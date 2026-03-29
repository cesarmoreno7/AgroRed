import type { Pool } from "pg";
import type {
  MlClassification,
  MlDecisionInputs,
  MlDecisionScores,
  MlDecisionSupportReport
} from "../../domain/models/DecisionSupport.js";
import type { DecisionSupportRepository } from "../../domain/ports/DecisionSupportRepository.js";

interface SummaryRow {
  active_offers: string;
  open_demand_units: string;
  available_inventory_units: string;
  reserved_inventory_units: string;
  scheduled_rescues: string;
  scheduled_logistics: string;
  open_incidents: string;
  pending_notifications: string;
}

interface TenantRow {
  id: string;
  code: string;
  name: string;
}

const MODEL_VERSION = "heuristic-v1";

export class PostgresDecisionSupportRepository implements DecisionSupportRepository {
  constructor(private readonly pool: Pool) {}

  async getDecisionSupport(tenantKey?: string | null): Promise<MlDecisionSupportReport> {
    const tenant = tenantKey ? await this.resolveTenant(tenantKey) : null;
    const tenantId = tenant?.id ?? null;

    const result = await this.pool.query<SummaryRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND status = 'published' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS active_offers,
          (SELECT COALESCE(SUM(quantity_required), 0) FROM public.demands WHERE deleted_at IS NULL AND status = 'open' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS open_demand_units,
          (SELECT COALESCE(SUM(GREATEST(quantity_on_hand - quantity_reserved, 0)), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS available_inventory_units,
          (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1))::text AS reserved_inventory_units,
          (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS scheduled_rescues,
          (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS scheduled_logistics,
          (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS open_incidents,
          (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending' AND ($1::uuid IS NULL OR tenant_id = $1))::text AS pending_notifications
      `,
      [tenantId]
    );

    const row = result.rows[0];
    const inputs: MlDecisionInputs = {
      activeOffers: Number(row.active_offers),
      openDemandUnits: Number(row.open_demand_units),
      availableInventoryUnits: Number(row.available_inventory_units),
      reservedInventoryUnits: Number(row.reserved_inventory_units),
      scheduledRescues: Number(row.scheduled_rescues),
      scheduledLogistics: Number(row.scheduled_logistics),
      openIncidents: Number(row.open_incidents),
      pendingNotifications: Number(row.pending_notifications)
    };
    const scores = this.computeScores(inputs);

    return {
      tenantId,
      tenantCode: tenant?.code ?? null,
      tenantName: tenant?.name ?? null,
      modelVersion: MODEL_VERSION,
      classification: this.resolveClassification(scores.readinessScore),
      inputs,
      scores,
      generatedAt: new Date().toISOString()
    };
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

  private computeScores(inputs: MlDecisionInputs): MlDecisionScores {
    const supplyCoverageRatio = inputs.openDemandUnits > 0
      ? inputs.availableInventoryUnits / inputs.openDemandUnits
      : 1;
    const supplyCoverageScore = this.clamp(Math.round((Math.min(supplyCoverageRatio, 1.5) / 1.5) * 100));
    const incidentPressureScore = this.clamp(inputs.openIncidents * 25 + inputs.pendingNotifications * 10);
    const logisticsStabilityScore = this.clamp(
      35
        + inputs.scheduledLogistics * 25
        + inputs.scheduledRescues * 10
        + (inputs.reservedInventoryUnits > 0 ? 5 : 0)
        - inputs.openIncidents * 15
        - inputs.pendingNotifications * 5
    );
    const readinessScore = this.clamp(
      Math.round(supplyCoverageScore * 0.45 + logisticsStabilityScore * 0.35 + (100 - incidentPressureScore) * 0.2)
    );

    return {
      supplyCoverageScore,
      logisticsStabilityScore,
      incidentPressureScore,
      readinessScore
    };
  }

  private resolveClassification(readinessScore: number): MlClassification {
    if (readinessScore >= 70) {
      return "stable";
    }

    if (readinessScore >= 45) {
      return "watch";
    }

    return "critical";
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}