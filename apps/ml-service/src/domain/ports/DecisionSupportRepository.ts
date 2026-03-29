import type { MlDecisionSupportReport } from "../models/DecisionSupport.js";

export interface DecisionSupportRepository {
  getDecisionSupport(tenantKey?: string | null): Promise<MlDecisionSupportReport>;
}