import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";
import { sendError } from "../routes/../response.js";
import type { Request, Response } from "express";

export interface RateLimiters {
  globalRateLimiter: ReturnType<typeof rateLimit>;
  authRateLimiter: ReturnType<typeof rateLimit>;
}

/**
 * Creates rate limiters. When a Redis client is provided the counters are
 * shared across all gateway instances (distributed). Falls back to in-memory
 * when Redis is not configured.
 */
export function createRateLimiters(redis?: Redis): RateLimiters {
  const storeFactory = (prefix: string) =>
    redis
      ? new RedisStore({
          // redis.call returns Promise<unknown>; cast to satisfy rate-limit-redis's SendCommandFn
          sendCommand: (async (...args: string[]) =>
            redis.call(...(args as [string, ...string[]]))) as unknown as (...args: string[]) => Promise<string>,
          prefix: `rl:${prefix}:`
        })
      : undefined;

  const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFactory("global"),
    passOnStoreError: true,
    handler: (_req: Request, res: Response) => {
      sendError(res, 429, "RATE_LIMIT_EXCEEDED", "Demasiadas solicitudes. Intente de nuevo mas tarde.");
    }
  });

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFactory("auth"),
    passOnStoreError: true,
    handler: (_req: Request, res: Response) => {
      sendError(res, 429, "RATE_LIMIT_EXCEEDED", "Demasiados intentos de autenticacion. Intente de nuevo mas tarde.");
    }
  });

  return { globalRateLimiter, authRateLimiter };
}

