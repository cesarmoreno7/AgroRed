import { useAuth } from "../hooks/useAuth";

const moduleAccess: Record<string, string[]> = {
  admin_municipal: [
    "user-service", "producer-service", "offer-service", "rescue-service", "demand-service",
    "institution-service", "inventory-service", "logistics-service", "incident-service",
    "notification-service", "auction-service", "analytics-service", "ml-service"
  ],
  territorial_analyst: [
    "producer-service", "offer-service", "rescue-service", "demand-service",
    "institution-service", "logistics-service", "incident-service", "auction-service",
    "analytics-service", "ml-service"
  ],
  logistics_operator: [
    "producer-service", "offer-service", "rescue-service", "demand-service",
    "inventory-service", "logistics-service", "incident-service", "notification-service",
    "auction-service"
  ],
  community_kitchen: [
    "offer-service", "rescue-service", "demand-service", "auction-service"
  ],
  producer: [
    "producer-service", "rescue-service", "offer-service", "auction-service"
  ],
  supermarket: [
    "offer-service", "auction-service"
  ],
};

export function useModuleAccess(module: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return moduleAccess[user.role]?.includes(module) ?? false;
}
