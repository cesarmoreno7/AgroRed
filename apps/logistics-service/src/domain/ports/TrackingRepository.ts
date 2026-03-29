import type { Resource } from "../entities/Resource.js";
import type { TrackingPoint } from "../entities/TrackingPoint.js";
import type { DeliveryEvent, ResourceStatus, TrackingEvent } from "../value-objects/TrackingTypes.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CurrentPosition {
  recursoId: string;
  nombre: string;
  tipo: string;
  estado: ResourceStatus;
  latitude: number;
  longitude: number;
  velocidad: number | null;
  bearing: number | null;
  evento: TrackingEvent;
  ordenId: string | null;
  actualizadoAt: Date;
}

export interface DeliveryEventRecord {
  id: number;
  ordenId: string;
  recursoId: string;
  recursoNombre: string;
  evento: DeliveryEvent;
  latitude: number | null;
  longitude: number | null;
  notas: string | null;
  evidenciaUrl: string | null;
  registradoAt: Date;
}

export interface GeofenceZone {
  id: string;
  tenantId: string;
  zoneName: string;
  zoneType: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface GeofenceCheckResult {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  isInside: boolean;
}

export interface EtaEstimate {
  recursoId: string;
  avgSpeedKmh: number;
  distanceKm: number;
  estimatedMinutes: number;
  confidence: "high" | "medium" | "low";
}

export interface TrackingRepository {
  // Resources
  saveResource(resource: Resource): Promise<void>;
  findResourceById(id: string): Promise<Resource | null>;
  listResources(params: PaginationParams, tenantId?: string): Promise<PaginatedResult<Resource>>;
  updateResourceStatus(id: string, estado: ResourceStatus): Promise<void>;

  // GPS Tracking
  recordPosition(point: TrackingPoint): Promise<void>;
  getCurrentPosition(recursoId: string): Promise<CurrentPosition | null>;
  getActivePositions(tenantId?: string): Promise<CurrentPosition[]>;
  getTrackingHistory(recursoId: string, since?: Date): Promise<TrackingPoint[]>;
  getRouteForOrder(ordenId: string): Promise<TrackingPoint[]>;

  // Delivery Events
  recordDeliveryEvent(event: {
    ordenId: string;
    recursoId: string;
    evento: DeliveryEvent;
    latitude?: number | null;
    longitude?: number | null;
    notas?: string | null;
    evidenciaUrl?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  getOrderTimeline(ordenId: string): Promise<DeliveryEventRecord[]>;

  // Assignment
  assignResourceToOrder(ordenId: string, recursoId: string): Promise<void>;

  // Geofencing
  saveGeofenceZone(zone: { tenantId: string; zoneName: string; zoneType: string; centerLat: number; centerLng: number; radiusM: number; metadata?: Record<string, unknown> }): Promise<GeofenceZone>;
  listGeofenceZones(tenantId: string): Promise<GeofenceZone[]>;
  checkPositionInZones(tenantId: string, lat: number, lng: number): Promise<GeofenceCheckResult[]>;
  logGeofenceEvent(zoneId: string, recursoId: string, eventType: string, lat: number, lng: number): Promise<void>;

  // ETA
  estimateEta(recursoId: string, destLat: number, destLng: number): Promise<EtaEstimate>;
}
