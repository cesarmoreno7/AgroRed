import { randomUUID } from "node:crypto";
import type { InstitutionalRepository } from "../../domain/ports/InstitutionalRepository.js";
import type { FoodProgram, FoodProgramCreateCommand } from "../../domain/models/InstitutionalTypes.js";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface ProgramCsvRow {
  name: string;
  programType: string;
  description?: string;
  targetPopulation?: string;
  budgetAllocated?: string;
  responsibleName?: string;
  responsibleEmail?: string;
  municipalityName?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface ImportProgramsResult {
  importId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: RowError[];
  programs: FoodProgram[];
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Parser CSV                                                         */
/* ------------------------------------------------------------------ */

const VALID_PROGRAM_TYPES = [
  "comedor_comunitario",
  "programa_escolar",
  "ayuda_humanitaria",
  "subsidio_alimentario"
] as const;

const REQUIRED_HEADERS = ["name", "programType"] as const;

export function parseCsvText(text: string): { rows: ProgramCsvRow[]; headerError?: string } {
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

  const rows: ProgramCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(record as unknown as ProgramCsvRow);
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

function validateRow(raw: ProgramCsvRow, rowIndex: number): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  if (!raw.name || raw.name.length < 3) {
    errors.push({ row: rowIndex, field: "name", message: "Mínimo 3 caracteres." });
  }

  if (!VALID_PROGRAM_TYPES.includes(raw.programType as typeof VALID_PROGRAM_TYPES[number])) {
    errors.push({
      row: rowIndex,
      field: "programType",
      message: `Valores permitidos: ${VALID_PROGRAM_TYPES.join(", ")}`
    });
  }

  if (raw.targetPopulation !== undefined && raw.targetPopulation !== "") {
    const pop = Number(raw.targetPopulation);
    if (isNaN(pop) || pop < 0 || !Number.isInteger(pop)) {
      errors.push({ row: rowIndex, field: "targetPopulation", message: "Debe ser un entero >= 0." });
    }
  }

  if (raw.budgetAllocated !== undefined && raw.budgetAllocated !== "") {
    const budget = Number(raw.budgetAllocated);
    if (isNaN(budget) || budget < 0) {
      errors.push({ row: rowIndex, field: "budgetAllocated", message: "Debe ser >= 0." });
    }
  }

  if (raw.responsibleEmail && raw.responsibleEmail !== "") {
    if (!raw.responsibleEmail.includes("@")) {
      errors.push({ row: rowIndex, field: "responsibleEmail", message: "Formato de correo inválido." });
    }
  }

  if (raw.startsAt && raw.startsAt !== "") {
    if (isNaN(new Date(raw.startsAt).getTime())) {
      errors.push({ row: rowIndex, field: "startsAt", message: "Fecha inválida (YYYY-MM-DD)." });
    }
  }
  if (raw.endsAt && raw.endsAt !== "") {
    if (isNaN(new Date(raw.endsAt).getTime())) {
      errors.push({ row: rowIndex, field: "endsAt", message: "Fecha inválida (YYYY-MM-DD)." });
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/*  Caso de uso                                                        */
/* ------------------------------------------------------------------ */

export class ImportFoodPrograms {
  constructor(private readonly repository: InstitutionalRepository) {}

  async execute(
    csvText: string,
    tenantId: string,
    defaultMunicipality: string
  ): Promise<ImportProgramsResult> {
    const { rows, headerError } = parseCsvText(csvText);

    if (headerError) {
      return {
        importId: randomUUID(),
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "headers", message: headerError }],
        programs: []
      };
    }

    const allErrors: RowError[] = [];
    const created: FoodProgram[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { valid, errors } = validateRow(rows[i], i + 2);
      if (!valid) {
        allErrors.push(...errors);
        continue;
      }

      const raw = rows[i];
      const cmd: FoodProgramCreateCommand = {
        tenantId,
        name: raw.name,
        programType: raw.programType,
        description: raw.description || undefined,
        targetPopulation: raw.targetPopulation ? Number(raw.targetPopulation) : 0,
        budgetAllocated: raw.budgetAllocated ? Number(raw.budgetAllocated) : 0,
        responsibleName: raw.responsibleName || undefined,
        responsibleEmail: raw.responsibleEmail || undefined,
        municipalityName: raw.municipalityName || defaultMunicipality,
        startsAt: raw.startsAt || undefined,
        endsAt: raw.endsAt || undefined,
      };

      try {
        const program = await this.repository.createProgram(cmd);
        created.push(program);
      } catch (err) {
        allErrors.push({
          row: i + 2,
          field: "db",
          message: err instanceof Error ? err.message : "Error desconocido al guardar."
        });
      }
    }

    return {
      importId: randomUUID(),
      totalRows: rows.length,
      successCount: created.length,
      errorCount: allErrors.length,
      errors: allErrors,
      programs: created
    };
  }
}
