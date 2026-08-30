import { EscalateFinding, type EscalationRepo, type EscalationSink } from "./EscalateFinding.js";
import type { PaeRequerimiento, PaeRequerimientoInput } from "../../domain/entities/PaeRequerimiento.js";

function makeFakes() {
  const requerimientos: PaeRequerimiento[] = [];
  const alerts: unknown[] = [];
  const tasks: unknown[] = [];
  const repo: EscalationRepo = {
    getThresholds: async () => ({}),
    findRequerimientoByInspectionId: async () => null,
    findRequerimientoByCaeReportId: async (id: string) =>
      requerimientos.find((r) => r.caeReportId === id) ?? null,
    findOperatorById: async () => null,
    createRequerimiento: async (input: PaeRequerimientoInput, dueDate: string) => {
      const r: PaeRequerimiento = {
        id: `req-${requerimientos.length + 1}`,
        tenantId: input.tenantId,
        sourceType: input.sourceType,
        inspectionId: input.inspectionId ?? null,
        caeReportId: input.caeReportId ?? null,
        operatorId: input.operatorId ?? null,
        title: input.title,
        description: input.description,
        legalBasis: input.legalBasis ?? null,
        severity: input.severity,
        status: "abierto",
        escalationLevel: 0,
        slaHours: input.slaHours,
        dueDate,
        firstNotifiedAt: null,
        respondedAt: null,
        responseNotes: null,
        closedAt: null,
        institutionalAlertId: null,
        coordinationTaskId: null,
        createdByTenantId: input.createdByTenantId ?? null,
        createdByRole: input.createdByRole ?? null,
        createdAt: "",
        updatedAt: ""
      };
      requerimientos.push(r);
      return r;
    },
    backfillRequerimientoLinks: async () => undefined
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
  return { repo, escalation, requerimientos, alerts, tasks };
}

describe("EscalateFinding.fromCaeReport", () => {
  it("creates a cae_report-sourced requerimiento + alert + task", async () => {
    const { repo, escalation, requerimientos, alerts, tasks } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });
    const r = await uc.fromCaeReport({
      id: "cae-1",
      tenantId: "muni-A",
      category: "cadena_frio",
      description: "La comida llegó tibia varias veces esta semana.",
      reporterRole: "docente"
    });
    expect(r).not.toBeNull();
    expect(requerimientos).toHaveLength(1);
    expect(requerimientos[0].sourceType).toBe("cae_report");
    expect(requerimientos[0].caeReportId).toBe("cae-1");
    expect(requerimientos[0].severity).toBe("critical"); // cadena_frio
    expect(alerts).toHaveLength(1);
    expect(tasks).toHaveLength(1);
  });

  it("is idempotent per cae_report id", async () => {
    const { repo, escalation, requerimientos } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });
    await uc.fromCaeReport({ id: "cae-1", tenantId: "muni-A", category: "otro", description: "x".repeat(15) });
    await uc.fromCaeReport({ id: "cae-1", tenantId: "muni-A", category: "otro", description: "x".repeat(15) });
    expect(requerimientos).toHaveLength(1);
  });
});
