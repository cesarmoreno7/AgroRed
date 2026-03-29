import type { Rescue } from "../entities/Rescue.js";

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

export interface RescueRepository {
  save(rescue: Rescue): Promise<void>;
  findById(id: string): Promise<Rescue | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Rescue>>;
}