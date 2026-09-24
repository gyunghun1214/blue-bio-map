import json, math, html, re
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'dist'
raw=json.loads((ROOT/'tmp/collected.json').read_text(encoding='utf-8'))
species=[]
for s in raw:
    sources={}
    for did,m in s['metadata'].items():
        m=m['results'][0]
        rights=m.get('intellectualrights','')
        norm=rights.lower()
        license='CC-BY-NC 4.0' if ('cc-by-nc' in norm or 'non commercial' in norm) else ('CC0 1.0' if 'cc0' in norm else ('CC-BY 4.0' if ('cc-by' in norm or 'commons attribution' in norm) else None))
        if not license: continue
        citation=html.unescape(m.get('citation') or m['title']).replace('YYYY-MM-DD','2026-09-22')
        sources[did]={'id':did,'title':m['title'],'citation':citation,'url':'https://obis.org/dataset/'+did,'license':license,'licenseUrl':'https://creativecommons.org/publicdomain/zero/1.0/' if license.startswith('CC0') else ('https://creativecommons.org/licenses/by-nc/4.0/' if 'NC' in license else 'https://creativecommons.org/licenses/by/4.0/')}
    records=[]; seen=set(); reasons=Counter()
    for r in s['records']:
        if r['id'] in seen: reasons['duplicate']+=1; continue
        seen.add(r['id'])
        if r['dataset_id'] not in sources: reasons['license_unconfirmed']+=1; continue
        if r.get('absence') or r.get('dropped'): reasons['excluded_status']+=1; continue
        lat=r.get('decimalLatitude');lon=r.get('decimalLongitude')
        if lat is None or lon is None or not(30<=lat<=43 and 122<=lon<=136): reasons['coordinate']+=1;continue
        if r.get('speciesid')!=s['aphiaID']: reasons['taxon']+=1;continue
        records.append(r)
    cells={}
    for r in records:
        key=(math.floor(r['decimalLatitude']),math.floor(r['decimalLongitude']))
        if key not in cells: cells[key]={'lat':key[0]+.5,'lon':key[1]+.5,'count':0,'years':[]}
        c=cells[key];c['count']+=1
        y=r.get('date_year')
        if isinstance(y,(int,float)): c['years'].append(int(y))
    years=[]
    for c in cells.values():
        years+=c['years'];c['yearStart']=min(c['years']) if c['years'] else None;c['yearEnd']=max(c['years']) if c['years'] else None;del c['years']
    used={r['dataset_id'] for r in records}
    item={k:v for k,v in s.items() if k not in ('records','metadata')}
    item.update({'recordCount':len(records),'retrievedCount':len(s['records']),'cells':list(cells.values()),'yearStart':min(years) if years else None,'yearEnd':max(years) if years else None,'undated':len(records)-len(years),'basis':dict(Counter(r.get('basisOfRecord','unknown') for r in records)),'sources':[sources[k] for k in sources if k in used],'excluded':dict(reasons),'scores':{'MBPI':None,'MFPI':None,'MCUI':None,'BBVI':None},'status':'unscored'})
    species.append(item)
snapshot={'collectedAt':'2026-09-22','bounds':[[30,122],[43,136]],'geometry':'POLYGON ((122 30, 136 30, 136 43, 122 43, 122 30))','notes':'기관 API 응답 중 종 식별자·좌표·자료 상태·이용 조건을 확인한 기록만 표시. 동일 OBIS 레코드 ID 중복 제거. 데이터셋 간 동일 관측의 중복 여부와 생물학적 동정 정확성은 추가 검수 필요. 종별 최대 1,000건을 조회한 제한된 스냅샷이며 전체 분포를 나타내지 않음. CC-BY-NC 자료를 포함하는 비상업 연구 시연. 좌표는 1° 격자로 집계하여 원좌표를 포함하지 않음.','species':species}
(out/'data.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'name':s['label'],'records':s['recordCount'],'cells':len(s['cells']),'years':[s['yearStart'],s['yearEnd']],'excluded':s['excluded']} for s in species],ensure_ascii=False))

assets=[('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','vendor/leaflet.js'),('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','vendor/leaflet.css'),('https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE','vendor/LEAFLET-LICENSE')]  # countries.json (1:10m outline) is built by prepare_basemap.py
def asset(pair):
    url,name=pair
    data=urlopen(url,timeout=45).read()
    if name=='countries.json':
        geo=json.loads(data)
        geo['features']=[f for f in geo['features'] if f['properties'].get('ADM0_A3') in ['KOR','PRK','JPN','CHN','RUS','TWN']]
        assert len(geo['features'])==6
        for f in geo['features']: f['properties']={'name':f['properties']['NAME'],'code':f['properties']['ADM0_A3']}
        data=json.dumps(geo,separators=(',',':')).encode()
    p=out/name;p.parent.mkdir(exist_ok=True);p.write_bytes(data)
    return {'file':name,'bytes':len(data)}
print(list(ThreadPoolExecutor(4).map(asset,assets)))
