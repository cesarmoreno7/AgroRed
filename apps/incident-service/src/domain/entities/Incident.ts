import type { IncidentType } from "../value-objects/IncidentType.js";
import type { IncidentSeverity } from "../value-objects/IncidentSeverity.js";
import type { IncidentStatus } from "../value-objects/IncidentStatus.js";

export interface IncidentProps {
  id: string;
  tenantId: string;
  logisticsOrderId: string | null;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  locationDescription: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: Date;
  municipalityName: string;
  notes?: string | null;
  status: IncidentStatus;
  // Extended fields (Módulo Incidencias y Riesgos Sociales)
  reportedBy?: string | null;
  reporterRole?: string | null;
  affectedPopulation?: number;
  affectedCommunity?: string | null;
  evidenceUrls?: string[];
  assignedTo?: string | null;
  priorityScore?: number;
  resolutionNotes?: string | null;
  resolvedAt?: Date | null;
  escalatedAt?: Date | null;
  interventionStartedAt?: Date | null;
  recurrenceCount?: number;
  parentIncidentId?: string | null;
  // SLA tracking
  slaTargetMinutes?: number | null;
  firstResponseAt?: Date | null;
  responseTimeMinutes?: number | null;
  createdAt?: Date;
}

export class Incident {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly logisticsOrderId: string | null;
  public readonly incidentType: IncidentType;
  public readonly severity: IncidentSeverity;
  public readonly title: string;
  public readonly description: string;
  public readonly locationDescription: string;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly occurredAt: Date;
  public readonly municipalityName: string;
  public readonly notes: string | null;
  public readonly status: IncidentStatus;
  // Extended fields
  public readonly reportedBy: string | null;
  public readonly reporterRole: string | null;
  public readonly affectedPopulation: number;
  public readonly affectedCommunity: string | null;
  public readonly evidenceUrls: string[];
  public readonly assignedTo: string | null;
  public readonly priorityScore: number;
  public readonly resolutionNotes: string | null;
  public readonly resolvedAt: Date | null;
  public readonly escalatedAt: Date | null;
  public readonly interventionStartedAt: Date | null;
  public readonly recurrenceCount: number;
  public readonly parentIncidentId: string | null;
  // SLA tracking
  public readonly slaTargetMinutes: number | null;
  public readonly firstResponseAt: Date | null;
  public readonly responseTimeMinutes: number | null;
  public readonly createdAt: Date;

  constructor(props: IncidentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.logisticsOrderId = props.logisticsOrderId;
    this.incidentType = props.incidentType;
    this.severity = props.severity;
    this.title = props.title.trim();
    this.description = props.description.trim();
    this.locationDescription = props.locationDescription.trim();
    this.latitude = props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === null ? null : Number(props.longitude);
    this.occurredAt = new Date(props.occurredAt);
    this.municipalityName = props.municipalityName.trim();
    this.notes = props.notes?.trim() || null;
    this.status = props.status;
    // Extended
    this.reportedBy = props.reportedBy?.trim() || null;
    this.reporterRole = props.reporterRole?.trim() || null;
    this.affectedPopulation = props.affectedPopulation ?? 0;
    this.affectedCommunity = props.affectedCommunity?.trim() || null;
    this.evidenceUrls = props.evidenceUrls ?? [];
    this.assignedTo = props.assignedTo?.trim() || null;
    this.priorityScore = props.priorityScore ?? 0;
    this.resolutionNotes = props.resolutionNotes?.trim() || null;
    this.resolvedAt = props.resolvedAt ? new Date(props.resolvedAt) : null;
    this.escalatedAt = props.escalatedAt ? new Date(props.escalatedAt) : null;
    this.interventionStartedAt = props.interventionStartedAt ? new Date(props.interventionStartedAt) : null;
    this.recurrenceCount = props.recurrenceCount ?? 0;
    this.parentIncidentId = props.parentIncidentId ?? null;
    // SLA
    this.slaTargetMinutes = props.slaTargetMinutes ?? null;
    this.firstResponseAt = props.firstResponseAt ? new Date(props.firstResponseAt) : null;
    this.responseTimeMinutes = props.responseTimeMinutes ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}