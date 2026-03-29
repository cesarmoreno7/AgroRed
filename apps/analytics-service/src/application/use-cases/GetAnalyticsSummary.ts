import type { AnalyticsSummary } from "../../domain/models/AnalyticsSummary.js";
import type { AnalyticsRepository } from "../../domain/ports/AnalyticsRepository.js";

export class GetAnalyticsSummary {
  constructor(private readonly repository: AnalyticsRepository) {}

  execute(tenantKey?: string | null): Promise<AnalyticsSummary> {
    return this.repository.getSummary(tenantKey ?? null);
  }
}