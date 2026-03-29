import type { Auction } from "../../domain/entities/Auction.js";

/**
 * Algoritmo de Cierre Suave (Anti-Sniping)
 *
 * Si se registra una puja dentro del último minuto, el reloj se extiende 3 minutos.
 * Máximo 5 extensiones consecutivas (15 minutos adicionales en total).
 */

const SOFT_CLOSE_THRESHOLD_MS = 60 * 1000;
const EXTENSION_MINUTES = 3;
const MAX_EXTENSIONS = 5;

export interface AntiSnipingResult {
  extended: boolean;
  newEndsAt: Date;
  extensionCount: number;
  extensionMinutes: number;
}

/**
 * Evalúa si una puja activa el cierre suave y calcula la nueva hora de cierre.
 */
export function evaluateAntiSniping(
  auction: Auction,
  bidTimestamp: Date = new Date()
): AntiSnipingResult {
  const timeRemaining = auction.endsAt.getTime() - bidTimestamp.getTime();
  const currentExtensions = auction.extensionCount;

  if (timeRemaining > SOFT_CLOSE_THRESHOLD_MS || currentExtensions >= MAX_EXTENSIONS) {
    return {
      extended: false,
      newEndsAt: auction.endsAt,
      extensionCount: currentExtensions,
      extensionMinutes: 0
    };
  }

  const newEndsAt = new Date(auction.endsAt.getTime() + EXTENSION_MINUTES * 60 * 1000);
  const newExtensionCount = currentExtensions + 1;

  return {
    extended: true,
    newEndsAt,
    extensionCount: newExtensionCount,
    extensionMinutes: EXTENSION_MINUTES
  };
}

/**
 * Verifica si la subasta aún puede recibir extensiones.
 */
export function canExtend(auction: Auction): boolean {
  return auction.extensionCount < MAX_EXTENSIONS;
}

/**
 * Calcula el máximo tiempo adicional posible (en minutos).
 */
export function maxAdditionalMinutes(auction: Auction): number {
  const remaining = MAX_EXTENSIONS - auction.extensionCount;
  return remaining * EXTENSION_MINUTES;
}
