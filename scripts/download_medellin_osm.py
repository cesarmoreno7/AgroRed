"""
Download Medellín's comunas (level 8) with full geometry from OpenStreetMap,
and export as GeoJSON. Then optionally load into PostGIS.
"""
import requests
import json
import os
import sys

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Step 1: Get comunas with full geometry
print("=" * 60)
print("Descargando comunas de Medellín desde OpenStreetMap...")
print("=" * 60)

query_comunas = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"="8"]["name"~"^Comuna"];
);
out body;
>;
out skel qt;
"""

print("\n1. Descargando comunas (relations + ways + nodes)...")
r = requests.post(OVERPASS_URL, data={"data": query_comunas}, timeout=180)
print(f"   Status: {r.status_code}, Size: {len(r.content)//1024} KB")
osm_data = r.json()

elements = osm_data.get("elements", [])
nodes = {e["id"]: (e["lon"], e["lat"]) for e in elements if e["type"] == "node"}
ways = {}
for e in elements:
    if e["type"] == "way":
        coords = [nodes[n] for n in e.get("nd", []) if n in nodes]
        ways[e["id"]] = coords

relations = [e for e in elements if e["type"] == "relation"]
print(f"   {len(relations)} relations, {len(ways)} ways, {len(nodes)} nodes")


def build_polygon_from_relation(rel, ways_dict):
    """Build a polygon from a relation's outer members."""
    outer_rings = []
    for member in rel.get("members", []):
        if member.get("type") == "way" and member.get("role", "outer") == "outer":
            wid = member["ref"]
            if wid in ways_dict:
                outer_rings.append(ways_dict[wid])

    if not outer_rings:
        return None

    # Merge connected rings
    merged = []
    current = list(outer_rings[0])
    used = {0}

    max_iter = len(outer_rings) * 2
    for _ in range(max_iter):
        found = False
        for i, ring in enumerate(outer_rings):
            if i in used:
                continue
            if not ring:
                continue
            # Check if ring connects to current tail
            if current[-1] == ring[0]:
                current.extend(ring[1:])
                used.add(i)
                found = True
            elif current[-1] == ring[-1]:
                current.extend(list(reversed(ring))[1:])
                used.add(i)
                found = True
            elif current[0] == ring[-1]:
                current = ring + current[1:]
                used.add(i)
                found = True
            elif current[0] == ring[0]:
                current = list(reversed(ring)) + current[1:]
                used.add(i)
                found = True
        if not found:
            if current:
                merged.append(current)
            # Start new ring from unused
            remaining = [i for i in range(len(outer_rings)) if i not in used]
            if remaining:
                idx = remaining[0]
                current = list(outer_rings[idx])
                used.add(idx)
            else:
                break

    if current and current not in merged:
        merged.append(current)

    # Close rings
    for ring in merged:
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])

    if len(merged) == 1:
        return {"type": "Polygon", "coordinates": [merged[0]]}
    elif len(merged) > 1:
        return {"type": "MultiPolygon", "coordinates": [[r] for r in merged]}
    return None


# Build GeoJSON features
print("\n2. Construyendo geometrías...")
features = []
for rel in relations:
    tags = rel.get("tags", {})
    name = tags.get("name", "")
    
    if not name.startswith("Comuna"):
        continue

    geom = build_polygon_from_relation(rel, ways)
    if geom:
        props = {
            "osm_id": rel["id"],
            "name": name,
            "admin_level": tags.get("admin_level", ""),
            "wikidata": tags.get("wikidata", ""),
        }
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": geom
        })
        ncoords = sum(len(r) for r in (geom.get("coordinates", [[]])))
        print(f"   {name}: {geom['type']}, ~{ncoords} coords")

print(f"\n   Total comunas con geometría: {len(features)}")

# Export to GeoJSON
out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "geojson")
os.makedirs(out_dir, exist_ok=True)

fc = {"type": "FeatureCollection", "features": features}
filepath = os.path.join(out_dir, "comunas_medellin_osm.geojson")
with open(filepath, "w", encoding="utf-8") as f:
    json.dump(fc, f, ensure_ascii=False)
print(f"\n3. Exportado: {filepath} ({os.path.getsize(filepath)//1024} KB)")

# Step 2: Download corregimientos (admin_level=7)
print("\n" + "=" * 60)
print("Descargando corregimientos de Medellín...")
print("=" * 60)

query_correg = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"="7"];
);
out body;
>;
out skel qt;
"""

print("\n4. Descargando corregimientos...")
r2 = requests.post(OVERPASS_URL, data={"data": query_correg}, timeout=180)
print(f"   Status: {r2.status_code}, Size: {len(r2.content)//1024} KB")
osm_data2 = r2.json()

elements2 = osm_data2.get("elements", [])
nodes2 = {e["id"]: (e["lon"], e["lat"]) for e in elements2 if e["type"] == "node"}
ways2 = {}
for e in elements2:
    if e["type"] == "way":
        coords = [nodes2[n] for n in e.get("nd", []) if n in nodes2]
        ways2[e["id"]] = coords

relations2 = [e for e in elements2 if e["type"] == "relation"]
print(f"   {len(relations2)} relations")

features2 = []
for rel in relations2:
    tags = rel.get("tags", {})
    name = tags.get("name", "")
    geom = build_polygon_from_relation(rel, ways2)
    if geom:
        props = {
            "osm_id": rel["id"],
            "name": name,
            "admin_level": tags.get("admin_level", ""),
        }
        features2.append({
            "type": "Feature",
            "properties": props,
            "geometry": geom
        })
        print(f"   {name}: {geom['type']}")

fc2 = {"type": "FeatureCollection", "features": features2}
filepath2 = os.path.join(out_dir, "corregimientos_medellin_osm.geojson")
with open(filepath2, "w", encoding="utf-8") as f:
    json.dump(fc2, f, ensure_ascii=False)
print(f"\n5. Exportado: {filepath2} ({os.path.getsize(filepath2)//1024} KB)")

# Step 3: Download barrios (admin_level=9)
print("\n" + "=" * 60)
print("Descargando barrios de Medellín (los que estén en OSM)...")
print("=" * 60)

query_barrios = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"="9"];
);
out body;
>;
out skel qt;
"""

print("\n6. Descargando barrios...")
r3 = requests.post(OVERPASS_URL, data={"data": query_barrios}, timeout=180)
print(f"   Status: {r3.status_code}, Size: {len(r3.content)//1024} KB")
osm_data3 = r3.json()

elements3 = osm_data3.get("elements", [])
nodes3 = {e["id"]: (e["lon"], e["lat"]) for e in elements3 if e["type"] == "node"}
ways3 = {}
for e in elements3:
    if e["type"] == "way":
        coords = [nodes3[n] for n in e.get("nd", []) if n in nodes3]
        ways3[e["id"]] = coords

relations3 = [e for e in elements3 if e["type"] == "relation"]
print(f"   {len(relations3)} relations")

features3 = []
for rel in relations3:
    tags = rel.get("tags", {})
    name = tags.get("name", "")
    geom = build_polygon_from_relation(rel, ways3)
    if geom:
        props = {
            "osm_id": rel["id"],
            "name": name,
            "admin_level": tags.get("admin_level", ""),
        }
        features3.append({
            "type": "Feature",
            "properties": props,
            "geometry": geom
        })
        print(f"   {name}: {geom['type']}")

fc3 = {"type": "FeatureCollection", "features": features3}
filepath3 = os.path.join(out_dir, "barrios_medellin_osm.geojson")
with open(filepath3, "w", encoding="utf-8") as f:
    json.dump(fc3, f, ensure_ascii=False)
print(f"\n7. Exportado: {filepath3} ({os.path.getsize(filepath3)//1024} KB)")

# Summary
print("\n" + "=" * 60)
print("RESUMEN")
print("=" * 60)
print(f"  Comunas (admin_level=8):        {len(features)} polígonos")
print(f"  Corregimientos (admin_level=7):  {len(features2)} polígonos")
print(f"  Barrios (admin_level=9):         {len(features3)} polígonos")
print(f"\nArchivos GeoJSON en: {out_dir}")
print("\nNOTA: OSM tiene las 16 comunas completas.")
print("Para barrios y manzanas catastral, se requiere acceso a GeoMedellín.")
