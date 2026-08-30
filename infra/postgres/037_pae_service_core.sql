-- ============================================================
-- 037_pae_service_core.sql
-- Capa de supervisión del PAE — Fase 1: operadores + inspecciones
-- de campo (interventoría diaria + auditorías aleatorias de la
-- Gobernación). Sin escalamiento todavía (Fase 2).
--
-- QC de campo (peso de porciones, cadena de frío, vencimientos,
-- higiene) no existía en ninguna tabla — esto es nuevo.
-- ============================================================

-- ── Operadores del PAE (empresa de alimentos con contrato del municipio) ──
CREATE TABLE IF NOT EXISTS public.pae_operators (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id),   -- municipio contratante
  legal_name          VARCHAR(255) NOT NULL,
  nit                 VARCHAR(30),
  legal_rep           VARCHAR(255),
  contract_number     VARCHAR(80),
  contract_starts_at  DATE,
  contract_ends_at    DATE,
  contact_name        VARCHAR(255),
  contact_email       VARCHAR(255),
  contact_phone       VARCHAR(30),
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','suspended','terminated')),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT uq_pae_operators_tenant_nit UNIQUE (tenant_id, nit)
);

CREATE INDEX IF NOT EXISTS idx_pae_operators_tenant ON public.pae_operators (tenant_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.pae_operators IS
  'Operadores del PAE (empresas de alimentos). El contrato lo firma el municipio (tenant_id); '
  'la Gobernación no contrata al operador, solo exige a la alcaldía que lo sancione.';

-- ── Inspecciones de campo ──
CREATE TABLE IF NOT EXISTS public.pae_inspections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id),   -- municipio inspeccionado
  operator_id              UUID REFERENCES public.pae_operators(id),
  institution_id           UUID REFERENCES public.institutions(id),       -- colegio / comedor
  food_program_id          UUID REFERENCES public.food_programs(id),      -- programa_escolar
  inspection_kind          VARCHAR(30) NOT NULL DEFAULT 'interventoria_diaria'
                           CHECK (inspection_kind IN ('interventoria_diaria','auditoria_aleatoria','cae_derivada')),
  inspector_role           VARCHAR(40),
  inspector_user_id        VARCHAR(64),
  inspector_tenant_id      UUID REFERENCES public.tenants(id),            -- quién inspecciona (municipio o ANTIOQUIA)
  inspected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_description      VARCHAR(255),
  latitude                 NUMERIC(9,6),
  longitude                NUMERIC(9,6),
  -- Datos estructurados de alto valor
  portion_weight_g         NUMERIC(8,2),
  portion_weight_expected_g NUMERIC(8,2),
  temperature_c            NUMERIC(5,2),
  cold_chain_ok            BOOLEAN,
  expiry_check_ok          BOOLEAN,
  earliest_expiry_date     DATE,
  hygiene_score            INT CHECK (hygiene_score IS NULL OR hygiene_score BETWEEN 0 AND 100),
  -- Respuestas completas del checklist + ítems que fallaron
  answers                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  failed_items             JSONB NOT NULL DEFAULT '[]'::jsonb,
  result                   VARCHAR(30) NOT NULL DEFAULT 'pendiente'
                           CHECK (result IN ('conforme','conforme_con_observaciones','no_conforme','pendiente')),
  status                   VARCHAR(20) NOT NULL DEFAULT 'completed'
                           CHECK (status IN ('programada','completed')),
  evidence_urls            TEXT[] NOT NULL DEFAULT '{}',
  notes                    TEXT,
  created_by               VARCHAR(64),
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pae_inspections_tenant_date ON public.pae_inspections (tenant_id, inspected_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pae_inspections_result ON public.pae_inspections (result);
CREATE INDEX IF NOT EXISTS idx_pae_inspections_operator ON public.pae_inspections (operator_id);
CREATE INDEX IF NOT EXISTS idx_pae_inspections_institution ON public.pae_inspections (institution_id);

COMMENT ON TABLE public.pae_inspections IS
  'Visita de interventoría (municipio) o auditoría aleatoria (Gobernación) a un colegio. '
  'result se calcula por auto-clasificación contra el checklist y las claves pae.* de alert_thresholds.';

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_operators   TO ' || quote_ident(CURRENT_USER);
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pae_inspections TO ' || quote_ident(CURRENT_USER);
END $$;
