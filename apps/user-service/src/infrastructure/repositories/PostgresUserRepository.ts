import type { Pool } from "pg";
import { User } from "../../domain/entities/User.js";
import type { UserRepository, PaginationParams, PaginatedResult } from "../../domain/ports/UserRepository.js";
import type { UserRole } from "../../domain/value-objects/UserRole.js";

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
  contact_phone: string | null;
  created_at: Date;
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async save(user: User): Promise<void> {
    const tenantId = await this.resolveTenantId(user.tenantId);

    await this.pool.query(
      `INSERT INTO public.users (id, tenant_id, email, full_name, role, password_hash, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, tenantId, user.email, user.fullName, user.role, user.passwordHash, user.contactPhone]
    );
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, password_hash, contact_phone, created_at
       FROM public.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, password_hash, contact_phone, created_at
       FROM public.users
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<User>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, password_hash, contact_phone, created_at
       FROM public.users
       WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: UserRow) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.tenants
        WHERE id::text = $1 OR UPPER(code) = UPPER($1)
        LIMIT 1
      `,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0].id;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<User | null> {
    const COLS: Record<string, string> = {
      fullName: "full_name", role: "role", status: "status", contactPhone: "contact_phone"
    };
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (COLS[k] !== undefined) { sets.push(`${COLS[k]} = $${i++}`); vals.push(v ?? null); }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = NOW()`); vals.push(id);
    await this.pool.query(`UPDATE public.users SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL`, vals);
    return this.findById(id);
  }

  private mapRow(row: UserRow): User {
    return new User({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      passwordHash: row.password_hash,
      contactPhone: row.contact_phone,
      createdAt: row.created_at
    });
  }
}

