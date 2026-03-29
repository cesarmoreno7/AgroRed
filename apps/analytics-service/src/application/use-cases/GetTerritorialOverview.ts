import type { TerritorialOverviewItem } from "../../domain/models/AnalyticsSummary.js";
import type { AnalyticsRepository } from "../../domain/ports/AnalyticsRepository.js";

export class GetTerritorialOverview {
  constructor(private readonly repository: AnalyticsRepository) {}

  execute(): Promise<TerritorialOverviewItem[]> {
    return this.repository.getTerritorialOverview();
  }
}