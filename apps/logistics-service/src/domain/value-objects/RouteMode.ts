export const ROUTE_MODES = ["municipal_fleet", "partner_carrier", "community_route"] as const;

export type RouteMode = (typeof ROUTE_MODES)[number];