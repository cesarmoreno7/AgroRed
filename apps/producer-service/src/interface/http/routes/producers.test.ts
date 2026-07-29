import express from "express";
import request from "supertest";
import { createProducersRouter } from "./producers.js";
import { Producer } from "../../../domain/entities/Producer.js";
import type {
  ProducerRepository,
  PaginationParams,
  PaginatedResult,
  ProducerStats
} from "../../../domain/ports/ProducerRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryProducerRepository implements ProducerRepository {
  private readonly store = new Map<string, Producer>();

  async save(producer: Producer): Promise<void> {
    this.store.set(producer.id, producer);
  }

  async saveBatch(producers: Producer[]): Promise<void> {
    for (const p of producers) this.store.set(p.id, p);
  }

  async update(producer: Producer): Promise<void> {
    this.store.set(producer.id, producer);
  }

  async softDelete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async findById(id: string): Promise<Producer | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Producer>> {
    let all = Array.from(this.store.values());
    if (tenantId) all = all.filter((p) => p.tenantId === tenantId);
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async findByOrganizationName(tenantId: string, organizationName: string): Promise<Producer | null> {
    for (const p of this.store.values()) {
      if (p.tenantId === tenantId && p.organizationName.trim().toLowerCase() === organizationName) return p;
    }
    return null;
  }

  async findStats(producerId: string): Promise<ProducerStats | null> {
    const producer = this.store.get(producerId);
    if (!producer) return null;
    return { producer, totalOffers: 0, activeOffers: 0, totalRescues: 0, totalKgRescued: 0, lastActivityAt: null, historicalProduction: [] };
  }
}

function buildApp(repo: ProducerRepository, auditLogger?: AuditLogger) {
  const app = express();
  app.use(express.json());
  app.use(createProducersRouter(repo, auditLogger));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  userId: null,
  producerType: "association",
  organizationName: "Asociación Campesina Valle",
  contactName: "Juan Pérez",
  contactPhone: "3101234567",
  municipalityName: "Buenaventura",
  zoneType: "rural",
  productCategories: ["Frutas", "Verduras"]
};

describe("Producer routes", () => {
  let repo: InMemoryProducerRepository;
  let app: express.Express;

  beforeEach(() => {
    repo = new InMemoryProducerRepository();
    app = buildApp(repo);
  });

  describe("POST /api/v1/producers/register", () => {
    it("returns 201 on valid payload", async () => {
      const res = await request(app).post("/api/v1/producers/register").send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organizationName).toBe("Asociación Campesina Valle");
      expect(res.body.data.status).toBe("pending_verification");
      expect(res.body.data.id).toBeDefined();
    });

    it("returns 400 on invalid payload", async () => {
      const res = await request(app).post("/api/v1/producers/register").send({ tenantId: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_PRODUCER_PAYLOAD");
    });

    it("returns 409 when producer already exists", async () => {
      await request(app).post("/api/v1/producers/register").send(validPayload);
      const res = await request(app).post("/api/v1/producers/register").send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PRODUCER_ALREADY_EXISTS");
    });
  });

  describe("GET /api/v1/producers", () => {
    it("returns paginated empty list", async () => {
      const res = await request(app).get("/api/v1/producers");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ total: 0, page: 1, limit: 20 });
    });

    it("returns producers with custom page/limit", async () => {
      await request(app).post("/api/v1/producers/register").send(validPayload);
      await request(app).post("/api/v1/producers/register").send({
        ...validPayload,
        organizationName: "Otra Asociación"
      });

      const res = await request(app).get("/api/v1/producers?page=1&limit=1");

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
    });

    it("scopes a regular admin_municipal to its own tenant even when other tenants have data (Bug #9 baseline)", async () => {
      await request(app).post("/api/v1/producers/register").send(validPayload);
      await request(app).post("/api/v1/producers/register").send({ ...validPayload, tenantId: "t-2", organizationName: "Otro municipio" });

      const res = await request(app).get("/api/v1/producers").set("x-tenant-id", "t-1").set("x-user-role", "admin_municipal");

      expect(res.body.pagination.total).toBe(1);
    });

    it("gives SUPERADMIN real cross-tenant visibility and audits the access (Bug #9)", async () => {
      const auditLogger = jest.fn(async () => undefined);
      const godViewApp = buildApp(repo, auditLogger);

      await request(godViewApp).post("/api/v1/producers/register").send(validPayload);
      await request(godViewApp).post("/api/v1/producers/register").send({ ...validPayload, tenantId: "t-2", organizationName: "Otro municipio" });

      const res = await request(godViewApp)
        .get("/api/v1/producers")
        .set("x-tenant-id", "t-1")
        .set("x-user-role", "SUPERADMIN")
        .set("x-user-id", "superadmin-1");

      expect(res.body.pagination.total).toBe(2);
      expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
        serviceName: "producer-service",
        entityName: "producers",
        actionName: "godview.cross_tenant_read",
        actorId: "superadmin-1"
      }));
    });
  });

  describe("GET /api/v1/producers/:id", () => {
    it("returns 404 for unknown id", async () => {
      const res = await request(app).get("/api/v1/producers/unknown");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PRODUCER_NOT_FOUND");
    });

    it("returns producer by id", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/v1/producers/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it("returns 404 for cross-tenant access", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/producers/${id}`)
        .set("x-tenant-id", "t-other");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/producers/:id", () => {
    it("returns 404 for unknown producer", async () => {
      const res = await request(app).put("/api/v1/producers/unknown").send({ contactName: "Nuevo Nombre" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PRODUCER_NOT_FOUND");
    });

    it("returns 400 with empty payload", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).put(`/api/v1/producers/${id}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PRODUCER_PAYLOAD");
    });

    it("updates producer fields", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).put(`/api/v1/producers/${id}`).send({
        contactName: "Pedro Gómez",
        contactPhone: "3209876543",
        productCategories: ["Lácteos"]
      });

      expect(res.status).toBe(200);
      expect(res.body.data.contactName).toBe("Pedro Gómez");
      expect(res.body.data.contactPhone).toBe("3209876543");
      expect(res.body.data.productCategories).toEqual(["Lácteos"]);
      expect(res.body.data.organizationName).toBe("Asociación Campesina Valle");
    });

    it("returns 404 for cross-tenant update", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/v1/producers/${id}`)
        .set("x-tenant-id", "t-other")
        .send({ contactName: "Intruso" });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/producers/:id/status", () => {
    it("returns 404 for unknown producer", async () => {
      const res = await request(app).patch("/api/v1/producers/unknown/status").send({ status: "active" });

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid status", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).patch(`/api/v1/producers/${id}/status`).send({ status: "suspended" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_PAYLOAD");
    });

    it("updates producer status to active", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      expect(created.body.data.status).toBe("pending_verification");

      const res = await request(app).patch(`/api/v1/producers/${id}/status`).send({ status: "active" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });
  });

  describe("DELETE /api/v1/producers/:id", () => {
    it("returns 404 for unknown producer", async () => {
      const res = await request(app).delete("/api/v1/producers/unknown");

      expect(res.status).toBe(404);
    });

    it("soft deletes a producer and returns 204", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const delRes = await request(app).delete(`/api/v1/producers/${id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/api/v1/producers/${id}`);
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for cross-tenant delete", async () => {
      const created = await request(app).post("/api/v1/producers/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/producers/${id}`)
        .set("x-tenant-id", "t-other");

      expect(res.status).toBe(404);
    });
  });
});
