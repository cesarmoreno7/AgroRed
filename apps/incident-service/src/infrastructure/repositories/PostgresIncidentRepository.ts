import type { Pool } from "pg";
import { Incident } from "../../domain/entities/Incident.js";
import { clusterPoints } from "@agrored/shared/geo/haversine.js";
import type {
  IncidentRepository,
  PaginationParams,
  PaginatedResult,
  IncidentListFilter,
  IncidentAction,
  IncidentAlert,
  ZoneSummary,
  IncidentCluster,
  IncidentTrend,
  AlertThreshold,
} from "../../domain/ports/IncidentRepository.js";
import type { IncidentSeverity } from "../../domain/value-objects/IncidentSeverity.js";
import type { IncidentStatus } from "../../domain/value-objects/IncidentStatus.js";
import type { IncidentType } from "../../domain/value-objects/IncidentType.js";

interface IncidentRow {
  id: string;
  tenant_id: string;
  logistics_order_id: string | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location_description: string;
  latitude: string | null;
  longitude: string | null;
  occurred_at: Date;
  municipality_name: string;
  notes: string | null;
  status: IncidentStatus;
  reported_by: string | null;
  reporter_role: string | null;
  affected_population: number;
  affected_community: string | null;
  evidence_urls: string[] | null;
  assigned_to: string | null;
  priority_score: string | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  escalated_at: Date | null;
  intervention_started_at: Date | null;
  recurrence_count: number;
  parent_incident_id: string | null;
  sla_target_minutes: number | null;
  first_response_at: Date | null;
  response_time_minutes: number | null;
  created_at: Date;
}

export class PostgresIncidentRepository implements IncidentRepository {
  constructor(private readonly pool: Pool) {}

  async save(incident: Incident): Promise<void> {
    const tenantId = await this.resolveTenantId(incident.tenantId);
    const logisticsOrderId = incident.logisticsOrderId
      ? await this.resolveLogisticsOrderId(incident.logisticsOrderId, tenantId)
      : null;

    await this.pool.query(
      `
        INSERT INTO public.incidents (
          id, tenant_id, logistics_order_id, incident_type, severity,
          title, description, location_description, latitude, longitude,
          occurred_at, municipality_name, notes, status,
          reported_by, reporter_role, affected_population, affected_community,
          evidence_urls, assigned_to, priority_score, parent_incident_id,
          sla_target_minutes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      `,
      [
        incident.id, tenantId, logisticsOrderId,
        incident.incidentType, incident.severity,
        incident.title, incident.description, incident.locationDescription,
        incident.latitude, incident.longitude,
        incident.occurredAt, incident.municipalityName, incident.notes, incident.status,
        incident.reportedBy, incident.reporterRole, incident.affectedPopulation,
        incident.affectedCommunity, incident.evidenceUrls, incident.assignedTo,
        incident.priorityScore, incident.parentIncidentId,
        this.defaultSlaMinutes(incident.severity),
      ]
    );
  }

  private defaultSlaMinutes(severity: string): number {
    switch (severity) {
      case "critical": return 60;
      case "high": return 240;
      case "medium": return 1440;
      case "low": return 4320;
      default: return 1440;
    }
  }

  async findById(id: string): Promise<Incident | null> {
    const result = await this.pool.query<IncidentRow>(
      `SELECT * FROM public.incidents WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, filter?: IncidentListFilter): Promise<PaginatedResult<Incident>> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: unknown[] = [];
    let idx = 1;

    if (filter?.tenantId) {
      const tenantId = await this.resolveTenantId(filter.tenantId);
      conditions.push(`tenant_id = $${idx++}`);
      values.push(tenantId);
    }
    if (filter?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter?.severity) {
      conditions.push(`severity = $${idx++}`);
      values.push(filter.severity);
    }
    if (filter?.incidentType) {
      conditions.push(`incident_type = $${idx++}`);
      values.push(filter.incidentType);
    }
    if (filter?.municipalityName) {
      conditions.push(`municipality_name ILIKE $${idx++}`);
      values.push(`%${filter.municipalityName}%`);
    }

    const where = conditions.join(" AND ");

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.incidents WHERE ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<IncidentRow>(
      `SELECT * FROM public.incidents WHERE ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, params.limit, offset]
    );

    return {
      data: result.rows.map((row) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async updateStatus(
    id: string,
    status: IncidentStatus,
    fields?: Partial<{
      assignedTo: string;
      resolutionNotes: string;
      resolvedAt: Date;
      escalatedAt: Date;
      interventionStartedAt: Date;
      priorityScore: number;
    }>
  ): Promise<void> {
    const sets: string[] = ["status = $2"];
    const values: unknown[] = [id, status];
    let idx = 3;

    if (fields?.assignedTo !== undefined) {
      sets.push(`assigned_to = $${idx++}`);
      values.push(fields.assignedTo);
    }
    if (fields?.resolutionNotes !== undefined) {
      sets.push(`resolution_notes = $${idx++}`);
      values.push(fields.resolutionNotes);
    }
    if (fields?.resolvedAt !== undefined) {
      sets.push(`resolved_at = $${idx++}`);
      values.push(fields.resolvedAt);
    }
    if (fields?.escalatedAt !== undefined) {
      sets.push(`escalated_at = $${idx++}`);
      values.push(fields.escalatedAt);
    }
    if (fields?.interventionStartedAt !== undefined) {
      sets.push(`intervention_started_at = $${idx++}`);
      values.push(fields.interventionStartedAt);
    }
    if (fields?.priorityScore !== undefined) {
      sets.push(`priority_score = $${idx++}`);
      values.push(fields.priorityScore);
    }

    // Auto-set first_response_at and response_time_minutes on first status change from initial state
    const initialStates: string[] = ["reportada", "open"];
    if (!initialStates.includes(status)) {
      sets.push(`first_response_at = COALESCE(first_response_at, NOW())`);
      sets.push(`response_time_minutes = COALESCE(response_time_minutes, ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::int)`);
    }

    await this.pool.query(
      `UPDATE public.incidents SET ${sets.join(", ")} WHERE id = $1 AND deleted_at IS NULL`,
      values
    );
  }

  // ── Actions ──

  async saveAction(action: IncidentAction): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.incident_actions (id, incident_id, action_type, performed_by, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action.id, action.incidentId, action.actionType, action.performedBy, action.description, JSON.stringify(action.metadata)]
    );
  }

  async listActions(incidentId: string): Promise<IncidentAction[]> {
    const res = await this.pool.query<{
      id: string; incident_id: string; action_type: string; performed_by: string;
      description: string; metadata: Record<string, unknown>; created_at: Date;
    }>(
      `SELECT * FROM public.incident_actions WHERE incident_id = $1 ORDER BY created_at ASC`,
      [incidentId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      actionType: r.action_type,
      performedBy: r.performed_by,
      description: r.description,
      metadata: r.metadata ?? {},
      createdAt: r.created_at,
    }));
  }

  // ── Alerts ──

  async saveAlert(alert: IncidentAlert): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.incident_alerts
        (id, tenant_id, alert_type, severity, title, description, zone_name, incident_count, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [alert.id, alert.tenantId, alert.alertType, alert.severity, alert.title, alert.description, alert.zoneName, alert.incidentCount, JSON.stringify(alert.metadata)]
    );
  }

  async listAlerts(tenantId: string, params: PaginationParams): Promise<PaginatedResult<IncidentAlert>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const countRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.incident_alerts WHERE tenant_id = $1`,
      [tid]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await this.pool.query<{
      id: string; tenant_id: string; alert_type: string; severity: string;
      title: string; description: string; zone_name: string | null;
      incident_count: number; is_acknowledged: boolean;
      acknowledged_by: string | null; acknowledged_at: Date | null;
      metadata: Record<string, unknown>; created_at: Date;
    }>(
      `SELECT * FROM public.incident_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tid, params.limit, offset]
    );

    return {
      data: res.rows.map((r) => ({
        id: r.id, tenantId: r.tenant_id, alertType: r.alert_type, severity: r.severity,
        title: r.title, description: r.description, zoneName: r.zone_name,
        incidentCount: r.incident_count, isAcknowledged: r.is_acknowledged,
        acknowledgedBy: r.acknowledged_by, acknowledgedAt: r.acknowledged_at,
        metadata: r.metadata ?? {}, createdAt: r.created_at,
      })),
      total, page: params.page, limit: params.limit,
    };
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.incident_alerts SET is_acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1`,
      [alertId, acknowledgedBy]
    );
  }

  // ── Analytics ──

  async getZoneSummary(tenantId: string): Promise<ZoneSummary[]> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query<{
      municipality_name: string; incident_type: string; severity: string;
      total: string; open_count: string; in_progress_count: string;
      avg_priority_score: string; last_reported_at: Date;
    }>(
      `SELECT municipality_name, incident_type, severity,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status IN ('open','reportada'))::text AS open_count,
              COUNT(*) FILTER (WHERE status IN ('en_gestion','intervenida','investigating'))::text AS in_progress_count,
              COALESCE(AVG(priority_score), 0)::text AS avg_priority_score,
              MAX(created_at) AS last_reported_at
       FROM public.incidents
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY municipality_name, incident_type, severity
       ORDER BY municipality_name, severity DESC`,
      [tid]
    );
    return res.rows.map((r) => ({
      municipalityName: r.municipality_name,
      incidentType: r.incident_type,
      severity: r.severity,
      total: Number(r.total),
      openCount: Number(r.open_count),
      inProgressCount: Number(r.in_progress_count),
      avgPriorityScore: Number(r.avg_priority_score),
      lastReportedAt: r.last_reported_at,
    }));
  }

  async countByZoneAndSeverity(tenantId: string): Promise<{ zone: string; severity: string; count: number }[]> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query<{ zone: string; severity: string; count: string }>(
      `SELECT municipality_name AS zone, severity, COUNT(*)::text AS count
       FROM public.incidents
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY municipality_name, severity
       ORDER BY count DESC`,
      [tid]
    );
    return res.rows.map((r) => ({ zone: r.zone, severity: r.severity, count: Number(r.count) }));
  }

  async countRecentByZone(tenantId: string, hoursBack: number): Promise<{ zone: string; count: number; criticalCount: number }[]> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query<{ zone: string; count: string; critical_count: string }>(
      `SELECT municipality_name AS zone,
              COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE severity = 'critical')::text AS critical_count
       FROM public.incidents
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND created_at >= NOW() - ($2 || ' hours')::interval
       GROUP BY municipality_name
       ORDER BY count DESC`,
      [tid, String(hoursBack)]
    );
    return res.rows.map((r) => ({ zone: r.zone, count: Number(r.count), criticalCount: Number(r.critical_count) }));
  }

  async countUnattended(tenantId: string, hoursThreshold: number): Promise<number> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.incidents
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND status IN ('reportada','open')
         AND created_at <= NOW() - ($2 || ' hours')::interval`,
      [tid, String(hoursThreshold)]
    );
    return Number(res.rows[0].count);
  }

  // ── Spatial Clustering (Haversine) ──

  async getIncidentClusters(tenantId: string, radiusM = 500, minPoints = 2): Promise<IncidentCluster[]> {
    const tid = await this.resolveTenantId(tenantId);
    const severityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    const result = await this.pool.query<{
      id: string; incident_type: string; severity: string;
      affected_population: string; lat: string; lng: string;
    }>(
      `SELECT i.id, i.incident_type, i.severity, i.affected_population::text,
              i.latitude::text AS lat, i.longitude::text AS lng
       FROM public.incidents i
       WHERE i.tenant_id = $1 AND i.deleted_at IS NULL
         AND i.latitude IS NOT NULL AND i.longitude IS NOT NULL`,
      [tid]
    );

    if (result.rows.length === 0) return [];

    const items = result.rows.map(r => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      data: { id: r.id, type: r.incident_type, severity: r.severity, affectedPop: Number(r.affected_population) },
    }));

    const clusters = clusterPoints(items, radiusM, minPoints);

    return clusters.map((c, idx) => {
      const severities = c.points.map(p => p.data.severity);
      const avgSev = severities.reduce((sum, s) => sum + (severityMap[s] ?? 1), 0) / severities.length;
      const types = c.points.map(p => p.data.type);
      const dominantType = types.sort((a, b) =>
        types.filter(t => t === b).length - types.filter(t => t === a).length
      )[0];

      return {
        clusterId: idx,
        centroidLat: c.centroidLat,
        centroidLng: c.centroidLng,
        incidentCount: c.points.length,
        avgSeverityScore: Math.round(avgSev * 10) / 10,
        dominantType,
        affectedPopulation: c.points.reduce((sum, p) => sum + p.data.affectedPop, 0),
        incidentIds: c.points.map(p => p.data.id),
      };
    });
  }

  // ── Trend Analytics ──

  async getIncidentTrends(tenantId: string, granularity: "daily" | "weekly" = "weekly", limit = 52): Promise<IncidentTrend[]> {
    const tid = await this.resolveTenantId(tenantId);
    const view = granularity === "daily" ? "v_incident_trends_daily" : "v_incident_trends";
    const periodCol = granularity === "daily" ? "day" : "week_start";

    const result = await this.pool.query<{
      period: string; incident_type: string; severity: string;
      incident_count: string; total_affected: string;
      resolved_count: string; avg_response_min: string | null;
    }>(
      `SELECT ${periodCol}::text AS period, incident_type, severity,
              incident_count::text, total_affected::text,
              resolved_count::text, avg_response_min::text
       FROM public.${view}
       WHERE tenant_id = $1
       ORDER BY ${periodCol} DESC
       LIMIT $2`,
      [tid, limit]
    );

    return result.rows.map(r => ({
      period: r.period,
      incidentType: r.incident_type,
      severity: r.severity,
      incidentCount: Number(r.incident_count),
      totalAffected: Number(r.total_affected),
      resolvedCount: Number(r.resolved_count),
      avgResponseMin: r.avg_response_min ? Number(r.avg_response_min) : null,
    }));
  }

  // ── Alert Thresholds ──

  async getAlertThresholds(tenantId: string): Promise<AlertThreshold[]> {
    const tid = await this.resolveTenantId(tenantId);
    const { rows } = await this.pool.query(
      `SELECT id, tenant_id, rule_key, value, description, updated_by, updated_at
       FROM public.alert_thresholds WHERE tenant_id = $1 ORDER BY rule_key`,
      [tid]
    );
    return rows.map(r => ({
      id: r.id as string,
      tenantId: r.tenant_id as string,
      ruleKey: r.rule_key as string,
      value: Number(r.value),
      description: (r.description as string) ?? null,
      updatedBy: (r.updated_by as string) ?? null,
      updatedAt: new Date(r.updated_at as string),
    }));
  }

  async upsertAlertThreshold(tenantId: string, ruleKey: string, value: number, updatedBy?: string): Promise<AlertThreshold> {
    const tid = await this.resolveTenantId(tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO public.alert_thresholds (tenant_id, rule_key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, rule_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING id, tenant_id, rule_key, value, description, updated_by, updated_at`,
      [tid, ruleKey, value, updatedBy ?? null]
    );
    const r = rows[0];
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      ruleKey: r.rule_key as string,
      value: Number(r.value),
      description: (r.description as string) ?? null,
      updatedBy: (r.updated_by as string) ?? null,
      updatedAt: new Date(r.updated_at as string),
    };
  }

  // ── Private helpers ──

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );
    if (!result.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return result.rows[0].id;
  }

  private async resolveLogisticsOrderId(logisticsOrderId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.logistics_orders WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [logisticsOrderId, tenantId]
    );
    if (!result.rows[0]) throw new Error("LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT");
    return result.rows[0].id;
  }

  private mapRow(row: IncidentRow): Incident {
    return new Incident({
      id: row.id,
      tenantId: row.tenant_id,
      logisticsOrderId: row.logistics_order_id,
      incidentType: row.incident_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      locationDescription: row.location_description,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      occurredAt: row.occurred_at,
      municipalityName: row.municipality_name,
      notes: row.notes,
      status: row.status,
      reportedBy: row.reported_by,
      reporterRole: row.reporter_role,
      affectedPopulation: row.affected_population ?? 0,
      affectedCommunity: row.affected_community,
      evidenceUrls: row.evidence_urls ?? [],
      assignedTo: row.assigned_to,
      priorityScore: row.priority_score ? Number(row.priority_score) : 0,
      resolutionNotes: row.resolution_notes,
      resolvedAt: row.resolved_at,
      escalatedAt: row.escalated_at,
      interventionStartedAt: row.intervention_started_at,
      recurrenceCount: row.recurrence_count ?? 0,
      parentIncidentId: row.parent_incident_id,
      slaTargetMinutes: row.sla_target_minutes ?? null,
      firstResponseAt: row.first_response_at ?? null,
      responseTimeMinutes: row.response_time_minutes ?? null,
      createdAt: row.created_at,
    });
  }
}