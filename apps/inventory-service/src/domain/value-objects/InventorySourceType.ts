export const INVENTORY_SOURCE_TYPES = ["offer_stock", "rescued_stock", "buffer_stock"] as const;

export type InventorySourceType = (typeof INVENTORY_SOURCE_TYPES)[number];