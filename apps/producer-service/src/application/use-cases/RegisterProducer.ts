import { randomUUID } from "node:crypto";
import { Producer } from "../../domain/entities/Producer.js";
import type { ProducerRepository } from "../../domain/ports/ProducerRepository.js";
import type {
  ProducerType,
  ProducerZone
} from "../../domain/value-objects/ProducerType.js";

export interface RegisterProducerCommand {
  tenantId: string;
  userId?: string | null;
  producerType: ProducerType;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  municipalityName: string;
  zoneType: ProducerZone;
  productCategories: string[];
  latitude?: number | null;
  longitude?: number | null;
}

export class RegisterProducer {
  constructor(private readonly repository: ProducerRepository) {}

  async execute(command: RegisterProducerCommand): Promise<Producer> {
    const normalizedOrganizationName = command.organizationName.trim().toLowerCase();
    const existingProducer = await this.repository.findByOrganizationName(
      command.tenantId,
      normalizedOrganizationName
    );

    if (existingProducer) {
      throw new Error("PRODUCER_ALREADY_EXISTS");
    }

    const producer = new Producer({
      id: randomUUID(),
      tenantId: command.tenantId,
      userId: command.userId ?? null,
      producerType: command.producerType,
      organizationName: command.organizationName,
      contactName: command.contactName,
      contactPhone: command.contactPhone,
      municipalityName: command.municipalityName,
      zoneType: command.zoneType,
      productCategories: command.productCategories,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      status: "pending_verification"
    });

    await this.repository.save(producer);

    return producer;
  }
}
