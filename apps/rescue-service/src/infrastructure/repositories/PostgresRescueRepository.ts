import type { Pool } from "pg";
import { Rescue } from "../../domain/entities/Rescue.js";
import type { RescueRepository, PaginationParams, PaginatedResult } from "../../domain/ports/RescueRepository.js";
import type { RescueChannel } from "../../domain/value-objects/RescueChannel.js";
import type { RescueStatus } from "../../domain/value-objects/RescueStatus.js";

interface RescueRow {
  id: string;
  tenant_id: string;
  producer_id: string;
  offer_id: string | null;
  rescue_channel: RescueChannel;
  destination_organization_name: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_rescued: string;
  scheduled_at: Date;
  beneficiary_count: number;
  municipality_name: string;
  notes: string | null;
  status: RescueStatus;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
}

export class PostgresRescueRepository implements RescueRepository {
  constructor(private readonly pool: Pool) {}

  async save(rescue: Rescue): Promise<void> {
    const tenantId = await this.resolveTenantId(rescue.tenantId);
    const producerId = await this.resolveProducerId(rescue.producerId, tenantId);
    const offerId = rescue.offerId
      ? await this.resolveOfferId(rescue.offerId, tenantId, producerId)
      : null;

    await this.pool.query(
      `
        INSERT INTO public.rescues (
          id,
          tenant_id,
          producer_id,
          offer_id,
          rescue_channel,
          destination_organization_name,
          product_name,
          category,
          unit,
          quantity_rescued,
          scheduled_at,
          beneficiary_count,
          municipality_name,
          notes,
          status,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `,
      [
        rescue.id,
        tenantId,
        producerId,
        offerId,
        rescue.rescueChannel,
        rescue.destinationOrganizationName,
        rescue.productName,
        rescue.category,
        rescue.unit,
        rescue.quantityRescued,
        rescue.scheduledAt,
        rescue.beneficiaryCount,
        rescue.municipalityName,
        rescue.notes,
        rescue.status,
        rescue.latitude,
        rescue.longitude
      ]
    );
  }

  async findById(id: string): Promise<Rescue | null> {
    const result = await this.pool.query<RescueRow>(
      `
        SELECT
          id,
          tenant_id,
          producer_id,
          offer_id,
          rescue_channel,
          destination_organization_name,
          product_name,
          category,
          unit,
          quantity_rescued,
          scheduled_at,
          beneficiary_count,
          municipality_name,
          notes,
          status,
          latitude,
          longitude,
          created_at
        FROM public.rescues
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Rescue>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<RescueRow>(
      `
        SELECT id, tenant_id, producer_id, offer_id, rescue_channel, destination_organization_name, product_name, category, unit, quantity_rescued, scheduled_at, beneficiary_count, municipality_name, notes, status, latitude, longitude, created_at
        FROM public.rescues
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: RescueRow) => this.mapRow(row)),
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

  private async resolveOfferId(offerId: string, tenantId: string, producerId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.offers
        WHERE id = $1
          AND tenant_id = $2
          AND producer_id = $3
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [offerId, tenantId, producerId]
    );

    if (!result.rows[0]) {
      throw new Error("OFFER_NOT_FOUND_FOR_PRODUCER");
    }

    return result.rows[0].id;
  }

  private mapRow(row: RescueRow): Rescue {
    return new Rescue({
      id: row.id,
      tenantId: row.tenant_id,
      producerId: row.producer_id,
      offerId: row.offer_id,
      rescueChannel: row.rescue_channel,
      destinationOrganizationName: row.destination_organization_name,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityRescued: Number(row.quantity_rescued),
      scheduledAt: row.scheduled_at,
      beneficiaryCount: row.beneficiary_count,
      municipalityName: row.municipality_name,
      notes: row.notes,
      status: row.status,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      createdAt: row.created_at
    });
  }
}