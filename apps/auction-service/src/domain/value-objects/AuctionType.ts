/**
 * Tipo A – Subasta Ascendente con Cierre Suave (modelo principal)
 * Tipo B – Subasta Holandesa Acelerada (modo urgencia)
 */
export const AUCTION_TYPES = ["ascending", "dutch"] as const;
export type AuctionType = (typeof AUCTION_TYPES)[number];
