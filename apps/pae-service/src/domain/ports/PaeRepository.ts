import type { PaeInspection } from "../entities/PaeInspection.js";
import type { PaeOperator, PaeOperatorInput } from "../entities/PaeOperator.js";
import type { PaeThresholds } from "../checklist/paeChecklistTemplate.js";

export interface PaeInspectionListFilter {
  /** Uno o varios tenants (rollup para supervisor_departamental). */
  tenantIds?: string[];
  operatorId?: string;
  institutionId?: string;
  inspectionKind?: string;
  result?: string;
  limit: number;
  offset: number;
}

/** Registro de inspección ya clasificado, listo para persistir. */
export interface PaeInspectionRecord {
  tenantId: string;
  operatorId: string | null;
  institutionId: string | null;
  foodProgramId: string | null;
  inspectionKind: string;
  inspectorRole: string | null;
  inspectorUserId: string | null;
  inspectorTenantId: string | null;
  inspectedAt: string;
  locationDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  portionWeightG: number | null;
  portionWeightExpectedG: number | null;
  temperatureC: number | null;
  coldChainOk: boolean | null;
  expiryCheckOk: boolean | null;
  earliestExpiryDate: string | null;
  hygieneScore: number | null;
  answers: Record<string, unknown>;
  failedItems: unknown[];
  result: string;
  status: "programada" | "completed";
  evidenceUrls: string[];
  notes: string | null;
  createdBy: string | null;
}

export interface PaeRepository {
  /** Lee las tolerancias `pae.*` de alert_thresholds para un tenant (merge con defaults). */
  getThresholds(tenantId: string): Promise<Partial<PaeThresholds>>;

  createOperator(input: PaeOperatorInput): Promise<PaeOperator>;
  listOperators(tenantIds: string[]): Promise<PaeOperator[]>;
  findOperatorById(id: string): Promise<PaeOperator | null>;

  createInspection(record: PaeInspectionRecord): Promise<PaeInspection>;
  listInspections(filter: PaeInspectionListFilter): Promise<{ data: PaeInspection[]; total: number }>;
  findInspectionById(id: string): Promise<PaeInspection | null>;
  updateInspectionNotes(id: string, notes: string | null, evidenceUrls: string[] | null): Promise<PaeInspection | null>;
}
