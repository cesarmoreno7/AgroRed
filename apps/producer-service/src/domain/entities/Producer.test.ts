import { Producer } from "./Producer.js";

describe("Producer entity", () => {
  const baseProps = {
    id: "pr-1",
    tenantId: "t-1",
    userId: "u-1",
    producerType: "cooperative" as const,
    organizationName: "  Coop Agrícola  ",
    contactName: "  Carlos Pérez  ",
    contactPhone: "  3001234567  ",
    municipalityName: "  Cartago  ",
    zoneType: "rural" as const,
    productCategories: ["  frutas  ", "  hortalizas  ", ""],
    status: "active" as const
  };

  it("trims string fields", () => {
    const p = new Producer(baseProps);
    expect(p.organizationName).toBe("Coop Agrícola");
    expect(p.contactName).toBe("Carlos Pérez");
    expect(p.contactPhone).toBe("3001234567");
    expect(p.municipalityName).toBe("Cartago");
  });

  it("trims and filters empty product categories", () => {
    const p = new Producer(baseProps);
    expect(p.productCategories).toEqual(["frutas", "hortalizas"]);
  });

  it("sets userId to null when omitted", () => {
    const p = new Producer({ ...baseProps, userId: null });
    expect(p.userId).toBeNull();
  });

  it("assigns default createdAt", () => {
    const before = new Date();
    const p = new Producer(baseProps);
    expect(p.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("preserves explicit createdAt", () => {
    const fixed = new Date("2024-12-01");
    const p = new Producer({ ...baseProps, createdAt: fixed });
    expect(p.createdAt).toBe(fixed);
  });
});
