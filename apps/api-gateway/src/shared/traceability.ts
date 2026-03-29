import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function traceabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.header("x-correlation-id") || randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  const traceId = randomUUID();
  req.headers["x-trace-id"] = traceId;
  res.setHeader("x-trace-id", traceId);

  next();
}