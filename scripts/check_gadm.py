import requests, json

r = requests.get('https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_COL_1.json', timeout=30)
data = r.json()
feats = data['features']
print(f'Total features: {len(feats)}')
f0 = feats[0]['properties']
print('Properties keys:', list(f0.keys()))

targets = ['Antioquia','Valle del Cauca','Cundinamarca','Santander','Boyacá','Nariño']
for f in feats:
    p = f['properties']
    name = p.get('NAME_1','')
    for t in targets:
        if t.lower() in name.lower() or name.lower() in t.lower():
            geom_type = f['geometry']['type']
            print(f"  {name:25} CC_1={p.get('CC_1','?'):5} HASC={p.get('HASC_1','?'):8} geom={geom_type}")
