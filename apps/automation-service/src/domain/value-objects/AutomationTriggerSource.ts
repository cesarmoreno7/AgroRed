export const AUTOMATION_TRIGGER_SOURCES = [
  "manual_review",
  "incident_response",
  "demand_pressure",
  "daily_sweep",
  "logistics_followup"
] as const;

export type AutomationTriggerSource = (typeof AUTOMATION_TRIGGER_SOURCES)[number];