import type { Institution } from "../entities/Institution.js";

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

export interface StatusHistoryEntry {
  institutionId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string | null;
  reason: string | null;
}

export interface InstitutionRepository {
  save(institution: Institution): Promise<void>;
  saveBatch(institutions: Institution[]): Promise<void>;
  update(institution: Institution): Promise<void>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<Institution | null>;
  findByName(tenantId: string, name: string): Promise<Institution | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Institution>>;
  logStatusChange(entry: StatusHistoryEntry): Promise<void>;
}
