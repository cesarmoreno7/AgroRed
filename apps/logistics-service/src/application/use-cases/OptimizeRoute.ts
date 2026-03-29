import type { RoutePlanRepository, RoutePlanWithStops } from "../../domain/ports/RoutePlanRepository.js";
import type { RoadRoutingService } from "../../domain/ports/RoadRoutingService.js";
import type { RouteStop } from "../../domain/entities/RouteStop.js";

export interface OptimizeRouteResult extends RoutePlanWithStops {
  warnings: string[];
  /** Which routing engine was used */
  routingEngine: "osrm" | "haversine";
  /** Encoded polyline for map rendering (only when OSRM available) */
  geometry: string | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class OptimizeRoute {
  private readonly roadRouting: RoadRoutingService | null;

  constructor(
    private readonly repository: RoutePlanRepository,
    roadRouting?: RoadRoutingService | null,
  ) {
    this.roadRouting = roadRouting ?? null;
  }

  async execute(planId: string): Promise<OptimizeRouteResult> {
    const planWithStops = await this.repository.findPlanWithStops(planId);
    if (!planWithStops) throw new Error("PLAN_NOT_FOUND");

    const { plan, stops } = planWithStops;
    const warnings: string[] = [];

    if (plan.status !== "draft" && plan.status !== "optimized") {
      throw new Error("PLAN_NOT_EDITABLE");
    }

    const totalLoadKg = stops.reduce((acc, s) => acc + s.loadKg, 0);

    if (stops.length < 2) {
      if (plan.maxCapacityKg > 0 && totalLoadKg > plan.maxCapacityKg) {
        warnings.push(`Carga total (${totalLoadKg} kg) excede capacidad maxima (${plan.maxCapacityKg} kg).`);
      }
      await this.repository.updatePlanStatus(planId, "optimized");
      await this.repository.updatePlanTotals(planId, {
        totalStops: stops.length, totalDistanceKm: 0, estimatedDurationMin: 0,
        totalLoadKg, optimizationScore: 100,
      });
      const updated = await this.repository.findPlanWithStops(planId);
      return { ...updated!, warnings, routingEngine: "haversine", geometry: null };
    }

    const geoStops = stops.filter(s => s.latitude !== null && s.longitude !== null);
    const nonGeoStops = stops.filter(s => s.latitude === null || s.longitude === null);

    // Try OSRM TSP first, fallback to haversine nearest-neighbor
    let orderedIds: string[];
    let totalDistanceKm: number;
    let estimatedDurationMin: number;
    let routingEngine: "osrm" | "haversine";
    let geometry: string | null = null;

    if (this.roadRouting && geoStops.length >= 2) {
      const osrmResult = await this.tryOsrmTrip(geoStops, warnings);
      if (osrmResult) {
        orderedIds = [
          ...osrmResult.orderedIds,
          ...nonGeoStops.map(s => s.id),
        ];
        totalDistanceKm = osrmResult.distanceKm;
        estimatedDurationMin = osrmResult.durationMin;
        routingEngine = "osrm";
        geometry = osrmResult.geometry;
      } else {
        const fallback = this.nearestNeighbor(geoStops, nonGeoStops);
        orderedIds = fallback.orderedIds;
        totalDistanceKm = fallback.distanceKm;
        estimatedDurationMin = Math.ceil((totalDistanceKm / 30) * 60);
        routingEngine = "haversine";
        warnings.push("OSRM no disponible; usando distancia en linea recta como respaldo.");
      }
    } else if (geoStops.length >= 2) {
      const fallback = this.nearestNeighbor(geoStops, nonGeoStops);
      orderedIds = fallback.orderedIds;
      totalDistanceKm = fallback.distanceKm;
      estimatedDurationMin = Math.ceil((totalDistanceKm / 30) * 60);
      routingEngine = "haversine";
    } else {
      orderedIds = stops.map(s => s.id);
      totalDistanceKm = 0;
      estimatedDurationMin = 0;
      routingEngine = "haversine";
    }

    await this.repository.reorderStops(planId, orderedIds);

    // Optimization score
    let score = 50;
    if (plan.maxCapacityKg > 0) {
      score += Math.min(totalLoadKg / plan.maxCapacityKg, 1) * 25;
    }
    if (stops.length > 1 && totalDistanceKm > 0) {
      const distPerStop = totalDistanceKm / (stops.length - 1);
      score += Math.max(0, 1 - distPerStop / 10) * 25;
    }
    // OSRM TSP gives better ordering → bonus
    if (routingEngine === "osrm") score = Math.min(score + 5, 99.99);

    score = Math.min(99.99, Math.max(0, score));

    if (plan.maxCapacityKg > 0 && totalLoadKg > plan.maxCapacityKg) {
      warnings.push(`Carga total (${totalLoadKg} kg) excede capacidad maxima (${plan.maxCapacityKg} kg).`);
      score = Math.max(0, score - 15);
    }
    if (plan.windowStart && plan.windowEnd) {
      const availableMin = (plan.windowEnd.getTime() - plan.windowStart.getTime()) / 60000;
      if (estimatedDurationMin > availableMin) {
        warnings.push(
          `Duracion estimada (${estimatedDurationMin} min) excede la ventana de tiempo disponible (${Math.round(availableMin)} min).`
        );
        score = Math.max(0, score - 10);
      }
    }

    await this.repository.updatePlanTotals(planId, {
      totalStops: stops.length,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      estimatedDurationMin,
      totalLoadKg,
      optimizationScore: Math.round(score * 100) / 100,
    });
    await this.repository.updatePlanStatus(planId, "optimized");

    const result = await this.repository.findPlanWithStops(planId);
    return { ...result!, warnings, routingEngine, geometry };
  }

  // ── OSRM TSP via trip service ──

  private async tryOsrmTrip(
    geoStops: RouteStop[],
    warnings: string[],
  ): Promise<{ orderedIds: string[]; distanceKm: number; durationMin: number; geometry: string | null } | null> {
    try {
      const waypoints = geoStops.map(s => ({ lat: s.latitude!, lng: s.longitude! }));
      const trip = await this.roadRouting!.optimizeTrip(waypoints, {
        roundtrip: false,
        source: "first",
        destination: "last",
      });

      if (trip.totalDistanceKm === 0 && trip.legs.length === 0) return null;

      const orderedIds = trip.waypointOrder.map(idx => geoStops[idx].id);
      return {
        orderedIds,
        distanceKm: trip.totalDistanceKm,
        durationMin: Math.ceil(trip.totalDurationMin),
        geometry: trip.geometry,
      };
    } catch (err) {
      warnings.push(`OSRM trip error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ── Haversine nearest-neighbor fallback ──

  private nearestNeighbor(
    geoStops: RouteStop[],
    nonGeoStops: RouteStop[],
  ): { orderedIds: string[]; distanceKm: number } {
    const remaining = [...geoStops];
    const ordered: RouteStop[] = [remaining.shift()!];
    let totalDistanceKm = 0;

    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(last.latitude!, last.longitude!, remaining[i].latitude!, remaining[i].longitude!);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      totalDistanceKm += bestDist;
      ordered.push(remaining.splice(bestIdx, 1)[0]);
    }

    return {
      orderedIds: [...ordered.map(s => s.id), ...nonGeoStops.map(s => s.id)],
      distanceKm: totalDistanceKm,
    };
  }
}
