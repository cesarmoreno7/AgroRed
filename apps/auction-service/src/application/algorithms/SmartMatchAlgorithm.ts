import type { Bid } from "../../domain/entities/Bid.js";
import { haversineKm } from "./AgroMatchAlgorithm.js";

/**
 * Algoritmo de Puntuación Ponderada (Smart Match)
 *
 * Resuelve empates y determina al ganador basándose en:
 * - Oferta (60%): monto ofrecido como porcentaje del precio máximo.
 * - Cercanía (30%): puntaje inversamente proporcional a la distancia logística.
 * - Puntaje Social (10%): bonificación para PAE, comedores, fundaciones.
 *
 * Puntuación = (Oferta × 0.60) + (Cercanía × 0.30) + (PuntajeSocial × 0.10)
 */

export interface SmartMatchInput {
  bid: Bid;
  maxBidAmount: number;
  producerLatitude: number;
  producerLongitude: number;
}

export interface SmartMatchResult {
  bidId: string;
  bidderId: string;
  totalScore: number;
  offerScore: number;
  proximityScore: number;
  socialScore: number;
}

const WEIGHT_OFFER = 0.60;
const WEIGHT_PROXIMITY = 0.30;
const WEIGHT_SOCIAL = 0.10;

const MAX_DISTANCE_KM = 300;

/**
 * Calcula el puntaje Smart Match de una puja.
 */
export function calculateSmartMatch(input: SmartMatchInput): SmartMatchResult {
  const offerScore =
    input.maxBidAmount > 0
      ? (input.bid.amount / input.maxBidAmount) * 100
      : 0;

  let proximityScore = 0;
  if (input.bid.latitude != null && input.bid.longitude != null) {
    const distKm = haversineKm(
      input.producerLatitude,
      input.producerLongitude,
      input.bid.latitude,
      input.bid.longitude
    );
    proximityScore = Math.max(0, ((MAX_DISTANCE_KM - distKm) / MAX_DISTANCE_KM) * 100);
  }

  const socialScore = Math.min(100, input.bid.socialScore);

  const totalScore =
    offerScore * WEIGHT_OFFER +
    proximityScore * WEIGHT_PROXIMITY +
    socialScore * WEIGHT_SOCIAL;

  return {
    bidId: input.bid.id,
    bidderId: input.bid.bidderId,
    totalScore: Math.round(totalScore * 100) / 100,
    offerScore: Math.round(offerScore * 100) / 100,
    proximityScore: Math.round(proximityScore * 100) / 100,
    socialScore: Math.round(socialScore * 100) / 100
  };
}

/**
 * Determina el ganador entre un conjunto de pujas usando Smart Match.
 */
export function determineWinner(
  bids: Bid[],
  producerLatitude: number,
  producerLongitude: number
): SmartMatchResult | null {
  if (bids.length === 0) return null;

  const maxBidAmount = Math.max(...bids.map((b) => b.amount));

  const results = bids.map((bid) =>
    calculateSmartMatch({
      bid,
      maxBidAmount,
      producerLatitude,
      producerLongitude
    })
  );

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results[0];
}
