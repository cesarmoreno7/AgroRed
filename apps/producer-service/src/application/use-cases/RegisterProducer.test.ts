import { RegisterProducer } from "./RegisterProducer.js";
import { InMemoryProducerRepository } from "../../infrastructure/repositories/InMemoryProducerRepository.js";

describe("RegisterProducer use-case", () => {
  let repository: InMemoryProducerRepository;
  let useCase: RegisterProducer;

  beforeEach(() => {
    repository = new InMemoryProducerRepository();
    useCase = new RegisterProducer(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    userId: "u-1",
    producerType: "cooperative" as const,
    organizationName: "Coop Agrícola Valle",
    contactName: "Carlos Pérez",
    contactPhone: "3001234567",
    municipalityName: "Cartago",
    zoneType: "rural" as const,
    productCategories: ["frutas", "hortalizas"]
  };

  it("registers a producer successfully", async () => {
    const producer = await useCase.execute(validCommand);

    expect(producer.id).toBeDefined();
    expect(producer.organizationName).toBe("Coop Agrícola Valle");
    expect(producer.status).toBe("pending_verification");
    expect(producer.producerType).toBe("cooperative");
  });

  it("saves the producer to the repository", async () => {
    const producer = await useCase.execute(validCommand);
    const found = await repository.findById(producer.id);
    expect(found).not.toBeNull();
    expect(found!.organizationName).toBe("Coop Agrícola Valle");
  });

  it("throws PRODUCER_ALREADY_EXISTS for duplicate organization in same tenant", async () => {
    await useCase.execute(validCommand);
    await expect(useCase.execute(validCommand)).rejects.toThrow("PRODUCER_ALREADY_EXISTS");
  });

  it("allows same organization name in different tenants", async () => {
    await useCase.execute(validCommand);
    const other = await useCase.execute({ ...validCommand, tenantId: "t-2" });
    expect(other.tenantId).toBe("t-2");
  });

  it("sets userId to null when omitted", async () => {
    const producer = await useCase.execute({ ...validCommand, userId: null });
    expect(producer.userId).toBeNull();
  });
});
