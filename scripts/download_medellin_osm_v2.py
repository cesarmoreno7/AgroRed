"""
Download Medellín's comunas with full geometry from OpenStreetMap.
Builds polygons from relation->way->node chain.
"""
import requests
import json
import os
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

query = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"="8"]["name"~"^Comuna"];
);
out body;
>;
out skel qt;
"""

print("Descargando comunas de Medellín desde Overpass API...")
r = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
print(f"Status: {r.status_code}, Size: {len(r.content)//1024} KB")
osm = r.json()
elements = osm.get("elements", [])

# Parse into types
nodes = {}
ways = {}
relations = []

for e in elements:
    if e["type"] == "node":
        nodes[e["id"]] = (e["lon"], e["lat"])
    elif e["type"] == "way":
        ways[e["id"]] = e.get("nd", [])
    elif e["type"] == "relation":
        relations.append(e)

print(f"Parsed: {len(relations)} rels, {len(ways)} ways, {len(nodes)} nodes")

# Debug: show first relation structure
if relations:
    rel0 = relations[0]
    tags = rel0.get("tags", {})
    members = rel0.get("members", [])
    print(f"\nDebug rel[0]: name={tags.get('name')}")
    print(f"  Members: {len(members)}")
    for m in members[:5]:
        print(f"    type={m['type']} ref={m['ref']} role={m.get('role','(none)')}")
    
    # Check if ways exist
    outer_ways = [m for m in members if m["type"] == "way" and m.get("role", "") in ("outer", "")]
    print(f"  Outer ways: {len(outer_ways)}")
    for w in outer_ways[:3]:
        wid = w["ref"]
        if wid in ways:
            nds = ways[wid]
            print(f"    Way {wid}: {len(nds)} nodes, first={nds[0] if nds else '?'}, in_nodes={nds[0] in nodes if nds else False}")
        else:
            print(f"    Way {wid}: NOT FOUND in ways dict")


def merge_way_coords(way_ids, ways_dict, nodes_dict):
    """Get coordinate lists for a sequence of ways and merge them into a ring."""
    segments = []
    for wid in way_ids:
        if wid not in ways_dict:
            continue
        node_ids = ways_dict[wid]
        coords = []
        for nid in node_ids:
            if nid in nodes_dict:
                coords.append(nodes_dict[nid])
        if coords:
            segments.append(coords)

    if not segments:
        return []

    # Merge segments into continuous rings
    merged = [list(segments[0])]
    used = {0}
    
    changed = True
    while changed:
        changed = False
        for i, seg in enumerate(segments):
            if i in used or not seg:
                continue
            for ring in merged:
                if ring[-1] == seg[0]:
                    ring.extend(seg[1:])
                    used.add(i)
                    changed = True
                    break
                elif ring[-1] == seg[-1]:
                    ring.extend(reversed(seg[:-1]))  
                    used.add(i)
                    changed = True
                    break
                elif ring[0] == seg[-1]:
                    merged[merged.index(ring)] = seg[:-1] + ring
                    used.add(i)
                    changed = True
                    break
                elif ring[0] == seg[0]:
                    merged[merged.index(ring)] = list(reversed(seg[1:])) + ring
                    used.add(i)
                    changed = True
                    break
        
        # Start new ring for unconnected segments
        unmatched = [i for i in range(len(segments)) if i not in used]
        if unmatched and not changed:
            idx = unmatched[0]
            merged.append(list(segments[idx]))
            used.add(idx)
            changed = True

    # Close rings
    for ring in merged:
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])

    return merged


features = []
for rel in relations:
    tags = rel.get("tags", {})
    name = tags.get("name", "?")
    
    # Get outer way IDs
    outer_wids = []
    for m in rel.get("members", []):
        if m["type"] == "way":
            role = m.get("role", "")
            if role in ("outer", ""):
                outer_wids.append(m["ref"])

    if not outer_wids:
        print(f"  SKIP {name}: no outer ways")
        continue

    rings = merge_way_coords(outer_wids, ways, nodes)
    
    if not rings or all(len(r) < 4 for r in rings):
        print(f"  SKIP {name}: could not build valid ring (got {len(rings)} rings)")
        continue

    # Filter out degenerate rings
    valid_rings = [r for r in rings if len(r) >= 4]
    
    if len(valid_rings) == 1:
        geom = {"type": "Polygon", "coordinates": [valid_rings[0]]}
    else:
        geom = {"type": "MultiPolygon", "coordinates": [[r] for r in valid_rings]}

    props = {
        "osm_id": rel["id"],
        "name": name,
        "admin_level": tags.get("admin_level", ""),
        "wikidata": tags.get("wikidata", ""),
    }
    features.append({"type": "Feature", "properties": props, "geometry": geom})
    npts = sum(len(r) for r in valid_rings)
    print(f"  OK {name}: {geom['type']}, {npts} puntos")

print(f"\nTotal: {len(features)} comunas con geometría")

# Export
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "geojson")
os.makedirs(out_dir, exist_ok=True)

fc = {"type": "FeatureCollection", "features": features}
fp = os.path.join(out_dir, "comunas_medellin_osm.geojson")
with open(fp, "w", encoding="utf-8") as f:
    json.dump(fc, f, ensure_ascii=False)
print(f"\nExportado: {fp} ({os.path.getsize(fp)//1024} KB)")

# Now wait and download corregimientos
print("\nEsperando 10s antes de la siguiente consulta (rate limit)...")
time.sleep(10)

print("\n" + "=" * 60)
print("Descargando corregimientos (admin_level=7)...")
print("=" * 60)

query2 = """
[out:json][timeout:120];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"="7"];
);
out body;
>;
out skel qt;
"""

r2 = requests.post(OVERPASS_URL, data={"data": query2}, timeout=180)
print(f"Status: {r2.status_code}, Size: {len(r2.content)//1024} KB")

if r2.status_code == 200 and r2.content:
    osm2 = r2.json()
    els2 = osm2.get("elements", [])
    nodes2 = {e["id"]: (e["lon"], e["lat"]) for e in els2 if e["type"] == "node"}
    ways2 = {e["id"]: e.get("nd", []) for e in els2 if e["type"] == "way"}
    rels2 = [e for e in els2 if e["type"] == "relation"]
    
    features2 = []
    for rel in rels2:
        tags = rel.get("tags", {})
        name = tags.get("name", "?")
        outer_wids = [m["ref"] for m in rel.get("members", []) 
                      if m["type"] == "way" and m.get("role", "") in ("outer", "")]
        rings = merge_way_coords(outer_wids, ways2, nodes2)
        valid_rings = [r for r in rings if len(r) >= 4]
        if valid_rings:
            geom = {"type": "Polygon", "coordinates": [valid_rings[0]]} if len(valid_rings) == 1 else {"type": "MultiPolygon", "coordinates": [[r] for r in valid_rings]}
            features2.append({"type": "Feature", "properties": {"osm_id": rel["id"], "name": name, "admin_level": "7"}, "geometry": geom})
            print(f"  OK {name}")
    
    fc2 = {"type": "FeatureCollection", "features": features2}
    fp2 = os.path.join(out_dir, "corregimientos_medellin_osm.geojson")
    with open(fp2, "w", encoding="utf-8") as f:
        json.dump(fc2, f, ensure_ascii=False)
    print(f"Exportado: {fp2} ({os.path.getsize(fp2)//1024} KB)")
else:
    print(f"  Error: HTTP {r2.status_code}")

# Summary
print("\n" + "=" * 60)
print("RESUMEN")
print("=" * 60)
print(f"  Comunas:         {len(features)}/16")
print(f"  Corregimientos:  {len(features2) if 'features2' in dir() else '?'}")
print(f"\nArchivos en: {out_dir}")
