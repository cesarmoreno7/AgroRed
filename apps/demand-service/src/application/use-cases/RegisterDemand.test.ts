import { RegisterDemand } from "./RegisterDemand.js";
import type { Demand } from "../../domain/entities/Demand.js";
import type { DemandRepository, PaginationParams, PaginatedResult } from "../../domain/ports/DemandRepository.js";

class InMemoryDemandRepository implements DemandRepository {
  private readonly store = new Map<string, Demand>();

  async save(demand: Demand): Promise<void> {
    this.store.set(demand.id, demand);
  }

  async findById(id: string): Promise<Demand | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Demand>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

describe("RegisterDemand use-case", () => {
  let repository: InMemoryDemandRepository;
  let useCase: RegisterDemand;

  beforeEach(() => {
    repository = new InMemoryDemandRepository();
    useCase = new RegisterDemand(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    responsibleUserId: "u-1",
    demandChannel: "community_kitchen" as const,
    organizationName: "Comedor Comunitario Cali",
    productName: "Arroz",
    category: "Granos",
    unit: "kg",
    quantityRequired: 300,
    neededBy: new Date("2025-07-15"),
    beneficiaryCount: 120,
    municipalityName: "Cali",
    notes: "Entrega urgente"
  };

  it("registers a demand successfully", async () => {
    const demand = await useCase.execute(validCommand);

    expect(demand.id).toBeDefined();
    expect(demand.status).toBe("open");
    expect(demand.productName).toBe("Arroz");
    expect(demand.quantityRequired).toBe(300);
    expect(demand.beneficiaryCount).toBe(120);
    expect(demand.demandChannel).toBe("community_kitchen");
  });

  it("saves the demand to the repository", async () => {
    const demand = await useCase.execute(validCommand);
    const found = await repository.findById(demand.id);
    expect(found).not.toBeNull();
    expect(found!.organizationName).toBe("Comedor Comunitario Cali");
  });

  it("sets responsibleUserId to null when omitted", async () => {
    const demand = await useCase.execute({ ...validCommand, responsibleUserId: null });
    expect(demand.responsibleUserId).toBeNull();
  });

  it("sets notes to null when omitted", async () => {
    const demand = await useCase.execute({ ...validCommand, notes: null });
    expect(demand.notes).toBeNull();
  });

  it("throws INVALID_DEMAND_NEEDED_BY for invalid date", async () => {
    await expect(
      useCase.execute({ ...validCommand, neededBy: new Date("invalid") })
    ).rejects.toThrow("INVALID_DEMAND_NEEDED_BY");
  });
});
