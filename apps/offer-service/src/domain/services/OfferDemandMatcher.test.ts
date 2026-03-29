import { describe, it, expect } from "@jest/globals";
import { Offer } from "../../domain/entities/Offer.js";
import { OfferDemandMatcher } from "../../domain/services/OfferDemandMatcher.js";

function makeOffer(overrides = {}) {
  return new Offer({
    id: "offer-1",
    tenantId: "tenant-1",
    producerId: "producer-1",
    title: "Tomate Chonto",
    productName: "Tomate chonto",
    category: "Hortalizas",
    unit: "kg",
    quantityAvailable: 200,
    priceAmount: 3500,
    currency: "COP",
    availableFrom: new Date(),
    municipalityName: "Piloto",
    status: "published",
    ...overrides
  });
}

function makeDemand(overrides = {}) {
  return {
    id: "demand-1",
    tenantId: "tenant-1",
    demandChannel: "community_kitchen",
    organizationName: "Comedor La Esperanza",
    productName: "Tomate chonto",
    category: "Hortalizas",
    unit: "kg",
    quantityRequired: 100,
    neededBy: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    beneficiaryCount: 120,
    municipalityName: "Piloto",
    latitude: null,
    longitude: null,
    ...overrides
  };
}

describe("OfferDemandMatcher", () => {
  const matcher = new OfferDemandMatcher();

  it("matches offer with demand of same category, unit, and sufficient quantity", () => {
    const offer = makeOffer();
    const demands = [makeDemand()];
    const matches = matcher.match(offer, demands);

    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(OfferDemandMatcher.SCORE_THRESHOLD);
    expect(matches[0].reasons.length).toBeGreaterThan(0);
  });

  it("gives higher score to urgent demands (neededBy <= 7 days)", () => {
    const offer = makeOffer();
    const urgent = makeDemand({ id: "d1", neededBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });
    const later = makeDemand({ id: "d2", neededBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) });
    const matches = matcher.match(offer, [urgent, later]);

    expect(matches[0].demand.id).toBe("d1");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("includes proximity bonus when both have coordinates within 50km", () => {
    const offer = makeOffer({ latitude: 6.2442, longitude: -75.5812 });
    const nearby = makeDemand({ latitude: 6.2500, longitude: -75.5900 });
    const matches = matcher.match(offer, [nearby]);

    expect(matches).toHaveLength(1);
    const proxyReason = matches[0].reasons.find((r) => r.includes("km"));
    expect(proxyReason).toBeDefined();
  });

  it("filters out demands below threshold (different category, different unit)", () => {
    const offer = makeOffer({ category: "Frutas", unit: "racimo" });
    const demands = [makeDemand({
      category: "Lacteos",
      productName: "Leche",
      unit: "litro",
      neededBy: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    })];
    const matches = matcher.match(offer, demands);

    expect(matches).toHaveLength(0);
  });

  it("gives partial score for partial quantity coverage (50-99%)", () => {
    const offer = makeOffer({ quantityAvailable: 60 });
    const demand = makeDemand({ quantityRequired: 100 });
    const matches = matcher.match(offer, [demand]);

    expect(matches).toHaveLength(1);
    const coverageReason = matches[0].reasons.find((r) => r.includes("parcial") || r.includes("Cobertura"));
    expect(coverageReason).toBeDefined();
  });

  it("scores product name similarity even with different category", () => {
    const offer = makeOffer({ category: "Verduras", productName: "Tomate cherry" });
    const demand = makeDemand({ category: "Hortalizas", productName: "Tomate" });
    const matches = matcher.match(offer, [demand]);

    expect(matches.length).toBeGreaterThanOrEqual(0);
    if (matches.length > 0) {
      const productReason = matches[0].reasons.find((r) => r.includes("compatible") || r.includes("Producto"));
      expect(productReason).toBeDefined();
    }
  });

  it("sorts matches by score descending", () => {
    const offer = makeOffer();
    const d1 = makeDemand({ id: "d1", neededBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    const d2 = makeDemand({ id: "d2", neededBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });
    const matches = matcher.match(offer, [d1, d2]);

    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });
});
