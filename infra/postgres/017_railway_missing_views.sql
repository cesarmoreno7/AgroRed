-- =========================================================
-- 017_railway_missing_views.sql
-- Vistas de mapa y función haversine para Railway (sin PostGIS)
-- =========================================================

BEGIN;

-- Haversine function for nearby queries (km)
CREATE OR REPLACE FUNCTION haversine_km(lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC)
RETURNS NUMERIC AS $$
  SELECT 2 * 6371 * ASIN(SQRT(
    POWER(SIN(RADIANS((lat2 - lat1) / 2)), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS((lon2 - lon1) / 2)), 2)
  ));
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- v_mapa_productores (Railway: uses latitude/longitude, joins territorial tables)
CREATE OR REPLACE VIEW v_mapa_productores AS
SELECT p.id,
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
    p.longitude::text AS longitud,
    p.latitude::text AS latitud
FROM producers p
LEFT JOIN zona z ON p.zona_id = z.id
LEFT JOIN comuna c ON p.comuna_id = c.id
LEFT JOIN municipio m ON p.municipio_id = m.id
LEFT JOIN departamento d ON m.departamento_id = d.id
WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.deleted_at IS NULL;

-- v_mapa_ofertas (Railway: uses latitude/longitude)
CREATE OR REPLACE VIEW v_mapa_ofertas AS
SELECT o.id,
    o.title,
    o.product_name,
    o.category,
    o.quantity_available,
    o.unit,
    o.price_amount,
    o.currency,
    o.available_from,
    o.available_until,
    NULL::text AS punto_entrega,
    o.status,
    pr.organization_name AS productor,
    pr.contact_phone,
    COALESCE(o.longitude, pr.longitude)::text AS longitud,
    COALESCE(o.latitude, pr.latitude)::text AS latitud
FROM offers o
JOIN producers pr ON o.producer_id = pr.id
WHERE o.status = 'published' AND o.deleted_at IS NULL
  AND (o.latitude IS NOT NULL OR pr.latitude IS NOT NULL);

-- v_mapa_comedores (Railway: uses latitud/longitud from comedor table)
CREATE OR REPLACE VIEW v_mapa_comedores AS
SELECT co.id,
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
    co.longitud::text AS longitud,
    co.latitud::text AS latitud
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN comuna c ON co.comuna_id = c.id
LEFT JOIN municipio m ON co.municipio_id = m.id
LEFT JOIN departamento d ON m.departamento_id = d.id
WHERE co.estado = 'activo';

COMMIT;
