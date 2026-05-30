import type { Pool } from "pg";
import { Demand } from "../../domain/entities/Demand.js";
import type { DemandRepository, PaginationParams, PaginatedResult } from "../../domain/ports/DemandRepository.js";
import type { DemandChannel } from "../../domain/value-objects/DemandChannel.js";
import type { DemandStatus } from "../../domain/value-objects/DemandStatus.js";

interface DemandRow {
  id: string;
  tenant_id: string;
  responsible_user_id: string | null;
  institution_id: string | null;
  demand_channel: DemandChannel;
  organization_name: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_required: string;
  needed_by: Date;
  beneficiary_count: number;
  municipality_name: string;
  notes: string | null;
  status: DemandStatus;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
}

export class PostgresDemandRepository implements DemandRepository {
  constructor(private readonly pool: Pool) {}

  async save(demand: Demand): Promise<void> {
    const tenantId = await this.resolveTenantId(demand.tenantId);
    const responsibleUserId = demand.responsibleUserId
      ? await this.resolveUserId(demand.responsibleUserId, tenantId)
      : null;

    await this.pool.query(
      `INSERT INTO public.demands (
          id, tenant_id, responsible_user_id, institution_id, demand_channel,
          organization_name, product_name, category, unit, quantity_required,
          needed_by, beneficiary_count, municipality_name, notes, status, latitude, longitude
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        demand.id, tenantId, responsibleUserId, demand.institutionId,
        demand.demandChannel, demand.organizationName, demand.productName,
        demand.category, demand.unit, demand.quantityRequired, demand.neededBy,
        demand.beneficiaryCount, demand.municipalityName, demand.notes,
        demand.status, demand.latitude, demand.longitude
      ]
    );
  }

  async findById(id: string): Promise<Demand | null> {
    const result = await this.pool.query<DemandRow>(
      `SELECT id, tenant_id, responsible_user_id, institution_id, demand_channel,
              organization_name, product_name, category, unit, quantity_required,
              needed_by, beneficiary_count, municipality_name, notes, status,
              latitude, longitude, created_at
       FROM public.demands
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Demand>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.demands WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<DemandRow>(
      `SELECT id, tenant_id, responsible_user_id, institution_id, demand_channel,
              organization_name, product_name, category, unit, quantity_required,
              needed_by, beneficiary_count, municipality_name, notes, status,
              latitude, longitude, created_at
       FROM public.demands
       WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: DemandRow) => this.mapRow(row)),
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

  private async resolveUserId(userId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("USER_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<Demand | null> {
    const COLS: Record<string, string> = {
      demandChannel: "demand_channel", organizationName: "organization_name",
      productName: "product_name", category: "category", unit: "unit",
      quantityRequired: "quantity_required", neededBy: "needed_by",
      beneficiaryCount: "beneficiary_count", municipalityName: "municipality_name",
      notes: "notes", status: "status", latitude: "latitude", longitude: "longitude",
      institutionId: "institution_id"
    };
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (COLS[k] !== undefined) { sets.push(`${COLS[k]} = $${i++}`); vals.push(v ?? null); }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = NOW()`); vals.push(id);
    await this.pool.query(`UPDATE public.demands SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL`, vals);
    return this.findById(id);
  }

  private mapRow(row: DemandRow): Demand {
    return new Demand({
      id: row.id,
      tenantId: row.tenant_id,
      responsibleUserId: row.responsible_user_id,
      institutionId: row.institution_id,
      demandChannel: row.demand_channel,
      organizationName: row.organization_name,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityRequired: Number(row.quantity_required),
      neededBy: row.needed_by,
      beneficiaryCount: row.beneficiary_count,
      municipalityName: row.municipality_name,
      notes: row.notes,
      status: row.status,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      createdAt: row.created_at
    });
  }
}
