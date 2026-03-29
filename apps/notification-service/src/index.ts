import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresNotificationRepository } from "./infrastructure/repositories/PostgresNotificationRepository.js";
import { SmtpEmailSender } from "./infrastructure/email/SmtpEmailSender.js";
import { createNotificationQueue, createNotificationWorker } from "./infrastructure/queue/NotificationQueue.js";
import { getRedisClient, closeRedis } from "../../shared/redis/RedisClient.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createNotificationsRouter } from "./interface/http/routes/notifications.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresNotificationRepository(pool);
  const emailSender = new SmtpEmailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM
  });

  // Redis + BullMQ worker
  const redis = getRedisClient({ url: env.REDIS_URL });
  const queue = createNotificationQueue(redis);
  const worker = createNotificationWorker({ redis, repository, sender: emailSender });
  logInfo("queue.notification.worker_started", {});

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.API_GATEWAY_ORIGIN || "http://localhost:8080" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(traceabilityMiddleware);
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
      await worker.close();
      await queue.close();
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