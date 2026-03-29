/**
 * Representa una demanda abierta que puede coincidir con una oferta publicada.
 */
export interface MatchableDemand {
  id: string;
  tenantId: string;
  demandChannel: string;
  organizationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityRequired: number;
  neededBy: Date;
  beneficiaryCount: number;
  municipalityName: string;
  latitude: number | null;
  longitude: number | null;
}
