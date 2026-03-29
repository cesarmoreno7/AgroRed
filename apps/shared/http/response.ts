import type { NextFunction, Request, Response } from "express";

export function sendSuccess(res: Response, data: unknown, status = 200): Response {
  return res.status(status).json({
    success: true,
    data
  });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  correlationId?: string
): Response {
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message }
  };
  if (correlationId !== undefined) {
    (body.error as Record<string, unknown>).correlationId = correlationId;
  }
  return res.status(status).json(body);
}

export function sendPaginatedSuccess(
  res: Response,
  data: unknown[],
  pagination: { total: number; page: number; limit: number }
): Response {
  return res.status(200).json({
    success: true,
    data,
    pagination
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): Response {
  return sendError(res, 404, "RESOURCE_NOT_FOUND", "Ruta no encontrada.");
}

export type LogErrorFn = (message: string, meta: Record<string, unknown>) => void;

export function createGlobalErrorHandler(logError: LogErrorFn) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    logError("unhandled_error", {
      path: req.originalUrl,
      method: req.method,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    sendError(res, 500, "INTERNAL_SERVER_ERROR", "Error interno del servidor.");
  };
}
