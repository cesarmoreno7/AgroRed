import { randomUUID } from "node:crypto";
import { Auction } from "../../domain/entities/Auction.js";
import type { AuctionRepository } from "../../domain/ports/AuctionRepository.js";
import type { AuctionType } from "../../domain/value-objects/AuctionType.js";
import type { VisibilityPhase } from "../../domain/value-objects/VisibilityPhase.js";
import { VISIBILITY_RADIUS_KM } from "../../domain/value-objects/VisibilityPhase.js";
import { getShelfLifeHours } from "../../domain/value-objects/ProductShelfLife.js";

export interface PublishAuctionCommand {
  tenantId: string;
  producerId: string;
  productName: string;
  category: string;
  unit: string;
  quantityKg: number;
  photoUrl?: string | null;
  harvestDate: Date;
  auctionType: AuctionType;
  basePrice: number;
  reservePrice: number;
  currency?: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  municipalityName: string;
  dutchStepPercent?: number | null;
  dutchStepMinutes?: number | null;
}

export class PublishAuction {
  constructor(private readonly repository: AuctionRepository) {}

  async execute(command: PublishAuctionCommand): Promise<Auction> {
    const harvestDate = new Date(command.harvestDate);
    if (Number.isNaN(harvestDate.getTime())) {
      throw new Error("INVALID_HARVEST_DATE");
    }

    if (command.durationMinutes < 120 || command.durationMinutes > 1440) {
      throw new Error("INVALID_DURATION");
    }

    if (command.basePrice <= 0) {
      throw new Error("INVALID_BASE_PRICE");
    }

    if (command.reservePrice < 0 || command.reservePrice > command.basePrice) {
      throw new Error("INVALID_RESERVE_PRICE");
    }

    const shelfLifeHours = getShelfLifeHours(command.productName);
    const now = new Date();
    const endsAt = new Date(now.getTime() + command.durationMinutes * 60 * 1000);

    const isUrgent = command.auctionType === "dutch";
    const initialPhase: VisibilityPhase = isUrgent ? "urgent" : "phase_1";
    const initialRadius = VISIBILITY_RADIUS_KM[initialPhase];

    const initialPrice = command.auctionType === "ascending"
      ? command.basePrice
      : command.basePrice;

    const auction = new Auction({
      id: randomUUID(),
      tenantId: command.tenantId,
      producerId: command.producerId,
      productName: command.productName,
      category: command.category,
      unit: command.unit,
      quantityKg: command.quantityKg,
      photoUrl: command.photoUrl ?? null,
      harvestDate,
      shelfLifeHours,
      auctionType: command.auctionType,
      basePrice: command.basePrice,
      reservePrice: command.reservePrice,
      currency: command.currency ?? "COP",
      durationMinutes: command.durationMinutes,
      startsAt: now,
      endsAt,
      currentPrice: initialPrice,
      visibilityPhase: initialPhase,
      visibilityRadiusKm: initialRadius,
      latitude: command.latitude,
      longitude: command.longitude,
      municipalityName: command.municipalityName,
      extensionCount: 0,
      maxExtensions: 5,
      dutchStepPercent: command.dutchStepPercent ?? null,
      dutchStepMinutes: command.dutchStepMinutes ?? null,
      winnerId: null,
      winnerPrice: null,
      status: "active"
    });

    await this.repository.save(auction);
    return auction;
  }
}
