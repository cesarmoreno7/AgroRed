import type { MlDecisionSupportReport } from "../../domain/models/DecisionSupport.js";
import type { DecisionSupportRepository } from "../../domain/ports/DecisionSupportRepository.js";

export class GetDecisionSupport {
  constructor(private readonly repository: DecisionSupportRepository) {}

  execute(tenantKey?: string | null): Promise<MlDecisionSupportReport> {
    return this.repository.getDecisionSupport(tenantKey ?? null);
  }
}