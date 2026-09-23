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
  for(let i=0;i<80;i++){await sleep(250);const st=await evaluate("document.getElementById('connection-state')?.textContent||''");if(/연결됨|별도 시연|불러오기 실패/.test(st))return st;}return 'timeout';}
async function shot(name,full=true){
  const m=await evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:full?{x:0,y:0,width:m.w,height:Math.min(m.h,6000),scale:1}:undefined});
  fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}
const pick=aphia=>evaluate(`document.querySelector('[data-species="${aphia}"]').click();document.getElementById('detail').innerText`);
const detailEl=()=>evaluate(`document.getElementById('detail').scrollIntoView();1`);
try{
  ws=new WebSocket(await connect());
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable');await send('Runtime.enable');
  const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});

  // ---------- Desktop, real production API ----------
  await viewport(1440,1000,false);
  const st=await load();
  check('Desktop live: connection state shows actual profile count',st==='운영 DB 연결됨 · 3종',st);
  const note=await evaluate("document.getElementById('collection-note').textContent");
  check('Live note uses received profile count (not fixed 2종)',note.includes('발행된 3종')&&!note.includes('2종'),note);
  const cards=await evaluate("[...document.querySelectorAll('.species-card')].map(b=>b.innerText.replace(/\\s+/g,' '))");
  check('List: sea cucumber card shows 출현자료 미수집 (not 0건)',cards.some(c=>c.includes('해삼')&&c.includes('출현자료 미수집')&&!c.includes('0건')),JSON.stringify(cards));

  let t=await pick(836033);
  check('Oyster: nutrition 144 / measured 107 / calculated 37 / AFCD 25 / unit 4 / basis 144',
    ['영양 근거','144건','실측 107건 · 계산 37건','AFCD 근거 기록 25건','단위 미확정 4건 · 기준량 가정 144건'].every(x=>t.includes(x)),t);
  check('Oyster: aquaculture 4 shown as evidence records, not production',t.includes('양식 표시 근거 4건')&&t.includes('AFCD에서 양식(farmed)으로 표시된 근거 기록 수')&&t.includes('생산량 통계가 아닙니다')&&!/생산량\s*4/.test(t),t);
  check('Oyster: conservation withheld',t.includes('근거 부족으로 보류')&&t.includes('IUCN 검색 기록 2건 · 평가 0건'),t);
  check('Oyster: compounds 미수집, occurrences 26 kept',/보고 화합물\s*미수집/.test(t)&&/수집된 기록\s*26건/.test(t),t);
  await detailEl();await shot('desktop-oyster');

  t=await pick(241776);
  check('Sea cucumber: 122 compounds, no quantitative activity',/보고 화합물\s*122개/.test(t)&&/정량 활성 자료\s*확인한 자료에서 없음/.test(t),t);
  check('Sea cucumber: no efficacy claim',!/입증|효능|효과가 있/.test(t),t);
  check('Sea cucumber: CMNPD source and NC-SA terms visible in compound summary',t.includes('CMNPD')&&t.includes('CC BY-NC-SA 4.0')&&t.includes('비상업 이용'),t);
  check('Sea cucumber: 출현자료 미수집, not 위치 공개 검토 중',t.includes('출현자료 미수집')&&!t.includes('위치 공개 검토 중'),t);
  check('Sea cucumber: conservation withheld, nutrition 미수집',t.includes('근거 부족으로 보류')&&/영양 성분 값\s*미수집/.test(t),t);
  const mapNote=await evaluate("document.getElementById('map-review-note').textContent+' | '+document.getElementById('map-cells').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length");
  check('Sea cucumber map: no fabricated positions',mapNote.includes('출현자료를 수집하지 않은 종')&&mapNote.includes('해당 없음')&&mapNote.endsWith('shapes=0'),mapNote);
  await detailEl();await shot('desktop-sea-cucumber');

  t=await pick(342067);
  check('Squid: 미수집 vs 미검토 distinguished',/영양 성분 값\s*미수집/.test(t)&&/보고 화합물\s*미수집/.test(t)&&/보전평가\s*미검토/.test(t)&&t.includes('2건'),t);
  await detailEl();await shot('desktop-squid');
  const leak=await evaluate("document.body.innerText");
  check('No CMNPD raw data / coordinates in page',!/InChI|SMILES|CMNPD\d|raw_record/i.test(leak));

  await evaluate("document.querySelector('[data-view=compare]').click();1");await sleep(300);
  const cmp=await evaluate("document.getElementById('comparison').innerText");
  check('Compare table: per-species nutrition/compounds/conservation from API',cmp.includes('영양 144건')&&cmp.includes('보고 화합물 122개')&&cmp.includes('근거 부족으로 보류')&&cmp.includes('미검토'),cmp);
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-compare');
  await evaluate("document.querySelector('[data-view=method]').click();1");await sleep(300);
  const src=await evaluate("document.getElementById('all-sources').innerText");
  check('Sources: AFCD/CMNPD show their own change notes, not OBIS labels',src.includes('해삼 기원 보고 화합물 개수만 집계')&&src.includes('데이터셋 원문')&&!src.includes('OBIS 데이터셋'),src.slice(0,400));

  // demo mode keeps existing map behavior and separation
  await evaluate("document.querySelector('[data-view=explore]').click();const s=document.getElementById('collection');s.value='demo';s.dispatchEvent(new Event('change'));1");
  for(let i=0;i<40;i++){await sleep(250);if((await evaluate("document.getElementById('connection-state').textContent")).includes('시연'))break;}
  const demo=await evaluate("document.getElementById('connection-state').textContent+' | shapes='+document.querySelectorAll('#map path.leaflet-interactive').length+' | '+document.getElementById('map-review-note').textContent");
  check('Demo mode: separate 3 species with 1° grid map',demo.startsWith('별도 시연 자료 · 3종')&&Number((demo.match(/shapes=(\d+)/)||[])[1])>0,demo);
  await evaluate("window.scrollTo(0,0);1");await shot('desktop-demo-map',false);

  // ---------- Mobile 390px ----------
  await viewport(390,844,true);
  await load();
  for(const [aphia,name] of [[241776,'mobile-sea-cucumber'],[836033,'mobile-oyster']]){
    await pick(aphia);await detailEl();
    const ov=await evaluate("({doc:document.documentElement.scrollWidth,vw:window.innerWidth,wide:[...document.querySelectorAll('#detail *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length})");
    check(`Mobile 390px ${name}: no horizontal overflow`,ov.doc<=ov.vw&&ov.wide===0,JSON.stringify(ov));
    await shot(name);
  }

  // ---------- Failure / empty / v1-only responses (fetch mocked in page) ----------
  await viewport(1440,1000,false);
  const mocks={
    'api-error':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('x',{status:500})):o(u,...a))(window.fetch);",
    'api-empty':"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}})):o(u,...a))(window.fetch);",
    'v1-only':"window.fetch=(o=>async(u,...a)=>{const r=await o(u,...a);if(!String(u).includes('/rest/v1/'))return r;const rows=await r.json();for(const p of rows){const s=p.evidence_summary;for(const k of ['summary_version','nutrition','compounds','conservation','production','occurrence_status'])delete s[k];p.production_summary='생산·영양·생리활성·보전 근거 미검토. 점수 미산출.';}return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});})(window.fetch);"
  };
  let scriptId;
  for(const [name,src] of Object.entries(mocks)){
    if(scriptId)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});
    scriptId=(await send('Page.addScriptToEvaluateOnNewDocument',{source:src})).identifier;
    const s=await load();
    const state=await evaluate("({state:document.getElementById('connection-state').textContent,error:document.getElementById('error').hidden?'':document.getElementById('error').textContent,list:document.getElementById('species-list').innerText,detail:document.getElementById('detail').innerText})");
    if(name==='api-error')check('API failure: error shown, no stale data',state.state==='불러오기 실패'&&state.error.includes('불러오지 못했습니다')&&state.detail==='',JSON.stringify(state));
    if(name==='api-empty')check('Empty API response: "아직 발행된 종이 없습니다"',state.list.includes('아직 발행된 종이 없습니다')&&state.state.includes('발행 자료 없음'),JSON.stringify(state));
    if(name==='v1-only')check('v2 keys absent: falls back to production_summary, no fake 0/미수집',state.detail.includes('생산·영양·생리활성·보전 근거 미검토')&&!state.detail.includes('영양 근거')&&!state.detail.includes('미수집'),state.detail);
    await evaluate("window.scrollTo(0,0);1");await shot(name,false);
  }
  check('No uncaught page errors',errors.length===0,errors.join(' | '));
}catch(e){check('Harness',false,e.stack);}
finally{fs.writeFileSync(path.join(OUT,'ui-check-results.json'),JSON.stringify(results,null,2));ws?.close();chrome.kill();
  console.log(`${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status!=='PASS').length} FAIL`);}
