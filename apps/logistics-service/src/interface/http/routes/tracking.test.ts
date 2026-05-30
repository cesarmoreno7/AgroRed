  it("writes an audit event after recording a position", async () => {
    const repository = new InMemoryTrackingRepository();
    // Simulate position response
    const recursoId = "22222222-2222-2222-2222-222222222222";
    repository.findResourceById = async (id: string) => new Resource({
      id,
      tenantId: "t-1",
      userId: null,
      nombre: "Moto 2",
      tipo: "moto",
      placa: null,
      telefono: null,
      estado: "disponible",
      latitude: 1.23,
      longitude: 2.34,
      metadata: {}
    });
    // Mock recordPosition and getCurrentPosition to return a valid CurrentPosition
    const currentPosition = {
      recursoId,
      nombre: "Moto 2",
      tipo: "moto",
      estado: "disponible",
      latitude: 1.23,
      longitude: 2.34,
      velocidad: null,
      bearing: null,
      evento: "posicion",
      ordenId: null,
      actualizadoAt: new Date("2026-05-27T10:00:00.000Z")
    };
    repository.recordPosition = async (_point) => currentPosition;
    repository.getCurrentPosition = async (_id) => currentPosition;
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    // The handler expects recursoId (uuid), latitude, longitude, evento (optional)
    const res = await request(app)
      .post("/api/v1/logistics/tracking/position")
      .set("x-user-id", "actor-pos-1")
      .set("x-correlation-id", "corr-pos-1")
      .send({ recursoId, latitude: 1.23, longitude: 2.34 });

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "logistics-service",
      entityName: "logistics_tracking_positions",
      actionName: "logistics.position_recorded",
      actorId: "actor-pos-1",
      correlationId: "corr-pos-1"
    }));
  });

  it("writes an audit event after recording a delivery event", async () => {
    const repository = new InMemoryTrackingRepository();
    repository.findResourceById = async (id: string) => ({
      id,
      tenantId: "t-1",
      userId: null,
      nombre: "Moto 3",
      tipo: "moto",
      placa: null,
      telefono: null,
      estado: "disponible",
      latitude: 1.11,
      longitude: 2.22,
      metadata: {}
    });
    // Simulate delivery event response
    const ordenId = "33333333-3333-3333-3333-333333333333";
    const recursoId = "44444444-4444-4444-4444-444444444444";
    const timelineEvent = {
      id: 123,
      ordenId,
      recursoId,
      recursoNombre: "Moto 3",
      evento: "entregado",
      latitude: 1.11,
      longitude: 2.22,
      notas: null,
      evidenciaUrl: null,
      registradoAt: new Date("2026-05-27T10:00:00.000Z"),
      tenantId: "t-1"
    };
    let timeline: any[] = [];
    repository.recordDeliveryEvent = async () => {
      timeline = [timelineEvent];
      return timeline;
    };
    repository.getOrderTimeline = async (_ordenId: string) => timeline;
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    // The handler expects a valid delivery event payload with UUIDs and evento
    const res = await request(app)
      .post("/api/v1/logistics/deliveries/events")
      .set("x-user-id", "actor-delivery-1")
      .set("x-correlation-id", "corr-delivery-1")
      .send({
        ordenId,
        recursoId,
        evento: "entregado"
      });

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "logistics-service",
      entityName: "logistics_delivery_events",
      actionName: "logistics.delivery_event_recorded",
      actorId: "actor-delivery-1",
      correlationId: "corr-delivery-1"
    }));
  });
import express from "express";
import request from "supertest";
import { createTrackingRouter } from "./tracking.js";
import { Resource } from "../../../domain/entities/Resource.js";
import { TrackingPoint } from "../../../domain/entities/TrackingPoint.js";
import type {
  CurrentPosition,
  DeliveryEventRecord,
  EtaEstimate,
  GeofenceCheckResult,
  GeofenceZone,
  PaginatedResult,
  PaginationParams,
  TrackingRepository
} from "../../../domain/ports/TrackingRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryTrackingRepository implements TrackingRepository {
  private readonly resources = new Map<string, Resource>();

  async saveResource(resource: Resource): Promise<void> {
    this.resources.set(resource.id, resource);
  }

  async findResourceById(id: string): Promise<Resource | null> {
    return this.resources.get(id) ?? null;
  }

  async listResources(params: PaginationParams, tenantId?: string): Promise<PaginatedResult<Resource>> {
    let data = Array.from(this.resources.values());
    if (tenantId) {
      data = data.filter((resource) => resource.tenantId === tenantId);
    }
    const start = (params.page - 1) * params.limit;
    return { data: data.slice(start, start + params.limit), total: data.length, page: params.page, limit: params.limit };
  }

  async updateResourceStatus(id: string, estado: Resource["estado"]): Promise<void> {
    const resource = this.resources.get(id);
    if (!resource) return;
    this.resources.set(id, new Resource({ ...resource, estado, updatedAt: new Date() }));
  }

  async recordPosition(_point: TrackingPoint): Promise<void> { return; }
  async getCurrentPosition(_recursoId: string): Promise<CurrentPosition | null> { return null; }
  async getActivePositions(_tenantId?: string): Promise<CurrentPosition[]> { return []; }
  async getTrackingHistory(_recursoId: string, _since?: Date): Promise<TrackingPoint[]> { return []; }
  async getRouteForOrder(_ordenId: string): Promise<TrackingPoint[]> { return []; }
  async recordDeliveryEvent(): Promise<void> { return; }
  async getOrderTimeline(_ordenId: string): Promise<DeliveryEventRecord[]> { return []; }
  async assignResourceToOrder(_ordenId: string, _recursoId: string): Promise<void> { return; }
  async saveGeofenceZone(_zone: { tenantId: string; zoneName: string; zoneType: string; centerLat: number; centerLng: number; radiusM: number; metadata?: Record<string, unknown> }): Promise<GeofenceZone> {
    return {
      id: "zone-1",
      tenantId: "t-1",
      zoneName: "zone",
      zoneType: "circle",
      centerLat: 0,
      centerLng: 0,
      radiusM: 100,
      isActive: true,
      metadata: {},
      createdAt: new Date()
    };
  }
  async listGeofenceZones(_tenantId: string): Promise<GeofenceZone[]> { return []; }
  async checkPositionInZones(_tenantId: string, _lat: number, _lng: number): Promise<GeofenceCheckResult[]> { return []; }
  async logGeofenceEvent(_zoneId: string, _recursoId: string, _eventType: string, _lat: number, _lng: number): Promise<void> { return; }
  async updateGeofenceZone(_id: string, _updates: any): Promise<GeofenceZone | null> { return null; }
  async estimateEta(_recursoId: string, _destLat: number, _destLng: number): Promise<EtaEstimate> {
    return { recursoId: "r-1", avgSpeedKmh: 20, distanceKm: 3, estimatedMinutes: 9, confidence: "medium" };
  }
}

function buildApp(repository: TrackingRepository, auditLogger?: AuditLogger) {
  const app = express();
  app.use(express.json());
  app.use(createTrackingRouter(repository, auditLogger));
  return app;
}

const resourcePayload = {
  tenantId: "t-1",
  userId: null,
  nombre: "Camion 1",
  tipo: "vehiculo",
  placa: "ABC123",
  telefono: "3000000000"
};

describe("Tracking routes", () => {
  it("writes an audit event after resource registration", async () => {
    const repository = new InMemoryTrackingRepository();
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    const res = await request(app)
      .post("/api/v1/logistics/resources/register")
      .set("x-user-id", "actor-resource-1")
      .set("x-correlation-id", "corr-resource-1")
      .send(resourcePayload);

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t-1",
      serviceName: "logistics-service",
      entityName: "logistics_resources",
      actionName: "logistics.resource_registered",
      actorId: "actor-resource-1",
      correlationId: "corr-resource-1"
    }));
  });

  it("writes an audit event after assigning a resource", async () => {
    const repository = new InMemoryTrackingRepository();
    const seeded = new Resource({
      id: "44444444-4444-4444-4444-444444444444",
      tenantId: "t-1",
      userId: null,
      nombre: "Moto 1",
      tipo: "moto",
      placa: null,
      telefono: null,
      estado: "disponible",
      latitude: null,
      longitude: null,
      metadata: {}
    });
    await repository.saveResource(seeded);

    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    const res = await request(app)
      .post("/api/v1/logistics/55555555-5555-5555-5555-555555555555/assign")
      .set("x-user-id", "actor-assign-1")
      .set("x-correlation-id", "corr-assign-1")
      .send({ recursoId: seeded.id });

    expect(res.status).toBe(200);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "logistics-service",
      entityName: "logistics_assignments",
      actionName: "logistics.resource_assigned",
      actorId: "actor-assign-1",
      correlationId: "corr-assign-1"
    }));
  });
});