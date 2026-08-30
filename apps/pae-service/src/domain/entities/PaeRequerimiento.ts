export const REQUERIMIENTO_STATUSES = [
  "abierto",
  "notificado",
  "en_respuesta",
  "subsanado",
  "incumplido",
  "escalado_sancion",
  "archivado"
] as const;

export type RequerimientoStatus = (typeof REQUERIMIENTO_STATUSES)[number];

export type RequerimientoSourceType =
  | "inspection"
  | "cae_report"
  | "audit"
  | "overdue_sweep"
  | "manual";

export interface PaeRequerimientoInput {
  tenantId: string; // municipio requerido
  sourceType: RequerimientoSourceType;
  inspectionId?: string | null;
  caeReportId?: string | null;
  operatorId?: string | null;
  title: string;
  description: string;
  legalBasis?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  slaHours: number;
  createdByTenantId?: string | null;
  createdByRole?: string | null;
}

export interface PaeRequerimiento {
  id: string;
  tenantId: string;
  sourceType: RequerimientoSourceType;
  inspectionId: string | null;
  caeReportId: string | null;
  operatorId: string | null;
  title: string;
  description: string;
  legalBasis: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: RequerimientoStatus;
  escalationLevel: number;
  slaHours: number;
  dueDate: string;
  firstNotifiedAt: string | null;
  respondedAt: string | null;
  responseNotes: string | null;
  closedAt: string | null;
  institutionalAlertId: string | null;
  coordinationTaskId: string | null;
  createdByTenantId: string | null;
  createdByRole: string | null;
  createdAt: string;
  updatedAt: string;
}
