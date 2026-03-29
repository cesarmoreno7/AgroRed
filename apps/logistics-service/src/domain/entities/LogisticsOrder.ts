import type { RouteMode } from "../value-objects/RouteMode.js";
import type { LogisticsStatus } from "../value-objects/LogisticsStatus.js";

export interface LogisticsOrderProps {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  demandId: string | null;
  routeMode: RouteMode;
  originLocationName: string;
  destinationOrganizationName: string;
  destinationAddress: string;
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  scheduledPickupAt: Date;
  scheduledDeliveryAt: Date;
  quantityAssigned: number;
  municipalityName: string;
  notes?: string | null;
  status: LogisticsStatus;
  createdAt?: Date;
}

export class LogisticsOrder {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly inventoryItemId: string;
  public readonly demandId: string | null;
  public readonly routeMode: RouteMode;
  public readonly originLocationName: string;
  public readonly destinationOrganizationName: string;
  public readonly destinationAddress: string;
  public readonly originLatitude: number | null;
  public readonly originLongitude: number | null;
  public readonly destinationLatitude: number | null;
  public readonly destinationLongitude: number | null;
  public readonly scheduledPickupAt: Date;
  public readonly scheduledDeliveryAt: Date;
  public readonly quantityAssigned: number;
  public readonly municipalityName: string;
  public readonly notes: string | null;
  public readonly status: LogisticsStatus;
  public readonly createdAt: Date;

  constructor(props: LogisticsOrderProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.inventoryItemId = props.inventoryItemId;
    this.demandId = props.demandId;
    this.routeMode = props.routeMode;
    this.originLocationName = props.originLocationName.trim();
    this.destinationOrganizationName = props.destinationOrganizationName.trim();
    this.destinationAddress = props.destinationAddress.trim();
    this.originLatitude = props.originLatitude === undefined || props.originLatitude === null ? null : Number(props.originLatitude);
    this.originLongitude = props.originLongitude === undefined || props.originLongitude === null ? null : Number(props.originLongitude);
    this.destinationLatitude = props.destinationLatitude === undefined || props.destinationLatitude === null ? null : Number(props.destinationLatitude);
    this.destinationLongitude = props.destinationLongitude === undefined || props.destinationLongitude === null ? null : Number(props.destinationLongitude);
    this.scheduledPickupAt = new Date(props.scheduledPickupAt);
    this.scheduledDeliveryAt = new Date(props.scheduledDeliveryAt);
    this.quantityAssigned = Number(props.quantityAssigned);
    this.municipalityName = props.municipalityName.trim();
    this.notes = props.notes?.trim() || null;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}