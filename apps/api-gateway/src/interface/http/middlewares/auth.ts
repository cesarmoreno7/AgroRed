import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { TokenBlacklist } from "../../../infrastructure/redis/TokenBlacklist.js";

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}

/** Routes that do NOT require authentication. */
const PUBLIC_PATHS = [
  "/api/v1/users/register",
  "/api/v1/users/login",
  "/health",
  "/api/v1/catalog"
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function sendAuthError(res: Response, code: string, message: string): void {
  res.status(401).json({
    success: false,
    error: { code, message }
  });
}

export function createAuthMiddleware(jwtSecret: string, blacklist?: TokenBlacklist) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isPublic(req.path)) {
      return next();
    }

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      sendAuthError(res, "AUTH_TOKEN_MISSING", "Token de autenticacion requerido.");
      return;
    }

    const token = header.slice(7);

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Check if token has been revoked (logout)
      if (blacklist && decoded.jti) {
        const revoked = await blacklist.isBlacklisted(decoded.jti);
        if (revoked) {
          sendAuthError(res, "AUTH_TOKEN_REVOKED", "Token revocado. Inicie sesion nuevamente.");
          return;
        }
      }

      // Attach user info as headers so downstream services can read them.
      req.headers["x-user-id"] = decoded.sub;
      req.headers["x-tenant-id"] = decoded.tenantId;
      req.headers["x-user-email"] = decoded.email;
      req.headers["x-user-role"] = decoded.role;

      next();
    } catch {
      sendAuthError(res, "AUTH_TOKEN_INVALID", "Token invalido o expirado.");
    }
  };
}
