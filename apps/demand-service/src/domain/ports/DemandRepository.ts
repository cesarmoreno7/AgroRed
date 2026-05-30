import type { Demand } from "../entities/Demand.js";

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

export interface DemandRepository {
  save(demand: Demand): Promise<void>;
  findById(id: string): Promise<Demand | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Demand>>;
  patch(id: string, fields: Record<string, unknown>): Promise<Demand | null>;
}
