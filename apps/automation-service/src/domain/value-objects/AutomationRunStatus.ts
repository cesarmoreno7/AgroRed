export const AUTOMATION_RUN_STATUSES = ["generated", "dispatched", "executing", "completed", "failed"] as const;

export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];