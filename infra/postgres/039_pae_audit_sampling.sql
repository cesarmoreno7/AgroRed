-- ============================================================
-- 039_pae_audit_sampling.sql
-- Capa de supervisión del PAE — Fase 3: bitácora de muestreo de
-- auditorías aleatorias de la Gobernación. (Las auditorías en sí
-- son filas de pae_inspections con inspection_kind='auditoria_aleatoria'
-- y status='programada' hasta que el equipo técnico las diligencia.)
-- El sweep de requerimientos vencidos no necesita tabla nueva.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pae_audit_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sampled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_count        INT NOT NULL DEFAULT 0,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pae_audit_runs_supervisor
  ON public.pae_audit_runs (supervisor_tenant_id, sampled_at DESC);

COMMENT ON TABLE public.pae_audit_runs IS
  'Bitácora de cada corrida del muestreo aleatorio de auditorías de la Gobernación.';

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_audit_runs TO ' || quote_ident(CURRENT_USER);
END $$;
