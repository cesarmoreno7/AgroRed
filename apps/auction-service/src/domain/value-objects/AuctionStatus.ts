export const AUCTION_STATUSES = [
  "draft",
  "active",
  "extended",
  "closed_with_winner",
  "closed_no_winner",
  "cancelled"
] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
