import express from "express";
import request from "supertest";
import { createRescuesRouter } from "./rescues.js";
import { Rescue } from "../../../domain/entities/Rescue.js";
import type { RescueRepository, PaginationParams, PaginatedResult } from "../../../domain/ports/RescueRepository.js";

class InMemoryRescueRepository implements RescueRepository {
  private readonly store = new Map<string, Rescue>();

  async save(rescue: Rescue): Promise<void> {
    this.store.set(rescue.id, rescue);
  }

  async findById(id: string): Promise<Rescue | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Rescue>> {
    let all = Array.from(this.store.values());
    if (tenantId) all = all.filter((r) => r.tenantId === tenantId);
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

function buildApp(repo: RescueRepository) {
  const app = express();
  app.use(express.json());
  app.use(createRescuesRouter(repo));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  producerId: "00000000-0000-0000-0000-000000000001",
  offerId: null,
  rescueChannel: "food_bank",
  destinationOrganizationName: "Banco de Alimentos Cali",
  productName: "Plátano",
  category: "Frutas",
  unit: "kg",
  quantityRescued: 200,
  scheduledAt: "2025-07-01T08:00:00Z",
  beneficiaryCount: 50,
  municipalityName: "Buenaventura",
  notes: "Entrega programada"
};

describe("Rescue routes", () => {
  let repo: InMemoryRescueRepository;
  let app: express.Express;

  beforeEach(() => {
    repo = new InMemoryRescueRepository();
    app = buildApp(repo);
  });

  describe("POST /api/v1/rescues/register", () => {
    it("returns 201 on valid payload", async () => {
      const res = await request(app).post("/api/v1/rescues/register").send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productName).toBe("Plátano");
      expect(res.body.data.status).toBe("scheduled");
      expect(res.body.data.id).toBeDefined();
    });

    it("returns 400 on invalid payload", async () => {
      const res = await request(app).post("/api/v1/rescues/register").send({ tenantId: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_RESCUE_PAYLOAD");
    });

    it("persists rescue in repository", async () => {
      const res = await request(app).post("/api/v1/rescues/register").send(validPayload);
      const saved = await repo.findById(res.body.data.id);

      expect(saved).not.toBeNull();
      expect(saved!.quantityRescued).toBe(200);
    });
  });

  describe("GET /api/v1/rescues", () => {
    it("returns paginated empty list", async () => {
      const res = await request(app).get("/api/v1/rescues");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ total: 0, page: 1, limit: 20 });
    });

    it("returns rescues with pagination", async () => {
      await request(app).post("/api/v1/rescues/register").send(validPayload);
      await request(app).post("/api/v1/rescues/register").send(validPayload);

      const res = await request(app).get("/api/v1/rescues?page=1&limit=1");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.limit).toBe(1);
    });

    it("filters by tenant when x-tenant-id header is set", async () => {
      await request(app).post("/api/v1/rescues/register").send(validPayload);
      await request(app).post("/api/v1/rescues/register").send({ ...validPayload, tenantId: "t-other" });

      const res = await request(app).get("/api/v1/rescues").set("x-tenant-id", "t-1");

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tenantId).toBe("t-1");
    });
  });

  describe("GET /api/v1/rescues/:id", () => {
    it("returns 404 for unknown id", async () => {
      const res = await request(app).get("/api/v1/rescues/unknown-id");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RESCUE_NOT_FOUND");
    });

    it("returns rescue by id", async () => {
      const created = await request(app).post("/api/v1/rescues/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/v1/rescues/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.productName).toBe("Plátano");
    });

    it("returns 404 for cross-tenant access", async () => {
      const created = await request(app).post("/api/v1/rescues/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app)
        .get(`/api/v1/rescues/${id}`)
        .set("x-tenant-id", "t-other");

      expect(res.status).toBe(404);
    });
  });
});
