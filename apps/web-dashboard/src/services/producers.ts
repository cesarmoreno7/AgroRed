import { api } from "./api";
import type { ApiResult } from "./api";

// ── Domain types ─────────────────────────────────────────────

export interface ProducerRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  producerType: string;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  municipalityName: string;
  zoneType: string;
  productCategories: string[];
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface ProductionRecord {
  temporada: string;
  cultivo: string;
  hectareas: number;
  toneladas: number;
  ingresos: number;
  costos: number;
  fechaCorte: string;
}

export interface ProducerStatsResponse {
  producer: ProducerRecord;
  stats: {
    totalOffers: number;
    activeOffers: number;
    totalRescues: number;
    totalKgRescued: number;
    lastActivityAt: string | null;
    historicalProduction: ProductionRecord[];
  };
}

// ── GeoJSON types ────────────────────────────────────────────

export interface ProducerMapProperties {
  id: string;
  nombre: string;
  tipo: string;
  contactName: string;
  contactPhone: string;
  productCategories: string[];
  status: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
}

export interface ProducerGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: ProducerMapProperties;
  }>;
}

export interface BboxParams {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// ── API functions ─────────────────────────────────────────────

export function fetchProducers(limit = 100): Promise<ApiResult<ProducerRecord[]>> {
  return api<ProducerRecord[]>("/api/v1/producers", { params: { limit } });
}

export function registerProducer(
  data: Partial<ProducerRecord> & { productCategories: string[] }
): Promise<ApiResult<ProducerRecord>> {
  return api<ProducerRecord>("/api/v1/producers/register", { method: "POST", body: data });
}

export function fetchProducersGeoJSON(bbox?: BboxParams): Promise<ApiResult<ProducerGeoJSON>> {
  const params: Record<string, number | undefined> = bbox
    ? { minLng: bbox.minLng, minLat: bbox.minLat, maxLng: bbox.maxLng, maxLat: bbox.maxLat }
    : {};
  return api<ProducerGeoJSON>("/api/v1/analytics/map/producers", { params });
}

export function fetchProducerStats(producerId: string): Promise<ApiResult<ProducerStatsResponse>> {
  return api<ProducerStatsResponse>(`/api/v1/producers/${producerId}/stats`);
}

export function updateProducer(id: string, data: Partial<ProducerRecord>): Promise<ApiResult<ProducerRecord>> {
  return api<ProducerRecord>(`/api/v1/producers/${id}`, { method: "PATCH", body: data });
}
