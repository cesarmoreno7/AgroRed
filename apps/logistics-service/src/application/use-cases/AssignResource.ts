import type { TrackingRepository } from "../../domain/ports/TrackingRepository.js";

export class AssignResource {
  constructor(private readonly repository: TrackingRepository) {}

  async execute(ordenId: string, recursoId: string): Promise<void> {
    const resource = await this.repository.findResourceById(recursoId);
    if (!resource) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    if (resource.estado !== "disponible") {
      throw new Error("RESOURCE_NOT_AVAILABLE");
    }

    await this.repository.assignResourceToOrder(ordenId, recursoId);

    await this.repository.updateResourceStatus(recursoId, "en_ruta");

    await this.repository.recordDeliveryEvent({
      ordenId,
      recursoId,
      evento: "asignado",
      latitude: resource.latitude,
      longitude: resource.longitude,
      notas: null,
      evidenciaUrl: null,
      metadata: {},
    });
  }
}
