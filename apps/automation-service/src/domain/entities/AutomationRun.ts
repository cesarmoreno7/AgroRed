import type { AutomationClassification } from "../value-objects/AutomationClassification.js";
import type { AutomationRunStatus } from "../value-objects/AutomationRunStatus.js";
import type { AutomationTriggerSource } from "../value-objects/AutomationTriggerSource.js";

export type AutomationActionPriority = "high" | "medium" | "low";

export interface AutomationMetricsInputs {
  activeOffers: number;
  openDemandUnits: number;
  availableInventoryUnits: number;
  reservedInventoryUnits: number;
  scheduledRescues: number;
  scheduledLogistics: number;
  openIncidents: number;
  pendingNotifications: number;
}

export interface AutomationMetricsScores {
  supplyCoverageScore: number;
  logisticsStabilityScore: number;
  incidentPressureScore: number;
  readinessScore: number;
}

export interface AutomationMetricsSnapshot {
  inputs: AutomationMetricsInputs;
  scores: AutomationMetricsScores;
}

export interface AutomationAction {
  priority: AutomationActionPriority;
  actionCode: string;
  title: string;
  rationale: string;
}

export interface AutomationRunProps {
  id: string;
  tenantId: string;
  incidentId: string | null;
  logisticsOrderId: string | null;
  triggerSource: AutomationTriggerSource;
  modelVersion: string;
  classification: AutomationClassification;
  status: AutomationRunStatus;
  actions: AutomationAction[];
  metricsSnapshot: AutomationMetricsSnapshot;
  notes?: string | null;
  createdAt?: Date;
}

export class AutomationRun {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly incidentId: string | null;
  public readonly logisticsOrderId: string | null;
  public readonly triggerSource: AutomationTriggerSource;
  public readonly modelVersion: string;
  public readonly classification: AutomationClassification;
  public readonly status: AutomationRunStatus;
  public readonly actions: AutomationAction[];
  public readonly metricsSnapshot: AutomationMetricsSnapshot;
  public readonly notes: string | null;
  public readonly createdAt: Date;

  constructor(props: AutomationRunProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.incidentId = props.incidentId;
    this.logisticsOrderId = props.logisticsOrderId;
    this.triggerSource = props.triggerSource;
    this.modelVersion = props.modelVersion;
    this.classification = props.classification;
    this.status = props.status;
    this.actions = props.actions.map((action) => ({ ...action }));
    this.metricsSnapshot = {
      inputs: { ...props.metricsSnapshot.inputs },
      scores: { ...props.metricsSnapshot.scores }
    };
    this.notes = props.notes?.trim() || null;
    this.createdAt = props.createdAt ?? new Date();
  }
}