import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresAnalyticsRepository } from "./infrastructure/repositories/PostgresAnalyticsRepository.js";
import { PostgresMapRepository } from "./infrastructure/repositories/PostgresMapRepository.js";
import { PostgresInstitutionalRepository } from "./infrastructure/repositories/PostgresInstitutionalRepository.js";
import { getRedisClient, closeRedis } from "../../shared/redis/RedisClient.js";
import { RedisCache } from "../../shared/redis/RedisCache.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createAnalyticsRouter } from "./interface/http/routes/analytics.js";
import { createMapRouter } from "./interface/http/routes/map.js";
import { createInstitutionalRouter } from "./interface/http/routes/institutional.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresAnalyticsRepository(pool);
  const mapRepository = new PostgresMapRepository(pool);
  const institutionalRepository = new PostgresInstitutionalRepository(pool);

  // Redis cache
  const redis = getRedisClient({ url: env.REDIS_URL });
  const cache = new RedisCache(redis, "analytics");

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
  app.use(createAnalyticsRouter(repository, cache));
  app.use(createMapRouter(mapRepository));
  app.use(createInstitutionalRouter(institutionalRepository));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT, databaseHost: env.POSTGRES_HOST });
  });

  const shutdown = async (signal: string) => {
    logInfo("service.stopping", { signal });

    server.close(async () => {
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