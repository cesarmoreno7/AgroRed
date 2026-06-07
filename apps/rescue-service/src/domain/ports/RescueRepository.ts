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

export interface FoodOrigin {
  id: string;
  tenantId: string;
  name: string;
  municipalityName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface RescueRepository {
  save(rescue: Rescue): Promise<void>;
  findById(id: string): Promise<Rescue | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Rescue>>;
  patch(id: string, fields: Record<string, unknown>): Promise<Rescue | null>;
  // Food Origins
  saveOrigin(origin: { tenantId: string; name: string; municipalityName: string; address?: string | null; latitude?: number | null; longitude?: number | null }): Promise<FoodOrigin>;
  listOrigins(tenantId?: string | null): Promise<FoodOrigin[]>;
  updateOrigin(id: string, fields: Partial<Omit<FoodOrigin, "id" | "tenantId" | "createdAt">>): Promise<FoodOrigin | null>;
  deleteOrigin(id: string): Promise<boolean>;
}