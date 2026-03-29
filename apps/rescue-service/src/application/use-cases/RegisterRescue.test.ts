import { RegisterRescue } from "./RegisterRescue.js";
import type { Rescue } from "../../domain/entities/Rescue.js";
import type { RescueRepository, PaginationParams, PaginatedResult } from "../../domain/ports/RescueRepository.js";

class InMemoryRescueRepository implements RescueRepository {
  private readonly store = new Map<string, Rescue>();

  async save(rescue: Rescue): Promise<void> {
    this.store.set(rescue.id, rescue);
  }

  async findById(id: string): Promise<Rescue | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Rescue>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

describe("RegisterRescue use-case", () => {
  let repository: InMemoryRescueRepository;
  let useCase: RegisterRescue;

  beforeEach(() => {
    repository = new InMemoryRescueRepository();
    useCase = new RegisterRescue(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    producerId: "p-1",
    offerId: "o-1",
    rescueChannel: "food_bank" as const,
    destinationOrganizationName: "Banco de Alimentos Cali",
    productName: "Plátano",
    category: "Frutas",
    unit: "kg",
    quantityRescued: 200,
    scheduledAt: new Date("2025-07-01T08:00:00Z"),
    beneficiaryCount: 50,
    municipalityName: "Buenaventura",
    notes: "Entrega programada"
  };

  it("registers a rescue successfully", async () => {
    const rescue = await useCase.execute(validCommand);

    expect(rescue.id).toBeDefined();
    expect(rescue.status).toBe("scheduled");
    expect(rescue.productName).toBe("Plátano");
    expect(rescue.quantityRescued).toBe(200);
    expect(rescue.beneficiaryCount).toBe(50);
  });

  it("saves the rescue to the repository", async () => {
    const rescue = await useCase.execute(validCommand);
    const found = await repository.findById(rescue.id);
    expect(found).not.toBeNull();
    expect(found!.rescueChannel).toBe("food_bank");
  });

  it("sets offerId to null when omitted", async () => {
    const rescue = await useCase.execute({ ...validCommand, offerId: null });
    expect(rescue.offerId).toBeNull();
  });

  it("sets notes to null when omitted", async () => {
    const rescue = await useCase.execute({ ...validCommand, notes: null });
    expect(rescue.notes).toBeNull();
  });

  it("throws INVALID_RESCUE_SCHEDULE for invalid date", async () => {
    await expect(
      useCase.execute({ ...validCommand, scheduledAt: new Date("invalid") })
    ).rejects.toThrow("INVALID_RESCUE_SCHEDULE");
  });
});
