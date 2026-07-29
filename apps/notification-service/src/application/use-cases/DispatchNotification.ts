import type { NotificationRepository } from "../../domain/ports/NotificationRepository.js";
import type { NotificationSender } from "../../domain/ports/NotificationSender.js";
import type { NotificationChannel } from "../../domain/value-objects/NotificationChannel.js";
import { Notification } from "../../domain/entities/Notification.js";

export type NotificationSenderRegistry = Partial<Record<NotificationChannel, NotificationSender>>;

export class DispatchNotification {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly senders: NotificationSenderRegistry
  ) {}

  async execute(notificationId: string): Promise<{ status: "sent" | "failed"; errorMessage?: string }> {
    const notification = await this.repository.findById(notificationId);

    if (!notification) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }

    if (notification.status !== "pending") {
      throw new Error("NOTIFICATION_NOT_PENDING");
    }

    const sender = this.senders[notification.notificationChannel];
    if (!sender) {
      throw new Error("UNSUPPORTED_NOTIFICATION_CHANNEL");
    }

    const result = await sender.send(notification);

    const dispatchStatus = result.success ? "sent" as const : "failed" as const;

    const updatedNotification = new Notification({
      id: notification.id,
      tenantId: notification.tenantId,
      incidentId: notification.incidentId,
      logisticsOrderId: notification.logisticsOrderId,
      offerId: notification.offerId,
      notificationChannel: notification.notificationChannel,
      recipientLabel: notification.recipientLabel,
      title: notification.title,
      message: notification.message,
      scheduledFor: notification.scheduledFor,
      status: dispatchStatus,
      createdAt: notification.createdAt
    });

    await this.repository.updateStatus(updatedNotification.id, updatedNotification.status);

    return {
      status: dispatchStatus,
      errorMessage: result.errorMessage
    };
  }
}
