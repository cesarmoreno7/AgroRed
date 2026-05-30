-- 019: Agrega created_by a institutions para trazabilidad del registrador

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS created_by UUID NULL
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_institutions_created_by
  ON public.institutions (created_by)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.institutions.created_by IS
  'ID del usuario que registró la institución. NULL si fue importado o el usuario fue eliminado.';
