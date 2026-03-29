export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];