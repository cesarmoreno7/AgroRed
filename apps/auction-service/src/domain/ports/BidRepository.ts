import type { Bid } from "../entities/Bid.js";
import type { BidStatus } from "../value-objects/BidStatus.js";

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

export interface BidRepository {
  save(bid: Bid): Promise<void>;
  findById(id: string): Promise<Bid | null>;
  findByAuction(auctionId: string): Promise<Bid[]>;
  findHighestBid(auctionId: string): Promise<Bid | null>;
  findProxyBids(auctionId: string): Promise<Bid[]>;
  updateStatus(id: string, status: BidStatus): Promise<void>;
  countByAuction(auctionId: string): Promise<number>;
}
