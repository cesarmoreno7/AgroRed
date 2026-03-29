import { randomUUID } from "node:crypto";
import { Producer } from "../../domain/entities/Producer.js";
import type { ProducerRepository } from "../../domain/ports/ProducerRepository.js";
import type { ProducerType, ProducerZone } from "../../domain/value-objects/ProducerType.js";
import { PRODUCER_TYPES, PRODUCER_ZONES } from "../../domain/value-objects/ProducerType.js";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface ProducerCsvRow {
  organizationName: string;
  contactName: string;
  contactPhone: string;
  producerType: string;
  zoneType: string;
  productCategories: string;
  municipalityName?: string;
  latitude?: string;
  longitude?: string;
}

export interface ImportProducersResult {
  importId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: RowError[];
  producers: Producer[];
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Parser CSV                                                         */
/* ------------------------------------------------------------------ */

const REQUIRED_HEADERS = [
  "organizationName", "contactName", "contactPhone",
  "producerType", "zoneType", "productCategories"
] as const;

export function parseCsvText(text: string): { rows: ProducerCsvRow[]; headerError?: string } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], headerError: "El archivo debe tener al menos una fila de encabezados y una de datos." };
  }

  const headers = lines[0].split(",").map(h => h.trim());

  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      return { rows: [], headerError: `Falta columna obligatoria: ${required}` };
    }
  }

  const rows: ProducerCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(record as unknown as ProducerCsvRow);
  }

  return { rows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Validación de fila                                                 */
/* ------------------------------------------------------------------ */

function validateRow(raw: ProducerCsvRow, rowIndex: number): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  if (!raw.organizationName || raw.organizationName.length < 3) {
    errors.push({ row: rowIndex, field: "organizationName", message: "Mínimo 3 caracteres." });
  }
  if (!raw.contactName || raw.contactName.length < 3) {
    errors.push({ row: rowIndex, field: "contactName", message: "Mínimo 3 caracteres." });
  }
  if (!raw.contactPhone || raw.contactPhone.length < 7) {
    errors.push({ row: rowIndex, field: "contactPhone", message: "Mínimo 7 caracteres." });
  }
  if (!PRODUCER_TYPES.includes(raw.producerType as ProducerType)) {
    errors.push({ row: rowIndex, field: "producerType", message: `Valores: ${PRODUCER_TYPES.join(", ")}` });
  }
  if (!PRODUCER_ZONES.includes(raw.zoneType as ProducerZone)) {
    errors.push({ row: rowIndex, field: "zoneType", message: `Valores: ${PRODUCER_ZONES.join(", ")}` });
  }

  const categories = raw.productCategories
    ? raw.productCategories.split(";").map(c => c.trim()).filter(c => c.length >= 2)
    : [];
  if (categories.length === 0) {
    errors.push({ row: rowIndex, field: "productCategories", message: "Al menos una categoría (separadas por ;)." });
  }

  if (raw.latitude !== undefined && raw.latitude !== "") {
    const lat = Number(raw.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push({ row: rowIndex, field: "latitude", message: "Debe estar entre -90 y 90." });
    }
  }
  if (raw.longitude !== undefined && raw.longitude !== "") {
    const lng = Number(raw.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push({ row: rowIndex, field: "longitude", message: "Debe estar entre -180 y 180." });
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/*  Caso de uso                                                        */
/* ------------------------------------------------------------------ */

export class ImportProducers {
  constructor(private readonly repository: ProducerRepository) {}

  async execute(csvText: string, tenantId: string, defaultMunicipality: string): Promise<ImportProducersResult> {
    const { rows, headerError } = parseCsvText(csvText);

    if (headerError) {
      return {
        importId: randomUUID(),
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "headers", message: headerError }],
        producers: []
      };
    }

    const allErrors: RowError[] = [];
    const validProducers: Producer[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { valid, errors } = validateRow(rows[i], i + 2);
      if (!valid) {
        allErrors.push(...errors);
        continue;
      }

      const raw = rows[i];
      const categories = raw.productCategories
        .split(";")
        .map(c => c.trim())
        .filter(c => c.length >= 2);

      validProducers.push(
        new Producer({
          id: randomUUID(),
          tenantId,
          userId: null,
          producerType: raw.producerType as ProducerType,
          organizationName: raw.organizationName,
          contactName: raw.contactName,
          contactPhone: raw.contactPhone,
          municipalityName: raw.municipalityName || defaultMunicipality,
          zoneType: raw.zoneType as ProducerZone,
          productCategories: categories,
          latitude: raw.latitude ? Number(raw.latitude) : null,
          longitude: raw.longitude ? Number(raw.longitude) : null,
          status: "pending_verification"
        })
      );
    }

    if (validProducers.length > 0) {
      await this.repository.saveBatch(validProducers);
    }

    return {
      importId: randomUUID(),
      totalRows: rows.length,
      successCount: validProducers.length,
      errorCount: allErrors.length,
      errors: allErrors,
      producers: validProducers
    };
  }
}
