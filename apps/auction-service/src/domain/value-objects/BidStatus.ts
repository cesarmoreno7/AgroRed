export const BID_STATUSES = ["active", "outbid", "winner", "rejected"] as const;
export type BidStatus = (typeof BID_STATUSES)[number];
