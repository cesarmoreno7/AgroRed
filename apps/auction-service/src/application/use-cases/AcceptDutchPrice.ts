import type { AuctionRepository } from "../../domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../domain/ports/BidRepository.js";

/**
 * Caso de uso: Aceptar precio en subasta holandesa (Tipo B).
 * El primer comprador que acepte el precio actual gana el lote.
 */
export interface AcceptDutchPriceCommand {
  auctionId: string;
  bidderId: string;
  bidderType: string;
  acceptedPrice: number;
  latitude?: number | null;
  longitude?: number | null;
}

export class AcceptDutchPrice {
  constructor(
    private readonly auctionRepo: AuctionRepository,
    private readonly bidRepo: BidRepository
  ) {}

  async execute(command: AcceptDutchPriceCommand): Promise<void> {
    const auction = await this.auctionRepo.findById(command.auctionId);
    if (!auction) {
      throw new Error("AUCTION_NOT_FOUND");
    }

    if (auction.auctionType !== "dutch") {
      throw new Error("NOT_DUTCH_AUCTION");
    }

    if (auction.status !== "active") {
      throw new Error("AUCTION_NOT_ACTIVE");
    }

    if (new Date() > auction.endsAt) {
      throw new Error("AUCTION_EXPIRED");
    }

    if (command.bidderId === auction.producerId) {
      throw new Error("PRODUCER_CANNOT_BID");
    }

    if (command.acceptedPrice < auction.reservePrice) {
      throw new Error("PRICE_BELOW_RESERVE");
    }

    await this.auctionRepo.setWinner(command.auctionId, command.bidderId, command.acceptedPrice);
    await this.auctionRepo.updateStatus(command.auctionId, "closed_with_winner");
  }
}
