import { randomUUID } from "node:crypto";
import { Rescue } from "../../domain/entities/Rescue.js";
import type { RescueRepository } from "../../domain/ports/RescueRepository.js";
import type { RescueChannel } from "../../domain/value-objects/RescueChannel.js";

export interface RegisterRescueCommand {
  tenantId: string;
  producerId: string;
  offerId?: string | null;
  rescueChannel: RescueChannel;
  destinationOrganizationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityRescued: number;
  scheduledAt: Date;
  beneficiaryCount: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export class RegisterRescue {
  constructor(private readonly repository: RescueRepository) {}

  async execute(command: RegisterRescueCommand): Promise<Rescue> {
    const scheduledAt = new Date(command.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error("INVALID_RESCUE_SCHEDULE");
    }

    const rescue = new Rescue({
      id: randomUUID(),
      tenantId: command.tenantId,
      producerId: command.producerId,
      offerId: command.offerId ?? null,
      rescueChannel: command.rescueChannel,
      destinationOrganizationName: command.destinationOrganizationName,
      productName: command.productName,
      category: command.category,
      unit: command.unit,
      quantityRescued: command.quantityRescued,
      scheduledAt,
      beneficiaryCount: command.beneficiaryCount,
      municipalityName: command.municipalityName,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      notes: command.notes ?? null,
      status: "scheduled"
    });

    await this.repository.save(rescue);

    return rescue;
  }
}
