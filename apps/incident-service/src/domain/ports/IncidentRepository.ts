import type { Incident } from "../entities/Incident.js";
import type { IncidentStatus } from "../value-objects/IncidentStatus.js";

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

export interface IncidentListFilter {
  tenantId?: string;
  status?: IncidentStatus;
  severity?: string;
  incidentType?: string;
  municipalityName?: string;
}

export interface IncidentAction {
  id: string;
  incidentId: string;
  actionType: string;
  performedBy: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IncidentAlert {
  id: string;
  tenantId: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  zoneName: string | null;
  incidentCount: number;
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IncidentCluster {
  clusterId: number;
  centroidLat: number;
  centroidLng: number;
  incidentCount: number;
  avgSeverityScore: number;
  dominantType: string;
  affectedPopulation: number;
  incidentIds: string[];
}

export interface IncidentTrend {
  period: string;
  incidentType: string;
  severity: string;
  incidentCount: number;
  totalAffected: number;
  resolvedCount: number;
  avgResponseMin: number | null;
}

export interface ZoneSummary {
  municipalityName: string;
  incidentType: string;
  severity: string;
  total: number;
  openCount: number;
  inProgressCount: number;
  avgPriorityScore: number;
  lastReportedAt: Date;
}

export interface IncidentRepository {
  save(incident: Incident): Promise<void>;
  findById(id: string): Promise<Incident | null>;
  list(params: PaginationParams, filter?: IncidentListFilter): Promise<PaginatedResult<Incident>>;
  updateStatus(id: string, status: IncidentStatus, fields?: Partial<{
    assignedTo: string;
    resolutionNotes: string;
    resolvedAt: Date;
    escalatedAt: Date;
    interventionStartedAt: Date;
    priorityScore: number;
  }>): Promise<void>;
  // Actions
  saveAction(action: IncidentAction): Promise<void>;
  listActions(incidentId: string): Promise<IncidentAction[]>;
  // Alerts
  saveAlert(alert: IncidentAlert): Promise<void>;
  listAlerts(tenantId: string, params: PaginationParams): Promise<PaginatedResult<IncidentAlert>>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
  // Analytics
  getZoneSummary(tenantId: string): Promise<ZoneSummary[]>;
  countByZoneAndSeverity(tenantId: string): Promise<{ zone: string; severity: string; count: number }[]>;
  // Alert generation helpers
  countRecentByZone(tenantId: string, hoursBack: number): Promise<{ zone: string; count: number; criticalCount: number }[]>;
  countUnattended(tenantId: string, hoursThreshold: number): Promise<number>;
  // Spatial clustering (PostGIS)
  getIncidentClusters(tenantId: string, radiusM?: number, minPoints?: number): Promise<IncidentCluster[]>;
  // Trend analytics
  getIncidentTrends(tenantId: string, granularity?: "daily" | "weekly", limit?: number): Promise<IncidentTrend[]>;
  // Dynamic alert thresholds
  getAlertThresholds(tenantId: string): Promise<AlertThreshold[]>;
  upsertAlertThreshold(tenantId: string, ruleKey: string, value: number, updatedBy?: string): Promise<AlertThreshold>;
}

export interface AlertThreshold {
  id: string;
  tenantId: string;
  ruleKey: string;
  value: number;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}