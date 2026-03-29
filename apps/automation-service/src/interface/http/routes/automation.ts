import { Router } from "express";
import { z } from "zod";
import { ExecuteAutomationRun } from "../../../application/use-cases/ExecuteAutomationRun.js";
import type { AutomationRun } from "../../../domain/entities/AutomationRun.js";
import type { AutomationRepository } from "../../../domain/ports/AutomationRepository.js";
import { AUTOMATION_TRIGGER_SOURCES } from "../../../domain/value-objects/AutomationTriggerSource.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const executeAutomationSchema = z.object({
  tenantId: z.string().min(1),
  triggerSource: z.enum(AUTOMATION_TRIGGER_SOURCES),
  incidentId: z.string().uuid().optional().nullable(),
  logisticsOrderId: z.string().uuid().optional().nullable(),
  notes: z.string().min(3).max(500).optional().nullable()
});

const listAutomationQuerySchema = z.object({
  tenantId: z.string().min(1).optional()
});

function toAutomationResponse(run: AutomationRun) {
  return {
    id: run.id,
    tenantId: run.tenantId,
    incidentId: run.incidentId,
    logisticsOrderId: run.logisticsOrderId,
    triggerSource: run.triggerSource,
    modelVersion: run.modelVersion,
    classification: run.classification,
    status: run.status,
    actions: run.actions,
    metricsSnapshot: run.metricsSnapshot,
    notes: run.notes,
    createdAt: run.createdAt.toISOString()
  };
}

export function createAutomationRouter(repository: AutomationRepository): Router {
  const router = Router();
  const executeAutomationRun = new ExecuteAutomationRun(repository);

  router.post("/api/v1/automation/execute", asyncHandler(async (req, res) => {
    const parsed = executeAutomationSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_AUTOMATION_PAYLOAD", "Payload invalido para ejecucion de automatizacion.");
    }

    try {
      const run = await executeAutomationRun.execute(parsed.data);
      return sendSuccess(res, toAutomationResponse(run), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "INCIDENT_NOT_FOUND_FOR_TENANT", "La incidencia asociada no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT", "La operacion logistica asociada no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "INCIDENT_REQUIRED_FOR_TRIGGER") {
        return sendError(res, 400, "INCIDENT_REQUIRED_FOR_TRIGGER", "La automatizacion por incidencia requiere una incidencia asociada.");
      }

      if (error instanceof Error && error.message === "LOGISTICS_ORDER_REQUIRED_FOR_TRIGGER") {
        return sendError(res, 400, "LOGISTICS_ORDER_REQUIRED_FOR_TRIGGER", "La automatizacion de seguimiento logistico requiere una operacion asociada.");
      }

      return sendError(res, 500, "AUTOMATION_EXECUTION_FAILED", "No fue posible generar la corrida de automatizacion.");
    }
  }));

  router.get("/api/v1/automation", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? (req.query.tenantId as string | undefined);

    try {
      const result = await repository.list({ page, limit }, tenantId);
      return sendPaginatedSuccess(res, result.data.map(toAutomationResponse), { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      return sendError(res, 500, "AUTOMATION_LIST_FAILED", "No fue posible listar las corridas de automatizacion.");
    }
  }));

  router.get("/api/v1/automation/:id", asyncHandler(async (req, res) => {
    const run = await repository.findById(String(req.params.id));

    if (!run) {
      return sendError(res, 404, "AUTOMATION_RUN_NOT_FOUND", "Corrida de automatizacion no encontrada.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && run.tenantId !== tenantId) {
      return sendError(res, 404, "AUTOMATION_RUN_NOT_FOUND", "Corrida de automatizacion no encontrada.");
    }

    return sendSuccess(res, toAutomationResponse(run));
  }));

  return router;
}