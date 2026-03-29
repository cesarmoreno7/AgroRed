import { Router } from "express";
import { z } from "zod";
import { RegisterIncident } from "../../../application/use-cases/RegisterIncident.js";
import { UpdateIncidentStatus } from "../../../application/use-cases/UpdateIncidentStatus.js";
import { RegisterIncidentAction } from "../../../application/use-cases/RegisterIncidentAction.js";
import { PrioritizeIncident } from "../../../application/use-cases/PrioritizeIncident.js";
import { GenerateIncidentAlerts } from "../../../application/use-cases/GenerateIncidentAlerts.js";
import { classifyIncident } from "../../../application/use-cases/ClassifyIncident.js";
import type { Incident } from "../../../domain/entities/Incident.js";
import type { IncidentRepository, IncidentAction, IncidentAlert } from "../../../domain/ports/IncidentRepository.js";
import { INCIDENT_SEVERITIES } from "../../../domain/value-objects/IncidentSeverity.js";
import { INCIDENT_TYPES } from "../../../domain/value-objects/IncidentType.js";
import { INCIDENT_STATUSES } from "../../../domain/value-objects/IncidentStatus.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerIncidentSchema = z.object({
  tenantId: z.string().min(1),
  logisticsOrderId: z.string().uuid().optional().nullable(),
  incidentType: z.enum(INCIDENT_TYPES),
  severity: z.enum(INCIDENT_SEVERITIES),
  title: z.string().min(3),
  description: z.string().min(10),
  locationDescription: z.string().min(3),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  occurredAt: z.coerce.date(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  // Extended fields
  reportedBy: z.string().max(255).optional().nullable(),
  reporterRole: z.string().max(100).optional().nullable(),
  affectedPopulation: z.coerce.number().int().min(0).optional().default(0),
  affectedCommunity: z.string().max(255).optional().nullable(),
  evidenceUrls: z.array(z.string().url()).max(10).optional().default([]),
  parentIncidentId: z.string().uuid().optional().nullable(),
});

const updateStatusSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  assignedTo: z.string().max(255).optional(),
  resolutionNotes: z.string().max(2000).optional(),
  performedBy: z.string().min(1),
});

const registerActionSchema = z.object({
  actionType: z.string().min(1),
  performedBy: z.string().min(1),
  description: z.string().min(3),
  metadata: z.record(z.unknown()).optional(),
});

function toIncidentResponse(incident: Incident) {
  return {
    id: incident.id,
    tenantId: incident.tenantId,
    logisticsOrderId: incident.logisticsOrderId,
    incidentType: incident.incidentType,
    severity: incident.severity,
    title: incident.title,
    description: incident.description,
    locationDescription: incident.locationDescription,
    latitude: incident.latitude,
    longitude: incident.longitude,
    occurredAt: incident.occurredAt.toISOString(),
    municipalityName: incident.municipalityName,
    notes: incident.notes,
    status: incident.status,
    reportedBy: incident.reportedBy,
    reporterRole: incident.reporterRole,
    affectedPopulation: incident.affectedPopulation,
    affectedCommunity: incident.affectedCommunity,
    evidenceUrls: incident.evidenceUrls,
    assignedTo: incident.assignedTo,
    priorityScore: incident.priorityScore,
    resolutionNotes: incident.resolutionNotes,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    escalatedAt: incident.escalatedAt?.toISOString() ?? null,
    interventionStartedAt: incident.interventionStartedAt?.toISOString() ?? null,
    recurrenceCount: incident.recurrenceCount,
    parentIncidentId: incident.parentIncidentId,
    slaTargetMinutes: incident.slaTargetMinutes,
    firstResponseAt: incident.firstResponseAt?.toISOString() ?? null,
    responseTimeMinutes: incident.responseTimeMinutes,
    createdAt: incident.createdAt.toISOString(),
  };
}

function toActionResponse(a: IncidentAction) {
  return {
    id: a.id,
    incidentId: a.incidentId,
    actionType: a.actionType,
    performedBy: a.performedBy,
    description: a.description,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  };
}

function toAlertResponse(a: IncidentAlert) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    alertType: a.alertType,
    severity: a.severity,
    title: a.title,
    description: a.description,
    zoneName: a.zoneName,
    incidentCount: a.incidentCount,
    isAcknowledged: a.isAcknowledged,
    acknowledgedBy: a.acknowledgedBy,
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  };
}

export function createIncidentsRouter(repository: IncidentRepository): Router {
  const router = Router();
  const registerIncident = new RegisterIncident(repository);
  const updateIncidentStatus = new UpdateIncidentStatus(repository);
  const registerIncidentAction = new RegisterIncidentAction(repository);
  const prioritizeIncident = new PrioritizeIncident(repository);
  const generateIncidentAlerts = new GenerateIncidentAlerts(repository);

  // ── Registrar incidencia ──
  router.post("/api/v1/incidents/register", asyncHandler(async (req, res) => {
    const parsed = registerIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_INCIDENT_PAYLOAD", "Payload invalido para registro de incidencia.");
    }

    try {
      const incident = await registerIncident.execute(parsed.data);
      return sendSuccess(res, toIncidentResponse(incident), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      if (error instanceof Error && error.message === "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT", "La operacion logistica asociada no existe para el municipio indicado.");
      }
      if (error instanceof Error && error.message === "INVALID_INCIDENT_OCCURRED_AT") {
        return sendError(res, 400, "INVALID_INCIDENT_OCCURRED_AT", "La fecha y hora de ocurrencia no es valida.");
      }
      if (error instanceof Error && error.message === "INVALID_INCIDENT_COORDINATES") {
        return sendError(res, 400, "INVALID_INCIDENT_COORDINATES", "Las coordenadas de la incidencia son invalidas o incompletas.");
      }
      return sendError(res, 500, "INCIDENT_REGISTRATION_FAILED", "No fue posible registrar la incidencia territorial.");
    }
  }));

  // ── Listar incidencias (con filtros) ──
  router.get("/api/v1/incidents", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? (req.query.tenantId ? String(req.query.tenantId) : undefined);
    const filter = {
      tenantId,
      status: req.query.status ? String(req.query.status) as any : undefined,
      severity: req.query.severity ? String(req.query.severity) : undefined,
      incidentType: req.query.incidentType ? String(req.query.incidentType) : undefined,
      municipalityName: req.query.municipalityName ? String(req.query.municipalityName) : undefined,
    };
    try {
      const result = await repository.list({ page, limit }, filter);
      return sendPaginatedSuccess(res, result.data.map(toIncidentResponse), { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "INCIDENTS_LIST_FAILED", "No fue posible listar las incidencias.");
    }
  }));

  // ── Obtener incidencia por ID ──
  router.get("/api/v1/incidents/:id", asyncHandler(async (req, res) => {
    const incident = await repository.findById(String(req.params.id));
    if (!incident) return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && incident.tenantId !== tenantId) {
      return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");
    }

    return sendSuccess(res, toIncidentResponse(incident));
  }));

  // ── Cambiar estado (con validación de transición) ──
  router.patch("/api/v1/incidents/:id/status", asyncHandler(async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_STATUS_PAYLOAD", "Payload de cambio de estado invalido.");
    }

    try {
      const incident = await updateIncidentStatus.execute({
        incidentId: String(req.params.id),
        ...parsed.data,
      });
      return sendSuccess(res, toIncidentResponse(incident));
    } catch (error) {
      if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND") {
        return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");
      }
      if (error instanceof Error && error.message === "INVALID_STATUS_TRANSITION") {
        return sendError(res, 422, "INVALID_STATUS_TRANSITION", "La transicion de estado no es valida.");
      }
      return sendError(res, 500, "STATUS_UPDATE_FAILED", "No fue posible actualizar el estado.");
    }
  }));

  // ── Priorizar incidencia (calcular score) ──
  router.post("/api/v1/incidents/:id/prioritize", asyncHandler(async (req, res) => {
    try {
      const score = await prioritizeIncident.execute(String(req.params.id));
      return sendSuccess(res, { incidentId: req.params.id, priorityScore: score });
    } catch (error) {
      if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND") {
        return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");
      }
      return sendError(res, 500, "PRIORITIZATION_FAILED", "No fue posible calcular la prioridad.");
    }
  }));

  // ── Registrar acción sobre incidencia ──
  router.post("/api/v1/incidents/:id/actions", asyncHandler(async (req, res) => {
    const parsed = registerActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ACTION_PAYLOAD", "Payload de accion invalido.");
    }

    try {
      const action = await registerIncidentAction.execute({
        incidentId: String(req.params.id),
        ...parsed.data,
      });
      return sendSuccess(res, toActionResponse(action), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND") {
        return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");
      }
      if (error instanceof Error && error.message === "INVALID_ACTION_TYPE") {
        return sendError(res, 400, "INVALID_ACTION_TYPE", "Tipo de accion no valido.");
      }
      return sendError(res, 500, "ACTION_REGISTRATION_FAILED", "No fue posible registrar la accion.");
    }
  }));

  // ── Listar acciones de una incidencia ──
  router.get("/api/v1/incidents/:id/actions", asyncHandler(async (req, res) => {
    const actions = await repository.listActions(String(req.params.id));
    return sendSuccess(res, actions.map(toActionResponse));
  }));

  // ── Alertas de incidencias por tenant ──
  router.get("/api/v1/incidents/alerts/:tenantId", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    try {
      const result = await repository.listAlerts(String(req.params.tenantId), { page, limit });
      return sendPaginatedSuccess(res, result.data.map(toAlertResponse), { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ALERTS_LIST_FAILED", "No fue posible listar las alertas.");
    }
  }));

  // ── Generar alertas automaticas ──
  router.post("/api/v1/incidents/alerts/:tenantId/generate", asyncHandler(async (req, res) => {
    try {
      const alerts = await generateIncidentAlerts.execute(String(req.params.tenantId));
      return sendSuccess(res, { generated: alerts.length, alerts: alerts.map(toAlertResponse) }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ALERT_GENERATION_FAILED", "No fue posible generar alertas automaticas.");
    }
  }));

  // ── Reconocer alerta ──
  router.patch("/api/v1/incidents/alerts/:alertId/acknowledge", asyncHandler(async (req, res) => {
    const acknowledgedBy = req.body?.acknowledgedBy;
    if (!acknowledgedBy || typeof acknowledgedBy !== "string") {
      return sendError(res, 400, "INVALID_ACKNOWLEDGE_PAYLOAD", "Se requiere acknowledgedBy.");
    }
    await repository.acknowledgeAlert(String(req.params.alertId), acknowledgedBy);
    return sendSuccess(res, { acknowledged: true });
  }));

  // ── Resumen analítico por zona ──
  router.get("/api/v1/incidents/analytics/:tenantId", asyncHandler(async (req, res) => {
    try {
      const zoneSummary = await repository.getZoneSummary(String(req.params.tenantId));
      const heatmap = await repository.countByZoneAndSeverity(String(req.params.tenantId));
      return sendSuccess(res, { zoneSummary, heatmap });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ANALYTICS_FAILED", "No fue posible generar la analitica de incidencias.");
    }
  }));

  // ── Clustering espacial PostGIS (hotspots) ──
  router.get("/api/v1/incidents/analytics/:tenantId/clusters", asyncHandler(async (req, res) => {
    const radiusM = Math.max(50, Math.min(5000, parseInt(String(req.query.radiusM ?? "500"), 10) || 500));
    const minPoints = Math.max(2, Math.min(20, parseInt(String(req.query.minPoints ?? "2"), 10) || 2));

    try {
      const clusters = await repository.getIncidentClusters(String(req.params.tenantId), radiusM, minPoints);
      return sendSuccess(res, {
        totalClusters: clusters.length,
        parameters: { radiusM, minPoints },
        clusters,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "CLUSTERING_FAILED", "No fue posible calcular los clusters de incidencias.");
    }
  }));

  // ── Tendencias temporales ──
  router.get("/api/v1/incidents/analytics/:tenantId/trends", asyncHandler(async (req, res) => {
    const granularity = String(req.query.granularity ?? "weekly") === "daily" ? "daily" as const : "weekly" as const;
    const limit = Math.max(1, Math.min(365, parseInt(String(req.query.limit ?? "52"), 10) || 52));

    try {
      const trends = await repository.getIncidentTrends(String(req.params.tenantId), granularity, limit);
      return sendSuccess(res, { granularity, totalPeriods: trends.length, trends });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "TRENDS_FAILED", "No fue posible generar las tendencias de incidencias.");
    }
  }));

  // ── Orquestar logística desde incidencia (cross-service) ──
  router.post("/api/v1/incidents/:id/trigger-logistics", asyncHandler(async (req, res) => {
    const incident = await repository.findById(String(req.params.id));
    if (!incident) return sendError(res, 404, "INCIDENT_NOT_FOUND", "Incidencia no encontrada.");

    if (incident.logisticsOrderId) {
      return sendError(res, 409, "LOGISTICS_ALREADY_LINKED", "La incidencia ya tiene una orden logística vinculada.");
    }

    const logisticsUrl = process.env.LOGISTICS_SERVICE_URL || "http://localhost:3007";

    try {
      const orderPayload = {
        tenantId: incident.tenantId,
        originDescription: "Auto-generada desde incidencia " + incident.id,
        destinationDescription: incident.locationDescription,
        destinationLat: incident.latitude,
        destinationLng: incident.longitude,
        productName: `Respuesta a: ${incident.title}`,
        quantity: 1,
        unit: "servicio",
        priority: incident.severity === "critical" ? "urgent" : incident.severity === "high" ? "high" : "normal",
        notes: `Incidencia: ${incident.title}. Severidad: ${incident.severity}. Población afectada: ${incident.affectedPopulation}`,
      };

      const resp = await fetch(`${logisticsUrl}/api/v1/logistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!resp.ok) {
        return sendError(res, 502, "LOGISTICS_SERVICE_ERROR", "El servicio de logística respondió con error.");
      }

      const logisticsData = await resp.json() as { data?: { id?: string } };
      const logisticsOrderId = logisticsData.data?.id;

      // Register action
      if (logisticsOrderId) {
        const { randomUUID } = await import("node:crypto");
        await repository.saveAction({
          id: randomUUID(),
          incidentId: incident.id,
          actionType: "logistics_triggered",
          performedBy: req.body?.performedBy ?? "system",
          description: `Orden logística ${logisticsOrderId} creada automáticamente`,
          metadata: { logisticsOrderId },
          createdAt: new Date(),
        });
      }

      return sendSuccess(res, {
        incidentId: incident.id,
        logisticsOrderId,
        message: "Orden logística creada exitosamente desde incidencia.",
      }, 201);
    } catch {
      return sendError(res, 502, "LOGISTICS_SERVICE_UNAVAILABLE", "No fue posible contactar el servicio de logística.");
    }
  }));

  // ══════════════════════════════════════
  // DYNAMIC ALERT THRESHOLDS
  // ══════════════════════════════════════

  router.get("/api/v1/incidents/thresholds/:tenantId", asyncHandler(async (req, res) => {
    try {
      const thresholds = await repository.getAlertThresholds(String(req.params.tenantId));
      return sendSuccess(res, thresholds);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "THRESHOLDS_FAILED", "No fue posible obtener los umbrales.");
    }
  }));

  const upsertThresholdSchema = z.object({
    ruleKey: z.string().min(3).max(80).regex(/^incident\.\w+$/, "rule_key debe iniciar con 'incident.'"),
    value: z.coerce.number().min(0),
    updatedBy: z.string().optional(),
  });

  router.put("/api/v1/incidents/thresholds/:tenantId", asyncHandler(async (req, res) => {
    const parsed = upsertThresholdSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_THRESHOLD", "Payload invalido para umbral de alerta.");
    }
    try {
      const threshold = await repository.upsertAlertThreshold(
        String(req.params.tenantId),
        parsed.data.ruleKey,
        parsed.data.value,
        parsed.data.updatedBy,
      );
      return sendSuccess(res, threshold);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "THRESHOLD_UPSERT_FAILED", "No fue posible actualizar el umbral.");
    }
  }));

  // ══════════════════════════════════════
  // NLP AUTO-CLASSIFICATION
  // ══════════════════════════════════════

  const classifySchema = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
  });

  router.post("/api/v1/incidents/classify", asyncHandler(async (req, res) => {
    const parsed = classifySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CLASSIFY_PAYLOAD", "Se requiere title y description.");
    }
    const result = classifyIncident(parsed.data.title, parsed.data.description);
    return sendSuccess(res, result);
  }));

  // Classify + register in one step
  router.post("/api/v1/incidents/register-auto", asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body || !body.title || !body.description) {
      return sendError(res, 400, "MISSING_TEXT", "Se requiere title y description para auto-clasificar.");
    }

    const classification = classifyIncident(body.title, body.description);

    // Allow override from body; fallback to NLP suggestion
    const enriched = {
      ...body,
      incidentType: body.incidentType || classification.suggestedType,
      severity: body.severity || classification.suggestedSeverity,
    };

    const parsed = registerIncidentSchema.safeParse(enriched);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_INCIDENT_PAYLOAD", "Payload invalido para registrar incidencia.");
    }

    try {
      const incident = await registerIncident.execute(parsed.data);
      return sendSuccess(res, {
        incident: toIncidentResponse(incident),
        classification: {
          suggestedType: classification.suggestedType,
          suggestedSeverity: classification.suggestedSeverity,
          confidence: classification.confidence,
          matchedKeywords: classification.matchedKeywords,
          method: classification.method,
        },
      }, 201);
    } catch (error) {
      return sendError(res, 500, "REGISTER_FAILED", "No fue posible registrar la incidencia.");
    }
  }));

  return router;
}