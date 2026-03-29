import type { AuctionType } from "../value-objects/AuctionType.js";
import type { AuctionStatus } from "../value-objects/AuctionStatus.js";
import type { VisibilityPhase } from "../value-objects/VisibilityPhase.js";

export interface AuctionProps {
  id: string;
  tenantId: string;
  producerId: string;
  productName: string;
  category: string;
  unit: string;
  quantityKg: number;
  photoUrl?: string | null;
  harvestDate: Date;
  shelfLifeHours: number;
  auctionType: AuctionType;
  basePrice: number;
  reservePrice: number;
  currency: string;
  durationMinutes: number;
  startsAt: Date;
  endsAt: Date;
  currentPrice: number;
  visibilityPhase: VisibilityPhase;
  visibilityRadiusKm: number;
  latitude: number;
  longitude: number;
  municipalityName: string;
  extensionCount: number;
  maxExtensions: number;
  dutchStepPercent?: number | null;
  dutchStepMinutes?: number | null;
  winnerId?: string | null;
  winnerPrice?: number | null;
  status: AuctionStatus;
  createdAt?: Date;
}

export class Auction {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly producerId: string;
  public readonly productName: string;
  public readonly category: string;
  public readonly unit: string;
  public readonly quantityKg: number;
  public readonly photoUrl: string | null;
  public readonly harvestDate: Date;
  public readonly shelfLifeHours: number;
  public readonly auctionType: AuctionType;
  public readonly basePrice: number;
  public readonly reservePrice: number;
  public readonly currency: string;
  public readonly durationMinutes: number;
  public readonly startsAt: Date;
  public readonly endsAt: Date;
  public readonly currentPrice: number;
  public readonly visibilityPhase: VisibilityPhase;
  public readonly visibilityRadiusKm: number;
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly municipalityName: string;
  public readonly extensionCount: number;
  public readonly maxExtensions: number;
  public readonly dutchStepPercent: number | null;
  public readonly dutchStepMinutes: number | null;
  public readonly winnerId: string | null;
  public readonly winnerPrice: number | null;
  public readonly status: AuctionStatus;
  public readonly createdAt: Date;

  constructor(props: AuctionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.producerId = props.producerId;
    this.productName = props.productName.trim();
    this.category = props.category.trim();
    this.unit = props.unit.trim();
    this.quantityKg = Number(props.quantityKg);
    this.photoUrl = props.photoUrl?.trim() || null;
    this.harvestDate = new Date(props.harvestDate);
    this.shelfLifeHours = Number(props.shelfLifeHours);
    this.auctionType = props.auctionType;
    this.basePrice = Number(props.basePrice);
    this.reservePrice = Number(props.reservePrice);
    this.currency = props.currency.trim().toUpperCase();
    this.durationMinutes = Number(props.durationMinutes);
    this.startsAt = new Date(props.startsAt);
    this.endsAt = new Date(props.endsAt);
    this.currentPrice = Number(props.currentPrice);
    this.visibilityPhase = props.visibilityPhase;
    this.visibilityRadiusKm = Number(props.visibilityRadiusKm);
    this.latitude = Number(props.latitude);
    this.longitude = Number(props.longitude);
    this.municipalityName = props.municipalityName.trim();
    this.extensionCount = Number(props.extensionCount);
    this.maxExtensions = Number(props.maxExtensions);
    this.dutchStepPercent = props.dutchStepPercent != null ? Number(props.dutchStepPercent) : null;
    this.dutchStepMinutes = props.dutchStepMinutes != null ? Number(props.dutchStepMinutes) : null;
    this.winnerId = props.winnerId ?? null;
    this.winnerPrice = props.winnerPrice != null ? Number(props.winnerPrice) : null;
    this.status = props.status;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
  }

  get isExpired(): boolean {
    return new Date() > this.endsAt;
  }

  get remainingMinutes(): number {
    const diff = this.endsAt.getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60_000));
  }

  get hoursFromHarvest(): number {
    return (Date.now() - this.harvestDate.getTime()) / (1000 * 60 * 60);
  }

  get isUrgent(): boolean {
    return this.hoursFromHarvest >= (this.shelfLifeHours - 6);
  }
}
