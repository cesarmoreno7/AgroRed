import type { Offer } from "../entities/Offer.js";

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

export interface OfferRepository {
  save(offer: Offer): Promise<void>;
  findById(id: string): Promise<Offer | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Offer>>;
  patch(id: string, fields: Record<string, unknown>): Promise<Offer | null>;
  /** Most recent published offer for a producer — used to source real product/quantity data for automatic rescue activation (Bug #12). */
  findLatestActiveByProducerId(producerId: string, tenantId: string): Promise<Offer | null>;
}
