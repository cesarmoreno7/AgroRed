export const DEMAND_CHANNELS = [
  "community_kitchen",
  "school_program",
  "social_program",
  "emergency_response"
] as const;

export type DemandChannel = (typeof DEMAND_CHANNELS)[number];
