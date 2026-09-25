// Headless Chrome screenshots (no deps), same approach as uicheck.mjs.
// node verification/capture.mjs <outdir> <prefix>   -> <prefix>-{desktop,mobile}-{explore,compare}.png + map top at 390px
// node verification/capture.mjs <outdir> og         -> og.png (1200x630 explorer view, public cells only)
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,PREFIX]=process.argv.slice(2);fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/', PORT=process.env.CDP_PORT||9333;
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+PORT,'--no-first-run','--disable-gpu',
  '--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result.value;
async function load(w,h,mobile){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});
  await send('Page.navigate',{url:URL0});
  for(let i=0;i<80;i++){await sleep(250);if(/연결됨|저장된 사본/.test(await evaluate("document.getElementById('connection-state')?.textContent||''")))break;}
  await sleep(2500);
}
async function shot(name,clip){
  const m=await evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:!clip,clip:clip||{x:0,y:0,width:m.w,height:Math.min(m.h,6000),scale:1}});
  fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));
}
try{
  let wsUrl;for(let i=0;i<50&&!wsUrl;i++){try{const t=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();wsUrl=t.find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}if(!wsUrl)await sleep(200);}
  ws=new WebSocket(wsUrl);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await new Promise(r=>ws.onopen=r);await send('Page.enable');await send('Runtime.enable');
  if(PREFIX==='og'){
    await load(1200,1400,false);
    // Species with the most public cells; dots are schematic, no popup (no coordinates or record IDs on screen).
    await evaluate(`(()=>{const s=[...data.species].sort((a,b)=>b.cells.length-a.cells.length)[0];selectSpecies(s.aphiaID);map.closePopup();return s.label})()`);await sleep(2500);
    // 1200x630 of the explorer (list, map, detail) at 1x.
    const y=await evaluate(`Math.round(document.querySelector('.explorer').getBoundingClientRect().top+scrollY)`);
    await shot('og',{x:0,y,width:1200,height:630,scale:1});
  }else{
    for(const [label,w,h,mobile] of [['desktop',1440,1000,false],['mobile',390,844,true]]){
      await load(w,h,mobile);
      const top=await evaluate(`Math.round(document.getElementById('map').getBoundingClientRect().top+scrollY)`);
      console.log(`${label} map top: ${top}px`);
      await shot(`${PREFIX}-${label}-explore`);
      await evaluate(`document.querySelector('[data-view=compare]').click();1`);await sleep(800);
      await shot(`${PREFIX}-${label}-compare`);
    }
  }
}finally{ws?.close();chrome.kill();}
