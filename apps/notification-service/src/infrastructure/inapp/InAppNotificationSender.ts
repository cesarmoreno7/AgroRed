import type { Notification } from "../../domain/entities/Notification.js";
import type { NotificationSender, SendResult } from "../../domain/ports/NotificationSender.js";
import { logInfo } from "../../shared/logger.js";

/**
 * "Delivers" an in-app notification. Unlike email/SMS/WhatsApp there is no
 * external transport: the notification row itself, already persisted by
 * RegisterNotification and readable via GET /api/v1/notifications, is the
 * in-app inbox the dashboard polls. Dispatch here just confirms delivery so
 * the notification stops being reported as unsendable (Bug #10).
 */
export class InAppNotificationSender implements NotificationSender {
  async send(notification: Notification): Promise<SendResult> {
    logInfo("in_app.delivered", { notificationId: notification.id, recipient: notification.recipientLabel });
    return { success: true };
  }
}
