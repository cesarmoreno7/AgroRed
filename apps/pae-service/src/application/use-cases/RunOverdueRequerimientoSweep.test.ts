import { RunOverdueRequerimientoSweep, type OverdueSweepRepo } from "./RunOverdueRequerimientoSweep.js";
import type { EscalationSink } from "./EscalateFinding.js";
import type { PaeRequerimiento } from "../../domain/entities/PaeRequerimiento.js";

function req(overrides: Partial<PaeRequerimiento> = {}): PaeRequerimiento {
  return {
    id: "req-1",
    tenantId: "muni-A",
    sourceType: "inspection",
    inspectionId: "insp-1",
    caeReportId: null,
    operatorId: "op-1",
    title: "Hallazgo",
    description: "",
    legalBasis: null,
    severity: "high",
    status: "abierto",
    escalationLevel: 0,
    slaHours: 72,
    dueDate: new Date(Date.now() - 3_600_000).toISOString(),
    firstNotifiedAt: null,
    respondedAt: null,
    responseNotes: null,
    closedAt: null,
    institutionalAlertId: null,
    coordinationTaskId: null,
    createdByTenantId: null,
    createdByRole: null,
    createdAt: "",
    updatedAt: "",
    ...overrides
  };
}

function makeFakes(rows: PaeRequerimiento[]) {
  const bumps: { id: string; escalationLevel: number; status: string }[] = [];
  const alerts: unknown[] = [];
  const tasks: unknown[] = [];
  const repo: OverdueSweepRepo = {
    listOverdueRequerimientos: async () => rows,
    getThresholds: async () => ({}),
    bumpRequerimientoEscalation: async (id, data) => {
      bumps.push({ id, escalationLevel: data.escalationLevel, status: data.status });
    }
  };
  const escalation: EscalationSink = {
    createInstitutionalAlert: async (d) => {
      alerts.push(d);
      return `a-${alerts.length}`;
    },
    createCoordinationTask: async (d) => {
      tasks.push(d);
      return `t-${tasks.length}`;
    }
  };
  return { repo, escalation, bumps, alerts, tasks };
}

describe("RunOverdueRequerimientoSweep", () => {
  it("escalates an overdue, unresponded requerimiento (level 0 -> 1, notificado)", async () => {
    const { repo, escalation, bumps, alerts, tasks } = makeFakes([req()]);
    const out = await new RunOverdueRequerimientoSweep({ repository: repo, escalation }).execute();
    expect(out).toEqual({ scanned: 1, escalated: 1 });
    expect(bumps[0]).toMatchObject({ escalationLevel: 1, status: "notificado" });
    expect(alerts).toHaveLength(1);
    expect(tasks).toHaveLength(1);
  });

  it("marks level >= 2 as incumplido with critical severity", async () => {
    const { repo, escalation, bumps, alerts } = makeFakes([req({ escalationLevel: 1 })]);
    await new RunOverdueRequerimientoSweep({ repository: repo, escalation }).execute();
    expect(bumps[0]).toMatchObject({ escalationLevel: 2, status: "incumplido" });
    expect((alerts[0] as { severity: string }).severity).toBe("critical");
  });

  it("does nothing when there are no overdue rows", async () => {
    const { repo, escalation, bumps } = makeFakes([]);
    const out = await new RunOverdueRequerimientoSweep({ repository: repo, escalation }).execute();
    expect(out).toEqual({ scanned: 0, escalated: 0 });
    expect(bumps).toHaveLength(0);
  });
});
