import { ImportFoodPrograms, parseCsvText } from "./ImportFoodPrograms.js";
import type { InstitutionalRepository } from "../../domain/ports/InstitutionalRepository.js";
import type {
  FoodProgram,
  FoodProgramCreateCommand,
  CoordinationTask,
  SpoilageRecord,
  SpoilageSummary
} from "../../domain/models/InstitutionalTypes.js";
import type { InstitutionalAlertThreshold } from "../../domain/ports/InstitutionalRepository.js";
import { randomUUID } from "node:crypto";

/* ------------------------------------------------------------------ */
/*  Stub Repository (only createProgram is used by the use-case)       */
/* ------------------------------------------------------------------ */

const empty = { data: [] as any[], total: 0, page: 1, limit: 20 };

class StubInstitutionalRepository implements InstitutionalRepository {
  public created: FoodProgram[] = [];

  async createProgram(cmd: FoodProgramCreateCommand): Promise<FoodProgram> {
    const program: FoodProgram = {
      id: randomUUID(),
      tenantId: cmd.tenantId,
      name: cmd.name,
      programType: cmd.programType,
      description: cmd.description ?? null,
      targetPopulation: cmd.targetPopulation ?? 0,
      currentCoverage: 0,
      budgetAllocated: cmd.budgetAllocated ?? 0,
      budgetExecuted: 0,
      responsibleName: cmd.responsibleName ?? null,
      responsibleEmail: cmd.responsibleEmail ?? null,
      municipalityName: cmd.municipalityName,
      status: "active",
      startsAt: cmd.startsAt ?? null,
      endsAt: cmd.endsAt ?? null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.created.push(program);
    return program;
  }

  /* ---- stubs required by interface ---- */
  async getIratScores(): Promise<any[]> { return []; }
  async findProgramById(): Promise<FoodProgram | null> { return null; }
  async listPrograms(): Promise<any> { return empty; }
  async updateProgramStatus(): Promise<void> { /* noop */ }
  async createBeneficiary(): Promise<any> { return {} as any; }
  async findBeneficiaryById(): Promise<any> { return null; }
  async listBeneficiaries(): Promise<any> { return empty; }
  async listInstitutionalAlerts(): Promise<any> { return empty; }
  async acknowledgeInstitutionalAlert(): Promise<void> { /* noop */ }
  async generateAlerts(): Promise<any[]> { return []; }
  async listCoordinationTasks(): Promise<any> { return empty; }
  async createCoordinationTask(): Promise<CoordinationTask> { return {} as CoordinationTask; }
  async updateCoordinationTaskStatus(): Promise<void> { /* noop */ }
  async getProgramCoverage(): Promise<any[]> { return []; }
  async getInstitutionalDashboard(): Promise<any> { return {}; }
  async createAllocationScenario(): Promise<any> { return {}; }
  async listAllocationScenarios(): Promise<any[]> { return []; }
  async runAllocationSimulation(): Promise<any> { return {}; }
  async getSupervisionData(): Promise<any[]> { return []; }
  async getAlertThresholds(): Promise<InstitutionalAlertThreshold[]> { return []; }
  async upsertAlertThreshold(): Promise<InstitutionalAlertThreshold> { return {} as InstitutionalAlertThreshold; }
  async createSpoilageRecord(): Promise<SpoilageRecord> { return {} as SpoilageRecord; }
  async listSpoilageRecords(): Promise<any> { return empty; }
  async getSpoilageSummary(): Promise<SpoilageSummary[]> { return []; }
}

/* ------------------------------------------------------------------ */
/*  Tests: parseCsvText                                                */
/* ------------------------------------------------------------------ */

describe("parseCsvText (food programs)", () => {
  it("parses valid CSV with required headers", () => {
    const csv = [
      "name,programType",
      "Comedor Centro,comedor_comunitario"
    ].join("\n");
    const { rows, headerError } = parseCsvText(csv);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Comedor Centro");
    expect(rows[0].programType).toBe("comedor_comunitario");
  });

  it("returns header error when required column is missing", () => {
    const csv = "name\nComedor";
    const { headerError } = parseCsvText(csv);
    expect(headerError).toContain("programType");
  });

  it("returns header error for empty file", () => {
    const { headerError } = parseCsvText("");
    expect(headerError).toBeDefined();
  });

  it("handles CRLF endings", () => {
    const csv = "name,programType\r\nEscuela PAE,programa_escolar";
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: ImportFoodPrograms use-case                                 */
/* ------------------------------------------------------------------ */

describe("ImportFoodPrograms use-case", () => {
  let repository: StubInstitutionalRepository;
  let useCase: ImportFoodPrograms;

  beforeEach(() => {
    repository = new StubInstitutionalRepository();
    useCase = new ImportFoodPrograms(repository);
  });

  const fullCsv = [
    "name,programType,description,targetPopulation,budgetAllocated,responsibleName,responsibleEmail,municipalityName,startsAt,endsAt",
    "Comedor La Esperanza,comedor_comunitario,Alimentación diaria,200,5000000,Ana Torres,ana@gov.co,Tuluá,2025-01-01,2025-12-31",
    "PAE Escuela Central,programa_escolar,Programa escolar,350,8000000,Pedro Ruiz,pedro@edu.co,Buga,2025-02-01,2025-11-30",
    "Ayuda Zonas Rurales,ayuda_humanitaria,Entrega alimentos,100,3000000,María López,maria@ngo.org,Cali,2025-03-01,"
  ].join("\n");

  it("imports all valid rows", async () => {
    const result = await useCase.execute(fullCsv, "t-1", "DefaultMuni");
    expect(result.totalRows).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(repository.created).toHaveLength(3);
  });

  it("passes tenantId and municipalityName correctly", async () => {
    const csv = [
      "name,programType",
      "Comedor Norte,comedor_comunitario"
    ].join("\n");
    const result = await useCase.execute(csv, "tenant-x", "Palmira");
    expect(result.programs[0].tenantId).toBe("tenant-x");
    expect(result.programs[0].municipalityName).toBe("Palmira");
  });

  it("uses row municipalityName when present over default", async () => {
    const csv = [
      "name,programType,municipalityName",
      "Comedor Sur,comedor_comunitario,Buga"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.programs[0].municipalityName).toBe("Buga");
  });

  it("rejects invalid programType", async () => {
    const csv = [
      "name,programType",
      "Programa Raro,tipo_invalido"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe("programType");
  });

  it("rejects invalid email format", async () => {
    const csv = [
      "name,programType,responsibleEmail",
      "Comedor X,comedor_comunitario,noemail"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe("responsibleEmail");
  });

  it("validates targetPopulation is a valid integer", async () => {
    const csv = [
      "name,programType,targetPopulation",
      "Comedor Z,comedor_comunitario,-5"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.errors.some((e) => e.field === "targetPopulation")).toBe(true);
  });

  it("validates startsAt as a valid date", async () => {
    const csv = [
      "name,programType,startsAt",
      "Comedor W,comedor_comunitario,not-a-date"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.errors.some((e) => e.field === "startsAt")).toBe(true);
  });

  it("returns header error for missing columns", async () => {
    const result = await useCase.execute("col1,col2\na,b", "t-1", "Tuluá");
    expect(result.successCount).toBe(0);
    expect(result.errors[0].field).toBe("headers");
  });

  it("generates unique import IDs", async () => {
    const csv = "name,programType\nComedor A,comedor_comunitario";
    const r1 = await useCase.execute(csv, "t-1", "Tuluá");
    const r2 = await useCase.execute(csv, "t-1", "Tuluá");
    expect(r1.importId).not.toBe(r2.importId);
  });
});
