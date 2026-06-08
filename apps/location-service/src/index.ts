import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresDepartamentoRepository } from "./infrastructure/repositories/PostgresLocationRepositories.js";
import { PostgresMunicipioRepository } from "./infrastructure/repositories/PostgresLocationRepositories.js";
import { PostgresCorregimientoRepository } from "./infrastructure/repositories/PostgresLocationRepositories.js";
import { PostgresVeredaRepository } from "./infrastructure/repositories/PostgresLocationRepositories.js";
import { createLocationsRouter } from "./interface/http/routes/locations.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { logError, logInfo } from "./shared/logger.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { internalAuthMiddleware } from "../../shared/middleware/internalAuth.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);

  const departamentoRepo = new PostgresDepartamentoRepository(pool);
  const municipioRepo = new PostgresMunicipioRepository(pool);
  const corregimientoRepo = new PostgresCorregimientoRepository(pool);
  const veredaRepo = new PostgresVeredaRepository(pool);

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.API_GATEWAY_ORIGIN || "http://localhost:8080" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(traceabilityMiddleware);
  app.use(internalAuthMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "location-service" });
  });

  app.use(createLocationsRouter(departamentoRepo, municipioRepo, corregimientoRepo, veredaRepo));

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT });
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
