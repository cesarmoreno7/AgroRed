-- 016_railway_spatial_setup.sql
-- SKIPPED: territorial hierarchy tables (pais/departamento/municipio/zona/etc.)
-- already exist in this database from a prior session, created with GEOMETRY columns.
-- The GIN indexes on JSONB geom cannot be applied to existing GEOMETRY columns.
-- To re-apply: drop the territorial tables and re-run migrate.
SELECT 1;
