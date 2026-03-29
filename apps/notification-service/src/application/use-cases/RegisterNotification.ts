import { randomUUID } from "node:crypto";
import { Notification } from "../../domain/entities/Notification.js";
import type { NotificationRepository } from "../../domain/ports/NotificationRepository.js";
import type { NotificationChannel } from "../../domain/value-objects/NotificationChannel.js";

export interface RegisterNotificationCommand {
  tenantId: string;
  incidentId?: string | null;
  logisticsOrderId?: string | null;
  offerId?: string | null;
  notificationChannel: NotificationChannel;
  recipientLabel: string;
  title: string;
  message: string;
  scheduledFor: Date;
}

export class RegisterNotification {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(command: RegisterNotificationCommand): Promise<Notification> {
    const scheduledFor = new Date(command.scheduledFor);

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new Error("INVALID_NOTIFICATION_SCHEDULE");
    }

    if (!command.incidentId && !command.logisticsOrderId && !command.offerId) {
      throw new Error("INVALID_NOTIFICATION_REFERENCE");
    }

    const notification = new Notification({
      id: randomUUID(),
      tenantId: command.tenantId,
      incidentId: command.incidentId ?? null,
      logisticsOrderId: command.logisticsOrderId ?? null,
      offerId: command.offerId ?? null,
      notificationChannel: command.notificationChannel,
      recipientLabel: command.recipientLabel,
      title: command.title,
      message: command.message,
      scheduledFor,
      status: "pending"
    });

    await this.repository.save(notification);

    return notification;
  }
}