import { api, buildApiUrl, getToken } from "./api";

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

// ── Ley 2046/2020 — Cumplimiento de compra local ──

export function fetchLey2046(tenantId?: string) {
  return api<any[]>("/api/v1/analytics/institutional/ley2046", {
    params: tenantId ? { tenantId } : undefined,
  });
}

export function generateLey2046Alerts(tenantId: string) {
  return api<any>("/api/v1/analytics/institutional/ley2046/alerts/generate", {
    method: "POST",
    body: { tenantId },
  });
}

/** Descarga el reporte de cumplimiento Ley 2046 (CSV o PDF) autenticado con el JWT actual. */
export async function downloadLey2046Report(tenantId: string, format: "csv" | "pdf"): Promise<boolean> {
  const url = buildApiUrl("/api/v1/analytics/institutional/ley2046", { tenantId, format });
  const token = getToken();
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return false;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `cumplimiento_ley2046.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    return false;
  }
}
