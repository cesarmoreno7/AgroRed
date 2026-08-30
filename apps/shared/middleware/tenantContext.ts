import type { Request, Response, NextFunction } from "express";

/**
 * Extracts x-tenant-id set by the API gateway auth middleware and
 * makes it available as req.headers["x-tenant-id"].
 *
 * For POST/PUT/PATCH with a JSON body that includes tenantId,
 * overrides the body value with the trusted header value so that
 * a user cannot create resources in a foreign tenant.
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  const headerTenantId = req.headers["x-tenant-id"] as string | undefined;

  if (headerTenantId && req.body && typeof req.body === "object" && "tenantId" in req.body) {
    req.body.tenantId = headerTenantId;
  }

  next();
}

/**
 * Helper to extract tenantId from trusted gateway header.
 * Returns undefined when running without the gateway (e.g. direct service access).
 */
export function getTenantId(req: Request): string | undefined {
  return req.headers["x-tenant-id"] as string | undefined;
}

/**
 * Roles with real cross-tenant ("Vision de Dios") read access — Bug #9.
 * Kept to a single role so the bypass below stays narrow and auditable,
 * unlike the old admin_municipal bypass removed in Bug #1.
 */
const GOD_VIEW_ROLES = new Set(["SUPERADMIN"]);

export function isGodViewRole(req: Request): boolean {
  const role = req.headers["x-user-role"] as string | undefined;
  return !!role && GOD_VIEW_ROLES.has(role);
}

/**
 * Tenant filter to use in list/read queries: null means "no tenant filter"
 * (cross-tenant visibility). Only SUPERADMIN gets that; every other role is
 * always scoped to its own tenant, regardless of what it asks for.
 */
export function resolveTenantFilter(req: Request): string | null {
  if (isGodViewRole(req)) {
    return null;
  }
  return getTenantId(req) ?? null;
}

/**
 * PAE oversight — the set of municipio tenant IDs a `supervisor_departamental`
 * (Gobernación / external interventoría) may read/act on, resolved by the gateway
 * `oversightContext` middleware into the `x-oversight-tenant-ids` header (CSV).
 *
 * Returns null when there is no oversight list (any other role, or the header is
 * absent) — callers then fall back to `resolveTenantFilter` (own tenant).
 */
export function resolveOversightTenantIds(req: Request): string[] | null {
  const raw = req.headers["x-oversight-tenant-ids"];
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

/**
 * True when `tenantId` is one the caller is allowed to target:
 *  - SUPERADMIN: always (god view);
 *  - `supervisor_departamental`: only if `tenantId` is in its oversight list;
 *  - anyone else: only their own `x-tenant-id`.
 * Used by PAE routes to gate `?tenantId=` drill-down and `targetTenantId` writes.
 */
export function assertTenantInOversight(req: Request, tenantId: string): boolean {
  if (!tenantId) {
    return false;
  }
  if (isGodViewRole(req)) {
    return true;
  }
  const oversight = resolveOversightTenantIds(req);
  if (oversight) {
    return oversight.includes(tenantId);
  }
  return getTenantId(req) === tenantId;
}

export interface GodViewAuditEvent {
  tenantId: string | null;
  serviceName: string;
  entityName: string;
  entityId: string;
  actionName: string;
  actorId?: string | null;
  correlationId?: string;
  payload: Record<string, unknown>;
}

/**
 * Leaves a real audit trail every time SUPERADMIN's cross-tenant bypass is
 * actually used, so "Vision de Dios" reads are traceable via GET /api/v1/audit
 * instead of being an invisible, unaudited superpower.
 */
export async function auditGodViewAccess(
  req: Request,
  auditLogger: ((event: GodViewAuditEvent) => Promise<void>) | undefined,
  info: { serviceName: string; entityName: string }
): Promise<void> {
  if (!isGodViewRole(req) || !auditLogger) {
    return;
  }

  await auditLogger({
    tenantId: null,
    serviceName: info.serviceName,
    entityName: info.entityName,
    entityId: "*",
    actionName: "godview.cross_tenant_read",
    actorId: typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : null,
    correlationId: typeof req.headers["x-correlation-id"] === "string" ? req.headers["x-correlation-id"] : undefined,
    payload: { path: req.originalUrl, method: req.method }
  });
}
