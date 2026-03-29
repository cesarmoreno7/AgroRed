/**
 * Port for road routing services (OSRM, Google, etc.)
 * Provides real road-network distances, durations, and route geometry.
 */

export interface RouteWaypoint {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  distanceKm: number;
  durationMin: number;
  summary: string;
}

export interface RouteResult {
  totalDistanceKm: number;
  totalDurationMin: number;
  legs: RouteLeg[];
  /** Encoded polyline (Google format) for map rendering */
  geometry: string | null;
}

export interface TripResult {
  /** Optimized order of waypoint indices (TSP solution) */
  waypointOrder: number[];
  totalDistanceKm: number;
  totalDurationMin: number;
  legs: RouteLeg[];
  geometry: string | null;
}

export interface DistanceMatrixEntry {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  durationMin: number;
}

export interface DistanceMatrixResult {
  /** distances[i][j] = km from waypoint i to j */
  distances: number[][];
  /** durations[i][j] = minutes from waypoint i to j */
  durations: number[][];
}

export interface RoadRoutingService {
  /**
   * Get route between ordered waypoints (A→B→C→D).
   * Returns road distances, durations, and geometry per leg.
   */
  getRoute(waypoints: RouteWaypoint[]): Promise<RouteResult>;

  /**
   * Solve TSP: find optimal order to visit all waypoints.
   * Uses OSRM trip service or equivalent.
   * If roundtrip=true, returns to start.
   */
  optimizeTrip(
    waypoints: RouteWaypoint[],
    options?: { roundtrip?: boolean; source?: "first" | "any"; destination?: "last" | "any" }
  ): Promise<TripResult>;

  /**
   * Compute NxN distance/duration matrix between waypoints.
   * Useful for clustering and consolidation analysis.
   */
  getDistanceMatrix(waypoints: RouteWaypoint[]): Promise<DistanceMatrixResult>;

  /** Check if the routing service is reachable */
  healthCheck(): Promise<boolean>;
}
