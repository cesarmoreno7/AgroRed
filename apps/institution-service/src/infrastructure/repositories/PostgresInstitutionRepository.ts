import type { Pool } from "pg";
import { Institution } from "../../domain/entities/Institution.js";
import type {
  InstitutionRepository,
  PaginationParams,
  PaginatedResult,
  StatusHistoryEntry
} from "../../domain/ports/InstitutionRepository.js";
import type { InstitutionStatus, InstitutionType } from "../../domain/value-objects/InstitutionType.js";

interface InstitutionRow {
  id: string;
  tenant_id: string;
  institution_type: InstitutionType;
  name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  municipality_name: string;
  address: string | null;
  beneficiary_count: string;
  product_categories: string[];
  latitude: string | null;
  longitude: string | null;
  status: InstitutionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

export class PostgresInstitutionRepository implements InstitutionRepository {
  constructor(private readonly pool: Pool) {}

  async save(institution: Institution): Promise<void> {
    const tenantId = await this.resolveTenantId(institution.tenantId);

    await this.pool.query(
      `INSERT INTO public.institutions (
         id, tenant_id, institution_type, name, contact_name, contact_phone,
         contact_email, municipality_name, address, beneficiary_count,
         product_categories, latitude, longitude, status, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        institution.id,
        tenantId,
        institution.institutionType,
        institution.name,
        institution.contactName,
        institution.contactPhone,
        institution.contactEmail,
        institution.municipalityName,
        institution.address,
        institution.beneficiaryCount,
        institution.productCategories,
        institution.latitude,
        institution.longitude,
        institution.status,
        institution.notes,
        institution.createdBy
      ]
    );
  }

  async saveBatch(institutions: Institution[]): Promise<void> {
    if (institutions.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const inst of institutions) {
        const tenantId = await this.resolveTenantId(inst.tenantId);
        await client.query(
          `INSERT INTO public.institutions (
             id, tenant_id, institution_type, name, contact_name, contact_phone,
             contact_email, municipality_name, address, beneficiary_count,
             product_categories, latitude, longitude, status, notes, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT DO NOTHING`,
          [
            inst.id,
            tenantId,
            inst.institutionType,
            inst.name,
            inst.contactName,
            inst.contactPhone,
            inst.contactEmail,
            inst.municipalityName,
            inst.address,
            inst.beneficiaryCount,
            inst.productCategories,
            inst.latitude,
            inst.longitude,
            inst.status,
            inst.notes,
            inst.createdBy
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async update(institution: Institution): Promise<void> {
    await this.pool.query(
      `UPDATE public.institutions SET
         institution_type   = $2,
         name               = $3,
         contact_name       = $4,
         contact_phone      = $5,
         contact_email      = $6,
         address            = $7,
         beneficiary_count  = $8,
         product_categories = $9,
         latitude           = $10,
         longitude          = $11,
         status             = $12,
         notes              = $13
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        institution.id,
        institution.institutionType,
        institution.name,
        institution.contactName,
        institution.contactPhone,
        institution.contactEmail,
        institution.address,
        institution.beneficiaryCount,
        institution.productCategories,
        institution.latitude,
        institution.longitude,
        institution.status,
        institution.notes
      ]
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.institutions SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<Institution | null> {
    const result = await this.pool.query<InstitutionRow>(
      `SELECT id, tenant_id, institution_type, name, contact_name, contact_phone,
              contact_email, municipality_name, address, beneficiary_count,
              product_categories, latitude, longitude, status, notes, created_by, created_at
       FROM public.institutions
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByName(tenantIdOrCode: string, name: string): Promise<Institution | null> {
    const tenantId = await this.resolveTenantId(tenantIdOrCode);
    const result = await this.pool.query<InstitutionRow>(
      `SELECT id, tenant_id, institution_type, name, contact_name, contact_phone,
              contact_email, municipality_name, address, beneficiary_count,
              product_categories, latitude, longitude, status, notes, created_by, created_at
       FROM public.institutions
       WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND deleted_at IS NULL`,
      [tenantId, name.trim()]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Institution>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.institutions WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<InstitutionRow>(
      `SELECT id, tenant_id, institution_type, name, contact_name, contact_phone,
              contact_email, municipality_name, address, beneficiary_count,
              product_categories, latitude, longitude, status, notes, created_by, created_at
       FROM public.institutions
       WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  async logStatusChange(entry: StatusHistoryEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.institution_status_history
         (institution_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.institutionId, entry.oldStatus, entry.newStatus, entry.changedBy, entry.reason]
    );
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );
    if (!result.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return result.rows[0].id;
  }

  private mapRow(row: InstitutionRow): Institution {
    return new Institution({
      id: row.id,
      tenantId: row.tenant_id,
      institutionType: row.institution_type,
      name: row.name,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      municipalityName: row.municipality_name,
      address: row.address,
      beneficiaryCount: parseInt(row.beneficiary_count, 10),
      productCategories: row.product_categories,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      status: row.status,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at
    });
  }
}
