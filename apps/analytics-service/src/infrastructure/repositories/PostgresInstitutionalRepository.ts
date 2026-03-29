import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type {
  InstitutionalRepository,
  PaginationParams,
  PaginatedResult,
  AllocationScenario,
  SupervisionData,
  InstitutionalAlertThreshold,
} from "../../domain/ports/InstitutionalRepository.js";
import type {
  IratScore,
  FoodProgram,
  FoodProgramCreateCommand,
  Beneficiary,
  BeneficiaryCreateCommand,
  InstitutionalAlert,
  CoordinationTask,
  ProgramCoverage,
  InstitutionalDashboard,
  SpoilageRecord,
  SpoilageCreateCommand,
  SpoilageSummary,
} from "../../domain/models/InstitutionalTypes.js";

export class PostgresInstitutionalRepository implements InstitutionalRepository {
  constructor(private readonly pool: Pool) {}

  // ── IRAT ──

  async getIratScores(tenantId?: string): Promise<IratScore[]> {
    const tid = tenantId ? await this.resolveTenantId(tenantId) : null;
    const where = tid ? "WHERE tenant_id = $1" : "";
    const values = tid ? [tid] : [];
    const res = await this.pool.query(
      `SELECT * FROM public.v_irat_municipal ${where} ORDER BY irat_score DESC`,
      values
    );
    return res.rows.map((r: any) => ({
      tenantId: r.tenant_id,
      tenantCode: r.tenant_code,
      tenantName: r.tenant_name,
      totalOffers: Number(r.total_offers),
      totalOfferQuantity: Number(r.total_offer_quantity),
      openDemands: Number(r.open_demands),
      totalDemandQuantity: Number(r.total_demand_quantity),
      totalBeneficiaries: Number(r.total_beneficiaries),
      scheduledRescues: Number(r.scheduled_rescues),
      totalRescuedQuantity: Number(r.total_rescued_quantity),
      openIncidents: Number(r.open_incidents),
      criticalIncidents: Number(r.critical_incidents),
      activeLogistics: Number(r.active_logistics),
      activePrograms: Number(r.active_programs),
      programCoverage: Number(r.program_coverage),
      iratScore: Number(r.irat_score),
    }));
  }

  // ── Food Programs ──

  async createProgram(cmd: FoodProgramCreateCommand): Promise<FoodProgram> {
    const id = randomUUID();
    const tenantId = await this.resolveTenantId(cmd.tenantId);
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.food_programs
        (id, tenant_id, name, program_type, description, target_population, budget_allocated,
         responsible_name, responsible_email, municipality_name, starts_at, ends_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id, tenantId, cmd.name, cmd.programType, cmd.description ?? null,
        cmd.targetPopulation ?? 0, cmd.budgetAllocated ?? 0,
        cmd.responsibleName ?? null, cmd.responsibleEmail ?? null,
        cmd.municipalityName, cmd.startsAt ?? null, cmd.endsAt ?? null, now, now,
      ]
    );
    return (await this.findProgramById(id))!;
  }

  async findProgramById(id: string): Promise<FoodProgram | null> {
    const res = await this.pool.query(
      `SELECT * FROM public.food_programs WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    return res.rows[0] ? this.mapProgram(res.rows[0]) : null;
  }

  async listPrograms(tenantId: string, params: PaginationParams): Promise<PaginatedResult<FoodProgram>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM public.food_programs WHERE tenant_id = $1 AND deleted_at IS NULL`, [tid]
    );
    const total = parseInt(countRes.rows[0].count, 10);
    const res = await this.pool.query(
      `SELECT * FROM public.food_programs WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tid, params.limit, offset]
    );
    return { data: res.rows.map((r: any) => this.mapProgram(r)), total, page: params.page, limit: params.limit };
  }

  async updateProgramStatus(id: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.food_programs SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status]
    );
  }

  // ── Beneficiaries ──

  async createBeneficiary(cmd: BeneficiaryCreateCommand): Promise<Beneficiary> {
    const id = randomUUID();
    const tenantId = await this.resolveTenantId(cmd.tenantId);
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.beneficiaries
        (id, tenant_id, program_id, full_name, document_id, document_type, age, gender,
         socioeconomic_level, risk_classification, nutritional_status,
         municipality_name, zone_name, address, latitude, longitude, contact_phone, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id, tenantId, cmd.programId ?? null, cmd.fullName,
        cmd.documentId ?? null, cmd.documentType ?? null,
        cmd.age ?? null, cmd.gender ?? null,
        cmd.socioeconomicLevel ?? null, cmd.riskClassification ?? null,
        cmd.nutritionalStatus ?? null, cmd.municipalityName,
        cmd.zoneName ?? null, cmd.address ?? null,
        cmd.latitude ?? null, cmd.longitude ?? null,
        cmd.contactPhone ?? null, now, now,
      ]
    );
    return (await this.findBeneficiaryById(id))!;
  }

  async findBeneficiaryById(id: string): Promise<Beneficiary | null> {
    const res = await this.pool.query(
      `SELECT * FROM public.beneficiaries WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    return res.rows[0] ? this.mapBeneficiary(res.rows[0]) : null;
  }

  async listBeneficiaries(
    tenantId: string,
    params: PaginationParams,
    filter?: { programId?: string; riskClassification?: string; municipalityName?: string }
  ): Promise<PaginatedResult<Beneficiary>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = ["tenant_id = $1", "deleted_at IS NULL", "is_active = TRUE"];
    const values: unknown[] = [tid];
    let idx = 2;

    if (filter?.programId) {
      conditions.push(`program_id = $${idx++}`);
      values.push(filter.programId);
    }
    if (filter?.riskClassification) {
      conditions.push(`risk_classification = $${idx++}`);
      values.push(filter.riskClassification);
    }
    if (filter?.municipalityName) {
      conditions.push(`municipality_name ILIKE $${idx++}`);
      values.push(`%${filter.municipalityName}%`);
    }

    const where = conditions.join(" AND ");
    const countRes = await this.pool.query(`SELECT COUNT(*) FROM public.beneficiaries WHERE ${where}`, values);
    const total = parseInt(countRes.rows[0].count, 10);
    const res = await this.pool.query(
      `SELECT * FROM public.beneficiaries WHERE ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, params.limit, offset]
    );
    return { data: res.rows.map((r: any) => this.mapBeneficiary(r)), total, page: params.page, limit: params.limit };
  }

  // ── Institutional Alerts ──

  async listInstitutionalAlerts(tenantId: string, params: PaginationParams): Promise<PaginatedResult<InstitutionalAlert>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM public.institutional_alerts WHERE tenant_id = $1`, [tid]
    );
    const total = parseInt(countRes.rows[0].count, 10);
    const res = await this.pool.query(
      `SELECT * FROM public.institutional_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tid, params.limit, offset]
    );
    return { data: res.rows.map((r: any) => this.mapAlert(r)), total, page: params.page, limit: params.limit };
  }

  async acknowledgeInstitutionalAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.institutional_alerts SET is_acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1`, [alertId, acknowledgedBy]
    );
  }

  async generateAlerts(tenantId: string): Promise<InstitutionalAlert[]> {
    const tid = await this.resolveTenantId(tenantId);
    const iratScores = await this.getIratScores(tenantId);
    const alerts: InstitutionalAlert[] = [];

    // Load per-tenant thresholds with defaults
    const thresholds = await this.getAlertThresholds(tenantId);
    const t = (key: string, fallback: number): number => {
      const found = thresholds.find(th => th.ruleKey === key);
      return found ? found.value : fallback;
    };

    const iratHigh = t("institutional.irat_high", 60);
    const iratCritical = t("institutional.irat_critical", 80);
    const supplyShortage = t("institutional.supply_shortage", 50) / 100;
    const lowCoverage = t("institutional.low_coverage", 30) / 100;

    for (const score of iratScores) {
      // High IRAT alert
      if (score.iratScore >= iratHigh) {
        const alert = await this.createAlert(tid, {
          alertType: "irat_alto",
          severity: score.iratScore >= iratCritical ? "critical" : "high",
          title: `IRAT alto en ${score.tenantName}`,
          description: `El indice IRAT es ${score.iratScore} (umbral: ${iratHigh}). Requiere atencion inmediata.`,
          indicatorName: "irat_score",
          indicatorValue: score.iratScore,
          thresholdValue: iratHigh,
          zoneName: score.tenantName,
        });
        alerts.push(alert);
      }

      // Supply shortage
      if (score.totalDemandQuantity > 0 && score.totalOfferQuantity < score.totalDemandQuantity * supplyShortage) {
        const alert = await this.createAlert(tid, {
          alertType: "desabastecimiento",
          severity: "high",
          title: `Riesgo de desabastecimiento en ${score.tenantName}`,
          description: `Oferta (${score.totalOfferQuantity}) cubre menos del ${Math.round(supplyShortage * 100)}% de la demanda (${score.totalDemandQuantity}).`,
          indicatorName: "supply_coverage",
          indicatorValue: score.totalOfferQuantity,
          thresholdValue: score.totalDemandQuantity * supplyShortage,
          zoneName: score.tenantName,
        });
        alerts.push(alert);
      }

      // Excess without destination
      if (score.totalOfferQuantity > 0 && score.openDemands === 0 && score.activeLogistics === 0) {
        const alert = await this.createAlert(tid, {
          alertType: "exceso_sin_destino",
          severity: "medium",
          title: `Exceso de alimentos sin destino en ${score.tenantName}`,
          description: `Hay ${score.totalOfferQuantity} unidades de oferta sin demanda ni logistica activa.`,
          indicatorName: "excess_supply",
          indicatorValue: score.totalOfferQuantity,
          thresholdValue: 0,
          zoneName: score.tenantName,
        });
        alerts.push(alert);
      }

      // Low program coverage
      if (score.totalBeneficiaries > 0 && score.programCoverage < score.totalBeneficiaries * lowCoverage) {
        const alert = await this.createAlert(tid, {
          alertType: "baja_cobertura",
          severity: "high",
          title: `Baja cobertura de programas en ${score.tenantName}`,
          description: `Cobertura de programas (${score.programCoverage}) cubre menos del ${Math.round(lowCoverage * 100)}% de beneficiarios (${score.totalBeneficiaries}).`,
          indicatorName: "program_coverage",
          indicatorValue: score.programCoverage,
          thresholdValue: score.totalBeneficiaries * lowCoverage,
          zoneName: score.tenantName,
        });
        alerts.push(alert);
      }
    }

    return alerts;
  }

  // ── Coordination Tasks ──

  async createCoordinationTask(task: Omit<CoordinationTask, "id" | "createdAt" | "updatedAt" | "completedAt">): Promise<CoordinationTask> {
    const id = randomUUID();
    const tenantId = await this.resolveTenantId(task.tenantId);
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.coordination_tasks
        (id, tenant_id, actor_type, actor_name, task_description, assigned_to, status, priority, due_date, notes, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id, tenantId, task.actorType, task.actorName, task.taskDescription,
        task.assignedTo, task.status, task.priority, task.dueDate,
        task.notes, JSON.stringify(task.metadata), now, now,
      ]
    );
    return { ...task, id, tenantId, createdAt: now, updatedAt: now, completedAt: null };
  }

  async listCoordinationTasks(tenantId: string, params: PaginationParams): Promise<PaginatedResult<CoordinationTask>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM public.coordination_tasks WHERE tenant_id = $1`, [tid]
    );
    const total = parseInt(countRes.rows[0].count, 10);
    const res = await this.pool.query(
      `SELECT * FROM public.coordination_tasks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tid, params.limit, offset]
    );
    return { data: res.rows.map((r: any) => this.mapTask(r)), total, page: params.page, limit: params.limit };
  }

  async updateCoordinationTaskStatus(taskId: string, status: string): Promise<void> {
    const sets = ["status = $2", "updated_at = NOW()"];
    if (status === "completed") sets.push("completed_at = NOW()");
    await this.pool.query(
      `UPDATE public.coordination_tasks SET ${sets.join(", ")} WHERE id = $1`, [taskId, status]
    );
  }

  // ── Program Coverage ──

  async getProgramCoverage(tenantId: string): Promise<ProgramCoverage[]> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query(
      `SELECT * FROM public.v_program_coverage WHERE tenant_id = $1 ORDER BY coverage_pct ASC`, [tid]
    );
    return res.rows.map((r: any) => ({
      tenantId: r.tenant_id,
      programId: r.program_id,
      programName: r.program_name,
      programType: r.program_type,
      targetPopulation: Number(r.target_population),
      currentCoverage: Number(r.current_coverage),
      coveragePct: Number(r.coverage_pct),
      budgetAllocated: Number(r.budget_allocated),
      budgetExecuted: Number(r.budget_executed),
      budgetExecutionPct: Number(r.budget_execution_pct),
      municipalityName: r.municipality_name,
      status: r.status,
      totalDeliveries: Number(r.total_deliveries),
      totalDeliveredQuantity: Number(r.total_delivered_quantity),
      enrolledBeneficiaries: Number(r.enrolled_beneficiaries),
    }));
  }

  // ── Dashboard ──

  async getInstitutionalDashboard(tenantId?: string): Promise<InstitutionalDashboard> {
    const irat = await this.getIratScores(tenantId);
    const avgIratScore = irat.length === 0 ? 0 : Math.round(irat.reduce((s, i) => s + i.iratScore, 0) / irat.length * 100) / 100;
    const totalPopulationServed = irat.reduce((s, i) => s + i.programCoverage, 0);
    const totalFoodCoverage = irat.reduce((s, i) => s + i.totalOfferQuantity, 0);
    const totalTonsDistributed = irat.reduce((s, i) => s + i.totalRescuedQuantity, 0);
    const totalFoodRescued = irat.reduce((s, i) => s + i.totalRescuedQuantity, 0);

    // Simple waste calculation: offer qty - demand qty where offer > demand
    const wasteAvoided = irat.reduce((s, i) => {
      const excess = Math.max(0, i.totalOfferQuantity - i.totalDemandQuantity);
      const rescued = Math.min(excess, i.totalRescuedQuantity);
      return s + rescued;
    }, 0);

    const logisticsEfficiency = irat.length === 0 ? 0 : Math.round(
      irat.reduce((s, i) => s + (i.activeLogistics > 0 ? 1 : 0), 0) / irat.length * 100
    );

    // Alert generation for dashboard
    const tid = tenantId ? await this.resolveTenantId(tenantId) : null;
    let alerts: InstitutionalAlert[] = [];
    if (tid) {
      const alertResult = await this.pool.query(
        `SELECT * FROM public.institutional_alerts WHERE tenant_id = $1 AND is_acknowledged = FALSE ORDER BY created_at DESC LIMIT 20`,
        [tid]
      );
      alerts = alertResult.rows.map((r: any) => this.mapAlert(r));
    }

    // Program coverage
    let programCoverage: ProgramCoverage[] = [];
    if (tenantId) {
      programCoverage = await this.getProgramCoverage(tenantId);
    }

    return {
      irat,
      kpis: {
        avgIratScore,
        totalPopulationServed,
        totalFoodCoverage,
        totalTonsDistributed,
        totalFoodRescued,
        wasteAvoided,
        logisticsEfficiency,
        avgResponseTime: 0,
      },
      alerts,
      programCoverage,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Allocation Simulation ──

  async createAllocationScenario(scenario: {
    tenantId: string; scenarioName: string; description?: string;
    budgetTotal: number; parameters: Record<string, unknown>; createdBy?: string;
  }): Promise<AllocationScenario> {
    const id = randomUUID();
    const tid = await this.resolveTenantId(scenario.tenantId);
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.allocation_scenarios
        (id, tenant_id, scenario_name, description, budget_total, parameters, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, tid, scenario.scenarioName, scenario.description ?? null,
       scenario.budgetTotal, JSON.stringify(scenario.parameters),
       scenario.createdBy ?? null, now, now]
    );
    return {
      id, tenantId: tid, scenarioName: scenario.scenarioName,
      description: scenario.description ?? null, budgetTotal: scenario.budgetTotal,
      parameters: scenario.parameters, results: {}, status: "draft",
      createdBy: scenario.createdBy ?? null, createdAt: now,
    };
  }

  async listAllocationScenarios(tenantId: string): Promise<AllocationScenario[]> {
    const tid = await this.resolveTenantId(tenantId);
    const res = await this.pool.query(
      `SELECT * FROM public.allocation_scenarios WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tid]
    );
    return res.rows.map((r: any) => ({
      id: r.id, tenantId: r.tenant_id, scenarioName: r.scenario_name,
      description: r.description, budgetTotal: Number(r.budget_total),
      parameters: r.parameters ?? {}, results: r.results ?? {},
      status: r.status, createdBy: r.created_by, createdAt: r.created_at,
    }));
  }

  async runAllocationSimulation(scenarioId: string): Promise<AllocationScenario> {
    // 1. Load scenario
    const scenRes = await this.pool.query(
      `SELECT * FROM public.allocation_scenarios WHERE id = $1`, [scenarioId]
    );
    if (!scenRes.rows[0]) throw new Error("SCENARIO_NOT_FOUND");
    const sc = scenRes.rows[0] as any;
    const tid = sc.tenant_id;
    const budget = Number(sc.budget_total);
    const params = sc.parameters ?? {};

    // 2. Get IRAT scores for the tenant
    const irat = await this.getIratScores(tid);

    // 3. Get program coverage
    const coverageRes = await this.pool.query(
      `SELECT * FROM public.v_program_coverage WHERE tenant_id = $1 ORDER BY coverage_pct ASC`,
      [tid]
    );
    const programs = coverageRes.rows;

    // 4. Run simulation: Proportional allocation based on IRAT risk score
    const totalIrat = irat.reduce((s, i) => s + i.iratScore, 0) || 1;
    const priorityWeight = Number(params.priorityWeight ?? 0.7);  // 70% by IRAT, 30% equal
    const equalShare = budget * (1 - priorityWeight) / Math.max(programs.length, 1);

    const allocations = programs.map((p: any) => {
      const matchingIrat = irat.find(i => i.tenantId === tid);
      const iratProportion = matchingIrat ? matchingIrat.iratScore / totalIrat : 0;
      const riskAllocation = budget * priorityWeight * iratProportion;
      const totalAllocation = Math.round((riskAllocation + equalShare) * 100) / 100;
      const coveragePct = Number(p.coverage_pct);
      const gap = Number(p.target_population) - Number(p.current_coverage);

      return {
        programId: p.program_id,
        programName: p.program_name,
        currentBudget: Number(p.budget_allocated),
        proposedBudget: totalAllocation,
        currentCoverage: Number(p.current_coverage),
        targetPopulation: Number(p.target_population),
        coverageGap: Math.max(0, gap),
        coveragePct,
        estimatedNewCoverage: Math.min(
          Number(p.target_population),
          Number(p.current_coverage) + Math.round(totalAllocation / Math.max(Number(p.budget_allocated) / Math.max(Number(p.current_coverage), 1), 1))
        ),
      };
    });

    const totalAllocated = allocations.reduce((s: number, a: any) => s + a.proposedBudget, 0);
    const results = {
      allocations,
      summary: {
        budgetTotal: budget,
        totalAllocated: Math.round(totalAllocated * 100) / 100,
        remainingBudget: Math.round((budget - totalAllocated) * 100) / 100,
        programsImpacted: allocations.length,
        avgCoverageImprovement: allocations.length > 0
          ? Math.round(allocations.reduce((s: number, a: any) => s + (a.estimatedNewCoverage - a.currentCoverage), 0) / allocations.length)
          : 0,
      },
      simulatedAt: new Date().toISOString(),
    };

    // 5. Save results
    await this.pool.query(
      `UPDATE public.allocation_scenarios SET results = $2, status = 'completed', updated_at = NOW() WHERE id = $1`,
      [scenarioId, JSON.stringify(results)]
    );

    return {
      id: sc.id, tenantId: tid, scenarioName: sc.scenario_name,
      description: sc.description, budgetTotal: budget,
      parameters: sc.parameters ?? {}, results,
      status: "completed", createdBy: sc.created_by, createdAt: sc.created_at,
    };
  }

  // ── Supervisión Operativa ──

  async getSupervisionData(tenantId?: string): Promise<SupervisionData[]> {
    const tid = tenantId ? await this.resolveTenantId(tenantId) : null;
    const where = tid ? "WHERE tenant_id = $1" : "";
    const params = tid ? [tid] : [];

    const res = await this.pool.query(
      `SELECT * FROM public.v_supervision_operativa ${where}`,
      params
    );
    return res.rows.map((r: any) => ({
      tenantId: r.tenant_id,
      tenantCode: r.tenant_code,
      tenantName: r.tenant_name,
      recursosEnRuta: Number(r.recursos_en_ruta),
      recursosDisponibles: Number(r.recursos_disponibles),
      entregasEnCurso: Number(r.entregas_en_curso),
      entregasHoy: Number(r.entregas_hoy),
      incidenciasAbiertas: Number(r.incidencias_abiertas),
      incidenciasCriticas: Number(r.incidencias_criticas),
      slaBreached: Number(r.sla_breached),
      alertasPendientes: Number(r.alertas_pendientes),
    }));
  }

  // ── Alert Thresholds ──

  async getAlertThresholds(tenantId: string): Promise<InstitutionalAlertThreshold[]> {
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

  async upsertAlertThreshold(tenantId: string, ruleKey: string, value: number, updatedBy?: string): Promise<InstitutionalAlertThreshold> {
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

  // ── Private Helpers ──

  private async createAlert(tenantId: string, data: {
    alertType: string; severity: string; title: string; description: string;
    indicatorName: string; indicatorValue: number; thresholdValue: number; zoneName: string;
  }): Promise<InstitutionalAlert> {
    const id = randomUUID();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.institutional_alerts
        (id, tenant_id, alert_type, severity, title, description, indicator_name, indicator_value, threshold_value, zone_name, auto_generated, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11)`,
      [id, tenantId, data.alertType, data.severity, data.title, data.description, data.indicatorName, data.indicatorValue, data.thresholdValue, data.zoneName, now]
    );
    return {
      id, tenantId, alertType: data.alertType, severity: data.severity,
      title: data.title, description: data.description,
      indicatorName: data.indicatorName, indicatorValue: data.indicatorValue,
      thresholdValue: data.thresholdValue, zoneName: data.zoneName,
      isAcknowledged: false, acknowledgedBy: null, acknowledgedAt: null,
      autoGenerated: true, metadata: {}, createdAt: now,
    };
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [tenantKey]
    );
    if (!result.rows[0]) throw new Error("TENANT_NOT_FOUND");
    return result.rows[0].id;
  }

  private mapProgram(r: any): FoodProgram {
    return {
      id: r.id, tenantId: r.tenant_id, name: r.name, programType: r.program_type,
      description: r.description, targetPopulation: Number(r.target_population),
      currentCoverage: Number(r.current_coverage), budgetAllocated: Number(r.budget_allocated),
      budgetExecuted: Number(r.budget_executed), responsibleName: r.responsible_name,
      responsibleEmail: r.responsible_email, municipalityName: r.municipality_name,
      status: r.status, startsAt: r.starts_at, endsAt: r.ends_at,
      metadata: r.metadata ?? {}, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  private mapBeneficiary(r: any): Beneficiary {
    return {
      id: r.id, tenantId: r.tenant_id, programId: r.program_id,
      fullName: r.full_name, documentId: r.document_id, documentType: r.document_type,
      age: r.age, gender: r.gender, socioeconomicLevel: r.socioeconomic_level,
      riskClassification: r.risk_classification, nutritionalStatus: r.nutritional_status,
      municipalityName: r.municipality_name, zoneName: r.zone_name, address: r.address,
      latitude: r.latitude ? Number(r.latitude) : null, longitude: r.longitude ? Number(r.longitude) : null,
      contactPhone: r.contact_phone, isActive: r.is_active, createdAt: r.created_at,
    };
  }

  private mapAlert(r: any): InstitutionalAlert {
    return {
      id: r.id, tenantId: r.tenant_id, alertType: r.alert_type, severity: r.severity,
      title: r.title, description: r.description, indicatorName: r.indicator_name,
      indicatorValue: r.indicator_value ? Number(r.indicator_value) : null,
      thresholdValue: r.threshold_value ? Number(r.threshold_value) : null,
      zoneName: r.zone_name, isAcknowledged: r.is_acknowledged,
      acknowledgedBy: r.acknowledged_by, acknowledgedAt: r.acknowledged_at,
      autoGenerated: r.auto_generated, metadata: r.metadata ?? {}, createdAt: r.created_at,
    };
  }

  private mapTask(r: any): CoordinationTask {
    return {
      id: r.id, tenantId: r.tenant_id, actorType: r.actor_type, actorName: r.actor_name,
      taskDescription: r.task_description, assignedTo: r.assigned_to, status: r.status,
      priority: r.priority, dueDate: r.due_date, completedAt: r.completed_at,
      notes: r.notes, metadata: r.metadata ?? {}, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // ── Spoilage Tracking ──

  async createSpoilageRecord(cmd: SpoilageCreateCommand): Promise<SpoilageRecord> {
    const tid = await this.resolveTenantId(cmd.tenantId);
    const id = randomUUID();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO public.spoilage_records
        (id, tenant_id, program_id, logistics_order_id, product_name, category,
         quantity_kg, spoilage_kg, spoilage_reason, stage, temperature_c,
         detected_at, detected_by, location_name, latitude, longitude, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        id, tid, cmd.programId ?? null, cmd.logisticsOrderId ?? null,
        cmd.productName, cmd.category ?? "perecedero",
        cmd.quantityKg, cmd.spoilageKg, cmd.spoilageReason ?? "other",
        cmd.stage ?? "storage", cmd.temperatureC ?? null,
        now, cmd.detectedBy ?? null, cmd.locationName ?? null,
        cmd.latitude ?? null, cmd.longitude ?? null, cmd.notes ?? null, now,
      ]
    );
    return {
      id, tenantId: tid, programId: cmd.programId ?? null,
      logisticsOrderId: cmd.logisticsOrderId ?? null,
      productName: cmd.productName, category: cmd.category ?? "perecedero",
      quantityKg: cmd.quantityKg, spoilageKg: cmd.spoilageKg,
      spoilageReason: (cmd.spoilageReason ?? "other") as SpoilageRecord["spoilageReason"],
      stage: (cmd.stage ?? "storage") as SpoilageRecord["stage"],
      temperatureC: cmd.temperatureC ?? null,
      detectedAt: now, detectedBy: cmd.detectedBy ?? null,
      locationName: cmd.locationName ?? null,
      latitude: cmd.latitude ?? null, longitude: cmd.longitude ?? null,
      notes: cmd.notes ?? null, createdAt: now,
    };
  }

  async listSpoilageRecords(tenantId: string, params: PaginationParams): Promise<PaginatedResult<SpoilageRecord>> {
    const tid = await this.resolveTenantId(tenantId);
    const offset = (params.page - 1) * params.limit;
    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*) AS total FROM public.spoilage_records WHERE tenant_id = $1`, [tid]
    );
    const { rows } = await this.pool.query(
      `SELECT * FROM public.spoilage_records WHERE tenant_id = $1
       ORDER BY detected_at DESC LIMIT $2 OFFSET $3`,
      [tid, params.limit, offset]
    );
    return {
      data: rows.map(this.mapSpoilage),
      total: Number(countRows[0].total),
      page: params.page,
      limit: params.limit,
    };
  }

  async getSpoilageSummary(tenantId: string): Promise<SpoilageSummary[]> {
    const tid = await this.resolveTenantId(tenantId);
    const { rows } = await this.pool.query(
      `SELECT * FROM public.v_spoilage_summary WHERE tenant_id = $1`,
      [tid]
    );
    return rows.map(r => ({
      category: r.category as string,
      stage: r.stage as string,
      spoilageReason: r.spoilage_reason as string,
      recordCount: Number(r.record_count),
      totalQuantityKg: Number(r.total_quantity_kg),
      totalSpoilageKg: Number(r.total_spoilage_kg),
      spoilageRatePct: Number(r.spoilage_rate_pct),
      avgTemperatureC: r.avg_temperature_c != null ? Number(r.avg_temperature_c) : null,
      lastDetected: new Date(r.last_detected as string),
    }));
  }

  private mapSpoilage(r: any): SpoilageRecord {
    return {
      id: r.id, tenantId: r.tenant_id, programId: r.program_id,
      logisticsOrderId: r.logistics_order_id,
      productName: r.product_name, category: r.category,
      quantityKg: Number(r.quantity_kg), spoilageKg: Number(r.spoilage_kg),
      spoilageReason: r.spoilage_reason, stage: r.stage,
      temperatureC: r.temperature_c != null ? Number(r.temperature_c) : null,
      detectedAt: new Date(r.detected_at), detectedBy: r.detected_by,
      locationName: r.location_name,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      notes: r.notes, createdAt: new Date(r.created_at),
    };
  }
}
