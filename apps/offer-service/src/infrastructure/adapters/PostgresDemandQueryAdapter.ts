import type { Pool } from "pg";
import type { DemandQueryPort } from "../../domain/ports/DemandQueryPort.js";
import type { MatchableDemand } from "../../domain/entities/MatchableDemand.js";

interface DemandRow {
  id: string;
  tenant_id: string;
  demand_channel: string;
  organization_name: string;
  product_name: string;
  category: string;
  unit: string;
  quantity_required: string;
  needed_by: Date;
  beneficiary_count: string;
  municipality_name: string;
  latitude: string | null;
  longitude: string | null;
}

export class PostgresDemandQueryAdapter implements DemandQueryPort {
  constructor(private readonly pool: Pool) {}

  async findOpenDemandsByCategory(tenantId: string, category: string, municipalityName?: string): Promise<MatchableDemand[]> {
    const resolvedTenantId = await this.resolveTenantId(tenantId);

    let whereClause = `
        WHERE d.tenant_id = $1
          AND d.status = 'open'
          AND d.deleted_at IS NULL
          AND d.needed_by >= NOW()
          AND (LOWER(d.category) = LOWER($2) OR LOWER(d.product_name) LIKE '%' || LOWER($2) || '%')
    `;
    const params: (string)[] = [resolvedTenantId, category];

    if (municipalityName) {
      whereClause += `  AND LOWER(d.municipality_name) = LOWER($3)\n`;
      params.push(municipalityName);
    }

    const result = await this.pool.query<DemandRow>(
      `
        SELECT
          d.id,
          d.tenant_id,
          d.demand_channel,
          d.organization_name,
          d.product_name,
          d.category,
          d.unit,
          d.quantity_required,
          d.needed_by,
          d.beneficiary_count,
          d.municipality_name,
          d.latitude::text AS latitude,
          d.longitude::text AS longitude
        FROM public.demands d
        ${whereClause}
        ORDER BY d.needed_by ASC
        LIMIT 50
      `,
      params
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0].id;
  }

  private mapRow(row: DemandRow): MatchableDemand {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      demandChannel: row.demand_channel,
      organizationName: row.organization_name,
      productName: row.product_name,
      category: row.category,
      unit: row.unit,
      quantityRequired: Number(row.quantity_required),
      neededBy: new Date(row.needed_by),
      beneficiaryCount: Number(row.beneficiary_count),
      municipalityName: row.municipality_name,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null
    };
  }
}
