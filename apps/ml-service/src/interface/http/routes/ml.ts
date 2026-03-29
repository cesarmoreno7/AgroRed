import { Router } from "express";
import { z } from "zod";
import { GetDecisionSupport } from "../../../application/use-cases/GetDecisionSupport.js";
import { GetRecommendations } from "../../../application/use-cases/GetRecommendations.js";
import type { DecisionSupportRepository } from "../../../domain/ports/DecisionSupportRepository.js";
import type { RedisCache } from "../../../../shared/redis/RedisCache.js";
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