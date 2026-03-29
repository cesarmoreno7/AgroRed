import type { RoutePlan } from "../entities/RoutePlan.js";
import type { RouteStop } from "../entities/RouteStop.js";
import type { PlanStatus, StopStatus } from "../value-objects/RoutePlanTypes.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RoutePlanWithStops {
  plan: RoutePlan;
  stops: RouteStop[];
}

export interface RoutePlanRepository {
  savePlan(plan: RoutePlan): Promise<void>;
  findPlanById(id: string): Promise<RoutePlan | null>;
  findPlanWithStops(id: string): Promise<RoutePlanWithStops | null>;
  listPlans(tenantId: string, params: PaginationParams): Promise<PaginatedResult<RoutePlan>>;
  updatePlanStatus(id: string, status: PlanStatus): Promise<void>;
  updatePlanTotals(id: string, totals: {
    totalStops: number;
    totalDistanceKm: number;
    estimatedDurationMin: number;
    totalLoadKg: number;
    optimizationScore: number | null;
  }): Promise<void>;

  saveStop(stop: RouteStop): Promise<void>;
  findStopById(id: string): Promise<RouteStop | null>;
  listStopsByPlan(routePlanId: string): Promise<RouteStop[]>;
  updateStopStatus(id: string, status: StopStatus, actualArrival?: Date, actualDeparture?: Date): Promise<void>;
  deleteStop(id: string): Promise<void>;
  reorderStops(routePlanId: string, stopIds: string[]): Promise<void>;

  // Analytics
  getActiveRoutes(tenantId: string): Promise<ActiveRouteView[]>;
  getPerformanceMetrics(tenantId: string): Promise<RoutePerformanceMetrics>;
}

export interface ActiveRouteView {
  planId: string;
  planName: string;
  planType: string;
  status: string;
  totalStops: number;
  completedStops: number;
  pendingStops: number;
  totalDistanceKm: number;
  totalLoadKg: number;
  maxCapacityKg: number;
  loadPercentage: number;
  estimatedDurationMin: number;
  optimizationScore: number | null;
  recursoId: string | null;
}

export interface RoutePerformanceMetrics {
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  avgOptimizationScore: number;
  avgDistanceKm: number;
  avgLoadUtilization: number;
  totalDeliveredKg: number;
  avgStopsPerRoute: number;
}
