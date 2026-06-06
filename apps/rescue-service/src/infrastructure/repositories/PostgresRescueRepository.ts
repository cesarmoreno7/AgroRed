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
  origin_id: string | null;
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

interface FoodOriginRow {
  id: string;
  tenant_id: string;
  name: string;
  municipality_name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
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
      `INSERT INTO public.rescues (
          id, tenant_id, producer_id, offer_id, origin_id, rescue_channel,
          destination_organization_name, product_name, category, unit,
          quantity_rescued, scheduled_at, beneficiary_count, municipality_name,
          notes, status, latitude, longitude
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        rescue.id, tenantId, producerId, offerId, rescue.originId,
        rescue.rescueChannel, rescue.destinationOrganizationName,
        rescue.productName, rescue.category, rescue.unit,
        rescue.quantityRescued, rescue.scheduledAt, rescue.beneficiaryCount,
        rescue.municipalityName, rescue.notes, rescue.status,
        rescue.latitude, rescue.longitude
      ]
    );
  }

  async findById(id: string): Promise<Rescue | null> {
    const result = await this.pool.query<RescueRow>(
      `SELECT id, tenant_id, producer_id, offer_id, origin_id, rescue_channel,
              destination_organization_name, product_name, category, unit,
              quantity_rescued, scheduled_at, beneficiary_count, municipality_name,
              notes, status, latitude, longitude, created_at
       FROM public.rescues WHERE id = $1 AND deleted_at IS NULL`,
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
      `SELECT id, tenant_id, producer_id, offer_id, origin_id, rescue_channel,
              destination_organization_name, product_name, category, unit,
              quantity_rescued, scheduled_at, beneficiary_count, municipality_name,
              notes, status, latitude, longitude, created_at
       FROM public.rescues
       WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
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

  async patch(id: string, fields: Record<string, unknown>): Promise<Rescue | null> {
    const COLS: Record<string, string> = {
      rescueChannel: "rescue_channel", destinationOrganizationName: "destination_organization_name",
      productName: "product_name", category: "category", unit: "unit",
      quantityRescued: "quantity_rescued", scheduledAt: "scheduled_at",
      beneficiaryCount: "beneficiary_count", municipalityName: "municipality_name",
      notes: "notes", status: "status", latitude: "latitude", longitude: "longitude",
      originId: "origin_id",
    };
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (COLS[k] !== undefined) { sets.push(`${COLS[k]} = $${i++}`); vals.push(v ?? null); }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = NOW()`); vals.push(id);
    await this.pool.query(`UPDATE public.rescues SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL`, vals);
    return this.findById(id);
  }

  // ── Food Origins CRUD ───────────────────────────────────────

  async saveOrigin(origin: { tenantId: string; name: string; municipalityName: string; address?: string | null; latitude?: number | null; longitude?: number | null }): Promise<{ id: string; tenantId: string; name: string; municipalityName: string; address: string | null; latitude: number | null; longitude: number | null; isActive: boolean; createdAt: Date }> {
    const tenantId = await this.resolveTenantId(origin.tenantId);
    const result = await this.pool.query<FoodOriginRow>(
      `INSERT INTO public.food_origins (tenant_id, name, municipality_name, address, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, tenant_id, name, municipality_name, address, latitude, longitude, is_active, created_at`,
      [tenantId, origin.name, origin.municipalityName, origin.address ?? null, origin.latitude ?? null, origin.longitude ?? null]
    );
    return this.mapOriginRow(result.rows[0]);
  }

  async listOrigins(_tenantId?: string): Promise<ReturnType<PostgresRescueRepository["mapOriginRow"]>[]> {
    // Los orígenes son recursos compartidos entre todos los tenants
    const result = await this.pool.query<FoodOriginRow>(
      `SELECT id, tenant_id, name, municipality_name, address, latitude, longitude, is_active, created_at
       FROM public.food_origins WHERE deleted_at IS NULL ORDER BY name ASC`
    );
    return result.rows.map(r => this.mapOriginRow(r));
  }

  async updateOrigin(id: string, fields: { name?: string; municipalityName?: string; address?: string | null; latitude?: number | null; longitude?: number | null; isActive?: boolean }): Promise<ReturnType<PostgresRescueRepository["mapOriginRow"]> | null> {
    const COLS: Record<string, string> = {
      name: "name", municipalityName: "municipality_name", address: "address",
      latitude: "latitude", longitude: "longitude", isActive: "is_active",
    };
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (COLS[k] !== undefined) { sets.push(`${COLS[k]} = $${i++}`); vals.push(v ?? null); }
    }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`); vals.push(id);
    await this.pool.query(`UPDATE public.food_origins SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL`, vals);
    const result = await this.pool.query<FoodOriginRow>(
      `SELECT id, tenant_id, name, municipality_name, address, latitude, longitude, is_active, created_at FROM public.food_origins WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapOriginRow(result.rows[0]) : null;
  }

  async deleteOrigin(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.food_origins SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapOriginRow(row: FoodOriginRow) {
    return {
      id:               row.id,
      tenantId:         row.tenant_id,
      name:             row.name,
      municipalityName: row.municipality_name,
      address:          row.address,
      latitude:         row.latitude !== null ? Number(row.latitude) : null,
      longitude:        row.longitude !== null ? Number(row.longitude) : null,
      isActive:         row.is_active,
      createdAt:        row.created_at,
    };
  }

  private mapRow(row: RescueRow): Rescue {
    return new Rescue({
      id: row.id,
      tenantId: row.tenant_id,
      producerId: row.producer_id,
      offerId: row.offer_id,
      originId: row.origin_id,
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