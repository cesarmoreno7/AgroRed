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
  /** Offers created in the last 30 days vs. the 30 days before that — real historical signal, not a snapshot. */
  offersLast30: number;
  offersPrior30: number;
  /** Demands opened in the last 30 days vs. the 30 days before that. */
  demandsLast30: number;
  demandsPrior30: number;
}

export interface MlDecisionScores {
  supplyCoverageScore: number;
  logisticsStabilityScore: number;
  incidentPressureScore: number;
  /** 0-100, higher = supply/demand balance is improving over the last 30d vs. the prior 30d. */
  trendScore: number;
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