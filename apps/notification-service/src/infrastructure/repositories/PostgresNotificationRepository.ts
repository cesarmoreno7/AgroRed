import type { Pool } from "pg";
import { Notification } from "../../domain/entities/Notification.js";
import type { NotificationRepository, PaginationParams, PaginatedResult } from "../../domain/ports/NotificationRepository.js";
import type { NotificationChannel } from "../../domain/value-objects/NotificationChannel.js";
import type { NotificationStatus } from "../../domain/value-objects/NotificationStatus.js";

interface NotificationRow {
  id: string;
  tenant_id: string;
  incident_id: string | null;
  logistics_order_id: string | null;
  offer_id: string | null;
  notification_channel: NotificationChannel;
  recipient_label: string;
  title: string;
  message: string;
  scheduled_for: Date;
  status: NotificationStatus;
  created_at: Date;
}

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async save(notification: Notification): Promise<void> {
    const tenantId = await this.resolveTenantId(notification.tenantId);
    const incidentId = notification.incidentId
      ? await this.resolveIncidentId(notification.incidentId, tenantId)
      : null;
    const logisticsOrderId = notification.logisticsOrderId
      ? await this.resolveLogisticsOrderId(notification.logisticsOrderId, tenantId)
      : null;

    await this.pool.query(
      `
        INSERT INTO public.notifications (
          id,
          tenant_id,
          incident_id,
          logistics_order_id,
          offer_id,
          notification_channel,
          recipient_label,
          title,
          message,
          scheduled_for,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        notification.id,
        tenantId,
        incidentId,
        logisticsOrderId,
        notification.offerId,
        notification.notificationChannel,
        notification.recipientLabel,
        notification.title,
        notification.message,
        notification.scheduledFor,
        notification.status
      ]
    );
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await this.pool.query<NotificationRow>(
      `
        SELECT
          id,
          tenant_id,
          incident_id,
          logistics_order_id,
          offer_id,
          notification_channel,
          recipient_label,
          title,
          message,
          scheduled_for,
          status,
          created_at
        FROM public.notifications
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Notification>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<NotificationRow>(
      `
        SELECT id, tenant_id, incident_id, logistics_order_id, offer_id, notification_channel, recipient_label, title, message, scheduled_for, status, created_at
        FROM public.notifications
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: NotificationRow) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.tenants
        WHERE id::text = $1 OR UPPER(code) = UPPER($1)
        LIMIT 1
      `,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0].id;
  }

  private async resolveIncidentId(incidentId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.incidents
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [incidentId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("INCIDENT_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private async resolveLogisticsOrderId(logisticsOrderId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.logistics_orders
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [logisticsOrderId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  async updateStatus(id: string, status: NotificationStatus): Promise<void> {
    await this.pool.query(
      `UPDATE public.notifications SET status = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [status, id]
    );
  }

  async findPending(limit: number): Promise<Notification[]> {
    const result = await this.pool.query<NotificationRow>(
      `
        SELECT id, tenant_id, incident_id, logistics_order_id, offer_id, notification_channel, recipient_label, title, message, scheduled_for, status, created_at
        FROM public.notifications
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
          AND deleted_at IS NULL
        ORDER BY scheduled_for ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map((row: NotificationRow) => this.mapRow(row));
  }

  private mapRow(row: NotificationRow): Notification {
    return new Notification({
      id: row.id,
      tenantId: row.tenant_id,
      incidentId: row.incident_id,
      logisticsOrderId: row.logistics_order_id,
      offerId: row.offer_id,
      notificationChannel: row.notification_channel,
      recipientLabel: row.recipient_label,
      title: row.title,
      message: row.message,
      scheduledFor: row.scheduled_for,
      status: row.status,
      createdAt: row.created_at
    });
  }
}