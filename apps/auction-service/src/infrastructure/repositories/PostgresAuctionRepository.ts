import type { Pool } from "pg";
import { Auction } from "../../domain/entities/Auction.js";
import type {
  AuctionRepository,
  AuctionFilters,
  PaginationParams,
  PaginatedResult
} from "../../domain/ports/AuctionRepository.js";
import type { AuctionType } from "../../domain/value-objects/AuctionType.js";
import type { AuctionStatus } from "../../domain/value-objects/AuctionStatus.js";
import type { VisibilityPhase } from "../../domain/value-objects/VisibilityPhase.js";

interface AuctionRow {
  id: string;
  tenant_id: string;
  producer_id: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_kg: string;
  photo_url: string | null;
  harvest_date: Date;
  shelf_life_hours: string;
  auction_type: AuctionType;
  base_price: string;
  reserve_price: string;
  currency: string;
  duration_minutes: string;
  starts_at: Date;
  ends_at: Date;
  current_price: string;
  visibility_phase: VisibilityPhase;
  visibility_radius_km: string;
  latitude: string;
  longitude: string;
  municipality_name: string;
  extension_count: string;
  max_extensions: string;
  dutch_step_percent: string | null;
  dutch_step_minutes: string | null;
  winner_id: string | null;
  winner_price: string | null;
  status: AuctionStatus;
  created_at: Date;
}

export class PostgresAuctionRepository implements AuctionRepository {
  constructor(private readonly pool: Pool) {}

  async save(auction: Auction): Promise<void> {
    const tenantId = await this.resolveTenantId(auction.tenantId);

    await this.pool.query(
      `INSERT INTO public.auctions (
        id, tenant_id, producer_id, product_name, category, unit, quantity_kg,
        photo_url, harvest_date, shelf_life_hours, auction_type, base_price,
        reserve_price, currency, duration_minutes, starts_at, ends_at,
        current_price, visibility_phase, visibility_radius_km,
        latitude, longitude, municipality_name,
        extension_count, max_extensions, dutch_step_percent, dutch_step_minutes,
        winner_id, winner_price, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
      )`,
      [
        auction.id, tenantId, auction.producerId,
        auction.productName, auction.category, auction.unit, auction.quantityKg,
        auction.photoUrl, auction.harvestDate, auction.shelfLifeHours,
        auction.auctionType, auction.basePrice, auction.reservePrice,
        auction.currency, auction.durationMinutes, auction.startsAt, auction.endsAt,
        auction.currentPrice, auction.visibilityPhase, auction.visibilityRadiusKm,
        auction.latitude, auction.longitude, auction.municipalityName,
        auction.extensionCount, auction.maxExtensions,
        auction.dutchStepPercent, auction.dutchStepMinutes,
        auction.winnerId, auction.winnerPrice, auction.status
      ]
    );
  }

  async update(auction: Auction): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET
        current_price=$2, visibility_phase=$3, visibility_radius_km=$4,
        extension_count=$5, ends_at=$6, winner_id=$7, winner_price=$8, status=$9
       WHERE id=$1 AND deleted_at IS NULL`,
      [
        auction.id, auction.currentPrice, auction.visibilityPhase,
        auction.visibilityRadiusKm, auction.extensionCount, auction.endsAt,
        auction.winnerId, auction.winnerPrice, auction.status
      ]
    );
  }

  async findById(id: string): Promise<Auction | null> {
    const result = await this.pool.query<AuctionRow>(
      `SELECT * FROM public.auctions WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, filters?: AuctionFilters): Promise<PaginatedResult<Auction>> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters?.auctionType) {
      conditions.push(`auction_type = $${idx++}`);
      values.push(filters.auctionType);
    }
    if (filters?.producerId) {
      conditions.push(`producer_id = $${idx++}`);
      values.push(filters.producerId);
    }
    if (filters?.municipalityName) {
      conditions.push(`UPPER(municipality_name) = UPPER($${idx++})`);
      values.push(filters.municipalityName);
    }
    if (filters?.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      values.push(filters.tenantId);
    }

    const where = conditions.join(" AND ");

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.auctions WHERE ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, params.limit, offset];
    const result = await this.pool.query<AuctionRow>(
      `SELECT * FROM public.auctions WHERE ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      dataValues
    );

    return {
      data: result.rows.map((row) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  async findActiveExpired(): Promise<Auction[]> {
    const result = await this.pool.query<AuctionRow>(
      `SELECT * FROM public.auctions
       WHERE status IN ('active', 'extended')
         AND ends_at <= NOW()
         AND deleted_at IS NULL`
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async updateStatus(id: string, status: AuctionStatus): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET status = $2 WHERE id = $1 AND deleted_at IS NULL`,
      [id, status]
    );
  }

  async updateEndTime(id: string, endsAt: Date, extensionCount: number): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET ends_at = $2, extension_count = $3 WHERE id = $1 AND deleted_at IS NULL`,
      [id, endsAt, extensionCount]
    );
  }

  async updateCurrentPrice(id: string, price: number): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET current_price = $2 WHERE id = $1 AND deleted_at IS NULL`,
      [id, price]
    );
  }

  async updateVisibility(id: string, phase: VisibilityPhase, radiusKm: number): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET visibility_phase = $2, visibility_radius_km = $3
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, phase, radiusKm]
    );
  }

  async setWinner(id: string, winnerId: string, winnerPrice: number): Promise<void> {
    await this.pool.query(
      `UPDATE public.auctions SET winner_id = $2, winner_price = $3
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, winnerId, winnerPrice]
    );
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );
    if (!result.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return result.rows[0].id;
  }

  private mapRow(row: AuctionRow): Auction {
    return new Auction({
      id: row.id,
      tenantId: row.tenant_id,
      producerId: row.producer_id,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityKg: Number(row.quantity_kg),
      photoUrl: row.photo_url,
      harvestDate: row.harvest_date,
      shelfLifeHours: Number(row.shelf_life_hours),
      auctionType: row.auction_type,
      basePrice: Number(row.base_price),
      reservePrice: Number(row.reserve_price),
      currency: row.currency,
      durationMinutes: Number(row.duration_minutes),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      currentPrice: Number(row.current_price),
      visibilityPhase: row.visibility_phase,
      visibilityRadiusKm: Number(row.visibility_radius_km),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      municipalityName: row.municipality_name,
      extensionCount: Number(row.extension_count),
      maxExtensions: Number(row.max_extensions),
      dutchStepPercent: row.dutch_step_percent ? Number(row.dutch_step_percent) : null,
      dutchStepMinutes: row.dutch_step_minutes ? Number(row.dutch_step_minutes) : null,
      winnerId: row.winner_id,
      winnerPrice: row.winner_price ? Number(row.winner_price) : null,
      status: row.status,
      createdAt: row.created_at
    });
  }
}
