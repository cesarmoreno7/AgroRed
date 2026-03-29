import type { BidStatus } from "../value-objects/BidStatus.js";

export interface BidProps {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderType: string;
  amount: number;
  maxProxyAmount?: number | null;
  isProxy: boolean;
  socialScore: number;
  distanceKm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status: BidStatus;
  createdAt?: Date;
}

export class Bid {
  public readonly id: string;
  public readonly auctionId: string;
  public readonly bidderId: string;
  public readonly bidderType: string;
  public readonly amount: number;
  public readonly maxProxyAmount: number | null;
  public readonly isProxy: boolean;
  public readonly socialScore: number;
  public readonly distanceKm: number | null;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly status: BidStatus;
  public readonly createdAt: Date;

  constructor(props: BidProps) {
    this.id = props.id;
    this.auctionId = props.auctionId;
    this.bidderId = props.bidderId;
    this.bidderType = props.bidderType.trim();
    this.amount = Number(props.amount);
    this.maxProxyAmount = props.maxProxyAmount != null ? Number(props.maxProxyAmount) : null;
    this.isProxy = props.isProxy;
    this.socialScore = Number(props.socialScore);
    this.distanceKm = props.distanceKm != null ? Number(props.distanceKm) : null;
    this.latitude = props.latitude != null ? Number(props.latitude) : null;
    this.longitude = props.longitude != null ? Number(props.longitude) : null;
    this.status = props.status;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
  }

  get hasSocialBonus(): boolean {
    return this.socialScore > 0;
  }
}
