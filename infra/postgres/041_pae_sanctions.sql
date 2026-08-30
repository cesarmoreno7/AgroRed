-- ============================================================
-- 041_pae_sanctions.sql
-- Capa de supervisión del PAE — Fase 6: sanciones al operador.
--
-- Modelo legal: la Gobernación NO sanciona al operador (no es su
-- contratista). Puede PROPONER / REQUERIR la sanción; solo la
-- alcaldía (dueña del contrato, tenant_id = pae_operators.tenant_id)
-- puede pasarla a 'aplicada'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pae_sanctions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id             UUID NOT NULL REFERENCES public.pae_operators(id),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id),   -- alcaldía que aplica
  requerimiento_id        UUID REFERENCES public.pae_requerimientos(id),
  sanction_type           VARCHAR(20) NOT NULL
                          CHECK (sanction_type IN ('amonestacion','multa','caducidad')),
  amount                  NUMERIC(14,2),
  currency                VARCHAR(3) NOT NULL DEFAULT 'COP',
  status                  VARCHAR(20) NOT NULL DEFAULT 'propuesta'
                          CHECK (status IN ('propuesta','requerida','aplicada','en_firme','archivada')),
  requested_by_tenant_id  UUID REFERENCES public.tenants(id),            -- Gobernación (si la exigió)
  requested_by_user       VARCHAR(64),
  applied_by_user         VARCHAR(64),
  justification           TEXT NOT NULL,
  resolution_doc_url      TEXT,
  requested_at            TIMESTAMPTZ,
  applied_at              TIMESTAMPTZ,
  firm_at                 TIMESTAMPTZ,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pae_sanctions_operator ON public.pae_sanctions (operator_id);
CREATE INDEX IF NOT EXISTS idx_pae_sanctions_tenant_status ON public.pae_sanctions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pae_sanctions_requerimiento ON public.pae_sanctions (requerimiento_id);

COMMENT ON TABLE public.pae_sanctions IS
  'Sanción de la alcaldía al operador del PAE. La Gobernación propone/requiere (status=requerida); '
  'solo admin_municipal del tenant contratante pasa a status=aplicada.';

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_sanctions TO ' || quote_ident(CURRENT_USER);
END $$;
