// Headless Chrome via DevTools protocol (no deps). Renders the local site, clicks species, screenshots, checks text.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const OUT=process.argv[2]; fs.mkdirSync(OUT,{recursive:true});
const URL0='http://127.0.0.1:8765/';
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9333','--no-first-run','--disable-gpu',
  '--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
async function connect(){for(let i=0;i<50;i++){try{const t=await (await fetch('http://127.0.0.1:9333/json')).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}catch{}await sleep(200);}throw Error('no chrome');}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value;};
const results=[];
const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail});console.log(ok?'PASS':'FAIL',name,ok?'':detail);};
async function viewport(w,h,mobile){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:mobile?2:1,mobile});}
let mock='';
async function load(){await send('Page.navigate',{url:URL0});
  for(let i=0;i<80;i++){await sleep(250);const st=await evaluate("document.getElementById('connection-state')?.textContent||''");if(/연결됨|추가 수집|불러오기 실패/.test(st))return st;}return 'timeout';}
async function shot(name,full=true){
  const m=await evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:full?{x:0,y:0,width:m.w,height:Math.min(m.h,6000),scale:1}:undefined});
  fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}
const pick=aphia=>evaluate(`document.querySelector('[data-species="${aphia}"]').click();document.querySelectorAll('#detail details.detail-more').forEach(d=>d.open=true);document.getElementById('detail').innerText`);
const detailEl=()=>evaluate(`document.getElementById('detail').scrollIntoView();1`);
try{
  ws=new WebSocket(await connect());
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable');await send('Runtime.enable');
  if(process.env.FIXTURE){
    const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    const reply=k=>`Promise.resolve(new Response(JSON.stringify(FX.${k}),{status:200,headers:{'content-type':'application/json'}}))`;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return ${reply('profiles')};if(s.includes('/rest/v1/species_map_cells'))return ${reply('cells')};return o(u,...a);})(window.fetch);}`});
    console.log('Using fixture',process.env.FIXTURE);
  }
  const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});

  // ---------- Desktop, real production API ----------
  await viewport(1440,1000,false);
  const st=await load();
  check('Desktop live: connection state shows actual profile count',st==='공개 기준 자료 연결됨 · 8종',st);
  const note=await evaluate("document.getElementById('collection-note').textContent");
  check('Live note uses received profile count (not fixed 2종)',note.includes('발행된 8종')&&!note.includes('2종'),note);
  const cards=await evaluate("[...document.querySelectorAll('.species-card')].map(b=>b.innerText.replace(/\\s+/g,' '))");
  check('List: sea cucumber card shows map records and cells (same numbers as panel)',cards.some(c=>c.includes('해삼')&&c.includes('지도 표시 기록 2건 · 2셀')),JSON.stringify(cards));

  let t=await pick(836033);
  check('Oyster: nutrition inventory (144 / 107 / 37 / AFCD 25 / unit 4 / basis 144) kept apart from the verified-pilot-2 MFPI trace',
    ['영양 자료 수집 현황 · 식량가치 아님','영양 기록 수 · 수집 현황','144건','실측 107건 · 계산 37건','AFCD 25건','단위 미확정 4건 · 기준량 가정 144건','MFPI · 식량 가능성','65.5 · 검증 전 시범 지표'].every(x=>t.includes(x))&&!t.includes('영양 성분 값'),t);
  check('Oyster: aquaculture 4 shown as evidence records, not production',t.includes('양식 관련 요약 4건 · 기술적 가능성 판정 아님')&&t.includes('AFCD에서 양식(farmed)으로 표시된 근거 기록 수')&&t.includes('생산량 통계가 아닙니다')&&!/생산량\s*4/.test(t),t);
  check('Oyster: conservation withheld',t.includes('근거 부족으로 보류')&&t.includes('IUCN 검색 기록 2건 · 평가 0건'),t);
  check('Oyster: compounds 미수집, separate OBIS 26 kept in details',/보고 화합물\s*미수집/.test(t)&&/기록 수\s*26건/.test(t),t);
  await detailEl();await shot('desktop-oyster');

  t=await pick(241776);
  check('Sea cucumber: 122 compounds, no quantitative activity',/보고 화합물\s*122개/.test(t)&&/정량 활성 자료\s*확인한 자료에서 없음/.test(t),t);
  check('Sea cucumber: no efficacy claim',!/입증|효능|효과가 있/.test(t),t);
  check('Sea cucumber: CMNPD source and NC-SA terms visible in compound summary',t.includes('CMNPD')&&t.includes('CC BY-NC-SA 4.0')&&t.includes('비상업 이용'),t);
  check('Sea cucumber: two occurrence records, 4-degree generalization',/지도 표시 기록\s*2건 · 2개 격자\(4°\)/.test(t)&&t.includes('GBIF')&&t.includes('4°×4°')&&t.includes('정밀 위치나 전체 분포가 아닙니다'),t);
  check('Sea cucumber: conservation withheld, nutrition 미수집',t.includes('근거 부족으로 보류')&&/영양 기록 수\s*미수집/.test(t),t);
  check('Sea cucumber live: reviewed 2026 IUCN EN A2bd is current, 2013 superseded; pilot MCUI 80 with original grade beside it',t.includes('IUCN 현행 평가 EN A2bd: 2026년 발표')&&/보전 평가\s*80\.0 · 검증 전 시범 지표/.test(t)&&!t.includes('undefined')&&t.includes('2025-09-30 평가')&&t.includes('대체된 역사적 평가')&&t.includes('MCUI · 보전 평가')&&t.includes('80.0 · 검증 전 시범 지표')&&!t.includes('Needs updating'),t.slice(t.indexOf('보전'),t.indexOf('보전')+500));
  const mapNote=await evaluate("document.getElementById('map-review-note').textContent+' | '+document.getElementById('map-cells').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length");
  check('Sea cucumber map: two broad cells shown without claiming full distribution',mapNote.includes('4° 셀')&&mapNote.includes('붉은 점은 실제 발견 좌표가 아닌')&&mapNote.includes('전체 분포를 뜻하지 않습니다')&&mapNote.includes(' | 2 | shapes=2'),mapNote);
  await detailEl();await shot('desktop-sea-cucumber');

  t=await pick(342067);
  check('Squid: 미수집 vs 미검토 distinguished',/영양 기록 수\s*미수집/.test(t)&&/보고 화합물\s*미수집/.test(t)&&/보전평가\s*미검토/.test(t)&&t.includes('2건'),t);
  await detailEl();await shot('desktop-squid');
  const leak=await evaluate("document.body.innerText");
  check('No CMNPD raw data / coordinates in page',!/InChI|SMILES|CMNPD\d|raw_record/i.test(leak));

  await evaluate("document.querySelector('[data-view=compare]').click();1");await sleep(300);
  const cmp=await evaluate("document.getElementById('comparison').innerText");
  check('Compare table: verified-pilot-2 axis status per species (scores, partial evidence, withheld) with evidence links',['65.5','54.2','42.2','80.0','10.0','일부 근거 확인','산출 보류','검증 전 시범 지표 · 근거 보기','근거·보류 사유 보기'].every(x=>cmp.includes(x)),cmp);
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-compare');
  await evaluate("document.querySelector('[data-view=method]').click();1");await sleep(300);
  const src=await evaluate("document.getElementById('all-sources').innerText");
  check('Sources: AFCD/CMNPD show their own change notes, not OBIS labels',src.includes('해삼 기원 보고 화합물 개수만 집계')&&src.includes('데이터셋 원문')&&!src.includes('OBIS 데이터셋'),src.slice(0,400));

  // demo mode keeps existing map behavior and separation
  await evaluate("document.querySelector('[data-view=explore]').click();const s=document.getElementById('collection');s.value='demo';s.dispatchEvent(new Event('change'));1");
  for(let i=0;i<40;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state').textContent")).includes('추가 수집'))break;}
  const demo=await evaluate("document.getElementById('connection-state').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length+' | '+document.getElementById('map-review-note').textContent");
  const demoFit=await evaluate("[377084,836033,241776].map(a=>{selectSpecies(a);return map.getBounds().contains(L.latLngBounds(selected.cells.flatMap(c=>[[c.lat-.5,c.lon-.5],[c.lat+.5,c.lon+.5]])))&&document.querySelectorAll('#cell-table tbody tr').length===selected.cells.length})");
  check('Demo mode: view fits each species grid; cell table lists every cell',demoFit.every(Boolean),JSON.stringify(demoFit));
  check('Demo mode: separate 3 species with 1° grid map',demo.startsWith('추가 수집 자료 · 3종')&&Number((demo.match(/shapes=(\d+)/)||[])[1])>0,demo);
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-demo-map',false);
  const demoPopup=await evaluate("(()=>{overlay.getLayers().find(x=>x.getPopup&&x.getPopup()).openPopup();return document.querySelector('.leaflet-popup-content').innerText})()");
  check('Demo popup: separate OBIS grid, withheld judgment, real count, dot notice',['추가 수집 OBIS 출현 격자','해역별 활용·보전 판단: 보류','선별 기록','OBIS 조회 조건','붉은 점은 실제 발견 좌표가 아닌'].every(x=>demoPopup.includes(x))&&await evaluate("overlay.getLayers().some(l=>l._schematicDot)"),demoPopup.slice(0,300));
  await evaluate("map.closePopup();document.querySelector('[data-species=\"241776\"]').click();1");
  const demoCuc=await evaluate("document.getElementById('detail').innerText");
  check('Demo 돌기해삼: 2026 IUCN EN current (not yet reviewed), 2013 superseded',demoCuc.includes('2026년 발표 (원문 검수 전)')&&demoCuc.includes('2026년 평가로 대체')&&!demoCuc.includes('평가 미조회'),demoCuc);
  await evaluate("document.querySelector('[data-view=compare]').click();document.querySelector('.decision-card[data-aphia=\"241776\"]').click();1");
  const dec=await evaluate("document.getElementById('decision-detail').innerText");
  check('Decision panel: 돌기해삼 all four axes withheld, IUCN 2026 EN current but not reviewed',['MFPI: 산출 보류','MBPI: 산출 보류','MCUI: 산출 보류','BBVI: 산출 보류','IUCN 평가 · 2026년 현행 평가 확인 · 원문 검수 전','Hamel & Mercier 2026'].every(x=>dec.includes(x)),dec.slice(0,500));
  await shot('desktop-decision-demo');
  await evaluate("document.querySelector('[data-view=explore]').click();1");

  // ---------- Published 1° map cells (live) ----------
  await evaluate("{const s=document.getElementById('collection');s.value='live';s.dispatchEvent(new Event('change'));}1");
  for(let i=0;i<40;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state').textContent")).includes('공개 기준'))break;}
  const shapes=()=>evaluate("document.querySelectorAll('#map path.leaflet-interactive').length");
  // Spatial cells (one hit area each): 미역 4 period rows -> 3 cells, 우뭇가사리 3 -> 2 (N33E126 has two periods).
  const expectCells={836033:1,342067:1,241776:2,494972:4,145721:3,372119:2,506159:2,250680:2};
  const drawn={};for(const a of Object.keys(expectCells)){await pick(a);await sleep(150);drawn[a]=await shapes();}
  // Back-to-back selection used to drop the fit mid-animation (sea cucumber 4° cells cropped at max zoom).
  const fits=await evaluate("[241776,494972,145721,836033,241776].map(a=>{selectSpecies(a);return map.getBounds().contains(L.latLngBounds(selected.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]])))})");
  check('Map view contains every published cell, even on quick species switches',fits.every(Boolean),JSON.stringify(fits));
  const cucDots=await evaluate("selectSpecies(241776);overlay.getLayers().filter(l=>l._schematicDot).length");
  check('4° cells keep 1° dot density (not a few point-like dots)',cucDots>=40,String(cucDots));
  check('Live map: every species has a spatial layer',JSON.stringify(drawn)===JSON.stringify(expectCells),JSON.stringify(drawn));
  check('Live map title names the public-criteria collection',(await evaluate("document.getElementById('map-source').textContent")).includes('공개 기준 자료'));
  t=await pick(836033);
  check('Oyster live: map section explains why publishable, exclusions, OBIS 26 kept under review',['지도 셀','공개 셀','왜 공개할 수 있는가','CC BY-NC 322건','육지 위 좌표','운영 DB에서 검토 중인 기존 기록','1°를 적용','기존 OBIS 시험 수집 26건'].every(x=>t.includes(x)),t);
  check('Oyster: text matches its published cell (no "instead of cells" contradiction)',!t.includes('공개 출현 셀 대신')&&t.includes('이 수집 기록은 지도 셀에 쓰지 않음'),t.slice(0,600));
  check('Institution checklist: country metadata, ABS/BBNJ links, not a legal determination',['활용 전 제도 확인','법적 판단 아님','기록의 국가 메타데이터','유전자원법','ABS 정보공유체계','BBNJ 협정','관할 경계를 판정할 수 없습니다'].every(x=>t.includes(x)),t.slice(t.indexOf('활용 전'),t.indexOf('활용 전')+400));
  const cucT=await pick(241776);
  check('Sea cucumber detail: checked bioactivity case shown, marked not an index input',cucT.includes('별도 원문 조사 · 지표 입력 아님')&&cucT.includes('Holotoxin'),cucT.slice(cucT.indexOf('화합물'),cucT.indexOf('화합물')+400));
  t=await pick(836033);
  const oyTop=await evaluate("(()=>{selectSpecies(836033);const d=document.getElementById('detail');const more=[...d.querySelectorAll('details.detail-more')];return {top:d.querySelector('.detail-summary').innerText,closed:more.length===3&&more.every(x=>!x.open),summaries:more.map(x=>x.querySelector('summary').innerText),kb:more.every(x=>x.querySelector('summary').tabIndex===0)}})()");
  check('Core regression: oyster top = map GBIF 3건 · 1개 격자 · 2025 only; OBIS 26건/2008–2014 not mixed in',/지도 표시 기록\s*3건 · 1개 격자\(1°\)/.test(oyTop.top)&&/기록 연도\s*2025/.test(oyTop.top)&&oyTop.top.includes('GBIF')&&!oyTop.top.includes('26')&&!oyTop.top.includes('2008')&&!oyTop.top.includes('AphiaID'),oyTop.top);
  check('Oyster top explains why 1 published cell differs from 33 separate OBIS cells',oyTop.top.includes('별도 OBIS 수집은 33셀')&&oyTop.top.includes('지역·기간·선별 기준이 달라 두 지도는 합산하지 않습니다'),oyTop.top);
  await shot('desktop-oyster-collapsed');
  check('Detail: three disclosures closed by default, keyboard-focusable summaries',oyTop.closed&&oyTop.kb&&JSON.stringify(oyTop.summaries)===JSON.stringify(['근거 자세히 보기','수집·선별 기준','출처와 이용조건']),JSON.stringify(oyTop));
  check('Oyster details: separate OBIS 26건 2008–2014 labelled as not in cells; same-species OBIS comparison, not summed',t.includes('이 수집 기록은 지도 셀에 쓰지 않음')&&/관측 기간\s*2008–2014/.test(t)&&/추가 수집 자료\(OBIS\)에도 이 종이 있습니다: 기록 [\d,]+건 · \d+개 격자/.test(t)&&t.includes('합산하지 않습니다'),t.slice(t.indexOf('수집·선별'),t.indexOf('수집·선별')+900));
  check('Counts agree: footer, list card and panel show the same map record total',await evaluate("(()=>{const n=cellRecords(selected);const card=document.querySelector('[data-species=\"836033\"]').innerText.replace(/\\s+/g,' ');return document.getElementById('map-count').textContent===n.toLocaleString()&&card.includes(n+'건 · '+spatialCells(selected).length+'셀')&&document.querySelector('#detail-map-summary').innerText.includes(n+'건')})()"));
  check('Mode selector: plain names and a closed "why maps differ" disclosure',await evaluate("(()=>{const o=[...document.querySelectorAll('#collection option')].map(x=>x.textContent).join('|');const w=document.querySelector('.mode-why');return o.includes('공개 기준 적용 자료')&&o.includes('추가 수집 자료')&&!/검증 완료/.test(o)&&!!w&&!w.open&&w.textContent.includes('더 좁은 지역·기간과 별도 공개 기준')&&w.textContent.includes('CC BY-NC')})()"));
  const unplaced=await evaluate("toggleSimulation(false);document.getElementById('matrix-unplaced').innerText+' | '+document.querySelectorAll('#matrix-unplaced button').length");
  check('Matrix: unplaced species listed apart as priority-survey targets',unplaced.includes('정보 부족 · 우선 조사 대상 8종')&&unplaced.includes('네 유형과 별개')&&unplaced.endsWith(' 8'),unplaced);
  const simHidden=await evaluate("toggleSimulation(true);const x=document.getElementById('matrix-unplaced').innerHTML==='';toggleSimulation(false);x");
  check('Matrix: priority-survey list hidden in the simulated A–D example',simHidden);
  check('Method tab: back-test cases from the proposal, marked not yet done',await evaluate("const m=document.getElementById('method').textContent;m.includes('사후 검증 사례(아직 수행 안 함)')&&m.includes('Conus magus')&&m.includes('Ecteinascidia turbinata')&&m.includes('Halichondria okadai')"));
  check('Method tab: no outdated grid-centre wording',await evaluate("!document.getElementById('method').textContent.includes('격자 중심')&&document.getElementById('method').textContent.includes('실제 발견·채집 좌표가 아닙니다')"));
  check('Merged PR #1: evidence coverage row and map section both reachable; pilot values carry a caution box',t.includes('자료 연결 현황')&&t.includes('품질 점수 아님')&&t.includes('시범 분석 주의')&&t.includes('지도 셀'),t);
  const popup=await evaluate("const l=overlay.getLayers()[0];l.openPopup();document.querySelector('.leaflet-popup-content').innerText");
  check('Cell popup: period, sea area, source, licence, spatial resolution',['공개 집계 기간 2016–2026 · 기록 연도 2025','LME Yellow Sea','1°×1°','가장 짧은 변 약 88 km','선별 기록 3건 · 조사 지점 2곳','kbif','CC0 1.0','해역별 활용·보전 판단: 보류','판단 보류 이유','원좌표·개체수·자원량·한국 전체 분포가 아닙니다','붉은 점은 실제 발견 좌표가 아닌'].every(x=>popup.includes(x)),popup);
  // PR #9 dots: schematic marks on a pane that takes no clicks; the transparent cell keeps PR #8's evidence popup.
  check('Cells are faint dashed hit areas, dots drawn on a non-clickable pane',await evaluate("[...document.querySelectorAll('#map path.leaflet-interactive')].every(p=>p.getAttribute('stroke-dasharray')&&Number(p.getAttribute('fill-opacity'))<.1)&&getComputedStyle(map.getPane('dotPane')).pointerEvents==='none'&&overlay.getLayers().some(l=>l._schematicDot)&&overlay.getLayers().filter(l=>l._schematicDot).every(l=>!l.options.interactive)"));
  const dotXY=await evaluate("map.closePopup();document.getElementById('map').scrollIntoView({block:'center'});const d=overlay.getLayers().find(l=>l._schematicDot);const p=map.latLngToContainerPoint(d.getLatLng());const r=document.getElementById('map').getBoundingClientRect();({x:r.left+p.x,y:r.top+p.y})");
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:dotXY.x,y:dotXY.y,button:'left',clickCount:1});
  await sleep(300);
  const clicked=await evaluate("document.querySelector('.leaflet-popup-content')?.innerText||''");
  check('Clicking on a dot opens the cell evidence popup (not blocked by dots)',clicked.includes('해역별 활용·보전 판단: 보류')&&clicked.includes('출처·이용조건'),clicked.slice(0,200));
  // Same location, two periods (synthetic second row injected in-page; live data has none today): one hit area, both periods reachable by a real click.
  const twoXY=await evaluate("(()=>{const c=selected.cells[0];selected.cells.push({...c,period:'2099–2100',yearStart:2099,yearEnd:2099,records:7,sites:5,citations:[{title:'Synthetic second provider',url:'https://example.org/second',licenses:['CC0 1.0']}]});map.closePopup();renderMap();map.setView([c.lat0+c.sizeDeg/2,c.lon0+c.sizeDeg/2],7,{animate:false});document.getElementById('map').scrollIntoView({block:'center'});const p=map.latLngToContainerPoint([c.lat0+c.sizeDeg*.5,c.lon0+c.sizeDeg*.93]);const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y,hits:overlay.getLayers().filter(l=>!l._schematicDot).length,cells:document.getElementById('map-cells').textContent}})()");
  await sleep(400);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:twoXY.x,y:twoXY.y,button:'left',clickCount:1});
  await sleep(300);
  const two=await evaluate("document.querySelector('.leaflet-popup-content')?.innerText||''");
  check('Two periods in one cell: one hit area, click shows both periods with counts, sites and sources',twoXY.hits===1&&twoXY.cells==='1'&&['공개 집계 기간 2016–2026','공개 집계 기간 2099–2100','선별 기록 7건 · 조사 지점 5곳','Synthetic second provider','기간 2개'].every(x=>two.includes(x)),JSON.stringify(twoXY)+' '+two.slice(0,300));
  await shot('desktop-two-period-popup',false);
  await evaluate("selected.cells.pop();map.closePopup();1");
  await pick(145721);await sleep(200);
  const wakame=await evaluate("(()=>{const l=overlay.getLayers().filter(l=>!l._schematicDot).find(l=>l.getBounds().getSouth()===33&&l.getBounds().getWest()===126);l.openPopup();return document.querySelector('.leaflet-popup-content').innerText})()");
  check('Live 미역 N33E126: both published periods in one popup',['공개 집계 기간 2000–','공개 집계 기간 2016–','기간 2개'].every(x=>wakame.includes(x)),wakame.slice(0,400));
  await pick(836033);await sleep(200);
  await evaluate("map.closePopup();renderMap();1");
  // Synthetic optional report through the real loader (no file is written or published).
  const cucReport=async checked=>evaluate(`(async()=>{const real=window.fetch;window.fetch=async u=>String(u).includes('assessments.json')?new Response(JSON.stringify({method_version:'pilot-1',status:'provisional_unvalidated',food_weight:.5,generated_at:'2026-09-23',sources:{s:{url:'https://example.org/s',license:'test',accessed:'2026-09-20'}},species:[{aphia_id:241776,scientific_name:'Apostichopus japonicus',source_ids:['s'],scores:{MFPI:null,MBPI:null,MCUI:80,BBVI:null},iucn_category:'EN',iucn_assessment_year:2013,conservation_trace:{category:'EN',assessment_year:2013,source_id:'s',current_status_verified:true,current_status_source_id:'s',current_status_checked_on:'${checked}'}}]})):real(u);
    for(const x of data.species)delete x.assessment;await attachPilotAssessments(data);window.fetch=real;selectSpecies(241776);document.querySelectorAll('#detail details.detail-more').forEach(d=>d.open=true);return document.getElementById('detail').innerText})()`);
  const rechecked=await cucReport('2026-09-20');
  check('Sea cucumber with valid recheck: pilot MCUI, no contradictory wording, not a Korea-only/policy claim',rechecked.includes('2026년 평가로 대체')&&!rechecked.includes('현행 여부 재확인')&&rechecked.includes('재확인 2026-09-20 · 시범 보고서')&&rechecked.includes('2026년 한국 한정 평가나 확정된 정책 판단이 아닙니다')&&!rechecked.includes('MCUI로 바꾸지 않습니다')&&!rechecked.includes('현행 평가 여부는 확인하지 않았습니다'),rechecked.slice(rechecked.indexOf('보전'),rechecked.indexOf('보전')+500));
  await evaluate("document.getElementById('detail').querySelector('h3:nth-of-type(3)')?.scrollIntoView();1");await shot('desktop-sea-cucumber-rechecked');
  const badDate=await cucReport('2099-99-99');
  check('Sea cucumber with impossible check date: MCUI withheld, 2026 current-assessment wording kept',badDate.includes('2026년 발표 (원문 검수 전)')&&badDate.includes('MCUI는 평가 기준·평가일·범위를 원문으로 검수한 뒤에만')&&!badDate.includes('재확인'),badDate.slice(badDate.indexOf('보전'),badDate.indexOf('보전')+400));
  await evaluate("for(const x of data.species)delete x.assessment;selectSpecies(836033);1");
  // Keyboard / screen-reader path to the same cell evidence.
  await pick(145721);await sleep(300);
  const tbl=await evaluate("(()=>{const b=document.getElementById('cell-table');b.querySelector('details').open=true;return {rows:b.querySelectorAll('tbody tr').length,text:b.innerText}})()");
  check('Cell table: one row per spatial cell, both periods of the shared cell listed',tbl.rows===3&&tbl.text.includes('33–34°N · 126–127°E')&&/2000–\d{4}/.test(tbl.text)&&/2016–\d{4}/.test(tbl.text)&&tbl.text.includes('CC0 1.0'),JSON.stringify(tbl).slice(0,400));
  await evaluate("map.closePopup();document.querySelector('#cell-table [data-cell]').focus();1");await sleep(200);
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await sleep(500);
  const kb=await evaluate("({popup:document.querySelector('.leaflet-popup-content')?.innerText||'',focusIn:!!document.activeElement?.closest('.leaflet-popup')})");
  check('Keyboard: Enter on "지도에서 열기" opens the cell popup and moves focus into it',kb.popup.includes('해역별 활용·보전 판단: 보류')&&kb.focusIn,JSON.stringify(kb).slice(0,200));
  await evaluate("map.closePopup();1");
  // ---- A/B improvements ----
  let ab=await pick(241776);
  check('A-1 top summary: map records, three axis statuses (not a verdict), limit line; publish date kept in sources',await evaluate("(()=>{const c=document.querySelector('#detail .detail-summary');return !!c&&c.innerText.includes('판정 아님')&&c.innerText.includes('지도 표시 기록')&&c.querySelectorAll('.evidence-item').length===6&&!!c.querySelector('.detail-limit')&&/발행 \\d{4}-\\d{2}-\\d{2}/.test(document.getElementById('detail').textContent)})()"));
  check('A-2 coverage bar: 5 segments, on/off matches n/5',await evaluate("(()=>{const b=document.querySelector('#detail .coverage-bar');return !!b&&b.querySelectorAll('.seg').length===5&&b.querySelectorAll('.seg.on').length===evidenceCoverage(selected).known})()"));
  check('A-4 IUCN: superseded 2013 assessment no longer flagged Needs updating; 2026 assessment cited',!ab.includes('Needs updating')&&ab.includes('2013년 발표 (2026년 평가로 대체)')&&ab.includes('Hamel & Mercier 2026'),ab.slice(ab.indexOf('보전'),ab.indexOf('보전')+300));
  const pop=await evaluate("(()=>{map.closePopup();overlay.getLayers().find(l=>!l._schematicDot).openPopup();return [...document.querySelectorAll('.leaflet-popup-content')].at(-1).innerText})()");
  check('A-3 popup: GBIF generalisation vocabulary and 4° sensitivity note',['dataGeneralizations','informationWithheld','GBIF 지침의 가장 엄격한 등급(1°)보다 넓은 4° 셀','재검토 예정일: 미정'].every(x=>pop.includes(x)),pop.slice(0,400));
  check('B-1 popup: effort reference line, not presence',/OBIS 전체 종 기록 [\d,]+건\(2000년 이후\)/.test(pop)&&pop.includes('이 종의 존재·개체수와 무관'),pop.slice(0,400));
  const eff=await evaluate("(()=>({n:effortLayer?.getLayers().length,date:document.getElementById('effort-date').textContent,pane:getComputedStyle(map.getPane('effortPane')).pointerEvents}))()");
  check('B-1 effort layer drawn from snapshot, non-clickable, dated',eff.n>100&&/\d{4}-\d{2}-\d{2} 조회/.test(eff.date)&&eff.pane==='none',JSON.stringify(eff));
  const off=await evaluate("(()=>{const t=document.getElementById('effort-toggle');t.click();const a=effortLayer.getLayers().length;t.click();return [a,effortLayer.getLayers().length]})()");
  check('B-1 effort toggle hides and restores the layer',off[0]===0&&off[1]>100,JSON.stringify(off));
  await evaluate("map.closePopup();1");
  await pick(145721);await sleep(200);
  const pf=await evaluate("(()=>{const b=[...document.querySelectorAll('#period-filter [data-period]')];const all=overlay.getLayers().filter(l=>!l._schematicDot).length;b.find(x=>x.dataset.period.startsWith('2000')).click();const one=overlay.getLayers().filter(l=>!l._schematicDot).length;const rows=document.querySelectorAll('#cell-table tbody tr').length;const hash=location.hash;b[0].click();return {buttons:b.length,all,one,rows,hash,back:overlay.getLayers().filter(l=>!l._schematicDot).length}})()");
  check('A-5 period filter: 미역 has 전체+2 periods; filtering reduces cells and table; hash records it',pf.buttons===3&&pf.one<pf.all&&pf.rows===pf.one&&/p=2000/.test(decodeURIComponent(pf.hash))&&pf.back===pf.all,JSON.stringify(pf));
  const csv=await evaluate("(()=>{const t=cellCsv(selected);return {bom:t.charCodeAt(0)===0xFEFF,lines:t.split('\\r\\n').length,cells:selected.cells.length,head:t.slice(1,40)}})()");
  const pfSum=await evaluate("(()=>{const b=[...document.querySelectorAll('#period-filter [data-period]')];b.find(x=>x.dataset.period.startsWith('2000')).click();const one=document.getElementById('detail-map-summary').innerText;b[0].click();return {one,all:document.getElementById('detail-map-summary').innerText}})()");
  check('Period filter relabels the panel summary (selected period vs 전체 기간)',pfSum.one.includes('선택 기간 2000')&&pfSum.all.includes('전체 기간'),JSON.stringify(pfSum));
  check('A-5 CSV: BOM, header + one line per published period row',csv.bom&&csv.lines===csv.cells+1&&csv.head.startsWith('"species_label"'),JSON.stringify(csv));
  check('A-6 info panel and copy-link control present',await evaluate("!!document.querySelector('.map-info summary')&&document.querySelector('.map-info').textContent.includes('회색 음영')&&!!document.getElementById('copy-link')"));
  // Shared link restores species, tab and basemap after a reload.
  await evaluate("location.hash='c=live&s=241776&v=compare&b=depth';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);
  const restored=await evaluate("({s:selected?.aphiaID,v:currentView,b:basemap})");
  check('A-5 shared link restores species, tab and basemap',restored.s===241776&&restored.v==='compare'&&restored.b==='depth',JSON.stringify(restored));
  await evaluate("setBasemap('basic');setView('explore');history.replaceState(null,'',location.pathname);1");
  check('A-2 comparison table shows coverage bars for all 8 species',await evaluate("document.querySelectorAll('#comparison .coverage-bar').length===8"));
  t=await pick(836033);
  check('Legend: red dots are a schematic of published cells, not discovery coordinates',await evaluate("!document.querySelector('.map-key').hidden&&document.getElementById('map-legend-note').textContent.includes('점 간격')&&document.getElementById('map-symbol-label').textContent.includes('실제 발견 좌표 아님')&&document.getElementById('map-judgment').textContent.includes('승인 0곳')"));
  await sleep(400);await shot('desktop-live-oyster-cell');await evaluate('map.closePopup();1');await sleep(400);
  t=await pick(494972);
  check('톳 live: new profile with 4 cells, nutrition/compounds 미수집, conservation 미검토',(await shapes())===4&&/영양 기록 수\s*미수집/.test(t)&&/보전평가\s*미검토/.test(t)&&/지도 표시 기록\s*[\d,]+건 · 4개 격자/.test(t)&&t.includes('GBIF'),t);
  await detailEl();await shot('desktop-live-hijiki');
  t=await pick(241776);
  check('Sea cucumber live: published 4-degree cells visible',(await shapes())===2&&t.includes('공개 셀')&&t.includes('2개 · 4°×4°')&&(await evaluate("document.getElementById('map-source').textContent")).includes('공개 4° 셀'),t);
  const plain=await evaluate("document.body.innerText");
  check('Page shows no raw coordinates',!/\d{2,3}\.\d{3,}/.test(plain),plain.match(/\d{2,3}\.\d{3,}/)?.[0]);
  // ---------- Background maps: basic / satellite (NASA GIBS) / depth (GEBCO) ----------
  await pick(494972);
  const tiles=host=>evaluate(`[...document.querySelectorAll('#map img.leaflet-tile-loaded')].filter(i=>i.src.includes('${host}')).length`);
  const waitTiles=async host=>{for(let i=0;i<60;i++){if(await tiles(host)>0)return true;await sleep(500);}return false;};
  // screenshots only after every visible tile finished (GEBCO WMS is slow)
  const settle=async()=>{for(let i=0;i<60;i++){if(!(await evaluate("document.querySelectorAll('#map img.leaflet-tile:not(.leaflet-tile-loaded)').length")))break;await sleep(500);}await sleep(500);};
  await evaluate("document.querySelector('[data-basemap=satellite]').click();1");
  check('Satellite basemap: NASA GIBS tiles load, cells kept, bright style',await waitTiles('gibs.earthdata.nasa.gov')&&(await shapes())===4&&await evaluate("document.getElementById('map').classList.contains('map-dark')&&document.querySelector('[data-basemap=satellite]').getAttribute('aria-pressed')==='true'"));
  await settle();await shot('desktop-basemap-satellite');
  await evaluate("document.querySelector('[data-basemap=depth]').click();1");
  check('Depth basemap: GEBCO tiles load, cells kept',await waitTiles('wms.gebco.net')&&(await shapes())===4&&(await tiles('gibs.earthdata.nasa.gov'))===0);
  await settle();await shot('desktop-basemap-depth');
  await evaluate("document.querySelector('[data-basemap=basic]').click();1");await sleep(300);
  check('Basic basemap: 1:10m outline, no external tiles',(await evaluate("document.querySelectorAll('#map img.leaflet-tile').length"))===0&&!(await evaluate("document.getElementById('map').classList.contains('map-dark')"))&&(await shapes())===4);
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBlockedURLs',{urls:['*gibs.earthdata.nasa.gov*']});
  await evaluate("document.querySelector('[data-basemap=satellite]').click();1");
  let fell='';for(let i=0;i<40;i++){await sleep(250);fell=await evaluate("document.getElementById('basemap-status').textContent");if(fell)break;}
  check('Tile failure falls back to basic with a message',fell.includes('기본 지도로 바꿨습니다')&&(await evaluate("document.querySelector('[data-basemap=basic]').getAttribute('aria-pressed')"))==='true'&&(await shapes())===4,fell);
  await send('Network.setBlockedURLs',{urls:[]});await send('Network.setCacheDisabled',{cacheDisabled:false});
  await evaluate("try{localStorage.removeItem('basemap')}catch{};1");

  // ---------- Mobile 390px ----------
  await viewport(390,844,true);
  await load();
  for(const [aphia,name] of [[241776,'mobile-sea-cucumber'],[836033,'mobile-oyster']]){
    await pick(aphia);await detailEl();
    const ov=await evaluate("({doc:document.documentElement.scrollWidth,vw:window.innerWidth,wide:[...document.querySelectorAll('#detail *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length})");
    check(`Mobile 390px ${name}: no horizontal overflow`,ov.doc<=ov.vw&&ov.wide===0,JSON.stringify(ov));
    await shot(name);
  }
  await pick(494972);await evaluate("document.querySelector('.map-pane').scrollIntoView();1");await sleep(1500);await shot('mobile-live-hijiki-map',false);
  await detailEl();
  const pov=await evaluate("({doc:document.documentElement.scrollWidth,vw:window.innerWidth,wide:[...document.querySelectorAll('#detail *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length})");
  const mwhy=await evaluate("(()=>{const w=document.querySelector('.mode-why');w.open=true;const r={doc:document.documentElement.scrollWidth,vw:window.innerWidth};w.open=false;return r})()");
  check('Mobile 390px: opened "why maps differ" table fits',mwhy.doc<=mwhy.vw,JSON.stringify(mwhy));
  check('Mobile 390px 톳 with cells: no horizontal overflow',pov.doc<=pov.vw&&pov.wide===0,JSON.stringify(pov));
  await shot('mobile-live-hijiki');

  // ---------- Failure / empty / v1-only responses (fetch mocked in page) ----------
  await viewport(1440,1000,false);
  const mocks={
    'api-error':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('x',{status:500})):o(u,...a))(window.fetch);",
    'api-empty':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}})):o(u,...a))(window.fetch);",
    'v1-only':"window.fetch=(o=>async(u,...a)=>{const r=await o(u,...a);if(!String(u).includes('/rest/v1/species_profiles'))return r;const rows=await r.json();for(const p of rows){const s=p.evidence_summary;for(const k of ['summary_version','nutrition','compounds','conservation','production','occurrence_status','map'])delete s[k];p.production_summary='생산·영양·생리활성·보전 근거 미검토. 점수 미산출.';}return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});})(window.fetch);"
  };
  let scriptId;
  for(const [name,src] of Object.entries(mocks)){
    if(scriptId)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
    scriptId=(await send('Page.addScriptToEvaluateOnNewDocument',{source:src})).identifier;
    const s=await load();
    const state=await evaluate("({state:document.getElementById('connection-state').textContent,error:document.getElementById('error').hidden?'':document.getElementById('error').textContent,list:document.getElementById('species-list').innerText,detail:document.getElementById('detail').innerText,full:document.getElementById('detail').textContent})");
    if(name==='api-error')check('API failure: error shown, no stale data',state.state==='불러오기 실패'&&state.error.includes('불러오지 못했습니다')&&state.detail==='',JSON.stringify(state));
    if(name==='api-empty')check('Empty API response: "아직 발행된 종이 없습니다"',state.list.includes('아직 발행된 종이 없습니다')&&state.state.includes('발행 자료 없음'),JSON.stringify(state));
    if(name==='v1-only')check('v2 keys absent: falls back to production_summary, no fake 0/미수집',state.full.includes('생산·영양·생리활성·보전 근거 미검토')&&!state.full.includes('영양 근거')&&!state.full.includes('미수집'),state.full);
    await evaluate("window.scrollTo(0,0);1");await shot(name,false);
  }
  check('No uncaught page errors',errors.length===0,errors.join(' | '));
}catch(e){check('Harness',false,e.stack);}
finally{fs.writeFileSync(path.join(OUT,'ui-check-results.json'),JSON.stringify(results,null,2));ws?.close();chrome.kill();
  console.log(`${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status!=='PASS').length} FAIL`);}
