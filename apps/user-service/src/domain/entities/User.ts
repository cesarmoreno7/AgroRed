import type { UserRole } from "../value-objects/UserRole.js";
import { ROLE_PERMISSIONS, PERMISSIONS } from "../value-objects/UserRole.js";

export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  contactPhone?: string | null;
  createdAt?: Date;
}

export class User {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly email: string;
  public readonly fullName: string;
  public readonly role: UserRole;
  public readonly passwordHash: string;
  public readonly contactPhone: string | null;
  public readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.email = props.email.trim().toLowerCase();
    this.fullName = props.fullName.trim();
    this.role = props.role;
    this.passwordHash = props.passwordHash;
    this.contactPhone = props.contactPhone?.trim() || null;
    this.createdAt = props.createdAt ?? new Date();
  }

  hasPermission(permission: typeof PERMISSIONS[keyof typeof PERMISSIONS]): boolean {
    return ROLE_PERMISSIONS[this.role].includes(permission);
  }
}

