-- 004_producer_stats.sql
-- Historical production statistics per producer
-- + v_mapa_productores view (required by analytics-service)

CREATE TABLE IF NOT EXISTS public.estadisticas_productor (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID          NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  tenant_id   UUID          NOT NULL REFERENCES public.tenants(id),
  cultivo     VARCHAR(100)  NOT NULL,
  temporada   VARCHAR(50)   NOT NULL,
  hectareas   NUMERIC(8,3)  NOT NULL DEFAULT 0,
  toneladas   NUMERIC(10,3) NOT NULL DEFAULT 0,
  ingresos    NUMERIC(14,2) NOT NULL DEFAULT 0,
  costos      NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_corte DATE          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estadisticas_producer_id
  ON public.estadisticas_productor (producer_id);

CREATE INDEX IF NOT EXISTS idx_estadisticas_fecha_corte
  ON public.estadisticas_productor (fecha_corte DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_estadisticas_producer_cultivo_temporada
  ON public.estadisticas_productor (producer_id, cultivo, temporada);

DROP VIEW IF EXISTS public.v_mapa_productores CASCADE;
CREATE VIEW public.v_mapa_productores AS
SELECT
  p.id,
  p.organization_name  AS nombre,
  p.producer_type      AS tipo,
  p.contact_name,
  p.contact_phone,
  p.product_categories,
  p.status,
  NULL::text           AS zona,
  NULL::text           AS comuna,
  p.municipality_name  AS municipio,
  NULL::text           AS departamento,
  p.longitude::text    AS longitud,
  p.latitude::text     AS latitud
FROM public.producers p
WHERE p.deleted_at IS NULL
  AND p.latitude  IS NOT NULL
  AND p.longitude IS NOT NULL;

DO $$ BEGIN EXECUTE 'GRANT SELECT ON public.v_mapa_productores TO ' || quote_ident(CURRENT_USER); END $$;
DO $$ BEGIN EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.estadisticas_productor TO ' || quote_ident(CURRENT_USER); END $$;
