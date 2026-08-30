export const INSPECTION_RESULTS = [
  "conforme",
  "conforme_con_observaciones",
  "no_conforme",
  "pendiente"
] as const;

export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const INSPECTION_KINDS = [
  "interventoria_diaria",
  "auditoria_aleatoria",
  "cae_derivada"
] as const;

export type InspectionKind = (typeof INSPECTION_KINDS)[number];

export type FindingSeverity = "low" | "medium" | "high" | "critical";

/** Categoría de ítem fallido → severidad del hallazgo para el escalamiento (Fase 2). */
export const CATEGORY_SEVERITY: Record<string, FindingSeverity> = {
  cadena_frio: "critical",
  vencimiento: "critical",
  gramaje: "high",
  higiene: "high",
  dotacion: "medium",
  otro: "medium"
};
