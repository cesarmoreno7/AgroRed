export const RESCUE_CHANNELS = [
  "food_bank",
  "community_kitchen",
  "social_program",
  "market_recovery"
] as const;

export type RescueChannel = (typeof RESCUE_CHANNELS)[number];