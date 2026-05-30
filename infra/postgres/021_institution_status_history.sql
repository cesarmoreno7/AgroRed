-- 021: Auditoría de cambios de estado en instituciones

CREATE TABLE IF NOT EXISTS public.institution_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  old_status      VARCHAR(30) NOT NULL,
  new_status      VARCHAR(30) NOT NULL,
  changed_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reason          TEXT        NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inst_status_history_institution
  ON public.institution_status_history (institution_id, changed_at DESC);

COMMENT ON TABLE public.institution_status_history IS
  'Registro inmutable de cada cambio de estado de una institución: quién lo hizo, cuándo y por qué.';
