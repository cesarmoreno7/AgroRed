import { ImportNearExpiryItems, parseCsvText } from "./ImportNearExpiryItems.js";
import type { InventoryItem } from "../../domain/entities/InventoryItem.js";
import type {
  InventoryItemRepository,
  PaginationParams,
  PaginatedResult
} from "../../domain/ports/InventoryItemRepository.js";

/* ------------------------------------------------------------------ */
/*  In-Memory Repository                                               */
/* ------------------------------------------------------------------ */

class InMemoryInventoryItemRepository implements InventoryItemRepository {
  public readonly store = new Map<string, InventoryItem>();

  async save(item: InventoryItem): Promise<void> {
    this.store.set(item.id, item);
  }

  async saveBatch(items: InventoryItem[]): Promise<void> {
    for (const item of items) this.store.set(item.id, item);
  }

  async findById(id: string): Promise<InventoryItem | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<InventoryItem>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return {
      data: all.slice(start, start + params.limit),
      total: all.length,
      page: params.page,
      limit: params.limit
    };
  }

  async listNearExpiry(
    _tenantId: string,
    _daysAhead: number,
    params: PaginationParams
  ): Promise<PaginatedResult<InventoryItem>> {
    const now = new Date();
    const limit = new Date(now.getTime() + _daysAhead * 86400000);
    const all = Array.from(this.store.values()).filter(
      (i) => i.expiresAt && i.expiresAt >= now && i.expiresAt <= limit
    );
    const start = (params.page - 1) * params.limit;
    return {
      data: all.slice(start, start + params.limit),
      total: all.length,
      page: params.page,
      limit: params.limit
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Tests: parseCsvText                                                */
/* ------------------------------------------------------------------ */

describe("parseCsvText", () => {
  it("parses a valid CSV with required headers", () => {
    const csv = [
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt",
      "Tomate,Hortaliza,kg,100,Bodega Central,2026-04-05",
      "Leche,Lácteo,litro,50,Refrigerador A,2026-04-02"
    ].join("\n");

    const { rows, headerError } = parseCsvText(csv);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].productName).toBe("Tomate");
    expect(rows[0].expiresAt).toBe("2026-04-05");
    expect(rows[1].quantityOnHand).toBe("50");
  });

  it("returns error when required header is missing", () => {
    const csv = "productName,category,unit\nTomate,Hortaliza,kg";
    const { headerError } = parseCsvText(csv);
    expect(headerError).toContain("quantityOnHand");
  });

  it("returns error for empty file", () => {
    const { headerError } = parseCsvText("  ");
    expect(headerError).toContain("encabezados");
  });

  it("handles quoted fields with commas", () => {
    const csv = [
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt",
      '"Tomate cherry, rojo",Hortaliza,kg,30,"Bodega A, Estante 2",2026-04-10'
    ].join("\n");
    const { rows } = parseCsvText(csv);
    expect(rows[0].productName).toBe("Tomate cherry, rojo");
    expect(rows[0].storageLocationName).toBe("Bodega A, Estante 2");
  });

  it("handles Windows CRLF line endings", () => {
    const csv =
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt\r\nMango,Fruta,kg,20,Bodega,2026-04-15";
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe("Mango");
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: ImportNearExpiryItems use-case                              */
/* ------------------------------------------------------------------ */

describe("ImportNearExpiryItems use-case", () => {
  let repository: InMemoryInventoryItemRepository;
  let useCase: ImportNearExpiryItems;

  beforeEach(() => {
    repository = new InMemoryInventoryItemRepository();
    useCase = new ImportNearExpiryItems(repository);
  });

  const validCsv = [
    "productName,category,unit,quantityOnHand,storageLocationName,expiresAt",
    "Tomate,Hortaliza,kg,100,Bodega Central,2026-04-05",
    "Leche,Lácteo,litro,50,Refrigerador A,2026-04-02",
    "Mango,Fruta,unidad,200,Bodega Sur,2026-04-10"
  ].join("\n");

  it("imports all valid rows and persists them", async () => {
    const result = await useCase.execute(validCsv, "t-1", "p-1", "Tuluá");

    expect(result.totalRows).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(result.items).toHaveLength(3);
    expect(repository.store.size).toBe(3);
  });

  it("sets expiresAt correctly on each item", async () => {
    const result = await useCase.execute(validCsv, "t-1", "p-1", "Tuluá");
    const tomato = result.items.find((i) => i.productName === "Tomate");
    expect(tomato!.expiresAt).toBeInstanceOf(Date);
    expect(tomato!.expiresAt!.toISOString()).toContain("2026-04-05");
  });

  it("defaults sourceType to buffer_stock", async () => {
    const result = await useCase.execute(validCsv, "t-1", "p-1", "Tuluá");
    result.items.forEach((item) => {
      expect(item.sourceType).toBe("buffer_stock");
    });
  });

  it("reports row-level errors without failing the entire import", async () => {
    const csvWithErrors = [
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt",
      "Tomate,Hortaliza,kg,100,Bodega Central,2026-04-05",
      "X,H,,abc,Bo,invalid-date",
      "Mango,Fruta,unidad,200,Bodega Sur,2026-04-10"
    ].join("\n");

    const result = await useCase.execute(csvWithErrors, "t-1", "p-1", "Tuluá");
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.row === 3)).toBe(true);
  });

  it("returns header error for malformed CSV", async () => {
    const result = await useCase.execute("col1,col2\na,b", "t-1", "p-1", "Tuluá");
    expect(result.successCount).toBe(0);
    expect(result.errors[0].field).toBe("headers");
  });

  it("generates unique importId and item ids", async () => {
    const result = await useCase.execute(validCsv, "t-1", "p-1", "Tuluá");
    expect(result.importId).toBeDefined();
    const ids = result.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns tenantId and municipalityName from parameters", async () => {
    const result = await useCase.execute(validCsv, "tenant-x", "prod-y", "Cali");
    result.items.forEach((item) => {
      expect(item.tenantId).toBe("tenant-x");
      expect(item.producerId).toBe("prod-y");
      expect(item.municipalityName).toBe("Cali");
    });
  });

  it("handles optional sourceType column", async () => {
    const csv = [
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt,sourceType",
      "Leche,Lácteo,litro,50,Refrigerador,2026-04-02,rescued_stock"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "p-1", "Tuluá");
    expect(result.items[0].sourceType).toBe("rescued_stock");
  });

  it("rejects invalid sourceType value", async () => {
    const csv = [
      "productName,category,unit,quantityOnHand,storageLocationName,expiresAt,sourceType",
      "Leche,Lácteo,litro,50,Refrigerador,2026-04-02,INVALID"
    ].join("\n");
    const result = await useCase.execute(csv, "t-1", "p-1", "Tuluá");
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe("sourceType");
  });
});
