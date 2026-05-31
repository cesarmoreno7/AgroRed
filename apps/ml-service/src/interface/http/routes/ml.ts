import { Router } from "express";
import { z } from "zod";
import { GetDecisionSupport } from "../../../application/use-cases/GetDecisionSupport.js";
import { GetRecommendations } from "../../../application/use-cases/GetRecommendations.js";
import type { DecisionSupportRepository } from "../../../domain/ports/DecisionSupportRepository.js";
import type { RedisCache } from "../../../../../shared/redis/RedisCache.js";
import { asyncHandler, sendError, sendSuccess } from "../response.js";

const mlQuerySchema = z.object({
  tenantId: z.string().min(1).optional()
});

export function createMlRouter(repository: DecisionSupportRepository, cache?: RedisCache): Router {
  const router = Router();
  const getDecisionSupport = new GetDecisionSupport(repository);
  const getRecommendations = new GetRecommendations(repository);
  const CACHE_TTL = 600; // 10 minutes

  router.get("/api/v1/ml/decision-support", asyncHandler(async (req, res) => {
    const parsed = mlQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ML_QUERY", "El query de ML no es valido.");
    }

    try {
      const cacheKey = `decision:${parsed.data.tenantId ?? "all"}`;
      const report = cache
        ? await cache.getOrSet(cacheKey, CACHE_TTL, () => getDecisionSupport.execute(parsed.data.tenantId))
        : await getDecisionSupport.execute(parsed.data.tenantId);
      return sendSuccess(res, report);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      return sendError(res, 500, "ML_DECISION_SUPPORT_FAILED", "No fue posible construir el reporte heuristico.");
    }
  }));

  // ── GET /api/v1/ml/suggestions  (alias for the dashboard's MLPage) ────
  router.get("/api/v1/ml/suggestions", asyncHandler(async (req, res) => {
    const parsed = mlQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "INVALID_ML_QUERY", "El query de ML no es valido.");

    try {
      const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? parsed.data.tenantId;
      const report = cache
        ? await cache.getOrSet(`suggestions:${tenantId ?? "all"}`, CACHE_TTL, () => getRecommendations.execute(tenantId))
        : await getRecommendations.execute(tenantId);

      // Map to the MLSuggestion shape expected by the frontend
      const suggestions = report.recommendations.map((r: any, i: number) => ({
        id:          `${report.tenantId ?? "na"}-${i}`,
        type:        r.actionCode ?? "recommendation",
        title:       r.title,
        description: r.rationale,
        confidence:  r.confidence ?? Math.round(60 + Math.random() * 35),
        priority:    r.priority ?? "medium",
        status:      "pending",
        createdAt:   report.generatedAt ?? new Date().toISOString(),
      }));

      return sendSuccess(res, suggestions);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ML_SUGGESTIONS_FAILED", "No fue posible obtener sugerencias.");
    }
  }));

  router.get("/api/v1/ml/recommendations", asyncHandler(async (req, res) => {
    const parsed = mlQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ML_QUERY", "El query de ML no es valido.");
    }

    try {
      const cacheKey = `recommendations:${parsed.data.tenantId ?? "all"}`;
      const report = cache
        ? await cache.getOrSet(cacheKey, CACHE_TTL, () => getRecommendations.execute(parsed.data.tenantId))
        : await getRecommendations.execute(parsed.data.tenantId);
      return sendSuccess(res, report);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      return sendError(res, 500, "ML_RECOMMENDATIONS_FAILED", "No fue posible construir las recomendaciones heuristicas.");
    }
  }));

  return router;
}