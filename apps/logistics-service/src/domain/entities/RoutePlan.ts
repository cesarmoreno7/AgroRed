import type { PlanType, PlanStatus } from "../value-objects/RoutePlanTypes.js";

export interface RoutePlanProps {
  id: string;
  tenantId: string;
  planName: string;
  planType: PlanType;
  recursoId: string | null;
  totalStops: number;
  totalDistanceKm: number;
  estimatedDurationMin: number;
  totalLoadKg: number;
  maxCapacityKg: number;
  windowStart: Date | null;
  windowEnd: Date | null;
  status: PlanStatus;
  optimizationScore: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RoutePlan {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly planName: string;
  public readonly planType: PlanType;
  public readonly recursoId: string | null;
  public readonly totalStops: number;
  public readonly totalDistanceKm: number;
  public readonly estimatedDurationMin: number;
  public readonly totalLoadKg: number;
  public readonly maxCapacityKg: number;
  public readonly windowStart: Date | null;
  public readonly windowEnd: Date | null;
  public readonly status: PlanStatus;
  public readonly optimizationScore: number | null;
  public readonly notes: string | null;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: RoutePlanProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.planName = props.planName.trim();
    this.planType = props.planType;
    this.recursoId = props.recursoId;
    this.totalStops = Number(props.totalStops);
    this.totalDistanceKm = Number(props.totalDistanceKm);
    this.estimatedDurationMin = Number(props.estimatedDurationMin);
    this.totalLoadKg = Number(props.totalLoadKg);
    this.maxCapacityKg = Number(props.maxCapacityKg);
    this.windowStart = props.windowStart ? new Date(props.windowStart) : null;
    this.windowEnd = props.windowEnd ? new Date(props.windowEnd) : null;
    this.status = props.status;
    this.optimizationScore = props.optimizationScore !== null && props.optimizationScore !== undefined
      ? Number(props.optimizationScore) : null;
    this.notes = props.notes?.trim() || null;
    this.metadata = props.metadata ?? {};
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
