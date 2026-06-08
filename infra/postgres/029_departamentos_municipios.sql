-- ============================================================
-- 029_departamentos_municipios.sql
-- Cierra brechas detectadas al comparar migracion_completa.txt
-- con las migraciones existentes (014/015 SKIPPED, 027/028 activos).
--
-- Cambios:
--   1. Tabla public.departamentos (UUID, código DANE 2 dígitos)
--   2. Tabla public.municipios    (UUID, código DANE 5 dígitos)
--   3. Seed: 33 departamentos de Colombia
--   4. Seed: 8 municipios (más los ya referenciados en 027)
--   5. Seed: 3 veredas faltantes (El Hato, Las Granjas, La Pradera/Bello)
--   6. Rol PostgreSQL SUPERADMIN + permisos sobre tablas maestras
--
-- Esquema: UUID PKs + TEXT codes (consistente con 027_corregimientos_veredas)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TABLA: departamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departamentos (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  dane_code     TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB   NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_departamento_dane UNIQUE (dane_code)
);

CREATE INDEX IF NOT EXISTS idx_departamentos_dane   ON public.departamentos(dane_code);
CREATE INDEX IF NOT EXISTS idx_departamentos_name   ON public.departamentos(name);
CREATE INDEX IF NOT EXISTS idx_departamentos_active ON public.departamentos(is_active) WHERE is_active = TRUE;

-- ============================================================
-- 2. TABLA: municipios
-- ============================================================

CREATE TABLE IF NOT EXISTS public.municipios (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  dane_code       TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  department_code TEXT    NOT NULL,   -- FK lógico a departamentos.dane_code (2 dígitos)
  department_name TEXT    NOT NULL,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  population      INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB   NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_municipio_dane UNIQUE (dane_code)
);

CREATE INDEX IF NOT EXISTS idx_municipios_dane   ON public.municipios(dane_code);
CREATE INDEX IF NOT EXISTS idx_municipios_dept   ON public.municipios(department_code);
CREATE INDEX IF NOT EXISTS idx_municipios_name   ON public.municipios(name);
CREATE INDEX IF NOT EXISTS idx_municipios_active ON public.municipios(is_active) WHERE is_active = TRUE;

-- ============================================================
-- 3. SEED: 33 departamentos de Colombia
-- ============================================================

INSERT INTO public.departamentos (dane_code, name) VALUES
  ('05', 'Antioquia'),
  ('08', 'Atlántico'),
  ('11', 'Bogotá D.C.'),
  ('13', 'Bolívar'),
  ('15', 'Boyacá'),
  ('17', 'Caldas'),
  ('18', 'Caquetá'),
  ('19', 'Cauca'),
  ('20', 'Cesar'),
  ('23', 'Córdoba'),
  ('25', 'Cundinamarca'),
  ('27', 'Chocó'),
  ('41', 'Huila'),
  ('44', 'La Guajira'),
  ('47', 'Magdalena'),
  ('50', 'Meta'),
  ('52', 'Nariño'),
  ('54', 'Norte de Santander'),
  ('63', 'Quindío'),
  ('66', 'Risaralda'),
  ('68', 'Santander'),
  ('70', 'Sucre'),
  ('73', 'Tolima'),
  ('76', 'Valle del Cauca'),
  ('81', 'Arauca'),
  ('85', 'Casanare'),
  ('86', 'Putumayo'),
  ('88', 'San Andrés y Providencia'),
  ('91', 'Amazonas'),
  ('94', 'Guainía'),
  ('95', 'Guaviare'),
  ('97', 'Vaupés'),
  ('99', 'Vichada')
ON CONFLICT (dane_code) DO NOTHING;

-- ============================================================
-- 4. SEED: municipios (los 8 del plan + los ya referenciados en 027)
-- ============================================================

INSERT INTO public.municipios (dane_code, name, department_code, department_name, latitude, longitude, population) VALUES
  -- Antioquia
  ('05001', 'Medellín',           '05', 'Antioquia',        6.2442,  -75.5812, 2700000),
  ('05088', 'Bello',              '05', 'Antioquia',        6.3388,  -75.5581,  600000),
  ('05266', 'Envigado',           '05', 'Antioquia',        6.1721,  -75.5920,  230000),
  ('05576', 'Rionegro',           '05', 'Antioquia',        6.1550,  -75.3738,  120000),
  ('05664', 'Santa Rosa de Osos', '05', 'Antioquia',        6.6474,  -75.4606,   35000),
  ('05649', 'San Roque',          '05', 'Antioquia',        6.4783,  -74.9947,   18000),
  ('05002', 'Abejorral',          '05', 'Antioquia',        5.7954,  -75.4378,   19000),
  -- Bogotá D.C.
  ('11001', 'Bogotá D.C.',        '11', 'Bogotá D.C.',      4.7110,  -74.0721, 8000000),
  -- Valle del Cauca
  ('76001', 'Cali',               '76', 'Valle del Cauca',  3.4516,  -76.5320, 2300000),
  ('76823', 'Yumbo',              '76', 'Valle del Cauca',  3.5913,  -76.4953,  120000),
  -- Santander
  ('68001', 'Bucaramanga',        '68', 'Santander',        7.1193,  -73.1227,  600000),
  -- Bolívar
  ('13001', 'Cartagena',          '13', 'Bolívar',         10.3997,  -75.5144, 1000000),
  -- Atlántico
  ('08001', 'Barranquilla',       '08', 'Atlántico',       10.9639,  -74.7964, 1300000),
  -- Nariño
  ('52001', 'Pasto',              '52', 'Nariño',           1.2136,  -77.2811,  450000),
  -- Meta
  ('50001', 'Villavicencio',      '50', 'Meta',             4.1420,  -73.6266,  550000)
ON CONFLICT (dane_code) DO NOTHING;

-- ============================================================
-- 5. SEED: veredas faltantes detectadas en la comparación
--    (La Pradera/Bello, El Hato/Bello, Las Granjas/Envigado)
-- ============================================================

INSERT INTO public.veredas (name, municipality_code, municipality_name, department_code, latitude, longitude)
VALUES
  ('La Pradera', '05088', 'Bello',    '05',  6.3520, -75.5640),
  ('El Hato',    '05088', 'Bello',    '05',  6.3480, -75.5720),
  ('Las Granjas','05266', 'Envigado', '05',  6.1690, -75.5950)
ON CONFLICT (name, municipality_code) DO NOTHING;

-- ============================================================
-- 6. ROL PostgreSQL SUPERADMIN + permisos sobre tablas maestras
--    (Complementa el usuario de aplicación creado en 028)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'SUPERADMIN') THEN
    CREATE ROLE "SUPERADMIN";
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON TABLE public.departamentos TO "SUPERADMIN";
GRANT ALL PRIVILEGES ON TABLE public.municipios    TO "SUPERADMIN";
GRANT ALL PRIVILEGES ON TABLE public.corregimientos TO "SUPERADMIN";
GRANT ALL PRIVILEGES ON TABLE public.veredas        TO "SUPERADMIN";

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

SELECT 'departamentos' AS tabla, COUNT(*) AS registros FROM public.departamentos
UNION ALL
SELECT 'municipios',   COUNT(*) FROM public.municipios
UNION ALL
SELECT 'corregimientos', COUNT(*) FROM public.corregimientos
UNION ALL
SELECT 'veredas',      COUNT(*) FROM public.veredas;

COMMIT;
