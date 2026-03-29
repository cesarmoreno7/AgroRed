import type { Request, Response, NextFunction } from "express";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RoutePolicy {
  method: HttpMethod;
  pathPrefix: string;
  allowedRoles: string[];
}

/**
 * Role-based route access policies.
 *
 * Convention:
 * - admin_municipal        → full access to all operations
 * - territorial_analyst    → read-only on analytics, map, ml, reports; write incidents
 * - producer               → manage own offers, view own rescues
 * - community_kitchen      → register demands, view offers/rescues
 * - logistics_operator     → manage logistics, tracking, delivery events
 * - supermarket            → register offers, view analytics
 *
 * Routes not listed here are open to any authenticated user.
 */
const ROUTE_POLICIES: RoutePolicy[] = [
  // --- User management (admin only) ---
  { method: "GET",  pathPrefix: "/api/v1/users",       allowedRoles: ["admin_municipal"] },

  // --- Producers ---
  { method: "POST", pathPrefix: "/api/v1/producers/register", allowedRoles: ["admin_municipal", "producer"] },
  { method: "GET",  pathPrefix: "/api/v1/producers",          allowedRoles: ["admin_municipal", "producer", "territorial_analyst", "logistics_operator"] },

  // --- Offers ---
  { method: "POST", pathPrefix: "/api/v1/offers",   allowedRoles: ["admin_municipal", "producer", "supermarket"] },
  { method: "GET",  pathPrefix: "/api/v1/offers",    allowedRoles: ["admin_municipal", "producer", "supermarket", "community_kitchen", "territorial_analyst", "logistics_operator"] },

  // --- Rescues ---
  { method: "POST", pathPrefix: "/api/v1/rescues",  allowedRoles: ["admin_municipal", "producer", "community_kitchen"] },
  { method: "GET",  pathPrefix: "/api/v1/rescues",   allowedRoles: ["admin_municipal", "producer", "community_kitchen", "territorial_analyst", "logistics_operator"] },

  // --- Demands ---
  { method: "POST", pathPrefix: "/api/v1/demands",  allowedRoles: ["admin_municipal", "community_kitchen"] },
  { method: "GET",  pathPrefix: "/api/v1/demands",   allowedRoles: ["admin_municipal", "community_kitchen", "territorial_analyst", "logistics_operator"] },

  // --- Inventory ---
  { method: "POST", pathPrefix: "/api/v1/inventory", allowedRoles: ["admin_municipal", "logistics_operator"] },
  { method: "GET",  pathPrefix: "/api/v1/inventory",  allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst"] },

  // --- Logistics ---
  { method: "POST", pathPrefix: "/api/v1/logistics", allowedRoles: ["admin_municipal", "logistics_operator"] },
  { method: "GET",  pathPrefix: "/api/v1/logistics",  allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst"] },

  // --- Incidents ---
  { method: "POST", pathPrefix: "/api/v1/incidents", allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst"] },
  { method: "GET",  pathPrefix: "/api/v1/incidents",  allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst"] },

  // --- Analytics (read-only) ---
  { method: "GET",  pathPrefix: "/api/v1/analytics", allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- Notifications ---
  { method: "POST", pathPrefix: "/api/v1/notifications", allowedRoles: ["admin_municipal"] },
  { method: "GET",  pathPrefix: "/api/v1/notifications",  allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- ML (read-only) ---
  { method: "GET",  pathPrefix: "/api/v1/ml", allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- Automation ---
  { method: "POST", pathPrefix: "/api/v1/automation", allowedRoles: ["admin_municipal"] },
  { method: "GET",  pathPrefix: "/api/v1/automation",  allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- Audit (admin only) ---
  { method: "GET",  pathPrefix: "/api/v1/audit", allowedRoles: ["admin_municipal"] }
];

function findPolicy(method: string, path: string): RoutePolicy | undefined {
  return ROUTE_POLICIES.find(
    (policy) =>
      policy.method === method &&
      (path === policy.pathPrefix || path.startsWith(policy.pathPrefix + "/"))
  );
}

/**
 * RBAC middleware that enforces role-based access per route.
 * Must be mounted AFTER auth middleware (needs x-user-role header).
 * Public/unauthenticated routes are skipped by the auth middleware first.
 */
export function rbacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const role = req.headers["x-user-role"] as string | undefined;

  // If no role header, the request is either public or unauthenticated — skip RBAC.
  if (!role) {
    return next();
  }

  const policy = findPolicy(req.method, req.path);

  // No policy defined = open to any authenticated user.
  if (!policy) {
    return next();
  }

  if (!policy.allowedRoles.includes(role)) {
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "No tiene permisos para acceder a este recurso."
      }
    });
    return;
  }

  next();
}
