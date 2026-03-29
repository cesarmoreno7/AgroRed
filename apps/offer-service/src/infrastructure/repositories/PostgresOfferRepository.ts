import type { Pool } from "pg";
import { Offer } from "../../domain/entities/Offer.js";
import type { OfferRepository, PaginationParams, PaginatedResult } from "../../domain/ports/OfferRepository.js";
import type { OfferStatus } from "../../domain/value-objects/OfferStatus.js";

interface OfferRow {
  id: string;
  tenant_id: string;
  producer_id: string;
  title: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_available: string;
  price_amount: string;
  currency: string;
  available_from: Date;
  available_until: Date | null;
  municipality_name: string;
  notes: string | null;
  status: OfferStatus;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
}

export class PostgresOfferRepository implements OfferRepository {
  constructor(private readonly pool: Pool) {}

  async save(offer: Offer): Promise<void> {
    const tenantId = await this.resolveTenantId(offer.tenantId);
    const producerId = await this.resolveProducerId(offer.producerId, tenantId);

    await this.pool.query(
      `
        INSERT INTO public.offers (
          id,
          tenant_id,
          producer_id,
          title,
          product_name,
          category,
          unit,
          quantity_available,
          price_amount,
          currency,
          available_from,
          available_until,
          municipality_name,
          notes,
          status,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `,
      [
        offer.id,
        tenantId,
        producerId,
        offer.title,
        offer.productName,
        offer.category,
        offer.unit,
        offer.quantityAvailable,
        offer.priceAmount,
        offer.currency,
        offer.availableFrom,
        offer.availableUntil,
        offer.municipalityName,
        offer.notes,
        offer.status,
        offer.latitude ?? null,
        offer.longitude ?? null,
      ]
    );
  }

  async findById(id: string): Promise<Offer | null> {
    const result = await this.pool.query<OfferRow>(
      `
        SELECT
          id,
          tenant_id,
          producer_id,
          title,
          product_name,
          category,
          unit,
          quantity_available,
          price_amount,
          currency,
          available_from,
          available_until,
          municipality_name,
          notes,
          status,
          latitude::text AS latitude,
          longitude::text AS longitude,
          created_at
        FROM public.offers
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Offer>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<OfferRow>(
      `
        SELECT id, tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, notes, status, latitude::text AS latitude, longitude::text AS longitude, created_at
        FROM public.offers
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: OfferRow) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.tenants
        WHERE id::text = $1 OR UPPER(code) = UPPER($1)
        LIMIT 1
      `,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0].id;
  }

  private async resolveProducerId(producerId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.producers
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [producerId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("PRODUCER_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private mapRow(row: OfferRow): Offer {
    return new Offer({
      id: row.id,
      tenantId: row.tenant_id,
      producerId: row.producer_id,
      title: row.title,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityAvailable: Number(row.quantity_available),
      priceAmount: Number(row.price_amount),
      currency: row.currency,
      availableFrom: row.available_from,
      availableUntil: row.available_until,
      municipalityName: row.municipality_name,
      notes: row.notes,
      status: row.status,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      createdAt: row.created_at
    });
  }
}
