import { Router } from "express";
import type { Pool } from "pg";
import { asyncHandler, sendSuccess } from "../response.js";

/**
 * IRAT = Indicador de Riesgo Alimentario Territorial.
 *
 * Índice compuesto de 5 dimensiones (0-100, más alto = más riesgo), calculado por institución:
 *
 *   1. coverageRisk   (peso 0.35) — cobertura de suministro: 1 - supply_last30/beneficiary_count.
 *   2. trendRisk      (peso 0.15) — tendencia: caída de suministro vs. los 30 días previos a los últimos 30.
 *   3. diversityRisk  (peso 0.15) — diversidad: menos productos distintos entregados = más riesgo (5+ = riesgo 0).
 *   4. incidentRisk   (peso 0.20) — presión territorial: incidencias abiertas en el tenant en los últimos 30 días.
 *   5. logisticsRisk  (peso 0.15) — continuidad logística: proporción de entregas programadas vencidas sin completar.
 *
 * irat_score = round(Σ dimensión * peso, 2). Los pesos suman 1.0 y priorizan cobertura (la señal
 * más directa de seguridad alimentaria) sobre las demás.
 *
 * Umbrales leídos de alert_thresholds (defaults: high=60, critical=80).
 * Notificaciones insertadas en la tabla notifications cuando se supera un umbral; el despacho real
 * ocurre vía ActionExecutionEngine (automation-service) cuando el barrido programado detecta
 * notificaciones pendientes — ver apps/automation-service/src/application/services/ActionExecutionEngine.ts.
 */

const DIMENSION_WEIGHTS = {
  coverageRisk: 0.35,
  trendRisk: 0.15,
  diversityRisk: 0.15,
  incidentRisk: 0.20,
  logisticsRisk: 0.15
} as const;

interface IratDimensionsRow {
  institution_id: string;
  institution_name: string;
  tenant_id: string;
  beneficiary_count: number;
  supply_last30: number;
  coverage_risk: number;
  trend_risk: number;
  diversity_risk: number;
  incident_risk: number;
  logistics_risk: number;
}

const DIMENSIONS_QUERY = `
  WITH supply AS (
    SELECT
      ep.institucion_id,
      SUM(ed.cantidad_entregada) FILTER (
        WHERE ep.fecha_entrega >= NOW() - INTERVAL '30 days'
      ) AS supply_last30,
      SUM(ed.cantidad_entregada) FILTER (
        WHERE ep.fecha_entrega >= NOW() - INTERVAL '60 days'
          AND ep.fecha_entrega <  NOW() - INTERVAL '30 days'
      ) AS supply_prior30,
      COUNT(DISTINCT ed.producto_id) FILTER (
        WHERE ep.fecha_entrega >= NOW() - INTERVAL '30 days'
      ) AS distinct_products_last30
    FROM public.entregas_productos ep
    JOIN public.entregas_detalle ed ON ed.entrega_id = ep.id
    WHERE ep.deleted_at IS NULL
      AND ep.estado IN ('recibido', 'parcial')
    GROUP BY ep.institucion_id
  ),
  incidents_by_tenant AS (
    SELECT tenant_id, COUNT(*) AS open_incidents
    FROM public.incidents
    WHERE deleted_at IS NULL
      AND status = 'open'
      AND occurred_at >= NOW() - INTERVAL '30 days'
    GROUP BY tenant_id
  ),
  logistics_by_tenant AS (
    SELECT
      tenant_id,
      COUNT(*) AS scheduled_total,
      COUNT(*) FILTER (
        WHERE status IN ('scheduled', 'delayed') AND scheduled_delivery_at < NOW()
      ) AS overdue
    FROM public.logistics_orders
    WHERE deleted_at IS NULL
      AND scheduled_delivery_at >= NOW() - INTERVAL '30 days'
    GROUP BY tenant_id
  )
  SELECT
    i.id                          AS institution_id,
    i.name                        AS institution_name,
    i.tenant_id,
    i.beneficiary_count,
    COALESCE(s.supply_last30, 0)  AS supply_last30,
    GREATEST(0, LEAST(100,
      (1 - COALESCE(s.supply_last30, 0) / NULLIF(i.beneficiary_count, 0)) * 100
    ))                                                                       AS coverage_risk,
    CASE
      WHEN COALESCE(s.supply_prior30, 0) = 0 THEN 50
      ELSE GREATEST(0, LEAST(100,
        (s.supply_prior30 - COALESCE(s.supply_last30, 0)) / s.supply_prior30 * 100
      ))
    END                                                                      AS trend_risk,
    GREATEST(0, 100 - LEAST(100, COALESCE(s.distinct_products_last30, 0) * 20)) AS diversity_risk,
    LEAST(100, COALESCE(inc.open_incidents, 0) * 15)                         AS incident_risk,
    CASE
      WHEN COALESCE(lg.scheduled_total, 0) = 0 THEN 0
      ELSE LEAST(100, COALESCE(lg.overdue, 0)::NUMERIC / lg.scheduled_total * 100)
    END                                                                      AS logistics_risk
  FROM public.institutions i
  LEFT JOIN supply s               ON s.institucion_id = i.id
  LEFT JOIN incidents_by_tenant inc ON inc.tenant_id = i.tenant_id
  LEFT JOIN logistics_by_tenant lg  ON lg.tenant_id = i.tenant_id
  WHERE i.deleted_at IS NULL
    AND i.status = 'active'
`;

function computeIratScore(row: IratDimensionsRow): number {
  const score =
    Number(row.coverage_risk) * DIMENSION_WEIGHTS.coverageRisk +
    Number(row.trend_risk) * DIMENSION_WEIGHTS.trendRisk +
    Number(row.diversity_risk) * DIMENSION_WEIGHTS.diversityRisk +
    Number(row.incident_risk) * DIMENSION_WEIGHTS.incidentRisk +
    Number(row.logistics_risk) * DIMENSION_WEIGHTS.logisticsRisk;

  return Math.round(score * 100) / 100;
}

export function createIratRouter(pool: Pool): Router {
  const router = Router();

  /* GET /api/v1/analytics/irat — current composite scores per institution */
  router.get("/api/v1/analytics/irat", asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<IratDimensionsRow>(DIMENSIONS_QUERY);

    const scored = rows.map((row) => ({
      institutionId: row.institution_id,
      institutionName: row.institution_name,
      tenantId: row.tenant_id,
      beneficiaryCount: row.beneficiary_count,
      supplyLast30: Number(row.supply_last30),
      dimensions: {
        coverageRisk: Number(row.coverage_risk),
        trendRisk: Number(row.trend_risk),
        diversityRisk: Number(row.diversity_risk),
        incidentRisk: Number(row.incident_risk),
        logisticsRisk: Number(row.logistics_risk)
      },
      iratScore: computeIratScore(row)
    })).sort((a, b) => b.iratScore - a.iratScore);

    return sendSuccess(res, scored);
  }));

  /* POST /api/v1/analytics/irat/check — evaluate composite score & fire notifications */
  router.post("/api/v1/analytics/irat/check", asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<IratDimensionsRow>(DIMENSIONS_QUERY);

    // Per-tenant thresholds (fall back to defaults)
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

    for (const row of rows) {
      const score = computeIratScore(row);
      const thr = thresholdMap.get(row.tenant_id) ?? { high: 60, critical: 80 };
      const level = score >= thr.critical ? "CRITICAL"
                  : score >= thr.high     ? "HIGH"
                  : null;

      if (!level) continue;

      const title   = `IRAT ${level}: ${row.institution_name}`;
      const message = `Indicador de Riesgo Alimentario en ${level.toLowerCase()} (${score}%). ` +
        `Cobertura: ${Number(row.coverage_risk).toFixed(0)} · Tendencia: ${Number(row.trend_risk).toFixed(0)} · ` +
        `Diversidad: ${Number(row.diversity_risk).toFixed(0)} · Incidencias: ${Number(row.incident_risk).toFixed(0)} · ` +
        `Logística: ${Number(row.logistics_risk).toFixed(0)}. Acción inmediata requerida.`;

      await pool.query(
        `INSERT INTO public.notifications
           (id, tenant_id, notification_channel, recipient_label, title, message, scheduled_for, status)
         VALUES (gen_random_uuid(), $1, 'in_app', 'admin_municipal', $2, $3, NOW(), 'pending')`,
        [row.tenant_id, title, message]
      );

      fired.push({ institution: row.institution_name, score, level });
    }

    return sendSuccess(res, {
      checked: rows.length,
      fired: fired.length,
      alerts: fired,
      checkedAt: new Date().toISOString(),
    });
  }));

  return router;
}
