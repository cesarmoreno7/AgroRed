import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { asyncHandler, sendError, sendSuccess } from "../response.js";

const CATEGORIES = ["tuberculo","hortaliza","fruta","cereal","leguminosa","lacteo","cacao","platano","yuca","otro"] as const;

const createProductSchema = z.object({
  tenantId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(120),
  category: z.enum(CATEGORIES),
  unit: z.string().min(1).max(20).default("kg"),
  description: z.string().max(500).optional().nullable(),
  inSeason: z.boolean().optional().default(false),
});

const updateProductSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  unit: z.string().min(1).max(20).optional(),
  description: z.string().max(500).optional().nullable(),
  inSeason: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo requerido." });

function mapRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    description: row.description,
    inSeason: row.in_season,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProductsRouter(pool: Pool): Router {
  const router = Router();

  // GET /api/v1/products/catalog — list active products (global + tenant)
  router.get("/api/v1/products/catalog", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
    const category = req.query.category ? String(req.query.category) : null;
    const all = req.query.all === "true";

    let whereClause = all ? "" : "WHERE is_active = TRUE";
    const params: unknown[] = [];
    let paramIdx = 1;

    if (tenantId) {
      const join = whereClause ? " AND" : " WHERE";
      whereClause += `${join} (tenant_id = $${paramIdx} OR tenant_id IS NULL)`;
      params.push(tenantId);
      paramIdx++;
    } else {
      const join = whereClause ? " AND" : " WHERE";
      whereClause += `${join} tenant_id IS NULL`;
    }

    if (category) {
      const join = whereClause ? " AND" : " WHERE";
      whereClause += `${join} category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    try {
      const result = await pool.query(
        `SELECT * FROM public.product_catalog ${whereClause} ORDER BY category ASC, name ASC`,
        params
      );
      return sendSuccess(res, result.rows.map(mapRow));
    } catch (err: any) {
      if (err?.code === "42P01") {
        // Table does not exist — migration pending
        return sendError(res, 503, "PRODUCT_CATALOG_UNAVAILABLE", "El catálogo de productos no está disponible. La migración de base de datos está pendiente.");
      }
      return sendError(res, 500, "PRODUCT_CATALOG_FETCH_FAILED", "No fue posible obtener el catálogo de productos.");
    }
  }));

  // POST /api/v1/products/catalog — create product
  router.post("/api/v1/products/catalog", asyncHandler(async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PRODUCT_PAYLOAD", "Payload inválido para catálogo de producto.");
    }
    const { tenantId, name, category, unit, description, inSeason } = parsed.data;

    try {
      const result = await pool.query(
        `INSERT INTO public.product_catalog (tenant_id, name, category, unit, description, in_season)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId ?? null, name, category, unit, description ?? null, inSeason]
      );
      return sendSuccess(res, mapRow(result.rows[0]), 201);
    } catch (err: any) {
      if (err?.code === "23505") {
        return sendError(res, 409, "PRODUCT_ALREADY_EXISTS", "Ya existe un producto con ese nombre en el catálogo.");
      }
      throw err;
    }
  }));

  // PATCH /api/v1/products/catalog/:id — update product
  router.patch("/api/v1/products/catalog/:id", asyncHandler(async (req, res) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PRODUCT_UPDATE", "Payload inválido para actualizar producto.");
    }

    const fieldMap: Record<string, string> = {
      name: "name", category: "category", unit: "unit",
      description: "description", inSeason: "in_season", isActive: "is_active",
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(parsed.data)) {
      if (fieldMap[k] !== undefined) {
        sets.push(`${fieldMap[k]} = $${i++}`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return sendError(res, 400, "NO_FIELDS", "No se proporcionaron campos válidos.");

    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);

    try {
      const result = await pool.query(
        `UPDATE public.product_catalog SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
        vals
      );
      if (result.rowCount === 0) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Producto no encontrado.");
      return sendSuccess(res, mapRow(result.rows[0]));
    } catch {
      return sendError(res, 500, "PRODUCT_UPDATE_FAILED", "No fue posible actualizar el producto.");
    }
  }));

  // DELETE /api/v1/products/catalog/:id — soft delete (set is_active = false)
  router.delete("/api/v1/products/catalog/:id", asyncHandler(async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE public.product_catalog SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (result.rowCount === 0) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Producto no encontrado.");
      return res.status(204).send();
    } catch {
      return sendError(res, 500, "PRODUCT_DELETE_FAILED", "No fue posible eliminar el producto.");
    }
  }));

  return router;
}
