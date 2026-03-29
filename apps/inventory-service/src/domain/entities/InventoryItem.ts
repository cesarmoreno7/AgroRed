import type { InventorySourceType } from "../value-objects/InventorySourceType.js";
import type { InventoryStatus } from "../value-objects/InventoryStatus.js";

export interface InventoryItemProps {
  id: string;
  tenantId: string;
  producerId: string;
  offerId: string | null;
  rescueId: string | null;
  sourceType: InventorySourceType;
  storageLocationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityOnHand: number;
  quantityReserved: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  expiresAt?: Date | null;
  status: InventoryStatus;
  createdAt?: Date;
}

export class InventoryItem {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly producerId: string;
  public readonly offerId: string | null;
  public readonly rescueId: string | null;
  public readonly sourceType: InventorySourceType;
  public readonly storageLocationName: string;
  public readonly productName: string;
  public readonly category: string;
  public readonly unit: string;
  public readonly quantityOnHand: number;
  public readonly quantityReserved: number;
  public readonly municipalityName: string;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly notes: string | null;
  public readonly expiresAt: Date | null;
  public readonly status: InventoryStatus;
  public readonly createdAt: Date;

  constructor(props: InventoryItemProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.producerId = props.producerId;
    this.offerId = props.offerId;
    this.rescueId = props.rescueId;
    this.sourceType = props.sourceType;
    this.storageLocationName = props.storageLocationName.trim();
    this.productName = props.productName.trim();
    this.category = props.category.trim();
    this.unit = props.unit.trim();
    this.quantityOnHand = Number(props.quantityOnHand);
    this.quantityReserved = Number(props.quantityReserved);
    this.municipalityName = props.municipalityName.trim();
    this.latitude = props.latitude === undefined || props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === undefined || props.longitude === null ? null : Number(props.longitude);
    this.notes = props.notes?.trim() || null;
    this.expiresAt = props.expiresAt ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}