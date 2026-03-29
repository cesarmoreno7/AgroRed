import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env.js";
import { createPostgresPool, checkPostgres } from "./infrastructure/persistence/postgres.js";
import { PostgresAuctionRepository } from "./infrastructure/repositories/PostgresAuctionRepository.js";
import { PostgresBidRepository } from "./infrastructure/repositories/PostgresBidRepository.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createAuctionsRouter } from "./interface/http/routes/auctions.js";
import { notFoundHandler, globalErrorHandler } from "./interface/http/response.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { startAuctionScheduler } from "./application/scheduler/AuctionScheduler.js";
import { logError, logInfo } from "./shared/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env);
  const auctionRepo = new PostgresAuctionRepository(pool);
  const bidRepo = new PostgresBidRepository(pool);

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

  app.use(createAuctionsRouter(auctionRepo, bidRepo));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  await checkPostgres(pool);

  const schedulerInterval = startAuctionScheduler(auctionRepo, bidRepo);

  const server = app.listen(env.PORT, () => {
    logInfo("service.started", { port: env.PORT, databaseHost: env.POSTGRES_HOST });
  });

  const shutdown = async (signal: string) => {
    logInfo("service.stopping", { signal });
    clearInterval(schedulerInterval);

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
