import type { NotificationPort, OfferMatchNotificationParams } from "../../domain/ports/NotificationPort.js";
import { logInfo, logError } from "../../shared/logger.js";

export class HttpNotificationAdapter implements NotificationPort {
  constructor(private readonly notificationServiceUrl: string) {}

  async registerOfferMatchNotification(params: OfferMatchNotificationParams): Promise<void> {
    const url = `${this.notificationServiceUrl}/api/v1/notifications/register`;

    const body = JSON.stringify({
      tenantId: params.tenantId,
      offerId: params.offerId,
      notificationChannel: "in_app",
      recipientLabel: params.recipientLabel,
      title: params.title,
      message: params.message,
      scheduledFor: new Date().toISOString()
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      logError("notification.register_failed", {
        status: response.status,
        offerId: params.offerId,
        response: text
      });
      throw new Error(`NOTIFICATION_REGISTER_FAILED: ${response.status}`);
    }

    logInfo("notification.registered", {
      offerId: params.offerId,
      recipientLabel: params.recipientLabel
    });
  }
}
