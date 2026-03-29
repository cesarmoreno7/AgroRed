-- ============================================================
-- GEOLOCALIZACIÓN: Productores, Ofertas y Comedores
-- Capas POINT sobre el modelo jerárquico existente
-- ============================================================

-- ============================================================
-- 1. AGREGAR GEOLOCALIZACIÓN A PRODUCTORES
-- ============================================================
ALTER TABLE producers ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);
ALTER TABLE producers ADD COLUMN IF NOT EXISTS zona_id INT REFERENCES zona(id);
ALTER TABLE producers ADD COLUMN IF NOT EXISTS comuna_id INT REFERENCES comuna(id);
ALTER TABLE producers ADD COLUMN IF NOT EXISTS municipio_id INT REFERENCES municipio(id);

CREATE INDEX IF NOT EXISTS idx_producers_geom ON producers USING GIST(geom);

-- ============================================================
-- 2. AGREGAR GEOLOCALIZACIÓN A OFERTAS
-- ============================================================
ALTER TABLE offers ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS punto_entrega TEXT;

CREATE INDEX IF NOT EXISTS idx_offers_geom ON offers USING GIST(geom);

-- ============================================================
-- 3. TABLA DE COMEDORES COMUNITARIOS/ESCOLARES
-- ============================================================
CREATE TABLE comedor (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('comunitario', 'escolar', 'universitario', 'empresarial', 'otro')),
    direccion TEXT NOT NULL,
    capacidad_diaria INT,              -- Personas que puede atender por día
    beneficiarios_actuales INT DEFAULT 0,
    horario_atencion TEXT,             -- ej: "Lunes a Viernes 11:00-14:00"
    responsable TEXT,
    telefono TEXT,
    zona_id INT REFERENCES zona(id),
    comuna_id INT REFERENCES comuna(id),
    municipio_id INT REFERENCES municipio(id),
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'temporal')),
    geom GEOMETRY(POINT, 4326) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comedor_geom ON comedor USING GIST(geom);
CREATE INDEX idx_comedor_tipo ON comedor(tipo);
CREATE INDEX idx_comedor_estado ON comedor(estado);

-- ============================================================
-- 4. TABLA DE RELACIÓN COMEDOR-PRODUCTOR (abastecimiento)
-- ============================================================
CREATE TABLE comedor_productor (
    id SERIAL PRIMARY KEY,
    comedor_id INT NOT NULL REFERENCES comedor(id),
    producer_id UUID NOT NULL REFERENCES producers(id),
    producto TEXT NOT NULL,
    frecuencia TEXT,                   -- diaria, semanal, quincenal
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. VISTA: Mapa de productores con ubicación geográfica
-- ============================================================
CREATE OR REPLACE VIEW v_mapa_productores AS
SELECT
    p.id,
    p.organization_name AS nombre,
    p.producer_type AS tipo,
    p.contact_name,
    p.contact_phone,
    p.product_categories,
    p.status,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    d.nombre AS departamento,
    ST_X(p.geom) AS longitud,
    ST_Y(p.geom) AS latitud,
    p.geom
FROM producers p
LEFT JOIN zona z ON p.zona_id = z.id
LEFT JOIN comuna c ON p.comuna_id = c.id
LEFT JOIN municipio m ON p.municipio_id = m.id
LEFT JOIN departamento d ON m.departamento_id = d.id
WHERE p.geom IS NOT NULL AND p.deleted_at IS NULL;

-- ============================================================
-- 6. VISTA: Mapa de ofertas activas geolocalizadas
-- ============================================================
CREATE OR REPLACE VIEW v_mapa_ofertas AS
SELECT
    o.id,
    o.title,
    o.product_name,
    o.category,
    o.quantity_available,
    o.unit,
    o.price_amount,
    o.currency,
    o.available_from,
    o.available_until,
    o.punto_entrega,
    o.status,
    pr.organization_name AS productor,
    pr.contact_phone,
    ST_X(COALESCE(o.geom, pr.geom)) AS longitud,
    ST_Y(COALESCE(o.geom, pr.geom)) AS latitud,
    COALESCE(o.geom, pr.geom) AS geom
FROM offers o
JOIN producers pr ON o.producer_id = pr.id
WHERE o.status = 'published'
  AND o.deleted_at IS NULL
  AND (o.geom IS NOT NULL OR pr.geom IS NOT NULL);

-- ============================================================
-- 7. VISTA: Mapa de comedores comunitarios/escolares
-- ============================================================
CREATE OR REPLACE VIEW v_mapa_comedores AS
SELECT
    co.id,
    co.nombre,
    co.tipo,
    co.direccion,
    co.capacidad_diaria,
    co.beneficiarios_actuales,
    co.horario_atencion,
    co.responsable,
    co.telefono,
    co.estado,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    d.nombre AS departamento,
    ST_X(co.geom) AS longitud,
    ST_Y(co.geom) AS latitud,
    co.geom
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN comuna c ON co.comuna_id = c.id
LEFT JOIN municipio m ON co.municipio_id = m.id
LEFT JOIN departamento d ON m.departamento_id = d.id
WHERE co.estado = 'activo';

-- ============================================================
-- 8. VISTA: Productores cercanos a un comedor (radio 10km)
-- ============================================================
CREATE OR REPLACE VIEW v_comedores_productores_cercanos AS
SELECT
    co.id AS comedor_id,
    co.nombre AS comedor,
    co.tipo AS tipo_comedor,
    pr.id AS productor_id,
    pr.organization_name AS productor,
    pr.product_categories,
    ROUND(ST_Distance(
        ST_Transform(co.geom, 3116),
        ST_Transform(pr.geom, 3116)
    )::numeric, 0) AS distancia_metros,
    co.geom AS comedor_geom,
    pr.geom AS productor_geom
FROM comedor co, producers pr
WHERE co.estado = 'activo'
  AND pr.deleted_at IS NULL
  AND pr.geom IS NOT NULL
  AND ST_DWithin(
        ST_Transform(co.geom, 3116),
        ST_Transform(pr.geom, 3116),
        10000  -- 10 km de radio
    );
