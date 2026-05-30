import type { Pool } from "pg";
import { logError, logInfo } from "./logger.js";

export interface AuditEventInput {
  tenantId?: string | null;
  serviceName: string;
  entityName: string;
  entityId: string;
  actionName: string;
  actorId?: string | null;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export async function writeAuditEvent(pool: Pool, event: AuditEventInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.audit_log
         (tenant_id, service_name, entity_name, entity_id, action_name, actor_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        event.tenantId ?? null,
        event.serviceName,
        event.entityName,
        event.entityId,
        event.actionName,
        event.actorId ?? null,
        JSON.stringify(event.payload)
      ]
    );

    logInfo("audit.event_logged", {
      correlationId: event.correlationId,
      serviceName: event.serviceName,
      entityName: event.entityName,
      actionName: event.actionName
    });
  } catch (error) {
    logError("audit.event_failed", {
      correlationId: event.correlationId,
      serviceName: event.serviceName,
      entityName: event.entityName,
      actionName: event.actionName,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}