import type { ResourceType, ResourceStatus } from "../value-objects/TrackingTypes.js";

export interface ResourceProps {
  id: string;
  tenantId: string;
  userId: string | null;
  nombre: string;
  tipo: ResourceType;
  placa: string | null;
  telefono: string | null;
  estado: ResourceStatus;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Resource {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly userId: string | null;
  public readonly nombre: string;
  public readonly tipo: ResourceType;
  public readonly placa: string | null;
  public readonly telefono: string | null;
  public readonly estado: ResourceStatus;
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: ResourceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.nombre = props.nombre.trim();
    this.tipo = props.tipo;
    this.placa = props.placa?.trim() || null;
    this.telefono = props.telefono?.trim() || null;
    this.estado = props.estado;
    this.latitude = props.latitude !== undefined && props.latitude !== null ? Number(props.latitude) : null;
    this.longitude = props.longitude !== undefined && props.longitude !== null ? Number(props.longitude) : null;
    this.metadata = props.metadata ?? {};
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
