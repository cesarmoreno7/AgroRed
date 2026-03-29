import type { Auction } from "../../domain/entities/Auction.js";

/**
 * Algoritmo de Subasta Holandesa (Dutch Auction)
 *
 * El precio comienza alto y desciende automáticamente cada intervalo.
 * El primer comprador que acepte el precio actual se queda con el lote.
 * Si nadie acepta antes del precio mínimo de reserva, la subasta se cierra sin ganador.
 */

export interface DutchPriceResult {
  currentPrice: number;
  stepNumber: number;
  reachedReserve: boolean;
  priceChanged: boolean;
}

/**
 * Calcula el precio actual de una subasta holandesa basándose en el tiempo transcurrido.
 */
export function calculateDutchPrice(auction: Auction): DutchPriceResult {
  if (auction.auctionType !== "dutch") {
    return {
      currentPrice: auction.currentPrice,
      stepNumber: 0,
      reachedReserve: false,
      priceChanged: false
    };
  }

  const stepPercent = auction.dutchStepPercent ?? 5;
  const stepMinutes = auction.dutchStepMinutes ?? 10;

  const minutesElapsed = (Date.now() - auction.startsAt.getTime()) / (1000 * 60);
  const stepNumber = Math.floor(minutesElapsed / stepMinutes);

  const reductionFactor = Math.pow(1 - stepPercent / 100, stepNumber);
  let newPrice = Math.round(auction.basePrice * reductionFactor);

  const reachedReserve = newPrice <= auction.reservePrice;
  if (reachedReserve) {
    newPrice = auction.reservePrice;
  }

  return {
    currentPrice: newPrice,
    stepNumber,
    reachedReserve,
    priceChanged: newPrice !== auction.currentPrice
  };
}
