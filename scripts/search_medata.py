"""Search MEData CKAN API for spatial datasets."""
import requests, json

queries = ['barrios', 'comunas', 'manzana', 'catastro', 'geojson', 'shapefile', 'territorio', 'division']

for q in queries:
    try:
        url = f'https://medata.gov.co/api/3/action/package_search?q={q}&rows=10'
        r = requests.get(url, timeout=15)
        data = r.json()
        if data.get('success'):
            results = data['result']['results']
            print(f'\n=== "{q}" ({len(results)} resultados) ===')
            for ds in results[:5]:
                title = ds.get('title', '?')
                formats = [res.get('format', '?') for res in ds.get('resources', [])]
                print(f'  - {title}  [{", ".join(formats)}]')
                for res in ds.get('resources', []):
                    fmt = res.get('format', '').lower()
                    if fmt in ('geojson', 'shp', 'shapefile', 'gpkg', 'wms', 'wfs', 'geopackage'):
                        print(f'    >> {res["format"]}: {res.get("url", "")}')
    except Exception as e:
        print(f'Error ({q}): {e}')
