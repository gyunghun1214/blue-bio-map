// Offline demo check (docs/offline-demo.md): headless Chrome with every request outside this computer cut off, against
// a local server (CI: scripts/offline/serve.ps1). The page must open from live-snapshot.json, ask nothing of the
// network, take map tiles only from offline-tiles/ inside tile-plan.json, and keep the chatbot on the FAQ.
// Run: start a server on dist/, then node verification/offline_check.mjs [output-directory]
// Env: URL0 (default http://127.0.0.1:8770/), CHROME_PATH.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), DIST=path.join(HERE,'..','dist');
const OUT=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'offline-check-'));
fs.mkdirSync(OUT,{recursive:true});
const snapshot=JSON.parse(fs.readFileSync(path.join(DIST,'live-snapshot.json'),'utf8'));
// All species the site shows: published profiles (snapshot) plus catalog candidates not among them (30 on 2026-10-09).
const catalog=JSON.parse(fs.readFileSync(path.join(DIST,'candidate-catalog.json'),'utf8')).species.map(s=>s.aphiaID);
const report=JSON.parse(fs.readFileSync(path.join(DIST,'assessments.json'),'utf8'));
const published=snapshot.profiles.map(p=>Number(p.aphia_id)), allSpecies=published.length+catalog.filter(a=>!published.includes(a)).length;
const scored=[...report.species,...(report.candidate_species||[])].length;
const plan=JSON.parse(fs.readFileSync(path.join(HERE,'..','scripts','offline','tile-plan.json'),'utf8'));
const URL0=process.env.URL0||'http://127.0.0.1:8770/', LOCAL=new URL(URL0).host;
const tileX=(lon,z)=>Math.floor((lon+180)/360*2**z);
const tileY=(lat,z)=>{const r=lat*Math.PI/180;return Math.floor((1-Math.asinh(Math.tan(r))/Math.PI)/2*2**z);};
// Same ranges as prepare-offline.ps1.
const planned=(z,x,y)=>plan.levels.some(l=>z>=l.zooms[0]&&z<=l.zooms[1]&&x>=tileX(l.west,z)&&x<=tileX(l.east,z)&&y>=tileY(l.north,z)&&y<=tileY(l.south,z));
const TILE_RE={satellite:/^\/offline-tiles\/satellite\/(\d+)\/(\d+)\/(\d+)\.jpeg$/,depth:/^\/offline-tiles\/depth\/(\d+)\/(\d+)\/(\d+)\.png$/};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64').toString('base64');

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
async function connect(){
  for(let i=0;i<300;i++){
    try{
      const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();
      const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;
    }catch{}
    await sleep(200);
  }
  throw Error('Chrome DevTools endpoint timeout');
}
const send=(method,params={})=>new Promise((res,rej)=>{
  const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},15000);
  pending.set(i,{res,rej,timer});ws.send(JSON.stringify({id:i,method,params}));
});
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value;};
const waitFor=async(expr,accept,timeout=15000)=>{const end=Date.now()+timeout;let v;do{v=await evaluate(expr);if(accept(v))return v;await sleep(150);}while(Date.now()<end);return v;};
const results=[];
const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail});console.log(ok?'PASS':'FAIL',name,ok?'':detail);};
async function pressEnter(){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});}
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}

// The network: requests to this computer pass (tiles answered with a 1×1 image when fakeTiles is on); every other
// request is recorded and fails as if the cable were out.
const external=[], localPaths=[], errors=[];let fakeTiles=false;
async function onPaused({requestId,request}){
  const u=new URL(request.url);
  try{
    if(u.host!==LOCAL&&!/^(data|blob):/.test(u.protocol)){external.push(request.url);await send('Fetch.failRequest',{requestId,errorReason:'InternetDisconnected'});return;}
    localPaths.push(u.pathname);
    if(fakeTiles&&u.pathname.startsWith('/offline-tiles/'))
      await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:PNG});
    else await send('Fetch.continueRequest',{requestId});
  }catch{/* page navigated away */}
}
const state=()=>evaluate(`({conn:document.getElementById('connection-state')?.textContent||'',error:document.getElementById('error')?.hidden===false?document.getElementById('error').textContent:'',
  basemapStatus:document.getElementById('basemap-status')?.textContent||'',url:location.href,offline:globalThis.BBVM_OFFLINE,
  species:typeof data!=='undefined'&&data?data.species.length:0,tiles:document.querySelectorAll('#map img.leaflet-tile-loaded').length})`);
const counts=`운영 발행 ${snapshot.profiles.length}종 · 조사 후보`;
const tilesOf=kind=>localPaths.map(p=>TILE_RE[kind].exec(p)).filter(Boolean).map(m=>kind==='satellite'?[+m[1],+m[3],+m[2]]:[+m[1],+m[2],+m[3]]);

try{
  ws=new WebSocket(await connect());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}
    else if(m.method==='Fetch.requestPaused')onPaused(m.params);
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});

  // ---------- 1. Open as offline-demo.cmd does, with no saved tiles ----------
  await send('Page.navigate',{url:URL0+'?offline=1'});
  const note=await waitFor("document.querySelector('#site-gate .gate-note')?.hidden===false?document.querySelector('#site-gate .gate-note').textContent:''",v=>v);
  check('O-1 entry screen says it opens the dated saved copy for the offline demo',note===`오프라인 시연 · ${snapshot.fetched_at} 기준 공개 자료 사본으로 엽니다.`,note);
  // Enter acts only once the entry screen is ready (intro.js GATE_MIN_MS); a fast runner reaches the note before that.
  await waitFor("document.getElementById('site-gate').classList.contains('is-ready')",v=>v);
  await pressEnter();
  const entered=await waitFor("document.getElementById('site-gate').hidden&&sessionStorage.getItem('bbvm-intro-entered')==='1'",v=>v,5000);
  check('O-1b Enter opens the map from the offline entry screen',entered===true,String(entered));
  let s=await (async()=>{for(let i=0;i<60;i++){const v=await state();if(v.conn.startsWith('오프라인')&&v.basemapStatus)return v;await sleep(250);}return state();})();
  check('O-2 status line names the offline demo and the snapshot date, no red alert',s.conn.startsWith(`오프라인 시연 · 저장된 공개 자료 사본 (${snapshot.fetched_at} 기준) · ${counts}`)&&!s.error,JSON.stringify(s));
  const all=await evaluate(`(()=>{renderComparison();return {list:document.querySelectorAll('#species-list [data-species]').length,
    compare:document.querySelectorAll('#comparison thead th').length-1,assessed:data.species.filter(x=>x.assessment).length}})()`);
  check(`O-3 all ${allSpecies} species (published ${published.length} + candidates) in the list and the comparison, ${scored} with indices from assessments.json`,
    s.species===allSpecies&&all.list===allSpecies&&all.compare===allSpecies&&all.assessed===scored,JSON.stringify({...all,species:s.species,allSpecies,scored}));
  const details=await evaluate(`(()=>{const bad=[];for(const x of data.species){selectSpecies(x.aphiaID);const t=document.getElementById('detail').innerText;
    if(!t.includes(x.label)||t.length<200)bad.push(x.label);}selectSpecies(data.species[0].aphiaID);return bad;})()`);
  check('O-3b every species detail opens with its own content',details.length===0,details.join(', '));
  check('O-4 the ?offline=1 flag is not left in the address (shared links stay normal)',!/offline=/.test(s.url)&&s.offline===true,s.url);
  check('O-5 without saved tiles the map falls back to the outline map and says why',s.basemapStatus==='오프라인 시연: 저장된 배경 지도가 없어 경계선만 있는 지도로 바꿨습니다.',s.basemapStatus);
  const sat=tilesOf('satellite');
  check('O-6 satellite tiles are asked of offline-tiles/ only, inside tile-plan.json',sat.length>0&&sat.every(t=>planned(...t)),JSON.stringify(sat.filter(t=>!planned(...t)).slice(0,5)));
  await shot('offline-no-tiles');

  // ---------- 2. Chatbot: FAQ only ----------
  const reply=await evaluate(`(async()=>{document.querySelector('.bbc-fab').click();await new Promise(r=>setTimeout(r,300));
    const i=document.querySelector('.bbc-input');i.value='오늘 부산 날씨와 환율 알려줘';document.querySelector('.bbc-form').requestSubmit();
    await new Promise(r=>setTimeout(r,500));return [...document.querySelectorAll('.bbc-log .bbc-bot')].at(-1)?.textContent||'';})()`);
  check('O-7 chatbot: a question the FAQ cannot match gets the offline note, no AI request',reply.startsWith('오프라인 시연 중이라 AI 답변은 쉬고 있어요')&&!localPaths.some(p=>p.startsWith('/api/')),reply);

  // ---------- 3. Reload without the flag: still offline in this tab; tiles present ----------
  fakeTiles=true;localPaths.length=0;
  await send('Page.navigate',{url:URL0});
  s=await (async()=>{for(let i=0;i<60;i++){const v=await state();if(v.conn.startsWith('오프라인')&&v.tiles>0)return v;await sleep(250);}return state();})();
  check('O-8 a reload in the same tab stays in offline demo mode and skips the entry screen',s.conn.startsWith('오프라인 시연')&&await evaluate("document.getElementById('site-gate').hidden"),JSON.stringify(s));
  await sleep(800);s=await state();
  check('O-9 with saved tiles the satellite map shows them and no fallback note',s.tiles>0&&!s.basemapStatus&&tilesOf('satellite').every(t=>planned(...t)),JSON.stringify(s));
  await evaluate("document.querySelector('[data-basemap=\"depth\"]').click();1");await sleep(1200);
  const depth=tilesOf('depth');
  check('O-10 depth map: tiles from offline-tiles/depth inside tile-plan.json, no fallback',depth.length>0&&depth.every(t=>planned(...t))&&!(await state()).basemapStatus,JSON.stringify(depth.slice(0,5)));
  await evaluate("map.setZoom(8,{animate:false});1");await sleep(1000);
  const z8=tilesOf('depth').filter(t=>t[0]===8);
  check('O-11 the opening view at the closest zoom is covered by the saved tiles',z8.length>0&&z8.every(t=>planned(...t)),JSON.stringify(z8.filter(t=>!planned(...t)).slice(0,5)));
  await evaluate("document.querySelector('[data-basemap=\"satellite\"]').click();fitMap();1");await sleep(800);
  await shot('offline-tiles');

  // ---------- 4. Expedition page ----------
  await send('Page.navigate',{url:URL0+'expedition.html'});await sleep(3000);
  const stops=JSON.parse(fs.readFileSync(path.join(DIST,'expedition-stops.json'),'utf8'));
  check('O-12 expedition page opens from local files with its stop data',await evaluate("document.readyState==='complete'&&document.body.innerText.length>50")&&localPaths.includes('/expedition-stops.json'),JSON.stringify(localPaths.filter(p=>!p.startsWith('/offline-tiles')).slice(-8)));

  check('O-13 nothing was requested outside this computer',external.length===0,external.slice(0,8).join(' | '));
  check('O-14 no uncaught page errors',errors.length===0,errors.join(' | '));

  // ---------- 5. ?offline=0 ends the mode: the live path is unchanged (here the API is cut off, so it is the dated copy) ----------
  await send('Page.navigate',{url:URL0+'?offline=0'});
  s=await (async()=>{for(let i=0;i<80;i++){const v=await state();if(/연결 실패|연결됨/.test(v.conn))return v;await sleep(250);}return state();})();
  check('O-15 ?offline=0 returns to the normal page: asks the live API first, then the existing saved-copy fallback',
    s.offline===false&&s.conn.startsWith(`연결 실패 · 저장된 사본 사용 (${snapshot.fetched_at} 기준)`)&&external.some(u=>u.includes('.supabase.co/rest/v1/species_profiles')),JSON.stringify(s));
}catch(e){check('Harness',false,e.stack);}
finally{
  fs.writeFileSync(path.join(OUT,'offline-check-results.json'),JSON.stringify(results,null,2));
  try{ws?.close();}catch{}
  chrome.kill();await sleep(500);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}
  const fail=results.filter(r=>r.status!=='PASS').length;
  console.log(`${results.length-fail} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
}
