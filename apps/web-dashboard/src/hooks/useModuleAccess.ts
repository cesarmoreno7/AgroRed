import { useAuth } from "../hooks/useAuth";
import { MODULE_ACCESS } from "../config/moduleAccess";

export function useModuleAccess(module: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return MODULE_ACCESS[user.role]?.includes(module) ?? false;
}
