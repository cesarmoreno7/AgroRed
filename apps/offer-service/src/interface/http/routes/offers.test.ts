import express from "express";
import request from "supertest";
import { createOffersRouter } from "./offers.js";
import { Offer } from "../../../domain/entities/Offer.js";
import type { OfferRepository, PaginationParams, PaginatedResult } from "../../../domain/ports/OfferRepository.js";
import type { DemandQueryPort, MatchableDemand } from "../../../domain/ports/DemandQueryPort.js";
import type { NotificationPort } from "../../../domain/ports/NotificationPort.js";
import type { AuditLogger } from "../../../shared/audit.js";
import { Producer } from "../../../../../producer-service/src/domain/entities/Producer.js";
import type { ProducerRepository } from "../../../../../producer-service/src/domain/ports/ProducerRepository.js";

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

  async patch(id: string, fields: Record<string, unknown>): Promise<Offer | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = new Offer({ ...existing, ...fields } as ConstructorParameters<typeof Offer>[0]);
    this.store.set(id, updated);
    return updated;
  }

  async findLatestActiveByProducerId(producerId: string): Promise<Offer | null> {
    return Array.from(this.store.values()).find((o) => o.producerId === producerId && o.status === "published") ?? null;
  }
}

class InMemoryProducerRepository implements ProducerRepository {
  constructor(private readonly producers: Producer[]) {}
  async save(): Promise<void> {}
  async saveBatch(): Promise<void> {}
  async update(): Promise<void> {}
  async softDelete(): Promise<boolean> { return false; }
  async findById(id: string): Promise<Producer | null> {
    return this.producers.find((p) => p.id === id) ?? null;
  }
  async list(): Promise<PaginatedResult<Producer>> {
    return { data: this.producers, total: this.producers.length, page: 1, limit: 20 };
  }
  async findByOrganizationName(): Promise<Producer | null> { return null; }
  async findByUserId(userId: string): Promise<Producer | null> {
    return this.producers.find((p) => p.userId === userId) ?? null;
  }
  async findStats(): Promise<null> { return null; }
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

function buildApp(repository: OfferRepository, auditLogger?: AuditLogger, producerRepository?: ProducerRepository) {
  const app = express();
  app.use(express.json());
  app.use(createOffersRouter(repository, new EmptyDemandQuery(), new NoopNotificationPort(), null, auditLogger, producerRepository));
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

  describe("PATCH /api/v1/offers/:id ownership (Bug #6)", () => {
    const ownerProducer = new Producer({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "t-1",
      userId: "user-owner",
      producerType: "individual",
      organizationName: "Finca A",
      contactName: "Juan",
      contactPhone: "3001112233",
      municipalityName: "Rionegro",
      zoneType: "urban_periphery",
      productCategories: ["hortalizas"],
      status: "active"
    });

    const otherProducer = new Producer({
      id: "22222222-2222-2222-2222-222222222222",
      tenantId: "t-1",
      userId: "user-other",
      producerType: "individual",
      organizationName: "Finca B",
      contactName: "Ana",
      contactPhone: "3004445566",
      municipalityName: "Rionegro",
      zoneType: "urban_periphery",
      productCategories: ["frutas"],
      status: "active"
    });

    async function seedOffer(repo: InMemoryOfferRepository) {
      const offer = new Offer({
        id: "offer-1",
        tenantId: "t-1",
        producerId: ownerProducer.id,
        title: "Oferta papa criolla",
        productName: "Papa criolla",
        category: "Tuberculos",
        unit: "kg",
        quantityAvailable: 250,
        priceAmount: 1200,
        currency: "COP",
        availableFrom: new Date("2026-05-27T00:00:00.000Z"),
        municipalityName: "Rionegro",
        status: "published"
      });
      await repo.save(offer);
      return offer;
    }

    it("blocks a producer from editing another producer's offer in the same tenant", async () => {
      const repo = new InMemoryOfferRepository();
      await seedOffer(repo);
      const producerRepo = new InMemoryProducerRepository([ownerProducer, otherProducer]);
      const app = buildApp(repo, undefined, producerRepo);

      const res = await request(app)
        .patch("/api/v1/offers/offer-1")
        .set("x-tenant-id", "t-1")
        .set("x-user-role", "producer")
        .set("x-user-id", "user-other")
        .send({ title: "Intento de edicion ajena" });

      expect(res.status).toBe(403);
    });

    it("allows the owning producer to edit their own offer", async () => {
      const repo = new InMemoryOfferRepository();
      await seedOffer(repo);
      const producerRepo = new InMemoryProducerRepository([ownerProducer, otherProducer]);
      const app = buildApp(repo, undefined, producerRepo);

      const res = await request(app)
        .patch("/api/v1/offers/offer-1")
        .set("x-tenant-id", "t-1")
        .set("x-user-role", "producer")
        .set("x-user-id", "user-owner")
        .send({ title: "Papa criolla actualizada" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Papa criolla actualizada");
    });

    it("allows admin_municipal to edit any offer within the tenant regardless of ownership", async () => {
      const repo = new InMemoryOfferRepository();
      await seedOffer(repo);
      const producerRepo = new InMemoryProducerRepository([ownerProducer, otherProducer]);
      const app = buildApp(repo, undefined, producerRepo);

      const res = await request(app)
        .patch("/api/v1/offers/offer-1")
        .set("x-tenant-id", "t-1")
        .set("x-user-role", "admin_municipal")
        .set("x-user-id", "admin-1")
        .send({ title: "Editado por admin" });

      expect(res.status).toBe(200);
    });
  });
});