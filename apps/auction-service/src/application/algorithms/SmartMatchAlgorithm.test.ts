import { Bid } from "../../domain/entities/Bid.js";
import { calculateSmartMatch, determineWinner } from "../algorithms/SmartMatchAlgorithm.js";

function createBid(overrides: Partial<ConstructorParameters<typeof Bid>[0]> = {}): Bid {
  return new Bid({
    id: "bid-1",
    auctionId: "auction-1",
    bidderId: "bidder-1",
    bidderType: "operador",
    amount: 500000,
    maxProxyAmount: null,
    isProxy: false,
    socialScore: 0,
    distanceKm: null,
    latitude: 6.25,
    longitude: -75.56,
    status: "active",
    ...overrides
  });
}

describe("SmartMatchAlgorithm", () => {
  it("should calculate correct scores for a bid", () => {
    const bid = createBid({ amount: 500000, socialScore: 50, latitude: 6.30, longitude: -75.60 });
    const result = calculateSmartMatch({
      bid,
      maxBidAmount: 500000,
      producerLatitude: 6.25,
      producerLongitude: -75.56
    });

    expect(result.offerScore).toBe(100);
    expect(result.socialScore).toBe(50);
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it("should favor PAE buyer in tie scenario", () => {
    const bidPAE = createBid({
      id: "bid-pae", bidderId: "pae-1", amount: 500000,
      socialScore: 100, latitude: 6.26, longitude: -75.57
    });
    const bidComercio = createBid({
      id: "bid-com", bidderId: "com-1", amount: 500000,
      socialScore: 10, latitude: 6.50, longitude: -75.80
    });

    const winner = determineWinner([bidPAE, bidComercio], 6.25, -75.56);
    expect(winner).not.toBeNull();
    expect(winner!.bidderId).toBe("pae-1");
  });

  it("should favor closer buyer when social scores are equal", () => {
    const bidClose = createBid({
      id: "bid-close", bidderId: "close-1", amount: 500000,
      socialScore: 50, latitude: 6.26, longitude: -75.57
    });
    const bidFar = createBid({
      id: "bid-far", bidderId: "far-1", amount: 500000,
      socialScore: 50, latitude: 7.00, longitude: -76.00
    });

    const winner = determineWinner([bidClose, bidFar], 6.25, -75.56);
    expect(winner).not.toBeNull();
    expect(winner!.bidderId).toBe("close-1");
  });

  it("should return null for empty bids array", () => {
    const winner = determineWinner([], 6.25, -75.56);
    expect(winner).toBeNull();
  });
});
