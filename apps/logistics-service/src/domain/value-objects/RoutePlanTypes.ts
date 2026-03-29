export const PLAN_TYPES = ["recoleccion", "entrega", "mixta"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = ["draft", "optimized", "in_progress", "completed", "cancelled"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const STOP_TYPES = ["pickup", "delivery", "checkpoint"] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const STOP_STATUSES = ["pending", "arrived", "completed", "skipped"] as const;
export type StopStatus = (typeof STOP_STATUSES)[number];
