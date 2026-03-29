import type { AuctionRepository } from "../../domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../domain/ports/BidRepository.js";
import { determineWinner } from "../algorithms/SmartMatchAlgorithm.js";
import { logInfo } from "../../shared/logger.js";

/**
 * Caso de uso: Cierre de subasta.
 * Ejecutado por el scheduler cuando el temporizador llega a cero.
 * Aplica el algoritmo Smart Match para determinar al ganador.
 */
export interface CloseAuctionResult {
  auctionId: string;
  winnerId: string | null;
  winnerPrice: number | null;
  totalBids: number;
  status: string;
}

export class CloseAuction {
  constructor(
    private readonly auctionRepo: AuctionRepository,
    private readonly bidRepo: BidRepository
  ) {}

  async execute(auctionId: string): Promise<CloseAuctionResult> {
    const auction = await this.auctionRepo.findById(auctionId);
    if (!auction) {
      throw new Error("AUCTION_NOT_FOUND");
    }

    if (auction.status === "closed_with_winner" || auction.status === "closed_no_winner") {
      throw new Error("AUCTION_ALREADY_CLOSED");
    }

    const bids = await this.bidRepo.findByAuction(auctionId);
    const activeBids = bids.filter((b) => b.status === "active" || b.status === "outbid");

    if (activeBids.length === 0) {
      await this.auctionRepo.updateStatus(auctionId, "closed_no_winner");
      logInfo("auction.closed_no_winner", { auctionId });
      return {
        auctionId,
        winnerId: null,
        winnerPrice: null,
        totalBids: 0,
        status: "closed_no_winner"
      };
    }

    const highestAmount = Math.max(...activeBids.map((b) => b.amount));
    const topBids = activeBids.filter((b) => b.amount === highestAmount);

    let winnerId: string;
    let winnerPrice: number;

    if (topBids.length === 1) {
      winnerId = topBids[0].bidderId;
      winnerPrice = topBids[0].amount;
    } else {
      const matchResult = determineWinner(
        topBids,
        auction.latitude,
        auction.longitude
      );
      if (!matchResult) {
        await this.auctionRepo.updateStatus(auctionId, "closed_no_winner");
        return {
          auctionId,
          winnerId: null,
          winnerPrice: null,
          totalBids: activeBids.length,
          status: "closed_no_winner"
        };
      }
      winnerId = matchResult.bidderId;
      winnerPrice = highestAmount;
    }

    if (winnerPrice < auction.reservePrice) {
      await this.auctionRepo.updateStatus(auctionId, "closed_no_winner");
      logInfo("auction.closed_below_reserve", { auctionId, winnerPrice, reservePrice: auction.reservePrice });
      return {
        auctionId,
        winnerId: null,
        winnerPrice: null,
        totalBids: activeBids.length,
        status: "closed_no_winner"
      };
    }

    await this.auctionRepo.setWinner(auctionId, winnerId, winnerPrice);
    await this.auctionRepo.updateStatus(auctionId, "closed_with_winner");

    const winBid = activeBids.find((b) => b.bidderId === winnerId);
    if (winBid) {
      await this.bidRepo.updateStatus(winBid.id, "winner");
    }

    logInfo("auction.closed_with_winner", { auctionId, winnerId, winnerPrice });

    return {
      auctionId,
      winnerId,
      winnerPrice,
      totalBids: activeBids.length,
      status: "closed_with_winner"
    };
  }
}
