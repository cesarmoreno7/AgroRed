import { randomUUID } from "node:crypto";
import { Resource } from "../../domain/entities/Resource.js";
import type { TrackingRepository } from "../../domain/ports/TrackingRepository.js";
import type { ResourceType } from "../../domain/value-objects/TrackingTypes.js";

export interface RegisterResourceCommand {
  tenantId: string;
  userId?: string | null;
  nombre: string;
  tipo: ResourceType;
  placa?: string | null;
  telefono?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown>;
}

export class RegisterResource {
  constructor(private readonly repository: TrackingRepository) {}

  async execute(command: RegisterResourceCommand): Promise<Resource> {
    const resource = new Resource({
      id: randomUUID(),
      tenantId: command.tenantId,
      userId: command.userId ?? null,
      nombre: command.nombre,
      tipo: command.tipo,
      placa: command.placa ?? null,
      telefono: command.telefono ?? null,
      estado: "disponible",
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      metadata: command.metadata ?? {},
    });

    await this.repository.saveResource(resource);
    return resource;
  }
}
