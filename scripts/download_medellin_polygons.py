"""
Download Medellín comunas from polygons.openstreetmap.fr and OSM Nominatim.
Uses the relation IDs found earlier to get GeoJSON directly.
"""
import requests
import json
import os
import time

# Relation IDs from earlier Overpass query
COMUNAS = {
    "Comuna 1 - Popular": 7680903,
    "Comuna 2 - Santa Cruz": 7680904,
    "Comuna 3 - Manrique": 7680859,
    "Comuna 4 - Aranjuez": 7677386,
    "Comuna 5 - Castilla": 7680807,
    "Comuna 6 - Doce de Octubre": 7680403,
    "Comuna 7 - Robledo": 7680678,
    "Comuna 8 - Villa Hermosa": 11937925,
    "Comuna 9 - Buenos Aires": 7673971,
    "Comuna 10 - La Candelaria": 7673972,
    "Comuna 11 - Laureles-Estadio": 7680490,
    "Comuna 12 - La América": 7680799,
    "Comuna 13 - San Javier": 7680798,
    "Comuna 14 - El Poblado": 7673973,
    "Comuna 15 - Guayabal": 7676069,
    "Comuna 16 - Belén": 7676068,
}

CORREGIMIENTOS = {
    "Altavista": 3541283,
    "Perímetro Urbano Medellín": 3541280,
    "San Antonio de Prado": 3541286,
    "San Cristóbal": 3541285,
    "San Sebastián de Palmitas": 3541284,
    "Santa Elena": 3541287,
}


def download_osm_polygon(rel_id, name):
    """Download polygon from polygons.openstreetmap.fr"""
    url = f"https://polygons.openstreetmap.fr/get_geojson.py?id={rel_id}&params=0"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            geom = r.json()
            return geom
    except Exception as e:
        pass
    
    # Fallback: Nominatim
    url2 = f"https://nominatim.openstreetmap.org/details.php?osmtype=R&osmid={rel_id}&polygon_geojson=1&format=json"
    headers = {"User-Agent": "AgroRed/1.0 (educational project)"}
    try:
        r2 = requests.get(url2, headers=headers, timeout=30)
        if r2.status_code == 200:
            data = r2.json()
            geom = data.get("geometry")
            if geom:
                return geom
    except Exception:
        pass
    
    return None


out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "geojson")
os.makedirs(out_dir, exist_ok=True)

# Download comunas
print("=" * 60)
print("Descargando 16 comunas de Medellín")
print("=" * 60)

comuna_features = []
for name, rel_id in sorted(COMUNAS.items(), key=lambda x: int(x[0].split()[1])):
    geom = download_osm_polygon(rel_id, name)
    if geom:
        f = {
            "type": "Feature",
            "properties": {"name": name, "osm_relation": rel_id},
            "geometry": geom
        }
        comuna_features.append(f)
        gtype = geom.get("type", "?")
        print(f"  OK {name}: {gtype}")
    else:
        print(f"  FAIL {name}")
    time.sleep(1.5)  # Be nice to the server

fc1 = {"type": "FeatureCollection", "features": comuna_features}
fp1 = os.path.join(out_dir, "comunas_medellin_osm.geojson")
with open(fp1, "w", encoding="utf-8") as f:
    json.dump(fc1, f, ensure_ascii=False)
print(f"\nGuardado: {fp1} ({os.path.getsize(fp1)//1024} KB)")

# Download corregimientos
print("\n" + "=" * 60)
print("Descargando corregimientos de Medellín")
print("=" * 60)

correg_features = []
for name, rel_id in sorted(CORREGIMIENTOS.items()):
    geom = download_osm_polygon(rel_id, name)
    if geom:
        f = {
            "type": "Feature",
            "properties": {"name": name, "osm_relation": rel_id},
            "geometry": geom
        }
        correg_features.append(f)
        print(f"  OK {name}: {geom.get('type','?')}")
    else:
        print(f"  FAIL {name}")
    time.sleep(1.5)

fc2 = {"type": "FeatureCollection", "features": correg_features}
fp2 = os.path.join(out_dir, "corregimientos_medellin_osm.geojson")
with open(fp2, "w", encoding="utf-8") as f:
    json.dump(fc2, f, ensure_ascii=False)
print(f"\nGuardado: {fp2} ({os.path.getsize(fp2)//1024} KB)")

# Summary
print("\n" + "=" * 60)
print("RESUMEN")
print("=" * 60)
print(f"  Comunas:         {len(comuna_features)}/16")
print(f"  Corregimientos:  {len(correg_features)}/6")
