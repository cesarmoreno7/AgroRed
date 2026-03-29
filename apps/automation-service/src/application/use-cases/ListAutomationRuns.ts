import type { AutomationRepository, PaginationParams, PaginatedResult } from "../../domain/ports/AutomationRepository.js";
import type { AutomationRun } from "../../domain/entities/AutomationRun.js";

interface ListAutomationRunsInput {
  tenantId: string;
  page?: number;
  limit?: number;
}

export class ListAutomationRuns {
  constructor(private readonly repository: AutomationRepository) {}

  async execute(input: ListAutomationRunsInput): Promise<PaginatedResult<AutomationRun>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    return this.repository.list({ page, limit }, input.tenantId);
  }
}