import type { Pool } from "pg";
import type {
  AnalyticsSummary,
  TerritorialOverviewItem
} from "../../domain/models/AnalyticsSummary.js";
import type { AnalyticsRepository } from "../../domain/ports/AnalyticsRepository.js";

interface SummaryRow {
  users: string;
  producers: string;
  offers: string;
  rescues: string;
  demands: string;
  inventory_items: string;
  logistics_orders: string;
  incidents: string;
  notifications: string;
  open_demands: string;
  scheduled_rescues: string;
  available_inventory_units: string;
  reserved_inventory_units: string;
  scheduled_logistics: string;
  open_incidents: string;
  pending_notifications: string;
}

interface TerritorialOverviewRow {
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
  producers: string;
  offers: string;
  open_demands: string;
  inventory_units: string;
  scheduled_logistics: string;
  open_incidents: string;
  pending_notifications: string;
}

interface TenantRow {
  id: string;
  code: string;
  name: string;
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async getSummary(tenantKey?: string | null): Promise<AnalyticsSummary> {
    const tenant = tenantKey ? await this.resolveTenant(tenantKey) : null;
    const tenantId = tenant?.id ?? null;

    const result = await this.pool.query<SummaryRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS users,
          (SELECT COUNT(*) FROM public.producers WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS producers,
          (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS offers,
          (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS rescues,
          (SELECT COUNT(*) FROM public.demands WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS demands,
          (SELECT COUNT(*) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS inventory_items,
          (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS logistics_orders,
          (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS incidents,
          (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS notifications,
          (SELECT COUNT(*) FROM public.demands WHERE deleted_at IS NULL AND status = 'open' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS open_demands,
          (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS scheduled_rescues,
          (SELECT COALESCE(SUM(quantity_on_hand - quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS available_inventory_units,
          (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS reserved_inventory_units,
          (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS scheduled_logistics,
          (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS open_incidents,
          (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS pending_notifications
      `,
      [tenantId]
    );

    const row = result.rows[0];

    return {
      tenantId,
      tenantCode: tenant?.code ?? null,
      tenantName: tenant?.name ?? null,
      totals: {
        users: Number(row.users),
        producers: Number(row.producers),
        offers: Number(row.offers),
        rescues: Number(row.rescues),
        demands: Number(row.demands),
        inventoryItems: Number(row.inventory_items),
        logisticsOrders: Number(row.logistics_orders),
        incidents: Number(row.incidents),
        notifications: Number(row.notifications)
      },
      operations: {
        openDemands: Number(row.open_demands),
        scheduledRescues: Number(row.scheduled_rescues),
        availableInventoryUnits: Number(row.available_inventory_units),
        reservedInventoryUnits: Number(row.reserved_inventory_units),
        scheduledLogistics: Number(row.scheduled_logistics),
        openIncidents: Number(row.open_incidents),
        pendingNotifications: Number(row.pending_notifications)
      },
      generatedAt: new Date().toISOString()
    };
  }

  async getTerritorialOverview(): Promise<TerritorialOverviewItem[]> {
    const result = await this.pool.query<TerritorialOverviewRow>(
      `
        WITH producer_counts AS (
          SELECT tenant_id, COUNT(*)::text AS producers
          FROM public.producers
          WHERE deleted_at IS NULL
          GROUP BY tenant_id
        ),
        offer_counts AS (
          SELECT tenant_id, COUNT(*)::text AS offers
          FROM public.offers
          WHERE deleted_at IS NULL
          GROUP BY tenant_id
        ),
        demand_counts AS (
          SELECT tenant_id, COUNT(*)::text AS open_demands
          FROM public.demands
          WHERE deleted_at IS NULL AND status = 'open'
          GROUP BY tenant_id
        ),
        inventory_counts AS (
          SELECT tenant_id, COALESCE(SUM(quantity_on_hand - quantity_reserved), 0)::text AS inventory_units
          FROM public.inventory_items
          WHERE deleted_at IS NULL
          GROUP BY tenant_id
        ),
        logistics_counts AS (
          SELECT tenant_id, COUNT(*)::text AS scheduled_logistics
          FROM public.logistics_orders
          WHERE deleted_at IS NULL AND status = 'scheduled'
          GROUP BY tenant_id
        ),
        incident_counts AS (
          SELECT tenant_id, COUNT(*)::text AS open_incidents
          FROM public.incidents
          WHERE deleted_at IS NULL AND status = 'open'
          GROUP BY tenant_id
        ),
        notification_counts AS (
          SELECT tenant_id, COUNT(*)::text AS pending_notifications
          FROM public.notifications
          WHERE deleted_at IS NULL AND status = 'pending'
          GROUP BY tenant_id
        )
        SELECT
          t.id AS tenant_id,
          t.code AS tenant_code,
          t.name AS tenant_name,
          COALESCE(pc.producers, '0') AS producers,
          COALESCE(oc.offers, '0') AS offers,
          COALESCE(dc.open_demands, '0') AS open_demands,
          COALESCE(ic.inventory_units, '0') AS inventory_units,
          COALESCE(lc.scheduled_logistics, '0') AS scheduled_logistics,
          COALESCE(nc.open_incidents, '0') AS open_incidents,
          COALESCE(fc.pending_notifications, '0') AS pending_notifications
        FROM public.tenants t
        LEFT JOIN producer_counts pc ON pc.tenant_id = t.id
        LEFT JOIN offer_counts oc ON oc.tenant_id = t.id
        LEFT JOIN demand_counts dc ON dc.tenant_id = t.id
        LEFT JOIN inventory_counts ic ON ic.tenant_id = t.id
        LEFT JOIN logistics_counts lc ON lc.tenant_id = t.id
        LEFT JOIN incident_counts nc ON nc.tenant_id = t.id
        LEFT JOIN notification_counts fc ON fc.tenant_id = t.id
        ORDER BY t.name ASC
      `
    );

    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      tenantCode: row.tenant_code,
      tenantName: row.tenant_name,
      producers: Number(row.producers),
      offers: Number(row.offers),
      openDemands: Number(row.open_demands),
      inventoryUnits: Number(row.inventory_units),
      scheduledLogistics: Number(row.scheduled_logistics),
      openIncidents: Number(row.open_incidents),
      pendingNotifications: Number(row.pending_notifications)
    }));
  }

  private async resolveTenant(tenantKey: string): Promise<TenantRow> {
    const result = await this.pool.query<TenantRow>(
      `
        SELECT id, code, name
        FROM public.tenants
        WHERE id::text = $1 OR UPPER(code) = UPPER($1)
        LIMIT 1
      `,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0];
  }
}