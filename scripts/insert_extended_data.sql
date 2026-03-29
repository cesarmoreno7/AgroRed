-- ============================================================
-- DATOS EXTENDIDOS: Jerarquía Geográfica de Colombia
-- País → Departamentos → Municipios → Zonas → Predios
-- ============================================================

-- ============================================================
-- DEPARTAMENTOS (aproximaciones geográficas reales)
-- ============================================================

-- Valle del Cauca
INSERT INTO departamento (nombre, pais_id, geom)
VALUES ('Valle del Cauca', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-77.0 4.5, -75.7 4.5, -75.7 3.5, -77.0 3.5, -77.0 4.5)))', 4326));

-- Cundinamarca
INSERT INTO departamento (nombre, pais_id, geom)
VALUES ('Cundinamarca', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-74.9 5.8, -73.0 5.8, -73.0 3.7, -74.9 3.7, -74.9 5.8)))', 4326));

-- Santander
INSERT INTO departamento (nombre, pais_id, geom)
VALUES ('Santander', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-74.0 8.0, -72.5 8.0, -72.5 5.7, -74.0 5.7, -74.0 8.0)))', 4326));

-- Boyacá
INSERT INTO departamento (nombre, pais_id, geom)
VALUES ('Boyacá', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-74.5 7.1, -72.3 7.1, -72.3 4.9, -74.5 4.9, -74.5 7.1)))', 4326));

-- Nariño
INSERT INTO departamento (nombre, pais_id, geom)
VALUES ('Nariño', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-79.0 2.5, -77.0 2.5, -77.0 0.4, -79.0 0.4, -79.0 2.5)))', 4326));

-- ============================================================
-- MUNICIPIOS DE ANTIOQUIA (depto_id = 1, ya existente)
-- ============================================================

-- Envigado
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Envigado', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.59 6.18, -75.55 6.18, -75.55 6.15, -75.59 6.15, -75.59 6.18)))', 4326));

-- Itagüí
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Itagüí', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.63 6.19, -75.59 6.19, -75.59 6.16, -75.63 6.16, -75.63 6.19)))', 4326));

-- Bello
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Bello', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.58 6.40, -75.52 6.40, -75.52 6.33, -75.58 6.33, -75.58 6.40)))', 4326));

-- Rionegro
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Rionegro', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.42 6.20, -75.35 6.20, -75.35 6.13, -75.42 6.13, -75.42 6.20)))', 4326));

-- Santa Fe de Antioquia
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Santa Fe de Antioquia', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.84 6.60, -75.74 6.60, -75.74 6.53, -75.84 6.53, -75.84 6.60)))', 4326));

-- ============================================================
-- MUNICIPIOS DEL VALLE DEL CAUCA (depto_id = 2)
-- ============================================================

-- Cali
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Cali', (SELECT id FROM departamento WHERE nombre='Valle del Cauca'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.58 3.50, -76.48 3.50, -76.48 3.38, -76.58 3.38, -76.58 3.50)))', 4326));

-- Palmira
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Palmira', (SELECT id FROM departamento WHERE nombre='Valle del Cauca'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.35 3.58, -76.25 3.58, -76.25 3.48, -76.35 3.48, -76.35 3.58)))', 4326));

-- Buenaventura
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Buenaventura', (SELECT id FROM departamento WHERE nombre='Valle del Cauca'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.10 3.95, -76.90 3.95, -76.90 3.80, -77.10 3.80, -77.10 3.95)))', 4326));

-- ============================================================
-- MUNICIPIOS DE CUNDINAMARCA (depto_id = 3)
-- ============================================================

-- Bogotá
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Bogotá', (SELECT id FROM departamento WHERE nombre='Cundinamarca'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.20 4.80, -74.00 4.80, -74.00 4.50, -74.20 4.50, -74.20 4.80)))', 4326));

-- Soacha
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Soacha', (SELECT id FROM departamento WHERE nombre='Cundinamarca'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.25 4.60, -74.18 4.60, -74.18 4.55, -74.25 4.55, -74.25 4.60)))', 4326));

-- Zipaquirá
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Zipaquirá', (SELECT id FROM departamento WHERE nombre='Cundinamarca'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.02 5.06, -73.96 5.06, -73.96 5.00, -74.02 5.00, -74.02 5.06)))', 4326));

-- ============================================================
-- MUNICIPIOS DE SANTANDER (depto_id = 4)
-- ============================================================

-- Bucaramanga
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Bucaramanga', (SELECT id FROM departamento WHERE nombre='Santander'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.15 7.15, -73.08 7.15, -73.08 7.08, -73.15 7.08, -73.15 7.15)))', 4326));

-- Barrancabermeja
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Barrancabermeja', (SELECT id FROM departamento WHERE nombre='Santander'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.90 7.10, -73.80 7.10, -73.80 7.00, -73.90 7.00, -73.90 7.10)))', 4326));

-- ============================================================
-- MUNICIPIOS DE BOYACÁ (depto_id = 5)
-- ============================================================

-- Tunja
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Tunja', (SELECT id FROM departamento WHERE nombre='Boyacá'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.40 5.58, -73.33 5.58, -73.33 5.50, -73.40 5.50, -73.40 5.58)))', 4326));

-- Duitama
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Duitama', (SELECT id FROM departamento WHERE nombre='Boyacá'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.05 5.85, -72.98 5.85, -72.98 5.78, -73.05 5.78, -73.05 5.85)))', 4326));

-- ============================================================
-- MUNICIPIOS DE NARIÑO (depto_id = 6)
-- ============================================================

-- Pasto
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Pasto', (SELECT id FROM departamento WHERE nombre='Nariño'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.30 1.25, -77.24 1.25, -77.24 1.19, -77.30 1.19, -77.30 1.25)))', 4326));

-- Tumaco
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES ('Tumaco', (SELECT id FROM departamento WHERE nombre='Nariño'), ST_GeomFromText(
  'MULTIPOLYGON(((-78.85 1.85, -78.75 1.85, -78.75 1.75, -78.85 1.75, -78.85 1.85)))', 4326));

-- ============================================================
-- ZONAS DE MEDELLÍN (municipio ya existente, id=1)
-- ============================================================

-- El Poblado (barrio)
INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('El Poblado', 'barrio', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.57 6.21, -75.56 6.21, -75.56 6.20, -75.57 6.20, -75.57 6.21)))', 4326));

-- Laureles (barrio)
INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Laureles', 'barrio', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.59 6.26, -75.58 6.26, -75.58 6.25, -75.59 6.25, -75.59 6.26)))', 4326));

-- San Antonio de Prado (corregimiento)
INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('San Antonio de Prado', 'corregimiento', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.67 6.22, -75.63 6.22, -75.63 6.18, -75.67 6.18, -75.67 6.22)))', 4326));

-- Santa Elena (vereda)
INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Santa Elena', 'vereda', 1, ST_GeomFromText(
  'MULTIPOLYGON(((-75.50 6.23, -75.47 6.23, -75.47 6.20, -75.50 6.20, -75.50 6.23)))', 4326));

-- ============================================================
-- ZONAS DE ENVIGADO (municipio id dinámico)
-- ============================================================

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Zuñiga', 'barrio', (SELECT id FROM municipio WHERE nombre='Envigado'), ST_GeomFromText(
  'MULTIPOLYGON(((-75.585 6.175, -75.575 6.175, -75.575 6.165, -75.585 6.165, -75.585 6.175)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('El Trianón', 'barrio', (SELECT id FROM municipio WHERE nombre='Envigado'), ST_GeomFromText(
  'MULTIPOLYGON(((-75.575 6.172, -75.565 6.172, -75.565 6.162, -75.575 6.162, -75.575 6.172)))', 4326));

-- ============================================================
-- ZONAS DE CALI
-- ============================================================

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('San Fernando', 'barrio', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.54 3.44, -76.53 3.44, -76.53 3.43, -76.54 3.43, -76.54 3.44)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Siloé', 'barrio', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.56 3.42, -76.55 3.42, -76.55 3.41, -76.56 3.41, -76.56 3.42)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Pance', 'corregimiento', (SELECT id FROM municipio WHERE nombre='Cali'), ST_GeomFromText(
  'MULTIPOLYGON(((-76.58 3.35, -76.54 3.35, -76.54 3.31, -76.58 3.31, -76.58 3.35)))', 4326));

-- ============================================================
-- ZONAS DE BOGOTÁ
-- ============================================================

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Chapinero', 'barrio', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.06 4.66, -74.04 4.66, -74.04 4.64, -74.06 4.64, -74.06 4.66)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Usaquén', 'barrio', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.05 4.73, -74.03 4.73, -74.03 4.70, -74.05 4.70, -74.05 4.73)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Sumapaz', 'corregimiento', (SELECT id FROM municipio WHERE nombre='Bogotá'), ST_GeomFromText(
  'MULTIPOLYGON(((-74.18 4.55, -74.10 4.55, -74.10 4.48, -74.18 4.48, -74.18 4.55)))', 4326));

-- ============================================================
-- ZONAS DE BUCARAMANGA
-- ============================================================

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Cabecera del Llano', 'barrio', (SELECT id FROM municipio WHERE nombre='Bucaramanga'), ST_GeomFromText(
  'MULTIPOLYGON(((-73.12 7.12, -73.11 7.12, -73.11 7.11, -73.12 7.11, -73.12 7.12)))', 4326));

-- ============================================================
-- ZONAS DE PASTO
-- ============================================================

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Centro Histórico', 'barrio', (SELECT id FROM municipio WHERE nombre='Pasto'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.28 1.22, -77.27 1.22, -77.27 1.21, -77.28 1.21, -77.28 1.22)))', 4326));

INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES ('Catambuco', 'corregimiento', (SELECT id FROM municipio WHERE nombre='Pasto'), ST_GeomFromText(
  'MULTIPOLYGON(((-77.32 1.18, -77.28 1.18, -77.28 1.14, -77.32 1.14, -77.32 1.18)))', 4326));

-- ============================================================
-- PREDIOS EN MEDELLÍN - Barrio Centro (zona_id = 1)
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-CEN-002', 1, ST_GeomFromText(
  'POLYGON((-75.564 6.244, -75.563 6.244, -75.563 6.245, -75.564 6.245, -75.564 6.244))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-CEN-003', 1, ST_GeomFromText(
  'POLYGON((-75.563 6.243, -75.562 6.243, -75.562 6.244, -75.563 6.244, -75.563 6.243))', 4326));

-- ============================================================
-- PREDIOS EN EL POBLADO (zona dinámica)
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-POB-001', (SELECT id FROM zona WHERE nombre='El Poblado'), ST_GeomFromText(
  'POLYGON((-75.567 6.205, -75.566 6.205, -75.566 6.206, -75.567 6.206, -75.567 6.205))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-POB-002', (SELECT id FROM zona WHERE nombre='El Poblado'), ST_GeomFromText(
  'POLYGON((-75.566 6.204, -75.565 6.204, -75.565 6.205, -75.566 6.205, -75.566 6.204))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-POB-003', (SELECT id FROM zona WHERE nombre='El Poblado'), ST_GeomFromText(
  'POLYGON((-75.565 6.203, -75.564 6.203, -75.564 6.204, -75.565 6.204, -75.565 6.203))', 4326));

-- ============================================================
-- PREDIOS EN LAURELES
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-LAU-001', (SELECT id FROM zona WHERE nombre='Laureles'), ST_GeomFromText(
  'POLYGON((-75.587 6.255, -75.586 6.255, -75.586 6.256, -75.587 6.256, -75.587 6.255))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-LAU-002', (SELECT id FROM zona WHERE nombre='Laureles'), ST_GeomFromText(
  'POLYGON((-75.586 6.254, -75.585 6.254, -75.585 6.255, -75.586 6.255, -75.586 6.254))', 4326));

-- ============================================================
-- PREDIOS EN SANTA ELENA (vereda)
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-STE-001', (SELECT id FROM zona WHERE nombre='Santa Elena'), ST_GeomFromText(
  'POLYGON((-75.49 6.215, -75.485 6.215, -75.485 6.22, -75.49 6.22, -75.49 6.215))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('MDE-STE-002', (SELECT id FROM zona WHERE nombre='Santa Elena'), ST_GeomFromText(
  'POLYGON((-75.485 6.210, -75.48 6.210, -75.48 6.215, -75.485 6.215, -75.485 6.210))', 4326));

-- ============================================================
-- PREDIOS EN ENVIGADO - Zuñiga
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('ENV-ZUN-001', (SELECT id FROM zona WHERE nombre='Zuñiga'), ST_GeomFromText(
  'POLYGON((-75.582 6.170, -75.581 6.170, -75.581 6.171, -75.582 6.171, -75.582 6.170))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('ENV-ZUN-002', (SELECT id FROM zona WHERE nombre='Zuñiga'), ST_GeomFromText(
  'POLYGON((-75.581 6.169, -75.580 6.169, -75.580 6.170, -75.581 6.170, -75.581 6.169))', 4326));

-- ============================================================
-- PREDIOS EN CALI - San Fernando
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('CAL-SFE-001', (SELECT id FROM zona WHERE nombre='San Fernando'), ST_GeomFromText(
  'POLYGON((-76.536 3.435, -76.535 3.435, -76.535 3.436, -76.536 3.436, -76.536 3.435))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('CAL-SFE-002', (SELECT id FROM zona WHERE nombre='San Fernando'), ST_GeomFromText(
  'POLYGON((-76.535 3.434, -76.534 3.434, -76.534 3.435, -76.535 3.435, -76.535 3.434))', 4326));

-- ============================================================
-- PREDIOS EN CALI - Pance (corregimiento rural)
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('CAL-PAN-001', (SELECT id FROM zona WHERE nombre='Pance'), ST_GeomFromText(
  'POLYGON((-76.57 3.34, -76.565 3.34, -76.565 3.345, -76.57 3.345, -76.57 3.34))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('CAL-PAN-002', (SELECT id FROM zona WHERE nombre='Pance'), ST_GeomFromText(
  'POLYGON((-76.565 3.335, -76.56 3.335, -76.56 3.34, -76.565 3.34, -76.565 3.335))', 4326));

-- ============================================================
-- PREDIOS EN BOGOTÁ - Chapinero
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('BOG-CHA-001', (SELECT id FROM zona WHERE nombre='Chapinero'), ST_GeomFromText(
  'POLYGON((-74.055 4.650, -74.054 4.650, -74.054 4.651, -74.055 4.651, -74.055 4.650))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('BOG-CHA-002', (SELECT id FROM zona WHERE nombre='Chapinero'), ST_GeomFromText(
  'POLYGON((-74.054 4.649, -74.053 4.649, -74.053 4.650, -74.054 4.650, -74.054 4.649))', 4326));

-- ============================================================
-- PREDIOS EN BOGOTÁ - Usaquén
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('BOG-USA-001', (SELECT id FROM zona WHERE nombre='Usaquén'), ST_GeomFromText(
  'POLYGON((-74.045 4.715, -74.044 4.715, -74.044 4.716, -74.045 4.716, -74.045 4.715))', 4326));

-- ============================================================
-- PREDIOS EN BUCARAMANGA - Cabecera del Llano
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('BGA-CAB-001', (SELECT id FROM zona WHERE nombre='Cabecera del Llano'), ST_GeomFromText(
  'POLYGON((-73.115 7.115, -73.114 7.115, -73.114 7.116, -73.115 7.116, -73.115 7.115))', 4326));

-- ============================================================
-- PREDIOS EN PASTO - Centro Histórico
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('PAS-CHI-001', (SELECT id FROM zona WHERE nombre='Centro Histórico'), ST_GeomFromText(
  'POLYGON((-77.275 1.215, -77.274 1.215, -77.274 1.216, -77.275 1.216, -77.275 1.215))', 4326));

-- ============================================================
-- PREDIOS EN PASTO - Catambuco (corregimiento)
-- ============================================================

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('PAS-CAT-001', (SELECT id FROM zona WHERE nombre='Catambuco'), ST_GeomFromText(
  'POLYGON((-77.31 1.16, -77.305 1.16, -77.305 1.165, -77.31 1.165, -77.31 1.16))', 4326));

INSERT INTO predio (codigo, zona_id, geom)
VALUES ('PAS-CAT-002', (SELECT id FROM zona WHERE nombre='Catambuco'), ST_GeomFromText(
  'POLYGON((-77.305 1.155, -77.30 1.155, -77.30 1.16, -77.305 1.16, -77.305 1.155))', 4326));
