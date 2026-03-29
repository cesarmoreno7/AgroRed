import { randomUUID } from "node:crypto";
import { Demand } from "../../domain/entities/Demand.js";
import type { DemandRepository } from "../../domain/ports/DemandRepository.js";
import type { DemandChannel } from "../../domain/value-objects/DemandChannel.js";

export interface RegisterDemandCommand {
  tenantId: string;
  responsibleUserId?: string | null;
  demandChannel: DemandChannel;
  organizationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityRequired: number;
  neededBy: Date;
  beneficiaryCount: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export class RegisterDemand {
  constructor(private readonly repository: DemandRepository) {}

  async execute(command: RegisterDemandCommand): Promise<Demand> {
    const neededBy = new Date(command.neededBy);

    if (Number.isNaN(neededBy.getTime())) {
      throw new Error("INVALID_DEMAND_NEEDED_BY");
    }

    const demand = new Demand({
      id: randomUUID(),
      tenantId: command.tenantId,
      responsibleUserId: command.responsibleUserId ?? null,
      demandChannel: command.demandChannel,
      organizationName: command.organizationName,
      productName: command.productName,
      category: command.category,
      unit: command.unit,
      quantityRequired: command.quantityRequired,
      neededBy,
      beneficiaryCount: command.beneficiaryCount,
      municipalityName: command.municipalityName,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      notes: command.notes ?? null,
      status: "open"
    });

    await this.repository.save(demand);

    return demand;
  }
}
