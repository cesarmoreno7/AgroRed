import { ImportProducers, parseCsvText } from "./ImportProducers.js";
import type { Producer } from "../../domain/entities/Producer.js";
import type {
  ProducerRepository,
  PaginationParams,
  PaginatedResult
} from "../../domain/ports/ProducerRepository.js";

/* ------------------------------------------------------------------ */
/*  In-Memory Repository                                               */
/* ------------------------------------------------------------------ */

function buildKey(tenantId: string, orgName: string): string {
  return `${tenantId}::${orgName.trim().toLowerCase()}`;
}

class InMemoryProducerRepository implements ProducerRepository {
  public readonly store = new Map<string, Producer>();
  private readonly byOrg = new Map<string, Producer>();

  async save(producer: Producer): Promise<void> {
    this.store.set(producer.id, producer);
    this.byOrg.set(buildKey(producer.tenantId, producer.organizationName), producer);
  }

  async saveBatch(producers: Producer[]): Promise<void> {
    for (const p of producers) {
      this.store.set(p.id, p);
      this.byOrg.set(buildKey(p.tenantId, p.organizationName), p);
    }
  }

  async findById(id: string): Promise<Producer | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Producer>> {
    let all = Array.from(this.store.values());
    if (tenantId) all = all.filter(p => p.tenantId === tenantId);
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async findByOrganizationName(tenantId: string, orgName: string): Promise<Producer | null> {
    return this.byOrg.get(buildKey(tenantId, orgName)) ?? null;
  }
}

/* ------------------------------------------------------------------ */
/*  Tests: parseCsvText                                                */
/* ------------------------------------------------------------------ */

describe("parseCsvText (producers)", () => {
  it("parses a valid CSV with required headers", () => {
    const csv = [
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories",
      "Finca El Sol,Juan Pérez,3101234567,individual,rural,Hortalizas;Frutas"
    ].join("\n");
    const { rows, headerError } = parseCsvText(csv);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationName).toBe("Finca El Sol");
    expect(rows[0].productCategories).toBe("Hortalizas;Frutas");
  });

  it("returns header error when required column is missing", () => {
    const csv = "organizationName,contactName\nFinca,Juan";
    const { headerError } = parseCsvText(csv);
    expect(headerError).toContain("contactPhone");
  });

  it("handles quoted fields with commas", () => {
    const csv = [
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories",
      '"Asociación Los Andes, Tuluá",María López,3109876543,association,rural,Café;Plátano'
    ].join("\n");
    const { rows } = parseCsvText(csv);
    expect(rows[0].organizationName).toBe("Asociación Los Andes, Tuluá");
  });

  it("handles CRLF line endings", () => {
    const csv =
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories\r\nCoop A,Ana,3101111111,cooperative,urban_periphery,Leche";
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: ImportProducers use-case                                    */
/* ------------------------------------------------------------------ */

describe("ImportProducers use-case", () => {
  let repository: InMemoryProducerRepository;
  let useCase: ImportProducers;

  beforeEach(() => {
    repository = new InMemoryProducerRepository();
    useCase = new ImportProducers(repository);
  });

  const validCsv = [
    "organizationName,contactName,contactPhone,producerType,zoneType,productCategories",
    "Finca El Sol,Juan Pérez,3101234567,individual,rural,Hortalizas;Frutas",
    "Asociación Valle Verde,María López,3109876543,association,rural,Café;Plátano;Yuca",
    "Cooperativa Agua Clara,Pedro Gómez,3105551234,cooperative,urban_periphery,Leche;Queso"
  ].join("\n");

  it("imports all valid rows and persists them", async () => {
    const result = await useCase.execute(validCsv, "t-1", "Tuluá");
    expect(result.totalRows).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(repository.store.size).toBe(3);
  });

  it("sets tenantId and municipalityName from parameters", async () => {
    const result = await useCase.execute(validCsv, "tenant-x", "Cali");
    result.producers.forEach((p) => {
      expect(p.tenantId).toBe("tenant-x");
      expect(p.municipalityName).toBe("Cali");
    });
  });

  it("splits productCategories by semicolon", async () => {
    const result = await useCase.execute(validCsv, "t-1", "Tuluá");
    const asoc = result.producers.find((p) => p.organizationName === "Asociación Valle Verde");
    expect(asoc!.productCategories).toEqual(["Café", "Plátano", "Yuca"]);
  });

  it("sets status to pending_verification", async () => {
    const result = await useCase.execute(validCsv, "t-1", "Tuluá");
    result.producers.forEach((p) => {
      expect(p.status).toBe("pending_verification");
    });
  });

  it("reports row-level errors without failing the entire import", async () => {
    const csvWithErrors = [
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories",
      "Finca El Sol,Juan Pérez,3101234567,individual,rural,Hortalizas;Frutas",
      "AB,X,123,INVALID_TYPE,badzone,",
      "Cooperativa Agua Clara,Pedro Gómez,3105551234,cooperative,urban_periphery,Leche"
    ].join("\n");
    const result = await useCase.execute(csvWithErrors, "t-1", "Tuluá");
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.row === 3)).toBe(true);
  });

  it("returns header error for malformed CSV", async () => {
    const result = await useCase.execute("col1,col2\na,b", "t-1", "Tuluá");
    expect(result.successCount).toBe(0);
    expect(result.errors[0].field).toBe("headers");
  });

  it("uses optional municipalityName from CSV row when present", async () => {
    const csv = [
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories,municipalityName",
      "Finca Norte,Ana Torres,3101112222,individual,rural,Café,Buga"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.producers[0].municipalityName).toBe("Buga");
  });

  it("handles optional latitude and longitude columns", async () => {
    const csv = [
      "organizationName,contactName,contactPhone,producerType,zoneType,productCategories,latitude,longitude",
      "Finca GPS,Carlos Ruiz,3101234567,individual,rural,Tomate,4.0833,-76.2"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "Tuluá");
    expect(result.producers[0].latitude).toBeCloseTo(4.0833);
    expect(result.producers[0].longitude).toBeCloseTo(-76.2);
  });

  it("generates unique IDs for each producer", async () => {
    const result = await useCase.execute(validCsv, "t-1", "Tuluá");
    const ids = result.producers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
