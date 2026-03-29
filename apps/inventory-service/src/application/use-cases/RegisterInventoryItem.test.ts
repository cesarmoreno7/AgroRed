import { RegisterInventoryItem } from "./RegisterInventoryItem.js";
import type { InventoryItem } from "../../domain/entities/InventoryItem.js";
import type { InventoryItemRepository, PaginationParams, PaginatedResult } from "../../domain/ports/InventoryItemRepository.js";

class InMemoryInventoryItemRepository implements InventoryItemRepository {
  private readonly store = new Map<string, InventoryItem>();

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
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async listNearExpiry(_tenantId: string, _daysAhead: number, params: PaginationParams): Promise<PaginatedResult<InventoryItem>> {
    const now = new Date();
    const limit = new Date(now.getTime() + _daysAhead * 86400000);
    const all = Array.from(this.store.values()).filter(i => i.expiresAt && i.expiresAt >= now && i.expiresAt <= limit);
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

describe("RegisterInventoryItem use-case", () => {
  let repository: InMemoryInventoryItemRepository;
  let useCase: RegisterInventoryItem;

  beforeEach(() => {
    repository = new InMemoryInventoryItemRepository();
    useCase = new RegisterInventoryItem(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    producerId: "p-1",
    offerId: "o-1",
    sourceType: "offer_stock" as const,
    storageLocationName: "Bodega Central Tuluá",
    productName: "Tomate",
    category: "Hortalizas",
    unit: "kg",
    quantityOnHand: 500,
    quantityReserved: 0,
    municipalityName: "Tuluá"
  };

  it("registers an inventory item successfully", async () => {
    const item = await useCase.execute(validCommand);

    expect(item.id).toBeDefined();
    expect(item.status).toBe("available");
    expect(item.productName).toBe("Tomate");
    expect(item.quantityOnHand).toBe(500);
    expect(item.quantityReserved).toBe(0);
  });

  it("saves the item to the repository", async () => {
    const item = await useCase.execute(validCommand);
    const found = await repository.findById(item.id);
    expect(found).not.toBeNull();
    expect(found!.storageLocationName).toBe("Bodega Central Tuluá");
  });

  it("sets status to reserved when fully reserved", async () => {
    const item = await useCase.execute({ ...validCommand, quantityReserved: 500 });
    expect(item.status).toBe("reserved");
  });

  it("throws INVALID_INVENTORY_SOURCE_LINK when offer_stock without offerId", async () => {
    await expect(
      useCase.execute({ ...validCommand, sourceType: "offer_stock", offerId: null })
    ).rejects.toThrow("INVALID_INVENTORY_SOURCE_LINK");
  });

  it("throws INVALID_INVENTORY_SOURCE_LINK when rescued_stock without rescueId", async () => {
    await expect(
      useCase.execute({ ...validCommand, sourceType: "rescued_stock", offerId: null, rescueId: null })
    ).rejects.toThrow("INVALID_INVENTORY_SOURCE_LINK");
  });

  it("throws INVALID_INVENTORY_QUANTITY_BALANCE when reserved exceeds on hand", async () => {
    await expect(
      useCase.execute({ ...validCommand, quantityReserved: 600 })
    ).rejects.toThrow("INVALID_INVENTORY_QUANTITY_BALANCE");
  });

  it("works with buffer_stock without offerId/rescueId", async () => {
    const item = await useCase.execute({
      ...validCommand,
      sourceType: "buffer_stock",
      offerId: null,
      rescueId: null
    });
    expect(item.sourceType).toBe("buffer_stock");
  });
});
