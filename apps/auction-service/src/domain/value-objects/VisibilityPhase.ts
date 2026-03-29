/**
 * Fases de visibilidad segmentada por radio geográfico:
 * - phase_1: primeras 4h, radio 50 km
 * - phase_2: horas 4-12, radio 150 km / departamental
 * - phase_3: horas 12+, nacional
 * - urgent: inmediatamente departamental (Tipo B)
 */
export const VISIBILITY_PHASES = ["phase_1", "phase_2", "phase_3", "urgent"] as const;
export type VisibilityPhase = (typeof VISIBILITY_PHASES)[number];

export const VISIBILITY_RADIUS_KM: Record<VisibilityPhase, number> = {
  phase_1: 50,
  phase_2: 150,
  phase_3: 99999,
  urgent: 150
};
