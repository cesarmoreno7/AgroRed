import type {
  RoadRoutingService,
  RouteWaypoint,
  RouteResult,
  TripResult,
  DistanceMatrixResult,
  RouteLeg,
} from "../../domain/ports/RoadRoutingService.js";
import { logError, logInfo } from "../../shared/logger.js";

/**
 * OSRM (Open Source Routing Machine) adapter.
 *
 * Uses the OSRM HTTP API:
 *  - /route/v1/driving   → ordered routing (A→B→C)
 *  - /trip/v1/driving     → TSP solver (optimal visit order)
 *  - /table/v1/driving    → NxN distance/duration matrix
 *
 * Default: public demo server (router.project-osrm.org).
 * Production: self-host via Docker with Colombia OSM extract.
 */
export class OsrmRoutingService implements RoadRoutingService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl = "https://router.project-osrm.org", timeoutMs = 10_000) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeout = timeoutMs;
  }

  // ── Public API ──

  async getRoute(waypoints: RouteWaypoint[]): Promise<RouteResult> {
    if (waypoints.length < 2) {
      return { totalDistanceKm: 0, totalDurationMin: 0, legs: [], geometry: null };
    }

    const coords = this.formatCoords(waypoints);
    const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=false`;

    const data = await this.request(url);
    if (data.code !== "Ok" || !data.routes?.length) {
      logError("osrm.route.failed", { code: data.code, message: data.message });
      return { totalDistanceKm: 0, totalDurationMin: 0, legs: [], geometry: null };
    }

    const route = data.routes[0];
    const legs: RouteLeg[] = (route.legs ?? []).map((leg: OsrmLeg) => ({
      distanceKm: Math.round((leg.distance / 1000) * 100) / 100,
      durationMin: Math.round((leg.duration / 60) * 100) / 100,
      summary: leg.summary || "",
    }));

    return {
      totalDistanceKm: Math.round((route.distance / 1000) * 100) / 100,
      totalDurationMin: Math.round((route.duration / 60) * 100) / 100,
      legs,
      geometry: route.geometry ?? null,
    };
  }

  async optimizeTrip(
    waypoints: RouteWaypoint[],
    options?: { roundtrip?: boolean; source?: "first" | "any"; destination?: "last" | "any" }
  ): Promise<TripResult> {
    if (waypoints.length < 2) {
      return { waypointOrder: waypoints.map((_, i) => i), totalDistanceKm: 0, totalDurationMin: 0, legs: [], geometry: null };
    }

    const coords = this.formatCoords(waypoints);
    const roundtrip = options?.roundtrip ?? false;
    const source = options?.source ?? "first";
    const destination = options?.destination ?? "last";

    const url =
      `${this.baseUrl}/trip/v1/driving/${coords}` +
      `?overview=full&geometries=polyline&steps=false` +
      `&roundtrip=${roundtrip}&source=${source}&destination=${destination}`;

    const data = await this.request(url);
    if (data.code !== "Ok" || !data.trips?.length) {
      logError("osrm.trip.failed", { code: data.code, message: data.message });
      // Fallback: return original order
      return {
        waypointOrder: waypoints.map((_, i) => i),
        totalDistanceKm: 0,
        totalDurationMin: 0,
        legs: [],
        geometry: null,
      };
    }

    const trip = data.trips[0];

    // Build waypoint order from OSRM response
    const waypointOrder: number[] = (data.waypoints ?? []).map(
      (wp: OsrmTripWaypoint) => wp.waypoint_index
    );

    const legs: RouteLeg[] = (trip.legs ?? []).map((leg: OsrmLeg) => ({
      distanceKm: Math.round((leg.distance / 1000) * 100) / 100,
      durationMin: Math.round((leg.duration / 60) * 100) / 100,
      summary: leg.summary || "",
    }));

    return {
      waypointOrder,
      totalDistanceKm: Math.round((trip.distance / 1000) * 100) / 100,
      totalDurationMin: Math.round((trip.duration / 60) * 100) / 100,
      legs,
      geometry: trip.geometry ?? null,
    };
  }

  async getDistanceMatrix(waypoints: RouteWaypoint[]): Promise<DistanceMatrixResult> {
    if (waypoints.length < 2) {
      return { distances: [[0]], durations: [[0]] };
    }

    const coords = this.formatCoords(waypoints);
    const url = `${this.baseUrl}/table/v1/driving/${coords}?annotations=distance,duration`;

    const data = await this.request(url);
    if (data.code !== "Ok") {
      logError("osrm.table.failed", { code: data.code, message: data.message });
      return this.fallbackMatrix(waypoints);
    }

    const distances: number[][] = (data.distances ?? []).map((row: number[]) =>
      row.map((d: number) => Math.round((d / 1000) * 100) / 100)
    );
    const durations: number[][] = (data.durations ?? []).map((row: number[]) =>
      row.map((d: number) => Math.round((d / 60) * 100) / 100)
    );

    return { distances, durations };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple nearest query to check connectivity
      const url = `${this.baseUrl}/nearest/v1/driving/-74.0721,4.7110?number=1`;
      const data = await this.request(url);
      const ok = data.code === "Ok";
      logInfo("osrm.health", { ok, baseUrl: this.baseUrl });
      return ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──

  private formatCoords(waypoints: RouteWaypoint[]): string {
    // OSRM uses lng,lat format
    return waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(";");
  }

  private async request(url: string): Promise<OsrmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`OSRM HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as OsrmResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Haversine fallback when OSRM is unreachable */
  private fallbackMatrix(waypoints: RouteWaypoint[]): DistanceMatrixResult {
    const n = waypoints.length;
    const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
    const durations: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const km = this.haversineKm(waypoints[i].lat, waypoints[i].lng, waypoints[j].lat, waypoints[j].lng);
        const roadKm = km * 1.3; // road factor
        const min = (roadKm / 30) * 60; // 30 km/h avg
        distances[i][j] = Math.round(roadKm * 100) / 100;
        distances[j][i] = distances[i][j];
        durations[i][j] = Math.round(min * 100) / 100;
        durations[j][i] = durations[i][j];
      }
    }

    return { distances, durations };
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// ── OSRM response types ──

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: string | null;
  legs: OsrmLeg[];
}

interface OsrmLeg {
  distance: number; // meters
  duration: number; // seconds
  summary: string;
}

interface OsrmTripWaypoint {
  waypoint_index: number;
  trips_index: number;
  location: [number, number];
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
  trips?: OsrmRoute[];
  waypoints?: OsrmTripWaypoint[];
  distances?: number[][];
  durations?: number[][];
}
