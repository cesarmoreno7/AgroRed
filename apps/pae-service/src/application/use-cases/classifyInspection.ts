import {
  DEFAULT_PAE_THRESHOLDS,
  PAE_CHECKLIST_TEMPLATE,
  type PaeChecklistItem,
  type PaeThresholds
} from "../../domain/checklist/paeChecklistTemplate.js";
import type { PaeInspectionFailedItem } from "../../domain/entities/PaeInspection.js";
import type { InspectionResult } from "../../domain/value-objects/InspectionResult.js";

export interface ClassifyInspectionInput {
  portionWeightG?: number | null;
  portionWeightExpectedG?: number | null;
  temperatureC?: number | null;
  earliestExpiryDate?: string | null; // ISO date
  hygieneScore?: number | null;
  /** Respuestas libres del checklist: key → 'conforme' | 'no_conforme' | 'no_aplica' | string. */
  answers?: Record<string, unknown>;
  /** Fecha de referencia para el cálculo de días a vencimiento (default: hoy). */
  now?: Date;
}

export interface ClassifyInspectionOutput {
  result: InspectionResult;
  failedItems: PaeInspectionFailedItem[];
  coldChainOk: boolean | null;
  expiryCheckOk: boolean | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Auto-clasifica una inspección PAE. PURA: sin BD, sin efectos.
 *   - todo dentro de rango                          → conforme
 *   - solo ítems no-auto-fail (p.ej. dotación)       → conforme_con_observaciones
 *   - cualquier ítem auto-fail fuera de rango        → no_conforme
 */
export function classifyInspection(
  input: ClassifyInspectionInput,
  thresholds: Partial<PaeThresholds> = {},
  template: PaeChecklistItem[] = PAE_CHECKLIST_TEMPLATE
): ClassifyInspectionOutput {
  const t: PaeThresholds = { ...DEFAULT_PAE_THRESHOLDS, ...thresholds };
  const now = input.now ?? new Date();
  const failed: PaeInspectionFailedItem[] = [];
  const byKey = new Map(template.map((i) => [i.key, i]));
  const catOf = (key: string): string => byKey.get(key)?.category ?? "otro";

  // ── Gramaje ──
  let gramajeChecked = false;
  if (
    typeof input.portionWeightG === "number" &&
    typeof input.portionWeightExpectedG === "number" &&
    input.portionWeightExpectedG > 0
  ) {
    gramajeChecked = true;
    const lower = input.portionWeightExpectedG * (1 - t.gramaje_tolerance_pct / 100);
    if (input.portionWeightG < lower) {
      failed.push({
        key: "gramaje_racion",
        category: catOf("gramaje_racion"),
        reason: `Gramaje ${input.portionWeightG} g por debajo del mínimo ${lower.toFixed(1)} g (esperado ${input.portionWeightExpectedG} g ± ${t.gramaje_tolerance_pct}%).`,
        measuredValue: input.portionWeightG,
        expected: `>= ${lower.toFixed(1)} g`
      });
    }
  }

  // ── Cadena de frío ──
  let coldChainOk: boolean | null = null;
  if (typeof input.temperatureC === "number") {
    coldChainOk = input.temperatureC <= t.cold_chain_max_c && input.temperatureC >= t.cold_chain_min_c;
    if (!coldChainOk) {
      failed.push({
        key: "temperatura_frio",
        category: catOf("temperatura_frio"),
        reason: `Temperatura ${input.temperatureC} °C fuera del rango [${t.cold_chain_min_c}, ${t.cold_chain_max_c}] °C.`,
        measuredValue: input.temperatureC,
        expected: `${t.cold_chain_min_c}–${t.cold_chain_max_c} °C`
      });
    }
  }

  // ── Vencimiento ──
  let expiryCheckOk: boolean | null = null;
  if (input.earliestExpiryDate) {
    const exp = new Date(input.earliestExpiryDate);
    if (!Number.isNaN(exp.getTime())) {
      const daysLeft = daysBetween(now, exp);
      expiryCheckOk = daysLeft >= t.expiry_min_days;
      if (!expiryCheckOk) {
        failed.push({
          key: "fechas_vencimiento",
          category: catOf("fechas_vencimiento"),
          reason: `Insumo con ${daysLeft} día(s) a vencimiento (mínimo ${t.expiry_min_days}).`,
          measuredValue: daysLeft,
          expected: `>= ${t.expiry_min_days} días`
        });
      }
    }
  }

  // ── Higiene ──
  if (typeof input.hygieneScore === "number" && input.hygieneScore < t.hygiene_min_score) {
    failed.push({
      key: "higiene_cocina",
      category: catOf("higiene_cocina"),
      reason: `Puntaje de higiene ${input.hygieneScore} por debajo del mínimo ${t.hygiene_min_score}.`,
      measuredValue: input.hygieneScore,
      expected: `>= ${t.hygiene_min_score}`
    });
  }

  // ── Respuestas libres del checklist ──
  const answers = input.answers ?? {};
  for (const item of template) {
    const raw = answers[item.key];
    if (typeof raw === "string" && raw.toLowerCase() === "no_conforme") {
      if (!failed.some((f) => f.key === item.key)) {
        failed.push({ key: item.key, category: item.category, reason: `Ítem "${item.label}" marcado no conforme.` });
      }
    }
  }

  // ── Resultado ──
  const autoFailKeys = new Set(template.filter((i) => i.autoFailOnNonConformity).map((i) => i.key));
  const hasHardFail = failed.some((f) => autoFailKeys.has(f.key));
  const result: InspectionResult = hasHardFail
    ? "no_conforme"
    : failed.length > 0
      ? "conforme_con_observaciones"
      : "conforme";

  // Si no se midió nada relevante y no hay respuestas, sigue "pendiente".
  const nothingChecked =
    !gramajeChecked &&
    coldChainOk === null &&
    expiryCheckOk === null &&
    typeof input.hygieneScore !== "number" &&
    Object.keys(answers).length === 0;

  return {
    result: nothingChecked ? "pendiente" : result,
    failedItems: failed,
    coldChainOk,
    expiryCheckOk
  };
}
