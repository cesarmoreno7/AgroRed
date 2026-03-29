import type { NotificationRepository } from "../../domain/ports/NotificationRepository.js";
import type { NotificationSender } from "../../domain/ports/NotificationSender.js";
import { Notification } from "../../domain/entities/Notification.js";

export class DispatchNotification {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly sender: NotificationSender
  ) {}

  async execute(notificationId: string): Promise<{ status: "sent" | "failed"; errorMessage?: string }> {
    const notification = await this.repository.findById(notificationId);

    if (!notification) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }

    if (notification.status !== "pending") {
      throw new Error("NOTIFICATION_NOT_PENDING");
    }

    if (notification.notificationChannel !== "email") {
      throw new Error("UNSUPPORTED_NOTIFICATION_CHANNEL");
    }

    const result = await this.sender.send(notification);

    const updatedNotification = new Notification({
      id: notification.id,
      tenantId: notification.tenantId,
      incidentId: notification.incidentId,
      logisticsOrderId: notification.logisticsOrderId,
      notificationChannel: notification.notificationChannel,
      recipientLabel: notification.recipientLabel,
      title: notification.title,
      message: notification.message,
      scheduledFor: notification.scheduledFor,
      status: result.success ? "sent" : "failed",
      createdAt: notification.createdAt
    });

    await this.repository.updateStatus(updatedNotification.id, updatedNotification.status);

    return {
      status: updatedNotification.status,
      errorMessage: result.errorMessage
    };
  }
}
