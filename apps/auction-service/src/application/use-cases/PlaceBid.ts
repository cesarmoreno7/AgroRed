import { randomUUID } from "node:crypto";
import { Bid } from "../../domain/entities/Bid.js";
import type { AuctionRepository } from "../../domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../domain/ports/BidRepository.js";
import { evaluateAntiSniping } from "../algorithms/AntiSnipingAlgorithm.js";
import { processProxyBids } from "../algorithms/ProxyBiddingAlgorithm.js";

export interface PlaceBidCommand {
  auctionId: string;
  bidderId: string;
  bidderType: string;
  amount: number;
  maxProxyAmount?: number | null;
  socialScore?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlaceBidResult {
  bid: Bid;
  antiSnipingTriggered: boolean;
  newEndsAt?: Date;
  proxyBidsTriggered: number;
}

export class PlaceBid {
  constructor(
    private readonly auctionRepo: AuctionRepository,
    private readonly bidRepo: BidRepository
  ) {}

  async execute(command: PlaceBidCommand): Promise<PlaceBidResult> {
    const auction = await this.auctionRepo.findById(command.auctionId);
    if (!auction) {
      throw new Error("AUCTION_NOT_FOUND");
    }

    if (auction.status !== "active" && auction.status !== "extended") {
      throw new Error("AUCTION_NOT_ACTIVE");
    }

    if (new Date() > auction.endsAt) {
      throw new Error("AUCTION_EXPIRED");
    }

    if (command.bidderId === auction.producerId) {
      throw new Error("PRODUCER_CANNOT_BID");
    }

    const highestBid = await this.bidRepo.findHighestBid(command.auctionId);
    if (command.amount <= (highestBid?.amount ?? auction.basePrice - 1)) {
      throw new Error("BID_TOO_LOW");
    }

    if (highestBid && command.amount <= highestBid.amount) {
      throw new Error("BID_TOO_LOW");
    }

    const socialScore = command.socialScore ?? this.calculateSocialScore(command.bidderType);

    const bid = new Bid({
      id: randomUUID(),
      auctionId: command.auctionId,
      bidderId: command.bidderId,
      bidderType: command.bidderType,
      amount: command.amount,
      maxProxyAmount: command.maxProxyAmount ?? null,
      isProxy: false,
      socialScore,
      distanceKm: null,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      status: "active"
    });

    if (highestBid) {
      await this.bidRepo.updateStatus(highestBid.id, "outbid");
    }

    await this.bidRepo.save(bid);
    await this.auctionRepo.updateCurrentPrice(command.auctionId, command.amount);

    const antiSniping = evaluateAntiSniping(auction);
    if (antiSniping.extended) {
      await this.auctionRepo.updateEndTime(
        command.auctionId,
        antiSniping.newEndsAt,
        antiSniping.extensionCount
      );
      await this.auctionRepo.updateStatus(command.auctionId, "extended");
    }

    let proxyBidsTriggered = 0;
    const proxyBids = await this.bidRepo.findProxyBids(command.auctionId);
    if (proxyBids.length > 0) {
      const proxyResults = processProxyBids(proxyBids, command.amount, command.bidderId);

      for (const result of proxyResults) {
        if (result.shouldBid) {
          const proxyBid = new Bid({
            id: randomUUID(),
            auctionId: command.auctionId,
            bidderId: result.bidderId,
            bidderType: "proxy",
            amount: result.newAmount,
            maxProxyAmount: null,
            isProxy: true,
            socialScore: proxyBids.find((p) => p.bidderId === result.bidderId)?.socialScore ?? 0,
            distanceKm: null,
            latitude: null,
            longitude: null,
            status: "active"
          });

          await this.bidRepo.updateStatus(bid.id, "outbid");
          await this.bidRepo.save(proxyBid);
          await this.auctionRepo.updateCurrentPrice(command.auctionId, result.newAmount);
          proxyBidsTriggered++;
        }
      }
    }

    return {
      bid,
      antiSnipingTriggered: antiSniping.extended,
      newEndsAt: antiSniping.extended ? antiSniping.newEndsAt : undefined,
      proxyBidsTriggered
    };
  }

  private calculateSocialScore(bidderType: string): number {
    const socialTypes: Record<string, number> = {
      pae: 100,
      comedor_comunitario: 90,
      fundacion: 80,
      programa_alimentacion: 85,
      municipio: 70,
      operador_institucional: 60,
      operador: 30,
      comercio: 10,
      individual: 0
    };
    return socialTypes[bidderType.toLowerCase()] ?? 0;
  }
}
