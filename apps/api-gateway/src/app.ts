import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import type { Pool } from "pg";
import { Redis } from "ioredis";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { buildServiceRegistry } from "./infrastructure/http/serviceRegistry.js";
import { TokenBlacklist } from "./infrastructure/redis/TokenBlacklist.js";
import { correlationIdMiddleware } from "./interface/http/middlewares/correlationId.js";
import { createAuditTrailMiddleware } from "./interface/http/middlewares/auditTrail.js";
import { requestLoggerMiddleware } from "./interface/http/middlewares/requestLogger.js";
import { createAuditRouter } from "./interface/http/routes/audit.js";
import { createAiChatRouter } from "./interface/http/routes/aiChat.js";
import { createCatalogRouter } from "./interface/http/routes/catalog.js";
import { createHealthRouter } from "./interface/http/routes/health.js";
import { createLogoutRouter } from "./interface/http/routes/logout.js";
import { registerMonolithRouters } from "./interface/http/routes/monolithRouters.js";
import { sendError } from "./interface/http/response.js";
import { logError } from "./shared/logger.js";
import { traceabilityMiddleware } from "./shared/traceability.js";
import { createAuthMiddleware } from "./interface/http/middlewares/auth.js";
import { createRateLimiters } from "./interface/http/middlewares/rateLimiter.js";
import { rbacMiddleware } from "./interface/http/middlewares/rbac.js";
import type { GatewayHealthDependencies } from "./interface/http/routes/health.js";

function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function buildApp(
  env: AppEnv = loadEnv(),
  pool?: Pool,
  redis?: Redis,
  gatewayDependencies: GatewayHealthDependencies = {}
): Promise<Express> {
  const app = express();
  const services = buildServiceRegistry(env);
  const allowedOrigins = parseAllowedOrigins(env.API_GATEWAY_CORS_ORIGIN);

  // Redis-backed features (gracefully degrade to in-memory when Redis is unavailable)
  const blacklist = redis ? new TokenBlacklist(redis) : undefined;
  const { globalRateLimiter, authRateLimiter } = createRateLimiters(redis);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(globalRateLimiter);
  app.use("/api/v1/users/login", authRateLimiter);
  app.use("/api/v1/users/register", authRateLimiter);
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(traceabilityMiddleware);
  app.use(createAuthMiddleware(env.JWT_SECRET, blacklist));
  app.use(rbacMiddleware);
  app.use(createAuditTrailMiddleware(pool));

  app.use(createHealthRouter(services, gatewayDependencies));
  app.use(createCatalogRouter(services));
  app.use(createAiChatRouter(env, pool));
  if (blacklist) {
    app.use(createLogoutRouter(env.JWT_SECRET, blacklist));
  }
  if (pool) {
    app.use(createAuditRouter(pool));
  }
  if (pool) {
    await registerMonolithRouters(app, pool, redis, env);
  }

  app.use((_req, res) =>
    sendError(res, 404, "RESOURCE_NOT_FOUND", "Ruta no configurada en API Gateway.")
  );

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    logError("gateway.unhandled_error", {
      correlationId: req.correlationId,
      path: req.originalUrl,
      message: error instanceof Error ? error.message : "Unknown error"
    });

    sendError(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Error interno del API Gateway.",
      req.correlationId
    );
  });

  return app;
}


