export const INCIDENT_TYPES = [
  // Logísticos (existentes)
  "route_delay",
  "vehicle_failure",
  "quality_issue",
  "access_blockage",
  "weather_alert",
  // Sociales (nuevos - Módulo Incidencias y Riesgos Sociales)
  "inseguridad_alimentaria",
  "desnutricion",
  "falta_acceso_alimentos",
  "falla_programa",
  "desperdicio_alimentario",
  "problema_logistico",
  "emergencia_social",
  "desplazamiento",
  "crisis_humanitaria"
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];