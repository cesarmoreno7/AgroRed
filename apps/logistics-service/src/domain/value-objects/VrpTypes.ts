/** Domain types for Vehicle Routing Problem (VRP) multi-vehicle solver. */

export interface VrpVehicle {
  id: string;
  label: string;
  capacityKg: number;
  /** Starting location (depot) — may differ per vehicle if needed */
  depotLat?: number;
  depotLng?: number;
}

export interface VrpStop {
  id: string;
  latitude: number;
  longitude: number;
  loadKg: number;
  locationName: string;
  /** Time window (optional) */
  windowStart?: Date | null;
  windowEnd?: Date | null;
}

export interface VrpVehicleRoute {
  vehicleIndex: number;
  vehicleId: string;
  vehicleLabel: string;
  capacityKg: number;
  assignedLoadKg: number;
  distanceKm: number;
  durationMin: number;
  stops: VrpStop[];
  /** Encoded polyline from OSRM, if available */
  geometry: string | null;
}

export interface VrpSolution {
  id: string;
  tenantId: string;
  scenarioName: string;
  depotLat: number;
  depotLng: number;
  strategy: "clarke_wright" | "nearest_insertion";
  status: "pending" | "solved" | "failed";
  totalVehiclesUsed: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  totalLoadKg: number;
  unservedStops: number;
  routingEngine: "osrm" | "haversine";
  vehicleRoutes: VrpVehicleRoute[];
  warnings: string[];
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

export type VrpStrategy = "clarke_wright" | "nearest_insertion";
