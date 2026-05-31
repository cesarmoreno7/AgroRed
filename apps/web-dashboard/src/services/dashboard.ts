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

// Adapts the GeoJSON resource layer from the analytics map endpoint
// to the CurrentPosition[] shape used by the ActiveFleet component.
export async function fetchActiveResources(_tenantId?: string) {
  const res = await api<{
    type: string;
    features: Array<{
      geometry: { coordinates: [number, number] };
      properties: {
        id: string; nombre: string; tipo: string; estado: string;
        velocidad: number | null; ordenActualId: string | null;
        ultimaActualizacion: string | null;
      };
    }>;
  }>("/api/v1/analytics/map/resources");

  if (!res.ok) return { ok: false as const, status: res.status, code: res.code, message: res.message };

  const positions: CurrentPosition[] = (res.data.features ?? []).map(f => ({
    recursoId:      f.properties.id,
    nombre:         f.properties.nombre,
    tipo:           f.properties.tipo,
    estado:         f.properties.estado,
    latitude:       f.geometry.coordinates[1],
    longitude:      f.geometry.coordinates[0],
    velocidad:      f.properties.velocidad,
    bearing:        null,
    evento:         "posicion",
    ordenId:        f.properties.ordenActualId,
    actualizadoAt:  f.properties.ultimaActualizacion ?? new Date().toISOString(),
  }));

  return { ok: true as const, status: 200, data: positions };
}
