import { randomUUID } from "node:crypto";
import { RoutePlan } from "../../domain/entities/RoutePlan.js";
import type { RoutePlanRepository } from "../../domain/ports/RoutePlanRepository.js";
import type { PlanType } from "../../domain/value-objects/RoutePlanTypes.js";

export interface CreateRoutePlanCommand {
  tenantId: string;
  planName: string;
  planType: PlanType;
  recursoId?: string | null;
  maxCapacityKg?: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export class CreateRoutePlan {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(command: CreateRoutePlanCommand): Promise<RoutePlan> {
    const plan = new RoutePlan({
      id: randomUUID(),
      tenantId: command.tenantId,
      planName: command.planName,
      planType: command.planType,
      recursoId: command.recursoId ?? null,
      totalStops: 0,
      totalDistanceKm: 0,
      estimatedDurationMin: 0,
      totalLoadKg: 0,
      maxCapacityKg: command.maxCapacityKg ?? 0,
      windowStart: command.windowStart ? new Date(command.windowStart) : null,
      windowEnd: command.windowEnd ? new Date(command.windowEnd) : null,
      status: "draft",
      optimizationScore: null,
      notes: command.notes ?? null,
      metadata: command.metadata ?? {},
    });

    await this.repository.savePlan(plan);
    return plan;
  }
}
