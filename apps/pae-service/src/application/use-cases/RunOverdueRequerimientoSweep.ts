import type { PaeRepository } from "../../domain/ports/PaeRepository.js";
import type { EscalationSink } from "./EscalateFinding.js";
import { DEFAULT_PAE_THRESHOLDS } from "../../domain/checklist/paeChecklistTemplate.js";

export type OverdueSweepRepo = Pick<
  PaeRepository,
  "listOverdueRequerimientos" | "getThresholds" | "bumpRequerimientoEscalation"
>;

export interface RunOverdueRequerimientoSweepDeps {
  repository: OverdueSweepRepo;
  escalation: EscalationSink;
}

/**
 * Requerimientos vencidos sin respuesta → sube escalation_level, re-notifica
 * (nueva institutional_alert → correos a admin_municipal + nueva coordination_task),
 * y re-agenda due_date. Nivel >= 2 pasa a 'incumplido' (la Gobernación puede exigir sanción).
 * Se ejecuta desde el flow BullMQ `pae-requerimiento-overdue-sweep`.
 */
export class RunOverdueRequerimientoSweep {
  constructor(private readonly deps: RunOverdueRequerimientoSweepDeps) {}

  async execute(now: Date = new Date()): Promise<{ scanned: number; escalated: number }> {
    const overdue = await this.deps.repository.listOverdueRequerimientos();
    let escalated = 0;

    for (const r of overdue) {
      try {
        const level = r.escalationLevel + 1;
        const status = level >= 2 ? "incumplido" : "notificado";
        const severity = level >= 2 ? "critical" : "high";

        const thresholds = await this.deps.repository.getThresholds(r.tenantId);
        const slaHours = Number(
          thresholds.requerimiento_sla_hours ?? r.slaHours ?? DEFAULT_PAE_THRESHOLDS.requerimiento_sla_hours
        );
        const dueDate = new Date(now.getTime() + slaHours * 3_600_000).toISOString();

        const title = `Requerimiento PAE vencido (nivel ${level}) — ${r.title}`;
        const description =
          `El requerimiento ${r.id} venció sin respuesta de la alcaldía. Escalamiento nivel ${level}. ` +
          `Nuevo plazo: ${slaHours} h (vence ${dueDate}). ` +
          (level >= 2
            ? "La Gobernación puede exigir formalmente la aplicación de multas o caducidad al operador."
            : "");

        const alertId = await this.deps.escalation.createInstitutionalAlert({
          tenantId: r.tenantId,
          alertType: "pae_requerimiento_vencido",
          severity,
          title,
          description,
          indicatorName: "pae_requerimiento_escalation_level",
          indicatorValue: level,
          thresholdValue: 1
        });

        await this.deps.escalation.createCoordinationTask({
          tenantId: r.tenantId,
          actorName: "Alcaldía",
          taskDescription: `Requerimiento PAE ${r.id} VENCIDO (nivel ${level}). Responder antes de ${dueDate}.`,
          priority: severity,
          dueDate: dueDate.slice(0, 10),
          notes: alertId ?? undefined
        });

        await this.deps.repository.bumpRequerimientoEscalation(r.id, {
          escalationLevel: level,
          status,
          dueDate
        });
        escalated += 1;
      } catch {
        // best-effort por requerimiento
      }
    }

    return { scanned: overdue.length, escalated };
  }
}
