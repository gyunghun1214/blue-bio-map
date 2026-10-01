"""Download the bundled map library (Leaflet) into dist/vendor."""
from pathlib import Path
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'dist'
assets=[('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','vendor/leaflet.js'),('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','vendor/leaflet.css'),('https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE','vendor/LEAFLET-LICENSE')]  # countries.json (1:10m outline) is built by prepare_basemap.py
def asset(pair):
    url,name=pair
    data=urlopen(url,timeout=45).read()
    p=out/name;p.parent.mkdir(exist_ok=True);p.write_bytes(data)
    return {'file':name,'bytes':len(data)}
print(list(ThreadPoolExecutor(4).map(asset,assets)))
