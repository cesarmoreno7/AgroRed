import type { Pool } from "pg";
import { InventoryItem } from "../../domain/entities/InventoryItem.js";
import type { InventoryItemRepository, PaginationParams, PaginatedResult } from "../../domain/ports/InventoryItemRepository.js";
import type { InventorySourceType } from "../../domain/value-objects/InventorySourceType.js";
import type { InventoryStatus } from "../../domain/value-objects/InventoryStatus.js";

interface InventoryItemRow {
  id: string;
  tenant_id: string;
  producer_id: string;
  offer_id: string | null;
  rescue_id: string | null;
  source_type: InventorySourceType;
  storage_location_name: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_on_hand: string;
  quantity_reserved: string;
  municipality_name: string;
  notes: string | null;
  expires_at: Date | null;
  status: InventoryStatus;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
}

export class PostgresInventoryItemRepository implements InventoryItemRepository {
  constructor(private readonly pool: Pool) {}

  async save(item: InventoryItem): Promise<void> {
    const tenantId = await this.resolveTenantId(item.tenantId);
    const producerId = await this.resolveProducerId(item.producerId, tenantId);
    const offerId = item.offerId ? await this.resolveOfferId(item.offerId, tenantId, producerId) : null;
    const rescueId = item.rescueId
      ? await this.resolveRescueId(item.rescueId, tenantId, producerId, offerId)
      : null;

    await this.pool.query(
      `
        INSERT INTO public.inventory_items (
          id,
          tenant_id,
          producer_id,
          offer_id,
          rescue_id,
          source_type,
          storage_location_name,
          product_name,
          category,
          unit,
          quantity_on_hand,
          quantity_reserved,
          municipality_name,
          notes,
          expires_at,
          status,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        item.id,
        tenantId,
        producerId,
        offerId,
        rescueId,
        item.sourceType,
        item.storageLocationName,
        item.productName,
        item.category,
        item.unit,
        item.quantityOnHand,
        item.quantityReserved,
        item.municipalityName,
        item.notes,
        item.expiresAt,
        item.status,
        item.latitude,
        item.longitude
      ]
    );
  }

  async findById(id: string): Promise<InventoryItem | null> {
    const result = await this.pool.query<InventoryItemRow>(
      `
        SELECT
          id,
          tenant_id,
          producer_id,
          offer_id,
          rescue_id,
          source_type,
          storage_location_name,
          product_name,
          category,
          unit,
          quantity_on_hand,
          quantity_reserved,
          municipality_name,
          notes,
          expires_at,
          status,
          latitude,
          longitude,
          created_at
        FROM public.inventory_items
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<InventoryItem>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<InventoryItemRow>(
      `
        SELECT id, tenant_id, producer_id, offer_id, rescue_id, source_type, storage_location_name, product_name, category, unit, quantity_on_hand, quantity_reserved, municipality_name, notes, expires_at, status, latitude, longitude, created_at
        FROM public.inventory_items
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: InventoryItemRow) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  async saveBatch(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of items) {
        await client.query(
          `INSERT INTO public.inventory_items
             (id, tenant_id, producer_id, offer_id, rescue_id, source_type,
              storage_location_name, product_name, category, unit,
              quantity_on_hand, quantity_reserved, municipality_name,
              notes, expires_at, status, latitude, longitude)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            item.id, item.tenantId, item.producerId,
            item.offerId, item.rescueId, item.sourceType,
            item.storageLocationName, item.productName, item.category, item.unit,
            item.quantityOnHand, item.quantityReserved, item.municipalityName,
            item.notes, item.expiresAt, item.status, item.latitude, item.longitude
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listNearExpiry(
    tenantId: string,
    daysAhead: number,
    params: PaginationParams
  ): Promise<PaginatedResult<InventoryItem>> {
    const resolvedTenant = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.inventory_items
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND status IN ('available','reserved')
         AND expires_at IS NOT NULL
         AND expires_at <= NOW() + ($2 || ' days')::INTERVAL
         AND expires_at >= NOW()`,
      [resolvedTenant, String(daysAhead)]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<InventoryItemRow>(
      `SELECT id, tenant_id, producer_id, offer_id, rescue_id, source_type,
              storage_location_name, product_name, category, unit,
              quantity_on_hand, quantity_reserved, municipality_name,
              notes, expires_at, status, latitude, longitude, created_at
       FROM public.inventory_items
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND status IN ('available','reserved')
         AND expires_at IS NOT NULL
         AND expires_at <= NOW() + ($2 || ' days')::INTERVAL
         AND expires_at >= NOW()
       ORDER BY expires_at ASC
       LIMIT $3 OFFSET $4`,
      [resolvedTenant, String(daysAhead), params.limit, offset]
    );

    return {
      data: result.rows.map((r: InventoryItemRow) => this.mapRow(r)),
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

  private async resolveRescueId(
    rescueId: string,
    tenantId: string,
    producerId: string,
    offerId: string | null
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.rescues
        WHERE id = $1
          AND tenant_id = $2
          AND producer_id = $3
          AND ($4::uuid IS NULL OR offer_id = $4)
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [rescueId, tenantId, producerId, offerId]
    );

    if (!result.rows[0]) {
      throw new Error("RESCUE_NOT_FOUND_FOR_SOURCE");
    }

    return result.rows[0].id;
  }

  private mapRow(row: InventoryItemRow): InventoryItem {
    return new InventoryItem({
      id: row.id,
      tenantId: row.tenant_id,
      producerId: row.producer_id,
      offerId: row.offer_id,
      rescueId: row.rescue_id,
      sourceType: row.source_type,
      storageLocationName: row.storage_location_name,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityOnHand: Number(row.quantity_on_hand),
      quantityReserved: Number(row.quantity_reserved),
      municipalityName: row.municipality_name,
      notes: row.notes,
      expiresAt: row.expires_at,
      status: row.status,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      createdAt: row.created_at
    });
  }
}