// Before/after numbers for the explore-map design 2 change (2026-10-13). Same headless-Chrome approach as uicheck.mjs (no deps).
// node verification/2026-10-explore-cards-cells/measure.mjs <out.json> [screenshot.png]
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (as in uicheck.mjs).
// Everything under "data" must be identical before and after (the change is screen-only): each species' BBVI, MCUI, labels,
// type, public cells, records and years, and the all-species value map's cells per type. "layout" may move.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,SHOT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-explore-cards-cells/measure.mjs <out.json> [screenshot.png]');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const HASH='#s=836033&v=explore&b=satellite&t=occurrence'; // the view named in the task (참굴, satellite, occurrence)
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

// Read inside the page: every species' values from the app's own functions (never from the screen text).
const SPECIES_READ=`(()=>data.species.map(s=>{const v=k=>axisState(s,k).value;
  return {aphiaID:s.aphiaID,label:s.label,catalog:!!s.catalog,BBVI:v('BBVI'),MCUI:v('MCUI'),bbviLabel:bbviLabel(s)||null,mcuiBasis:basisNote(s,'MCUI')||null,
    type:matrixType(s),typeLabel:matrixType(s)?matrixTypeLabel(matrixType(s)):null,cells:spatialCells(s).length,records:cellRecords(s),years:s.cells.length?cellYears(s):null};}))()`;
// The all-species value map: groups and the colour type of each cell, then the drawn map (switched to that view if it exists).
const VALUE_READ=`async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const groups=valueCellGroups(),byType={};for(const g of groups.values()){const t=cellMatrixType(g).type||'none';byType[t]=(byType[t]||0)+1;}
  selectSpecies(836033);setMapMode('value');await wait(200);
  if(typeof valueView!=='undefined'&&valueView!=='all')document.getElementById('value-view').click();
  await wait(200);
  const r={groups:groups.size,byType,drawn:valueRects.length,
    icon:Object.fromEntries([...document.querySelectorAll('#value-mini .vm-grid [data-key]')].map(b=>[b.dataset.key,b.querySelector('.vm-n')?.textContent??b.textContent])),
    none:document.getElementById('v-none-count').textContent,selectedCells:[...valueCellGroups().values()].filter(g=>g.species.has(836033)).length};
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
  const opened=await evaluate(`({s:selected.aphiaID,zoom:map.getZoom(),center:[+map.getCenter().lat.toFixed(2),+map.getCenter().lng.toFixed(2)],mode:mapMode})`);
  if(SHOT){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(SHOT,Buffer.from(r.data,'base64'));}
  const species=await evaluate(SPECIES_READ);
  const types={};for(const s of species){const t=s.type||'none';types[t]=(types[t]||0)+1;}
  const value=await evaluate(`(${VALUE_READ})()`);
  const result={measuredAt:new Date().toISOString(),url:URL0+HASH,data:{total:species.length,types,species,value},layout:{opened}};
  fs.mkdirSync(path.dirname(path.resolve(OUT)),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,1)+'\n');
  console.log('wrote',OUT);
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
