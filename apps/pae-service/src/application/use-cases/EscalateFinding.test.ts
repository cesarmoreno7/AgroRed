import { EscalateFinding, type EscalationRepo, type EscalationSink } from "./EscalateFinding.js";
import type { PaeInspection } from "../../domain/entities/PaeInspection.js";
import type { PaeRequerimiento, PaeRequerimientoInput } from "../../domain/entities/PaeRequerimiento.js";

function inspection(overrides: Partial<PaeInspection> = {}): PaeInspection {
  return {
    id: "insp-1",
    tenantId: "muni-A",
    operatorId: "op-1",
    institutionId: null,
    foodProgramId: null,
    inspectionKind: "interventoria_diaria",
    inspectorRole: "admin_municipal",
    inspectorUserId: "u1",
    inspectorTenantId: "muni-A",
    inspectedAt: new Date().toISOString(),
    locationDescription: null,
    latitude: null,
    longitude: null,
    portionWeightG: 150,
    portionWeightExpectedG: 220,
    temperatureC: null,
    coldChainOk: null,
    expiryCheckOk: null,
    earliestExpiryDate: null,
    hygieneScore: null,
    answers: {},
    failedItems: [{ key: "gramaje_racion", category: "gramaje", reason: "Gramaje bajo." }],
    result: "no_conforme",
    status: "completed",
    evidenceUrls: [],
    notes: null,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function makeFakes() {
  const requerimientos: PaeRequerimiento[] = [];
  const alerts: unknown[] = [];
  const tasks: unknown[] = [];

  const repo: EscalationRepo = {
    getThresholds: async () => ({}),
    findRequerimientoByInspectionId: async (inspectionId: string) =>
      requerimientos.find((r) => r.inspectionId === inspectionId) ?? null,
    findOperatorById: async () => ({
      id: "op-1",
      tenantId: "muni-A",
      legalName: "Alimentos del Oriente S.A.S.",
      nit: null,
      legalRep: null,
      contractNumber: null,
      contractStartsAt: null,
      contractEndsAt: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      status: "active",
      createdAt: "",
      updatedAt: ""
    }),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      requerimientos.push(r);
      return r;
    },
    backfillRequerimientoLinks: async (id, links) => {
      const r = requerimientos.find((x) => x.id === id);
      if (r) {
        r.institutionalAlertId = links.institutionalAlertId ?? r.institutionalAlertId;
        r.coordinationTaskId = links.coordinationTaskId ?? r.coordinationTaskId;
        r.status = r.status === "abierto" ? "notificado" : r.status;
      }
    }
  };

  const escalation: EscalationSink = {
    createInstitutionalAlert: async (d) => {
      alerts.push(d);
      return `alert-${alerts.length}`;
    },
    createCoordinationTask: async (d) => {
      tasks.push(d);
      return `task-${tasks.length}`;
    }
  };

  return { repo, escalation, requerimientos, alerts, tasks };
}

describe("EscalateFinding.fromInspection", () => {
  it("creates one requerimiento + alert + task for a no_conforme inspection", async () => {
    const { repo, escalation, requerimientos, alerts, tasks } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });

    const r = await uc.fromInspection(inspection(), { createdByRole: "supervisor_departamental" });

    expect(r).not.toBeNull();
    expect(requerimientos).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(requerimientos[0].tenantId).toBe("muni-A");
    expect((tasks[0] as { tenantId: string }).tenantId).toBe("muni-A");
    expect(r?.institutionalAlertId).toBe("alert-1");
    expect(r?.coordinationTaskId).toBe("task-1");
    expect(r?.status).toBe("notificado");
  });

  it("maps cold-chain failure to critical severity", async () => {
    const { repo, escalation, requerimientos } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });
    await uc.fromInspection(
      inspection({ failedItems: [{ key: "temperatura_frio", category: "cadena_frio", reason: "12°C" }] })
    );
    expect(requerimientos[0].severity).toBe("critical");
  });

  it("is idempotent on the same inspection id", async () => {
    const { repo, escalation, requerimientos, alerts } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });
    await uc.fromInspection(inspection());
    await uc.fromInspection(inspection());
    expect(requerimientos).toHaveLength(1);
    expect(alerts).toHaveLength(1);
  });

  it("does nothing for a conforme_con_observaciones inspection", async () => {
    const { repo, escalation, requerimientos } = makeFakes();
    const uc = new EscalateFinding({ repository: repo, escalation });
    const r = await uc.fromInspection(inspection({ result: "conforme_con_observaciones" }));
    expect(r).toBeNull();
    expect(requerimientos).toHaveLength(0);
  });
});
