import { Router, type Request } from "express";
import { z } from "zod";
import {
  assertTenantInOversight,
  getTenantId,
  resolveOversightTenantIds
} from "../../../../../shared/middleware/tenantContext.js";
import type { PaeRepository } from "../../../domain/ports/PaeRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";
import { RegisterInspection, TargetTenantNotAllowedError } from "../../../application/use-cases/RegisterInspection.js";
import { classifyInspection } from "../../../application/use-cases/classifyInspection.js";
import { EscalateFinding, type EscalationSink } from "../../../application/use-cases/EscalateFinding.js";
import { INSPECTION_KINDS } from "../../../domain/value-objects/InspectionResult.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

export interface PaeRouterDeps {
  repository: PaeRepository;
  /** Escritura en institutional_alerts / coordination_tasks / notifications (glue Fase 2). */
  escalation?: EscalationSink;
  auditLogger?: AuditLogger;
}

/** Lista de tenants que el llamante puede LEER (rollup). */
function readScope(req: Request): string[] {
  const oversight = resolveOversightTenantIds(req);
  if (oversight) {
    return oversight;
  }
  const own = getTenantId(req);
  return own ? [own] : [];
}

/** Resuelve el/los tenant(s) para un GET de lista, respetando ?tenantId= (drill-down). */
function listTenantIds(req: Request): { ok: boolean; tenantIds: string[] } {
  const requested = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  if (requested) {
    if (!assertTenantInOversight(req, requested)) {
      return { ok: false, tenantIds: [] };
    }
    return { ok: true, tenantIds: [requested] };
  }
  return { ok: true, tenantIds: readScope(req) };
}

const operatorSchema = z.object({
  targetTenantId: z.string().uuid().optional(),
  legalName: z.string().min(2),
  nit: z.string().optional(),
  legalRep: z.string().optional(),
  contractNumber: z.string().optional(),
  contractStartsAt: z.string().optional(),
  contractEndsAt: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  status: z.enum(["active", "suspended", "terminated"]).optional()
});

const inspectionSchema = z.object({
  targetTenantId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  foodProgramId: z.string().uuid().optional(),
  inspectionKind: z.enum(INSPECTION_KINDS).default("interventoria_diaria"),
  inspectedAt: z.string().optional(),
  locationDescription: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  portionWeightG: z.number().nonnegative().optional(),
  portionWeightExpectedG: z.number().positive().optional(),
  temperatureC: z.number().optional(),
  earliestExpiryDate: z.string().optional(),
  hygieneScore: z.number().int().min(0).max(100).optional(),
  answers: z.record(z.unknown()).optional(),
  evidenceUrls: z.array(z.string()).optional(),
  notes: z.string().optional()
});

const classifySchema = inspectionSchema.partial().omit({ targetTenantId: true });

export function createPaeRouter(deps: PaeRouterDeps): Router {
  const router = Router();
  const registerInspection = new RegisterInspection({ repository: deps.repository });
  const escalateFinding = deps.escalation
    ? new EscalateFinding({ repository: deps.repository, escalation: deps.escalation })
    : undefined;

  // ── Panel / índice ──
  router.get(
    "/api/v1/pae",
    asyncHandler(async (req, res) => {
      const tenantIds = readScope(req);
      if (tenantIds.length === 0) {
        return sendSuccess(res, { scope: [], inspections: { total: 0 } });
      }
      const recent = await deps.repository.listInspections({ tenantIds, limit: 5, offset: 0 });
      return sendSuccess(res, {
        scope: tenantIds,
        inspections: { total: recent.total, recent: recent.data }
      });
    })
  );

  // ── Alcance del supervisor (municipios visibles) ──
  router.get(
    "/api/v1/pae/scope",
    asyncHandler(async (req, res) => {
      return sendSuccess(res, { tenantIds: readScope(req) });
    })
  );

  // ── Operadores ──
  router.post(
    "/api/v1/pae/operators",
    asyncHandler(async (req, res) => {
      const parsed = operatorSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      const own = getTenantId(req);
      const targetTenantId = parsed.data.targetTenantId ?? own;
      if (!targetTenantId || !assertTenantInOversight(req, targetTenantId)) {
        return sendError(res, 403, "TENANT_NOT_ALLOWED", "No puede registrar operadores en ese municipio.");
      }
      const operator = await deps.repository.createOperator({ ...parsed.data, tenantId: targetTenantId });
      await deps.auditLogger?.({
        tenantId: targetTenantId,
        serviceName: "pae-service",
        entityName: "pae_operators",
        entityId: operator.id,
        actionName: "operator.upserted",
        actorId: (req.headers["x-user-id"] as string) ?? null,
        payload: { legalName: operator.legalName }
      });
      return sendSuccess(res, operator, 201);
    })
  );

  router.get(
    "/api/v1/pae/operators",
    asyncHandler(async (req, res) => {
      const scope = listTenantIds(req);
      if (!scope.ok) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso no encontrado.");
      }
      const operators = await deps.repository.listOperators(scope.tenantIds);
      return sendSuccess(res, operators);
    })
  );

  // ── Inspecciones ──
  router.post(
    "/api/v1/pae/inspections/classify",
    asyncHandler(async (req, res) => {
      const parsed = classifySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      const result = classifyInspection({
        portionWeightG: parsed.data.portionWeightG ?? null,
        portionWeightExpectedG: parsed.data.portionWeightExpectedG ?? null,
        temperatureC: parsed.data.temperatureC ?? null,
        earliestExpiryDate: parsed.data.earliestExpiryDate ?? null,
        hygieneScore: parsed.data.hygieneScore ?? null,
        answers: parsed.data.answers ?? {}
      });
      return sendSuccess(res, result);
    })
  );

  router.post(
    "/api/v1/pae/inspections",
    asyncHandler(async (req, res) => {
      const parsed = inspectionSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      try {
        const inspection = await registerInspection.execute(
          {
            ...parsed.data,
            inspectorRole: (req.headers["x-user-role"] as string) ?? null,
            inspectorUserId: (req.headers["x-user-id"] as string) ?? null,
            inspectorTenantId: getTenantId(req) ?? null,
            createdBy: (req.headers["x-user-id"] as string) ?? null
          },
          (t) => assertTenantInOversight(req, t)
        );
        await deps.auditLogger?.({
          tenantId: inspection.tenantId,
          serviceName: "pae-service",
          entityName: "pae_inspections",
          entityId: inspection.id,
          actionName: "inspection.registered",
          actorId: (req.headers["x-user-id"] as string) ?? null,
          payload: { result: inspection.result, kind: inspection.inspectionKind }
        });

        // Fase 2: hallazgo no conforme → requerimiento a la alcaldía + alerta + tarea.
        let requerimiento = null;
        if (inspection.result === "no_conforme" && escalateFinding) {
          requerimiento = await escalateFinding.fromInspection(inspection, {
            sourceType: "inspection",
            createdByTenantId: getTenantId(req) ?? null,
            createdByRole: (req.headers["x-user-role"] as string) ?? null
          });
          if (requerimiento) {
            await deps.auditLogger?.({
              tenantId: inspection.tenantId,
              serviceName: "pae-service",
              entityName: "pae_requerimientos",
              entityId: requerimiento.id,
              actionName: "requerimiento.created",
              actorId: (req.headers["x-user-id"] as string) ?? null,
              payload: { source: "inspection", inspectionId: inspection.id, severity: requerimiento.severity }
            });
          }
        }

        return sendSuccess(res, { ...inspection, requerimiento }, 201);
      } catch (error) {
        if (error instanceof TargetTenantNotAllowedError) {
          return sendError(res, 403, "TENANT_NOT_ALLOWED", "El municipio no está bajo su supervisión.");
        }
        throw error;
      }
    })
  );

  router.get(
    "/api/v1/pae/inspections",
    asyncHandler(async (req, res) => {
      const scope = listTenantIds(req);
      if (!scope.ok) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso no encontrado.");
      }
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const { data, total } = await deps.repository.listInspections({
        tenantIds: scope.tenantIds,
        operatorId: typeof req.query.operatorId === "string" ? req.query.operatorId : undefined,
        institutionId: typeof req.query.institutionId === "string" ? req.query.institutionId : undefined,
        inspectionKind: typeof req.query.kind === "string" ? req.query.kind : undefined,
        result: typeof req.query.result === "string" ? req.query.result : undefined,
        limit,
        offset: (page - 1) * limit
      });
      return sendPaginatedSuccess(res, data, { total, page, limit });
    })
  );

  router.get(
    "/api/v1/pae/inspections/:id",
    asyncHandler(async (req, res) => {
      const inspection = await deps.repository.findInspectionById(String(req.params.id));
      if (!inspection || !assertTenantInOversight(req, inspection.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Inspección no encontrada.");
      }
      return sendSuccess(res, inspection);
    })
  );

  router.patch(
    "/api/v1/pae/inspections/:id",
    asyncHandler(async (req, res) => {
      const existing = await deps.repository.findInspectionById(String(req.params.id));
      if (!existing || !assertTenantInOversight(req, existing.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Inspección no encontrada.");
      }
      const schema = z.object({
        notes: z.string().optional(),
        evidenceUrls: z.array(z.string()).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", "Payload inválido.");
      }
      const updated = await deps.repository.updateInspectionNotes(
        String(req.params.id),
        parsed.data.notes ?? null,
        parsed.data.evidenceUrls ?? null
      );
      return sendSuccess(res, updated);
    })
  );

  // ── Requerimientos ──
  router.get(
    "/api/v1/pae/requerimientos",
    asyncHandler(async (req, res) => {
      const scope = listTenantIds(req);
      if (!scope.ok) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso no encontrado.");
      }
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const { data, total } = await deps.repository.listRequerimientos({
        tenantIds: scope.tenantIds,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        operatorId: typeof req.query.operatorId === "string" ? req.query.operatorId : undefined,
        limit,
        offset: (page - 1) * limit
      });
      return sendPaginatedSuccess(res, data, { total, page, limit });
    })
  );

  router.get(
    "/api/v1/pae/requerimientos/:id",
    asyncHandler(async (req, res) => {
      const r = await deps.repository.findRequerimientoById(String(req.params.id));
      if (!r || !assertTenantInOversight(req, r.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Requerimiento no encontrado.");
      }
      return sendSuccess(res, r);
    })
  );

  // La alcaldía responde el requerimiento.
  router.patch(
    "/api/v1/pae/requerimientos/:id/respond",
    asyncHandler(async (req, res) => {
      const r = await deps.repository.findRequerimientoById(String(req.params.id));
      if (!r || !assertTenantInOversight(req, r.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Requerimiento no encontrado.");
      }
      const schema = z.object({
        responseNotes: z.string().min(1),
        status: z.enum(["en_respuesta", "subsanado"]).default("en_respuesta")
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      const updated = await deps.repository.updateRequerimientoResponse(String(req.params.id), {
        status: parsed.data.status,
        responseNotes: parsed.data.responseNotes
      });
      if (updated?.status === "subsanado" && updated.coordinationTaskId) {
        await deps.escalation?.completeCoordinationTask?.(updated.coordinationTaskId);
      }
      await deps.auditLogger?.({
        tenantId: r.tenantId,
        serviceName: "pae-service",
        entityName: "pae_requerimientos",
        entityId: r.id,
        actionName: "requerimiento.responded",
        actorId: (req.headers["x-user-id"] as string) ?? null,
        payload: { status: parsed.data.status }
      });
      return sendSuccess(res, updated);
    })
  );

  router.patch(
    "/api/v1/pae/requerimientos/:id/close",
    asyncHandler(async (req, res) => {
      const r = await deps.repository.findRequerimientoById(String(req.params.id));
      if (!r || !assertTenantInOversight(req, r.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Requerimiento no encontrado.");
      }
      const schema = z.object({ status: z.enum(["subsanado", "archivado"]).default("archivado") });
      const parsed = schema.safeParse(req.body ?? {});
      const updated = await deps.repository.closeRequerimiento(
        String(req.params.id),
        parsed.success ? parsed.data.status : "archivado"
      );
      return sendSuccess(res, updated);
    })
  );

  // Gobernación exige a la alcaldía escalar a sanción.
  router.post(
    "/api/v1/pae/requerimientos/:id/escalate-to-sanction",
    asyncHandler(async (req, res) => {
      const r = await deps.repository.findRequerimientoById(String(req.params.id));
      if (!r || !assertTenantInOversight(req, r.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Requerimiento no encontrado.");
      }
      const updated = await deps.repository.escalateRequerimientoToSanction(String(req.params.id));
      await deps.auditLogger?.({
        tenantId: r.tenantId,
        serviceName: "pae-service",
        entityName: "pae_requerimientos",
        entityId: r.id,
        actionName: "requerimiento.escalated_to_sanction",
        actorId: (req.headers["x-user-id"] as string) ?? null,
        payload: {}
      });
      return sendSuccess(res, updated);
    })
  );

  return router;
}
