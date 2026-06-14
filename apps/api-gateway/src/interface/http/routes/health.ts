import { Router } from "express";
import type { ServiceRouteDefinition } from "../../../infrastructure/http/serviceRegistry.js";
import { asyncHandler, sendSuccess } from "../response.js";

export type DependencyStatus = "ok" | "degraded" | "unavailable";

export interface GatewayHealthDependencies {
  redis?: DependencyStatus;
}

async function checkService(service: ServiceRouteDefinition): Promise<{ name: string; status: DependencyStatus }> {
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

export function createHealthRouter(
  services: ServiceRouteDefinition[],
  gatewayDependencies: GatewayHealthDependencies = {}
): Router {
  const router = Router();

  router.get("/ping", (_req, res) => { res.status(200).json({ ok: true }); });

  router.get("/health", asyncHandler(async (_req, res) => {
    const results = await Promise.all(services.map(checkService));
    const downstreamOk = results.every((r) => r.status === "ok");
    const gatewayDependenciesOk = Object.values(gatewayDependencies).every((status) => status === "ok");
    const allOk = downstreamOk && gatewayDependenciesOk;

    const payload = {
      service: "api-gateway",
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      managedServices: services.length,
      gatewayDependencies,
      dependencies: Object.fromEntries(results.map((r) => [r.name, r.status]))
    };

    return sendSuccess(res, payload, allOk ? 200 : 503);
  }));

  return router;
}

