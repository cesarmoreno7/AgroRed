import { Router } from "express";
import type { Pool } from "pg";
import type { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../response.js";

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function createAuditRouter(pool: Pool): Router {
  const router = Router();

  router.get("/api/v1/audit", asyncHandler(async (req, res) => {
    const { serviceName, entityName, actionName, startDate, endDate } = req.query;

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (typeof serviceName === "string" && serviceName.length > 0) {
      conditions.push(`service_name = $${values.length + 1}`);
      values.push(serviceName);
    }
    if (typeof entityName === "string" && entityName.length > 0) {
      conditions.push(`entity_name = $${values.length + 1}`);
      values.push(entityName);
    }
    if (typeof actionName === "string" && actionName.length > 0) {
      conditions.push(`action_name = $${values.length + 1}`);
      values.push(actionName);
    }
    if (typeof startDate === "string" && startDate.length > 0) {
      conditions.push(`created_at >= $${values.length + 1}`);
      values.push(startDate);
    }
    if (typeof endDate === "string" && endDate.length > 0) {
      conditions.push(`created_at <= $${values.length + 1}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM public.audit_log ${whereClause}`;
    const countResult = await pool.query<{ count: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const dataQuery = `SELECT id, tenant_id, service_name, entity_name, entity_id, action_name, actor_id, payload, created_at FROM public.audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const result = await pool.query(dataQuery, [...values, limit, offset]);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit }
    });
  }));

  return router;
}
