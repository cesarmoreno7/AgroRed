import type { Pool } from "pg";

/**
 * Escribe en tablas de OTROS módulos (analytics / notification) reutilizando
 * el patrón `createAlert()` + `notifyTenantAdmins()` de
 * apps/analytics-service/.../PostgresInstitutionalRepository.ts (~:591-646).
 *
 * En el monolito comparten un solo Pool; en modo servicio-suelto pae-service
 * corre solo, así que esto es best-effort y nunca bloquea el flujo principal.
 */
export interface InstitutionalAlertInput {
  tenantId: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  indicatorName?: string;
  indicatorValue?: number;
  thresholdValue?: number;
  zoneName?: string;
}

export interface CoordinationTaskInput {
  tenantId: string;
  actorName: string;
  taskDescription: string;
  assignedTo?: string | null;
  priority?: "low" | "medium" | "high" | "critical";
  dueDate?: string | null;
  notes?: string | null;
}

export class PaeEscalationRepository {
  constructor(private readonly pool: Pool) {}

  /** Inserta institutional_alerts y, para severidad alta/crítica, encola correos a los admin_municipal. */
  async createInstitutionalAlert(data: InstitutionalAlertInput): Promise<string | null> {
    try {
      const res = await this.pool.query<{ id: string }>(
        `INSERT INTO public.institutional_alerts
           (tenant_id, alert_type, severity, title, description,
            indicator_name, indicator_value, threshold_value, zone_name, auto_generated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
         RETURNING id`,
        [
          data.tenantId,
          data.alertType,
          data.severity,
          data.title,
          data.description,
          data.indicatorName ?? null,
          data.indicatorValue ?? null,
          data.thresholdValue ?? null,
          data.zoneName ?? null
        ]
      );
      const alertId = res.rows[0]?.id ?? null;
      if (alertId && (data.severity === "high" || data.severity === "critical")) {
        await this.notifyTenantAdmins(data.tenantId, alertId, data.title, data.description);
      }
      return alertId;
    } catch {
      return null;
    }
  }

  private async notifyTenantAdmins(
    tenantId: string,
    alertId: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      const admins = await this.pool.query<{ email: string }>(
        `SELECT email FROM public.users
          WHERE tenant_id = $1 AND role = 'admin_municipal' AND status = 'active' AND deleted_at IS NULL
          LIMIT 3`,
        [tenantId]
      );
      for (const admin of admins.rows) {
        await this.pool.query(
          `INSERT INTO public.notifications
             (id, tenant_id, institutional_alert_id, notification_channel, recipient_label, title, message, scheduled_for, status)
           VALUES (gen_random_uuid(), $1, $2, 'email', $3, $4, $5, NOW(), 'pending')`,
          [tenantId, alertId, admin.email, title, message]
        );
      }
    } catch {
      // best-effort
    }
  }

  /** Inserta coordination_tasks con actor_type='alcaldia'. Devuelve el id o null. */
  async createCoordinationTask(data: CoordinationTaskInput): Promise<string | null> {
    try {
      const res = await this.pool.query<{ id: string }>(
        `INSERT INTO public.coordination_tasks
           (tenant_id, actor_type, actor_name, task_description, assigned_to, status, priority, due_date, notes)
         VALUES ($1, 'alcaldia', $2, $3, $4, 'pending', COALESCE($5,'high'), $6::date, $7)
         RETURNING id`,
        [
          data.tenantId,
          data.actorName,
          data.taskDescription,
          data.assignedTo ?? null,
          data.priority ?? null,
          data.dueDate ?? null,
          data.notes ?? null
        ]
      );
      return res.rows[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Marca la coordination_task ligada como completed cuando el requerimiento se subsana. */
  async completeCoordinationTask(taskId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE public.coordination_tasks
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [taskId]
      );
    } catch {
      // best-effort
    }
  }
}
