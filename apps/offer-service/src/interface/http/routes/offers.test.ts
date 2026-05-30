import express from "express";
import request from "supertest";
import { createOffersRouter } from "./offers.js";
import { Offer } from "../../../domain/entities/Offer.js";
import type { OfferRepository, PaginationParams, PaginatedResult } from "../../../domain/ports/OfferRepository.js";
import type { DemandQueryPort, MatchableDemand } from "../../../domain/ports/DemandQueryPort.js";
import type { NotificationPort } from "../../../domain/ports/NotificationPort.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryOfferRepository implements OfferRepository {
  private readonly store = new Map<string, Offer>();

  async save(offer: Offer): Promise<void> {
    this.store.set(offer.id, offer);
  }

  async findById(id: string): Promise<Offer | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Offer>> {
    let values = Array.from(this.store.values());
    if (tenantId) {
      values = values.filter((offer) => offer.tenantId === tenantId);
    }
    const start = (params.page - 1) * params.limit;
    return { data: values.slice(start, start + params.limit), total: values.length, page: params.page, limit: params.limit };
  }
}

class EmptyDemandQuery implements DemandQueryPort {
  async findOpenDemandsForMatching(): Promise<MatchableDemand[]> {
    return [];
  }
}

class NoopNotificationPort implements NotificationPort {
  async registerOfferMatchNotification(): Promise<void> {
    return;
  }
}

function buildApp(repository: OfferRepository, auditLogger?: AuditLogger) {
  const app = express();
  app.use(express.json());
  app.use(createOffersRouter(repository, new EmptyDemandQuery(), new NoopNotificationPort(), null, auditLogger));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  producerId: "11111111-1111-1111-1111-111111111111",
  title: "Oferta papa criolla",
  productName: "Papa criolla",
  category: "Tuberculos",
  unit: "kg",
  quantityAvailable: 250,
  priceAmount: 1200,
  currency: "cop",
  availableFrom: "2026-05-27T00:00:00.000Z",
  availableUntil: "2026-05-30T00:00:00.000Z",
  municipalityName: "Bogota",
  notes: "Disponible para entrega inmediata"
};

describe("Offer routes", () => {
  it("writes an audit event after publishing an offer successfully", async () => {
    const repo = new InMemoryOfferRepository();
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repo, auditLogger);

    const res = await request(app)
      .post("/api/v1/offers/publish")
      .set("x-user-id", "actor-1")
      .set("x-correlation-id", "corr-offer-1")
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t-1",
      serviceName: "offer-service",
      entityName: "offers",
      actionName: "offer.published",
      actorId: "actor-1",
      correlationId: "corr-offer-1"
    }));
  });
});