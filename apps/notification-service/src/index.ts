import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresNotificationRepository } from "./infrastructure/repositories/PostgresNotificationRepository.js";
import { SmtpEmailSender } from "./infrastructure/email/SmtpEmailSender.js";
import { createNotificationQueue, createNotificationWorker } from "./infrastructure/queue/NotificationQueue.js";
import { createRedisConnection, closeRedis } from "../../shared/redis/RedisClient.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createNotificationsRouter } from "./interface/http/routes/notifications.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { internalAuthMiddleware } from "../../shared/middleware/internalAuth.js";

async function supportsBullMq(redisUrl: string): Promise<boolean> {
  const probe = createRedisConnection({ url: redisUrl, maxRetriesPerRequest: null });

  try {
    const info = await probe.info("server");
    const versionLine = info.split("\n").find((line) => line.startsWith("redis_version:"));
    const majorVersion = versionLine ? Number.parseInt(versionLine.split(":")[1]?.split(".")[0] ?? "0", 10) : 0;

    return majorVersion >= 5;
  } finally {
    await probe.quit();
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresNotificationRepository(pool);
  let queue = null;
  let worker = null;
  let queueRedis = null;
  let workerRedis = null;
  const emailSender = new SmtpEmailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM
  });

  // Redis + BullMQ worker
  if (await supportsBullMq(env.REDIS_URL)) {
    try {
      queueRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      workerRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      queue = createNotificationQueue(queueRedis);
      worker = createNotificationWorker({ redis: workerRedis, repository, sender: emailSender });
      await queue.waitUntilReady();
      await worker.waitUntilReady();
      logInfo("queue.notification.worker_started", {});
    } catch (error) {
      logError("queue.notification.disabled", {
        message: error instanceof Error ? error.message : String(error)
      });

      if (worker) {
        await worker.close();
        worker = null;
      }
      if (queue) {
        await queue.close();
        queue = null;
      }
      if (workerRedis) {
        await workerRedis.quit();
        workerRedis = null;
      }
      if (queueRedis) {
        await queueRedis.quit();
        queueRedis = null;
      }
    }
  } else {
    logError("queue.notification.disabled", {
      message: "Redis version is lower than 5. BullMQ worker disabled in local mode."
    });
  }

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.API_GATEWAY_ORIGIN || "http://localhost:8080" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(traceabilityMiddleware);
  app.use(internalAuthMiddleware);
  app.use(
    createHealthRouter({
      check: async () => {
        await checkPostgres(pool);
        return { database: "ok" };
      }
    })
  );
  app.use(createNotificationsRouter(repository, emailSender));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT, databaseHost: env.POSTGRES_HOST });
  });

  const shutdown = async (signal: string) => {
    logInfo("service.stopping", { signal });

    server.close(async () => {
      if (worker) {
        await worker.close();
      }
      if (queue) {
        await queue.close();
      }
      if (workerRedis) {
        await workerRedis.quit();
      }
      if (queueRedis) {
        await queueRedis.quit();
      }
      await closeRedis();
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  logError("service.bootstrap_failed", {
    message: error instanceof Error ? error.message : String(error)
  });

  process.exit(1);
});