import type { InventoryItem } from "../entities/InventoryItem.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface InventoryItemRepository {
  save(item: InventoryItem): Promise<void>;
  saveBatch(items: InventoryItem[]): Promise<void>;
  findById(id: string): Promise<InventoryItem | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<InventoryItem>>;
  listNearExpiry(tenantId: string, daysAhead: number, params: PaginationParams): Promise<PaginatedResult<InventoryItem>>;
}