import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresAnalyticsRepository } from "./infrastructure/repositories/PostgresAnalyticsRepository.js";
import { PostgresMapRepository } from "./infrastructure/repositories/PostgresMapRepository.js";
import { PostgresInstitutionalRepository } from "./infrastructure/repositories/PostgresInstitutionalRepository.js";
import { getRedisClient, closeRedis, checkRedis } from "../../shared/redis/RedisClient.js";
import { RedisCache } from "../../shared/redis/RedisCache.js";
import { EventBus } from "../../shared/redis/EventBus.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createAnalyticsRouter } from "./interface/http/routes/analytics.js";
import { createMapRouter } from "./interface/http/routes/map.js";
import { createInstitutionalRouter } from "./interface/http/routes/institutional.js";
import { createOriginsRouter } from "./interface/http/routes/origins.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { internalAuthMiddleware } from "../../shared/middleware/internalAuth.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresAnalyticsRepository(pool);
  const mapRepository = new PostgresMapRepository(pool);
  const institutionalRepository = new PostgresInstitutionalRepository(pool);

  let cache: RedisCache | undefined;
  let eventBus: EventBus | null = null;

  try {
    const redis = getRedisClient({ url: env.REDIS_URL });
    await checkRedis(redis);
    cache = new RedisCache(redis, "analytics");
    logInfo("redis.cache.enabled", {});
  } catch (error) {
    await closeRedis().catch(() => undefined);
    logError("redis.cache.disabled", {
      message: error instanceof Error ? error.message : String(error)
    });
  }

  if (cache) {
    const invalidateAnalyticsCache = async (): Promise<void> => {
      await cache.invalidatePattern("summary:*");
      await cache.invalidatePattern("overview:*");
    };

    const candidateEventBus = new EventBus(env.REDIS_URL);

    try {
      await candidateEventBus.subscribe("offer.published", () => void invalidateAnalyticsCache());
      await candidateEventBus.subscribe("rescue.created", () => void invalidateAnalyticsCache());
      await candidateEventBus.subscribe("auction.closed", () => void invalidateAnalyticsCache());
      eventBus = candidateEventBus;
      logInfo("redis.event_bus.enabled", {});
    } catch (error) {
      await candidateEventBus.close();
      logError("redis.event_bus.disabled", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
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
  app.use(createAnalyticsRouter(repository, cache));
  app.use(createMapRouter(mapRepository));
  app.use(createInstitutionalRouter(institutionalRepository));
  app.use(createOriginsRouter(pool));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT, databaseHost: env.POSTGRES_HOST });
  });

  const shutdown = async (signal: string) => {
    logInfo("service.stopping", { signal });

    server.close(async () => {
      if (eventBus) {
        await eventBus.close();
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