import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresOfferRepository } from "./infrastructure/repositories/PostgresOfferRepository.js";
import { PostgresDemandQueryAdapter } from "./infrastructure/adapters/PostgresDemandQueryAdapter.js";
import { HttpNotificationAdapter } from "./infrastructure/adapters/HttpNotificationAdapter.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createOffersRouter } from "./interface/http/routes/offers.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresOfferRepository(pool);
  const demandQuery = new PostgresDemandQueryAdapter(pool);
  const notificationAdapter = new HttpNotificationAdapter(env.NOTIFICATION_SERVICE_URL);
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
  app.use(createOffersRouter(repository, demandQuery, notificationAdapter));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT, databaseHost: env.POSTGRES_HOST });
  });

  const shutdown = async (signal: string) => {
    logInfo("service.stopping", { signal });

    server.close(async () => {
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
