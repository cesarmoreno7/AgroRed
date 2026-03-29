export const PRODUCER_TYPES = ["individual", "association", "cooperative"] as const;

export type ProducerType = (typeof PRODUCER_TYPES)[number];

export const PRODUCER_STATUSES = ["pending_verification", "active", "inactive"] as const;

export type ProducerStatus = (typeof PRODUCER_STATUSES)[number];

export const PRODUCER_ZONES = ["rural", "urban_periphery"] as const;

export type ProducerZone = (typeof PRODUCER_ZONES)[number];
