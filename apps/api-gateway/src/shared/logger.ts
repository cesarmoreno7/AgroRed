type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...meta,
    service: "api-gateway",
    level,
    message
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function logInfo(message: string, meta: Record<string, unknown> = {}): void {
  write("info", message, meta);
}

export function logWarn(message: string, meta: Record<string, unknown> = {}): void {
  write("warn", message, meta);
}

export function logError(message: string, meta: Record<string, unknown> = {}): void {
  write("error", message, meta);
}

