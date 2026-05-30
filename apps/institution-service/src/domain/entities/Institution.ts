import type { InstitutionStatus, InstitutionType } from "../value-objects/InstitutionType.js";

export interface InstitutionProps {
  id: string;
  tenantId: string;
  institutionType: InstitutionType;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  municipalityName: string;
  address?: string | null;
  beneficiaryCount: number;
  productCategories: string[];
  latitude?: number | null;
  longitude?: number | null;
  status: InstitutionStatus;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: Date;
}

export class Institution {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly institutionType: InstitutionType;
  public readonly name: string;
  public readonly contactName: string;
  public readonly contactPhone: string;
  public readonly contactEmail: string | null;
  public readonly municipalityName: string;
  public readonly address: string | null;
  public readonly beneficiaryCount: number;
  public readonly productCategories: string[];
  public readonly latitude: number | null;
  public readonly longitude: number | null;
  public readonly status: InstitutionStatus;
  public readonly notes: string | null;
  public readonly createdBy: string | null;
  public readonly createdAt: Date;

  constructor(props: InstitutionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.institutionType = props.institutionType;
    this.name = props.name.trim();
    this.contactName = props.contactName.trim();
    this.contactPhone = props.contactPhone.trim();
    this.contactEmail = props.contactEmail?.trim() || null;
    this.municipalityName = props.municipalityName.trim();
    this.address = props.address?.trim() || null;
    this.beneficiaryCount = Math.max(0, Math.round(props.beneficiaryCount));
    this.productCategories = props.productCategories.map((c) => c.trim()).filter(Boolean);
    this.latitude = props.latitude ?? null;
    this.longitude = props.longitude ?? null;
    this.status = props.status;
    this.notes = props.notes?.trim() || null;
    this.createdBy = props.createdBy ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}
