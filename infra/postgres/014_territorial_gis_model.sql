-- 014_territorial_gis_model.sql
-- SKIPPED: This migration requires PostGIS (GEOMETRY types, ST_Centroid, GIST indexes)
-- and a territorial hierarchy (municipio/zona/comedor tables) that are not part of
-- the current deployment. The project uses lat/lon NUMERIC columns + Haversine instead.
-- Re-enable only after installing PostGIS and applying the territorial base schema.
SELECT 1;
