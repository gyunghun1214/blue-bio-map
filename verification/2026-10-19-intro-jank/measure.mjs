// How smooth the first visit's 8 s piece (dist/intro.js INTRO_TIMELINE: drop → rings → globe) runs, measured as a visitor
// sees it: Chrome on screen (not headless, so the page is visible and the real GPU draws it), a new profile, the page's own
// frames (rAF) grouped into 1 s buckets from the intro:start mark: frames, frames over 33 ms and 100 ms, the longest gap,
// how long the main thread was held (a timer probe every 8 ms, and the long animation frames with their scripts). With
// --trace, Chrome's own trace of the same run: how busy each thread was in each second (the GPU process's main thread
// included) and, for every gap over 50 ms, what each thread was doing during it, by name. With --layers (a separate run,
// it slows the page), the composited layers at 2, 5, 7.5 and 9.5 s and how often each was painted per second.
// No dependencies (the DevTools protocol over Node's WebSocket, like uicheck.mjs). Run with the site on 127.0.0.1:8765:
//   python -m http.server 8765 --bind 127.0.0.1 --directory dist
//   node verification/2026-10-19-intro-jank/measure.mjs <out-dir> [--size 577x549|1920x1080|max] [--runs 3] [--trace]
//        [--layers] [--label before] [--url http://127.0.0.1:8765/] [--dpr 1.5] [--headless] [--hwgl] [--ablate nomask,nosea,…]
//        [--css "…"] [--js "…"]
// --size: the page's inner size (the window is fitted to it), or max (maximized). --runs: one profile for all runs, so
// run 1 has cold caches (HTTP, GPU shaders) and the rest warm ones, as on a second visit. --dpr: forces the pixel ratio
// (otherwise the screen's). --hwgl: tells the page its WebGL is a GPU (a container's SwiftShader would make intro.js keep
// the still picture). --ablate: nomask (no mask on the loader), noripple, nosea, nohero (those layers hidden), noshadow (canvas
// shadowBlur ignored), nodash (setLineDash ignored); --css / --js: anything else put in front of the page.
// CHROME_PATH: Chrome or Chromium (default: the usual Chrome on Windows, google-chrome elsewhere); CHROME_FLAGS: more flags.
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';

const argv=process.argv.slice(2),OUT=argv[0];
if(!OUT||OUT.startsWith('--'))throw Error('Usage: node measure.mjs <out-dir> [--size WxH|max] [--runs N] [--trace] [--layers] [--label L] [--url U]');
const opt=(k,d)=>{const i=argv.indexOf('--'+k);return i<0?d:argv[i+1]!==undefined&&!argv[i+1].startsWith('--')?argv[i+1]:true;};
const URL0=opt('url','http://127.0.0.1:8765/'),SIZE=String(opt('size','577x549')),RUNS=Number(opt('runs',3)),LABEL=String(opt('label','run'));
const TRACE=!!opt('trace',false),LAYERS=!!opt('layers',false),HEADLESS=!!opt('headless',false),HWGL=!!opt('hwgl',false),DPR=opt('dpr',null);
// --ablate a,b: switch parts off by name (the same ablations as the 2026-10-19 report, without quoting CSS on a command line)
const ABLATE={nomask:{css:'.gate-loader{-webkit-mask-image:none!important;mask-image:none!important}'},noripple:{css:'.gate-ripple{display:none!important}'},
  nosea:{css:'.gate-sea{visibility:hidden!important}'},nohero:{css:'.gate-hero{visibility:hidden!important}'},
  noshadow:{js:"Object.defineProperty(CanvasRenderingContext2D.prototype,'shadowBlur',{get(){return 0;},set(){},configurable:true});"},
  nodash:{js:'CanvasRenderingContext2D.prototype.setLineDash=function(){};'}};
const ablate=String(opt('ablate','')).split(',').filter(Boolean);for(const a of ablate)if(!ABLATE[a])throw Error('--ablate: one of '+Object.keys(ABLATE).join(', '));
const CSS=[opt('css',''),...ablate.map(a=>ABLATE[a].css)].filter(Boolean).join('\n'),JS=[opt('js',''),...ablate.map(a=>ABLATE[a].js)].filter(Boolean).join('\n');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');

// ---- the page side: put in before any of the page's own scripts ----
// every frame's rAF time, a timer every 8 ms (how late it runs is time the main thread was held), visibility changes, the
// long animation frames (with the scripts in them), and a mark that ties the page's clock to the trace's
const RECORDER=`(()=>{if(window.__jank)return;const T=window.__jank={raf:[],lag:[],vis:[[performance.now(),document.visibilityState]],loaf:[]};
const until=performance.now()+30000;const f=t=>{T.raf.push(t);if(t<until)requestAnimationFrame(f);};requestAnimationFrame(f);
let due=performance.now()+8;const p=()=>{const n=performance.now();T.lag.push([n,Math.max(0,n-due)]);due=n+8;if(n<until)setTimeout(p,8);};setTimeout(p,8);
document.addEventListener('visibilitychange',()=>T.vis.push([performance.now(),document.visibilityState]));
try{new PerformanceObserver(l=>{for(const e of l.getEntries())T.loaf.push({start:e.startTime,dur:e.duration,block:e.blockingDuration,render:e.renderStart,style:e.styleAndLayoutStart,
  scripts:(e.scripts||[]).map(s=>({src:String(s.sourceURL||s.name||'').split('/').pop(),fn:s.sourceFunctionName,dur:Math.round(s.duration)}))});}).observe({type:'long-animation-frame',buffered:true});}catch{}
performance.mark('jank:sync');})();`;
// a GPU name for the page (the drawing stays SwiftShader's): verification/2026-10-landing-globe-motion/motion_check.mjs
const HW_GL="{for(const P of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){const o=P.prototype.getParameter;P.prototype.getParameter=function(p){return p===0x9246?'measure GPU':o.call(this,p);};}}";
// a style sheet in front of the page's own: the document has no element yet when this runs, so it waits for <html>
const STYLE=css=>`{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};const add=()=>{const r=document.head||document.documentElement;if(!r)return false;r.appendChild(s);return true;};
  if(!add()){const mo=new MutationObserver(()=>{if(add())mo.disconnect();});mo.observe(document,{childList:true,subtree:true});}}`;
// what the page used: the GPU's name (a context of its own), the globe's files, the marks, the screen
const ABOUT=`(()=>{const m=n=>performance.getEntriesByName(n)[0]?.startTime??null;let gpu='';try{const c=document.createElement('canvas').getContext('webgl');const d=c.getExtension('WEBGL_debug_renderer_info');gpu=String(c.getParameter(d?d.UNMASKED_RENDERER_WEBGL:c.RENDERER));}catch{}
  const res=performance.getEntriesByType('resource').map(r=>r.name);
  return {marks:Object.fromEntries(['jank:sync','intro:start','intro:done','bbvm-globe-drawn','bbvm-globe-gl-ready','bbvm-globe-decoded','bbvm-globe-gl-failed'].map(n=>[n,m(n)])),
    globe:res.some(u=>/globe-v3\\//.test(u))&&m('bbvm-globe-gl-ready')!==null?'WebGL (globe-v3)':res.some(u=>/globe-v2\\//.test(u))?'사진 (globe-v2)':'?',
    gpu,dpr:devicePixelRatio,w:innerWidth,h:innerHeight,screen:[screen.width,screen.height],focus:document.hasFocus(),ua:navigator.userAgent,
    canvases:[...document.querySelectorAll('#site-gate canvas')].map(c=>c.className+' '+c.width+'×'+c.height),...window.__jank};})()`;

// ---- Chrome over the DevTools protocol: one browser connection, the page as a flat session ----
async function launch(profile,run){
  const flags=['--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync',
    '--disable-default-apps','--disable-component-update','--disable-background-networking',
    // keep frames coming while a terminal or another window overlaps this one (Windows marks covered windows hidden)
    '--disable-features=CalculateNativeWinOcclusion,Translate,MediaRouter,OptimizationHints',
    '--window-position=0,0','--window-size=1000,800','--user-data-dir='+profile,
    ...(HEADLESS?['--headless=new']:[]),...(DPR?['--force-device-scale-factor='+DPR]:[]),
    // as root (a container): no sandbox, and --test-type keeps its warning bar off the top of the page
    ...(process.getuid?.()===0?['--no-sandbox','--test-type']:[]),...(process.env.CHROME_FLAGS||'').split(/\s+/).filter(Boolean),'about:blank'];
  try{fs.rmSync(path.join(profile,'DevToolsActivePort'),{force:true});}catch{} // the last run's port, when the profile is kept
  const chrome=spawn(chromePath,flags,{stdio:['ignore','ignore','pipe']});let err='';chrome.stderr.on('data',d=>{err=(err+d).slice(-4000);});
  let port=0;
  for(let i=0;i<300&&!port;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0])||0;}catch{}if(!port)await sleep(200);}
  if(!port)throw Error('Chrome DevTools port timeout: '+err.slice(-800));
  const ver=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws=new WebSocket(ver.webSocketDebuggerUrl);let id=0;const pending=new Map(),handlers=new Set();
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(p.method+': '+m.error.message)):p.res(m.result);return;}
    for(const h of handlers)h(m);};
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(Error('WebSocket error'));});
  const send=(method,params={},sessionId,ms=30000)=>new Promise((res,rej)=>{const i=++id;
    const timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},ms);pending.set(i,{res,rej,timer,method});
    ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
  // what chrome://gpu would say: the features drawn by the GPU, the device and driver, ANGLE's backend
  let gpu={};try{const g=(await send('SystemInfo.getInfo')).gpu,a=g.auxAttributes||{};
    gpu={features:g.featureStatus,device:(g.devices||[]).filter(d=>d.active!==false).map(d=>`${d.vendorString||d.vendorId} ${d.deviceString||d.deviceId} ${d.driverVersion||''}`).join(' / '),
      gl:[a.glRenderer,a.glVersion,a.displayType,a.skiaBackendType].filter(Boolean).join(' · ')};}catch{}
  const targets=(await send('Target.getTargets')).targetInfos,page=targets.find(t=>t.type==='page');
  const {sessionId}=await send('Target.attachToTarget',{targetId:page.targetId,flatten:true});
  const S=(m,p,ms)=>send(m,p,sessionId,ms);
  const evaluate=async e=>{const r=await S('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
  await S('Page.enable');await S('Runtime.enable');
  const errors=[];handlers.add(m=>{if(m.sessionId!==sessionId)return;
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
  // the page's size: the window fitted until the page inside it is the size asked for (or maximized)
  if(HEADLESS){const [w,h]=SIZE==='max'?[1920,1080]:SIZE.split('x').map(Number);
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:Number(DPR)||1,mobile:false});}
  else{const {windowId}=await send('Browser.getWindowForTarget',{targetId:page.targetId});
    if(SIZE==='max')await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'maximized'}});
    else{const [w,h]=SIZE.split('x').map(Number),{bounds:o}=await send('Browser.getWindowBounds',{windowId});
      // the window's frame and toolbar: the outer size less the inner one; a fractional pixel ratio can leave 1 px over
      let [iw,ih]=await evaluate('[innerWidth,innerHeight]'),b={width:o.width+w-iw,height:o.height+h-ih};
      for(let i=0;i<6&&(Math.abs(iw-w)>1||Math.abs(ih-h)>1);i++){await send('Browser.setWindowBounds',{windowId,bounds:{left:0,top:0,...b}});await sleep(400);
        [iw,ih]=await evaluate('[innerWidth,innerHeight]');if(process.env.SIZE_DEBUG)console.log('size',i,JSON.stringify(b),iw,ih);b={width:b.width+w-iw,height:b.height+h-ih};}
      if(Math.abs(iw-w)>1||Math.abs(ih-h)>1)console.log(`(the page came out ${iw}×${ih}, not ${w}×${h}: the window manager or the pixel ratio)`);}
    await sleep(500);}
  await S('Page.bringToFront');
  const close=async()=>{try{await send('Browser.close',{},undefined,5000);}catch{}try{ws.close();}catch{}chrome.kill();await sleep(800);};
  return {send,S,evaluate,errors,handlers,sessionId,close,run,gpu};
}

// ---- reading a run: buckets from intro:start ----
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2:null;};
function buckets(info,from=0,to=12){
  const t0=info.marks['intro:start'];if(t0===null)return null;
  const raf=info.raf,rows=[];
  for(let k=from;k<to;k++){
    const a=t0+k*1000,b=a+1000,iv=[];
    for(let i=1;i<raf.length;i++)if(raf[i]>=a&&raf[i]<b)iv.push(raf[i]-raf[i-1]);
    const lag=info.lag.filter(([n])=>n>=a&&n<b).map(([,l])=>l);
    rows.push({s:k,frames:iv.length,over33:iv.filter(x=>x>33.4).length,over100:iv.filter(x=>x>100).length,max:iv.length?Math.round(Math.max(...iv)):null,
      held:Math.round(lag.reduce((x,y)=>x+y,0)),heldMax:lag.length?Math.round(Math.max(...lag)):null});
  }
  return rows;
}
// gaps between frames over ms, in page time, from 1 s before intro:start
const gapsOf=(info,ms)=>{const t0=info.marks['intro:start'],out=[];for(let i=1;i<info.raf.length;i++){const d=info.raf[i]-info.raf[i-1];
  if(d>ms&&info.raf[i]>t0-1000)out.push({from:info.raf[i-1],to:info.raf[i],dur:d,at:(info.raf[i-1]-t0)/1000});}return out;};

// ---- the trace: busy time per thread and second, what ran during each gap ----
const COMPILE=/compile|Compile|::link|Link\b|LinkProgram|ProgramCache|ShaderCache::load|GraphicsPipeline|ComputePipeline|PipelineCache|D3DCompile|ShaderTranslate|precompile/;
const WRAP=/^(ThreadControllerImpl::RunTask|ThreadPool_RunTask|RunTask|TaskQueueManager::ProcessTaskFromWorkQueue|SequenceManager::.*|MessageLoop::RunTask|Receive mojo message|.*::OnMessageReceived|ScheduledTasks|ThreadController active|ThreadPoolForegroundWorker.*|TaskGraphRunner::RunTask)$/;
function analyzeTrace(events,info){
  const tn=new Map(),pn=new Map();
  for(const e of events)if(e.ph==='M'){if(e.name==='thread_name')tn.set(e.pid+':'+e.tid,e.args?.name||'?');if(e.name==='process_name')pn.set(e.pid,e.args?.name||'?');}
  // page clock → trace clock: the jank:sync mark (on the page's main thread, which also names the renderer)
  const sync=events.find(e=>e.name==='jank:sync'&&(e.cat||'').includes('user_timing'));
  if(!sync)return {error:'no jank:sync mark in the trace'};
  const off=sync.ts-info.marks['jank:sync']*1000,T=ms=>ms*1000+off,t0=T(info.marks['intro:start']),rpid=sync.pid;
  const label=k=>{const [pid]=k.split(':').map(Number),p=pn.get(pid)||'?',t=tn.get(k)||'?';
    return (pid===rpid?'Renderer':/gpu/i.test(p)?'GPU':/browser/i.test(p)?'Browser':p)+'/'+t.replace(/\d+$/,'');};
  // complete events per thread (B/E pairs folded in), then self time by nesting
  const per=new Map(),open=new Map();
  const add=(k,e)=>{let a=per.get(k);if(!a)per.set(k,a=[]);a.push(e);};
  for(const e of events){const k=e.pid+':'+e.tid;
    if(e.ph==='X'&&e.dur>0)add(k,{name:e.name,ts:e.ts,dur:e.dur,args:e.args});
    else if(e.ph==='B'){let s=open.get(k);if(!s)open.set(k,s=[]);s.push(e);}
    else if(e.ph==='E'){const b=open.get(k)?.pop();if(b)add(k,{name:b.name,ts:b.ts,dur:e.ts-b.ts,args:b.args});}}
  const lanes=new Map(); // label → [{name,ts,dur,self,top}]
  for(const [k,list] of per){list.sort((a,b)=>a.ts-b.ts||b.dur-a.dur);const st=[];
    for(const e of list){while(st.length&&st[st.length-1].ts+st[st.length-1].dur<=e.ts)st.pop();e.self=e.dur;e.top=!st.length;
      if(st.length)st[st.length-1].self-=Math.min(e.dur,st[st.length-1].ts+st[st.length-1].dur-e.ts);st.push(e);}
    const l=label(k);lanes.set(l,(lanes.get(l)||[]).concat(list));}
  const overlap=(e,a,b)=>Math.max(0,Math.min(e.ts+e.dur,b)-Math.max(e.ts,a));
  // busy (top-level tasks) per second for every thread that did anything from 1 s before intro:start to 12 s after
  const busy={};
  for(const [l,list] of lanes){const row=[];for(let s=-1;s<12;s++){const a=t0+s*1e6,b=a+1e6;row.push(Math.round(list.filter(e=>e.top).reduce((x,e)=>x+overlap(e,a,b),0)/1000));}
    if(row.reduce((x,y)=>x+y,0)>30)busy[l]=row;}
  // self time by name in a window, per thread (generic task wrappers left out)
  const selfIn=(list,a,b,n=8)=>{const m=new Map();for(const e of list){if(WRAP.test(e.name))continue;const o=overlap(e,a,b);if(o<=0)continue;
      m.set(e.name,(m.get(e.name)||0)+e.self*o/e.dur);}
    return [...m].sort((x,y)=>y[1]-x[1]).slice(0,n).filter(([,v])=>v>=500).map(([k,v])=>[k,Math.round(v/100)/10]);};
  const windows={};for(const [name,[a,b]] of Object.entries({'1-4s':[1,4],'4-6s':[4,6],'6-8s':[6,8],'8-10s':[8,10]})){
    windows[name]={};for(const [l,list] of lanes)if(busy[l]){const top=selfIn(list,t0+a*1e6,t0+b*1e6);if(top.length)windows[name][l]=top;}}
  // every gap over 50 ms: what each thread did in it, and its longest single events
  const gaps=gapsOf(info,50).map(g=>{const a=T(g.from),b=T(g.to),threads={};
    for(const [l,list] of lanes){const top=selfIn(list,a,b,6),long=list.filter(e=>overlap(e,a,b)>(b-a)*.3&&!WRAP.test(e.name)).sort((x,y)=>y.dur-x.dur).slice(0,3)
      .map(e=>[e.name,Math.round(e.dur/1000),Math.round((e.ts-t0)/1000)]);
      const used=Math.round(list.filter(e=>e.top).reduce((x,e)=>x+overlap(e,a,b),0)/1000);if(used>=Math.min(20,(b-a)/1000*.25))threads[l]={busy:used,self:top,long};}
    return {at:+g.at.toFixed(2),dur:Math.round(g.dur),threads};});
  // single events over 50 ms from 1 s before intro:start on, any thread (a stall's name)
  const long=[];for(const [l,list] of lanes)for(const e of list)if(e.dur>=50000&&e.ts>=t0-1e6&&e.ts<=t0+12e6&&!WRAP.test(e.name))long.push({thread:l,name:e.name,ms:Math.round(e.dur/1000),at:+((e.ts-t0)/1e6).toFixed(2),args:JSON.stringify(e.args||{}).slice(0,160)});
  long.sort((a,b)=>b.ms-a.ms);
  // GPU programs made while the piece runs (a new effect drawn for the first time compiles its shader; on Windows ANGLE's
  // D3D compiler can take tens of ms each): every compile-like event, outermost per thread only
  const compiles=[];for(const [l,list] of lanes){let end=-1;for(const e of [...list].sort((a,b)=>a.ts-b.ts||b.dur-a.dur)){if(!COMPILE.test(e.name)||e.ts<t0-1e6||e.ts>t0+12e6||e.ts<end)continue;end=e.ts+e.dur;
    compiles.push({thread:l,name:e.name.slice(0,90),ms:+(e.dur/1000).toFixed(1),at:+((e.ts-t0)/1e6).toFixed(2)});}}
  compiles.sort((a,b)=>a.at-b.at);
  const perSecond=Array.from({length:13},(_,i)=>{const c=compiles.filter(x=>x.at>=i-1&&x.at<i);return {s:i-1,n:c.length,ms:Math.round(c.reduce((a,x)=>a+x.ms,0))};});
  return {busy,windows,gaps,long:long.slice(0,40),compiles:{perSecond,list:compiles.slice(0,200)}};
}
async function readStream(C,handle){let out='';for(;;){const r=await C.send('IO.read',{handle,size:1<<20});out+=r.base64Encoded?Buffer.from(r.data,'base64').toString():r.data;if(r.eof)break;}
  await C.send('IO.close',{handle});return out;}

// ---- the layers: composited layers at a few moments, paints per second ----
async function layers(C,t0){
  const node=new Map(),paints=[],snaps={};let last=null;
  // page time of each paint: the wall clock shifted by the page's own (read once)
  const shift=await C.evaluate('performance.now()')-Date.now();
  C.handlers.add(m=>{if(m.sessionId!==C.sessionId)return;if(m.method==='LayerTree.layerTreeDidChange'&&m.params.layers)last=m.params.layers;
    if(m.method==='LayerTree.layerPainted')paints.push([Date.now()+shift-t0,m.params.layerId]);});
  await C.S('DOM.enable');await C.S('LayerTree.enable');
  const desc=async id=>{if(!id)return '';if(node.has(id))return node.get(id);let d='';
    try{const n=(await C.S('DOM.describeNode',{backendNodeId:id})).node;const cls=(n.attributes||[]).reduce((s,v,i,a)=>a[i-1]==='class'?v:s,'');d=(n.localName||n.nodeName)+(cls?'.'+cls.split(/\s+/).join('.'):'');}catch{}
    node.set(id,d);return d;};
  for(const at of [2000,5000,7500,9500]){
    const now=await C.evaluate('performance.now()');await sleep(Math.max(0,t0+at-now));
    const list=last||[],rows=[];
    for(const l of list){if(!l.drawsContent&&!l.backendNodeId)continue;let why=[];try{why=(await C.S('LayerTree.compositingReasons',{layerId:l.layerId})).compositingReasonIds||[];}catch{}
      rows.push({id:l.layerId,node:await desc(l.backendNodeId),size:Math.round(l.width)+'×'+Math.round(l.height),draws:l.drawsContent,why:why.join(',')});}
    snaps[(at/1000)+'s']=rows;}
  await C.S('LayerTree.disable');
  // paints of each layer per second of the piece (layerPainted: Blink repainted that layer's content)
  const per={};for(const [t,id] of paints){const s=Math.floor(t/1000);if(s<0||s>11)continue;(per[id]||(per[id]=Array(12).fill(0)))[s]++;}
  for(const rows of Object.values(snaps))for(const r of rows)r.paintsPerSecond=(per[r.id]||Array(12).fill(0)).join(' ');
  return {snaps,paints:per};
}

// ---- one run ----
async function once(C,n){
  const scripts=[RECORDER,HWGL?HW_GL:'',CSS?STYLE(CSS):'',JS||''].filter(Boolean);
  for(const source of scripts)await C.S('Page.addScriptToEvaluateOnNewDocument',{source});
  let trace=null;
  if(TRACE){
    const cats=['toplevel','blink.user_timing','devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame',
      'blink','cc','viz','gpu','gpu.angle','gpu.dawn','gpu.capture','disabled-by-default-gpu.service','disabled-by-default-gpu.decoder','benchmark','renderer.scheduler',
      'skia','skia.gpu','skia.shaders','disabled-by-default-skia.shaders','shaders','disabled-by-default-viz.gpu_composite_time','v8.execute','loading'];
    const done=new Promise(r=>C.handlers.add(m=>{if(m.method==='Tracing.tracingComplete'&&!m.sessionId)r(m.params.stream);}));
    await C.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordAsMuchAsPossible',includedCategories:cats,excludedCategories:['*']}});
    trace={done};
  }
  const t=Date.now();await C.S('Page.navigate',{url:URL0});
  // the piece: until intro:done (or 25 s), then 2.5 s more for the frames after it
  let info=null,lay=null;
  for(let i=0;i<250;i++){await sleep(100);try{const m=await C.evaluate("[performance.getEntriesByName('intro:start')[0]?.startTime??null,performance.getEntriesByName('intro:done')[0]?.startTime??null,performance.now()]");
    if(LAYERS&&m[0]!==null&&!lay)lay=layers(C,m[0]);
    if(m[1]!==null&&m[2]-m[1]>2500)break;}catch{}}
  if(lay)lay=await lay;
  info=await C.evaluate(ABOUT);info.errors=C.errors.slice();info.wall=Date.now()-t;info.chromeGpu=C.gpu;
  const res={run:n,info:{...info,raf:undefined,lag:undefined},buckets:buckets(info),gaps:gapsOf(info,100).map(g=>({at:+g.at.toFixed(2),ms:Math.round(g.dur)}))};
  if(lay){res.layers=lay.snaps;res.layerPaints=lay.paints;}
  if(trace){await C.send('Tracing.end');const handle=await trace.done;const text=await readStream(C,handle);
    const file=path.join(OUT,`trace-${LABEL}-${SIZE}-${n}.json.gz`);fs.writeFileSync(file,zlib.gzipSync(text));
    let events=[];try{const j=JSON.parse(text);events=Array.isArray(j)?j:j.traceEvents||[];}catch(e){res.traceError=String(e);}
    res.trace=analyzeTrace(events,info);res.traceFile=path.basename(file);}
  return res;
}

// ---- the report ----
const pad=(s,n)=>String(s??'–').padStart(n);
function table(rows,title){
  const head=`| 구간 | 프레임(fps) | 33ms 넘음 | 100ms 넘음 | 최대 간격(ms) | 메인 스레드 지연 합/최대(ms) |\n|---|---|---|---|---|---|`;
  return `${title}\n\n${head}\n`+rows.map(r=>`| ${r.s}–${r.s+1}초 | ${r.frames} | ${r.over33} | ${r.over100} | ${r.max??'–'} | ${r.held} / ${r.heldMax??'–'} |`).join('\n');
}
const all=[];
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'intro-jank-'));
for(let n=1;n<=RUNS;n++){
  const C=await launch(profile,n);
  try{const r=await once(C,n);all.push(r);
    console.log(`\n# ${LABEL} ${SIZE} run ${n}/${RUNS} (${n===1?'cold':'warm'}): globe ${r.info.globe}, GPU "${r.info.gpu}", dpr ${r.info.dpr}, ${r.info.w}×${r.info.h}, focus ${r.info.focus}, visibility ${r.info.vis.map(v=>v[1]).join('→')}`);
    console.log(`intro:start→done ${r.info.marks['intro:done']!==null&&r.info.marks['intro:start']!==null?Math.round(r.info.marks['intro:done']-r.info.marks['intro:start'])+' ms':'–'}, gaps >100 ms: ${r.gaps.map(g=>g.ms+' ms @'+g.at+'s').join(', ')||'none'}`);
    if(r.buckets)console.log(r.buckets.map(b=>`${pad(b.s,2)}s ${pad(b.frames,3)} fps  >33:${pad(b.over33,3)}  >100:${pad(b.over100,2)}  max ${pad(b.max,4)} ms  held ${pad(b.held,4)}/${pad(b.heldMax,3)} ms`).join('\n'));
    if(r.info.errors.length)console.log('page errors:',r.info.errors.slice(0,5));
    if(r.trace?.long?.length)console.log('longest trace events:',r.trace.long.slice(0,8).map(e=>`${e.thread} ${e.name} ${e.ms} ms @${e.at}s`).join(' | '));
  }finally{await C.close();}
}
try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5});}catch{}
// per second: the median over the warm runs (all runs if there is only one), and the cold run on its own
const warm=all.length>1?all.slice(1):all,ks=all[0]?.buckets?.map(b=>b.s)||[];
const med=ks.map((s,i)=>({s,...Object.fromEntries(['frames','over33','over100','max','held','heldMax'].map(k=>[k,median(warm.map(r=>r.buckets?.[i]?.[k]).filter(v=>v!==null&&v!==undefined))]))}));
const env=all[0]?.info||{};
// the trace's part of a run: busy ms per second of the threads that matter most, the longest events, each gap's work
function traceText(t){
  if(!t)return '';if(t.error)return `\n(trace: ${t.error})\n`;
  const rows=Object.entries(t.busy).sort((a,b)=>b[1].slice(4,10).reduce((x,y)=>x+y,0)-a[1].slice(4,10).reduce((x,y)=>x+y,0)).slice(0,8);
  const out=['','### 스레드별 바쁜 시간(ms, 1초마다, -1초부터)','','| 스레드 | '+Array.from({length:13},(_,i)=>i-1).join(' | ')+' |','|---|'+'---|'.repeat(13),
    ...rows.map(([l,v])=>`| ${l} | ${v.join(' | ')} |`),'','### 구간별로 가장 오래 걸린 일(자기 시간 ms)',''];
  for(const [w,o] of Object.entries(t.windows)){out.push(`- ${w}: `+Object.entries(o).filter(([l])=>rows.some(([r])=>r===l)).slice(0,5).map(([l,top])=>`**${l}** `+top.slice(0,5).map(([n,v])=>`${n} ${v}`).join(', ')).join(' · '));}
  out.push('','### 50ms 넘는 프레임 간격마다 한 일','');
  for(const g of t.gaps.filter(g=>g.dur>=50).slice(0,30))out.push(`- ${g.at}초, ${g.dur}ms: `+Object.entries(g.threads).sort((a,b)=>b[1].busy-a[1].busy).slice(0,3)
    .map(([l,x])=>`**${l}** 바쁨 ${x.busy}ms (${x.self.slice(0,4).map(([n,v])=>`${n} ${v}`).join(', ')})`).join(' · '));
  out.push('','### 50ms 넘는 단일 이벤트','',...t.long.slice(0,15).map(e=>`- ${e.at}초 ${e.thread} ${e.name} ${e.ms}ms`));
  if(t.compiles){out.push('','### GPU 셰이더·파이프라인 만들기 (초마다 개수/ms, -1초부터)','',t.compiles.perSecond.map(x=>`${x.s}초 ${x.n}/${x.ms}`).join(' · '),'',
    ...t.compiles.list.filter(x=>x.ms>=5).slice(0,40).map(x=>`- ${x.at}초 ${x.thread} ${x.name} ${x.ms}ms`));}
  return out.join('\n')+'\n';
}
const layerText=r=>!r.layers?'':['','### 합성 레이어 (시점별, 오른쪽은 0–11초 초당 다시 그린 횟수)','',
  ...Object.entries(r.layers).flatMap(([at,rows])=>[`- ${at}: `+rows.filter(x=>x.draws).map(x=>`${x.node||'(익명)'} ${x.size} [${x.why}] 그림: ${x.paintsPerSecond}`).join(' · ')])].join('\n')+'\n';
const md=[`# 인트로 프레임 측정: ${LABEL} (${SIZE})`,'',...(ablate.length||CSS||JS?[`- 끈 것: ${ablate.join(', ')||'(직접 넣은 CSS/JS)'}`]:[]),`- 주소 ${URL0}, ${HEADLESS?'headless':'화면에 띄운 Chrome'}, 지구 ${env.globe}, GPU "${env.gpu}", dpr ${env.dpr}, 페이지 ${env.w}×${env.h}, 실행 ${all.length}회 (1회째 새 캐시)`,
  `- ${env.ua||''}`,`- GPU: ${env.chromeGpu?.device||''} · ${env.chromeGpu?.gl||''}`,`- 기능: ${Object.entries(env.chromeGpu?.features||{}).map(([k,v])=>k+'='+v).join(', ')}`,'',table(med,`## ${all.length>1?'2회째부터의 중앙값 (캐시 있음)':'1회'}`),'',
  ...all.map(r=>table(r.buckets||[],`## ${r.run}회째 (${r.run===1?'새 캐시':'캐시 있음'}) · 100ms 넘는 간격: ${r.gaps.map(g=>g.ms+'ms @'+g.at+'초').join(', ')||'없음'}`)+'\n'+traceText(r.trace)+layerText(r))].join('\n');
const base=path.join(OUT,`${LABEL}-${SIZE}`);
fs.writeFileSync(base+'.md',md);fs.writeFileSync(base+'.json',JSON.stringify({label:LABEL,size:SIZE,url:URL0,median:med,runs:all},null,1));
console.log(`\n${md}\n\nsaved ${base}.md / .json`);
