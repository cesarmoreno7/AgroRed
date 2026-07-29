import type { Notification } from "../../domain/entities/Notification.js";
import type { NotificationSender, SendResult } from "../../domain/ports/NotificationSender.js";
import { logError, logInfo } from "../../shared/logger.js";

export interface TwilioWhatsappConfig {
  accountSid: string;
  authToken: string;
  /** Twilio WhatsApp-enabled sender number, e.g. "+14155238886" (Sandbox default). */
  whatsappFrom: string;
}

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

function toWhatsappAddress(value: string): string {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

/**
 * Sends WhatsApp messages through the Twilio Messages REST API
 * (the same endpoint as SMS, addressed with the "whatsapp:" prefix).
 * Bug #10: "omnicanal" alerts previously only reached the email channel.
 */
export class TwilioWhatsappSender implements NotificationSender {
  constructor(private readonly config: TwilioWhatsappConfig) {}

  async send(notification: Notification): Promise<SendResult> {
    if (!this.config.accountSid || !this.config.authToken || !this.config.whatsappFrom) {
      const errorMessage = "WhatsApp channel not configured (missing TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM).";
      logError("whatsapp.send_skipped", { notificationId: notification.id, reason: errorMessage });
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
            From: toWhatsappAddress(this.config.whatsappFrom),
            To: toWhatsappAddress(notification.recipientLabel),
            Body: `${notification.title}\n${notification.message}`
          })
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Twilio WhatsApp API responded ${response.status}: ${body}`);
      }

      logInfo("whatsapp.sent", { notificationId: notification.id, to: notification.recipientLabel });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError("whatsapp.send_failed", { notificationId: notification.id, to: notification.recipientLabel, error: errorMessage });
      return { success: false, errorMessage };
    }
  }
}
