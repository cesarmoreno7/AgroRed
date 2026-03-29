import { classifyIncident } from "./ClassifyIncident.js";

describe("ClassifyIncident – keyword NLP classifier", () => {
  it("classifies food insecurity from description", () => {
    const result = classifyIncident(
      "Reporte de hambre",
      "La comunidad reporta falta de alimentos y hambre en zona rural aislada"
    );
    expect(result.method).toBe("keyword_nlp");
    expect(result.suggestedType).toBe("inseguridad_alimentaria");
    expect(result.confidence).toBeGreaterThan(0.1);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("classifies malnutrition", () => {
    const result = classifyIncident(
      "Caso de desnutrición infantil",
      "Se detectaron 5 niños con bajo peso y anemia en el comedor escolar"
    );
    expect(result.suggestedType).toBe("desnutricion");
    expect(result.suggestedSeverity).toBe("critical");
  });

  it("classifies humanitarian crisis with critical severity", () => {
    const result = classifyIncident(
      "Inundación masiva",
      "Crisis humanitaria por inundación. Emergencia urgente con múltiples familias desplazadas"
    );
    expect(["crisis_humanitaria", "desplazamiento"]).toContain(result.suggestedType);
    expect(result.suggestedSeverity).toBe("critical");
  });

  it("classifies vehicle failure", () => {
    const result = classifyIncident(
      "Avería del camión",
      "El vehículo de reparto quedó varado por falla mecánica en la vía"
    );
    expect(result.suggestedType).toBe("vehicle_failure");
  });

  it("classifies food waste / spoilage", () => {
    const result = classifyIncident(
      "Desperdicio en bodega",
      "Se encontraron alimentos vencidos y en descomposición, hay pérdida de alimentos considerable"
    );
    expect(result.suggestedType).toBe("desperdicio_alimentario");
  });

  it("classifies route delay", () => {
    const result = classifyIncident(
      "Retraso en la entrega",
      "Hay demora de 3 horas por atraso en ruta hacia el centro de distribución"
    );
    expect(result.suggestedType).toBe("route_delay");
  });

  it("returns low confidence for unrecognized text", () => {
    const result = classifyIncident(
      "Nota informativa",
      "Este es un texto genérico que no contiene palabras clave relevantes"
    );
    expect(result.confidence).toBeLessThan(0.3);
    expect(result.suggestedType).toBeDefined();
  });

  it("boosts severity with urgency keywords", () => {
    const result = classifyIncident(
      "Emergencia urgente",
      "Situación urgente con riesgo de muerte por falta de acceso a alimentos"
    );
    expect(result.suggestedSeverity).toBe("critical");
  });

  it("classifies quality issues", () => {
    const result = classifyIncident(
      "Alimentos en mal estado",
      "Se detectó contaminación en lote de alimentos, mal estado y olor extraño"
    );
    expect(result.suggestedType).toBe("quality_issue");
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("classifies forced displacement", () => {
    const result = classifyIncident(
      "Desplazamiento forzado",
      "Familias desplazadas llegan al municipio por conflicto armado y violencia"
    );
    expect(result.suggestedType).toBe("desplazamiento");
  });
});
