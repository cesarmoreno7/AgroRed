-- 023: Agrega last_zone_ids a tracking_actual para detectar enter/exit de geocercas

ALTER TABLE public.tracking_actual
  ADD COLUMN IF NOT EXISTS last_zone_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tracking_actual.last_zone_ids IS
  'IDs de las geocercas en las que estaba el recurso en la última posición conocida. Permite detectar enter/exit.';
