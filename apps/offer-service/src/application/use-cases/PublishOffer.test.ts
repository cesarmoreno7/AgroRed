import { PublishOffer } from "./PublishOffer.js";
import type { Offer } from "../../domain/entities/Offer.js";
import type { OfferRepository, PaginationParams, PaginatedResult } from "../../domain/ports/OfferRepository.js";

class InMemoryOfferRepository implements OfferRepository {
  private readonly store = new Map<string, Offer>();

  async save(offer: Offer): Promise<void> {
    this.store.set(offer.id, offer);
  }

  async findById(id: string): Promise<Offer | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Offer>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

describe("PublishOffer use-case", () => {
  let repository: InMemoryOfferRepository;
  let useCase: PublishOffer;

  beforeEach(() => {
    repository = new InMemoryOfferRepository();
    useCase = new PublishOffer(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    producerId: "p-1",
    title: "Tomates orgánicos",
    productName: "Tomate",
    category: "Hortalizas",
    unit: "kg",
    quantityAvailable: 500,
    priceAmount: 1200,
    currency: "COP",
    availableFrom: new Date("2025-06-01"),
    availableUntil: new Date("2025-06-30"),
    municipalityName: "Tuluá",
    notes: "Cosecha fresca"
  };

  it("publishes an offer successfully", async () => {
    const offer = await useCase.execute(validCommand);

    expect(offer.id).toBeDefined();
    expect(offer.status).toBe("published");
    expect(offer.title).toBe("Tomates orgánicos");
    expect(offer.productName).toBe("Tomate");
    expect(offer.quantityAvailable).toBe(500);
  });

  it("saves the offer to the repository", async () => {
    const offer = await useCase.execute(validCommand);
    const found = await repository.findById(offer.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Tomates orgánicos");
  });

  it("works without availableUntil", async () => {
    const offer = await useCase.execute({ ...validCommand, availableUntil: null });
    expect(offer.availableUntil).toBeNull();
  });

  it("works without notes", async () => {
    const offer = await useCase.execute({ ...validCommand, notes: null });
    expect(offer.notes).toBeNull();
  });

  it("throws INVALID_OFFER_AVAILABILITY_WINDOW when availableUntil < availableFrom", async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        availableFrom: new Date("2025-07-01"),
        availableUntil: new Date("2025-06-01")
      })
    ).rejects.toThrow("INVALID_OFFER_AVAILABILITY_WINDOW");
  });

  it("throws INVALID_OFFER_AVAILABILITY_WINDOW for invalid availableFrom", async () => {
    await expect(
      useCase.execute({ ...validCommand, availableFrom: new Date("invalid-date") })
    ).rejects.toThrow("INVALID_OFFER_AVAILABILITY_WINDOW");
  });
});
