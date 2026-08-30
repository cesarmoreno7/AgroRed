import type { PaeRepository } from "../../domain/ports/PaeRepository.js";
import type { PaeInspection } from "../../domain/entities/PaeInspection.js";
import type { PaeRequerimiento, RequerimientoSourceType } from "../../domain/entities/PaeRequerimiento.js";
import { CATEGORY_SEVERITY, type FindingSeverity } from "../../domain/value-objects/InspectionResult.js";
import { DEFAULT_PAE_THRESHOLDS } from "../../domain/checklist/paeChecklistTemplate.js";

const SEVERITY_RANK: Record<FindingSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export interface EscalationSink {
  createInstitutionalAlert(data: {
    tenantId: string;
    alertType: string;
    severity: FindingSeverity;
    title: string;
    description: string;
    indicatorName?: string;
    indicatorValue?: number;
    thresholdValue?: number;
    zoneName?: string;
  }): Promise<string | null>;
  createCoordinationTask(data: {
    tenantId: string;
    actorName: string;
    taskDescription: string;
    assignedTo?: string | null;
    priority?: FindingSeverity;
    dueDate?: string | null;
    notes?: string | null;
  }): Promise<string | null>;
  completeCoordinationTask?(taskId: string): Promise<void>;
}

export type EscalationRepo = Pick<
  PaeRepository,
  | "getThresholds"
  | "findRequerimientoByInspectionId"
  | "createRequerimiento"
  | "backfillRequerimientoLinks"
  | "findOperatorById"
>;

export interface EscalateFindingDeps {
  repository: EscalationRepo;
  escalation: EscalationSink;
}

export interface EscalateFindingContext {
  sourceType?: RequerimientoSourceType;
  caeReportId?: string | null;
  createdByTenantId?: string | null;
  createdByRole?: string | null;
}

function severityFromFailedItems(items: { category: string }[]): FindingSeverity {
  let worst: FindingSeverity = "medium";
  for (const it of items) {
    const sev = CATEGORY_SEVERITY[it.category] ?? "medium";
    if (SEVERITY_RANK[sev] > SEVERITY_RANK[worst]) {
      worst = sev;
    }
  }
  return worst;
}

/**
 * "Pega" del escalamiento: una inspección no_conforme → requerimiento a la
 * alcaldía + institutional_alert (→ correos a admin_municipal) + coordination_task.
 * Idempotente por inspection_id.
 */
export class EscalateFinding {
  constructor(private readonly deps: EscalateFindingDeps) {}

  async fromInspection(
    inspection: PaeInspection,
    ctx: EscalateFindingContext = {}
  ): Promise<PaeRequerimiento | null> {
    if (inspection.result !== "no_conforme") {
      return null;
    }

    const existing = await this.deps.repository.findRequerimientoByInspectionId(inspection.id);
    if (existing) {
      return existing;
    }

    const thresholds = await this.deps.repository.getThresholds(inspection.tenantId);
    const slaHours = Number(thresholds.requerimiento_sla_hours ?? DEFAULT_PAE_THRESHOLDS.requerimiento_sla_hours);
    const dueDate = new Date(Date.now() + slaHours * 3_600_000).toISOString();

    const failed = (inspection.failedItems as { key: string; category: string; reason: string }[]) ?? [];
    const severity = severityFromFailedItems(failed);

    const operator = inspection.operatorId
      ? await this.deps.repository.findOperatorById(inspection.operatorId)
      : null;
    const actorName = operator?.legalName ?? "Operador PAE";

    const reasons = failed.map((f) => `• ${f.reason}`).join("\n") || "Incumplimiento detectado en inspección de campo.";
    const title = `Requerimiento PAE: hallazgos no conformes (${actorName})`;
    const description =
      `Se detectaron hallazgos no conformes en la inspección ${inspection.id} ` +
      `(${inspection.inspectionKind}). La alcaldía debe requerir al operador y, de ser necesario, ` +
      `aplicar multas o caducidad conforme a la Ley 2046 y el manual del PAE.\n\n${reasons}\n\n` +
      `Plazo de respuesta: ${slaHours} horas (vence ${dueDate}).`;

    const requerimiento = await this.deps.repository.createRequerimiento(
      {
        tenantId: inspection.tenantId,
        sourceType: ctx.sourceType ?? "inspection",
        inspectionId: inspection.id,
        caeReportId: ctx.caeReportId ?? null,
        operatorId: inspection.operatorId,
        title,
        description,
        legalBasis: "Ley 2046 de 2020 — compra local a pequeños productores",
        severity,
        slaHours,
        createdByTenantId: ctx.createdByTenantId ?? null,
        createdByRole: ctx.createdByRole ?? null
      },
      dueDate
    );

    const alertId = await this.deps.escalation.createInstitutionalAlert({
      tenantId: inspection.tenantId,
      alertType: "pae_no_conforme",
      severity,
      title,
      description,
      indicatorName: "pae_inspection_result",
      indicatorValue: failed.length,
      thresholdValue: 0
    });

    const taskId = await this.deps.escalation.createCoordinationTask({
      tenantId: inspection.tenantId,
      actorName,
      taskDescription:
        `Atender requerimiento PAE ${requerimiento.id}: verificar el hallazgo, requerir al operador ` +
        `y reportar la acción tomada antes de ${dueDate}.`,
      priority: severity,
      dueDate: dueDate.slice(0, 10)
    });

    await this.deps.repository.backfillRequerimientoLinks(requerimiento.id, {
      institutionalAlertId: alertId,
      coordinationTaskId: taskId,
      firstNotifiedAt: new Date().toISOString()
    });

    return { ...requerimiento, institutionalAlertId: alertId, coordinationTaskId: taskId, status: "notificado" };
  }
}
