import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresLogisticsOrderRepository } from "./infrastructure/repositories/PostgresLogisticsOrderRepository.js";
import { PostgresTrackingRepository } from "./infrastructure/repositories/PostgresTrackingRepository.js";
import { PostgresRoutePlanRepository } from "./infrastructure/repositories/PostgresRoutePlanRepository.js";
import { OsrmRoutingService } from "./infrastructure/services/OsrmRoutingService.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createLogisticsRouter } from "./interface/http/routes/logistics.js";
import { createTrackingRouter } from "./interface/http/routes/tracking.js";
import { createRoutePlanningRouter } from "./interface/http/routes/routePlanning.js";
import { logError, logInfo } from "./shared/logger.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const repository = new PostgresLogisticsOrderRepository(pool);
  const trackingRepository = new PostgresTrackingRepository(pool);
  const routePlanRepository = new PostgresRoutePlanRepository(pool);
  const osrmRouting = new OsrmRoutingService(env.OSRM_URL);
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
  app.use(createLogisticsRouter(repository));
  app.use(createTrackingRouter(trackingRepository));
  app.use(createRoutePlanningRouter(routePlanRepository, osrmRouting));
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