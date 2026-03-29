import { RegisterIncident } from "./RegisterIncident.js";
import type { Incident } from "../../domain/entities/Incident.js";
import type {
  IncidentRepository,
  PaginationParams,
  PaginatedResult,
  IncidentAction,
  IncidentAlert,
  IncidentCluster,
  IncidentTrend,
  ZoneSummary,
  AlertThreshold,
  IncidentListFilter
} from "../../domain/ports/IncidentRepository.js";
import type { IncidentStatus } from "../../domain/value-objects/IncidentStatus.js";

class InMemoryIncidentRepository implements IncidentRepository {
  private readonly store = new Map<string, Incident>();

  async save(incident: Incident): Promise<void> {
    this.store.set(incident.id, incident);
  }

  async findById(id: string): Promise<Incident | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, _filter?: IncidentListFilter): Promise<PaginatedResult<Incident>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async updateStatus(_id: string, _status: IncidentStatus, _fields?: Partial<Record<string, unknown>>): Promise<void> { /* noop */ }
  async saveAction(_action: IncidentAction): Promise<void> { /* noop */ }
  async listActions(_incidentId: string): Promise<IncidentAction[]> { return []; }
  async saveAlert(_alert: IncidentAlert): Promise<void> { /* noop */ }
  async listAlerts(_tenantId: string, _params: PaginationParams): Promise<PaginatedResult<IncidentAlert>> { return { data: [], total: 0, page: 1, limit: 20 }; }
  async acknowledgeAlert(_alertId: string, _acknowledgedBy: string): Promise<void> { /* noop */ }
  async getZoneSummary(_tenantId: string): Promise<ZoneSummary[]> { return []; }
  async countByZoneAndSeverity(_tenantId: string): Promise<{ zone: string; severity: string; count: number }[]> { return []; }
  async countRecentByZone(_tenantId: string, _hoursBack: number): Promise<{ zone: string; count: number; criticalCount: number }[]> { return []; }
  async countUnattended(_tenantId: string, _hoursThreshold: number): Promise<number> { return 0; }
  async getIncidentClusters(_tenantId: string, _radiusM?: number, _minPoints?: number): Promise<IncidentCluster[]> { return []; }
  async getIncidentTrends(_tenantId: string, _granularity?: "daily" | "weekly", _limit?: number): Promise<IncidentTrend[]> { return []; }
  async getAlertThresholds(_tenantId: string): Promise<AlertThreshold[]> { return []; }
  async upsertAlertThreshold(_tenantId: string, _ruleKey: string, _value: number, _updatedBy?: string): Promise<AlertThreshold> { return {} as AlertThreshold; }
}

describe("RegisterIncident use-case", () => {
  let repository: InMemoryIncidentRepository;
  let useCase: RegisterIncident;

  beforeEach(() => {
    repository = new InMemoryIncidentRepository();
    useCase = new RegisterIncident(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    logisticsOrderId: "lo-1",
    incidentType: "route_delay" as const,
    severity: "medium" as const,
    title: "Demora en ruta Tuluá-Cali",
    description: "El vehículo reporta retraso de 2 horas por cierre vial en la vía panorama.",
    locationDescription: "Km 42 Vía Panorama",
    latitude: 3.75,
    longitude: -76.25,
    occurredAt: new Date("2025-07-01T14:30:00Z"),
    municipalityName: "Tuluá"
  };

  it("registers an incident successfully", async () => {
    const incident = await useCase.execute(validCommand);

    expect(incident.id).toBeDefined();
    expect(incident.status).toBe("reportada");
    expect(incident.incidentType).toBe("route_delay");
    expect(incident.severity).toBe("medium");
    expect(incident.title).toBe("Demora en ruta Tuluá-Cali");
  });

  it("saves the incident to the repository", async () => {
    const incident = await useCase.execute(validCommand);
    const found = await repository.findById(incident.id);
    expect(found).not.toBeNull();
    expect(found!.incidentType).toBe("route_delay");
  });

  it("works without logisticsOrderId", async () => {
    const incident = await useCase.execute({ ...validCommand, logisticsOrderId: null });
    expect(incident.logisticsOrderId).toBeNull();
  });

  it("works without coordinates", async () => {
    const incident = await useCase.execute({ ...validCommand, latitude: null, longitude: null });
    expect(incident.latitude).toBeNull();
    expect(incident.longitude).toBeNull();
  });

  it("throws INVALID_INCIDENT_OCCURRED_AT for invalid date", async () => {
    await expect(
      useCase.execute({ ...validCommand, occurredAt: new Date("invalid") })
    ).rejects.toThrow("INVALID_INCIDENT_OCCURRED_AT");
  });

  it("throws INVALID_INCIDENT_COORDINATES for only latitude", async () => {
    await expect(
      useCase.execute({ ...validCommand, latitude: 3.75, longitude: null })
    ).rejects.toThrow("INVALID_INCIDENT_COORDINATES");
  });

  it("throws INVALID_INCIDENT_COORDINATES for out of range", async () => {
    await expect(
      useCase.execute({ ...validCommand, latitude: 100, longitude: -76.25 })
    ).rejects.toThrow("INVALID_INCIDENT_COORDINATES");
  });
});
