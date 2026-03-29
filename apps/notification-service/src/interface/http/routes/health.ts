import { Router } from "express";
import { sendError, sendSuccess } from "../response.js";

export interface HealthDependencyChecker {
  check(): Promise<Record<string, unknown>>;
}

export function createHealthRouter(healthChecker: HealthDependencyChecker): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    try {
      const dependencies = await healthChecker.check();

      return sendSuccess(res, {
        service: "notification-service",
        status: "ok",
        timestamp: new Date().toISOString(),
        dependencies
      });
    } catch {
      return sendError(res, 503, "DEPENDENCY_UNAVAILABLE", "Base de datos no disponible.");
    }
  });

  return router;
}