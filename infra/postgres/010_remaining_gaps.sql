-- ================================================================
-- 010_remaining_gaps.sql
-- Geofencing, incident clustering, trend analytics, resource simulation,
-- supervisión operativa support
-- ================================================================

-- ──────────────────────────────────────────────────────
-- 1. GEOFENCE ZONES (logistics)
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  zone_name   VARCHAR(200) NOT NULL,
  zone_type   VARCHAR(50)  NOT NULL DEFAULT 'delivery',  -- delivery | restricted | warehouse | critical
  geom        GEOMETRY(Polygon, 4326),
  center_lat  NUMERIC(10,7),
  center_lng  NUMERIC(10,7),
  radius_m    NUMERIC(10,2) DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_tenant ON public.geofence_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_geom ON public.geofence_zones USING GIST(geom);

-- Geofence events log
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id          BIGSERIAL PRIMARY KEY,
  zone_id     UUID NOT NULL,
  recurso_id  UUID NOT NULL,
  event_type  VARCHAR(20) NOT NULL, -- enter | exit | dwell
  latitude    NUMERIC(10,7),
  longitude   NUMERIC(10,7),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_zone ON public.geofence_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_recurso ON public.geofence_events(recurso_id);

-- ──────────────────────────────────────────────────────
-- 2. INCIDENT CLUSTERING SUPPORT (spatial)
-- ──────────────────────────────────────────────────────

-- View for PostGIS cluster analysis with ST_ClusterDBSCAN
CREATE OR REPLACE VIEW public.v_incident_clusters AS
SELECT
  i.id,
  i.tenant_id,
  i.incident_type,
  i.severity,
  i.status,
  i.municipality_name,
  i.affected_population,
  i.latitude,
  i.longitude,
  i.created_at,
  ST_SetSRID(ST_MakePoint(i.longitude::double precision, i.latitude::double precision), 4326) AS geom
FROM public.incidents i
WHERE i.deleted_at IS NULL
  AND i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL;

-- ──────────────────────────────────────────────────────
-- 3. TREND ANALYTICS SUPPORT
-- ──────────────────────────────────────────────────────

-- Weekly incident trend view
CREATE OR REPLACE VIEW public.v_incident_trends AS
SELECT
  tenant_id,
  date_trunc('week', created_at)::date AS week_start,
  incident_type,
  severity,
  COUNT(*) AS incident_count,
  SUM(affected_population) AS total_affected,
  COUNT(*) FILTER (WHERE status = 'cerrada') AS resolved_count,
  AVG(response_time_minutes) FILTER (WHERE response_time_minutes IS NOT NULL) AS avg_response_min
FROM public.incidents
WHERE deleted_at IS NULL
GROUP BY tenant_id, date_trunc('week', created_at)::date, incident_type, severity
ORDER BY week_start DESC;

-- Daily incident trend view (finer grain)
CREATE OR REPLACE VIEW public.v_incident_trends_daily AS
SELECT
  tenant_id,
  created_at::date AS day,
  incident_type,
  severity,
  COUNT(*) AS incident_count,
  SUM(affected_population) AS total_affected,
  COUNT(*) FILTER (WHERE status = 'cerrada') AS resolved_count,
  AVG(response_time_minutes) FILTER (WHERE response_time_minutes IS NOT NULL) AS avg_response_min
FROM public.incidents
WHERE deleted_at IS NULL
GROUP BY tenant_id, created_at::date, incident_type, severity
ORDER BY day DESC;

-- ──────────────────────────────────────────────────────
-- 4. RESOURCE ALLOCATION SIMULATION
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.allocation_scenarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  scenario_name VARCHAR(200) NOT NULL,
  description  TEXT,
  budget_total NUMERIC(14,2) DEFAULT 0,
  parameters   JSONB DEFAULT '{}',
  results      JSONB DEFAULT '{}',
  status       VARCHAR(30) DEFAULT 'draft', -- draft | running | completed
  created_by   VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocation_scenarios_tenant ON public.allocation_scenarios(tenant_id);

-- ──────────────────────────────────────────────────────
-- 5. SUPERVISION OPERATIVA VIEW
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_supervision_operativa AS
SELECT
  t.id AS tenant_id,
  t.code AS tenant_code,
  t.name AS tenant_name,
  -- Recursos activos
  (SELECT COUNT(*) FROM public.recursos r WHERE r.tenant_id = t.id AND r.estado = 'en_ruta' AND r.deleted_at IS NULL) AS recursos_en_ruta,
  (SELECT COUNT(*) FROM public.recursos r WHERE r.tenant_id = t.id AND r.estado = 'disponible' AND r.deleted_at IS NULL) AS recursos_disponibles,
  -- Entregas
  (SELECT COUNT(*) FROM public.logistics_orders lo WHERE lo.tenant_id = t.id AND lo.status = 'in_transit' AND lo.deleted_at IS NULL) AS entregas_en_curso,
  (SELECT COUNT(*) FROM public.logistics_orders lo WHERE lo.tenant_id = t.id AND lo.status = 'delivered' AND lo.deleted_at IS NULL AND lo.delivered_at >= NOW() - INTERVAL '24 hours') AS entregas_hoy,
  -- Incidencias
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.status IN ('reportada','open') AND i.deleted_at IS NULL) AS incidencias_abiertas,
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.severity = 'critical' AND i.status NOT IN ('cerrada') AND i.deleted_at IS NULL) AS incidencias_criticas,
  -- SLA
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.deleted_at IS NULL AND i.sla_target_minutes IS NOT NULL AND i.first_response_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 60 > i.sla_target_minutes) AS sla_breached,
  -- Alertas sin reconocer
  (SELECT COUNT(*) FROM public.incident_alerts ia WHERE ia.tenant_id = t.id AND ia.is_acknowledged = FALSE) AS alertas_pendientes
FROM public.tenants t;

-- ──────────────────────────────────────────────────────
-- 6. ETA ESTIMATION SUPPORT
-- ──────────────────────────────────────────────────────

-- View for average speed per resource (from tracking history)
CREATE OR REPLACE VIEW public.v_resource_avg_speed AS
SELECT
  recurso_id,
  COUNT(*) AS total_points,
  AVG(velocidad) FILTER (WHERE velocidad > 0 AND velocidad < 120) AS avg_speed_kmh,
  MAX(registrado_at) AS last_tracked_at
FROM public.tracking_historial
WHERE registrado_at >= NOW() - INTERVAL '7 days'
GROUP BY recurso_id;

-- ──────────────────────────────────────────────────────
-- GRANTS
-- ──────────────────────────────────────────────────────

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_zones TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.geofence_events TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.geofence_events_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_scenarios TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_clusters TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_trends TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_trends_daily TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_supervision_operativa TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_resource_avg_speed TO ' || CURRENT_USER; END $$;
