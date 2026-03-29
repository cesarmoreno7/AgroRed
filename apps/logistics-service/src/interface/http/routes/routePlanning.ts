import { Router } from "express";
import { z } from "zod";
import { CreateRoutePlan } from "../../../application/use-cases/CreateRoutePlan.js";
import { AddRouteStop } from "../../../application/use-cases/AddRouteStop.js";
import { OptimizeRoute } from "../../../application/use-cases/OptimizeRoute.js";
import { ConsolidateStops } from "../../../application/use-cases/ConsolidateStops.js";
import { SolveVrp } from "../../../application/use-cases/SolveVrp.js";
import type { RoutePlan } from "../../../domain/entities/RoutePlan.js";
import type { RouteStop } from "../../../domain/entities/RouteStop.js";
import type { RoutePlanRepository } from "../../../domain/ports/RoutePlanRepository.js";
import type { RoadRoutingService } from "../../../domain/ports/RoadRoutingService.js";
import { PLAN_TYPES, STOP_TYPES, PLAN_STATUSES, STOP_STATUSES } from "../../../domain/value-objects/RoutePlanTypes.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

// ── Schemas ──

const createPlanSchema = z.object({
  tenantId: z.string().min(1),
  planName: z.string().min(3),
  planType: z.enum(PLAN_TYPES),
  recursoId: z.string().uuid().optional().nullable(),
  maxCapacityKg: z.coerce.number().min(0).optional().default(0),
  windowStart: z.string().optional().nullable(),
  windowEnd: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const addStopSchema = z.object({
  stopType: z.enum(STOP_TYPES),
  locationName: z.string().min(2),
  address: z.string().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  logisticsOrderId: z.string().uuid().optional().nullable(),
  estimatedArrival: z.string().optional().nullable(),
  estimatedDeparture: z.string().optional().nullable(),
  loadKg: z.coerce.number().min(0).optional().default(0),
  notes: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const reorderSchema = z.object({
  stopIds: z.array(z.string().uuid()).min(1),
});

// ── Response mappers ──

function toPlanResponse(plan: RoutePlan) {
  return {
    id: plan.id,
    tenantId: plan.tenantId,
    planName: plan.planName,
    planType: plan.planType,
    recursoId: plan.recursoId,
    totalStops: plan.totalStops,
    totalDistanceKm: plan.totalDistanceKm,
    estimatedDurationMin: plan.estimatedDurationMin,
    totalLoadKg: plan.totalLoadKg,
    maxCapacityKg: plan.maxCapacityKg,
    windowStart: plan.windowStart?.toISOString() ?? null,
    windowEnd: plan.windowEnd?.toISOString() ?? null,
    status: plan.status,
    optimizationScore: plan.optimizationScore,
    notes: plan.notes,
    metadata: plan.metadata,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toStopResponse(stop: RouteStop) {
  return {
    id: stop.id,
    routePlanId: stop.routePlanId,
    stopOrder: stop.stopOrder,
    stopType: stop.stopType,
    locationName: stop.locationName,
    address: stop.address,
    latitude: stop.latitude,
    longitude: stop.longitude,
    logisticsOrderId: stop.logisticsOrderId,
    estimatedArrival: stop.estimatedArrival?.toISOString() ?? null,
    actualArrival: stop.actualArrival?.toISOString() ?? null,
    estimatedDeparture: stop.estimatedDeparture?.toISOString() ?? null,
    actualDeparture: stop.actualDeparture?.toISOString() ?? null,
    loadKg: stop.loadKg,
    status: stop.status,
    notes: stop.notes,
    metadata: stop.metadata,
    createdAt: stop.createdAt.toISOString(),
  };
}

// ── Router ──

export function createRoutePlanningRouter(
  repository: RoutePlanRepository,
  roadRouting?: RoadRoutingService | null,
): Router {
  const router = Router();
  const createRoutePlan = new CreateRoutePlan(repository);
  const addRouteStop = new AddRouteStop(repository);
  const optimizeRoute = new OptimizeRoute(repository, roadRouting);
  const consolidateStops = new ConsolidateStops(repository);

  // ══════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════

  router.get("/api/v1/logistics/analytics/active-routes", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const routes = await repository.getActiveRoutes(tenantId);
    return sendSuccess(res, routes);
  }));

  router.get("/api/v1/logistics/analytics/performance", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const metrics = await repository.getPerformanceMetrics(tenantId);
    return sendSuccess(res, metrics);
  }));

  // ══════════════════════════════════════
  // ROUTE PLANS
  // ══════════════════════════════════════

  router.post("/api/v1/logistics/route-plans", asyncHandler(async (req, res) => {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PLAN_PAYLOAD", "Payload invalido para crear plan de ruta.");
    }
    try {
      const plan = await createRoutePlan.execute(parsed.data);
      return sendSuccess(res, toPlanResponse(plan), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "PLAN_CREATION_FAILED", "No fue posible crear el plan de ruta.");
    }
  }));

  router.get("/api/v1/logistics/route-plans", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const result = await repository.listPlans(tenantId, { page, limit });
    return sendPaginatedSuccess(res, result.data.map(toPlanResponse), {
      total: result.total, page: result.page, limit: result.limit,
    });
  }));

  router.get("/api/v1/logistics/route-plans/:id", asyncHandler(async (req, res) => {
    const planWithStops = await repository.findPlanWithStops(String(req.params.id));
    if (!planWithStops) {
      return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    }
    return sendSuccess(res, {
      ...toPlanResponse(planWithStops.plan),
      stops: planWithStops.stops.map(toStopResponse),
    });
  }));

  router.patch("/api/v1/logistics/route-plans/:id/status", asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!status || !PLAN_STATUSES.includes(status)) {
      return sendError(res, 400, "INVALID_PLAN_STATUS", "Estado de plan invalido.");
    }
    const plan = await repository.findPlanById(String(req.params.id));
    if (!plan) return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    await repository.updatePlanStatus(String(req.params.id), status);
    return sendSuccess(res, { updated: true });
  }));

  // ══════════════════════════════════════
  // OPTIMIZE
  // ══════════════════════════════════════

  router.post("/api/v1/logistics/route-plans/:id/optimize", asyncHandler(async (req, res) => {
    try {
      const result = await optimizeRoute.execute(String(req.params.id));
      return sendSuccess(res, {
        ...toPlanResponse(result.plan),
        stops: result.stops.map(toStopResponse),
        warnings: result.warnings,
        routingEngine: result.routingEngine,
        geometry: result.geometry,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
        return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
      }
      if (error instanceof Error && error.message === "PLAN_NOT_EDITABLE") {
        return sendError(res, 409, "PLAN_NOT_EDITABLE", "El plan esta en progreso o completado y no se puede optimizar.");
      }
      return sendError(res, 500, "OPTIMIZATION_FAILED", "No fue posible optimizar la ruta.");
    }
  }));

  // ══════════════════════════════════════
  // CONSOLIDATION
  // ══════════════════════════════════════

  router.get("/api/v1/logistics/route-plans/:id/consolidation", asyncHandler(async (req, res) => {
    const radiusKm = Math.max(0.1, Math.min(50, parseFloat(String(req.query.radiusKm ?? "2"))));
    try {
      const result = await consolidateStops.execute(String(req.params.id), radiusKm);
      return sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
        return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
      }
      return sendError(res, 500, "CONSOLIDATION_FAILED", "No fue posible analizar la consolidacion.");
    }
  }));

  // ══════════════════════════════════════
  // ROUTE STOPS
  // ══════════════════════════════════════

  router.post("/api/v1/logistics/route-plans/:planId/stops", asyncHandler(async (req, res) => {
    const parsed = addStopSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_STOP_PAYLOAD", "Payload invalido para agregar parada.");
    }
    try {
      const stop = await addRouteStop.execute({
        routePlanId: String(req.params.planId),
        ...parsed.data,
      });
      return sendSuccess(res, toStopResponse(stop), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "PLAN_NOT_FOUND") {
        return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
      }
      if (error instanceof Error && error.message === "PLAN_NOT_EDITABLE") {
        return sendError(res, 409, "PLAN_NOT_EDITABLE", "El plan ya no acepta nuevas paradas.");
      }
      if (error instanceof Error && error.message === "CAPACITY_EXCEEDED") {
        return sendError(res, 422, "CAPACITY_EXCEEDED", "La carga excede la capacidad maxima del vehiculo.");
      }
      return sendError(res, 500, "STOP_CREATION_FAILED", "No fue posible agregar la parada.");
    }
  }));

  router.get("/api/v1/logistics/route-plans/:planId/stops", asyncHandler(async (req, res) => {
    const stops = await repository.listStopsByPlan(String(req.params.planId));
    return sendSuccess(res, stops.map(toStopResponse));
  }));

  router.patch("/api/v1/logistics/route-stops/:stopId/status", asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!status || !STOP_STATUSES.includes(status)) {
      return sendError(res, 400, "INVALID_STOP_STATUS", "Estado de parada invalido.");
    }
    const stop = await repository.findStopById(String(req.params.stopId));
    if (!stop) return sendError(res, 404, "STOP_NOT_FOUND", "Parada no encontrada.");

    const actualArrival = status === "arrived" ? new Date() : undefined;
    const actualDeparture = status === "completed" ? new Date() : undefined;

    await repository.updateStopStatus(String(req.params.stopId), status, actualArrival, actualDeparture);
    return sendSuccess(res, { updated: true });
  }));

  router.delete("/api/v1/logistics/route-stops/:stopId", asyncHandler(async (req, res) => {
    const stop = await repository.findStopById(String(req.params.stopId));
    if (!stop) return sendError(res, 404, "STOP_NOT_FOUND", "Parada no encontrada.");

    const plan = await repository.findPlanById(stop.routePlanId);
    if (plan && plan.status !== "draft" && plan.status !== "optimized") {
      return sendError(res, 409, "PLAN_NOT_EDITABLE", "No se puede eliminar paradas de un plan en ejecucion.");
    }

    await repository.deleteStop(String(req.params.stopId));
    return sendSuccess(res, { deleted: true });
  }));

  router.put("/api/v1/logistics/route-plans/:planId/stops/reorder", asyncHandler(async (req, res) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_REORDER_PAYLOAD", "Se requiere un array de stopIds.");
    }
    const plan = await repository.findPlanById(String(req.params.planId));
    if (!plan) return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    if (plan.status !== "draft" && plan.status !== "optimized") {
      return sendError(res, 409, "PLAN_NOT_EDITABLE", "No se puede reordenar un plan en ejecucion.");
    }
    await repository.reorderStops(String(req.params.planId), parsed.data.stopIds);
    const stops = await repository.listStopsByPlan(String(req.params.planId));
    return sendSuccess(res, stops.map(toStopResponse));
  }));

  // ══════════════════════════════════════
  // ROAD DIRECTIONS (OSRM)
  // ══════════════════════════════════════

  router.get("/api/v1/logistics/route-plans/:id/directions", asyncHandler(async (req, res) => {
    if (!roadRouting) {
      return sendError(res, 503, "ROUTING_UNAVAILABLE", "Servicio de ruteo vial no configurado.");
    }
    const planWithStops = await repository.findPlanWithStops(String(req.params.id));
    if (!planWithStops) {
      return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    }
    const geoStops = planWithStops.stops
      .filter(s => s.latitude !== null && s.longitude !== null)
      .sort((a, b) => a.stopOrder - b.stopOrder);
    if (geoStops.length < 2) {
      return sendError(res, 422, "INSUFFICIENT_COORDS", "Se necesitan al menos 2 paradas con coordenadas.");
    }
    const waypoints = geoStops.map(s => ({ lat: s.latitude!, lng: s.longitude! }));
    const route = await roadRouting.getRoute(waypoints);
    return sendSuccess(res, {
      planId: planWithStops.plan.id,
      totalDistanceKm: route.totalDistanceKm,
      totalDurationMin: route.totalDurationMin,
      legs: route.legs.map((leg, i) => ({
        from: geoStops[i]?.locationName ?? null,
        to: geoStops[i + 1]?.locationName ?? null,
        ...leg,
      })),
      geometry: route.geometry,
    });
  }));

  router.post("/api/v1/logistics/route-plans/:id/distance-matrix", asyncHandler(async (req, res) => {
    if (!roadRouting) {
      return sendError(res, 503, "ROUTING_UNAVAILABLE", "Servicio de ruteo vial no configurado.");
    }
    const planWithStops = await repository.findPlanWithStops(String(req.params.id));
    if (!planWithStops) {
      return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    }
    const geoStops = planWithStops.stops
      .filter(s => s.latitude !== null && s.longitude !== null)
      .sort((a, b) => a.stopOrder - b.stopOrder);
    if (geoStops.length < 2) {
      return sendError(res, 422, "INSUFFICIENT_COORDS", "Se necesitan al menos 2 paradas con coordenadas.");
    }
    const waypoints = geoStops.map(s => ({ lat: s.latitude!, lng: s.longitude! }));
    const matrix = await roadRouting.getDistanceMatrix(waypoints);
    return sendSuccess(res, {
      planId: planWithStops.plan.id,
      stopNames: geoStops.map(s => s.locationName),
      distances: matrix.distances,
      durations: matrix.durations,
    });
  }));

  router.get("/api/v1/logistics/routing/health", asyncHandler(async (_req, res) => {
    if (!roadRouting) {
      return sendSuccess(res, { available: false, engine: "none", message: "No road routing service configured." });
    }
    const ok = await roadRouting.healthCheck();
    return sendSuccess(res, { available: ok, engine: "osrm" });
  }));

  // ══════════════════════════════════════
  // VRP MULTI-VEHICLE
  // ══════════════════════════════════════

  const vrpStopSchema = z.object({
    id: z.string().min(1),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    loadKg: z.coerce.number().min(0),
    locationName: z.string().min(1),
  });

  const vrpVehicleSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    capacityKg: z.coerce.number().min(0.01),
  });

  const vrpRequestSchema = z.object({
    tenantId: z.string().min(1),
    scenarioName: z.string().min(1),
    depotLat: z.coerce.number().min(-90).max(90),
    depotLng: z.coerce.number().min(-180).max(180),
    vehicles: z.array(vrpVehicleSchema).min(1).max(50),
    stops: z.array(vrpStopSchema).min(1).max(500),
    strategy: z.enum(["clarke_wright", "nearest_insertion"]).optional(),
    createdBy: z.string().optional(),
  });

  const solveVrp = new SolveVrp(roadRouting ?? null);

  router.post("/api/v1/logistics/vrp/solve", asyncHandler(async (req, res) => {
    const parsed = vrpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_VRP_PAYLOAD", "Payload inválido para VRP multi-vehículo.");
    }
    try {
      const solution = await solveVrp.execute(parsed.data);
      return sendSuccess(res, solution, 200);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_VEHICLES") {
        return sendError(res, 400, "NO_VEHICLES", "Se requiere al menos un vehículo.");
      }
      if (error instanceof Error && error.message === "NO_STOPS") {
        return sendError(res, 400, "NO_STOPS", "Se requiere al menos una parada.");
      }
      return sendError(res, 500, "VRP_SOLVE_FAILED", "No fue posible resolver el VRP.");
    }
  }));

  // VRP from existing route plan — auto-split into multi-vehicle routes
  router.post("/api/v1/logistics/route-plans/:id/vrp", asyncHandler(async (req, res) => {
    const planWithStops = await repository.findPlanWithStops(String(req.params.id));
    if (!planWithStops) {
      return sendError(res, 404, "PLAN_NOT_FOUND", "Plan de ruta no encontrado.");
    }

    const vehiclesBody = z.object({
      vehicles: z.array(vrpVehicleSchema).min(1).max(50),
      depotLat: z.coerce.number().min(-90).max(90),
      depotLng: z.coerce.number().min(-180).max(180),
      strategy: z.enum(["clarke_wright", "nearest_insertion"]).optional(),
    }).safeParse(req.body);

    if (!vehiclesBody.success) {
      return sendError(res, 400, "INVALID_VRP_PAYLOAD", "Se requiere vehicles[], depotLat, depotLng.");
    }

    const geoStops = planWithStops.stops
      .filter(s => s.latitude !== null && s.longitude !== null)
      .map(s => ({
        id: s.id,
        latitude: s.latitude!,
        longitude: s.longitude!,
        loadKg: s.loadKg,
        locationName: s.locationName,
      }));

    if (geoStops.length < 1) {
      return sendError(res, 422, "NO_GEO_STOPS", "El plan no tiene paradas con coordenadas.");
    }

    try {
      const solution = await solveVrp.execute({
        tenantId: planWithStops.plan.tenantId,
        scenarioName: `VRP para plan ${planWithStops.plan.planName}`,
        depotLat: vehiclesBody.data.depotLat,
        depotLng: vehiclesBody.data.depotLng,
        vehicles: vehiclesBody.data.vehicles,
        stops: geoStops,
        strategy: vehiclesBody.data.strategy,
      });
      return sendSuccess(res, solution, 200);
    } catch (error) {
      return sendError(res, 500, "VRP_SOLVE_FAILED", "No fue posible resolver el VRP.");
    }
  }));

  return router;
}
