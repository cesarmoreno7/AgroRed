import nodemailer from "nodemailer";
import type { Notification } from "../../domain/entities/Notification.js";
import type { NotificationSender, SendResult } from "../../domain/ports/NotificationSender.js";
import { logError, logInfo } from "../../shared/logger.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class SmtpEmailSender implements NotificationSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user
        ? { auth: { user: config.user, pass: config.pass } }
        : {})
    });
  }

  async send(notification: Notification): Promise<SendResult> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: notification.recipientLabel,
        subject: notification.title,
        text: notification.message
      });

      logInfo("email.sent", {
        notificationId: notification.id,
        to: notification.recipientLabel
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logError("email.send_failed", {
        notificationId: notification.id,
        to: notification.recipientLabel,
        error: errorMessage
      });

      return { success: false, errorMessage };
    }
  }
}
