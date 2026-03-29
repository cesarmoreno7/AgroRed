import { Router } from "express";
import type { ServiceRouteDefinition } from "../../../infrastructure/http/serviceRegistry.js";
import { sendSuccess } from "../response.js";

export function createCatalogRouter(services: ServiceRouteDefinition[]): Router {
  const router = Router();

  router.get("/api/v1/catalog/services", (_req, res) =>
    sendSuccess(
      res,
      services.map((service) => ({
        key: service.key,
        name: service.name,
        description: service.description,
        pathPrefix: service.pathPrefix
      }))
    )
  );

  return router;
}

