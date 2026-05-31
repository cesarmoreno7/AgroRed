import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const createSchema = z.object({
  tenantId:         z.string().uuid(),
  name:             z.string().min(2),
  municipalityName: z.string().min(2),
  address:          z.string().optional().nullable(),
  latitude:         z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude:        z.coerce.number().min(-180).max(180).optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ tenantId: true }).extend({
  isActive: z.boolean().optional(),
});

function toResponse(r: Record<string, unknown>) {
  return {
    id:               r.id,
    tenantId:         r.tenant_id,
    name:             r.name,
    municipalityName: r.municipality_name,
    address:          r.address ?? null,
    latitude:         r.latitude !== null ? Number(r.latitude) : null,
    longitude:        r.longitude !== null ? Number(r.longitude) : null,
    isActive:         r.is_active,
    createdAt:        r.created_at,
  };
}

export function createOriginsRouter(pool: Pool): Router {
  const router = Router();

  // ── GET /api/v1/analytics/origins ─────────────────────────────────
  router.get("/api/v1/analytics/origins", asyncHandler(async (req, res) => {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),   10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const userRole  = req.headers["x-user-role"]  as string | undefined;
    const offset = (page - 1) * limit;

    const whereClause = userRole === "admin_municipal"
      ? "WHERE deleted_at IS NULL"
      : (tenantId ? "WHERE deleted_at IS NULL AND tenant_id = $3" : "WHERE deleted_at IS NULL");

    const params = userRole === "admin_municipal"
      ? [limit, offset]
      : (tenantId ? [limit, offset, tenantId] : [limit, offset]);

    const countParams = userRole === "admin_municipal"
      ? []
      : (tenantId ? [tenantId] : []);
    const countWhere = userRole === "admin_municipal"
      ? "WHERE deleted_at IS NULL"
      : (tenantId ? "WHERE deleted_at IS NULL AND tenant_id = $1" : "WHERE deleted_at IS NULL");

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM food_origins ${countWhere}`, countParams),
      pool.query(
        `SELECT id, tenant_id, name, municipality_name, address, latitude, longitude, is_active, created_at
         FROM food_origins ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        params
      ),
    ]);

    return sendPaginatedSuccess(res, dataRes.rows.map(toResponse), {
      total: parseInt(countRes.rows[0].count, 10), page, limit,
    });
  }));

  // ── POST /api/v1/analytics/origins ────────────────────────────────
  router.post("/api/v1/analytics/origins", asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_ORIGIN_PAYLOAD", "Datos inválidos para el origen.");

    const d = parsed.data;
    const result = await pool.query(
      `INSERT INTO food_origins (tenant_id, name, municipality_name, address, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.tenantId, d.name, d.municipalityName, d.address ?? null, d.latitude ?? null, d.longitude ?? null]
    );
    return sendSuccess(res, toResponse(result.rows[0]), 201);
  }));

  // ── PUT /api/v1/analytics/origins/:id ─────────────────────────────
  router.put("/api/v1/analytics/origins/:id", asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_ORIGIN_PAYLOAD", "Datos inválidos para actualizar el origen.");

    const existing = await pool.query(`SELECT * FROM food_origins WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!existing.rows[0]) return sendError(res, 404, "ORIGIN_NOT_FOUND", "Origen no encontrado.");

    const d = parsed.data;
    const r = existing.rows[0] as Record<string, unknown>;
    const result = await pool.query(
      `UPDATE food_origins SET
         name             = $2,
         municipality_name = $3,
         address           = $4,
         latitude          = $5,
         longitude         = $6,
         is_active         = $7,
         updated_at        = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [
        req.params.id,
        d.name            ?? r.name,
        d.municipalityName ?? r.municipality_name,
        d.address         !== undefined ? d.address          : r.address,
        d.latitude        !== undefined ? d.latitude         : r.latitude,
        d.longitude       !== undefined ? d.longitude        : r.longitude,
        d.isActive        !== undefined ? d.isActive         : r.is_active,
      ]
    );
    return sendSuccess(res, toResponse(result.rows[0]));
  }));

  // ── DELETE /api/v1/analytics/origins/:id ──────────────────────────
  router.delete("/api/v1/analytics/origins/:id", asyncHandler(async (req, res) => {
    const existing = await pool.query(`SELECT id FROM food_origins WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!existing.rows[0]) return sendError(res, 404, "ORIGIN_NOT_FOUND", "Origen no encontrado.");
    await pool.query(`UPDATE food_origins SET deleted_at=NOW() WHERE id=$1`, [req.params.id]);
    return res.status(204).send();
  }));

  return router;
}
