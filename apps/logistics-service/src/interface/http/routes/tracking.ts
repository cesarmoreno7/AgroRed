import { Router } from "express";
import { z } from "zod";
import { RegisterResource } from "../../../application/use-cases/RegisterResource.js";
import { RecordPosition } from "../../../application/use-cases/RecordPosition.js";
import { RecordDeliveryEventUseCase } from "../../../application/use-cases/RecordDeliveryEvent.js";
import { AssignResource } from "../../../application/use-cases/AssignResource.js";
import type { Resource } from "../../../domain/entities/Resource.js";
import type { TrackingPoint } from "../../../domain/entities/TrackingPoint.js";
import type { TrackingRepository, CurrentPosition, DeliveryEventRecord, GeofenceZone, GeofenceCheckResult, EtaEstimate } from "../../../domain/ports/TrackingRepository.js";
import { RESOURCE_TYPES } from "../../../domain/value-objects/TrackingTypes.js";
import { DELIVERY_EVENTS, TRACKING_EVENTS } from "../../../domain/value-objects/TrackingTypes.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

// ── Schemas ──

const registerResourceSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().uuid().optional().nullable(),
  nombre: z.string().min(2),
  tipo: z.enum(RESOURCE_TYPES),
  placa: z.string().max(20).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const recordPositionSchema = z.object({
  recursoId: z.string().uuid(),
  ordenId: z.string().uuid().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  velocidad: z.coerce.number().min(0).optional().nullable(),
  precisionGps: z.coerce.number().min(0).optional().nullable(),
  bearing: z.coerce.number().min(0).max(360).optional().nullable(),
  evento: z.enum(TRACKING_EVENTS).optional().default("posicion"),
  metadata: z.record(z.unknown()).optional(),
});

const batchPositionSchema = z.array(recordPositionSchema).min(1).max(100);

const deliveryEventSchema = z.object({
  ordenId: z.string().uuid(),
  recursoId: z.string().uuid(),
  evento: z.enum(DELIVERY_EVENTS),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  evidenciaUrl: z.string().url().max(2048).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const assignResourceSchema = z.object({
  recursoId: z.string().uuid(),
});

const createGeofenceSchema = z.object({
  tenantId: z.string().min(1),
  zoneName: z.string().min(2),
  zoneType: z.enum(["delivery", "restricted", "warehouse", "critical"]).default("delivery"),
  centerLat: z.coerce.number().min(-90).max(90),
  centerLng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().min(10).max(50000),
  metadata: z.record(z.unknown()).optional(),
});

const checkGeofenceSchema = z.object({
  tenantId: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const etaSchema = z.object({
  destLat: z.coerce.number().min(-90).max(90),
  destLng: z.coerce.number().min(-180).max(180),
});

// ── Response mappers ──

function toResourceResponse(r: Resource) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    userId: r.userId,
    nombre: r.nombre,
    tipo: r.tipo,
    placa: r.placa,
    telefono: r.telefono,
    estado: r.estado,
    latitude: r.latitude,
    longitude: r.longitude,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toPositionResponse(p: CurrentPosition) {
  return {
    recursoId: p.recursoId,
    nombre: p.nombre,
    tipo: p.tipo,
    estado: p.estado,
    latitude: p.latitude,
    longitude: p.longitude,
    velocidad: p.velocidad,
    bearing: p.bearing,
    evento: p.evento,
    ordenId: p.ordenId,
    actualizadoAt: p.actualizadoAt.toISOString(),
  };
}

function toTrackingPointResponse(tp: TrackingPoint) {
  return {
    id: tp.id,
    recursoId: tp.recursoId,
    ordenId: tp.ordenId,
    latitude: tp.latitude,
    longitude: tp.longitude,
    velocidad: tp.velocidad,
    precisionGps: tp.precisionGps,
    bearing: tp.bearing,
    evento: tp.evento,
    registradoAt: tp.registradoAt.toISOString(),
  };
}

function toDeliveryEventResponse(de: DeliveryEventRecord) {
  return {
    id: de.id,
    ordenId: de.ordenId,
    recursoId: de.recursoId,
    recursoNombre: de.recursoNombre,
    evento: de.evento,
    latitude: de.latitude,
    longitude: de.longitude,
    notas: de.notas,
    evidenciaUrl: de.evidenciaUrl,
    registradoAt: de.registradoAt.toISOString(),
  };
}

// ── Router ──

export function createTrackingRouter(repository: TrackingRepository): Router {
  const router = Router();
  const registerResource = new RegisterResource(repository);
  const recordPosition = new RecordPosition(repository);
  const recordDeliveryEvent = new RecordDeliveryEventUseCase(repository);
  const assignResource = new AssignResource(repository);

  // ═══════════════════════════════════════════
  // RESOURCES (vehículos / domiciliarios)
  // ═══════════════════════════════════════════

  // POST /api/v1/logistics/resources/register
  router.post("/api/v1/logistics/resources/register", asyncHandler(async (req, res) => {
    const parsed = registerResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_RESOURCE_PAYLOAD", "Payload invalido para registro de recurso logistico.");
    }

    try {
      const resource = await registerResource.execute(parsed.data);
      return sendSuccess(res, toResourceResponse(resource), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "RESOURCE_REGISTRATION_FAILED", "No fue posible registrar el recurso.");
    }
  }));

  // GET /api/v1/logistics/resources
  router.get("/api/v1/logistics/resources", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;

    try {
      const result = await repository.listResources({ page, limit }, tenantId);
      return sendPaginatedSuccess(res, result.data.map(toResourceResponse), {
        total: result.total, page: result.page, limit: result.limit,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "RESOURCES_LIST_FAILED", "No fue posible listar recursos.");
    }
  }));

  // GET /api/v1/logistics/resources/:id
  router.get("/api/v1/logistics/resources/:id", asyncHandler(async (req, res) => {
    const resource = await repository.findResourceById(String(req.params.id));
    if (!resource) {
      return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso logistico no encontrado.");
    }
    return sendSuccess(res, toResourceResponse(resource));
  }));

  // ═══════════════════════════════════════════
  // GPS TRACKING (posiciones en tiempo real)
  // ═══════════════════════════════════════════

  // POST /api/v1/logistics/tracking/position
  // Single position update (from React Native app)
  router.post("/api/v1/logistics/tracking/position", asyncHandler(async (req, res) => {
    const parsed = recordPositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_POSITION_PAYLOAD", "Payload invalido. Requeridos: recursoId, latitude, longitude.");
    }

    try {
      const position = await recordPosition.execute(parsed.data);
      return sendSuccess(res, toPositionResponse(position), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso logistico no encontrado.");
      }
      return sendError(res, 500, "POSITION_RECORD_FAILED", "No fue posible registrar la posicion.");
    }
  }));

  // POST /api/v1/logistics/tracking/positions/batch
  // Batch position upload (buffered points from React Native when offline)
  router.post("/api/v1/logistics/tracking/positions/batch", asyncHandler(async (req, res) => {
    const parsed = batchPositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_BATCH_PAYLOAD", "Payload invalido. Envie un array de posiciones (max 100).");
    }

    const results: { recorded: number; failed: number } = { recorded: 0, failed: 0 };

    for (const positionData of parsed.data) {
      try {
        await recordPosition.execute(positionData);
        results.recorded++;
      } catch {
        results.failed++;
      }
    }

    return sendSuccess(res, results, 201);
  }));

  // GET /api/v1/logistics/tracking/current/:recursoId
  router.get("/api/v1/logistics/tracking/current/:recursoId", asyncHandler(async (req, res) => {
    const position = await repository.getCurrentPosition(String(req.params.recursoId));
    if (!position) {
      return sendError(res, 404, "POSITION_NOT_FOUND", "No hay posicion registrada para este recurso.");
    }
    return sendSuccess(res, toPositionResponse(position));
  }));

  // GET /api/v1/logistics/tracking/active
  // All resources currently en_ruta (for map view)
  router.get("/api/v1/logistics/tracking/active", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;

    try {
      const positions = await repository.getActivePositions(tenantId);
      return sendSuccess(res, positions.map(toPositionResponse));
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ACTIVE_POSITIONS_FAILED", "No fue posible obtener posiciones activas.");
    }
  }));

  // GET /api/v1/logistics/tracking/history/:recursoId
  router.get("/api/v1/logistics/tracking/history/:recursoId", asyncHandler(async (req, res) => {
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;

    if (since && isNaN(since.getTime())) {
      return sendError(res, 400, "INVALID_DATE", "Fecha 'since' invalida. Use formato ISO 8601.");
    }

    const history = await repository.getTrackingHistory(String(req.params.recursoId), since);
    return sendSuccess(res, history.map(toTrackingPointResponse));
  }));

  // GET /api/v1/logistics/tracking/route/:ordenId
  // Full GPS route for one delivery order
  router.get("/api/v1/logistics/tracking/route/:ordenId", asyncHandler(async (req, res) => {
    const route = await repository.getRouteForOrder(String(req.params.ordenId));
    return sendSuccess(res, route.map(toTrackingPointResponse));
  }));

  // ═══════════════════════════════════════════
  // DELIVERY EVENTS (lifecycle de entregas)
  // ═══════════════════════════════════════════

  // POST /api/v1/logistics/deliveries/events
  router.post("/api/v1/logistics/deliveries/events", asyncHandler(async (req, res) => {
    const parsed = deliveryEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_DELIVERY_EVENT", "Payload invalido para evento de entrega.");
    }

    try {
      const timeline = await recordDeliveryEvent.execute(parsed.data);
      return sendSuccess(res, timeline.map(toDeliveryEventResponse), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso logistico no encontrado.");
      }
      return sendError(res, 500, "DELIVERY_EVENT_FAILED", "No fue posible registrar el evento de entrega.");
    }
  }));

  // GET /api/v1/logistics/deliveries/:ordenId/timeline
  router.get("/api/v1/logistics/deliveries/:ordenId/timeline", asyncHandler(async (req, res) => {
    const timeline = await repository.getOrderTimeline(String(req.params.ordenId));
    return sendSuccess(res, timeline.map(toDeliveryEventResponse));
  }));

  // ═══════════════════════════════════════════
  // ASSIGNMENT (recurso ↔ orden)
  // ═══════════════════════════════════════════

  // POST /api/v1/logistics/:ordenId/assign
  router.post("/api/v1/logistics/:ordenId/assign", asyncHandler(async (req, res) => {
    const parsed = assignResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ASSIGNMENT", "Se requiere recursoId (UUID).");
    }

    try {
      await assignResource.execute(String(req.params.ordenId), parsed.data.recursoId);
      return sendSuccess(res, { message: "Recurso asignado exitosamente." });
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso logistico no encontrado.");
      }
      if (error instanceof Error && error.message === "RESOURCE_NOT_AVAILABLE") {
        return sendError(res, 409, "RESOURCE_NOT_AVAILABLE", "El recurso no esta disponible para asignacion.");
      }
      if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
        return sendError(res, 404, "ORDER_NOT_FOUND", "Orden logistica no encontrada.");
      }
      return sendError(res, 500, "ASSIGNMENT_FAILED", "No fue posible asignar el recurso.");
    }
  }));

  // ═══════════════════════════════════════════
  // GEOFENCING (zonas PostGIS)
  // ═══════════════════════════════════════════

  // POST /api/v1/logistics/geofences — create geofence zone
  router.post("/api/v1/logistics/geofences", asyncHandler(async (req, res) => {
    const parsed = createGeofenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_GEOFENCE_PAYLOAD", "Payload invalido para crear geocerca.");
    }
    try {
      const zone = await repository.saveGeofenceZone(parsed.data);
      return sendSuccess(res, zone, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "GEOFENCE_CREATION_FAILED", "No fue posible crear la geocerca.");
    }
  }));

  // GET /api/v1/logistics/geofences — list geofence zones
  router.get("/api/v1/logistics/geofences", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    try {
      const zones = await repository.listGeofenceZones(tenantId);
      return sendSuccess(res, zones);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "GEOFENCE_LIST_FAILED", "No fue posible listar geocercas.");
    }
  }));

  // POST /api/v1/logistics/geofences/check — check if position is inside any zone
  router.post("/api/v1/logistics/geofences/check", asyncHandler(async (req, res) => {
    const parsed = checkGeofenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CHECK_PAYLOAD", "Payload invalido. Se requiere tenantId, latitude, longitude.");
    }
    try {
      const results = await repository.checkPositionInZones(parsed.data.tenantId, parsed.data.latitude, parsed.data.longitude);
      const inside = results.filter(r => r.isInside);
      return sendSuccess(res, { totalZones: results.length, insideZones: inside.length, zones: results });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "GEOFENCE_CHECK_FAILED", "No fue posible verificar la geocerca.");
    }
  }));

  // ═══════════════════════════════════════════
  // ETA ESTIMATION (estimación de llegada)
  // ═══════════════════════════════════════════

  // GET /api/v1/logistics/tracking/eta/:recursoId — estimate time of arrival
  router.get("/api/v1/logistics/tracking/eta/:recursoId", asyncHandler(async (req, res) => {
    const parsed = etaSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ETA_QUERY", "Se requiere ?destLat=&destLng= para estimar ETA.");
    }
    try {
      const eta = await repository.estimateEta(String(req.params.recursoId), parsed.data.destLat, parsed.data.destLng);
      return sendSuccess(res, eta);
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso logistico no encontrado o sin posicion actual.");
      }
      return sendError(res, 500, "ETA_ESTIMATION_FAILED", "No fue posible estimar el tiempo de llegada.");
    }
  }));

  return router;
}
