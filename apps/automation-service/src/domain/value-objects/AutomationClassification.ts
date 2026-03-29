export const AUTOMATION_CLASSIFICATIONS = ["stable", "watch", "critical"] as const;

export type AutomationClassification = (typeof AUTOMATION_CLASSIFICATIONS)[number];