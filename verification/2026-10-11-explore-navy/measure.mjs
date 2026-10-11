// Before/after numbers for the navy explore-map redesign (2026-10-11). Same headless-Chrome approach as uicheck.mjs (no deps).
// node verification/2026-10-11-explore-navy/measure.mjs <out.json> [screenshot.png]
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (as in uicheck.mjs).
// Everything under "data" must be identical before and after a presentation-only change; "layout" is expected to move
// (the auto-fit view depends on how much of the map the panels cover).
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,SHOT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-11-explore-navy/measure.mjs <out.json> [screenshot.png]');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const HASH='#s=836033&v=explore&b=satellite&t=occurrence&m=6%2F35.78%2F128.49'; // the production view named in the task
const SPECIES=[836033,145721,241776,504357]; // 참굴 · 미역(periods) · 해삼(4°, published) · 피조개(4°, candidate)
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
async function connect(){
  for(let i=0;i<300;i++){
    try{
      const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      if(Number.isInteger(port)&&port>0){const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}
    }catch{}
    await sleep(200);
  }
  throw Error('Chrome DevTools endpoint timeout');
}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},20000);pending.set(i,{res,rej,timer});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};

// Read inside the page: bubble groups at zoom 5–6, schematic dots and BBVI tags at zoom 7–8, values and labels.
const SPECIES_READ=`async id=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  if(mapMode!=='occurrence')setMapMode('occurrence');
  selectSpecies(id);await wait(150);
  const s=selected, out={label:s.label,records:cellRecords(s),cells:spatialCells(s).length,rows:s.cells.length,
    bbviTag:bbviTagText(s),axes:Object.fromEntries(['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return [k,{value:st.value,label:st.label,kind:st.kind}]})),
    counters:['map-count','map-cells','map-years'].map(x=>document.getElementById(x).textContent),zoom:{}};
  for(const z of [5,6,7,8]){
    map.setZoom(z,{animate:false});drawOccurrence();await wait(50);
    const layers=overlay.getLayers();
    out.zoom[z]={bubbles:cellBubbles(dotCells,z).map(b=>[b.cells.length,b.records]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
      bubbleMarks:layers.filter(l=>l._zoomMark&&l instanceof L.CircleMarker).length,
      bubbleLabels:[...document.querySelectorAll('#map .bubble-count')].map(e=>e.textContent).sort(),
      dots:layers.filter(l=>l._schematicDot).length,
      tags:[...new Set([...document.querySelectorAll('#map .bbvi-tag')].map(e=>e.textContent))],tagCount:document.querySelectorAll('#map .bbvi-tag').length,
      cellFrames:layers.filter(l=>!l._schematicDot&&!l._zoomMark).length};
  }
  const periods=[...document.querySelectorAll('#period-filter [data-period]')];
  if(periods.length){out.periods={};for(const b of periods){b.click();await wait(50);map.setZoom(7,{animate:false});drawOccurrence();
    out.periods[b.dataset.period]={rows:periodView(selected).cells.length,dots:overlay.getLayers().filter(l=>l._schematicDot).length,table:document.querySelectorAll('#cell-table tbody tr').length};}
    periods[0].click();}
  return out;
}`;
const LIST_READ=`async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms)), ids=()=>[...document.querySelectorAll('#species-list .species-card')].map(b=>Number(b.dataset.species));
  const set=(sel,v)=>{const e=document.getElementById(sel);e.value=v;e.dispatchEvent(new Event('change'));};
  const read=()=>({count:document.getElementById('species-count').textContent,ids:ids()});
  const chips=[...document.querySelectorAll('#use-chips [data-use]:not([disabled])')].map(b=>b.dataset.use);
  const r={chipsAvailable:chips};
  setUses([]);set('species-group','all');set('species-evidence','all');await wait(50);r.all=read();
  set('species-group','패류');await wait(50);r.shellfish=read();set('species-group','all');
  set('species-evidence','candidate');await wait(50);r.candidates=read();set('species-evidence','all');
  setUses([chips[0]]);await wait(50);r.oneChip={chips:[chips[0]],...read()};
  // a second chip that still leaves species (AND), else the pair is recorded as empty
  const second=chips.find(c=>c!==chips[0]&&(setUses([chips[0],c]),ids().length>0))||chips[1];
  setUses([chips[0],second]);await wait(50);r.twoChips={chips:[chips[0],second],...read()};
  setUses([]);await wait(50);
  return r;
}`;
const VALUE_READ=`async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  selectSpecies(836033);setMapMode('value');await wait(150);
  const r={types:Object.fromEntries([...document.querySelectorAll('#value-mini .vm-grid [data-key]')].map(b=>[b.dataset.key,b.querySelector('.vm-n')?.textContent??b.textContent])),
    cells:valueRects.length,none:document.getElementById('v-none-count').textContent};
  setMapMode('occurrence');await wait(50);
  return r;
}`;
try{
  ws=new WebSocket(await connect());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await send('Page.enable');await send('Runtime.enable');
  if(process.env.FIXTURE){
    const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    const reply=k=>`Promise.resolve(new Response(JSON.stringify(FX.${k}),{status:200,headers:{'content-type':'application/json'}}))`;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return ${reply('profiles')};if(s.includes('/rest/v1/species_map_cells'))return ${reply('cells')};return o(u,...a);})(window.fetch);}`});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1560,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:URL0+HASH});
  for(let i=0;i<120;i++){await sleep(250);if(await evaluate("typeof data!=='undefined'&&!!data?.species&&!!map&&!!selected").catch(()=>false))break;}
  await sleep(1500);
  const opened=await evaluate(`({s:selected.aphiaID,zoom:map.getZoom(),center:[+map.getCenter().lat.toFixed(2),+map.getCenter().lng.toFixed(2)],mode:mapMode,
    bubbles:cellBubbles(dotCells,map.getZoom()).length,effortOn:document.getElementById('effort-toggle').checked,effortLayers:effortLayer?effortLayer.getLayers().length:null})`);
  if(SHOT){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(SHOT,Buffer.from(r.data,'base64'));}
  const species={},fitted={};
  for(const a of SPECIES){
    species[a]=await evaluate(`(${SPECIES_READ})(${a})`);
    // layout-dependent: where the species auto-fit lands (panels change the free map area)
    fitted[a]=await evaluate(`(()=>{lastFitted=null;renderMap();return {zoom:map.getZoom(),center:[+map.getCenter().lat.toFixed(2),+map.getCenter().lng.toFixed(2)]}})()`);
  }
  const list=await evaluate(`(${LIST_READ})()`);
  const value=await evaluate(`(${VALUE_READ})()`);
  const total=await evaluate(`({species:data.species.length,published:data.species.filter(s=>!s.catalog).length,candidates:data.species.filter(s=>s.catalog).length})`);
  const result={measuredAt:new Date().toISOString(),url:URL0+HASH,data:{total,openedView:{s:opened.s,zoom:opened.zoom,center:opened.center,mode:opened.mode,bubbles:opened.bubbles},species,list,value},
    layout:{effortOnAtStart:opened.effortOn,effortLayersAtStart:opened.effortLayers,fitted}};
  fs.mkdirSync(path.dirname(path.resolve(OUT)),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,1)+'\n');
  console.log('wrote',OUT);
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
