import { randomUUID } from "node:crypto";
import { AutomationRun } from "../../domain/entities/AutomationRun.js";
import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import type { AutomationTriggerSource } from "../../domain/value-objects/AutomationTriggerSource.js";
import type { ActionExecutionEngine } from "../services/ActionExecutionEngine.js";
import { logError } from "../../shared/logger.js";

export interface ExecuteAutomationRunCommand {
  tenantId: string;
  triggerSource: AutomationTriggerSource;
  incidentId?: string | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
}

export class ExecuteAutomationRun {
  constructor(
    private readonly repository: AutomationRepository,
    private readonly actionEngine?: ActionExecutionEngine
  ) {}

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

    if (this.actionEngine) {
      try {
        await this.actionEngine.execute(run.actions, { tenantId: run.tenantId, runId: run.id });
      } catch (error) {
        // Action execution is best-effort follow-through — a failure here must not
        // fail the run itself, since the plan was already generated and persisted.
        logError("automation_run.action_execution_failed", {
          runId: run.id,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return run;
  }
}