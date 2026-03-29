-- Insertar datos de prueba para la tabla pais
INSERT INTO pais (nombre, codigo_iso, geom)
VALUES 
    ('Colombia', 'CO', ST_GeomFromText('MULTIPOLYGON(((-79.0 12.0, -66.0 12.0, -66.0 -4.0, -79.0 -4.0, -79.0 12.0)))', 4326));

-- Insertar datos de prueba para la tabla departamento
INSERT INTO departamento (nombre, pais_id, geom)
VALUES 
    ('Antioquia', 1, ST_GeomFromText('MULTIPOLYGON(((-76.0 7.0, -75.0 7.0, -75.0 6.0, -76.0 6.0, -76.0 7.0)))', 4326));

-- Insertar datos de prueba para la tabla municipio
INSERT INTO municipio (nombre, departamento_id, geom)
VALUES 
    ('Medellín', 1, ST_GeomFromText('MULTIPOLYGON(((-75.6 6.3, -75.5 6.3, -75.5 6.2, -75.6 6.2, -75.6 6.3)))', 4326));

-- Insertar datos de prueba para la tabla zona
INSERT INTO zona (nombre, tipo, municipio_id, geom)
VALUES 
    ('Barrio Centro', 'barrio', 1, ST_GeomFromText('MULTIPOLYGON(((-75.57 6.24, -75.56 6.24, -75.56 6.25, -75.57 6.25, -75.57 6.24)))', 4326));

-- Insertar datos de prueba para la tabla predio
INSERT INTO predio (codigo, zona_id, geom)
VALUES 
    ('PREDIO001', 1, ST_GeomFromText('POLYGON((-75.565 6.245, -75.564 6.245, -75.564 6.246, -75.565 6.246, -75.565 6.245))', 4326));