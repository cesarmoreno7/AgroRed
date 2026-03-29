import { Bid } from "../../domain/entities/Bid.js";
import { evaluateProxyBid, processProxyBids } from "../algorithms/ProxyBiddingAlgorithm.js";

function createProxyBid(overrides: Partial<ConstructorParameters<typeof Bid>[0]> = {}): Bid {
  return new Bid({
    id: "proxy-1",
    auctionId: "auction-1",
    bidderId: "proxy-bidder-1",
    bidderType: "comedor_comunitario",
    amount: 400000,
    maxProxyAmount: 800000,
    isProxy: false,
    socialScore: 90,
    distanceKm: null,
    latitude: 6.25,
    longitude: -75.56,
    status: "active",
    ...overrides
  });
}

describe("ProxyBiddingAlgorithm", () => {
  it("should bid when current highest is below max proxy amount", () => {
    const proxy = createProxyBid({ maxProxyAmount: 800000 });
    const result = evaluateProxyBid(proxy, 500000);

    expect(result.shouldBid).toBe(true);
    expect(result.newAmount).toBeGreaterThan(500000);
    expect(result.proxyExhausted).toBe(false);
  });

  it("should not bid when current highest exceeds max proxy amount", () => {
    const proxy = createProxyBid({ maxProxyAmount: 500000 });
    const result = evaluateProxyBid(proxy, 600000);

    expect(result.shouldBid).toBe(false);
    expect(result.proxyExhausted).toBe(true);
  });

  it("should not bid when maxProxyAmount is null", () => {
    const proxy = createProxyBid({ maxProxyAmount: null });
    const result = evaluateProxyBid(proxy, 400000);

    expect(result.shouldBid).toBe(false);
    expect(result.proxyExhausted).toBe(false);
  });

  it("processProxyBids should skip current highest bidder", () => {
    const proxies = [
      createProxyBid({ id: "p1", bidderId: "bidder-a", maxProxyAmount: 700000 }),
      createProxyBid({ id: "p2", bidderId: "bidder-b", maxProxyAmount: 900000 })
    ];

    const results = processProxyBids(proxies, 500000, "bidder-a");

    const bidderBResult = results.find((r) => r.bidderId === "bidder-b");
    expect(bidderBResult?.shouldBid).toBe(true);

    const bidderAResult = results.find((r) => r.bidderId === "bidder-a");
    expect(bidderAResult).toBeUndefined();
  });
});
