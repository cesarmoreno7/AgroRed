/**
 * Cross-service integration test:
 * Register User → Login → Register Producer → Publish Offer → Register Rescue → Register Demand
 *
 * Uses InMemory repositories to validate the critical business flow
 * without requiring external infrastructure.
 */

import { RegisterUser } from "../../apps/user-service/src/application/use-cases/RegisterUser.js";
import { LoginUser } from "../../apps/user-service/src/application/use-cases/LoginUser.js";
import { InMemoryUserRepository } from "../../apps/user-service/src/infrastructure/repositories/InMemoryUserRepository.js";

import { RegisterProducer } from "../../apps/producer-service/src/application/use-cases/RegisterProducer.js";
import { InMemoryProducerRepository } from "../../apps/producer-service/src/infrastructure/repositories/InMemoryProducerRepository.js";

import { PublishOffer } from "../../apps/offer-service/src/application/use-cases/PublishOffer.js";
import type { Offer } from "../../apps/offer-service/src/domain/entities/Offer.js";
import type { OfferRepository, PaginationParams, PaginatedResult } from "../../apps/offer-service/src/domain/ports/OfferRepository.js";

import { RegisterRescue } from "../../apps/rescue-service/src/application/use-cases/RegisterRescue.js";
import type { Rescue } from "../../apps/rescue-service/src/domain/entities/Rescue.js";
import type { RescueRepository, PaginationParams as RescuePaginationParams, PaginatedResult as RescuePaginatedResult } from "../../apps/rescue-service/src/domain/ports/RescueRepository.js";

import { RegisterDemand } from "../../apps/demand-service/src/application/use-cases/RegisterDemand.js";
import type { Demand } from "../../apps/demand-service/src/domain/entities/Demand.js";
import type { DemandRepository, PaginationParams as DemandPaginationParams, PaginatedResult as DemandPaginatedResult } from "../../apps/demand-service/src/domain/ports/DemandRepository.js";

/* ── InMemory Offer Repository ───────────────────────────────── */

class InMemoryOfferRepository implements OfferRepository {
  private readonly store = new Map<string, Offer>();
  async save(offer: Offer): Promise<void> { this.store.set(offer.id, offer); }
  async findById(id: string): Promise<Offer | null> { return this.store.get(id) ?? null; }
  async list(params: PaginationParams): Promise<PaginatedResult<Offer>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

/* ── InMemory Rescue Repository ──────────────────────────────── */

class InMemoryRescueRepository implements RescueRepository {
  private readonly store = new Map<string, Rescue>();
  async save(rescue: Rescue): Promise<void> { this.store.set(rescue.id, rescue); }
  async findById(id: string): Promise<Rescue | null> { return this.store.get(id) ?? null; }
  async list(params: RescuePaginationParams): Promise<RescuePaginatedResult<Rescue>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

/* ── InMemory Demand Repository ──────────────────────────────── */

class InMemoryDemandRepository implements DemandRepository {
  private readonly store = new Map<string, Demand>();
  async save(demand: Demand): Promise<void> { this.store.set(demand.id, demand); }
  async findById(id: string): Promise<Demand | null> { return this.store.get(id) ?? null; }
  async list(params: DemandPaginationParams): Promise<DemandPaginatedResult<Demand>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }
}

/* ── Integration Test ────────────────────────────────────────── */

describe("Critical flow: User → Producer → Offer → Rescue → Demand", () => {
  const jwtSecret = "test-secret-key-for-integration";
  const jwtExpiresIn = "1h";
  const tenantId = "t-integration";
  const password = "securePass!456";

  let userRepo: InMemoryUserRepository;
  let producerRepo: InMemoryProducerRepository;
  let offerRepo: InMemoryOfferRepository;
  let rescueRepo: InMemoryRescueRepository;
  let demandRepo: InMemoryDemandRepository;

  let registerUser: RegisterUser;
  let loginUser: LoginUser;
  let registerProducer: RegisterProducer;
  let publishOffer: PublishOffer;
  let registerRescue: RegisterRescue;
  let registerDemand: RegisterDemand;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    producerRepo = new InMemoryProducerRepository();
    offerRepo = new InMemoryOfferRepository();
    rescueRepo = new InMemoryRescueRepository();
    demandRepo = new InMemoryDemandRepository();

    registerUser = new RegisterUser(userRepo);
    loginUser = new LoginUser(userRepo, jwtSecret, jwtExpiresIn);
    registerProducer = new RegisterProducer(producerRepo);
    publishOffer = new PublishOffer(offerRepo);
    registerRescue = new RegisterRescue(rescueRepo);
    registerDemand = new RegisterDemand(demandRepo);
  });

  it("completes the full producer-side flow (register → login → producer → offer → rescue)", async () => {
    // 1. Register a user
    const user = await registerUser.execute({
      tenantId,
      email: "productor@agrored.co",
      fullName: "Carlos Productor",
      role: "PRODUCER",
      password
    });
    expect(user.id).toBeDefined();
    expect(user.role).toBe("PRODUCER");

    // 2. Login
    const loginResult = await loginUser.execute({
      email: "productor@agrored.co",
      password
    });
    expect(loginResult.token).toBeDefined();
    expect(loginResult.token.split(".")).toHaveLength(3);
    expect(loginResult.modules).toContain("producer-service");

    // 3. Register as producer
    const producer = await registerProducer.execute({
      tenantId,
      userId: user.id,
      producerType: "individual",
      organizationName: "Finca El Paraíso",
      contactName: "Carlos Productor",
      contactPhone: "+573001234567",
      municipalityName: "Tuluá",
      zoneType: "rural",
      productCategories: ["Hortalizas", "Frutas"]
    });
    expect(producer.id).toBeDefined();
    expect(producer.userId).toBe(user.id);
    expect(producer.status).toBe("pending_verification");

    // 4. Publish an offer
    const offer = await publishOffer.execute({
      tenantId,
      producerId: producer.id,
      title: "Tomates frescos",
      productName: "Tomate",
      category: "Hortalizas",
      unit: "kg",
      quantityAvailable: 500,
      priceAmount: 1200,
      currency: "COP",
      availableFrom: new Date("2025-07-01"),
      availableUntil: new Date("2025-07-15"),
      municipalityName: "Tuluá",
      notes: "Cosecha orgánica"
    });
    expect(offer.id).toBeDefined();
    expect(offer.status).toBe("published");
    expect(offer.producerId).toBe(producer.id);

    // 5. Register a rescue for the offer
    const rescue = await registerRescue.execute({
      tenantId,
      producerId: producer.id,
      offerId: offer.id,
      rescueChannel: "food_bank",
      destinationOrganizationName: "Banco de Alimentos Valle",
      productName: "Tomate",
      category: "Hortalizas",
      unit: "kg",
      quantityRescued: 200,
      scheduledAt: new Date("2025-07-02T08:00:00Z"),
      beneficiaryCount: 80,
      municipalityName: "Tuluá"
    });
    expect(rescue.id).toBeDefined();
    expect(rescue.status).toBe("scheduled");
    expect(rescue.offerId).toBe(offer.id);
    expect(rescue.producerId).toBe(producer.id);

    // Verify all entities are persisted
    expect(await userRepo.findById(user.id)).not.toBeNull();
    expect(await producerRepo.findById(producer.id)).not.toBeNull();
    expect(await offerRepo.findById(offer.id)).not.toBeNull();
    expect(await rescueRepo.findById(rescue.id)).not.toBeNull();
  });

  it("completes the demand-side flow (register kitchen user → login → register demand)", async () => {
    // 1. Register a community kitchen user
    const user = await registerUser.execute({
      tenantId,
      email: "cocina@agrored.co",
      fullName: "María Cocina Comunitaria",
      role: "MUNICIPALITY",
      password
    });
    expect(user.role).toBe("MUNICIPALITY");

    // 2. Login
    const loginResult = await loginUser.execute({
      email: "cocina@agrored.co",
      password
    });
    expect(loginResult.modules).toContain("demand-service");

    // 3. Register a demand
    const demand = await registerDemand.execute({
      tenantId,
      responsibleUserId: user.id,
      demandChannel: "community_kitchen",
      organizationName: "Comedor Barrio Obrero",
      productName: "Arroz",
      category: "Granos",
      unit: "kg",
      quantityRequired: 100,
      neededBy: new Date("2025-07-10"),
      beneficiaryCount: 60,
      municipalityName: "Cali"
    });
    expect(demand.id).toBeDefined();
    expect(demand.status).toBe("open");
    expect(demand.responsibleUserId).toBe(user.id);

    // Verify persistence
    expect(await userRepo.findById(user.id)).not.toBeNull();
    expect(await demandRepo.findById(demand.id)).not.toBeNull();
  });

  it("prevents duplicate user registration", async () => {
    await registerUser.execute({
      tenantId,
      email: "duplicado@agrored.co",
      fullName: "First User",
      role: "PRODUCER",
      password
    });

    await expect(
      registerUser.execute({
        tenantId,
        email: "duplicado@agrored.co",
        fullName: "Second User",
        role: "PRODUCER",
        password
      })
    ).rejects.toThrow("USER_EMAIL_ALREADY_EXISTS");
  });

  it("prevents duplicate producer registration", async () => {
    await registerProducer.execute({
      tenantId,
      producerType: "association",
      organizationName: "Cooperativa Única",
      contactName: "Pedro",
      contactPhone: "+573009999999",
      municipalityName: "Buga",
      zoneType: "rural",
      productCategories: ["Frutas"]
    });

    await expect(
      registerProducer.execute({
        tenantId,
        producerType: "individual",
        organizationName: "Cooperativa Única",
        contactName: "Juan",
        contactPhone: "+573008888888",
        municipalityName: "Buga",
        zoneType: "urban_periphery",
        productCategories: ["Hortalizas"]
      })
    ).rejects.toThrow("PRODUCER_ALREADY_EXISTS");
  });

  it("rejects login with wrong password", async () => {
    await registerUser.execute({
      tenantId,
      email: "auth@agrored.co",
      fullName: "Auth Test",
      role: "ADMIN",
      password
    });

    await expect(
      loginUser.execute({ email: "auth@agrored.co", password: "wrongPassXYZ" })
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });
});
