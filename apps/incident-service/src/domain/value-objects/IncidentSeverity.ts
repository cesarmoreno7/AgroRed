export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** Numeric weight for priority scoring */
export const SEVERITY_WEIGHT: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};