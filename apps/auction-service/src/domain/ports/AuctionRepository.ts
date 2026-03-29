import type { Auction } from "../entities/Auction.js";
import type { AuctionStatus } from "../value-objects/AuctionStatus.js";
import type { VisibilityPhase } from "../value-objects/VisibilityPhase.js";

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

export interface AuctionFilters {
  status?: AuctionStatus;
  auctionType?: string;
  producerId?: string;
  municipalityName?: string;
  buyerLatitude?: number;
  buyerLongitude?: number;
  radiusKm?: number;
  tenantId?: string;
}

export interface AuctionRepository {
  save(auction: Auction): Promise<void>;
  update(auction: Auction): Promise<void>;
  findById(id: string): Promise<Auction | null>;
  list(params: PaginationParams, filters?: AuctionFilters): Promise<PaginatedResult<Auction>>;
  findActiveExpired(): Promise<Auction[]>;
  updateStatus(id: string, status: AuctionStatus): Promise<void>;
  updateEndTime(id: string, endsAt: Date, extensionCount: number): Promise<void>;
  updateCurrentPrice(id: string, price: number): Promise<void>;
  updateVisibility(id: string, phase: VisibilityPhase, radiusKm: number): Promise<void>;
  setWinner(id: string, winnerId: string, winnerPrice: number): Promise<void>;
}
