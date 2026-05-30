import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresUserRepository } from "./infrastructure/repositories/PostgresUserRepository.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createUsersRouter } from "./interface/http/routes/users.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { internalAuthMiddleware } from "../../shared/middleware/internalAuth.js";
import type { Redis } from "ioredis";
import { getRedisClient, closeRedis, checkRedis } from "../../shared/redis/RedisClient.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresUserRepository(pool);
  let redis: Redis | undefined;

  try {
    const redisClient = getRedisClient({ url: env.REDIS_URL });
    await checkRedis(redisClient);
    redis = redisClient;
    logInfo("redis.password_recovery.enabled", {});
  } catch (error) {
    await closeRedis().catch(() => undefined);
    logError("redis.password_recovery.disabled", {
      message: error instanceof Error ? error.message : String(error)
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
  app.use(createUsersRouter({
    repository,
    redis,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    emailUser: env.EMAIL_USER,
    emailPass: env.EMAIL_PASS,
    frontendUrl: env.FRONTEND_URL
  }));
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
