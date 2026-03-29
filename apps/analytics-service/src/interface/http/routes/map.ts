import { Router } from "express";
import { z } from "zod";
import { GetMapLayer } from "../../../application/use-cases/GetMapLayer.js";
import { GetNearbyProducers } from "../../../application/use-cases/GetNearbyProducers.js";
import { GetHierarchyLayer } from "../../../application/use-cases/GetHierarchyLayer.js";
import type { MapRepository, MapLayer } from "../../../domain/ports/MapRepository.js";
import { asyncHandler, sendError, sendSuccess } from "../response.js";

const MAP_LAYERS: readonly MapLayer[] = ["producers", "offers", "canteens", "rescues", "incidents", "demands", "resources"] as const;

const bboxSchema = z.object({
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
}).optional();

const nearbySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().min(0.1).max(100).default(10),
});

const municipioFilterSchema = z.object({
  departamentoId: z.coerce.number().int().positive().optional(),
});

export function createMapRouter(repository: MapRepository): Router {
  const router = Router();
  const getMapLayer = new GetMapLayer(repository);
  const getNearbyProducers = new GetNearbyProducers(repository);
  const getHierarchyLayer = new GetHierarchyLayer(repository);

  // ── GET /api/v1/analytics/map/nearby/producers ──
  // Returns producers near a given point within a radius.
  // Required: ?lng=&lat=  Optional: &radiusKm= (default 10)
  router.get("/api/v1/analytics/map/nearby/producers", asyncHandler(async (req, res) => {
    const parsed = nearbySchema.safeParse(req.query);

    if (!parsed.success) {
      return sendError(
        res,
        400,
        "INVALID_NEARBY_QUERY",
        "Query invalido. Requeridos: ?lng=&lat=  Opcional: &radiusKm= (default 10, max 100)"
      );
    }

    try {
      const geojson = await getNearbyProducers.execute(parsed.data);
      return sendSuccess(res, geojson);
    } catch {
      return sendError(res, 500, "NEARBY_QUERY_FAILED", "No fue posible buscar productores cercanos.");
    }
  }));

  // ── GET /api/v1/analytics/map/hierarchy/departamentos ──
  router.get("/api/v1/analytics/map/hierarchy/departamentos", asyncHandler(async (_req, res) => {
    try {
      const geojson = await getHierarchyLayer.departamentos();
      return sendSuccess(res, geojson);
    } catch {
      return sendError(res, 500, "HIERARCHY_FAILED", "No fue posible obtener los departamentos.");
    }
  }));

  // ── GET /api/v1/analytics/map/hierarchy/municipios ──
  router.get("/api/v1/analytics/map/hierarchy/municipios", asyncHandler(async (req, res) => {
    const parsed = municipioFilterSchema.safeParse(req.query);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_FILTER", "Filtro invalido para municipios.");
    }

    try {
      const geojson = await getHierarchyLayer.municipios(parsed.data.departamentoId);
      return sendSuccess(res, geojson);
    } catch {
      return sendError(res, 500, "HIERARCHY_FAILED", "No fue posible obtener los municipios.");
    }
  }));

  // ── GET /api/v1/analytics/map/:layer ──
  // Returns GeoJSON FeatureCollection for the specified layer.
  // Optional bbox query: ?minLng=&minLat=&maxLng=&maxLat=
  // MUST be registered after specific routes (nearby, hierarchy) to avoid wildcard conflicts.
  router.get("/api/v1/analytics/map/:layer", asyncHandler(async (req, res) => {
    const layer = req.params.layer as string;

    if (!MAP_LAYERS.includes(layer as MapLayer)) {
      return sendError(
        res,
        400,
        "INVALID_MAP_LAYER",
        `Capa invalida. Capas disponibles: ${MAP_LAYERS.join(", ")}`
      );
    }

    const bboxParsed = bboxSchema.safeParse(
      req.query.minLng ? {
        minLng: req.query.minLng,
        minLat: req.query.minLat,
        maxLng: req.query.maxLng,
        maxLat: req.query.maxLat,
      } : undefined
    );

    if (!bboxParsed.success) {
      return sendError(
        res,
        400,
        "INVALID_BBOX",
        "Bounding box invalido. Use: ?minLng=&minLat=&maxLng=&maxLat="
      );
    }

    try {
      const geojson = await getMapLayer.execute(layer as MapLayer, bboxParsed.data);
      return sendSuccess(res, geojson);
    } catch {
      return sendError(res, 500, "MAP_LAYER_FAILED", "No fue posible obtener la capa del mapa.");
    }
  }));

  return router;
}
