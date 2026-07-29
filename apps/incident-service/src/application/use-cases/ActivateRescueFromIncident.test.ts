import { activateRescueFromIncident } from "./ActivateRescueFromIncident.js";
import { Incident } from "../../domain/entities/Incident.js";
import { Producer } from "../../../../producer-service/src/domain/entities/Producer.js";
import { Offer } from "../../../../offer-service/src/domain/entities/Offer.js";
import type { ProducerRepository } from "../../../../producer-service/src/domain/ports/ProducerRepository.js";
import type { OfferRepository } from "../../../../offer-service/src/domain/ports/OfferRepository.js";
import type { Rescue } from "../../../../rescue-service/src/domain/entities/Rescue.js";
import type { RescueRepository, FoodOrigin } from "../../../../rescue-service/src/domain/ports/RescueRepository.js";

class FakeProducerRepository implements Partial<ProducerRepository> {
  constructor(private readonly producers: Producer[] = []) {}
  async findByUserId(userId: string): Promise<Producer | null> {
    return this.producers.find((p) => p.userId === userId) ?? null;
  }
}

class FakeOfferRepository implements Partial<OfferRepository> {
  constructor(private readonly offers: Offer[] = []) {}
  async findLatestActiveByProducerId(producerId: string): Promise<Offer | null> {
    return this.offers.find((o) => o.producerId === producerId && o.status === "published") ?? null;
  }
}

class FakeRescueRepository implements RescueRepository {
  public saved: Rescue[] = [];
  async save(rescue: Rescue): Promise<void> { this.saved.push(rescue); }
  async findById(): Promise<Rescue | null> { return null; }
  async list(): Promise<{ data: Rescue[]; total: number; page: number; limit: number }> {
    return { data: [], total: 0, page: 1, limit: 20 };
  }
  async patch(): Promise<Rescue | null> { return null; }
  async saveOrigin(): Promise<FoodOrigin> { throw new Error("not implemented"); }
  async listOrigins(): Promise<FoodOrigin[]> { return []; }
  async updateOrigin(): Promise<FoodOrigin | null> { return null; }
  async deleteOrigin(): Promise<boolean> { return false; }
}

function buildIncident(overrides: Partial<ConstructorParameters<typeof Incident>[0]> = {}): Incident {
  return new Incident({
    id: "inc-1",
    tenantId: "t-1",
    logisticsOrderId: null,
    incidentType: "desperdicio_alimentario",
    severity: "high",
    title: "Excedente de cosecha en riesgo",
    description: "Producto perecedero sin comprador, riesgo de perdida en 24h.",
    locationDescription: "Vereda La Playa",
    latitude: 6.15,
    longitude: -75.37,
    occurredAt: new Date("2026-07-01T10:00:00Z"),
    municipalityName: "Rionegro",
    status: "open",
    reportedBy: "user-producer-1",
    affectedPopulation: 40,
    ...overrides
  });
}

const producer = new Producer({
  id: "producer-1",
  tenantId: "t-1",
  userId: "user-producer-1",
  producerType: "individual",
  organizationName: "Finca La Esperanza",
  contactName: "Maria Gomez",
  contactPhone: "3001112233",
  municipalityName: "Rionegro",
  zoneType: "rural",
  productCategories: ["hortalizas"],
  status: "active"
});

const activeOffer = new Offer({
  id: "offer-1",
  tenantId: "t-1",
  producerId: "producer-1",
  title: "Tomate en excedente",
  productName: "Tomate",
  category: "Hortalizas",
  unit: "kg",
  quantityAvailable: 300,
  priceAmount: 0,
  currency: "COP",
  availableFrom: new Date("2026-07-01T00:00:00Z"),
  municipalityName: "Rionegro",
  status: "published"
});

describe("activateRescueFromIncident (Bug #12)", () => {
  it("creates a real rescue sourced from the reporting producer's active offer", async () => {
    const rescueRepository = new FakeRescueRepository();
    const result = await activateRescueFromIncident(buildIncident(), {
      producerRepository: new FakeProducerRepository([producer]) as ProducerRepository,
      offerRepository: new FakeOfferRepository([activeOffer]) as OfferRepository,
      rescueRepository
    });

    expect(result).toEqual(expect.objectContaining({ triggered: true, offerId: "offer-1" }));
    expect(rescueRepository.saved).toHaveLength(1);
    const rescue = rescueRepository.saved[0];
    expect(rescue.producerId).toBe("producer-1");
    expect(rescue.productName).toBe("Tomate");
    expect(rescue.quantityRescued).toBe(300);
    expect(rescue.rescueChannel).toBe("food_bank");
    expect(rescue.beneficiaryCount).toBe(40);
  });

  it("does not trigger for incident types unrelated to food loss", async () => {
    const rescueRepository = new FakeRescueRepository();
    const result = await activateRescueFromIncident(buildIncident({ incidentType: "vehicle_failure" }), {
      producerRepository: new FakeProducerRepository([producer]) as ProducerRepository,
      offerRepository: new FakeOfferRepository([activeOffer]) as OfferRepository,
      rescueRepository
    });

    expect(result).toEqual({ triggered: false, reason: "INCIDENT_TYPE_NOT_ELIGIBLE" });
    expect(rescueRepository.saved).toHaveLength(0);
  });

  it("does not fabricate a rescue when the reporter is not a known producer", async () => {
    const rescueRepository = new FakeRescueRepository();
    const result = await activateRescueFromIncident(buildIncident({ reportedBy: "admin-user-1" }), {
      producerRepository: new FakeProducerRepository([producer]) as ProducerRepository,
      offerRepository: new FakeOfferRepository([activeOffer]) as OfferRepository,
      rescueRepository
    });

    expect(result).toEqual({ triggered: false, reason: "REPORTER_NOT_A_PRODUCER" });
    expect(rescueRepository.saved).toHaveLength(0);
  });

  it("does not fabricate a rescue when the producer has no active offer to link", async () => {
    const rescueRepository = new FakeRescueRepository();
    const result = await activateRescueFromIncident(buildIncident(), {
      producerRepository: new FakeProducerRepository([producer]) as ProducerRepository,
      offerRepository: new FakeOfferRepository([]) as OfferRepository,
      rescueRepository
    });

    expect(result).toEqual({ triggered: false, reason: "NO_ACTIVE_OFFER_FOUND" });
    expect(rescueRepository.saved).toHaveLength(0);
  });
});
