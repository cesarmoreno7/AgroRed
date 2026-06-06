-- ============================================================
-- 027_corregimientos_veredas.sql
-- Jerarquía territorial extendida: Corregimientos y Veredas
-- Sin PostGIS — usa lat/lon NUMERIC + Haversine (como el resto del proyecto).
--
-- Jerarquía DANE completa:
--   Departamento (2 dígitos)
--   └── Municipio (5 dígitos)
--       └── Corregimiento (8 dígitos, DANE)
--           └── Vereda (texto libre, no tiene código DANE universal)
-- ============================================================

-- ── Tabla: corregimientos ─────────────────────────────────────
-- Un corregimiento es una división administrativa de un municipio,
-- reconocida por el DANE con código propio.
CREATE TABLE IF NOT EXISTS public.corregimientos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dane_code       TEXT NOT NULL,                    -- Código DANE 8 dígitos (ej: 05001001)
  name            TEXT NOT NULL,
  municipality_code TEXT NOT NULL,                  -- FK lógico al código DANE del municipio (5 dígitos)
  municipality_name TEXT NOT NULL,
  department_code TEXT NOT NULL,                    -- Código DANE del departamento (2 dígitos)
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  population      INTEGER,
  area_km2        NUMERIC(10,2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_corregimiento_dane UNIQUE (dane_code)
);

CREATE INDEX IF NOT EXISTS idx_corregimientos_muni    ON public.corregimientos(municipality_code);
CREATE INDEX IF NOT EXISTS idx_corregimientos_dept    ON public.corregimientos(department_code);
CREATE INDEX IF NOT EXISTS idx_corregimientos_active  ON public.corregimientos(is_active) WHERE is_active = TRUE;

-- ── Tabla: veredas ────────────────────────────────────────────
-- Una vereda es la unidad territorial rural mínima de Colombia.
-- No tiene código DANE universal; se identifica por nombre + corregimiento/municipio.
CREATE TABLE IF NOT EXISTS public.veredas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  corregimiento_id    UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  municipality_code   TEXT NOT NULL,
  municipality_name   TEXT NOT NULL,
  department_code     TEXT NOT NULL,
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  population          INTEGER,
  area_km2            NUMERIC(10,2),
  main_product        TEXT,                         -- Producto agrícola principal de la vereda
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vereda_name_muni UNIQUE (name, municipality_code)
);

CREATE INDEX IF NOT EXISTS idx_veredas_corregimiento  ON public.veredas(corregimiento_id);
CREATE INDEX IF NOT EXISTS idx_veredas_muni           ON public.veredas(municipality_code);
CREATE INDEX IF NOT EXISTS idx_veredas_dept           ON public.veredas(department_code);
CREATE INDEX IF NOT EXISTS idx_veredas_active         ON public.veredas(is_active) WHERE is_active = TRUE;

-- ── Columnas de referencia territorial en tablas existentes ───
-- Agrega corregimiento_id y vereda_id (opcionalmente) a las tablas
-- que ya tienen latitude/longitude para enriquecer la geolocalización.

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS corregimiento_id UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vereda_id        UUID REFERENCES public.veredas(id) ON DELETE SET NULL;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS corregimiento_id UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vereda_id        UUID REFERENCES public.veredas(id) ON DELETE SET NULL;

ALTER TABLE public.rescues
  ADD COLUMN IF NOT EXISTS corregimiento_id UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vereda_id        UUID REFERENCES public.veredas(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS corregimiento_id UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vereda_id        UUID REFERENCES public.veredas(id) ON DELETE SET NULL;

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS corregimiento_id UUID REFERENCES public.corregimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vereda_id        UUID REFERENCES public.veredas(id) ON DELETE SET NULL;

-- ── Muestra de datos: Antioquia — algunos corregimientos ──────
INSERT INTO public.corregimientos
  (dane_code, name, municipality_code, municipality_name, department_code, latitude, longitude, population)
VALUES
  ('05001001','El Pedregal',         '05001','Medellín','05',   6.2965, -75.6064, 25000),
  ('05001002','San Cristóbal',       '05001','Medellín','05',   6.2760, -75.6551, 45000),
  ('05001003','Altavista',           '05001','Medellín','05',   6.2148, -75.6340, 22000),
  ('05001004','San Antonio de Prado','05001','Medellín','05',   6.1800, -75.6480, 55000),
  ('05001005','Santa Elena',         '05001','Medellín','05',   6.2520, -75.4970, 18000),
  ('05576001','El Carmen',           '05576','Rionegro', '05',  6.1550, -75.4050, 12000),
  ('05576002','La Fe',               '05576','Rionegro', '05',  6.1300, -75.3800,  8000),
  ('05664001','Hojas Anchas',        '05664','Santa Rosa de Osos','05', 6.6580, -75.4690, 6000),
  ('05649001','El Oro',              '05649','San Roque','05',  6.4750, -74.9920, 4000),
  ('05002001','La Ceja del Tambo',   '05002','Abejorral','05',  5.7954, -75.4378, 3500)
ON CONFLICT (dane_code) DO NOTHING;

-- ── Muestra de veredas en Medellín ───────────────────────────
INSERT INTO public.veredas
  (name, municipality_code, municipality_name, department_code, latitude, longitude, main_product)
VALUES
  ('Bello Oriente',     '05001','Medellín','05', 6.2870, -75.5530,'Hortalizas'),
  ('La Palma',          '05001','Medellín','05', 6.2430, -75.6880,'Aguacate'),
  ('Las Playas',        '05001','Medellín','05', 6.1910, -75.6910,'Tomate'),
  ('El Pinar',          '05001','Medellín','05', 6.3010, -75.6250,'Papa criolla'),
  ('Pajarito',          '05001','Medellín','05', 6.3250, -75.5740,'Fríjol'),
  ('El Astillero',      '05576','Rionegro', '05', 6.1680,-75.3850,'Lechuga'),
  ('La Quiebra',        '05576','Rionegro', '05', 6.1420,-75.4120,'Maíz'),
  ('La Pradera',        '05664','Santa Rosa de Osos','05', 6.6500,-75.4800,'Leche'),
  ('El Rosario',        '05649','San Roque','05', 6.4800,-74.9800,'Yuca'),
  ('Pantanillo',        '05002','Abejorral','05', 5.8100,-75.4500,'Cacao')
ON CONFLICT (name, municipality_code) DO NOTHING;
