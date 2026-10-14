// The turning entry-screen globe (dist/intro.js, 2026-10-14) in headless Chrome over the DevTools protocol (cdp.mjs):
// the start pose against the still picture, the entry turn, the sway (fast-forwarded), dragging with a mouse and a
// finger, the motion switch and the system setting, leaving (frames and the WebGL context let go), a shared link, and
// the same screen without WebGL. The card's orange point is found in each capture: it sits on the globe near Korea, so
// its travel is Korea's travel on screen.
// Run with the site on http://127.0.0.1:8765/ (CHROME_PATH: a Chrome or Chromium; in a container add the SwiftShader
// flags --use-angle=swiftshader --enable-unsafe-swiftshader so WebGL runs without a GPU):
//   node verification/2026-10-landing-globe-motion/motion_check.mjs <outdir>
//   URL0=http://127.0.0.1:8766/ node ... <outdir> before      main before the change: does anything move after it shows?
import fs from 'node:fs';import path from 'node:path';
import {launch,sleep} from './cdp.mjs';
const [OUT,ONLY]=process.argv.slice(2);if(!OUT)throw Error('Usage: node motion_check.mjs <outdir> [before]');
fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const results=[],report={};
const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail:String(detail).slice(0,1500)});console.log(ok?'PASS':'FAIL',name,ok?'':String(detail).slice(0,600));};
// counts the entry screen's own animation frames (intro.js), and keeps every WebGL context made, to see it let go
const RAF_COUNTER="window.__introRaf=0;{const o=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){if(/intro\\.js/.test(new Error().stack||''))window.__introRaf++;return o.call(this,cb);};}";
const GL_SPY="window.__gls=[];{const o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){const c=o.call(this,t,...a);if(c&&/webgl/.test(t))window.__gls.push(c);return c;};}";
// JS time of each intro.js frame (the callback), for the report
const FRAME_TIMER="window.__ft=[];{const o=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){if(!/intro\\.js/.test(new Error().stack||''))return o.call(this,cb);return o.call(this,t=>{const a=performance.now();cb(t);window.__ft.push(performance.now()-a);});};}";
// fast-forward: intro.js frames see time run __warp times faster (its clock steps at most 100 ms a frame)
const WARP="window.__warp=1;{const o=window.requestAnimationFrame;let b=null;window.requestAnimationFrame=function(cb){if(!/intro\\.js/.test(new Error().stack||''))return o.call(this,cb);return o.call(this,t=>{if(b===null)b=t;cb(b+(t-b)*window.__warp);});};}";

let C=null;
async function open({w=1672,h=941,mobile=false,dpr=1,hash='',motion='0',system=null,scripts=[]}={}){
  await C.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:dpr,mobile});
  await C.send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
  await C.send('Emulation.setEmulatedMedia',{features:system?[{name:'prefers-reduced-motion',value:system}]:[]});
  const store=motion===null?"localStorage.removeItem('bbvm-reduce-motion')":`localStorage.setItem('bbvm-reduce-motion','${motion}')`;
  await C.onNewDocument(`try{sessionStorage.clear();${store}}catch{}`,RAF_COUNTER,GL_SPY,...scripts);
  await C.send('Page.navigate',{url:'about:blank'});await sleep(100);
  C.requests.length=0;
  await C.send('Page.navigate',{url:URL0+hash});
  for(let i=0;i<100;i++){if(await C.evaluate("location.href!=='about:blank'&&!!document.getElementById('site-gate')").catch(()=>false))break;await sleep(50);}
}
const state=()=>C.evaluate(`(()=>{const g=document.getElementById('site-gate');return {on:document.documentElement.classList.contains('gate-on'),ready:g.classList.contains('is-ready'),
  still:g.classList.contains('is-still'),raf:window.__introRaf,gls:window.__gls.length,lost:window.__gls.map(c=>c.isContextLost()),canvas:g.querySelector('.gate-sea').width,
  marks:performance.getEntriesByType('mark').map(m=>m.name),view:document.querySelector('.view.active')?.id}})()`);
async function waitReady(){for(let i=0;i<120;i++){const s=await state().catch(()=>null);if(s&&(s.ready||!s.on))return s;await sleep(100);}return state();}
async function waitGone(ms=3000){const t=Date.now();let s;do{await sleep(100);s=await state();}while(s.on&&Date.now()-t<ms);return s;}
const frameOf=(w,h,band)=>C.evaluate(`(()=>{const b=document.querySelector('.gate-globe'),st=getComputedStyle(b).display!=='none',r=b.getBoundingClientRect();
  const f=globeFrame(innerWidth,innerHeight,st?{top:r.top,bottom:r.bottom}:null);return f;})()`);
// the orange point (#dfa064; under the stacked layout's lower shade, darker but the same hue) in a capture: its centre; and the mean difference of two captures over the disc
const DOT_JS=`async(png,box)=>{const bmp=await createImageBitmap(await (await fetch('data:image/png;base64,'+png)).blob()),c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);
  const d=x.getImageData(0,0,bmp.width,bmp.height).data;let n=0,sx=0,sy=0;
  for(let y=Math.max(0,box[1]);y<Math.min(bmp.height,box[3]);y++)for(let X=Math.max(0,box[0]);X<Math.min(bmp.width,box[2]);X++){const i=(y*bmp.width+X)*4;
    const r=d[i],g=d[i+1],b=d[i+2];if(r>60&&r-b>.35*r&&r-g>.15*r&&r-g<.45*r){n++;sx+=X;sy+=y;}}
  return n?{x:sx/n,y:sy/n,n}:null;}`;
const dotIn=(png,box)=>C.evaluate(`(${DOT_JS})(${JSON.stringify(png)},${JSON.stringify(box)})`);
const diff=(a,b,f)=>C.evaluate(`(async()=>{const load=async p=>{const bmp=await createImageBitmap(await (await fetch('data:image/png;base64,'+p)).blob()),c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);return x.getImageData(0,0,bmp.width,bmp.height);};
  const A=await load(${JSON.stringify(a)}),B=await load(${JSON.stringify(b)}),f=${JSON.stringify(f)};let s=0,n=0;
  for(let y=0;y<A.height;y+=2)for(let x=0;x<A.width;x+=2){if(Math.hypot(x-f.cx,y-f.cy)>f.R*.97)continue;const i=(y*A.width+x)*4;s+=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);n++;}
  return s/n/3;})()`);
async function shot(name,clip){return C.shot(name&&path.join(OUT,name+'.png'),clip);}
const SIZES=[['1672x941',{w:1672,h:941}],['1440x900',{w:1440,h:900}],['820x1180',{w:820,h:1180,mobile:true}],['390x844',{w:390,h:844,mobile:true,dpr:2}]];
const mouse=async(type,x,y,buttons)=>C.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons,clickCount:type==='mouseMoved'?0:1});
async function dragMouse(path,hold){await mouse('mouseMoved',...path[0],0);await mouse('mousePressed',...path[0],1);
  for(const p of path.slice(1)){await mouse('mouseMoved',...p,1);await sleep(16);}if(hold)await hold();await mouse('mouseReleased',...path.at(-1),0);}

try{
  if(ONLY==='before'){
    C=await launch((process.env.CHROME_FLAGS||'').split(' ').filter(Boolean));
    await open({motion:'0'});await waitReady();await sleep(1500);
    const r0=(await state()).raf,a=await shot('before-t0');await sleep(5000);const b=await shot('before-t5');await sleep(5000);const c=await shot('before-t10');
    const r1=(await state()).raf,f=await frameOf();
    const d1=await diff(a,b,f),d2=await diff(b,c,f);
    report.before={rafIn10s:r1-r0,diff0to5:d1,diff5to10:d2};
    check(`Before (main): once shown, the globe is not redrawn for 10 s (${r1-r0} intro.js frames) and three captures 5 s apart are the same (mean diff ${d1.toFixed(2)}, ${d2.toFixed(2)})`,r1-r0<=2&&d1<.05&&d2<.05,JSON.stringify(report.before));
    throw 'done';
  }
  C=await launch((process.env.CHROME_FLAGS||'').split(' ').filter(Boolean));
  // ---------- the start pose (still) at each size, the entry turn, then the sway really moving ----------
  for(const [name,o] of SIZES){
    await open({...o,motion:'1'});let s=await waitReady();await sleep(1200);s=await state();
    const f=await frameOf();report[name]={frame:f};
    const still=await shot(`${name}-1-start-pose`);
    check(`${name}: WebGL globe drawn (textures in, context made, nothing failed)`,s.gls===1&&s.marks.includes('bbvm-globe-gl-ready')&&!s.marks.includes('bbvm-globe-gl-failed'),JSON.stringify(s));
    const box=[0,0,o.w*(o.dpr||1),o.h*(o.dpr||1)],d0=await dotIn(still,box);report[name].dot0=d0;
    await open({...o,motion:'0'});await waitReady();
    const t0=Date.now(),shots=[];
    for(const t of [500,1200,2600,4600,6600,8600]){await sleep(Math.max(0,t-(Date.now()-t0)));shots.push(await shot(`${name}-2-moving-${t}ms`));}
    const dots=[];for(const p of shots)dots.push(await dotIn(p,box));
    const k=o.dpr||1,shift=d=>d&&d0?Math.hypot(d.x-d0.x,d.y-d0.y)/k/o.w:null;
    report[name].entry=dots.map(shift);
    const later=[await diff(shots[3],shots[4],{cx:f.cx*k,cy:f.cy*k,R:f.R*k}),await diff(shots[4],shots[5],{cx:f.cx*k,cy:f.cy*k,R:f.R*k})];report[name].diff2s=later;
    // (a software renderer draws a few frames a second, and the motion clock steps at most 100 ms a frame, so the entry
    // can take longer than 2.4 s here: the checks look at the first and the last captures)
    check(`${name}: the entry turns Korea into place (point ${(shift(dots[0])*100).toFixed(1)}% of the width off at 0.5 s, ${(shift(dots[5])*100).toFixed(1)}% at 8.6 s)`,shift(dots[0])>.03&&shift(dots[5])<.06,JSON.stringify(report[name].entry));
    check(`${name}: still moving after the entry: captures 2 s apart differ (mean diff ${later.map(v=>v.toFixed(2)).join(', ')}), Korea within 6% of its place (${dots.slice(4).map(d=>(shift(d)*100).toFixed(2)+'%').join(', ')})`,
      later.every(v=>v>.05)&&dots.slice(4).every(d=>shift(d)!==null&&shift(d)<.06),JSON.stringify(report[name]));
  }

  // ---------- the sway end to end, fast-forwarded on a phone screen (fewest pixels, so the software renderer keeps up):
  // the point's travel over a whole longitude period ----------
  await open({w:390,h:844,mobile:true,motion:'0',scripts:[WARP,FRAME_TIMER]});await waitReady();
  const fs0=await frameOf(),ref0=await C.evaluate("(()=>{const b=document.querySelector('.gate-globe').getBoundingClientRect(),f=globeFrame(innerWidth,innerHeight,{top:b.top,bottom:b.bottom}),p=project(...ANCHOR);return {x:f.cx+p.x*f.R,y:f.cy-p.y*f.R};})()");
  await C.evaluate('window.__warp=8;window.__ft.length=0;1');
  const near=[Math.round(ref0.x-90),Math.round(ref0.y-60),Math.round(ref0.x+90),Math.round(ref0.y+60)];
  const sway=[];const tS=Date.now();
  // the motion clock steps at most 100 ms a frame, so on a software renderer even fast-forwarded the 52 s period takes
  // longer than 52 s here: sample until the point has been well both sides of its place (or 150 s)
  const both=()=>{const l=sway.filter(s=>s.t>8000);return l.some(s=>s.dx<-.02)&&l.some(s=>s.dx>.02);};
  while(Date.now()-tS<150000&&!(both()&&Date.now()-tS>45000)){const png=await shot(null),d=await dotIn(png,near);if(d)sway.push({t:Date.now()-tS,dx:(d.x-ref0.x)/390,dy:(d.y-ref0.y)/390,png});await sleep(150);}
  const ft=await C.evaluate('window.__ft.slice()');
  const settled=sway.filter(s=>s.t>8000),far=Math.max(...settled.map(s=>Math.hypot(s.dx,s.dy))),west=settled.reduce((a,b)=>b.dx<a.dx?b:a),east=settled.reduce((a,b)=>b.dx>a.dx?b:a);
  fs.writeFileSync(path.join(OUT,'390x844-3-sway-west.png'),Buffer.from(west.png,'base64'));fs.writeFileSync(path.join(OUT,'390x844-3-sway-east.png'),Buffer.from(east.png,'base64'));
  const q=a=>{const s=[...a].sort((x,y)=>x-y);return {n:s.length,mean:+(s.reduce((x,y)=>x+y,0)/s.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s.at(-1).toFixed(2)};};
  report.sway={samples:sway.length,settled:settled.length,maxShift:far,west:[west.dx,west.dy],east:[east.dx,east.dy],frameJsMs:q(ft),track:sway.map(s=>[s.t,+(s.dx*100).toFixed(2),+(s.dy*100).toFixed(2)])};
  check(`Phone 390×844, sway fast-forwarded: the point travels both ways (${(west.dx*100).toFixed(1)}% to ${(east.dx*100).toFixed(1)}% of the width) and never more than 6% from its place (${(far*100).toFixed(2)}%)`,
    settled.length>10&&west.dx<-.015&&east.dx>.015&&far<.06,JSON.stringify({...report.sway,track:undefined}));
  const f=await (async()=>{await open({motion:'0'});await waitReady();return frameOf();})(),box=[0,0,1672,941];
  const ref=(await C.evaluate("(()=>{const f=globeFrame(innerWidth,innerHeight,null),p=project(...ANCHOR);return {x:f.cx+p.x*f.R,y:f.cy-p.y*f.R};})()"));

  // ---------- dragging ----------
  await open({motion:'0',scripts:[FRAME_TIMER]});await waitReady();await sleep(3000);
  const p0=await dotIn(await shot(null),box);
  let held=null;
  await dragMouse([[1150,720],[1250,720],[1350,720],[1450,720],[1550,720]],async()=>{await sleep(120);held=await shot('1672x941-4-drag-east');});
  const dragged=await dotIn(held,box);await sleep(100);
  await C.evaluate('window.__ft.length=0;1');
  await dragMouse([[1150,720],[1650,720],[1660,560],[1660,400],[1660,300]],async()=>{await sleep(120);held=await shot('1672x941-5-drag-limit');});
  const limit=await dotIn(held,box),dragFt=await C.evaluate('window.__ft.slice()');
  await sleep(200);const glide=await dotIn(await shot('1672x941-6-released-200ms'),box);
  await sleep(2600);const back=await dotIn(await shot('1672x941-7-released-2.8s'),box);
  report.drag={p0,dragged,limit,glide,back,frameJsMs:q(dragFt)};
  check(`Mouse drag 400 px east: Korea follows the pointer (point moved ${(dragged.x-p0.x).toFixed(0)} px)`,dragged.x-p0.x>250&&dragged.x-p0.x<520,JSON.stringify(report.drag));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/1672;
  check(`Dragged far past the limit (±30° · ±15°): the point stops within reach (${(dist(limit,p0)*100).toFixed(1)}% of the width off) and Korea stays on the near side`,!!limit&&dist(limit,p0)<.45,JSON.stringify(report.drag));
  check(`Released: a short glide, then back to the sway by 2.8 s (${(dist(back,p0)*100).toFixed(2)}% of the width from the pose)`,!!back&&dist(back,ref)<.06,JSON.stringify(report.drag));
  check('Dragging the globe selects no text and keeps the entry screen',(await state()).on&&await C.evaluate("String(getSelection())===''"));
  // the copy, the buttons and the card never start a drag
  const p1=await dotIn(await shot(null),box);
  await dragMouse([[300,300],[700,300],[1000,320]]);await sleep(150);const p2=await dotIn(await shot(null),box);
  await dragMouse([[1420,520],[1600,520],[1650,560]]);await sleep(150);const p3=await dotIn(await shot(null),box);
  check('Dragging over the title or the card does not turn the globe',dist(p1,p2)<.01&&dist(p2,p3)<.01,JSON.stringify({p1,p2,p3}));

  // a finger: sideways turns it, upward does not
  await open({w:390,h:844,mobile:true,dpr:2,motion:'1'});await waitReady();await sleep(800);
  const fp=await frameOf(),mb=[0,0,780,1688],t0=await dotIn(await shot(null),mb);
  const touchPath=async pts=>{await C.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pts[0][0],y:pts[0][1]}]});
    for(const p of pts.slice(1)){await C.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p[0],y:p[1]}]});await sleep(16);}};
  const gy=Math.round(fp.cy-fp.R*.35);
  await touchPath([[110,gy],[150,gy],[190,gy],[230,gy],[270,gy]]);await sleep(600);const t1=await dotIn(await shot('390x844-8-finger-sideways'),mb);
  await C.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(600);const t2=await dotIn(await shot(null),mb);
  check(`Phone, still on: a sideways finger drag turns the globe (point ${((t1.x-t0.x)/2).toFixed(0)} px), and on release it is straight back (no glide while still)`,t1.x-t0.x>120&&Math.hypot(t2.x-t0.x,t2.y-t0.y)<4,JSON.stringify({t0,t1,t2}));

  // ---------- the switch and the system setting: no frames, the pose ----------
  await open({motion:'1'});await waitReady();await sleep(1500);
  let r0=(await state()).raf;const sa=await shot(null);await sleep(2000);const sb=await shot(null);let r1=(await state()).raf;
  check(`Switch still (remembered): no frames once shown (${r1-r0} in 2 s), the pose does not change (diff ${(await diff(sa,sb,f)).toFixed(3)})`,r1-r0<=1&&await diff(sa,sb,f)<.02,`${r0} → ${r1}`);
  await open({motion:null,system:'reduce'});await waitReady();await sleep(1500);
  r0=(await state()).raf;await sleep(2000);r1=(await state()).raf;const st=await state();
  check(`System "reduce motion" with nothing remembered: switch on, no frames (${r1-r0} in 2 s)`,st.still&&r1-r0<=1,JSON.stringify(st));
  await shot('1672x941-9-system-reduced');
  await open({motion:'0'});await waitReady();await sleep(4000);
  await C.evaluate("document.querySelector('.gate-motion').click();1");await sleep(150);
  r0=(await state()).raf;const sc=await shot(null);await sleep(1500);r1=(await state()).raf;
  const dc=await dotIn(sc,box);
  check(`Flipping the switch while it sways: at once in the pose (point ${(dist(dc,ref)*100).toFixed(2)}% off) and the frames stop (${r1-r0} in 1.5 s)`,dist(dc,ref)<.003&&r1-r0<=1,JSON.stringify({dc,ref,r0,r1}));
  await C.evaluate("document.querySelector('.gate-motion').click();1");await sleep(3000);
  const ra=(await state()).raf;await sleep(1000);const rb=(await state()).raf;
  check(`Switching motion back on: it sways again (${rb-ra} frames in 1 s)`,rb-ra>=2,`${ra} → ${rb}`);

  // ---------- leaving: gathers to the pose, then no frames and the WebGL context let go ----------
  await open({motion:'0'});await waitReady();await sleep(3000);
  await C.evaluate("document.getElementById('gate-enter').click();1");await sleep(150);await shot('1672x941-10-leave-150ms');
  let s=await waitGone();await sleep(300);
  r0=(await state()).raf;await sleep(1500);r1=(await state()).raf;s=await state();
  check(`After leaving: no more intro.js frames (${r1-r0} in 1.5 s), the WebGL context lost on purpose, the canvas emptied, on the map`,!s.on&&r1===r0&&s.lost.length===1&&s.lost[0]===true&&s.canvas===0&&s.view==='explore',JSON.stringify(s));
  // the share of the screen's transfer the globe takes, per screen
  const xfer=async(o)=>{await open({...o,motion:'1'});await waitReady();await sleep(800);
    return C.evaluate("performance.getEntriesByType('resource').filter(e=>/vendor\\/globe-v[23]\\//.test(e.name)).map(e=>({file:e.name.split('/vendor/')[1],bytes:e.encodedBodySize}))");};
  report.transfer={desktop1x:await xfer({}),desktop2x:await xfer({dpr:2}),phone2x:await xfer({w:390,h:844,mobile:true,dpr:2})};
  check('Globe transfer per screen recorded (textures only, the still picture not fetched)',Object.values(report.transfer).every(l=>l.length===2&&l.every(e=>e.file.startsWith('globe-v3/'))),JSON.stringify(report.transfer));

  // ---------- a shared link: no screen, nothing fetched, no context ----------
  await open({hash:'#s=274849&v=compare'});await sleep(2500);s=await state();
  check('Shared link (#s=274849&v=compare): no entry screen, no WebGL context, neither globe-v3 nor globe-v2 fetched',!s.on&&s.gls===0&&!C.requests.some(u=>/globe-v[23]/.test(u)),JSON.stringify({s,req:C.requests.filter(u=>u.includes('vendor'))}));
  check('No uncaught page errors or console.error (WebGL run)',C.errors.length===0,C.errors.join(' | '));
  C.close();

  // ---------- without WebGL: the still picture, still pose, entering works ----------
  C=await launch([...(process.env.CHROME_FLAGS||'').split(' ').filter(Boolean),'--disable-webgl']);
  for(const [name,o] of [SIZES[0],SIZES[3]]){
    await open({...o,motion:'0'});s=await waitReady();await sleep(2500);await shot(`${name}-11-no-webgl`);
    const reqs=C.requests.filter(u=>/globe-v[23]/.test(u));r0=(await state()).raf;await sleep(1500);r1=(await state()).raf;
    check(`${name} without WebGL: the still picture (globe-v2), no textures, no frames once shown (${r1-r0})`,reqs.length===1&&/globe-v2\/globe-\d+\.webp/.test(reqs[0])&&r1-r0<=1,JSON.stringify(reqs));
  }
  await C.evaluate("document.getElementById('gate-enter').click();1");s=await waitGone();
  check('Without WebGL: 바다 탐색하기 opens the map',!s.on&&s.view==='explore',JSON.stringify(s));
  check('No uncaught page errors or console.error (no WebGL run)',C.errors.length===0,C.errors.join(' | '));
}catch(e){if(e!=='done')check('Harness',false,e.stack||e);}
finally{
  fs.writeFileSync(path.join(OUT,'motion-check.json'),JSON.stringify({results,report},null,1));
  C?.close();
  console.log(`${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status!=='PASS').length} FAIL`);
  process.exitCode=results.some(r=>r.status!=='PASS')?1:0;
}
