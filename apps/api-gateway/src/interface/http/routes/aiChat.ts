import jwt from "jsonwebtoken";
import { Router } from "express";
import type { AppEnv } from "../../../config/env.js";
import { asyncHandler, sendError } from "../response.js";

const NODE_TO_LEGACY_ROLE: Record<string, string> = {
  admin_municipal: "ADMIN",
  territorial_analyst: "TERRITORIAL_MANAGER",
  ADMIN: "ADMIN",
  TERRITORIAL_MANAGER: "TERRITORIAL_MANAGER"
};

function buildLegacyToken(env: AppEnv, reqHeaders: Record<string, string | string[] | undefined>): string | null {
  const currentRole = typeof reqHeaders["x-user-role"] === "string" ? reqHeaders["x-user-role"] : "";
  const mappedRole = NODE_TO_LEGACY_ROLE[currentRole];

  if (!mappedRole) {
    return null;
  }

  return jwt.sign(
    {
      sub: typeof reqHeaders["x-user-id"] === "string" ? reqHeaders["x-user-id"] : "gateway-ai-user",
      tenantId: typeof reqHeaders["x-tenant-id"] === "string" ? reqHeaders["x-tenant-id"] : "",
      email: typeof reqHeaders["x-user-email"] === "string" ? reqHeaders["x-user-email"] : "",
      role: mappedRole
    },
    env.JWT_SECRET,
    { expiresIn: "5m" }
  );
}

export function createAiChatRouter(env: AppEnv): Router {
  const router = Router();

  router.post("/api/v1/ai-chat", asyncHandler(async (req, res) => {
    if (!env.AI_CHAT_SERVICE_URL) {
      return sendError(
        res,
        503,
        "AI_CHAT_NOT_CONFIGURED",
        "La integracion de AI chat no esta configurada en el API Gateway.",
        req.correlationId
      );
    }

    const legacyToken = buildLegacyToken(env, req.headers);
    if (!legacyToken) {
      return sendError(res, 403, "FORBIDDEN", "No tiene permisos para ejecutar esta accion.", req.correlationId);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const downstream = await fetch(new URL("/api/v1/ai-chat", env.AI_CHAT_SERVICE_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${legacyToken}`,
          "x-correlation-id": req.correlationId
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal
      });

      const raw = await downstream.text();
      const contentType = downstream.headers.get("content-type") ?? "application/json";
      res.status(downstream.status);
      res.setHeader("Content-Type", contentType);
      res.send(raw);
    } catch {
      return sendError(
        res,
        502,
        "AI_CHAT_UNAVAILABLE",
        "El backend de AI chat no esta disponible.",
        req.correlationId
      );
    } finally {
      clearTimeout(timeout);
    }
  }));

  return router;
}