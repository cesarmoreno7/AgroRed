import type { OfferStatus } from "../value-objects/OfferStatus.js";

export interface OfferProps {
  id: string;
  tenantId: string;
  producerId: string;
  title: string;
  productName: string;
  category: string;
  unit: string;
  quantityAvailable: number;
  priceAmount: number;
  currency: string;
  availableFrom: Date;
  availableUntil?: Date | null;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status: OfferStatus;
  createdAt?: Date;
}

export class Offer {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly producerId: string;
  public readonly title: string;
  public readonly productName: string;
  public readonly category: string;
  public readonly unit: string;
  public readonly quantityAvailable: number;
  public readonly priceAmount: number;
  public readonly currency: string;
  public readonly availableFrom: Date;
  public readonly availableUntil: Date | null;
  public readonly municipalityName: string;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly notes: string | null;
  public readonly status: OfferStatus;
  public readonly createdAt: Date;

  constructor(props: OfferProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.producerId = props.producerId;
    this.title = props.title.trim();
    this.productName = props.productName.trim();
    this.category = props.category.trim();
    this.unit = props.unit.trim();
    this.quantityAvailable = Number(props.quantityAvailable);
    this.priceAmount = Number(props.priceAmount);
    this.currency = props.currency.trim().toUpperCase();
    this.availableFrom = new Date(props.availableFrom);
    this.availableUntil = props.availableUntil ? new Date(props.availableUntil) : null;
    this.municipalityName = props.municipalityName.trim();
    this.latitude = props.latitude === undefined || props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === undefined || props.longitude === null ? null : Number(props.longitude);
    this.notes = props.notes?.trim() || null;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}
