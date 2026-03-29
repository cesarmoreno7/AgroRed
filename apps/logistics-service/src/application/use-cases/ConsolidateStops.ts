import type { RoutePlanRepository } from "../../domain/ports/RoutePlanRepository.js";
import type { RouteStop } from "../../domain/entities/RouteStop.js";

/**
 * Groups nearby stops within a route plan by geographic proximity.
 * Stops within `radiusKm` of each other are consolidated into groups.
 * Returns sugested groupings but does NOT modify the plan.
 */

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ConsolidationGroup {
  centroidLat: number;
  centroidLng: number;
  totalLoadKg: number;
  stopCount: number;
  stopIds: string[];
  locationNames: string[];
}

export interface ConsolidationResult {
  planId: string;
  groups: ConsolidationGroup[];
  ungrouped: string[];
  potentialSavedKm: number;
}

export class ConsolidateStops {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(planId: string, radiusKm = 2): Promise<ConsolidationResult> {
    const planWithStops = await this.repository.findPlanWithStops(planId);
    if (!planWithStops) throw new Error("PLAN_NOT_FOUND");

    const { stops } = planWithStops;

    const geoStops = stops.filter(
      (s): s is RouteStop & { latitude: number; longitude: number } =>
        s.latitude !== null && s.longitude !== null
    );
    const nonGeoStops = stops.filter((s) => s.latitude === null || s.longitude === null);

    // Simple greedy clustering
    const assigned = new Set<string>();
    const groups: ConsolidationGroup[] = [];

    for (const stop of geoStops) {
      if (assigned.has(stop.id)) continue;

      const cluster = [stop];
      assigned.add(stop.id);

      for (const other of geoStops) {
        if (assigned.has(other.id)) continue;
        const dist = haversineKm(stop.latitude, stop.longitude, other.latitude, other.longitude);
        if (dist <= radiusKm) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }

      if (cluster.length > 1) {
        const centroidLat = cluster.reduce((sum, s) => sum + s.latitude, 0) / cluster.length;
        const centroidLng = cluster.reduce((sum, s) => sum + s.longitude, 0) / cluster.length;
        groups.push({
          centroidLat: Math.round(centroidLat * 1e6) / 1e6,
          centroidLng: Math.round(centroidLng * 1e6) / 1e6,
          totalLoadKg: cluster.reduce((sum, s) => sum + s.loadKg, 0),
          stopCount: cluster.length,
          stopIds: cluster.map((s) => s.id),
          locationNames: cluster.map((s) => s.locationName),
        });
      }
    }

    // Estimate km saved if consolidated stops visited once instead of individually
    let potentialSavedKm = 0;
    for (const group of groups) {
      for (let i = 1; i < group.stopIds.length; i++) {
        const a = geoStops.find((s) => s.id === group.stopIds[i - 1])!;
        const b = geoStops.find((s) => s.id === group.stopIds[i])!;
        potentialSavedKm += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      }
    }

    const ungrouped = [
      ...geoStops.filter((s) => !groups.some((g) => g.stopIds.includes(s.id))).map((s) => s.id),
      ...nonGeoStops.map((s) => s.id),
    ];

    return {
      planId,
      groups,
      ungrouped,
      potentialSavedKm: Math.round(potentialSavedKm * 100) / 100,
    };
  }
}
