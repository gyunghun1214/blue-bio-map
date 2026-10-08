// Headless Chrome via DevTools protocol (no deps). Renders the local site, clicks species, screenshots, checks text.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
const OUT=process.argv[2];
// Expected counts are computed from the published files, never typed in: 22 candidates, snapshot rows, pilot scores.
const DIST=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const readDist=f=>JSON.parse(fs.readFileSync(path.join(DIST,f),'utf8'));
const catalogIds=readDist('candidate-catalog.json').species.map(s=>s.aphiaID), snapshot=readDist('live-snapshot.json'), report=readDist('assessments.json');
// Expected candidate cells come from the reviewed release file, not from constants.
const release=readDist('expansion-public-cells.json').species, places=e=>new Set(e.cells.map(c=>c.lat0+','+c.lon0)).size;
const ark=release.find(e=>e.aphiaID===504357), arkPlaces=places(ark), arkOld=ark.cells.find(c=>c.historical);
// 2026-10-01: NIBR specimen points gave 시카메굴 its cells. The no-cell branch uses whichever candidate still has
// none; when every candidate has cells, the same checks run on 시카메굴 and expect its cells instead.
const noCell=release.find(e=>!e.cells.length)?.aphiaID, emptyPick=noCell||836041, emptyPlaces=noCell?0:places(release.find(e=>e.aphiaID===836041));
const candidatesBeside=publishedIds=>catalogIds.filter(a=>!publishedIds.includes(a)).length;
const reportScores=[...report.species,...(report.candidate_species||[])].flatMap(s=>Object.values(s.scores).filter(v=>v!==null).map(v=>v.toFixed(1)));
// Up to 3.1 a national MCUI (참굴 2.3: all four axes computed) never enters the IUCN matrix; 3.2 places it with its own marker.
const nationalPlaced=!!report.method?.matrix?.include_national_mcui, readiness=readDist('matrix-readiness.json');
// 3.15: a substitute MCUI (another range state's list) is placed only when the rule lists its basis. 3.15 (team-lead decision
// 2026-10-02): reference only, so a Rapid LC check gives no MCUI and never reaches the matrix.
const substitutesPlaced=report.method?.matrix?.include_substitute_mcui||[];
// 3.24: a candidate species (큰가리비) is placed too, so published and candidate points are counted apart
const placedIn=list=>list.filter(s=>(nationalPlaced||s.mcui_basis!=='national')&&(s.mcui_basis!=='range_state'||substitutesPlaced.includes(s.mcui_basis))&&['MFPI','MBPI','MCUI','BBVI'].every(k=>s.scores[k]!==null)).length;
const placedInMatrix=placedIn(report.species), placedCandidates=placedIn(report.candidate_species);
const typeLabel=aphia=>Object.values(report.method.matrix.types).find(t=>t.id===readiness.species.find(r=>r.aphia_id===aphia).matrix_type)?.label;
if(!OUT)throw Error('Usage: node verification/uicheck.mjs <output-directory>');
fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu',
  '--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,chromeFailure=null,chromeStderr='';const pending=new Map();
const diagnostic=()=>`Chrome ${chromeFailure?.message||'still running'}; stderr: ${chromeStderr.slice(-1800)||'(empty)'}`;
const failPending=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.rej(error);}pending.clear();};
chrome.stderr.on('data',chunk=>{chromeStderr=(chromeStderr+chunk.toString()).slice(-10000);});
chrome.on('error',error=>{chromeFailure=error;failPending(error);});
chrome.on('exit',(code,signal)=>{chromeFailure=Error(`exited ${code??signal}`);failPending(Error(diagnostic()));});
async function connect(){
  // ponytail: fixed 60 s wait; GitHub's Windows runner often needs >15 s for Chrome's first DevTools port (2026-10-01)
  for(let i=0;i<300;i++){
    if(chromeFailure)throw Error(diagnostic());
    try{
      const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      if(Number.isInteger(port)&&port>0){
        const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();
        const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;
      }
    }catch{}
    await sleep(200);
  }
  throw Error(`Chrome DevTools endpoint timeout. ${diagnostic()}`);
}
const send=(method,params={})=>new Promise((res,rej)=>{
  if(ws?.readyState!==WebSocket.OPEN)return rej(Error(`${method}: WebSocket unavailable. ${diagnostic()}`));
  const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(`${method}: response timeout. ${diagnostic()}`));},10000);
  pending.set(i,{res,rej,timer});
  try{ws.send(JSON.stringify({id:i,method,params}));}catch(error){clearTimeout(timer);pending.delete(i);rej(error);}
});
async function openWebSocket(url){
  ws=new WebSocket(url);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(`WebSocket open timeout. ${diagnostic()}`)),5000);
    ws.onopen=()=>{clearTimeout(timer);resolve();};
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
    ws.onerror=()=>{const error=Error(`WebSocket error. ${diagnostic()}`);clearTimeout(timer);failPending(error);reject(error);};
    ws.onclose=()=>{const error=Error(`WebSocket closed. ${diagnostic()}`);clearTimeout(timer);failPending(error);reject(error);};
  });
}
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value;};
async function waitForText(expr,accept,timeout=3000){
  const deadline=Date.now()+timeout;
  let value='';
  do{
    value=await evaluate(expr);
    if(accept(value))return value;
    await sleep(100);
  }while(Date.now()<deadline);
  return value;
}
const results=[];
const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail});console.log(ok?'PASS':'FAIL',name,ok?'':detail);};
async function viewport(w,h,mobile){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:mobile?2:1,mobile});}

// Entry screen (dist/intro.js): read its state, wait until it can be entered, press Enter like a keyboard.
const gateState=()=>evaluate(`(()=>{const g=document.getElementById('site-gate'),a=document.activeElement,held=[...document.body.children].filter(n=>n!==g&&!/^(SCRIPT|LINK)$/.test(n.tagName));
  return {on:document.documentElement.classList.contains('gate-on'),hidden:g.hidden,ready:g.classList.contains('is-ready'),step:g.querySelector('.gate-step').textContent,
    note:g.querySelector('.gate-note').hidden?'':g.querySelector('.gate-note').textContent,counts:g.querySelector('.gate-counts').textContent,focus:a?.id||a?.tagName||'',
    held:held.length,inert:held.filter(n=>n.inert).length,stored:sessionStorage.getItem('bbvm-intro-entered'),
    enterBox:(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))(document.getElementById('gate-enter').getBoundingClientRect()),vw:innerWidth,vh:innerHeight,doc:document.documentElement.scrollWidth}})()`);
async function gateReady(){for(let i=0;i<60;i++){const g=await gateState();if(g.ready||!g.on)return g;await sleep(200);}return gateState();}
async function pressEnter(){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});}
let mock='';
async function load(){await send('Page.navigate',{url:URL0});
  for(let i=0;i<80;i++){await sleep(250);const st=await evaluate("document.getElementById('connection-state')?.textContent||''");if(/연결됨|불러오기 실패|연결 실패/.test(st))return st;}return 'timeout';}
async function shot(name,full=true){
  const m=await evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:full?{x:0,y:0,width:m.w,height:Math.min(m.h,6000),scale:1}:undefined});
  fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}
// 2026-10-03: overview zooms show regional bubbles; the cell checks below look at the zoomed-in cell view (bubble checks are separate).
const cellZoom="if(mapMode==='occurrence'&&map.getZoom()<=BUBBLE_MAX_ZOOM)map.setZoom(BUBBLE_MAX_ZOOM+1,{animate:false});";
const pick=aphia=>evaluate(`document.querySelector('[data-species="${aphia}"]').click();${cellZoom}document.querySelectorAll('#detail details.detail-more').forEach(d=>d.open=true);document.getElementById('detail').innerText`);
// Operating cells come from the live API (map-3 since 2026-10-01): counts are read from the loaded rows, never typed in.
const liveMap=aphia=>evaluate(`(()=>{const s=data.species.find(x=>x.aphiaID===${aphia});return {records:cellRecords(s),recordsText:cellRecords(s).toLocaleString(),cells:spatialCells(s).length,rows:s.cells.length,years:cellYears(s)}})()`);
const detailEl=()=>evaluate(`document.getElementById('detail').scrollIntoView();1`);
// The comparison table: text, coverage bars and species columns.
// The comparison is one table holding every species (it scrolls sideways), so one read covers it; kept as a list of one.
const walkComparison=()=>evaluate("(()=>{renderComparison();return [{label:document.getElementById('comparison-page').textContent,text:document.getElementById('comparison').innerText,bars:document.querySelectorAll('#comparison .coverage-bar').length,cols:document.querySelectorAll('#comparison thead th').length-1,page:document.documentElement.scrollWidth<=document.documentElement.clientWidth}]})()");
try{
  await openWebSocket(await connect());
  await send('Page.enable');await send('Runtime.enable');
  if(process.env.FIXTURE){
    const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    const reply=k=>`Promise.resolve(new Response(JSON.stringify(FX.${k}),{status:200,headers:{'content-type':'application/json'}}))`;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return ${reply('profiles')};if(s.includes('/rest/v1/species_map_cells'))return ${reply('cells')};return o(u,...a);})(window.fetch);}`});
    console.log('Using fixture',process.env.FIXTURE);
  }
  const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('console.error: '+m.params.args.map(x=>x.value??x.description).join(' '));});

  // ---------- Desktop, real production API ----------
  await viewport(1560,900,false);
  const st=await load();
  // Published count straight from the public API (read-only), candidates from dist/candidate-catalog.json.
  const apiIds=await evaluate("fetch(publicApi.url+'/rest/v1/species_profiles?select=aphia_id',{headers:{apikey:publicApi.key},cache:'no-store'}).then(r=>r.json()).then(r=>r.map(x=>Number(x.aphia_id)))");
  const expPub=apiIds.length, expCand=candidatesBeside(apiIds), total=await evaluate('data.species.length');
  check('Desktop live: connection state names published profiles and candidates separately (API + catalog counts)',st===`공개 기준 자료 연결됨 · 운영 발행 ${expPub}종 · 조사 후보 ${expCand}종`&&expPub+expCand===total,`${st} | API ${expPub}, catalog ${expCand}, shown ${total}`);

  // ---------- Entry screen, first open of a fresh tab: loader → entry screen → Enter → map ----------
  {
    let g=await gateReady();
    check('G-1 first open: entry screen over the map, map and chatbot inert, loader finished with the species total, counts read from the loaded data',
      g.on&&!g.hidden&&g.ready&&g.held>0&&g.inert===g.held&&g.step===`해양생물 ${total}종 자료를 불러왔어요`&&g.counts===`지금 해양생물 ${total}종을 볼 수 있습니다(운영 발행 ${expPub}종 · 조사 후보 ${expCand}종).`&&g.note===''&&g.stored===null,JSON.stringify(g));
    check('G-2 entry button has focus (Enter and Space act on it) and sits inside the first screen',g.focus==='gate-enter'&&g.enterBox.bottom<=g.vh&&g.enterBox.top>0,JSON.stringify(g));
    await sleep(1200);await shot('gate-desktop',false);
    await pressEnter();await sleep(1100);
    g=await gateState();
    check('G-3 Enter opens the map: entry screen gone, nothing inert, focus in the species search, remembered for this tab',
      !g.on&&g.hidden&&g.inert===0&&g.focus==='search'&&g.stored==='1',JSON.stringify(g));
  }
  const note=await evaluate("document.getElementById('collection-note').textContent");
  check('Live note uses the same published/candidate counts (not a fixed 2종)',note.includes(`운영 발행 ${expPub}종과 조사 후보 ${expCand}종`)&&!/(^|[^\d])2종/.test(note),note);
  const cards=await evaluate("[...document.querySelectorAll('.species-card')].map(b=>b.innerText.replace(/\\s+/g,' '))");
  const cucMap=await liveMap(241776);
  check('List: sea cucumber card shows map records and cells (same numbers as panel)',cards.some(c=>c.includes('해삼')&&c.includes(`지도 표시 기록 ${cucMap.recordsText}건 · ${cucMap.cells}셀`)),JSON.stringify(cards));

  // verified-pilot-3.9: species with no linked RDA row score MFPI from a MEXT same-species raw item, and the browser re-check accepts it
  const mextRows=await evaluate("[413600,127022,534443].map(id=>{const s=data.species.find(x=>x.aphiaID===id);const st=axisState(s,'MFPI');return [id,st.kind,st.value,s.assessment?.food_trace?.source_food_item_id]})");
  // 3.15 links RDA rows by name (MABIK 국명, MFDS 학명, misapplied-name crosswalk), so 고등어 and 참문어 use their RDA row again
  check('3.9 MEXT row (맛조개) and 3.15 name-linked RDA rows (고등어·참문어) pass the browser re-check (no 기술 오류)',
    JSON.stringify(mextRows)===JSON.stringify([[413600,'scored',57.7,'MEXT:10280'],[127022,'scored',59.9,'K0150000000a'],[534443,'scored',37.8,'K6110030000a']]),JSON.stringify(mextRows));
  const eck=await pick(371986);
  const eckAxes=await evaluate("(()=>{const s=data.species.find(x=>x.aphiaID===371986);return {scores:s.assessment?.scores,report:s.assessment?.report_version,cells:s.cells.length,map:document.getElementById('map-judgment').textContent,mcui:document.querySelector('#detail details[data-axis=MCUI]')?.textContent||''}})()");
  check('Ecklonia candidate: paper-local MBPI 67.5 and five source-linked measurements without spatial or combined scores',
    eckAxes.report===report.method_version&&eckAxes.scores?.MBPI===67.5&&
    // 4.3 (team-lead decision 2026-10-05): the Rapid LC check scores LC-equivalent 10 with its failed back-test label
    // 4.0: MFPI 62.5 from a moisture-converted row and BBVI 65.0 (single paper); MCUI stays withheld
    eckAxes.scores.MFPI===62.5&&eckAxes.scores.MCUI===10&&eck.includes('10.0 · 정식 산출 · 역검증 기준 미충족 · 자체 예비평가(Rapid LC)')&&
    eckAxes.mcui.includes('자체 예비평가(Rapid LC) MCUI')&&eckAxes.mcui.includes('매트릭스에는 회색 점선 점으로 따로 놓습니다')&&eckAxes.scores.BBVI===65&&
    eckAxes.cells===release.find(e=>e.aphiaID===371986).cells.length&&(eckAxes.cells?eckAxes.map.includes('이 종의 매트릭스 유형: 지속가능 활용 후보')&&!eckAxes.map.includes('67.5'):eckAxes.map.includes('지도에 반영되지 않습니다'))&&
    eck.includes('MBPI 67.5')&&!eck.includes('시범')&&eck.includes('원논문 1편')&&
    eck.includes('phloroglucinol')&&eck.includes('eckstolonol')&&eck.includes('1.47 ± 0.04 mM'),
    JSON.stringify(eckAxes)+' | '+eck.slice(0,500));

  let t=await pick(836033);
  check('Oyster: nutrition inventory (144 / 107 / 37 / AFCD 25 / unit 4 / basis 144) kept apart from the verified-pilot-2 MFPI trace',
    ['영양 자료 수집 현황 · 식량가치 아님','영양 기록 수 · 수집 현황','144건','실측 107건 · 계산 37건','AFCD 25건','단위 미확정 4건 · 기준량 가정 144건','MFPI · 식량 가능성','71.6 · 정식 산출 · 방법 검증 통과(11종 비교)'].every(x=>t.includes(x))&&!t.includes('영양 성분 값'),t);
  check('Oyster: aquaculture 4 shown as evidence records, not production',t.includes('양식 관련 요약 4건 · 기술적 가능성 판정 아님')&&t.includes('AFCD에서 양식(farmed)으로 표시된 근거 기록 수')&&t.includes('생산량 통계가 아닙니다')&&!/생산량\s*4/.test(t),t);
  // The operating profile predates the index report: reviewed axes show the report result, not the profile's old status.
  check('Oyster: conservation follows the index report (MCUI 10.0), not the older profile 보류',/보전평가\s*지표 보고서에서 검토 · MCUI 10\.0/.test(t)&&!t.includes('근거 부족으로 보류')&&t.includes('지표 보고서보다 먼저 작성'),t);
  check('Oyster: compounds follow the index report (MBPI 96.3), separate OBIS 26 kept in details',/보고 화합물\s*지표 보고서에서 검토 · MBPI 96\.3/.test(t)&&!/보고 화합물\s*미수집/.test(t)&&/기록 수\s*26건/.test(t),t);
  const nat=await evaluate("document.querySelectorAll('#detail details.score-disclosure').forEach(d=>d.open=true);document.getElementById('detail').innerText");
  // verified-pilot-2.1: with no IUCN global record, the oyster MCUI is the separately labelled Korean national assessment.
  check('Oyster: MCUI 10 labelled as Korean national assessment with page, never compared with IUCN MCUI',nat.includes('한국 국가 평가 기반 MCUI: LC')&&nat.includes('목록 1371쪽')&&nat.includes('목록·찾아보기 쪽 재확인 2026-09-27')&&nat.includes('서로 순위를 매기거나 비교하지 않고, '+(nationalPlaced?'매트릭스에는 네모 점으로 따로 놓습니다':'매트릭스에도 놓지 않습니다'))&&!nat.includes('IUCN LC'),nat);
  // verified-pilot-2.3: peptide LQP scored in the AHTPDB cohort; a synthetic LQP from another origin replicates the potency, so BBVI is computed (80.9 in 2.3, 83.9 with the 3.6 calcium MFPI).
  check('Oyster: MBPI 96.3 with origin paper, potency replication (Miyoshi 1991, synthetic, other origin) and its one-origin-paper limit',!nat.includes('참고값(근거 논문 1편)')&&!nat.includes('참고 통합값')&&['83.9 · 정식 산출 · 방법 검증 기준 미충족','효능 재현 · 합성 LQP 2 µM · 재현 시료 옥수수 α-제인','10.1271/bbb1961.55.1313','효능만 재현하며 기원 근거나 점수 값이 되지 않습니다','독립 DOI 2편(기원 1 + 효능 재현 1)','이 종에서 LQP가 나온다는 기원 근거는 Do et al. 2012 (10.5352/jls.2012.22.2.220) 1편뿐입니다'].every(x=>nat.includes(x)),nat);
  check('Oyster: MBPI 96.3 with paper value and AHTPDB attribution (developer-confirmed public database)',['96.3 · 정식 산출 · 방법 검증 기준 미충족','LQP','1.18 µM','10.5352/jls.2012.22.2.220','펩타이드 352개','doi:10.1093/nar/gku1141','공개 DB · 개발자 이메일 확인(2026-09-27): 누구나 사용 가능'].every(x=>nat.includes(x)),nat);
  await evaluate("document.querySelectorAll('#detail details.score-disclosure').forEach(d=>d.open=false)");
  await detailEl();await shot('desktop-oyster');

  t=await pick(241776);
  check('Sea cucumber: 122 compounds, no quantitative activity',/보고 화합물\s*122개/.test(t)&&/정량 활성 자료\s*확인한 자료에서 없음/.test(t),t);
  check('Sea cucumber: no efficacy claim',!/입증|효능|효과가 있/.test(t),t);
  check('Sea cucumber: CMNPD source and NC-SA terms visible in compound summary',t.includes('CMNPD')&&t.includes('CC BY-NC-SA 4.0')&&t.includes('비상업 이용'),t);
  check('Sea cucumber: published occurrence records, 4-degree generalization',new RegExp(`지도 표시 기록\\s*${cucMap.recordsText}건 · ${cucMap.cells}개 격자\\(4°\\)`).test(t)&&t.includes('GBIF')&&t.includes('4°×4°')&&t.includes('정밀 위치나 전체 분포가 아닙니다'),t);
  // 3.15: the RDA 해삼 row is linked through its MFDS scientific name (Stichopus japonicus), so MFPI 63.5
  check('Sea cucumber: conservation MCUI 80.0 and nutrition MFPI 63.5 from the index report, no stale 미수집/보류',/보전평가\s*지표 보고서에서 검토 · MCUI 80\.0/.test(t)&&/영양 기록 수\s*지표 보고서에서 검토 · MFPI 63\.5/.test(t)&&!t.includes('근거 부족으로 보류')&&!/영양 기록 수\s*미수집/.test(t),t);
  check('Sea cucumber live: reviewed 2026 IUCN EN A2bd is current, 2013 superseded; pilot MCUI 80 with original grade beside it',t.includes('IUCN 현행 평가 EN A2bd: 2026년 발표')&&/보전 평가\s*80\.0 · 정식 산출 · 공식 평가 범주/.test(t)&&!t.includes('undefined')&&t.includes('2025-09-30 평가')&&t.includes('대체된 역사적 평가')&&t.includes('MCUI · 보전 평가')&&t.includes('80.0 · 정식 산출 · 공식 평가 범주')&&!t.includes('Needs updating'),t.slice(t.indexOf('보전'),t.indexOf('보전')+500));
  const mapNote=await evaluate("document.getElementById('map-review-note').textContent+' | '+document.getElementById('map-cells').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length");
  check('Sea cucumber map: broad 4° cells shown without claiming full distribution',mapNote.includes('4° 셀')&&mapNote.includes('붉은 점은 실제 발견 좌표가 아닌')&&mapNote.includes('전체 분포를 뜻하지 않습니다')&&mapNote.includes(` | ${cucMap.cells} | shapes=${cucMap.cells}`),mapNote);
  await detailEl();await shot('desktop-sea-cucumber');

  t=await pick(342067);
  // 3.15: a reviewed aquaculture-feasibility record (false) completes the squid MFPI inputs: 46.1. 3.27: Wako 1996 YALPHA gives MBPI 56.9
  check('Squid: index report replaces the older profile 미수집/미검토 (MFPI 46.1, MBPI 56.9, MCUI 20.0)',/영양 기록 수\s*지표 보고서에서 검토 · MFPI 46\.1/.test(t)&&/보고 화합물\s*지표 보고서에서 검토 · MBPI 56\.9/.test(t)&&/보전평가\s*지표 보고서에서 검토 · MCUI 20\.0/.test(t)&&!/미수집|미검토/.test(t.split('영양 자료 수집 현황')[1]||'')&&t.includes('2건'),t);
  await detailEl();await shot('desktop-squid');
  const leak=await evaluate("document.body.innerText");
  check('No CMNPD raw data / coordinates in page',!/InChI|SMILES|CMNPD\d|raw_record/i.test(leak));
  // The cell line and the withheld reasons read the index report too, not the profile's older 미검토/미수집.
  // 3.15 fills 해삼 MFPI, so its withheld reason is read from BBVI and 살오징어 adds MBPI. 3.15 (team-lead decision 2026-10-02):
  // reference only, so 미역 MCUI stays withheld (IUCN 0 results) beside its Rapid LC reference.
  const stale=await evaluate("(()=>{const s=id=>data.species.find(x=>x.aphiaID===id);return {line:speciesAxesLine(s(145721)),cuc:assessmentBlockers(s(241776)),sq:assessmentBlockers(s(342067)),wak:assessmentBlockers(s(145721))}})()");
  check('Wakame/Sea cucumber/Squid: cell line and withheld reasons follow the index report, not the older profile 미검토/미수집',
    !stale.line.includes('보류')&&!stale.line.includes('미검토')&&  // 4.3: 미역 has its Primorsky MCUI, so nothing is withheld
    Object.keys(stale.wak).length===0&&
    // 3.27: the sea cucumber's single-paper BBVI and the squid's MBPI are scores now, so neither species has a withheld reason left
    Object.keys(stale.cuc).length===0&&Object.keys(stale.sq).length===0&&!JSON.stringify(stale).includes('검수된 영양 값 미확인'),JSON.stringify(stale));

  await evaluate("document.querySelector('[data-view=compare]').click();1");await sleep(300);
  const cmp=(await walkComparison()).map(p=>p.text).join('\n');
  // 4.5: the floor label left the table (no species takes the floor); the relaxation-(d) tag is required instead
  check('Compare table (all pages): every assessments.json score (operating and candidate) plus named withheld reasons and evidence links',reportScores.length>0&&[...reportScores,'정식 산출 · 공식 평가 범주 · 근거 보기','정식 산출 · 방법 검증 통과(11종 비교) · 근거 보기','정식 산출 · 역검증 기준 미충족 · 근거 보기','자체 예비평가(Rapid LC) · IUCN 기반 MCUI와 비교 불가','지방 목록 참고값(연해주)','완화 산출(d)','정식 산출 · 방법 검증 기준 미충족 · 근거 논문 1편 · 근거 보기','수분 환산값(다른 시료)'].every(x=>cmp.includes(x))&&!cmp.includes('시범')&&!cmp.replaceAll('효능 근거 미확인','').includes('미확인')&&!cmp.includes('산출 보류')&&!cmp.includes('예비 평가 참고'),cmp);
  const compareUx=await evaluate("(()=>{const c=document.getElementById('comparison'),g=c.querySelector('.coverage-guide');c.scrollLeft=c.scrollWidth;const guideSticks=Math.abs(g.getBoundingClientRect().left-c.getBoundingClientRect().left)<4;c.scrollLeft=0;const badge=c.querySelector('.seg.calculated'),small=badge.querySelector('small');const contrast=getComputedStyle(small).color==='rgb(255, 255, 255)'&&getComputedStyle(badge).backgroundColor==='rgb(15, 112, 100)';const currentGuide=!g.textContent.includes('종전 2/5')&&g.textContent.includes('완성률이나 근거 품질 점수가 아닙니다');c.querySelector('[data-score-axis=MFPI]').click();const focused=document.activeElement.closest('[data-axis=MFPI]')!==null;const back=document.querySelector('.comparison-return');back.click();return {guideSticks,contrast,currentGuide,focused,returned:document.querySelector('.view.active').id==='compare'&&document.activeElement.dataset.scoreAphia==='836033'}})()");
  check('Comparison guide, badge contrast and keyboard return',Object.values(compareUx).every(Boolean),JSON.stringify(compareUx));
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-compare');
  await evaluate("document.querySelector('[data-view=method]').click();1");await sleep(300);
  const src=await evaluate("document.getElementById('all-sources').innerText");
  check('Sources: AFCD/CMNPD show their own change notes, not OBIS labels',src.includes('해삼 기원 보고 화합물 개수만 집계')&&src.includes('데이터셋 원문')&&!src.includes('OBIS 데이터셋'),src.slice(0,400));

  await evaluate("document.querySelector('[data-view=explore]').click();1");

  // ---------- Published 1° map cells (live) ----------
  const shapes=()=>evaluate("document.querySelectorAll('#map path.leaflet-interactive').length");
  // Spatial cells (one hit area each; period rows of one place share a cell), from the published rows of each operating species.
  const expectCells={};for(const a of [836033,342067,241776,494972,145721,372119,506159,250680])expectCells[a]=(await liveMap(a)).cells;
  const drawn={};for(const a of Object.keys(expectCells)){await pick(a);await sleep(150);drawn[a]=await shapes();}
  // Back-to-back selection used to drop the fit mid-animation (sea cucumber 4° cells cropped at max zoom).
  const fits=await evaluate("[241776,494972,145721,836033,241776].map(a=>{selectSpecies(a);return map.getBounds().contains(L.latLngBounds(selected.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]])))})");
  check('Map view contains every published cell, even on quick species switches',fits.every(Boolean),JSON.stringify(fits));
  const cucDots=await evaluate("selectSpecies(241776);"+cellZoom+"overlay.getLayers().filter(l=>l._schematicDot).length");
  check('4° cells keep 1° dot density (not a few point-like dots)',cucDots>=40,String(cucDots));
  check('Live map: every species has a spatial layer',JSON.stringify(drawn)===JSON.stringify(expectCells),JSON.stringify(drawn));
  // 2026-10-03: overview = regional bubbles (no dots, no BBVI tags); a bubble click zooms in and splits it into dots with species BBVI tags.
  const bub=await evaluate("(()=>{selectSpecies(836033);map.setZoom(5,{animate:false});const ls=overlay.getLayers(),bs=ls.filter(l=>l._zoomMark&&l instanceof L.CircleMarker);const r={bubbles:bs.length,dots:ls.filter(l=>l._schematicDot).length,tags:document.querySelectorAll('#map .bbvi-tag').length,frames:document.querySelectorAll('#map path[stroke-dasharray]').length};bs[0].fire('click');return r})()");
  await sleep(900);
  const split=await evaluate("({zoom:map.getZoom(),dots:overlay.getLayers().filter(l=>l._schematicDot).length,tags:document.querySelectorAll('#map .bbvi-tag').length,tag:document.querySelector('#map .bbvi-tag')?.textContent||''})");
  check('Overview zoom shows regional bubbles only; clicking one zooms in to red dots with species BBVI tags',bub.bubbles>0&&bub.dots===0&&bub.tags===0&&bub.frames===0&&split.zoom>=7&&split.dots>0&&split.tags>0&&/^BBVI (\d+\.\d|미산출)/.test(split.tag),JSON.stringify({bub,split}));
  const sumPop=await evaluate("(()=>{const l=overlay.getLayers().find(l=>l instanceof L.Rectangle&&l.getPopup());l.openPopup();const c=document.querySelector('.leaflet-popup-content');const r={tiles:[...c.querySelectorAll('.cell-summary span')].map(x=>x.textContent),text:c.innerText};map.closePopup();return r})()");
  check('Cell popup opens with confirmed / usable / conservation-priority / evidence-gap species counts',JSON.stringify(sumPop.tiles)==='["확인 종","활용 가능 종","보전 우선 종","근거 부족 종"]'&&sumPop.text.includes('이 격자에서 측정한 값이 아닙니다'),JSON.stringify(sumPop).slice(0,500));
  const sumVal=await evaluate("(()=>{setMapMode('value');const r=[...document.querySelectorAll('#value-cell-detail .cell-summary span')].map(x=>x.textContent);setMapMode('occurrence');return r})()");
  check('Value map cell panel shows the same four species counts',JSON.stringify(sumVal)==='["확인 종","활용 가능 종","보전 우선 종","근거 부족 종"]',JSON.stringify(sumVal));
  check('Live map title names the public-criteria collection',(await evaluate("document.getElementById('map-source').textContent")).includes('공개 기준 자료'));
  t=await pick(836033);
  check('Oyster live: map section explains why publishable, exclusions, OBIS 26 kept under review',['지도 셀','공개 셀','왜 공개할 수 있는가',`CC BY-NC ${snapshot.profiles.find(p=>p.aphia_id===836033).evidence_summary.map.used_licences['CC BY-NC 4.0']}건`,'육지 위 좌표','운영 DB에서 검토 중인 기존 기록','1°를 적용','기존 OBIS 시험 수집 26건'].every(x=>t.includes(x)),t);
  check('Oyster: text matches its published cell (no "instead of cells" contradiction)',!t.includes('공개 출현 셀 대신')&&t.includes('이 수집 기록은 지도 셀에 쓰지 않음'),t.slice(0,600));
  check('Institution checklist: country metadata, ABS/BBNJ links, not a legal determination',['활용 전 제도 확인','법적 판단 아님','기록의 국가 메타데이터','유전자원법','ABS 정보공유체계','BBNJ 협정','관할 경계를 판정할 수 없습니다'].every(x=>t.includes(x)),t.slice(t.indexOf('활용 전'),t.indexOf('활용 전')+400));
  const cucT=await pick(241776);
  check('Sea cucumber detail: checked bioactivity case shown, marked not an index input',cucT.includes('별도 원문 조사 · 지표 입력 아님')&&cucT.includes('Holotoxin'),cucT.slice(cucT.indexOf('화합물'),cucT.indexOf('화합물')+400));
  t=await pick(836033);
  const oyMap=await liveMap(836033);
  const oyTop=await evaluate("(()=>{selectSpecies(836033);const d=document.getElementById('detail');const more=[...d.querySelectorAll('details.detail-more')];return {top:d.querySelector('.detail-summary').innerText,closed:more.length===3&&more.every(x=>!x.open),summaries:more.map(x=>x.querySelector('summary').innerText),kb:more.every(x=>x.querySelector('summary').tabIndex===0)}})()");
  check('Core regression: oyster top = map GBIF records · cells · years of the published cells; OBIS 26건/2008–2014 not mixed in',new RegExp(`지도 표시 기록\\s*${oyMap.recordsText}건 · ${oyMap.cells}개 격자\\(1°\\)`).test(oyTop.top)&&oyTop.top.includes(`기록 연도\n${oyMap.years}`)&&oyTop.top.includes('GBIF')&&!/26건/.test(oyTop.top.split('제외 사유')[0])&&!oyTop.top.includes('2008')&&/제외 사유\s*.*운영 DB에서 검토 중인 기존 기록 26건/.test(oyTop.top)&&!oyTop.top.includes('AphiaID'),oyTop.top);
  await shot('desktop-oyster-collapsed');
  check('Detail: three disclosures closed by default, keyboard-focusable summaries',oyTop.closed&&oyTop.kb&&JSON.stringify(oyTop.summaries)===JSON.stringify(['근거 자세히 보기','수집·선별 기준','출처와 이용조건']),JSON.stringify(oyTop));
  check('Oyster details: separate OBIS 26건 2008–2014 labelled as not in cells; no removed OBIS demo comparison',t.includes('이 수집 기록은 지도 셀에 쓰지 않음')&&/관측 기간\s*2008–2014/.test(t)&&!t.includes('추가 수집'),t.slice(t.indexOf('수집·선별'),t.indexOf('수집·선별')+900));
  check('Counts agree: footer, list card and panel show the same map record total',await evaluate("(()=>{const n=cellRecords(selected);const card=document.querySelector('[data-species=\"836033\"]').innerText.replace(/\\s+/g,' ');return document.getElementById('map-count').textContent===n.toLocaleString()&&card.includes(n+'건 · '+spatialCells(selected).length+'셀')&&document.querySelector('#detail-map-summary').innerText.includes(n+'건')})()"));
  const unplaced=await evaluate("toggleSimulation(false);document.getElementById('matrix-unplaced').innerText+' | '+document.querySelectorAll('#matrix-unplaced button').length");
  const unplacedN=expPub+expCand-placedInMatrix-placedCandidates;
  // verified-pilot-3.2: renamed so it is not confused with the information-sufficiency label '우선 조사 대상'
  // 4.3: every species is placed, so the unplaced box is empty and hidden
  check('Matrix: unplaced species listed apart as unranked follow-up targets, published and candidates counted separately',unplacedN===0?unplaced===' | 0':unplaced.includes(`매트릭스 미배치 ${unplacedN}종 (운영 발행 ${expPub-placedInMatrix}종 · 조사 후보 ${expCand-placedCandidates}종) (BBVI·MCUI 한 쌍 없음)`)&&unplaced.includes('우선 조사 대상’과는 다른 목록')&&unplaced.includes('네 유형과 별개')&&unplaced.includes('기존 카탈로그 순서')&&unplaced.endsWith(' '+unplacedN),unplaced.slice(0,200));
  const simHidden=await evaluate("toggleSimulation(true);const x=document.getElementById('matrix-unplaced').innerHTML==='';toggleSimulation(false);x");
  check('Matrix: priority-survey list hidden in the simulated A–D example',simHidden);
  const pairsGone=await evaluate("document.getElementById('axis-pairs')===null&&typeof axisPairsHtml==='undefined'");
  const refN=await evaluate("({assessed:data.species.filter(s=>s.assessment).length,shown:data.species.filter(s=>s.assessment&&referenceCombination(s)).map(s=>s.aphiaID).sort()})");
  // verified-pilot-2.3: 참굴 has a real BBVI, so only 미역 (single-paper MBPI) keeps the reference value beside a withheld BBVI.
  // 3.1: the ChEMBL stratum gives 멍게 a single-paper MBPI beside its MFPI, so the same rule shows it too;
  // the link review left 바지락·큰가리비 without a ChEMBL item (feces-study sterols, agmatine), so they have no MBPI.
  // 3.3: 홍합 gets an MFPI (60.1, uFiSh zinc) beside its single-paper MBPI 10.1, so the same rule shows it too.
  // 3.5: 넙치 (MFPI 53.3, Ko 2016 MBPI 29.2) and 큰가리비 (MFPI 56.3, VW MBPI 27.3) join under the same rule.
  // 3.6: 톳 and 청각 get an MFPI (calcium, 3 of 4 components) beside their single-paper ChEMBL MBPI.
  // 3.8: 바지락 gets a single-paper peptide MBPI 39.5 (Suetsuna 2002) beside its MFPI 60.4.
  // 3.11: 고등어 gets a single-paper peptide MBPI 34.9 (PLITT, Wang 2024) beside its MFPI 48.0.
  // 3.12: 미역 IY is replicated (Suetsuna 2000), so 미역 has a computed BBVI 63.9 and leaves the reference list.
  // 3.13: 멸치 gets a single-paper peptide MBPI 22.6 (DGGP, Kim 2016) beside its MFPI 74.1.
  // 3.14: 대구 gets a single-paper purified-peptide MBPI 59.9 (GASSGMPG, Ngo 2016) beside its MFPI 38.3; 바지락 MBPI 58.6.
  // 3.15: 해삼 (MFPI 63.5 from the name link) and 전복 (MBPI 15.6 from the uM conversion) join.
  // 3.18: 피조개 (AI-hemocidin 2, 22.1) and 조피볼락 (TS40, 31.6) get a single-paper AMP MBPI beside their MFPI and join too
  // (3.19: 22.0 and 31.7 after Poor Broth joins the cohort).
  // 3.18: the trait chips (#98 layout) are built from adopted evidence only; a trait with none stays a grey, disabled
  // '0종 · 근거 수집 전' chip. The AMP stratum turns 항균 on (2; 3.19 adds 참굴 Cg-BigDef1 -> 3) and fungi are kept out of
  // it (항진균 0). 3.21 turns 항암 on with 피조개, 가시파래 and 맛조개.
  const chips=await evaluate("(()=>{renderUseChips();return [...document.querySelectorAll('.use-chip')].map(b=>[b.dataset.use,parseInt(b.querySelector('b').textContent,10),b.classList.contains('gap'),b.disabled])})()");
  const chipN=Object.fromEntries(chips.map(([id,n])=>[id,n]));
  // 3.27: 살오징어 YALPHA joins ACE (14 -> 15) and 시카메굴 flazin (anti-HIV) joins the virus chip (5 -> 6)
  // 2026-10-03: 내성균 reads the adopted Cg-BigDef1 MRSA rows (1); 항산화 and 항당뇨 take display-only literature rows from
  // trait-evidence.json (team-lead decision 2026-10-03, 2 each); 항진균 and 진통 stay grey (no row passed the rule).
  check('Use chips: counts come from adopted evidence (ACE 15, virus 6, antibacterial 4 from the 3.18/3.19/4.1 AMP stratum, resistant 1 from its MRSA rows, anticancer 3 from the 3.21 stratum, antifungal 0, pain 0, omega-3 9 from the 3.17 EPA+DHA rows) plus display-only rows (antioxidant 2, antidiabetic 2), and a trait with none stays a grey disabled 0 chip',
    chipN.ace===15&&chipN.virus===7&&chipN.microbe===4&&chipN.resistant===1&&chipN.fungus===3&&chipN.pain===1&&chipN.antioxidant===2&&chipN.diabetes===2&&chipN.cancer===3&&chipN.omega3===9&&
    chips.filter(([,n,gap])=>gap).every(([,n,,off])=>n===0&&off)&&chips.filter(([,n,gap])=>!gap).every(([,n,,off])=>n>0&&!off),JSON.stringify(chips));
  // Picking a chip hides the species without that evidence and says how many were hidden; it never claims they are worth less.
  const chipFilter=await evaluate("(()=>{setUses(['microbe']);const ids=[...document.querySelectorAll('.species-card')].map(b=>Number(b.dataset.species));const oyster=document.querySelector('.species-card[data-species=\"836033\"]')?.innerText||'';const ark=document.querySelector('.species-card[data-species=\"504357\"]')?.innerText||'';const note=document.getElementById('use-extra').innerText;setUses([]);return {ids,note,oyster,ark,back:document.querySelectorAll('.species-card').length}})()");
  check('Use chip filter: the antibacterial chip leaves 꽃게 (4.1), 피조개, 조피볼락 and 참굴, counts the hidden species and clears back to all 30',
    JSON.stringify(chipFilter.ids.sort((a,b)=>a-b))==='[274849,504357,836033,1061762]'&&/근거 미확인 26종/.test(chipFilter.note)&&
    /가치가 낮다는 뜻 아님/.test(chipFilter.note)&&chipFilter.back===30&&
    // several strains of one target show their median (the scored value); a single strain shows its own value
    chipFilter.oyster.includes('MIC 2.5 uM (균주 7개 중앙값)')&&chipFilter.ark.includes('MIC 22.77 uM')&&!chipFilter.ark.includes('중앙값'),JSON.stringify(chipFilter));
  // A display-only chip says on every card and in its note that it is not a score.
  const disp=await evaluate("(()=>{setUses(['antioxidant']);const cards=[...document.querySelectorAll('.species-card')].map(b=>[Number(b.dataset.species),b.innerText]);const note=document.getElementById('use-extra').innerText;const title=document.querySelector('[data-use=antioxidant]').title;setUses([]);return {cards,note,title}})()");
  check('Display-only chip: 항산화 shows 감태 and 참조기, each card and the note say 표시 전용·점수 미반영',
    JSON.stringify(disp.cards.map(c=>c[0]).sort())==='[281273,371986]'&&disp.cards.every(c=>c[1].includes('표시 전용, 점수 미반영'))&&
    disp.note.includes('표시 전용 근거로 점수·매트릭스·지도 색에는 쓰지 않으며')&&disp.title.includes('점수 미반영'),JSON.stringify(disp));
  // 2026-10-03: chips combine with AND. The counts are the intersections of the chip counts above; an empty result
  // offers to turn the last chip off, and clearing returns the occurrence map to the species shown before.
  const and=await evaluate(`(()=>{const n=()=>document.querySelectorAll('.species-card').length,before=selected.aphiaID,view=map.getZoom()+'/'+map.getCenter().lat.toFixed(3),r={};
    for(const ids of [['ace','protein_g'],['protein_g','omega3'],['virus','mineral'],['ace','protein_g','omega3'],['virus','parasite']]){const pre=selected.aphiaID;setUses(ids);r[ids.join('+')]=n();r.kept=selected.aphiaID===pre;}
    r.undo=document.querySelector('.use-empty [data-use-off]')?.innerText||'';
    setUses(['virus']);document.querySelector('[data-use=mineral]').click();
    r.badge=document.querySelector('[data-use=parasite]').innerText;r.zero=document.querySelector('[data-use=parasite]').classList.contains('zero');
    r.pressed=[...document.querySelectorAll('[data-use][aria-pressed=true]')].map(b=>b.dataset.use).join();r.hash=decodeURIComponent(location.hash.match(/u=([^&]*)/)?.[1]||'');
    r.sum=document.querySelector('.use-sum')?.innerText||'';r.sel=useMatch(selected);
    document.querySelector('[data-use-clear]').click();r.back=n();r.restored=selected.aphiaID===before;r.cleared=activeUses.size;r.view=map.getZoom()+'/'+map.getCenter().lat.toFixed(3)===view;return r})()`);
  check('Use chips AND: 혈압×고단백 8, 고단백×오메가-3 7, 바이러스×미네랄 5, 혈압×고단백×오메가-3 3, 바이러스×기생충 0 with a turn-last-off button (→ 6) that keeps the map species; badges show what adding a chip leaves; 전체 해제 returns all 30 and the species and map view from before',
    and['ace+protein_g']===8&&and['protein_g+omega3']===7&&and['virus+mineral']===5&&and['ace+protein_g+omega3']===3&&and['virus+parasite']===0&&
    /기생충’ 끄기 → 7종/.test(and.undo)&&and.kept&&/0종/.test(and.badge)&&and.zero&&and.pressed==='virus,mineral'&&and.hash==='virus,mineral'&&
    /5종/.test(and.sum)&&and.sel&&and.back===30&&and.restored&&and.view&&and.cleared===0,JSON.stringify(and));
  // DBAASP supplies the AMP comparison cohort; its terms require naming it wherever the derived data is published.
  const dbaasp=await evaluate("(()=>{const t=document.getElementById('all-sources').innerText;return {named:t.includes('DBAASP'),link:!!document.querySelector('#all-sources a[href*=\"dbaasp.org\"]')}})()");
  check('Method tab source list names DBAASP and links it (its terms ask for attribution wherever derived data is published)',dbaasp.named&&dbaasp.link,JSON.stringify(dbaasp));

  // 3.27 (team-lead decision 2026-10-03): a single-paper top MBPI item now gives a labelled BBVI score, so no species shows
  // the 3.15-3.26 reference combination any more (the code path stays for older reports and is unit-tested)
  check('Reference combination: no longer shown; the 18 single-paper BBVI are labelled scores (3.15-3.26 showed 16 reference values; 3.28: 톳 replicated)',refN.assessed===expPub+expCand&&JSON.stringify(refN.shown)==='[]',JSON.stringify(refN));
  check('Axis pairs box removed: the matrix shows every placed species (2026-10-08)',pairsGone);
  // ---- Presentation polish (2026-09-25) ----
  const og=await evaluate("(async()=>{const m=p=>document.querySelector(`meta[${p}]`)?.content||'';const img=m('property=\"og:image\"');const r=await fetch('og.png');const b=await r.blob();return {title:m('property=\"og:title\"'),desc:m('property=\"og:description\"'),type:m('property=\"og:type\"'),url:m('property=\"og:url\"'),locale:m('property=\"og:locale\"'),card:m('name=\"twitter:card\"'),img,ok:r.ok,type2:b.type,size:b.size,dims:await createImageBitmap(b).then(i=>i.width+'x'+i.height)}})()");
  check('OG tags present, absolute og:image, og.png loads 1200x630 ≤300KB',!!og.title&&!!og.desc&&og.type==='website'&&og.url==='https://blue-bio-map.blue-bio-map.workers.dev/'&&og.locale==='ko_KR'&&og.card==='summary_large_image'&&og.img==='https://blue-bio-map.blue-bio-map.workers.dev/og.png'&&og.ok&&og.dims==='1200x630'&&og.size<=300*1024,JSON.stringify(og));
  const slider=await evaluate("({n:data.species.filter(s=>pilotScore(s,'BBVI')!==null).length,lab:data.species.filter(s=>pilotScore(s,'BBVI')!==null&&s.assessment?.bbvi_label).length,rep:data.species.filter(s=>pilotScore(s,'BBVI')!==null&&!s.assessment?.bbvi_label).map(s=>s.aphiaID).sort((a,b)=>a-b),disabled:document.getElementById('bbvi-weight').disabled,status:document.getElementById('bbvi-weight-status').textContent})");
  // 3.27: 3 replicated (참굴, 미역, 큰가리비) + 19 labelled single-paper BBVI; 3.28: 톳 replicated, 4 + 18
  check('BBVI 30 species (4 replicated: 참굴, 미역, 톳, 큰가리비 + 26 labelled: 23 single-paper and 3 floor; 4.3 adds 참조기 and the floor BBVIs of 방어·참문어·갑오징어): weight slider enabled',slider.n===30&&slider.lab===26&&JSON.stringify(slider.rep)==='[145721,393716,494972,836033]'&&!slider.disabled&&slider.status==='BBVI 산출 종 30종',JSON.stringify(slider));
  const oyCard=await evaluate("document.querySelector('#decision-list [data-aphia=\"836033\"] span').textContent");
  // verified-pilot-3.2: the oyster is placed (national MCUI, marked), so its card leads with the published matrix type
  check('Oyster status card shows only its published matrix type (2026-10-08: evidence labels stay in the detail)',!!typeLabel(836033)&&oyCard===typeLabel(836033)&&!oyCard.includes('검증')&&!oyCard.includes('참고값')&&!oyCard.includes('근거 논문 1편'),oyCard);
  // 2026-10-08: the screen uses neutral label words; the published data keeps the old ones
  const oldWords=await evaluate("(()=>{const v=currentView,hit=[];for(const x of ['explore','compare','method']){setView(x,false);const t=document.body.textContent;for(const w of ['검증 미통과','단일 논문'])if(t.includes(w))hit.push(x+':'+w);}setView(v,false);return hit})()");
  check('No old label words (검증 미통과, 단일 논문) on any tab',oldWords.length===0,oldWords.join(' | '));
  const oyCmp=await evaluate("(()=>{renderComparison();const q=a=>document.querySelector('#comparison [data-score-aphia=\"836033\"][data-score-axis=\"'+a+'\"]')?.textContent.replace(/\\s+/g,' ')||'';const r={MBPI:q('MBPI'),BBVI:q('BBVI')};return r})()");
  check('Comparison table: 참굴 MBPI 96.3 and BBVI 83.9 match the report, pilot label kept, no single-paper label',oyCmp.MBPI.startsWith('96.3')&&oyCmp.BBVI.startsWith('83.9')&&oyCmp.MBPI.includes('정식 산출 · 방법 검증 기준 미충족')&&oyCmp.BBVI.includes('정식 산출 · 방법 검증 기준 미충족')&&!oyCmp.MBPI.includes('근거 논문 1편')&&!oyCmp.BBVI.includes('근거 논문 1편'),JSON.stringify(oyCmp));
  // verified-pilot-3.2: the oyster leaves the follow-up chips and becomes a square (national) matrix point with its type
  const oyPoint=await evaluate("(()=>{toggleSimulation(false);const p=[...document.querySelectorAll('#matrix-points .matrix-point.pilot')].find(b=>b.title.startsWith('참굴'));return {chip:!!document.querySelector('#matrix-unplaced [data-aphia=\"836033\"]'),national:!!p?.classList.contains('national'),title:p?.title||''}})()");
  check('Oyster: placed as a marked national-MCUI point with its type, not listed as a follow-up chip',!oyPoint.chip&&oyPoint.national&&oyPoint.title.includes('MCUI 한국 국가 평가 기반')&&oyPoint.title.includes(typeLabel(836033)),JSON.stringify(oyPoint));
  check('Collection note: no stale "점수는 아직 발행하지 않았습니다"',await evaluate("(()=>{const n=document.getElementById('collection-note').textContent;return !n.includes('점수는 아직 발행하지 않았습니다')&&!n.includes('보류')&&!n.includes('시범')})()"));
  check('Header/initial copy: no "0.2" version, no "첫 버전"/"점수를 산출하지 않아"',await evaluate("!document.querySelector('.version').textContent.includes('0.2')&&!document.body.innerText.includes('첫 버전')&&!document.body.innerText.includes('점수를 산출하지 않아')"));
  const inlineSim=await evaluate("(()=>{toggleSimulation(false);const b=document.getElementById('simulate-inline');if(!b)return 'no button';b.click();const r=simulated&&document.getElementById('matrix-note').textContent.includes('실제 종과 무관');toggleSimulation(false);return r})()");
  // verified-pilot-3.2 places real species, so the empty-matrix shortcut appears only when nothing is placed
  const matrixNote=await evaluate("document.getElementById('matrix-note').textContent");
  check('Empty matrix note links straight to the simulated example (still labelled not real); a placed matrix states its count instead',
    readiness.matrix_points?inlineSim==='no button'&&matrixNote.startsWith(`정식 산출 ${readiness.matrix_points}종`)&&
      matrixNote.includes('네모 점은')===readiness.species.some(r=>r.matrix_eligible&&['national','range_state'].includes(r.mcui_basis))&&matrixNote.includes('한국 국가 평가')===readiness.species.some(r=>r.matrix_eligible&&r.mcui_basis==='national')&&matrixNote.includes('서식국 국가 평가')===readiness.species.some(r=>r.matrix_eligible&&r.mcui_basis==='range_state'):inlineSim===true,String(inlineSim)+' | '+matrixNote);
  const effortOp=await evaluate("(()=>{const eb=[...document.querySelectorAll('.effort-key .eb')].map(e=>getComputedStyle(e).opacity);const fills=[...new Set(effortLayer.getLayers().map(l=>l.options.fillOpacity))].sort();return {eb,fills}})()");
  check('Effort shading lighter than before (legend .07/.15/.25/.37 · layer ≤.14)',JSON.stringify(effortOp.eb)==='["0.07","0.15","0.25","0.37"]'&&Math.max(...effortOp.fills)<=.14,JSON.stringify(effortOp));
  check('Method tab: back-test cases from the proposal, marked run and failed (3.27)',await evaluate("const m=document.getElementById('method').textContent;m.includes('사후 검증 사례(3.27 실행 · 기준 미충족')&&!m.includes('아직 수행 안 함')&&m.includes('Conus magus')&&m.includes('Ecteinascidia turbinata')&&m.includes('Halichondria okadai')"));
  check('Method tab: no outdated grid-centre wording',await evaluate("!document.getElementById('method').textContent.includes('격자 중심')&&document.getElementById('method').textContent.includes('실제 발견·채집 좌표가 아닙니다')"));
  check('Merged PR #1: evidence coverage row and map section both reachable; pilot values carry a caution box',t.includes('자료 연결 현황')&&t.includes('품질 점수 아님')&&t.includes('분석 주의')&&t.includes('지도 셀'),t);
  const popup=await evaluate("const l=overlay.getLayers()[0];l.openPopup();document.querySelector('.leaflet-popup-content').innerText");
  // The popup of one published cell lists each of its period rows with counts and licences (taken from the loaded rows).
  const popCells=await evaluate("spatialCells(selected).map(rows=>[...rows.map(r=>'공개 집계 기간 '+r.period),...rows.map(r=>'선별 기록 '+r.records+'건 · 조사 지점 '+r.sites+'곳'),...rows.flatMap(r=>r.licenses)])");
  check('Cell popup: period, sea area, source, licence, spatial resolution',popCells.some(need=>need.every(x=>popup.includes(x)))&&['1°×1°','가장 짧은 변 약','해역별 활용·보전 판단: 하지 않음(지표는 종 단위)','해역 판단을 하지 않는 이유','원좌표·개체수·자원량·한국 전체 분포가 아닙니다','붉은 점은 실제 발견 좌표가 아닌'].every(x=>popup.includes(x)),popup);
  // PR #9 dots: schematic marks on a pane that takes no clicks; the transparent cell keeps PR #8's evidence popup.
  // Cell fill is 0.1 on the satellite/depth basemaps (satellite is the default since 2026-10-03), 0.06 on the outline fallback.
  check('Cells are faint dashed hit areas, dots drawn on a non-clickable pane',await evaluate("[...document.querySelectorAll('#map path.leaflet-interactive')].every(p=>p.getAttribute('stroke-dasharray')&&Number(p.getAttribute('fill-opacity'))<=.1)&&getComputedStyle(map.getPane('dotPane')).pointerEvents==='none'&&overlay.getLayers().some(l=>l._schematicDot)&&overlay.getLayers().filter(l=>l._schematicDot).every(l=>!l.options.interactive)"));
  // The popup opened above auto-pans the map; measure the dot only after that pan and the scroll have settled.
  await evaluate("map.closePopup();document.getElementById('map').scrollIntoView({block:'center',behavior:'instant'})");
  await sleep(800);
  const dotXY=await evaluate("const ds=overlay.getLayers().filter(l=>l._schematicDot),sz=map.getSize();const d=ds.find(d=>{const p=map.latLngToContainerPoint(d.getLatLng());return p.x>80&&p.x<sz.x-80&&p.y>120&&p.y<sz.y-220})||ds[0];const p=map.latLngToContainerPoint(d.getLatLng());const r=document.getElementById('map').getBoundingClientRect();({x:r.left+p.x,y:r.top+p.y})");
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:dotXY.x,y:dotXY.y,button:'left',clickCount:1});
  const clicked=await waitForText("document.querySelector('.leaflet-popup-content')?.innerText||''",t=>t.includes('해역별 활용·보전 판단: 하지 않음(지표는 종 단위)')&&t.includes('출처·이용조건'));
  const dotOk=clicked.includes('해역별 활용·보전 판단: 하지 않음(지표는 종 단위)')&&clicked.includes('출처·이용조건');
  if(!dotOk)await shot('dot-popup-failure',false).catch(()=>{});
  check('Clicking on a dot opens the cell evidence popup (not blocked by dots)',dotOk,JSON.stringify(dotXY)+' '+clicked.slice(0,200));
  // Same location, two periods (synthetic second row injected in-page; live data has none today): one hit area, both periods reachable by a real click.
  const twoXY=await evaluate("(()=>{const c=spatialCells(selected).find(rows=>rows.length===1)[0];selected.cells.push({...c,period:'2099–2100',yearStart:2099,yearEnd:2099,records:7,sites:5,citations:[{title:'Synthetic second provider',url:'https://example.org/second',licenses:['CC0 1.0']}]});map.closePopup();renderMap();map.setView([c.lat0+c.sizeDeg/2,c.lon0+c.sizeDeg/2],7,{animate:false});document.getElementById('map').scrollIntoView({block:'center'});const p=map.latLngToContainerPoint([c.lat0+c.sizeDeg*.5,c.lon0+c.sizeDeg*.93]);const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y,hits:overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).length,cells:document.getElementById('map-cells').textContent,spatial:spatialCells(selected).length,period:c.period}})()");
  await sleep(400);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:twoXY.x,y:twoXY.y,button:'left',clickCount:1});
  const twoNeed=[`공개 집계 기간 ${twoXY.period}`,'공개 집계 기간 2099–2100','선별 기록 7건 · 조사 지점 5곳','Synthetic second provider','기간 2개'];
  const two=await waitForText("document.querySelector('.leaflet-popup-content')?.innerText||''",t=>twoNeed.every(x=>t.includes(x)));
  check('Two periods in one cell: one hit area, click shows both periods with counts, sites and sources',twoXY.hits===twoXY.spatial&&twoXY.cells===String(twoXY.spatial)&&twoNeed.every(x=>two.includes(x)),JSON.stringify(twoXY)+' '+two.slice(0,300));
  await shot('desktop-two-period-popup',false);
  await evaluate("selected.cells.pop();map.closePopup();1");
  await pick(145721);await sleep(200);
  const wakame=await evaluate("(()=>{const l=overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).find(l=>l.getBounds().getSouth()===33&&l.getBounds().getWest()===126);l.openPopup();return document.querySelector('.leaflet-popup-content').innerText})()");
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
  check('Cell table: one row per spatial cell, both periods of the shared cell listed',tbl.rows===(await liveMap(145721)).cells&&tbl.text.includes('33–34°N · 126–127°E')&&/2000–\d{4}/.test(tbl.text)&&/2016–\d{4}/.test(tbl.text)&&tbl.text.includes('CC0 1.0'),JSON.stringify(tbl).slice(0,400));
  await evaluate("map.closePopup();document.querySelector('#cell-table [data-cell]').focus();1");await sleep(200);
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await sleep(500);
  const kb=await evaluate("({popup:document.querySelector('.leaflet-popup-content')?.innerText||'',focusIn:!!document.activeElement?.closest('.leaflet-popup')})");
  check('Keyboard: Enter on "지도에서 열기" opens the cell popup and moves focus into it',kb.popup.includes('해역별 활용·보전 판단: 하지 않음(지표는 종 단위)')&&kb.focusIn,JSON.stringify(kb).slice(0,200));
  await evaluate("map.closePopup();1");
  // ---- A/B improvements ----
  let ab=await pick(241776);
  check('A-1 top summary: map records, three axis statuses (not a verdict), limit line; publish date kept in sources',await evaluate("(()=>{const c=document.querySelector('#detail .detail-summary');return !!c&&c.innerText.includes('판정 아님')&&c.innerText.includes('지도 표시 기록')&&[...c.querySelectorAll('.evidence-item')].filter(e=>!['해역','이용조건','제외 사유'].includes(e.firstChild.textContent)).length===6&&['해역','이용조건'].every(l=>[...c.querySelectorAll('.evidence-item span')].some(e=>e.textContent===l))&&!!c.querySelector('.detail-limit')&&/발행 \\d{4}-\\d{2}-\\d{2}/.test(document.getElementById('detail').textContent)})()"));
  check('A-2 coverage bar: 5 segments, each segment shows its evidence stage (PR #22 stages, not on/off)',await evaluate("(()=>{const b=document.querySelector('#detail .coverage-bar');const c=evidenceCoverage(selected).checks;const seg=[...(b?.querySelectorAll('.seg')||[])];return seg.length===5&&c.length===5&&seg.every((e,i)=>e.classList.contains(c[i].stage)&&e.textContent.includes(coverageStages[c[i].stage]))})()"));
  check('A-4 IUCN: superseded 2013 assessment no longer flagged Needs updating; 2026 assessment cited',!ab.includes('Needs updating')&&ab.includes('2013년 발표 (2026년 평가로 대체)')&&ab.includes('Hamel & Mercier 2026'),ab.slice(ab.indexOf('보전'),ab.indexOf('보전')+300));
  const pop=await evaluate("(()=>{map.closePopup();overlay.getLayers().find(l=>!l._schematicDot&&!l._zoomMark).openPopup();return [...document.querySelectorAll('.leaflet-popup-content')].at(-1).innerText})()");
  check('A-3 popup: GBIF generalisation vocabulary and 4° sensitivity note',['dataGeneralizations','informationWithheld','GBIF 지침의 가장 엄격한 등급(1°)보다 넓은 4° 셀','재검토 예정일: 미정'].every(x=>pop.includes(x)),pop.slice(0,400));
  check('B-1 popup: effort reference line, not presence',/OBIS 전체 종 기록 [\d,]+건\(2000년 이후\)/.test(pop)&&pop.includes('이 종의 존재·개체수와 무관'),pop.slice(0,400));
  const eff=await evaluate("(()=>({n:effortLayer?.getLayers().length,date:document.getElementById('effort-date').textContent,pane:getComputedStyle(map.getPane('effortPane')).pointerEvents}))()");
  check('B-1 effort layer drawn from snapshot, non-clickable, dated',eff.n>100&&/\d{4}-\d{2}-\d{2} 조회/.test(eff.date)&&eff.pane==='none',JSON.stringify(eff));
  const off=await evaluate("(()=>{const t=document.getElementById('effort-toggle');t.click();const a=effortLayer.getLayers().length;t.click();return [a,effortLayer.getLayers().length]})()");
  check('B-1 effort toggle hides and restores the layer',off[0]===0&&off[1]>100,JSON.stringify(off));
  await evaluate("map.closePopup();1");
  await pick(145721);await sleep(200);
  const pf=await evaluate("(()=>{const b=[...document.querySelectorAll('#period-filter [data-period]')];const all=overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).length;b.find(x=>x.dataset.period.startsWith('2000')).click();const one=overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).length;const rows=document.querySelectorAll('#cell-table tbody tr').length;const hash=location.hash;b[0].click();return {buttons:b.length,all,one,rows,hash,back:overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).length}})()");
  check('A-5 period filter: 미역 has 전체+2 periods; filtering reduces cells and table; hash records it',pf.buttons===3&&pf.one<pf.all&&pf.rows===pf.one&&/p=2000/.test(decodeURIComponent(pf.hash))&&pf.back===pf.all,JSON.stringify(pf));
  const csv=await evaluate("(()=>{const t=cellCsv(selected);return {bom:t.charCodeAt(0)===0xFEFF,lines:t.split('\\r\\n').length,cells:selected.cells.length,head:t.slice(1,40)}})()");
  const pfSum=await evaluate("(()=>{const b=[...document.querySelectorAll('#period-filter [data-period]')];b.find(x=>x.dataset.period.startsWith('2000')).click();const one=document.getElementById('detail-map-summary').innerText;b[0].click();return {one,all:document.getElementById('detail-map-summary').innerText}})()");
  check('Period filter relabels the panel summary (selected period vs 전체 기간)',pfSum.one.includes('선택 기간 2000')&&pfSum.all.includes('전체 기간'),JSON.stringify(pfSum));
  check('A-5 CSV: BOM, header + one line per published period row',csv.bom&&csv.lines===csv.cells+1&&csv.head.startsWith('"species_label"'),JSON.stringify(csv));
  check('A-6 info panel and copy-link control present',await evaluate("!!document.querySelector('.map-info summary')&&document.querySelector('.map-legend-more').textContent.includes('회색 음영')&&!!document.getElementById('copy-link')"));
  // Shared link restores species, tab and basemap after a reload.
  await evaluate("location.hash='s=241776&v=compare&b=depth';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);
  const restored=await evaluate("({s:selected?.aphiaID,v:currentView,b:basemap})");
  check('A-5 shared link restores species, tab and basemap',restored.s===241776&&restored.v==='compare'&&restored.b==='depth',JSON.stringify(restored));
  await evaluate("setBasemap('satellite');setView('explore');history.replaceState(null,'',location.pathname);1");
  // A real tab change starts at the top of the page (setView scrolls only when the view changes).
  const tabTop=await evaluate("(()=>{setView('compare');scrollTo(0,1500);const from=Math.round(scrollY);document.querySelector('[data-view=method]').click();const r={from,to:Math.round(scrollY),view:currentView};setView('explore');return r})()");
  check('Tab change resets the page to the top: compare scrolled down, then the 근거와 방법 tab opens at scrollY 0',tabTop.from>0&&tabTop.to===0&&tabTop.view==='method',JSON.stringify(tabTop));
  // 근거 상태 filter: 운영 발행 = !s.catalog, 조사 후보 = !!s.catalog (the same split as the header counts).
  const evid=await evaluate("(()=>{const sel=document.getElementById('species-evidence'),n=v=>{sel.value=v;sel.dispatchEvent(new Event('change'));return document.querySelectorAll('#species-list .species-card').length;};const r={published:n('published'),candidate:n('candidate'),all:n('all'),wantPublished:data.species.filter(s=>!s.catalog).length,wantCandidate:data.species.filter(s=>!!s.catalog).length,total:data.species.length};return r})()");
  check('Species filter 근거 상태: 운영 발행 / 조사 후보 counts come from data.species and add up to all species',evid.published===evid.wantPublished&&evid.candidate===evid.wantCandidate&&evid.published>0&&evid.candidate>0&&evid.published+evid.candidate===evid.total&&evid.all===evid.total,JSON.stringify(evid));
  // ↻ reloads the data, re-applies species and use chip from the hash and leaves the tab as it was.
  await evaluate("selectSpecies(274849);setUses(['microbe']);setView('compare');document.getElementById('reload-data').click();1");
  for(let i=0;i<80;i++){await sleep(250);if(await evaluate('!!data'))break;}
  const kept=await evaluate("({s:selected?.aphiaID,use:[...activeUses].join(),v:currentView})");
  check('↻ reload keeps the selected species, use chip and tab',kept.s===274849&&kept.use==='microbe'&&kept.v==='compare',JSON.stringify(kept));
  await evaluate("setUses([]);setView('explore');history.replaceState(null,'',location.pathname);1");
  const bars=await walkComparison();
  check('A-2 comparison table shows one coverage bar per species column, all species covered',bars.length===1&&bars[0].bars===total&&bars[0].cols===total,JSON.stringify(bars.map(p=>[p.label,p.bars,p.cols])));
  const stickyCompare=await evaluate("(()=>{setView('compare');const c=document.getElementById('comparison');c.scrollLeft=c.scrollWidth;const left=c.getBoundingClientRect().left;const row=c.querySelector('tbody th').getBoundingClientRect().left;const head=c.querySelector('thead th').getBoundingClientRect().left;const label=getComputedStyle(c.querySelector('.coverage-bar .seg b'));const result={left,row,head,wrap:label.whiteSpace,overflow:label.overflow};c.scrollLeft=0;setView('explore');return result})()");
  check('Comparison labels remain visible after horizontal scroll and badges wrap',Math.abs(stickyCompare.row-stickyCompare.left)<4&&Math.abs(stickyCompare.head-stickyCompare.left)<4&&stickyCompare.wrap==='normal'&&stickyCompare.overflow==='visible',JSON.stringify(stickyCompare));
  t=await pick(836033);
  check('Legend: red dots are a schematic of published cells, not discovery coordinates',await evaluate("!document.querySelector('.map-key').hidden&&document.getElementById('map-legend-note').textContent.includes('점 간격')&&document.getElementById('map-symbol-label').textContent.includes('실제 발견 좌표 아님')&&document.getElementById('map-judgment').textContent.includes('매트릭스 유형')"));
  const fold=await evaluate("(()=>{const b=document.getElementById('legend-toggle'),box=b.parentElement,key=document.querySelector('.map-key');const vis=e=>e.getBoundingClientRect().height>0;const r={open:vis(key)&&b.getAttribute('aria-expanded')==='true'};b.click();r.folded=!vis(key)&&vis(b)&&b.getAttribute('aria-expanded')==='false'&&b.getBoundingClientRect().width<=44;b.click();setMapMode('value');const mini=document.getElementById('value-mini'),pop=document.getElementById('value-legend'),info=document.getElementById('value-info');r.valueFolded=!vis(b)&&vis(mini)&&!vis(pop)&&info.getAttribute('aria-expanded')==='false';info.click();r.valueOpen=vis(pop)&&info.getAttribute('aria-expanded')==='true';document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));r.escClosed=!vis(pop)&&document.activeElement===info;info.click();document.getElementById('map').click();r.outsideClosed=!vis(pop);setMapMode('occurrence');r.back=vis(key)&&!vis(mini);return r;})()");
  check('Legend fold: open on load, the button folds the occurrence legend; value mode shows only the corner icon, ⓘ opens the full legend, Esc and an outside click close it',fold.open&&fold.folded&&fold.valueFolded&&fold.valueOpen&&fold.escClosed&&fold.outsideClosed&&fold.back,JSON.stringify(fold));
  await sleep(400);await shot('desktop-live-oyster-cell');await evaluate('map.closePopup();1');await sleep(400);
  t=await pick(494972);
  const hijMap=await liveMap(494972);
  check('톳 live: published cells, nutrition/compounds/conservation from the index report',(await shapes())===hijMap.cells&&/영양 기록 수\s*지표 보고서에서 검토 · MFPI 63\.3/.test(t)&&/보고 화합물\s*지표 보고서에서 검토 · MBPI 86\.6/.test(t)&&/보전평가\s*지표 보고서에서 검토 · MCUI 60\.0 \(지방 목록 참고값\)/.test(t)&&new RegExp(`지도 표시 기록\\s*[\\d,]+건 · ${hijMap.cells}개 격자`).test(t)&&t.includes('GBIF'),t);
  await detailEl();await shot('desktop-live-hijiki');
  t=await pick(241776);
  check('Sea cucumber live: published 4-degree cells visible',(await shapes())===cucMap.cells&&t.includes('공개 셀')&&t.includes(`${cucMap.cells}개 · 4°×4°`)&&(await evaluate("document.getElementById('map-source').textContent")).includes('공개 4° 셀'),t);
  const plain=await evaluate("document.body.innerText");
  check('Page shows no raw coordinates',!/\d{2,3}\.\d{3,}/.test(plain),plain.match(/\d{2,3}\.\d{3,}/)?.[0]);
  // ---------- Map mode buttons: occurrence <-> utilization × conservation ----------
  const modeState=()=>evaluate(`(()=>{const q=s=>document.querySelector(s),pressed=m=>q('[data-map-mode="'+m+'"]').getAttribute('aria-pressed');
    return {mode:mapMode,occ:pressed('occurrence'),val:pressed('value'),occLegend:!q('#occurrence-legend').hidden,valLegend:!q('#value-mini').hidden,
      panel:!q('#value-cell-detail').hidden,panelText:q('#value-cell-detail').innerText,effortDisabled:q('#effort-toggle').disabled,
      effort:effortLayer?effortLayer.getLayers().length:-1,source:q('#map-source').textContent,judgment:q('#map-judgment').textContent,
      hash:decodeURIComponent(location.hash),shapes:document.querySelectorAll('#map path.leaflet-interactive').length}})()`);
  const clickMode=async m=>{await evaluate(`document.querySelector('[data-map-mode="${m}"]').click();1`);await sleep(300);return modeState();};
  let ms=await clickMode('value');
  check('Map mode button → value: pressed state, value legend, cell panel, no effort layer, hash t=value',
    ms.mode==='value'&&ms.occ==='false'&&ms.val==='true'&&!ms.occLegend&&ms.valLegend&&ms.panel&&ms.panelText.includes('선택한 공개 격자')&&ms.panelText.includes('합산 점수·우선순위는 산출하지 않았습니다')&&ms.effortDisabled&&ms.effort===0&&ms.source.startsWith('활용 × 보전')&&/(^|&)t=value/.test(ms.hash.slice(1))&&ms.shapes>0,JSON.stringify(ms));
  // verified-pilot-3.2 (figure 5): legend in the figure's order, cells coloured by species type, sufficiency layers toggle apart
  // sufficiency markers are not interactive (the cell keeps the click), so count overlay layers rather than clickable paths
  const layers=await evaluate(`(async()=>{const q=s=>document.querySelector(s),count=()=>overlay.getLayers().length,clickable=()=>document.querySelectorAll('#map path.leaflet-interactive').length,before=count(),hits=clickable(),box=q('#layer-priority');
    box.checked=true;box.dispatchEvent(new Event('change'));const on=count(),hitsOn=clickable(),markers=overlay.getLayers().filter(l=>l instanceof L.CircleMarker);box.checked=false;box.dispatchEvent(new Event('change'));
    return {before,on,off:count(),hits,hitsOn,markersInteractive:markers.some(l=>l.options.interactive!==false),markers:markers.length,legend:[...q('#value-legend').querySelectorAll('[role=listitem] b')].map(e=>e.textContent),judgment:q('#map-judgment').textContent,rule:q('#value-rule').textContent,
      pCount:q('#layer-priority-count').textContent,uCount:q('#layer-unexplored-count').textContent,noCell:q('#layer-nocell').textContent,legendText:q('#value-legend').innerText}})()`);
  const rep=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8')),flagged=[...rep.species,...rep.candidate_species];
  const outside=JSON.parse(fs.readFileSync(new URL('../dist/unexplored-candidates.json',import.meta.url),'utf8')).species;  // 4.0: 30종 밖 근연종
  const nP=flagged.filter(s=>s.priority_survey).length,nU=flagged.filter(s=>s.unexplored_candidate).length+outside.length;
  check('Value map (3.2): figure-5 legend, type-coloured cells, priority-survey layer toggles without recolouring or taking clicks',
    JSON.stringify(layers.legend)===JSON.stringify(['보전 우선·모니터링','대체생산·배양 연구','기초조사·관찰 대상','지속가능 활용 후보'])&&
    layers.judgment.includes('종 유형으로 칠한 공개 격자')&&layers.rule.includes('50 이상이면 높음')&&layers.rule.includes('소수 한 자리')&&layers.rule.includes('50% 미만')&&
    (nP?layers.on>layers.before&&layers.markers>0:layers.on===layers.before&&layers.markers===0)&&layers.off===layers.before&&  // 4.3: no species is flagged
    !layers.markersInteractive&&layers.hitsOn===layers.hits&&!layers.legendText.includes('빗금'),JSON.stringify(layers));
  check('Value map (3.2): layer labels count flagged species and those on the map; flagged species without a cell are listed',
    layers.pCount.startsWith(nP+'종 · 지도 표시 ')&&layers.uCount.startsWith(nU+'종 · 지도 표시 ')&&
    (layers.uCount===nU+'종 · 지도 표시 0종'&&nU?layers.noCell.includes('미탐색 후보 중 공개 출현 셀이 없어'):true)&&
    // Once every flagged species has a cell (시카메굴, NIBR points 2026-10-01) there is nothing to list; 3.15 leaves no unexplored candidate.
    (layers.pCount===nP+'종 · 지도 표시 '+nP+'종'&&layers.uCount===nU+'종 · 지도 표시 '+nU+'종'?layers.noCell==='':layers.noCell.includes('종 부재나 분포 없음을 뜻하지 않습니다')),JSON.stringify(layers));
  // The 2×2 corner icon: the legend's counts and colours, hover dims the other types, clicks filter (several at once), the wheel never zooms the map
  await evaluate("document.getElementById('map').scrollIntoView({block:'center'});1");await sleep(300);
  const icon=await evaluate(`(()=>{const q=s=>document.querySelector(s),grid=q('.vm-grid').getBoundingClientRect(),sw=q('.basemap-switch').getBoundingClientRect(),plot=q('.vm-plot').getBoundingClientRect();
    const legend=[...q('#value-legend').querySelectorAll('[data-key]')].map(e=>[e.dataset.key,e.querySelector('em').textContent,e.style.background]);
    const cells=[...q('.vm-grid').querySelectorAll('[data-key]')].map(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.key,n:Number(e.textContent),bg:e.style.background,tip:e.dataset.tip,x:r.x+r.width/2,y:r.y+r.height/2};});
    return {legend,cells,size:[grid.width,grid.height],below:grid.top>=sw.bottom,right:Math.abs(plot.right-q('.map-ui-tr').getBoundingClientRect().right)<2,all:valueRects.length}})()`);
  const typed=icon.cells.filter(c=>c.n>0),mouse=async(type,c,extra={})=>send('Input.dispatchMouseEvent',{type,x:c.x,y:c.y,button:'left',clickCount:1,...extra});
  const iconState=()=>evaluate("({drawn:valueRects.length,dim:valueRects.filter(([,l])=>l.options.fillOpacity===.06).length,pressed:[...document.querySelectorAll('.vm-grid [aria-pressed=true]')].map(e=>e.dataset.key),zoom:map.getZoom(),centre:map.getCenter().toString(),tip:getComputedStyle(document.querySelector('#value-mini .vm-grid [data-key]:hover')||document.body,'::after').content})");
  const iconS0=await iconState();
  await mouse('mouseMoved',typed[0]);await sleep(200);const iconHover=await iconState();
  await mouse('mousePressed',typed[0]);await mouse('mouseReleased',typed[0]);await sleep(400);const iconOne=await iconState();
  await mouse('mouseMoved',typed[1]);await mouse('mousePressed',typed[1]);await mouse('mouseReleased',typed[1]);await sleep(400);const iconTwo=await iconState();
  for(const c of typed.slice(0,2)){await mouse('mouseMoved',c);await mouse('mousePressed',c);await mouse('mouseReleased',c);await sleep(300);}
  await mouse('mouseWheel',typed[0],{deltaX:0,deltaY:-600,button:'none'});await sleep(500);const iconAfter=await iconState();
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
  check('Value map icon: 72px 2×2 under the basemap switch, the legend’s own counts and colours; hover dims the other types and names the type; clicks filter one or two types and clear; the wheel leaves the map alone',
    JSON.stringify(icon.legend)===JSON.stringify(icon.cells.map(c=>[c.key,c.n+'셀',c.bg]))&&icon.size.every(v=>Math.abs(v-72)<1)&&icon.below&&icon.right&&typed.length>=2&&
    iconS0.drawn===icon.all&&iconS0.dim===0&&iconHover.dim===icon.all-typed[0].n&&iconHover.tip.includes(typed[0].tip)&&
    iconOne.drawn===typed[0].n&&JSON.stringify(iconOne.pressed)===JSON.stringify([typed[0].key])&&iconTwo.drawn===typed[0].n+typed[1].n&&iconTwo.pressed.length===2&&
    iconAfter.drawn===icon.all&&!iconAfter.pressed.length&&iconAfter.zoom===iconS0.zoom&&iconAfter.centre===iconS0.centre,JSON.stringify({icon,iconS0,iconHover,iconOne,iconTwo,iconAfter}));
  // 4.0: the outside candidates' list and purple markers (no score, one marker per public cell; a failed record check says so)
  const outList=await evaluate(`(async()=>{const box=document.querySelector('#layer-unexplored');box.checked=true;box.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,300));const d=document.querySelector('#unexplored-outside'),li=[...d.querySelectorAll('li')].map(e=>e.textContent);
    const purple=overlay.getLayers().filter(l=>l instanceof L.CircleMarker&&l.options.color==='#6b3fa0').length;box.checked=false;box.dispatchEvent(new Event('change'));
    return {hidden:d.hidden,summary:d.querySelector('summary')?.textContent,li,purple}})()`);
  const outCells=new Set(outside.flatMap(s=>s.cells.map(c=>[c.lat0,c.lon0,c.sizeDeg].join()))).size;
  check('Value map (4.0): 30종 밖 미탐색 후보 list and one purple marker per public cell; a failed record check is named, never shown as no records',
    !outList.hidden&&outList.summary===`30종 밖 미탐색 후보 ${outside.length}종 목록 · 점수 없음`&&outList.li.length===outside.length&&outList.purple===outCells&&
    outside.filter(s=>s.review.status==='fetch_check_failed').every(s=>outList.li.some(t=>t.includes(s.name)&&t.includes('GBIF 기록 수 대조 불일치로 셀 미표시')))&&
    outList.li.every(t=>/BBVI \d+\.\d/.test(t)),JSON.stringify({...outList,li:outList.li.slice(0,3),outCells}));
  await pick(emptyPick);await sleep(300);ms=await modeState();
  check(`Value mode + candidate ${noCell?'without public cells: stays in value mode, explains no link':'시카메굴 with NIBR-point cells: stays in value mode, no no-cell alert'}`,
    ms.mode==='value'&&ms.panelText.includes('공개 가능한 출현 격자가 없어')===!!noCell&&new RegExp('s='+emptyPick).test(ms.hash),JSON.stringify(ms));
  ms=await clickMode('occurrence');
  check(`Map mode button → occurrence: pressed state, occurrence legend, panel hidden, hash t=occurrence, ${noCell?'no fake cell for candidate':'시카메굴 cells drawn once'}`,
    ms.mode==='occurrence'&&ms.occ==='true'&&ms.val==='false'&&ms.occLegend&&!ms.valLegend&&!ms.panel&&!ms.source.startsWith('활용')&&!ms.judgment.includes('조합 분류')&&/(^|&)t=occurrence/.test(ms.hash.slice(1))&&ms.shapes===emptyPlaces,JSON.stringify(ms));
  await pick(836033);await sleep(300);ms=await modeState();
  check('Back in occurrence mode: live species redraws cells and the effort layer',!ms.effortDisabled&&ms.effort>100&&ms.shapes>0&&!ms.source.startsWith('활용'),JSON.stringify(ms));
  await pick(504357);await sleep(300);ms=await modeState();
  check('피조개: every reviewed 4° cell drawn once, not a current distribution',ms.shapes===arkPlaces&&ms.source==='조사 후보 · 검수 기록 공개 4° 셀'&&(await evaluate("document.getElementById('map-review-note').textContent")).includes('현재 분포'),JSON.stringify(ms));
  const arkPop=await evaluate(`(()=>{const l=overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).find(l=>l.getBounds().getSouth()===${arkOld.lat0}&&l.getBounds().getWest()===${arkOld.lon0});l.openPopup();const t=document.querySelector('.leaflet-popup-content').innerText;map.closePopup();return t})()`);
  check('피조개 pre-2000 cell popup: historical record marked, outside-EEZ flag as in the release',arkPop.includes('과거 기록(2000년 이전) · 현재 분포 근거 아님')&&arkPop.includes(String(arkOld.yearStart))&&arkPop.includes('한국·북한 EEZ 밖')===arkOld.outsideKoreanEEZ,arkPop.slice(0,400));
  const sweep=[];
  for(const e of release){
    const detail=await pick(e.aphiaID);await sleep(150);const m=await modeState(),note=await evaluate("document.getElementById('map-review-note').textContent");
    if(m.shapes!==places(e)||!detail.includes(e.name)||!(e.cells.length?note.includes('현재 분포'):note.includes('제외 사유')&&note.includes('종 부재')))sweep.push(`${e.name} ${m.shapes}/${places(e)}`);
  }
  check(`All ${release.length} candidates: detail opens and the map draws exactly the reviewed cells or states the withheld reasons`,sweep.length===0,sweep.join(' | '));
  ms=await clickMode('value');ms=await clickMode('occurrence');ms=await clickMode('value');
  check('Repeated toggling leaves a single consistent value state',ms.mode==='value'&&ms.val==='true'&&ms.occ==='false'&&ms.valLegend&&!ms.occLegend&&ms.effort===0,JSON.stringify(ms));
  ms=await clickMode('occurrence');
  check('Back to occurrence mode restores the live map',ms.mode==='occurrence'&&ms.occLegend&&!ms.panel&&!ms.source.startsWith('활용')&&ms.shapes>0,JSON.stringify(ms));
  await evaluate("location.hash='s=836033&v=explore&b=basic&t=value';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);ms=await modeState();
  check('Shared link with t=value restores the value map and its pressed button',ms.mode==='value'&&ms.val==='true'&&ms.valLegend,JSON.stringify(ms));
  await clickMode('occurrence');await evaluate("history.replaceState(null,'',location.pathname);1");
  // ---------- Comparison: every species in one table that scrolls sideways ----------
  const cmpState="(()=>{const c=document.getElementById('comparison'),[corner,...h]=c.querySelectorAll('thead th'),cl=c.getBoundingClientRect().left;return {label:document.getElementById('comparison-page').textContent,prev:document.getElementById('comparison-prev').disabled,next:document.getElementById('comparison-next').disabled,left:Math.round(c.scrollLeft),max:c.scrollWidth-c.clientWidth,stuck:Math.abs(corner.getBoundingClientRect().left-cl)<2&&Math.abs(c.querySelector('tbody th').getBoundingClientRect().left-cl)<2,heads:h.map(x=>x.querySelector('small').textContent)}})()";
  await evaluate("selectSpecies(data.species[0].aphiaID);setView('compare');1");await sleep(200);
  const sc={start:await evaluate(cmpState),names:await evaluate('data.species.map(s=>s.name)')};
  await evaluate("document.getElementById('comparison-next').click();1");await sleep(1000);sc.next=await evaluate(cmpState);
  await evaluate("(()=>{const c=document.getElementById('comparison');c.scrollLeft=c.scrollWidth;return 1})()");await sleep(300);sc.end=await evaluate(cmpState);
  await evaluate("document.getElementById('bbvi-weight').dispatchEvent(new Event('input'));1");await sleep(300);sc.redrawn=await evaluate(cmpState);
  await evaluate("(()=>{setView('explore');document.getElementById('comparison').scrollLeft=0;selectSpecies(data.species.at(-1).aphiaID);setView('compare');return 1})()");await sleep(300);sc.picked=await evaluate(cmpState);
  await evaluate("selectSpecies(data.species[0].aphiaID);setView('explore');1");
  const atEnd=p=>p.left>=p.max-1&&p.label.endsWith(`${total}종 / 총 ${total}종`)&&p.next&&!p.prev;
  check('Comparison scroll: one table with all species, label follows the visible columns, prev/next move a screen and stop at the ends, first column sticks, redraw and a picked species keep the right place',
    total===expPub+expCand&&JSON.stringify(sc.start.heads)===JSON.stringify(sc.names)&&
    sc.start.left===0&&sc.start.prev&&!sc.start.next&&/^1(–\d+)?종 \/ 총 \d+종$/.test(sc.start.label)&&sc.start.label.endsWith(`총 ${total}종`)&&
    sc.next.left>0&&!sc.next.prev&&sc.next.label!==sc.start.label&&
    atEnd(sc.end)&&sc.end.stuck&&sc.redrawn.left===sc.end.left&&sc.redrawn.label===sc.end.label&&atEnd(sc.picked),
    JSON.stringify({...sc,names:sc.names.length,start:{...sc.start,heads:sc.start.heads.length},next:{...sc.next,heads:0},end:{...sc.end,heads:0},redrawn:{...sc.redrawn,heads:0},picked:{...sc.picked,heads:0}}));
  // ---------- Background maps: satellite (NASA GIBS, default) / depth (GEBCO); the bundled outline map only replaces failed tiles ----------
  await pick(494972);
  check('Basemap switch: only 위성 and 수심, no 기본 button',(await evaluate("[...document.querySelectorAll('[data-basemap]')].map(b=>b.dataset.basemap+':'+b.textContent).join()"))==='satellite:위성,depth:수심');
  const tiles=host=>evaluate(`[...document.querySelectorAll('#map img.leaflet-tile-loaded')].filter(i=>i.src.includes('${host}')).length`);
  const waitTiles=async host=>{for(let i=0;i<60;i++){if(await tiles(host)>0)return true;await sleep(500);}return false;};
  // screenshots only after every visible tile finished (GEBCO WMS is slow)
  const settle=async()=>{for(let i=0;i<60;i++){if(!(await evaluate("document.querySelectorAll('#map img.leaflet-tile:not(.leaflet-tile-loaded)').length")))break;await sleep(500);}await sleep(500);};
  await evaluate("document.querySelector('[data-basemap=satellite]').click();1");
  check('Satellite basemap: NASA GIBS tiles load, cells kept, bright style',await waitTiles('gibs.earthdata.nasa.gov')&&(await shapes())===hijMap.cells&&await evaluate("document.getElementById('map').classList.contains('map-dark')&&document.querySelector('[data-basemap=satellite]').getAttribute('aria-pressed')==='true'"));
  await settle();await shot('desktop-basemap-satellite');
  await evaluate("document.querySelector('[data-basemap=depth]').click();1");
  check('Depth basemap: GEBCO tiles load, cells kept',await waitTiles('wms.gebco.net')&&(await shapes())===hijMap.cells&&(await tiles('gibs.earthdata.nasa.gov'))===0);
  await settle();await shot('desktop-basemap-depth');
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBlockedURLs',{urls:['*gibs.earthdata.nasa.gov*']});
  await evaluate("document.querySelector('[data-basemap=satellite]').click();1");
  let fell='';for(let i=0;i<40;i++){await sleep(250);fell=await evaluate("document.getElementById('basemap-status').textContent");if(fell)break;}
  check('Tile failure falls back to the 1:10m outline map with a message: no external tiles, no button pressed, cells kept',fell.includes('경계선만 있는 지도로 바꿨습니다')&&(await evaluate("basemap==='basic'&&!document.querySelector('[data-basemap][aria-pressed=true]')&&!document.getElementById('map').classList.contains('map-dark')&&document.querySelectorAll('#map img.leaflet-tile').length===0"))&&(await shapes())===hijMap.cells,fell);
  await send('Network.setBlockedURLs',{urls:[]});await send('Network.setCacheDisabled',{cacheDisabled:false});
  await evaluate("localStorage.setItem('basemap','basic');1");await load();
  check('A browser that stored 기본 before 2026-10-03 opens satellite, the default',await evaluate("basemap==='satellite'&&localStorage.getItem('basemap')==='satellite'&&document.querySelector('[data-basemap=satellite]').getAttribute('aria-pressed')==='true'"));
  await evaluate("try{localStorage.removeItem('basemap')}catch{};1");

  // ---------- Page width: only the comparison wrapper may scroll sideways ----------
  for(const [w,h,mobile] of [[390,844,true],[768,1024,false],[1280,900,false],[1560,900,false]]){
    await viewport(w,h,mobile);await load();
    const widths=await evaluate("['explore','compare','method'].map(v=>{setView(v);const d=document.documentElement;return v+' '+d.scrollWidth+'/'+d.clientWidth+(d.scrollWidth<=d.clientWidth?'':' OVER')})");
    const cmpScroll=await evaluate("(()=>{setView('compare');const c=document.getElementById('comparison'),s=getComputedStyle(c);const r={own:c.scrollWidth>c.clientWidth?s.overflowX:'fits',pageX:getComputedStyle(document.body).overflowX+'/'+getComputedStyle(document.documentElement).overflowX};setView('explore');return r})()");
    check(`Page width ${w}px: explore/compare/method never wider than the viewport; table scrolls in its own box (no overflow-x:hidden on page)`,widths.every(x=>!x.endsWith('OVER'))&&['fits','auto','scroll'].includes(cmpScroll.own)&&!cmpScroll.pageX.includes('hidden'),widths.join(' | ')+' '+JSON.stringify(cmpScroll));
    if(w===1560){await evaluate("setView('compare');window.scrollTo(0,0);1");await shot('desktop-1560-compare',false);await evaluate("setView('explore');1");}
  }

  // ---------- The eight demo flows, desktop and mobile (screenshots in OUT) ----------
  for(const [tag,w,h,mobile] of [['desktop',1560,900,false],['mobile',390,844,true]]){
    await viewport(w,h,mobile);await load();
    const mapShot=async name=>{await evaluate(`document.getElementById('map').scrollIntoView({block:'${mobile?'start':'center'}'});1`);await sleep(600);await shot(`${tag}-flow-${name}`,false);};
    const flow=async aphia=>{await pick(aphia);await sleep(300);return evaluate("({sel:document.getElementById('map-selected').innerText,src:document.getElementById('map-source').textContent,note:document.getElementById('map-review-note').textContent,shapes:document.querySelectorAll('#map path.leaflet-interactive').length,detail:document.getElementById('detail').innerText})");};
    let f=await flow(836033);
    check(`Flow 1 ${tag}: 참굴 MFPI 71.6 above the map and in the panel`,f.sel.includes('참굴')&&f.sel.includes('운영 발행')&&f.sel.includes('MFPI 71.6')&&f.detail.includes('71.6 · 정식 산출 · 방법 검증 통과(11종 비교)'),f.sel);
    await mapShot('1-oyster');
    f=await flow(241776);
    check(`Flow 2 ${tag}: 해삼 MCUI 80, IUCN EN, published 4° cells`,f.sel.includes('MCUI 80')&&f.detail.includes('EN A2bd')&&f.shapes===cucMap.cells&&f.src.includes('4° 셀'),f.sel+' | '+f.src);
    await mapShot('2-sea-cucumber');
    f=await flow(504357);
    check(`Flow 3 ${tag}: 피조개 reviewed 4° cells labelled not a current distribution, pre-2000 records flagged`,f.sel.includes('현재 분포 아님')&&f.sel.includes('조사 후보')&&f.src==='조사 후보 · 검수 기록 공개 4° 셀'&&f.shapes===arkPlaces&&f.note.includes('현재 분포')&&f.note.includes('2000년 이전'),f.sel+' | '+f.src);
    await mapShot('3-ark-shell');
    f=await flow(emptyPick);
    check(noCell?`Flow 4 ${tag}: candidate without public cells draws no cell and says so`:`Flow 4 ${tag}: 시카메굴 draws its NIBR-point cells and credits NIBR`,
      noCell?f.shapes===0&&f.sel.includes('조사 후보')&&!f.sel.includes('0점')&&f.note.includes('제외 사유')&&f.note.includes('종 부재')
        :f.shapes===emptyPlaces&&f.sel.includes('조사 후보')&&!f.sel.includes('0점')&&f.detail.includes('채집 지점 국립생물자원관')&&f.detail.includes('공공누리 제3유형'),f.sel+' | '+f.src+' | '+f.note.slice(0,120));
    await mapShot(noCell?'4-candidate-no-cells':'4-candidate-nibr-cells');
    const walk=await walkComparison();
    check(`Flow 5 ${tag}: comparison shows all ${total} species in one table, page never overflows`,walk.length===1&&walk[0].cols===total&&walk[0].page,JSON.stringify(walk.map(p=>[p.label,p.cols,p.page])));
    await evaluate("setView('compare');window.scrollTo(0,0);1");await shot(`${tag}-flow-5-compare`,false);await evaluate("setView('explore');1");
    await pick(836033);await evaluate("document.getElementById('map').scrollIntoView({block:'center'});1");await sleep(300);
    const before=await evaluate("({y:Math.round(scrollY),sel:selected.aphiaID})");
    await evaluate("document.querySelector('[data-map-mode=value]').click();1");await sleep(400);await shot(`${tag}-flow-6-value-mode`,false); // no scrollIntoView here: the check measures scroll drift
    await evaluate("document.querySelector('[data-map-mode=occurrence]').click();1");await sleep(400);
    const after=await evaluate("({y:Math.round(scrollY),sel:selected.aphiaID,mode:mapMode})");
    check(`Flow 6 ${tag}: map mode value → occurrence keeps selection and scroll position`,after.sel===before.sel&&after.mode==='occurrence'&&Math.abs(after.y-before.y)<=4,JSON.stringify({before,after}));
    // Every species × {occurrence, MFPI, MBPI, MCUI, BBVI} opens its own evidence and returns to the same horizontal scroll and button.
    // One CDP call per species keeps each call under the 10 s response limit; the assertions are unchanged.
    const opens={n:await evaluate('data.species.length'),bad:[]};
    for(let i=0;i<opens.n;i++)opens.bad.push(...await evaluate(`(()=>{const bad=[],i=${i},s=data.species[i];setView('compare');
      ['OCC','MFPI','MBPI','MCUI','BBVI'].forEach(axis=>{
        renderComparison();setView('compare');const c=document.getElementById('comparison');c.scrollLeft=Math.min(37,c.scrollWidth-c.clientWidth);const left=c.scrollLeft;
        const b=c.querySelector('[data-score-aphia="'+s.aphiaID+'"][data-score-axis="'+axis+'"]');if(!b){bad.push([s.label,axis,'no button']);return;}
        b.click();const a=document.activeElement;
        const ok=axis==='OCC'
          ?selected===s&&mapMode==='occurrence'&&(s.cells?.length?a.closest('#cell-table details')?.open&&!!document.getElementById('cell-csv'):document.activeElement.id==='detail-map-summary'&&/없음/.test(a.textContent)&&!/개 격자/.test(a.textContent))
          :selected===s&&a.closest('#detail [data-axis="'+axis+'"]')&&(()=>{for(let d=a.closest('details');d;d=d.parentElement?.closest('details'))if(!d.open)return false;return true;})();
        if(!ok||currentView!=='explore'){bad.push([s.label,axis,'target',a.outerHTML.slice(0,80)]);}
        document.querySelector('.comparison-return').click();
        const back=document.activeElement;
        if(currentView!=='compare'||c.scrollLeft!==left||back.dataset.scoreAphia!==String(s.aphiaID)||back.dataset.scoreAxis!==axis)bad.push([s.label,axis,'return',c.scrollLeft,left]);
      });return bad;})()`));
    opens.bad=opens.bad.slice(0,8);
    check(`Evidence ${tag}: all ${opens.n}×5 comparison buttons open their own evidence (incl. the last columns) and return to scroll and focus`,opens.n===total&&opens.bad.length===0,JSON.stringify(opens));
    const late=await evaluate("(()=>{const i=data.species.length-1;renderComparison();setView('compare');document.querySelector('[data-score-aphia=\"'+data.species[i].aphiaID+'\"][data-score-axis=MBPI]').click();return 1})()");
    // The smooth scroll can outlast a fixed pause on a busy machine (a tab change now starts at the top): wait up to 3 s.
    let seen;for(let t=0;t<15;t++){await sleep(200);seen=await evaluate("(()=>{const r=document.activeElement.getBoundingClientRect();return {top:Math.round(r.top),h:innerHeight,axis:document.activeElement.closest('[data-axis]')?.dataset.axis}})()");if(seen.top>=0&&seen.top<seen.h)break;}
    check(`Evidence ${tag}: last-column MBPI evidence scrolled into view`,late===1&&seen.axis==='MBPI'&&seen.top>=0&&seen.top<seen.h,JSON.stringify(seen));
    const occ=await evaluate("(()=>{const s=data.species.find(x=>x.cells?.length);renderComparison();setView('compare');document.querySelector('[data-score-aphia=\"'+s.aphiaID+'\"][data-score-axis=OCC]').click();const sum=document.getElementById('detail-map-summary').innerText,csv=cellCsv(s);return {shapes:document.querySelectorAll('#map path.leaflet-interactive').length,rows:document.querySelectorAll('#cell-table tbody tr').length,period:/기록 연도/.test(sum),source:/출처/.test(sum),sea:/해역/.test(sum),license:/이용조건/.test(sum),csv:csv.includes('sea_areas')&&csv.includes('licenses')}})()");
    check(`Evidence ${tag}: occurrence button draws the cells and lists period, sea area, source, licence and CSV columns`,occ.shapes>0&&occ.rows>0&&occ.period&&occ.source&&occ.sea&&occ.license&&occ.csv,JSON.stringify(occ));
    await evaluate("setView('explore');1");
  }

  // ---------- Mobile 390px first screen and stability ----------
  await viewport(390,844,true);
  await load();
  // Before this change the map started at 952px (0px visible in the 844px first screen).
  const mob=await evaluate("(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();const m=r('map');const c=document.querySelector('.species-card').getBoundingClientRect();return {top:Math.round(m.top+scrollY),visible:Math.round(Math.min(m.bottom,844)-Math.max(m.top,0)),search:r('search').bottom<=844,card:c.height>0,chips:(u=>u.height>0&&u.top+40<=844)(document.getElementById('use-chips').getBoundingClientRect()),sel:document.getElementById('map-selected').innerText,warn:r('score-disclaimer').height>0&&document.getElementById('score-disclaimer').textContent.includes('정식 산출')&&document.getElementById('score-disclaimer').textContent.includes('검증: MFPI 통과 · MBPI 기준 미충족'),legend:document.querySelector('.map-legend-more').open}})()");
  check('Mobile 390×844 first screen: search, 활용 특성 chips (species cards just below) and ≥200px of map; selected status by the map; warning kept; legend folded',mob.visible>=200&&mob.search&&mob.card&&mob.chips&&/운영 발행|조사 후보/.test(mob.sel)&&mob.sel.length>4&&mob.warn&&!mob.legend,JSON.stringify(mob));
  await shot('mobile-first-screen',false);
  // Switching species on the horizontal card list and toggling map mode must not jump or close what the user opened.
  const stab=await evaluate(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const list=document.getElementById('species-list');const cards=[...list.querySelectorAll('.species-card')];
    document.querySelector('.map-legend-more').open=true;
    const target=cards[6];target.scrollIntoView({inline:'center',block:'nearest'});await wait(100);const y0=scrollY,x0=list.scrollLeft;target.click();await wait(300);
    const r1={dy:Math.round(scrollY-y0),dx:Math.round(list.scrollLeft-x0),sel:selected.aphiaID===Number(target.dataset.species),selCard:list.querySelector('.species-card.selected')?.dataset.species===target.dataset.species,legend:document.querySelector('.map-legend-more').open};
    const y1=scrollY;document.querySelector('[data-map-mode=value]').click();await wait(300);document.querySelector('[data-map-mode=occurrence]').click();await wait(300);
    return {...r1,modeDy:Math.round(scrollY-y1),mode:mapMode,still:selected.aphiaID===Number(target.dataset.species),legend2:document.querySelector('.map-legend-more').open}})()`);
  check('Mobile: switching species keeps list/page scroll, selection and open disclosures; mode round-trip does not jump',Math.abs(stab.dy)<=4&&Math.abs(stab.dx)<=4&&stab.sel&&stab.selCard&&stab.legend&&Math.abs(stab.modeDy)<=4&&stab.mode==='occurrence'&&stab.still&&stab.legend2,JSON.stringify(stab));
  await evaluate("document.querySelector('.map-legend-more').open=false;1");

  for(const [aphia,name] of [[241776,'mobile-sea-cucumber'],[836033,'mobile-oyster']]){
    await pick(aphia);await detailEl();
    const ov=await evaluate("({doc:document.documentElement.scrollWidth,vw:window.innerWidth,wide:[...document.querySelectorAll('#detail *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length})");
    check(`Mobile 390px ${name}: no horizontal overflow`,ov.doc<=ov.vw&&ov.wide===0,JSON.stringify(ov));
    await shot(name);
  }
  await pick(494972);await evaluate("document.querySelector('.map-pane').scrollIntoView();1");await sleep(1500);await shot('mobile-live-hijiki-map',false);
  await detailEl();
  const pov=await evaluate("({doc:document.documentElement.scrollWidth,vw:window.innerWidth,wide:[...document.querySelectorAll('#detail *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length})");
  check('Mobile 390px 톳 with cells: no horizontal overflow',pov.doc<=pov.vw&&pov.wide===0,JSON.stringify(pov));
  await shot('mobile-live-hijiki');

  // ---------- Failure / empty / v1-only responses (fetch mocked in page) ----------
  await viewport(1560,900,false);
  const mocks={
    'api-offline':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.reject(new TypeError('Failed to fetch')):o(u,...a))(window.fetch);",
    'api-error':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('x',{status:500})):String(u).includes('live-snapshot.json')?Promise.resolve(new Response('',{status:404})):o(u,...a))(window.fetch);",
    'api-empty':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}})):o(u,...a))(window.fetch);",
    'v1-only':"window.fetch=(o=>async(u,...a)=>{const r=await o(u,...a);if(!String(u).includes('/rest/v1/species_profiles'))return r;const rows=await r.json();for(const p of rows){const s=p.evidence_summary;for(const k of ['summary_version','nutrition','compounds','conservation','production','occurrence_status','map'])delete s[k];p.production_summary='생산·영양·생리활성·보전 근거 미검토. 점수 미산출.';}return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});})(window.fetch);"
  };
  // Empty and failed API are demo flows 7 and 8: checked on desktop and phone. Expected counts come from dist/ files.
  const offlineCounts=`운영 발행 ${snapshot.profiles.length}종 · 조사 후보 ${candidatesBeside(snapshot.profiles.map(p=>Number(p.aphia_id)))}종`;
  const runs=[...Object.keys(mocks).map(n=>[n,'desktop']),['api-offline','mobile'],['api-empty','mobile']];
  let scriptId;
  for(const [name,tag] of runs){
    if(tag==='mobile')await viewport(390,844,true);
    if(scriptId)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
    scriptId=(await send('Page.addScriptToEvaluateOnNewDocument',{source:mocks[name]})).identifier;
    const s=await load();
    const state=await evaluate("({state:document.getElementById('connection-state').textContent,error:document.getElementById('error').hidden?'':document.getElementById('error').textContent,disclaimer:document.getElementById('score-disclaimer').textContent,cards:document.querySelectorAll('.species-card').length,published:(data?.species||[]).filter(s=>!s.catalog).length,list:document.getElementById('species-list').innerText.slice(0,200),detail:document.getElementById('detail').innerText,full:document.getElementById('detail').textContent})");
    const brief=JSON.stringify({...state,detail:state.detail.slice(0,80),full:undefined});
    if(name==='api-offline')check(`Flow 8 ${tag}: API unreachable → "연결 실패" with the dated saved snapshot and separate counts`,state.state===`연결 실패 · 저장된 사본 사용 (${snapshot.fetched_at} 기준) · ${offlineCounts}`&&state.error.includes('저장한 공개 자료 사본')&&state.detail.length>0&&!state.error.includes('불러오지 못했습니다'),brief);
    if(name==='api-error')check('API failure and no snapshot: error shown, no stale data',state.state==='불러오기 실패'&&state.error.includes('불러오지 못했습니다')&&state.detail==='',brief);
    if(name==='api-empty')check(`Flow 7 ${tag}: empty API (200 []) → connected, 운영 발행 0종, the ${catalogIds.length} shown are candidates; no snapshot, no failure`,state.state===`공개 기준 자료 연결됨 · 운영 발행 0종 · 조사 후보 ${catalogIds.length}종`&&state.error===''&&!state.state.includes('사본')&&state.disclaimer.includes('운영 발행 자료가 0종')&&state.disclaimer.includes(`${catalogIds.length}종은 모두 조사 후보`)&&state.cards===catalogIds.length&&state.published===0,brief);
    if(name==='v1-only')check('v2 keys absent: falls back to production_summary, no fake 0/미수집',state.full.includes('생산·영양·생리활성·보전 근거 미검토')&&!state.full.includes('영양 근거')&&!state.full.includes('미수집'),state.full);
    await evaluate("window.scrollTo(0,0);1");await shot(tag==='mobile'?`mobile-${name}`:name,false);
  }
  // ---------- Entry screen: skip rules, phone, failed load ----------
  if(scriptId)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
  await viewport(1560,900,false);
  await evaluate("sessionStorage.removeItem('bbvm-intro-entered');location.hash='s=241776&v=explore';location.reload();1");await sleep(400);
  for(let i=0;i<80&&!/연결됨|불러오기 실패|연결 실패/.test(await evaluate("document.getElementById('connection-state')?.textContent||''"));i++)await sleep(250);
  let gs=await gateState();
  check('G-4 a shared link (#s=…) opens the map directly, even in a tab that never entered',!gs.on&&gs.hidden&&gs.inert===0&&await evaluate("selected?.aphiaID===241776"),JSON.stringify(gs));
  await viewport(390,844,true);
  await evaluate("sessionStorage.removeItem('bbvm-intro-entered');history.replaceState(null,'',location.pathname);1");
  await load();gs=await gateReady();
  check('G-5 phone 390px: entry screen shown, button inside the first screen, no horizontal overflow',gs.on&&gs.ready&&gs.enterBox.bottom<=gs.vh&&gs.enterBox.left>=0&&gs.enterBox.right<=gs.vw&&gs.doc<=gs.vw,JSON.stringify(gs));
  await sleep(1200);await shot('gate-mobile',false);
  await evaluate("document.getElementById('gate-enter').click();1");await sleep(1100);gs=await gateState();
  check('G-5 phone: the button opens the map',!gs.on&&gs.hidden&&gs.inert===0,JSON.stringify(gs));
  await viewport(1560,900,false);
  scriptId=(await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{sessionStorage.removeItem('bbvm-intro-entered')}catch{}"+mocks['api-error']})).identifier;
  await load();gs=await gateReady();
  check('G-6 failed load: entry screen still opens, says so, and Enter still enters',gs.ready&&gs.note==='자료를 불러오지 못했습니다. 들어가서 다시 불러오기를 눌러 주세요.'&&gs.counts==='',JSON.stringify(gs));
  await pressEnter();await sleep(1100);gs=await gateState();
  check('G-6 failed load: after Enter the map page shows its own error',!gs.on&&await evaluate("!document.getElementById('error').hidden"),JSON.stringify(gs));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
  check('No uncaught page errors or console.error',errors.length===0,errors.join(' | '));
}catch(e){check('Harness',false,e.stack);}
finally{fs.writeFileSync(path.join(OUT,'ui-check-results.json'),JSON.stringify(results,null,2));ws?.close();
  if(chrome.exitCode===null&&chrome.signalCode===null){
    const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill();
    await Promise.race([stopped,sleep(3000)]);
  }
  try{
    const root=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
    const target=fs.realpathSync(profile).toLowerCase();
    if(target.startsWith(root)&&path.basename(target).startsWith('cdp-'))
      fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }catch(error){console.warn('Could not remove isolated Chrome profile:',error.message);}
  process.exitCode=results.some(r=>r.status!=='PASS')?1:0;
  console.log(`${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status!=='PASS').length} FAIL`);}
