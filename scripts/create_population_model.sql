-- ============================================================
-- EXTENSIÓN: Manzanas + Modelo de Población/Censo
-- Jerarquía: País → Depto → Municipio → Zona → Manzana → Predio
-- ============================================================

-- ============================================================
-- TABLA DE MANZANAS (nivel entre zona y predio)
-- ============================================================
CREATE TABLE manzana (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL,              -- Código catastral de la manzana
    zona_id INT NOT NULL REFERENCES zona(id),
    geom GEOMETRY(POLYGON, 4326) NOT NULL
);

CREATE INDEX idx_manzana_geom ON manzana USING GIST(geom);

-- Actualizar predio para referenciar manzana (opcional, mantiene zona_id)
ALTER TABLE predio ADD COLUMN manzana_id INT REFERENCES manzana(id);

-- ============================================================
-- TABLA DE VIVIENDAS (unidades habitacionales dentro de predios)
-- ============================================================
CREATE TABLE vivienda (
    id SERIAL PRIMARY KEY,
    predio_id INT NOT NULL REFERENCES predio(id),
    direccion TEXT NOT NULL,
    tipo TEXT NOT NULL,                -- casa, apartamento, finca, local
    estrato INT CHECK (estrato BETWEEN 1 AND 6),
    num_pisos INT DEFAULT 1
);

-- ============================================================
-- TABLA DE HABITANTES (personas vinculadas a viviendas)
-- ============================================================
CREATE TABLE habitante (
    id SERIAL PRIMARY KEY,
    vivienda_id INT NOT NULL REFERENCES vivienda(id),
    nombre TEXT NOT NULL,
    documento TEXT NOT NULL UNIQUE,
    fecha_nacimiento DATE,
    genero TEXT CHECK (genero IN ('M', 'F', 'otro')),
    parentesco TEXT,                   -- jefe_hogar, conyuge, hijo, otro
    activo BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- TABLA DE CENSO (agregados poblacionales por unidad geográfica)
-- ============================================================
CREATE TABLE censo (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nivel TEXT NOT NULL,               -- predio, manzana, zona, municipio
    referencia_id INT NOT NULL,        -- ID del nivel correspondiente
    total_viviendas INT DEFAULT 0,
    total_habitantes INT DEFAULT 0,
    total_hogares INT DEFAULT 0,
    densidad_hab_km2 NUMERIC(10,2),
    fuente TEXT DEFAULT 'levantamiento_campo'
);

-- ============================================================
-- VISTA: Población por predio (calculada desde habitantes)
-- ============================================================
CREATE OR REPLACE VIEW v_poblacion_predio AS
SELECT
    p.id AS predio_id,
    p.codigo AS predio_codigo,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(p.geom, 3116)) AS area_m2
FROM predio p
JOIN zona z ON p.zona_id = z.id
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY p.id, p.codigo, z.nombre, z.tipo, m.nombre, d.nombre, p.geom;

-- ============================================================
-- VISTA: Población por manzana
-- ============================================================
CREATE OR REPLACE VIEW v_poblacion_manzana AS
SELECT
    mz.id AS manzana_id,
    mz.codigo AS manzana_codigo,
    z.nombre AS zona,
    m.nombre AS municipio,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(mz.geom, 3116)) AS area_m2
FROM manzana mz
JOIN zona z ON mz.zona_id = z.id
JOIN municipio m ON z.municipio_id = m.id
LEFT JOIN predio p ON p.manzana_id = mz.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY mz.id, mz.codigo, z.nombre, m.nombre, mz.geom;

-- ============================================================
-- VISTA: Población por zona (barrio/vereda/corregimiento)
-- ============================================================
CREATE OR REPLACE VIEW v_poblacion_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(z.geom, 3116)) AS area_m2
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN predio p ON p.zona_id = z.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY z.id, z.nombre, z.tipo, m.nombre, d.nombre, z.geom;
