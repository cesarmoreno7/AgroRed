import type { StopType, StopStatus } from "../value-objects/RoutePlanTypes.js";

export interface RouteStopProps {
  id: string;
  routePlanId: string;
  stopOrder: number;
  stopType: StopType;
  locationName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  logisticsOrderId: string | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  loadKg: number;
  status: StopStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
}

export class RouteStop {
  public readonly id: string;
  public readonly routePlanId: string;
  public readonly stopOrder: number;
  public readonly stopType: StopType;
  public readonly locationName: string;
  public readonly address: string | null;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly logisticsOrderId: string | null;
  public readonly estimatedArrival: Date | null;
  public readonly actualArrival: Date | null;
  public readonly estimatedDeparture: Date | null;
  public readonly actualDeparture: Date | null;
  public readonly loadKg: number;
  public readonly status: StopStatus;
  public readonly notes: string | null;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: Date;

  constructor(props: RouteStopProps) {
    this.id = props.id;
    this.routePlanId = props.routePlanId;
    this.stopOrder = Number(props.stopOrder);
    this.stopType = props.stopType;
    this.locationName = props.locationName.trim();
    this.address = props.address?.trim() || null;
    this.latitude = props.latitude !== null && props.latitude !== undefined ? Number(props.latitude) : null;
    this.longitude = props.longitude !== null && props.longitude !== undefined ? Number(props.longitude) : null;
    this.logisticsOrderId = props.logisticsOrderId;
    this.estimatedArrival = props.estimatedArrival ? new Date(props.estimatedArrival) : null;
    this.actualArrival = props.actualArrival ? new Date(props.actualArrival) : null;
    this.estimatedDeparture = props.estimatedDeparture ? new Date(props.estimatedDeparture) : null;
    this.actualDeparture = props.actualDeparture ? new Date(props.actualDeparture) : null;
    this.loadKg = Number(props.loadKg);
    this.status = props.status;
    this.notes = props.notes?.trim() || null;
    this.metadata = props.metadata ?? {};
    this.createdAt = props.createdAt ?? new Date();
  }
}
