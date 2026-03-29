import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../../user-service/src/domain/value-objects/UserRole.js";

/**
 * Middleware factory that restricts access to specific roles.
 * Must be mounted AFTER the auth middleware so that x-user-role is available.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.headers["x-user-role"] as string | undefined;

    if (!role || !allowedRoles.includes(role as UserRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "No tiene permisos para acceder a este recurso."
        }
      });
      return;
    }

    next();
  };
}
