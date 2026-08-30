-- ============================================================
-- 036_pae_oversight_foundation.sql
-- Capa de supervisión del PAE — Fase 0: fundación del actor
-- "Gobernación" (supervisor departamental) sobre varios municipios.
--
-- Hoy `tenants` es plano y el cross-tenant es todo-o-nada (solo
-- SUPERADMIN). Esta tabla vincula un tenant supervisor (p. ej. la
-- Gobernación de Antioquia) con los tenants municipio que vigila,
-- SIN tocar la tabla `tenants`. El gateway expande esta relación a
-- una lista de UUIDs y la reenvía en `x-oversight-tenant-ids`.
--
-- Sirve también para "interventoría externa contratada por el
-- municipio X" (oversight_type = 'interventoria_externa').
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_oversight (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  child_tenant_id      UUID NOT NULL REFERENCES public.tenants(id),
  oversight_type       VARCHAR(40) NOT NULL DEFAULT 'pae_field_control',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_oversight UNIQUE (supervisor_tenant_id, child_tenant_id, oversight_type),
  CONSTRAINT chk_tenant_oversight_not_self CHECK (supervisor_tenant_id <> child_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_oversight_supervisor
  ON public.tenant_oversight (supervisor_tenant_id, oversight_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_tenant_oversight_child
  ON public.tenant_oversight (child_tenant_id);

COMMENT ON TABLE public.tenant_oversight IS
  'Vincula un tenant supervisor (Gobernación / interventoría externa) con los tenants '
  'municipio que vigila. El gateway lo expande a x-oversight-tenant-ids. No reemplaza el '
  'aislamiento por tenant: solo habilita lectura y ciertas escrituras sobre la lista.';

-- ── Seed: la Gobernación de Antioquia supervisa todos los municipios ──
-- El tenant 'departamento' ANTIOQUIA se siembra en 028_superadmin_role.sql.
INSERT INTO public.tenant_oversight (supervisor_tenant_id, child_tenant_id, oversight_type)
SELECT dep.id, mun.id, 'pae_field_control'
FROM public.tenants dep
CROSS JOIN public.tenants mun
WHERE dep.code = 'ANTIOQUIA'
  AND mun.type = 'municipio'
  AND mun.id <> dep.id
ON CONFLICT ON CONSTRAINT uq_tenant_oversight DO NOTHING;

-- ── Seed: usuario supervisor departamental de la Gobernación ──
-- Password inicial: Gobernacion2026!  (cambiar en producción)
INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, metadata)
SELECT
  gen_random_uuid(),
  dep.id,
  'supervisor.pae@antioquia.gov.co',
  'Supervisor PAE - Gobernación de Antioquia',
  'supervisor_departamental',
  'active',
  crypt('Gobernacion2026!', gen_salt('bf')),
  '{"created_by": "migration_036", "purpose": "Supervisión departamental del PAE"}'::jsonb
FROM public.tenants dep
WHERE dep.code = 'ANTIOQUIA'
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'supervisor.pae@antioquia.gov.co');

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_oversight TO ' || quote_ident(CURRENT_USER);
END $$;
