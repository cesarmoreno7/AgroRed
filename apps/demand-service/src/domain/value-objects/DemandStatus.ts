export const DEMAND_STATUSES = ["open", "matched", "closed"] as const;

export type DemandStatus = (typeof DEMAND_STATUSES)[number];
