import express from "express";
import request from "supertest";
import { createInstitutionsRouter } from "./institutions.js";
import { Institution } from "../../../domain/entities/Institution.js";
import type {
  InstitutionRepository,
  PaginationParams,
  PaginatedResult
} from "../../../domain/ports/InstitutionRepository.js";

class InMemoryInstitutionRepository implements InstitutionRepository {
  private readonly store = new Map<string, Institution>();
  public readonly statusLog: import("../../../domain/ports/InstitutionRepository.js").StatusHistoryEntry[] = [];

  async save(institution: Institution): Promise<void> {
    this.store.set(institution.id, institution);
  }

  async saveBatch(institutions: Institution[]): Promise<void> {
    for (const inst of institutions) this.store.set(inst.id, inst);
  }

  async update(institution: Institution): Promise<void> {
    this.store.set(institution.id, institution);
  }

  async softDelete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async findById(id: string): Promise<Institution | null> {
    return this.store.get(id) ?? null;
  }

  async findByName(tenantId: string, name: string): Promise<Institution | null> {
    for (const inst of this.store.values()) {
      if (inst.tenantId === tenantId && inst.name.toLowerCase() === name.toLowerCase()) return inst;
    }
    return null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Institution>> {
    let all = Array.from(this.store.values());
    if (tenantId) all = all.filter((i) => i.tenantId === tenantId);
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async logStatusChange(entry: import("../../../domain/ports/InstitutionRepository.js").StatusHistoryEntry): Promise<void> {
    this.statusLog.push(entry);
  }
}

function buildApp(repo: InstitutionRepository) {
  const app = express();
  app.use(express.json());
  app.use(createInstitutionsRouter(repo));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  institutionType: "educational",
  name: "Colegio Nacional San José",
  contactName: "María López",
  contactPhone: "3101234567",
  municipalityName: "Buenaventura",
  beneficiaryCount: 500,
  productCategories: ["Frutas", "Verduras", "Lácteos"]
};

describe("Institution routes", () => {
  let repo: InMemoryInstitutionRepository;
  let app: express.Express;

  beforeEach(() => {
    repo = new InMemoryInstitutionRepository();
    app = buildApp(repo);
  });

  describe("POST /api/v1/institutions/register", () => {
    it("returns 201 on valid payload", async () => {
      const res = await request(app).post("/api/v1/institutions/register").send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Colegio Nacional San José");
      expect(res.body.data.status).toBe("pending_verification");
      expect(res.body.data.id).toBeDefined();
    });

    it("returns 400 on invalid payload", async () => {
      const res = await request(app).post("/api/v1/institutions/register").send({ tenantId: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INSTITUTION_PAYLOAD");
    });

    it("returns 409 when institution already exists", async () => {
      await request(app).post("/api/v1/institutions/register").send(validPayload);
      const res = await request(app).post("/api/v1/institutions/register").send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INSTITUTION_ALREADY_EXISTS");
    });
  });

  describe("GET /api/v1/institutions", () => {
    it("returns paginated empty list", async () => {
      const res = await request(app).get("/api/v1/institutions");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ total: 0, page: 1, limit: 20 });
    });

    it("returns institutions with pagination", async () => {
      await request(app).post("/api/v1/institutions/register").send(validPayload);
      await request(app).post("/api/v1/institutions/register").send({ ...validPayload, name: "Hospital Regional" });

      const res = await request(app).get("/api/v1/institutions?page=1&limit=1");

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe("GET /api/v1/institutions/:id", () => {
    it("returns 404 for unknown id", async () => {
      const res = await request(app).get("/api/v1/institutions/unknown");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("INSTITUTION_NOT_FOUND");
    });

    it("returns institution by id", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/v1/institutions/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it("returns 404 for cross-tenant access", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/v1/institutions/${id}`).set("x-tenant-id", "t-other");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/institutions/:id", () => {
    it("returns 404 for unknown institution", async () => {
      const res = await request(app).put("/api/v1/institutions/unknown").send({ contactName: "Nuevo" });

      expect(res.status).toBe(404);
    });

    it("returns 400 with empty payload", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).put(`/api/v1/institutions/${id}`).send({});

      expect(res.status).toBe(400);
    });

    it("updates institution fields", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).put(`/api/v1/institutions/${id}`).send({
        contactName: "Carlos Ruiz",
        beneficiaryCount: 750,
        productCategories: ["Cereales"]
      });

      expect(res.status).toBe(200);
      expect(res.body.data.contactName).toBe("Carlos Ruiz");
      expect(res.body.data.beneficiaryCount).toBe(750);
      expect(res.body.data.productCategories).toEqual(["Cereales"]);
      expect(res.body.data.name).toBe("Colegio Nacional San José");
    });
  });

  describe("PATCH /api/v1/institutions/:id/status", () => {
    it("returns 400 for invalid status", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const res = await request(app).patch(`/api/v1/institutions/${id}/status`).send({ status: "suspended" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_PAYLOAD");
    });

    it("activates an institution", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      expect(created.body.data.status).toBe("pending_verification");

      const res = await request(app).patch(`/api/v1/institutions/${id}/status`).send({ status: "active" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });
  });

  describe("DELETE /api/v1/institutions/:id", () => {
    it("returns 404 for unknown institution", async () => {
      const res = await request(app).delete("/api/v1/institutions/unknown");

      expect(res.status).toBe(404);
    });

    it("soft deletes and returns 204", async () => {
      const created = await request(app).post("/api/v1/institutions/register").send(validPayload);
      const id = created.body.data.id;

      const delRes = await request(app).delete(`/api/v1/institutions/${id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/api/v1/institutions/${id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
