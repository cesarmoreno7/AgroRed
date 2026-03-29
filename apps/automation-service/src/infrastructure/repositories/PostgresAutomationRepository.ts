import type { Pool } from "pg";
import type {
  AutomationAction,
  AutomationMetricsInputs,
  AutomationMetricsScores,
  AutomationMetricsSnapshot,
  AutomationRun
} from "../../domain/entities/AutomationRun.js";
import { AutomationRun as AutomationRunEntity } from "../../domain/entities/AutomationRun.js";
import type {
  AutomationPlanningQuery,
  AutomationPlanningResult,
  AutomationRepository,
  PaginationParams,
  PaginatedResult
} from "../../domain/ports/AutomationRepository.js";
import type { AutomationClassification } from "../../domain/value-objects/AutomationClassification.js";
import type { AutomationRunStatus } from "../../domain/value-objects/AutomationRunStatus.js";
import type { AutomationTriggerSource } from "../../domain/value-objects/AutomationTriggerSource.js";

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

interface AutomationRunRow {
  id: string;
  tenant_id: string;
  incident_id: string | null;
  logistics_order_id: string | null;
  trigger_source: AutomationTriggerSource;
  model_version: string;
  classification: AutomationClassification;
  status: AutomationRunStatus;
  actions: AutomationAction[] | string;
  metrics_snapshot: AutomationMetricsSnapshot | string;
  notes: string | null;
  created_at: Date;
}

interface TenantRow {
  id: string;
}

const MODEL_VERSION = "heuristic-v1";

export class PostgresAutomationRepository implements AutomationRepository {
  constructor(private readonly pool: Pool) {}

  async planExecution(query: AutomationPlanningQuery): Promise<AutomationPlanningResult> {
    const tenant = await this.resolveTenant(query.tenantKey);
    const incidentId = query.incidentId
      ? await this.resolveIncidentId(query.incidentId, tenant.id)
      : null;
    const logisticsOrderId = query.logisticsOrderId
      ? await this.resolveLogisticsOrderId(query.logisticsOrderId, tenant.id)
      : null;
    const metricsSnapshot = await this.buildMetricsSnapshot(tenant.id);
    const actions = this.buildActions(metricsSnapshot, incidentId, logisticsOrderId);

    return {
      tenantId: tenant.id,
      incidentId,
      logisticsOrderId,
      modelVersion: MODEL_VERSION,
      classification: this.resolveClassification(metricsSnapshot.scores.readinessScore),
      actions,
      metricsSnapshot
    };
  }

  async save(run: AutomationRun): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO public.automation_runs (
          id,
          tenant_id,
          incident_id,
          logistics_order_id,
          trigger_source,
          model_version,
          classification,
          status,
          actions,
          metrics_snapshot,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      `,
      [
        run.id,
        run.tenantId,
        run.incidentId,
        run.logisticsOrderId,
        run.triggerSource,
        run.modelVersion,
        run.classification,
        run.status,
        JSON.stringify(run.actions),
        JSON.stringify(run.metricsSnapshot),
        run.notes
      ]
    );
  }

  async update(run: AutomationRun): Promise<void> {
    await this.pool.query(
      `
        UPDATE public.automation_runs
        SET
          status = $1,
          notes = $2
        WHERE id = $3
      `,
      [
        run.status,
        run.notes,
        run.id
      ]
    );
  }

  async findById(id: string): Promise<AutomationRun | null> {
    const result = await this.pool.query<AutomationRunRow>(
      `
        SELECT
          id,
          tenant_id,
          incident_id,
          logistics_order_id,
          trigger_source,
          model_version,
          classification,
          status,
          actions,
          metrics_snapshot,
          notes,
          created_at
        FROM public.automation_runs
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantKey?: string | null): Promise<PaginatedResult<AutomationRun>> {
    const tenantId = tenantKey ? (await this.resolveTenant(tenantKey)).id : null;
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `
        SELECT COUNT(*)
        FROM public.automation_runs
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
      `,
      [tenantId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<AutomationRunRow>(
      `
        SELECT
          id, tenant_id, incident_id, logistics_order_id, trigger_source,
          model_version, classification, status, actions, metrics_snapshot,
          notes, created_at
        FROM public.automation_runs
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId, params.limit, offset]
    );

    return {
      data: result.rows.map((row) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  private async resolveTenant(tenantKey: string): Promise<TenantRow> {
    const result = await this.pool.query<TenantRow>(
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

    return result.rows[0];
  }

  private async resolveIncidentId(incidentId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.incidents
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [incidentId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("INCIDENT_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private async resolveLogisticsOrderId(logisticsOrderId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.logistics_orders
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [logisticsOrderId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private async buildMetricsSnapshot(tenantId: string): Promise<AutomationMetricsSnapshot> {
    const result = await this.pool.query<SummaryRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND status = 'published' AND tenant_id = $1)::text AS active_offers,
          (SELECT COALESCE(SUM(quantity_required), 0) FROM public.demands WHERE deleted_at IS NULL AND status = 'open' AND tenant_id = $1)::text AS open_demand_units,
          (SELECT COALESCE(SUM(GREATEST(quantity_on_hand - quantity_reserved, 0)), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND tenant_id = $1)::text AS available_inventory_units,
          (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND tenant_id = $1)::text AS reserved_inventory_units,
          (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled' AND tenant_id = $1)::text AS scheduled_rescues,
          (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled' AND tenant_id = $1)::text AS scheduled_logistics,
          (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open' AND tenant_id = $1)::text AS open_incidents,
          (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending' AND tenant_id = $1)::text AS pending_notifications
      `,
      [tenantId]
    );

    const row = result.rows[0];
    const inputs: AutomationMetricsInputs = {
      activeOffers: Number(row.active_offers),
      openDemandUnits: Number(row.open_demand_units),
      availableInventoryUnits: Number(row.available_inventory_units),
      reservedInventoryUnits: Number(row.reserved_inventory_units),
      scheduledRescues: Number(row.scheduled_rescues),
      scheduledLogistics: Number(row.scheduled_logistics),
      openIncidents: Number(row.open_incidents),
      pendingNotifications: Number(row.pending_notifications)
    };

    return {
      inputs,
      scores: this.computeScores(inputs)
    };
  }

  private buildActions(
    snapshot: AutomationMetricsSnapshot,
    incidentId: string | null,
    logisticsOrderId: string | null
  ): AutomationAction[] {
    const actions: AutomationAction[] = [];
    const { inputs, scores } = snapshot;

    if (scores.supplyCoverageScore < 50) {
      actions.push({
        priority: "high",
        actionCode: "activate_supply",
        title: "Activar oferta complementaria",
        rationale: "La cobertura actual de inventario no alcanza la demanda abierta del territorio."
      });
    }

    if (inputs.scheduledLogistics === 0 && inputs.openDemandUnits > 0) {
      actions.push({
        priority: "high",
        actionCode: "schedule_logistics",
        title: "Programar operacion logistica",
        rationale: "Hay demanda abierta sin operaciones logisticas programadas para atenderla."
      });
    }

    if (inputs.openIncidents > 0 || incidentId) {
      actions.push({
        priority: scores.readinessScore < 45 ? "high" : "medium",
        actionCode: "stabilize_operations",
        title: "Estabilizar operacion territorial",
        rationale: "Existen incidencias o alertas de continuidad que requieren coordinacion inmediata."
      });
    }

    if (inputs.pendingNotifications > 0) {
      actions.push({
        priority: "medium",
        actionCode: "dispatch_notifications",
        title: "Despachar notificaciones pendientes",
        rationale: "Persisten alertas pendientes hacia actores claves del flujo operativo."
      });
    }

    if (inputs.reservedInventoryUnits > inputs.availableInventoryUnits) {
      actions.push({
        priority: "medium",
        actionCode: "rebalance_inventory",
        title: "Rebalancear inventario",
        rationale: "El inventario reservado supera el disponible y puede afectar el cumplimiento de entregas."
      });
    }

    if (logisticsOrderId && !actions.some((action) => action.actionCode === "schedule_logistics")) {
      actions.push({
        priority: "medium",
        actionCode: "follow_logistics_execution",
        title: "Dar seguimiento a la operacion logistica",
        rationale: "La corrida fue disparada sobre una operacion logistica y requiere monitoreo hasta cierre."
      });
    }

    if (actions.length === 0) {
      actions.push({
        priority: "low",
        actionCode: "maintain_monitoring",
        title: "Mantener monitoreo operativo",
        rationale: "Los indicadores actuales no muestran tension critica; conviene sostener seguimiento preventivo."
      });
    }

    return actions;
  }

  private computeScores(inputs: AutomationMetricsInputs): AutomationMetricsScores {
    const supplyCoverageRatio = inputs.openDemandUnits > 0 ? inputs.availableInventoryUnits / inputs.openDemandUnits : 1;
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

  private resolveClassification(readinessScore: number): AutomationClassification {
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

  private mapRow(row: AutomationRunRow): AutomationRun {
    return new AutomationRunEntity({
      id: row.id,
      tenantId: row.tenant_id,
      incidentId: row.incident_id,
      logisticsOrderId: row.logistics_order_id,
      triggerSource: row.trigger_source,
      modelVersion: row.model_version,
      classification: row.classification,
      status: row.status,
      actions: this.parseJson<AutomationAction[]>(row.actions),
      metricsSnapshot: this.parseJson<AutomationMetricsSnapshot>(row.metrics_snapshot),
      notes: row.notes,
      createdAt: row.created_at
    });
  }

  private parseJson<T>(value: T | string): T {
    if (typeof value === "string") {
      return JSON.parse(value) as T;
    }

    return value;
  }
}