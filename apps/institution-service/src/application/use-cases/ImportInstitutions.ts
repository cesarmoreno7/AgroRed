import { randomUUID } from "node:crypto";
import { Institution } from "../../domain/entities/Institution.js";
import type { InstitutionRepository } from "../../domain/ports/InstitutionRepository.js";
import type { InstitutionType } from "../../domain/value-objects/InstitutionType.js";
import { INSTITUTION_TYPES } from "../../domain/value-objects/InstitutionType.js";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface InstitutionCsvRow {
  institutionType: string;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  municipalityName?: string;
  address?: string;
  beneficiaryCount: string;
  productCategories: string;
  latitude?: string;
  longitude?: string;
  notes?: string;
}

export interface ImportInstitutionsResult {
  importId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: RowError[];
  institutions: Institution[];
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
  "institutionType", "name", "contactName", "contactPhone",
  "beneficiaryCount", "productCategories"
] as const;

function parseCsvText(text: string): { rows: InstitutionCsvRow[]; headerError?: string } {
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

  const rows: InstitutionCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(record as unknown as InstitutionCsvRow);
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

function validateRow(raw: InstitutionCsvRow, rowIndex: number): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  if (!INSTITUTION_TYPES.includes(raw.institutionType as InstitutionType)) {
    errors.push({ row: rowIndex, field: "institutionType", message: `Valores: ${INSTITUTION_TYPES.join(", ")}` });
  }
  if (!raw.name || raw.name.length < 3) {
    errors.push({ row: rowIndex, field: "name", message: "Mínimo 3 caracteres." });
  }
  if (!raw.contactName || raw.contactName.length < 3) {
    errors.push({ row: rowIndex, field: "contactName", message: "Mínimo 3 caracteres." });
  }
  if (!raw.contactPhone || raw.contactPhone.length < 7) {
    errors.push({ row: rowIndex, field: "contactPhone", message: "Mínimo 7 caracteres." });
  }

  const count = parseInt(raw.beneficiaryCount, 10);
  if (isNaN(count) || count < 1) {
    errors.push({ row: rowIndex, field: "beneficiaryCount", message: "Debe ser un entero >= 1." });
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

export class ImportInstitutions {
  constructor(private readonly repository: InstitutionRepository) {}

  async execute(
    csvText: string,
    tenantId: string,
    defaultMunicipality: string,
    createdBy: string | null = null
  ): Promise<ImportInstitutionsResult> {
    const { rows, headerError } = parseCsvText(csvText);

    if (headerError) {
      return {
        importId: randomUUID(),
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "headers", message: headerError }],
        institutions: []
      };
    }

    const allErrors: RowError[] = [];
    const validInstitutions: Institution[] = [];

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

      validInstitutions.push(
        new Institution({
          id: randomUUID(),
          tenantId,
          institutionType: raw.institutionType as InstitutionType,
          name: raw.name,
          contactName: raw.contactName,
          contactPhone: raw.contactPhone,
          contactEmail: raw.contactEmail || null,
          municipalityName: raw.municipalityName || defaultMunicipality,
          address: raw.address || null,
          beneficiaryCount: parseInt(raw.beneficiaryCount, 10),
          productCategories: categories,
          latitude: raw.latitude ? Number(raw.latitude) : null,
          longitude: raw.longitude ? Number(raw.longitude) : null,
          notes: raw.notes || null,
          createdBy,
          status: "pending_verification"
        })
      );
    }

    if (validInstitutions.length > 0) {
      await this.repository.saveBatch(validInstitutions);
    }

    return {
      importId: randomUUID(),
      totalRows: rows.length,
      successCount: validInstitutions.length,
      errorCount: allErrors.length,
      errors: allErrors,
      institutions: validInstitutions
    };
  }
}
