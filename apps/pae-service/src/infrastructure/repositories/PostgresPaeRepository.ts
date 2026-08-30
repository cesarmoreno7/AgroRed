import type { Pool } from "pg";
import type {
  PaeInspectionListFilter,
  PaeInspectionRecord,
  PaeRepository
} from "../../domain/ports/PaeRepository.js";
import type { PaeInspection } from "../../domain/entities/PaeInspection.js";
import type { PaeOperator, PaeOperatorInput } from "../../domain/entities/PaeOperator.js";
import { PAE_THRESHOLD_KEYS, type PaeThresholds } from "../../domain/checklist/paeChecklistTemplate.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapOperator(row: any): PaeOperator {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    legalName: row.legal_name,
    nit: row.nit,
    legalRep: row.legal_rep,
    contractNumber: row.contract_number,
    contractStartsAt: row.contract_starts_at ? String(row.contract_starts_at).slice(0, 10) : null,
    contractEndsAt: row.contract_ends_at ? String(row.contract_ends_at).slice(0, 10) : null,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInspection(row: any): PaeInspection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operatorId: row.operator_id,
    institutionId: row.institution_id,
    foodProgramId: row.food_program_id,
    inspectionKind: row.inspection_kind,
    inspectorRole: row.inspector_role,
    inspectorUserId: row.inspector_user_id,
    inspectorTenantId: row.inspector_tenant_id,
    inspectedAt: row.inspected_at,
    locationDescription: row.location_description,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    portionWeightG: row.portion_weight_g !== null ? Number(row.portion_weight_g) : null,
    portionWeightExpectedG: row.portion_weight_expected_g !== null ? Number(row.portion_weight_expected_g) : null,
    temperatureC: row.temperature_c !== null ? Number(row.temperature_c) : null,
    coldChainOk: row.cold_chain_ok,
    expiryCheckOk: row.expiry_check_ok,
    earliestExpiryDate: row.earliest_expiry_date ? String(row.earliest_expiry_date).slice(0, 10) : null,
    hygieneScore: row.hygiene_score !== null ? Number(row.hygiene_score) : null,
    answers: row.answers ?? {},
    failedItems: row.failed_items ?? [],
    result: row.result,
    status: row.status,
    evidenceUrls: row.evidence_urls ?? [],
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresPaeRepository implements PaeRepository {
  constructor(private readonly pool: Pool) {}

  async getThresholds(tenantId: string): Promise<Partial<PaeThresholds>> {
    const res = await this.pool.query<{ rule_key: string; value: string }>(
      `SELECT rule_key, value FROM public.alert_thresholds
        WHERE tenant_id = $1 AND rule_key LIKE 'pae.%'`,
      [tenantId]
    );
    const out: Partial<PaeThresholds> = {};
    for (const row of res.rows) {
      const field = PAE_THRESHOLD_KEYS[row.rule_key];
      if (field) {
        out[field] = Number(row.value);
      }
    }
    return out;
  }

  async createOperator(input: PaeOperatorInput): Promise<PaeOperator> {
    const res = await this.pool.query(
      `INSERT INTO public.pae_operators
         (tenant_id, legal_name, nit, legal_rep, contract_number, contract_starts_at,
          contract_ends_at, contact_name, contact_email, contact_phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'active'))
       ON CONFLICT ON CONSTRAINT uq_pae_operators_tenant_nit DO UPDATE
         SET legal_name = EXCLUDED.legal_name,
             legal_rep = EXCLUDED.legal_rep,
             contract_number = EXCLUDED.contract_number,
             contract_starts_at = EXCLUDED.contract_starts_at,
             contract_ends_at = EXCLUDED.contract_ends_at,
             contact_name = EXCLUDED.contact_name,
             contact_email = EXCLUDED.contact_email,
             contact_phone = EXCLUDED.contact_phone,
             status = EXCLUDED.status,
             updated_at = NOW()
       RETURNING *`,
      [
        input.tenantId,
        input.legalName,
        input.nit ?? null,
        input.legalRep ?? null,
        input.contractNumber ?? null,
        input.contractStartsAt ?? null,
        input.contractEndsAt ?? null,
        input.contactName ?? null,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        input.status ?? null
      ]
    );
    return mapOperator(res.rows[0]);
  }

  async listOperators(tenantIds: string[]): Promise<PaeOperator[]> {
    const res = await this.pool.query(
      `SELECT * FROM public.pae_operators
        WHERE deleted_at IS NULL AND tenant_id = ANY($1::uuid[])
        ORDER BY legal_name ASC`,
      [tenantIds]
    );
    return res.rows.map(mapOperator);
  }

  async findOperatorById(id: string): Promise<PaeOperator | null> {
    const res = await this.pool.query(
      `SELECT * FROM public.pae_operators WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] ? mapOperator(res.rows[0]) : null;
  }

  async createInspection(r: PaeInspectionRecord): Promise<PaeInspection> {
    const res = await this.pool.query(
      `INSERT INTO public.pae_inspections
         (tenant_id, operator_id, institution_id, food_program_id, inspection_kind,
          inspector_role, inspector_user_id, inspector_tenant_id, inspected_at,
          location_description, latitude, longitude,
          portion_weight_g, portion_weight_expected_g, temperature_c, cold_chain_ok,
          expiry_check_ok, earliest_expiry_date, hygiene_score,
          answers, failed_items, result, status, evidence_urls, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, NOW()),
               $10,$11,$12,
               $13,$14,$15,$16,
               $17,$18,$19,
               $20::jsonb,$21::jsonb,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        r.tenantId,
        r.operatorId,
        r.institutionId,
        r.foodProgramId,
        r.inspectionKind,
        r.inspectorRole,
        r.inspectorUserId,
        r.inspectorTenantId,
        r.inspectedAt,
        r.locationDescription,
        r.latitude,
        r.longitude,
        r.portionWeightG,
        r.portionWeightExpectedG,
        r.temperatureC,
        r.coldChainOk,
        r.expiryCheckOk,
        r.earliestExpiryDate,
        r.hygieneScore,
        JSON.stringify(r.answers ?? {}),
        JSON.stringify(r.failedItems ?? []),
        r.result,
        r.status,
        r.evidenceUrls ?? [],
        r.notes,
        r.createdBy
      ]
    );
    return mapInspection(res.rows[0]);
  }

  async listInspections(
    filter: PaeInspectionListFilter
  ): Promise<{ data: PaeInspection[]; total: number }> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: unknown[] = [];
    let i = 1;

    if (filter.tenantIds && filter.tenantIds.length > 0) {
      conditions.push(`tenant_id = ANY($${i++}::uuid[])`);
      values.push(filter.tenantIds);
    }
    if (filter.operatorId) {
      conditions.push(`operator_id = $${i++}`);
      values.push(filter.operatorId);
    }
    if (filter.institutionId) {
      conditions.push(`institution_id = $${i++}`);
      values.push(filter.institutionId);
    }
    if (filter.inspectionKind) {
      conditions.push(`inspection_kind = $${i++}`);
      values.push(filter.inspectionKind);
    }
    if (filter.result) {
      conditions.push(`result = $${i++}`);
      values.push(filter.result);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const totalRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.pae_inspections ${where}`,
      values
    );
    const dataRes = await this.pool.query(
      `SELECT * FROM public.pae_inspections ${where}
        ORDER BY inspected_at DESC
        LIMIT $${i++} OFFSET $${i++}`,
      [...values, filter.limit, filter.offset]
    );
    return {
      data: dataRes.rows.map(mapInspection),
      total: parseInt(totalRes.rows[0].count, 10)
    };
  }

  async findInspectionById(id: string): Promise<PaeInspection | null> {
    const res = await this.pool.query(
      `SELECT * FROM public.pae_inspections WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] ? mapInspection(res.rows[0]) : null;
  }

  async updateInspectionNotes(
    id: string,
    notes: string | null,
    evidenceUrls: string[] | null
  ): Promise<PaeInspection | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_inspections
          SET notes = COALESCE($2, notes),
              evidence_urls = COALESCE($3, evidence_urls),
              updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *`,
      [id, notes, evidenceUrls]
    );
    return res.rows[0] ? mapInspection(res.rows[0]) : null;
  }
}
