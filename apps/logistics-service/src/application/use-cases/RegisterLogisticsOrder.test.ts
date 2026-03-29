import { RegisterLogisticsOrder } from "./RegisterLogisticsOrder.js";
import type { LogisticsOrder } from "../../domain/entities/LogisticsOrder.js";
import type { LogisticsOrderRepository, PaginationParams, PaginatedResult } from "../../domain/ports/LogisticsOrderRepository.js";

class InMemoryLogisticsOrderRepository implements LogisticsOrderRepository {
  private readonly store = new Map<string, LogisticsOrder>();

  async save(order: LogisticsOrder): Promise<void> {
    this.store.set(order.id, order);
  }

  async findById(id: string): Promise<LogisticsOrder | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<LogisticsOrder>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

describe("RegisterLogisticsOrder use-case", () => {
  let repository: InMemoryLogisticsOrderRepository;
  let useCase: RegisterLogisticsOrder;

  beforeEach(() => {
    repository = new InMemoryLogisticsOrderRepository();
    useCase = new RegisterLogisticsOrder(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    inventoryItemId: "inv-1",
    demandId: "d-1",
    routeMode: "municipal_fleet" as const,
    originLocationName: "Bodega Central Tuluá",
    destinationOrganizationName: "Comedor Barrio Obrero",
    destinationAddress: "Calle 15 #8-42, Cali",
    scheduledPickupAt: new Date("2025-07-01T06:00:00Z"),
    scheduledDeliveryAt: new Date("2025-07-01T10:00:00Z"),
    quantityAssigned: 200,
    municipalityName: "Cali"
  };

  it("registers a logistics order successfully", async () => {
    const order = await useCase.execute(validCommand);

    expect(order.id).toBeDefined();
    expect(order.status).toBe("scheduled");
    expect(order.routeMode).toBe("municipal_fleet");
    expect(order.quantityAssigned).toBe(200);
  });

  it("saves the order to the repository", async () => {
    const order = await useCase.execute(validCommand);
    const found = await repository.findById(order.id);
    expect(found).not.toBeNull();
    expect(found!.destinationOrganizationName).toBe("Comedor Barrio Obrero");
  });

  it("sets demandId to null when omitted", async () => {
    const order = await useCase.execute({ ...validCommand, demandId: null });
    expect(order.demandId).toBeNull();
  });

  it("throws INVALID_LOGISTICS_SCHEDULE when delivery before pickup", async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        scheduledPickupAt: new Date("2025-07-02T10:00:00Z"),
        scheduledDeliveryAt: new Date("2025-07-01T06:00:00Z")
      })
    ).rejects.toThrow("INVALID_LOGISTICS_SCHEDULE");
  });

  it("throws INVALID_LOGISTICS_SCHEDULE for invalid pickup date", async () => {
    await expect(
      useCase.execute({ ...validCommand, scheduledPickupAt: new Date("invalid") })
    ).rejects.toThrow("INVALID_LOGISTICS_SCHEDULE");
  });

  it("throws INVALID_LOGISTICS_SCHEDULE for invalid delivery date", async () => {
    await expect(
      useCase.execute({ ...validCommand, scheduledDeliveryAt: new Date("invalid") })
    ).rejects.toThrow("INVALID_LOGISTICS_SCHEDULE");
  });
});
