import { TrackingPoint } from "../../domain/entities/TrackingPoint.js";
import type { TrackingRepository, CurrentPosition } from "../../domain/ports/TrackingRepository.js";
import type { TrackingEvent } from "../../domain/value-objects/TrackingTypes.js";

export interface RecordPositionCommand {
  recursoId: string;
  ordenId?: string | null;
  latitude: number;
  longitude: number;
  velocidad?: number | null;
  precisionGps?: number | null;
  bearing?: number | null;
  evento?: TrackingEvent;
  metadata?: Record<string, unknown>;
}

export class RecordPosition {
  constructor(private readonly repository: TrackingRepository) {}

  async execute(command: RecordPositionCommand): Promise<CurrentPosition> {
    const resource = await this.repository.findResourceById(command.recursoId);
    if (!resource) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    const point = new TrackingPoint({
      recursoId: command.recursoId,
      ordenId: command.ordenId ?? null,
      latitude: command.latitude,
      longitude: command.longitude,
      velocidad: command.velocidad ?? null,
      precisionGps: command.precisionGps ?? null,
      bearing: command.bearing ?? null,
      evento: command.evento ?? "posicion",
      metadata: command.metadata ?? {},
    });

    await this.repository.recordPosition(point);

    const position = await this.repository.getCurrentPosition(command.recursoId);
    if (!position) {
      throw new Error("POSITION_NOT_FOUND");
    }

    return position;
  }
}
