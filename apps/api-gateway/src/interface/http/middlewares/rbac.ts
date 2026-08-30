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
  { method: "POST",  pathPrefix: "/api/v1/offers",     allowedRoles: ["admin_municipal", "producer", "supermarket"] },
  { method: "PATCH", pathPrefix: "/api/v1/offers/:id", allowedRoles: ["admin_municipal", "producer", "supermarket"] },
  { method: "GET",   pathPrefix: "/api/v1/offers",     allowedRoles: ["admin_municipal", "producer", "supermarket", "community_kitchen", "territorial_analyst", "logistics_operator"] },

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
  // producer can report incidents from the field (Bug #8) but does not get the
  // broader incident-management read access that ops/analyst roles have.
  { method: "POST", pathPrefix: "/api/v1/incidents", allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst", "producer"] },
  { method: "GET",  pathPrefix: "/api/v1/incidents",  allowedRoles: ["admin_municipal", "logistics_operator", "territorial_analyst", "supervisor_departamental"] },

  // --- Analytics map: capas GeoJSON abiertas a roles que usan el mapa ---
  { method: "GET",  pathPrefix: "/api/v1/analytics/map", allowedRoles: ["admin_municipal", "territorial_analyst", "producer", "logistics_operator", "community_kitchen", "supervisor_departamental"] },

  // --- Orígenes Aliados: lectura abierta a todos los roles que intervienen en rescates ---
  { method: "GET",  pathPrefix: "/api/v1/analytics/origins", allowedRoles: ["admin_municipal", "territorial_analyst", "producer", "community_kitchen", "logistics_operator", "supermarket"] },

  // --- Analytics (summary, overview, reports, institutional/*) ---
  { method: "GET",  pathPrefix: "/api/v1/analytics", allowedRoles: ["admin_municipal", "territorial_analyst", "supervisor_departamental"] },

  // --- AI chat bridge ---
  { method: "POST", pathPrefix: "/api/v1/ai-chat", allowedRoles: ["admin_municipal", "territorial_analyst", "ADMIN", "TERRITORIAL_MANAGER"] },

  // --- Notifications ---
  { method: "POST", pathPrefix: "/api/v1/notifications", allowedRoles: ["admin_municipal"] },
  { method: "GET",  pathPrefix: "/api/v1/notifications",  allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- ML (read-only) ---
  { method: "GET",  pathPrefix: "/api/v1/ml", allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- Automation ---
  { method: "POST", pathPrefix: "/api/v1/automation", allowedRoles: ["admin_municipal"] },
  { method: "GET",  pathPrefix: "/api/v1/automation",  allowedRoles: ["admin_municipal", "territorial_analyst"] },

  // --- Auctions ---
  // supermarket is a buyer role (grouped with community_kitchen as "Cocina
  // Comunitaria/Supermercado" for the Dutch/ascending auctions) — Bug #7 gave it
  // no entry at all, blocking it even from reading auctions.
  { method: "POST", pathPrefix: "/api/v1/auctions/publish",      allowedRoles: ["admin_municipal", "producer"] },
  { method: "POST", pathPrefix: "/api/v1/auctions",              allowedRoles: ["admin_municipal", "producer"] },
  { method: "POST", pathPrefix: "/api/v1/auctions/:id/bid",      allowedRoles: ["admin_municipal", "community_kitchen", "logistics_operator", "supermarket"] },
  { method: "POST", pathPrefix: "/api/v1/auctions/:id/accept-dutch", allowedRoles: ["admin_municipal", "community_kitchen", "logistics_operator", "supermarket"] },
  { method: "POST", pathPrefix: "/api/v1/auctions/:id/close",   allowedRoles: ["admin_municipal"] },
  { method: "GET",  pathPrefix: "/api/v1/auctions",              allowedRoles: ["admin_municipal", "producer", "community_kitchen", "logistics_operator", "territorial_analyst", "supermarket"] },

  // --- Institutions ---
  { method: "POST",   pathPrefix: "/api/v1/institutions/register",    allowedRoles: ["admin_municipal"] },
  { method: "PUT",    pathPrefix: "/api/v1/institutions/:id",          allowedRoles: ["admin_municipal"] },
  { method: "PATCH",  pathPrefix: "/api/v1/institutions/:id/status",   allowedRoles: ["admin_municipal"] },
  { method: "DELETE", pathPrefix: "/api/v1/institutions/:id",          allowedRoles: ["admin_municipal"] },
  { method: "GET",    pathPrefix: "/api/v1/institutions",              allowedRoles: ["admin_municipal", "territorial_analyst", "logistics_operator", "community_kitchen", "supervisor_departamental"] },

  // --- Audit (admin only) ---
  { method: "GET",  pathPrefix: "/api/v1/audit", allowedRoles: ["admin_municipal"] },

  // --- PAE oversight (Supervisión del Programa de Alimentación Escolar) ---
  // `/api/v1/pae/cae/public/*` has NO policy on purpose: it is in auth PUBLIC_PATHS,
  // so no x-user-role reaches RBAC and it falls through (rbac skips when no role).
  { method: "GET",   pathPrefix: "/api/v1/pae",                                       allowedRoles: ["admin_municipal", "territorial_analyst", "supervisor_departamental"] },
  { method: "POST",  pathPrefix: "/api/v1/pae",                                       allowedRoles: ["admin_municipal", "supervisor_departamental"] },
  { method: "PATCH", pathPrefix: "/api/v1/pae",                                       allowedRoles: ["admin_municipal", "supervisor_departamental"] },
  { method: "POST",  pathPrefix: "/api/v1/pae/operators",                             allowedRoles: ["admin_municipal"] },
  { method: "POST",  pathPrefix: "/api/v1/pae/audits",                                allowedRoles: ["supervisor_departamental"] },
  { method: "PATCH", pathPrefix: "/api/v1/pae/requerimientos/:id/respond",           allowedRoles: ["admin_municipal"] },
  { method: "POST",  pathPrefix: "/api/v1/pae/requerimientos/:id/escalate-to-sanction", allowedRoles: ["supervisor_departamental"] },
  { method: "POST",  pathPrefix: "/api/v1/pae/sanctions/:id/apply",                  allowedRoles: ["admin_municipal"] }
];

// --- SUPERADMIN "Vision de Dios" (Bug #9) ---
// SUPERADMIN is seeded in the DB (infra/postgres/028_superadmin_role.sql) for
// cross-tenant monitoring, but this RBAC layer never referenced it — the role
// was a UI-only concept, blocked by every protected route. Grant it real
// read access across every module instead of hand-listing it on each policy
// above, so no GET route is missed as new ones get added. Write access stays
// scoped to admin_municipal: SUPERADMIN monitors, it does not operate tenants.
for (const policy of ROUTE_POLICIES) {
  if (policy.method === "GET" && !policy.allowedRoles.includes("SUPERADMIN")) {
    policy.allowedRoles.push("SUPERADMIN");
  }
}

function normalizePath(path: string): string {
  const clean = path.split("?")[0]?.replace(/\/+$/, "");
  return clean && clean.length > 0 ? clean : "/";
}

function splitSegments(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .filter(Boolean);
}

function policyMatchesPath(policyPath: string, requestPath: string): boolean {
  const policySegments = splitSegments(policyPath);
  const requestSegments = splitSegments(requestPath);
  const hasDynamicSegment = policySegments.some((segment) => segment.startsWith(":"));

  if (hasDynamicSegment) {
    if (policySegments.length !== requestSegments.length) {
      return false;
    }
  } else if (requestSegments.length < policySegments.length) {
    return false;
  }

  for (let i = 0; i < policySegments.length; i++) {
    const policySegment = policySegments[i];
    const requestSegment = requestSegments[i];

    if (policySegment.startsWith(":")) {
      continue;
    }

    if (policySegment !== requestSegment) {
      return false;
    }
  }

  return true;
}

function policySpecificity(policyPath: string): number {
  const segments = splitSegments(policyPath);
  const staticSegments = segments.filter((segment) => !segment.startsWith(":")).length;

  // Prioriza mas segmentos (mas especifico) y luego mayor cantidad de segmentos estaticos.
  return segments.length * 100 + staticSegments;
}

function findPolicy(method: string, path: string): RoutePolicy | undefined {
  const candidates = ROUTE_POLICIES
    .filter((policy) => policy.method === method)
    .filter((policy) => policyMatchesPath(policy.pathPrefix, path))
    .sort((a, b) => policySpecificity(b.pathPrefix) - policySpecificity(a.pathPrefix));

  return candidates[0];
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
