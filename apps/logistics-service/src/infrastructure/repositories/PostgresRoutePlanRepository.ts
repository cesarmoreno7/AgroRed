import type { Pool } from "pg";
import { RoutePlan } from "../../domain/entities/RoutePlan.js";
import { RouteStop } from "../../domain/entities/RouteStop.js";
import type {
  RoutePlanRepository,
  PaginationParams,
  PaginatedResult,
  RoutePlanWithStops,
  ActiveRouteView,
  RoutePerformanceMetrics,
} from "../../domain/ports/RoutePlanRepository.js";
import type { PlanStatus, StopStatus } from "../../domain/value-objects/RoutePlanTypes.js";

function toPlan(row: Record<string, unknown>): RoutePlan {
  return new RoutePlan({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    planName: row.plan_name as string,
    planType: row.plan_type as RoutePlan["planType"],
    recursoId: (row.recurso_id as string) ?? null,
    totalStops: Number(row.total_stops ?? 0),
    totalDistanceKm: Number(row.total_distance_km ?? 0),
    estimatedDurationMin: Number(row.estimated_duration_min ?? 0),
    totalLoadKg: Number(row.total_load_kg ?? 0),
    maxCapacityKg: Number(row.max_capacity_kg ?? 0),
    windowStart: row.window_start ? new Date(row.window_start as string) : null,
    windowEnd: row.window_end ? new Date(row.window_end as string) : null,
    status: row.status as RoutePlan["status"],
    optimizationScore: row.optimization_score !== null && row.optimization_score !== undefined
      ? Number(row.optimization_score) : null,
    notes: (row.notes as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  });
}

function toStop(row: Record<string, unknown>): RouteStop {
  return new RouteStop({
    id: row.id as string,
    routePlanId: row.route_plan_id as string,
    stopOrder: Number(row.stop_order),
    stopType: row.stop_type as RouteStop["stopType"],
    locationName: row.location_name as string,
    address: (row.address as string) ?? null,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    logisticsOrderId: (row.logistics_order_id as string) ?? null,
    estimatedArrival: row.estimated_arrival ? new Date(row.estimated_arrival as string) : null,
    actualArrival: row.actual_arrival ? new Date(row.actual_arrival as string) : null,
    estimatedDeparture: row.estimated_departure ? new Date(row.estimated_departure as string) : null,
    actualDeparture: row.actual_departure ? new Date(row.actual_departure as string) : null,
    loadKg: Number(row.load_kg ?? 0),
    status: row.status as RouteStop["status"],
    notes: (row.notes as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  });
}

export class PostgresRoutePlanRepository implements RoutePlanRepository {
  constructor(private readonly pool: Pool) {}

  async savePlan(plan: RoutePlan): Promise<void> {
    await this.pool.query(
      `INSERT INTO route_plans
        (id, tenant_id, plan_name, plan_type, recurso_id,
         total_stops, total_distance_km, estimated_duration_min,
         total_load_kg, max_capacity_kg, window_start, window_end,
         status, optimization_score, notes, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        plan.id, plan.tenantId, plan.planName, plan.planType, plan.recursoId,
        plan.totalStops, plan.totalDistanceKm, plan.estimatedDurationMin,
        plan.totalLoadKg, plan.maxCapacityKg, plan.windowStart, plan.windowEnd,
        plan.status, plan.optimizationScore, plan.notes,
        JSON.stringify(plan.metadata), plan.createdAt, plan.updatedAt,
      ]
    );
  }

  async findPlanById(id: string): Promise<RoutePlan | null> {
    const { rows } = await this.pool.query("SELECT * FROM route_plans WHERE id = $1", [id]);
    return rows.length ? toPlan(rows[0]) : null;
  }

  async findPlanWithStops(id: string): Promise<RoutePlanWithStops | null> {
    const plan = await this.findPlanById(id);
    if (!plan) return null;
    const stops = await this.listStopsByPlan(id);
    return { plan, stops };
  }

  async listPlans(tenantId: string, params: PaginationParams): Promise<PaginatedResult<RoutePlan>> {
    const offset = (params.page - 1) * params.limit;
    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        "SELECT * FROM route_plans WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [tenantId, params.limit, offset]
      ),
      this.pool.query(
        "SELECT COUNT(*)::int AS total FROM route_plans WHERE tenant_id = $1",
        [tenantId]
      ),
    ]);
    return {
      data: dataResult.rows.map(toPlan),
      total: countResult.rows[0].total,
      page: params.page,
      limit: params.limit,
    };
  }

  async updatePlanStatus(id: string, status: PlanStatus): Promise<void> {
    await this.pool.query(
      "UPDATE route_plans SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id]
    );
  }

  async updatePlanTotals(
    id: string,
    totals: {
      totalStops: number;
      totalDistanceKm: number;
      estimatedDurationMin: number;
      totalLoadKg: number;
      optimizationScore: number | null;
    }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE route_plans
       SET total_stops = $1, total_distance_km = $2, estimated_duration_min = $3,
           total_load_kg = $4, optimization_score = $5, updated_at = NOW()
       WHERE id = $6`,
      [
        totals.totalStops, totals.totalDistanceKm, totals.estimatedDurationMin,
        totals.totalLoadKg, totals.optimizationScore, id,
      ]
    );
  }

  // ── Stops ──

  async saveStop(stop: RouteStop): Promise<void> {
    await this.pool.query(
      `INSERT INTO route_stops
        (id, route_plan_id, stop_order, stop_type, location_name, address,
         latitude, longitude, logistics_order_id,
         estimated_arrival, actual_arrival, estimated_departure, actual_departure,
         load_kg, status, notes, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        stop.id, stop.routePlanId, stop.stopOrder, stop.stopType,
        stop.locationName, stop.address, stop.latitude, stop.longitude,
        stop.logisticsOrderId, stop.estimatedArrival, stop.actualArrival,
        stop.estimatedDeparture, stop.actualDeparture, stop.loadKg,
        stop.status, stop.notes, JSON.stringify(stop.metadata), stop.createdAt,
      ]
    );
  }

  async findStopById(id: string): Promise<RouteStop | null> {
    const { rows } = await this.pool.query("SELECT * FROM route_stops WHERE id = $1", [id]);
    return rows.length ? toStop(rows[0]) : null;
  }

  async listStopsByPlan(routePlanId: string): Promise<RouteStop[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM route_stops WHERE route_plan_id = $1 ORDER BY stop_order ASC",
      [routePlanId]
    );
    return rows.map(toStop);
  }

  async updateStopStatus(
    id: string,
    status: StopStatus,
    actualArrival?: Date,
    actualDeparture?: Date
  ): Promise<void> {
    const sets = ["status = $1"];
    const params: unknown[] = [status];
    let idx = 2;

    if (actualArrival !== undefined) {
      sets.push(`actual_arrival = $${idx}`);
      params.push(actualArrival);
      idx++;
    }
    if (actualDeparture !== undefined) {
      sets.push(`actual_departure = $${idx}`);
      params.push(actualDeparture);
      idx++;
    }

    params.push(id);
    await this.pool.query(
      `UPDATE route_stops SET ${sets.join(", ")} WHERE id = $${idx}`,
      params
    );
  }

  async deleteStop(id: string): Promise<void> {
    await this.pool.query("DELETE FROM route_stops WHERE id = $1", [id]);
  }

  async reorderStops(routePlanId: string, stopIds: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < stopIds.length; i++) {
        await client.query(
          "UPDATE route_stops SET stop_order = $1 WHERE id = $2 AND route_plan_id = $3",
          [i + 1, stopIds[i], routePlanId]
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

  async getActiveRoutes(tenantId: string): Promise<ActiveRouteView[]> {
    const { rows } = await this.pool.query(
      `SELECT
         rp.id AS plan_id, rp.plan_name, rp.plan_type, rp.status,
         rp.total_stops, rp.total_distance_km, rp.total_load_kg,
         rp.max_capacity_kg, rp.estimated_duration_min, rp.optimization_score,
         rp.recurso_id,
         COALESCE(SUM(CASE WHEN rs.status = 'completed' THEN 1 ELSE 0 END), 0)::int AS completed_stops,
         COALESCE(SUM(CASE WHEN rs.status IN ('pending','arrived') THEN 1 ELSE 0 END), 0)::int AS pending_stops,
         CASE WHEN rp.max_capacity_kg > 0
              THEN ROUND((rp.total_load_kg / rp.max_capacity_kg * 100)::numeric, 1)
              ELSE 0 END AS load_percentage
       FROM route_plans rp
       LEFT JOIN route_stops rs ON rs.route_plan_id = rp.id
       WHERE rp.tenant_id = $1 AND rp.status IN ('in_progress','optimized')
       GROUP BY rp.id
       ORDER BY rp.created_at DESC
       LIMIT 50`,
      [tenantId]
    );
    return rows.map((r) => ({
      planId: r.plan_id as string,
      planName: r.plan_name as string,
      planType: r.plan_type as string,
      status: r.status as string,
      totalStops: Number(r.total_stops),
      completedStops: Number(r.completed_stops),
      pendingStops: Number(r.pending_stops),
      totalDistanceKm: Number(r.total_distance_km),
      totalLoadKg: Number(r.total_load_kg),
      maxCapacityKg: Number(r.max_capacity_kg),
      loadPercentage: Number(r.load_percentage),
      estimatedDurationMin: Number(r.estimated_duration_min),
      optimizationScore: r.optimization_score !== null ? Number(r.optimization_score) : null,
      recursoId: (r.recurso_id as string) ?? null,
    }));
  }

  async getPerformanceMetrics(tenantId: string): Promise<RoutePerformanceMetrics> {
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*)::int AS total_plans,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::int AS completed_plans,
         COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0)::int AS in_progress_plans,
         ROUND(COALESCE(AVG(optimization_score) FILTER (WHERE optimization_score IS NOT NULL), 0)::numeric, 2) AS avg_optimization_score,
         ROUND(COALESCE(AVG(total_distance_km) FILTER (WHERE total_distance_km > 0), 0)::numeric, 2) AS avg_distance_km,
         ROUND(COALESCE(AVG(
           CASE WHEN max_capacity_kg > 0 THEN total_load_kg / max_capacity_kg * 100 ELSE 0 END
         ), 0)::numeric, 2) AS avg_load_utilization,
         COALESCE(SUM(total_load_kg) FILTER (WHERE status = 'completed'), 0) AS total_delivered_kg,
         ROUND(COALESCE(AVG(total_stops) FILTER (WHERE total_stops > 0), 0)::numeric, 1) AS avg_stops_per_route
       FROM route_plans
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = rows[0];
    return {
      totalPlans: Number(r.total_plans),
      completedPlans: Number(r.completed_plans),
      inProgressPlans: Number(r.in_progress_plans),
      avgOptimizationScore: Number(r.avg_optimization_score),
      avgDistanceKm: Number(r.avg_distance_km),
      avgLoadUtilization: Number(r.avg_load_utilization),
      totalDeliveredKg: Number(r.total_delivered_kg),
      avgStopsPerRoute: Number(r.avg_stops_per_route),
    };
  }
}
