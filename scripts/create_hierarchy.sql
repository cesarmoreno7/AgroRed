-- Tabla de Países
CREATE TABLE pais (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo_iso TEXT NOT NULL UNIQUE, -- Código ISO del país (ej: CO para Colombia)
    geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

-- Tabla de Departamentos
CREATE TABLE departamento (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    pais_id INT NOT NULL REFERENCES pais(id),
    geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

-- Tabla de Municipios
CREATE TABLE municipio (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    departamento_id INT NOT NULL REFERENCES departamento(id),
    geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

-- Tabla de Zonas (Barrios, Veredas, Corregimientos)
CREATE TABLE zona (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL, -- barrio, vereda, corregimiento
    municipio_id INT NOT NULL REFERENCES municipio(id),
    geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

-- Tabla de Predios
CREATE TABLE predio (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL,
    zona_id INT NOT NULL REFERENCES zona(id),
    geom GEOMETRY(POLYGON, 4326) NOT NULL
);