import type { RoadRoutingService, DistanceMatrixResult } from "../../domain/ports/RoadRoutingService.js";
import type {
  VrpVehicle,
  VrpStop,
  VrpVehicleRoute,
  VrpSolution,
  VrpStrategy,
} from "../../domain/value-objects/VrpTypes.js";
import { randomUUID } from "node:crypto";

/**
 * Multi-vehicle VRP solver using the **Clarke-Wright Savings** algorithm.
 *
 * 1. Compute NxN distance matrix (OSRM table or haversine fallback).
 * 2. Build initial routes:  depot → stop_i → depot  (one route per stop).
 * 3. Compute savings:  S(i,j) = d(depot,i) + d(depot,j) − d(i,j).
 * 4. Sort savings descending and merge routes greedily while respecting
 *    vehicle capacity constraints.
 * 5. Assign merged routes to available vehicles.
 * 6. Optionally fetch OSRM geometry per vehicle route.
 */
export class SolveVrp {
  constructor(private readonly roadRouting: RoadRoutingService | null) {}

  async execute(params: {
    tenantId: string;
    scenarioName: string;
    depotLat: number;
    depotLng: number;
    vehicles: VrpVehicle[];
    stops: VrpStop[];
    strategy?: VrpStrategy;
    createdBy?: string;
  }): Promise<VrpSolution> {
    const {
      tenantId,
      scenarioName,
      depotLat,
      depotLng,
      vehicles,
      stops,
      strategy = "clarke_wright",
      createdBy = null,
    } = params;

    const warnings: string[] = [];

    if (vehicles.length === 0) throw new Error("NO_VEHICLES");
    if (stops.length === 0) throw new Error("NO_STOPS");

    // Sort vehicles by capacity descending for better packing
    const sortedVehicles = [...vehicles].sort((a, b) => b.capacityKg - a.capacityKg);

    // ── Step 1: Distance matrix ───────────────────────
    const depot: { lat: number; lng: number } = { lat: depotLat, lng: depotLng };
    const allPoints = [depot, ...stops.map(s => ({ lat: s.latitude, lng: s.longitude }))];
    // allPoints[0] = depot, allPoints[1..n] = stops

    let matrix: DistanceMatrixResult;
    let routingEngine: "osrm" | "haversine" = "haversine";

    if (this.roadRouting) {
      try {
        const healthy = await this.roadRouting.healthCheck();
        if (healthy) {
          matrix = await this.roadRouting.getDistanceMatrix(allPoints);
          routingEngine = "osrm";
        } else {
          matrix = haversineMatrix(allPoints);
          warnings.push("OSRM no disponible; usando distancia en línea recta.");
        }
      } catch {
        matrix = haversineMatrix(allPoints);
        warnings.push("Error contactando OSRM; usando distancia en línea recta.");
      }
    } else {
      matrix = haversineMatrix(allPoints);
    }

    const dist = matrix.distances; // dist[i][j] in km
    const dur = matrix.durations;  // dur[i][j] in min

    // ── Step 2: Compute Clarke-Wright savings ──────────
    const n = stops.length;
    const savings: Array<{ i: number; j: number; value: number }> = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Matrix indices: depot=0, stop_i = i+1, stop_j = j+1
        const sij = dist[0][i + 1] + dist[0][j + 1] - dist[i + 1][j + 1];
        if (sij > 0) {
          savings.push({ i, j, value: sij });
        }
      }
    }

    savings.sort((a, b) => b.value - a.value);

    // ── Step 3: Build initial single-stop routes ──────
    // Each route: [stopIndex] with total load
    interface TempRoute {
      stopIndices: number[];
      totalLoadKg: number;
    }

    // routeOf[stopIndex] → which tempRoute index it belongs to
    const routeOf = new Array<number>(n);
    const tempRoutes: (TempRoute | null)[] = [];

    for (let i = 0; i < n; i++) {
      routeOf[i] = i;
      tempRoutes.push({ stopIndices: [i], totalLoadKg: stops[i].loadKg });
    }

    // Maximum capacity = largest vehicle capacity
    const maxCapacity = Math.max(...sortedVehicles.map(v => v.capacityKg));

    // ── Step 4: Merge routes using savings ──────────
    for (const { i, j } of savings) {
      const ri = routeOf[i];
      const rj = routeOf[j];
      if (ri === rj) continue; // already same route

      const routeI = tempRoutes[ri];
      const routeJ = tempRoutes[rj];
      if (!routeI || !routeJ) continue;

      // Only merge if i is at the end of routeI and j is at the start of routeJ (or vice versa)
      // For simplicity, we check both endpoints
      const iAtEnd = routeI.stopIndices[routeI.stopIndices.length - 1] === i;
      const iAtStart = routeI.stopIndices[0] === i;
      const jAtEnd = routeJ.stopIndices[routeJ.stopIndices.length - 1] === j;
      const jAtStart = routeJ.stopIndices[0] === j;

      if (!((iAtEnd && jAtStart) || (iAtStart && jAtEnd) || (iAtEnd && jAtEnd) || (iAtStart && jAtStart))) {
        continue;
      }

      const combinedLoad = routeI.totalLoadKg + routeJ.totalLoadKg;
      if (combinedLoad > maxCapacity) continue;

      // Merge routeJ into routeI
      let merged: number[];
      if (iAtEnd && jAtStart) {
        merged = [...routeI.stopIndices, ...routeJ.stopIndices];
      } else if (jAtEnd && iAtStart) {
        merged = [...routeJ.stopIndices, ...routeI.stopIndices];
      } else if (iAtEnd && jAtEnd) {
        merged = [...routeI.stopIndices, ...routeJ.stopIndices.reverse()];
      } else {
        merged = [...routeI.stopIndices.reverse(), ...routeJ.stopIndices];
      }

      routeI.stopIndices = merged;
      routeI.totalLoadKg = combinedLoad;
      tempRoutes[rj] = null;

      for (const idx of routeJ.stopIndices) {
        routeOf[idx] = ri;
      }
    }

    // ── Step 5: Collect active routes ──────────────
    const activeRoutes = tempRoutes.filter((r): r is TempRoute => r !== null);
    // Sort by load descending for best-fit vehicle assignment
    activeRoutes.sort((a, b) => b.totalLoadKg - a.totalLoadKg);

    // ── Step 6: Assign vehicles ──────────────────
    const vehicleRoutes: VrpVehicleRoute[] = [];
    const usedVehicles = new Set<number>();
    let totalDistance = 0;
    let totalDuration = 0;
    let totalLoad = 0;
    let unserved = 0;

    for (const route of activeRoutes) {
      // Find first available vehicle with enough capacity
      let assigned = false;
      for (let vi = 0; vi < sortedVehicles.length; vi++) {
        if (usedVehicles.has(vi)) continue;
        if (sortedVehicles[vi].capacityKg >= route.totalLoadKg) {
          usedVehicles.add(vi);

          // Compute distance: depot → stop_0 → stop_1 → ... → stop_n → depot
          let routeDistKm = 0;
          let routeDurMin = 0;
          const indices = route.stopIndices;

          // depot → first stop
          routeDistKm += dist[0][indices[0] + 1];
          routeDurMin += dur[0][indices[0] + 1];
          // inter-stop legs
          for (let k = 0; k < indices.length - 1; k++) {
            routeDistKm += dist[indices[k] + 1][indices[k + 1] + 1];
            routeDurMin += dur[indices[k] + 1][indices[k + 1] + 1];
          }
          // last stop → depot
          routeDistKm += dist[indices[indices.length - 1] + 1][0];
          routeDurMin += dur[indices[indices.length - 1] + 1][0];

          const vehicle = sortedVehicles[vi];
          vehicleRoutes.push({
            vehicleIndex: vi,
            vehicleId: vehicle.id,
            vehicleLabel: vehicle.label,
            capacityKg: vehicle.capacityKg,
            assignedLoadKg: Math.round(route.totalLoadKg * 100) / 100,
            distanceKm: Math.round(routeDistKm * 100) / 100,
            durationMin: Math.round(routeDurMin * 100) / 100,
            stops: indices.map(idx => stops[idx]),
            geometry: null,
          });

          totalDistance += routeDistKm;
          totalDuration += routeDurMin;
          totalLoad += route.totalLoadKg;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        unserved += route.stopIndices.length;
        warnings.push(
          `No hay vehículo con capacidad suficiente para ruta de ${route.totalLoadKg} kg (${route.stopIndices.length} paradas). Paradas no atendidas.`
        );
      }
    }

    // ── Step 7: Fetch OSRM geometry per vehicle route ──
    if (routingEngine === "osrm" && this.roadRouting) {
      for (const vr of vehicleRoutes) {
        try {
          const waypoints = [
            depot,
            ...vr.stops.map(s => ({ lat: s.latitude, lng: s.longitude })),
            depot,
          ];
          const routeResult = await this.roadRouting.getRoute(waypoints);
          vr.geometry = routeResult.geometry;
          // Update with real road distances
          vr.distanceKm = routeResult.totalDistanceKm;
          vr.durationMin = routeResult.totalDurationMin;
        } catch {
          // keep matrix-based distance; no geometry
        }
      }

      // Recalculate totals after OSRM refinement
      totalDistance = vehicleRoutes.reduce((s, r) => s + r.distanceKm, 0);
      totalDuration = vehicleRoutes.reduce((s, r) => s + r.durationMin, 0);
    }

    return {
      id: randomUUID(),
      tenantId,
      scenarioName,
      depotLat,
      depotLng,
      strategy,
      status: "solved",
      totalVehiclesUsed: vehicleRoutes.length,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      totalDurationMin: Math.round(totalDuration * 100) / 100,
      totalLoadKg: Math.round(totalLoad * 100) / 100,
      unservedStops: unserved,
      routingEngine,
      vehicleRoutes,
      warnings,
      metadata: {},
      createdBy,
      createdAt: new Date(),
    };
  }
}

// ── Haversine fallback matrix ──────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineMatrix(points: Array<{ lat: number; lng: number }>): DistanceMatrixResult {
  const n = points.length;
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  const durations: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  const ROAD_FACTOR = 1.3;
  const AVG_SPEED_KMH = 30;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const km = haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng) * ROAD_FACTOR;
      const min = (km / AVG_SPEED_KMH) * 60;
      distances[i][j] = Math.round(km * 100) / 100;
      distances[j][i] = distances[i][j];
      durations[i][j] = Math.round(min * 100) / 100;
      durations[j][i] = durations[i][j];
    }
  }

  return { distances, durations };
}
