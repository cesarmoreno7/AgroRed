export const OFFER_STATUSES = ["published", "reserved", "closed"] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];
