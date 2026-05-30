import { api } from "./api";

export function fetchIrat() {
  return api<any[]>("/api/v1/analytics/institutional/irat");
}
export function fetchAlerts(page = 1, limit = 50) {
  return api<any[]>("/api/v1/analytics/institutional/alerts", {
    params: { page, limit },
  });
}
export function generateAlerts(tenantId: string) {
  return api<any>("/api/v1/analytics/institutional/alerts/generate", {
    method: "POST",
    body: { tenantId },
  });
}
export function acknowledgeAlert(alertId: string, acknowledgedBy: string) {
  return api<any>(`/api/v1/analytics/institutional/alerts/${alertId}/acknowledge`, {
    method: "PATCH",
    body: { acknowledgedBy },
  });
}
