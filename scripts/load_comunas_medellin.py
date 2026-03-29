"""
Load real OSM comunas + corregimientos polygons into the agrored.comuna table.
Updates existing records by matching nombre/numero, inserts missing ones.
"""
import json
import re
import psycopg2

DB = dict(host='localhost', port=5432, dbname='agrored', user='777', password='777')
MEDELLIN_ID = 1  # municipio_id for Medellín

# Mapping: OSM name -> (numero, db_nombre)
# Medellín has 16 comunas (1-16) + 5 corregimientos (50-90)
COMUNA_MAP = {
    "Comuna 1 - Popular":          (1,  "Popular"),
    "Comuna 2 - Santa Cruz":       (2,  "Santa Cruz"),
    "Comuna 3 - Manrique":         (3,  "Manrique"),
    "Comuna 4 - Aranjuez":         (4,  "Aranjuez"),
    "Comuna 5 - Castilla":         (5,  "Castilla"),
    "Comuna 6 - Doce de Octubre":  (6,  "Doce de Octubre"),
    "Comuna 7 - Robledo":          (7,  "Robledo"),
    "Comuna 8 - Villa Hermosa":    (8,  "Villa Hermosa"),
    "Comuna 9 - Buenos Aires":     (9,  "Buenos Aires"),
    "Comuna 10 - La Candelaria":   (10, "La Candelaria"),
    "Comuna 11 - Laureles-Estadio":(11, "Laureles-Estadio"),
    "Comuna 12 - La América":      (12, "La América"),
    "Comuna 13 - San Javier":      (13, "San Javier"),
    "Comuna 14 - El Poblado":      (14, "El Poblado"),
    "Comuna 15 - Guayabal":        (15, "Guayabal"),
    "Comuna 16 - Belén":           (16, "Belén"),
}

CORREG_MAP = {
    "San Sebastián de Palmitas":   (50, "San Sebastián de Palmitas"),
    "San Cristóbal":               (60, "San Cristóbal"),
    "Altavista":                   (70, "Altavista"),
    "San Antonio de Prado":        (80, "San Antonio de Prado"),
    "Santa Elena":                 (90, "Santa Elena"),
    # "Perímetro Urbano Medellín" is the urban boundary, not a corregimiento
}


def load_geojson(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def upsert_comuna(cur, numero, nombre, geom_json, municipio_id):
    """Update if exists by numero+municipio, otherwise insert."""
    # Try update first
    cur.execute("""
        UPDATE comuna
        SET geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326),
            nombre = %s
        WHERE numero = %s AND municipio_id = %s
        RETURNING id
    """, (geom_json, nombre, numero, municipio_id))
    
    row = cur.fetchone()
    if row:
        return 'UPDATE', row[0]
    
    # Insert
    cur.execute("""
        INSERT INTO comuna (nombre, numero, municipio_id, codigo, geom)
        VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
        RETURNING id
    """, (nombre, numero, municipio_id,
          f"05001-C{numero:02d}", geom_json))
    
    return 'INSERT', cur.fetchone()[0]


def main():
    print("=" * 60)
    print("Carga de comunas OSM reales -> PostGIS agrored")
    print("=" * 60)

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    # 1. Load comunas GeoJSON
    print("\n1. Cargando comunas (16)...")
    comunas_fc = load_geojson("data/geojson/comunas_medellin_osm.geojson")
    
    updated = 0
    inserted = 0
    for feat in comunas_fc["features"]:
        osm_name = feat["properties"]["name"]
        if osm_name not in COMUNA_MAP:
            print(f"   SKIP: {osm_name} (no mapping)")
            continue
        
        numero, db_name = COMUNA_MAP[osm_name]
        geom_json = json.dumps(feat["geometry"])
        action, cid = upsert_comuna(cur, numero, db_name, geom_json, MEDELLIN_ID)
        
        if action == 'UPDATE':
            updated += 1
            print(f"   UPDATE #{cid}: {db_name} (C{numero:02d})")
        else:
            inserted += 1
            print(f"   INSERT #{cid}: {db_name} (C{numero:02d})")
    
    print(f"   Comunas: {updated} actualizadas, {inserted} insertadas")

    # 2. Load corregimientos GeoJSON
    print("\n2. Cargando corregimientos (5)...")
    correg_fc = load_geojson("data/geojson/corregimientos_medellin_osm.geojson")
    
    up2 = ins2 = 0
    for feat in correg_fc["features"]:
        osm_name = feat["properties"]["name"]
        if osm_name not in CORREG_MAP:
            continue
        
        numero, db_name = CORREG_MAP[osm_name]
        geom_json = json.dumps(feat["geometry"])
        action, cid = upsert_comuna(cur, numero, db_name, geom_json, MEDELLIN_ID)
        
        if action == 'UPDATE':
            up2 += 1
            print(f"   UPDATE #{cid}: {db_name} (C{numero:02d})")
        else:
            ins2 += 1
            print(f"   INSERT #{cid}: {db_name} (C{numero:02d})")
    
    print(f"   Corregimientos: {up2} actualizados, {ins2} insertados")

    # 3. Commit
    conn.commit()
    print("\n3. COMMIT OK")

    # 4. Verify
    print("\n4. Verificación:")
    cur.execute("""
        SELECT c.nombre, c.numero, 
               ST_GeometryType(c.geom) AS tipo,
               ROUND(ST_Area(c.geom::geography)::NUMERIC/1000000, 2) AS area_km2,
               ST_NPoints(c.geom) AS points
        FROM comuna c
        WHERE c.municipio_id = %s
        ORDER BY c.numero
    """, (MEDELLIN_ID,))
    
    print(f"   {'Nombre':<30} {'#':>3} {'Tipo':<18} {'Área km²':>10} {'Puntos':>7}")
    print("   " + "-" * 72)
    for row in cur.fetchall():
        print(f"   {row[0]:<30} {row[1]:>3} {row[2]:<18} {row[3]:>10} {row[4]:>7}")

    cur.close()
    conn.close()
    print("\nCarga finalizada.")


if __name__ == '__main__':
    main()
