import express from "express";
import request from "supertest";
import { createDemandsRouter } from "./demands.js";
import { Demand } from "../../../domain/entities/Demand.js";
import type { DemandRepository, PaginationParams, PaginatedResult } from "../../../domain/ports/DemandRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryDemandRepository implements DemandRepository {
  private readonly store = new Map<string, Demand>();

  async save(demand: Demand): Promise<void> {
    this.store.set(demand.id, demand);
  }

  async findById(id: string): Promise<Demand | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Demand>> {
    let values = Array.from(this.store.values());
    if (tenantId) {
      values = values.filter((demand) => demand.tenantId === tenantId);
    }
    const start = (params.page - 1) * params.limit;
    return { data: values.slice(start, start + params.limit), total: values.length, page: params.page, limit: params.limit };
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<Demand | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = new Demand({ ...existing, ...fields } as ConstructorParameters<typeof Demand>[0]);
    this.store.set(id, updated);
    return updated;
  }
}

function buildApp(repository: DemandRepository, auditLogger?: AuditLogger, onIratRecheck?: (reason: string) => void) {
  const app = express();
  app.use(express.json());
  app.use(createDemandsRouter(repository, auditLogger, onIratRecheck));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  responsibleUserId: "22222222-2222-2222-2222-222222222222",
  demandChannel: "community_kitchen",
  organizationName: "Comedor Central",
  productName: "Arroz",
  category: "Granos",
  unit: "kg",
  quantityRequired: 180,
  neededBy: "2026-05-28T00:00:00.000Z",
  beneficiaryCount: 120,
  municipalityName: "Bogota",
  notes: "Urgente"
};

describe("Demand routes", () => {
  it("writes an audit event after registering a demand successfully", async () => {
    const repo = new InMemoryDemandRepository();
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repo, auditLogger);

    const res = await request(app)
      .post("/api/v1/demands/register")
      .set("x-user-id", "actor-2")
      .set("x-correlation-id", "corr-demand-1")
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t-1",
      serviceName: "demand-service",
      entityName: "demands",
      actionName: "demand.registered",
      actorId: "actor-2",
      correlationId: "corr-demand-1"
    }));
  });

  describe("IRAT real-time recheck trigger (Bug #11)", () => {
    it("triggers a recheck after registering a demand", async () => {
      const repo = new InMemoryDemandRepository();
      const onIratRecheck = jest.fn();
      const app = buildApp(repo, undefined, onIratRecheck);

      const res = await request(app).post("/api/v1/demands/register").send(validPayload);

      expect(res.status).toBe(201);
      expect(onIratRecheck).toHaveBeenCalledWith("demand.registered");
    });

    it("triggers a recheck when a demand transitions to closed", async () => {
      const repo = new InMemoryDemandRepository();
      const onIratRecheck = jest.fn();
      const app = buildApp(repo, undefined, onIratRecheck);

      const created = await request(app).post("/api/v1/demands/register").send(validPayload);
      onIratRecheck.mockClear();
      const id = created.body.data.id;

      const res = await request(app).patch(`/api/v1/demands/${id}`).send({ status: "closed" });

      expect(res.status).toBe(200);
      expect(onIratRecheck).toHaveBeenCalledWith("demand.closed");
    });

    it("does not trigger a recheck for unrelated field updates", async () => {
      const repo = new InMemoryDemandRepository();
      const onIratRecheck = jest.fn();
      const app = buildApp(repo, undefined, onIratRecheck);

      const created = await request(app).post("/api/v1/demands/register").send(validPayload);
      onIratRecheck.mockClear();
      const id = created.body.data.id;

      const res = await request(app).patch(`/api/v1/demands/${id}`).send({ notes: "Actualizacion menor" });

      expect(res.status).toBe(200);
      expect(onIratRecheck).not.toHaveBeenCalled();
    });
  });
});