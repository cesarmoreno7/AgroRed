import type { Pool } from "pg";
import { Bid } from "../../domain/entities/Bid.js";
import type { BidRepository } from "../../domain/ports/BidRepository.js";
import type { BidStatus } from "../../domain/value-objects/BidStatus.js";

interface BidRow {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder_type: string;
  amount: string;
  max_proxy_amount: string | null;
  is_proxy: boolean;
  social_score: string;
  distance_km: string | null;
  latitude: string | null;
  longitude: string | null;
  status: BidStatus;
  created_at: Date;
}

export class PostgresBidRepository implements BidRepository {
  constructor(private readonly pool: Pool) {}

  async save(bid: Bid): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.auction_bids (
        id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount,
        is_proxy, social_score, distance_km, latitude, longitude, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        bid.id, bid.auctionId, bid.bidderId, bid.bidderType, bid.amount,
        bid.maxProxyAmount, bid.isProxy, bid.socialScore,
        bid.distanceKm, bid.latitude, bid.longitude, bid.status
      ]
    );
  }

  async findById(id: string): Promise<Bid | null> {
    const result = await this.pool.query<BidRow>(
      `SELECT * FROM public.auction_bids WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByAuction(auctionId: string): Promise<Bid[]> {
    const result = await this.pool.query<BidRow>(
      `SELECT * FROM public.auction_bids WHERE auction_id = $1 ORDER BY amount DESC, created_at ASC`,
      [auctionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findHighestBid(auctionId: string): Promise<Bid | null> {
    const result = await this.pool.query<BidRow>(
      `SELECT * FROM public.auction_bids
       WHERE auction_id = $1 AND status = 'active'
       ORDER BY amount DESC LIMIT 1`,
      [auctionId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findProxyBids(auctionId: string): Promise<Bid[]> {
    const result = await this.pool.query<BidRow>(
      `SELECT * FROM public.auction_bids
       WHERE auction_id = $1 AND max_proxy_amount IS NOT NULL AND status IN ('active', 'outbid')
       ORDER BY max_proxy_amount DESC`,
      [auctionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async updateStatus(id: string, status: BidStatus): Promise<void> {
    await this.pool.query(
      `UPDATE public.auction_bids SET status = $2 WHERE id = $1`,
      [id, status]
    );
  }

  async countByAuction(auctionId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.auction_bids WHERE auction_id = $1`,
      [auctionId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: BidRow): Bid {
    return new Bid({
      id: row.id,
      auctionId: row.auction_id,
      bidderId: row.bidder_id,
      bidderType: row.bidder_type,
      amount: Number(row.amount),
      maxProxyAmount: row.max_proxy_amount ? Number(row.max_proxy_amount) : null,
      isProxy: row.is_proxy,
      socialScore: Number(row.social_score),
      distanceKm: row.distance_km ? Number(row.distance_km) : null,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      status: row.status,
      createdAt: row.created_at
    });
  }
}
