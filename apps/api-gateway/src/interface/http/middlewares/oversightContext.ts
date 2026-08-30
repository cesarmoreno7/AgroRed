import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { RedisCache } from "../../../../../shared/redis/RedisCache.js";
import { logWarn } from "../../../shared/logger.js";

const OVERSIGHT_ROLE = "supervisor_departamental";
const CACHE_TTL_SECONDS = 300;
const HEADER = "x-oversight-tenant-ids";

/**
 * Resolves the set of municipio tenant IDs a `supervisor_departamental`
 * user is allowed to see (from `public.tenant_oversight`) and forwards it
 * to downstream services as the `x-oversight-tenant-ids` header (CSV).
 *
 * Must run AFTER the auth middleware (needs `x-user-role` / `x-tenant-id`)
 * and after `tenantContext`. The header is always cleared first so a client
 * cannot spoof its own oversight scope.
 *
 * Best-effort: a DB failure logs a warning and leaves the header empty
 * rather than blocking the request; downstream code treats "no list" as
 * "scope to own tenant".
 */
export function createOversightContextMiddleware(pool: Pool, redis?: Redis) {
  const cache = redis ? new RedisCache(redis, "oversight") : undefined;
  const memo = new Map<string, { ids: string[]; at: number }>();

  async function resolveChildTenantIds(supervisorTenantId: string): Promise<string[]> {
    const compute = async (): Promise<string[]> => {
      const result = await pool.query<{ child_tenant_id: string }>(
        `SELECT child_tenant_id
           FROM public.tenant_oversight
          WHERE supervisor_tenant_id = $1 AND is_active`,
        [supervisorTenantId]
      );
      return result.rows.map((r) => r.child_tenant_id);
    };

    if (cache) {
      return cache.getOrSet(supervisorTenantId, CACHE_TTL_SECONDS, compute);
    }

    const hit = memo.get(supervisorTenantId);
    if (hit && Date.now() - hit.at < CACHE_TTL_SECONDS * 1000) {
      return hit.ids;
    }
    const ids = await compute();
    memo.set(supervisorTenantId, { ids, at: Date.now() });
    return ids;
  }

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Anti-spoof: never trust an inbound value for this header.
    delete req.headers[HEADER];

    const role = req.headers["x-user-role"] as string | undefined;
    const supervisorTenantId = req.headers["x-tenant-id"] as string | undefined;

    if (role !== OVERSIGHT_ROLE || !supervisorTenantId) {
      return next();
    }

    try {
      const ids = await resolveChildTenantIds(supervisorTenantId);
      if (ids.length > 0) {
        req.headers[HEADER] = ids.join(",");
      }
    } catch (error) {
      logWarn("gateway.oversight_context.resolve_failed", {
        supervisorTenantId,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    next();
  };
}
