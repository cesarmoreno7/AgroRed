"""
load_geodata_railway.py
Carga los datos territoriales y geometrías (como JSONB) en Railway PostgreSQL.

Fuente: datos locales de la base agrored + archivos GeoJSON exportados.
Destino: Railway PostgreSQL (sin PostGIS, geometrías en JSONB).
"""

import json
import os
import sys
import psycopg2

# ─── Configuración Railway ────────────────────────────────────────────
RAILWAY_DSN = "postgresql://postgres:KhEyjUdkKsexOklSwCVtPsnzrsSMssOY@gondola.proxy.rlwy.net:24101/railway"

# ─── Configuración local ──────────────────────────────────────────────
LOCAL_DSN = "postgresql://777:777@localhost:5432/agrored"

# ─── Directorio de GeoJSON ────────────────────────────────────────────
GEOJSON_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "geojson")


def load_from_local_db(local_conn, railway_conn):
    """
    Lee la jerarquía territorial completa desde la BD local (PostGIS)
    y la inserta en Railway con geometrías convertidas a GeoJSON (JSONB).
    """
    local_cur = local_conn.cursor()
    rw_cur = railway_conn.cursor()

    # ── 1. País ──────────────────────────────────────────────
    print("\n[1/8] Cargando países...")
    local_cur.execute("""
        SELECT id, nombre, codigo_iso, ST_AsGeoJSON(geom)::JSONB
        FROM pais ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO pais (id, nombre, codigo_iso, geom)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (codigo_iso) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], json.dumps(r[3]) if r[3] else None))
    print(f"  → {len(rows)} países")

    # ── 2. Departamentos ─────────────────────────────────────
    print("[2/8] Cargando departamentos...")
    local_cur.execute("""
        SELECT id, nombre, pais_id, codigo_dane, ST_AsGeoJSON(geom)::JSONB
        FROM departamento ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO departamento (id, nombre, pais_id, codigo_dane, geom)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                codigo_dane = EXCLUDED.codigo_dane,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], json.dumps(r[4]) if r[4] else None))
    print(f"  → {len(rows)} departamentos")

    # ── 3. Municipios ────────────────────────────────────────
    print("[3/8] Cargando municipios...")
    local_cur.execute("""
        SELECT id, nombre, departamento_id, codigo_dane, ST_AsGeoJSON(geom)::JSONB
        FROM municipio ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO municipio (id, nombre, departamento_id, codigo_dane, geom)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                codigo_dane = EXCLUDED.codigo_dane,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], json.dumps(r[4]) if r[4] else None))
    print(f"  → {len(rows)} municipios")

    # ── 4. Comunas ───────────────────────────────────────────
    print("[4/8] Cargando comunas...")
    local_cur.execute("""
        SELECT id, nombre, numero, tipo, municipio_id, codigo, ST_AsGeoJSON(geom)::JSONB
        FROM comuna ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO comuna (id, nombre, numero, tipo, municipio_id, codigo, geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                numero = EXCLUDED.numero,
                tipo = EXCLUDED.tipo,
                codigo = EXCLUDED.codigo,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], r[4], r[5],
              json.dumps(r[6]) if r[6] else None))
    print(f"  → {len(rows)} comunas")

    # ── 5. Zonas ─────────────────────────────────────────────
    print("[5/8] Cargando zonas...")
    local_cur.execute("""
        SELECT id, nombre, tipo, municipio_id, comuna_id, codigo_zona,
               ST_AsGeoJSON(geom)::JSONB
        FROM zona ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO zona (id, nombre, tipo, municipio_id, comuna_id, codigo_zona, geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                tipo = EXCLUDED.tipo,
                comuna_id = EXCLUDED.comuna_id,
                codigo_zona = EXCLUDED.codigo_zona,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], r[4], r[5],
              json.dumps(r[6]) if r[6] else None))
    print(f"  → {len(rows)} zonas")

    # ── 6. Manzanas ──────────────────────────────────────────
    print("[6/8] Cargando manzanas...")
    local_cur.execute("""
        SELECT id, codigo, zona_id, codigo_catastral, ST_AsGeoJSON(geom)::JSONB
        FROM manzana ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO manzana (id, codigo, zona_id, codigo_catastral, geom)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                codigo = EXCLUDED.codigo,
                codigo_catastral = EXCLUDED.codigo_catastral,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], json.dumps(r[4]) if r[4] else None))
    print(f"  → {len(rows)} manzanas")

    # ── 7. Predios ───────────────────────────────────────────
    print("[7/8] Cargando predios...")
    local_cur.execute("""
        SELECT id, codigo, zona_id, manzana_id, codigo_catastral,
               ST_AsGeoJSON(geom)::JSONB
        FROM predio ORDER BY id
    """)
    rows = local_cur.fetchall()
    for r in rows:
        rw_cur.execute("""
            INSERT INTO predio (id, codigo, zona_id, manzana_id, codigo_catastral, geom)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                codigo = EXCLUDED.codigo,
                codigo_catastral = EXCLUDED.codigo_catastral,
                geom = EXCLUDED.geom
        """, (r[0], r[1], r[2], r[3], r[4],
              json.dumps(r[5]) if r[5] else None))
    print(f"  → {len(rows)} predios")

    # ── 8. Viviendas, habitantes, censo ──────────────────────
    print("[8/8] Cargando modelo poblacional...")

    local_cur.execute("SELECT id, predio_id, direccion, tipo, estrato, num_pisos FROM vivienda ORDER BY id")
    viviendas = local_cur.fetchall()
    for r in viviendas:
        rw_cur.execute("""
            INSERT INTO vivienda (id, predio_id, direccion, tipo, estrato, num_pisos)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, r)
    print(f"  → {len(viviendas)} viviendas")

    local_cur.execute("""
        SELECT id, vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco, activo
        FROM habitante ORDER BY id
    """)
    habitantes = local_cur.fetchall()
    for r in habitantes:
        rw_cur.execute("""
            INSERT INTO habitante (id, vivienda_id, nombre, documento, fecha_nacimiento, genero, parentesco, activo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (documento) DO NOTHING
        """, r)
    print(f"  → {len(habitantes)} habitantes")

    local_cur.execute("""
        SELECT id, fecha, nivel, referencia_id, total_viviendas, total_habitantes,
               total_hogares, densidad_hab_km2, fuente
        FROM censo ORDER BY id
    """)
    censos = local_cur.fetchall()
    for r in censos:
        rw_cur.execute("""
            INSERT INTO censo (id, fecha, nivel, referencia_id, total_viviendas,
                              total_habitantes, total_hogares, densidad_hab_km2, fuente)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, r)
    print(f"  → {len(censos)} registros de censo")

    # ── 9. Comedores ─────────────────────────────────────────
    print("\n[Extra] Cargando comedores...")
    local_cur.execute("""
        SELECT id, nombre, tipo, direccion, capacidad_diaria, beneficiarios_actuales,
               horario_atencion, responsable, telefono, zona_id, comuna_id, municipio_id,
               estado, ST_Y(geom) AS lat, ST_X(geom) AS lon,
               metadata, created_at, updated_at
        FROM comedor ORDER BY id
    """)
    comedores = local_cur.fetchall()
    for r in comedores:
        row = list(r)
        # metadata (index 15) puede ser dict, convertir a JSON string
        if isinstance(row[15], dict):
            row[15] = json.dumps(row[15])
        rw_cur.execute("""
            INSERT INTO comedor (id, nombre, tipo, direccion, capacidad_diaria,
                                beneficiarios_actuales, horario_atencion, responsable,
                                telefono, zona_id, comuna_id, municipio_id, estado,
                                latitud, longitud, metadata, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, row)
    print(f"  → {len(comedores)} comedores")

    # ── Resetear secuencias ──────────────────────────────────
    print("\n[Seq] Ajustando secuencias...")
    tables_with_seq = ['pais', 'departamento', 'municipio', 'comuna', 'zona',
                       'manzana', 'predio', 'vivienda', 'habitante', 'censo', 'comedor']
    for tbl in tables_with_seq:
        rw_cur.execute(f"""
            SELECT setval(pg_get_serial_sequence('{tbl}', 'id'),
                          COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1, false)
        """)
    print("  → Secuencias ajustadas")

    railway_conn.commit()
    local_cur.close()
    rw_cur.close()


def verify_railway(conn):
    """Verificación final del estado de Railway."""
    cur = conn.cursor()

    print("\n" + "=" * 60)
    print("VERIFICACIÓN RAILWAY")
    print("=" * 60)

    tables = [
        ('pais', None),
        ('departamento', 'codigo_dane'),
        ('municipio', 'codigo_dane'),
        ('comuna', 'codigo'),
        ('zona', 'codigo_zona'),
        ('manzana', 'codigo_catastral'),
        ('predio', 'codigo_catastral'),
        ('vivienda', None),
        ('habitante', None),
        ('censo', None),
        ('comedor', None),
        ('irat_zonas', None),
        ('incidencias_sociales', None),
        ('beneficiarios_zona', None),
        ('supermercados', None),
        ('productos_proximos_vencer', None),
        ('operadores_logisticos', None),
        ('rutas_logisticas', None),
    ]

    for tbl, code_col in tables:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        count = cur.fetchone()[0]
        geom_info = ""
        if code_col:
            cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE {code_col} IS NOT NULL")
            code_count = cur.fetchone()[0]
            geom_info = f" | códigos: {code_count}"
        # Check geom JSONB
        cur.execute(f"""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = '{tbl}' AND column_name = 'geom'
        """)
        has_geom = cur.fetchone()[0] > 0
        if has_geom:
            cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE geom IS NOT NULL")
            geom_count = cur.fetchone()[0]
            geom_info += f" | geom: {geom_count}"
        print(f"  {tbl:30s} → {count:>4d} registros{geom_info}")

    # Verificar vistas
    cur.execute("""
        SELECT viewname FROM pg_views
        WHERE schemaname = 'public'
        ORDER BY viewname
    """)
    views = [r[0] for r in cur.fetchall()]
    print(f"\n  Vistas creadas: {len(views)}")
    for v in views:
        print(f"    • {v}")

    # Verificar columnas FK en producers
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'producers' AND column_name IN ('municipio_id', 'zona_id', 'comuna_id')
        ORDER BY column_name
    """)
    fk_cols = [r[0] for r in cur.fetchall()]
    print(f"\n  FK territoriales en producers: {', '.join(fk_cols) if fk_cols else 'NINGUNA'}")

    print("=" * 60)
    cur.close()


def main():
    print("=" * 60)
    print("AGRORED — Carga de datos territoriales a Railway")
    print("(sin PostGIS: geometrías como GeoJSON en JSONB)")
    print("=" * 60)

    # Conectar a ambas bases
    print("\nConectando a base local...")
    local_conn = psycopg2.connect(LOCAL_DSN)
    print("  ✓ Local conectada")

    print("Conectando a Railway...")
    railway_conn = psycopg2.connect(RAILWAY_DSN)
    print("  ✓ Railway conectada")

    try:
        load_from_local_db(local_conn, railway_conn)
        verify_railway(railway_conn)
        print("\n✅ Carga completada exitosamente.")
    except Exception as e:
        railway_conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        local_conn.close()
        railway_conn.close()


if __name__ == "__main__":
    main()
