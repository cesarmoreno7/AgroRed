import type { TrackingRepository, CurrentPosition } from "../../domain/ports/TrackingRepository.js";
import { RecordPosition } from "../../application/use-cases/RecordPosition.js";
import { logError, logInfo } from "../../shared/logger.js";

/**
 * Moves every "en_ruta" resource a little on each tick, so "Flota en tiempo real"
 * shows genuine movement instead of the static seed coordinates from
 * infra/postgres/025_seed_fleet_resources.sql. This is a simulator, not real GPS —
 * it exists to make the live map/SSE stream demonstrably real-time until actual
 * GPS devices or a driver-facing mobile app report positions instead.
 */

const EARTH_RADIUS_KM_PER_DEGREE = 111;
const MAX_DRIFT_DEGREES = 0.35; // keep vehicles roughly within their seeded city
const BEARING_JITTER_DEGREES = 20;

interface SimState {
  originLat: number;
  originLng: number;
  bearingDeg: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function jitterBearing(bearingDeg: number): number {
  const jitter = (Math.random() - 0.5) * 2 * BEARING_JITTER_DEGREES;
  return (bearingDeg + jitter + 360) % 360;
}

export class FleetPositionSimulator {
  private readonly recordPosition: RecordPosition;
  private readonly state = new Map<string, SimState>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: TrackingRepository,
    private readonly tickMs = 10_000,
    onBroadcast?: (tenantId: string, position: CurrentPosition) => void
  ) {
    this.recordPosition = new RecordPosition(repository, onBroadcast);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    logInfo("fleet_simulator.started", { tickMs: this.tickMs });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const positions = await this.repository.getActivePositions();

      for (const position of positions) {
        if (position.evento === "entregado" || position.evento === "pausa") continue;

        let sim = this.state.get(position.recursoId);
        if (!sim) {
          sim = { originLat: position.latitude, originLng: position.longitude, bearingDeg: position.bearing ?? Math.random() * 360 };
          this.state.set(position.recursoId, sim);
        }

        const speedKmh = position.velocidad && position.velocidad > 0 ? position.velocidad : 25;
        const distanceKm = speedKmh * (this.tickMs / 3_600_000);

        // Turn back toward the origin once drifting too far, otherwise wander with jitter —
        // keeps the vehicle visually near its seeded city instead of leaving the country.
        const driftLat = position.latitude - sim.originLat;
        const driftLng = position.longitude - sim.originLng;
        const drift = Math.sqrt(driftLat ** 2 + driftLng ** 2);
        const bearingDeg = drift > MAX_DRIFT_DEGREES
          ? (Math.atan2(-driftLng, -driftLat) * 180) / Math.PI
          : jitterBearing(sim.bearingDeg);

        const bearingRad = toRad(bearingDeg);
        const latDelta = (distanceKm / EARTH_RADIUS_KM_PER_DEGREE) * Math.cos(bearingRad);
        const lngDelta = (distanceKm / (EARTH_RADIUS_KM_PER_DEGREE * Math.cos(toRad(position.latitude)))) * Math.sin(bearingRad);

        const newLat = position.latitude + latDelta;
        const newLng = position.longitude + lngDelta;

        sim.bearingDeg = bearingDeg;

        await this.recordPosition.execute({
          recursoId: position.recursoId,
          latitude: Math.max(-90, Math.min(90, newLat)),
          longitude: Math.max(-180, Math.min(180, newLng)),
          velocidad: speedKmh,
          bearing: bearingDeg,
          evento: "en_transito"
        });
      }
    } catch (error) {
      logError("fleet_simulator.tick_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
