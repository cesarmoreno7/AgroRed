import type { Request, Response, NextFunction } from "express";

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
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      correlationId: correlationId ?? null
    }
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

