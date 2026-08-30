-- ============================================================
-- 040_pae_cae.sql
-- Capa de supervisión del PAE — Fase 4: control social.
-- Comités de Alimentación Escolar (CAE) por colegio + reportes
-- ciudadanos vía formulario web público con token. Cada reporte
-- entra a la MISMA cadena de escalamiento (pae_requerimientos).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pae_cae_committees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id),
  institution_id UUID NOT NULL REFERENCES public.institutions(id),
  token          UUID NOT NULL DEFAULT gen_random_uuid(),
  committee_name VARCHAR(255),
  contact_email  VARCHAR(255),
  contact_phone  VARCHAR(30),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pae_cae_committees_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_pae_cae_committees_tenant ON public.pae_cae_committees (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pae_cae_committees_institution ON public.pae_cae_committees (institution_id);

CREATE TABLE IF NOT EXISTS public.pae_cae_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id    UUID NOT NULL REFERENCES public.pae_cae_committees(id),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  reporter_name   VARCHAR(255),
  reporter_role   VARCHAR(40),           -- rector | docente | padre_familia | estudiante | otro
  reporter_contact VARCHAR(120),
  category        VARCHAR(40) NOT NULL
                  CHECK (category IN ('gramaje','cadena_frio','vencimiento','higiene','inasistencia_entrega','otro')),
  description     TEXT NOT NULL,
  evidence_urls   TEXT[] NOT NULL DEFAULT '{}',
  occurred_on     DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'nuevo'
                  CHECK (status IN ('nuevo','triage','derivado','descartado')),
  requerimiento_id UUID REFERENCES public.pae_requerimientos(id),
  inspection_id   UUID REFERENCES public.pae_inspections(id),
  triaged_by      VARCHAR(64),
  triage_notes    TEXT,
  client_ip       INET,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pae_cae_reports_tenant_status ON public.pae_cae_reports (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pae_cae_reports_committee ON public.pae_cae_reports (committee_id);

-- FK diferida de 038: un requerimiento puede originarse en un reporte CAE.
ALTER TABLE public.pae_requerimientos
  DROP CONSTRAINT IF EXISTS fk_pae_requerimientos_cae_report;
ALTER TABLE public.pae_requerimientos
  ADD CONSTRAINT fk_pae_requerimientos_cae_report
  FOREIGN KEY (cae_report_id) REFERENCES public.pae_cae_reports(id);

-- Un requerimiento por reporte CAE (idempotencia del glue).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pae_requerimientos_cae_report
  ON public.pae_requerimientos (cae_report_id) WHERE cae_report_id IS NOT NULL;

COMMENT ON TABLE public.pae_cae_reports IS
  'Reporte ciudadano del Comité de Alimentación Escolar, recibido por formulario público '
  'tokenizado. status: nuevo → triage (verificado) → derivado (a requerimiento/inspección) | descartado.';

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_cae_committees TO ' || quote_ident(CURRENT_USER);
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_cae_reports    TO ' || quote_ident(CURRENT_USER);
END $$;
