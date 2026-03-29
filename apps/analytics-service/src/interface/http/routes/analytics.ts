import { Router } from "express";
import { z } from "zod";
import { GetAnalyticsSummary } from "../../../application/use-cases/GetAnalyticsSummary.js";
import { GetTerritorialOverview } from "../../../application/use-cases/GetTerritorialOverview.js";
import type { AnalyticsRepository } from "../../../domain/ports/AnalyticsRepository.js";
import type { RedisCache } from "../../../../shared/redis/RedisCache.js";
import { asyncHandler, sendError, sendSuccess } from "../response.js";
import { sendPdf } from "../pdf.js";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(","));
  }
  return lines.join("\n");
}

function sendCsv(res: import("express").Response, data: Record<string, unknown>[], filename: string) {
  const csv = toCsv(data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
}

const summaryQuerySchema = z.object({
  tenantId: z.string().min(1).optional()
});

export function createAnalyticsRouter(repository: AnalyticsRepository, cache?: RedisCache): Router {
  const router = Router();
  const getAnalyticsSummary = new GetAnalyticsSummary(repository);
  const getTerritorialOverview = new GetTerritorialOverview(repository);
  const CACHE_TTL = 300; // 5 minutes

  router.get("/api/v1/analytics/summary", asyncHandler(async (req, res) => {
    const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? (req.query.tenantId ? String(req.query.tenantId) : undefined);
    const format = String(req.query.format ?? "json").toLowerCase();

    try {
      const cacheKey = `summary:${tenantId ?? "all"}`;
      const summary = cache
        ? await cache.getOrSet(cacheKey, CACHE_TTL, () => getAnalyticsSummary.execute(tenantId))
        : await getAnalyticsSummary.execute(tenantId);

      if (format === "csv") {
        const flatRow = {
          tenantId: summary.tenantId,
          tenantCode: summary.tenantCode,
          tenantName: summary.tenantName,
          ...summary.totals,
          ...summary.operations,
          generatedAt: summary.generatedAt,
        };
        return sendCsv(res, [flatRow], "analytics_summary.csv");
      }

      if (format === "pdf") {
        const flatRow = {
          tenantId: summary.tenantId,
          tenantCode: summary.tenantCode,
          tenantName: summary.tenantName,
          ...summary.totals,
          ...summary.operations,
          generatedAt: summary.generatedAt,
        };
        return sendPdf(res, [flatRow], "analytics_summary.pdf", "Resumen Analítico");
      }

      return sendSuccess(res, summary);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      return sendError(res, 500, "ANALYTICS_SUMMARY_FAILED", "No fue posible construir el resumen analitico.");
    }
  }));

  router.get("/api/v1/analytics/territorial-overview", asyncHandler(async (req, res) => {
    const format = String(req.query.format ?? "json").toLowerCase();
    const overview = cache
      ? await cache.getOrSet("territorial-overview", CACHE_TTL, () => getTerritorialOverview.execute())
      : await getTerritorialOverview.execute();

    if (format === "csv") {
      return sendCsv(res, overview as unknown as Record<string, unknown>[], "territorial_overview.csv");
    }

    if (format === "pdf") {
      return sendPdf(res, overview as unknown as Record<string, unknown>[], "territorial_overview.pdf", "Resumen Territorial");
    }

    return sendSuccess(res, overview);
  }));

  return router;
}