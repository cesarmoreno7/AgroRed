import { classifyInspection } from "./classifyInspection.js";

const NOW = new Date("2026-08-30T12:00:00Z");

describe("classifyInspection", () => {
  it("marks gramaje below tolerance as no_conforme", () => {
    const out = classifyInspection(
      { portionWeightG: 150, portionWeightExpectedG: 220, now: NOW },
      { gramaje_tolerance_pct: 10 }
    );
    expect(out.result).toBe("no_conforme");
    expect(out.failedItems.map((f) => f.category)).toContain("gramaje");
  });

  it("accepts gramaje within tolerance", () => {
    const out = classifyInspection(
      { portionWeightG: 205, portionWeightExpectedG: 220, now: NOW },
      { gramaje_tolerance_pct: 10 }
    );
    expect(out.result).toBe("conforme");
    expect(out.failedItems).toHaveLength(0);
  });

  it("marks temperature above cold_chain_max_c as no_conforme (cadena_frio)", () => {
    const out = classifyInspection({ temperatureC: 12, now: NOW }, { cold_chain_max_c: 8, cold_chain_min_c: 0 });
    expect(out.result).toBe("no_conforme");
    expect(out.coldChainOk).toBe(false);
    expect(out.failedItems[0].category).toBe("cadena_frio");
  });

  it("accepts temperature inside the cold-chain range", () => {
    const out = classifyInspection({ temperatureC: 4, now: NOW }, { cold_chain_max_c: 8, cold_chain_min_c: 0 });
    expect(out.result).toBe("conforme");
    expect(out.coldChainOk).toBe(true);
  });

  it("marks near-expiry insumo as no_conforme (vencimiento)", () => {
    const out = classifyInspection(
      { earliestExpiryDate: "2026-08-31", now: NOW },
      { expiry_min_days: 2 }
    );
    expect(out.result).toBe("no_conforme");
    expect(out.expiryCheckOk).toBe(false);
    expect(out.failedItems[0].category).toBe("vencimiento");
  });

  it("accepts insumo with enough shelf life", () => {
    const out = classifyInspection(
      { earliestExpiryDate: "2026-09-30", now: NOW },
      { expiry_min_days: 2 }
    );
    expect(out.result).toBe("conforme");
    expect(out.expiryCheckOk).toBe(true);
  });

  it("marks low hygiene score as no_conforme", () => {
    const out = classifyInspection({ hygieneScore: 55, now: NOW }, { hygiene_min_score: 70 });
    expect(out.result).toBe("no_conforme");
    expect(out.failedItems[0].category).toBe("higiene");
  });

  it("returns conforme_con_observaciones for a soft (non-auto-fail) finding only", () => {
    const out = classifyInspection(
      { hygieneScore: 90, answers: { dotacion_menaje: "no_conforme" }, now: NOW },
      {}
    );
    expect(out.result).toBe("conforme_con_observaciones");
    expect(out.failedItems.map((f) => f.key)).toEqual(["dotacion_menaje"]);
  });

  it("uses default thresholds when none are provided", () => {
    // default gramaje_tolerance_pct = 10 → 220 * 0.9 = 198, so 190 fails
    const out = classifyInspection({ portionWeightG: 190, portionWeightExpectedG: 220, now: NOW });
    expect(out.result).toBe("no_conforme");
  });

  it("stays pendiente when nothing measurable was captured", () => {
    const out = classifyInspection({ now: NOW });
    expect(out.result).toBe("pendiente");
    expect(out.failedItems).toHaveLength(0);
  });
});
