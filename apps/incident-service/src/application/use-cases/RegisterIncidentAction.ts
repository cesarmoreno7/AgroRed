import { randomUUID } from "node:crypto";
import type { IncidentRepository, IncidentAction } from "../../domain/ports/IncidentRepository.js";

export interface RegisterIncidentActionCommand {
  incidentId: string;
  actionType: string;
  performedBy: string;
  description: string;
  metadata?: Record<string, unknown>;
}

const VALID_ACTION_TYPES = [
  "assign", "escalate", "intervene", "close", "note",
  "activate_program", "activate_logistics", "follow_up",
] as const;

export class RegisterIncidentAction {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(command: RegisterIncidentActionCommand): Promise<IncidentAction> {
    const incident = await this.repository.findById(command.incidentId);
    if (!incident) throw new Error("INCIDENT_NOT_FOUND");

    if (!VALID_ACTION_TYPES.includes(command.actionType as any)) {
      throw new Error("INVALID_ACTION_TYPE");
    }

    const action: IncidentAction = {
      id: randomUUID(),
      incidentId: command.incidentId,
      actionType: command.actionType,
      performedBy: command.performedBy,
      description: command.description,
      metadata: command.metadata ?? {},
      createdAt: new Date(),
    };

    await this.repository.saveAction(action);
    return action;
  }
}
