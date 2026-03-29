import type { Pool } from "pg";
import { LogisticsOrder } from "../../domain/entities/LogisticsOrder.js";
import type { LogisticsOrderRepository, PaginationParams, PaginatedResult } from "../../domain/ports/LogisticsOrderRepository.js";
import type { RouteMode } from "../../domain/value-objects/RouteMode.js";
import type { LogisticsStatus } from "../../domain/value-objects/LogisticsStatus.js";

interface LogisticsOrderRow {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  demand_id: string | null;
  route_mode: RouteMode;
  origin_location_name: string;
  destination_organization_name: string;
  destination_address: string;
  scheduled_pickup_at: Date;
  scheduled_delivery_at: Date;
  quantity_assigned: string;
  municipality_name: string;
  notes: string | null;
  status: LogisticsStatus;
  origin_latitude: string | null;
  origin_longitude: string | null;
  destination_latitude: string | null;
  destination_longitude: string | null;
  created_at: Date;
}

export class PostgresLogisticsOrderRepository implements LogisticsOrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: LogisticsOrder): Promise<void> {
    const tenantId = await this.resolveTenantId(order.tenantId);
    const inventoryItemId = await this.resolveInventoryItem(order.inventoryItemId, tenantId, order.quantityAssigned);
    const demandId = order.demandId ? await this.resolveDemandId(order.demandId, tenantId) : null;

    await this.pool.query(
      `
        INSERT INTO public.logistics_orders (
          id,
          tenant_id,
          inventory_item_id,
          demand_id,
          route_mode,
          origin_location_name,
          destination_organization_name,
          destination_address,
          scheduled_pickup_at,
          scheduled_delivery_at,
          quantity_assigned,
          municipality_name,
          notes,
          status,
          origin_latitude,
          origin_longitude,
          destination_latitude,
          destination_longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        order.id,
        tenantId,
        inventoryItemId,
        demandId,
        order.routeMode,
        order.originLocationName,
        order.destinationOrganizationName,
        order.destinationAddress,
        order.scheduledPickupAt,
        order.scheduledDeliveryAt,
        order.quantityAssigned,
        order.municipalityName,
        order.notes,
        order.status,
        order.originLatitude,
        order.originLongitude,
        order.destinationLatitude,
        order.destinationLongitude
      ]
    );
  }

  async findById(id: string): Promise<LogisticsOrder | null> {
    const result = await this.pool.query<LogisticsOrderRow>(
      `
        SELECT
          id,
          tenant_id,
          inventory_item_id,
          demand_id,
          route_mode,
          origin_location_name,
          destination_organization_name,
          destination_address,
          scheduled_pickup_at,
          scheduled_delivery_at,
          quantity_assigned,
          municipality_name,
          notes,
          status,
          origin_latitude,
          origin_longitude,
          destination_latitude,
          destination_longitude,
          created_at
        FROM public.logistics_orders
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<LogisticsOrder>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<LogisticsOrderRow>(
      `
        SELECT id, tenant_id, offer_id, demand_id, rescue_id, origin_name, destination_name, cargo_description, weight_kg, transport_mode, scheduled_date, municipality_name, notes, status, latitude, longitude, created_at
        FROM public.logistics_orders
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: LogisticsOrderRow) => this.mapRow(row)),
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

  private async resolveInventoryItem(
    inventoryItemId: string,
    tenantId: string,
    quantityAssigned: number
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.inventory_items
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
          AND (quantity_on_hand - quantity_reserved) >= $3
        LIMIT 1
      `,
      [inventoryItemId, tenantId, quantityAssigned]
    );

    if (result.rows[0]) {
      return result.rows[0].id;
    }

    const existence = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.inventory_items
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [inventoryItemId, tenantId]
    );

    if (!existence.rows[0]) {
      throw new Error("INVENTORY_ITEM_NOT_FOUND_FOR_TENANT");
    }

    throw new Error("INSUFFICIENT_INVENTORY_AVAILABLE");
  }

  private async resolveDemandId(demandId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.demands
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [demandId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("DEMAND_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private mapRow(row: LogisticsOrderRow): LogisticsOrder {
    return new LogisticsOrder({
      id: row.id,
      tenantId: row.tenant_id,
      inventoryItemId: row.inventory_item_id,
      demandId: row.demand_id,
      routeMode: row.route_mode,
      originLocationName: row.origin_location_name,
      destinationOrganizationName: row.destination_organization_name,
      destinationAddress: row.destination_address,
      scheduledPickupAt: row.scheduled_pickup_at,
      scheduledDeliveryAt: row.scheduled_delivery_at,
      quantityAssigned: Number(row.quantity_assigned),
      municipalityName: row.municipality_name,
      notes: row.notes,
      status: row.status,
      originLatitude: row.origin_latitude !== null ? Number(row.origin_latitude) : null,
      originLongitude: row.origin_longitude !== null ? Number(row.origin_longitude) : null,
      destinationLatitude: row.destination_latitude !== null ? Number(row.destination_latitude) : null,
      destinationLongitude: row.destination_longitude !== null ? Number(row.destination_longitude) : null,
      createdAt: row.created_at
    });
  }
}