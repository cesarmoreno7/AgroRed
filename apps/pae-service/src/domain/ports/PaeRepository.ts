import type { PaeInspection } from "../entities/PaeInspection.js";
import type { PaeOperator, PaeOperatorInput } from "../entities/PaeOperator.js";
import type { PaeRequerimiento, PaeRequerimientoInput, RequerimientoStatus } from "../entities/PaeRequerimiento.js";
import type {
  PaeCaeCommittee,
  PaeCaeCommitteeInput,
  PaeCaeReport,
  PaeCaeReportInput,
  CaeReportStatus
} from "../entities/PaeCae.js";
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

  // ── Requerimientos (Fase 2) ──
  createRequerimiento(input: PaeRequerimientoInput, dueDate: string): Promise<PaeRequerimiento>;
  findRequerimientoByInspectionId(inspectionId: string): Promise<PaeRequerimiento | null>;
  findRequerimientoByCaeReportId(caeReportId: string): Promise<PaeRequerimiento | null>;
  findRequerimientoById(id: string): Promise<PaeRequerimiento | null>;
  listRequerimientos(filter: PaeRequerimientoListFilter): Promise<{ data: PaeRequerimiento[]; total: number }>;
  backfillRequerimientoLinks(
    id: string,
    links: { institutionalAlertId?: string | null; coordinationTaskId?: string | null; firstNotifiedAt?: string | null }
  ): Promise<void>;
  updateRequerimientoResponse(
    id: string,
    data: { status: RequerimientoStatus; responseNotes: string | null }
  ): Promise<PaeRequerimiento | null>;
  closeRequerimiento(id: string, status: "subsanado" | "archivado"): Promise<PaeRequerimiento | null>;
  escalateRequerimientoToSanction(id: string): Promise<PaeRequerimiento | null>;

  // ── Sweep de vencidos + muestreo de auditorías (Fase 3) ──
  listOverdueRequerimientos(): Promise<PaeRequerimiento[]>;
  bumpRequerimientoEscalation(
    id: string,
    data: { escalationLevel: number; status: RequerimientoStatus; dueDate: string }
  ): Promise<void>;
  /** Crea stubs de pae_inspections (auditoria_aleatoria) para colegios de los municipios supervisados. */
  sampleRandomAudits(perSupervisor: number): Promise<{ created: number; runs: number }>;

  // ── Control social CAE (Fase 4) ──
  createCaeCommittee(input: PaeCaeCommitteeInput): Promise<PaeCaeCommittee>;
  rotateCaeCommitteeToken(id: string): Promise<PaeCaeCommittee | null>;
  listCaeCommittees(tenantIds: string[]): Promise<PaeCaeCommittee[]>;
  findCaeCommitteeByToken(token: string): Promise<PaeCaeCommittee | null>;
  /** Datos públicos del formulario (nombre del colegio + municipio) por token. */
  getPublicCaeForm(token: string): Promise<{ committeeId: string; tenantId: string; schoolName: string; municipality: string } | null>;
  createCaeReport(input: PaeCaeReportInput): Promise<PaeCaeReport>;
  findCaeReportById(id: string): Promise<PaeCaeReport | null>;
  listCaeReports(filter: { tenantIds?: string[]; status?: string; limit: number; offset: number }): Promise<{ data: PaeCaeReport[]; total: number }>;
  linkCaeReportRequerimiento(reportId: string, requerimientoId: string): Promise<void>;
  triageCaeReport(id: string, data: { status: CaeReportStatus; triageNotes: string | null; triagedBy: string | null }): Promise<PaeCaeReport | null>;
}

export interface PaeRequerimientoListFilter {
  tenantIds?: string[];
  status?: string;
  operatorId?: string;
  limit: number;
  offset: number;
}
