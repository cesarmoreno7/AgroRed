export const RESCUE_STATUSES = ["scheduled", "in_transit", "delivered", "cancelled"] as const;

export type RescueStatus = (typeof RESCUE_STATUSES)[number];