import type { IncidentType } from "../../domain/value-objects/IncidentType.js";
import type { IncidentSeverity } from "../../domain/value-objects/IncidentSeverity.js";

/**
 * Keyword-based NLP classifier for automatic incident categorization.
 *
 * Uses a weighted keyword dictionary to match incident type and estimate
 * severity from title + description text. This avoids the need for an
 * external ML model or training data — suitable for production use while
 * a proper ML pipeline is developed.
 *
 * classification_method: "keyword_nlp"
 */

export interface ClassificationResult {
  suggestedType: IncidentType;
  suggestedSeverity: IncidentSeverity;
  confidence: number; // 0-1
  matchedKeywords: string[];
  method: "keyword_nlp";
}

// ── Keyword dictionaries ──────────────────────

interface TypeRule {
  type: IncidentType;
  keywords: string[];
  severityHint?: IncidentSeverity;
  weight: number;
}

const TYPE_RULES: TypeRule[] = [
  // Social / food security
  {
    type: "inseguridad_alimentaria",
    keywords: ["inseguridad alimentaria", "hambre", "falta de alimentos", "sin comida", "no tienen que comer", "escasez de alimentos", "déficit alimentario"],
    severityHint: "high",
    weight: 10,
  },
  {
    type: "desnutricion",
    keywords: ["desnutrición", "desnutricion", "bajo peso", "malnutrición", "malnutricion", "anemia", "deficiencia nutricional", "talla baja"],
    severityHint: "critical",
    weight: 10,
  },
  {
    type: "falta_acceso_alimentos",
    keywords: ["acceso a alimentos", "no llegan alimentos", "sin acceso", "zona aislada", "vías bloqueadas", "bloqueo vial", "difícil acceso", "comunidad aislada"],
    severityHint: "high",
    weight: 9,
  },
  {
    type: "crisis_humanitaria",
    keywords: ["crisis humanitaria", "emergencia humanitaria", "desastre", "inundación", "inundacion", "terremoto", "deslizamiento", "avalancha", "catástrofe"],
    severityHint: "critical",
    weight: 12,
  },
  {
    type: "desplazamiento",
    keywords: ["desplazamiento", "desplazados", "migrantes", "refugiados", "desplazamiento forzado", "éxodo", "migración forzada"],
    severityHint: "critical",
    weight: 11,
  },
  {
    type: "emergencia_social",
    keywords: ["emergencia social", "violencia", "conflicto armado", "amenaza", "inseguridad", "protesta", "paro", "disturbios"],
    severityHint: "high",
    weight: 9,
  },
  {
    type: "desperdicio_alimentario",
    keywords: ["desperdicio", "merma", "pérdida de alimentos", "alimentos dañados", "alimentos vencidos", "descomposición", "pudrición", "hongos"],
    severityHint: "medium",
    weight: 7,
  },
  {
    type: "falla_programa",
    keywords: ["falla del programa", "programa suspendido", "programa cancelado", "incumplimiento", "no se entregó", "entrega fallida", "beneficiarios sin atender"],
    severityHint: "high",
    weight: 8,
  },
  // Logistics
  {
    type: "problema_logistico",
    keywords: ["problema logístico", "problema logistico", "retraso en entrega", "entrega tardía", "falta de transporte", "ruta interrumpida", "carga dañada"],
    severityHint: "medium",
    weight: 6,
  },
  {
    type: "route_delay",
    keywords: ["retraso", "demora", "atraso en ruta", "llegada tarde", "delay", "detenido"],
    severityHint: "low",
    weight: 5,
  },
  {
    type: "vehicle_failure",
    keywords: ["falla vehicular", "avería", "vehículo varado", "pinchazo", "motor", "mecánica", "accidente vial"],
    severityHint: "medium",
    weight: 6,
  },
  {
    type: "quality_issue",
    keywords: ["calidad", "contaminación", "contaminacion", "mal estado", "olor", "color", "textura", "caducado"],
    severityHint: "high",
    weight: 8,
  },
  {
    type: "access_blockage",
    keywords: ["bloqueo", "derrumbe", "vía bloqueada", "via bloqueada", "acceso restringido", "puente caído"],
    severityHint: "medium",
    weight: 7,
  },
  {
    type: "weather_alert",
    keywords: ["clima", "lluvia", "tormenta", "granizo", "helada", "sequía", "sequia", "ola de calor", "alerta climática"],
    severityHint: "medium",
    weight: 5,
  },
];

// ── Severity keywords (independent boosts) ──

const SEVERITY_BOOSTS: Array<{ keywords: string[]; severity: IncidentSeverity; weight: number }> = [
  { keywords: ["urgente", "inmediato", "emergencia", "crítico", "critico", "muerte", "fallecimiento", "mortalidad"], severity: "critical", weight: 5 },
  { keywords: ["grave", "severo", "alto riesgo", "masivo", "múltiples", "multiples", "generalizado"], severity: "high", weight: 3 },
  { keywords: ["moderado", "parcial", "algunos", "localizado"], severity: "medium", weight: 1 },
  { keywords: ["leve", "menor", "aislado", "puntual"], severity: "low", weight: 0 },
];

// ── Classifier ──────────────────────────────

export function classifyIncident(title: string, description: string): ClassificationResult {
  const text = normalize(`${title} ${description}`);

  // Score each type rule
  const typeScores: Array<{ type: IncidentType; score: number; matched: string[]; severityHint?: IncidentSeverity }> = [];

  for (const rule of TYPE_RULES) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      if (text.includes(normalize(kw))) {
        score += rule.weight;
        matched.push(kw);
      }
    }
    if (score > 0) {
      typeScores.push({ type: rule.type, score, matched, severityHint: rule.severityHint });
    }
  }

  // Sort by score descending
  typeScores.sort((a, b) => b.score - a.score);

  // If no match at all, default to "emergencia_social" with low confidence
  if (typeScores.length === 0) {
    return {
      suggestedType: "emergencia_social",
      suggestedSeverity: "medium",
      confidence: 0.1,
      matchedKeywords: [],
      method: "keyword_nlp",
    };
  }

  const best = typeScores[0];
  const maxPossible = best.matched.length * (TYPE_RULES.find(r => r.type === best.type)?.weight ?? 10);
  let confidence = Math.min(1, best.score / Math.max(maxPossible, 20));

  // Severity: start with the type hint, then check independent boosts
  let severity: IncidentSeverity = best.severityHint ?? "medium";
  let maxSevWeight = 0;

  for (const boost of SEVERITY_BOOSTS) {
    for (const kw of boost.keywords) {
      if (text.includes(normalize(kw))) {
        if (boost.weight > maxSevWeight) {
          maxSevWeight = boost.weight;
          severity = boost.severity;
        }
        confidence = Math.min(1, confidence + 0.05);
      }
    }
  }

  // If second-best score is close, reduce confidence (ambiguity)
  if (typeScores.length > 1) {
    const ratio = typeScores[1].score / best.score;
    if (ratio > 0.8) confidence *= 0.7;
    else if (ratio > 0.5) confidence *= 0.85;
  }

  return {
    suggestedType: best.type,
    suggestedSeverity: severity,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords: best.matched,
    method: "keyword_nlp",
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents for matching
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
