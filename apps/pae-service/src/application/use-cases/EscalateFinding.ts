import type { PaeRepository } from "../../domain/ports/PaeRepository.js";
import type { PaeInspection } from "../../domain/entities/PaeInspection.js";
import type { PaeRequerimiento, RequerimientoSourceType } from "../../domain/entities/PaeRequerimiento.js";
import { CATEGORY_SEVERITY, type FindingSeverity } from "../../domain/value-objects/InspectionResult.js";
import { DEFAULT_PAE_THRESHOLDS } from "../../domain/checklist/paeChecklistTemplate.js";

const SEVERITY_RANK: Record<FindingSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** Categoría de reporte CAE → severidad del requerimiento. */
const CAE_CATEGORY_SEVERITY: Record<string, FindingSeverity> = {
  cadena_frio: "critical",
  vencimiento: "critical",
  gramaje: "high",
  higiene: "high",
  inasistencia_entrega: "high",
  otro: "medium"
};

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
  | "findRequerimientoByCaeReportId"
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
 * "Pega" del escalamiento: un hallazgo no conforme (inspección) o un reporte CAE
 * verificado → requerimiento a la alcaldía + institutional_alert (→ correos a
 * admin_municipal) + coordination_task. Idempotente por inspection_id / cae_report_id.
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

    const failed = (inspection.failedItems as { key: string; category: string; reason: string }[]) ?? [];
    const severity = severityFromFailedItems(failed);
    const operator = inspection.operatorId
      ? await this.deps.repository.findOperatorById(inspection.operatorId)
      : null;
    const actorName = operator?.legalName ?? "Operador PAE";
    const reasons = failed.map((f) => `• ${f.reason}`).join("\n") || "Incumplimiento detectado en inspección de campo.";

    return this.createChain({
      tenantId: inspection.tenantId,
      sourceType: ctx.sourceType ?? "inspection",
      inspectionId: inspection.id,
      caeReportId: ctx.caeReportId ?? null,
      operatorId: inspection.operatorId,
      severity,
      actorName,
      title: `Requerimiento PAE: hallazgos no conformes (${actorName})`,
      bodyDetail:
        `Se detectaron hallazgos no conformes en la inspección ${inspection.id} (${inspection.inspectionKind}).\n\n${reasons}`,
      indicatorValue: failed.length,
      createdByTenantId: ctx.createdByTenantId ?? null,
      createdByRole: ctx.createdByRole ?? null
    });
  }

  async fromCaeReport(
    report: { id: string; tenantId: string; category: string; description: string; reporterRole?: string | null }
  ): Promise<PaeRequerimiento | null> {
    const existing = await this.deps.repository.findRequerimientoByCaeReportId(report.id);
    if (existing) {
      return existing;
    }
    const severity = CAE_CATEGORY_SEVERITY[report.category] ?? "medium";

    return this.createChain({
      tenantId: report.tenantId,
      sourceType: "cae_report",
      inspectionId: null,
      caeReportId: report.id,
      operatorId: null,
      severity,
      actorName: "Operador PAE",
      title: `Requerimiento PAE: reporte del Comité de Alimentación Escolar (${report.category})`,
      bodyDetail:
        `El Comité de Alimentación Escolar reportó (${report.category}) por parte de ` +
        `${report.reporterRole ?? "un veedor"}: "${report.description}".`,
      indicatorValue: 1,
      createdByTenantId: null,
      createdByRole: "comite_cae"
    });
  }

  private async createChain(p: {
    tenantId: string;
    sourceType: RequerimientoSourceType;
    inspectionId: string | null;
    caeReportId: string | null;
    operatorId: string | null;
    severity: FindingSeverity;
    actorName: string;
    title: string;
    bodyDetail: string;
    indicatorValue: number;
    createdByTenantId: string | null;
    createdByRole: string | null;
  }): Promise<PaeRequerimiento> {
    const thresholds = await this.deps.repository.getThresholds(p.tenantId);
    const slaHours = Number(
      thresholds.requerimiento_sla_hours ?? DEFAULT_PAE_THRESHOLDS.requerimiento_sla_hours
    );
    const dueDate = new Date(Date.now() + slaHours * 3_600_000).toISOString();

    const description =
      `${p.bodyDetail}\n\nLa alcaldía debe requerir al operador y, de ser necesario, aplicar multas o ` +
      `caducidad conforme a la Ley 2046 y el manual del PAE.\nPlazo de respuesta: ${slaHours} h (vence ${dueDate}).`;

    const requerimiento = await this.deps.repository.createRequerimiento(
      {
        tenantId: p.tenantId,
        sourceType: p.sourceType,
        inspectionId: p.inspectionId,
        caeReportId: p.caeReportId,
        operatorId: p.operatorId,
        title: p.title,
        description,
        legalBasis: "Ley 2046 de 2020 — compra local a pequeños productores",
        severity: p.severity,
        slaHours,
        createdByTenantId: p.createdByTenantId,
        createdByRole: p.createdByRole
      },
      dueDate
    );

    const alertId = await this.deps.escalation.createInstitutionalAlert({
      tenantId: p.tenantId,
      alertType: p.sourceType === "cae_report" ? "pae_reporte_cae" : "pae_no_conforme",
      severity: p.severity,
      title: p.title,
      description,
      indicatorName: "pae_finding",
      indicatorValue: p.indicatorValue,
      thresholdValue: 0
    });

    const taskId = await this.deps.escalation.createCoordinationTask({
      tenantId: p.tenantId,
      actorName: p.actorName,
      taskDescription:
        `Atender requerimiento PAE ${requerimiento.id}: verificar el hallazgo, requerir al operador ` +
        `y reportar la acción tomada antes de ${dueDate}.`,
      priority: p.severity,
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
