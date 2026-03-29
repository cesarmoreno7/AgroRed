import { randomUUID } from "node:crypto";
import { AutomationRun } from "../../domain/entities/AutomationRun.js";
import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import type { AutomationTriggerSource } from "../../domain/value-objects/AutomationTriggerSource.js";

export interface ExecuteAutomationRunCommand {
  tenantId: string;
  triggerSource: AutomationTriggerSource;
  incidentId?: string | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
}

export class ExecuteAutomationRun {
  constructor(private readonly repository: AutomationRepository) {}

  async execute(command: ExecuteAutomationRunCommand): Promise<AutomationRun> {
    if (command.triggerSource === "incident_response" && !command.incidentId) {
      throw new Error("INCIDENT_REQUIRED_FOR_TRIGGER");
    }

    if (command.triggerSource === "logistics_followup" && !command.logisticsOrderId) {
      throw new Error("LOGISTICS_ORDER_REQUIRED_FOR_TRIGGER");
    }

    const plan = await this.repository.planExecution({
      tenantKey: command.tenantId,
      incidentId: command.incidentId ?? null,
      logisticsOrderId: command.logisticsOrderId ?? null
    });

    const run = new AutomationRun({
      id: randomUUID(),
      tenantId: plan.tenantId,
      incidentId: plan.incidentId,
      logisticsOrderId: plan.logisticsOrderId,
      triggerSource: command.triggerSource,
      modelVersion: plan.modelVersion,
      classification: plan.classification,
      status: "generated",
      actions: plan.actions,
      metricsSnapshot: plan.metricsSnapshot,
      notes: command.notes ?? null
    });

    await this.repository.save(run);

    return run;
  }
}