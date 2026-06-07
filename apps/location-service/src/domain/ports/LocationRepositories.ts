import type { DepartamentoEntity, MunicipioEntity, CorregimientoEntity, VeredaEntity } from "../entities/LocationEntities.js";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DepartamentoRepository {
  list(page: number, limit: number, search?: string): Promise<PaginatedResult<DepartamentoEntity>>;
  findById(id: string): Promise<DepartamentoEntity | null>;
  findByCodigoDane(codigoDane: string): Promise<DepartamentoEntity | null>;
  create(data: { codigoDane: string; nombre: string }): Promise<DepartamentoEntity>;
  update(id: string, data: { codigoDane?: string; nombre?: string }): Promise<DepartamentoEntity>;
  delete(id: string): Promise<void>;
}

export interface MunicipioRepository {
  list(page: number, limit: number, search?: string, departamentoId?: string): Promise<PaginatedResult<MunicipioEntity>>;
  findById(id: string): Promise<MunicipioEntity | null>;
  findByCodigoDane(codigoDane: string): Promise<MunicipioEntity | null>;
  create(data: { codigoDane: string; nombre: string; departamentoId: string }): Promise<MunicipioEntity>;
  update(id: string, data: { codigoDane?: string; nombre?: string; departamentoId?: string }): Promise<MunicipioEntity>;
  delete(id: string): Promise<void>;
}

export interface CorregimientoRepository {
  list(page: number, limit: number, municipalityCode?: string, search?: string): Promise<PaginatedResult<CorregimientoEntity>>;
  findById(id: string): Promise<CorregimientoEntity | null>;
  findByDaneCode(daneCode: string): Promise<CorregimientoEntity | null>;
  create(data: Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">): Promise<CorregimientoEntity>;
  update(id: string, data: Partial<Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">>): Promise<CorregimientoEntity>;
  delete(id: string): Promise<void>;
}

export interface VeredaRepository {
  list(page: number, limit: number, corregimientoId?: string, municipalityCode?: string, search?: string): Promise<PaginatedResult<VeredaEntity>>;
  findById(id: string): Promise<VeredaEntity | null>;
  create(data: Omit<VeredaEntity, "id" | "createdAt" | "metadata">): Promise<VeredaEntity>;
  update(id: string, data: Partial<Omit<VeredaEntity, "id" | "createdAt" | "metadata">>): Promise<VeredaEntity>;
  delete(id: string): Promise<void>;
}
