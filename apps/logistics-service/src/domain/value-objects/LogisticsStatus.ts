export const LOGISTICS_STATUSES = ["scheduled", "in_transit", "delivered", "cancelled"] as const;

export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];