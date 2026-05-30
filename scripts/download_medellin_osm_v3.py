"""
Download Medellín comunas/corregimientos from OSM using out:geom for direct geometry.
"""
import requests
import json
import os
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def download_layer(query, label):
    """Download a layer from Overpass and build GeoJSON features."""
    print(f"\nDescargando {label}...")
    r = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
    print(f"  Status: {r.status_code}, Size: {len(r.content)//1024} KB")
    
    if r.status_code != 200:
        print(f"  ERROR: HTTP {r.status_code}")
        return []
    
    osm = r.json()
    elements = osm.get("elements", [])
    
    features = []
    for el in elements:
        if el["type"] != "relation":
            continue
        
        tags = el.get("tags", {})
        name = tags.get("name", "?")
        members = el.get("members", [])
        
        # Collect outer rings from way members that have geometry
        outer_segments = []
        for m in members:
            if m.get("type") == "way" and m.get("role", "outer") in ("outer", ""):
                geom = m.get("geometry", [])
                if geom:
                    coords = [(pt["lon"], pt["lat"]) for pt in geom]
                    outer_segments.append(coords)
        
        if not outer_segments:
            print(f"  SKIP {name}: no geometry in members")
            continue
        
        # Merge segments into rings
        rings = merge_segments(outer_segments)
        valid = [r for r in rings if len(r) >= 4]
        
        if not valid:
            print(f"  SKIP {name}: no valid rings after merging")
            continue
        
        if len(valid) == 1:
            geom = {"type": "Polygon", "coordinates": [valid[0]]}
        else:
            geom = {"type": "MultiPolygon", "coordinates": [[r] for r in valid]}
        
        props = {
            "osm_id": el["id"],
            "name": name,
            "admin_level": tags.get("admin_level", ""),
            "wikidata": tags.get("wikidata", ""),
        }
        features.append({"type": "Feature", "properties": props, "geometry": geom})
        print(f"  OK {name}")
    
    return features


def merge_segments(segments):
    """Merge line segments into closed rings."""
    if not segments:
        return []
    
    rings = []
    current = list(segments[0])
    used = {0}
    
    max_loops = len(segments) * 3
    for _ in range(max_loops):
        found = False
        for i, seg in enumerate(segments):
            if i in used or len(seg) < 2:
                continue
            
            # Try to connect
            if _close_enough(current[-1], seg[0]):
                current.extend(seg[1:])
                used.add(i)
                found = True
            elif _close_enough(current[-1], seg[-1]):
                current.extend(list(reversed(seg))[1:])
                used.add(i)
                found = True
            elif _close_enough(current[0], seg[-1]):
                current = seg[:-1] + current
                used.add(i)
                found = True
            elif _close_enough(current[0], seg[0]):
                current = list(reversed(seg))[:-1] + current
                used.add(i)
                found = True
            
            if found:
                break
        
        if not found:
            # Close current ring and start new one
            if len(current) >= 3:
                if current[0] != current[-1]:
                    current.append(current[0])
                rings.append(current)
            
            remaining = [i for i in range(len(segments)) if i not in used]
            if remaining:
                idx = remaining[0]
                current = list(segments[idx])
                used.add(idx)
            else:
                break
    
    # Don't forget last ring
    if len(current) >= 3 and current not in rings:
        if current[0] != current[-1]:
            current.append(current[0])
        rings.append(current)
    
    return rings


def _close_enough(p1, p2, tol=1e-7):
    """Check if two points are close enough (same location)."""
    return abs(p1[0] - p2[0]) < tol and abs(p1[1] - p2[1]) < tol


def save_geojson(features, filename, out_dir):
    fc = {"type": "FeatureCollection", "features": features}
    fp = os.path.join(out_dir, filename)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    size = os.path.getsize(fp) // 1024
    print(f"  Guardado: {fp} ({size} KB, {len(features)} features)")
    return fp


# ─── Main ────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "geojson")
os.makedirs(out_dir, exist_ok=True)

# 1. Comunas (admin_level=8)
q_comunas = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
relation(area.mde)["boundary"="administrative"]["admin_level"="8"]["name"~"^Comuna"];
out geom;
"""

comunas = download_layer(q_comunas, "Comunas de Medellín (admin_level=8)")
save_geojson(comunas, "comunas_medellin_osm.geojson", out_dir)

# 2. Corregimientos (admin_level=7) — wait to avoid rate limit
time.sleep(12)

q_correg = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
relation(area.mde)["boundary"="administrative"]["admin_level"="7"];
out geom;
"""

correg = download_layer(q_correg, "Corregimientos de Medellín (admin_level=7)")
save_geojson(correg, "corregimientos_medellin_osm.geojson", out_dir)

# 3. Barrios (admin_level=9) — these are partial in OSM
time.sleep(12)

q_barrios = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
relation(area.mde)["boundary"="administrative"]["admin_level"="9"];
out geom;
"""

barrios = download_layer(q_barrios, "Barrios de Medellín (admin_level=9)")
save_geojson(barrios, "barrios_medellin_osm.geojson", out_dir)

# Summary
print("\n" + "=" * 60)
print("RESUMEN - Datos OSM Medellín")
print("=" * 60)
print(f"  Comunas (16 oficiales):      {len(comunas)} descargadas")
print(f"  Corregimientos (5 oficiales): {len(correg)} descargados")
print(f"  Barrios (parcial en OSM):     {len(barrios)} descargados")
print(f"\nArchivos en: {out_dir}")
