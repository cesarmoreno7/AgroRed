import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import { ExecuteAutomationRun } from "../../application/use-cases/ExecuteAutomationRun.js";
import type { ActionExecutionEngine } from "../../application/services/ActionExecutionEngine.js";
import type { AutomationTriggerSource } from "../../domain/value-objects/AutomationTriggerSource.js";
import { logError, logInfo } from "../../shared/logger.js";

const QUEUE_NAME = "automation-run";

/** Sentinel tenantId used by scheduled sweeps that must run once per active tenant, not once globally. */
const SYSTEM_WIDE_TENANT_KEY = "system";

/** BullMQ job name registered by ScheduledFlows.ts for the hourly IRAT threshold sweep. */
const IRAT_ALERT_CHECK_JOB_NAME = "irat-alert-check";

/** PAE oversight scheduled jobs (ScheduledFlows.ts). */
const PAE_OVERDUE_SWEEP_JOB_NAME = "pae-requerimiento-overdue-sweep";
const PAE_RANDOM_AUDIT_JOB_NAME = "pae-random-audit-sampling";

export interface AutomationJobData {
  tenantId: string;
  triggerSource: AutomationTriggerSource;
  incidentId?: string | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
}

/** Minimal contract for the real IRAT check — implemented by analytics-service's PostgresInstitutionalRepository. */
export interface IratAlertChecker {
  generateAlerts(tenantId: string): Promise<unknown[]>;
  /** Ley 2046/2020: alerta cuando la compra a pequeños productores cae por debajo del 30% legal. */
  generateLey2046Alerts(tenantId: string): Promise<unknown[]>;
}

/** Minimal contract for the PAE oversight scheduled sweeps — implemented in pae-service. */
export interface PaeSweeper {
  /** Requerimientos vencidos → sube nivel de escalamiento + re-notifica. */
  runOverdueRequerimientoSweep(): Promise<unknown>;
  /** Muestreo aleatorio de auditorías de la Gobernación → stubs de pae_inspections. */
  sampleRandomAudits(): Promise<unknown>;
}

export interface AutomationQueueDeps {
  redis: Redis;
  repository: AutomationRepository;
  actionEngine?: ActionExecutionEngine;
  /** When provided, the "irat-alert-check" scheduled job runs a real IRAT threshold check
   *  instead of the generic offer/demand heuristic — see ScheduledFlows.ts for the schedule. */
  iratAlertChecker?: IratAlertChecker;
  /** When provided, the PAE oversight scheduled jobs run their real sweeps. */
  paeSweeper?: PaeSweeper;
}

/**
 * BullMQ queue for asynchronous automation runs.
 */
export function createAutomationQueue(redis: Redis): Queue {
  return new Queue(QUEUE_NAME, { connection: redis });
}

/**
 * Spawns a BullMQ worker that processes automation execution jobs.
 */
export function createAutomationWorker(deps: AutomationQueueDeps): Worker {
  const executeRun = new ExecuteAutomationRun(deps.repository, deps.actionEngine);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<AutomationJobData>) => {
      logInfo("queue.automation.processing", { jobId: job.id, trigger: job.data.triggerSource });

      // Scheduled sweeps (ScheduledFlows.ts) are enqueued once with a "system" sentinel
      // because they apply to every municipio, not a single tenant — "system" itself is
      // never a real tenant, so resolving it directly would fail every scheduled run.
      if (job.data.tenantId === SYSTEM_WIDE_TENANT_KEY) {
        const tenantIds = await deps.repository.listActiveTenantIds();
        const results = [];

        // The IRAT sweep checks real thresholds (institutional_alerts + email notifications)
        // instead of running the generic offer/demand heuristic under a misleading name.
        // The same hourly sweep also checks Ley 2046 (compra local) compliance per institution.
        if (job.name === IRAT_ALERT_CHECK_JOB_NAME && deps.iratAlertChecker) {
          for (const tenantId of tenantIds) {
            try {
              const iratAlerts = await deps.iratAlertChecker.generateAlerts(tenantId);
              const ley2046Alerts = await deps.iratAlertChecker.generateLey2046Alerts(tenantId);
              results.push({ tenantId, alertsFired: iratAlerts.length + ley2046Alerts.length });
            } catch (error) {
              logError("queue.automation.irat_check_failed", {
                jobId: job.id,
                tenantId,
                message: error instanceof Error ? error.message : String(error)
              });
            }
          }

          return { fanOut: true, iratCheck: true, tenantCount: tenantIds.length, results };
        }

        // PAE oversight sweeps query their own tables (pae_requerimientos / tenant_oversight),
        // so they don't fan out per tenant — run once and return.
        if (job.name === PAE_OVERDUE_SWEEP_JOB_NAME && deps.paeSweeper) {
          const out = await deps.paeSweeper.runOverdueRequerimientoSweep();
          return { paeOverdueSweep: true, result: out };
        }
        if (job.name === PAE_RANDOM_AUDIT_JOB_NAME && deps.paeSweeper) {
          const out = await deps.paeSweeper.sampleRandomAudits();
          return { paeRandomAudit: true, result: out };
        }

        for (const tenantId of tenantIds) {
          try {
            const run = await executeRun.execute({ ...job.data, tenantId });
            results.push({ tenantId, runId: run.id, status: run.status });
          } catch (error) {
            logError("queue.automation.tenant_run_failed", {
              jobId: job.id,
              tenantId,
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }

        return { fanOut: true, tenantCount: tenantIds.length, results };
      }

      const run = await executeRun.execute(job.data);

      return { runId: run.id, status: run.status, classification: run.classification };
    },
    {
      connection: deps.redis,
      concurrency: 3
    }
  );

  worker.on("completed", (job) => {
    logInfo("queue.automation.completed", { jobId: job.id, trigger: job.data.triggerSource });
  });

  worker.on("failed", (job, err) => {
    logError("queue.automation.failed", {
      jobId: job?.id ?? "unknown",
      trigger: job?.data?.triggerSource ?? "unknown",
      error: err.message
    });
  });

  return worker;
}
