function write(level: "info" | "error", message: string, meta: Record<string, unknown> = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...meta,
    service: "user-service",
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

export function logError(message: string, meta: Record<string, unknown> = {}): void {
  write("error", message, meta);
}

export async function logAuditEvent(pool: any, event: {
  traceId: string;
  serviceName: string;
  entityName: string;
  entityId: string;
  actionName: string;
  actorId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const query = `
    INSERT INTO audit_log (service_name, entity_name, entity_id, action_name, actor_id, payload)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;

  const values = [
    event.serviceName,
    event.entityName,
    event.entityId,
    event.actionName,
    event.actorId,
    JSON.stringify(event.payload)
  ];

  try {
    await pool.query(query, values);
    logInfo("Audit event logged", { traceId: event.traceId });
  } catch (error) {
    logError("Failed to log audit event", { traceId: event.traceId, error });
  }
}
