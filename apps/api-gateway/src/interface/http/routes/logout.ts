import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import type { TokenBlacklist } from "../../../infrastructure/redis/TokenBlacklist.js";
import type { JwtPayload } from "../middlewares/auth.js";

export function createLogoutRouter(jwtSecret: string, blacklist: TokenBlacklist): Router {
  const router = Router();

  router.post("/api/v1/users/logout", async (req: Request, res: Response) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      res.status(400).json({
        success: false,
        error: { code: "TOKEN_REQUIRED", message: "Token requerido para cerrar sesion." }
      });
      return;
    }

    const token = header.slice(7);

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      const jti = decoded.jti || token.slice(-32); // fallback to last 32 chars
      const exp = decoded.exp || 0;
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp - now;

      await blacklist.add(jti, ttl > 0 ? ttl : 3600);

      res.json({ success: true, data: { message: "Sesion cerrada exitosamente." } });
    } catch {
      // Even if token is expired, treat logout as successful
      res.json({ success: true, data: { message: "Sesion cerrada." } });
    }
  });

  return router;
}
