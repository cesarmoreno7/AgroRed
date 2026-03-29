import type { Pool } from "pg";
import { Resource } from "../../domain/entities/Resource.js";
import { TrackingPoint } from "../../domain/entities/TrackingPoint.js";
import type {
  TrackingRepository,
  PaginationParams,
  PaginatedResult,
  CurrentPosition,
  DeliveryEventRecord,
  GeofenceZone,
  GeofenceCheckResult,
  EtaEstimate,
} from "../../domain/ports/TrackingRepository.js";
import type {
  ResourceType,
  ResourceStatus,
  TrackingEvent,
  DeliveryEvent,
} from "../../domain/value-objects/TrackingTypes.js";

// ── Row interfaces ──────────────────────────────────────────

interface ResourceRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nombre: string;
  tipo: ResourceType;
  placa: string | null;
  telefono: string | null;
  estado: ResourceStatus;
  latitude: string | null;
  longitude: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface CurrentPositionRow {
  recurso_id: string;
  nombre: string;
  tipo: string;
  estado: ResourceStatus;
  latitude: string;
  longitude: string;
  velocidad: string | null;
  bearing: string | null;
  evento: TrackingEvent;
  orden_id: string | null;
  actualizado_at: Date;
}

interface TrackingHistoryRow {
  id: number;
  recurso_id: string;
  orden_id: string | null;
  latitude: string;
  longitude: string;
  velocidad: string | null;
  precision_gps: string | null;
  bearing: string | null;
  evento: TrackingEvent;
  metadata: Record<string, unknown>;
  registrado_at: Date;
}

interface DeliveryEventRow {
  id: number;
  orden_id: string;
  recurso_id: string;
  recurso_nombre: string;
  evento: DeliveryEvent;
  latitude: string | null;
  longitude: string | null;
  notas: string | null;
  evidencia_url: string | null;
  registrado_at: Date;
}

// ── Repository ──────────────────────────────────────────────

export class PostgresTrackingRepository implements TrackingRepository {
  constructor(private readonly pool: Pool) {}

  // ── Resources ──

  async saveResource(resource: Resource): Promise<void> {
    const tenantId = await this.resolveTenantId(resource.tenantId);

    await this.pool.query(
      `
        INSERT INTO public.recursos (
          id, tenant_id, user_id, nombre, tipo, placa, telefono,
          estado, latitude, longitude, geom, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          CASE WHEN $9 IS NOT NULL AND $10 IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($10::double precision, $9::double precision), 4326)
            ELSE NULL
          END,
          $11
        )
      `,
      [
        resource.id,
        tenantId,
        resource.userId,
        resource.nombre,
        resource.tipo,
        resource.placa,
        resource.telefono,
        resource.estado,
        resource.latitude,
        resource.longitude,
        JSON.stringify(resource.metadata),
      ]
    );
  }

  async findResourceById(id: string): Promise<Resource | null> {
    const result = await this.pool.query<ResourceRow>(
      `
        SELECT id, tenant_id, user_id, nombre, tipo, placa, telefono,
               estado, latitude, longitude, metadata, created_at, updated_at
        FROM public.recursos
        WHERE id = $1 AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapResourceRow(result.rows[0]) : null;
  }

  async listResources(params: PaginationParams, tenantId?: string): Promise<PaginatedResult<Resource>> {
    const offset = (params.page - 1) * params.limit;
    const resolvedTenantId = tenantId ? await this.resolveTenantId(tenantId) : null;

    const whereClause = resolvedTenantId
      ? "WHERE deleted_at IS NULL AND tenant_id = $3"
      : "WHERE deleted_at IS NULL";
    const queryParams = resolvedTenantId
      ? [params.limit, offset, resolvedTenantId]
      : [params.limit, offset];

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.recursos ${whereClause.replace("$3", "$1")}`,
      resolvedTenantId ? [resolvedTenantId] : []
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<ResourceRow>(
      `
        SELECT id, tenant_id, user_id, nombre, tipo, placa, telefono,
               estado, latitude, longitude, metadata, created_at, updated_at
        FROM public.recursos
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
      queryParams
    );

    return {
      data: result.rows.map((r) => this.mapResourceRow(r)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async updateResourceStatus(id: string, estado: ResourceStatus): Promise<void> {
    await this.pool.query(
      `UPDATE public.recursos SET estado = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id, estado]
    );
  }

  // ── GPS Tracking ──

  async recordPosition(point: TrackingPoint): Promise<void> {
    // 1. Insert into history
    await this.pool.query(
      `
        INSERT INTO public.tracking_historial (
          recurso_id, orden_id, latitude, longitude, geom,
          velocidad, precision_gps, bearing, evento, metadata, registrado_at
        )
        VALUES (
          $1, $2, $3, $4,
          ST_SetSRID(ST_MakePoint($5::double precision, $3::double precision), 4326),
          $6, $7, $8, $9, $10, $11
        )
      `,
      [
        point.recursoId,
        point.ordenId,
        point.latitude,
        point.longitude,
        point.longitude, // $5 for MakePoint(lng, lat)
        point.velocidad,
        point.precisionGps,
        point.bearing,
        point.evento,
        JSON.stringify(point.metadata),
        point.registradoAt,
      ]
    );

    // 2. Upsert current position
    await this.pool.query(
      `
        INSERT INTO public.tracking_actual (
          recurso_id, latitude, longitude, geom,
          velocidad, bearing, evento, orden_id, actualizado_at
        )
        VALUES (
          $1, $2, $3,
          ST_SetSRID(ST_MakePoint($4::double precision, $2::double precision), 4326),
          $5, $6, $7, $8, NOW()
        )
        ON CONFLICT (recurso_id)
        DO UPDATE SET
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          geom = EXCLUDED.geom,
          velocidad = EXCLUDED.velocidad,
          bearing = EXCLUDED.bearing,
          evento = EXCLUDED.evento,
          orden_id = EXCLUDED.orden_id,
          actualizado_at = NOW()
      `,
      [
        point.recursoId,
        point.latitude,
        point.longitude,
        point.longitude, // $4 for MakePoint(lng, lat)
        point.velocidad,
        point.bearing,
        point.evento,
        point.ordenId,
      ]
    );

    // 3. Update resource's lat/lon
    await this.pool.query(
      `
        UPDATE public.recursos
        SET latitude = $2, longitude = $3,
            geom = ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326),
            updated_at = NOW()
        WHERE id = $1
      `,
      [point.recursoId, point.latitude, point.longitude]
    );
  }

  async getCurrentPosition(recursoId: string): Promise<CurrentPosition | null> {
    const result = await this.pool.query<CurrentPositionRow>(
      `
        SELECT
          ta.recurso_id,
          r.nombre,
          r.tipo,
          r.estado,
          ta.latitude::text,
          ta.longitude::text,
          ta.velocidad::text,
          ta.bearing::text,
          ta.evento,
          ta.orden_id,
          ta.actualizado_at
        FROM public.tracking_actual ta
        JOIN public.recursos r ON r.id = ta.recurso_id
        WHERE ta.recurso_id = $1 AND r.deleted_at IS NULL
      `,
      [recursoId]
    );

    return result.rows[0] ? this.mapCurrentPosition(result.rows[0]) : null;
  }

  async getActivePositions(tenantId?: string): Promise<CurrentPosition[]> {
    const resolvedTenantId = tenantId ? await this.resolveTenantId(tenantId) : null;
    const whereClause = resolvedTenantId ? "AND r.tenant_id = $1" : "";
    const params = resolvedTenantId ? [resolvedTenantId] : [];

    const result = await this.pool.query<CurrentPositionRow>(
      `
        SELECT
          ta.recurso_id,
          r.nombre,
          r.tipo,
          r.estado,
          ta.latitude::text,
          ta.longitude::text,
          ta.velocidad::text,
          ta.bearing::text,
          ta.evento,
          ta.orden_id,
          ta.actualizado_at
        FROM public.tracking_actual ta
        JOIN public.recursos r ON r.id = ta.recurso_id
        WHERE r.deleted_at IS NULL AND r.estado = 'en_ruta' ${whereClause}
        ORDER BY ta.actualizado_at DESC
      `,
      params
    );

    return result.rows.map((r) => this.mapCurrentPosition(r));
  }

  async getTrackingHistory(recursoId: string, since?: Date): Promise<TrackingPoint[]> {
    const sinceClause = since ? "AND registrado_at >= $2" : "";
    const params: unknown[] = [recursoId];
    if (since) params.push(since);

    const result = await this.pool.query<TrackingHistoryRow>(
      `
        SELECT id, recurso_id, orden_id, latitude::text, longitude::text,
               velocidad::text, precision_gps::text, bearing::text,
               evento, metadata, registrado_at
        FROM public.tracking_historial
        WHERE recurso_id = $1 ${sinceClause}
        ORDER BY registrado_at ASC
      `,
      params
    );

    return result.rows.map((r) => this.mapTrackingRow(r));
  }

  async getRouteForOrder(ordenId: string): Promise<TrackingPoint[]> {
    const result = await this.pool.query<TrackingHistoryRow>(
      `
        SELECT id, recurso_id, orden_id, latitude::text, longitude::text,
               velocidad::text, precision_gps::text, bearing::text,
               evento, metadata, registrado_at
        FROM public.tracking_historial
        WHERE orden_id = $1
        ORDER BY registrado_at ASC
      `,
      [ordenId]
    );

    return result.rows.map((r) => this.mapTrackingRow(r));
  }

  // ── Delivery Events ──

  async recordDeliveryEvent(event: {
    ordenId: string;
    recursoId: string;
    evento: DeliveryEvent;
    latitude?: number | null;
    longitude?: number | null;
    notas?: string | null;
    evidenciaUrl?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO public.delivery_events (
          orden_id, recurso_id, evento, latitude, longitude, geom,
          notas, evidencia_url, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5,
          CASE WHEN $4 IS NOT NULL AND $5 IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)
            ELSE NULL
          END,
          $6, $7, $8
        )
      `,
      [
        event.ordenId,
        event.recursoId,
        event.evento,
        event.latitude ?? null,
        event.longitude ?? null,
        event.notas ?? null,
        event.evidenciaUrl ?? null,
        JSON.stringify(event.metadata ?? {}),
      ]
    );
  }

  async getOrderTimeline(ordenId: string): Promise<DeliveryEventRecord[]> {
    const result = await this.pool.query<DeliveryEventRow>(
      `
        SELECT
          de.id,
          de.orden_id,
          de.recurso_id,
          r.nombre AS recurso_nombre,
          de.evento,
          de.latitude::text,
          de.longitude::text,
          de.notas,
          de.evidencia_url,
          de.registrado_at
        FROM public.delivery_events de
        JOIN public.recursos r ON de.recurso_id = r.id
        WHERE de.orden_id = $1
        ORDER BY de.registrado_at ASC
      `,
      [ordenId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      ordenId: r.orden_id,
      recursoId: r.recurso_id,
      recursoNombre: r.recurso_nombre,
      evento: r.evento,
      latitude: r.latitude !== null ? Number(r.latitude) : null,
      longitude: r.longitude !== null ? Number(r.longitude) : null,
      notas: r.notas,
      evidenciaUrl: r.evidencia_url,
      registradoAt: r.registrado_at,
    }));
  }

  // ── Assignment ──

  async assignResourceToOrder(ordenId: string, recursoId: string): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE public.logistics_orders
        SET recurso_id = $2
        WHERE id = $1 AND deleted_at IS NULL
      `,
      [ordenId, recursoId]
    );

    if (result.rowCount === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }
  }

  // ── Geofencing ──

  async saveGeofenceZone(zone: { tenantId: string; zoneName: string; zoneType: string; centerLat: number; centerLng: number; radiusM: number; metadata?: Record<string, unknown> }): Promise<GeofenceZone> {
    const tenantId = await this.resolveTenantId(zone.tenantId);
    const result = await this.pool.query<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO public.geofence_zones (tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m,
        geom, metadata)
       VALUES ($1, $2, $3, $4, $5, $6,
        ST_Buffer(
          ST_Transform(ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326), 3116),
          $6::double precision
        )::geometry(Polygon, 3116),
        $7)
       RETURNING id, created_at, updated_at`,
      [tenantId, zone.zoneName, zone.zoneType, zone.centerLat, zone.centerLng, zone.radiusM, JSON.stringify(zone.metadata ?? {})]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      tenantId,
      zoneName: zone.zoneName,
      zoneType: zone.zoneType,
      centerLat: zone.centerLat,
      centerLng: zone.centerLng,
      radiusM: zone.radiusM,
      isActive: true,
      metadata: zone.metadata ?? {},
      createdAt: row.created_at,
    };
  }

  async listGeofenceZones(tenantId: string): Promise<GeofenceZone[]> {
    const tid = await this.resolveTenantId(tenantId);
    const result = await this.pool.query<{
      id: string; tenant_id: string; zone_name: string; zone_type: string;
      center_lat: string | null; center_lng: string | null; radius_m: string;
      is_active: boolean; metadata: Record<string, unknown>; created_at: Date;
    }>(
      `SELECT id, tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m, is_active, metadata, created_at
       FROM public.geofence_zones WHERE tenant_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [tid]
    );
    return result.rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      zoneName: r.zone_name,
      zoneType: r.zone_type,
      centerLat: r.center_lat ? Number(r.center_lat) : null,
      centerLng: r.center_lng ? Number(r.center_lng) : null,
      radiusM: Number(r.radius_m),
      isActive: r.is_active,
      metadata: r.metadata ?? {},
      createdAt: r.created_at,
    }));
  }

  async checkPositionInZones(tenantId: string, lat: number, lng: number): Promise<GeofenceCheckResult[]> {
    const tid = await this.resolveTenantId(tenantId);
    const result = await this.pool.query<{
      id: string; zone_name: string; zone_type: string; is_inside: boolean;
    }>(
      `SELECT gz.id, gz.zone_name, gz.zone_type,
              ST_Contains(
                gz.geom,
                ST_Transform(ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326), 3116)
              ) AS is_inside
       FROM public.geofence_zones gz
       WHERE gz.tenant_id = $1 AND gz.is_active = TRUE`,
      [tid, lng, lat]
    );
    return result.rows.map(r => ({
      zoneId: r.id,
      zoneName: r.zone_name,
      zoneType: r.zone_type,
      isInside: r.is_inside,
    }));
  }

  async logGeofenceEvent(zoneId: string, recursoId: string, eventType: string, lat: number, lng: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.geofence_events (zone_id, recurso_id, event_type, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)`,
      [zoneId, recursoId, eventType, lat, lng]
    );
  }

  // ── ETA Estimation ──

  async estimateEta(recursoId: string, destLat: number, destLng: number): Promise<EtaEstimate> {
    // Get current position
    const posResult = await this.pool.query<{ latitude: string; longitude: string }>(
      `SELECT latitude::text, longitude::text FROM public.tracking_actual WHERE recurso_id = $1`,
      [recursoId]
    );
    if (!posResult.rows[0]) throw new Error("RESOURCE_NOT_FOUND");

    const curLat = Number(posResult.rows[0].latitude);
    const curLng = Number(posResult.rows[0].longitude);

    // Calculate straight-line distance using PostGIS (meters, then km)
    const distResult = await this.pool.query<{ distance_km: string }>(
      `SELECT ROUND(
        (ST_Distance(
          ST_Transform(ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326), 3116),
          ST_Transform(ST_SetSRID(ST_MakePoint($3::double precision, $4::double precision), 4326), 3116)
        ) * 1.3 / 1000)::numeric, 2)::text AS distance_km`,
      [curLng, curLat, destLng, destLat]
    );
    const distanceKm = Number(distResult.rows[0].distance_km);

    // Get average speed from recent history (last 7 days)
    const speedResult = await this.pool.query<{ avg_speed: string | null; total_points: string }>(
      `SELECT AVG(velocidad) FILTER (WHERE velocidad > 0 AND velocidad < 120) AS avg_speed,
              COUNT(*)::text AS total_points
       FROM public.tracking_historial
       WHERE recurso_id = $1 AND registrado_at >= NOW() - INTERVAL '7 days'`,
      [recursoId]
    );

    const avgSpeed = speedResult.rows[0].avg_speed ? Number(speedResult.rows[0].avg_speed) : 25;
    const totalPoints = Number(speedResult.rows[0].total_points);
    const confidence: "high" | "medium" | "low" = totalPoints > 100 ? "high" : totalPoints > 20 ? "medium" : "low";

    const estimatedMinutes = Math.round((distanceKm / avgSpeed) * 60);

    return {
      recursoId,
      avgSpeedKmh: Math.round(avgSpeed * 10) / 10,
      distanceKm,
      estimatedMinutes: Math.max(1, estimatedMinutes),
      confidence,
    };
  }

  // ── Helpers ──

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );
    if (!result.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return result.rows[0].id;
  }

  private mapResourceRow(row: ResourceRow): Resource {
    return new Resource({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      nombre: row.nombre,
      tipo: row.tipo,
      placa: row.placa,
      telefono: row.telefono,
      estado: row.estado,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapCurrentPosition(row: CurrentPositionRow): CurrentPosition {
    return {
      recursoId: row.recurso_id,
      nombre: row.nombre,
      tipo: row.tipo,
      estado: row.estado,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      velocidad: row.velocidad !== null ? Number(row.velocidad) : null,
      bearing: row.bearing !== null ? Number(row.bearing) : null,
      evento: row.evento,
      ordenId: row.orden_id,
      actualizadoAt: row.actualizado_at,
    };
  }

  private mapTrackingRow(row: TrackingHistoryRow): TrackingPoint {
    return new TrackingPoint({
      id: row.id,
      recursoId: row.recurso_id,
      ordenId: row.orden_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      velocidad: row.velocidad !== null ? Number(row.velocidad) : null,
      precisionGps: row.precision_gps !== null ? Number(row.precision_gps) : null,
      bearing: row.bearing !== null ? Number(row.bearing) : null,
      evento: row.evento,
      metadata: row.metadata ?? {},
      registradoAt: row.registrado_at,
    });
  }
}
