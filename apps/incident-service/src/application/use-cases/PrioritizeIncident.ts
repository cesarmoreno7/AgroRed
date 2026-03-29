import type { IncidentRepository } from "../../domain/ports/IncidentRepository.js";
import { SEVERITY_WEIGHT } from "../../domain/value-objects/IncidentSeverity.js";
import type { IncidentSeverity } from "../../domain/value-objects/IncidentSeverity.js";

/**
 * Calculates a priority score for an incident based on:
 * - severity weight
 * - affected population
 * - recurrence
 * Then updates the incident record.
 */
export class PrioritizeIncident {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(incidentId: string): Promise<number> {
    const incident = await this.repository.findById(incidentId);
    if (!incident) throw new Error("INCIDENT_NOT_FOUND");

    const severityW = SEVERITY_WEIGHT[incident.severity as IncidentSeverity] ?? 1;
    const populationFactor = Math.min(10, Math.log2(Math.max(1, incident.affectedPopulation)));
    const recurrenceFactor = Math.min(5, incident.recurrenceCount * 1.5);

    const score = Math.round(
      (severityW * 4 + populationFactor * 3 + recurrenceFactor * 3) * 10
    ) / 10;

    const clampedScore = Math.min(99.99, Math.max(0, score));

    await this.repository.updateStatus(incident.id, incident.status, {
      priorityScore: clampedScore,
    });

    return clampedScore;
  }
}
