import type { IncidentRepository } from "../../domain/ports/IncidentRepository.js";
import type { IncidentStatus } from "../../domain/value-objects/IncidentStatus.js";
import type { Incident } from "../../domain/entities/Incident.js";
import { randomUUID } from "node:crypto";

export interface UpdateIncidentStatusCommand {
  incidentId: string;
  status: IncidentStatus;
  assignedTo?: string;
  resolutionNotes?: string;
  performedBy: string;
}

const VALID_TRANSITIONS: Record<string, IncidentStatus[]> = {
  open:          ["investigating", "reportada", "en_analisis", "dismissed"],
  reportada:     ["en_analisis", "priorizada", "dismissed"],
  en_analisis:   ["priorizada", "escalada", "dismissed"],
  priorizada:    ["en_gestion", "escalada"],
  en_gestion:    ["intervenida", "escalada"],
  intervenida:   ["cerrada", "escalada"],
  investigating: ["resolved", "dismissed", "en_gestion"],
  escalada:      ["en_gestion", "priorizada", "cerrada"],
  resolved:      [],
  cerrada:       [],
  dismissed:     [],
};

export class UpdateIncidentStatus {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(command: UpdateIncidentStatusCommand): Promise<Incident> {
    const incident = await this.repository.findById(command.incidentId);
    if (!incident) throw new Error("INCIDENT_NOT_FOUND");

    const allowed = VALID_TRANSITIONS[incident.status] ?? [];
    if (!allowed.includes(command.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const fields: Record<string, unknown> = {};
    if (command.assignedTo) fields.assignedTo = command.assignedTo;
    if (command.resolutionNotes) fields.resolutionNotes = command.resolutionNotes;

    if (command.status === "resolved" || command.status === "cerrada") {
      fields.resolvedAt = new Date();
    }
    if (command.status === "escalada") {
      fields.escalatedAt = new Date();
    }
    if (command.status === "en_gestion" || command.status === "intervenida") {
      fields.interventionStartedAt = new Date();
    }

    await this.repository.updateStatus(command.incidentId, command.status, fields as any);

    // Log action
    await this.repository.saveAction({
      id: randomUUID(),
      incidentId: command.incidentId,
      actionType: `status_change_to_${command.status}`,
      performedBy: command.performedBy,
      description: `Estado cambiado de '${incident.status}' a '${command.status}'${command.resolutionNotes ? `. Notas: ${command.resolutionNotes}` : ""}`,
      metadata: { previousStatus: incident.status, newStatus: command.status },
      createdAt: new Date(),
    });

    const updated = await this.repository.findById(command.incidentId);
    return updated!;
  }
}
