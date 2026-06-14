import { Router } from "express";
import type { Pool } from "pg";
import { asyncHandler, sendError, sendSuccess } from "../response.js";

/**
 * IRAT = Indicador de Riesgo Alimentario Territorial.
 *
 * Algorithm per institution:
 *   supply_last30  = SUM(cantidad_entregada) from entregas_detalle
 *                    joined to entregas_productos WHERE fecha_entrega >= NOW()-30d
 *   irat_score     = GREATEST(0, 1 - supply_last30 / NULLIF(beneficiary_count, 0)) * 100
 *
 * Thresholds read from alert_thresholds (defaults: high=60, critical=80).
 * Notifications inserted directly into the notifications table when exceeded.
 */
export function createIratRouter(pool: Pool): Router {
  const router = Router();

  /* GET /api/v1/analytics/irat — current scores per institution */
  router.get("/api/v1/analytics/irat", asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<{
      institution_id: string;
      institution_name: string;
      tenant_id: string;
      beneficiary_count: number;
      supply_last30: number;
      irat_score: number;
    }>(`
      SELECT
        i.id                                       AS institution_id,
        i.name                                     AS institution_name,
        i.tenant_id,
        i.beneficiary_count,
        COALESCE(s.supply_last30, 0)               AS supply_last30,
        GREATEST(0,
          (1 - COALESCE(s.supply_last30, 0) / NULLIF(i.beneficiary_count, 0)) * 100
        )::NUMERIC(5,2)                             AS irat_score
      FROM public.institutions i
      LEFT JOIN (
        SELECT ep.institucion_id,
               SUM(ed.cantidad_entregada) AS supply_last30
          FROM public.entregas_productos ep
          JOIN public.entregas_detalle   ed ON ed.entrega_id = ep.id
         WHERE ep.deleted_at IS NULL
           AND ep.estado IN ('recibido','parcial')
           AND ep.fecha_entrega >= NOW() - INTERVAL '30 days'
         GROUP BY ep.institucion_id
      ) s ON s.institucion_id = i.id
      WHERE i.deleted_at IS NULL
        AND i.status = 'active'
      ORDER BY irat_score DESC
    `);

    return sendSuccess(res, rows);
  }));

  /* POST /api/v1/analytics/irat/check — evaluate & fire notifications */
  router.post("/api/v1/analytics/irat/check", asyncHandler(async (_req, res) => {
    const { rows: scoreRows } = await pool.query<{
      institution_id: string;
      institution_name: string;
      tenant_id: string;
      irat_score: number;
    }>(`
      SELECT
        i.id    AS institution_id,
        i.name  AS institution_name,
        i.tenant_id,
        GREATEST(0,
          (1 - COALESCE(s.supply_last30, 0) / NULLIF(i.beneficiary_count, 0)) * 100
        )::NUMERIC(5,2) AS irat_score
      FROM public.institutions i
      LEFT JOIN (
        SELECT ep.institucion_id,
               SUM(ed.cantidad_entregada) AS supply_last30
          FROM public.entregas_productos ep
          JOIN public.entregas_detalle   ed ON ed.entrega_id = ep.id
         WHERE ep.deleted_at IS NULL
           AND ep.estado IN ('recibido','parcial')
           AND ep.fecha_entrega >= NOW() - INTERVAL '30 days'
         GROUP BY ep.institucion_id
      ) s ON s.institucion_id = i.id
      WHERE i.deleted_at IS NULL
        AND i.status = 'active'
    `);

    // Get per-tenant thresholds (fall back to defaults)
    const { rows: thresholdRows } = await pool.query<{
      tenant_id: string;
      irat_high: number;
      irat_critical: number;
    }>(`
      SELECT
        tenant_id,
        MAX(CASE WHEN rule_key = 'institutional.irat_high'     THEN value END) AS irat_high,
        MAX(CASE WHEN rule_key = 'institutional.irat_critical' THEN value END) AS irat_critical
      FROM public.alert_thresholds
      WHERE rule_key IN ('institutional.irat_high','institutional.irat_critical')
      GROUP BY tenant_id
    `);

    const thresholdMap = new Map(
      thresholdRows.map((r) => [r.tenant_id, {
        high:     r.irat_high     ?? 60,
        critical: r.irat_critical ?? 80,
      }])
    );

    const fired: { institution: string; score: number; level: string }[] = [];

    for (const row of scoreRows) {
      const thr = thresholdMap.get(row.tenant_id) ?? { high: 60, critical: 80 };
      const level = row.irat_score >= thr.critical ? "CRITICAL"
                  : row.irat_score >= thr.high     ? "HIGH"
                  : null;

      if (!level) continue;

      const title   = `IRAT ${level}: ${row.institution_name}`;
      const message = `Indicador de Riesgo Alimentario en ${level.toLowerCase()} (${row.irat_score}%). Acción inmediata requerida.`;

      await pool.query(
        `INSERT INTO public.notifications
           (id, tenant_id, notification_channel, recipient_label, title, message, scheduled_for, status)
         VALUES (gen_random_uuid(), $1, 'in_app', 'admin_municipal', $2, $3, NOW(), 'pending')`,
        [row.tenant_id, title, message]
      );

      fired.push({ institution: row.institution_name, score: Number(row.irat_score), level });
    }

    return sendSuccess(res, {
      checked: scoreRows.length,
      fired: fired.length,
      alerts: fired,
      checkedAt: new Date().toISOString(),
    });
  }));

  return router;
}
