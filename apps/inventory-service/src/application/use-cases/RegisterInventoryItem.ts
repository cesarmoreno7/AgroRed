import { randomUUID } from "node:crypto";
import { InventoryItem } from "../../domain/entities/InventoryItem.js";
import type { InventoryItemRepository } from "../../domain/ports/InventoryItemRepository.js";
import type { InventorySourceType } from "../../domain/value-objects/InventorySourceType.js";

export interface RegisterInventoryItemCommand {
  tenantId: string;
  producerId: string;
  offerId?: string | null;
  rescueId?: string | null;
  sourceType: InventorySourceType;
  storageLocationName: string;
  productName: string;
  category: string;
  unit: string;
  quantityOnHand: number;
  quantityReserved?: number;
  municipalityName: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  expiresAt?: Date | null;
}

export class RegisterInventoryItem {
  constructor(private readonly repository: InventoryItemRepository) {}

  async execute(command: RegisterInventoryItemCommand): Promise<InventoryItem> {
    const quantityReserved = Number(command.quantityReserved ?? 0);

    if (command.sourceType === "offer_stock" && !command.offerId) {
      throw new Error("INVALID_INVENTORY_SOURCE_LINK");
    }

    if (command.sourceType === "rescued_stock" && !command.rescueId) {
      throw new Error("INVALID_INVENTORY_SOURCE_LINK");
    }

    if (quantityReserved < 0 || quantityReserved > command.quantityOnHand) {
      throw new Error("INVALID_INVENTORY_QUANTITY_BALANCE");
    }

    const item = new InventoryItem({
      id: randomUUID(),
      tenantId: command.tenantId,
      producerId: command.producerId,
      offerId: command.offerId ?? null,
      rescueId: command.rescueId ?? null,
      sourceType: command.sourceType,
      storageLocationName: command.storageLocationName,
      productName: command.productName,
      category: command.category,
      unit: command.unit,
      quantityOnHand: command.quantityOnHand,
      quantityReserved,
      municipalityName: command.municipalityName,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      notes: command.notes ?? null,
      expiresAt: command.expiresAt ?? null,
      status: quantityReserved === command.quantityOnHand ? "reserved" : "available"
    });

    await this.repository.save(item);

    return item;
  }
}