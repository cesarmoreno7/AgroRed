export type MlClassification = "stable" | "watch" | "critical";
export type MlRecommendationPriority = "high" | "medium" | "low";

export interface MlDecisionInputs {
  activeOffers: number;
  openDemandUnits: number;
  availableInventoryUnits: number;
  reservedInventoryUnits: number;
  scheduledRescues: number;
  scheduledLogistics: number;
  openIncidents: number;
  pendingNotifications: number;
}

export interface MlDecisionScores {
  supplyCoverageScore: number;
  logisticsStabilityScore: number;
  incidentPressureScore: number;
  readinessScore: number;
}

export interface MlDecisionSupportReport {
  tenantId: string | null;
  tenantCode: string | null;
  tenantName: string | null;
  modelVersion: string;
  classification: MlClassification;
  inputs: MlDecisionInputs;
  scores: MlDecisionScores;
  generatedAt: string;
}

export interface MlRecommendation {
  priority: MlRecommendationPriority;
  actionCode: string;
  title: string;
  rationale: string;
}

export interface MlRecommendationsReport {
  tenantId: string | null;
  tenantCode: string | null;
  tenantName: string | null;
  modelVersion: string;
  classification: MlClassification;
  recommendations: MlRecommendation[];
  generatedAt: string;
}