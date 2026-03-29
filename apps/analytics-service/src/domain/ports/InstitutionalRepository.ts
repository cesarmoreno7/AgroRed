import type {
  IratScore,
  FoodProgram,
  FoodProgramCreateCommand,
  Beneficiary,
  BeneficiaryCreateCommand,
  InstitutionalAlert,
  CoordinationTask,
  ProgramCoverage,
  InstitutionalDashboard,
  SpoilageRecord,
  SpoilageCreateCommand,
  SpoilageSummary,
} from "../models/InstitutionalTypes.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AllocationScenario {
  id: string;
  tenantId: string;
  scenarioName: string;
  description: string | null;
  budgetTotal: number;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
  status: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface SupervisionData {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  recursosEnRuta: number;
  recursosDisponibles: number;
  entregasEnCurso: number;
  entregasHoy: number;
  incidenciasAbiertas: number;
  incidenciasCriticas: number;
  slaBreached: number;
  alertasPendientes: number;
}

export interface InstitutionalRepository {
  // IRAT
  getIratScores(tenantId?: string): Promise<IratScore[]>;

  // Food programs
  createProgram(cmd: FoodProgramCreateCommand): Promise<FoodProgram>;
  findProgramById(id: string): Promise<FoodProgram | null>;
  listPrograms(tenantId: string, params: PaginationParams): Promise<PaginatedResult<FoodProgram>>;
  updateProgramStatus(id: string, status: string): Promise<void>;

  // Beneficiaries
  createBeneficiary(cmd: BeneficiaryCreateCommand): Promise<Beneficiary>;
  findBeneficiaryById(id: string): Promise<Beneficiary | null>;
  listBeneficiaries(tenantId: string, params: PaginationParams, filter?: { programId?: string; riskClassification?: string; municipalityName?: string }): Promise<PaginatedResult<Beneficiary>>;

  // Institutional alerts
  listInstitutionalAlerts(tenantId: string, params: PaginationParams): Promise<PaginatedResult<InstitutionalAlert>>;
  acknowledgeInstitutionalAlert(alertId: string, acknowledgedBy: string): Promise<void>;
  generateAlerts(tenantId: string): Promise<InstitutionalAlert[]>;

  // Coordination tasks
  createCoordinationTask(task: Omit<CoordinationTask, "id" | "createdAt" | "updatedAt" | "completedAt">): Promise<CoordinationTask>;
  listCoordinationTasks(tenantId: string, params: PaginationParams): Promise<PaginatedResult<CoordinationTask>>;
  updateCoordinationTaskStatus(taskId: string, status: string): Promise<void>;

  // Program coverage
  getProgramCoverage(tenantId: string): Promise<ProgramCoverage[]>;

  // Dashboard
  getInstitutionalDashboard(tenantId?: string): Promise<InstitutionalDashboard>;

  // Simulation
  createAllocationScenario(scenario: { tenantId: string; scenarioName: string; description?: string; budgetTotal: number; parameters: Record<string, unknown>; createdBy?: string }): Promise<AllocationScenario>;
  listAllocationScenarios(tenantId: string): Promise<AllocationScenario[]>;
  runAllocationSimulation(scenarioId: string): Promise<AllocationScenario>;

  // Supervisión operativa
  getSupervisionData(tenantId?: string): Promise<SupervisionData[]>;

  // Dynamic alert thresholds
  getAlertThresholds(tenantId: string): Promise<InstitutionalAlertThreshold[]>;
  upsertAlertThreshold(tenantId: string, ruleKey: string, value: number, updatedBy?: string): Promise<InstitutionalAlertThreshold>;

  // Spoilage tracking
  createSpoilageRecord(cmd: SpoilageCreateCommand): Promise<SpoilageRecord>;
  listSpoilageRecords(tenantId: string, params: PaginationParams): Promise<PaginatedResult<SpoilageRecord>>;
  getSpoilageSummary(tenantId: string): Promise<SpoilageSummary[]>;
}

export interface InstitutionalAlertThreshold {
  id: string;
  tenantId: string;
  ruleKey: string;
  value: number;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}
