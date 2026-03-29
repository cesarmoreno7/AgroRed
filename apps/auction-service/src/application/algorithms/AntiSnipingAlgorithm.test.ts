import { Auction } from "../../domain/entities/Auction.js";
import { evaluateAntiSniping, canExtend, maxAdditionalMinutes } from "../algorithms/AntiSnipingAlgorithm.js";

function createAuction(overrides: Partial<ConstructorParameters<typeof Auction>[0]> = {}): Auction {
  const now = new Date();
  return new Auction({
    id: "auction-1",
    tenantId: "tenant-1",
    producerId: "producer-1",
    productName: "Tomate",
    category: "hortaliza",
    unit: "kg",
    quantityKg: 500,
    harvestDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    shelfLifeHours: 48,
    auctionType: "ascending",
    basePrice: 400000,
    reservePrice: 200000,
    currency: "COP",
    durationMinutes: 480,
    startsAt: new Date(now.getTime() - 60 * 60 * 1000),
    endsAt: new Date(now.getTime() + 30 * 1000),
    currentPrice: 400000,
    visibilityPhase: "phase_1",
    visibilityRadiusKm: 50,
    latitude: 6.25,
    longitude: -75.56,
    municipalityName: "Medellin",
    extensionCount: 0,
    maxExtensions: 5,
    status: "active",
    ...overrides
  });
}

describe("AntiSnipingAlgorithm", () => {
  it("should extend when bid is within last minute", () => {
    const auction = createAuction({ extensionCount: 0 });
    const bidTime = new Date(auction.endsAt.getTime() - 30 * 1000);
    const result = evaluateAntiSniping(auction, bidTime);

    expect(result.extended).toBe(true);
    expect(result.extensionCount).toBe(1);
    expect(result.extensionMinutes).toBe(3);
    expect(result.newEndsAt.getTime()).toBeGreaterThan(auction.endsAt.getTime());
  });

  it("should not extend when bid is more than 1 minute before end", () => {
    const auction = createAuction();
    const bidTime = new Date(auction.endsAt.getTime() - 5 * 60 * 1000);
    const result = evaluateAntiSniping(auction, bidTime);

    expect(result.extended).toBe(false);
    expect(result.extensionCount).toBe(0);
  });

  it("should not extend past max extensions", () => {
    const auction = createAuction({ extensionCount: 5 });
    const bidTime = new Date(auction.endsAt.getTime() - 30 * 1000);
    const result = evaluateAntiSniping(auction, bidTime);

    expect(result.extended).toBe(false);
    expect(result.extensionCount).toBe(5);
  });

  it("canExtend returns true when under limit", () => {
    const auction = createAuction({ extensionCount: 3 });
    expect(canExtend(auction)).toBe(true);
  });

  it("canExtend returns false at limit", () => {
    const auction = createAuction({ extensionCount: 5 });
    expect(canExtend(auction)).toBe(false);
  });

  it("maxAdditionalMinutes calculates remaining extension time", () => {
    const auction = createAuction({ extensionCount: 2 });
    expect(maxAdditionalMinutes(auction)).toBe(9);
  });
});
