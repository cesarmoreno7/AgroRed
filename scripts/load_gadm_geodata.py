"""
load_gadm_geodata.py — AGRORED
Descarga polígonos oficiales GADM (Colombia) y actualiza las geometrías
en la base de datos PostgreSQL/PostGIS.

Fuente: GADM v4.1 — https://gadm.org
  Level 0: País (Colombia)
  Level 1: Departamentos
  Level 2: Municipios

Uso:
  python scripts/load_gadm_geodata.py
"""

import json
import sys
import requests
import psycopg2

# ─── Config ──────────────────────────────────────────
DB = dict(host='localhost', port=5432, dbname='agrored', user='777', password='777')

GADM_L0 = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_COL_0.json'
GADM_L1 = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_COL_1.json'
GADM_L2 = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_COL_2.json'

# Mapeo NAME_1 GADM → nombre en nuestra BD
DEPT_MAP = {
    'Antioquia':         'Antioquia',
    'ValledelCauca':     'Valle del Cauca',
    'Cundinamarca':      'Cundinamarca',
    'Santander':         'Santander',
    'Boyacá':            'Boyacá',
    'Nariño':            'Nariño',
}

# Mapeo exacto (NAME_2, NAME_1) GADM → nombre en nuestra BD
MPIO_MAP = {
    ('Medellín',        'Antioquia'):         'Medellín',
    ('Envigado',        'Antioquia'):         'Envigado',
    ('Itagüí',          'Antioquia'):         'Itagüí',
    ('Bello',           'Antioquia'):         'Bello',
    ('Rionegro',        'Antioquia'):         'Rionegro',
    ('SantaFédeAntioquia','Antioquia'):       'Santa Fe de Antioquia',
    ('SantaFedeAntioquia','Antioquia'):       'Santa Fe de Antioquia',
    ('SantiagodeCali',  'ValledelCauca'):     'Cali',
    ('Palmira',         'ValledelCauca'):     'Palmira',
    ('Buenaventura',    'ValledelCauca'):     'Buenaventura',
    ('BogotáD.C.',      'BogotáD.C.'):        'Bogotá',
    ('Soacha',          'Cundinamarca'):      'Soacha',
    ('Zipaquirá',       'Cundinamarca'):      'Zipaquirá',
    ('Bucaramanga',     'Santander'):         'Bucaramanga',
    ('Barrancabermeja',  'Santander'):        'Barrancabermeja',
    ('Tunja',           'Boyacá'):            'Tunja',
    ('Duitama',         'Boyacá'):            'Duitama',
    ('SanJuandePasto',  'Nariño'):            'Pasto',
    ('Tumaco',          'Nariño'):            'Tumaco',
}


def download_json(url, label):
    """Download GeoJSON from URL."""
    print(f'  Descargando {label}...', end=' ', flush=True)
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(f'{len(data["features"])} features ({len(r.content)//1024} KB)')
    return data


def update_pais(cur, geojson_l0):
    """Update Colombia geometry from GADM L0."""
    for f in geojson_l0['features']:
        if f['properties'].get('COUNTRY') == 'Colombia':
            geom_json = json.dumps(f['geometry'])
            cur.execute("""
                UPDATE pais
                SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                WHERE codigo_iso = 'CO'
            """, (geom_json,))
            print(f'    País Colombia: geom actualizada ({f["geometry"]["type"]})')
            return
    print('    WARN: Colombia no encontrado en L0')


def update_departamentos(cur, geojson_l1):
    """Update department geometries from GADM L1."""
    updated = 0
    for f in geojson_l1['features']:
        gadm_name = f['properties'].get('NAME_1', '')
        db_name = DEPT_MAP.get(gadm_name)
        if db_name:
            geom_json = json.dumps(f['geometry'])
            cur.execute("""
                UPDATE departamento
                SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                WHERE nombre = %s
            """, (geom_json, db_name))
            if cur.rowcount > 0:
                updated += 1
                print(f'    Depto {db_name}: OK')
            else:
                print(f'    Depto {db_name}: NOT FOUND in DB')
    print(f'  Departamentos actualizados: {updated}/6')


def update_municipios(cur, geojson_l2):
    """Update municipality geometries from GADM L2."""
    updated = 0
    for f in geojson_l2['features']:
        name2 = f['properties'].get('NAME_2', '')
        name1 = f['properties'].get('NAME_1', '')
        key = (name2, name1)
        db_name = MPIO_MAP.get(key)
        if db_name:
            geom_json = json.dumps(f['geometry'])
            cur.execute("""
                UPDATE municipio
                SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                WHERE nombre = %s
            """, (geom_json, db_name))
            if cur.rowcount > 0:
                updated += 1
                print(f'    Mpio {db_name}: OK')
            else:
                print(f'    Mpio {db_name}: NOT FOUND in DB (key={key})')
    print(f'  Municipios actualizados: {updated}/18')
    return updated


def update_bogota_special(cur, geojson_l1):
    """Bogotá is both a department and city — use L1 Bogotá D.C. as department geometry."""
    for f in geojson_l1['features']:
        name = f['properties'].get('NAME_1', '')
        if 'Bogot' in name:
            geom_json = json.dumps(f['geometry'])
            # Bogotá is in departamento Cundinamarca but is actually D.C.
            # It is stored as municipio in our DB under departamento Cundinamarca
            # The L1 geometry for BogotáD.C. is the whole district
            cur.execute("""
                UPDATE municipio
                SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                WHERE nombre = 'Bogotá' AND geom IS NULL
            """, (geom_json,))
            if cur.rowcount > 0:
                print(f'    Bogotá (from L1 as fallback): OK')


def try_santa_fe(cur, geojson_l2):
    """Try to find Santa Fe de Antioquia with alternate spellings."""
    for f in geojson_l2['features']:
        name2 = f['properties'].get('NAME_2', '')
        name1 = f['properties'].get('NAME_1', '')
        if name1 == 'Antioquia' and 'santa' in name2.lower() and 'antioquia' in name2.lower():
            geom_json = json.dumps(f['geometry'])
            cur.execute("""
                UPDATE municipio
                SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                WHERE nombre = 'Santa Fe de Antioquia'
            """, (geom_json,))
            if cur.rowcount > 0:
                print(f'    Santa Fe de Antioquia (alt match: {name2}): OK')
                return True
    return False


def generate_zona_geometries(cur):
    """
    Generate approximate zone (barrio/vereda/corregimiento) geometries
    by subdividing the parent municipio polygon.
    These are representative geometries — real cartography should replace them.
    """
    print('\n  Generando geometrías aproximadas para zonas...')

    # Get municipios that have geometry
    cur.execute("""
        SELECT m.id, m.nombre, ST_AsText(m.geom) IS NOT NULL as has_geom
        FROM municipio m
        WHERE m.geom IS NOT NULL
    """)
    mpios_with_geom = {r[0]: r[1] for r in cur.fetchall() if r[2]}

    # For each municipio, get its zones and create subdivisions
    total = 0
    for mpio_id, mpio_name in mpios_with_geom.items():
        cur.execute("""
            SELECT id, nombre, tipo FROM zona
            WHERE municipio_id = %s
            ORDER BY tipo, nombre
        """, (mpio_id,))
        zonas = cur.fetchall()
        if not zonas:
            continue

        n = len(zonas)
        # Use ST_Subdivide or simple grid approach
        # We'll create a voronoi-like subdivision of the municipio
        for i, (zona_id, zona_nombre, zona_tipo) in enumerate(zonas):
            # Create a buffer-shrunk piece of the municipio for each zone
            # Offset fraction to create different sub-areas
            frac = i / max(n, 1)
            next_frac = (i + 1) / max(n, 1)

            # Use a clipping approach: take a horizontal strip of the municipio
            cur.execute("""
                WITH bbox AS (
                    SELECT
                        ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
                        ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax,
                        geom
                    FROM municipio WHERE id = %s
                ),
                strip AS (
                    SELECT ST_Intersection(
                        geom,
                        ST_MakeEnvelope(
                            xmin,
                            ymin + (ymax - ymin) * %s,
                            xmax,
                            ymin + (ymax - ymin) * %s,
                            4326
                        )
                    ) AS geom
                    FROM bbox
                )
                UPDATE zona
                SET geom = CASE
                    WHEN ST_IsEmpty((SELECT geom FROM strip)) THEN zona.geom
                    WHEN ST_GeometryType((SELECT geom FROM strip)) = 'ST_GeometryCollection'
                        THEN ST_Multi(ST_CollectionExtract((SELECT geom FROM strip), 3))
                    WHEN ST_GeometryType((SELECT geom FROM strip)) IN ('ST_Polygon','ST_MultiPolygon')
                        THEN ST_Multi((SELECT geom FROM strip))
                    ELSE zona.geom
                END
                WHERE id = %s
                  AND ST_GeometryType(
                      CASE
                          WHEN ST_IsEmpty((SELECT geom FROM strip)) THEN NULL
                          WHEN ST_GeometryType((SELECT geom FROM strip)) = 'ST_GeometryCollection'
                              THEN ST_Multi(ST_CollectionExtract((SELECT geom FROM strip), 3))
                          WHEN ST_GeometryType((SELECT geom FROM strip)) IN ('ST_Polygon','ST_MultiPolygon')
                              THEN ST_Multi((SELECT geom FROM strip))
                          ELSE NULL
                      END
                  ) IN ('ST_MultiPolygon','ST_Polygon')
            """, (mpio_id, frac, next_frac, zona_id))

            if cur.rowcount > 0:
                total += 1

        print(f'    {mpio_name}: {len(zonas)} zonas actualizadas')

    print(f'  Total zonas con geometría generada: {total}')


def generate_comuna_geometries(cur):
    """Generate approximate comuna geometries from parent municipio."""
    print('\n  Generando geometrías aproximadas para comunas...')

    cur.execute("""
        SELECT c.id, c.nombre, c.numero, c.municipio_id, m.nombre AS mpio
        FROM comuna c
        JOIN municipio m ON c.municipio_id = m.id
        WHERE m.geom IS NOT NULL
        ORDER BY c.municipio_id, c.numero
    """)
    comunas = cur.fetchall()

    # Group by municipio
    by_mpio = {}
    for cid, cname, cnum, mid, mname in comunas:
        by_mpio.setdefault(mid, []).append((cid, cname, cnum))

    total = 0
    for mpio_id, comm_list in by_mpio.items():
        n = len(comm_list)
        for i, (cid, cname, cnum) in enumerate(comm_list):
            frac = i / max(n, 1)
            next_frac = (i + 1) / max(n, 1)

            cur.execute("""
                WITH bbox AS (
                    SELECT
                        ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
                        ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax,
                        geom
                    FROM municipio WHERE id = %s
                ),
                strip AS (
                    SELECT ST_Intersection(
                        geom,
                        ST_MakeEnvelope(
                            xmin + (xmax - xmin) * %s,
                            ymin,
                            xmin + (xmax - xmin) * %s,
                            ymax,
                            4326
                        )
                    ) AS geom
                    FROM bbox
                )
                UPDATE comuna
                SET geom = CASE
                    WHEN ST_IsEmpty((SELECT geom FROM strip)) THEN comuna.geom
                    WHEN ST_GeometryType((SELECT geom FROM strip)) = 'ST_GeometryCollection'
                        THEN ST_Multi(ST_CollectionExtract((SELECT geom FROM strip), 3))
                    WHEN ST_GeometryType((SELECT geom FROM strip)) IN ('ST_Polygon','ST_MultiPolygon')
                        THEN ST_Multi((SELECT geom FROM strip))
                    ELSE comuna.geom
                END
                WHERE id = %s
                  AND ST_GeometryType(
                      CASE
                          WHEN ST_IsEmpty((SELECT geom FROM strip)) THEN NULL
                          WHEN ST_GeometryType((SELECT geom FROM strip)) = 'ST_GeometryCollection'
                              THEN ST_Multi(ST_CollectionExtract((SELECT geom FROM strip), 3))
                          WHEN ST_GeometryType((SELECT geom FROM strip)) IN ('ST_Polygon','ST_MultiPolygon')
                              THEN ST_Multi((SELECT geom FROM strip))
                          ELSE NULL
                      END
                  ) IN ('ST_MultiPolygon','ST_Polygon')
            """, (mpio_id, frac, next_frac, cid))

            if cur.rowcount > 0:
                total += 1

    print(f'  Total comunas con geometría generada: {total}')


def generate_manzana_geometries(cur):
    """Generate approximate manzana geometries from parent zona."""
    print('\n  Generando geometrías aproximadas para manzanas...')

    cur.execute("""
        SELECT mz.id, mz.codigo, mz.zona_id
        FROM manzana mz
        JOIN zona z ON mz.zona_id = z.id
        WHERE z.geom IS NOT NULL
        ORDER BY mz.zona_id, mz.id
    """)
    manzanas = cur.fetchall()

    by_zona = {}
    for mid, mcode, zid in manzanas:
        by_zona.setdefault(zid, []).append((mid, mcode))

    total = 0
    for zona_id, mz_list in by_zona.items():
        n = len(mz_list)
        for i, (mz_id, mz_code) in enumerate(mz_list):
            frac = i / max(n, 1)
            next_frac = (i + 1) / max(n, 1)

            cur.execute("""
                WITH bbox AS (
                    SELECT
                        ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
                        ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax,
                        geom
                    FROM zona WHERE id = %s
                ),
                cell AS (
                    SELECT ST_Intersection(
                        geom,
                        ST_MakeEnvelope(
                            xmin + (xmax - xmin) * %s,
                            ymin,
                            xmin + (xmax - xmin) * %s,
                            ymax,
                            4326
                        )
                    ) AS geom
                    FROM bbox
                )
                UPDATE manzana
                SET geom = CASE
                    WHEN ST_IsEmpty((SELECT geom FROM cell)) THEN manzana.geom
                    WHEN ST_GeometryType((SELECT geom FROM cell)) IN ('ST_Polygon','ST_MultiPolygon')
                        THEN (SELECT geom FROM cell)
                    WHEN ST_GeometryType((SELECT geom FROM cell)) = 'ST_GeometryCollection'
                        THEN ST_CollectionExtract((SELECT geom FROM cell), 3)
                    ELSE manzana.geom
                END
                WHERE id = %s
            """, (zona_id, frac, next_frac, mz_id))

            if cur.rowcount > 0:
                total += 1

    print(f'  Total manzanas con geometría generada: {total}')


def save_geojson_files(conn):
    """Export each layer to GeoJSON for QGIS/ArcGIS direct use."""
    import os
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'geojson')
    os.makedirs(out_dir, exist_ok=True)

    layers = [
        ('departamentos', "SELECT id, nombre, codigo_dane, ST_AsGeoJSON(geom) AS geojson FROM departamento WHERE geom IS NOT NULL"),
        ('municipios',    "SELECT id, nombre, codigo_dane, ST_AsGeoJSON(geom) AS geojson FROM municipio WHERE geom IS NOT NULL"),
        ('zonas',         "SELECT id, nombre, tipo, codigo_zona, ST_AsGeoJSON(geom) AS geojson FROM zona WHERE geom IS NOT NULL"),
        ('comunas',       "SELECT id, nombre, numero, codigo, ST_AsGeoJSON(geom) AS geojson FROM comuna WHERE geom IS NOT NULL"),
        ('manzanas',      "SELECT id, codigo, codigo_catastral, ST_AsGeoJSON(geom) AS geojson FROM manzana WHERE geom IS NOT NULL"),
    ]

    cur = conn.cursor()
    for name, sql in layers:
        cur.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        geojson_idx = cols.index('geojson')

        features = []
        for row in rows:
            props = {cols[i]: row[i] for i in range(len(cols)) if i != geojson_idx}
            geom = json.loads(row[geojson_idx]) if row[geojson_idx] else None
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": geom
            })

        fc = {"type": "FeatureCollection", "features": features}
        filepath = os.path.join(out_dir, f'{name}.geojson')
        with open(filepath, 'w', encoding='utf-8') as fh:
            json.dump(fc, fh, ensure_ascii=False, indent=2)
        print(f'    {filepath}: {len(features)} features')

    cur.close()


def main():
    print('=' * 60)
    print('AGRORED — Carga de Geodatos GADM Colombia')
    print('=' * 60)

    # 1. Download
    print('\n1. Descargando datos GADM...')
    l0 = download_json(GADM_L0, 'País (L0)')
    l1 = download_json(GADM_L1, 'Departamentos (L1)')
    l2 = download_json(GADM_L2, 'Municipios (L2)')

    # 2. Connect to DB
    print('\n2. Conectando a PostgreSQL...')
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    print('  Conectado OK')

    try:
        # 3. Update País
        print('\n3. Actualizando geometría del país...')
        update_pais(cur, l0)

        # 4. Update Departamentos
        print('\n4. Actualizando geometrías de departamentos...')
        update_departamentos(cur, l1)

        # 5. Update Municipios
        print('\n5. Actualizando geometrías de municipios...')
        count = update_municipios(cur, l2)

        # Special cases
        update_bogota_special(cur, l1)
        try_santa_fe(cur, l2)

        # Check for missing municipios
        cur.execute("SELECT nombre FROM municipio WHERE geom IS NULL OR ST_IsEmpty(geom)")
        missing = [r[0] for r in cur.fetchall()]
        if missing:
            print(f'\n  WARN: Municipios sin geometría: {missing}')
            # Try fuzzy match for remaining
            for m_name in missing:
                search = m_name.lower().replace(' de ', '').replace(' ', '')
                for f in l2['features']:
                    n2 = f['properties'].get('NAME_2', '').lower().replace(' ', '')
                    if search in n2 or n2 in search:
                        n1 = f['properties'].get('NAME_1', '')
                        geom_json = json.dumps(f['geometry'])
                        cur.execute("""
                            UPDATE municipio
                            SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                            WHERE nombre = %s AND (geom IS NULL OR ST_IsEmpty(geom))
                        """, (geom_json, m_name))
                        if cur.rowcount > 0:
                            print(f'    {m_name} (fuzzy: {f["properties"]["NAME_2"]}): OK')
                            break

        # 6. Generate sub-municipality geometries
        print('\n6. Generando geometrías de zonas (subdivisiones de municipio)...')
        generate_zona_geometries(cur)

        print('\n7. Generando geometrías de comunas...')
        generate_comuna_geometries(cur)

        print('\n8. Generando geometrías de manzanas...')
        generate_manzana_geometries(cur)

        # 9. Commit
        conn.commit()
        print('\n9. COMMIT exitoso — todos los datos guardados.')

        # 10. Export GeoJSON
        print('\n10. Exportando capas a GeoJSON...')
        save_geojson_files(conn)

        # 11. Final report
        print('\n' + '=' * 60)
        print('RESUMEN FINAL')
        print('=' * 60)
        for table, col in [('pais','geom'), ('departamento','geom'), ('municipio','geom'),
                           ('zona','geom'), ('comuna','geom'), ('manzana','geom')]:
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NOT NULL AND NOT ST_IsEmpty({col})")
            total = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            all_rows = cur.fetchone()[0]
            pct = (total / all_rows * 100) if all_rows > 0 else 0
            status = '✓' if pct == 100 else '⚠'
            print(f'  {status} {table:15}: {total}/{all_rows} con geometría ({pct:.0f}%)')

    except Exception as e:
        conn.rollback()
        print(f'\nERROR: {e}')
        raise
    finally:
        cur.close()
        conn.close()

    print('\nCarga finalizada correctamente.')
    print('Los archivos GeoJSON están en: data/geojson/')
    print('Puedes abrirlos directamente en QGIS o ArcGIS.')


if __name__ == '__main__':
    main()
