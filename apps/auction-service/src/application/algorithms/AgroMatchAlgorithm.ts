import type { Auction } from "../../domain/entities/Auction.js";

/**
 * Algoritmo de Emparejamiento Agrológico (AEA)
 *
 * Determina qué subastas se muestran a qué compradores y en qué orden.
 * Pondera: Frescura (30%), Proximidad (30%), Logística (20%), Historial (20%).
 */

export interface AEAInput {
  auction: Auction;
  buyerLatitude: number;
  buyerLongitude: number;
  buyerScore: number;
  logisticsAvailability: number;
}

export interface AEAResult {
  auctionId: string;
  score: number;
  freshnessScore: number;
  proximityScore: number;
  logisticsScore: number;
  historyScore: number;
}

const WEIGHT_FRESHNESS = 0.30;
const WEIGHT_PROXIMITY = 0.30;
const WEIGHT_LOGISTICS = 0.20;
const WEIGHT_HISTORY = 0.20;

/**
 * Calcula la distancia en km entre dos puntos usando la fórmula de Haversine.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Frescura: puntaje inversamente proporcional al tiempo desde la cosecha.
 * A mayor tiempo transcurrido → mayor urgencia → mayor puntaje de visibilidad.
 */
function computeFreshness(auction: Auction): number {
  const hoursElapsed = auction.hoursFromHarvest;
  const ratio = Math.min(hoursElapsed / auction.shelfLifeHours, 1);
  return ratio * 100;
}

/**
 * Proximidad: puntaje inversamente proporcional a la distancia.
 * 0 km → 100, 50 km → ~60, 150 km → ~20, 300+ km → ~0
 */
function computeProximity(auction: Auction, buyerLat: number, buyerLon: number): number {
  const distKm = haversineKm(auction.latitude, auction.longitude, buyerLat, buyerLon);
  return Math.max(0, 100 - (distKm / 3));
}

/**
 * Logística: disponibilidad de vehículos en la zona (0-100).
 */
function computeLogistics(availability: number): number {
  return Math.max(0, Math.min(100, availability));
}

/**
 * Historial: calificación acumulada del productor y comprador (0-100).
 */
function computeHistory(buyerScore: number): number {
  return Math.max(0, Math.min(100, buyerScore));
}

/**
 * Calcula el puntaje AEA para un par (subasta, comprador).
 */
export function calculateAEA(input: AEAInput): AEAResult {
  const freshnessScore = computeFreshness(input.auction);
  const proximityScore = computeProximity(input.auction, input.buyerLatitude, input.buyerLongitude);
  const logisticsScore = computeLogistics(input.logisticsAvailability);
  const historyScore = computeHistory(input.buyerScore);

  const score =
    freshnessScore * WEIGHT_FRESHNESS +
    proximityScore * WEIGHT_PROXIMITY +
    logisticsScore * WEIGHT_LOGISTICS +
    historyScore * WEIGHT_HISTORY;

  return {
    auctionId: input.auction.id,
    score: Math.round(score * 100) / 100,
    freshnessScore: Math.round(freshnessScore * 100) / 100,
    proximityScore: Math.round(proximityScore * 100) / 100,
    logisticsScore: Math.round(logisticsScore * 100) / 100,
    historyScore: Math.round(historyScore * 100) / 100
  };
}

/**
 * Ordena subastas por puntaje AEA descendente para un comprador dado.
 */
export function rankAuctionsForBuyer(inputs: AEAInput[]): AEAResult[] {
  return inputs
    .map(calculateAEA)
    .sort((a, b) => b.score - a.score);
}
