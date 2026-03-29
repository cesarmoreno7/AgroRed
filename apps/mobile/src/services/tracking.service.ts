import { apiRequest } from "./api";
import { ENDPOINTS } from "../config/api";
import type {
  Resource,
  CurrentPosition,
  TrackingPointData,
  DeliveryEventRecord,
  DeliveryEvent,
} from "../types";

// ── Resources ──

export async function registerResource(data: {
  tenantId: string;
  nombre: string;
  tipo: string;
  placa?: string;
  telefono?: string;
  latitude?: number;
  longitude?: number;
}) {
  return apiRequest<Resource>(ENDPOINTS.resourceRegister, {
    method: "POST",
    body: data,
  });
}

export async function fetchResources(page = 1, limit = 20, tenantId?: string) {
  return apiRequest<{ items: Resource[]; total: number; page: number; limit: number }>(
    ENDPOINTS.resourceList,
    { params: { page, limit, tenantId } },
  );
}

export async function fetchResourceById(id: string) {
  return apiRequest<Resource>(ENDPOINTS.resourceById(id));
}

// ── GPS Tracking ──

export async function sendPosition(data: TrackingPointData) {
  return apiRequest<CurrentPosition>(ENDPOINTS.trackingPosition, {
    method: "POST",
    body: data,
  });
}

export async function sendBatchPositions(positions: TrackingPointData[]) {
  return apiRequest<{ recorded: number; failed: number }>(ENDPOINTS.trackingBatch, {
    method: "POST",
    body: positions,
  });
}

export async function fetchCurrentPosition(recursoId: string) {
  return apiRequest<CurrentPosition>(ENDPOINTS.trackingCurrent(recursoId));
}

export async function fetchActiveResources(tenantId?: string) {
  return apiRequest<CurrentPosition[]>(ENDPOINTS.trackingActive, {
    params: tenantId ? { tenantId } : undefined,
  });
}

export async function fetchTrackingHistory(recursoId: string, since?: string) {
  return apiRequest<TrackingPointData[]>(ENDPOINTS.trackingHistory(recursoId), {
    params: since ? { since } : undefined,
  });
}

export async function fetchRoute(ordenId: string) {
  return apiRequest<TrackingPointData[]>(ENDPOINTS.trackingRoute(ordenId));
}

// ── Delivery Events ──

export async function recordDeliveryEvent(data: {
  ordenId: string;
  recursoId: string;
  evento: DeliveryEvent;
  latitude?: number;
  longitude?: number;
  notas?: string;
  evidenciaUrl?: string;
}) {
  return apiRequest<DeliveryEventRecord[]>(ENDPOINTS.deliveryEvents, {
    method: "POST",
    body: data,
  });
}

export async function fetchDeliveryTimeline(ordenId: string) {
  return apiRequest<DeliveryEventRecord[]>(ENDPOINTS.deliveryTimeline(ordenId));
}

// ── Assignment ──

export async function assignResource(ordenId: string, recursoId: string) {
  return apiRequest<{ message: string }>(ENDPOINTS.assignResource(ordenId), {
    method: "POST",
    body: { recursoId },
  });
}
