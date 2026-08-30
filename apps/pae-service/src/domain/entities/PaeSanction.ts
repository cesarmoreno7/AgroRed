export const SANCTION_TYPES = ["amonestacion", "multa", "caducidad"] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];

export const SANCTION_STATUSES = ["propuesta", "requerida", "aplicada", "en_firme", "archivada"] as const;
export type SanctionStatus = (typeof SANCTION_STATUSES)[number];

export interface PaeSanctionInput {
  operatorId: string;
  tenantId: string; // alcaldía que aplica
  requerimientoId?: string | null;
  sanctionType: SanctionType;
  amount?: number | null;
  justification: string;
  /** Gobernación cuando exige la sanción (status pasa a 'requerida'). */
  requestedByTenantId?: string | null;
  requestedByUser?: string | null;
}

export interface PaeSanction {
  id: string;
  operatorId: string;
  tenantId: string;
  requerimientoId: string | null;
  sanctionType: SanctionType;
  amount: number | null;
  currency: string;
  status: SanctionStatus;
  requestedByTenantId: string | null;
  requestedByUser: string | null;
  appliedByUser: string | null;
  justification: string;
  resolutionDocUrl: string | null;
  requestedAt: string | null;
  appliedAt: string | null;
  firmAt: string | null;
  createdAt: string;
  updatedAt: string;
}
