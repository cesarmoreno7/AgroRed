import type {
  ProducerStatus,
  ProducerType,
  ProducerZone
} from "../value-objects/ProducerType.js";

export interface ProducerProps {
  id: string;
  tenantId: string;
  userId: string | null;
  producerType: ProducerType;
  organizationName: string;
  contactName: string;
  contactPhone: string;
  municipalityName: string;
  zoneType: ProducerZone;
  productCategories: string[];
  latitude?: number | null;
  longitude?: number | null;
  status: ProducerStatus;
  createdAt?: Date;
}

export class Producer {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly userId: string | null;
  public readonly producerType: ProducerType;
  public readonly organizationName: string;
  public readonly contactName: string;
  public readonly contactPhone: string;
  public readonly municipalityName: string;
  public readonly zoneType: ProducerZone;
  public readonly productCategories: string[];
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly status: ProducerStatus;
  public readonly createdAt: Date;

  constructor(props: ProducerProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.producerType = props.producerType;
    this.organizationName = props.organizationName.trim();
    this.contactName = props.contactName.trim();
    this.contactPhone = props.contactPhone.trim();
    this.municipalityName = props.municipalityName.trim();
    this.zoneType = props.zoneType;
    this.productCategories = props.productCategories.map((category) => category.trim()).filter(Boolean);
    this.latitude = props.latitude === undefined || props.latitude === null ? null : Number(props.latitude);
    this.longitude = props.longitude === undefined || props.longitude === null ? null : Number(props.longitude);
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}
