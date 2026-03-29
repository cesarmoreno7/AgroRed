import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import type { AutomationRun } from "../../domain/entities/AutomationRun.js";

interface GetAutomationRunInput {
  id: string;
}

export class GetAutomationRun {
  constructor(private readonly repository: AutomationRepository) {}

  async execute(input: GetAutomationRunInput): Promise<AutomationRun | null> {
    return this.repository.findById(input.id);
  }
}