import type { Bid } from "../../domain/entities/Bid.js";

/**
 * Algoritmo de Proxy Bidding (Puja Automática)
 *
 * El comprador define un presupuesto máximo y el sistema puja automáticamente
 * en su nombre, incrementando la oferta en el mínimo necesario.
 * El sistema nunca revela el presupuesto máximo del comprador.
 */

const MIN_INCREMENT_PERCENT = 0.01;

export interface ProxyBidResult {
  shouldBid: boolean;
  newAmount: number;
  proxyExhausted: boolean;
  bidderId: string;
}

/**
 * Calcula el incremento mínimo para una puja.
 * El incremento es el 1% del precio actual o $1.000 COP, el que sea mayor.
 */
function getMinIncrement(currentPrice: number): number {
  return Math.max(currentPrice * MIN_INCREMENT_PERCENT, 1000);
}

/**
 * Evalúa si un proxy bidder debe pujar automáticamente
 * dado un nuevo precio tope a superar.
 */
export function evaluateProxyBid(
  proxyBid: Bid,
  currentHighestAmount: number
): ProxyBidResult {
  if (proxyBid.maxProxyAmount == null) {
    return {
      shouldBid: false,
      newAmount: proxyBid.amount,
      proxyExhausted: false,
      bidderId: proxyBid.bidderId
    };
  }

  const minIncrement = getMinIncrement(currentHighestAmount);
  const neededAmount = currentHighestAmount + minIncrement;

  if (neededAmount > proxyBid.maxProxyAmount) {
    return {
      shouldBid: false,
      newAmount: proxyBid.amount,
      proxyExhausted: true,
      bidderId: proxyBid.bidderId
    };
  }

  return {
    shouldBid: true,
    newAmount: Math.round(neededAmount),
    proxyExhausted: false,
    bidderId: proxyBid.bidderId
  };
}

/**
 * Procesa todas las pujas proxy activas para una subasta y determina
 * cuáles deben pujar automáticamente después de una nueva puja manual.
 */
export function processProxyBids(
  proxyBids: Bid[],
  currentHighestAmount: number,
  currentHighestBidderId: string
): ProxyBidResult[] {
  const results: ProxyBidResult[] = [];

  const eligibleProxies = proxyBids
    .filter((b) => b.bidderId !== currentHighestBidderId && b.maxProxyAmount != null)
    .sort((a, b) => (b.maxProxyAmount ?? 0) - (a.maxProxyAmount ?? 0));

  let runningHighest = currentHighestAmount;

  for (const proxy of eligibleProxies) {
    const result = evaluateProxyBid(proxy, runningHighest);
    results.push(result);

    if (result.shouldBid) {
      runningHighest = result.newAmount;
    }
  }

  return results;
}
