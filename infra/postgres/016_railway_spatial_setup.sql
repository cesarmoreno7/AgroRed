-- =========================================================
-- 016_railway_spatial_setup.sql
-- AGRORED — Modelo Territorial para Railway (sin PostGIS)
--
-- Railway no tiene extensión PostGIS disponible.
-- Estrategia: JSONB para geometrías, lat/lon NUMERIC para puntos.
-- Las geometrías se almacenan como GeoJSON en columnas JSONB.
--
-- Jerarquía: País → Depto → Municipio → Comuna → Zona → Manzana → Predio
-- =========================================================

BEGIN;

-- =========================================================
-- 1. TABLAS DE JERARQUÍA TERRITORIAL
-- =========================================================

-- 1a. País
CREATE TABLE IF NOT EXISTS pais (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo_iso TEXT NOT NULL UNIQUE,
    geom JSONB  -- GeoJSON MultiPolygon
);

-- 1b. Departamento
CREATE TABLE IF NOT EXISTS departamento (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    pais_id INT NOT NULL REFERENCES pais(id),
    codigo_dane VARCHAR(5) UNIQUE,
    geom JSONB  -- GeoJSON MultiPolygon
);

-- 1c. Municipio
CREATE TABLE IF NOT EXISTS municipio (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    departamento_id INT NOT NULL REFERENCES departamento(id),
    codigo_dane VARCHAR(10) UNIQUE,
    geom JSONB  -- GeoJSON MultiPolygon
);

-- 1d. Comuna
CREATE TABLE IF NOT EXISTS comuna (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    numero INT,
    tipo TEXT NOT NULL DEFAULT 'comuna',
    municipio_id INT NOT NULL REFERENCES municipio(id),
    codigo VARCHAR(20) UNIQUE,
    geom JSONB  -- GeoJSON MultiPolygon
);

-- 1e. Zona (barrios, veredas, corregimientos)
CREATE TABLE IF NOT EXISTS zona (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    municipio_id INT NOT NULL REFERENCES municipio(id),
    comuna_id INT REFERENCES comuna(id),
    codigo_zona VARCHAR(30) UNIQUE,
    geom JSONB  -- GeoJSON MultiPolygon
);

-- 1f. Manzana
CREATE TABLE IF NOT EXISTS manzana (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL,
    zona_id INT NOT NULL REFERENCES zona(id),
    codigo_catastral VARCHAR(40) UNIQUE,
    geom JSONB  -- GeoJSON Polygon
);

-- 1g. Predio
CREATE TABLE IF NOT EXISTS predio (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL,
    zona_id INT NOT NULL REFERENCES zona(id),
    manzana_id INT REFERENCES manzana(id),
    codigo_catastral VARCHAR(40) UNIQUE,
    geom JSONB  -- GeoJSON Polygon
);

-- =========================================================
-- 2. MODELO POBLACIONAL
-- =========================================================

-- 2a. Vivienda
CREATE TABLE IF NOT EXISTS vivienda (
    id SERIAL PRIMARY KEY,
    predio_id INT NOT NULL REFERENCES predio(id),
    direccion TEXT NOT NULL,
    tipo TEXT NOT NULL,
    estrato INT CHECK (estrato BETWEEN 1 AND 6),
    num_pisos INT DEFAULT 1
);

-- 2b. Habitante
CREATE TABLE IF NOT EXISTS habitante (
    id SERIAL PRIMARY KEY,
    vivienda_id INT NOT NULL REFERENCES vivienda(id),
    nombre TEXT NOT NULL,
    documento TEXT NOT NULL UNIQUE,
    fecha_nacimiento DATE,
    genero TEXT CHECK (genero IN ('M', 'F', 'otro')),
    parentesco TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- 2c. Censo
CREATE TABLE IF NOT EXISTS censo (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nivel TEXT NOT NULL,
    referencia_id INT NOT NULL,
    total_viviendas INT DEFAULT 0,
    total_habitantes INT DEFAULT 0,
    total_hogares INT DEFAULT 0,
    densidad_hab_km2 NUMERIC(10,2),
    fuente TEXT DEFAULT 'levantamiento_campo'
);

-- =========================================================
-- 3. COMEDOR (si no existe)
-- =========================================================

CREATE TABLE IF NOT EXISTS comedor (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('comunitario','escolar','universitario','empresarial','otro')),
    direccion TEXT NOT NULL,
    capacidad_diaria INT,
    beneficiarios_actuales INT DEFAULT 0,
    horario_atencion TEXT,
    responsable TEXT,
    telefono TEXT,
    zona_id INT REFERENCES zona(id),
    comuna_id INT REFERENCES comuna(id),
    municipio_id INT REFERENCES municipio(id),
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','temporal')),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- 4. TABLAS ANALÍTICAS (IRAT, incidencias, beneficiarios)
-- =========================================================

-- 4a. IRAT — Índice de Riesgo Alimentario Territorial
CREATE TABLE IF NOT EXISTS irat_zonas (
    id SERIAL PRIMARY KEY,
    tipo_zona VARCHAR(20) NOT NULL CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
    referencia_id INT NOT NULL,
    codigo_zona VARCHAR(40),
    disponibilidad NUMERIC(5,2) DEFAULT 0 CHECK (disponibilidad BETWEEN 0 AND 100),
    acceso NUMERIC(5,2) DEFAULT 0 CHECK (acceso BETWEEN 0 AND 100),
    logistica NUMERIC(5,2) DEFAULT 0 CHECK (logistica BETWEEN 0 AND 100),
    estabilidad NUMERIC(5,2) DEFAULT 0 CHECK (estabilidad BETWEEN 0 AND 100),
    incidencias NUMERIC(5,2) DEFAULT 0 CHECK (incidencias BETWEEN 0 AND 100),
    irat_total NUMERIC(5,2) NOT NULL CHECK (irat_total BETWEEN 0 AND 100),
    clasificacion VARCHAR(20) CHECK (clasificacion IN ('CRITICO','ALTO','MEDIO','BAJO','OPTIMO')),
    fecha_corte DATE NOT NULL,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_irat_zona UNIQUE (tipo_zona, referencia_id, fecha_corte)
);

CREATE INDEX IF NOT EXISTS idx_irat_tipo_zona ON irat_zonas(tipo_zona, referencia_id);
CREATE INDEX IF NOT EXISTS idx_irat_fecha ON irat_zonas(fecha_corte);
CREATE INDEX IF NOT EXISTS idx_irat_clasificacion ON irat_zonas(clasificacion);

-- 4b. Incidencias sociales (sin GEOMETRY, usa lat/lon)
CREATE TABLE IF NOT EXISTS incidencias_sociales (
    id SERIAL PRIMARY KEY,
    tipo_incidencia VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_zona VARCHAR(20) NOT NULL CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
    referencia_id INT NOT NULL,
    codigo_zona VARCHAR(40),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    nivel_riesgo VARCHAR(20) CHECK (nivel_riesgo IN ('CRITICO','ALTO','MEDIO','BAJO')),
    prioridad VARCHAR(20) CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
    estado VARCHAR(20) DEFAULT 'REPORTADA'
        CHECK (estado IN ('REPORTADA','EN_ANALISIS','PRIORIZADA','EN_GESTION',
                          'INTERVENIDA','CERRADA','ESCALADA')),
    fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
    fecha_atencion TIMESTAMPTZ,
    responsable VARCHAR(150),
    fuente_reporte VARCHAR(100),
    usuario_registro VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS idx_incidencias_zona ON incidencias_sociales(tipo_zona, referencia_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias_sociales(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_riesgo ON incidencias_sociales(nivel_riesgo);

-- 4c. Beneficiarios por zona
CREATE TABLE IF NOT EXISTS beneficiarios_zona (
    id SERIAL PRIMARY KEY,
    tipo_zona VARCHAR(20) NOT NULL CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
    referencia_id INT NOT NULL,
    codigo_zona VARCHAR(40),
    programa VARCHAR(150) NOT NULL,
    beneficiarios_total INT DEFAULT 0,
    ninos INT DEFAULT 0,
    adultos_mayores INT DEFAULT 0,
    mujeres_gestantes INT DEFAULT 0,
    poblacion_discapacidad INT DEFAULT 0,
    fecha_corte DATE NOT NULL,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_beneficiarios_zona UNIQUE (tipo_zona, referencia_id, programa, fecha_corte)
);

CREATE INDEX IF NOT EXISTS idx_beneficiarios_zona ON beneficiarios_zona(tipo_zona, referencia_id);
CREATE INDEX IF NOT EXISTS idx_beneficiarios_programa ON beneficiarios_zona(programa, fecha_corte);

-- 4d. Supermercados (sin GEOMETRY, usa lat/lon)
CREATE TABLE IF NOT EXISTS supermercados (
    id SERIAL PRIMARY KEY,
    nit VARCHAR(30),
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(200),
    telefono VARCHAR(50),
    email VARCHAR(150),
    responsable VARCHAR(150),
    municipio_id INT REFERENCES municipio(id),
    zona_id INT REFERENCES zona(id),
    comuna_id INT REFERENCES comuna(id),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','TEMPORAL')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supermercados_municipio ON supermercados(municipio_id);
CREATE INDEX IF NOT EXISTS idx_supermercados_estado ON supermercados(estado);

-- 4e. Productos próximos a vencer
CREATE TABLE IF NOT EXISTS productos_proximos_vencer (
    id SERIAL PRIMARY KEY,
    supermercado_id INT NOT NULL REFERENCES supermercados(id),
    nombre_producto VARCHAR(150) NOT NULL,
    categoria_producto VARCHAR(100),
    marca VARCHAR(100),
    lote VARCHAR(100),
    fecha_vencimiento DATE NOT NULL,
    cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
    unidad_medida VARCHAR(20),
    peso_estimado_kg NUMERIC(12,2),
    valor_comercial_estimado NUMERIC(14,2),
    estado_empaque VARCHAR(50),
    condicion_sanitaria VARCHAR(50),
    prioridad_rescate VARCHAR(20) CHECK (prioridad_rescate IN ('CRITICA','ALTA','MEDIA','BAJA')),
    estado_rescate VARCHAR(30) DEFAULT 'REPORTADO'
        CHECK (estado_rescate IN ('REPORTADO','EN_EVALUACION','RESCATADO','DISTRIBUIDO','DESCARTADO')),
    fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_productos_vencer_supermercado ON productos_proximos_vencer(supermercado_id);
CREATE INDEX IF NOT EXISTS idx_productos_vencer_fecha ON productos_proximos_vencer(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_productos_vencer_estado ON productos_proximos_vencer(estado_rescate);

-- 4f. Operadores logísticos
CREATE TABLE IF NOT EXISTS operadores_logisticos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nit VARCHAR(30),
    telefono VARCHAR(50),
    email VARCHAR(150),
    responsable VARCHAR(150),
    cobertura_municipios INT[],
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4g. Rutas logísticas (sin GEOMETRY, usa JSONB para trazado)
CREATE TABLE IF NOT EXISTS rutas_logisticas (
    id SERIAL PRIMARY KEY,
    operador_id INT REFERENCES operadores_logisticos(id),
    origen_tipo VARCHAR(30) CHECK (origen_tipo IN ('SUPERMERCADO','PRODUCTOR','BODEGA','COMEDOR')),
    origen_id INT,
    origen_nombre VARCHAR(150),
    destino_tipo VARCHAR(30) CHECK (destino_tipo IN ('COMEDOR','BENEFICIARIO','BODEGA','PUNTO_ENTREGA')),
    destino_id INT,
    destino_nombre VARCHAR(150),
    geom_ruta JSONB,  -- GeoJSON LineString
    distancia_km NUMERIC(10,2),
    tiempo_estimado_min INT,
    estado VARCHAR(20) DEFAULT 'PROGRAMADA'
        CHECK (estado IN ('PROGRAMADA','EN_CURSO','COMPLETADA','CANCELADA')),
    fecha_programada DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rutas_operador ON rutas_logisticas(operador_id);
CREATE INDEX IF NOT EXISTS idx_rutas_estado ON rutas_logisticas(estado);
CREATE INDEX IF NOT EXISTS idx_rutas_fecha ON rutas_logisticas(fecha_programada);

-- =========================================================
-- 5. FK TERRITORIALES EN TABLA producers (si no existen)
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'producers' AND column_name = 'municipio_id') THEN
        ALTER TABLE producers ADD COLUMN municipio_id INT REFERENCES municipio(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'producers' AND column_name = 'zona_id') THEN
        ALTER TABLE producers ADD COLUMN zona_id INT REFERENCES zona(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'producers' AND column_name = 'comuna_id') THEN
        ALTER TABLE producers ADD COLUMN comuna_id INT REFERENCES comuna(id);
    END IF;
END $$;

-- =========================================================
-- 6. ÍNDICES SOBRE CÓDIGOS DANE
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_municipio_codigo_dane ON municipio(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_departamento_codigo_dane ON departamento(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_zona_codigo ON zona(codigo_zona);
CREATE INDEX IF NOT EXISTS idx_manzana_catastral ON manzana(codigo_catastral);
CREATE INDEX IF NOT EXISTS idx_comuna_codigo ON comuna(codigo);

-- Índices GIN sobre geometrías JSONB (para búsquedas por propiedades)
CREATE INDEX IF NOT EXISTS idx_pais_geom ON pais USING GIN(geom);
CREATE INDEX IF NOT EXISTS idx_departamento_geom ON departamento USING GIN(geom);
CREATE INDEX IF NOT EXISTS idx_municipio_geom ON municipio USING GIN(geom);
CREATE INDEX IF NOT EXISTS idx_zona_geom ON zona USING GIN(geom);
CREATE INDEX IF NOT EXISTS idx_comuna_geom ON comuna USING GIN(geom);

-- =========================================================
-- 7. VISTAS ANALÍTICAS (sin funciones PostGIS)
-- =========================================================

-- 7a. IRAT por zona
CREATE OR REPLACE VIEW v_gis_irat_zonas AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    z.codigo_zona,
    m.nombre AS municipio,
    m.codigo_dane AS municipio_dane,
    d.nombre AS departamento,
    i.disponibilidad, i.acceso, i.logistica,
    i.estabilidad, i.incidencias,
    i.irat_total, i.clasificacion, i.fecha_corte
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN irat_zonas i ON i.tipo_zona = 'ZONA'
                       AND i.referencia_id = z.id
                       AND i.fecha_corte = (
                           SELECT MAX(i2.fecha_corte)
                           FROM irat_zonas i2
                           WHERE i2.tipo_zona = 'ZONA' AND i2.referencia_id = z.id
                       );

-- 7b. Incidencias sociales
CREATE OR REPLACE VIEW v_gis_incidencias AS
SELECT
    inc.id,
    inc.tipo_incidencia,
    inc.descripcion,
    inc.nivel_riesgo,
    inc.prioridad,
    inc.estado,
    inc.fecha_reporte,
    inc.fecha_atencion,
    inc.responsable,
    inc.fuente_reporte,
    inc.latitud,
    inc.longitud,
    z.nombre AS zona,
    z.tipo AS tipo_zona_nombre,
    m.nombre AS municipio
FROM incidencias_sociales inc
LEFT JOIN zona z ON inc.tipo_zona = 'ZONA' AND inc.referencia_id = z.id
LEFT JOIN municipio m ON z.municipio_id = m.id;

-- 7c. Supermercados con productos pendientes
CREATE OR REPLACE VIEW v_gis_supermercados AS
SELECT
    s.id, s.nombre, s.nit, s.direccion, s.telefono, s.estado,
    s.latitud, s.longitud,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    (SELECT COUNT(*) FROM productos_proximos_vencer ppv
     WHERE ppv.supermercado_id = s.id
       AND ppv.estado_rescate = 'REPORTADO') AS productos_pendientes
FROM supermercados s
LEFT JOIN zona z ON s.zona_id = z.id
LEFT JOIN comuna c ON s.comuna_id = c.id
LEFT JOIN municipio m ON s.municipio_id = m.id
WHERE s.estado = 'ACTIVO';

-- 7d. Comedores con cobertura
CREATE OR REPLACE VIEW v_gis_comedores_cobertura AS
SELECT
    co.id, co.nombre, co.tipo, co.direccion,
    co.capacidad_diaria, co.beneficiarios_actuales,
    co.horario_atencion, co.estado,
    co.latitud, co.longitud,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    CASE WHEN co.capacidad_diaria > 0
         THEN ROUND((co.beneficiarios_actuales::NUMERIC / co.capacidad_diaria) * 100, 1)
         ELSE 0 END AS pct_ocupacion
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN comuna c ON co.comuna_id = c.id
LEFT JOIN municipio m ON co.municipio_id = m.id;

-- 7e. Rutas logísticas
CREATE OR REPLACE VIEW v_gis_rutas AS
SELECT
    r.id,
    r.origen_tipo, r.origen_nombre,
    r.destino_tipo, r.destino_nombre,
    r.distancia_km, r.tiempo_estimado_min,
    r.estado, r.fecha_programada,
    op.nombre AS operador,
    r.geom_ruta
FROM rutas_logisticas r
LEFT JOIN operadores_logisticos op ON r.operador_id = op.id
WHERE r.geom_ruta IS NOT NULL;

-- 7f. Población por zona
CREATE OR REPLACE VIEW v_poblacion_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo,
    m.nombre AS municipio,
    d.nombre AS departamento,
    COUNT(DISTINCT p.id) AS predios,
    COUNT(DISTINCT v.id) AS viviendas,
    COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS habitantes
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN predio p ON p.zona_id = z.id
LEFT JOIN vivienda v ON v.predio_id = p.id
LEFT JOIN habitante h ON h.vivienda_id = v.id
GROUP BY z.id, z.nombre, z.tipo, m.nombre, d.nombre;

-- 7g. Beneficiarios por zona
CREATE OR REPLACE VIEW v_gis_beneficiarios_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    z.codigo_zona,
    m.nombre AS municipio,
    bz.programa,
    bz.beneficiarios_total, bz.ninos, bz.adultos_mayores,
    bz.mujeres_gestantes, bz.fecha_corte
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN beneficiarios_zona bz ON bz.tipo_zona = 'ZONA'
                            AND bz.referencia_id = z.id;

-- 7h. Dashboard territorial
CREATE OR REPLACE VIEW v_dashboard_territorial AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo,
    z.codigo_zona,
    m.nombre AS municipio,
    m.codigo_dane,
    (SELECT COUNT(DISTINCT h.id) FROM predio p
     JOIN vivienda v ON v.predio_id = p.id
     JOIN habitante h ON h.vivienda_id = v.id AND h.activo
     WHERE p.zona_id = z.id) AS habitantes,
    (SELECT i.irat_total FROM irat_zonas i
     WHERE i.tipo_zona = 'ZONA' AND i.referencia_id = z.id
     ORDER BY i.fecha_corte DESC LIMIT 1) AS irat_actual,
    (SELECT i.clasificacion FROM irat_zonas i
     WHERE i.tipo_zona = 'ZONA' AND i.referencia_id = z.id
     ORDER BY i.fecha_corte DESC LIMIT 1) AS irat_clasificacion,
    (SELECT COUNT(*) FROM incidencias_sociales inc
     WHERE inc.tipo_zona = 'ZONA' AND inc.referencia_id = z.id
       AND inc.estado NOT IN ('CERRADA','INTERVENIDA')) AS incidencias_abiertas,
    (SELECT COUNT(*) FROM comedor co
     WHERE co.zona_id = z.id AND co.estado = 'activo') AS comedores_activos,
    (SELECT COUNT(*) FROM producers pr
     WHERE pr.zona_id = z.id AND pr.deleted_at IS NULL) AS productores_activos
FROM zona z
JOIN municipio m ON z.municipio_id = m.id;

-- =========================================================
-- 7i. Cadena alimentaria unificada
-- =========================================================

CREATE OR REPLACE VIEW v_gis_cadena_alimentaria AS
SELECT
    'PRODUCTOR' AS tipo_actor,
    p.id::TEXT AS actor_id,
    p.organization_name AS nombre,
    p.producer_type AS subtipo,
    p.status AS estado,
    p.latitude AS latitud,
    p.longitude AS longitud,
    z.nombre AS zona,
    m.nombre AS municipio
FROM producers p
LEFT JOIN zona z ON p.zona_id = z.id
LEFT JOIN municipio m ON p.municipio_id = m.id
WHERE p.deleted_at IS NULL AND p.latitude IS NOT NULL

UNION ALL

SELECT
    'COMEDOR' AS tipo_actor,
    co.id::TEXT AS actor_id,
    co.nombre,
    co.tipo AS subtipo,
    co.estado,
    co.latitud,
    co.longitud,
    z.nombre AS zona,
    m.nombre AS municipio
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN municipio m ON co.municipio_id = m.id
WHERE co.latitud IS NOT NULL

UNION ALL

SELECT
    'SUPERMERCADO' AS tipo_actor,
    s.id::TEXT AS actor_id,
    s.nombre,
    'supermercado' AS subtipo,
    s.estado,
    s.latitud,
    s.longitud,
    z.nombre AS zona,
    m.nombre AS municipio
FROM supermercados s
LEFT JOIN zona z ON s.zona_id = z.id
LEFT JOIN municipio m ON s.municipio_id = m.id
WHERE s.latitud IS NOT NULL AND s.estado = 'ACTIVO';

COMMIT;

-- =========================================================
-- FIN: 016_railway_spatial_setup.sql
-- =========================================================
