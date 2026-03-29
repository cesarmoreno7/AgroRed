-- ============================================================
-- 003_map_spatial_support.sql
-- Spatial indexes and GeoJSON helper functions for map API
-- ============================================================

-- ── Spatial indexes on lat/lon columns for bbox filtering ──

CREATE INDEX IF NOT EXISTS idx_producers_lat_lng
  ON public.producers (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_offers_lat_lng
  ON public.offers (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rescues_lat_lng
  ON public.rescues (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_demands_lat_lng
  ON public.demands (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng
  ON public.incidents (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_lat_lng
  ON public.inventory_items (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_origin_lat_lng
  ON public.logistics_orders (origin_latitude, origin_longitude)
  WHERE origin_latitude IS NOT NULL AND origin_longitude IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_dest_lat_lng
  ON public.logistics_orders (destination_latitude, destination_longitude)
  WHERE destination_latitude IS NOT NULL AND destination_longitude IS NOT NULL AND deleted_at IS NULL;

-- ── View: Rescues map layer ──

CREATE OR REPLACE VIEW v_mapa_rescates AS
SELECT
  r.id,
  r.product_name,
  r.quantity_rescued,
  r.unit,
  r.status,
  r.scheduled_at,
  r.latitude,
  r.longitude,
  t.code  AS tenant_code,
  t.name  AS tenant_name
FROM rescues r
JOIN tenants t ON r.tenant_id = t.id
WHERE r.deleted_at IS NULL
  AND r.latitude IS NOT NULL
  AND r.longitude IS NOT NULL;

-- ── View: Incidents map layer ──

CREATE OR REPLACE VIEW v_mapa_incidentes AS
SELECT
  i.id,
  i.title,
  i.incident_type,
  i.severity,
  i.status,
  i.created_at AS reported_at,
  i.latitude,
  i.longitude,
  t.code  AS tenant_code,
  t.name  AS tenant_name
FROM incidents i
JOIN tenants t ON i.tenant_id = t.id
WHERE i.deleted_at IS NULL
  AND i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL;

-- ── View: Demands map layer ──

CREATE OR REPLACE VIEW v_mapa_demandas AS
SELECT
  d.id,
  d.product_name,
  d.quantity_required,
  d.unit,
  d.status,
  d.needed_by,
  d.latitude,
  d.longitude,
  t.code  AS tenant_code,
  t.name  AS tenant_name
FROM demands d
JOIN tenants t ON d.tenant_id = t.id
WHERE d.deleted_at IS NULL
  AND d.latitude IS NOT NULL
  AND d.longitude IS NOT NULL;

-- ── View: Complete supply chain map (all entity types on one query) ──

CREATE OR REPLACE VIEW v_mapa_cadena_completa AS
SELECT
  'producer'::text AS entity_type,
  p.id::text AS entity_id,
  p.organization_name AS label,
  p.status,
  p.latitude,
  p.longitude,
  p.municipality_name AS municipio,
  p.created_at
FROM producers p
WHERE p.deleted_at IS NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL

UNION ALL

SELECT
  'offer'::text AS entity_type,
  o.id::text AS entity_id,
  o.title AS label,
  o.status,
  o.latitude,
  o.longitude,
  NULL AS municipio,
  o.created_at
FROM offers o
WHERE o.deleted_at IS NULL AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL

UNION ALL

SELECT
  'rescue'::text AS entity_type,
  r.id::text AS entity_id,
  r.product_name AS label,
  r.status,
  r.latitude,
  r.longitude,
  NULL AS municipio,
  r.created_at
FROM rescues r
WHERE r.deleted_at IS NULL AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL

UNION ALL

SELECT
  'demand'::text AS entity_type,
  d.id::text AS entity_id,
  d.product_name AS label,
  d.status,
  d.latitude,
  d.longitude,
  NULL AS municipio,
  d.created_at
FROM demands d
WHERE d.deleted_at IS NULL AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL

UNION ALL

SELECT
  'incident'::text AS entity_type,
  i.id::text AS entity_id,
  i.title AS label,
  i.status,
  i.latitude,
  i.longitude,
  NULL AS municipio,
  i.created_at
FROM incidents i
WHERE i.deleted_at IS NULL AND i.latitude IS NOT NULL AND i.longitude IS NOT NULL;

-- ── Grant permissions to application user ──

GRANT SELECT ON v_mapa_rescates TO "777";
GRANT SELECT ON v_mapa_incidentes TO "777";
GRANT SELECT ON v_mapa_demandas TO "777";
GRANT SELECT ON v_mapa_cadena_completa TO "777";
