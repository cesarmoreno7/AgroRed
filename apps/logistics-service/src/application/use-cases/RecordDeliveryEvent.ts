import type { TrackingRepository, DeliveryEventRecord } from "../../domain/ports/TrackingRepository.js";
import type { DeliveryEvent } from "../../domain/value-objects/TrackingTypes.js";

export interface RecordDeliveryEventCommand {
  ordenId: string;
  recursoId: string;
  evento: DeliveryEvent;
  latitude?: number | null;
  longitude?: number | null;
  notas?: string | null;
  evidenciaUrl?: string | null;
  metadata?: Record<string, unknown>;
}

// Map delivery events → logistics_orders status
const EVENT_TO_ORDER_STATUS: Record<string, string | null> = {
  asignado: "scheduled",
  aceptado: "scheduled",
  inicio_ruta: "in_transit",
  llegada_origen: "in_transit",
  recogida: "in_transit",
  en_transito: "in_transit",
  llegada_destino: "in_transit",
  entregado: "delivered",
  no_entregado: "cancelled",
  cancelado: "cancelled",
  rechazado: null,
  pausa: null,
  reanudacion: null,
};

// Map delivery events → resource status
const EVENT_TO_RESOURCE_STATUS: Record<string, string | null> = {
  asignado: "en_ruta",
  inicio_ruta: "en_ruta",
  entregado: "disponible",
  no_entregado: "disponible",
  cancelado: "disponible",
  rechazado: "disponible",
};

export class RecordDeliveryEventUseCase {
  constructor(private readonly repository: TrackingRepository) {}

  async execute(command: RecordDeliveryEventCommand): Promise<DeliveryEventRecord[]> {
    const resource = await this.repository.findResourceById(command.recursoId);
    if (!resource) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    await this.repository.recordDeliveryEvent({
      ordenId: command.ordenId,
      recursoId: command.recursoId,
      evento: command.evento,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      notas: command.notas ?? null,
      evidenciaUrl: command.evidenciaUrl ?? null,
      metadata: command.metadata ?? {},
    });

    // Update resource status if applicable
    const newResourceStatus = EVENT_TO_RESOURCE_STATUS[command.evento];
    if (newResourceStatus) {
      await this.repository.updateResourceStatus(
        command.recursoId,
        newResourceStatus as "disponible" | "en_ruta"
      );
    }

    // Record position if coordinates provided
    if (command.latitude != null && command.longitude != null) {
      const trackingEvent = command.evento as string;
      const validTrackingEvents = [
        "posicion", "inicio_ruta", "llegada_origen", "recogida",
        "en_transito", "llegada_destino", "entregado", "pausa", "reanudacion"
      ];

      if (validTrackingEvents.includes(trackingEvent)) {
        const { TrackingPoint } = await import("../../domain/entities/TrackingPoint.js");
        const point = new TrackingPoint({
          recursoId: command.recursoId,
          ordenId: command.ordenId,
          latitude: command.latitude,
          longitude: command.longitude,
          velocidad: null,
          precisionGps: null,
          bearing: null,
          evento: trackingEvent as "posicion" | "inicio_ruta" | "llegada_origen" | "recogida" | "en_transito" | "llegada_destino" | "entregado" | "pausa" | "reanudacion",
          metadata: {},
        });
        await this.repository.recordPosition(point);
      }
    }

    return this.repository.getOrderTimeline(command.ordenId);
  }
}

export { EVENT_TO_ORDER_STATUS };
