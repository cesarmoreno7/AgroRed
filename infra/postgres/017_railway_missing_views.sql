-- 017_railway_missing_views.sql
-- Only the haversine function is applied here.
-- v_mapa_productores already exists from 004_producer_stats.sql with the correct schema.
-- v_mapa_ofertas and v_mapa_comedores depend on territorial JOIN columns (zona_id,
-- municipio_id) that are not present in this deployment (016 was skipped).

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 NUMERIC, lon1 NUMERIC,
  lat2 NUMERIC, lon2 NUMERIC
)
RETURNS NUMERIC AS $$
  SELECT 2 * 6371 * ASIN(SQRT(
    POWER(SIN(RADIANS((lat2 - lat1) / 2)), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS((lon2 - lon1) / 2)), 2)
  ));
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
