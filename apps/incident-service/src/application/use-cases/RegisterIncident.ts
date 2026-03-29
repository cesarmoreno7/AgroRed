import { randomUUID } from "node:crypto";
import { Incident } from "../../domain/entities/Incident.js";
import type { IncidentRepository } from "../../domain/ports/IncidentRepository.js";
import type { IncidentSeverity } from "../../domain/value-objects/IncidentSeverity.js";
import type { IncidentType } from "../../domain/value-objects/IncidentType.js";

export interface RegisterIncidentCommand {
  tenantId: string;
  logisticsOrderId?: string | null;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  locationDescription: string;
  latitude?: number | null;
  longitude?: number | null;
  occurredAt: Date;
  municipalityName: string;
  notes?: string | null;
  // Extended
  reportedBy?: string | null;
  reporterRole?: string | null;
  affectedPopulation?: number;
  affectedCommunity?: string | null;
  evidenceUrls?: string[];
  parentIncidentId?: string | null;
}

export class RegisterIncident {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(command: RegisterIncidentCommand): Promise<Incident> {
    const occurredAt = new Date(command.occurredAt);
    const latitude = command.latitude ?? null;
    const longitude = command.longitude ?? null;

    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error("INVALID_INCIDENT_OCCURRED_AT");
    }

    if ((latitude === null) !== (longitude === null)) {
      throw new Error("INVALID_INCIDENT_COORDINATES");
    }

    if (latitude !== null && (latitude < -90 || latitude > 90 || longitude! < -180 || longitude! > 180)) {
      throw new Error("INVALID_INCIDENT_COORDINATES");
    }

    const incident = new Incident({
      id: randomUUID(),
      tenantId: command.tenantId,
      logisticsOrderId: command.logisticsOrderId ?? null,
      incidentType: command.incidentType,
      severity: command.severity,
      title: command.title,
      description: command.description,
      locationDescription: command.locationDescription,
      latitude,
      longitude,
      occurredAt,
      municipalityName: command.municipalityName,
      notes: command.notes ?? null,
      status: "reportada",
      reportedBy: command.reportedBy ?? null,
      reporterRole: command.reporterRole ?? null,
      affectedPopulation: command.affectedPopulation ?? 0,
      affectedCommunity: command.affectedCommunity ?? null,
      evidenceUrls: command.evidenceUrls ?? [],
      parentIncidentId: command.parentIncidentId ?? null,
    });

    await this.repository.save(incident);

    return incident;
  }
}