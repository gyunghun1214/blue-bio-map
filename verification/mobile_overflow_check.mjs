// Phone widths 360/390/430: no page-wide sideways scroll and nothing cut off at the right edge, headless Chrome via
// DevTools (no deps). States: entry screen (with the phone's '지도 바로 열기'), map and filters, species detail, compare
// matrix and data table, the chatbot, and the sea expedition (first screen, sailing, stop list, detail sheet).
// A box inside its own sideways scroller (chip rows, tables) is allowed; the page itself must not scroll, and
// `overflow-x:hidden` on the page does not hide a cut-off button (any visible element past the right edge fails).
// On a failure it prints the state, the element and its right edge, and saves a screenshot.
// Usage: node verification/mobile_overflow_check.mjs <output-directory>   (site served at URL0, default http://127.0.0.1:8765/)
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const OUT=process.argv[2];
if(!OUT)throw Error('Usage: node verification/mobile_overflow_check.mjs <output-directory>');
fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0,passed=0;

async function session(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
  const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let wsUrl;
  for(let i=0;i<300&&!wsUrl;i++){
    try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();wsUrl=t.find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}
    if(!wsUrl)await sleep(200);
  }
  if(!wsUrl)throw Error('Chrome DevTools endpoint timeout');
  const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));setTimeout(()=>{if(pending.has(i)){pending.delete(i);rej(Error(method+' timeout'));}},60000);});
  const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  const close=async()=>{ws.close();chrome.kill();await sleep(500);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}};
  return {send,evaluate,close};
}
async function waitFor(s,expr,timeout=30000){
  const end=Date.now()+timeout;let v;
  do{v=await s.evaluate(expr).catch(()=>null);if(v)return v;await sleep(150);}while(Date.now()<end);
  return v;
}
// What sticks out: the page's scroll width, and visible elements past the right edge that no ancestor clips or scrolls.
const OVER=`(()=>{
  const de=document.documentElement,cw=de.clientWidth,out=[];
  const vis=e=>{const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('[hidden],[inert]');};
  const kept=e=>{for(let p=e.parentElement;p&&p!==document.body&&p!==de;p=p.parentElement)if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX))return true;return false;};
  const name=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\\s+/).slice(0,2).join('.'):'');
  for(const e of document.body.querySelectorAll('*')){if(!vis(e))continue;const r=e.getBoundingClientRect();if(r.right>cw+1&&!kept(e)){out.push(name(e)+' right='+Math.round(r.right));if(out.length>=5)break;}}
  return {sw:de.scrollWidth,cw,out};
})()`;
async function check(s,state){
  const m=await s.evaluate(OVER);
  const ok=m.sw<=m.cw&&!m.out.length;
  if(ok)passed++;else{failed++;const file=state.replace(/[^\w-]+/g,'_');
    const r=await s.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,file+'.png'),Buffer.from(r.data,'base64'));}
  console.log(`${ok?'PASS':'FAIL'} ${state}${ok?'':` :: scrollWidth ${m.sw} > ${m.cw} or past the edge: ${m.out.join(', ')||'-'}`}`);
}
const click=(s,sel)=>s.evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true})()`);

for(const w of [360,390,430]){
  const s=await session();
  try{
    await s.send('Emulation.setDeviceMetricsOverride',{width:w,height:844,deviceScaleFactor:1,mobile:true});
    await s.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    // main page, first visit (fresh profile): the entry screen and its phone button
    await s.send('Page.navigate',{url:URL0});
    const quick=await waitFor(s,`(()=>{const b=document.querySelector('.gate-quick');return !!b&&b.getBoundingClientRect().height>=44})()`,15000);
    if(quick)passed++;else failed++;
    console.log(`${quick?'PASS':'FAIL'} ${w} entry: '지도 바로 열기' shows (44px) while the screen is up`);
    await check(s,`${w} entry screen`);
    await click(s,'.gate-quick');
    const open=await waitFor(s,`document.getElementById('site-gate').hidden&&document.activeElement===document.querySelector('main')`,5000);
    if(open)passed++;else failed++;
    console.log(`${open?'PASS':'FAIL'} ${w} entry: the button opens the map at once (screen gone, focus on main)`);
    await waitFor(s,`/연결됨|저장된 사본/.test(document.getElementById('connection-state')?.textContent||'')`,30000);await sleep(1200);
    await check(s,`${w} map and filters`);
    await s.evaluate(`selectSpecies(data.species[0].aphiaID)`);await sleep(1000);
    await check(s,`${w} species detail`);
    await s.evaluate(`setView('compare')`);await sleep(1200);
    await check(s,`${w} compare matrix`);
    await click(s,'[data-cmp-mode="table"]');await sleep(1000);
    await check(s,`${w} compare data table (cards)`);
    await s.evaluate(`setView('explore')`);await sleep(600);
    if(await click(s,'.bbc-fab')){await sleep(900);await check(s,`${w} chatbot open`);await click(s,'.bbc-close');await sleep(400);await check(s,`${w} chatbot closed`);}
    // sea expedition
    await s.send('Page.navigate',{url:new URL('expedition.html',URL0).href});
    await waitFor(s,`!!document.getElementById('start')&&!document.body.classList.contains('is-loading')`,20000);await sleep(1200);
    await check(s,`${w} expedition first screen`);
    await click(s,'#start');await sleep(2500);
    await check(s,`${w} expedition sailing`);
    await click(s,'#list-toggle');await sleep(700);
    await check(s,`${w} expedition stop list`);
    await click(s,'#stop-list [data-detail]');await sleep(1000);
    await check(s,`${w} expedition detail sheet`);
  }finally{await s.close();}
}
console.log(`${failed?'FAIL':'PASS'}: mobile overflow ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
