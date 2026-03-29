import type { LogisticsOrder } from "../entities/LogisticsOrder.js";

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

export interface LogisticsOrderRepository {
  save(order: LogisticsOrder): Promise<void>;
  findById(id: string): Promise<LogisticsOrder | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<LogisticsOrder>>;
}