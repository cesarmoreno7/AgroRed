export const INVENTORY_STATUSES = ["available", "reserved", "dispatched", "depleted"] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];