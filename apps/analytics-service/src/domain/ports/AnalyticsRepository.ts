import type { AnalyticsSummary, TerritorialOverviewItem } from "../models/AnalyticsSummary.js";

export interface AnalyticsRepository {
  getSummary(tenantKey?: string | null): Promise<AnalyticsSummary>;
  getTerritorialOverview(): Promise<TerritorialOverviewItem[]>;
}