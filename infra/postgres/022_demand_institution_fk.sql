-- 022: Liga demands con institutions para conectar canal ↔ institución

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS institution_id UUID NULL
    REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demands_institution_id
  ON public.demands (institution_id)
  WHERE institution_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.demands.institution_id IS
  'Institución que genera la demanda. NULL cuando la demanda viene de un canal genérico sin institución registrada.';
