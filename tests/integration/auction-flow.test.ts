/**
 * Integration test: Auction lifecycle
 * Publish → PlaceBid → CloseAuction (with winner / no winner)
 *
 * Uses InMemory repositories — no external infrastructure required.
 */

import { randomUUID } from "node:crypto";
import { Auction } from "../../apps/auction-service/src/domain/entities/Auction.js";
import type { AuctionProps } from "../../apps/auction-service/src/domain/entities/Auction.js";
import { Bid } from "../../apps/auction-service/src/domain/entities/Bid.js";
import type {
  AuctionRepository,
  AuctionFilters,
  PaginationParams,
  PaginatedResult
} from "../../apps/auction-service/src/domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../apps/auction-service/src/domain/ports/BidRepository.js";
import type { AuctionStatus } from "../../apps/auction-service/src/domain/value-objects/AuctionStatus.js";
import type { VisibilityPhase } from "../../apps/auction-service/src/domain/value-objects/VisibilityPhase.js";
import type { BidStatus } from "../../apps/auction-service/src/domain/value-objects/BidStatus.js";
import { PublishAuction } from "../../apps/auction-service/src/application/use-cases/PublishAuction.js";
import { PlaceBid } from "../../apps/auction-service/src/application/use-cases/PlaceBid.js";
import { CloseAuction } from "../../apps/auction-service/src/application/use-cases/CloseAuction.js";

/* ── InMemory Auction Repository ─────────────────────────────── */

class InMemoryAuctionRepository implements AuctionRepository {
  private readonly store = new Map<string, AuctionProps>();

  private toAuction(props: AuctionProps): Auction {
    return new Auction(props);
  }

  async save(auction: Auction): Promise<void> {
    this.store.set(auction.id, { ...auction });
  }

  async update(auction: Auction): Promise<void> {
    if (!this.store.has(auction.id)) return;
    this.store.set(auction.id, { ...auction });
  }

  async findById(id: string): Promise<Auction | null> {
    const props = this.store.get(id);
    return props ? this.toAuction(props) : null;
  }

  async list(
    params: PaginationParams,
    filters?: AuctionFilters
  ): Promise<PaginatedResult<Auction>> {
    let all = Array.from(this.store.values());
    if (filters?.status) all = all.filter((a) => a.status === filters.status);
    if (filters?.producerId) all = all.filter((a) => a.producerId === filters.producerId);
    if (filters?.tenantId) all = all.filter((a) => a.tenantId === filters.tenantId);
    const start = (params.page - 1) * params.limit;
    return {
      data: all.slice(start, start + params.limit).map((p) => this.toAuction(p)),
      total: all.length,
      page: params.page,
      limit: params.limit
    };
  }

  async findActiveExpired(): Promise<Auction[]> {
    const now = new Date();
    return Array.from(this.store.values())
      .filter((a) => (a.status === "active" || a.status === "extended") && a.endsAt <= now)
      .map((p) => this.toAuction(p));
  }

  async updateStatus(id: string, status: AuctionStatus): Promise<void> {
    const props = this.store.get(id);
    if (props) this.store.set(id, { ...props, status });
  }

  async updateEndTime(id: string, endsAt: Date, extensionCount: number): Promise<void> {
    const props = this.store.get(id);
    if (props) this.store.set(id, { ...props, endsAt, extensionCount });
  }

  async updateCurrentPrice(id: string, price: number): Promise<void> {
    const props = this.store.get(id);
    if (props) this.store.set(id, { ...props, currentPrice: price });
  }

  async updateVisibility(id: string, phase: VisibilityPhase, radiusKm: number): Promise<void> {
    const props = this.store.get(id);
    if (props) this.store.set(id, { ...props, visibilityPhase: phase, visibilityRadiusKm: radiusKm });
  }

  async setWinner(id: string, winnerId: string, winnerPrice: number): Promise<void> {
    const props = this.store.get(id);
    if (props) this.store.set(id, { ...props, winnerId, winnerPrice });
  }

  async softDelete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

/* ── InMemory Bid Repository ─────────────────────────────────── */

interface MutableBid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderType: string;
  amount: number;
  maxProxyAmount: number | null;
  isProxy: boolean;
  socialScore: number;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  status: BidStatus;
  createdAt: Date;
}

class InMemoryBidRepository implements BidRepository {
  private readonly store = new Map<string, MutableBid>();

  private toBid(m: MutableBid): Bid {
    return new Bid(m);
  }

  async save(bid: Bid): Promise<void> {
    this.store.set(bid.id, {
      id: bid.id,
      auctionId: bid.auctionId,
      bidderId: bid.bidderId,
      bidderType: bid.bidderType,
      amount: bid.amount,
      maxProxyAmount: bid.maxProxyAmount,
      isProxy: bid.isProxy,
      socialScore: bid.socialScore,
      distanceKm: bid.distanceKm,
      latitude: bid.latitude,
      longitude: bid.longitude,
      status: bid.status,
      createdAt: bid.createdAt
    });
  }

  async findById(id: string): Promise<Bid | null> {
    const m = this.store.get(id);
    return m ? this.toBid(m) : null;
  }

  async findByAuction(auctionId: string): Promise<Bid[]> {
    return Array.from(this.store.values())
      .filter((b) => b.auctionId === auctionId)
      .map((b) => this.toBid(b));
  }

  async findHighestBid(auctionId: string): Promise<Bid | null> {
    const bids = Array.from(this.store.values()).filter(
      (b) => b.auctionId === auctionId && b.status === "active"
    );
    if (bids.length === 0) return null;
    return this.toBid(bids.reduce((best, b) => (b.amount > best.amount ? b : best)));
  }

  async findProxyBids(auctionId: string): Promise<Bid[]> {
    return Array.from(this.store.values())
      .filter((b) => b.auctionId === auctionId && b.maxProxyAmount != null && b.status === "active")
      .map((b) => this.toBid(b));
  }

  async updateStatus(id: string, status: BidStatus): Promise<void> {
    const m = this.store.get(id);
    if (m) this.store.set(id, { ...m, status });
  }

  async countByAuction(auctionId: string): Promise<number> {
    return Array.from(this.store.values()).filter((b) => b.auctionId === auctionId).length;
  }
}

/* ── Shared test data ────────────────────────────────────────── */

const TENANT_ID = "t-auction-test";
const PRODUCER_ID = randomUUID();
const BIDDER_A = randomUUID();
const BIDDER_B = randomUUID();

function makeFutureDate(minutesFromNow: number): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}

/* ── Tests ───────────────────────────────────────────────────── */

describe("Auction flow: publish → bid → close", () => {
  let auctionRepo: InMemoryAuctionRepository;
  let bidRepo: InMemoryBidRepository;
  let publishAuction: PublishAuction;
  let placeBid: PlaceBid;
  let closeAuction: CloseAuction;

  beforeEach(() => {
    auctionRepo = new InMemoryAuctionRepository();
    bidRepo = new InMemoryBidRepository();
    publishAuction = new PublishAuction(auctionRepo);
    placeBid = new PlaceBid(auctionRepo, bidRepo);
    closeAuction = new CloseAuction(auctionRepo, bidRepo);
  });

  it("publishes an ascending auction successfully", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Papa criolla",
      category: "tuberculo",
      unit: "kg",
      quantityKg: 300,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 1000,
      reservePrice: 800,
      durationMinutes: 120,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    expect(auction.id).toBeDefined();
    expect(auction.status).toBe("active");
    expect(auction.currentPrice).toBe(1000);
    expect(auction.basePrice).toBe(1000);
    expect(auction.reservePrice).toBe(800);
    expect(auction.tenantId).toBe(TENANT_ID);
    expect(auction.producerId).toBe(PRODUCER_ID);
  });

  it("rejects auction with duration outside 120–1440 minutes", async () => {
    await expect(
      publishAuction.execute({
        tenantId: TENANT_ID,
        producerId: PRODUCER_ID,
        productName: "Mango",
        category: "fruta",
        unit: "kg",
        quantityKg: 100,
        harvestDate: new Date("2025-07-01"),
        auctionType: "ascending",
        basePrice: 500,
        reservePrice: 300,
        durationMinutes: 60,
        latitude: 4.711,
        longitude: -74.072,
        municipalityName: "Bogotá D.C."
      })
    ).rejects.toThrow("INVALID_DURATION");
  });

  it("rejects auction where reservePrice exceeds basePrice", async () => {
    await expect(
      publishAuction.execute({
        tenantId: TENANT_ID,
        producerId: PRODUCER_ID,
        productName: "Arroz",
        category: "grano",
        unit: "kg",
        quantityKg: 200,
        harvestDate: new Date("2025-07-01"),
        auctionType: "ascending",
        basePrice: 500,
        reservePrice: 600,
        durationMinutes: 180,
        latitude: 4.711,
        longitude: -74.072,
        municipalityName: "Bogotá D.C."
      })
    ).rejects.toThrow("INVALID_RESERVE_PRICE");
  });

  it("accepts a valid bid and updates current price", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Yuca",
      category: "tuberculo",
      unit: "kg",
      quantityKg: 400,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 800,
      reservePrice: 600,
      durationMinutes: 240,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    const result = await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_A,
      bidderType: "comedor_comunitario",
      amount: 900
    });

    expect(result.bid.id).toBeDefined();
    expect(result.bid.amount).toBe(900);
    expect(result.bid.status).toBe("active");
    expect(result.bid.bidderId).toBe(BIDDER_A);

    const updated = await auctionRepo.findById(auction.id);
    expect(updated?.currentPrice).toBe(900);
  });

  it("rejects a bid lower than the current price", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Zanahoria",
      category: "hortaliza",
      unit: "kg",
      quantityKg: 150,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 1000,
      reservePrice: 700,
      durationMinutes: 180,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_A,
      bidderType: "pae",
      amount: 1100
    });

    await expect(
      placeBid.execute({
        auctionId: auction.id,
        bidderId: BIDDER_B,
        bidderType: "comedor_comunitario",
        amount: 1050
      })
    ).rejects.toThrow("BID_TOO_LOW");
  });

  it("prevents producer from bidding on their own auction", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Lechuga",
      category: "hortaliza",
      unit: "kg",
      quantityKg: 80,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 600,
      reservePrice: 400,
      durationMinutes: 120,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    await expect(
      placeBid.execute({
        auctionId: auction.id,
        bidderId: PRODUCER_ID,
        bidderType: "producer",
        amount: 700
      })
    ).rejects.toThrow("PRODUCER_CANNOT_BID");
  });

  it("closes auction with a winner when reserve price is met", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Maíz",
      category: "grano",
      unit: "kg",
      quantityKg: 600,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 1500,
      reservePrice: 1000,
      durationMinutes: 120,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_A,
      bidderType: "comedor_comunitario",
      amount: 1600
    });

    await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_B,
      bidderType: "pae",
      amount: 1800
    });

    const closeResult = await closeAuction.execute(auction.id);

    expect(closeResult.status).toBe("closed_with_winner");
    expect(closeResult.winnerId).toBe(BIDDER_B);
    expect(closeResult.winnerPrice).toBe(1800);
    expect(closeResult.totalBids).toBeGreaterThanOrEqual(2);

    const closed = await auctionRepo.findById(auction.id);
    expect(closed?.status).toBe("closed_with_winner");
    expect(closed?.winnerId).toBe(BIDDER_B);
    expect(closed?.winnerPrice).toBe(1800);
  });

  it("closes auction with no winner when no bids are placed", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Fríjol",
      category: "legumbre",
      unit: "kg",
      quantityKg: 200,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 2000,
      reservePrice: 1500,
      durationMinutes: 120,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    const closeResult = await closeAuction.execute(auction.id);

    expect(closeResult.status).toBe("closed_no_winner");
    expect(closeResult.winnerId).toBeNull();
    expect(closeResult.winnerPrice).toBeNull();
    expect(closeResult.totalBids).toBe(0);

    const closed = await auctionRepo.findById(auction.id);
    expect(closed?.status).toBe("closed_no_winner");
  });

  it("prevents closing an already-closed auction", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Cebolla",
      category: "hortaliza",
      unit: "kg",
      quantityKg: 100,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 500,
      reservePrice: 300,
      durationMinutes: 120,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    await closeAuction.execute(auction.id);

    await expect(closeAuction.execute(auction.id)).rejects.toThrow("AUCTION_ALREADY_CLOSED");
  });

  it("full lifecycle: two competing bidders → highest bid wins", async () => {
    const auction = await publishAuction.execute({
      tenantId: TENANT_ID,
      producerId: PRODUCER_ID,
      productName: "Tomate de árbol",
      category: "fruta",
      unit: "kg",
      quantityKg: 250,
      harvestDate: new Date("2025-07-01"),
      auctionType: "ascending",
      basePrice: 1200,
      reservePrice: 900,
      durationMinutes: 180,
      latitude: 4.711,
      longitude: -74.072,
      municipalityName: "Bogotá D.C."
    });

    expect(auction.status).toBe("active");

    const firstBid = await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_A,
      bidderType: "fundacion",
      amount: 1300
    });
    expect(firstBid.bid.status).toBe("active");

    const secondBid = await placeBid.execute({
      auctionId: auction.id,
      bidderId: BIDDER_B,
      bidderType: "pae",
      amount: 1500
    });
    expect(secondBid.bid.status).toBe("active");

    const allBids = await bidRepo.findByAuction(auction.id);
    expect(allBids.length).toBe(2);

    const firstBidUpdated = allBids.find((b) => b.id === firstBid.bid.id);
    expect(firstBidUpdated?.status).toBe("outbid");

    const result = await closeAuction.execute(auction.id);
    expect(result.status).toBe("closed_with_winner");
    expect(result.winnerId).toBe(BIDDER_B);
    expect(result.winnerPrice).toBe(1500);
  });

  it("reports AUCTION_NOT_FOUND when placing bid on unknown auction", async () => {
    await expect(
      placeBid.execute({
        auctionId: randomUUID(),
        bidderId: BIDDER_A,
        bidderType: "comedor_comunitario",
        amount: 1000
      })
    ).rejects.toThrow("AUCTION_NOT_FOUND");
  });
});
