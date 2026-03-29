import type { AutomationRun, AutomationAction, AutomationMetricsSnapshot } from "../entities/AutomationRun.js";
import type { AutomationClassification } from "../value-objects/AutomationClassification.js";

export interface AutomationPlanningQuery {
  tenantKey: string;
  incidentId: string | null;
  logisticsOrderId: string | null;
}

export interface AutomationPlanningResult {
  tenantId: string;
  incidentId: string | null;
  logisticsOrderId: string | null;
  modelVersion: string;
  classification: AutomationClassification;
  actions: AutomationAction[];
  metricsSnapshot: AutomationMetricsSnapshot;
}

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

export interface AutomationRepository {
  planExecution(query: AutomationPlanningQuery): Promise<AutomationPlanningResult>;
  save(run: AutomationRun): Promise<void>;
  findById(id: string): Promise<AutomationRun | null>;
  list(params: PaginationParams, tenantKey?: string | null): Promise<PaginatedResult<AutomationRun>>;
}