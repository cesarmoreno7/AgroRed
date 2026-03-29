-- =========================================================
-- 014_territorial_gis_model.sql
-- AGRORED — Modelo Territorial y Analítico para GIS
--
-- Complementa el modelo espacial existente:
--   pais → departamento → municipio → comuna → zona → manzana → predio
-- con:
--   - Códigos DANE/territoriales para joins con QGIS/ArcGIS
--   - Tablas analíticas (IRAT, incidencias, beneficiarios)
--   - Actores territoriales (supermercados, operadores logísticos)
--   - Rescate alimentario
--   - Vistas GIS para capas temáticas
--
-- Requisitos: PostGIS habilitado (ya existe en el esquema)
-- =========================================================

BEGIN;

-- =========================================================
-- 1. CÓDIGOS DANE / TERRITORIALES EN TABLAS EXISTENTES
--    (esenciales para joins GIS con shapefiles IGAC/DANE)
-- =========================================================

-- 1a. Municipio: agregar codigo_dane
ALTER TABLE municipio
  ADD COLUMN IF NOT EXISTS codigo_dane VARCHAR(10) UNIQUE;

COMMENT ON COLUMN municipio.codigo_dane IS
  'Código DANE oficial del municipio (ej: 05001 para Medellín). Clave de join con shapefiles IGAC/DANE.';

-- 1b. Departamento: agregar codigo_dane
ALTER TABLE departamento
  ADD COLUMN IF NOT EXISTS codigo_dane VARCHAR(5) UNIQUE;

COMMENT ON COLUMN departamento.codigo_dane IS
  'Código DANE del departamento (ej: 05 para Antioquia).';

-- 1c. Zona: agregar codigo_zona para joins GIS
ALTER TABLE zona
  ADD COLUMN IF NOT EXISTS codigo_zona VARCHAR(30) UNIQUE;

COMMENT ON COLUMN zona.codigo_zona IS
  'Código territorial único (barrio/vereda/corregimiento) para join con shapefiles GIS.';

-- 1d. Manzana: agregar codigo_catastral
ALTER TABLE manzana
  ADD COLUMN IF NOT EXISTS codigo_catastral VARCHAR(40) UNIQUE;

COMMENT ON COLUMN manzana.codigo_catastral IS
  'Código catastral IGAC de la manzana para join con shapefiles.';

-- 1e. Comuna: agregar codigo
ALTER TABLE comuna
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE;

COMMENT ON COLUMN comuna.codigo IS
  'Código oficial de la comuna/sector para join con fuentes GIS.';

-- 1f. Predio: agregar codigo_catastral
ALTER TABLE predio
  ADD COLUMN IF NOT EXISTS codigo_catastral VARCHAR(40) UNIQUE;

COMMENT ON COLUMN predio.codigo_catastral IS
  'Código catastral IGAC de predio para join con GIS catastral.';

-- =========================================================
-- 2. IRAT (Índice de Riesgo Alimentario Territorial)
-- =========================================================

CREATE TABLE IF NOT EXISTS irat_zonas (
    id SERIAL PRIMARY KEY,
    tipo_zona VARCHAR(20) NOT NULL
        CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
    referencia_id INT NOT NULL,           -- FK lógica al id del nivel
    codigo_zona VARCHAR(40),              -- Código para join GIS

    -- Dimensiones IRAT
    disponibilidad NUMERIC(5,2) DEFAULT 0
        CHECK (disponibilidad BETWEEN 0 AND 100),
    acceso NUMERIC(5,2) DEFAULT 0
        CHECK (acceso BETWEEN 0 AND 100),
    logistica NUMERIC(5,2) DEFAULT 0
        CHECK (logistica BETWEEN 0 AND 100),
    estabilidad NUMERIC(5,2) DEFAULT 0
        CHECK (estabilidad BETWEEN 0 AND 100),
    incidencias NUMERIC(5,2) DEFAULT 0
        CHECK (incidencias BETWEEN 0 AND 100),

    -- Resultado
    irat_total NUMERIC(5,2) NOT NULL
        CHECK (irat_total BETWEEN 0 AND 100),
    clasificacion VARCHAR(20)
        CHECK (clasificacion IN ('CRITICO','ALTO','MEDIO','BAJO','OPTIMO')),

    fecha_corte DATE NOT NULL,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_irat_zona UNIQUE (tipo_zona, referencia_id, fecha_corte)
);

CREATE INDEX idx_irat_tipo_zona ON irat_zonas(tipo_zona, referencia_id);
CREATE INDEX idx_irat_fecha ON irat_zonas(fecha_corte);
CREATE INDEX idx_irat_clasificacion ON irat_zonas(clasificacion);

COMMENT ON TABLE irat_zonas IS
  'Índice de Riesgo Alimentario Territorial. Cada fila es un cálculo IRAT para una zona en una fecha de corte.';

-- =========================================================
-- 3. INCIDENCIAS SOCIALES
-- =========================================================

CREATE TABLE IF NOT EXISTS incidencias_sociales (
    id SERIAL PRIMARY KEY,
    tipo_incidencia VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Ubicación territorial
    tipo_zona VARCHAR(20) NOT NULL
        CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
    referencia_id INT NOT NULL,
    codigo_zona VARCHAR(40),

    -- Ubicación puntual (optional)
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    geom GEOMETRY(POINT, 4326),

    -- Clasificación
    nivel_riesgo VARCHAR(20)
        CHECK (nivel_riesgo IN ('CRITICO','ALTO','MEDIO','BAJO')),
    prioridad VARCHAR(20)
        CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
    estado VARCHAR(20) DEFAULT 'REPORTADA'
        CHECK (estado IN ('REPORTADA','EN_ANALISIS','PRIORIZADA','EN_GESTION',
                          'INTERVENIDA','CERRADA','ESCALADA')),

    -- Gestión
    fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
    fecha_atencion TIMESTAMPTZ,
    responsable VARCHAR(150),
    fuente_reporte VARCHAR(100),
    usuario_registro VARCHAR(150)
);

CREATE INDEX idx_incidencias_geom ON incidencias_sociales USING GIST(geom);
CREATE INDEX idx_incidencias_zona ON incidencias_sociales(tipo_zona, referencia_id);
CREATE INDEX idx_incidencias_estado ON incidencias_sociales(estado);
CREATE INDEX idx_incidencias_riesgo ON incidencias_sociales(nivel_riesgo);

COMMENT ON TABLE incidencias_sociales IS
  'Incidencias sociales georeferenciadas vinculadas a la jerarquía territorial.';

-- =========================================================
-- 4. BENEFICIARIOS POR ZONA
-- =========================================================

CREATE TABLE IF NOT EXISTS beneficiarios_zona (
    id SERIAL PRIMARY KEY,
    tipo_zona VARCHAR(20) NOT NULL
        CHECK (tipo_zona IN ('MANZANA','ZONA','COMUNA','MUNICIPIO')),
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

    CONSTRAINT uq_beneficiarios_zona
        UNIQUE (tipo_zona, referencia_id, programa, fecha_corte)
);

CREATE INDEX idx_beneficiarios_zona ON beneficiarios_zona(tipo_zona, referencia_id);
CREATE INDEX idx_beneficiarios_programa ON beneficiarios_zona(programa, fecha_corte);

COMMENT ON TABLE beneficiarios_zona IS
  'Cobertura de beneficiarios por programa alimentario y zona territorial.';

-- =========================================================
-- 5. SUPERMERCADOS
-- =========================================================

CREATE TABLE IF NOT EXISTS supermercados (
    id SERIAL PRIMARY KEY,
    nit VARCHAR(30),
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(200),
    telefono VARCHAR(50),
    email VARCHAR(150),
    responsable VARCHAR(150),

    -- Ubicación territorial
    municipio_id INT REFERENCES municipio(id),
    zona_id INT REFERENCES zona(id),
    comuna_id INT REFERENCES comuna(id),

    -- Ubicación geoespacial
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    geom GEOMETRY(POINT, 4326),

    estado VARCHAR(20) DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO','INACTIVO','TEMPORAL')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supermercados_geom ON supermercados USING GIST(geom);
CREATE INDEX idx_supermercados_municipio ON supermercados(municipio_id);
CREATE INDEX idx_supermercados_estado ON supermercados(estado);

COMMENT ON TABLE supermercados IS
  'Supermercados/donantes potenciales de rescate alimentario, georeferenciados.';

-- =========================================================
-- 6. PRODUCTOS PRÓXIMOS A VENCER (rescate alimentario)
-- =========================================================

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
    prioridad_rescate VARCHAR(20)
        CHECK (prioridad_rescate IN ('CRITICA','ALTA','MEDIA','BAJA')),
    estado_rescate VARCHAR(30) DEFAULT 'REPORTADO'
        CHECK (estado_rescate IN ('REPORTADO','EN_EVALUACION','RESCATADO',
                                   'DISTRIBUIDO','DESCARTADO')),
    fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT
);

CREATE INDEX idx_productos_vencer_supermercado ON productos_proximos_vencer(supermercado_id);
CREATE INDEX idx_productos_vencer_fecha ON productos_proximos_vencer(fecha_vencimiento);
CREATE INDEX idx_productos_vencer_estado ON productos_proximos_vencer(estado_rescate);

COMMENT ON TABLE productos_proximos_vencer IS
  'Productos de supermercado próximos a vencer, candidatos para rescate alimentario.';

-- =========================================================
-- 7. OPERADORES LOGÍSTICOS
-- =========================================================

CREATE TABLE IF NOT EXISTS operadores_logisticos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nit VARCHAR(30),
    telefono VARCHAR(50),
    email VARCHAR(150),
    responsable VARCHAR(150),
    cobertura_municipios INT[],         -- Array de municipio.id
    estado VARCHAR(20) DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE operadores_logisticos IS
  'Operadores logísticos para distribución alimentaria.';

-- =========================================================
-- 8. RUTAS LOGÍSTICAS
-- =========================================================

CREATE TABLE IF NOT EXISTS rutas_logisticas (
    id SERIAL PRIMARY KEY,
    operador_id INT REFERENCES operadores_logisticos(id),

    -- Origen
    origen_tipo VARCHAR(30)
        CHECK (origen_tipo IN ('SUPERMERCADO','PRODUCTOR','BODEGA','COMEDOR')),
    origen_id INT,
    origen_nombre VARCHAR(150),

    -- Destino
    destino_tipo VARCHAR(30)
        CHECK (destino_tipo IN ('COMEDOR','BENEFICIARIO','BODEGA','PUNTO_ENTREGA')),
    destino_id INT,
    destino_nombre VARCHAR(150),

    -- Trazado espacial
    geom_ruta GEOMETRY(LINESTRING, 4326),

    distancia_km NUMERIC(10,2),
    tiempo_estimado_min INT,
    estado VARCHAR(20) DEFAULT 'PROGRAMADA'
        CHECK (estado IN ('PROGRAMADA','EN_CURSO','COMPLETADA','CANCELADA')),
    fecha_programada DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rutas_geom ON rutas_logisticas USING GIST(geom_ruta);
CREATE INDEX idx_rutas_operador ON rutas_logisticas(operador_id);
CREATE INDEX idx_rutas_estado ON rutas_logisticas(estado);
CREATE INDEX idx_rutas_fecha ON rutas_logisticas(fecha_programada);

COMMENT ON TABLE rutas_logisticas IS
  'Rutas de distribución logística con trazado espacial para visualización en QGIS/ArcGIS.';

-- =========================================================
-- 9. ÍNDICES ESPACIALES ADICIONALES (si aún no existen)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_pais_geom ON pais USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_departamento_geom ON departamento USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_municipio_geom ON municipio USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_zona_geom ON zona USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_predio_geom ON predio USING GIST(geom);

-- Índices sobre códigos DANE para joins rápidos
CREATE INDEX IF NOT EXISTS idx_municipio_codigo_dane ON municipio(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_departamento_codigo_dane ON departamento(codigo_dane);
CREATE INDEX IF NOT EXISTS idx_zona_codigo ON zona(codigo_zona);
CREATE INDEX IF NOT EXISTS idx_manzana_catastral ON manzana(codigo_catastral);
CREATE INDEX IF NOT EXISTS idx_comuna_codigo ON comuna(codigo);

-- =========================================================
-- 10. VISTAS GIS — Capas temáticas para QGIS/ArcGIS
-- =========================================================

-- 10a. Capa: IRAT por zona (barrios, veredas, corregimientos)
CREATE OR REPLACE VIEW v_gis_irat_zonas AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    z.codigo_zona,
    m.nombre AS municipio,
    m.codigo_dane AS municipio_dane,
    d.nombre AS departamento,
    i.disponibilidad,
    i.acceso,
    i.logistica,
    i.estabilidad,
    i.incidencias,
    i.irat_total,
    i.clasificacion,
    i.fecha_corte,
    z.geom
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

COMMENT ON VIEW v_gis_irat_zonas IS
  'Capa GIS: IRAT más reciente por zona territorial. Cargar en QGIS/ArcGIS como capa de polígonos.';

-- 10b. Capa: IRAT por manzana
CREATE OR REPLACE VIEW v_gis_irat_manzanas AS
SELECT
    mz.id AS manzana_id,
    mz.codigo AS manzana_codigo,
    mz.codigo_catastral,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    m.nombre AS municipio,
    i.irat_total,
    i.clasificacion,
    i.fecha_corte,
    mz.geom
FROM manzana mz
JOIN zona z ON mz.zona_id = z.id
JOIN municipio m ON z.municipio_id = m.id
LEFT JOIN irat_zonas i ON i.tipo_zona = 'MANZANA'
                       AND i.referencia_id = mz.id
                       AND i.fecha_corte = (
                           SELECT MAX(i2.fecha_corte)
                           FROM irat_zonas i2
                           WHERE i2.tipo_zona = 'MANZANA' AND i2.referencia_id = mz.id
                       );

COMMENT ON VIEW v_gis_irat_manzanas IS
  'Capa GIS: IRAT más reciente por manzana. Ideal para análisis de detalle por cuadra.';

-- 10c. Capa: Incidencias sociales
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
    z.nombre AS zona,
    z.tipo AS tipo_zona_nombre,
    m.nombre AS municipio,
    -- Geometría: punto exacto si existe, sino centroide de la zona
    COALESCE(inc.geom, ST_Centroid(z.geom)) AS geom
FROM incidencias_sociales inc
LEFT JOIN zona z ON inc.tipo_zona = 'ZONA' AND inc.referencia_id = z.id
LEFT JOIN municipio m ON z.municipio_id = m.id;

COMMENT ON VIEW v_gis_incidencias IS
  'Capa GIS: Incidencias sociales como puntos. Usa ubicación exacta o centroide de zona.';

-- 10d. Capa: Supermercados (puntos de rescate)
CREATE OR REPLACE VIEW v_gis_supermercados AS
SELECT
    s.id,
    s.nombre,
    s.nit,
    s.direccion,
    s.telefono,
    s.estado,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    (SELECT COUNT(*) FROM productos_proximos_vencer ppv
     WHERE ppv.supermercado_id = s.id
       AND ppv.estado_rescate = 'REPORTADO') AS productos_pendientes,
    s.geom
FROM supermercados s
LEFT JOIN zona z ON s.zona_id = z.id
LEFT JOIN comuna c ON s.comuna_id = c.id
LEFT JOIN municipio m ON s.municipio_id = m.id
WHERE s.estado = 'ACTIVO' AND s.geom IS NOT NULL;

COMMENT ON VIEW v_gis_supermercados IS
  'Capa GIS: Supermercados activos con conteo de productos pendientes de rescate.';

-- 10e. Capa: Comedores + beneficiarios + cobertura
CREATE OR REPLACE VIEW v_gis_comedores_cobertura AS
SELECT
    co.id,
    co.nombre,
    co.tipo,
    co.direccion,
    co.capacidad_diaria,
    co.beneficiarios_actuales,
    co.horario_atencion,
    co.estado,
    z.nombre AS zona,
    c.nombre AS comuna,
    m.nombre AS municipio,
    CASE WHEN co.capacidad_diaria > 0
         THEN ROUND((co.beneficiarios_actuales::NUMERIC / co.capacidad_diaria) * 100, 1)
         ELSE 0 END AS pct_ocupacion,
    co.geom
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN comuna c ON co.comuna_id = c.id
LEFT JOIN municipio m ON co.municipio_id = m.id
WHERE co.geom IS NOT NULL;

COMMENT ON VIEW v_gis_comedores_cobertura IS
  'Capa GIS: Comedores con % de ocupación. Útil para identificar déficit/superávit.';

-- 10f. Capa: Rutas logísticas
CREATE OR REPLACE VIEW v_gis_rutas AS
SELECT
    r.id,
    r.origen_tipo,
    r.origen_nombre,
    r.destino_tipo,
    r.destino_nombre,
    r.distancia_km,
    r.tiempo_estimado_min,
    r.estado,
    r.fecha_programada,
    op.nombre AS operador,
    r.geom_ruta AS geom
FROM rutas_logisticas r
LEFT JOIN operadores_logisticos op ON r.operador_id = op.id
WHERE r.geom_ruta IS NOT NULL;

COMMENT ON VIEW v_gis_rutas IS
  'Capa GIS: Rutas logísticas como líneas. Cargar como capa de líneas en QGIS.';

-- 10g. Capa: Habitantes por zona (join con censo existente)
CREATE OR REPLACE VIEW v_gis_poblacion_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    z.codigo_zona,
    m.nombre AS municipio,
    m.codigo_dane AS municipio_dane,
    d.nombre AS departamento,
    vpz.predios,
    vpz.viviendas,
    vpz.habitantes,
    vpz.area_m2,
    CASE WHEN vpz.area_m2 > 0
         THEN ROUND((vpz.habitantes::NUMERIC / (vpz.area_m2::NUMERIC / 1000000)), 1)
         ELSE 0 END AS densidad_hab_km2,
    z.geom
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN departamento d ON m.departamento_id = d.id
LEFT JOIN v_poblacion_zona vpz ON vpz.zona_id = z.id;

COMMENT ON VIEW v_gis_poblacion_zona IS
  'Capa GIS: Población y densidad por zona. Cruza geometría con datos de censo.';

-- 10h. Capa: Beneficiarios por zona
CREATE OR REPLACE VIEW v_gis_beneficiarios_zona AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo AS tipo_zona,
    z.codigo_zona,
    m.nombre AS municipio,
    bz.programa,
    bz.beneficiarios_total,
    bz.ninos,
    bz.adultos_mayores,
    bz.mujeres_gestantes,
    bz.fecha_corte,
    z.geom
FROM zona z
JOIN municipio m ON z.municipio_id = m.id
JOIN beneficiarios_zona bz ON bz.tipo_zona = 'ZONA'
                            AND bz.referencia_id = z.id;

COMMENT ON VIEW v_gis_beneficiarios_zona IS
  'Capa GIS: Beneficiarios por programa y zona. Para mapas de cobertura alimentaria.';

-- 10i. Capa: Cadena completa — productores → comedores → beneficiarios
CREATE OR REPLACE VIEW v_gis_cadena_alimentaria AS
SELECT
    'PRODUCTOR' AS tipo_actor,
    p.id::TEXT AS actor_id,
    p.organization_name AS nombre,
    p.producer_type AS subtipo,
    p.status AS estado,
    z.nombre AS zona,
    m.nombre AS municipio,
    p.geom
FROM producers p
LEFT JOIN zona z ON p.zona_id = z.id
LEFT JOIN municipio m ON p.municipio_id = m.id
WHERE p.deleted_at IS NULL AND p.geom IS NOT NULL

UNION ALL

SELECT
    'COMEDOR' AS tipo_actor,
    co.id::TEXT AS actor_id,
    co.nombre,
    co.tipo AS subtipo,
    co.estado,
    z.nombre AS zona,
    m.nombre AS municipio,
    co.geom
FROM comedor co
LEFT JOIN zona z ON co.zona_id = z.id
LEFT JOIN municipio m ON co.municipio_id = m.id
WHERE co.geom IS NOT NULL

UNION ALL

SELECT
    'SUPERMERCADO' AS tipo_actor,
    s.id::TEXT AS actor_id,
    s.nombre,
    'supermercado' AS subtipo,
    s.estado,
    z.nombre AS zona,
    m.nombre AS municipio,
    s.geom
FROM supermercados s
LEFT JOIN zona z ON s.zona_id = z.id
LEFT JOIN municipio m ON s.municipio_id = m.id
WHERE s.geom IS NOT NULL AND s.estado = 'ACTIVO';

COMMENT ON VIEW v_gis_cadena_alimentaria IS
  'Capa GIS unificada: todos los actores de la cadena alimentaria (productores, comedores, supermercados) como puntos.';

-- =========================================================
-- 11. VISTA RESUMEN: Dashboard territorial
-- =========================================================

CREATE OR REPLACE VIEW v_dashboard_territorial AS
SELECT
    z.id AS zona_id,
    z.nombre AS zona,
    z.tipo,
    z.codigo_zona,
    m.nombre AS municipio,
    m.codigo_dane,

    -- Población
    (SELECT COUNT(DISTINCT h.id) FROM predio p
     JOIN vivienda v ON v.predio_id = p.id
     JOIN habitante h ON h.vivienda_id = v.id AND h.activo
     WHERE p.zona_id = z.id) AS habitantes,

    -- IRAT
    (SELECT i.irat_total FROM irat_zonas i
     WHERE i.tipo_zona = 'ZONA' AND i.referencia_id = z.id
     ORDER BY i.fecha_corte DESC LIMIT 1) AS irat_actual,

    (SELECT i.clasificacion FROM irat_zonas i
     WHERE i.tipo_zona = 'ZONA' AND i.referencia_id = z.id
     ORDER BY i.fecha_corte DESC LIMIT 1) AS irat_clasificacion,

    -- Incidencias abiertas
    (SELECT COUNT(*) FROM incidencias_sociales inc
     WHERE inc.tipo_zona = 'ZONA' AND inc.referencia_id = z.id
       AND inc.estado NOT IN ('CERRADA','INTERVENIDA')) AS incidencias_abiertas,

    -- Comedores activos
    (SELECT COUNT(*) FROM comedor co
     WHERE co.zona_id = z.id AND co.estado = 'activo') AS comedores_activos,

    -- Productores activos
    (SELECT COUNT(*) FROM producers pr
     WHERE pr.zona_id = z.id AND pr.deleted_at IS NULL) AS productores_activos

FROM zona z
JOIN municipio m ON z.municipio_id = m.id;

COMMENT ON VIEW v_dashboard_territorial IS
  'Vista resumen por zona: población, IRAT, incidencias, comedores, productores. Para dashboards y reportes.';

COMMIT;

-- =========================================================
-- FIN: 014_territorial_gis_model.sql
-- =========================================================
