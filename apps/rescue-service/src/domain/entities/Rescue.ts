import type { RescueChannel } from "../value-objects/RescueChannel.js";
import type { RescueStatus } from "../value-objects/RescueStatus.js";

export interface RescueProps {
  id: string;
  tenantId: string;
  producerId: string;
  offerId: string | null;
  rescueChannel: RescueChannel;
  destinationOrganizationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityRescued: number;
  scheduledAt: Date;
  beneficiaryCount: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status: RescueStatus;
  createdAt?: Date;
}

export class Rescue {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly producerId: string;
  public readonly offerId: string | null;
  public readonly rescueChannel: RescueChannel;
  public readonly destinationOrganizationName: string;
  public readonly productName: string;
  public readonly category: string;
  public readonly unit: string;
  public readonly quantityRescued: number;
  public readonly scheduledAt: Date;
  public readonly beneficiaryCount: number;
  public readonly municipalityName: string;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly notes: string | null;
  public readonly status: RescueStatus;
  public readonly createdAt: Date;

  constructor(props: RescueProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.producerId = props.producerId;
    this.offerId = props.offerId;
    this.rescueChannel = props.rescueChannel;
    this.destinationOrganizationName = props.destinationOrganizationName.trim();
    this.productName = props.productName.trim();
    this.category = props.category.trim();
    this.unit = props.unit.trim();
    this.quantityRescued = Number(props.quantityRescued);
    this.scheduledAt = new Date(props.scheduledAt);
    this.beneficiaryCount = Number(props.beneficiaryCount);
    this.municipalityName = props.municipalityName.trim();
    this.latitude = props.latitude === undefined || props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === undefined || props.longitude === null ? null : Number(props.longitude);
    this.notes = props.notes?.trim() || null;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}