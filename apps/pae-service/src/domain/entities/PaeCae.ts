export interface PaeCaeCommittee {
  id: string;
  tenantId: string;
  institutionId: string;
  token: string;
  committeeName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaeCaeCommitteeInput {
  tenantId: string;
  institutionId: string;
  committeeName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export type CaeCategory =
  | "gramaje"
  | "cadena_frio"
  | "vencimiento"
  | "higiene"
  | "inasistencia_entrega"
  | "otro";

export type CaeReportStatus = "nuevo" | "triage" | "derivado" | "descartado";

export interface PaeCaeReportInput {
  committeeId: string;
  tenantId: string;
  reporterName?: string | null;
  reporterRole?: string | null;
  reporterContact?: string | null;
  category: CaeCategory;
  description: string;
  evidenceUrls?: string[];
  occurredOn?: string | null;
  clientIp?: string | null;
}

export interface PaeCaeReport {
  id: string;
  committeeId: string;
  tenantId: string;
  reporterName: string | null;
  reporterRole: string | null;
  reporterContact: string | null;
  category: CaeCategory;
  description: string;
  evidenceUrls: string[];
  occurredOn: string | null;
  status: CaeReportStatus;
  requerimientoId: string | null;
  inspectionId: string | null;
  triagedBy: string | null;
  triageNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
