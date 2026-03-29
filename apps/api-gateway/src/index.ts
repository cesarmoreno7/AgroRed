import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPostgresPool } from "./infrastructure/persistence/postgres.js";
import { getRedisClient, closeRedis } from "../../../apps/shared/redis/RedisClient.js";
import { logError, logInfo } from "./shared/logger.js";

const env = loadEnv();
const pool = createPostgresPool(env);
const redis = getRedisClient({ url: env.REDIS_URL });
const app = buildApp(env, pool, redis);

process.on("uncaughtException", (error) => {
  logError("process.uncaught_exception", {
    message: error.message,
    stack: error.stack ?? null
  });

  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logError("process.unhandled_rejection", {
    reason: reason instanceof Error ? reason.message : String(reason)
  });

  process.exit(1);
});

const server = app.listen(env.API_GATEWAY_PORT, () => {
  logInfo("gateway.started", {
    port: env.API_GATEWAY_PORT,
    nodeEnv: env.NODE_ENV
  });
});

const shutdown = async (signal: string) => {
  logInfo("gateway.stopping", { signal });

  server.close(async () => {
    await closeRedis();
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

