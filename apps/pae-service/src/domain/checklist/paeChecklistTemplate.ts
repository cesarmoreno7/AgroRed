/**
 * Checklist de inspección PAE — versionado en código (MVP).
 * Las tolerancias numéricas se leen de `alert_thresholds` (claves `pae.*`);
 * aquí van solo los defaults y la estructura del checklist.
 *
 * Fase 7: mover a una tabla `pae_inspection_templates` con overrides por tenant.
 */

export type PaeCategory =
  | "gramaje"
  | "cadena_frio"
  | "vencimiento"
  | "higiene"
  | "dotacion"
  | "otro";

export interface PaeThresholds {
  /** Tolerancia +/- en % sobre el gramaje esperado. */
  gramaje_tolerance_pct: number;
  /** Temperatura máxima aceptable en nevera/transporte (°C). */
  cold_chain_max_c: number;
  /** Temperatura mínima aceptable (°C). */
  cold_chain_min_c: number;
  /** Puntaje mínimo de higiene de cocina (0-100). */
  hygiene_min_score: number;
  /** Días mínimos a vencimiento para aceptar el alimento. */
  expiry_min_days: number;
  /** Horas de plazo del requerimiento a la alcaldía. */
  requerimiento_sla_hours: number;
}

export const DEFAULT_PAE_THRESHOLDS: PaeThresholds = {
  gramaje_tolerance_pct: 10,
  cold_chain_max_c: 8,
  cold_chain_min_c: 0,
  hygiene_min_score: 70,
  expiry_min_days: 2,
  requerimiento_sla_hours: 72
};

/** Mapea nombre de threshold en BD (`pae.<key>`) → campo de PaeThresholds. */
export const PAE_THRESHOLD_KEYS: Record<string, keyof PaeThresholds> = {
  "pae.gramaje_tolerance_pct": "gramaje_tolerance_pct",
  "pae.cold_chain_max_c": "cold_chain_max_c",
  "pae.cold_chain_min_c": "cold_chain_min_c",
  "pae.hygiene_min_score": "hygiene_min_score",
  "pae.expiry_min_days": "expiry_min_days",
  "pae.requerimiento_sla_hours": "requerimiento_sla_hours"
};

export interface PaeChecklistItem {
  key: string;
  label: string;
  category: PaeCategory;
  /** true → un fallo de este ítem lleva la inspección a no_conforme. */
  autoFailOnNonConformity: boolean;
}

/** Checklist base para interventoría diaria y auditoría aleatoria. */
export const PAE_CHECKLIST_TEMPLATE: PaeChecklistItem[] = [
  { key: "gramaje_racion",   label: "Peso de la ración servida vs. minuta patrón", category: "gramaje",     autoFailOnNonConformity: true },
  { key: "temperatura_frio", label: "Temperatura de conservación en frío",          category: "cadena_frio", autoFailOnNonConformity: true },
  { key: "fechas_vencimiento", label: "Fechas de vencimiento de los insumos",       category: "vencimiento", autoFailOnNonConformity: true },
  { key: "higiene_cocina",   label: "Condiciones higiénicas de la cocina/manipulación", category: "higiene", autoFailOnNonConformity: true },
  { key: "dotacion_menaje",  label: "Dotación y menaje suficientes",                category: "dotacion",    autoFailOnNonConformity: false }
];
