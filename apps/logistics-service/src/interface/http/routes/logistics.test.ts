import express from "express";
import request from "supertest";
import { createLogisticsRouter } from "./logistics.js";
import { LogisticsOrder } from "../../../domain/entities/LogisticsOrder.js";
import type { LogisticsOrderRepository, PaginationParams, PaginatedResult } from "../../../domain/ports/LogisticsOrderRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryLogisticsOrderRepository implements LogisticsOrderRepository {
  private readonly store = new Map<string, LogisticsOrder>();

  async save(order: LogisticsOrder): Promise<void> {
    this.store.set(order.id, order);
  }

  async findById(id: string): Promise<LogisticsOrder | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<LogisticsOrder>> {
    let orders = Array.from(this.store.values());
    if (tenantId) {
      orders = orders.filter((order) => order.tenantId === tenantId);
    }
    const start = (params.page - 1) * params.limit;
    return { data: orders.slice(start, start + params.limit), total: orders.length, page: params.page, limit: params.limit };
  }
}

function buildApp(repository: LogisticsOrderRepository, auditLogger?: AuditLogger) {
  const app = express();
  app.use(express.json());
  app.use(createLogisticsRouter(repository, auditLogger));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  inventoryItemId: "33333333-3333-3333-3333-333333333333",
  demandId: null,
  routeMode: "municipal_fleet",
  originLocationName: "Centro de acopio norte",
  destinationOrganizationName: "Comedor Esperanza",
  destinationAddress: "Calle 10 # 20-30",
  scheduledPickupAt: "2026-05-27T08:00:00.000Z",
  scheduledDeliveryAt: "2026-05-27T10:00:00.000Z",
  quantityAssigned: 120,
  municipalityName: "Bogota"
};

describe("Logistics routes", () => {
  it("writes an audit event after logistics order registration", async () => {
    const repository = new InMemoryLogisticsOrderRepository();
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    const res = await request(app)
      .post("/api/v1/logistics/register")
      .set("x-user-id", "actor-logistics-1")
      .set("x-correlation-id", "corr-logistics-1")
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t-1",
      serviceName: "logistics-service",
      entityName: "logistics_orders",
      actionName: "logistics.order_registered",
      actorId: "actor-logistics-1",
      correlationId: "corr-logistics-1"
    }));
  });
});