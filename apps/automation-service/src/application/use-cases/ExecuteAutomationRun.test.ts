import { ExecuteAutomationRun } from "./ExecuteAutomationRun.js";
import type { AutomationRepository } from "../../domain/ports/AutomationRepository.js";
import { AutomationRun } from "../../domain/entities/AutomationRun.js";
import { jest } from "@jest/globals";

const mockMetrics = {
  inputs: {
    activeOffers: 10,
    openDemandUnits: 5,
    availableInventoryUnits: 100,
    reservedInventoryUnits: 20,
    scheduledRescues: 3,
    scheduledLogistics: 2,
    openIncidents: 1,
    pendingNotifications: 4
  },
  scores: {
    supplyCoverageScore: 0.8,
    logisticsStabilityScore: 0.9,
    incidentPressureScore: 0.2,
    readinessScore: 0.85
  }
};

describe("ExecuteAutomationRun", () => {
  let repository: jest.Mocked<AutomationRepository>;
  let useCase: ExecuteAutomationRun;

  beforeEach(() => {
    repository = {
      planExecution: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      update: jest.fn()
    };
    useCase = new ExecuteAutomationRun(repository);
  });

  it("should execute and save a new automation run", async () => {
    repository.planExecution.mockResolvedValue({
      tenantId: "tenant-123",
      incidentId: null,
      logisticsOrderId: null,
      modelVersion: "v1",
      classification: "stable",
      actions: [],
      metricsSnapshot: mockMetrics
    });

    const command = {
      tenantId: "tenant-123",
      triggerSource: "incident_response" as const,
      incidentId: "incident-456"
    };

    const result = await useCase.execute(command);

    expect(repository.planExecution).toHaveBeenCalledWith({
      tenantKey: "tenant-123",
      incidentId: "incident-456",
      logisticsOrderId: null
    });
    expect(repository.save).toHaveBeenCalledWith(expect.any(AutomationRun));
    expect(result.status).toBe("generated");
  });

  it("should throw INCIDENT_REQUIRED for incident_response without incidentId", async () => {
    const command = {
      tenantId: "tenant-123",
      triggerSource: "incident_response" as const
    };

    await expect(useCase.execute(command)).rejects.toThrow("INCIDENT_REQUIRED_FOR_TRIGGER");
  });

  it("should throw LOGISTICS_ORDER_REQUIRED for logistics_followup without logisticsOrderId", async () => {
    const command = {
      tenantId: "tenant-123",
      triggerSource: "logistics_followup" as const
    };

    await expect(useCase.execute(command)).rejects.toThrow("LOGISTICS_ORDER_REQUIRED_FOR_TRIGGER");
  });
});