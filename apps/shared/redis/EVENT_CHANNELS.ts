/**
 * Canonical Redis Pub/Sub channel names for AgroRed inter-service communication.
 *
 * Publishers:
 *   offer.published   → offer-service  (POST /api/v1/offers/publish)
 *   rescue.created    → rescue-service (POST /api/v1/rescues/register)
 *   auction.closed    → auction-service (POST /api/v1/auctions/:id/close)
 *
 * Subscribers:
 *   analytics-service subscribes to all three → invalidates RedisCache summary/overview entries
 *
 * Payload type: EventPayload (see EventBus.ts)
 */
export const EVENT_CHANNELS = {
  OFFER_PUBLISHED: "offer.published",
  RESCUE_CREATED:  "rescue.created",
  AUCTION_CLOSED:  "auction.closed"
} as const;

export type EventChannel = typeof EVENT_CHANNELS[keyof typeof EVENT_CHANNELS];
