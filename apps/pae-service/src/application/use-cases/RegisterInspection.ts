import type { PaeRepository, PaeInspectionRecord } from "../../domain/ports/PaeRepository.js";
import type { PaeInspection, PaeInspectionInput } from "../../domain/entities/PaeInspection.js";
import { classifyInspection } from "./classifyInspection.js";

export class TargetTenantNotAllowedError extends Error {
  constructor() {
    super("TARGET_TENANT_NOT_IN_OVERSIGHT");
    this.name = "TargetTenantNotAllowedError";
  }
}

export interface RegisterInspectionDeps {
  repository: PaeRepository;
  /** Fase 2: se llama cuando result === 'no_conforme'. Opcional en Fase 1. */
  onNonConformity?: (inspection: PaeInspection) => Promise<void>;
}

export class RegisterInspection {
  constructor(private readonly deps: RegisterInspectionDeps) {}

  /**
   * @param canTargetTenant valida (por request) que el usuario puede inspeccionar
   *   `targetTenantId` — su propio tenant o uno de su lista de oversight.
   */
  async execute(
    input: PaeInspectionInput,
    canTargetTenant: (targetTenantId: string) => boolean
  ): Promise<PaeInspection> {
    if (!input.targetTenantId || !canTargetTenant(input.targetTenantId)) {
      throw new TargetTenantNotAllowedError();
    }

    const thresholds = await this.deps.repository.getThresholds(input.targetTenantId);
    const classification = classifyInspection(
      {
        portionWeightG: input.portionWeightG ?? null,
        portionWeightExpectedG: input.portionWeightExpectedG ?? null,
        temperatureC: input.temperatureC ?? null,
        earliestExpiryDate: input.earliestExpiryDate ?? null,
        hygieneScore: input.hygieneScore ?? null,
        answers: input.answers ?? {}
      },
      thresholds
    );

    const record: PaeInspectionRecord = {
      tenantId: input.targetTenantId,
      operatorId: input.operatorId ?? null,
      institutionId: input.institutionId ?? null,
      foodProgramId: input.foodProgramId ?? null,
      inspectionKind: input.inspectionKind,
      inspectorRole: input.inspectorRole ?? null,
      inspectorUserId: input.inspectorUserId ?? null,
      inspectorTenantId: input.inspectorTenantId ?? null,
      inspectedAt: input.inspectedAt ?? new Date().toISOString(),
      locationDescription: input.locationDescription ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      portionWeightG: input.portionWeightG ?? null,
      portionWeightExpectedG: input.portionWeightExpectedG ?? null,
      temperatureC: input.temperatureC ?? null,
      coldChainOk: classification.coldChainOk,
      expiryCheckOk: classification.expiryCheckOk,
      earliestExpiryDate: input.earliestExpiryDate ?? null,
      hygieneScore: input.hygieneScore ?? null,
      answers: input.answers ?? {},
      failedItems: classification.failedItems,
      result: classification.result,
      status: "completed",
      evidenceUrls: input.evidenceUrls ?? [],
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null
    };

    const inspection = await this.deps.repository.createInspection(record);

    if (inspection.result === "no_conforme" && this.deps.onNonConformity) {
      await this.deps.onNonConformity(inspection);
    }

    return inspection;
  }
}
