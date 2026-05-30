import express from "express";
import request from "supertest";
import { createIncidentsRouter } from "./incidents.js";
import { Incident } from "../../../domain/entities/Incident.js";
import type {
  AlertThreshold,
  IncidentAction,
  IncidentAlert,
  IncidentCluster,
  IncidentListFilter,
  IncidentRepository,
  IncidentTrend,
  PaginationParams,
  PaginatedResult,
  ZoneSummary
} from "../../../domain/ports/IncidentRepository.js";
import type { IncidentStatus } from "../../../domain/value-objects/IncidentStatus.js";
import type { AuditLogger } from "../../../shared/audit.js";

class InMemoryIncidentRepository implements IncidentRepository {
  private readonly store = new Map<string, Incident>();

  async save(incident: Incident): Promise<void> {
    this.store.set(incident.id, incident);
  }

  async findById(id: string): Promise<Incident | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, filter?: IncidentListFilter): Promise<PaginatedResult<Incident>> {
    let incidents = Array.from(this.store.values());
    if (filter?.tenantId) {
      incidents = incidents.filter((incident) => incident.tenantId === filter.tenantId);
    }
    const start = (params.page - 1) * params.limit;
    return { data: incidents.slice(start, start + params.limit), total: incidents.length, page: params.page, limit: params.limit };
  }

  async updateStatus(_id: string, _status: IncidentStatus): Promise<void> { return; }
  async saveAction(_action: IncidentAction): Promise<void> { return; }
  async listActions(_incidentId: string): Promise<IncidentAction[]> { return []; }
  async saveAlert(_alert: IncidentAlert): Promise<void> { return; }
  async listAlerts(_tenantId: string, params: PaginationParams): Promise<PaginatedResult<IncidentAlert>> {
    return { data: [], total: 0, page: params.page, limit: params.limit };
  }
  async acknowledgeAlert(): Promise<void> { return; }
  async getZoneSummary(_tenantId: string): Promise<ZoneSummary[]> { return []; }
  async countByZoneAndSeverity(_tenantId: string): Promise<{ zone: string; severity: string; count: number }[]> { return []; }
  async countRecentByZone(_tenantId: string, _hoursBack: number): Promise<{ zone: string; count: number; criticalCount: number }[]> { return []; }
  async countUnattended(_tenantId: string, _hoursThreshold: number): Promise<number> { return 0; }
  async getIncidentClusters(_tenantId: string, _radiusM?: number, _minPoints?: number): Promise<IncidentCluster[]> { return []; }
  async getIncidentTrends(_tenantId: string, _granularity?: "daily" | "weekly", _limit?: number): Promise<IncidentTrend[]> { return []; }
  async getAlertThresholds(_tenantId: string): Promise<AlertThreshold[]> { return []; }
  async upsertAlertThreshold(_tenantId: string, _ruleKey: string, _value: number): Promise<AlertThreshold> {
    return {
      id: "threshold-1",
      tenantId: "t-1",
      ruleKey: "incident.test",
      value: 1,
      description: null,
      updatedBy: null,
      updatedAt: new Date()
    };
  }
}

function buildApp(repository: IncidentRepository, auditLogger?: AuditLogger) {
  const app = express();
  app.use(express.json());
  app.use(createIncidentsRouter(repository, auditLogger));
  return app;
}

const validPayload = {
  tenantId: "t-1",
  logisticsOrderId: null,
  incidentType: "access_blockage",
  severity: "high",
  title: "Bloqueo en via principal",
  description: "Se presenta bloqueo por manifestacion que afecta la movilidad.",
  locationDescription: "Avenida principal con calle 10",
  occurredAt: "2026-05-27T10:00:00.000Z",
  municipalityName: "Bogota",
  reportedBy: "brigada-1",
  reporterRole: "monitoring_agent",
  affectedPopulation: 250
};

describe("Incident routes", () => {
  it("writes an audit event after incident registration", async () => {
    const repository = new InMemoryIncidentRepository();
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    const res = await request(app)
      .post("/api/v1/incidents/register")
      .set("x-user-id", "actor-incident-1")
      .set("x-correlation-id", "corr-incident-1")
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t-1",
      serviceName: "incident-service",
      entityName: "incidents",
      actionName: "incident.registered",
      actorId: "actor-incident-1",
      correlationId: "corr-incident-1"
    }));
  });

  it("writes an audit event after incident status update", async () => {
    // Arrange: create and save an incident
    const repository = new InMemoryIncidentRepository();
    const incident = new Incident({
      ...validPayload,
      id: "incident-1",
      status: "open",
      createdAt: new Date("2026-05-27T09:00:00.000Z")
    });
    await repository.save(incident);
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    // Act: update status (include all required fields)
    const res = await request(app)
      .patch("/api/v1/incidents/incident-1/status")
      .set("x-user-id", "actor-status-1")
      .set("x-correlation-id", "corr-status-1")
      .send({ status: "en_analisis", performedBy: "actor-status-1", assignedTo: "actor-status-1", resolutionNotes: "En análisis" });

    // Assert
    expect(res.status).toBe(200);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "incident-service",
      entityName: "incidents",
      actionName: "incident.status_updated",
      actorId: "actor-status-1",
      correlationId: "corr-status-1"
    }));
  });

  it("writes an audit event after registering an incident action", async () => {
    // Arrange: create and save an incident
    const repository = new InMemoryIncidentRepository();
    const incident = new Incident({
      ...validPayload,
      id: "incident-2",
      status: "open",
      createdAt: new Date("2026-05-27T09:00:00.000Z")
    });
    await repository.save(incident);
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    // Act: register action (include all required fields)
    const res = await request(app)
      .post("/api/v1/incidents/incident-2/actions")
      .set("x-user-id", "actor-action-1")
      .set("x-correlation-id", "corr-action-1")
      .send({ actionType: "intervene", performedBy: "actor-action-1", description: "Se realizó intervención", metadata: {} });

    // Assert
    expect(res.status).toBe(201);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "incident-service",
      entityName: "incident_actions",
      actionName: "incident.action_registered",
      actorId: "actor-action-1",
      correlationId: "corr-action-1"
    }));
  });

  it("writes an audit event after prioritizing an incident", async () => {
    // Arrange: create and save an incident
    const repository = new InMemoryIncidentRepository();
    const incident = new Incident({
      ...validPayload,
      id: "incident-3",
      status: "open",
      createdAt: new Date("2026-05-27T09:00:00.000Z")
    });
    await repository.save(incident);
    const auditLogger = jest.fn(async () => undefined);
    const app = buildApp(repository, auditLogger);

    // Act: prioritize
    const res = await request(app)
      .post("/api/v1/incidents/incident-3/prioritize")
      .set("x-user-id", "actor-prio-1")
      .set("x-correlation-id", "corr-prio-1")
      .send({ tenantId: "t-1" });

    // Assert
    expect(res.status).toBe(200);
    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      serviceName: "incident-service",
      entityName: "incidents",
      actionName: "incident.prioritized",
      actorId: "actor-prio-1",
      correlationId: "corr-prio-1"
    }));
  });
});