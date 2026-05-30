"""Download Medellín's comunas and barrios from OpenStreetMap Overpass API."""
import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

query = """
[out:json][timeout:60];
area["name"="Medellín"]["admin_level"="6"]->.mde;
(
  relation(area.mde)["boundary"="administrative"]["admin_level"~"^[789]$"];
);
out tags;
"""

print("Querying Overpass API for Medellín admin boundaries...")
r = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
print(f"Status: {r.status_code}, Size: {len(r.content)} bytes")

data = r.json()
elements = data.get("elements", [])
print(f"Total elements: {len(elements)}")

by_level = {}
for el in elements:
    tags = el.get("tags", {})
    level = tags.get("admin_level", "?")
    name = tags.get("name", "?")
    by_level.setdefault(level, []).append({"id": el["id"], "name": name})

for level in sorted(by_level.keys()):
    items = by_level[level]
    print(f"\nadmin_level={level} ({len(items)} elements):")
    for item in sorted(items, key=lambda x: x["name"])[:20]:
        print(f"  - {item['name']} (relation/{item['id']})")
    if len(items) > 20:
        print(f"  ... y {len(items)-20} mas")
