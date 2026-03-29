import { randomUUID } from "node:crypto";
import { RouteStop } from "../../domain/entities/RouteStop.js";
import type { RoutePlanRepository } from "../../domain/ports/RoutePlanRepository.js";
import type { StopType } from "../../domain/value-objects/RoutePlanTypes.js";

export interface AddRouteStopCommand {
  routePlanId: string;
  stopType: StopType;
  locationName: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  logisticsOrderId?: string | null;
  estimatedArrival?: string | null;
  estimatedDeparture?: string | null;
  loadKg?: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export class AddRouteStop {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(command: AddRouteStopCommand): Promise<RouteStop> {
    const plan = await this.repository.findPlanById(command.routePlanId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    if (plan.status !== "draft" && plan.status !== "optimized") {
      throw new Error("PLAN_NOT_EDITABLE");
    }

    // Capacity validation
    const existingStops = await this.repository.listStopsByPlan(command.routePlanId);
    const currentLoad = existingStops.reduce((acc, s) => acc + s.loadKg, 0);
    const newLoad = command.loadKg ?? 0;
    if (plan.maxCapacityKg > 0 && currentLoad + newLoad > plan.maxCapacityKg) {
      throw new Error("CAPACITY_EXCEEDED");
    }

    const nextOrder = existingStops.length + 1;

    const stop = new RouteStop({
      id: randomUUID(),
      routePlanId: command.routePlanId,
      stopOrder: nextOrder,
      stopType: command.stopType,
      locationName: command.locationName,
      address: command.address ?? null,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      logisticsOrderId: command.logisticsOrderId ?? null,
      estimatedArrival: command.estimatedArrival ? new Date(command.estimatedArrival) : null,
      actualArrival: null,
      estimatedDeparture: command.estimatedDeparture ? new Date(command.estimatedDeparture) : null,
      actualDeparture: null,
      loadKg: command.loadKg ?? 0,
      status: "pending",
      notes: command.notes ?? null,
      metadata: command.metadata ?? {},
    });

    await this.repository.saveStop(stop);

    // Update plan totals
    const totalLoadKg = currentLoad + stop.loadKg;
    await this.repository.updatePlanTotals(command.routePlanId, {
      totalStops: nextOrder,
      totalDistanceKm: plan.totalDistanceKm,
      estimatedDurationMin: plan.estimatedDurationMin,
      totalLoadKg: totalLoadKg,
      optimizationScore: plan.optimizationScore,
    });

    return stop;
  }
}
