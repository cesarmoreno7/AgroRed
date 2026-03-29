import { Rescue } from "./Rescue.js";

describe("Rescue entity", () => {
  const baseProps = {
    id: "r-1",
    tenantId: "t-1",
    producerId: "p-1",
    offerId: "o-1",
    rescueChannel: "food_bank" as const,
    destinationOrganizationName: "  Banco de Alimentos  ",
    productName: "  Plátano  ",
    category: "  Frutas  ",
    unit: "  kg  ",
    quantityRescued: 200,
    scheduledAt: new Date("2025-07-01T08:00:00Z"),
    beneficiaryCount: 50,
    municipalityName: "  Buenaventura  ",
    notes: "  Entrega programada  ",
    status: "scheduled" as const
  };

  it("trims string fields", () => {
    const r = new Rescue(baseProps);
    expect(r.destinationOrganizationName).toBe("Banco de Alimentos");
    expect(r.productName).toBe("Plátano");
    expect(r.category).toBe("Frutas");
    expect(r.unit).toBe("kg");
    expect(r.municipalityName).toBe("Buenaventura");
    expect(r.notes).toBe("Entrega programada");
  });

  it("converts numeric values", () => {
    const r = new Rescue({ ...baseProps, quantityRescued: "150" as any, beneficiaryCount: "30" as any });
    expect(r.quantityRescued).toBe(150);
    expect(r.beneficiaryCount).toBe(30);
  });

  it("sets offerId to null when omitted", () => {
    const r = new Rescue({ ...baseProps, offerId: null });
    expect(r.offerId).toBeNull();
  });

  it("sets notes to null when empty", () => {
    const r = new Rescue({ ...baseProps, notes: "   " });
    expect(r.notes).toBeNull();
  });

  it("assigns default createdAt", () => {
    const before = new Date();
    const r = new Rescue(baseProps);
    expect(r.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("creates scheduledAt as Date object", () => {
    const r = new Rescue(baseProps);
    expect(r.scheduledAt).toBeInstanceOf(Date);
  });
});
