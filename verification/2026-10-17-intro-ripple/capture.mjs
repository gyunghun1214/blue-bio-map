// The ripple loader (2026-10-17): screenshots of loading / mid-reveal / after at 1440×900, 1280×720 and a 390×844 phone,
// and browser checks of what the node test cannot see (timing, the 7 s limit, still, shared link, same-tab reload, failed
// data, overlap, scrolling). Headless Chrome over the DevTools protocol, no deps (the uicheck.mjs approach).
// Data requests are held with the Fetch domain so the loader can be caught; for the mid-reveal shots only, intro.js is
// served with GATE_FADE_MS 360 → 6000 (and the maximum moved to match) so a frame of the 0.36 s reveal can be taken.
// Run: python -m http.server 8765 --bind 127.0.0.1 --directory dist, then
//      node verification/2026-10-17-intro-ripple/capture.mjs <out-dir>   (CHROME_PATH: a Chrome or Chromium)
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const OUT=process.argv[2]||'verification/2026-10-17-intro-ripple';fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--hide-scrollbars','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let url=null;
for(let i=0;i<300&&!url;i++){try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  url=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}if(!url)await sleep(200);}
const ws=new WebSocket(url);let id=0;const pending=new Map(),listeners=[],errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  for(const l of listeners)l(m);};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));};
await send('Page.enable');await send('Runtime.enable');
const results=[];const check=(name,ok,detail='')=>{results.push([ok,name]);console.log(ok?'PASS':'FAIL',name,ok?'':detail);};

// held: data requests waiting for release(); mode: 'hold' | 'fail' | 'pass'; slow: serve the slowed intro.js
let held=[],mode="pass",slow=false,failId=null;
listeners.push(async m=>{
  if(m.method!=='Fetch.requestPaused')return;const p=m.params,u=p.request.url;
  try{
    if(/intro\.js/.test(u)&&p.responseStatusCode){
      const b=await send('Fetch.getResponseBody',{requestId:p.requestId});let s=b.base64Encoded?Buffer.from(b.body,'base64').toString('utf8'):b.body;
      if(slow)s=s.replace('GATE_MAX_MS=7000, GATE_FADE_MS=360','GATE_MAX_MS=60000, GATE_FADE_MS=6000');
      return send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from(s).toString('base64')});
    }
    if(mode==='fail')return send('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'});
    if(mode==='hold')return held.push(p.requestId);
    return send('Fetch.continueRequest',{requestId:p.requestId});
  }catch{}
});
const release=async()=>{const h=held;held=[];mode='pass';for(const r of h)await send('Fetch.continueRequest',{requestId:r}).catch(()=>{});};
// the data the entry screen waits for: the map outline and the species collection (the production API is out of reach
// here, so its two reads are answered from live-snapshot.json like uicheck's FIXTURE)
await send('Fetch.enable',{patterns:[{urlPattern:'*intro.js*',requestStage:'Response'},{urlPattern:'*countries.json*'},{urlPattern:'*live-snapshot.json*'},{urlPattern:'*/rest/v1/*'}]});
const fx=fs.readFileSync(new URL('../../dist/live-snapshot.json',import.meta.url),'utf8');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};const reply=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));
  window.fetch=(o=>(u,...a)=>{const s=String(u);if(window.__failApi&&s.includes('/rest/v1/'))return Promise.reject(Error('off'));if(s.includes('/rest/v1/species_profiles'))return reply('profiles');if(s.includes('/rest/v1/species_map_cells'))return reply('cells');return o(u,...a);})(window.fetch);}`});
const state=()=>evaluate(`(()=>{const g=document.getElementById('site-gate'),l=g.querySelector('.gate-loader'),b=g.querySelector('.gate-loader-body').getBoundingClientRect(),m=g.querySelector('.gate-motion').getBoundingClientRect();
  const top=document.elementFromPoint(m.left+m.width/2,m.top+m.height/2);
  return {on:document.documentElement.classList.contains('gate-on'),hidden:g.hidden,ready:g.classList.contains('is-ready'),revealing:g.classList.contains('is-revealing'),loader:!l.hidden,
    step:g.querySelector('.gate-step').textContent,note:g.querySelector('.gate-note').hidden?'':g.querySelector('.gate-note').textContent,still:g.classList.contains('is-still'),
    body:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},motto:(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,h:r.height}))(g.querySelector('.gate-motto').getBoundingClientRect()),
    switchOnTop:!!top?.closest?.('.gate-motion'),inertBehind:[...g.querySelectorAll('.gate-hero>*:not(.gate-bar),.gate-bar>*:not(.gate-motion)')].every(n=>n.inert),
    focus:document.activeElement?.id||document.activeElement?.className||'',vw:innerWidth,vh:innerHeight,sw:document.documentElement.scrollWidth,sh:g.scrollHeight,locked:getComputedStyle(document.documentElement).overflow==='hidden',loaderScroll:l.scrollHeight<=innerHeight,
    ripple:(c=>({w:c.width,h:c.height,on:c.classList.contains('is-on')}))(g.querySelector('.gate-ripple'))};})()`);
const waitFor=async(f,ms=10000)=>{const t=Date.now();let s={};do{try{s=await state();if(f(s))return s;}catch{/* the page is still starting */}await sleep(40);}while(Date.now()-t<ms);return s;};
async function open(w,h,phone,{hash='',reduce=false,keep=false}={}){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:phone?2:1,mobile:phone});
  await send('Emulation.setTouchEmulationEnabled',{enabled:phone});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]});
  if(!keep)await evaluate("try{sessionStorage.clear();localStorage.clear()}catch{};1").catch(()=>{});
  const t0=Date.now();await send('Page.navigate',{url:URL0+hash});return t0;
}
const tag=(w,h)=>`${w}x${h}`;

// 1) the three sizes: loading (data held), mid-reveal (slowed), after
for(const [w,h,phone] of [[1440,900,false],[1280,720,false],[390,844,true]]){
  slow=false;mode='hold';await open(w,h,phone);
  let s=await waitFor(s=>s.on&&s.ripple.on);await sleep(900);s=await state();
  await shot(`${tag(w,h)}-1-loading`);
  check(`${tag(w,h)} loading: whole-screen loader, the switch on top, everything else behind it out of reach, no scroll`,
    s.loader&&!s.ready&&s.switchOnTop&&s.inertBehind&&s.sw<=s.vw&&s.sh<=s.vh&&s.locked&&s.loaderScroll&&s.ripple.w>0&&s.focus==='gate-loader',JSON.stringify(s));
  // the words stay out of the ripples' band (the lower 40%, from 0.59 h) and inside the width
  check(`${tag(w,h)} loading: logo, line and step above the ripples (bottom ${Math.round(s.body.bottom/h*100)}% of the height), inside the width`,
    s.body.bottom<=h*.59&&s.motto.left>=0&&s.motto.right<=w,JSON.stringify(s));
  if(phone)check('phone: the line in two lines, 24 px or more from the edges',s.motto.h>60&&s.motto.left>=24&&w-s.motto.right>=24,JSON.stringify(s.motto));
  await release();s=await waitFor(s=>s.ready);
  await sleep(400);await shot(`${tag(w,h)}-3-after`);
  check(`${tag(w,h)} after: entry screen open, loader gone, nothing inert, button focused (desktop)`,s.ready&&!s.loader&&!s.revealing&&!s.inertBehind&&(phone||s.focus==='gate-enter'),JSON.stringify(s));
  // mid-reveal, slowed (6 s instead of 0.36 s): a third (words gone, sea going) and a half (rings closing onto the rim)
  slow=true;mode='hold';await open(w,h,phone);await waitFor(s=>s.on&&s.ripple.on);await sleep(700);await release();
  s=await waitFor(s=>s.revealing);const t=Date.now();
  await sleep(Math.max(0,2400-(Date.now()-t)));await shot(`${tag(w,h)}-2-reveal-40`);
  await sleep(Math.max(0,3400-(Date.now()-t)));await shot(`${tag(w,h)}-2-reveal-57`);
  s=await state();check(`${tag(w,h)} reveal: nothing usable until it ends (the screen under it still inert)`,s.revealing&&!s.ready&&s.inertBehind,JSON.stringify(s));
}
slow=false;

// 2) fast data: about 0.6 s of loader, then 0.36 s; the step says what was loaded
{ mode='pass';const t0=await open(1440,900,false);const s=await waitFor(s=>s.ready,8000);const ms=Date.now()-t0;
  check(`fast data: open ${ms} ms after navigation (0.6 s minimum + 0.36 s reveal + page start), step = the species total`,s.ready&&ms<2500&&/^해양생물 \d+종 자료를 불러왔어요$/.test(s.step),JSON.stringify({ms,step:s.step})); }
// 3) data that never comes: the loader is gone by 7 s and the step does not say done
{ mode='hold';const t0=await open(1440,900,false);let s=await waitFor(s=>s.revealing||s.ready,9000);const t1=Date.now()-t0;
  s=await waitFor(s=>s.ready,3000);const t2=Date.now()-t0;await shot('timeout-7s');
  check(`no data: reveal from ${t1} ms, entry screen open at ${t2} ms (≤ 7 s + page start), step not '불러왔어요', note says it keeps loading`,
    s.ready&&!s.loader&&t2<=7600&&t1>=6400&&!/불러왔어요/.test(s.step)&&/계속 불러오는 중/.test(s.note),JSON.stringify({t1,t2,step:s.step,note:s.note}));
  await release(); }
// 4) failed data: the step never says loaded; the note says so on the entry screen; Enter still enters
{ mode='fail';await evaluate("1");await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__failApi=true'}).then(r=>failId=r.identifier);
  await open(1440,900,false);let s=await waitFor(s=>s.ready,9000);await shot('failed-data');
  check(`failed data: step '${s.step}' (not 불러왔어요), note on the entry screen`,s.ready&&!/불러왔어요/.test(s.step)&&/불러오지 못했어요/.test(s.note),JSON.stringify(s));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:failId});mode='pass'; }
// 5) still (prefers-reduced-motion): the ripples stand, no reveal animation, the steps still change
{ mode='hold';await open(1440,900,false,{reduce:true});let s=await waitFor(s=>s.on&&s.still&&s.ripple.w>0);await sleep(500);
  const a=await evaluate("document.querySelector('.gate-ripple').toDataURL()");await sleep(700);const b=await evaluate("document.querySelector('.gate-ripple').toDataURL()");
  await shot('still-loading');
  const op=await evaluate("getComputedStyle(document.querySelector('.gate-ripple')).opacity");
  check('still: one standing picture of the ripples (no frame-to-frame change), fully shown at once',a===b&&a.length>2000&&op==='1',JSON.stringify({same:a===b,op}));
  await release();s=await waitFor(s=>s.ready||s.revealing,5000);const s2=await state();
  check('still: straight from the loader to the entry screen, no reveal phase, the step changed with the data',s2.ready&&!s2.revealing&&/불러왔어요/.test(s2.step),JSON.stringify(s2)); }
// 6) a shared link: no loader at all, from the first paint
{ mode='pass';await open(1440,900,false,{hash:'#s=241776&v=compare'});await sleep(150);
  const s=await evaluate("({on:document.documentElement.classList.contains('gate-on'),hidden:document.getElementById('site-gate').hidden})");
  check('shared link (#s=…): no loader, the map page at once',!s.on&&s.hidden,JSON.stringify(s)); }
// 7) the same tab: once entered, a reload opens the map directly
{ mode='pass';await open(1440,900,false);await waitFor(s=>s.ready);await evaluate("document.getElementById('gate-enter').click();1");await sleep(1200);
  await open(1440,900,false,{keep:true});await sleep(300);
  const s=await evaluate("({on:document.documentElement.classList.contains('gate-on'),hidden:document.getElementById('site-gate').hidden})");
  check('same tab after entering: a reload skips the loader',!s.on&&s.hidden,JSON.stringify(s)); }
// 8) keys during the loader do nothing; the motion switch works over it
{ mode='hold';await open(1440,900,false);await waitFor(s=>s.on);await sleep(300);
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await sleep(200);let s=await state();
  const r=await evaluate("(r=>({x:r.left+r.width/2,y:r.top+r.height/2}))(document.querySelector('.gate-motion').getBoundingClientRect())");
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:r.x,y:r.y,button:'left',clickCount:1});
  await sleep(200);const s2=await state();await shot('switch-during-loading');
  check('during the loader: Enter does not enter; clicking the switch turns motion off over the loader',s.on&&!s.ready&&!s.hidden&&s2.still&&s2.loader,JSON.stringify({s,s2}));
  await release();await evaluate("localStorage.clear();1"); }
console.log(errors.length?'page errors: '+errors.join(' | '):'no page errors');
console.log(`${results.filter(r=>r[0]).length}/${results.length} passed`);
fs.writeFileSync(path.join(OUT,'results.txt'),results.map(([ok,n])=>(ok?'PASS ':'FAIL ')+n).join('\n')+`\n${errors.length?'page errors: '+errors.join(' | '):'no page errors'}\n`);
ws.close();chrome.kill();process.exit(results.every(r=>r[0])&&!errors.length?0:1);
