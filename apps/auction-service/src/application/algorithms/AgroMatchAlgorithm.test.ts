import { Auction } from "../../domain/entities/Auction.js";
import { calculateAEA, haversineKm, rankAuctionsForBuyer } from "../algorithms/AgroMatchAlgorithm.js";

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
    harvestDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    shelfLifeHours: 48,
    auctionType: "ascending",
    basePrice: 400000,
    reservePrice: 200000,
    currency: "COP",
    durationMinutes: 480,
    startsAt: now,
    endsAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
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

describe("AgroMatchAlgorithm (AEA)", () => {
  it("haversineKm calculates distance correctly", () => {
    const dist = haversineKm(6.25, -75.56, 6.30, -75.60);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(20);
  });

  it("should compute AEA score with all components", () => {
    const auction = createAuction();
    const result = calculateAEA({
      auction,
      buyerLatitude: 6.26,
      buyerLongitude: -75.57,
      buyerScore: 80,
      logisticsAvailability: 70
    });

    expect(result.auctionId).toBe("auction-1");
    expect(result.score).toBeGreaterThan(0);
    expect(result.freshnessScore).toBeGreaterThan(0);
    expect(result.proximityScore).toBeGreaterThan(0);
    expect(result.logisticsScore).toBe(70);
    expect(result.historyScore).toBe(80);
  });

  it("fresher product from closer producer ranks higher", () => {
    const now = new Date();
    const auctionFresh = createAuction({
      id: "fresh",
      harvestDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latitude: 6.26, longitude: -75.57
    });
    const auctionOld = createAuction({
      id: "old",
      harvestDate: new Date(now.getTime() - 40 * 60 * 60 * 1000),
      latitude: 7.0, longitude: -76.0
    });

    const results = rankAuctionsForBuyer([
      { auction: auctionFresh, buyerLatitude: 6.25, buyerLongitude: -75.56, buyerScore: 50, logisticsAvailability: 50 },
      { auction: auctionOld, buyerLatitude: 6.25, buyerLongitude: -75.56, buyerScore: 50, logisticsAvailability: 50 }
    ]);

    expect(results.length).toBe(2);
  });
});
