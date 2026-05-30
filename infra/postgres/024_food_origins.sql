-- 024: Tabla food_origins para reemplazar localStorage en RescuesPage

CREATE TABLE IF NOT EXISTS public.food_origins (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES public.tenants(id),
  name              VARCHAR(255) NOT NULL,
  municipality_name VARCHAR(150) NOT NULL,
  address           TEXT         NULL,
  latitude          NUMERIC(9,6) NULL,
  longitude         NUMERIC(9,6) NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ  NULL
);

CREATE INDEX IF NOT EXISTS idx_food_origins_tenant
  ON public.food_origins (tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.rescues
  ADD COLUMN IF NOT EXISTS origin_id UUID NULL
    REFERENCES public.food_origins(id) ON DELETE SET NULL;

COMMENT ON TABLE  public.food_origins IS
  'Puntos de origen donde se recogen los alimentos rescatados (mercados, supermercados, fincas, etc.)';
COMMENT ON COLUMN public.rescues.origin_id IS
  'Origen registrado del alimento rescatado. Reemplaza el almacenamiento en localStorage del dashboard.';
