import type { Pool } from "pg";
import type { AutomationAction } from "../../domain/entities/AutomationRun.js";
import { PostgresNotificationRepository } from "../../../../notification-service/src/infrastructure/repositories/PostgresNotificationRepository.js";
import { DispatchNotification, type NotificationSenderRegistry } from "../../../../notification-service/src/application/use-cases/DispatchNotification.js";
import { createAuditLogger } from "../../shared/audit.js";
import { logInfo, logError } from "../../shared/logger.js";

export interface ActionExecutionContext {
  tenantId: string;
  runId: string;
}

/**
 * Codes that have a real, safe, automatable effect. Everything else is
 * acknowledged and persisted to audit_log rather than silently no-op'd —
 * actions like "schedule_logistics" or "rebalance_inventory" touch business
 * state that genuinely needs a human decision (which inventory lot, which
 * destination), so we record that the system flagged them instead of
 * fabricating a business decision.
 */
const EXECUTABLE_ACTION_CODES = new Set(["dispatch_notifications"]);

export class ActionExecutionEngine {
  constructor(
    private readonly pool: Pool,
    private readonly notificationSenders: NotificationSenderRegistry
  ) {}

  async execute(actions: AutomationAction[], context: ActionExecutionContext): Promise<void> {
    for (const action of actions) {
      try {
        logInfo("action.execution_started", { action: action.actionCode, runId: context.runId });

        if (action.actionCode === "dispatch_notifications") {
          await this.dispatchPendingNotifications();
        } else {
          await this.recordAcknowledgement(action, context);
        }

        logInfo("action.execution_completed", { action: action.actionCode, runId: context.runId });
      } catch (error) {
        logError("action.execution_failed", {
          action: action.actionCode,
          runId: context.runId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /** Mirrors POST /api/v1/notifications/dispatch-pending — real dispatch, not a simulation. */
  private async dispatchPendingNotifications(): Promise<void> {
    const repository = new PostgresNotificationRepository(this.pool);
    const dispatchNotification = new DispatchNotification(repository, this.notificationSenders);
    const pending = await repository.findPending(50);

    for (const notification of pending) {
      if (!this.notificationSenders[notification.notificationChannel]) continue;
      await dispatchNotification.execute(notification.id);
    }
  }

  /** Persists a real, queryable audit trail entry for actions that require human follow-up. */
  private async recordAcknowledgement(action: AutomationAction, context: ActionExecutionContext): Promise<void> {
    const auditLog = createAuditLogger(this.pool);
    await auditLog({
      tenantId: context.tenantId,
      serviceName: "automation-service",
      entityName: "automation_action",
      entityId: context.runId,
      actionName: action.actionCode,
      payload: {
        title: action.title,
        rationale: action.rationale,
        priority: action.priority,
        requiresManualFollowUp: !EXECUTABLE_ACTION_CODES.has(action.actionCode)
      }
    });
  }
}
