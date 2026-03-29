import type { DemandChannel } from "../value-objects/DemandChannel.js";
import type { DemandStatus } from "../value-objects/DemandStatus.js";

export interface DemandProps {
  id: string;
  tenantId: string;
  responsibleUserId: string | null;
  demandChannel: DemandChannel;
  organizationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityRequired: number;
  neededBy: Date;
  beneficiaryCount: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status: DemandStatus;
  createdAt?: Date;
}

export class Demand {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly responsibleUserId: string | null;
  public readonly demandChannel: DemandChannel;
  public readonly organizationName: string;
  public readonly productName: string;
  public readonly category: string;
  public readonly unit: string;
  public readonly quantityRequired: number;
  public readonly neededBy: Date;
  public readonly beneficiaryCount: number;
  public readonly municipalityName: string;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly notes: string | null;
  public readonly status: DemandStatus;
  public readonly createdAt: Date;

  constructor(props: DemandProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.responsibleUserId = props.responsibleUserId;
    this.demandChannel = props.demandChannel;
    this.organizationName = props.organizationName.trim();
    this.productName = props.productName.trim();
    this.category = props.category.trim();
    this.unit = props.unit.trim();
    this.quantityRequired = Number(props.quantityRequired);
    this.neededBy = new Date(props.neededBy);
    this.beneficiaryCount = Number(props.beneficiaryCount);
    this.municipalityName = props.municipalityName.trim();
    this.latitude = props.latitude === undefined || props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === undefined || props.longitude === null ? null : Number(props.longitude);
    this.notes = props.notes?.trim() || null;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}
