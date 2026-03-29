import { apiRequest } from "./api";
import { ENDPOINTS } from "../config/api";
import type { AnalyticsSummary, TerritorialOverviewItem } from "../types";

export async function fetchAnalyticsSummary(tenantId?: string) {
  return apiRequest<AnalyticsSummary>(ENDPOINTS.analyticsSummary, {
    params: tenantId ? { tenantId } : undefined,
  });
}

export async function fetchTerritorialOverview() {
  return apiRequest<TerritorialOverviewItem[]>(ENDPOINTS.territorialOverview);
}
