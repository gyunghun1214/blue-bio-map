// The first visit's piece at fixed moments, as the screen shows it, to put two versions side by side (2026-10-19: the
// ripples drawn by a shader instead of 2D canvas strokes should look the same). The page's clock is held after its first
// paint (performance.now and requestAnimationFrame only; the rest of the page runs on): the globe's files and the data
// come in, then the frames run in 16 ms steps up to each moment and the screen is captured. No dependencies (the
// DevTools protocol over Node's WebSocket, like measure.mjs). With the site on 127.0.0.1:8765:
//   node verification/2026-10-19-intro-jank/frames.mjs shoot <out-dir> [--size 577x549] [--dpr 1.5] [--mobile]
//        [--at 3,5.5,7.5] [--url http://127.0.0.1:8765/] [--headless] [--hwgl] [--reduce]
//   node verification/2026-10-19-intro-jank/frames.mjs compare <dir-a> <dir-b> [<out-dir>]
// shoot: <size>-t<s>.png for every moment. --hwgl: tells the page its WebGL is a GPU and lets it have a context there (a
// container's SwiftShader; with --use-angle=swiftshader in CHROME_FLAGS). --reduce: the system asks for reduced motion. compare: for every file in both, how far the
// pixels are apart (mean, the share over 8 and 24 levels, the largest), and a difference picture (×8) in <out-dir>.
// CHROME_PATH: Chrome or Chromium (default: the usual Chrome on Windows, google-chrome elsewhere); CHROME_FLAGS: more flags.
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';

const [MODE,...rest]=process.argv.slice(2);
const opt=(k,d)=>{const i=rest.indexOf('--'+k);return i<0?d:rest[i+1]!==undefined&&!rest[i+1].startsWith('--')?rest[i+1]:true;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---- PNG, 8-bit RGB(A) without interlace (what Chrome writes), in and out ----
function readPNG(file){
  const b=fs.readFileSync(file);let w=0,h=0,ch=0;const idat=[];
  for(let i=8;i<b.length;){const n=b.readUInt32BE(i),t=b.toString('ascii',i+4,i+8),d=b.subarray(i+8,i+8+n);i+=12+n;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);if(d[8]!==8||d[12])throw Error(file+': not 8-bit, or interlaced');ch={2:3,6:4}[d[9]];if(!ch)throw Error(file+': colour type '+d[9]);}
    else if(t==='IDAT')idat.push(d);else if(t==='IEND')break;}
  const raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(w*h*4);let prev=Buffer.alloc(st);
  for(let y=0;y<h;y++){const f=raw[y*(st+1)],line=Buffer.from(raw.subarray(y*(st+1)+1,(y+1)*(st+1)));
    for(let x=0;x<st;x++){const a=x>=ch?line[x-ch]:0,u=prev[x],c=x>=ch?prev[x-ch]:0;
      const p=a+u-c,pa=Math.abs(p-a),pb=Math.abs(p-u),pc=Math.abs(p-c);
      line[x]=(line[x]+(f===1?a:f===2?u:f===3?(a+u)>>1:f===4?(pa<=pb&&pa<=pc?a:pb<=pc?u:c):0))&255;}
    for(let x=0;x<w;x++){for(let k=0;k<3;k++)out[(y*w+x)*4+k]=line[x*ch+k];out[(y*w+x)*4+3]=ch===4?line[x*ch+3]:255;}
    prev=line;}
  return {w,h,data:out};
}
function writePNG(file,w,h,rgba){
  const crcT=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=buf=>{let c=0xffffffff;for(const x of buf)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
  fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}

if(MODE==='compare'){
  const [A,B,OUT=B+'-diff']=rest.filter(x=>!x.startsWith('--'));fs.mkdirSync(OUT,{recursive:true});
  const rows=[];
  for(const f of fs.readdirSync(A).filter(f=>f.endsWith('.png')&&fs.existsSync(path.join(B,f))).sort()){
    const a=readPNG(path.join(A,f)),b=readPNG(path.join(B,f));if(a.w!==b.w||a.h!==b.h){rows.push(`| ${f} | 크기가 다름 ${a.w}×${a.h} / ${b.w}×${b.h} | | | |`);continue;}
    let sum=0,max=0,o8=0,o24=0;const n=a.w*a.h,d=Buffer.alloc(n*4);
    for(let i=0;i<n;i++){let m=0;for(let k=0;k<3;k++){const x=Math.abs(a.data[i*4+k]-b.data[i*4+k]);sum+=x;if(x>m)m=x;d[i*4+k]=Math.min(255,x*8);}
      d[i*4+3]=255;if(m>max)max=m;if(m>8)o8++;if(m>24)o24++;}
    writePNG(path.join(OUT,f.replace(/\.png$/,'-diff.png')),a.w,a.h,d);
    rows.push(`| ${f} | ${(sum/n/3).toFixed(3)} | ${(o8/n*100).toFixed(3)}% | ${(o24/n*100).toFixed(3)}% | ${max} |`);
  }
  const md=`# 같은 순간의 화면 비교\n\n- A: ${A}\n- B: ${B}\n- 차이 그림(8배): ${OUT}\n\n| 파일 | 평균 차이(0–255) | 8단계 넘게 다른 픽셀 | 24단계 넘게 다른 픽셀 | 가장 큰 차이 |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
  fs.writeFileSync(path.join(OUT,'compare.md'),md);console.log(md);process.exit(0);
}
if(MODE!=='shoot')throw Error('Usage: node frames.mjs shoot <out-dir> [...] | compare <dir-a> <dir-b> [<out-dir>]');

const OUT=rest[0],URL0=String(opt('url','http://127.0.0.1:8765/')),SIZE=String(opt('size','577x549')),DPR=Number(opt('dpr',1.5)),MOBILE=!!opt('mobile',false);
const AT=String(opt('at','3,5.5,7.5')).split(',').map(Number),HEADLESS=!!opt('headless',false),HWGL=!!opt('hwgl',false),REDUCE=!!opt('reduce',false);
if(!OUT||OUT.startsWith('--'))throw Error('shoot: an out-dir');
fs.mkdirSync(OUT,{recursive:true});
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');

// the held clock: performance.now stands at C.t, frames asked for while it stands (or due then) wait in C.q and run in
// 16 ms steps from C.run, with that time
const CLOCK=`(()=>{if(window.__clock)return;const now0=performance.now.bind(performance),raf0=window.requestAnimationFrame.bind(window),caf0=window.cancelAnimationFrame.bind(window);
const C=window.__clock={paused:false,t:0,q:new Map(),real:new Map(),id:1e9};performance.now=()=>C.paused?C.t:now0();
window.requestAnimationFrame=f=>{const id=++C.id;if(C.paused)C.q.set(id,f);else C.real.set(id,raf0(ts=>{C.real.delete(id);if(C.paused)C.q.set(id,f);else f(ts);}));return id;};
window.cancelAnimationFrame=id=>{C.q.delete(id);const r=C.real.get(id);if(r!==undefined){caf0(r);C.real.delete(id);}};
C.pause=()=>{C.t=now0();C.paused=true;return C.t;};
C.run=ms=>{const end=C.t+ms;while(C.t<end){C.t=Math.min(end,C.t+16);const fs=[...C.q.values()];C.q.clear();for(const f of fs){try{f(C.t);}catch(e){console.error(e);}}}return C.t;};})();`;
const HW_GL=`{for(const P of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){const o=P.prototype.getParameter;P.prototype.getParameter=function(p){return p===0x9246?'frames GPU':o.call(this,p);};}
  const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,o){return g.call(this,t,o&&/webgl/.test(t)?{...o,failIfMajorPerformanceCaveat:false}:o);};}`;

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'intro-frames-'));
const flags=['--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-default-apps',
  '--disable-component-update','--disable-background-networking','--disable-features=CalculateNativeWinOcclusion,Translate,MediaRouter,OptimizationHints',
  '--window-position=0,0','--window-size=1200,1000','--user-data-dir='+profile,...(HEADLESS?['--headless=new']:[]),
  ...(process.getuid?.()===0?['--no-sandbox','--test-type']:[]),...(process.env.CHROME_FLAGS||'').split(/\s+/).filter(Boolean),'about:blank'];
const chrome=spawn(chromePath,flags,{stdio:['ignore','ignore','pipe']});let err='';chrome.stderr.on('data',d=>{err=(err+d).slice(-4000);});
let port=0;for(let i=0;i<300&&!port;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0])||0;}catch{}if(!port)await sleep(200);}
if(!port)throw Error('Chrome DevTools port timeout: '+err.slice(-800));
const ws=new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(p.method+': '+m.error.message)):p.res(m.result);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(Error('WebSocket error'));});
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej,method});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
const page=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='page');
const {sessionId}=await send('Target.attachToTarget',{targetId:page.targetId,flatten:true});
const S=(m,p)=>send(m,p,sessionId);
const evaluate=async e=>{const r=await S('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
await S('Page.enable');await S('Runtime.enable');
const [W,H]=SIZE.split('x').map(Number);
await S('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:DPR,mobile:MOBILE});
if(MOBILE)await S('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
if(REDUCE)await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
for(const source of [CLOCK,HWGL?HW_GL:''].filter(Boolean))await S('Page.addScriptToEvaluateOnNewDocument',{source});
await S('Page.bringToFront');await S('Page.navigate',{url:URL0});
const mark=n=>`(performance.getEntriesByName('${n}')[0]?.startTime??null)`;
const waitFor=async(expr,ms)=>{const end=Date.now()+ms;for(;;){try{const v=await evaluate(expr);if(v)return v;}catch{}if(Date.now()>end)return null;await sleep(50);}};
// held right after the first paint, before the drop; then the globe's files and the data come in on the real clock
const t0=await waitFor(mark('intro:start'),20000);if(t0===null)throw Error('no intro:start: '+errors.join(' | '));
const held=await evaluate('window.__clock.pause()');
const globe=await waitFor(`${mark('bbvm-globe-gl-ready')}!==null?'WebGL':${mark('bbvm-globe-decoded')}!==null?'사진':''`,20000);
const data=await waitFor(`document.querySelector('#site-gate .gate-counts')?.textContent||''`,20000);
await sleep(500);
const info=await evaluate(`({gpu:(()=>{try{const c=document.createElement('canvas').getContext('webgl');const d=c.getExtension('WEBGL_debug_renderer_info');return String(c.getParameter(d?d.UNMASKED_RENDERER_WEBGL:c.RENDERER));}catch{return '';}})(),
  ripple:[...document.querySelectorAll('#site-gate .gate-ripple')].map(c=>c.getContext('2d')?'2d':'webgl').join(','),dpr:devicePixelRatio,w:innerWidth,h:innerHeight})`);
console.log(`held at ${((held-t0)/1000).toFixed(2)} s, globe ${globe||'none'}, data ${data?'in':'not in'}, ${JSON.stringify(info)}`);
for(const at of AT){
  const t=await evaluate(`performance.now()-${t0}`);if(at*1000>t)await evaluate(`window.__clock.run(${Math.round(at*1000-t)})`);
  await sleep(250);
  const shot=await S('Page.captureScreenshot',{format:'png'});const file=path.join(OUT,`${SIZE}-t${at}.png`);fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
  const now=await evaluate(`[(performance.now()-${t0})/1000,[...document.querySelectorAll('#site-gate .gate-ripple')].map(c=>c.getContext('2d')?'2d':'webgl').join(',')]`);
  console.log(`${file} at ${now[0].toFixed(3)} s (ripple canvas ${now[1]})`);
}
if(errors.length)console.log('page errors:',errors.slice(0,5));
fs.writeFileSync(path.join(OUT,`${SIZE}-info.json`),JSON.stringify({url:URL0,size:SIZE,dpr:DPR,mobile:MOBILE,hwgl:HWGL,reduce:REDUCE,globe,info,errors},null,1));
try{await send('Browser.close');}catch{}chrome.kill();await sleep(500);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5});}catch{}
