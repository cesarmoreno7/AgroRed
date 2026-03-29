import { randomUUID } from "node:crypto";
import { InventoryItem } from "../../domain/entities/InventoryItem.js";
import type { InventoryItemRepository } from "../../domain/ports/InventoryItemRepository.js";
import type { InventorySourceType } from "../../domain/value-objects/InventorySourceType.js";
import { INVENTORY_SOURCE_TYPES } from "../../domain/value-objects/InventorySourceType.js";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface CsvRowRaw {
  productName: string;
  category: string;
  unit: string;
  quantityOnHand: string;
  storageLocationName: string;
  expiresAt: string;
  sourceType?: string;
  notes?: string;
  latitude?: string;
  longitude?: string;
}

export interface ImportResult {
  importId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: RowError[];
  items: InventoryItem[];
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Parseo CSV  (sin dependencias externas)                            */
/* ------------------------------------------------------------------ */

const EXPECTED_HEADERS = [
  "productName", "category", "unit", "quantityOnHand",
  "storageLocationName", "expiresAt"
] as const;

const OPTIONAL_HEADERS = [
  "sourceType", "notes", "latitude", "longitude"
] as const;

export function parseCsvText(text: string): { rows: CsvRowRaw[]; headerError?: string } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], headerError: "El archivo debe tener al menos una fila de encabezados y una de datos." };
  }

  const headers = lines[0].split(",").map(h => h.trim());

  for (const required of EXPECTED_HEADERS) {
    if (!headers.includes(required)) {
      return { rows: [], headerError: `Falta columna obligatoria: ${required}` };
    }
  }

  const rows: CsvRowRaw[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(record as unknown as CsvRowRaw);
  }

  return { rows };
}

/** Split handling quoted fields */
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

function validateRow(raw: CsvRowRaw, rowIndex: number): { item: CsvRowRaw | null; errors: RowError[] } {
  const errors: RowError[] = [];

  if (!raw.productName || raw.productName.length < 2) {
    errors.push({ row: rowIndex, field: "productName", message: "Mínimo 2 caracteres." });
  }
  if (!raw.category || raw.category.length < 2) {
    errors.push({ row: rowIndex, field: "category", message: "Mínimo 2 caracteres." });
  }
  if (!raw.unit || raw.unit.length < 1) {
    errors.push({ row: rowIndex, field: "unit", message: "Requerido." });
  }

  const qty = Number(raw.quantityOnHand);
  if (isNaN(qty) || qty <= 0) {
    errors.push({ row: rowIndex, field: "quantityOnHand", message: "Debe ser un número positivo." });
  }

  if (!raw.storageLocationName || raw.storageLocationName.length < 3) {
    errors.push({ row: rowIndex, field: "storageLocationName", message: "Mínimo 3 caracteres." });
  }

  const expDate = new Date(raw.expiresAt);
  if (isNaN(expDate.getTime())) {
    errors.push({ row: rowIndex, field: "expiresAt", message: "Fecha inválida. Use formato ISO 8601 (YYYY-MM-DD)." });
  }

  if (raw.sourceType && !INVENTORY_SOURCE_TYPES.includes(raw.sourceType as InventorySourceType)) {
    errors.push({ row: rowIndex, field: "sourceType", message: `Valores permitidos: ${INVENTORY_SOURCE_TYPES.join(", ")}` });
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

  return errors.length > 0 ? { item: null, errors } : { item: raw, errors: [] };
}

/* ------------------------------------------------------------------ */
/*  Caso de uso                                                        */
/* ------------------------------------------------------------------ */

export class ImportNearExpiryItems {
  constructor(private readonly repository: InventoryItemRepository) {}

  async execute(
    csvText: string,
    tenantId: string,
    producerId: string,
    municipalityName: string
  ): Promise<ImportResult> {
    const { rows, headerError } = parseCsvText(csvText);

    if (headerError) {
      return {
        importId: randomUUID(),
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "headers", message: headerError }],
        items: []
      };
    }

    const allErrors: RowError[] = [];
    const validItems: InventoryItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { item, errors } = validateRow(rows[i], i + 2);  // +2: header=1, 0-indexed+1
      if (errors.length > 0) {
        allErrors.push(...errors);
        continue;
      }

      const raw = item!;
      validItems.push(
        new InventoryItem({
          id: randomUUID(),
          tenantId,
          producerId,
          offerId: null,
          rescueId: null,
          sourceType: (raw.sourceType as InventorySourceType) || "buffer_stock",
          storageLocationName: raw.storageLocationName,
          productName: raw.productName,
          category: raw.category,
          unit: raw.unit,
          quantityOnHand: Number(raw.quantityOnHand),
          quantityReserved: 0,
          municipalityName,
          notes: raw.notes || null,
          expiresAt: new Date(raw.expiresAt),
          latitude: raw.latitude ? Number(raw.latitude) : null,
          longitude: raw.longitude ? Number(raw.longitude) : null,
          status: "available"
        })
      );
    }

    if (validItems.length > 0) {
      await this.repository.saveBatch(validItems);
    }

    return {
      importId: randomUUID(),
      totalRows: rows.length,
      successCount: validItems.length,
      errorCount: allErrors.length,
      errors: allErrors,
      items: validItems
    };
  }
}
