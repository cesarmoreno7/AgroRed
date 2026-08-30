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

  // Auditoría aleatoria de la Gobernación: programa una visita a un colegio,
  // o dispara el muestreo automático si no se indica institución.
  router.post(
    "/api/v1/pae/audits",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        targetTenantId: z.string().uuid().optional(),
        institutionId: z.string().uuid().optional(),
        foodProgramId: z.string().uuid().optional(),
        operatorId: z.string().uuid().optional(),
        sampleCount: z.number().int().min(1).max(20).optional()
      });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", "Payload inválido.");
      }

      if (!parsed.data.institutionId) {
        const out = await deps.repository.sampleRandomAudits(parsed.data.sampleCount ?? 3);
        return sendSuccess(res, { mode: "muestreo", ...out }, 201);
      }

      const targetTenantId = parsed.data.targetTenantId ?? getTenantId(req);
      if (!targetTenantId || !assertTenantInOversight(req, targetTenantId)) {
        return sendError(res, 403, "TENANT_NOT_ALLOWED", "El municipio no está bajo su supervisión.");
      }
      const stub = await deps.repository.createInspection({
        tenantId: targetTenantId,
        operatorId: parsed.data.operatorId ?? null,
        institutionId: parsed.data.institutionId,
        foodProgramId: parsed.data.foodProgramId ?? null,
        inspectionKind: "auditoria_aleatoria",
        inspectorRole: (req.headers["x-user-role"] as string) ?? "supervisor_departamental",
        inspectorUserId: (req.headers["x-user-id"] as string) ?? null,
        inspectorTenantId: getTenantId(req) ?? null,
        inspectedAt: new Date().toISOString(),
        locationDescription: null,
        latitude: null,
        longitude: null,
        portionWeightG: null,
        portionWeightExpectedG: null,
        temperatureC: null,
        coldChainOk: null,
        expiryCheckOk: null,
        earliestExpiryDate: null,
        hygieneScore: null,
        answers: {},
        failedItems: [],
        result: "pendiente",
        status: "programada",
        evidenceUrls: [],
        notes: null,
        createdBy: (req.headers["x-user-id"] as string) ?? null
      });
      return sendSuccess(res, { mode: "programada", inspection: stub }, 201);
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

  // ══════════════ Control social — CAE ══════════════
  const CAE_CATEGORIES = ["gramaje", "cadena_frio", "vencimiento", "higiene", "inasistencia_entrega", "otro"] as const;

  // Público, SIN autenticación (en auth PUBLIC_PATHS + rate limiter en app.ts).
  router.get(
    "/api/v1/pae/cae/public/:token",
    asyncHandler(async (req, res) => {
      const form = await deps.repository.getPublicCaeForm(String(req.params.token));
      if (!form) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Enlace de reporte no válido o inactivo.");
      }
      return sendSuccess(res, {
        schoolName: form.schoolName,
        municipality: form.municipality,
        categories: CAE_CATEGORIES
      });
    })
  );

  router.post(
    "/api/v1/pae/cae/public/:token",
    asyncHandler(async (req, res) => {
      const committee = await deps.repository.findCaeCommitteeByToken(String(req.params.token));
      if (!committee) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Enlace de reporte no válido o inactivo.");
      }
      const schema = z.object({
        reporterName: z.string().max(255).optional(),
        reporterRole: z.enum(["rector", "docente", "padre_familia", "estudiante", "otro"]).optional(),
        reporterContact: z.string().max(120).optional(),
        category: z.enum(CAE_CATEGORIES),
        description: z.string().min(10).max(4000),
        evidenceUrls: z.array(z.string().url()).max(10).optional(),
        occurredOn: z.string().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }

      const report = await deps.repository.createCaeReport({
        committeeId: committee.id,
        tenantId: committee.tenantId,
        reporterName: parsed.data.reporterName ?? null,
        reporterRole: parsed.data.reporterRole ?? null,
        reporterContact: parsed.data.reporterContact ?? null,
        category: parsed.data.category,
        description: parsed.data.description,
        evidenceUrls: parsed.data.evidenceUrls ?? [],
        occurredOn: parsed.data.occurredOn ?? null,
        clientIp: (req.ip as string) ?? null
      });

      let requerimiento = null;
      if (escalateFinding) {
        requerimiento = await escalateFinding.fromCaeReport({
          id: report.id,
          tenantId: report.tenantId,
          category: report.category,
          description: report.description,
          reporterRole: report.reporterRole
        });
        if (requerimiento) {
          await deps.repository.linkCaeReportRequerimiento(report.id, requerimiento.id);
        }
      }

      await deps.auditLogger?.({
        tenantId: report.tenantId,
        serviceName: "pae-service",
        entityName: "pae_cae_reports",
        entityId: report.id,
        actionName: "cae_report.received",
        actorId: null,
        payload: { category: report.category, requerimientoId: requerimiento?.id ?? null }
      });

      return sendSuccess(
        res,
        { trackingCode: report.id.slice(0, 8).toUpperCase(), status: "recibido" },
        201
      );
    })
  );

  // Autenticado — emisión/rotación de token del comité.
  router.post(
    "/api/v1/pae/cae/committees",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        targetTenantId: z.string().uuid().optional(),
        institutionId: z.string().uuid(),
        committeeName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      const targetTenantId = parsed.data.targetTenantId ?? getTenantId(req);
      if (!targetTenantId || !assertTenantInOversight(req, targetTenantId)) {
        return sendError(res, 403, "TENANT_NOT_ALLOWED", "No puede crear comités en ese municipio.");
      }
      const committee = await deps.repository.createCaeCommittee({
        tenantId: targetTenantId,
        institutionId: parsed.data.institutionId,
        committeeName: parsed.data.committeeName ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        contactPhone: parsed.data.contactPhone ?? null
      });
      const base = process.env.FRONTEND_URL ?? "";
      return sendSuccess(res, { ...committee, publicUrl: `${base}/cae/${committee.token}` }, 201);
    })
  );

  router.get(
    "/api/v1/pae/cae/reports",
    asyncHandler(async (req, res) => {
      const scope = listTenantIds(req);
      if (!scope.ok) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso no encontrado.");
      }
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const { data, total } = await deps.repository.listCaeReports({
        tenantIds: scope.tenantIds,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        limit,
        offset: (page - 1) * limit
      });
      return sendPaginatedSuccess(res, data, { total, page, limit });
    })
  );

  router.patch(
    "/api/v1/pae/cae/reports/:id/triage",
    asyncHandler(async (req, res) => {
      const report = await deps.repository.findCaeReportById(String(req.params.id));
      if (!report || !assertTenantInOversight(req, report.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Reporte no encontrado.");
      }
      const schema = z.object({
        status: z.enum(["triage", "derivado", "descartado"]),
        triageNotes: z.string().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", "Payload inválido.");
      }
      const updated = await deps.repository.triageCaeReport(String(req.params.id), {
        status: parsed.data.status,
        triageNotes: parsed.data.triageNotes ?? null,
        triagedBy: (req.headers["x-user-id"] as string) ?? null
      });
      return sendSuccess(res, updated);
    })
  );

  // ══════════════ Sanciones ══════════════
  router.post(
    "/api/v1/pae/sanctions",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        operatorId: z.string().uuid(),
        requerimientoId: z.string().uuid().optional(),
        sanctionType: z.enum(["amonestacion", "multa", "caducidad"]),
        amount: z.number().nonnegative().optional(),
        justification: z.string().min(10)
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", parsed.error.issues[0]?.message ?? "Payload inválido.");
      }
      const operator = await deps.repository.findOperatorById(parsed.data.operatorId);
      if (!operator || !assertTenantInOversight(req, operator.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Operador no encontrado.");
      }
      const role = (req.headers["x-user-role"] as string) ?? "";
      const isSupervisor = role === "supervisor_departamental";
      const sanction = await deps.repository.createSanction({
        operatorId: operator.id,
        tenantId: operator.tenantId, // la alcaldía contratante
        requerimientoId: parsed.data.requerimientoId ?? null,
        sanctionType: parsed.data.sanctionType,
        amount: parsed.data.amount ?? null,
        justification: parsed.data.justification,
        // Gobernación EXIGE (status='requerida'); la alcaldía PROPONE (status='propuesta').
        requestedByTenantId: isSupervisor ? getTenantId(req) ?? null : null,
        requestedByUser: isSupervisor ? (req.headers["x-user-id"] as string) ?? null : null
      });
      await deps.auditLogger?.({
        tenantId: operator.tenantId,
        serviceName: "pae-service",
        entityName: "pae_sanctions",
        entityId: sanction.id,
        actionName: isSupervisor ? "sanction.required" : "sanction.proposed",
        actorId: (req.headers["x-user-id"] as string) ?? null,
        payload: { type: sanction.sanctionType, status: sanction.status }
      });
      return sendSuccess(res, sanction, 201);
    })
  );

  router.get(
    "/api/v1/pae/sanctions",
    asyncHandler(async (req, res) => {
      const scope = listTenantIds(req);
      if (!scope.ok) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Recurso no encontrado.");
      }
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const { data, total } = await deps.repository.listSanctions({
        tenantIds: scope.tenantIds,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        operatorId: typeof req.query.operatorId === "string" ? req.query.operatorId : undefined,
        limit,
        offset: (page - 1) * limit
      });
      return sendPaginatedSuccess(res, data, { total, page, limit });
    })
  );

  // Solo la alcaldía dueña del contrato aplica la sanción.
  router.patch(
    "/api/v1/pae/sanctions/:id/apply",
    asyncHandler(async (req, res) => {
      const sanction = await deps.repository.findSanctionById(String(req.params.id));
      if (!sanction) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Sanción no encontrada.");
      }
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (role !== "admin_municipal" || getTenantId(req) !== sanction.tenantId) {
        return sendError(res, 403, "TENANT_NOT_ALLOWED", "Solo la alcaldía contratante puede aplicar la sanción.");
      }
      const schema = z.object({ resolutionDocUrl: z.string().url().optional() });
      const parsed = schema.safeParse(req.body ?? {});
      const updated = await deps.repository.applySanction(String(req.params.id), {
        appliedByUser: (req.headers["x-user-id"] as string) ?? null,
        resolutionDocUrl: parsed.success ? parsed.data.resolutionDocUrl ?? null : null
      });
      await deps.auditLogger?.({
        tenantId: sanction.tenantId,
        serviceName: "pae-service",
        entityName: "pae_sanctions",
        entityId: sanction.id,
        actionName: "sanction.applied",
        actorId: (req.headers["x-user-id"] as string) ?? null,
        payload: { type: sanction.sanctionType }
      });
      return sendSuccess(res, updated);
    })
  );

  router.patch(
    "/api/v1/pae/sanctions/:id/status",
    asyncHandler(async (req, res) => {
      const sanction = await deps.repository.findSanctionById(String(req.params.id));
      if (!sanction || !assertTenantInOversight(req, sanction.tenantId)) {
        return sendError(res, 404, "RESOURCE_NOT_FOUND", "Sanción no encontrada.");
      }
      const schema = z.object({ status: z.enum(["en_firme", "archivada"]) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "INVALID_PAYLOAD", "Payload inválido.");
      }
      const updated = await deps.repository.updateSanctionStatus(String(req.params.id), parsed.data.status);
      return sendSuccess(res, updated);
    })
  );

  return router;
}
