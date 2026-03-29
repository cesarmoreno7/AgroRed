-- ============================================================
-- 004_logistics_tracking.sql
-- Real-time GPS tracking for logistics: resources, tracking
-- history, current positions, delivery events, and coverage zones
-- ============================================================

-- ── 1. Recursos logísticos (vehículos, domiciliarios) ──

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
  geom GEOMETRY(POINT, 4326),
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
CREATE INDEX IF NOT EXISTS idx_recursos_geom ON public.recursos USING GIST(geom) WHERE geom IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recursos_user ON public.recursos(user_id) WHERE user_id IS NOT NULL;

-- ── 2. Historial de tracking GPS ──

CREATE TABLE IF NOT EXISTS public.tracking_historial (
  id BIGSERIAL PRIMARY KEY,
  recurso_id UUID NOT NULL REFERENCES public.recursos(id),
  orden_id UUID REFERENCES public.logistics_orders(id),
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  geom GEOMETRY(POINT, 4326) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_tracking_historial_geom
  ON public.tracking_historial USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_tracking_historial_evento
  ON public.tracking_historial(evento, registrado_at DESC);

-- ── 3. Última ubicación conocida (upsert rápido) ──

CREATE TABLE IF NOT EXISTS public.tracking_actual (
  recurso_id UUID PRIMARY KEY REFERENCES public.recursos(id),
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  velocidad NUMERIC(6,2),
  bearing NUMERIC(5,2),
  evento TEXT DEFAULT 'posicion',
  orden_id UUID REFERENCES public.logistics_orders(id),
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_actual_geom
  ON public.tracking_actual USING GIST(geom);

-- ── 4. Eventos de entrega (lifecycle de una orden logística) ──

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
  geom GEOMETRY(POINT, 4326),
  notas TEXT,
  evidencia_url TEXT,
  metadata JSONB DEFAULT '{}',
  registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_orden
  ON public.delivery_events(orden_id, registrado_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_recurso
  ON public.delivery_events(recurso_id, registrado_at DESC);

-- ── 5. Asignación recurso ↔ orden logística ──

ALTER TABLE public.logistics_orders
  ADD COLUMN IF NOT EXISTS recurso_id UUID REFERENCES public.recursos(id),
  ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_logistics_orders_recurso
  ON public.logistics_orders(recurso_id) WHERE recurso_id IS NOT NULL;

-- ── 6. Vista: Recursos en ruta con posición actual ──

CREATE OR REPLACE VIEW v_recursos_en_ruta AS
SELECT
  r.id AS recurso_id,
  r.nombre,
  r.tipo,
  r.placa,
  r.telefono,
  r.estado,
  ta.latitude,
  ta.longitude,
  ta.velocidad,
  ta.bearing,
  ta.evento AS ultimo_evento,
  ta.actualizado_at,
  lo.id AS orden_id,
  lo.destination_organization_name AS destino,
  lo.destination_address AS direccion_destino,
  lo.status AS estado_orden,
  t.code AS tenant_code,
  t.name AS tenant_name
FROM public.recursos r
JOIN public.tracking_actual ta ON ta.recurso_id = r.id
LEFT JOIN public.logistics_orders lo ON ta.orden_id = lo.id
JOIN public.tenants t ON r.tenant_id = t.id
WHERE r.estado = 'en_ruta'
  AND r.deleted_at IS NULL;

-- ── 7. Vista: Timeline de una orden logística ──

CREATE OR REPLACE VIEW v_orden_timeline AS
SELECT
  de.orden_id,
  de.recurso_id,
  r.nombre AS recurso_nombre,
  de.evento,
  de.latitude,
  de.longitude,
  de.notas,
  de.evidencia_url,
  de.registrado_at
FROM public.delivery_events de
JOIN public.recursos r ON de.recurso_id = r.id
ORDER BY de.orden_id, de.registrado_at ASC;

-- ── 8. Vista: Mapa de recursos (GeoJSON-ready) ──

CREATE OR REPLACE VIEW v_mapa_recursos AS
SELECT
  r.id,
  r.nombre,
  r.tipo,
  r.placa,
  r.estado,
  COALESCE(ta.latitude, r.latitude) AS latitud,
  COALESCE(ta.longitude, r.longitude) AS longitud,
  ta.velocidad,
  ta.bearing,
  ta.evento AS ultimo_evento,
  ta.actualizado_at,
  ta.orden_id,
  t.code AS tenant_code,
  t.name AS tenant_name
FROM public.recursos r
LEFT JOIN public.tracking_actual ta ON ta.recurso_id = r.id
JOIN public.tenants t ON r.tenant_id = t.id
WHERE r.deleted_at IS NULL
  AND (ta.latitude IS NOT NULL OR r.latitude IS NOT NULL);

-- ── Grants ──

DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.recursos TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE recursos_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.tracking_historial TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE tracking_historial_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.tracking_actual TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT ON public.delivery_events TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE delivery_events_id_seq TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_recursos_en_ruta TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_orden_timeline TO ' || CURRENT_USER; END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT ON v_mapa_recursos TO ' || CURRENT_USER; END $$;
