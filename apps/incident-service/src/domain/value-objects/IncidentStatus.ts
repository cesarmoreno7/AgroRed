export const INCIDENT_STATUSES = [
  "open",
  "investigating",
  "resolved",
  "dismissed",
  // Extended lifecycle (Módulo Incidencias y Riesgos Sociales)
  "reportada",
  "en_analisis",
  "priorizada",
  "en_gestion",
  "intervenida",
  "cerrada",
  "escalada"
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];