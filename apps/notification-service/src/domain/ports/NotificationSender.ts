import type { Notification } from "../entities/Notification.js";

export interface SendResult {
  success: boolean;
  errorMessage?: string;
}

export interface NotificationSender {
  send(notification: Notification): Promise<SendResult>;
}
