-- =============================================================================
-- AGRORED – Módulo de Instituciones Demandantes
-- Migración: 018_institution_module.sql
-- Tabla: institutions
-- Tipos cubiertos: educativas, hospitales, cárceles, comedores comunitarios,
--                  aeropuertos, bases militares, hogares de adultos mayores,
--                  albergues y otras.
-- =============================================================================

-- ─── Tabla principal de instituciones ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.institutions (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID          NOT NULL,           -- FK lógica → tenants(id)

    -- Clasificación
    institution_type    VARCHAR(30)   NOT NULL
        CHECK (institution_type IN (
            'educational',
            'hospital',
            'prison',
            'community_canteen',
            'airport',
            'military',
            'elderly_home',
            'shelter',
            'other'
        )),

    -- Identidad
    name                VARCHAR(255)  NOT NULL,
    contact_name        VARCHAR(255)  NOT NULL,
    contact_phone       VARCHAR(30)   NOT NULL,
    contact_email       VARCHAR(255)  NULL,
    municipality_name   VARCHAR(150)  NOT NULL,
    address             TEXT          NULL,

    -- Demanda
    beneficiary_count   INTEGER       NOT NULL DEFAULT 0
        CHECK (beneficiary_count >= 0),
    product_categories  TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],

    -- Geolocalización
    latitude            NUMERIC(10,7) NULL CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    longitude           NUMERIC(10,7) NULL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),

    -- Estado
    status              VARCHAR(30)   NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('pending_verification', 'active', 'inactive')),

    -- Observaciones
    notes               TEXT          NULL,
    metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,

    -- Auditoría
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ   NULL
);

-- ─── Unicidad: un mismo nombre de institución por tenant (ignora mayúsculas) ─

CREATE UNIQUE INDEX IF NOT EXISTS uq_institutions_tenant_name
    ON public.institutions (tenant_id, LOWER(name))
    WHERE deleted_at IS NULL;

-- ─── Índices operativos ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_institutions_tenant_id
    ON public.institutions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_institutions_status
    ON public.institutions (status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_institutions_type
    ON public.institutions (institution_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_institutions_municipality
    ON public.institutions (municipality_name)
    WHERE deleted_at IS NULL;

-- ─── Trigger: updated_at automático ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_institutions_updated_at'
          AND tgrelid = 'public.institutions'::regclass
    ) THEN
        CREATE TRIGGER trg_institutions_updated_at
            BEFORE UPDATE ON public.institutions
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

-- ─── Comentarios ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.institutions IS
    'Instituciones (educativas, hospitales, cárceles, comedores, aeropuertos, etc.) '
    'que demandan productos alimentarios dentro del ecosistema AgroRed.';

COMMENT ON COLUMN public.institutions.beneficiary_count IS
    'Número de personas beneficiadas diariamente por la institución.';

COMMENT ON COLUMN public.institutions.product_categories IS
    'Categorías de productos requeridos (ej: Frutas, Verduras, Lácteos).';
