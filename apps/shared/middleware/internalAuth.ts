import type { Request, Response, NextFunction } from "express";

/**
 * Validates that requests to private routes carry the headers injected by the
 * API Gateway after JWT verification. Rejects direct calls that bypass the
 * gateway (no x-user-id present) unless the request carries a valid
 * INTERNAL_API_KEY (used for service-to-service calls).
 *
 * Public routes (health, /api/v1/users/register, /api/v1/users/login) are
 * passed through without validation.
 */
const PUBLIC_SUFFIXES = ["/health", "/users/register", "/users/login", "/users/recover-password", "/users/reset-password"];

function isPublic(path: string): boolean {
  return PUBLIC_SUFFIXES.some((s) => path === s || path.endsWith(s));
}

export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublic(req.path)) {
    return next();
  }

  const userId = req.headers["x-user-id"] as string | undefined;
  const apiKey = req.headers["x-internal-api-key"] as string | undefined;
  const internalKey = process.env.INTERNAL_API_KEY;

  // Allow service-to-service calls with a pre-shared API key
  if (apiKey && internalKey && apiKey === internalKey) {
    return next();
  }

  if (!userId) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Acceso directo al servicio no permitido. Use el API Gateway."
      }
    });
    return;
  }

  next();
}
