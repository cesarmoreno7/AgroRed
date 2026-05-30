import { Navigate } from "react-router-dom";
import { useModuleAccess } from "../hooks/useModuleAccess";
import type { ReactNode } from "react";

interface Props {
  module: string;
  children: ReactNode;
}

export function ModuleGuard({ module, children }: Props) {
  const allowed = useModuleAccess(module);
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
