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

export interface ProductionRecord {
  temporada: string;
  cultivo: string;
  hectareas: number;
  toneladas: number;
  ingresos: number;
  costos: number;
  fechaCorte: string;
}

export interface ProducerStats {
  producer: Producer;
  totalOffers: number;
  activeOffers: number;
  totalRescues: number;
  totalKgRescued: number;
  lastActivityAt: string | null;
  historicalProduction: ProductionRecord[];
}

export interface ProducerRepository {
  save(producer: Producer): Promise<void>;
  saveBatch(producers: Producer[]): Promise<void>;
  update(producer: Producer): Promise<void>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<Producer | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Producer>>;
  findByOrganizationName(tenantId: string, organizationName: string): Promise<Producer | null>;
  findByUserId(userId: string): Promise<Producer | null>;
  findStats(producerId: string): Promise<ProducerStats | null>;
}
