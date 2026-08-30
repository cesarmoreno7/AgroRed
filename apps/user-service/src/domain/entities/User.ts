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
  expiresAt?: Date | null;
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
  /** Vencimiento del acceso. null = sin vencimiento. */
  public readonly expiresAt: Date | null;

  constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.email = props.email.trim().toLowerCase();
    this.fullName = props.fullName.trim();
    this.role = props.role;
    this.passwordHash = props.passwordHash;
    this.contactPhone = props.contactPhone?.trim() || null;
    this.createdAt = props.createdAt ?? new Date();
    this.expiresAt = props.expiresAt ?? null;
  }

  /** true si el acceso ya vencio (expires_at en el pasado). */
  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() <= now.getTime();
  }

  hasPermission(permission: typeof PERMISSIONS[keyof typeof PERMISSIONS]): boolean {
    return ROLE_PERMISSIONS[this.role].includes(permission);
  }
}

