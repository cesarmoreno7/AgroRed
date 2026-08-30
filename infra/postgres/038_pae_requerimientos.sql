-- ============================================================
-- 038_pae_requerimientos.sql
-- Capa de supervisión del PAE — Fase 2: cadena de escalamiento.
--
-- Una inspección 'no_conforme' (o un reporte CAE, Fase 4) genera un
-- REQUERIMIENTO formal a la alcaldía (tenant_id = municipio). El
-- glue crea además una institutional_alert (→ notifyTenantAdmins →
-- notifications) y una coordination_task (actor_type='alcaldia').
-- El sweep de vencidos (Fase 3) sube escalation_level.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pae_requerimientos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id),        -- municipio requerido (la alcaldía que debe actuar)
  source_type            VARCHAR(20) NOT NULL
                         CHECK (source_type IN ('inspection','cae_report','audit','overdue_sweep','manual')),
  inspection_id          UUID REFERENCES public.pae_inspections(id),
  cae_report_id          UUID,                                              -- FK se agrega en 040_pae_cae.sql
  operator_id            UUID REFERENCES public.pae_operators(id),
  title                  VARCHAR(255) NOT NULL,
  description            TEXT NOT NULL,
  legal_basis            VARCHAR(255),
  severity               VARCHAR(20) NOT NULL DEFAULT 'high'
                         CHECK (severity IN ('low','medium','high','critical')),
  status                 VARCHAR(30) NOT NULL DEFAULT 'abierto'
                         CHECK (status IN ('abierto','notificado','en_respuesta','subsanado','incumplido','escalado_sancion','archivado')),
  escalation_level       INT NOT NULL DEFAULT 0,
  sla_hours              INT NOT NULL DEFAULT 72,
  due_date               TIMESTAMPTZ NOT NULL,
  first_notified_at      TIMESTAMPTZ,
  responded_at           TIMESTAMPTZ,
  response_notes         TEXT,
  closed_at              TIMESTAMPTZ,
  institutional_alert_id UUID REFERENCES public.institutional_alerts(id),
  coordination_task_id   UUID REFERENCES public.coordination_tasks(id),
  created_by_tenant_id   UUID REFERENCES public.tenants(id),                -- quién exige (ANTIOQUIA o el municipio si es interventoría)
  created_by_role        VARCHAR(40),
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un requerimiento por inspección (idempotencia del glue de escalamiento).
  CONSTRAINT uq_pae_requerimientos_inspection UNIQUE (inspection_id)
);

CREATE INDEX IF NOT EXISTS idx_pae_requerimientos_tenant_status
  ON public.pae_requerimientos (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pae_requerimientos_due
  ON public.pae_requerimientos (due_date)
  WHERE status IN ('abierto','notificado','en_respuesta');
CREATE INDEX IF NOT EXISTS idx_pae_requerimientos_operator
  ON public.pae_requerimientos (operator_id);

COMMENT ON TABLE public.pae_requerimientos IS
  'Requerimiento formal de la Gobernación (o interventoría) a la alcaldía para que actúe '
  'sobre un incumplimiento del operador PAE. tenant_id = municipio requerido.';

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_requerimientos TO ' || quote_ident(CURRENT_USER);
END $$;
