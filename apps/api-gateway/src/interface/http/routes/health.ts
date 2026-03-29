import { Router } from "express";
import type { ServiceRouteDefinition } from "../../../infrastructure/http/serviceRegistry.js";
import { asyncHandler, sendSuccess } from "../response.js";

async function checkService(service: ServiceRouteDefinition): Promise<{ name: string; status: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${service.target}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return { name: service.name, status: response.ok ? "ok" : "degraded" };
  } catch {
    return { name: service.name, status: "unavailable" };
  }
}

export function createHealthRouter(services: ServiceRouteDefinition[]): Router {
  const router = Router();

  router.get("/health", asyncHandler(async (_req, res) => {
    const results = await Promise.all(services.map(checkService));
    const allOk = results.every((r) => r.status === "ok");

    const payload = {
      service: "api-gateway",
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      managedServices: services.length,
      dependencies: Object.fromEntries(results.map((r) => [r.name, r.status]))
    };

    return sendSuccess(res, payload, allOk ? 200 : 503);
  }));

  return router;
}

