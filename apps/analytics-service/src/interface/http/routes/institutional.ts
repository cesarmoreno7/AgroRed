import { Router } from "express";
import { z } from "zod";
import type { InstitutionalRepository } from "../../../domain/ports/InstitutionalRepository.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";
import { sendPdf } from "../pdf.js";
import { ImportFoodPrograms } from "../../../application/use-cases/ImportFoodPrograms.js";

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

// ── Schemas ──

const createProgramSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(3),
  programType: z.enum(["comedor_comunitario", "programa_escolar", "ayuda_humanitaria", "subsidio_alimentario"]),
  description: z.string().optional(),
  targetPopulation: z.coerce.number().int().min(0).optional().default(0),
  budgetAllocated: z.coerce.number().min(0).optional().default(0),
  responsibleName: z.string().optional(),
  responsibleEmail: z.string().email().optional(),
  municipalityName: z.string().min(3),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const createBeneficiarySchema = z.object({
  tenantId: z.string().min(1),
  programId: z.string().uuid().optional(),
  fullName: z.string().min(2),
  documentId: z.string().optional(),
  documentType: z.enum(["CC", "TI", "RC", "CE", "PEP", "NIT"]).optional(),
  age: z.coerce.number().int().min(0).max(150).optional(),
  gender: z.string().optional(),
  socioeconomicLevel: z.coerce.number().int().min(1).max(6).optional(),
  riskClassification: z.enum(["critico", "alto", "medio", "bajo"]).optional(),
  nutritionalStatus: z.enum(["normal", "desnutricion_aguda", "desnutricion_cronica", "sobrepeso"]).optional(),
  municipalityName: z.string().min(3),
  zoneName: z.string().optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  contactPhone: z.string().optional(),
});

const createTaskSchema = z.object({
  tenantId: z.string().min(1),
  actorType: z.enum(["supermercado", "banco_alimentos", "operador_logistico", "entidad_salud", "ong", "alcaldia"]),
  actorName: z.string().min(2),
  taskDescription: z.string().min(5),
  assignedTo: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ── Router ──

export function createInstitutionalRouter(repository: InstitutionalRepository): Router {
  const router = Router();

  // ═══════════════════════════════════════
  // DASHBOARD INSTITUCIONAL
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/dashboard", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    try {
      const dashboard = await repository.getInstitutionalDashboard(tenantId);
      return sendSuccess(res, dashboard);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "DASHBOARD_FAILED", "No fue posible generar el dashboard institucional.");
    }
  }));

  // ═══════════════════════════════════════
  // IRAT (Índice de Riesgo Alimentario)
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/irat", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const format = String(req.query.format ?? "json").toLowerCase();
    try {
      const scores = await repository.getIratScores(tenantId);

      if (format === "csv") {
        return sendCsv(res, scores as unknown as Record<string, unknown>[], "irat_scores.csv");
      }

      if (format === "pdf") {
        return sendPdf(res, scores as unknown as Record<string, unknown>[], "irat_scores.pdf", "Índice de Riesgo Alimentario Territorial (IRAT)");
      }

      return sendSuccess(res, scores);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "IRAT_FAILED", "No fue posible calcular el indice IRAT.");
    }
  }));

  // ═══════════════════════════════════════
  // PROGRAMAS ALIMENTARIOS
  // ═══════════════════════════════════════

  router.post("/api/v1/analytics/institutional/programs", asyncHandler(async (req, res) => {
    const parsed = createProgramSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PROGRAM_PAYLOAD", "Payload invalido para crear programa.");
    }
    try {
      const program = await repository.createProgram(parsed.data);
      return sendSuccess(res, program, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "PROGRAM_CREATION_FAILED", "No fue posible crear el programa.");
    }
  }));

  router.get("/api/v1/analytics/institutional/programs", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    try {
      const result = await repository.listPrograms(tenantId, { page, limit });
      return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "PROGRAMS_LIST_FAILED", "No fue posible listar programas.");
    }
  }));

  router.get("/api/v1/analytics/institutional/programs/:id", asyncHandler(async (req, res) => {
    const program = await repository.findProgramById(String(req.params.id));
    if (!program) return sendError(res, 404, "PROGRAM_NOT_FOUND", "Programa no encontrado.");
    return sendSuccess(res, program);
  }));

  router.patch("/api/v1/analytics/institutional/programs/:id/status", asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!status || !["active", "paused", "completed", "cancelled"].includes(status)) {
      return sendError(res, 400, "INVALID_STATUS", "Estado de programa invalido.");
    }
    await repository.updateProgramStatus(String(req.params.id), status);
    return sendSuccess(res, { updated: true });
  }));

  // ═══════════════════════════════════════
  // CSV IMPORT — COMEDORES / PAE / INSTITUCIONES
  // ═══════════════════════════════════════

  const csvProgramImportSchema = z.object({
    tenantId: z.string().min(1),
    municipalityName: z.string().min(3),
    csvText: z.string().min(10, "El CSV debe contener encabezados y al menos una fila de datos.")
  });

  router.post("/api/v1/analytics/institutional/programs/import/csv", asyncHandler(async (req, res) => {
    const parsed = csvProgramImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CSV_PAYLOAD", "Payload inválido para importación CSV de programas.");
    }

    const importUseCase = new ImportFoodPrograms(repository);
    try {
      const result = await importUseCase.execute(
        parsed.data.csvText,
        parsed.data.tenantId,
        parsed.data.municipalityName
      );
      const httpStatus = result.errorCount > 0 && result.successCount === 0 ? 422 : 200;
      return sendSuccess(res, {
        importId: result.importId,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        programs: result.programs
      }, httpStatus);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "CSV_IMPORT_FAILED", "No fue posible procesar la importación CSV de programas.");
    }
  }));

  // ═══════════════════════════════════════
  // COBERTURA DE PROGRAMAS
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/coverage", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const format = String(req.query.format ?? "json").toLowerCase();
    try {
      const coverage = await repository.getProgramCoverage(tenantId);

      if (format === "csv") {
        return sendCsv(res, coverage as unknown as Record<string, unknown>[], "program_coverage.csv");
      }

      if (format === "pdf") {
        return sendPdf(res, coverage as unknown as Record<string, unknown>[], "program_coverage.pdf", "Cobertura de Programas Alimentarios");
      }

      return sendSuccess(res, coverage);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "COVERAGE_FAILED", "No fue posible obtener la cobertura.");
    }
  }));

  // ═══════════════════════════════════════
  // BENEFICIARIOS
  // ═══════════════════════════════════════

  router.post("/api/v1/analytics/institutional/beneficiaries", asyncHandler(async (req, res) => {
    const parsed = createBeneficiarySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_BENEFICIARY_PAYLOAD", "Payload invalido para crear beneficiario.");
    }
    try {
      const beneficiary = await repository.createBeneficiary(parsed.data);
      return sendSuccess(res, beneficiary, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "BENEFICIARY_CREATION_FAILED", "No fue posible registrar el beneficiario.");
    }
  }));

  router.get("/api/v1/analytics/institutional/beneficiaries", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const filter = {
      programId: req.query.programId ? String(req.query.programId) : undefined,
      riskClassification: req.query.riskClassification ? String(req.query.riskClassification) : undefined,
      municipalityName: req.query.municipalityName ? String(req.query.municipalityName) : undefined,
    };
    try {
      const result = await repository.listBeneficiaries(tenantId, { page, limit }, filter);
      return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "BENEFICIARIES_LIST_FAILED", "No fue posible listar beneficiarios.");
    }
  }));

  router.get("/api/v1/analytics/institutional/beneficiaries/:id", asyncHandler(async (req, res) => {
    const beneficiary = await repository.findBeneficiaryById(String(req.params.id));
    if (!beneficiary) return sendError(res, 404, "BENEFICIARY_NOT_FOUND", "Beneficiario no encontrado.");
    return sendSuccess(res, beneficiary);
  }));

  // ═══════════════════════════════════════
  // ALERTAS INSTITUCIONALES
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/alerts", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    try {
      const result = await repository.listInstitutionalAlerts(tenantId, { page, limit });
      return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ALERTS_LIST_FAILED", "No fue posible listar alertas.");
    }
  }));

  router.post("/api/v1/analytics/institutional/alerts/generate", asyncHandler(async (req, res) => {
    const tenantId = req.body?.tenantId;
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    try {
      const alerts = await repository.generateAlerts(tenantId);
      return sendSuccess(res, { generated: alerts.length, alerts }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "ALERTS_GENERATION_FAILED", "No fue posible generar alertas.");
    }
  }));

  router.patch("/api/v1/analytics/institutional/alerts/:alertId/acknowledge", asyncHandler(async (req, res) => {
    const acknowledgedBy = req.body?.acknowledgedBy;
    if (!acknowledgedBy) return sendError(res, 400, "MISSING_ACKNOWLEDGED_BY", "Se requiere acknowledgedBy.");
    await repository.acknowledgeInstitutionalAlert(String(req.params.alertId), acknowledgedBy);
    return sendSuccess(res, { acknowledged: true });
  }));

  // ═══════════════════════════════════════
  // COORDINACIÓN INTERINSTITUCIONAL
  // ═══════════════════════════════════════

  router.post("/api/v1/analytics/institutional/tasks", asyncHandler(async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_TASK_PAYLOAD", "Payload invalido para crear tarea.");
    }
    try {
      const task = await repository.createCoordinationTask({
        ...parsed.data,
        assignedTo: parsed.data.assignedTo ?? null,
        dueDate: parsed.data.dueDate ?? null,
        notes: parsed.data.notes ?? null,
        status: "pending",
      });
      return sendSuccess(res, task, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "TASK_CREATION_FAILED", "No fue posible crear la tarea.");
    }
  }));

  router.get("/api/v1/analytics/institutional/tasks", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    try {
      const result = await repository.listCoordinationTasks(tenantId, { page, limit });
      return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "TASKS_LIST_FAILED", "No fue posible listar tareas.");
    }
  }));

  router.patch("/api/v1/analytics/institutional/tasks/:taskId/status", asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!status || !["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      return sendError(res, 400, "INVALID_TASK_STATUS", "Estado de tarea invalido.");
    }
    await repository.updateCoordinationTaskStatus(String(req.params.taskId), status);
    return sendSuccess(res, { updated: true });
  }));

  // ═══════════════════════════════════════
  // SIMULACIÓN DE ASIGNACIÓN DE RECURSOS
  // ═══════════════════════════════════════

  const createScenarioSchema = z.object({
    tenantId: z.string().min(1),
    scenarioName: z.string().min(3),
    description: z.string().optional(),
    budgetTotal: z.coerce.number().min(0),
    parameters: z.record(z.unknown()).optional().default({}),
    createdBy: z.string().optional(),
  });

  router.post("/api/v1/analytics/institutional/scenarios", asyncHandler(async (req, res) => {
    const parsed = createScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_SCENARIO_PAYLOAD", "Payload invalido para crear escenario de simulacion.");
    }
    try {
      const scenario = await repository.createAllocationScenario(parsed.data);
      return sendSuccess(res, scenario, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SCENARIO_CREATION_FAILED", "No fue posible crear el escenario.");
    }
  }));

  router.get("/api/v1/analytics/institutional/scenarios", asyncHandler(async (req, res) => {
    const tenantId = String(req.query.tenantId ?? "");
    if (!tenantId) return sendError(res, 400, "MISSING_TENANT", "Se requiere tenantId.");
    try {
      const scenarios = await repository.listAllocationScenarios(tenantId);
      return sendSuccess(res, scenarios);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SCENARIOS_LIST_FAILED", "No fue posible listar escenarios.");
    }
  }));

  router.post("/api/v1/analytics/institutional/scenarios/:id/run", asyncHandler(async (req, res) => {
    try {
      const result = await repository.runAllocationSimulation(String(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === "SCENARIO_NOT_FOUND") {
        return sendError(res, 404, "SCENARIO_NOT_FOUND", "Escenario de simulacion no encontrado.");
      }
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SIMULATION_FAILED", "No fue posible ejecutar la simulacion.");
    }
  }));

  // ═══════════════════════════════════════
  // SUPERVISIÓN OPERATIVA
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/supervision", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const format = String(req.query.format ?? "json").toLowerCase();
    try {
      const data = await repository.getSupervisionData(tenantId);

      if (format === "csv") {
        return sendCsv(res, data as unknown as Record<string, unknown>[], "supervision_operativa.csv");
      }

      if (format === "pdf") {
        return sendPdf(res, data as unknown as Record<string, unknown>[], "supervision_operativa.pdf", "Supervisión Operativa");
      }

      return sendSuccess(res, data);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SUPERVISION_FAILED", "No fue posible obtener datos de supervision.");
    }
  }));

  // ═══════════════════════════════════════
  // DYNAMIC ALERT THRESHOLDS
  // ═══════════════════════════════════════

  router.get("/api/v1/analytics/institutional/thresholds/:tenantId", asyncHandler(async (req, res) => {
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
    ruleKey: z.string().min(3).max(80).regex(/^institutional\.\w+$/, "rule_key debe iniciar con 'institutional.'"),
    value: z.coerce.number().min(0),
    updatedBy: z.string().optional(),
  });

  router.put("/api/v1/analytics/institutional/thresholds/:tenantId", asyncHandler(async (req, res) => {
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
  // SPOILAGE / MERMA TRACKING
  // ══════════════════════════════════════

  const spoilageReasons = ["expired", "temperature", "damaged", "contaminated", "overproduction", "other"] as const;
  const spoilageStages = ["harvest", "storage", "transport", "distribution", "last_mile"] as const;

  const createSpoilageSchema = z.object({
    tenantId: z.string().min(1),
    programId: z.string().uuid().optional(),
    logisticsOrderId: z.string().uuid().optional(),
    productName: z.string().min(2),
    category: z.string().optional(),
    quantityKg: z.coerce.number().min(0),
    spoilageKg: z.coerce.number().min(0),
    spoilageReason: z.enum(spoilageReasons).optional(),
    stage: z.enum(spoilageStages).optional(),
    temperatureC: z.coerce.number().optional(),
    detectedBy: z.string().optional(),
    locationName: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    notes: z.string().max(1000).optional(),
  });

  router.post("/api/v1/analytics/institutional/spoilage", asyncHandler(async (req, res) => {
    const parsed = createSpoilageSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_SPOILAGE", "Payload inválido para registro de merma.");
    }
    try {
      const record = await repository.createSpoilageRecord(parsed.data);
      return sendSuccess(res, record, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SPOILAGE_FAILED", "No fue posible registrar la merma.");
    }
  }));

  router.get("/api/v1/analytics/institutional/spoilage/:tenantId", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    try {
      const result = await repository.listSpoilageRecords(String(req.params.tenantId), { page, limit });
      return sendPaginatedSuccess(res, result.data, {
        total: result.total, page: result.page, limit: result.limit,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SPOILAGE_LIST_FAILED", "No fue posible listar los registros de merma.");
    }
  }));

  router.get("/api/v1/analytics/institutional/spoilage/:tenantId/summary", asyncHandler(async (req, res) => {
    const format = String(req.query.format ?? "json").toLowerCase();
    try {
      const summary = await repository.getSpoilageSummary(String(req.params.tenantId));
      if (format === "csv") {
        const csv = toCsv(summary as unknown as Record<string, unknown>[]);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="spoilage_summary.csv"');
        return res.send(csv);
      }
      if (format === "pdf") {
        return sendPdf(res, summary as unknown as Record<string, unknown>[], "spoilage_summary.pdf", "Resumen de Merma Alimentaria");
      }
      return sendSuccess(res, summary);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "SPOILAGE_SUMMARY_FAILED", "No fue posible generar el resumen de merma.");
    }
  }));

  return router;
}
