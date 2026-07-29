import type { Notification } from "../../domain/entities/Notification.js";
import type { NotificationSender, SendResult } from "../../domain/ports/NotificationSender.js";
import { logError, logInfo } from "../../shared/logger.js";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** E.164 sender number for plain SMS, e.g. "+15005550006". */
  smsFrom: string;
}

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

/**
 * Sends plain SMS through the Twilio Messages REST API.
 * Bug #10: notifications with notificationChannel = "sms" used to be accepted
 * (RegisterNotification) but silently unsendable — DispatchNotification threw
 * UNSUPPORTED_NOTIFICATION_CHANNEL for anything but email.
 */
export class TwilioSmsSender implements NotificationSender {
  constructor(private readonly config: TwilioConfig) {}

  async send(notification: Notification): Promise<SendResult> {
    if (!this.config.accountSid || !this.config.authToken || !this.config.smsFrom) {
      const errorMessage = "SMS channel not configured (missing TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM).";
      logError("sms.send_skipped", { notificationId: notification.id, reason: errorMessage });
      return { success: false, errorMessage };
    }

    try {
      const response = await fetch(
        `${TWILIO_API_BASE}/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64")}`
          },
          body: new URLSearchParams({
            From: this.config.smsFrom,
            To: notification.recipientLabel,
            Body: `${notification.title}\n${notification.message}`
          })
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Twilio SMS API responded ${response.status}: ${body}`);
      }

      logInfo("sms.sent", { notificationId: notification.id, to: notification.recipientLabel });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError("sms.send_failed", { notificationId: notification.id, to: notification.recipientLabel, error: errorMessage });
      return { success: false, errorMessage };
    }
  }
}
