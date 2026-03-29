import { Queue, Worker, type Job } from "bullmq";
import type Redis from "ioredis";
import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import { ExecuteAutomationRun } from "../../application/use-cases/ExecuteAutomationRun.js";
import { logError, logInfo } from "../../shared/logger.js";

const QUEUE_NAME = "automation-run";

export interface AutomationJobData {
  tenantId: string;
  triggerSource: string;
  incidentId?: string | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
}

export interface AutomationQueueDeps {
  redis: Redis;
  repository: AutomationRepository;
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
  const executeRun = new ExecuteAutomationRun(deps.repository);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<AutomationJobData>) => {
      logInfo("queue.automation.processing", { jobId: job.id, trigger: job.data.triggerSource });

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
