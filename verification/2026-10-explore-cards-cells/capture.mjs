// Screenshots for the explore-map design 2 change (2026-10-13). Same headless-Chrome approach as uicheck.mjs (no deps).
// node verification/2026-10-explore-cards-cells/capture.mjs <before|after> <outdir> [name-filter]
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (as in uicheck.mjs). The satellite and depth tiles are
// blocked in some sandboxes; the map then shows the navy sea with the land outline and the cells as usual.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [SET,DIR,ONLY]=process.argv.slice(2);
if(!SET||!DIR)throw Error('Usage: node verification/2026-10-explore-cards-cells/capture.mjs <before|after> <outdir> [name-filter]');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const H=(s,t='occurrence',b='satellite')=>`#s=${s}&v=explore&b=${b}&t=${t}`;
const OYSTER=836033,MUSSEL=506159,HIJIKI=494972,GELIDIUM=372119,ASCIDIAN=250680,CUCUMBER=241776;
const zoom7='map.setZoom(7,{animate:false});drawOccurrence();';
const allView="document.getElementById('value-view')?.click();";
// a candidate species without public cells: verified-4.11 has none (all 30 species have public cells), so the first candidate's
// cells are emptied in the page for this shot only (the page reloads before the next shot)
const noCell="{const s=data.species.find(x=>x.catalog);s.cells=[];selectSpecies(s.aphiaID);}";
const SHOTS={
  before:[
    {name:'1560-occurrence',w:1560,h:900,hash:H(OYSTER)},
    {name:'1560-occurrence-z7',w:1560,h:900,hash:H(OYSTER),js:zoom7},
    {name:'1560-value',w:1560,h:900,hash:H(OYSTER,'value')},
    {name:'1280-occurrence',w:1280,h:800,hash:H(OYSTER)},
    {name:'390-occurrence',w:390,h:844,mobile:true,hash:H(OYSTER)},
  ],
  after:[
    {name:'1560-occurrence',w:1560,h:900,hash:H(OYSTER)},
    {name:'1560-occurrence-z7',w:1560,h:900,hash:H(OYSTER),js:zoom7},
    {name:'1560-value-1-oyster',w:1560,h:900,hash:H(OYSTER,'value')},
    {name:'1560-value-2-mussel',w:1560,h:900,hash:H(MUSSEL,'value')},
    {name:'1560-value-3-hijiki',w:1560,h:900,hash:H(HIJIKI,'value')},
    {name:'1560-value-4-gelidium',w:1560,h:900,hash:H(GELIDIUM,'value')},
    {name:'1560-value-all',w:1560,h:900,hash:H(OYSTER,'value'),js:allView},
    {name:'1560-value-ascidian-untyped',w:1560,h:900,hash:H(ASCIDIAN,'value')},
    {name:'1560-value-no-cell-candidate',w:1560,h:900,hash:H(OYSTER,'value'),js:noCell},
    {name:'1560-occurrence-no-cell-candidate',w:1560,h:900,hash:H(OYSTER),js:noCell},
    {name:'1560-occurrence-sea-cucumber-4deg',w:1560,h:900,hash:H(CUCUMBER)},
    {name:'1560-header-popover',w:1560,h:900,hash:H(OYSTER),js:"document.getElementById('notice-chip').click();"},
    {name:'1560-legend-open',w:1560,h:900,hash:H(OYSTER),js:"document.querySelector('.map-legend-more').open=true;"},
    {name:'1440-occurrence',w:1440,h:900,hash:H(OYSTER)},
    {name:'1281-occurrence',w:1281,h:800,hash:H(OYSTER)},
    {name:'1281-value',w:1281,h:800,hash:H(HIJIKI,'value')},
    {name:'1280-occurrence',w:1280,h:800,hash:H(OYSTER)},
    {name:'820-occurrence',w:820,h:1180,hash:H(OYSTER)},
    {name:'390-occurrence',w:390,h:844,mobile:true,hash:H(OYSTER)},
    {name:'390-value',w:390,h:844,mobile:true,hash:H(HIJIKI,'value')},
    {name:'390-sheet',w:390,h:844,mobile:true,hash:H(OYSTER),js:"window.scrollTo(0,420);",full:true},
  ],
};
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
  fs.mkdirSync(DIR,{recursive:true});
  for(const shot of SHOTS[SET]){
    if(ONLY&&!shot.name.includes(ONLY))continue;
    await send('Emulation.setDeviceMetricsOverride',{width:shot.w,height:shot.h,deviceScaleFactor:1,mobile:!!shot.mobile});
    await send('Emulation.setTouchEmulationEnabled',{enabled:!!shot.mobile});
    await send('Page.navigate',{url:'about:blank'});await sleep(200);
    await send('Page.navigate',{url:URL0+shot.hash});
    for(let i=0;i<120;i++){await sleep(250);if(await evaluate("typeof data!=='undefined'&&!!data?.species&&!!map&&!!selected").catch(()=>false))break;}
    await sleep(1200);
    if(shot.js){await evaluate(`(async()=>{${shot.js}})()`);await sleep(900);}
    const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:!!shot.full});
    fs.writeFileSync(path.join(DIR,shot.name+'.png'),Buffer.from(r.data,'base64'));
    console.log('shot',shot.name);
  }
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
