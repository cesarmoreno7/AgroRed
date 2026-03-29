import type { TrackingEvent } from "../value-objects/TrackingTypes.js";

export interface TrackingPointProps {
  id?: number;
  recursoId: string;
  ordenId: string | null;
  latitude: number;
  longitude: number;
  velocidad: number | null;
  precisionGps: number | null;
  bearing: number | null;
  evento: TrackingEvent;
  metadata: Record<string, unknown>;
  registradoAt?: Date;
}

export class TrackingPoint {
  public readonly id: number | undefined;
  public readonly recursoId: string;
  public readonly ordenId: string | null;
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly velocidad: number | null;
  public readonly precisionGps: number | null;
  public readonly bearing: number | null;
  public readonly evento: TrackingEvent;
  public readonly metadata: Record<string, unknown>;
  public readonly registradoAt: Date;

  constructor(props: TrackingPointProps) {
    this.id = props.id;
    this.recursoId = props.recursoId;
    this.ordenId = props.ordenId;
    this.latitude = Number(props.latitude);
    this.longitude = Number(props.longitude);
    this.velocidad = props.velocidad !== null && props.velocidad !== undefined ? Number(props.velocidad) : null;
    this.precisionGps = props.precisionGps !== null && props.precisionGps !== undefined ? Number(props.precisionGps) : null;
    this.bearing = props.bearing !== null && props.bearing !== undefined ? Number(props.bearing) : null;
    this.evento = props.evento;
    this.metadata = props.metadata ?? {};
    this.registradoAt = props.registradoAt ?? new Date();
  }
}
