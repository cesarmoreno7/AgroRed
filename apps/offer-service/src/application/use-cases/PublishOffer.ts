import { randomUUID } from "node:crypto";
import { Offer } from "../../domain/entities/Offer.js";
import type { OfferRepository } from "../../domain/ports/OfferRepository.js";

export interface PublishOfferCommand {
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
}

export class PublishOffer {
  constructor(private readonly repository: OfferRepository) {}

  async execute(command: PublishOfferCommand): Promise<Offer> {
    const availableFrom = new Date(command.availableFrom);
    const availableUntil = command.availableUntil ? new Date(command.availableUntil) : null;

    if (
      Number.isNaN(availableFrom.getTime()) ||
      (availableUntil !== null && Number.isNaN(availableUntil.getTime())) ||
      (availableUntil !== null && availableUntil < availableFrom)
    ) {
      throw new Error("INVALID_OFFER_AVAILABILITY_WINDOW");
    }

    const offer = new Offer({
      id: randomUUID(),
      tenantId: command.tenantId,
      producerId: command.producerId,
      title: command.title,
      productName: command.productName,
      category: command.category,
      unit: command.unit,
      quantityAvailable: command.quantityAvailable,
      priceAmount: command.priceAmount,
      currency: command.currency,
      availableFrom,
      availableUntil,
      municipalityName: command.municipalityName,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      notes: command.notes ?? null,
      status: "published"
    });

    await this.repository.save(offer);

    return offer;
  }
}
