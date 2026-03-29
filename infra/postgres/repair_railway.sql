-- ================================================================
-- repair_railway.sql
-- Reparación para Railway PostgreSQL (SIN PostGIS):
--   - Crea tablas sin columnas GEOMETRY (usa lat/lng NUMERIC)
--   - Crea vistas sin funciones espaciales (ST_MakePoint, etc.)
--   - Ejecuta GRANTs con CURRENT_USER
--
-- Uso:
--   psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/repair_railway.sql
-- ================================================================

-- ──────────────────────────────────────────────────────
-- 0. DETECTAR SI POSTGIS ESTÁ DISPONIBLE
-- ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') THEN
    CREATE EXTENSION IF NOT EXISTS postgis;
    RAISE NOTICE 'PostGIS habilitado';
  ELSE
    RAISE NOTICE 'PostGIS NO disponible — se usarán columnas lat/lng sin GEOMETRY';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- 0b. FUNCIÓN HAVERSINE (reemplaza ST_Distance sin PostGIS)
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 NUMERIC, lng1 NUMERIC,
  lat2 NUMERIC, lng2 NUMERIC
) RETURNS NUMERIC AS $$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2))^2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians((lng2 - lng1) / 2))^2
  ));
$$ LANGUAGE SQL IMMUTABLE;

-- ──────────────────────────────────────────────────────
-- 1. REPARAR 003: GRANTs vistas de mapa
-- ──────────────────────────────────────────────────────

DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_rescates TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_incidentes TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_demandas TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_cadena_completa TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 2. REPARAR 004: Tablas logísticas (sin GEOMETRY)
-- ──────────────────────────────────────────────────────

-- 2a. Recursos logísticos
CREATE TABLE IF NOT EXISTS public.recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID REFERENCES public.users(id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('vehiculo', 'domiciliario', 'bicicleta', 'moto', 'otro')),
  placa TEXT,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible', 'en_ruta', 'inactivo', 'mantenimiento')),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_recurso_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  CONSTRAINT chk_recurso_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT chk_recurso_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE INDEX IF NOT EXISTS idx_recursos_tenant ON public.recursos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recursos_estado ON public.recursos(estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recursos_lat_lng ON public.recursos(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recursos_user ON public.recursos(user_id) WHERE user_id IS NOT NULL;

-- 2b. Historial de tracking GPS
CREATE TABLE IF NOT EXISTS public.tracking_historial (
  id BIGSERIAL PRIMARY KEY,
  recurso_id UUID NOT NULL REFERENCES public.recursos(id),
  orden_id UUID REFERENCES public.logistics_orders(id),
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  velocidad NUMERIC(6,2),
  precision_gps NUMERIC(6,2),
  bearing NUMERIC(5,2),
  evento TEXT CHECK (evento IN (
    'posicion', 'inicio_ruta', 'llegada_origen', 'recogida',
    'en_transito', 'llegada_destino', 'entregado', 'pausa', 'reanudacion'
  )) DEFAULT 'posicion',
  metadata JSONB DEFAULT '{}',
  registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_historial_recurso
  ON public.tracking_historial(recurso_id, registrado_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_historial_orden
  ON public.tracking_historial(orden_id) WHERE orden_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_historial_lat_lng
  ON public.tracking_historial(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_tracking_historial_evento
  ON public.tracking_historial(evento, registrado_at DESC);

-- 2c. Última ubicación conocida
CREATE TABLE IF NOT EXISTS public.tracking_actual (
  recurso_id UUID PRIMARY KEY REFERENCES public.recursos(id),
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  velocidad NUMERIC(6,2),
  bearing NUMERIC(5,2),
  evento TEXT DEFAULT 'posicion',
  orden_id UUID REFERENCES public.logistics_orders(id),
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_actual_lat_lng
  ON public.tracking_actual(latitude, longitude);

-- 2d. Eventos de entrega
CREATE TABLE IF NOT EXISTS public.delivery_events (
  id BIGSERIAL PRIMARY KEY,
  orden_id UUID NOT NULL REFERENCES public.logistics_orders(id),
  recurso_id UUID NOT NULL REFERENCES public.recursos(id),
  evento TEXT NOT NULL CHECK (evento IN (
    'asignado', 'aceptado', 'rechazado',
    'inicio_ruta', 'llegada_origen', 'recogida',
    'en_transito', 'llegada_destino', 'entregado',
    'no_entregado', 'cancelado', 'pausa', 'reanudacion'
  )),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  notas TEXT,
  evidencia_url TEXT,
  metadata JSONB DEFAULT '{}',
  registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_orden
  ON public.delivery_events(orden_id, registrado_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_recurso
  ON public.delivery_events(recurso_id, registrado_at DESC);

-- 2e. Asignación recurso ↔ orden logística
ALTER TABLE public.logistics_orders
  ADD COLUMN IF NOT EXISTS recurso_id UUID REFERENCES public.recursos(id),
  ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_logistics_orders_recurso
  ON public.logistics_orders(recurso_id) WHERE recurso_id IS NOT NULL;

-- 2f. Vistas logísticas
CREATE OR REPLACE VIEW v_recursos_en_ruta AS
SELECT
  r.id AS recurso_id, r.nombre, r.tipo, r.placa, r.telefono, r.estado,
  ta.latitude, ta.longitude, ta.velocidad, ta.bearing,
  ta.evento AS ultimo_evento, ta.actualizado_at,
  lo.id AS orden_id, lo.destination_organization_name AS destino,
  lo.destination_address AS direccion_destino, lo.status AS estado_orden,
  t.code AS tenant_code, t.name AS tenant_name
FROM public.recursos r
JOIN public.tracking_actual ta ON ta.recurso_id = r.id
LEFT JOIN public.logistics_orders lo ON ta.orden_id = lo.id
JOIN public.tenants t ON r.tenant_id = t.id
WHERE r.estado = 'en_ruta' AND r.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_orden_timeline AS
SELECT
  de.orden_id, de.recurso_id, r.nombre AS recurso_nombre,
  de.evento, de.latitude, de.longitude, de.notas,
  de.evidencia_url, de.registrado_at
FROM public.delivery_events de
JOIN public.recursos r ON de.recurso_id = r.id
ORDER BY de.orden_id, de.registrado_at ASC;

CREATE OR REPLACE VIEW v_mapa_recursos AS
SELECT
  r.id, r.nombre, r.tipo, r.placa, r.estado,
  COALESCE(ta.latitude, r.latitude) AS latitud,
  COALESCE(ta.longitude, r.longitude) AS longitud,
  ta.velocidad, ta.bearing, ta.evento AS ultimo_evento,
  ta.actualizado_at, ta.orden_id,
  t.code AS tenant_code, t.name AS tenant_name
FROM public.recursos r
LEFT JOIN public.tracking_actual ta ON ta.recurso_id = r.id
JOIN public.tenants t ON r.tenant_id = t.id
WHERE r.deleted_at IS NULL
  AND (ta.latitude IS NOT NULL OR r.latitude IS NOT NULL);

-- 2g. GRANTs logística
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.recursos TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.tracking_historial TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE tracking_historial_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.tracking_actual TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.delivery_events TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE delivery_events_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_recursos_en_ruta TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_orden_timeline TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_recursos TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 3. REPARAR 008: Columnas de recursos + vista activa
-- ──────────────────────────────────────────────────────

ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS capacidad_kg NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidad_volumen_m3 NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_refrigerado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS zona_operativa VARCHAR(255);

CREATE OR REPLACE VIEW public.v_active_routes AS
SELECT
  rp.id AS route_plan_id, rp.tenant_id, rp.recurso_id,
  rp.plan_type, rp.status, rp.window_start, rp.window_end,
  r.nombre AS recurso_nombre, r.tipo AS recurso_tipo,
  r.placa AS recurso_placa, r.estado AS recurso_estado,
  completed_stops.completed, pending_stops.pending
FROM public.route_plans rp
LEFT JOIN public.recursos r ON r.id = rp.recurso_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS completed FROM public.route_stops WHERE route_plan_id = rp.id AND status = 'completed'
) completed_stops ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS pending FROM public.route_stops WHERE route_plan_id = rp.id AND status = 'pending'
) pending_stops ON TRUE
WHERE rp.status IN ('draft', 'optimized', 'in_progress');

-- GRANTs 008
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_actions TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_alerts TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_programs TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_deliveries TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutional_alerts TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordination_tasks TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plans TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_irat_municipal TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incidents_by_zone TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_program_coverage TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_active_routes TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 4. REPARAR 010: Geofencing, clustering, supervisión
-- ──────────────────────────────────────────────────────

-- 4a. Geofence zones (sin GEOMETRY — usa center_lat/center_lng + radius_m)
CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  zone_name   VARCHAR(200) NOT NULL,
  zone_type   VARCHAR(50)  NOT NULL DEFAULT 'delivery',
  center_lat  NUMERIC(10,7),
  center_lng  NUMERIC(10,7),
  radius_m    NUMERIC(10,2) DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_tenant ON public.geofence_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_coords ON public.geofence_zones(center_lat, center_lng);

-- 4b. Vista clusters incidentes (sin ST_MakePoint — solo lat/lng)
CREATE OR REPLACE VIEW public.v_incident_clusters AS
SELECT
  i.id, i.tenant_id, i.incident_type, i.severity, i.status,
  i.municipality_name, i.affected_population,
  i.latitude, i.longitude, i.created_at
FROM public.incidents i
WHERE i.deleted_at IS NULL
  AND i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL;

-- 4c. Vista supervisión operativa (depende de recursos)
CREATE OR REPLACE VIEW public.v_supervision_operativa AS
SELECT
  t.id AS tenant_id, t.code AS tenant_code, t.name AS tenant_name,
  (SELECT COUNT(*) FROM public.recursos r WHERE r.tenant_id = t.id AND r.estado = 'en_ruta' AND r.deleted_at IS NULL) AS recursos_en_ruta,
  (SELECT COUNT(*) FROM public.recursos r WHERE r.tenant_id = t.id AND r.estado = 'disponible' AND r.deleted_at IS NULL) AS recursos_disponibles,
  (SELECT COUNT(*) FROM public.logistics_orders lo WHERE lo.tenant_id = t.id AND lo.status = 'in_transit' AND lo.deleted_at IS NULL) AS entregas_en_curso,
  (SELECT COUNT(*) FROM public.logistics_orders lo WHERE lo.tenant_id = t.id AND lo.status = 'delivered' AND lo.deleted_at IS NULL AND lo.delivered_at >= NOW() - INTERVAL '24 hours') AS entregas_hoy,
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.status IN ('reportada','open') AND i.deleted_at IS NULL) AS incidencias_abiertas,
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.severity = 'critical' AND i.status NOT IN ('cerrada') AND i.deleted_at IS NULL) AS incidencias_criticas,
  (SELECT COUNT(*) FROM public.incidents i WHERE i.tenant_id = t.id AND i.deleted_at IS NULL AND i.sla_target_minutes IS NOT NULL AND i.first_response_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 60 > i.sla_target_minutes) AS sla_breached,
  (SELECT COUNT(*) FROM public.incident_alerts ia WHERE ia.tenant_id = t.id AND ia.is_acknowledged = FALSE) AS alertas_pendientes
FROM public.tenants t;

-- 4d. Vista velocidad promedio (depende de tracking_historial)
CREATE OR REPLACE VIEW public.v_resource_avg_speed AS
SELECT
  recurso_id, COUNT(*) AS total_points,
  AVG(velocidad) FILTER (WHERE velocidad > 0 AND velocidad < 120) AS avg_speed_kmh,
  MAX(registrado_at) AS last_tracked_at
FROM public.tracking_historial
WHERE registrado_at >= NOW() - INTERVAL '7 days'
GROUP BY recurso_id;

-- GRANTs 010
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_zones TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.geofence_events TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.geofence_events_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_scenarios TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_clusters TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_trends TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_incident_trends_daily TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_supervision_operativa TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_resource_avg_speed TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 5. REPARAR 011: Alert thresholds GRANT
-- ──────────────────────────────────────────────────────

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON alert_thresholds TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 6. REPARAR 012: VRP + spoilage GRANTs
-- ──────────────────────────────────────────────────────

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vrp_solutions TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vrp_vehicle_routes TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.spoilage_records TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_spoilage_summary TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- 7. REPARAR 013: Inventory imports GRANT
-- ──────────────────────────────────────────────────────

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.inventory_imports TO ' || CURRENT_USER; END $$;

-- ──────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ──────────────────────────────────────────────────────

DO $$
DECLARE
  tbl_count INT;
  view_count INT;
BEGIN
  SELECT COUNT(*) INTO tbl_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public';

  RAISE NOTICE 'Reparacion completada — % tablas, % vistas en schema public', tbl_count, view_count;
END $$;
