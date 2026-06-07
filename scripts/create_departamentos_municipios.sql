-- Tabla de Departamentos (sin PostGIS, solo datos basicos)
CREATE TABLE IF NOT EXISTS departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_dane VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de Municipios (sin PostGIS, solo datos basicos)
CREATE TABLE IF NOT EXISTS municipios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_dane VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    departamento_id UUID NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Indices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_departamentos_codigo_dane ON departamentos(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_departamentos_nombre ON departamentos(nombre);
CREATE INDEX IF NOT EXISTS idx_municipios_codigo_dane ON municipios(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_municipios_nombre ON municipios(nombre);
CREATE INDEX IF NOT EXISTS idx_municipios_departamento_id ON municipios(departamento_id);

-- Insertar datos iniciales de departamentos (fuente: DANE Colombia)
INSERT INTO departamentos (codigo_dane, nombre) VALUES
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
ON CONFLICT (codigo_dane) DO NOTHING;
