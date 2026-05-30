import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { writeAuditEvent } from "../../../shared/audit.js";

type AuditedRoute = {
  pathPrefix: string;
  serviceName: string;
  entityName: string;
};

const AUDITED_ROUTES: AuditedRoute[] = [
  { pathPrefix: "/api/v1/offers", serviceName: "offer-service", entityName: "offers" },
  { pathPrefix: "/api/v1/demands", serviceName: "demand-service", entityName: "demands" },
  { pathPrefix: "/api/v1/logistics", serviceName: "logistics-service", entityName: "logistics" },
  { pathPrefix: "/api/v1/incidents", serviceName: "incident-service", entityName: "incidents" },
  { pathPrefix: "/api/v1/rescues", serviceName: "rescue-service", entityName: "rescues" },
  { pathPrefix: "/api/v1/inventory", serviceName: "inventory-service", entityName: "inventory" },
  { pathPrefix: "/api/v1/auctions", serviceName: "auction-service", entityName: "auctions" },
  { pathPrefix: "/api/v1/analytics/institutional", serviceName: "analytics-service", entityName: "institutional" }
];

const SENSITIVE_KEYS = new Set(["password", "newPassword", "token", "authorization"]);
const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  if (depth >= 2) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEYS.has(key) ? "[redacted]" : sanitizeValue(nestedValue, depth + 1);
    }
    return output;
  }

  return String(value);
}

function resolveAuditedRoute(path: string): AuditedRoute | undefined {
  return AUDITED_ROUTES.find((route) => path === route.pathPrefix || path.startsWith(`${route.pathPrefix}/`));
}

function buildActionName(method: string, pathPrefix: string, requestPath: string): string {
  const suffix = requestPath
    .slice(pathPrefix.length)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-zA-Z0-9/._-]+/g, "_")
    .replace(/\//g, "_");

  return `${method.toLowerCase()}:${suffix || "root"}`;
}

function extractEntityId(req: Request, pathPrefix: string): string {
  const suffixSegments = req.path
    .slice(pathPrefix.length)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const candidate = suffixSegments[0]
    ?? (typeof req.body?.id === "string" ? req.body.id : undefined)
    ?? (typeof req.body?.tenantId === "string" ? req.body.tenantId : undefined)
    ?? req.correlationId;

  return candidate;
}

export function createAuditTrailMiddleware(pool?: Pool) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!pool || !AUDITED_METHODS.has(req.method)) {
      next();
      return;
    }

    const auditedRoute = resolveAuditedRoute(req.path);
    if (!auditedRoute) {
      next();
      return;
    }

    res.once("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 400) {
        return;
      }

      void writeAuditEvent(pool, {
        tenantId: typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : null,
        serviceName: auditedRoute.serviceName,
        entityName: auditedRoute.entityName,
        entityId: extractEntityId(req, auditedRoute.pathPrefix),
        actionName: buildActionName(req.method, auditedRoute.pathPrefix, req.path),
        actorId: typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : null,
        correlationId: req.correlationId,
        payload: {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          query: sanitizeValue(req.query) as Record<string, unknown>,
          body: sanitizeValue(req.body) as Record<string, unknown>
        }
      });
    });

    next();
  };
}