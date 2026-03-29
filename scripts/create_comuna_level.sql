-- ============================================================
-- EXTENSIÓN: Nivel Comuna/Sector entre Municipio y Zona
-- Jerarquía: País → Depto → Municipio → Comuna → Zona → Manzana → Predio
-- ============================================================

-- ============================================================
-- TABLA DE COMUNAS/SECTORES
-- ============================================================
CREATE TABLE comuna (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    numero INT,                        -- Número oficial de comuna (ej: 14 = El Poblado)
    tipo TEXT NOT NULL DEFAULT 'comuna', -- comuna, sector, corregimiento_rural
    municipio_id INT NOT NULL REFERENCES municipio(id),
    geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

CREATE INDEX idx_comuna_geom ON comuna USING GIST(geom);

-- ============================================================
-- Agregar FK de comuna en zona
-- ============================================================
ALTER TABLE zona ADD COLUMN comuna_id INT REFERENCES comuna(id);

-- ============================================================
-- COMUNAS DE MEDELLÍN (municipio_id = 1)
-- Medellín tiene 16 comunas + 5 corregimientos
-- ============================================================

-- Comuna 1 - Popular
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Popular', 1, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.55 6.30, -75.53 6.30, -75.53 6.27, -75.55 6.27, -75.55 6.30)))', 4326));

-- Comuna 3 - Manrique
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Manrique', 3, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.55 6.27, -75.53 6.27, -75.53 6.25, -75.55 6.25, -75.55 6.27)))', 4326));

-- Comuna 10 - La Candelaria (donde está Barrio Centro)
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('La Candelaria', 10, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.58 6.26, -75.55 6.26, -75.55 6.23, -75.58 6.23, -75.58 6.26)))', 4326));

-- Comuna 11 - Laureles-Estadio
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Laureles-Estadio', 11, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.60 6.27, -75.57 6.27, -75.57 6.24, -75.60 6.24, -75.60 6.27)))', 4326));

-- Comuna 14 - El Poblado
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('El Poblado', 14, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.58 6.22, -75.55 6.22, -75.55 6.19, -75.58 6.19, -75.58 6.22)))', 4326));

-- Comuna 16 - Belén
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Belén', 16, 'comuna', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.62 6.24, -75.58 6.24, -75.58 6.21, -75.62 6.21, -75.62 6.24)))', 4326));

-- Corregimiento San Antonio de Prado
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('San Antonio de Prado', 80, 'corregimiento_rural', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.68 6.23, -75.62 6.23, -75.62 6.17, -75.68 6.17, -75.68 6.23)))', 4326));

-- Corregimiento Santa Elena
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Santa Elena', 90, 'corregimiento_rural', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.52 6.24, -75.46 6.24, -75.46 6.19, -75.52 6.19, -75.52 6.24)))', 4326));

-- ============================================================
-- COMUNAS DE CALI
-- ============================================================

-- Comuna 3 - San Fernando
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Comuna 3', 3, 'comuna', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.55 3.45, -76.52 3.45, -76.52 3.42, -76.55 3.42, -76.55 3.45)))', 4326));

-- Comuna 20 - Siloé
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Comuna 20', 20, 'comuna', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.57 3.43, -76.54 3.43, -76.54 3.40, -76.57 3.40, -76.57 3.43)))', 4326));

-- Corregimiento Pance
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Pance', 0, 'corregimiento_rural', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.59 3.36, -76.53 3.36, -76.53 3.30, -76.59 3.30, -76.59 3.36)))', 4326));

-- ============================================================
-- COMUNAS DE BOGOTÁ (localidades)
-- ============================================================

-- Localidad 2 - Chapinero
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Chapinero', 2, 'comuna', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.07 4.68, -74.03 4.68, -74.03 4.63, -74.07 4.63, -74.07 4.68)))', 4326));

-- Localidad 1 - Usaquén
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Usaquén', 1, 'comuna', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.06 4.75, -74.02 4.75, -74.02 4.69, -74.06 4.69, -74.06 4.75)))', 4326));

-- Localidad 20 - Sumapaz
INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Sumapaz', 20, 'corregimiento_rural', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.20 4.56, -74.08 4.56, -74.08 4.46, -74.20 4.46, -74.20 4.56)))', 4326));

-- ============================================================
-- COMUNAS DE BUCARAMANGA
-- ============================================================

INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Comuna 12 - Cabecera', 12, 'comuna', (SELECT id FROM municipio WHERE nombre='Bucaramanga'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.13 7.13, -73.10 7.13, -73.10 7.10, -73.13 7.10, -73.13 7.13)))', 4326));

-- ============================================================
-- COMUNAS DE PASTO
-- ============================================================

INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Comuna 1 - Centro', 1, 'comuna', (SELECT id FROM municipio WHERE nombre='Pasto'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.29 1.23, -77.26 1.23, -77.26 1.20, -77.29 1.20, -77.29 1.23)))', 4326));

INSERT INTO comuna (nombre, numero, tipo, municipio_id, geom) VALUES
('Catambuco', 0, 'corregimiento_rural', (SELECT id FROM municipio WHERE nombre='Pasto'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.33 1.19, -77.27 1.19, -77.27 1.13, -77.33 1.13, -77.33 1.19)))', 4326));

-- ============================================================
-- VINCULAR ZONAS EXISTENTES A SUS COMUNAS
-- ============================================================

-- Medellín: Barrio Centro → La Candelaria (comuna 10)
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='La Candelaria' AND municipio_id=1)
WHERE nombre = 'Barrio Centro';

-- Medellín: El Poblado → El Poblado (comuna 14)
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='El Poblado' AND tipo='comuna')
WHERE nombre = 'El Poblado' AND tipo='barrio';

-- Medellín: Laureles → Laureles-Estadio (comuna 11)
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Laureles-Estadio')
WHERE nombre = 'Laureles';

-- Medellín: San Antonio de Prado → Corregimiento SAP
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='San Antonio de Prado')
WHERE nombre = 'San Antonio de Prado';

-- Medellín: Santa Elena → Corregimiento Santa Elena
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Santa Elena' AND tipo='corregimiento_rural')
WHERE nombre = 'Santa Elena' AND tipo='vereda';

-- Cali: San Fernando → Comuna 3
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Comuna 3' AND municipio_id=(SELECT id FROM municipio WHERE nombre='Cali'))
WHERE nombre = 'San Fernando';

-- Cali: Siloé → Comuna 20
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Comuna 20')
WHERE nombre = 'Siloé';

-- Cali: Pance → Corregimiento Pance
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Pance' AND tipo='corregimiento_rural')
WHERE nombre = 'Pance' AND tipo='corregimiento';

-- Bogotá: Chapinero → Localidad Chapinero
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Chapinero' AND tipo='comuna')
WHERE nombre = 'Chapinero' AND tipo='barrio';

-- Bogotá: Usaquén → Localidad Usaquén
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Usaquén' AND tipo='comuna')
WHERE nombre = 'Usaquén' AND tipo='barrio';

-- Bogotá: Sumapaz → Localidad Sumapaz
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Sumapaz' AND tipo='corregimiento_rural')
WHERE nombre = 'Sumapaz' AND tipo='corregimiento';

-- Bucaramanga: Cabecera del Llano → Comuna 12
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Comuna 12 - Cabecera')
WHERE nombre = 'Cabecera del Llano';

-- Pasto: Centro Histórico → Comuna 1
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Comuna 1 - Centro')
WHERE nombre = 'Centro Histórico';

-- Pasto: Catambuco → Corregimiento Catambuco
UPDATE zona SET comuna_id = (SELECT id FROM comuna WHERE nombre='Catambuco' AND tipo='corregimiento_rural')
WHERE nombre = 'Catambuco' AND tipo='corregimiento';

-- ============================================================
-- ACTUALIZAR VISTAS POBLACIONALES (incluir comuna)
-- ============================================================

-- Vista: Población por predio (con comuna)
CREATE OR REPLACE VIEW v_poblacion_predio AS
SELECT
    p.id AS predio_id,
    p.codigo AS predio_codigo,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    c.nombre AS comuna,
    c.numero AS comuna_num,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(p.geom, 3116)) AS area_m2
FROM predio p
JOIN zona z ON p.zona_id = z.id
LEFT JOIN comuna c ON z.comuna_id = c.id
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY p.id, p.codigo, z.nombre, z.tipo, c.nombre, c.numero, m.nombre, d.nombre, p.geom;

-- Vista: Población por manzana (con comuna)
CREATE OR REPLACE VIEW v_poblacion_manzana AS
SELECT
    mz.id AS manzana_id,
    mz.codigo AS manzana_codigo,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(mz.geom, 3116)) AS area_m2
FROM manzana mz
JOIN zona z ON mz.zona_id = z.id
LEFT JOIN comuna c ON z.comuna_id = c.id
JOIN municipio m ON z.municipio_id = m.id
LEFT JOIN predio p ON p.manzana_id = mz.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY mz.id, mz.codigo, z.nombre, c.nombre, m.nombre, mz.geom;

-- Vista: Población por zona (con comuna)
CREATE OR REPLACE VIEW v_poblacion_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo,
    c.nombre AS comuna,
    c.numero AS comuna_num,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(z.geom, 3116)) AS area_m2
FROM zona z
LEFT JOIN comuna c ON z.comuna_id = c.id
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN predio p ON p.zona_id = z.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY z.id, z.nombre, z.tipo, c.nombre, c.numero, m.nombre, d.nombre, z.geom;

-- Vista nueva: Población por comuna
CREATE OR REPLACE VIEW v_poblacion_comuna AS
SELECT
    c.id AS comuna_id,
    c.nombre AS comuna,
    c.numero AS comuna_num,
    c.tipo AS tipo_comuna,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT z.id) AS zonas,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes,
    ST_Area(ST_Transform(c.geom, 3116)) AS area_m2
FROM comuna c
JOIN municipio m ON c.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN zona z ON z.comuna_id = c.id
LEFT JOIN predio p ON p.zona_id = z.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY c.id, c.nombre, c.numero, c.tipo, m.nombre, d.nombre, c.geom;
