-- ============================================================
-- 008_modulos_revision.sql
-- Revisión de módulos: Gestión Institucional, Logística
-- Inteligente, Incidencias y Riesgos Sociales
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. MÓDULO DE INCIDENCIAS Y RIESGOS SOCIALES
-- ────────────────────────────────────────────────

-- 1a. Expand incident_type enum values via ALTER
-- (Postgres text columns, no enum type to alter)
-- New social incident types will be validated at app level

-- 1b. Add new columns to incidents table
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS reported_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reporter_role VARCHAR(100),
  ADD COLUMN IF NOT EXISTS affected_population INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affected_community VARCHAR(255),
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intervention_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_incident_id UUID;

-- 1c. Incident actions/follow-up table
CREATE TABLE IF NOT EXISTS public.incident_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,       -- assign, escalate, intervene, close, note, activate_program, activate_logistics
  performed_by VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_actions_incident ON public.incident_actions(incident_id);

-- 1d. Incident alerts table
CREATE TABLE IF NOT EXISTS public.incident_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type VARCHAR(80) NOT NULL,         -- multiple_incidents_zone, critical_risk, unattended_timeout, rising_cases
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  zone_name VARCHAR(255),
  incident_count INT DEFAULT 0,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_alerts_tenant ON public.incident_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_severity ON public.incident_alerts(severity);

-- ────────────────────────────────────────────────
-- 2. MÓDULO DE GESTIÓN INSTITUCIONAL
-- ────────────────────────────────────────────────

-- 2a. Programas alimentarios
CREATE TABLE IF NOT EXISTS public.food_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  program_type VARCHAR(80) NOT NULL,       -- comedor_comunitario, programa_escolar, ayuda_humanitaria, subsidio_alimentario
  description TEXT,
  target_population INT DEFAULT 0,
  current_coverage INT DEFAULT 0,
  budget_allocated NUMERIC(14,2) DEFAULT 0,
  budget_executed NUMERIC(14,2) DEFAULT 0,
  responsible_name VARCHAR(255),
  responsible_email VARCHAR(255),
  municipality_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- active, paused, completed, cancelled
  starts_at DATE,
  ends_at DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_food_programs_tenant ON public.food_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_food_programs_type ON public.food_programs(program_type);
CREATE INDEX IF NOT EXISTS idx_food_programs_status ON public.food_programs(status);

-- 2b. Beneficiarios
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  program_id UUID,
  full_name VARCHAR(255) NOT NULL,
  document_id VARCHAR(50),                 -- cédula, TI, etc.
  document_type VARCHAR(30),               -- CC, TI, RC, CE, etc.
  age INT,
  gender VARCHAR(20),
  socioeconomic_level INT,                 -- 1-6 (estrato)
  risk_classification VARCHAR(30),         -- critico, alto, medio, bajo
  nutritional_status VARCHAR(50),          -- normal, desnutricion_aguda, desnutricion_cronica, sobrepeso
  municipality_name VARCHAR(255) NOT NULL,
  zone_name VARCHAR(255),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  contact_phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_tenant ON public.beneficiaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_program ON public.beneficiaries(program_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_risk ON public.beneficiaries(risk_classification);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_municipality ON public.beneficiaries(municipality_name);

-- 2c. Program deliveries (entregas de programas)
CREATE TABLE IF NOT EXISTS public.program_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL,
  beneficiary_id UUID,
  tenant_id UUID NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity NUMERIC(12,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  delivered_by VARCHAR(255),
  delivery_date DATE NOT NULL,
  municipality_name VARCHAR(255) NOT NULL,
  evidence_url TEXT,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'completed', -- scheduled, in_transit, completed, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_deliveries_program ON public.program_deliveries(program_id);
CREATE INDEX IF NOT EXISTS idx_program_deliveries_tenant ON public.program_deliveries(tenant_id);

-- 2d. Institutional alerts (alertas del tablero)
CREATE TABLE IF NOT EXISTS public.institutional_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type VARCHAR(80) NOT NULL,         -- desabastecimiento, exceso_sin_destino, producto_por_perder, baja_cobertura, irat_alto
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  indicator_name VARCHAR(100),
  indicator_value NUMERIC(12,4),
  threshold_value NUMERIC(12,4),
  zone_name VARCHAR(255),
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutional_alerts_tenant ON public.institutional_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_institutional_alerts_severity ON public.institutional_alerts(severity);

-- 2e. Coordination tasks (coordinación interinstitucional)
CREATE TABLE IF NOT EXISTS public.coordination_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_type VARCHAR(80) NOT NULL,         -- supermercado, banco_alimentos, operador_logistico, entidad_salud, ong, alcaldia
  actor_name VARCHAR(255) NOT NULL,
  task_description TEXT NOT NULL,
  assigned_to VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coordination_tasks_tenant ON public.coordination_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coordination_tasks_status ON public.coordination_tasks(status);

-- ────────────────────────────────────────────────
-- 3. MÓDULO DE LOGÍSTICA INTELIGENTE
-- ────────────────────────────────────────────────

-- 3a. Route plans (planeación de rutas)
CREATE TABLE IF NOT EXISTS public.route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) NOT NULL DEFAULT 'recoleccion', -- recoleccion, entrega, mixta
  recurso_id UUID,                         -- assigned resource (vehicle/courier)
  total_stops INT DEFAULT 0,
  total_distance_km NUMERIC(10,2) DEFAULT 0,
  estimated_duration_min INT DEFAULT 0,
  total_load_kg NUMERIC(10,2) DEFAULT 0,
  max_capacity_kg NUMERIC(10,2) DEFAULT 0,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, optimized, in_progress, completed, cancelled
  optimization_score NUMERIC(5,2),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_plans_tenant ON public.route_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_status ON public.route_plans(status);

-- 3b. Route stops (paradas de ruta)
CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id UUID NOT NULL,
  stop_order INT NOT NULL,
  stop_type VARCHAR(30) NOT NULL,          -- pickup, delivery, checkpoint
  location_name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  logistics_order_id UUID,                 -- linked logistics order
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  estimated_departure TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  load_kg NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, arrived, completed, skipped
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_stops_plan ON public.route_stops(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON public.route_stops(route_plan_id, stop_order);

-- 3c. Add capacity fields to recursos
ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS capacidad_kg NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidad_volumen_m3 NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_refrigerado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS zona_operativa VARCHAR(255);

-- ────────────────────────────────────────────────
-- 4. VISTAS ANALÍTICAS
-- ────────────────────────────────────────────────

-- 4a. Vista IRAT (Índice de Riesgo Alimentario Territorial)
CREATE OR REPLACE VIEW public.v_irat_municipal AS
SELECT
  t.id AS tenant_id,
  t.code AS tenant_code,
  t.name AS tenant_name,
  -- Oferta
  COALESCE(off_c.total_offers, 0) AS total_offers,
  COALESCE(off_c.total_offer_qty, 0) AS total_offer_quantity,
  -- Demanda
  COALESCE(dem_c.open_demands, 0) AS open_demands,
  COALESCE(dem_c.total_demand_qty, 0) AS total_demand_quantity,
  COALESCE(dem_c.total_beneficiaries, 0) AS total_beneficiaries,
  -- Rescate
  COALESCE(res_c.scheduled_rescues, 0) AS scheduled_rescues,
  COALESCE(res_c.total_rescued_qty, 0) AS total_rescued_quantity,
  -- Incidencias
  COALESCE(inc_c.open_incidents, 0) AS open_incidents,
  COALESCE(inc_c.critical_incidents, 0) AS critical_incidents,
  -- Logística
  COALESCE(log_c.active_logistics, 0) AS active_logistics,
  -- Programas
  COALESCE(prg_c.active_programs, 0) AS active_programs,
  COALESCE(prg_c.program_coverage, 0) AS program_coverage,
  -- Cálculo IRAT simplificado (0-100, mayor = mayor riesgo)
  LEAST(100, GREATEST(0, ROUND(
    (
      -- Factor demanda insatisfecha (0-40)
      CASE WHEN COALESCE(off_c.total_offer_qty, 0) = 0 THEN 40
           ELSE LEAST(40, (COALESCE(dem_c.total_demand_qty, 0)::numeric / GREATEST(1, COALESCE(off_c.total_offer_qty, 0))) * 20)
      END
      -- Factor incidencias (0-30)
      + LEAST(30, COALESCE(inc_c.open_incidents, 0) * 3 + COALESCE(inc_c.critical_incidents, 0) * 10)
      -- Factor cobertura programas (0-30, inverso)
      + CASE WHEN COALESCE(prg_c.program_coverage, 0) = 0 THEN 30
             WHEN COALESCE(dem_c.total_beneficiaries, 0) = 0 THEN 0
             ELSE LEAST(30, 30 - (COALESCE(prg_c.program_coverage, 0)::numeric / GREATEST(1, COALESCE(dem_c.total_beneficiaries, 0))) * 30)
        END
    )
  ))) AS irat_score
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_offers, COALESCE(SUM(quantity_available), 0) AS total_offer_qty
  FROM public.offers WHERE tenant_id = t.id AND deleted_at IS NULL AND status = 'published'
) off_c ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS open_demands, COALESCE(SUM(quantity_required), 0) AS total_demand_qty, COALESCE(SUM(beneficiary_count), 0) AS total_beneficiaries
  FROM public.demands WHERE tenant_id = t.id AND deleted_at IS NULL AND status = 'open'
) dem_c ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS scheduled_rescues, COALESCE(SUM(quantity_rescued), 0) AS total_rescued_qty
  FROM public.rescues WHERE tenant_id = t.id AND deleted_at IS NULL AND status = 'scheduled'
) res_c ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS open_incidents, COUNT(*) FILTER (WHERE severity = 'critical') AS critical_incidents
  FROM public.incidents WHERE tenant_id = t.id AND deleted_at IS NULL AND status = 'open'
) inc_c ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_logistics
  FROM public.logistics_orders WHERE tenant_id = t.id AND deleted_at IS NULL AND status IN ('scheduled', 'in_transit')
) log_c ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_programs, COALESCE(SUM(current_coverage), 0) AS program_coverage
  FROM public.food_programs WHERE tenant_id = t.id AND deleted_at IS NULL AND status = 'active'
) prg_c ON TRUE;

-- 4b. Vista resumen de incidencias por zona
CREATE OR REPLACE VIEW public.v_incidents_by_zone AS
SELECT
  tenant_id,
  municipality_name,
  incident_type,
  severity,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'open') AS open_count,
  COUNT(*) FILTER (WHERE status = 'reportada') AS reportada_count,
  COUNT(*) FILTER (WHERE status IN ('en_gestion', 'intervenida')) AS in_progress_count,
  AVG(priority_score) AS avg_priority_score,
  MAX(created_at) AS last_reported_at
FROM public.incidents
WHERE deleted_at IS NULL
GROUP BY tenant_id, municipality_name, incident_type, severity;

-- 4c. Vista cobertura de programas
CREATE OR REPLACE VIEW public.v_program_coverage AS
SELECT
  fp.tenant_id,
  fp.id AS program_id,
  fp.name AS program_name,
  fp.program_type,
  fp.target_population,
  fp.current_coverage,
  CASE WHEN fp.target_population = 0 THEN 0
       ELSE ROUND((fp.current_coverage::numeric / fp.target_population) * 100, 2)
  END AS coverage_pct,
  fp.budget_allocated,
  fp.budget_executed,
  CASE WHEN fp.budget_allocated = 0 THEN 0
       ELSE ROUND((fp.budget_executed / fp.budget_allocated) * 100, 2)
  END AS budget_execution_pct,
  fp.municipality_name,
  fp.status,
  COALESCE(del.total_deliveries, 0) AS total_deliveries,
  COALESCE(del.total_delivered_qty, 0) AS total_delivered_quantity,
  COALESCE(ben.beneficiary_count, 0) AS enrolled_beneficiaries
FROM public.food_programs fp
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_deliveries, COALESCE(SUM(quantity), 0) AS total_delivered_qty
  FROM public.program_deliveries WHERE program_id = fp.id
) del ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS beneficiary_count
  FROM public.beneficiaries WHERE program_id = fp.id AND is_active = TRUE AND deleted_at IS NULL
) ben ON TRUE
WHERE fp.deleted_at IS NULL;

-- 4d. Vista de rutas activas con carga
CREATE OR REPLACE VIEW public.v_active_routes AS
SELECT
  rp.id AS route_plan_id,
  rp.tenant_id,
  rp.plan_name,
  rp.plan_type,
  rp.status,
  rp.total_stops,
  rp.total_distance_km,
  rp.estimated_duration_min,
  rp.total_load_kg,
  rp.max_capacity_kg,
  CASE WHEN rp.max_capacity_kg = 0 THEN 0
       ELSE ROUND((rp.total_load_kg / rp.max_capacity_kg) * 100, 2)
  END AS load_pct,
  rp.window_start,
  rp.window_end,
  r.nombre AS recurso_nombre,
  r.tipo AS recurso_tipo,
  r.placa AS recurso_placa,
  r.estado AS recurso_estado,
  completed_stops.completed,
  pending_stops.pending
FROM public.route_plans rp
LEFT JOIN public.recursos r ON r.id = rp.recurso_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS completed FROM public.route_stops WHERE route_plan_id = rp.id AND status = 'completed'
) completed_stops ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS pending FROM public.route_stops WHERE route_plan_id = rp.id AND status = 'pending'
) pending_stops ON TRUE
WHERE rp.status IN ('draft', 'optimized', 'in_progress');

-- ────────────────────────────────────────────────
-- 5. GRANTS
-- ────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_actions TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_alerts TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_programs TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_deliveries TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutional_alerts TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordination_tasks TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plans TO "777";
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO "777";
GRANT SELECT ON public.v_irat_municipal TO "777";
GRANT SELECT ON public.v_incidents_by_zone TO "777";
GRANT SELECT ON public.v_program_coverage TO "777";
GRANT SELECT ON public.v_active_routes TO "777";
