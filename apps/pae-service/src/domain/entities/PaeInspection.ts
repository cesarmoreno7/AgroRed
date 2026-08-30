import type { InspectionKind, InspectionResult } from "../value-objects/InspectionResult.js";

export interface PaeInspectionInput {
  /** Municipio inspeccionado (validado contra la lista de oversight en el use-case). */
  targetTenantId: string;
  operatorId?: string | null;
  institutionId?: string | null;
  foodProgramId?: string | null;
  inspectionKind: InspectionKind;
  inspectorRole?: string | null;
  inspectorUserId?: string | null;
  inspectorTenantId?: string | null;
  inspectedAt?: string | null;
  locationDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  portionWeightG?: number | null;
  portionWeightExpectedG?: number | null;
  temperatureC?: number | null;
  earliestExpiryDate?: string | null;
  hygieneScore?: number | null;
  /** Respuestas libres del checklist (key → valor/observación). */
  answers?: Record<string, unknown>;
  evidenceUrls?: string[];
  notes?: string | null;
  createdBy?: string | null;
}

export interface PaeInspectionFailedItem {
  key: string;
  category: string;
  reason: string;
  measuredValue?: number | null;
  expected?: string | null;
}

export interface PaeInspection {
  id: string;
  tenantId: string;
  operatorId: string | null;
  institutionId: string | null;
  foodProgramId: string | null;
  inspectionKind: InspectionKind;
  inspectorRole: string | null;
  inspectorUserId: string | null;
  inspectorTenantId: string | null;
  inspectedAt: string;
  locationDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  portionWeightG: number | null;
  portionWeightExpectedG: number | null;
  temperatureC: number | null;
  coldChainOk: boolean | null;
  expiryCheckOk: boolean | null;
  earliestExpiryDate: string | null;
  hygieneScore: number | null;
  answers: Record<string, unknown>;
  failedItems: PaeInspectionFailedItem[];
  result: InspectionResult;
  status: "programada" | "completed";
  evidenceUrls: string[];
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
