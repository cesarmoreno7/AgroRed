import { randomUUID } from "node:crypto";
import { LogisticsOrder } from "../../domain/entities/LogisticsOrder.js";
import type { LogisticsOrderRepository } from "../../domain/ports/LogisticsOrderRepository.js";
import type { RouteMode } from "../../domain/value-objects/RouteMode.js";

export interface RegisterLogisticsOrderCommand {
  tenantId: string;
  inventoryItemId: string;
  demandId?: string | null;
  routeMode: RouteMode;
  originLocationName: string;
  destinationOrganizationName: string;
  destinationAddress: string;
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  scheduledPickupAt: Date;
  scheduledDeliveryAt: Date;
  quantityAssigned: number;
  municipalityName: string;
  notes?: string | null;
}

export class RegisterLogisticsOrder {
  constructor(private readonly repository: LogisticsOrderRepository) {}

  async execute(command: RegisterLogisticsOrderCommand): Promise<LogisticsOrder> {
    const scheduledPickupAt = new Date(command.scheduledPickupAt);
    const scheduledDeliveryAt = new Date(command.scheduledDeliveryAt);

    if (
      Number.isNaN(scheduledPickupAt.getTime()) ||
      Number.isNaN(scheduledDeliveryAt.getTime()) ||
      scheduledDeliveryAt < scheduledPickupAt
    ) {
      throw new Error("INVALID_LOGISTICS_SCHEDULE");
    }

    const order = new LogisticsOrder({
      id: randomUUID(),
      tenantId: command.tenantId,
      inventoryItemId: command.inventoryItemId,
      demandId: command.demandId ?? null,
      routeMode: command.routeMode,
      originLocationName: command.originLocationName,
      destinationOrganizationName: command.destinationOrganizationName,
      destinationAddress: command.destinationAddress,
      originLatitude: command.originLatitude ?? null,
      originLongitude: command.originLongitude ?? null,
      destinationLatitude: command.destinationLatitude ?? null,
      destinationLongitude: command.destinationLongitude ?? null,
      scheduledPickupAt,
      scheduledDeliveryAt,
      quantityAssigned: command.quantityAssigned,
      municipalityName: command.municipalityName,
      notes: command.notes ?? null,
      status: "scheduled"
    });

    await this.repository.save(order);

    return order;
  }
}