-- ============================================================
-- DATOS DE EJEMPLO: Manzanas, Viviendas, Habitantes
-- Para Medellín - Barrio Centro y El Poblado
-- ============================================================

-- ============================================================
-- MANZANAS en Barrio Centro (zona_id = 1)
-- ============================================================

INSERT INTO manzana (codigo, zona_id, geom) VALUES
('MDE-CEN-MZ01', 1, ST_GeomFromText('POLYGON((-75.567 6.244, -75.564 6.244, -75.564 6.246, -75.567 6.246, -75.567 6.244))', 4326)),
('MDE-CEN-MZ02', 1, ST_GeomFromText('POLYGON((-75.564 6.243, -75.561 6.243, -75.561 6.245, -75.564 6.245, -75.564 6.243))', 4326));

-- MANZANAS en El Poblado (zona dinámica)
INSERT INTO manzana (codigo, zona_id, geom) VALUES
('MDE-POB-MZ01', (SELECT id FROM zona WHERE nombre='El Poblado'), ST_GeomFromText('POLYGON((-75.568 6.204, -75.565 6.204, -75.565 6.207, -75.568 6.207, -75.568 6.204))', 4326)),
('MDE-POB-MZ02', (SELECT id FROM zona WHERE nombre='El Poblado'), ST_GeomFromText('POLYGON((-75.565 6.203, -75.563 6.203, -75.563 6.205, -75.565 6.205, -75.565 6.203))', 4326));

-- ============================================================
-- Vincular predios existentes a manzanas
-- ============================================================

-- Predios de Barrio Centro → Manzana MZ01
UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-CEN-MZ01')
WHERE codigo = 'PREDIO001';

UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-CEN-MZ02')
WHERE codigo = 'MDE-CEN-002';

UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-CEN-MZ02')
WHERE codigo = 'MDE-CEN-003';

-- Predios de El Poblado → Manzanas
UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-POB-MZ01')
WHERE codigo = 'MDE-POB-001';

UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-POB-MZ01')
WHERE codigo = 'MDE-POB-002';

UPDATE predio SET manzana_id = (SELECT id FROM manzana WHERE codigo='MDE-POB-MZ02')
WHERE codigo = 'MDE-POB-003';

-- ============================================================
-- VIVIENDAS en predios de Barrio Centro
-- ============================================================

-- PREDIO001 - 3 viviendas (edificio pequeño)
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='PREDIO001'), 'Cra 50 #45-10 Apto 101', 'apartamento', 3, 1),
((SELECT id FROM predio WHERE codigo='PREDIO001'), 'Cra 50 #45-10 Apto 201', 'apartamento', 3, 1),
((SELECT id FROM predio WHERE codigo='PREDIO001'), 'Cra 50 #45-10 Apto 301', 'apartamento', 3, 1);

-- MDE-CEN-002 - 1 casa
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='MDE-CEN-002'), 'Cra 49 #44-22', 'casa', 3, 2);

-- MDE-CEN-003 - 2 viviendas
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='MDE-CEN-003'), 'Cra 48 #43-15 Apto 1', 'apartamento', 3, 1),
((SELECT id FROM predio WHERE codigo='MDE-CEN-003'), 'Cra 48 #43-15 Apto 2', 'apartamento', 3, 1);

-- ============================================================
-- VIVIENDAS en predios de El Poblado
-- ============================================================

-- MDE-POB-001 - edificio con 4 apartamentos
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='MDE-POB-001'), 'Cra 43A #10S-20 Apto 101', 'apartamento', 5, 1),
((SELECT id FROM predio WHERE codigo='MDE-POB-001'), 'Cra 43A #10S-20 Apto 201', 'apartamento', 5, 1),
((SELECT id FROM predio WHERE codigo='MDE-POB-001'), 'Cra 43A #10S-20 Apto 301', 'apartamento', 5, 1),
((SELECT id FROM predio WHERE codigo='MDE-POB-001'), 'Cra 43A #10S-20 Apto 401', 'apartamento', 5, 1);

-- MDE-POB-002 - 1 casa
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='MDE-POB-002'), 'Cra 43A #11S-05', 'casa', 5, 3);

-- MDE-POB-003 - 2 viviendas
INSERT INTO vivienda (predio_id, direccion, tipo, estrato, num_pisos) VALUES
((SELECT id FROM predio WHERE codigo='MDE-POB-003'), 'Cra 42 #10S-50 Apto 1', 'apartamento', 5, 1),
((SELECT id FROM predio WHERE codigo='MDE-POB-003'), 'Cra 42 #10S-50 Apto 2', 'apartamento', 5, 1);

-- ============================================================
-- HABITANTES (familias de ejemplo)
-- ============================================================

-- Familia 1 - PREDIO001 Apto 101 (4 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(1, 'Carlos Gómez', '1017200001', '1980-03-15', 'M', 'jefe_hogar'),
(1, 'María López', '1017200002', '1982-07-22', 'F', 'conyuge'),
(1, 'Sofía Gómez López', '1017200003', '2010-11-05', 'F', 'hijo'),
(1, 'Juan Gómez López', '1017200004', '2013-02-18', 'M', 'hijo');

-- Familia 2 - PREDIO001 Apto 201 (2 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(2, 'Ana Martínez', '1017200005', '1975-09-10', 'F', 'jefe_hogar'),
(2, 'Pedro Martínez', '1017200006', '2005-04-25', 'M', 'hijo');

-- Familia 3 - PREDIO001 Apto 301 (1 persona)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(3, 'Luis Fernández', '1017200007', '1990-06-30', 'M', 'jefe_hogar');

-- Familia 4 - MDE-CEN-002 casa (5 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(4, 'Jorge Restrepo', '1017200008', '1968-12-01', 'M', 'jefe_hogar'),
(4, 'Carmen Duque', '1017200009', '1970-05-14', 'F', 'conyuge'),
(4, 'Andrés Restrepo Duque', '1017200010', '1995-08-20', 'M', 'hijo'),
(4, 'Laura Restrepo Duque', '1017200011', '1998-01-10', 'F', 'hijo'),
(4, 'Rosa Duque', '1017200012', '1945-03-08', 'F', 'otro');

-- Familia 5 - MDE-CEN-003 Apto 1 (3 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(5, 'Diana Ochoa', '1017200013', '1988-11-22', 'F', 'jefe_hogar'),
(5, 'Mateo Ríos Ochoa', '1017200014', '2015-07-03', 'M', 'hijo'),
(5, 'Valentina Ríos Ochoa', '1017200015', '2018-09-17', 'F', 'hijo');

-- Familia 6 - MDE-CEN-003 Apto 2 (2 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(6, 'Felipe Arango', '1017200016', '1992-04-11', 'M', 'jefe_hogar'),
(6, 'Camila Torres', '1017200017', '1993-08-29', 'F', 'conyuge');

-- ============================================================
-- HABITANTES en El Poblado
-- ============================================================

-- Apto 101 Poblado (3 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(7, 'Roberto Mejía', '1017200018', '1978-02-14', 'M', 'jefe_hogar'),
(7, 'Sandra Posada', '1017200019', '1980-10-05', 'F', 'conyuge'),
(7, 'Isabella Mejía Posada', '1017200020', '2012-06-21', 'F', 'hijo');

-- Apto 201 Poblado (1 persona)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(8, 'Alejandro Bustamante', '1017200021', '1985-01-30', 'M', 'jefe_hogar');

-- Apto 301 Poblado (2 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(9, 'Natalia Vélez', '1017200022', '1991-12-08', 'F', 'jefe_hogar'),
(9, 'Tomás Vélez', '1017200023', '2019-03-15', 'M', 'hijo');

-- Apto 401 Poblado (2 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(10, 'Mauricio Cárdenas', '1017200024', '1973-07-19', 'M', 'jefe_hogar'),
(10, 'Elena Soto', '1017200025', '1975-11-02', 'F', 'conyuge');

-- Casa Poblado (4 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(11, 'Gabriel Uribe', '1017200026', '1965-04-07', 'M', 'jefe_hogar'),
(11, 'Patricia Londoño', '1017200027', '1967-09-18', 'F', 'conyuge'),
(11, 'Sebastián Uribe Londoño', '1017200028', '1993-05-12', 'M', 'hijo'),
(11, 'Mariana Uribe Londoño', '1017200029', '1996-08-24', 'F', 'hijo');

-- Apto 1 Poblado MDE-POB-003 (2 personas)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(12, 'Daniela Henao', '1017200030', '1987-10-15', 'F', 'jefe_hogar'),
(12, 'Emiliano Henao', '1017200031', '2017-01-28', 'M', 'hijo');

-- Apto 2 Poblado MDE-POB-003 (1 persona)
INSERT INTO habitante (vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco) VALUES
(13, 'Julián Ospina', '1017200032', '1995-06-03', 'M', 'jefe_hogar');
