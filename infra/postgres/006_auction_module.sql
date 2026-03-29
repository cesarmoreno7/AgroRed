-- =============================================================================
-- AGRORED – Módulo de Subastas Agrícolas (Gestión de Excedentes Alimentarios)
-- Migración: 006_auction_module.sql
-- Tablas: auctions, auction_bids, auction_audit_log
-- =============================================================================

-- ─── Tabla principal de subastas ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auctions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,  -- FK lógica → tenants(id)
    producer_id     UUID NOT NULL,  -- FK lógica → producers(id)

    -- Producto
    product_name        VARCHAR(200) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    unit                VARCHAR(20)  NOT NULL DEFAULT 'kg',
    quantity_kg         NUMERIC(12,2) NOT NULL CHECK (quantity_kg > 0),
    photo_url           TEXT,
    harvest_date        TIMESTAMPTZ NOT NULL,
    shelf_life_hours    INTEGER NOT NULL CHECK (shelf_life_hours > 0),

    -- Tipo y precios
    auction_type        VARCHAR(20)  NOT NULL CHECK (auction_type IN ('ascending', 'dutch')),
    base_price          NUMERIC(14,2) NOT NULL CHECK (base_price > 0),
    reserve_price       NUMERIC(14,2) NOT NULL CHECK (reserve_price >= 0),
    currency            CHAR(3)      NOT NULL DEFAULT 'COP',

    -- Temporización
    duration_minutes    INTEGER NOT NULL CHECK (duration_minutes BETWEEN 120 AND 1440),
    starts_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at             TIMESTAMPTZ NOT NULL,
    current_price       NUMERIC(14,2) NOT NULL,

    -- Visibilidad segmentada
    visibility_phase        VARCHAR(20) NOT NULL DEFAULT 'phase_1'
        CHECK (visibility_phase IN ('phase_1', 'phase_2', 'phase_3', 'urgent')),
    visibility_radius_km    INTEGER NOT NULL DEFAULT 50,

    -- Ubicación del productor
    latitude            NUMERIC(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude           NUMERIC(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    municipality_name   VARCHAR(200) NOT NULL,

    -- Anti-Sniping / Cierre suave
    extension_count     INTEGER NOT NULL DEFAULT 0 CHECK (extension_count >= 0),
    max_extensions      INTEGER NOT NULL DEFAULT 5 CHECK (max_extensions >= 0),

    -- Holandesa
    dutch_step_percent  NUMERIC(5,2) CHECK (dutch_step_percent IS NULL OR dutch_step_percent BETWEEN 1 AND 50),
    dutch_step_minutes  INTEGER CHECK (dutch_step_minutes IS NULL OR dutch_step_minutes BETWEEN 1 AND 60),

    -- Resultado
    winner_id           UUID,  -- FK lógica → users(id)
    winner_price        NUMERIC(14,2),

    -- Estado y auditoría
    status              VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft','active','extended','closed_with_winner','closed_no_winner','cancelled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_tenant ON public.auctions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_producer ON public.auctions(producer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_ends_at ON public.auctions(ends_at) WHERE status IN ('active','extended') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_coords ON public.auctions(latitude, longitude) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_municipality ON public.auctions(municipality_name) WHERE deleted_at IS NULL;

-- ─── Tabla de pujas ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auction_bids (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id      UUID NOT NULL REFERENCES public.auctions(id),
    bidder_id       UUID NOT NULL,  -- FK lógica → users(id)

    bidder_type     VARCHAR(50) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    max_proxy_amount NUMERIC(14,2) CHECK (max_proxy_amount IS NULL OR max_proxy_amount > 0),
    is_proxy        BOOLEAN NOT NULL DEFAULT FALSE,
    social_score    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (social_score BETWEEN 0 AND 100),

    -- Ubicación del comprador (para Smart Match)
    distance_km     NUMERIC(10,2),
    latitude        NUMERIC(10,7) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude       NUMERIC(10,7) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),

    status          VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','outbid','winner','rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction ON public.auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON public.auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction_amount ON public.auction_bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_proxy ON public.auction_bids(auction_id) WHERE max_proxy_amount IS NOT NULL;

-- ─── Tabla de log de auditoría de subastas ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auction_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id      UUID NOT NULL REFERENCES public.auctions(id),
    event_type      VARCHAR(50) NOT NULL,
    actor_id        UUID,
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_auction ON public.auction_audit_log(auction_id);
CREATE INDEX IF NOT EXISTS idx_audit_event ON public.auction_audit_log(event_type);

-- ─── Vista: Mapa de subastas activas ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_mapa_subastas AS
SELECT
    a.id,
    a.tenant_id,
    t.name AS tenant_name,
    a.producer_id,
    a.product_name,
    a.category,
    a.quantity_kg,
    a.auction_type,
    a.base_price,
    a.current_price,
    a.currency,
    a.starts_at,
    a.ends_at,
    a.visibility_phase,
    a.visibility_radius_km,
    a.latitude,
    a.longitude,
    a.municipality_name,
    a.status,
    a.extension_count,
    (SELECT COUNT(*) FROM public.auction_bids b WHERE b.auction_id = a.id) AS total_bids,
    EXTRACT(EPOCH FROM (a.ends_at - NOW())) / 60 AS remaining_minutes
FROM public.auctions a
JOIN public.tenants t ON a.tenant_id = t.id
WHERE a.deleted_at IS NULL
  AND a.status IN ('active', 'extended');

-- ─── Vista: Resumen de subastas cerradas por municipio ───────────────────────

CREATE OR REPLACE VIEW public.v_resumen_subastas_municipio AS
SELECT
    a.municipality_name,
    a.tenant_id,
    COUNT(*) AS total_subastas,
    COUNT(*) FILTER (WHERE a.status = 'closed_with_winner') AS con_ganador,
    COUNT(*) FILTER (WHERE a.status = 'closed_no_winner') AS sin_ganador,
    ROUND(AVG(a.winner_price) FILTER (WHERE a.winner_price IS NOT NULL), 2) AS precio_promedio,
    ROUND(SUM(a.quantity_kg) FILTER (WHERE a.status = 'closed_with_winner'), 2) AS kg_transaccionados,
    ROUND(
        COUNT(*) FILTER (WHERE a.status = 'closed_with_winner')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
    ) AS tasa_exito_pct
FROM public.auctions a
WHERE a.deleted_at IS NULL
  AND a.status IN ('closed_with_winner', 'closed_no_winner')
GROUP BY a.municipality_name, a.tenant_id;

-- ─── Trigger para updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_auction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auctions_updated_at ON public.auctions;
CREATE TRIGGER trg_auctions_updated_at
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_auction_updated_at();
