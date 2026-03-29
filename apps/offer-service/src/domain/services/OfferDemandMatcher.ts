import type { Offer } from "../entities/Offer.js";
import type { MatchableDemand } from "../entities/MatchableDemand.js";

export interface OfferDemandMatch {
  demand: MatchableDemand;
  score: number;
  reasons: string[];
}

/**
 * Motor de matching oferta-demanda.
 *
 * Criterios de puntuación (0-100):
 * - Coincidencia de categoría:     +30 (exacta) | +15 (parcial por nombre de producto)
 * - Coincidencia de unidad:        +15 (exacta)
 * - Cobertura de cantidad:         +25 (oferta cubre ≥100% del requerimiento)
 * - Urgencia (neededBy próximo):   +20 (≤7 días) | +10 (≤14 días) | +5 (≤30 días)
 * - Proximidad geográfica:         +10 (≤50km) | +5 (≤100km)
 *
 * Umbral mínimo para generar sugerencia: 40 puntos
 */
export class OfferDemandMatcher {
  static readonly SCORE_THRESHOLD = 40;

  match(offer: Offer, demands: MatchableDemand[]): OfferDemandMatch[] {
    const matches: OfferDemandMatch[] = [];

    for (const demand of demands) {
      const { score, reasons } = this.computeScore(offer, demand);

      if (score >= OfferDemandMatcher.SCORE_THRESHOLD) {
        matches.push({ demand, score, reasons });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  private computeScore(offer: Offer, demand: MatchableDemand): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const offerCat = offer.category.toLowerCase();
    const demandCat = demand.category.toLowerCase();
    const offerProduct = offer.productName.toLowerCase();
    const demandProduct = demand.productName.toLowerCase();

    if (offerCat === demandCat) {
      score += 30;
      reasons.push(`Categoría coincide: "${offer.category}"`);
    } else if (offerProduct.includes(demandProduct) || demandProduct.includes(offerProduct)) {
      score += 15;
      reasons.push(`Producto compatible: "${offer.productName}" ↔ "${demand.productName}"`);
    }

    if (offer.unit.toLowerCase() === demand.unit.toLowerCase()) {
      score += 15;
      reasons.push(`Unidad coincide: "${offer.unit}"`);
    }

    if (offer.quantityAvailable >= demand.quantityRequired) {
      score += 25;
      reasons.push(`Cantidad suficiente: ${offer.quantityAvailable} ${offer.unit} disponible vs ${demand.quantityRequired} requerido`);
    } else if (offer.quantityAvailable >= demand.quantityRequired * 0.5) {
      score += 12;
      reasons.push(`Cobertura parcial: ${offer.quantityAvailable} ${offer.unit} cubre ${Math.round((offer.quantityAvailable / demand.quantityRequired) * 100)}%`);
    }

    const daysUntilNeeded = Math.ceil((demand.neededBy.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilNeeded <= 7) {
      score += 20;
      reasons.push(`Urgente: necesario en ${daysUntilNeeded} días`);
    } else if (daysUntilNeeded <= 14) {
      score += 10;
      reasons.push(`Próximo: necesario en ${daysUntilNeeded} días`);
    } else if (daysUntilNeeded <= 30) {
      score += 5;
      reasons.push(`Planificado: necesario en ${daysUntilNeeded} días`);
    }

    if (offer.latitude != null && offer.longitude != null && demand.latitude != null && demand.longitude != null) {
      const distKm = this.haversineKm(offer.latitude, offer.longitude, demand.latitude, demand.longitude);
      if (distKm <= 50) {
        score += 10;
        reasons.push(`Proxima: ${distKm.toFixed(1)} km de distancia`);
      } else if (distKm <= 100) {
        score += 5;
        reasons.push(`Alcanzable: ${distKm.toFixed(1)} km de distancia`);
      }
    }

    return { score, reasons };
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
