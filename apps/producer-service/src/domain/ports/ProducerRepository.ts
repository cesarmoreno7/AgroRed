import type { Producer } from "../entities/Producer.js";

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

export interface ProducerRepository {
  save(producer: Producer): Promise<void>;
  saveBatch(producers: Producer[]): Promise<void>;
  findById(id: string): Promise<Producer | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Producer>>;
  findByOrganizationName(tenantId: string, organizationName: string): Promise<Producer | null>;
}
