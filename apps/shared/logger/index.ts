/**
 * Centralized structured logger for all AgroRed microservices.
 * Usage: import { createLogger } from "@agrored/shared/logger.js"
 *        const { logInfo, logError } = createLogger("my-service");
 */

type LogLevel = "info" | "warn" | "error";

export interface Logger {
  logInfo(message: string, meta?: Record<string, unknown>): void;
  logWarn(message: string, meta?: Record<string, unknown>): void;
  logError(message: string, meta?: Record<string, unknown>): void;
}

function write(service: string, level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(serviceName: string): Logger {
  return {
    logInfo: (message, meta = {}) => write(serviceName, "info", message, meta),
    logWarn: (message, meta = {}) => write(serviceName, "warn", message, meta),
    logError: (message, meta = {}) => write(serviceName, "error", message, meta),
  };
}
