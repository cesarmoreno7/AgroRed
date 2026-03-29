import { AUTOMATION_RUN_STATUSES } from "./AutomationRunStatus.js";
import { AutomationStateMachine } from "../../domain/services/AutomationStateMachine.js";

describe("AutomationRunStatus", () => {
  it("defines the five expected statuses", () => {
    expect(AUTOMATION_RUN_STATUSES).toEqual([
      "generated",
      "dispatched",
      "executing",
      "completed",
      "failed"
    ]);
  });
});

describe("AutomationStateMachine", () => {
  let sm: AutomationStateMachine;

  beforeEach(() => {
    sm = new AutomationStateMachine();
  });

  describe("valid transitions", () => {
    it.each([
      ["generated", "dispatched"],
      ["dispatched", "executing"],
      ["executing", "completed"],
      ["executing", "failed"]
    ] as const)("allows %s → %s", (from, to) => {
      expect(sm.canTransition(from, to)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    it.each([
      ["generated", "executing"],
      ["generated", "completed"],
      ["generated", "failed"],
      ["dispatched", "completed"],
      ["dispatched", "failed"],
      ["dispatched", "generated"],
      ["completed", "generated"],
      ["completed", "failed"],
      ["failed", "generated"],
      ["failed", "completed"]
    ] as const)("rejects %s → %s", (from, to) => {
      expect(sm.canTransition(from, to)).toBe(false);
    });
  });

  describe("assertValidTransition", () => {
    it("does not throw for a valid transition", () => {
      expect(() => sm.assertValidTransition("generated", "dispatched")).not.toThrow();
    });

    it("throws for an invalid transition", () => {
      expect(() => sm.assertValidTransition("generated", "completed")).toThrow(
        "Invalid state transition from 'generated' to 'completed'"
      );
    });
  });
});
