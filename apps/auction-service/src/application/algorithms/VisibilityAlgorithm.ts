import type { Auction } from "../../domain/entities/Auction.js";
import type { VisibilityPhase } from "../../domain/value-objects/VisibilityPhase.js";
import { VISIBILITY_RADIUS_KM } from "../../domain/value-objects/VisibilityPhase.js";

/**
 * Algoritmo de Visibilidad Segmentada por Radio Geográfico
 *
 * - Fase 1 (primeras 4h): 50 km desde la finca del productor.
 * - Fase 2 (horas 4-12): 150 km / departamental.
 * - Fase 3 (horas 12+): nacional.
 * - Modo Urgencia (Tipo B): inmediatamente departamental.
 */

const PHASE_2_THRESHOLD_HOURS = 4;
const PHASE_3_THRESHOLD_HOURS = 12;

export interface VisibilityResult {
  phase: VisibilityPhase;
  radiusKm: number;
  changed: boolean;
}

/**
 * Calcula la fase de visibilidad actual basándose en el tiempo transcurrido.
 */
export function calculateVisibility(auction: Auction): VisibilityResult {
  if (auction.auctionType === "dutch") {
    return {
      phase: "urgent",
      radiusKm: VISIBILITY_RADIUS_KM.urgent,
      changed: auction.visibilityPhase !== "urgent"
    };
  }

  const hoursActive = (Date.now() - auction.startsAt.getTime()) / (1000 * 60 * 60);

  let newPhase: VisibilityPhase;
  if (hoursActive >= PHASE_3_THRESHOLD_HOURS) {
    newPhase = "phase_3";
  } else if (hoursActive >= PHASE_2_THRESHOLD_HOURS) {
    newPhase = "phase_2";
  } else {
    newPhase = "phase_1";
  }

  return {
    phase: newPhase,
    radiusKm: VISIBILITY_RADIUS_KM[newPhase],
    changed: auction.visibilityPhase !== newPhase
  };
}
