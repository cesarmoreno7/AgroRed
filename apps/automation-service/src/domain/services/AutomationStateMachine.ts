import type { AutomationRunStatus } from "../value-objects/AutomationRunStatus.js";

export class AutomationStateMachine {
  private validTransitions: Record<AutomationRunStatus, AutomationRunStatus[]> = {
    generated: ["dispatched"],
    dispatched: ["executing"],
    executing: ["completed", "failed"],
    completed: [],
    failed: []
  };

  canTransition(from: AutomationRunStatus, to: AutomationRunStatus): boolean {
    return this.validTransitions[from]?.includes(to) || false;
  }

  assertValidTransition(from: AutomationRunStatus, to: AutomationRunStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid state transition from '${from}' to '${to}'`);
    }
  }
}