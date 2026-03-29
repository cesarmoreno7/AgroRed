-- ════════════════════════════════════════════════════════════
-- 012 — VRP Multi-Vehículo, Spoilage Tracking, Incident Classification
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────
-- 1. VRP Solutions & Vehicle Assignments
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vrp_solutions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  scenario_name VARCHAR(200) NOT NULL,
  depot_lat     NUMERIC(10,6) NOT NULL,
  depot_lng     NUMERIC(10,6) NOT NULL,
  strategy      VARCHAR(40) NOT NULL DEFAULT 'clarke_wright',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_vehicles_used INTEGER DEFAULT 0,
  total_distance_km   NUMERIC(12,2) DEFAULT 0,
  total_duration_min  NUMERIC(12,2) DEFAULT 0,
  total_load_kg       NUMERIC(12,2) DEFAULT 0,
  unserved_stops      INTEGER DEFAULT 0,
  routing_engine      VARCHAR(20) DEFAULT 'haversine',
  metadata            JSONB DEFAULT '{}',
  created_by          VARCHAR(200),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vrp_vehicle_routes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vrp_solution_id UUID NOT NULL REFERENCES public.vrp_solutions(id) ON DELETE CASCADE,
  vehicle_index   INTEGER NOT NULL,
  recurso_id      UUID,
  vehicle_label   VARCHAR(200),
  capacity_kg     NUMERIC(10,2) DEFAULT 0,
  assigned_load_kg NUMERIC(10,2) DEFAULT 0,
  distance_km     NUMERIC(12,2) DEFAULT 0,
  duration_min    NUMERIC(12,2) DEFAULT 0,
  stop_count      INTEGER DEFAULT 0,
  geometry        TEXT,
  stop_order      JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vrp_solutions_tenant ON public.vrp_solutions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vrp_vehicle_routes_solution ON public.vrp_vehicle_routes(vrp_solution_id);

-- ────────────────────────────────────────────
-- 2. Spoilage Tracking
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.spoilage_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  program_id        UUID,
  logistics_order_id UUID,
  product_name      VARCHAR(200) NOT NULL,
  category          VARCHAR(100) NOT NULL DEFAULT 'perecedero',
  quantity_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
  spoilage_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
  spoilage_reason   VARCHAR(60) NOT NULL DEFAULT 'other',
  stage             VARCHAR(60) NOT NULL DEFAULT 'storage',
  temperature_c     NUMERIC(5,1),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_by       VARCHAR(200),
  location_name     VARCHAR(300),
  latitude          NUMERIC(10,6),
  longitude         NUMERIC(10,6),
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- spoilage_reason: expired, temperature, damaged, contaminated, overproduction, other
-- stage: harvest, storage, transport, distribution, last_mile

CREATE INDEX IF NOT EXISTS idx_spoilage_tenant ON public.spoilage_records(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_spoilage_program ON public.spoilage_records(program_id);

-- Spoilage summary view
CREATE OR REPLACE VIEW public.v_spoilage_summary AS
SELECT
  s.tenant_id,
  s.category,
  s.stage,
  s.spoilage_reason,
  COUNT(*) AS record_count,
  SUM(s.quantity_kg) AS total_quantity_kg,
  SUM(s.spoilage_kg) AS total_spoilage_kg,
  CASE WHEN SUM(s.quantity_kg) > 0
       THEN ROUND(SUM(s.spoilage_kg) / SUM(s.quantity_kg) * 100, 2)
       ELSE 0 END AS spoilage_rate_pct,
  AVG(s.temperature_c) AS avg_temperature_c,
  MAX(s.detected_at) AS last_detected
FROM public.spoilage_records s
GROUP BY s.tenant_id, s.category, s.stage, s.spoilage_reason;

-- ────────────────────────────────────────────
-- 3. Incident Auto-Classification
-- ────────────────────────────────────────────
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS auto_classification VARCHAR(40),
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS classification_method VARCHAR(30) DEFAULT 'manual';

-- classification_method: manual, keyword_nlp, ml_model

-- ────────────────────────────────────────────
-- Grants
-- ────────────────────────────────────────────
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vrp_solutions TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vrp_vehicle_routes TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.spoilage_records TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_spoilage_summary TO ' || CURRENT_USER; END $$;
