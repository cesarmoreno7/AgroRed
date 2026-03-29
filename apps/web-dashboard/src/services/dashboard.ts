import { api } from "./api";
import type { AnalyticsSummary, TerritorialOverviewItem, CurrentPosition, LoginResponse } from "../types";

export function login(email: string, password: string) {
  return api<LoginResponse>("/api/v1/users/login", { method: "POST", body: { email, password } });
}

export function fetchSummary(tenantId?: string) {
  return api<AnalyticsSummary>("/api/v1/analytics/summary", {
    params: tenantId ? { tenantId } : undefined,
  });
}

export function fetchTerritorialOverview() {
  return api<TerritorialOverviewItem[]>("/api/v1/analytics/territorial-overview");
}

export function fetchActiveResources(tenantId?: string) {
  return api<CurrentPosition[]>("/api/v1/logistics/tracking/active", {
    params: tenantId ? { tenantId } : undefined,
  });
}
