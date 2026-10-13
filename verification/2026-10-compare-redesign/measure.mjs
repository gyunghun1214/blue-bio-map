// Before/after values for the deep-sea '비교와 지표' redesign (2026-10-12). Same headless-Chrome approach as uicheck.mjs (no deps).
// node verification/2026-10-compare-redesign/measure.mjs <out.json>
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (as in uicheck.mjs).
// Everything under "data" must be identical before and after: values, labels, types and matrix placement of all species at
// BBVI food weights 0.25, 0.50 and 0.75, the table's value buttons, the matrix points' titles and the follow-up texts.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,SHOT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-compare-redesign/measure.mjs <out.json>');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const HASH='#s=274849&v=compare&b=satellite&t=occurrence&m=6%2F35.21%2F127.63'; // the production view named in the task
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

// Read inside the page at one weight. Functions only (no layout), plus the text the table, points and lists carry.
const READ=`async w=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms)), el=document.getElementById('bbvi-weight');
  if(typeof setBbviStep==='function')setBbviStep(Math.round(w*20));else{el.value=String(w);el.dispatchEvent(new Event('input'));}await wait(160); // the 2026-10-13 slider counts 0–20 steps
  const info=data.assessmentInfo||{};
  const species=data.species.map(s=>({aphia:s.aphiaID,label:s.label,name:s.name,group:s.group,catalog:!!s.catalog,
    axes:Object.fromEntries(['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return [k,{value:pilotScore(s,k),state:st.value,label:st.label,kind:st.kind,tag:axisTag(s,k,info)}]})),
    bbviLabel:bbviLabel(s)||null,placed:assessedForMatrix(s),type:matrixType(s),typeLabel:matrixType(s)?matrixTypeLabel(matrixType(s)):null,
    mcuiBasis:mcuiBasisLabel(s),separate:separateMcui(s),chips:evidenceChips(s).replace(/<[^>]+>/g,'|'),summary:scoreSummary(s),
    table:[...document.querySelectorAll('#comparison [data-score-aphia="'+s.aphiaID+'"]')].map(b=>[b.dataset.scoreAxis,b.textContent.replace(/\\s+/g,' ').trim(),b.getAttribute('aria-label')||''])}));
  const points=[...document.querySelectorAll('#matrix-points .matrix-point.pilot')].map(b=>[b.dataset.name,b.dataset.b,b.dataset.m,b.className.replace(/\\s+/g,' ').trim(),b.title,b.getAttribute('aria-label')||'']).sort((a,b)=>a[0].localeCompare(b[0],'ko'));
  const types=[...document.querySelectorAll('#matrix-types .mt-box')].map(x=>x.textContent.replace(/\\s+/g,' ').trim());
  return {weight:document.getElementById('bbvi-weight-value').textContent,status:document.getElementById('bbvi-weight-status').textContent,species,points,types,
    unplaced:document.getElementById('matrix-unplaced').textContent.replace(/\\s+/g,' ').trim()};
}`;
const FOLLOWUP=`(()=>data.species.map(s=>{showDecision(s);const t=document.getElementById('decision-detail').textContent.replace(/\\s+/g,' ').trim();return [s.aphiaID,t];}))()`;
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
  for(let i=0;i<120;i++){await sleep(250);if(await evaluate("typeof data!=='undefined'&&!!data?.species&&!!selected").catch(()=>false))break;}
  await sleep(1200);
  const opened=await evaluate("({s:selected.aphiaID,v:currentView})");
  const weights={};
  for(const w of [0.25,0.75,0.5])weights[w.toFixed(2)]=await evaluate(`(${READ})(${w})`);
  const followup=await evaluate(FOLLOWUP);
  const result={measuredAt:new Date().toISOString(),url:URL0+HASH,data:{opened,total:await evaluate('data.species.length'),weights,followup}};
  fs.mkdirSync(path.dirname(path.resolve(OUT)),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,1)+'\n');
  console.log('wrote',OUT);
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
