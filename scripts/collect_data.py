"""Rebuild a bounded, attributed OBIS / WoRMS prototype snapshot."""
import json, math, time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode, quote
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
GEOMETRY = 'POLYGON ((122 30, 136 30, 136 43, 122 43, 122 30))'
CANDIDATES = [('다시마', 'Saccharina japonica', '해조류'), ('참굴', 'Magallana gigas', '패류'), ('돌기해삼', 'Apostichopus japonicus', '해삼류')]

def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent':'BlueBioMap-research-prototype/0.1'}), timeout=45) as res:
                return json.load(res)
        except Exception:
            if attempt == 2: raise
            time.sleep(1)

def collect(candidate):
    ko, name, group = candidate
    worms_url = 'https://www.marinespecies.org/rest/AphiaRecordsByName/' + quote(name) + '?like=false&marine_only=true'
    taxa = get(worms_url)
    assert len(taxa) == 1, ('Ambiguous name',name)
    t = taxa[0]
    aphia = t['valid_AphiaID']
    params = {'taxonid':aphia, 'geometry':GEOMETRY,'size':1000}
    url = 'https://api.obis.org/v3/occurrence?' + urlencode(params)
    response = get(url)
    records = response.get('results',[])
    metadata = {}
    for did in sorted({r['dataset_id'] for r in records}):
        m = get('https://api.obis.org/v3/dataset/' + did)
        metadata[did] = m
    rawdir = ROOT/'tmp'
    rawdir.mkdir(exist_ok=True)
    (rawdir/f'{aphia}-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    (rawdir/f'{aphia}-records.json').write_text(json.dumps(response,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'name':name,'accepted':t['valid_name'],'aphia':aphia,'total':response.get('total'),'retrieved':len(records),'datasets':metadata},ensure_ascii=False))
    return {'label':ko,'name':t['valid_name'],'group':group,'aphiaID':aphia,'wormsUrl':t['url'],'wormsCitation':t['citation'],'queryUrl':url,'reportedTotal':response.get('total'),'records':records,'metadata':metadata}

if __name__ == '__main__':
    result = list(ThreadPoolExecutor(3).map(collect,CANDIDATES))
    (ROOT/'tmp'/'collected.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
