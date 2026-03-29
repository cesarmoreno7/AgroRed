export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp", "in_app"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];