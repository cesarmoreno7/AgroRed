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
