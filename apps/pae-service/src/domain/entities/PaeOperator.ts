export interface PaeOperatorInput {
  tenantId: string;
  legalName: string;
  nit?: string | null;
  legalRep?: string | null;
  contractNumber?: string | null;
  contractStartsAt?: string | null;
  contractEndsAt?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: "active" | "suspended" | "terminated";
}

export interface PaeOperator {
  id: string;
  tenantId: string;
  legalName: string;
  nit: string | null;
  legalRep: string | null;
  contractNumber: string | null;
  contractStartsAt: string | null;
  contractEndsAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: "active" | "suspended" | "terminated";
  createdAt: string;
  updatedAt: string;
}
