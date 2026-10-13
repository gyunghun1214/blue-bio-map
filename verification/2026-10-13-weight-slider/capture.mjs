// Screenshots of the BBVI 통합 가중치 slider (2026-10-13): 1440px and 390px, official / 식량 중심 / 신약 중심, value map badge.
// node verification/2026-10-13-weight-slider/capture.mjs <outdir>
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (as in uicheck.mjs).
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-13-weight-slider/capture.mjs <outdir>');fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
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

async function shot(name){
  const r=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));console.log('shot',name);
}
async function open(w,h,mobile,hash){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:mobile?2:1,mobile});
  await send('Page.navigate',{url:URL0+hash});
  for(let i=0;i<120;i++){await sleep(250);if(await evaluate("typeof data!=='undefined'&&!!data?.species&&!!selected").catch(()=>false))break;}
  await sleep(1500);
}
// the matrix with the basis popover open at one step (0–20), scrolled so the panel head is at the top
const compareAt=async (step,pop=true)=>{await evaluate(`(async()=>{const w=ms=>new Promise(f=>setTimeout(f,ms));setView('compare');setCompareMode('matrix');setBbviStep(${step});await w(400);
  setBasisPop(${pop});document.querySelector('.cmp-matrix-panel').scrollIntoView({block:'start'});scrollBy(0,-70);await w(300);return 1})()`);};
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
  await open(1440,1000,false,'#s=241776&v=compare');
  await compareAt(10);await shot('01-1440-official-panel');
  await compareAt(16);await shot('02-1440-food-0.8-panel');
  await compareAt(16,false);await shot('03-1440-food-0.8-matrix');
  await compareAt(4);await shot('04-1440-bio-0.8-panel');
  await evaluate("(async()=>{setBasisPop(false);setBbviStep(16);setCompareMode('table');await new Promise(f=>setTimeout(f,400));document.getElementById('cmp-table-view').scrollIntoView({block:'start'});scrollBy(0,-70);return 1})()");await sleep(300);await shot('05-1440-food-0.8-table');
  await evaluate("(async()=>{setCompareMode('matrix');setView('explore');setMapMode('value');await new Promise(f=>setTimeout(f,800));scrollTo(0,0);return 1})()");await sleep(500);await shot('06-1440-value-map-badge');
  await evaluate("setMapMode('occurrence');setBbviStep(10);1");
  await open(390,844,true,'#s=241776&v=compare');
  await compareAt(16);await shot('07-390-food-0.8-panel');
  await compareAt(16,false);await shot('08-390-food-0.8-matrix');
  await compareAt(10);await shot('09-390-official-panel');
}finally{try{ws?.close();}catch{}chrome.kill();}
