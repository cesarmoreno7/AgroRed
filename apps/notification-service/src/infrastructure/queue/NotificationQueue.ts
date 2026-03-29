import { Queue, Worker, type Job } from "bullmq";
import type Redis from "ioredis";
import type { NotificationRepository } from "../../domain/ports/NotificationRepository.js";
import type { NotificationSender } from "../../domain/ports/NotificationSender.js";
import { DispatchNotification } from "../../application/use-cases/DispatchNotification.js";
import { logError, logInfo } from "../../shared/logger.js";

const QUEUE_NAME = "notification-dispatch";

export interface NotificationQueueDeps {
  redis: Redis;
  repository: NotificationRepository;
  sender: NotificationSender;
}

/**
 * BullMQ queue for asynchronous notification dispatch.
 * Enqueue notification IDs; the worker picks them up and sends them.
 */
export function createNotificationQueue(redis: Redis): Queue {
  return new Queue(QUEUE_NAME, { connection: redis });
}

/**
 * Spawns a BullMQ worker that processes notification dispatch jobs.
 */
export function createNotificationWorker(deps: NotificationQueueDeps): Worker {
  const dispatch = new DispatchNotification(deps.repository, deps.sender);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<{ notificationId: string }>) => {
      const { notificationId } = job.data;
      logInfo("queue.notification.processing", { notificationId, jobId: job.id });

      const result = await dispatch.execute(notificationId);

      if (result.status === "failed") {
        throw new Error(result.errorMessage ?? "Dispatch failed");
      }

      return result;
    },
    {
      connection: deps.redis,
      concurrency: 5,
      limiter: { max: 30, duration: 60_000 } // max 30 emails per minute
    }
  );

  worker.on("completed", (job) => {
    logInfo("queue.notification.completed", { jobId: job.id, notificationId: job.data.notificationId });
  });

  worker.on("failed", (job, err) => {
    logError("queue.notification.failed", {
      jobId: job?.id ?? "unknown",
      notificationId: job?.data?.notificationId ?? "unknown",
      error: err.message
    });
  });

  return worker;
}
