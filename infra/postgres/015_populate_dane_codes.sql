-- 015_populate_dane_codes.sql
-- SKIPPED: depends on territorial hierarchy tables (departamento/municipio/zona/etc.)
-- created by create_hierarchy.sql which requires PostGIS GEOMETRY columns.
-- Those tables are not part of the current deployment since 014_territorial_gis_model.sql
-- was also skipped (PostGIS not enabled). Re-enable after PostGIS + territorial schema.
SELECT 1;
