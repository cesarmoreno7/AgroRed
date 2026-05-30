import requests, json

r = requests.get('https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_COL_2.json', timeout=60)
data = r.json()
feats = data['features']
print(f'Total features (municipios): {len(feats)}')
f0 = feats[0]['properties']
print('Properties keys:', list(f0.keys()))

targets = {
    'Medellín': 'Antioquia', 'Envigado': 'Antioquia', 'Itagüí': 'Antioquia',
    'Bello': 'Antioquia', 'Rionegro': 'Antioquia', 'Santa Fe de Antioquia': 'Antioquia',
    'Cali': 'Valle del Cauca', 'Palmira': 'Valle del Cauca', 'Buenaventura': 'Valle del Cauca',
    'Bogotá': 'Cundinamarca', 'Soacha': 'Cundinamarca', 'Zipaquirá': 'Cundinamarca',
    'Bucaramanga': 'Santander', 'Barrancabermeja': 'Santander',
    'Tunja': 'Boyacá', 'Duitama': 'Boyacá',
    'Pasto': 'Nariño', 'Tumaco': 'Nariño'
}

alt_names = {
    'Medellín': ['medellin','medellín'],
    'Envigado': ['envigado'],
    'Itagüí': ['itagui','itagüí'],
    'Bello': ['bello'],
    'Rionegro': ['rionegro'],
    'Santa Fe de Antioquia': ['santa fe de antioquia','santafe de antioquia'],
    'Cali': ['cali','santiago de cali'],
    'Palmira': ['palmira'],
    'Buenaventura': ['buenaventura'],
    'Bogotá': ['bogota','bogotá','santa fe de bogotá','santafe de bogota','bogotá, d.c.'],
    'Soacha': ['soacha'],
    'Zipaquirá': ['zipaquira','zipaquirá'],
    'Bucaramanga': ['bucaramanga'],
    'Barrancabermeja': ['barrancabermeja'],
    'Tunja': ['tunja'],
    'Duitama': ['duitama'],
    'Pasto': ['pasto'],
    'Tumaco': ['tumaco','san andrés de tumaco']
}

found = set()
for f in feats:
    p = f['properties']
    name2 = p.get('NAME_2','').lower().strip()
    name1 = p.get('NAME_1','').lower().strip()
    for target, dept in targets.items():
        for alt in alt_names[target]:
            if alt.lower() == name2 or alt.lower() in name2:
                geom = f['geometry']['type']
                ncoords = len(json.dumps(f['geometry']))
                print(f"  FOUND: {target:25} -> NAME_2={p['NAME_2']:25} NAME_1={p['NAME_1']:20} CC_2={p.get('CC_2','?'):8} geom={geom} size={ncoords}")
                found.add(target)

missing = set(targets.keys()) - found
if missing:
    print(f'\nMISSING: {missing}')

# Check if Bogota is in a different NAME_1
for f in feats:
    p = f['properties']
    n2 = p.get('NAME_2','').lower()
    if 'bogot' in n2:
        print(f"  Bogota match: NAME_2={p['NAME_2']} NAME_1={p['NAME_1']} CC_2={p.get('CC_2','?')}")
