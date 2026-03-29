import { Offer } from "./Offer.js";

describe("Offer entity", () => {
  const baseProps = {
    id: "o-1",
    tenantId: "t-1",
    producerId: "p-1",
    title: "  Tomates orgánicos  ",
    productName: "  Tomate  ",
    category: "  Hortalizas  ",
    unit: "  kg  ",
    quantityAvailable: 500,
    priceAmount: 1200,
    currency: "  cop  ",
    availableFrom: new Date("2025-06-01"),
    availableUntil: new Date("2025-06-30"),
    municipalityName: "  Tuluá  ",
    notes: "  Cosecha fresca  ",
    status: "published" as const
  };

  it("trims string fields", () => {
    const offer = new Offer(baseProps);
    expect(offer.title).toBe("Tomates orgánicos");
    expect(offer.productName).toBe("Tomate");
    expect(offer.category).toBe("Hortalizas");
    expect(offer.unit).toBe("kg");
    expect(offer.municipalityName).toBe("Tuluá");
    expect(offer.notes).toBe("Cosecha fresca");
  });

  it("uppercases currency", () => {
    const offer = new Offer(baseProps);
    expect(offer.currency).toBe("COP");
  });

  it("converts numeric strings to numbers", () => {
    const offer = new Offer({ ...baseProps, quantityAvailable: "250" as any, priceAmount: "800" as any });
    expect(offer.quantityAvailable).toBe(250);
    expect(offer.priceAmount).toBe(800);
  });

  it("sets availableUntil to null when omitted", () => {
    const offer = new Offer({ ...baseProps, availableUntil: null });
    expect(offer.availableUntil).toBeNull();
  });

  it("sets notes to null when empty or omitted", () => {
    const offer = new Offer({ ...baseProps, notes: "   " });
    expect(offer.notes).toBeNull();
  });

  it("assigns default createdAt", () => {
    const before = new Date();
    const offer = new Offer(baseProps);
    expect(offer.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
