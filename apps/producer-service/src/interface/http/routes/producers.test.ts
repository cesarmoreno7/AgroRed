import express from "express";
import request from "supertest";
import { createProducersRouter } from "./producers.js";
import { Producer } from "../../../domain/entities/Producer.js";
import type {
  ProducerRepository,
  PaginationParams,
  PaginatedResult
} from "../../../domain/ports/ProducerRepository.js";

class InMemoryProducerRepository implements ProducerRepository {
  private readonly store = new Map<string, Producer>();

  async save(producer: Producer): Promise<void> {
    this.store.set(producer.id, producer);
  }

  async saveBatch(producers: Producer[]): Promise<void> {
    for (const p of producers) this.store.set(p.id, p);
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
}

function buildApp(repo: ProducerRepository) {
  const app = express();
  app.use(express.json());
  app.use(createProducersRouter(repo));
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
});
