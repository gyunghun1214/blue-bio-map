// Headless Chrome via DevTools protocol (no deps). Renders the local site, clicks species, screenshots, checks text.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
import {collect} from './readability_probe.mjs';
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
// 4.16: an MBPI/BBVI whose top item is not replicated is shown as a whole number unless rounding would hide a non-zero value
// or move it across the BBVI line (the same rule as scoreText in app.js, read from the published method).
const bbviLine=report.method?.matrix?.bbvi_threshold, screenScore=(s,k,v)=>{const e=s.evidence_profile;if((k==='MBPI'||k==='BBVI')&&e&&e.item_count>0&&e.top_item_replication!=='replicated'){const r=Math.round(v);if(!(r===0&&v!==0)&&!(Number.isFinite(bbviLine)&&k==='BBVI'&&(r>=bbviLine)!==(v>=bbviLine)))return String(r);}return v.toFixed(1);};
const reportScores=[...report.species,...(report.candidate_species||[])].flatMap(s=>Object.entries(s.scores).filter(([,v])=>v!==null).map(([k,v])=>screenScore(s,k,v)));
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
// The comparison is one table holding every species, so one read covers it; kept as a list of one.
// Design 05 (2026-10-10): a row per species; the long labels sit in each row's 자세히 panel, opened here for the read.
// 2026-10-13 dark table: the full labels sit in that panel's '지표별 근거 전문' fold, opened too.
const walkComparison=()=>evaluate("(()=>{renderComparison();document.querySelectorAll('#comparison tr.cmp-more').forEach(r=>{r.hidden=false;r.querySelectorAll('details').forEach(d=>d.open=true)});const r=[{label:document.getElementById('comparison-page').textContent,text:document.getElementById('comparison').innerText,bars:document.querySelectorAll('#comparison .coverage-bar').length,ev:document.querySelectorAll('#comparison tr.cmp-more .dt-x-ev').length,rows:document.querySelectorAll('#comparison tbody tr.cmp-row').length,page:document.documentElement.scrollWidth<=document.documentElement.clientWidth}];renderComparison();return r})()");
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
      g.on&&!g.hidden&&g.ready&&g.held>0&&g.inert===g.held&&g.step===`해양생물 ${total}종 자료를 불러왔어요`&&g.counts===`${total}종의 해양생물(운영 발행 ${expPub} · 조사 후보 ${expCand}) · 공개 데이터 기반`&&g.note===''&&g.stored===null,JSON.stringify(g));
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
  // 4.11 (prereg 3): the paper's 6-compound ACE cohort is below the 30-compound minimum, so the ChEMBL dieckol record leads (56.8)
  check('Ecklonia candidate: MBPI 56.8 (shown 57, 4.16) from the ChEMBL dieckol record (4.11: the paper-local ACE cohort is below the stratum minimum) without spatial or combined scores',
    eckAxes.report===report.method_version&&eckAxes.scores?.MBPI===56.8&&
    // 4.3 (team-lead decision 2026-10-05): the Rapid LC check scores LC-equivalent 10 with its failed back-test label
    // 4.0: MFPI 62.5 from a moisture-converted row and BBVI 65.0 (single paper); MCUI stays withheld
    // 4.14 (prereg-4.14 2·3): the Rapid LC check is a reference again, so MCUI is not computed (never 10) and 감태 has no type;
    // BBVI 59.6 is mixed from the unrounded MFPI·MBPI
    // 4.17 (prereg-4.17 2·5): the Rapid LC check scores 10 again as a preliminary assessment; the map line reads like any other
    // type, and only the species detail names '예비 평가(공식 평가 전)'
    eckAxes.scores.MFPI===62.5&&eckAxes.scores.MCUI===10&&!eck.includes('10.0 · 정식 산출 · 역검증 기준 미충족 · 자체 예비평가(Rapid LC)')&&
    eckAxes.mcui.includes('예비 평가(공식 평가 전)')&&!eckAxes.mcui.includes('LC 가능성')&&eckAxes.scores.BBVI===59.6&&
    eckAxes.cells===release.find(e=>e.aphiaID===371986).cells.length&&(eckAxes.cells?eckAxes.map.includes('매트릭스 유형: 활용 연구 검토')&&!/예비|Rapid LC|역검증|56\.8/.test(eckAxes.map):eckAxes.map.includes('지도에 반영되지 않습니다'))&&
    /MBPI 57(?![.\d])/.test(eck)&&!eck.includes('MBPI 56.8')&&!eck.includes('시범')&&eck.includes('효소·수용체 등 단백질 표적')&&
    !eck.includes('eckstolonol')&&!eck.includes('1.47 ± 0.04 mM'),
    JSON.stringify({...eckAxes,mcui:eckAxes.mcui.slice(0,80),flags:['MBPI 57','효소·수용체 등 단백질 표적','eckstolonol','1.47 ± 0.04 mM','시범','10.0 · 정식 산출 · 역검증 기준 미충족 · 자체 예비평가(Rapid LC)'].map(x=>x+':'+eck.includes(x))})+' | '+eck.slice(0,500));

  let t=await pick(836033);
  check('Oyster: nutrition inventory (144 / 107 / 37 / AFCD 25 / unit 4 / basis 144) kept apart from the verified-pilot-2 MFPI trace',
    ['영양 자료 수집 현황 · 식량가치 아님','영양 기록 수 · 수집 현황','144건','실측 107건 · 계산 37건','AFCD 25건','단위 미확정 4건 · 기준량 가정 144건','MFPI · 식량 가능성','71.6 · 정식 산출 · 방법 검증 통과(11종 비교)'].every(x=>t.includes(x))&&!t.includes('영양 성분 값'),t);
  check('Oyster: aquaculture 4 shown as evidence records, not production',t.includes('양식 관련 요약 4건 · 기술적 가능성 판정 아님')&&t.includes('AFCD에서 양식(farmed)으로 표시된 근거 기록 수')&&t.includes('생산량 통계가 아닙니다')&&!/생산량\s*4/.test(t),t);
  // The operating profile predates the index report: reviewed axes show the report result, not the profile's old status.
  check('Oyster: conservation follows the index report (MCUI 10.0), not the older profile 보류',/보전평가\s*지표 보고서에서 검토 · MCUI 10\.0/.test(t)&&!t.includes('근거 부족으로 보류')&&t.includes('지표 보고서보다 먼저 작성'),t);
  check('Oyster: compounds follow the index report (MBPI 72, 4.16 whole number), separate OBIS 26 kept in details',/보고 화합물\s*지표 보고서에서 검토 · MBPI 72(?![.\d])/.test(t)&&!/보고 화합물\s*미수집/.test(t)&&/기록 수\s*26건/.test(t),t);
  const nat=await evaluate("document.querySelectorAll('#detail details.score-disclosure').forEach(d=>d.open=true);document.getElementById('detail').innerText");
  // verified-pilot-2.1: with no IUCN global record, the oyster MCUI is the separately labelled Korean national assessment.
  check('Oyster: MCUI 10 labelled as Korean national assessment with page, never compared with IUCN MCUI',nat.includes('한국 국가 평가 기반 MCUI: LC')&&nat.includes('목록 1371쪽')&&nat.includes('목록·찾아보기 쪽 재확인 2026-09-27')&&nat.includes('서로 순위를 매기거나 비교하지 않고, '+(nationalPlaced?'매트릭스에는 놓되 툴팁과 유형별 목록에 기반을 따로 적습니다':'매트릭스에도 놓지 않습니다'))&&!nat.includes('IUCN LC'),nat);
  // verified-pilot-2.3: peptide LQP scored in the AHTPDB cohort; a synthetic LQP from another origin replicated the potency, so BBVI was computed (80.9 in 2.3, 83.9 with the 3.6 calcium MFPI).
  // 4.11 (prereg 2): that zein-derived row is shown but no longer counted, so LQP keeps the factor 0.75: MBPI 72.2, BBVI 71.9 with the single-paper label.
  check('Oyster: MBPI 72.2 with origin paper, potency replication (Miyoshi 1991, synthetic, other origin) shown but not counted',!nat.includes('근거 논문 1편')&&!nat.includes('참고 통합값')&&['72 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 독립 재현 확인 중','효능 재현 · 합성 LQP 2 µM · 재현 시료 옥수수 α-제인','10.1271/bbb1961.55.1313','효능만 재현하며 기원 근거나 점수 값이 되지 않습니다','다른 기원의 측정이라 효능만 재현합니다(4.11부터 독립 논문으로 세지 않음)','이 종의 시료로 잰 독립 재현 논문이 아직 없습니다'].every(x=>nat.includes(x))&&!nat.includes('독립 DOI 2편'),nat);
  check('Oyster: MBPI 72 with paper value and AHTPDB attribution (developer-confirmed public database)',['72 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 독립 재현 확인 중','LQP','1.18 µM','10.5352/jls.2012.22.2.220','펩타이드 352개','doi:10.1093/nar/gku1141','공개 DB · 개발자 이메일 확인(2026-09-27): 누구나 사용 가능'].every(x=>nat.includes(x)),nat);
  await evaluate("document.querySelectorAll('#detail details.score-disclosure').forEach(d=>d.open=false)");
  await detailEl();await shot('desktop-oyster');

  t=await pick(241776);
  check('Sea cucumber: 122 compounds, no quantitative activity',/보고 화합물\s*122개/.test(t)&&/정량 활성 자료\s*확인한 자료에서 없음/.test(t),t);
  check('Sea cucumber: no efficacy claim',!/입증|효능|효과가 있/.test(t),t);
  check('Sea cucumber: CMNPD source and NC-SA terms visible in compound summary',t.includes('CMNPD')&&t.includes('CC BY-NC-SA 4.0')&&t.includes('비상업 이용'),t);
  check('Sea cucumber: published occurrence records, 4-degree generalization',new RegExp(`지도 표시 기록\\s*${cucMap.recordsText}건 · ${cucMap.cells}개 격자\\(4°\\)`).test(t)&&t.includes('GBIF')&&t.includes('4°×4°')&&t.includes('정밀 위치나 전체 분포가 아닙니다'),t);
  // 3.15: the RDA 해삼 row is linked through its MFDS scientific name (Stichopus japonicus), so MFPI 63.5
  check('Sea cucumber: conservation MCUI 80.0 and nutrition MFPI 63.5 from the index report, no stale 미수집/보류',/보전평가\s*지표 보고서에서 검토 · MCUI 80\.0/.test(t)&&/영양 기록 수\s*지표 보고서에서 검토 · MFPI 63\.5/.test(t)&&!t.includes('근거 부족으로 보류')&&!/영양 기록 수\s*미수집/.test(t),t);
  check('Sea cucumber live: reviewed 2026 IUCN EN A2bd is current, 2013 superseded; pilot MCUI 80 with original grade beside it',t.includes('IUCN 현행 평가 EN A2bd: 2026년 발표')&&/보전 평가\s*80\.0 \(EN, A2bd\) · 정식 산출 · 공식 평가 범주/.test(t)&&!t.includes('undefined')&&t.includes('2025-09-30 평가')&&t.includes('대체된 역사적 평가')&&t.includes('MCUI · 보전 평가')&&t.includes('80.0 (EN, A2bd) · 정식 산출 · 공식 평가 범주')&&!t.includes('Needs updating'),t.slice(t.indexOf('보전'),t.indexOf('보전')+500));
  const mapNote=await evaluate("document.getElementById('map-review-note').textContent+' | '+document.getElementById('map-cells').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length");
  check('Sea cucumber map: broad 4° cells shown without claiming full distribution',mapNote.includes('4° 셀')&&mapNote.includes('청회색 점은 실제 발견 좌표가 아닌')&&mapNote.includes('전체 분포를 뜻하지 않습니다')&&mapNote.includes(` | ${cucMap.cells} | shapes=${cucMap.cells}`),mapNote);
  await detailEl();await shot('desktop-sea-cucumber');

  t=await pick(342067);
  // 3.15: a reviewed aquaculture-feasibility record (false) completes the squid MFPI inputs: 46.1. 3.27: Wako 1996 YALPHA gives MBPI 56.9
  check('Squid: index report replaces the older profile 미수집/미검토 (MFPI 46.1, MBPI 56.9 shown 57 (4.16), MCUI 60.0: 4.12 KOSIS stock-decline signal over IUCN LC 10)',/영양 기록 수\s*지표 보고서에서 검토 · MFPI 46\.1/.test(t)&&/보고 화합물\s*지표 보고서에서 검토 · MBPI 57(?![.\d])/.test(t)&&/보전평가\s*지표 보고서에서 검토 · MCUI 60\.0 \(LC \+ 자원 감소\)(?! \()/.test(t)&&!/미수집|미검토/.test(t.split('영양 자료 수집 현황')[1]||'')&&t.includes('2건'),t);
  await detailEl();await shot('desktop-squid');
  const leak=await evaluate("document.body.innerText");
  check('No CMNPD raw data / coordinates in page',!/InChI|SMILES|CMNPD\d|raw_record/i.test(leak));
  // The cell line and the withheld reasons read the index report too, not the profile's older 미검토/미수집.
  // 3.15 fills 해삼 MFPI, so its withheld reason is read from BBVI and 살오징어 adds MBPI. 3.15 (team-lead decision 2026-10-02):
  // reference only, so 미역 MCUI stays withheld (IUCN 0 results) beside its Rapid LC reference.
  const stale=await evaluate("(()=>{const s=id=>data.species.find(x=>x.aphiaID===id);return {line:speciesAxesLine(s(145721)),cuc:assessmentBlockers(s(241776)),sq:assessmentBlockers(s(342067)),wak:assessmentBlockers(s(145721))}})()");
  check('Wakame/Sea cucumber/Squid: cell line and withheld reasons follow the index report, not the older profile 미검토/미수집',
    // 4.14 (prereg-4.14 2): 미역 has no IUCN global or Korean national category, so its line says '보전평가 미확인' (not 보류) and
    // its one open reason is the IUCN search, which says it is not a low score
    // 4.17 (prereg-4.17 2·5): its Rapid LC check is a preliminary assessment again, so the line shows MCUI 10.0 like any other
    !stale.line.includes('보류')&&!stale.line.includes('미검토')&&stale.line.includes('MCUI 10.0')&&!/예비|Rapid LC|역검증|미확인/.test(stale.line)&&
    Object.keys(stale.wak).length===0&&
    // 3.27: the sea cucumber's single-paper BBVI and the squid's MBPI are scores now, so neither species has a withheld reason left
    Object.keys(stale.cuc).length===0&&Object.keys(stale.sq).length===0&&!JSON.stringify(stale).includes('검수된 영양 값 미확인'),JSON.stringify(stale));

  // 2026-10 compare redesign: the tab opens on the matrix, so the table checks switch to the 데이터 표 view first.
  await evaluate("document.querySelector('[data-view=compare]').click();setCompareMode('table');1");await sleep(300);
  const cmp=(await walkComparison()).map(p=>p.text).join('\n');
  // 4.5: the floor label left the table (no species takes the floor); the relaxation-(d) tag is required instead
  // 4.17 (prereg-4.17 5): the table never names the preliminary assessment of the 13 species
  check('Compare table: no preliminary-assessment words (4.17: named only in the species detail)',!/예비 평가\(공식 평가 전\)|역검증|서식국 국가 평가|Rapid LC\) · |IUCN 기반 MCUI와 비교 불가.{0,3}자체/.test(cmp),(cmp.match(/.{0,60}(예비 평가\(공식 평가 전\)|역검증|서식국 국가 평가|Rapid LC\) · ).{0,60}/)||[''])[0]);
  check('Compare table (all pages): every assessments.json score (operating and candidate) plus named withheld reasons and evidence links',reportScores.length>0&&[...reportScores,'정식 산출 · 공식 평가 범주 · 근거 보기','정식 산출 · 방법 검증 통과(11종 비교) · 근거 보기','완화 산출(d)','정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 독립 재현 확인 중 · 근거 보기','수분 환산값(다른 시료)'].every(x=>cmp.includes(x))&&!cmp.includes('시범')&&!['효능 근거 미확인','보전평가 미확인','멸종위험 평가 미확인','최상위 근거 독립 재현 확인 중'].reduce((t,w)=>t.replaceAll(w,''),cmp).includes('미확인')&&!cmp.includes('자체 예비평가(Rapid LC) · IUCN 기반 MCUI와 비교 불가')&&!cmp.includes('LC 가능성')&&!cmp.includes('지방 목록 참고값')&&!cmp.includes('예비 평가 참고'),JSON.stringify({missing:[...reportScores,'정식 산출 · 공식 평가 범주 · 근거 보기','완화 산출(d)'].filter(x=>!cmp.includes(x)).slice(0,10),withheld:(cmp.match(/산출 보류/g)||[]).length,around:[...cmp.matchAll(/.{0,60}(산출 보류|미확인|시범).{0,40}/g)].map(m=>m[0]).slice(0,6)})+' '+cmp.slice(0,200));  // 4.14: a Rapid LC is a reference again (never a 10), and every species without an official category says '보전평가 미확인'; 4.19: every species has an MCUI, so no row says it
  // 2026-10-13: the table is dark like the page, the coverage column and its guide left it, and the line above it says how to read it
  const compareUx=await evaluate("(()=>{const c=document.getElementById('comparison'),hint=document.querySelector('#cmp-table-view .dt-hint')?.textContent||'';const rgb=x=>(x.match(/\\d+/g)||[]).slice(0,3).map(Number),dk=x=>{const v=rgb(x);return v.length===3&&Math.max(...v)<80;},lt=x=>Math.min(...rgb(x))>200;const dark=dk(getComputedStyle(c).backgroundColor)&&lt(getComputedStyle(c.querySelector('.cv-num')).color)&&dk(getComputedStyle(c.querySelector('thead th')).backgroundColor);const currentGuide=hint.includes('라벨은 근거의 수준이며 가치의 높낮이가 아닙니다')&&!c.querySelector('.coverage-bar,.coverage-guide');c.querySelector('[data-score-axis=MFPI]').click();const focused=document.activeElement.closest('[data-axis=MFPI]')!==null;const back=document.querySelector('.comparison-return');back.click();return {dark,currentGuide,focused,returned:document.querySelector('.view.active').id==='compare'&&document.activeElement.dataset.scoreAphia==='836033'}})()");
  check('Comparison (dark data table): dark panel and header, how-to-read line, no coverage column, keyboard return',Object.values(compareUx).every(Boolean),JSON.stringify(compareUx));
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-compare');
  // ---------- 비교와 지표 (2026-10 deep-sea redesign): matrix first, species profile, basket of up to 3, side-by-side view ----------
  {const ux=await evaluate(`(()=>{const r={},q=s=>document.querySelector(s),total=data.species.length;
    setView('compare');setCompareFilter({q:'',group:'all'});setCompareMode('matrix');
    r.matrixFirst=!q('#cmp-matrix-view').hidden&&q('#cmp-table-view').hidden;
    const last=data.species.at(-1);setView('explore');selectSpecies(last.aphiaID);setView('compare');
    r.fromExplore=q('#cmp-profile-name').textContent===last.label&&q('#matrix-points [aria-current]')?.dataset.aphia===String(last.aphiaID);
    q('#matrix-points [data-aphia="836033"]').click();
    r.ring=q('#matrix-points [data-aphia="836033"]').getAttribute('aria-current')==='true'&&document.querySelectorAll('#matrix-points [aria-current]').length===1;
    q('#cmp-open-more').click();const p=q('#cmp-profile').textContent+' '+q('#cmp-drawer-axes').textContent;r.drawer=q('#cmp-drawer').open;q('#cmp-drawer').close();
    r.profile=q('#cmp-profile-name').textContent==='참굴'&&p.includes('72')&&!p.includes('71.9')&&p.includes('산출 항목 6 · 독립 논문 4편')&&p.includes('최상위 항목 재현 기록 있음(기준 외)')&&!p.includes('기준 외:')&&!p.includes('근거 계수')&&p.includes('한국 국가 평가')&&p.includes('IUCN 기반 MCUI와 직접 비교 불가');
    cmpBasket=[];renderCompare();toggleBasket(836033);toggleBasket(836033);r.pressTwiceRemoves=cmpBasket.length===0;
    const ids=data.species.map(s=>s.aphiaID);ids.slice(0,3).forEach(toggleBasket);const fourth=toggleBasket(ids[3]);
    r.max3=fourth===false&&cmpBasket.length===3&&new Set(cmpBasket).size===3&&q('#cmp-tray .ct-count').textContent.trim()==='3 / 3'&&!q('#cmp-tray [data-basket-add]');
    selectSpecies(ids[3]);r.addDisabledWhenFull=q('#cmp-add').getAttribute('aria-disabled')==='true';
    q('#cmp-tray [data-basket-remove="'+ids[0]+'"]').click();r.remove=cmpBasket.join()===ids.slice(1,3).join()&&!!q('#cmp-tray [data-basket-add]');
    setCompareMode('table');setCompareMode('matrix');r.modeKeepsState=cmpBasket.length===2&&selected.aphiaID===ids[3];
    setCompareFilter({group:'해조류'});const n=data.species.filter(s=>s.group==='해조류').length,note=q('#cmp-filter-note').textContent;
    const pts=[...document.querySelectorAll('#matrix-points .matrix-point.pilot')],sea=new Set(data.species.filter(s=>s.group==='해조류').map(s=>String(s.aphiaID)));
    r.filter=n>0&&note.includes(total+'종 중 '+n+'종 표시')&&pts.filter(p=>p.hasAttribute('data-dim')).length===pts.filter(p=>!sea.has(p.dataset.aphia)).length&&pts.filter(p=>p.hasAttribute('data-dim')).every(p=>!sea.has(p.dataset.aphia))&&document.querySelectorAll('#comparison tr.cmp-row:not(.cmp-out)').length===n;
    setCompareFilter({q:'없는생물이름',group:'all'});r.empty=q('#cmp-filter-note').textContent.includes('검색 결과 없음');
    setCompareFilter({q:'',group:'all'});r.cleared=!document.querySelector('#matrix-points [data-dim]')&&q('#cmp-filter-note').textContent==='';
    return r})()`);
  check('Compare tab: matrix first, a species picked on the explore map shows in the profile and the ring, point click rings it and fills the profile, basket holds 3 without repeats, mode switch keeps state, filter dims points and counts',Object.values(ux).every(Boolean),JSON.stringify(ux));
  // Bars only on one scale: MFPI within one comparison group, MCUI within one assessment basis; never a total or a pick.
  const side=await evaluate(`(()=>{const r={},q=s=>document.querySelector(s),cohort=s=>s.assessment?.food_trace?.cohort_id,basis=s=>s.assessment?.mcui_basis||'iucn';
    cmpBasket=[836033,145721,274849];renderCompare();q('#cmp-compare-go').click();
    const t=q('#cmp-dialog-body').textContent;
    r.open=q('#cmp-dialog').open&&document.activeElement===q('.cmp-dialog-close');
    r.notComparable=t.includes('비교집단이 달라 직접 비교 불가')&&t.includes('평가 기반이 달라 직접 비교 불가')&&document.querySelectorAll('#cmp-dialog .cp-bar.sand').length===0;
    r.noScore=!/합산|종합 점수|추천 종|1위/.test(t.replace('합계·순위·추천은 만들지 않습니다',''));
    q('#cmp-dialog-body [data-dlg-aphia="836033"][data-dlg-axis="MCUI"]').click();
    r.evidence=currentView==='explore'&&!q('#cmp-dialog').open&&q('.comparison-return').textContent.includes('비교와 지표로 돌아가기');
    q('.comparison-return').click();
    r.backToDialog=currentView==='compare'&&q('#cmp-dialog').open&&document.activeElement===q('#cmp-dialog-body [data-dlg-aphia="836033"][data-dlg-axis="MCUI"]');
    q('#cmp-dialog').close();
    const pair=[];for(const a of data.species)for(const b of data.species)if(!pair.length&&a!==b&&pilotScore(a,'MFPI')!==null&&pilotScore(b,'MFPI')!==null&&pilotScore(a,'MCUI')!==null&&pilotScore(b,'MCUI')!==null&&cohort(a)===cohort(b)&&basis(a)===basis(b))pair.push(a.aphiaID,b.aphiaID);
    cmpBasket=pair;renderCompare();openCompareDialog();const t2=q('#cmp-dialog-body').textContent;
    r.sameScale=pair.length===2&&!/비교집단이 달라|평가 기반이 달라/.test(t2)&&document.querySelectorAll('#cmp-dialog .cp-bar.sand').length===2;
    q('#cmp-dialog').close();cmpBasket=[];renderCompare();
    selectSpecies(274849);setCompareMode('matrix');q('#cmp-profile [data-prof-axis="BBVI"]').click();q('.comparison-return').click();
    r.profileReturn=currentView==='compare'&&cmpMode==='matrix'&&document.activeElement===q('#cmp-profile [data-prof-axis="BBVI"]');
    return r})()`);
  check('Compare tab: side-by-side view draws bars only on a shared scale, says 직접 비교 불가 otherwise, no total or pick; evidence returns to the dialog and to the profile',Object.values(side).every(Boolean),JSON.stringify(side));
  // BBVI 통합 가중치 (2026-10-13): MBPI + MFPI = 1.00, presets, 탐색 보기 badges, official value beside a re-mix, points slide and
  // mark a moved type, value-map cell colours follow, the link carries w, the official weight brings back the first screen
  const wt=await evaluate(`(async()=>{const r={},q=s=>document.querySelector(s),wait=ms=>new Promise(f=>setTimeout(f,ms)),vis=e=>!!e&&!e.hidden&&e.getClientRects().length>0;
    setView('compare');setCompareFilter({q:'',group:'all'});setCompareMode('matrix');selectSpecies(836033);await wait(200);
    const table0=(setCompareMode('table'),q('#comparison').textContent);setCompareMode('matrix');
    const cellTypes=()=>{const n={};for(const g of valueCellGroups(true).values()){const t=cellMatrixType(g).type||'none';n[t]=(n[t]||0)+1;}return JSON.stringify(n);};
    setView('explore');setMapMode('value');await wait(300);const cells0=cellTypes(),cand0=document.getElementById('layer-unexplored-count')?.textContent;setMapMode('occurrence');setView('compare');setCompareMode('matrix');await wait(200);
    const wl=()=>(q('#cmp-wline-name').textContent+q('#cmp-wline-text').textContent).replace(/\\s+/g,' ').trim(),off=()=>q('#cmp-wline').classList.contains('off')&&vis(q('#cmp-wline [data-w-reset]'));
    q('#cmp-basis-toggle').click();r.panel=vis(q('#bbvi-weight'))&&vis(q('#cmp-basis-pop'))&&q('#bbvi-weight-value').textContent==='MBPI 0.50 · MFPI 0.50'&&!off()&&wl().startsWith('공식 가중치')&&q('#cmp-weight-reset').disabled;
    const left0=q('#matrix-points [data-aphia="241776"]')?.style.left;
    r.sum=[...Array(21).keys()].every(k=>{const m=weightPair(k/20).match(/MBPI (\\S+) · MFPI (\\S+)/);return Math.round(Number(m[1])*100)+Math.round(Number(m[2])*100)===100;});
    q('[data-w-preset="15"]').click();await wait(250);
    r.preset=q('#bbvi-weight-value').textContent==='MBPI 0.25 · MFPI 0.75'&&q('[data-w-preset="15"]').getAttribute('aria-pressed')==='true'&&q('#bbvi-weight').getAttribute('aria-valuetext')==='MBPI 0.25, MFPI 0.75';
    r.badges=off()&&wl().startsWith('탐색 가중치 · 공식값(0.50) 아님');
    const moved=data.species.filter(s=>matrixType(s)!==officialType(s));
    r.moved=moved.length>0&&q('#bbvi-weight-moved').textContent.startsWith('공식값과 유형이 다른 종 '+moved.length+'종')&&document.querySelectorAll('#matrix-points .matrix-point.w-moved').length===moved.filter(assessedForMatrix).length;
    const pt=q('#matrix-points [data-aphia="241776"]');r.point=!!pt&&pt.style.left!==left0&&pt.title.includes('공식 ');
    r.hash=/[#&]w=0\\.75(&|$)/.test(location.hash);
    r.profile=q('#cmp-profile').textContent.includes('공식 72')&&!q('#cmp-profile').textContent.includes('공식 71.9');r.cards=q('#species-list [data-species="241776"]').textContent.includes(scoreText(data.species.find(x=>x.aphiaID===241776),'BBVI',pilotScore(data.species.find(x=>x.aphiaID===241776),'BBVI')))&&pilotScore(data.species.find(x=>x.aphiaID===241776),'BBVI')!==36.1;
    setCompareMode('table');r.table=q('#comparison').innerHTML.includes('class="cv-official">(공식 ')&&off();setCompareMode('matrix');
    r.cells=cellTypes()!==cells0;
    setView('explore');setMapMode('value');await wait(300);r.mapBadge=vis(q('#value-weight-badge'))&&q('#value-weight-badge').textContent.includes('MBPI 0.25 · MFPI 0.75');
    r.candidates=document.getElementById('layer-unexplored-count')?.textContent===cand0;
    q('#value-weight-badge [data-w-reset]').click();await wait(250);r.mapReset=!vis(q('#value-weight-badge'))&&bbviWeight===.5;
    setMapMode('occurrence');setView('compare');setCompareMode('matrix');
    q('[data-w-preset="5"]').click();await wait(250);r.bio=q('#bbvi-weight-value').textContent==='MBPI 0.75 · MFPI 0.25'&&/[#&]w=0\\.25(&|$)/.test(location.hash);
    q('#cmp-weight-reset').click();await wait(250);
    setCompareMode('table');const table1=q('#comparison').textContent;setCompareMode('matrix');
    r.resetBadge=!off()&&wl().startsWith('공식 가중치');r.resetHash=!/[#&]w=/.test(location.hash);r.resetTable=table1===table0;r.resetCells=cellTypes()===cells0;r.resetPoints=!document.querySelector('#matrix-points .w-moved');
    setBasisPop(false);return r})()`);
  check('BBVI weight slider: MBPI + MFPI = 1.00 at 21 steps, presets, 탐색 보기 badges (panel, matrix, table, value map), official value beside a re-mix, explore cards follow, moved-type list and dashed points, cell colours follow, unexplored count fixed, link w, official weight restores the first screen',Object.values(wt).every(Boolean),JSON.stringify(wt));
  // 2026-10-15 MBPI evidence kind: the profile names the kind of the top evidence under MBPI (의약 표적 / 기능성 펩타이드 with the
  // ACE·XO share) and shows MBPI-Rx on its own row; no value reads '의약 표적 근거 없음', never 0; the line stays inside the panel
  const mk=await evaluate(`(async()=>{const r={},q=s=>document.querySelector(s),wait=ms=>new Promise(f=>setTimeout(f,ms));
    setView('compare');setCompareMode('matrix');selectSpecies(145721);await wait(200);q('#cmp-open-more').click();await wait(100);let p=q('#cmp-drawer-axes');
    r.wakame=p.querySelector('.cp-kind-badge')?.textContent==='기능성 펩타이드(ACE·XO)'&&p.querySelector('.cp-kind-share')?.textContent==='최상위 근거 · ACE·XO 항목 8/8(100%)'&&p.querySelector('.cp-rx-none')?.textContent==='의약 표적 근거 없음'&&!p.querySelector('.cp-rx-num');
    selectSpecies(504357);await wait(200);p=q('#cmp-drawer-axes');
    r.ark=p.querySelector('.cp-kind-badge')?.dataset.kind==='drug'&&p.querySelector('.cp-kind-badge')?.textContent==='의약 표적(항균·항암·기타 표적)'&&p.querySelector('.cp-rx-num')?.textContent===scoreText(data.species.find(x=>x.aphiaID===504357),'MBPI',75);
    const k=p.querySelector('.cp-kind').getBoundingClientRect(),x=p.querySelector('.cp-rx').getBoundingClientRect(),b=q('#cmp-drawer-body').getBoundingClientRect();r.inside=k.left>=b.left&&k.right<=b.right+1&&x.right<=b.right+1&&k.height>0&&x.height>0;
    selectSpecies(836033);await wait(200);r.order=(()=>{const m=q('#cdr-use .cdr-tag:nth-of-type(3)'),kk=q('#cdr-use .cp-kind'),rx=q('#cdr-use .cp-rx');return !!m&&m.textContent.startsWith('MBPI')&&!!kk&&!!rx&&(m.compareDocumentPosition(kk)&4)&&(kk.compareDocumentPosition(rx)&4);})();
    q('#cmp-drawer').close();return r})()`);
  check('MBPI evidence kind: badge (의약 표적 / 기능성 펩타이드 + ACE·XO share) and MBPI-Rx row under MBPI in the profile\'s 근거 자세히 보기 drawer (final design 2026-10-15), 의약 표적 근거 없음 for no value, inside the drawer',Object.values(mk).every(Boolean),JSON.stringify(mk));
  // 2026-10-13 dark data table: the one #bbvi-weight moves to the table's tool row and back; five type cards count the species the
  // group and search leave, by the type at the current weight, and keep only their type in the table; the expanded row sums BBVI
  // at that weight; BBVI sort follows; the cards and the expand button work from the keyboard with focus kept.
  const dt=await evaluate(`(async()=>{const r={},q=s=>document.querySelector(s),wait=ms=>new Promise(f=>setTimeout(f,ms)),vis=e=>!!e&&!e.hidden&&e.getClientRects().length>0;
    setView('compare');setCompareFilter({q:'',group:'all',type:null});cmpSort={key:null,dir:null};setCompareMode('table');await wait(200);
    r.slot=q('.cmp-weight').contains(q('#bbvi-weight'))&&vis(q('#bbvi-weight'))&&q('#bbvi-weight-value').textContent==='MBPI 0.50 · MFPI 0.50'&&q('#cmp-basis-pop').textContent.includes('비교집단은 고정됩니다');
    const cards=()=>[...document.querySelectorAll('#cmp-type-cards [data-cmp-type]')];
    const counts=()=>JSON.stringify(cards().map(b=>[b.dataset.cmpType,Number(b.querySelector('.dt-card-n b').textContent)]));
    const want=()=>JSON.stringify(cards().map(b=>[b.dataset.cmpType,data.species.filter(s=>cmpMatch(s)&&(matrixType(s)||'none')===b.dataset.cmpType).length]));
    r.cards=cards().length===5&&counts()===want()&&cards().reduce((a,b)=>a+Number(b.querySelector('.dt-card-n b').textContent),0)===data.species.length&&q('#cmp-type-cards [data-cmp-type=alternative_production]').textContent.includes(matrixTypePlain('alternative_production'))&&q('#cmp-type-cards [data-cmp-type=alternative_production]').textContent.includes(matrixTypeLabel('alternative_production'));
    r.groups=q('[data-cmp-group=all] .cmp-gn')?.textContent===String(data.species.length)&&vis(q('[data-cmp-group=all] .cmp-gn'));
    const c0=counts(),order0=[...document.querySelectorAll('#comparison tr.cmp-row')].map(t=>t.dataset.aphia).join();
    const el=q('#bbvi-weight');el.value='16';el.dispatchEvent(new Event('input'));await wait(300);
    r.weight=q('#bbvi-weight-value').textContent==='MBPI 0.20 · MFPI 0.80'&&el.getAttribute('aria-valuetext')==='MBPI 0.20, MFPI 0.80'&&counts()===want()&&counts()!==c0&&q('#cmp-wline').classList.contains('off');
    q('#comparison tr.cmp-row .cmp-more-btn').click();const x=q('#comparison tr.cmp-more:not([hidden]) .dt-x-sum')?.textContent||'';r.sum=x.startsWith('0.80 × MFPI ')&&x.includes(' + 0.20 × MBPI ');q('#comparison tr.cmp-row .cmp-more-btn').click();
    q('#comparison [data-sort=BBVI]').click();await wait(100);const top=data.species.filter(s=>pilotScore(s,'BBVI')!==null).map((s,i)=>[s,i]).sort(([a,i],[b,j])=>pilotScore(b,'BBVI')-pilotScore(a,'BBVI')||i-j)[0][0];
    r.sorted=q('#comparison tr.cmp-row').dataset.aphia===String(top.aphiaID);cmpSort={key:null,dir:null};renderComparison();
    setCompareMode('matrix');r.home=q('.cmp-weight').contains(q('#bbvi-weight'))&&vis(q('#bbvi-weight'))&&!vis(q('[data-cmp-group=all] .cmp-gn'))&&q('#bbvi-weight-value').textContent==='MBPI 0.20 · MFPI 0.80';
    setCompareMode('table');await wait(50);
    const card=q('#cmp-type-cards [data-cmp-type=sustainable_use]'),shown=()=>[...document.querySelectorAll('#comparison tr.cmp-row:not(.cmp-out)')].map(t=>cmpById(t.dataset.aphia));
    card.click();await wait(50);const n=()=>Number(card.querySelector('.dt-card-n b').textContent);
    r.typeFilter=card.getAttribute('aria-pressed')==='true'&&shown().length===n()&&shown().every(s=>matrixType(s)==='sustainable_use')&&q('#comparison-page').textContent.startsWith('총 '+n()+'종');
    q('[data-cmp-group="패류"]').click();await wait(50);r.combo=n()>0&&shown().length===n()&&shown().every(s=>s.group==='패류'&&matrixType(s)==='sustainable_use')&&q('#cmp-filter-note').textContent.includes(data.species.length+'종 중 '+n()+'종 표시');
    card.click();q('[data-cmp-group=all]').click();await wait(50);r.cleared=card.getAttribute('aria-pressed')==='false'&&shown().length===data.species.length&&q('#cmp-filter-note').textContent==='';
    setBbviStep(10);await wait(300);r.reset=q('#bbvi-weight-value').textContent==='MBPI 0.50 · MFPI 0.50'&&counts()===c0&&[...document.querySelectorAll('#comparison tr.cmp-row')].map(t=>t.dataset.aphia).join()===order0;
    q('#cmp-type-cards [data-cmp-type=baseline_survey]').focus();return r})()`);
  await pressEnter();await sleep(150);
  dt.keyCard=await evaluate("(()=>{const b=document.querySelector('#cmp-type-cards [data-cmp-type=baseline_survey]');return b.getAttribute('aria-pressed')==='true'&&document.activeElement===b})()");
  await pressEnter();await sleep(150);
  await evaluate("document.querySelector('#comparison tr.cmp-row .cmp-more-btn').focus();1");await pressEnter();await sleep(150);
  dt.keyMore=await evaluate("(()=>{const b=document.querySelector('#comparison tr.cmp-row .cmp-more-btn'),r=document.getElementById(b.getAttribute('aria-controls'));const ok=b.getAttribute('aria-expanded')==='true'&&!r.hidden&&document.querySelector('#cmp-type-cards [data-cmp-type=baseline_survey]').getAttribute('aria-pressed')==='false';b.click();setCompareMode('matrix');return ok})()");
  check('Data table (dark, 2026-10-13): one weight slider moves to the tool row and back (MBPI + MFPI = 1.00), type cards count the filtered species at the current weight and keep only their type (with the group), group counts in the table only, the expanded row sums BBVI at that weight, BBVI sort follows, keyboard toggles a card and a row',Object.values(dt).every(Boolean),JSON.stringify(dt));
  await evaluate("location.hash='s=836033&v=compare&w=0.70';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);
  const wl=await evaluate("({w:bbviWeight,text:document.getElementById('bbvi-weight-value').textContent,badge:document.getElementById('cmp-wline').classList.contains('off'),hash:location.hash})");
  await evaluate("location.hash='s=836033&v=compare&w=abc';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);
  const wb=await evaluate("({w:bbviWeight,badge:document.getElementById('cmp-wline').classList.contains('off'),hash:location.hash})");
  check('BBVI weight link: #…&w=0.70 opens at MBPI 0.30 · MFPI 0.70 with the badge; w=abc opens at the official weight and drops w',wl.w===.7&&wl.text==='MBPI 0.30 · MFPI 0.70'&&wl.badge&&wl.hash.includes('w=0.70')&&wb.w===.5&&!wb.badge&&!wb.hash.includes('w='),JSON.stringify({wl,wb}));
  await evaluate("setBbviStep(10);1");await sleep(300);
  await evaluate("selectSpecies(836033);toggleBasket(836033);toggleBasket(145721);setCompareMode('matrix');window.scrollTo(0,0);1");await sleep(300);await shot('desktop-compare-matrix');
  await evaluate("toggleBasket(274849);openCompareDialog();1");await sleep(200);await shot('desktop-compare-dialog');
  await evaluate("document.getElementById('cmp-dialog').close();cmpBasket=[];renderCompare();setCompareMode('table');1");}
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
  // 2026-10-03: overview = regional bubbles (no dots); a bubble click zooms in and splits it into dots. 2026-10-13 design 2 (reverses
  // PR #122): no per-cell BBVI tag at any zoom; one chip over the map names the species with its cells, records and years (the
  // numbers under the map, from the app), and the legend's first line follows the zoom (bubbles, then dots).
  const bub=await evaluate("(()=>{selectSpecies(836033);map.setZoom(5,{animate:false});const ls=overlay.getLayers(),bs=ls.filter(l=>l._zoomMark&&l instanceof L.CircleMarker);const r={bubbles:bs.length,dots:ls.filter(l=>l._schematicDot).length,tags:document.querySelectorAll('#map .bbvi-tag').length,frames:document.querySelectorAll('#map path[stroke-dasharray]').length,key:document.getElementById('map-symbol-label').textContent,bubbleMark:!document.getElementById('key-bubble-mark').hidden,rows:[...document.getElementById('occurrence-legend').children].filter(e=>e.getBoundingClientRect().height>0).length};bs[0].fire('click');return r})()");
  await sleep(900);
  const split=await evaluate(`(()=>{const s=periodView(selected),chip=document.getElementById('map-chip'),t=matrixType(selected),norm=h=>{const e=document.createElement('i');e.style.color=h;return e.style.color};
    return {zoom:map.getZoom(),dots:overlay.getLayers().filter(l=>l._schematicDot).length,tags:document.querySelectorAll('#map .bbvi-tag').length,key:document.getElementById('map-symbol-label').textContent,dotMark:!document.getElementById('key-dot-mark').hidden,
      chip:chip.hidden?'':chip.textContent,want:s.label+' · 공개 셀 '+spatialCells(s).length+'개 · 기록 '+cellRecords(s).toLocaleString()+'건',
      under:[document.getElementById('map-cells').textContent,document.getElementById('map-count').textContent,document.getElementById('map-years').textContent].join('|'),wantUnder:[spatialCells(s).length,cellRecords(s).toLocaleString(),cellYears(s)].join('|'),
      dot:chip.querySelector('.mc-dot')?.style.backgroundColor||'none',wantDot:t?norm(matrixTypeColour[t]):'none'}})()`);
  check('Overview zoom shows regional bubbles only; clicking one zooms in to red dots; no per-cell BBVI tag; the map chip names the species, cells, records and years once (type-colour dot); the legend line follows the zoom',
    bub.bubbles>0&&bub.dots===0&&bub.tags===0&&bub.frames===0&&bub.bubbleMark&&bub.rows<=2&&bub.key.startsWith('버블 = 공개 셀 묶음')&&bub.key.includes('실제 생물 발견 좌표 아님')&&split.zoom>=7&&split.dots>0&&split.tags===0&&split.dotMark&&
    split.key.startsWith('점선 = 1° 셀')&&split.key.includes('실제 생물 발견 좌표 아님')&&split.chip===split.want&&split.under===split.wantUnder&&split.dot===split.wantDot,JSON.stringify({bub,split}));
  // 2026-10-13 design 2, card shape A: a type dot, the name and latin name, then '활용 · 보전 · verdict', every value from the app
  const cardLine=await evaluate(`(()=>{const bad=[],rule=matrixRule();let n=0,want=0,single=0,wantSingle=0;for(const el of document.querySelectorAll('#species-list .species-card')){const s=data.species.find(x=>x.aphiaID===Number(el.dataset.species));if(!s?.assessment)continue;want++;
    const t=matrixType(s),v=k=>{const x=axisState(s,k).value;return x===null?'–':scoreText(s,k,x)},m=axisState(s,'MCUI').value,line=el.querySelector('.card-line');if(!line){bad.push(s.label+': no line');continue;}n++;
    const vs=[...line.querySelectorAll('.cl-v')],verdict=line.querySelector('.card-verdict'),got=vs.map(x=>x.querySelector('b').textContent+(x.querySelector('.cl-cat')?.textContent||'')).join('|')+'|'+verdict.querySelector('.verdict').textContent,exp=v('BBVI')+'|'+(m===null?'–':mcuiFace(m))+'|'+matrixTypePlain(t);
    // 2026-10-15 탐색 지도 시안: the card face shows the MCUI number only ('10', not '10.0'); its category (#208) stays in the card's spoken text
    const cat=(v('MCUI').match(/\\((.+)\\)$/)||[])[1];if(cat&&!vs[1].textContent.includes('('+cat+')'))bad.push(s.label+': no category '+cat);
    if(got!==exp||el.dataset.type!==(t||'none')||vs[1].classList.contains('high')!==(m!==null&&m>=rule.mcui_threshold)||!verdict.title.includes('채집·이용 허용이나 지속가능성 판정이 아님'))bad.push(s.label+': '+got+' / '+exp);
    if(vs[0].classList.contains('single'))single++;if(axisState(s,'BBVI').value!==null&&bbviLabel(s))wantSingle++;}
    const first=document.querySelector('#species-list .species-card .card-line .cl-v');return {bad,n,want,single,wantSingle,shown:first?getComputedStyle(first).display:''}})()`);
  check('Species cards (design 2, shape A): 활용 BBVI · 보전 MCUI · verdict on every assessed card from the app’s values and types; MCUI at or over the line in red; the verdict notes it is no advice; the single-paper mark follows the BBVI label',
    !cardLine.bad.length&&cardLine.n===cardLine.want&&cardLine.n>0&&cardLine.single===cardLine.wantSingle&&cardLine.shown!=='none',JSON.stringify(cardLine));
  // 2026-10-15 (LKH): the 탐색 후보 cards carry no grey evidence lines (근거 · 항목 · 독립 논문 · 재현 · 관련 문헌, MBPI 근거 층);
  // the evidence profile stays in the species detail's folded MBPI section
  const evCards=await evaluate(`(()=>{const cards=[...document.querySelectorAll('#species-list .species-card')],bad=[];
    for(const el of cards){const t=el.textContent;if(el.querySelector('.card-evidence,.card-lit,.card-stratum')||/독립 논문|관련 문헌|재현 기록|MBPI 근거/.test(t))bad.push(el.querySelector(':scope>b').textContent+': '+t);}
    return {bad,n:cards.length}})()`);
  check('Species cards (2026-10-15): no grey evidence lines on the 탐색 후보 cards (items · independent papers · replication · related papers · MBPI stratum)',
    !evCards.bad.length&&evCards.n>0,JSON.stringify(evCards));
  // 2026-10-14: no card text crosses its card border and the vertical list never scrolls sideways (the list is 279px wide at every width from 1281px)
  const cardFit=await evaluate(`(()=>{const list=document.getElementById('species-list'),over=[];
    const hid=(el,card)=>{for(let n=el;n&&n!==card;n=n.parentElement){const cs=getComputedStyle(n);if(n.classList.contains('sr-only')||cs.clip!=='auto'||cs.display==='none')return true;}return false;};
    for(const card of list.querySelectorAll('.species-card')){const edge=card.getBoundingClientRect().right;let right=-Infinity;
      // a one-line box that cuts its own text with '…' (the latin name beside a long Korean name) is measured by its box, which is what shows
      const cut=el=>{const cs=getComputedStyle(el);return cs.overflowX==='hidden'&&cs.textOverflow==='ellipsis'?el:null;};
      const w=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);for(let t;(t=w.nextNode());){if(!t.textContent.trim()||hid(t.parentElement,card))continue;const box=cut(t.parentElement);if(box){right=Math.max(right,box.getBoundingClientRect().right);continue;}const rg=document.createRange();rg.selectNodeContents(t);for(const r of rg.getClientRects())if(r.width>0)right=Math.max(right,r.right);}
      if(right>edge+0.5)over.push(card.querySelector(':scope>b').textContent+' +'+(right-edge).toFixed(1));}
    return {over,scroll:list.scrollWidth,client:list.clientWidth}})()`);
  check('Species cards fit: every card’s text stays inside its border and the species list has no horizontal scroll',!cardFit.over.length&&cardFit.scroll<=cardFit.client,JSON.stringify(cardFit));
  const typeChip=await evaluate(`(()=>{const t=matrixType(selected),c=document.querySelector('#detail .ax-type'),x=c?.textContent||'';return {text:x,plain:matrixTypePlain(t),label:t?matrixTypeLabel(t):'',title:c?.title||'',first:c?.querySelector('.verdict')?.textContent||''}})()`);
  check('Detail type chip (design 2): the verdict first, then the type name; its tooltip says research class, no permission or sustainability verdict',typeChip.first===typeChip.plain&&!!typeChip.label&&typeChip.text.indexOf(typeChip.plain)<typeChip.text.indexOf(typeChip.label)&&typeChip.title.startsWith('연구 분류 · 채집·이용 허용이나 지속가능성 판정이 아님'),JSON.stringify(typeChip));
  const leg=await evaluate(`(()=>{const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect(),key=q('#occurrence-legend'),more=q('.map-legend-more'),pane=r(q('.species-pane')),bl=r(q('.map-ui-bl')),c=r(q('#map-chip')),ov=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
    return {rows:[...key.children].filter(e=>r(e).height>0).length,summary:more.querySelector('summary').textContent,closed:!more.open,inside:['.key-bubble','.key-note','#map-legend-note'].every(s=>more.contains(q('#occurrence-legend '+s))),gap:Math.round(bl.left-pane.right),base:Math.round(bl.bottom-pane.bottom),
      chipHits:['.species-pane','#detail','.basemap-switch','#copy-link','#reset-map'].filter(s=>ov(c,r(q(s)))),chipEvents:getComputedStyle(q('#map-chip')).pointerEvents,chipLive:q('#map-chip').getAttribute('aria-live')}})()`);
  // 2026-10-15 탐색 지도 시안: the key sits bottom-left of the free map area, beside the species list (not under it), on the same baseline
  check('Legend (design 2 · 2026-10-15 시안): two rows (the mark and its meaning, then 조사량 and ‘ⓘ 범례’), the rest inside ‘범례’, bottom-left of the free map area beside the species list on its baseline; the map chip sits in the free part, takes no clicks, is not a live region',
    leg.rows===2&&leg.summary==='범례'&&leg.closed&&leg.inside&&leg.gap>=8&&Math.abs(leg.base)<=1&&!leg.chipHits.length&&leg.chipEvents==='none'&&leg.chipLive===null,JSON.stringify(leg));
  const sumPop=await evaluate("(()=>{const l=overlay.getLayers().find(l=>l instanceof L.Rectangle&&l.getPopup());l.openPopup();const c=document.querySelector('.leaflet-popup-content');const r={tiles:[...c.querySelectorAll('.cell-summary span')].map(x=>x.textContent),text:c.innerText};map.closePopup();return r})()");
  check('Cell popup opens with confirmed / usable / conservation-priority / evidence-gap species counts',JSON.stringify(sumPop.tiles)==='["확인 종","활용 지표 높은 종","보전 지표 높은 종","보전평가 미확인 종","근거 부족 종"]'&&sumPop.text.includes('이 격자에서 측정한 값이 아닙니다'),JSON.stringify(sumPop).slice(0,500));
  const sumVal=await evaluate("(()=>{setMapMode('value');const r=[...document.querySelectorAll('#value-cell-detail .cell-summary span')].map(x=>x.textContent);setMapMode('occurrence');return r})()");
  check('Value map cell panel shows the same four species counts',JSON.stringify(sumVal)==='["확인 종","활용 지표 높은 종","보전 지표 높은 종","보전평가 미확인 종","근거 부족 종"]',JSON.stringify(sumVal));
  check('Live map title names the public-criteria collection',(await evaluate("document.getElementById('map-source').textContent")).includes('공개 기준 자료'));
  // 2026-10-13 design 2: the chip follows the species and the period filter, always with the numbers under the map
  const chipFlow=await evaluate(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),q=x=>document.getElementById(x),out=[];
    const read=tag=>{const s=periodView(selected),n=spatialCells(s).length,c=q('map-chip');out.push({tag,chip:c.hidden?'(hidden)':c.textContent,
      want:n?selected.label+' · 공개 셀 '+n+'개 · 기록 '+cellRecords(s).toLocaleString()+'건':selected.label+' · 공개 셀 없음',cells:q('map-cells').textContent,wantCells:String(n),size:s.cells[0]?.sizeDeg||null})};
    selectSpecies(241776);await wait(300);read('해삼');
    // verified-4.11 has no candidate without public cells, so one candidate's cells are emptied for this read and put back
    const none=data.species.find(x=>x.catalog),kept=none.cells;none.cells=[];selectSpecies(none.aphiaID);await wait(300);read('후보 '+none.label+'(셀 비운 시험)');none.cells=kept;
    selectSpecies(836033);await wait(300);const p=[...document.querySelectorAll('[data-period]')].find(b=>b.dataset.period!=='all');p.click();await wait(300);read('참굴 '+p.dataset.period);
    document.querySelector('[data-period="all"]').click();await wait(300);read('참굴 전체');return out})()`);
  check('Map chip follows the species and the period filter (해삼 4° cells, a candidate without public cells (simulated), one period of 참굴 and back), equal to the numbers under the map',
    chipFlow.length===4&&chipFlow.every(x=>x.chip===x.want&&x.cells===x.wantCells)&&chipFlow[0].size===4&&chipFlow[2].chip!==chipFlow[3].chip,JSON.stringify(chipFlow));
  t=await pick(836033);
  check('Oyster live: map section explains why publishable, exclusions, OBIS 26 kept under review',['지도 셀','공개 셀','왜 공개할 수 있는가',`CC BY-NC ${snapshot.profiles.find(p=>p.aphia_id===836033).evidence_summary.map.used_licences['CC BY-NC 4.0']}건`,'육지 위 좌표','운영 DB에서 검토 중인 기존 기록','1°를 적용','기존 OBIS 시험 수집 26건'].every(x=>t.includes(x)),t);
  check('Oyster: text matches its published cell (no "instead of cells" contradiction)',!t.includes('공개 출현 셀 대신')&&t.includes('이 수집 기록은 지도 셀에 쓰지 않음'),t.slice(0,600));
  check('Institution checklist: record share by country metadata, Korean ABS act, ABS/BBNJ links, a check not a legal determination',['활용 전 확인할 제도','법적 판단 아님','기록의 국가 메타데이터','유전자원의 접근·이용 및 이익 공유에 관한 법률','나고야의정서 국내 이행법','법령 원문 확인이 필요합니다','ABS 정보공유체계','BBNJ 협정','관할 경계를 판정할 수 없습니다'].every(x=>t.includes(x))&&/한국\(KR\) [\d,]+건\([\d.]+%\)/.test(t),t.slice(t.indexOf('활용 전 확인'),t.indexOf('활용 전 확인')+500));
  // 2026-10-15 application-doc gaps: both-high species shows alternative production before the map summary; links; dialog; status table
  const gap=await evaluate(`(()=>{selectSpecies(342067);const d=document.getElementById('detail');const alt=d.querySelector('.alt-production'),map=d.querySelector('#detail-map-summary');
    const before=!!alt&&!!map&&!!(alt.compareDocumentPosition(map)&Node.DOCUMENT_POSITION_FOLLOWING),inat=d.querySelector('.detail-actions a')?.href||'';
    d.querySelector('[data-coord-request]').click();const dlg=document.getElementById('coord-dialog'),open=dlg.open,txt=dlg.innerText;dlg.close();
    selectSpecies(836033);const oyAlt=!!document.querySelector('#detail .alt-production'),cp=!!document.querySelector('#cmp-profile .alt-production');
    const m=document.getElementById('method'),gone=['mt-scorecard','mt-acc-05','promise-table','promise-count'].filter(id=>document.getElementById(id)),
      words=['VALIDATION SCORECARD','검증 성적표','신청서 약속','구현 현황'].filter(w=>m.textContent.includes(w)),folds=[...m.querySelectorAll('details.mt-acc')].map(d=>d.id);
    return {before,altText:alt?.innerText||'',inat,open,txt,oyAlt,gone,words,folds,first:m.firstElementChild?.id}})()`);
  check('Both-high species (살오징어): 대체생산·양식 연구 현황 before the map summary; other types do not get it',gap.before&&gap.altText.includes('대체생산·양식 연구 현황')&&gap.altText.includes('조사 필요')&&!gap.oyAlt,JSON.stringify({before:gap.before,oyAlt:gap.oyAlt,alt:gap.altText.slice(0,200)}));
  check('Species links: iNaturalist search (external) and the precise-coordinate dialog that gives no raw coordinates',gap.inat.startsWith('https://www.inaturalist.org/taxa/search?q=Todarodes%20pacificus')&&gap.open&&['원좌표를 누구에게도 제공하지 않습니다','시민','연구자','기관','계획된 승인 절차'].every(x=>gap.txt.includes(x)),JSON.stringify({inat:gap.inat,open:gap.open}));
  // 2026-10-16: the scorecard table and fold 05 (application promise table) were taken off the method tab
  check('Method tab: no validation scorecard and no fold 05 (application promise table); folds 01–04; MCUI table is the first block',gap.gone.length===0&&gap.words.length===0&&JSON.stringify(gap.folds)===JSON.stringify(['mt-acc-01','mt-acc-02','mt-acc-03','mt-acc-04'])&&gap.first==='mt-mcui-map',JSON.stringify({gone:gap.gone,words:gap.words,folds:gap.folds,first:gap.first}));
  const cucT=await pick(241776);
  check('Sea cucumber detail: checked bioactivity case shown, marked not an index input',cucT.includes('별도 원문 조사 · 지표 입력 아님')&&cucT.includes('Holotoxin'),cucT.slice(cucT.indexOf('화합물'),cucT.indexOf('화합물')+400));
  t=await pick(836033);
  const oyMap=await liveMap(836033);
  const oyTop=await evaluate("(()=>{selectSpecies(836033);const d=document.getElementById('detail');const more=[...d.querySelectorAll('details.detail-more')];return {top:d.querySelector('.detail-summary').innerText,closed:more.length===4&&more.every(x=>!x.open),summaries:more.map(x=>x.querySelector('summary').innerText),kb:more.every(x=>x.querySelector('summary').tabIndex===0)}})()");
  check('Core regression: oyster top = map GBIF records · cells · years of the published cells; OBIS 26건/2008–2014 not mixed in',new RegExp(`지도 표시 기록\\s*${oyMap.recordsText}건 · ${oyMap.cells}개 격자\\(1°\\)`).test(oyTop.top)&&oyTop.top.includes(`기록 연도\n${oyMap.years}`)&&oyTop.top.includes('GBIF')&&!/26건/.test(oyTop.top.split('제외 사유')[0])&&!oyTop.top.includes('2008')&&/제외 사유\s*.*운영 DB에서 검토 중인 기존 기록 26건/.test(oyTop.top)&&!oyTop.top.includes('AphiaID'),oyTop.top);
  await shot('desktop-oyster-collapsed');
  check('Detail: four disclosures closed by default, keyboard-focusable summaries',oyTop.closed&&oyTop.kb&&JSON.stringify(oyTop.summaries)===JSON.stringify(['근거 자세히 보기','활용 전 확인할 제도','수집·선별 기준','출처와 이용조건']),JSON.stringify(oyTop));
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
  // 4.13: 넙치's P35 MIC rows are adopted, so 항균 goes 4 -> 5. The ACE chip keeps 14 (넙치 still has its ACE item; only
  // its top item changed), and no other chip moves.
  check('Use chips: counts come from adopted evidence (ACE 14 since 4.11 drops 감태\'s paper-local ACE cohort, virus 6, antibacterial 5 from the 3.18/3.19/4.1/4.13 AMP stratum, resistant 1 from its MRSA rows, anticancer 3 from the 3.21 stratum, antifungal 0, pain 0, omega-3 9 from the 3.17 EPA+DHA rows) plus display-only rows (antioxidant 2, antidiabetic 2), and a trait with none stays a grey disabled 0 chip',
    chipN.ace===14&&chipN.virus===7&&chipN.microbe===5&&chipN.resistant===1&&chipN.fungus===3&&chipN.pain===1&&chipN.antioxidant===2&&chipN.diabetes===2&&chipN.cancer===3&&chipN.omega3===9&&
    chips.filter(([,n,gap])=>gap).every(([,n,,off])=>n===0&&off)&&chips.filter(([,n,gap])=>!gap).every(([,n,,off])=>n>0&&!off),JSON.stringify(chips));
  // Picking a chip hides the species without that evidence and says how many were hidden; it never claims they are worth less.
  const chipFilter=await evaluate("(()=>{setUses(['microbe']);const ids=[...document.querySelectorAll('.species-card')].map(b=>Number(b.dataset.species));const oyster=document.querySelector('.species-card[data-species=\"836033\"]')?.innerText||'';const ark=document.querySelector('.species-card[data-species=\"504357\"]')?.innerText||'';const note=document.getElementById('use-extra').innerText;setUses([]);return {ids,note,oyster,ark,back:document.querySelectorAll('.species-card').length}})()");
  check('Use chip filter: the antibacterial chip leaves 꽃게 (4.1), 피조개, 조피볼락, 참굴 and 넙치 (4.13), counts the hidden species and clears back to all 30',
    JSON.stringify(chipFilter.ids.sort((a,b)=>a-b))==='[274849,275816,504357,836033,1061762]'&&/근거 미확인 25종/.test(chipFilter.note)&&
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
  // 2026-10-11: five more food chips read values the report already holds (MFDS 30% claim line for each mineral, the
  // adopted edible fraction and the reviewed aquaculture record). They only show; no score changes.
  const food=await evaluate(`(()=>{const n=()=>document.querySelectorAll('.species-card').length,ids=()=>[...document.querySelectorAll('.species-card')].map(b=>Number(b.dataset.species)).sort((a,b)=>a-b),r={};
    renderUseChips();r.chips=Object.fromEntries([...document.querySelectorAll('.use-chip')].map(b=>[b.dataset.use,parseInt(b.querySelector('b').textContent,10)]));
    r.order=[...document.querySelectorAll('[aria-label="식량 활용 특성"] .use-chip')].map(b=>b.dataset.use).join();
    setUses(['calcium_mg']);r.calcium=ids();r.calciumNote=document.getElementById('use-extra').innerText;
    setUses(['whole']);r.whole=n();r.wholeText=[...document.querySelectorAll('.species-card')].every(b=>b.innerText.includes('가식부 100%'));
    for(const x of [['iron_mg','omega3'],['whole','mineral'],['farmed','protein_g']]){setUses(x);r[x.join('+')]=n();}
    setUses([]);const q=document.getElementById('search');q.value='칼슘';renderList();r.suggest=document.querySelector('[data-use-suggest]')?.dataset.useSuggest||'';r.suggestText=document.querySelector('[data-use-suggest]')?.innerText||'';q.value='';renderList();
    const before=selected.aphiaID,view=map.getZoom()+'/'+map.getCenter().lat.toFixed(3);applyHash({u:'calcium_mg,whole'});r.restored=[...activeUses].join();r.hash=decodeURIComponent(location.hash.match(/u=([^&]*)/)?.[1]||'');
    setUses([]);r.back=selected.aphiaID===before&&map.getZoom()+'/'+map.getCenter().lat.toFixed(3)===view;return r})()`);
  check('Food chips 8: 고단백 16, 미네랄 11, 칼슘 3, 철분 10, 아연 3, 오메가-3 9, 가식부 100% 9, 양식 가능 27 in that order; 칼슘 shows 참굴·꼬시래기·멸치 with the rest counted as 기준 미달/근거 미확인; AND 철분×오메가-3 2, 가식부×미네랄 4, 양식×고단백 13; searching 칼슘 points at the 칼슘 chip; u=calcium_mg,whole restores both chips',
    food.order==='protein_g,mineral,calcium_mg,iron_mg,zinc_mg,omega3,whole,farmed'&&food.chips.protein_g===16&&food.chips.mineral===11&&food.chips.calcium_mg===3&&food.chips.iron_mg===10&&food.chips.zinc_mg===3&&food.chips.omega3===9&&food.chips.whole===9&&food.chips.farmed===27&&
    JSON.stringify(food.calcium)==='[219984,236157,836033]'&&/기준 미달/.test(food.calciumNote)&&/210 mg/.test(food.calciumNote)&&food.whole===9&&food.wholeText&&
    food['iron_mg+omega3']===2&&food['whole+mineral']===4&&food['farmed+protein_g']===13&&food.suggest==='calcium_mg'&&/식량 · 칼슘/.test(food.suggestText)&&food.restored==='calcium_mg,whole'&&food.hash==='calcium_mg,whole'&&food.back,JSON.stringify(food));
  // 2026-10-12: 혈압(ACE 저해) and 항산화 sit in a third row '기능성(식품 소재)' with the same ids, rules and counts, old links still
  // turn them on, and every card and the species detail name the stratum of the MBPI's top item next to the value.
  const strat=await evaluate(`(()=>{const r={},before=selected.aphiaID;setUses([]);renderUseChips();
    r.rows=[...document.querySelectorAll('#use-chips .use-row')].map(x=>x.getAttribute('aria-label')+':'+[...x.querySelectorAll('.use-chip')].map(b=>b.dataset.use).join(','));
    r.title=document.querySelector('#use-chips .use-row:nth-of-type(2) .use-group')?.textContent||'';
    r.counts=Object.fromEntries([...document.querySelectorAll('.use-chip')].map(b=>[b.dataset.use,parseInt(b.querySelector('b').textContent,10)]));
    r.links={};for(const u of ['ace','antioxidant','ace,omega3']){applyHash({u});r.links[u]=[...activeUses].join();}setUses([]);
    renderList();r.cards=document.querySelectorAll('.species-card').length;r.cardStrata=document.querySelectorAll('.species-card .card-stratum').length;r.strata=data.species.map(x=>mbpiStratumOf(x)).filter(Boolean).map(st=>'MBPI 근거 · '+st.short);
    // the detail is rendered off-screen for 미역, so the selected species and the map stay as the later checks expect
    const wak=data.species.find(x=>x.aphiaID===145721),box=document.createElement('div');box.innerHTML=renderVerifiedIndices(wak);
    const m=box.querySelector('[data-axis="MBPI"]');r.summary=m?.querySelector('summary')?.textContent||'';r.first=m?.querySelector('.mbpi-first')?.textContent||'';
    box.innerHTML=axisCards(wak);r.axis=box.textContent;r.kept=selected.aphiaID===before;
    renderCompareProfile();renderCompareDrawer(selected);r.profile=document.querySelector('#cmp-drawer #cdr-use')?.textContent||'';r.profileStratum=mbpiStratumOf(selected)?.short||'';return r})()`);
  check('MBPI strata: chips in three rows (신약 · 기능성(식품 소재) · 식량) with ids and counts (혈압 14 from 4.11, 항산화 2), u=ace / u=antioxidant / u=ace,omega3 links still turn the same chips on; all 30 assessed species have an MBPI stratum (13 ACE 펩타이드; 4.11: 감태 leads with a ChEMBL compound), shown in the detail, not on the 탐색 후보 card (2026-10-15); 미역 detail opens with the published post-hoc result, the 19.6–89.2 aggregation range and the AHTPDB stratum; the compare profile\'s 근거 자세히 보기 drawer names the selected species\' stratum too',
    JSON.stringify(strat.rows)===JSON.stringify(['신약 활용 특성:virus,dementia,parasite,cancer,microbe,resistant,fungus,pain,diabetes','기능성(식품 소재) 활용 특성:ace,antioxidant','식량 활용 특성:protein_g,mineral,calcium_mg,iron_mg,zinc_mg,omega3,whole,farmed'])&&
    strat.title==='기능성(식품 소재)'&&strat.counts.ace===14&&strat.counts.antioxidant===2&&strat.counts.virus===7&&strat.counts.protein_g===16&&
    strat.links.ace==='ace'&&strat.links.antioxidant==='antioxidant'&&strat.links['ace,omega3']==='ace,omega3'&&
    strat.cards===30&&strat.cardStrata===0&&strat.strata.length===30&&strat.strata.every(t=>/^MBPI 근거 · /.test(t)&&!/미등록/.test(t))&&
    strat.strata.filter(t=>t==='MBPI 근거 · ACE 펩타이드').length===13&&strat.strata.filter(t=>t==='MBPI 근거 · ACE 화합물').length===0&&
    /89\.2 · 정식 산출 · 방법 검증 기준 미충족 · ACE 펩타이드/.test(strat.summary)&&
    strat.first.startsWith('사후 검증 기준 미충족(약물 기원종 3종 중 2종 계산) · 집계 방식에 따라 19.6–89.2근거 층: ACE 저해 펩타이드(AHTPDB 352개 안 순위')&&
    /생리활성 MBPI.*ACE 펩타이드/.test(strat.axis)&&strat.kept&&!!strat.profileStratum&&strat.profile.includes(strat.profileStratum),JSON.stringify(strat));
  // 4.10 (2026-10-12): the secondary, exploratory MBPI-Rx is one line under the detail's MBPI (opening to its reason and the
  // pre-registration), one sortable column in the compare data table, a line in #method-03 and (2026-10-15) a row under the
  // species profile's MBPI, and nowhere else on the page.
  const rx=await evaluate(`(()=>{const r={},keep={view:currentView,mode:cmpMode,sort:{...cmpSort},basket:[...cmpBasket],sel:selected.aphiaID};
    const box=document.createElement('div'),one=id=>data.species.find(x=>x.aphiaID===id);
    box.innerHTML=renderVerifiedIndices(one(836033));const d=box.querySelector('details.rx-disclosure');
    r.order=[...box.querySelectorAll('details.score-disclosure')].map(x=>x.dataset.axis||'RX').join();r.oy=d?.querySelector('summary')?.textContent||'';r.body=d?.querySelector('.score-disclosure-body')?.textContent||'';
    box.innerHTML=renderVerifiedIndices(one(145721));r.wak=box.querySelector('details.rx-disclosure summary')?.textContent||'';
    setView('compare',false);setCompareMode('table');cmpSort={key:null,dir:null};renderComparison();const c=document.getElementById('comparison'),cells=()=>[...c.querySelectorAll('tbody tr.cmp-row')].map(tr=>tr.querySelector('td.cmp-rx')?.textContent);
    r.heads=[...c.querySelectorAll('thead [data-sort]')].map(b=>b.dataset.sort).join();r.rxHead=c.querySelector('[data-sort=MBPI_RX]')?.textContent||'';r.start=cells();r.groups=data.species.map(s=>cmpGroup(s,'MBPI_RX'));
    c.querySelector('[data-sort=MBPI_RX]').click();r.desc=cells();r.label=document.getElementById('comparison-page').textContent;r.focus=document.activeElement?.dataset?.sort||'';
    c.querySelector('[data-sort=MBPI_RX]').click();r.asc=cells();c.querySelector('[data-sort=MBPI_RX]').click();r.reset=cells();
    cmpBasket=[836033,145721];renderCompare();renderCompareDialog();setCompareMode('matrix');renderList();
    r.elsewhere=['.species-list','#cmp-tray','#cmp-dialog-body','#matrix-points','#matrix-types','#map'].filter(q=>{const e=document.querySelector(q);if(!e)return false;
      const t=e.textContent+' '+[...e.querySelectorAll('[title],[aria-label]')].map(x=>(x.title||'')+' '+(x.getAttribute('aria-label')||'')).join(' ');return /의약 후보|MBPI-Rx/.test(t);});
    r.method=document.getElementById('method-03')?.textContent||'';
    cmpSort=keep.sort;cmpBasket=keep.basket;setCompareMode(keep.mode);renderComparison();renderCompare();setView(keep.view,false);r.kept=selected.aphiaID===keep.sel;return r})()`);
  {const rxAll=await evaluate("data.species.map(s=>mbpiRxOf(s)?.value??null)"),n=rxAll.filter(v=>v===null).length,num=x=>x==='–의약 표적 근거 없음'?null:Number(x),vals=rxAll.filter(v=>v!==null);
   // 4.14 (prereg-4.14 4): a sort ranks only inside one stratum (strata in first-seen order), '–' last both ways
   const strata=[...new Set(rx.groups.filter(Boolean))],rank=i=>rx.groups[i]?strata.indexOf(rx.groups[i]):Infinity,
     within=sign=>rxAll.map((v,i)=>i).sort((i,j)=>rank(i)-rank(j)||(rxAll[i]===null||rxAll[j]===null?(rxAll[i]===null)-(rxAll[j]===null)||i-j:sign*(rxAll[i]-rxAll[j])||i-j)).map(i=>rxAll[i]);
    check('MBPI-Rx (4.10, secondary, exploratory): 참굴 detail line right under MBPI reads 62.6 · 항균 펩타이드 · 사후 검증 기준 미충족(탐색적 재검토) and opens to the criterion, post-hoc reason and pre-registration; 미역 reads 의약 표적 근거 없음 with its reason (never 0); the compare table has one sortable MBPI-Rx column after MBPI (20 values, 10 –, – last both ways); #method-03 names it; the species profile shows it beside MBPI (2026-10-15, checked below); no card, basket, dialog, matrix or map text mentions it',
      rx.order==='MFPI,MBPI,RX,RX,MCUI,BBVI'&&rx.oy==='의약 후보 MBPI(보조, 탐색적)62.6 · 항균 펩타이드 · 사후 검증 기준 미충족(탐색적 재검토)'&&
      ['층 분류 기준: 그 층의 비교집단이 식품 단백질','사후 검증(약물 기원종 3종 중 2종 계산)','사전 등록: research/verified-indices/prereg-mbpi-rx-4.10-2026-10-12.md'].every(t=>rx.body.includes(t))&&
      rx.wak==='의약 후보 MBPI(보조, 탐색적)의약 표적 근거 없음 · 사후 검증 기준 미충족(탐색적 재검토)'&&
      rx.heads==='name,MFPI,MBPI,MBPI_RX,BBVI,MCUI'&&/^MBPI-Rx보조·탐색적/.test(rx.rxHead)&&rx.start.length===total&&n===10&&vals.length===20&&
      rx.start.filter(x=>x==='–의약 표적 근거 없음').length===10&&rx.start.every((x,i)=>num(x)===rxAll[i])&&
      strata.length>1&&JSON.stringify(rx.desc.map(num))===JSON.stringify(within(-1))&&JSON.stringify(rx.asc.map(num))===JSON.stringify(within(1))&&
      rx.desc.slice(-10).every(x=>x==='–의약 표적 근거 없음')&&rx.asc.slice(-10).every(x=>x==='–의약 표적 근거 없음')&&
      rx.label===`총 ${total}종 · 정렬: MBPI-Rx 높은 순 (층별)`&&rx.focus==='MBPI_RX'&&JSON.stringify(rx.reset)===JSON.stringify(rx.start)&&
      rx.elsewhere.length===0&&rx.method.includes('의약 후보 MBPI(보조) · 기준 미충족')&&rx.method.includes('prereg-mbpi-rx-4.10-2026-10-12.md')&&rx.kept,
      JSON.stringify({...rx,start:rx.start.slice(0,8),desc:rx.desc.slice(0,5),asc:rx.asc.slice(0,5),reset:undefined,body:rx.body.slice(0,120),method:rx.method.slice(-200)}));}
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
  // 3.27: 3 replicated (참굴, 미역, 큰가리비) + 19 labelled single-paper BBVI; 3.28: 톳 replicated, 4 + 18;
  // 4.3 fills every cell (참조기 and the floor BBVIs of 방어·참문어·갑오징어), 4 + 26; 4.9: 갑오징어 replicated, 5 + 25;
  // 4.11 counts only same-origin replications (미역's purified VW), 1 + 29
  check('BBVI 30 species (1 replicated: 미역 + 29 carrying the single-paper label): weight slider enabled',slider.n===30&&slider.lab===29&&JSON.stringify(slider.rep)==='[145721]'&&!slider.disabled&&slider.status==='BBVI 산출 종 30종',JSON.stringify(slider));
  const oyCard=await evaluate("document.querySelector('#decision-list [data-aphia=\"836033\"] span').textContent");
  // verified-pilot-3.2: the oyster is placed (national MCUI, marked), so its card leads with the published matrix type
  check('Oyster status card shows only its published matrix type (2026-10-08: evidence labels stay in the detail)',!!typeLabel(836033)&&oyCard===typeLabel(836033)&&!oyCard.includes('검증')&&!oyCard.includes('참고값')&&!oyCard.includes('근거 논문 1편')&&!oyCard.includes('재현'),oyCard);
  // 2026-10-08: the screen uses neutral label words; the published data keeps the old ones
  const oldWords=await evaluate("(()=>{const v=currentView,hit=[];for(const x of ['explore','compare','method']){setView(x,false);const t=document.body.textContent;for(const w of ['검증 미통과','단일 논문','미통과','근거 논문 1편'])if(t.includes(w))hit.push(x+':'+w);}setView(v,false);return hit})()");
  check('No old label words (검증 미통과, 단일 논문, 2026-10-12 any 미통과 such as the MBPI reason\'s 기준 미통과, 4.16 근거 논문 1편) on any tab',oldWords.length===0,oldWords.join(' | '));
  // 2026-10-15 method change ledger: fold 04 lists every published version newest first with the pre-registered ones marked;
  // the screen says '방법 결정' (the records keep '팀장 결정') and each one opens fold 04; the header shows the freeze date
  const ledger=await evaluate("(async()=>{const v0=currentView,y0=scrollY,L=await (await fetch('method-changelog.json')).json();setView('explore',false);const t=document.body.textContent;setView('method',false);const items=[...document.querySelectorAll('#mt-changelog .mt-cl-item')];const md=document.querySelector('.md-link');let opened=null;if(md){setView('explore',false);md.click();opened={view:currentView,fold:document.getElementById('mt-acc-04').open};}setView('method',false);const pre=document.querySelectorAll('#mt-changelog .mt-cl-pre').length;setView(v0,false);scrollTo(0,y0);return {n:items.length,want:L.entries.length,first:items[0]?.id,newest:'mt-cl-'+L.current.method_version.replace(/[^a-z0-9]+/gi,'-'),pre,wantPre:L.counts.preregistered,leader:document.body.textContent.includes('팀장 결정')||t.includes('팀장 결정'),links:document.querySelectorAll('.md-link').length,opened,chip:document.getElementById('pop-version').textContent,label:L.current.frozen_on+' 동결'}})()");
  check('Method fold 04: one timeline entry per published version (newest first), 사전 등록 marks match the ledger, no 팀장 결정 on screen, 방법 결정 opens fold 04, the header chip’s popover shows the freeze date (2026-10-15 시안: the version moved off the chip)',
    ledger.n===ledger.want&&ledger.first===ledger.newest&&ledger.pre===ledger.wantPre&&!ledger.leader&&ledger.links>0&&ledger.opened?.view==='method'&&ledger.opened?.fold&&ledger.chip.includes(ledger.label),JSON.stringify(ledger));
  // design 05: the value cell shows the number; its full label sits in the row's 자세히 panel (data-more-*)
  const oyCmp=await evaluate("(()=>{renderComparison();const q=a=>document.querySelector('#comparison [data-more-aphia=\"836033\"][data-more-axis=\"'+a+'\"]')?.textContent.replace(/\\s+/g,' ')||'';const r={MBPI:q('MBPI'),BBVI:q('BBVI')};return r})()");
  check('Comparison table: 참굴 MBPI 72 and BBVI 72 (4.16 whole numbers of 72.2/71.9) with the pilot and replication labels',/^72(?![.\d])/.test(oyCmp.MBPI)&&/^72(?![.\d])/.test(oyCmp.BBVI)&&oyCmp.MBPI.includes('정식 산출 · 방법 검증 기준 미충족')&&oyCmp.BBVI.includes('정식 산출 · 방법 검증 기준 미충족')&&oyCmp.MBPI.includes('최상위 근거 독립 재현 확인 중')&&oyCmp.BBVI.includes('최상위 근거 독립 재현 확인 중'),JSON.stringify(oyCmp));
  // verified-pilot-3.2: the oyster leaves the follow-up chips and becomes a matrix point with its type; design 02 (2026-10-10)
  // moves the national-MCUI mark from the point's shape to its tooltip and the per-type list under the graph
  const oyPoint=await evaluate("(()=>{toggleSimulation(false);const p=[...document.querySelectorAll('#matrix-points .matrix-point.pilot')].find(b=>b.title.startsWith('참굴'));const li=document.querySelector('#matrix-types [data-aphia=\"836033\"]');return {chip:!!document.querySelector('#matrix-unplaced [data-aphia=\"836033\"]'),title:p?.title||'',list:li?.textContent||'',box:li?.closest('.mt-card')?.querySelector('h3')?.textContent||''}})()");
  check('Oyster: placed as a national-MCUI point (tooltip and per-type list) with its type, not listed as a follow-up chip',!oyPoint.chip&&oyPoint.title.includes('MCUI 한국 국가 평가 기반')&&oyPoint.title.includes(typeLabel(836033))&&oyPoint.list.includes('MCUI 국가 평가')&&oyPoint.box.includes(typeLabel(836033)),JSON.stringify(oyPoint));
  check('Collection note: no stale "점수는 아직 발행하지 않았습니다"',await evaluate("(()=>{const n=document.getElementById('collection-note').textContent;return !n.includes('점수는 아직 발행하지 않았습니다')&&!n.includes('보류')&&!n.includes('시범')})()"));
  // 2026-10-13 design 2: one status chip ('연구 프로토타입 · version · OCEAN 20') instead of three badges; the popover keeps the full text
  check('Header/initial copy: one status chip on one line (연구 프로토타입; 2026-10-15 시안: the version in its popover, no "0.2"), no separate team or version badge, no "첫 버전"/"점수를 산출하지 않아"',await evaluate("(()=>{const c=document.getElementById('notice-chip').textContent;const r=document.createRange();r.selectNodeContents(document.getElementById('notice-chip-text'));const rs=[...r.getClientRects()].filter(x=>x.width>0);return rs.length>0&&rs.every(x=>x.top<rs[0].bottom&&x.bottom>rs[0].top)&&c.includes('연구 프로토타입')&&document.getElementById('pop-version').textContent.includes(data.assessmentInfo.version)&&!c.includes('0.2')&&!document.querySelector('.project-tag,.header .version')&&document.getElementById('notice-pop').textContent.includes('OCEAN 20')&&!document.body.innerText.includes('첫 버전')&&!document.body.innerText.includes('점수를 산출하지 않아')})()"));
  const inlineSim=await evaluate("(()=>{toggleSimulation(false);const b=document.getElementById('simulate-inline');if(!b)return 'no button';b.click();const r=simulated&&document.getElementById('matrix-note').textContent.includes('실제 종과 무관');toggleSimulation(false);return r})()");
  // verified-pilot-3.2 places real species, so the empty-matrix shortcut appears only when nothing is placed
  const matrixNote=await evaluate("document.getElementById('matrix-note').textContent");
  check('Empty matrix note links straight to the simulated example (still labelled not real); a placed matrix states its count instead',
    readiness.matrix_points?inlineSim==='no button'&&matrixNote.startsWith(`정식 산출 ${readiness.matrix_points}종`)&&
      // 4.17 (prereg-4.17 5): range-state and Rapid LC values are preliminary assessments, drawn and worded like any other MCUI
      matrixNote.includes('IUCN 기반과 같은 척도가 아닙니다')===readiness.species.some(r=>r.matrix_eligible&&r.mcui_basis==='national')&&matrixNote.includes('한국 국가 평가')===readiness.species.some(r=>r.matrix_eligible&&r.mcui_basis==='national')&&!/서식국|예비|Rapid LC|역검증/.test(matrixNote):inlineSim===true,String(inlineSim)+' | '+matrixNote);
  // Navy redesign (2026-10-11, intended change 1): the effort shading starts off and is not kept in the link; the 조사량
  // box turns it on. It stays on for the shading and B-1 checks below.
  const effortStart=await evaluate("(()=>{const t=document.getElementById('effort-toggle');const r={checked:t.checked,n:effortLayer?effortLayer.getLayers().length:0,hash:location.hash};t.click();r.on=t.checked&&effortLayer.getLayers().length>100;return r})()");
  check('B-1 effort layer off on first open and not in the link; the 조사량 box turns it on',!effortStart.checked&&effortStart.n===0&&!/effort/.test(effortStart.hash)&&effortStart.on,JSON.stringify(effortStart));
  const effortOp=await evaluate("(()=>{const eb=[...document.querySelectorAll('.effort-key .eb')].map(e=>getComputedStyle(e).opacity);const fills=[...new Set(effortLayer.getLayers().map(l=>l.options.fillOpacity))].sort();return {eb,fills}})()");
  check('Effort shading lighter than before (legend .07/.15/.25/.37 · layer ≤.14)',JSON.stringify(effortOp.eb)==='["0.07","0.15","0.25","0.37"]'&&Math.max(...effortOp.fills)<=.14,JSON.stringify(effortOp));
  check('Method tab: back-test cases from the proposal, marked run and failed (3.27)',await evaluate("const m=document.getElementById('method').textContent;m.includes('사후 검증 사례(3.27 실행 · 기준 미충족')&&!m.includes('아직 수행 안 함')&&m.includes('Conus magus')&&m.includes('Ecteinascidia turbinata')&&m.includes('Halichondria okadai')"));
  check('Method tab: no outdated grid-centre wording',await evaluate("!document.getElementById('method').textContent.includes('격자 중심')&&document.getElementById('method').textContent.includes('실제 발견·채집 좌표가 아닙니다')"));
  check('Merged PR #1: evidence coverage row and map section both reachable; pilot values carry a caution box',t.includes('자료 연결 현황')&&t.includes('품질 점수 아님')&&t.includes('분석 주의')&&t.includes('지도 셀'),t);
  const popup=await evaluate("const l=overlay.getLayers()[0];l.openPopup();document.querySelector('.leaflet-popup-content').innerText");
  // The popup of one published cell lists each of its period rows with counts and licences (taken from the loaded rows).
  const popCells=await evaluate("spatialCells(selected).map(rows=>[...rows.map(r=>'공개 집계 기간 '+r.period),...rows.map(r=>'선별 기록 '+r.records+'건 · 조사 지점 '+r.sites+'곳'),...rows.flatMap(r=>r.licenses)])");
  check('Cell popup: period, sea area, source, licence, spatial resolution',popCells.some(need=>need.every(x=>popup.includes(x)))&&['1°×1°','가장 짧은 변 약','해역별 활용·보전 판단: 하지 않음(지표는 종 단위)','해역 판단을 하지 않는 이유','원좌표·개체수·자원량·한국 전체 분포가 아닙니다','청회색 점은 실제 발견 좌표가 아닌'].every(x=>popup.includes(x)),popup);
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
  // 2026-10-15 탐색 지도 시안: from 1180px the cell table lives in the right panel's '선택 격자' tab
  await evaluate("map.closePopup();if(wideLayout())setSideTab('cell');document.querySelector('#cell-table [data-cell]').focus();1");await sleep(200);
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
  // 2026-10-13: a shared t=value link opens on the species view of that species (no new hash key)
  await evaluate("location.hash='s=372119&v=explore&t=value';location.reload();1");
  for(let i=0;i<80;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state')?.textContent||''")).includes('연결됨'))break;}
  await sleep(800);
  const sharedValue=await evaluate("({s:selected?.aphiaID,mode:mapMode,view:valueView,drawn:valueRects.length,cells:spatialCells(periodView(selected)).length,pressed:document.getElementById('value-view').getAttribute('aria-pressed')})");
  check('A shared t=value link opens the species view of that species',sharedValue.s===372119&&sharedValue.mode==='value'&&sharedValue.view==='species'&&sharedValue.drawn===sharedValue.cells&&sharedValue.pressed==='false',JSON.stringify(sharedValue));
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
  // 2026-10-13: the coverage column left the table (the detail pane keeps the bar, checked above); each row's panel carries the
  // evidence-level line instead
  check('A-2 comparison table: one row and one evidence-level line per species, no coverage column, all species covered',bars.length===1&&bars[0].bars===0&&bars[0].ev===total&&bars[0].rows===total,JSON.stringify(bars.map(p=>[p.label,p.bars,p.ev,p.rows])));
  const stickyCompare=await evaluate("(()=>{setView('compare');setCompareMode('table');const c=document.getElementById('comparison');c.scrollLeft=c.scrollWidth;const left=c.getBoundingClientRect().left;const row=c.querySelector('tbody th').getBoundingClientRect().left;const head=c.querySelector('thead th').getBoundingClientRect().left;const btn=c.querySelector('.cmp-more-btn');btn.click();const label=getComputedStyle(c.querySelector('tr.cmp-more:not([hidden]) .dt-x-ev .ev-chip'));const result={left,row,head,wrap:label.whiteSpace,overflow:label.overflow};btn.click();c.scrollLeft=0;setView('explore');return result})()");
  check('Comparison labels remain visible after horizontal scroll and evidence-level chips wrap',Math.abs(stickyCompare.row-stickyCompare.left)<4&&Math.abs(stickyCompare.head-stickyCompare.left)<4&&stickyCompare.wrap==='normal'&&stickyCompare.overflow==='visible',JSON.stringify(stickyCompare));
  t=await pick(836033);
  check('Legend: red dots are a schematic of published cells, not discovery coordinates',await evaluate("!document.querySelector('.map-key').hidden&&document.getElementById('map-legend-note').textContent.includes('점 간격')&&document.getElementById('map-symbol-label').textContent.includes('실제 생물 발견 좌표 아님')&&document.getElementById('map-judgment').textContent.includes('매트릭스 유형')"));
  const fold=await evaluate("(()=>{const b=document.getElementById('legend-toggle'),box=b.parentElement,key=document.querySelector('.map-key');const vis=e=>e.getBoundingClientRect().height>0;const r={open:vis(key)&&b.getAttribute('aria-expanded')==='true'};b.click();r.folded=!vis(key)&&vis(b)&&b.getAttribute('aria-expanded')==='false'&&b.getBoundingClientRect().width<=44;b.click();setMapMode('value');const mini=document.getElementById('value-mini'),pop=document.getElementById('value-legend'),info=document.getElementById('value-info');r.valueFolded=!vis(b)&&vis(mini)&&!vis(pop)&&info.getAttribute('aria-expanded')==='false';info.click();r.valueOpen=vis(pop)&&info.getAttribute('aria-expanded')==='true';document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));r.escClosed=!vis(pop)&&document.activeElement===info;info.click();document.getElementById('map').click();r.outsideClosed=!vis(pop);setMapMode('occurrence');r.back=vis(key)&&!vis(mini);return r;})()");
  check('Legend fold: open on load, the button folds the occurrence legend; value mode shows only the corner icon, ⓘ opens the full legend, Esc and an outside click close it',fold.open&&fold.folded&&fold.valueFolded&&fold.valueOpen&&fold.escClosed&&fold.outsideClosed&&fold.back,JSON.stringify(fold));
  await sleep(400);await shot('desktop-live-oyster-cell');await evaluate('map.closePopup();1');await sleep(400);
  t=await pick(494972);
  const hijMap=await liveMap(494972);
  // 4.14 (prereg-4.14 2·3): 톳's lists are another region's and a Rapid LC check, so MCUI is not computed and the row says why
  // 4.17 (prereg-4.17 2·5): the Rapid LC check is a preliminary assessment again; the row shows MCUI 10.0 with no basis words
  check('톳 live: published cells, nutrition/compounds/conservation from the index report',(await shapes())===hijMap.cells&&/영양 기록 수\s*지표 보고서에서 검토 · MFPI 63\.3/.test(t)&&/보고 화합물\s*지표 보고서에서 검토 · MBPI 65(?![.\d])/.test(t)&&/보전평가\s*지표 보고서에서 검토 · MCUI 10\.0 \(LC\)(?! \()/.test(t)&&new RegExp(`지도 표시 기록\\s*[\\d,]+건 · ${hijMap.cells}개 격자`).test(t)&&t.includes('GBIF'),t);
  await detailEl();await shot('desktop-live-hijiki');
  t=await pick(241776);
  check('Sea cucumber live: published 4-degree cells visible',(await shapes())===cucMap.cells&&t.includes('공개 셀')&&t.includes(`${cucMap.cells}개 · 4°×4°`)&&(await evaluate("document.getElementById('map-source').textContent")).includes('공개 4° 셀'),t);
  const plain=await evaluate("document.body.innerText");
  check('Page shows no raw coordinates',!/\d{2,3}\.\d{3,}/.test(plain),plain.match(/\d{2,3}\.\d{3,}/)?.[0]);
  // The shared-link reload above starts the effort shading off again (2026-10-11): turn it on for the mode round-trip below.
  await evaluate("(()=>{const t=document.getElementById('effort-toggle');if(!t.checked)t.click();return 1})()");
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
  // 2026-10-13 (design 2 + request): the value mode opens on the species view: only the selected species' cells, in its type
  // colour with a same-colour dashed border (no yellow); the chip and the numbers under the map are that species' own; the corner
  // icon counts the drawn colour; the key line under the list names the verdict and type; another card's hover outlines its cells.
  const own=await evaluate(`(()=>{const s=periodView(selected),t=matrixType(selected),q=x=>document.querySelector(x),fills=[...new Set(valueRects.map(([,l])=>l.options.fillColor))];
    const card=[...document.querySelectorAll('#species-list .species-card')].find(el=>{const x=data.species.find(y=>y.aphiaID===Number(el.dataset.species));return x&&x.aphiaID!==selected.aphiaID&&x.cells.length}),other=Number(card.dataset.species);
    card.dispatchEvent(new MouseEvent('mouseenter'));
    const hover={n:hoverRects.length,want:[...valueCellGroups(true).values()].filter(g=>g.species.has(other)).length,style:hoverRects.every(l=>l.options.dashArray==='6 4'&&l.options.color==='#ffd166'&&l.options.interactive===false&&l.options.fill===false)};card.dispatchEvent(new MouseEvent('mouseleave'));hover.left=hoverRects.length;
    return {view:valueView,pressed:q('#value-view').getAttribute('aria-pressed'),drawn:valueRects.length,cells:spatialCells(s).length,fills,want:matrixTypeColour[t]||'#b7c0ca',dashes:[...new Set(valueRects.map(([,l])=>l.options.dashArray))],wide:s.cells.some(c=>c.sizeDeg>=4),
      yellow:valueRects.some(([,l])=>l.options.color==='#ffd166'),chip:q('#map-chip').textContent,wantChip:selected.label+' · 공개 셀 '+spatialCells(s).length+'개 · 기록 '+cellRecords(s).toLocaleString()+'건',
      under:[q('#map-cells').textContent,q('#map-count').textContent,q('#map-years').textContent].join('|'),wantUnder:[spatialCells(s).length,cellRecords(s).toLocaleString(),cellYears(s)].join('|'),
      mini:[...document.querySelectorAll('.vm-grid [data-key]')].map(b=>[b.dataset.type,Number(b.querySelector('.vm-n').textContent)]),type:t,
      key:q('#value-key-text').textContent,plain:matrixTypePlain(t),label:t?matrixTypeLabel(t):'',keyShown:q('#value-key').getBoundingClientRect().height>0,toggleShown:q('#legend-toggle').getBoundingClientRect().height>0,
      source:q('#map-source').textContent,judgment:q('#map-judgment').textContent,panel:q('#value-cell-detail').innerText.includes(selected.label),hover}})()`);
  check('Value map opens on the species view: the selected species’ cells only, in its type colour with a dashed border (no yellow), its own chip and numbers; the icon counts the drawn colour; the key line names verdict and type; a card hover outlines that species’ cells',
    own.view==='species'&&own.pressed==='false'&&own.drawn>0&&own.drawn===own.cells&&own.fills.length===1&&own.fills[0]===own.want&&JSON.stringify(own.dashes)===(own.wide?'["9 6"]':'["3 3"]')&&!own.yellow&&own.chip===own.wantChip&&own.under===own.wantUnder&&
    own.mini.every(([t,n])=>n===(t===own.type?own.cells:0))&&own.keyShown&&!own.toggleShown&&own.key.includes(own.plain)&&own.key.includes(own.label)&&own.source.startsWith('활용 × 보전 · 선택 종')&&own.judgment.includes(`공개 셀 ${own.cells}곳`)&&own.panel&&
    own.hover.n===own.hover.want&&own.hover.n>0&&own.hover.style&&own.hover.left===0,JSON.stringify(own));
  const kinds=await evaluate(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),keep=selected.aphiaID,out=[];
    for(const id of [372119,506159,250680]){selectSpecies(id);await wait(250);const s=periodView(selected),t=matrixType(selected);
      out.push({sp:selected.label,type:t||'none',drawn:valueRects.length,cells:spatialCells(s).length,fills:[...new Set(valueRects.map(([,l])=>l.options.fillColor))],want:matrixTypeColour[t]||'#b7c0ca',
        yellow:valueRects.filter(([,l])=>l.options.color==='#ffd166').length,dots:overlay.getLayers().filter(l=>l._schematicDot).length,key:document.getElementById('value-key-text').textContent,chipDot:document.querySelector('#map-chip .mc-dot')?.className||''});}
    const v=document.getElementById('value-view');v.click();await wait(200);v.click();await wait(200);
    const back={view:valueView,pressed:v.getAttribute('aria-pressed'),drawn:valueRects.length,cells:spatialCells(periodView(selected)).length};
    selectSpecies(keep);await wait(250);return {out,back}})()`);
  check('Species view per type: 우뭇가사리 red, 홍합 blue, 멍게 in its type colour (4.19: Rapid LC as a preliminary assessment), each only its own cells, never yellow or red dots; ‘모든 종 겹쳐 보기’ pressed twice comes back to the species view',
    kinds.out.length===3&&kinds.out.every(k=>k.drawn===k.cells&&k.drawn>0&&k.fills.length===1&&k.fills[0]===k.want&&!k.yellow&&!k.dots)&&kinds.out.map(k=>k.type).join()==='conservation_priority,baseline_survey,baseline_survey'&&
    // 4.14 left 멍게 untyped ('유형 미산출 · 보전평가 미확인'); 4.19 places it, and the key reads like any other type, never naming the preliminary assessment
    !/미산출|미확인|예비|Rapid LC/.test(kinds.out[2].key)&&!kinds.out[2].chipDot.includes('none')&&kinds.back.view==='species'&&kinds.back.pressed==='false'&&kinds.back.drawn===kinds.back.cells,JSON.stringify(kinds));
  // 2026-10-15 (LKH: one cell, mostly Jeju's, stood out in 우뭇가사리 and 살오징어): the panel's first cell is not drawn as chosen.
  // With nothing clicked every species' cells share one border and one fill; a clicked cell gets a heavier border of the same
  // colour and keeps the fill; choosing another species drops the mark.
  // one species per call: the 10 s reply limit is too short for all of them in one evaluate
  const toneHelpers="const wait=ms=>new Promise(r=>setTimeout(r,ms)),fillOf=l=>l._sea?l._sea.options.fillOpacity:l.options.fillOpacity,narrow=()=>valueRects.filter(([g])=>g.size<4),"+
    "look=()=>({active:valueRects.filter(([,,a])=>a).length,fills:[...new Set(narrow().map(([,l])=>fillOf(l)))],weights:[...new Set(narrow().map(([,l])=>l.options.weight))]});";
  const toneKeep=await evaluate('selected.aphiaID'),toneOdd=[];
  for(const id of await evaluate('data.species.filter(x=>x.cells.length).map(x=>x.aphiaID)')){
    const v=await evaluate(`(async()=>{${toneHelpers}selectSpecies(${id});await wait(60);return {sp:selected.label,...look()}})()`);
    if(v.active||v.fills.length>1||v.weights.some(w=>w>1.5))toneOdd.push(v);
  }
  const tone=await evaluate(`(async()=>{${toneHelpers}
    selectSpecies(372119);await wait(200);const target=narrow().find(([g])=>valueCellKey(g.lat,g.lon,g.size)!==selectedValueCell)||narrow()[0],key=valueCellKey(target[0].lat,target[0].lon,target[0].size);
    target[1].fire('click');await wait(250);const on=valueRects.filter(([,,a])=>a),rest=narrow().filter(([,,a])=>!a);
    const clicked={n:on.length,key:on[0]?valueCellKey(on[0][0].lat,on[0][0].lon,on[0][0].size):null,want:key,fill:on[0]&&fillOf(on[0][1]),others:[...new Set(rest.map(([,l])=>fillOf(l)))],weight:on[0]?.[1].options.weight,otherWeight:Math.max(...rest.map(([,l])=>l.options.weight))};
    document.getElementById('value-view').click();await wait(200);const allView=look();allView.chosen=valueRects.filter(([,,a])=>a).map(([g])=>valueCellKey(g.lat,g.lon,g.size));document.getElementById('value-view').click();await wait(200);
    selectSpecies(342067);await wait(200);const after=look();selectSpecies(${toneKeep});await wait(250);return {clicked,allView,after}})()`);
  tone.odd=toneOdd;
  check('Value map cells share one tone: with nothing clicked no cell of any species is drawn as chosen (one border, one fill); a clicked cell gets only a heavier border and keeps the fill, in both views; another species drops the mark',
    tone.odd.length===0&&tone.clicked.n===1&&tone.clicked.key===tone.clicked.want&&tone.clicked.others.length===1&&tone.clicked.fill===tone.clicked.others[0]&&tone.clicked.weight>tone.clicked.otherWeight&&
    JSON.stringify(tone.allView.chosen)===JSON.stringify([tone.clicked.want])&&tone.after.active===0&&tone.after.fills.length===1,JSON.stringify(tone));
  const overlay2=await evaluate(`(async()=>{const q=x=>document.querySelector(x);q('#value-view').click();await new Promise(r=>setTimeout(r,300));
    return {view:valueView,pressed:q('#value-view').getAttribute('aria-pressed'),drawn:valueRects.length,groups:valueCellGroups().size,yellow:valueRects.filter(([,l])=>l.options.color==='#ffd166').length,
      mine:[...valueCellGroups().values()].filter(g=>g.species.has(selected.aphiaID)).length,chip:q('#map-chip').textContent,key:q('#value-key-text').textContent,source:q('#map-source').textContent}})()`);
  check('‘모든 종 겹쳐 보기’ (pressed) brings back every species’ cells, the selected species’ cells in yellow; the chip and the key line say so (the checks below run on this view)',
    overlay2.view==='all'&&overlay2.pressed==='true'&&overlay2.drawn===overlay2.groups&&overlay2.yellow===overlay2.mine&&overlay2.mine>0&&overlay2.chip.startsWith(`모든 종 겹쳐 보기 · 공개 격자 ${overlay2.groups}곳`)&&overlay2.key.includes('노란 실선 = 선택 종')&&overlay2.source==='활용 × 보전 · GBIF 공개 격자',JSON.stringify(overlay2));
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
    JSON.stringify(layers.legend)===JSON.stringify(['보전 연구 우선 검토','활용·보전 병행 검토','기초조사 검토','활용 연구 검토'])&&
    layers.judgment.includes('종 유형으로 칠한 공개 격자')&&layers.rule.includes('50 이상이면 높음')&&layers.rule.includes('탐색적 구분선')&&layers.rule.includes('반올림 전 값')&&layers.rule.includes('50% 미만')&&
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
    const cells=[...q('.vm-grid').querySelectorAll('[data-key]')].map(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.key,n:Number((e.querySelector('.vm-n')||e).textContent),bg:e.style.background,tip:e.dataset.tip,x:r.x+r.width/2,y:r.y+r.height/2};});
    return {legend,cells,size:[grid.width,grid.height],cellH:Math.min(...[...q('.vm-grid').querySelectorAll('[data-key]')].map(e=>e.getBoundingClientRect().height)),inBl:q('.map-ui-bl').contains(q('.vm-grid')),beside:plot.left>=q('.species-pane').getBoundingClientRect().right,below:grid.top>=sw.bottom,all:valueRects.length}})()`);
  const typed=icon.cells.filter(c=>c.n>0),mouse=async(type,c,extra={})=>send('Input.dispatchMouseEvent',{type,x:c.x,y:c.y,button:'left',clickCount:1,...extra});
  // dimmed = the faded edge (opacity .2, or .45 × .2 for a 1° cell drawn over its sea part): the square of a masked cell has no fill since 2026-10-14
  const iconState=()=>evaluate("({drawn:valueRects.length,dim:valueRects.filter(([,l])=>(l.options.opacity??1)<.25).length,pressed:[...document.querySelectorAll('.vm-grid [aria-pressed=true]')].map(e=>e.dataset.key),zoom:map.getZoom(),centre:map.getCenter().toString(),tip:getComputedStyle(document.querySelector('#value-mini .vm-grid [data-key]:hover')||document.body,'::after').content})");
  const iconS0=await iconState();
  await mouse('mouseMoved',typed[0]);await sleep(200);const iconHover=await iconState();
  await mouse('mousePressed',typed[0]);await mouse('mouseReleased',typed[0]);await sleep(400);const iconOne=await iconState();
  await mouse('mouseMoved',typed[1]);await mouse('mousePressed',typed[1]);await mouse('mouseReleased',typed[1]);await sleep(400);const iconTwo=await iconState();
  for(const c of typed.slice(0,2)){await mouse('mouseMoved',c);await mouse('mousePressed',c);await mouse('mouseReleased',c);await sleep(300);}
  await mouse('mouseWheel',typed[0],{deltaX:0,deltaY:-600,button:'none'});await sleep(500);const iconAfter=await iconState();
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
  // 2026-10-15 탐색 지도 시안: the 2×2 is the bottom-left key of the free map area (shape + name per type, 44px rows), not the 72px corner icon
  check('Value map icon: the 2×2 key bottom-left beside the species list, rows of 44px or more, the legend’s own counts and colours; hover dims the other types and names the type; clicks filter one or two types and clear; the wheel leaves the map alone',
    JSON.stringify(icon.legend)===JSON.stringify(icon.cells.map(c=>[c.key,c.n+'셀',c.bg]))&&icon.size[0]>=260&&icon.cellH>=44&&icon.inBl&&icon.beside&&icon.below&&typed.length>=2&&
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
  // a 4° cell is drawn 2 px inside its square since 2026-10-14 (land mask): find it by its centre
  const arkPop=await evaluate(`(()=>{const l=overlay.getLayers().filter(l=>!l._schematicDot&&!l._zoomMark).find(l=>{const c=l.getBounds().getCenter();return Math.abs(c.lat-${arkOld.lat0+2})<.1&&Math.abs(c.lng-${arkOld.lon0+2})<.1;});l.openPopup();const t=document.querySelector('.leaflet-popup-content').innerText;map.closePopup();return t})()`);
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
  // ---------- Comparison: every species in one table, a row each (design 05, 2026-10-10), sortable by mouse and keyboard ----------
  const cmpState="(()=>{const c=document.getElementById('comparison'),cr=c.getBoundingClientRect(),rows=[...c.querySelectorAll('tbody tr.cmp-row')];return {label:document.getElementById('comparison-page').textContent,rows:rows.map(r=>Number(r.dataset.aphia)),sort:[...c.querySelectorAll('thead th[aria-sort]')].filter(t=>t.getAttribute('aria-sort')!=='none').map(t=>t.querySelector('[data-sort]').dataset.sort+':'+t.getAttribute('aria-sort')),focus:document.activeElement?.dataset?.sort||'',fits:c.scrollWidth<=c.clientWidth+1,colStuck:Math.abs(c.querySelector('tbody th').getBoundingClientRect().left-cr.left)<2}})()";
  await evaluate("selectSpecies(data.species[0].aphiaID);setView('compare');setCompareMode('table');1");await sleep(200);
  const sc={start:await evaluate(cmpState),ids:await evaluate('data.species.map(s=>s.aphiaID)')};
  sc.byBbvi=await evaluate("data.species.map((s,i)=>[s,i]).sort(([a,i],[b,j])=>{const x=pilotScore(a,'BBVI'),y=pilotScore(b,'BBVI');return x===null||y===null?(x===null)-(y===null)||i-j:y-x||i-j}).map(([s])=>s.aphiaID)");
  await evaluate("document.querySelector('#comparison [data-sort=BBVI]').click();1");await sleep(200);sc.desc=await evaluate(cmpState);
  await evaluate("document.querySelector('#comparison [data-sort=BBVI]').focus();1");await pressEnter();await sleep(200);sc.asc=await evaluate(cmpState);  // keyboard
  await evaluate("document.getElementById('bbvi-weight').dispatchEvent(new Event('input'));1");await sleep(300);sc.redrawn=await evaluate(cmpState);
  await evaluate("document.querySelector('#comparison [data-sort=BBVI]').focus();1");await pressEnter();await sleep(200);sc.reset=await evaluate(cmpState);
  sc.head=await evaluate("(()=>{const c=document.getElementById('comparison');c.scrollTop=600;const d=Math.abs(c.querySelector('thead th').getBoundingClientRect().top-c.getBoundingClientRect().top);const moved=c.scrollTop>0;c.scrollTop=0;return {moved,d:Math.round(d)}})()");
  await evaluate("(()=>{setView('explore');selectSpecies(data.species.at(-1).aphiaID);setView('compare');return 1})()");await sleep(400);
  sc.picked=await evaluate("(()=>{const c=document.getElementById('comparison'),tr=c.querySelector('tr.cmp-row[data-aphia=\"'+data.species.at(-1).aphiaID+'\"]'),r=tr.getBoundingClientRect(),cr=c.getBoundingClientRect();return {inBox:r.top>=cr.top-1&&r.bottom<=cr.bottom+1,flash:tr.classList.contains('flash')}})()");
  await evaluate("selectSpecies(data.species[0].aphiaID);setView('explore');1");
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  check('Comparison table: one row per species, header sorts by mouse and keyboard (aria-sort, focus kept, high ↔ low → default), sort survives a redraw, sticky header and first column, a picked species is scrolled into the box and highlighted',
    total===expPub+expCand&&same(sc.start.rows,sc.ids)&&sc.start.label===`총 ${total}종 · 정렬: 기본 순서(운영 발행 → 조사 후보)`&&same(sc.start.sort,[])&&sc.start.colStuck&&
    same(sc.desc.rows,sc.byBbvi)&&same(sc.desc.sort,['BBVI:descending'])&&sc.desc.focus==='BBVI'&&sc.desc.label.endsWith('BBVI 높은 순 (탐색적 · 검증된 우열 아님)')&&
    same(sc.asc.sort,['BBVI:ascending'])&&sc.asc.label.endsWith('BBVI 낮은 순 (탐색적 · 검증된 우열 아님)')&&sc.asc.focus==='BBVI'&&same(sc.redrawn.rows,sc.asc.rows)&&
    same(sc.reset.rows,sc.ids)&&same(sc.reset.sort,[])&&sc.head.moved&&sc.head.d<2&&sc.picked.inBox&&sc.picked.flash,
    JSON.stringify({...sc,ids:sc.ids.length,byBbvi:sc.byBbvi.slice(0,3),start:{...sc.start,rows:sc.start.rows.length},desc:{...sc.desc,rows:sc.desc.rows.slice(0,3)},asc:{...sc.asc,rows:sc.asc.rows.slice(0,3)},redrawn:{...sc.redrawn,rows:sc.redrawn.rows.slice(0,3)},reset:{...sc.reset,rows:sc.reset.rows.length}}));
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
    const cmpScroll=await evaluate("(()=>{setView('compare');setCompareMode('table');const c=document.getElementById('comparison'),s=getComputedStyle(c);const r={own:c.scrollWidth>c.clientWidth?s.overflowX:'fits',pageX:getComputedStyle(document.body).overflowX+'/'+getComputedStyle(document.documentElement).overflowX};setView('explore');return r})()");
    check(`Page width ${w}px: explore/compare/method never wider than the viewport; table scrolls in its own box (no overflow-x:hidden on page)`,widths.every(x=>!x.endsWith('OVER'))&&['fits','auto','scroll'].includes(cmpScroll.own)&&!cmpScroll.pageX.includes('hidden'),widths.join(' | ')+' '+JSON.stringify(cmpScroll));
    if(w===1560){await evaluate("setView('compare');setCompareMode('table');window.scrollTo(0,0);1");await shot('desktop-1560-compare',false);await evaluate("setView('explore');1");}
    // 2026-10-13 design 2: one header chip that fits; the map chip in one line clear of the map controls and panels (hidden on phones)
    const d2=await evaluate(`(()=>{const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect(),ov=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom,h=q('.header'),chip=q('#map-chip'),c=r(chip),shown=getComputedStyle(chip).display!=='none';
      const boxes=['.map-ui-tl','.basemap-switch','#copy-link','#reset-map','.map-ui-bl','#detail','.species-pane'].filter(s=>{const e=q(s);return e&&r(e).height>0&&getComputedStyle(e).display!=='none'});
      return {header:h.scrollWidth<=h.clientWidth,chip:shown,hits:shown?boxes.filter(s=>ov(c,r(q(s)))):[],cut:chip.scrollWidth>chip.clientWidth}})()`);
    check(`Design 2 ${w}px: the header fits; the map chip ${mobile?'is hidden (the sheet head shows the species)':'shows in one line, clear of the map controls and panels'}`,d2.header&&(mobile?!d2.chip:d2.chip&&!d2.hits.length&&!d2.cut),JSON.stringify(d2));
    // 2026-10-13: the y-axis name '보전 필요성 MCUI' read as '필요성50' on a phone (PR #175). The final design (2026-10-15) puts
    // '활용가치 BBVI →' on one line under the x ticks and '보전 시급성 MCUI ↑' left of the y ticks; the guard is the same: each
    // name clear of every tick number (≥8px), the plot and the 가상 예시 flag, inside the page
    const yl=await evaluate(`(()=>{setView('compare');setCompareMode('matrix');toggleSimulation(true);const b=e=>e.getBoundingClientRect(),cap=document.querySelector('#compare .matrix .axis-x'),yc=document.querySelector('#compare .matrix .axis-y'),l=b(cap),y=b(yc),yr=(()=>{const w=document.createTreeWalker(yc,NodeFilter.SHOW_TEXT),out=[];for(let n;(n=w.nextNode());){const g=document.createRange();g.selectNodeContents(n);out.push(...[...g.getClientRects()].filter(x=>x.width>0));}return out;})(),p=b(document.getElementById('matrix')),f=b(document.querySelector('#compare .cmp-sim-flag'));
      const gap=(t,l)=>Math.max(t.left-l.right,l.left-t.right,t.top-l.bottom,l.top-t.bottom);const ticks=[...document.querySelectorAll('#compare .matrix-ticks i,#compare .matrix-ticks b')].map(b);
      const vis=t=>[...t.childNodes].filter(n=>!(n.classList&&n.classList.contains('sr-only'))).map(n=>n.textContent).join('').replace(/\\s+/g,' ').trim();
      const r={text:vis(cap),y:yc.textContent.replace(/\\s+/g,' ').trim(),oneLine:l.height<26,minGap:Math.round(Math.min(...ticks.map(t=>gap(t,l)))),yGap:Math.round(Math.min(...ticks.flatMap(t=>yr.map(x=>gap(t,x))))),belowPlot:Math.round(l.top-p.bottom),yLeft:Math.round(Math.max(p.left-y.right,p.top-y.bottom)),flagGap:Math.round(Math.min(gap(f,l),gap(f,y))),inside:l.left>=0&&l.right<=document.documentElement.clientWidth&&y.left>=0};toggleSimulation(false);setView('explore');return r})()`);
    check(`Matrix ${w}px: '활용가치 BBVI →' on one line under the plot and '보전 시급성 MCUI ↑' left of it (above it on phones), each ≥8px from every tick number, the plot and the 가상 예시 flag`,yl.text==='활용가치 BBVI →'&&/^보전\s?시급성\s?MCUI ↑$/.test(yl.y)&&yl.oneLine&&yl.minGap>=8&&yl.yGap>=8&&yl.belowPlot>=8&&yl.yLeft>=8&&yl.flagGap>=8&&yl.inside,JSON.stringify(yl));
    // 2026-10-13 design 3: every quadrant shows its plain verdict and its formal type name; crowded points sit in 'N종 밀집 · 펼치기'
    // boxes and no visible label, button or box covers another; a button opens its list and a row picks that species, which then
    // leaves the box with its label; with nothing chosen the basket is one line in the page, not a bar under 멍이
    if(w===390||w===1560){
      const d3=await evaluate(`(()=>{const r={},b=e=>e.getBoundingClientRect(),vis=e=>{if(!e||e.closest('[hidden]'))return false;const c=b(e);return c.width>0&&c.height>0&&getComputedStyle(e).visibility!=='hidden';};
        const over=(a,c)=>a.left<c.right-.5&&a.right>c.left+.5&&a.top<c.bottom-.5&&a.bottom>c.top+.5;
        setView('compare');setCompareFilter({q:'',group:'all'});setCompareMode('matrix');cmpBasket=[];renderCompare();
        r.names=[...document.querySelectorAll('#matrix .quadrant')].map(q=>{const s=q.querySelector('strong'),f=q.querySelector('span');return vis(s)&&vis(f)&&!!s.textContent.trim()&&!!f.textContent.trim()&&s.textContent!==f.textContent?1:0;}).join('');
        const layout=()=>{const labels=[...document.querySelectorAll('#matrix-points .matrix-point.pilot:not([data-clustered]) .point-label:not(.hidden-label)')].filter(vis).map(b),
            pills=[...document.querySelectorAll('#matrix-points .matrix-cluster-btn')].map(b),boxes=[...document.querySelectorAll('#matrix-points .matrix-cluster')].map(b);let n=0;
          labels.forEach((l,i)=>{for(const o of [...labels.slice(i+1),...pills,...boxes])if(over(l,o))n++;});pills.forEach((p,i)=>{for(const o of [...pills.slice(i+1),...boxes])if(over(p,o))n++;});
          return {boxes:boxes.length,pills:pills.length,labels:labels.length,overlaps:n};};
        selectSpecies(836033);declutterPointLabels();r.oyster=layout();
        selectSpecies(342067);declutterPointLabels();r.rockfish=layout();
        selectSpecies(836033);declutterPointLabels();
        const pill=document.querySelector('#matrix-points .matrix-cluster-btn'),n=pill?pill.dataset.cluster.split(',').length:0;pill?.click();
        const pop=document.getElementById('matrix-cluster-pop'),rows=[...pop.querySelectorAll('button[data-aphia]')];
        r.list=!!pill&&!pop.hidden&&rows.length===n&&pill.getAttribute('aria-expanded')==='true'&&pill.textContent.includes('접기')&&document.activeElement===rows[0]&&vis(pop);
        const id=rows[1]?.dataset.aphia;rows[1]?.click();declutterPointLabels();const pt=document.querySelector('#matrix-points [data-aphia="'+id+'"]');
        r.pick=!!id&&pop.hidden&&String(selected.aphiaID)===id&&document.getElementById('cmp-profile-name').textContent===cmpById(id).label&&pt?.getAttribute('aria-current')==='true'&&!pt.hasAttribute('data-clustered')&&vis(pt.querySelector('.point-label'));
        selectSpecies(836033);
        const tray=document.getElementById('cmp-tray'),fab=document.querySelector('.bbc-fab');tray.scrollIntoView({block:'center'});
        r.tray={empty:tray.classList.contains('empty'),position:getComputedStyle(tray).position,lineHeight:Math.round(b(tray).height),slots:tray.querySelectorAll('.ct-slot [data-basket-add]').length,clearOfFab:!!fab&&!over(b(tray),b(fab))};
        window.scrollTo(0,0);setView('explore');return r})()`);
      // 4.17: 29 points again (preliminary assessments); 4.14 had 16, none of them crowding into an
      // 'N종 밀집' box, so the box list and pick are checked only when a box is drawn (test_compare_ui.mjs keeps the grouping rule)
      const okLayout=x=>x.pills===x.boxes&&x.overlaps===0&&x.labels>0;
      check(`Compare ${w}px (design 3): plain and formal names in all 4 quadrants, no overlapping label/button/'N종 밀집' box (참굴, 살오징어 picked), a box button (when drawn) opens its list and a row picks that species, empty basket is one row of 3 free slots in the page clear of 멍이`,
        d3.names==='1111'&&okLayout(d3.oyster)&&okLayout(d3.rockfish)&&(d3.oyster.boxes===0||d3.list&&d3.pick)&&d3.tray.empty&&d3.tray.position==='static'&&d3.tray.clearOfFab&&d3.tray.slots===3&&(w<741||d3.tray.lineHeight<90),JSON.stringify(d3));
    }
  }

  // ---------- The eight demo flows, desktop and mobile (screenshots in OUT) ----------
  for(const [tag,w,h,mobile] of [['desktop',1560,900,false],['mobile',390,844,true]]){
    await viewport(w,h,mobile);await load();
    const mapShot=async name=>{await evaluate(`document.getElementById('map').scrollIntoView({block:'${mobile?'start':'center'}'});1`);await sleep(600);await shot(`${tag}-flow-${name}`,false);};
    // design 07: on a phone #map-selected is hidden (the sheet head shows the selection), so read its text, not its rendering
    const flow=async aphia=>{await pick(aphia);await sleep(300);return evaluate("({sel:document.getElementById('map-selected').textContent,src:document.getElementById('map-source').textContent,note:document.getElementById('map-review-note').textContent,shapes:document.querySelectorAll('#map path.leaflet-interactive').length,detail:document.getElementById('detail').innerText})");};
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
    check(`Flow 5 ${tag}: comparison shows all ${total} species in one table, page never overflows`,walk.length===1&&walk[0].rows===total&&walk[0].page,JSON.stringify(walk.map(p=>[p.label,p.rows,p.page])));
    await evaluate("setView('compare');setCompareMode('table');window.scrollTo(0,0);1");await shot(`${tag}-flow-5-compare`,false);await evaluate("setView('explore');1");
    await pick(836033);await evaluate("document.getElementById('map').scrollIntoView({block:'center'});1");await sleep(300);
    const before=await evaluate("({y:Math.round(scrollY),sel:selected.aphiaID})");
    await evaluate("document.querySelector('[data-map-mode=value]').click();1");await sleep(400);await shot(`${tag}-flow-6-value-mode`,false); // no scrollIntoView here: the check measures scroll drift
    await evaluate("document.querySelector('[data-map-mode=occurrence]').click();1");await sleep(400);
    const after=await evaluate("({y:Math.round(scrollY),sel:selected.aphiaID,mode:mapMode})");
    check(`Flow 6 ${tag}: map mode value → occurrence keeps selection and scroll position`,after.sel===before.sel&&after.mode==='occurrence'&&Math.abs(after.y-before.y)<=4,JSON.stringify({before,after}));
    // Every species × {occurrence, MFPI, MBPI, MCUI, BBVI} opens its own evidence and returns to the same horizontal scroll and button.
    // One CDP call per species keeps each call under the 10 s response limit; the assertions are unchanged.
    const opens={n:await evaluate('data.species.length'),bad:[]};
    for(let i=0;i<opens.n;i++)opens.bad.push(...await evaluate(`(()=>{const bad=[],i=${i},s=data.species[i];setView('compare');setCompareMode('table');
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
    const late=await evaluate("(()=>{const i=data.species.length-1;renderComparison();setView('compare');setCompareMode('table');document.querySelector('[data-score-aphia=\"'+data.species[i].aphiaID+'\"][data-score-axis=MBPI]').click();return 1})()");
    // The smooth scroll can outlast a fixed pause on a busy machine (a tab change now starts at the top): wait up to 3 s.
    let seen;for(let t=0;t<15;t++){await sleep(200);seen=await evaluate("(()=>{const r=document.activeElement.getBoundingClientRect();return {top:Math.round(r.top),h:innerHeight,axis:document.activeElement.closest('[data-axis]')?.dataset.axis}})()");if(seen.top>=0&&seen.top<seen.h)break;}
    check(`Evidence ${tag}: last-column MBPI evidence scrolled into view`,late===1&&seen.axis==='MBPI'&&seen.top>=0&&seen.top<seen.h,JSON.stringify(seen));
    const occ=await evaluate("(()=>{const s=data.species.find(x=>x.cells?.length);renderComparison();setView('compare');setCompareMode('table');document.querySelector('[data-score-aphia=\"'+s.aphiaID+'\"][data-score-axis=OCC]').click();const sum=document.getElementById('detail-map-summary').innerText,csv=cellCsv(s);return {shapes:document.querySelectorAll('#map path.leaflet-interactive').length,rows:document.querySelectorAll('#cell-table tbody tr').length,period:/기록 연도/.test(sum),source:/출처/.test(sum),sea:/해역/.test(sum),license:/이용조건/.test(sum),csv:csv.includes('sea_areas')&&csv.includes('licenses')}})()");
    check(`Evidence ${tag}: occurrence button draws the cells and lists period, sea area, source, licence and CSV columns`,occ.shapes>0&&occ.rows>0&&occ.period&&occ.source&&occ.sea&&occ.license&&occ.csv,JSON.stringify(occ));
    await evaluate("setView('explore');1");
  }

  // ---------- Mobile 390px first screen and stability ----------
  await viewport(390,844,true);
  await load();
  // Before this change the map started at 952px (0px visible in the 844px first screen).
  const mob=await evaluate("(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();const m=r('map');const c=document.querySelector('.species-card').getBoundingClientRect();return {top:Math.round(m.top+scrollY),visible:Math.round(Math.min(m.bottom,844)-Math.max(m.top,0)),search:r('search').bottom<=844,card:c.height>0,chips:(u=>u.height>0&&u.top+40<=844)(document.getElementById('use-chips').getBoundingClientRect()),sel:document.getElementById('sheet-summary').innerText,sheet:(h=>({top:Math.round(h.getBoundingClientRect().top),exp:document.getElementById('sheet-handle').getAttribute('aria-expanded')}))(document.getElementById('sheet-head')),tabs:[...document.querySelectorAll('.tabs button')].map(b=>b.textContent+'/'+getComputedStyle(b,'::before').content).join(),warn:(r('score-disclaimer').height>0||r('notice-chip').height>0&&document.getElementById('notice-chip').textContent.includes('연구 프로토타입'))&&document.getElementById('score-disclaimer').textContent.includes('정식 산출')&&document.getElementById('score-disclaimer').textContent.includes('검증: MFPI 통과 · MBPI 기준 미충족'),legend:document.querySelector('.map-legend-more').open}})()");
  // design 07 (2026-10-10): the map stays on top and the species pane is a bottom sheet; its head (handle + summary) sits right under the map
  check('Mobile 390×844 first screen: map ≥200px, then the sheet with the selected summary, search, 활용 특성 chips (species cards just below); warning kept; legend folded; short tab names by CSS only',mob.visible>=200&&mob.search&&mob.card&&mob.chips&&/운영 발행|조사 후보/.test(mob.sel)&&/MFPI[\s\S]*MCUI/.test(mob.sel)&&mob.sheet.exp==='false'&&mob.sheet.top<844-150&&mob.warn&&!mob.legend&&mob.tabs==='탐색 지도/"지도",비교와 지표/"비교",근거와 방법/"방법"',JSON.stringify(mob));
  const sheet=await evaluate(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const b=document.getElementById('sheet-handle'),stage=document.querySelector('.map-stage');b.click();await wait(900);
    const open={exp:b.getAttribute('aria-expanded'),top:Math.round(document.getElementById('sheet-head').getBoundingClientRect().top),stage:getComputedStyle(stage).position};b.click();await wait(900);
    return {open,closed:{exp:b.getAttribute('aria-expanded'),y:Math.round(scrollY)},doc:document.documentElement.scrollWidth,vw:innerWidth}})()`);
  check('Mobile sheet: the handle button opens the sheet over the pinned map and closes it again (aria-expanded follows), no horizontal overflow',sheet.open.exp==='true'&&Math.abs(sheet.open.top)<=2&&sheet.open.stage==='sticky'&&sheet.closed.exp==='false'&&sheet.closed.y===0&&sheet.doc<=sheet.vw,JSON.stringify(sheet));
  // BBVI 통합 가중치 on a phone: the panel and the matrix badge fit 390px, no sideways scroll
  const wm=await evaluate(`(async()=>{const wait=ms=>new Promise(f=>setTimeout(f,ms)),q=s=>document.querySelector(s);setView('compare');setCompareMode('matrix');q('#cmp-basis-toggle').click();
    setBbviStep(16);await wait(300);const pop=q('#cmp-basis-pop').getBoundingClientRect(),badge=q('#cmp-wline').getBoundingClientRect(),pre=[...document.querySelectorAll('[data-w-preset]')].map(b=>b.getBoundingClientRect());
    const r={pop:[Math.round(pop.left),Math.round(pop.right)],badge:[Math.round(badge.left),Math.round(badge.right),Math.round(badge.height)],presets:pre.every(b=>b.left>=pop.left-1&&b.right<=pop.right+1),doc:document.documentElement.scrollWidth,vw:innerWidth};
    setBbviStep(10);setBasisPop(false);await wait(200);setView('explore');return r})()`);
  check('BBVI weight panel at 390px: popover, presets and the weight status line stay inside the screen, no horizontal overflow',wm.pop[0]>=0&&wm.pop[1]<=wm.vw&&wm.badge[0]>=0&&wm.badge[1]<=wm.vw&&wm.badge[2]>0&&wm.presets&&wm.doc<=wm.vw,JSON.stringify(wm));
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

  // ---------- 멍이 버튼 옮기기 (chatbot.js): drag vs click, remembered and clamped, reset, phone touch ----------
  // Real mouse and touch input through DevTools; positions come from the page, not typed in. Clears bbChatFabPos at the end.
  {
    const fabState=()=>evaluate(`(()=>{const d=document.documentElement,f=document.querySelector('.bbc-fab'),p=document.querySelector('.bbc-panel'),r=f.getBoundingClientRect(),q=p.getBoundingClientRect(),
      z=document.querySelector('#explore.active .leaflet-control-zoom'),a=document.activeElement,c=typeof map!=='undefined'?map.getCenter():null;
      return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),right:Math.round(d.clientWidth-r.right),bottom:Math.round(d.clientHeight-r.bottom),vw:d.clientWidth,vh:d.clientHeight,
        open:!p.hidden,expanded:f.getAttribute('aria-expanded'),panel:p.hidden?null:{l:Math.round(q.left),t:Math.round(q.top),r:Math.round(q.right),b:Math.round(q.bottom)},
        moved:document.querySelector('.bbc').classList.contains('bbc-moved'),stored:localStorage.getItem('bbChatFabPos'),reset:!document.querySelector('.bbc-reset').hidden,
        zoomLeft:z&&z.getClientRects().length&&innerWidth>=768?Math.round(z.getBoundingClientRect().left):null,focus:a?.className||a?.tagName||'',doc:d.scrollWidth,scrollY:Math.round(scrollY),
        mapView:c?c.lat.toFixed(5)+','+c.lng.toFixed(5)+','+map.getZoom():''}})()`);
    const mid=s=>({x:s.x+s.w/2,y:s.y+s.w/2});
    const mouseDrag=async(from,to,steps=8)=>{
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x,y:from.y});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x:from.x,y:from.y,button:'left',buttons:1,clickCount:1});
      for(let i=1;i<=steps;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps,button:'left',buttons:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',buttons:0,clickCount:1});await sleep(300);};
    const touchDrag=async(from,to,steps=8)=>{
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
      for(let i=1;i<=steps;i++)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(400);};
    const key=async(k,code,vk)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,...(type==='keyDown'&&k==='Enter'?{text:'\r'}:{})});await sleep(200);};
    const boxesApart=(p,f)=>p.r<=f.x||p.l>=f.x+f.w||p.b<=f.y||p.t>=f.y+f.w;
    // 2026-10-11: pressing 멍이 first plays a short hop and opens the chat about 0.6 s later (at once with reduced motion), so wait for it.
    const openedState=async()=>{let s;for(let i=0;i<15;i++){s=await fabState();if(s.open)break;await sleep(100);}return s;};
    await viewport(1560,900,false);
    await evaluate("localStorage.removeItem('bbChatFabPos');document.querySelector('[data-view=\"explore\"]').click();window.scrollTo(0,0);1");await sleep(400);
    let m=await fabState();
    const defaultRight=m.zoomLeft===null?16:Math.max(16,m.vw-m.zoomLeft+12);
    let ok=!m.moved&&m.stored===null&&!m.reset&&m.bottom===16&&Math.abs(m.right-defaultRight)<=1;
    await evaluate("document.querySelector('.bbc-fab').focus();1");await key('Enter','Enter',13);
    const kOpen=await openedState();await key('Escape','Escape',27);const kClose=await fabState();
    check('M-1 멍이 default place unchanged (bottom 16px, left of the zoom control on the map tab); keyboard Enter opens, Esc closes and returns focus',
      ok&&kOpen.open&&kOpen.focus==='bbc-input'&&!kClose.open&&kClose.focus==='bbc-fab',JSON.stringify({m,defaultRight,kOpen:[kOpen.open,kOpen.focus],kClose:[kClose.open,kClose.focus]}));
    const before=m;
    await mouseDrag(mid(m),{x:60,y:150});
    await sleep(700);  // a wrongly kept click would open the chat only after the hop
    m=await fabState();
    check('M-2 mouse drag moves 멍이 to the drop point without opening the chat or moving the map',
      m.moved&&!m.open&&m.expanded==='false'&&m.x===36&&m.y===126&&!!m.stored&&m.mapView===before.mapView,JSON.stringify({m,mapBefore:before.mapView}));
    await mouseDrag(mid(m),{x:mid(m).x+3,y:mid(m).y},1);
    m=await openedState();
    check('M-3 a press that moves under the threshold still opens the chat, beside 멍이, on screen and not covering it',
      m.open&&m.expanded==='true'&&m.x===36&&m.panel.l>=8&&m.panel.t>=8&&m.panel.r<=m.vw-8&&m.panel.b<=m.vh-8&&boxesApart(m.panel,m)&&m.panel.l===m.x&&m.panel.t>=m.y+m.w&&m.reset,JSON.stringify(m));
    await sleep(300);await shot('mascot-moved-open',false);
    await evaluate("document.querySelector('.bbc-close').click();1");
    await mouseDrag(mid(await fabState()),{x:724,y:404});
    const dropped=await fabState();
    await evaluate("location.reload();1");await sleep(400);
    for(let i=0;i<80&&!/연결됨|불러오기 실패|연결 실패/.test(await evaluate("document.getElementById('connection-state')?.textContent||''"));i++)await sleep(250);
    const reloaded=await fabState();
    await viewport(800,400,false);await sleep(400);const small=await fabState();
    await viewport(1560,900,false);await sleep(400);const big=await fabState();
    check('M-4 the drop point survives a reload; a small window pulls 멍이 inside, a big one puts it back, the saved value unchanged',
      dropped.moved&&reloaded.x===dropped.x&&reloaded.y===dropped.y&&small.x===dropped.x&&small.y===small.vh-small.w-8&&small.y<dropped.y&&big.x===dropped.x&&big.y===dropped.y&&big.stored===dropped.stored,
      JSON.stringify({dropped:[dropped.x,dropped.y],reloaded:[reloaded.x,reloaded.y],small:[small.x,small.y,small.vw,small.vh],big:[big.x,big.y],stored:[dropped.stored,big.stored]}));
    await mouseDrag(mid(big),{x:mid(big).x,y:mid(big).y});await openedState();
    await evaluate("document.querySelector('.bbc-reset').click();1");await sleep(300);
    m=await fabState();
    check('M-5 "멍이 원래 자리로" returns to the default place, clears the saved value, hides itself and keeps the chat open',
      !m.moved&&m.stored===null&&!m.reset&&m.open&&m.bottom===16&&Math.abs(m.right-defaultRight)<=1&&m.focus==='bbc-input',JSON.stringify(m));
    await evaluate("document.querySelector('.bbc-close').click();1");
    await viewport(390,844,true);await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await sleep(500);
    await evaluate("window.scrollTo(0,400);1");await sleep(300);
    m=await fabState();
    await touchDrag(mid(m),{x:50,y:300});
    // Chrome makes no tap from a touch that starts within about a second of the previous touch gesture, so wait like a person would.
    await sleep(1500);
    const t=await fabState();
    await touchDrag(mid(t),mid(t),1);
    const tap=await openedState();
    await shot('mascot-mobile-sheet',false);
    check('M-6 phone 390px: a finger drag moves 멍이 without scrolling the page, a tap opens the bottom sheet, no horizontal overflow',
      !m.moved&&m.right===16&&t.moved&&!t.open&&t.x===26&&t.y===276&&t.scrollY===m.scrollY&&JSON.parse(t.stored).mobile&&JSON.parse(t.stored).desktop===undefined&&
      tap.open&&tap.panel.l===0&&tap.panel.r===tap.vw&&Math.abs(tap.panel.b-tap.vh)<=1&&tap.doc<=tap.vw,JSON.stringify({m,t,tap}));
    await evaluate("document.querySelector('.bbc-close').click();localStorage.removeItem('bbChatFabPos');window.scrollTo(0,0);1");
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});

    // ---------- 멍이 움직임 (2026-10-11): 깡충 인사 뒤 열기, 말하기 → 웃으며 깡충 → 원래 그림, 움직이는 말풍선 멍이는 하나, 움직임 줄이기 ----------
    // Classes and computed animation names are read from the page; the chat log is emptied so the welcome message comes again.
    await viewport(1560,900,false);
    const freshChat="document.querySelector('.bbc-log').replaceChildren();document.querySelector('[data-view=\"explore\"]').click();window.scrollTo(0,0);1";
    const press=async()=>{const c=mid(await fabState());
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:c.x,y:c.y});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x:c.x,y:c.y,button:'left',buttons:1,clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:c.x,y:c.y,button:'left',buttons:0,clickCount:1});};
    const motion=`(()=>{const q=s=>document.querySelector(s),an=s=>q(s)?getComputedStyle(q(s)).animationName:null,cl=s=>q(s)?.getAttribute('class')||'';
      return {open:!q('.bbc-panel').hidden,fab:cl('.bbc-fab .bbc-mascot'),head:cl('.bbc-avatar .bbc-mascot'),row:cl('.bbc-row.bbc-live .bbc-mascot'),live:document.querySelectorAll('.bbc-row.bbc-live').length,
        rows:document.querySelectorAll('.bbc-row').length,talking:document.querySelectorAll('.bbc-m-talk').length,headAll:an('.bbc-avatar .bbc-m-all'),headMouth:an('.bbc-avatar .bbc-m-mouth'),headOpenMouth:/Q60 90\\.5/.test(q('.bbc-avatar .bbc-m-mouth')?.innerHTML||''),
        fabAll:an('.bbc-fab .bbc-m-all'),fabEyes:an('.bbc-fab .bbc-m-eyes'),rowSL:q('.bbc-row.bbc-live .bbc-m-sL')?getComputedStyle(q('.bbc-row.bbc-live .bbc-m-sL')).transform:null}})()`;
    const until=async(test,ms)=>{let s;for(let t=0;t<=ms;t+=100){s=await evaluate(motion);if(test(s))break;await sleep(100);}return s;};
    // The motion follows the OS setting, and Chrome on the Windows CI runner reports reduced motion (animations off there),
    // so M-7 and M-8 ask for motion themselves and M-9 for reduced motion; the browser's own value comes back after M-9.
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await evaluate(freshChat);await sleep(300);
    const idle=await evaluate(motion);
    await press();
    const hop=await evaluate(motion);
    const greet=await until(s=>s.open,1500);
    check('M-7 멍이 breathes and blinks in the button; a press plays the hop first and opens the chat after it, where the welcome is spoken (header and its bubble)',
      idle.fabAll==='bbc-breathe'&&idle.fabEyes==='bbc-blink'&&/bbc-m-hop/.test(hop.fab)&&!hop.open&&greet.open&&/bbc-m-welcome/.test(greet.head)&&/bbc-m-talk/.test(greet.head)&&
      greet.headMouth==='bbc-talk'&&/bbc-m-talk/.test(greet.row)&&greet.live===1,JSON.stringify({idle,hop,greet}));
    await evaluate("document.querySelector('.bbc-log .bbc-chips button').click();1");
    const said=await evaluate(motion);
    const done=await until(s=>/bbc-m-hop/.test(s.head),3000);
    const back=await until(s=>!/bbc-m-(hop|talk)/.test(s.head)&&!s.headOpenMouth&&s.talking===0,2000);
    check('M-8 an FAQ answer: header and the newest bubble talk (only that bubble moves, the welcome one stops), then hop smiling, then the plain answer face breathing again',
      /bbc-m-answer/.test(said.head)&&/bbc-m-talk/.test(said.head)&&/bbc-m-talk/.test(said.row)&&said.live===1&&said.talking===2&&said.rows===2&&
      /bbc-m-hop/.test(done.head)&&!/bbc-m-talk/.test(done.head)&&done.headOpenMouth&&/bbc-m-answer/.test(back.head)&&!back.headOpenMouth&&back.headAll==='bbc-breathe'&&back.live===1,JSON.stringify({said,done,back}));
    await shot('mascot-motion-answer',false);
    // Reduced motion: no hop or talking, the chat opens at once, and only the state pictures change (the drooped siphons of 'unknown' stay).
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate("document.querySelector('.bbc-close').click();"+freshChat);await sleep(300);
    await press();
    const calm=await evaluate(motion);
    await evaluate("(()=>{const i=document.querySelector('.bbc-input');i.value='zqxj 멍이 시험 질문';document.querySelector('.bbc-form').requestSubmit();})();1");
    const puzzled=await until(s=>/bbc-m-unknown/.test(s.row),3000);
    check('M-9 reduced motion: a press opens the chat at once with no hop or talking and no running animation; an unknown answer still shows the drooped siphons',
      calm.open&&calm.talking===0&&/bbc-m-welcome/.test(calm.head)&&calm.headAll==='none'&&/bbc-m-unknown/.test(puzzled.head)&&puzzled.rowSL&&puzzled.rowSL!=='none'&&puzzled.talking===0,JSON.stringify({calm,puzzled}));
    // ---------- 사용법 안내 도우미 (2026-10-15): 정해진 답만, 심사 예상 질문의 값은 화면 자료에서, 답이 없으면 세 탭 바로가기 ----------
    const askBot=q=>evaluate(`(async()=>{const i=document.querySelector('.bbc-input');i.value=${JSON.stringify(q)};document.querySelector('.bbc-form').requestSubmit();
      await new Promise(r=>setTimeout(r,200));const m=[...document.querySelectorAll('.bbc-log .bbc-bot')].at(-1);return {text:m?.childNodes[0]?.textContent||'',
        tabs:[...(m?.closest('.bbc-row')?.nextElementSibling?.querySelectorAll('button[data-tab]')||[])].map(b=>b.dataset.tab+'|'+b.textContent)};})()`);
    const facts=await evaluate(`(()=>{const f=n=>data.species.find(s=>s.label===n),v=(n,k)=>scoreText(f(n),k,pilotScore(f(n),k));
      return {oyster:v('참굴','MCUI'),mackerel:v('고등어','MCUI'),squid:v('살오징어','MCUI'),n:data.species.length,placed:data.species.filter(assessedForMatrix).length,
        rule:matrixRule().bbvi_threshold,head:document.querySelector('#bbc-title').textContent,note:document.querySelector('.bbc-note').textContent}})()`);
    const judge={same:await askBot('참굴 10점과 고등어 10점은 같은 뜻이에요?'),squid:await askBot('살오징어는 IUCN에서 LC인데 왜 60점이에요?'),
      line:await askBot('50점은 누가 정했어요?'),missing:await askBot('미역은 왜 매트릭스에 없어요?'),none:await askBot('zqxj 오늘 점심 메뉴 추천')};
    const apiCalls=await evaluate("performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/')).length");
    check('M-10 guide helper: fixed answers only (no /api/ request), judge questions read values from the page data, an unmatched question shows 준비된 답이 없어요 with three tab links',
      facts.head==='사용법 안내 도우미'&&facts.note==='AI 아님 · 정해진 답변'&&apiCalls===0&&Object.values(judge).every(r=>!/[{}]/.test(r.text))&&
      judge.same.text.includes(`참굴 MCUI(${facts.oyster}점)`)&&judge.same.text.includes(`고등어 MCUI(${facts.mackerel}점)`)&&judge.squid.text.includes(`${facts.squid}점이 됐어요`)&&
      judge.line.text.includes(`각각 ${facts.rule} 이상`)&&judge.missing.text.includes(`${facts.n}종`)&&(facts.placed===facts.n?judge.missing.text.includes('모두'):judge.missing.text.includes(`${facts.placed}종이 놓여`))&&
      judge.none.text.startsWith('준비된 답이 없어요')&&judge.none.tabs.map(t=>t.split('|')[0]).join()==='explore,compare,method',JSON.stringify({facts,judge,apiCalls}));
    await evaluate("[...document.querySelectorAll('.bbc-log button[data-tab=\"compare\"]')].at(-1).click();1");await sleep(400);
    check('M-11 guide helper: a tab link opens that tab',await evaluate("document.getElementById('compare')?.classList.contains('active')||document.querySelector('.tabs button[data-view=\"compare\"]').getAttribute('aria-current')==='page'"),'');
    await send('Emulation.setEmulatedMedia',{features:[]});
    await evaluate("document.querySelector('.bbc-close').click();"+freshChat);
  }
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
    if(name==='api-error')check('API failure and no snapshot: "자료를 불러오지 못했어요 · ↻ 다시 시도" with the cause, no stale data, and the retry button reloads',state.state==='불러오기 실패'&&state.error.startsWith('자료를 불러오지 못했어요 · ↻ 다시 시도')&&state.error.includes('불러오지 못했습니다')&&state.detail===''&&await evaluate("document.querySelectorAll('.data-retry').length>=2"),brief);
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
  check('G-6 failed load: entry screen still opens, says so, and Enter still enters',gs.ready&&gs.note==='자료를 불러오지 못했어요. 들어가서 ↻ 다시 시도를 눌러 주세요.'&&gs.counts==='',JSON.stringify(gs));
  await pressEnter();await sleep(1100);gs=await gateState();
  check('G-6 failed load: after Enter the map page shows its own error',!gs.on&&await evaluate("!document.getElementById('error').hidden"),JSON.stringify(gs));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
  // ---------- G-7 the header logo goes home: the entry screen with the globe, from every tab, in a tab that entered ----------
  // Real mouse clicks (on the mark, then on the words) and the keyboard (focus + Enter). The page loads afresh: the app
  // writes its own first-visit hash again (default species, explore), none of the state before the click is kept.
  {
    const logo=part=>evaluate(`(()=>{const a=document.querySelector('header a.brand'),r=(${JSON.stringify(part)}==='mark'?a.querySelector('.brand-mark'):a.querySelector('strong')).getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2,cursor:getComputedStyle(a).cursor,name:a.getAttribute('aria-label')}})()`);
    const clickAt=async p=>{for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});};
    // after the click the page is a new document: wait for its entry screen (or for the map, if it did not show)
    const home=async()=>{await sleep(500);let g;for(let i=0;i<80;i++){try{g=await gateState();if(g.ready||(!g.on&&/연결됨|불러오기 실패|연결 실패/.test(await evaluate("document.getElementById('connection-state')?.textContent||''"))))break;}catch{}await sleep(250);}
      return {...g,hash:await evaluate('location.hash'),signal:await evaluate("sessionStorage.getItem('bbvm-intro-home')"),globe:await evaluate("!!document.querySelector('#site-gate .gate-hero:not([hidden]) .gate-globe')&&document.querySelector('#site-gate .gate-sea').width>0")};};
    const atGlobe=(g,old)=>g.on&&!g.hidden&&g.ready&&g.globe&&g.inert===g.held&&!g.hash.includes(old)&&!/v=(compare|method)/.test(g.hash)&&g.signal===null&&g.stored==='1';
    const back=async()=>{await pressEnter();await sleep(1100);return gateState();};
    // explore, a species chosen through a shared link
    await evaluate("sessionStorage.setItem('bbvm-intro-entered','1');1");
    await send('Page.navigate',{url:URL0+'#s=241776&v=explore'});
    for(let i=0;i<80&&!await evaluate("/연결됨|불러오기 실패|연결 실패/.test(document.getElementById('connection-state')?.textContent||'')&&selected?.aphiaID===241776").catch(()=>false);i++)await sleep(250);
    let p=await logo('mark');
    check('G-7 logo: one link round the mark and the words, pointer cursor, named for where it goes',p.cursor==='pointer'&&p.name==='Blue-bio Value Map 첫 화면으로'&&await evaluate("(()=>{const a=document.querySelector('header a.brand');return a.contains(a.querySelector('.brand-mark svg'))&&a.textContent.trim()==='Blue-bio Value Map'})()"),JSON.stringify(p));
    const before=await evaluate("({gate:document.documentElement.classList.contains('gate-on'),hash:location.hash})");
    await clickAt(p);let g=await home();
    check('G-7 explore (sea cucumber chosen, shared-link hash): clicking the logo mark shows the globe entry screen, not the map; the chosen species is gone',!before.gate&&before.hash.includes('s=241776')&&atGlobe(g,'s=241776'),JSON.stringify({before,g}));
    await sleep(1200);await shot('logo-home-desktop',false);
    g=await back();
    check('G-7 Enter from that screen opens the map as on a first visit (no species from before, explore tab)',!g.on&&g.hidden&&g.inert===0&&await evaluate("document.getElementById('explore').classList.contains('active')&&!location.hash.includes('s=241776')"),JSON.stringify(g));
    // 비교와 지표, through its tab, then the words of the logo
    await evaluate("document.querySelector('.tabs [data-view=\"compare\"]').click();1");await sleep(400);
    const cmp=await evaluate("document.getElementById('compare').classList.contains('active')");
    await clickAt(await logo('words'));g=await home();
    check('G-7 비교와 지표: clicking the logo words shows the globe entry screen',cmp&&atGlobe(g,'v=compare'),JSON.stringify({cmp,g}));
    await back();
    // 근거와 방법, keyboard only: the logo takes focus and Enter follows it
    await evaluate("document.querySelector('.tabs [data-view=\"method\"]').click();1");await sleep(400);
    const met=await evaluate("document.getElementById('method').classList.contains('active')&&(document.querySelector('header a.brand').focus(),document.activeElement.matches('header a.brand'))");
    await pressEnter();g=await home();
    check('G-7 근거와 방법: the logo by keyboard (focus, Enter) shows the globe entry screen',met&&atGlobe(g,'v=method'),JSON.stringify({met,g}));
    await back();
    // the signal is used once: a reload afterwards opens the map as before
    await load();g=await gateState();
    check('G-7 a reload after coming back opens the map directly (the logo signal is used once)',!g.on&&g.hidden&&await evaluate("sessionStorage.getItem('bbvm-intro-home')===null"),JSON.stringify(g));
    // phone 390px, on 비교와 지표
    await viewport(390,844,true);
    await send('Page.navigate',{url:URL0+'#v=compare'});
    for(let i=0;i<80&&!/연결됨|불러오기 실패|연결 실패/.test(await evaluate("document.getElementById('connection-state')?.textContent||''"));i++)await sleep(250);
    await clickAt(await logo('mark'));g=await home();
    check('G-7 phone 390px (비교와 지표): tapping the logo shows the globe entry screen',atGlobe(g,'v=compare')&&g.doc<=g.vw,JSON.stringify(g));
    await sleep(1200);await shot('logo-home-mobile',false);
    await evaluate("document.getElementById('gate-enter').click();1");await sleep(1100);
    await viewport(1560,900,false);
  }
  // ---------- R readability (2026-10-15): 12px floor, English originals in lang blocks, abbreviations named ----------
  // verification/readability_check.mjs sweeps every species and the expedition page too; this keeps the floor in CI.
  for(const [w,h,mobile] of [[390,844,true],[1440,900,false]]){
    await viewport(w,h,mobile);
    for(const v of ['explore','compare','method']){
      const r=await evaluate(`(async()=>{setView('${v}');for(const d of document.querySelectorAll('#${v} details'))d.open=true;await new Promise(r=>setTimeout(r,400));return (${collect})(['#${v}',12]);})()`);
      const bad={small:r.small.slice(0,5),english:r.eng.filter(e=>!e.marked).slice(0,5).map(e=>e.text.slice(0,80)),abbr:Object.entries(r.abbr).filter(([,a])=>!a.named).map(([k,a])=>k+' '+a.text)};
      check(`R-1 ${w}px ${v}: no text under 12px, English originals in lang blocks, first MFPI·MBPI·BBVI·MCUI named in Korean`,!r.small.length&&!bad.english.length&&!bad.abbr.length,JSON.stringify(bad));
    }
  }
  await viewport(1560,900,false);await evaluate("setView('explore');1");
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
