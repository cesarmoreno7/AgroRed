import type { Queue } from "bullmq";
import type { AutomationJobData } from "./AutomationQueue.js";
import { logError, logInfo } from "../../shared/logger.js";

/**
 * Registers repeatable BullMQ jobs on the automation queue:
 *
 *  • irat-alert-check   — every 60 min  → triggers daily_sweep automation
 *  • incident-followup  — every 6 h     → follows up open incidents
 *  • auto-close-sweep   — every 24 h    → closes stale resolved incidents
 */
export async function scheduleAutomationFlows(queue: Queue): Promise<void> {
  const flows: Array<{
    name: string;
    data: AutomationJobData;
    every: number; // ms
  }> = [
    {
      name: "irat-alert-check",
      data: {
        tenantId:      "system",
        triggerSource: "daily_sweep",
        notes:         "Scheduled IRAT threshold check",
      },
      every: 60 * 60 * 1000, // 1 hour
    },
    {
      name: "incident-followup",
      data: {
        tenantId:      "system",
        triggerSource: "logistics_followup",
        notes:         "Scheduled incident follow-up sweep",
      },
      every: 6 * 60 * 60 * 1000, // 6 hours
    },
    {
      name: "auto-close-sweep",
      data: {
        tenantId:      "system",
        triggerSource: "daily_sweep",
        notes:         "Auto-close resolved/stale incidents",
      },
      every: 24 * 60 * 60 * 1000, // 24 hours
    },
  ];

  for (const flow of flows) {
    try {
      await queue.add(flow.name, flow.data, {
        repeat: { every: flow.every },
        removeOnComplete: { count: 20 },
        removeOnFail:     { count: 10 },
      });
      logInfo("automation.flow.scheduled", { name: flow.name, everyMs: flow.every });
    } catch (error) {
      logError("automation.flow.schedule_failed", {
        name:    flow.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
