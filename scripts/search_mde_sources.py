"""
Search for Medellín's comunas and barrios polygon data from multiple sources.
"""
import requests
import json

# 1. Try Overpass API (OpenStreetMap) for Medellín admin boundaries
print("=" * 60)
print("1. OpenStreetMap Overpass - Comunas y Barrios de Medellín")
print("=" * 60)

overpass_url = "https://overpass-api.de/api/interpreter"

# Query for admin boundaries within Medellín (level 7 = comunas, level 8+ = barrios)
overpass_query = """
[out:json][timeout:60];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["admin_level"~"^(7|8|9)$"]["boundary"="administrative"];
);
out tags;
"""

try:
    r = requests.post(overpass_url, data={"data": overpass_query}, timeout=90)
    data = r.json()
    elements = data.get("elements", [])
    print(f"  Encontrados: {len(elements)} elements")
    
    by_level = {}
    for el in elements:
        tags = el.get("tags", {})
        level = tags.get("admin_level", "?")
        name = tags.get("name", "?")
        by_level.setdefault(level, []).append(name)
    
    for level in sorted(by_level.keys()):
        names = by_level[level]
        print(f"\n  admin_level={level} ({len(names)} elements):")
        for n in sorted(names)[:15]:
            print(f"    - {n}")
        if len(names) > 15:
            print(f"    ... y {len(names)-15} más")
except Exception as e:
    print(f"  Error: {e}")

# 2. Try ArcGIS Hub search for Medellín datasets
print("\n" + "=" * 60)
print("2. ArcGIS Hub - Datasets de Medellín")
print("=" * 60)

hub_url = "https://hub.arcgis.com/api/v3/datasets"
params = {
    "q": "Medellín comunas barrios",
    "per_page": 10,
}
try:
    r = requests.get(hub_url, params=params, timeout=30)
    data = r.json()
    datasets = data.get("data", [])
    print(f"  Encontrados: {len(datasets)} datasets")
    for ds in datasets[:10]:
        attrs = ds.get("attributes", {})
        name = attrs.get("name", "?")
        source = attrs.get("source", "?") 
        url = attrs.get("url", "?")
        print(f"  - {name}")
        print(f"    source: {source}")
        print(f"    url: {url}")
except Exception as e:
    print(f"  Error: {e}")

# 3. Try GeoMedellín API for geographic catalog
print("\n" + "=" * 60)
print("3. GeoMedellín API - Catálogo geográfico")
print("=" * 60)

api_urls = [
    "https://www.medellin.gov.co/apigeomedellin/api/datosabiertos",
    "https://www.medellin.gov.co/apigeomedellin/api/geoservicios",
    "https://www.medellin.gov.co/apigeomedellin/api/catalogo",
]
for url in api_urls:
    try:
        r = requests.get(url, timeout=15)
        print(f"\n  {url}")
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            text = r.text[:500]
            print(f"  Response: {text}")
    except Exception as e:
        print(f"  {url}: Error - {e}")
