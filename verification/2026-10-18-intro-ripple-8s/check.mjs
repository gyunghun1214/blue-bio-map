// The first visit's 8 s piece (2026-10-18, intro.js INTRO_TIMELINE): frames at fixed times, the measured length on a cold
// and a warm cache and on Slow 4G, a globe that does not come (the wait line, the timeout, the retry), still (reduced
// motion), no replay inside the app, no jump at the end, no console errors; webm videos of the cold runs.
// Playwright (Chromium) with the production API answered from live-snapshot.json, like uicheck's FIXTURE. Frames are
// taken on Playwright's paused clock, so each one is at its time exactly; the timings run on the real clock.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 --directory dist, then
//      node verification/2026-10-18-intro-ripple-8s/check.mjs <out-dir>   (needs the playwright package; CHROME_PATH optional)
import {chromium} from 'playwright';
import fs from 'node:fs';import path from 'node:path';
const OUT=process.argv[2]||'intro-ripple-8s';fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const fx=JSON.parse(fs.readFileSync(process.env.FIXTURE||new URL('../../dist/live-snapshot.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],rows=[];const check=(name,ok,detail='')=>{results.push([ok,name]);console.log(ok?'PASS':'FAIL',name,ok?'':detail);};
const PHONE={viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const DESK={viewport:{width:1440,height:900}};
const TIMES=[0,1000,1400,1800,3000,4200,5500,6800,8000,9000];
const local=u=>u.startsWith(URL0);

// a page with the API answered from the snapshot, other sites cut (map tiles: not part of the first screen), errors kept
// marks are also kept on window.__marks: Playwright's clock stands in for performance, whose own list then stays empty
const KEEP_MARKS=`{const m=performance.mark.bind(performance);window.__marks=[];performance.mark=(n,o)=>{window.__marks.push([n,o&&o.startTime!==undefined?o.startTime:performance.now()]);try{return m(n,o);}catch{}};}`;
async function page(ctx,{hold}={}){
  const p=await ctx.newPage();p.errors=[];
  p.keepMarks=()=>p.addInitScript(KEEP_MARKS);
  p.on('pageerror',e=>p.errors.push(String(e)));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|ERR_ABORTED|net::ERR_BLOCKED/.test(m.text()))p.errors.push(m.text());});
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('/rest/v1/')){const k=u.includes('species_profiles')?'profiles':u.includes('species_map_cells')?'cells':null;return k?r.fulfill({json:fx[k]}):r.abort();}
    if(hold&&/vendor\/globe-v[23]\//.test(u))return hold.push(r); // the globe's pictures: held until released
    return local(u)?r.continue():r.abort();});
  return p;
}
const state=p=>p.evaluate(()=>{const g=document.getElementById('site-gate'),mk=n=>{const k=window.__marks?.find(m=>m[0]===n);return k?{startTime:k[1]}:performance.getEntriesByName(n)[0];},s=mk('intro:start'),d=mk('intro:done');
  return {on:document.documentElement.classList.contains('gate-on'),ready:g.classList.contains('is-ready'),busy:g.getAttribute('aria-busy'),
    t:s?performance.now()-s.startTime:null,len:s&&d?d.startTime-s.startTime:null,step:g.querySelector('.gate-step').hidden?'':g.querySelector('.gate-step').textContent,
    fail:!g.querySelector('.gate-fail').hidden,loader:!g.querySelector('.gate-loader').hidden,loaderOpacity:getComputedStyle(g.querySelector('.gate-loader')).opacity,
    mask:g.querySelector('.gate-loader').style.maskImage||g.querySelector('.gate-loader').style.webkitMaskImage||'',focus:document.activeElement?.id||document.activeElement?.className||'',
    kx:g.style.getPropertyValue('--kx'),ky:g.style.getPropertyValue('--ky'),rip:(c=>[c.width,c.height,c.hidden])(g.querySelector('.gate-ripple')),
    inert:[...g.querySelectorAll('.gate-hero *')].some(n=>n.inert),pe:getComputedStyle(g.querySelector('.gate-loader')).pointerEvents};});
// the paused clock stops the page's own frames and timers, so waits poll from here
const globeIn=async p=>{for(let i=0;i<400;i++){if(await p.evaluate(()=>(window.__marks||[]).some(m=>/bbvm-globe-(decoded|gl-ready)/.test(m[0]))))return true;await p.waitForTimeout(50);}return false;};
const until=async(p,f,ms=30000)=>{const end=Date.now()+ms;let s={};do{try{s=await state(p);if(f(s))return s;}catch{/* the page is still starting */}await p.waitForTimeout(30);}while(Date.now()<end);return s;};

// 1) frames at fixed times on the paused clock, side by side with the GIF's frames at the same times
for(const [name,opt] of [['1440x900',DESK],['390x844',PHONE]]){
  const ctx=await browser.newContext(opt),p=await page(ctx);
  await p.clock.install();await p.keepMarks();await p.goto(URL0,{waitUntil:'commit'});
  let s=await until(p,s=>s.t!==null);await p.clock.pauseAt(Date.now()+50);
  // the globe picture arrives on the real clock while the fake one stands
  check(`${name}: the globe picture is in on the paused clock`,await globeIn(p));
  for(const at of TIMES){
    s=await state(p);if(at>s.t)await p.clock.runFor(Math.round(at-s.t));
    await p.waitForTimeout(80);s=await state(p);
    await p.screenshot({path:path.join(OUT,`${name}-t${(at/1000).toFixed(1)}.png`)});
    rows.push([name,at,s.t.toFixed(0),s.ready,s.loader,s.mask?'mask':'',s.step]);
    if(at===6800)check(`${name} 6.8 s: still opening, not usable yet`,!s.ready&&s.loader&&!!s.mask,JSON.stringify(s));
    // the page's frames run on the clock's 16 ms grid: the one at or past 8.0 s comes within two frames
    if(at===8000){await p.clock.runFor(34);await p.waitForTimeout(80);s=await state(p);}
    if(at===8000)check(`${name} 8.0 s: usable, loader and ripple canvas gone, focus on the way in, not busy`,s.ready&&!s.loader&&s.rip[0]===0&&s.rip[2]&&s.busy===null&&(name==='390x844'||s.focus==='gate-enter'),JSON.stringify(s));
    if(at===1000)check(`${name} 1.0 s: still loading, entry screen readable (not inert), loader takes the pointer`,!s.ready&&!s.inert&&s.pe==='auto'&&s.busy==='true',JSON.stringify(s));
  }
  // no jump: the globe frame (Korea's place, set by layout) right before and after the end, and a second later
  await ctx.close();
}
// the refraction is real: the globe canvas at the same time on the paused clock, with the rings' push and with it set to
// 0 (intro.js served with WAVE.refract 0), differs only where the rings pass
{
  const grab=async refract=>{const ctx=await browser.newContext(DESK),p=await page(ctx);
    if(refract===0)await p.route('**/intro.js*',async r=>{const res=await r.fetch();r.fulfill({response:res,body:(await res.text()).replace(/refract:\d+/,'refract:0')});});
    await p.clock.install();await p.keepMarks();await p.goto(URL0,{waitUntil:'commit'});await until(p,s=>s.t!==null);await p.clock.pauseAt(Date.now()+50);await globeIn(p);
    let s=await state(p);await p.clock.runFor(Math.round(5000-s.t));await p.waitForTimeout(80);
    const px=await p.evaluate(()=>{const c=document.querySelector('#site-gate .gate-sea');return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data.filter((_,i)=>i%4!==3));});
    await ctx.close();return px;};
  const a=await grab(),b=await grab(0);let moved=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>12)moved++;
  check(`refraction: the rings bend the globe where they pass (${(moved/a.length*100).toFixed(2)}% of the globe canvas differs at 5.0 s)`,moved/a.length>.002&&moved/a.length<.3,String(moved));
}
fs.writeFileSync(path.join(OUT,'frames.tsv'),rows.map(r=>r.join('\t')).join('\n')+'\n');

// 2) the measured length on the real clock: cold cache, warm cache (a second visit in the same browser), Slow 4G
const timing=[];
async function measure(label,opt,{throttle,video,ctx:given}={}){
  const ctx=given||await browser.newContext({...opt,...(video?{recordVideo:{dir:OUT,size:opt.viewport}}:{})}),p=await page(ctx);
  if(throttle){const c=await ctx.newCDPSession(p);await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions',{offline:false,latency:562.5,downloadThroughput:1.6*1e6/8*.9,uploadThroughput:750*1e3/8*.9});}
  const t=Date.now();await p.goto(URL0,{waitUntil:'commit'});
  const s=await until(p,s=>s.ready,60000);
  // a look a second later: nothing comes back (no loader, rings or second reveal)
  await p.waitForTimeout(1000);const after=await state(p);
  const marks=await p.evaluate(()=>Object.fromEntries(performance.getEntriesByType('mark').map(m=>[m.name,Math.round(m.startTime)])));
  const fp=await p.evaluate(()=>Math.round(performance.getEntriesByType('paint')[0]?.startTime??-1));
  timing.push({label,len:s.len,start:marks['intro:start'],firstPaint:fp,globe:marks['bbvm-globe-decoded']??marks['bbvm-globe-gl-ready'],errors:p.errors.length});
  check(`${label}: intro:start → intro:done ${s.len?.toFixed(0)} ms, within 7.8–8.3 s`,s.len>=7800&&s.len<=8300,JSON.stringify({s,marks}));
  check(`${label}: a second after, the entry screen stays (no loader, no replay)`,after.ready&&!after.loader&&after.on,JSON.stringify(after));
  check(`${label}: no console errors`,p.errors.length===0,p.errors.join(' | '));
  if(video){const v=await p.video()?.path();await p.close();await ctx.close();if(v)fs.renameSync(v,path.join(OUT,`${label.replace(/[^\w-]+/g,'-')}.webm`));return;}
  return {ctx,p};
}
for(const [name,opt] of [['1440x900',DESK],['390x844',PHONE]]){
  await measure(`${name} cold`,opt,{video:true});
  const ctx=await browser.newContext(opt);
  const first=await measure(`${name} cold (for warm)`,opt,{ctx});await first.p.close();
  const warm=await measure(`${name} warm`,opt,{ctx});await warm.p.close();await ctx.close();
  await measure(`${name} Slow 4G`,opt,{throttle:true});
}
fs.writeFileSync(path.join(OUT,'timing.json'),JSON.stringify(timing,null,1));

// 3) a globe that does not come: the wait line past 8 s, the timeout's error and retry, then in
{
  const hold=[],ctx=await browser.newContext(DESK),p=await page(ctx,{hold});await p.goto(URL0,{waitUntil:'commit'});
  let s=await until(p,s=>s.t>8600,15000);
  await p.screenshot({path:path.join(OUT,'wait-8.6s.png')});
  check('globe held: past 8 s the loader stays and says it is preparing the globe (no empty or half globe)',s.loader&&!s.ready&&s.step==='지구 화면을 준비하는 중'&&!s.mask,JSON.stringify(s));
  s=await until(p,s=>s.fail,20000);
  await p.screenshot({path:path.join(OUT,'fail-20s.png')});
  check(`globe held: by the timeout (${s.t?.toFixed(0)} ms) the error line with 다시 시도 and 지도 바로 열기`,s.fail&&s.t>=20000&&s.t<21500&&!s.ready,JSON.stringify(s));
  const btns=await p.evaluate(()=>[...document.querySelectorAll('#site-gate .gate-fail button')].map(b=>b.textContent));
  check('the error offers 다시 시도 and 지도 바로 열기',JSON.stringify(btns)===JSON.stringify(['다시 시도','지도 바로 열기']),JSON.stringify(btns));
  await p.unroute('**/*');await p.route('**/*',r=>{const u=r.request().url();if(u.includes('/rest/v1/'))return r.abort();return local(u)?r.continue():r.abort();});
  for(const r of hold.splice(0))r.abort().catch(()=>{}); // the stuck requests end as failures; the retry asks again
  await p.click('#site-gate .gate-retry');const at=(await state(p)).t;
  s=await until(p,s=>s.ready,15000);
  check(`retry: the globe comes and the entry screen opens over the late reveal (${((s.t-at)/1000).toFixed(1)} s after the click)`,s.ready&&!s.loader,JSON.stringify(s));
  await ctx.close();
}
// the globe in late but before the end: it opens from then and is usable by max(late, total−then) after
{
  const hold=[],ctx=await browser.newContext(DESK),p=await page(ctx,{hold});await p.goto(URL0,{waitUntil:'commit'});
  let s=await until(p,s=>s.t>5000,15000);
  check('globe held at 5 s: no opening yet (the loader whole)',s.loader&&!s.mask,JSON.stringify(s));
  for(const r of hold.splice(0))r.continue().catch(()=>{});
  s=await until(p,s=>s.ready,15000);
  check(`globe in after 5 s: usable at ${s.len?.toFixed(0)} ms (late opening of at least 1.8 s, and not before 8 s)`,s.ready&&s.len>=8000&&s.len<=9500,JSON.stringify(s));
  await ctx.close();
}

// 4) still (reduced motion): no rings, a cross-fade, usable at 8 s
{
  const ctx=await browser.newContext({...DESK,reducedMotion:'reduce'}),p=await page(ctx);
  await p.clock.install();await p.keepMarks();await p.goto(URL0,{waitUntil:'commit'});await until(p,s=>s.t!==null);await p.clock.pauseAt(Date.now()+50);
  await globeIn(p);
  const seen=[];
  for(const at of [3000,5500,6800,8000]){let s=await state(p);if(at>s.t)await p.clock.runFor(Math.round(at-s.t));await p.waitForTimeout(80);s=await state(p);
    if(at===8000){await p.clock.runFor(34);await p.waitForTimeout(80);s=await state(p);} // the frame on the 16 ms grid past 8.0 s
    const lit=await p.evaluate(()=>{const c=document.querySelector('#site-gate .gate-ripple'),x=c.getContext('2d');if(!c.width)return 0;const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;return n;});
    seen.push({at,op:+s.loaderOpacity,mask:!!s.mask,lit,ready:s.ready});await p.screenshot({path:path.join(OUT,`still-t${(at/1000).toFixed(1)}.png`)});}
  check('still: no drop or rings drawn, no mask, the loader cross-fades (1 → between → gone) and the screen opens at 8 s',
    seen.every(x=>x.lit===0&&!x.mask)&&seen[0].op===1&&seen[1].op>0&&seen[1].op<1&&seen[2].op<seen[1].op&&seen[3].ready,JSON.stringify(seen));
  await ctx.close();
}

// 5) no replay inside the app: in, then other tabs and a species; a reload in the same tab plays the piece again from the
// loader (2026-10-18, verification/2026-10-18-reload-shows-intro); and the end has no jump
{
  const ctx=await browser.newContext(DESK),p=await page(ctx);await p.goto(URL0);
  let s=await until(p,s=>s.ready,15000);
  const a={kx:s.kx,ky:s.ky};await p.waitForTimeout(1200);s=await state(p);
  check('no jump: the globe frame (Korea\'s place) is the same at the end and a second later',a.kx===s.kx&&a.ky===s.ky&&!!a.kx,JSON.stringify({a,b:{kx:s.kx,ky:s.ky}}));
  await p.keyboard.press('Enter');await p.waitForTimeout(1200);
  await p.evaluate(()=>{setView('compare');});await p.waitForTimeout(400);await p.evaluate(()=>{setView('method');});await p.waitForTimeout(400);
  await p.evaluate(()=>{setView('explore');const id=data.species[0]?.id;if(id)applyHash({s:String(id)});});await p.waitForTimeout(600);
  const inApp=await p.evaluate(()=>({on:document.documentElement.classList.contains('gate-on'),hidden:document.getElementById('site-gate').hidden}));
  await p.reload();await p.waitForTimeout(2500);
  const reloaded=await p.evaluate(()=>({on:document.documentElement.classList.contains('gate-on'),ready:document.getElementById('site-gate').classList.contains('is-ready'),start:performance.getEntriesByName('intro:start').length}));
  check('no replay: switching tabs and species shows no intro; a reload in the same tab plays it again from the loader (2026-10-18)',!inApp.on&&inApp.hidden&&reloaded.on&&!reloaded.ready&&reloaded.start===1,JSON.stringify({inApp,reloaded}));
  check('no console errors through the app',p.errors.length===0,p.errors.join(' | '));
  await ctx.close();
}
// the keyboard during the piece: Tab into the entry screen ends it at once (the focus is never on something hidden)
{
  const ctx=await browser.newContext(DESK),p=await page(ctx);await p.goto(URL0,{waitUntil:'commit'});
  await until(p,s=>s.t>2000);await p.keyboard.press('Tab');const s=await until(p,s=>s.ready,3000);
  check('keyboard: Tab during the piece opens the entry screen at once with the focus where it went',s.ready&&s.t<4000&&s.focus!=='gate-loader',JSON.stringify(s));
  await ctx.close();
}

// 6) the turning globe's path (WebGL shader): this Chromium has no GPU, so WebGL runs on SwiftShader and the page is told
// the renderer is a GPU (the name only, as motion_check does) and that it may use it; the frames are slow (a few a second)
{
  const gl=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const HW="{for(const P of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){const o=P.prototype.getParameter;P.prototype.getParameter=function(p){return p===0x9246?'check GPU':o.call(this,p);};}"+
    "const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,o){return g.call(this,t,o&&/webgl/.test(t)?{...o,failIfMajorPerformanceCaveat:false}:o);};}";
  const shots=[];
  for(const refract of [10,0]){
    const ctx=await gl.newContext(DESK),p=await page(ctx);await p.addInitScript(HW);
    if(refract===0)await p.route('**/intro.js*',async r=>{const res=await r.fetch();r.fulfill({response:res,body:(await res.text()).replace(/refract:\d+/,'refract:0')});});
    await p.clock.install();await p.keepMarks();await p.goto(URL0,{waitUntil:'commit'});await until(p,s=>s.t!==null);await p.clock.pauseAt(Date.now()+50);
    const ok=await globeIn(p);const kind=await p.evaluate(()=>(window.__marks||[]).map(m=>m[0]).filter(n=>/bbvm-globe/.test(n)));
    let s=await state(p);await p.clock.runFor(Math.round(5000-s.t));await p.waitForTimeout(400);
    if(refract)await p.screenshot({path:path.join(OUT,'webgl-1440x900-t5.0.png')});
    shots.push(await p.evaluate(()=>{const c=document.querySelector('#site-gate .gate-sea');return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data.filter((_,i)=>i%4!==3));}));
    if(refract){check('WebGL path: the turning globe\'s textures are in (not the still picture)',ok&&kind.includes('bbvm-globe-gl-ready')&&!kind.includes('bbvm-globe-decoded'),JSON.stringify(kind));
      s=await state(p);await p.clock.runFor(Math.round(8040-s.t));await p.waitForTimeout(400);s=await state(p);
      await p.screenshot({path:path.join(OUT,'webgl-1440x900-t8.0.png')});
      check('WebGL path: usable at 8 s, no errors',s.ready&&!s.loader&&p.errors.length===0,JSON.stringify({s,e:p.errors}));}
    await ctx.close();
  }
  let moved=0;for(let i=0;i<shots[0].length;i++)if(Math.abs(shots[0][i]-shots[1][i])>12)moved++;
  check(`WebGL path: the shader bends the globe where the rings pass (${(moved/shots[0].length*100).toFixed(2)}% differs at 5.0 s)`,moved/shots[0].length>.002&&moved/shots[0].length<.3,String(moved));
  await gl.close();
}
await browser.close();
console.log(timing);
fs.writeFileSync(path.join(OUT,'results.txt'),results.map(([ok,n])=>`${ok?'PASS':'FAIL'} ${n}`).join('\n')+`\n${results.filter(r=>r[0]).length}/${results.length} passed\n`);
console.log(`${results.filter(r=>r[0]).length}/${results.length} passed`);process.exit(results.every(r=>r[0])?0:1);
