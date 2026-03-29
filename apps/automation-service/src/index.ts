import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresAutomationRepository } from "./infrastructure/repositories/PostgresAutomationRepository.js";
import { createAutomationQueue, createAutomationWorker } from "./infrastructure/queue/AutomationQueue.js";
import { getRedisClient, closeRedis } from "../../shared/redis/RedisClient.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createAutomationRouter } from "./interface/http/routes/automation.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresAutomationRepository(pool);

  // Redis + BullMQ worker
  const redis = getRedisClient({ url: env.REDIS_URL });
  const queue = createAutomationQueue(redis);
  const worker = createAutomationWorker({ redis, repository });
  logInfo("queue.automation.worker_started", {});

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
  app.use(createAutomationRouter(repository));
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