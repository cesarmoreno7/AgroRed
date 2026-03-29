import { describe, it, expect } from "@jest/globals";
import { Offer } from "../../domain/entities/Offer.js";
import { MatchOfferToDemands } from "./MatchOfferToDemands.js";
import type { DemandQueryPort } from "../../domain/ports/DemandQueryPort.js";
import type { NotificationPort } from "../../domain/ports/NotificationPort.js";
import type { MatchableDemand } from "../../domain/entities/MatchableDemand.js";

function makeOffer(overrides = {}): Offer {
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

function makeDemand(overrides = {}): MatchableDemand {
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

describe("MatchOfferToDemands use-case", () => {
  it("finds matching demands locally and sends notifications", async () => {
    const notifications: Array<{ recipientLabel: string }> = [];

    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async (_t, _c, _m?) => [
        makeDemand(),
        makeDemand({ id: "demand-2", organizationName: "PAE Escuela Rural", demandChannel: "school_program" })
      ]
    };

    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async (params) => {
        notifications.push({ recipientLabel: params.recipientLabel });
      }
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(result.offerId).toBe("offer-1");
    expect(result.matchesFound).toBe(2);
    expect(result.notificationsSent).toBe(2);
    expect(result.searchScope).toBe("local");
    expect(notifications).toHaveLength(2);
  });

  it("expands to regional search when no local matches", async () => {
    const calls: Array<{ municipality?: string }> = [];

    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async (_t, _c, municipality?) => {
        calls.push({ municipality });
        // Local (Piloto) → empty; Regional (no filter) → demand from another municipality
        if (municipality) return [];
        return [makeDemand({ id: "demand-remote", municipalityName: "Vecino", organizationName: "Comedor Vecino" })];
      }
    };

    const notifications: string[] = [];
    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async (params) => { notifications.push(params.recipientLabel); }
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(calls).toHaveLength(2);
    expect(calls[0].municipality).toBe("Piloto");
    expect(calls[1].municipality).toBeUndefined();
    expect(result.searchScope).toBe("regional");
    expect(result.matchesFound).toBe(1);
    expect(result.matches[0].municipalityName).toBe("Vecino");
    expect(notifications).toHaveLength(1);
  });

  it("does not expand to regional when local matches exist", async () => {
    const calls: Array<{ municipality?: string }> = [];

    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async (_t, _c, municipality?) => {
        calls.push({ municipality });
        return [makeDemand()];
      }
    };

    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async () => {}
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(calls).toHaveLength(1); // only local call, no regional expansion
    expect(result.searchScope).toBe("local");
    expect(result.matchesFound).toBe(1);
  });

  it("returns zero matches when no demands match locally or regionally", async () => {
    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async () => [
        makeDemand({
          category: "Lacteos",
          productName: "Leche",
          unit: "litro",
          neededBy: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        })
      ]
    };

    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async () => {}
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(result.matchesFound).toBe(0);
    expect(result.notificationsSent).toBe(0);
    expect(result.searchScope).toBe("regional");
  });

  it("continues sending notifications even if one fails", async () => {
    let callCount = 0;

    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async () => [
        makeDemand({ id: "d1" }),
        makeDemand({ id: "d2" })
      ]
    };

    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async () => {
        callCount++;
        if (callCount === 1) throw new Error("SMTP down");
      }
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(result.matchesFound).toBe(2);
    expect(result.notificationsSent).toBe(1);
  });

  it("returns match details with score, reasons and municipality", async () => {
    const demandQuery: DemandQueryPort = {
      findOpenDemandsByCategory: async () => [makeDemand()]
    };

    const notificationPort: NotificationPort = {
      registerOfferMatchNotification: async () => {}
    };

    const useCase = new MatchOfferToDemands(demandQuery, notificationPort);
    const result = await useCase.execute(makeOffer());

    expect(result.matches[0]).toHaveProperty("demandId", "demand-1");
    expect(result.matches[0]).toHaveProperty("organizationName", "Comedor La Esperanza");
    expect(result.matches[0]).toHaveProperty("demandChannel", "community_kitchen");
    expect(result.matches[0]).toHaveProperty("municipalityName", "Piloto");
    expect(result.matches[0].score).toBeGreaterThan(0);
    expect(result.matches[0].reasons.length).toBeGreaterThan(0);
  });
});
