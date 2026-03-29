import { Auction } from "../../domain/entities/Auction.js";
import { calculateDutchPrice } from "../algorithms/DutchAuctionAlgorithm.js";

function createDutchAuction(overrides: Partial<ConstructorParameters<typeof Auction>[0]> = {}): Auction {
  const now = new Date();
  return new Auction({
    id: "dutch-1",
    tenantId: "tenant-1",
    producerId: "producer-1",
    productName: "Lechuga",
    category: "hortaliza",
    unit: "kg",
    quantityKg: 200,
    harvestDate: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    shelfLifeHours: 24,
    auctionType: "dutch",
    basePrice: 800000,
    reservePrice: 400000,
    currency: "COP",
    durationMinutes: 180,
    startsAt: new Date(now.getTime() - 30 * 60 * 1000),
    endsAt: new Date(now.getTime() + 150 * 60 * 1000),
    currentPrice: 800000,
    visibilityPhase: "urgent",
    visibilityRadiusKm: 150,
    latitude: 6.25,
    longitude: -75.56,
    municipalityName: "Medellin",
    extensionCount: 0,
    maxExtensions: 0,
    dutchStepPercent: 5,
    dutchStepMinutes: 10,
    status: "active",
    ...overrides
  });
}

describe("DutchAuctionAlgorithm", () => {
  it("should calculate price decrease after elapsed time", () => {
    const auction = createDutchAuction();
    const result = calculateDutchPrice(auction);

    expect(result.currentPrice).toBeLessThanOrEqual(auction.basePrice);
    expect(result.stepNumber).toBeGreaterThan(0);
  });

  it("should not go below reserve price", () => {
    const auction = createDutchAuction({
      startsAt: new Date(Date.now() - 300 * 60 * 1000),
      reservePrice: 400000
    });
    const result = calculateDutchPrice(auction);

    expect(result.currentPrice).toBeGreaterThanOrEqual(400000);
    expect(result.reachedReserve).toBe(true);
  });

  it("should not apply to ascending auctions", () => {
    const auction = createDutchAuction({ auctionType: "ascending" });
    const result = calculateDutchPrice(auction);

    expect(result.stepNumber).toBe(0);
    expect(result.priceChanged).toBe(false);
  });
});
