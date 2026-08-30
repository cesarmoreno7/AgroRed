import type { Pool } from "pg";
import type {
  PaeInspectionListFilter,
  PaeInspectionRecord,
  PaeRepository,
  PaeRequerimientoListFilter
} from "../../domain/ports/PaeRepository.js";
import type { PaeInspection } from "../../domain/entities/PaeInspection.js";
import type { PaeOperator, PaeOperatorInput } from "../../domain/entities/PaeOperator.js";
import type {
  PaeRequerimiento,
  PaeRequerimientoInput,
  RequerimientoStatus
} from "../../domain/entities/PaeRequerimiento.js";
import type {
  PaeCaeCommittee,
  PaeCaeCommitteeInput,
  PaeCaeReport,
  PaeCaeReportInput,
  CaeReportStatus
} from "../../domain/entities/PaeCae.js";
import type { PaeSanction, PaeSanctionInput } from "../../domain/entities/PaeSanction.js";
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

function mapRequerimiento(row: any): PaeRequerimiento {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceType: row.source_type,
    inspectionId: row.inspection_id,
    caeReportId: row.cae_report_id,
    operatorId: row.operator_id,
    title: row.title,
    description: row.description,
    legalBasis: row.legal_basis,
    severity: row.severity,
    status: row.status,
    escalationLevel: Number(row.escalation_level),
    slaHours: Number(row.sla_hours),
    dueDate: row.due_date,
    firstNotifiedAt: row.first_notified_at,
    respondedAt: row.responded_at,
    responseNotes: row.response_notes,
    closedAt: row.closed_at,
    institutionalAlertId: row.institutional_alert_id,
    coordinationTaskId: row.coordination_task_id,
    createdByTenantId: row.created_by_tenant_id,
    createdByRole: row.created_by_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const REQ_COLS = `id, tenant_id, source_type, inspection_id, cae_report_id, operator_id, title, description,
  legal_basis, severity, status, escalation_level, sla_hours, due_date, first_notified_at,
  responded_at, response_notes, closed_at, institutional_alert_id, coordination_task_id,
  created_by_tenant_id, created_by_role, created_at, updated_at`;

const COMMITTEE_COLS = `id, tenant_id, institution_id, token, committee_name, contact_email, contact_phone, is_active, created_at, updated_at`;
const CAE_REPORT_COLS = `id, committee_id, tenant_id, reporter_name, reporter_role, reporter_contact, category,
  description, evidence_urls, occurred_on, status, requerimiento_id, inspection_id, triaged_by, triage_notes,
  created_at, updated_at`;

function mapCommittee(row: any): PaeCaeCommittee {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    institutionId: row.institution_id,
    token: row.token,
    committeeName: row.committee_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SANCTION_COLS = `id, operator_id, tenant_id, requerimiento_id, sanction_type, amount, currency, status,
  requested_by_tenant_id, requested_by_user, applied_by_user, justification, resolution_doc_url,
  requested_at, applied_at, firm_at, created_at, updated_at`;

function mapSanction(row: any): PaeSanction {
  return {
    id: row.id,
    operatorId: row.operator_id,
    tenantId: row.tenant_id,
    requerimientoId: row.requerimiento_id,
    sanctionType: row.sanction_type,
    amount: row.amount !== null ? Number(row.amount) : null,
    currency: row.currency,
    status: row.status,
    requestedByTenantId: row.requested_by_tenant_id,
    requestedByUser: row.requested_by_user,
    appliedByUser: row.applied_by_user,
    justification: row.justification,
    resolutionDocUrl: row.resolution_doc_url,
    requestedAt: row.requested_at,
    appliedAt: row.applied_at,
    firmAt: row.firm_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCaeReport(row: any): PaeCaeReport {
  return {
    id: row.id,
    committeeId: row.committee_id,
    tenantId: row.tenant_id,
    reporterName: row.reporter_name,
    reporterRole: row.reporter_role,
    reporterContact: row.reporter_contact,
    category: row.category,
    description: row.description,
    evidenceUrls: row.evidence_urls ?? [],
    occurredOn: row.occurred_on ? String(row.occurred_on).slice(0, 10) : null,
    status: row.status,
    requerimientoId: row.requerimiento_id,
    inspectionId: row.inspection_id,
    triagedBy: row.triaged_by,
    triageNotes: row.triage_notes,
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

  // ── Requerimientos ──

  async createRequerimiento(input: PaeRequerimientoInput, dueDate: string): Promise<PaeRequerimiento> {
    const res = await this.pool.query(
      `INSERT INTO public.pae_requerimientos
         (tenant_id, source_type, inspection_id, cae_report_id, operator_id, title, description,
          legal_basis, severity, sla_hours, due_date, created_by_tenant_id, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12,$13)
       ON CONFLICT ON CONSTRAINT uq_pae_requerimientos_inspection DO NOTHING
       RETURNING ${REQ_COLS}`,
      [
        input.tenantId,
        input.sourceType,
        input.inspectionId ?? null,
        input.caeReportId ?? null,
        input.operatorId ?? null,
        input.title,
        input.description,
        input.legalBasis ?? null,
        input.severity,
        input.slaHours,
        dueDate,
        input.createdByTenantId ?? null,
        input.createdByRole ?? null
      ]
    );
    if (res.rows[0]) {
      return mapRequerimiento(res.rows[0]);
    }
    // ON CONFLICT DO NOTHING → ya existía; devolver el existente.
    const existing = await this.findRequerimientoByInspectionId(input.inspectionId ?? "");
    if (!existing) {
      throw new Error("REQUERIMIENTO_CREATE_FAILED");
    }
    return existing;
  }

  async findRequerimientoByInspectionId(inspectionId: string): Promise<PaeRequerimiento | null> {
    if (!inspectionId) {
      return null;
    }
    const res = await this.pool.query(
      `SELECT ${REQ_COLS} FROM public.pae_requerimientos WHERE inspection_id = $1`,
      [inspectionId]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async findRequerimientoByCaeReportId(caeReportId: string): Promise<PaeRequerimiento | null> {
    if (!caeReportId) {
      return null;
    }
    const res = await this.pool.query(
      `SELECT ${REQ_COLS} FROM public.pae_requerimientos WHERE cae_report_id = $1`,
      [caeReportId]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async findRequerimientoById(id: string): Promise<PaeRequerimiento | null> {
    const res = await this.pool.query(
      `SELECT ${REQ_COLS} FROM public.pae_requerimientos WHERE id = $1`,
      [id]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async listRequerimientos(
    filter: PaeRequerimientoListFilter
  ): Promise<{ data: PaeRequerimiento[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let i = 1;
    if (filter.tenantIds && filter.tenantIds.length > 0) {
      conditions.push(`tenant_id = ANY($${i++}::uuid[])`);
      values.push(filter.tenantIds);
    }
    if (filter.status) {
      conditions.push(`status = $${i++}`);
      values.push(filter.status);
    }
    if (filter.operatorId) {
      conditions.push(`operator_id = $${i++}`);
      values.push(filter.operatorId);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const totalRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.pae_requerimientos ${where}`,
      values
    );
    const dataRes = await this.pool.query(
      `SELECT ${REQ_COLS} FROM public.pae_requerimientos ${where}
        ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, filter.limit, filter.offset]
    );
    return {
      data: dataRes.rows.map(mapRequerimiento),
      total: parseInt(totalRes.rows[0].count, 10)
    };
  }

  async backfillRequerimientoLinks(
    id: string,
    links: { institutionalAlertId?: string | null; coordinationTaskId?: string | null; firstNotifiedAt?: string | null }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.pae_requerimientos
          SET institutional_alert_id = COALESCE($2, institutional_alert_id),
              coordination_task_id   = COALESCE($3, coordination_task_id),
              first_notified_at      = COALESCE($4::timestamptz, first_notified_at),
              status = CASE WHEN status = 'abierto' THEN 'notificado' ELSE status END,
              updated_at = NOW()
        WHERE id = $1`,
      [id, links.institutionalAlertId ?? null, links.coordinationTaskId ?? null, links.firstNotifiedAt ?? null]
    );
  }

  async updateRequerimientoResponse(
    id: string,
    data: { status: RequerimientoStatus; responseNotes: string | null }
  ): Promise<PaeRequerimiento | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_requerimientos
          SET status = $2,
              response_notes = COALESCE($3, response_notes),
              responded_at = COALESCE(responded_at, NOW()),
              closed_at = CASE WHEN $2 = 'subsanado' THEN NOW() ELSE closed_at END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING ${REQ_COLS}`,
      [id, data.status, data.responseNotes]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async closeRequerimiento(id: string, status: "subsanado" | "archivado"): Promise<PaeRequerimiento | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_requerimientos
          SET status = $2, closed_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING ${REQ_COLS}`,
      [id, status]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async escalateRequerimientoToSanction(id: string): Promise<PaeRequerimiento | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_requerimientos
          SET status = 'escalado_sancion', updated_at = NOW()
        WHERE id = $1
        RETURNING ${REQ_COLS}`,
      [id]
    );
    return res.rows[0] ? mapRequerimiento(res.rows[0]) : null;
  }

  async listOverdueRequerimientos(): Promise<PaeRequerimiento[]> {
    const res = await this.pool.query(
      `SELECT ${REQ_COLS} FROM public.pae_requerimientos
        WHERE status IN ('abierto','notificado','en_respuesta')
          AND responded_at IS NULL
          AND due_date < NOW()`
    );
    return res.rows.map(mapRequerimiento);
  }

  async bumpRequerimientoEscalation(
    id: string,
    data: { escalationLevel: number; status: RequerimientoStatus; dueDate: string }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.pae_requerimientos
          SET escalation_level = $2, status = $3, due_date = $4::timestamptz, updated_at = NOW()
        WHERE id = $1`,
      [id, data.escalationLevel, data.status, data.dueDate]
    );
  }

  async sampleRandomAudits(perSupervisor: number): Promise<{ created: number; runs: number }> {
    const supervisors = await this.pool.query<{ supervisor_tenant_id: string; children: string[] }>(
      `SELECT supervisor_tenant_id, array_agg(child_tenant_id) AS children
         FROM public.tenant_oversight
        WHERE is_active
        GROUP BY supervisor_tenant_id`
    );

    let created = 0;
    let runs = 0;

    for (const sup of supervisors.rows) {
      const inserted = await this.pool.query<{ id: string; tenant_id: string }>(
        `INSERT INTO public.pae_inspections
           (tenant_id, institution_id, food_program_id, inspection_kind, status, result,
            inspected_at, inspector_tenant_id, inspector_role)
         SELECT i.tenant_id, i.id, fp.id, 'auditoria_aleatoria', 'programada', 'pendiente',
                NOW(), $1, 'supervisor_departamental'
           FROM public.institutions i
           JOIN public.food_programs fp
             ON fp.tenant_id = i.tenant_id
            AND fp.program_type = 'programa_escolar'
            AND fp.deleted_at IS NULL
          WHERE i.tenant_id = ANY($2::uuid[])
            AND i.deleted_at IS NULL
            AND i.status = 'active'
          ORDER BY random()
          LIMIT $3
         RETURNING id, tenant_id`,
        [sup.supervisor_tenant_id, sup.children, perSupervisor]
      );

      if (inserted.rowCount && inserted.rowCount > 0) {
        created += inserted.rowCount;
        runs += 1;
        await this.pool.query(
          `INSERT INTO public.pae_audit_runs (supervisor_tenant_id, sample, created_count)
           VALUES ($1, $2::jsonb, $3)`,
          [sup.supervisor_tenant_id, JSON.stringify(inserted.rows), inserted.rowCount]
        );
      }
    }

    return { created, runs };
  }

  // ── Control social CAE ──

  async createCaeCommittee(input: PaeCaeCommitteeInput): Promise<PaeCaeCommittee> {
    const res = await this.pool.query(
      `INSERT INTO public.pae_cae_committees
         (tenant_id, institution_id, committee_name, contact_email, contact_phone)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING ${COMMITTEE_COLS}`,
      [input.tenantId, input.institutionId, input.committeeName ?? null, input.contactEmail ?? null, input.contactPhone ?? null]
    );
    return mapCommittee(res.rows[0]);
  }

  async rotateCaeCommitteeToken(id: string): Promise<PaeCaeCommittee | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_cae_committees
          SET token = gen_random_uuid(), updated_at = NOW()
        WHERE id = $1
        RETURNING ${COMMITTEE_COLS}`,
      [id]
    );
    return res.rows[0] ? mapCommittee(res.rows[0]) : null;
  }

  async listCaeCommittees(tenantIds: string[]): Promise<PaeCaeCommittee[]> {
    const res = await this.pool.query(
      `SELECT ${COMMITTEE_COLS} FROM public.pae_cae_committees
        WHERE tenant_id = ANY($1::uuid[])
        ORDER BY created_at DESC`,
      [tenantIds]
    );
    return res.rows.map(mapCommittee);
  }

  async findCaeCommitteeByToken(token: string): Promise<PaeCaeCommittee | null> {
    const res = await this.pool.query(
      `SELECT ${COMMITTEE_COLS} FROM public.pae_cae_committees WHERE token = $1 AND is_active`,
      [token]
    );
    return res.rows[0] ? mapCommittee(res.rows[0]) : null;
  }

  async getPublicCaeForm(
    token: string
  ): Promise<{ committeeId: string; tenantId: string; schoolName: string; municipality: string } | null> {
    const res = await this.pool.query<{
      committee_id: string;
      tenant_id: string;
      school_name: string;
      municipality: string;
    }>(
      `SELECT c.id AS committee_id, c.tenant_id,
              COALESCE(i.name, c.committee_name, 'Colegio') AS school_name,
              COALESCE(i.municipality_name, t.name, '') AS municipality
         FROM public.pae_cae_committees c
         LEFT JOIN public.institutions i ON i.id = c.institution_id
         LEFT JOIN public.tenants t ON t.id = c.tenant_id
        WHERE c.token = $1 AND c.is_active`,
      [token]
    );
    const row = res.rows[0];
    return row
      ? { committeeId: row.committee_id, tenantId: row.tenant_id, schoolName: row.school_name, municipality: row.municipality }
      : null;
  }

  async createCaeReport(input: PaeCaeReportInput): Promise<PaeCaeReport> {
    const res = await this.pool.query(
      `INSERT INTO public.pae_cae_reports
         (committee_id, tenant_id, reporter_name, reporter_role, reporter_contact,
          category, description, evidence_urls, occurred_on, client_ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::inet)
       RETURNING ${CAE_REPORT_COLS}`,
      [
        input.committeeId,
        input.tenantId,
        input.reporterName ?? null,
        input.reporterRole ?? null,
        input.reporterContact ?? null,
        input.category,
        input.description,
        input.evidenceUrls ?? [],
        input.occurredOn ?? null,
        input.clientIp ?? null
      ]
    );
    return mapCaeReport(res.rows[0]);
  }

  async findCaeReportById(id: string): Promise<PaeCaeReport | null> {
    const res = await this.pool.query(
      `SELECT ${CAE_REPORT_COLS} FROM public.pae_cae_reports WHERE id = $1`,
      [id]
    );
    return res.rows[0] ? mapCaeReport(res.rows[0]) : null;
  }

  async listCaeReports(filter: {
    tenantIds?: string[];
    status?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: PaeCaeReport[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let i = 1;
    if (filter.tenantIds && filter.tenantIds.length > 0) {
      conditions.push(`tenant_id = ANY($${i++}::uuid[])`);
      values.push(filter.tenantIds);
    }
    if (filter.status) {
      conditions.push(`status = $${i++}`);
      values.push(filter.status);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const totalRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.pae_cae_reports ${where}`,
      values
    );
    const dataRes = await this.pool.query(
      `SELECT ${CAE_REPORT_COLS} FROM public.pae_cae_reports ${where}
        ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, filter.limit, filter.offset]
    );
    return { data: dataRes.rows.map(mapCaeReport), total: parseInt(totalRes.rows[0].count, 10) };
  }

  async linkCaeReportRequerimiento(reportId: string, requerimientoId: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.pae_cae_reports SET requerimiento_id = $2, status = 'derivado', updated_at = NOW() WHERE id = $1`,
      [reportId, requerimientoId]
    );
  }

  async triageCaeReport(
    id: string,
    data: { status: CaeReportStatus; triageNotes: string | null; triagedBy: string | null }
  ): Promise<PaeCaeReport | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_cae_reports
          SET status = $2, triage_notes = COALESCE($3, triage_notes), triaged_by = COALESCE($4, triaged_by), updated_at = NOW()
        WHERE id = $1
        RETURNING ${CAE_REPORT_COLS}`,
      [id, data.status, data.triageNotes, data.triagedBy]
    );
    return res.rows[0] ? mapCaeReport(res.rows[0]) : null;
  }

  // ── Sanciones ──

  async createSanction(input: PaeSanctionInput): Promise<PaeSanction> {
    const requested = Boolean(input.requestedByTenantId);
    const res = await this.pool.query(
      `INSERT INTO public.pae_sanctions
         (operator_id, tenant_id, requerimiento_id, sanction_type, amount, status,
          requested_by_tenant_id, requested_by_user, justification, requested_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $6 = 'requerida' THEN NOW() ELSE NULL END)
       RETURNING ${SANCTION_COLS}`,
      [
        input.operatorId,
        input.tenantId,
        input.requerimientoId ?? null,
        input.sanctionType,
        input.amount ?? null,
        requested ? "requerida" : "propuesta",
        input.requestedByTenantId ?? null,
        input.requestedByUser ?? null,
        input.justification
      ]
    );
    return mapSanction(res.rows[0]);
  }

  async findSanctionById(id: string): Promise<PaeSanction | null> {
    const res = await this.pool.query(`SELECT ${SANCTION_COLS} FROM public.pae_sanctions WHERE id = $1`, [id]);
    return res.rows[0] ? mapSanction(res.rows[0]) : null;
  }

  async listSanctions(filter: {
    tenantIds?: string[];
    status?: string;
    operatorId?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: PaeSanction[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let i = 1;
    if (filter.tenantIds && filter.tenantIds.length > 0) {
      conditions.push(`tenant_id = ANY($${i++}::uuid[])`);
      values.push(filter.tenantIds);
    }
    if (filter.status) {
      conditions.push(`status = $${i++}`);
      values.push(filter.status);
    }
    if (filter.operatorId) {
      conditions.push(`operator_id = $${i++}`);
      values.push(filter.operatorId);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const totalRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.pae_sanctions ${where}`,
      values
    );
    const dataRes = await this.pool.query(
      `SELECT ${SANCTION_COLS} FROM public.pae_sanctions ${where}
        ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, filter.limit, filter.offset]
    );
    return { data: dataRes.rows.map(mapSanction), total: parseInt(totalRes.rows[0].count, 10) };
  }

  async applySanction(
    id: string,
    data: { appliedByUser: string | null; resolutionDocUrl: string | null }
  ): Promise<PaeSanction | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_sanctions
          SET status = 'aplicada', applied_at = NOW(), applied_by_user = $2,
              resolution_doc_url = COALESCE($3, resolution_doc_url), updated_at = NOW()
        WHERE id = $1 AND status IN ('propuesta','requerida')
        RETURNING ${SANCTION_COLS}`,
      [id, data.appliedByUser, data.resolutionDocUrl]
    );
    return res.rows[0] ? mapSanction(res.rows[0]) : null;
  }

  async updateSanctionStatus(id: string, status: "en_firme" | "archivada"): Promise<PaeSanction | null> {
    const res = await this.pool.query(
      `UPDATE public.pae_sanctions
          SET status = $2, firm_at = CASE WHEN $2 = 'en_firme' THEN NOW() ELSE firm_at END, updated_at = NOW()
        WHERE id = $1
        RETURNING ${SANCTION_COLS}`,
      [id, status]
    );
    return res.rows[0] ? mapSanction(res.rows[0]) : null;
  }
}
