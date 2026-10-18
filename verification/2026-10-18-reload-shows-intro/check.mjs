// A reload shows the entry screen again from the loader (2026-10-18, LKH): F5 and Ctrl+F5 on 비교와 지표 · 탐색 지도 ·
// 근거와 방법, on a 390 px phone and with 움직임 줄이기; the species and the map position stay, the button picks the tab,
// the page behind stays at the top and nothing closes the screen early (hashchange). Unchanged: a shared link (new tab,
// same tab), Back, the app's own reload for newer data (with the map up: no entry screen; with the screen up: the screen
// again, once). Also what Chromium calls opening the identical address again, and no console errors. Screenshots.
// Playwright (Chromium) with the production API answered from live-snapshot.json, like uicheck's FIXTURE. Map tiles are cut.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 --directory dist, then
//      node verification/2026-10-18-reload-shows-intro/check.mjs <out-dir>   (needs the playwright package; CHROME_PATH optional)
import {chromium} from 'playwright';
import fs from 'node:fs';import path from 'node:path';
const OUT=process.argv[2]||'reload-shows-intro';fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const fx=JSON.parse(fs.readFileSync(process.env.FIXTURE||new URL('../../dist/live-snapshot.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],ways=[];const check=(name,ok,detail='')=>{results.push([ok,name]);console.log(ok?'PASS':'FAIL',name,ok?'':detail);};
const PHONE={viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const DESK={viewport:{width:1440,height:900}};
const S=241776,M='7/34.60/127.90',OTHER=274849;
const local=u=>u.startsWith(URL0);
const pages=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// a page with the API answered from the snapshot, other sites cut, errors and loads counted; with newer.on the
// matrix readiness file says schema 2, a file newer than this app.js (app.js reloadOnceForNewData)
async function page(ctx,newer={on:false}){
  const p=await ctx.newPage();p.errors=[];p.loads=0;pages.push(p);
  p.on('pageerror',e=>p.errors.push(String(e)));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|ERR_ABORTED|net::ERR_BLOCKED/.test(m.text()))p.errors.push(m.text());});
  p.on('load',()=>p.loads++);
  await p.addInitScript(()=>{window.__hc=0;addEventListener('hashchange',()=>window.__hc++);});
  await p.route('**/*',async r=>{const u=r.request().url();
    if(u.includes('/rest/v1/')){const k=u.includes('species_profiles')?'profiles':u.includes('species_map_cells')?'cells':null;return k?r.fulfill({json:fx[k]}):r.abort();}
    if(newer.on&&/\/matrix-readiness\.json/.test(u)){const res=await r.fetch();return r.fulfill({response:res,json:{...(await res.json()),schema_version:2}});}
    return local(u)?r.continue():r.abort();});
  return p;
}
const state=p=>p.evaluate(()=>{const g=document.getElementById('site-gate'),h=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search),
  st=performance.getEntriesByName('intro:start')[0];
  return {type:performance.getEntriesByType('navigation')[0]?.type,on:document.documentElement.classList.contains('gate-on'),ready:g.classList.contains('is-ready'),
    loader:!g.querySelector('.gate-loader').hidden,starts:performance.getEntriesByName('intro:start').length,t:st?Math.round(performance.now()-st.startTime):null,
    v:h.get('v')??q.get('v'),s:h.get('s'),m:h.get('m'),entered:sessionStorage.getItem('bbvm-intro-entered'),mark:sessionStorage.getItem('bbvm-app-reload'),
    view:typeof currentView!=='undefined'?currentView:null,sel:typeof selected!=='undefined'?selected?.aphiaID??null:null,
    map:typeof map!=='undefined'&&map?`${map.getZoom()}/${map.getCenter().lat.toFixed(2)}/${map.getCenter().lng.toFixed(2)}`:null,
    y:Math.round(scrollY),restore:history.scrollRestoration,hc:window.__hc,conn:document.getElementById('connection-state')?.textContent||''};});
// polls survive the page starting over (a reload destroys the context the poll ran in)
const until=async(p,f,ms=30000)=>{const end=Date.now()+ms;let s=null;do{try{s=await state(p);if(f(s))return s;}catch{/* the page is starting */}await sleep(50);}while(Date.now()<end);return s;};
const connected=p=>until(p,s=>/연결됨/.test(s.conn),60000);
// from the reload until the screen is usable: it never closes, no hashchange, the page behind stays at the top
async function watchToReady(p){let closed=false,maxY=0,hc=0,s=null;const end=Date.now()+30000;
  while(Date.now()<end){try{s=await state(p);}catch{await sleep(50);continue;}
    maxY=Math.max(maxY,s.y);hc=Math.max(hc,s.hc);if(!s.on){closed=true;break;}if(s.ready)break;await sleep(100);}
  return {...s,closed,maxY,hcMax:hc};}
const gateClick=async(p,sel)=>{await p.click(`#site-gate ${sel}`);await until(p,s=>!s.on,5000);await sleep(900);};
const way=(name,s)=>{ways.push({name,type:s?.type,gate:!!s?.on});return s;};
const reloadNow=async p=>{await p.reload({waitUntil:'domcontentloaded'});return state(p);};
// the piece's start mark comes with its first painted frame: wait for it, then it is at its beginning
const started=p=>until(p,s=>s.starts===1||!s.on,10000);
const fromLoader=(s,st)=>s.type==='reload'&&s.on&&s.loader&&!s.ready&&st.on&&!st.ready&&st.starts===1&&st.t<1000;
// in: the first visit's screen, then Enter
async function firstIn(p){await p.goto(URL0);await until(p,s=>s.ready);await p.click('#gate-enter');await until(p,s=>!s.on,5000);await connected(p);}

// 1) 1440: 비교와 지표 with a species and a map position, scrolled; F5
{const ctx=await browser.newContext(DESK),p=await page(ctx);
  await firstIn(p);
  await p.evaluate(({S})=>{selectSpecies(S);map.setView([34.6,127.9],7,{animate:false});setView('compare');},{S});await sleep(400);
  await p.evaluate(()=>scrollTo(0,600));await sleep(200);
  const before=await state(p);
  check('1440 before: 비교와 지표, species, map position in the address',before.view==='compare'&&before.v==='compare'&&before.s===String(S)&&before.m===M,JSON.stringify(before));
  let s=way('F5 (page.reload) on 비교와 지표',await reloadNow(p)),st=await started(p);
  await p.screenshot({path:path.join(OUT,'1440-reload-first-second.png')});
  check('1440 F5: the entry screen from the loader, not usable yet; the piece from its start',fromLoader(s,st),JSON.stringify({s,st}));
  check('1440 F5: entered forgotten, the tab (v) out of the address, species and map position kept',s.entered===null&&s.v===null&&s.s===String(S)&&s.m===M,JSON.stringify(s));
  check('1440 F5: the page behind at the top, scroll restoration held',s.y===0&&s.restore==='manual',JSON.stringify({before:before.y,s}));
  s=await watchToReady(p);
  await p.screenshot({path:path.join(OUT,'1440-reload-ready.png')});
  check('1440 F5: the whole piece plays (usable at 8 s), never closes, no hashchange, the page behind stays at the top',s.ready&&!s.closed&&s.t>=7900&&s.hcMax===0&&s.maxY===0,JSON.stringify(s));
  s=await connected(p);
  check('1440 F5: under the screen the app has the same species and map position',s.on&&s.sel===S&&s.map===M,JSON.stringify(s));
  await p.keyboard.press('Enter');await until(p,s=>!s.on,5000);await sleep(900);s=await state(p);
  await p.screenshot({path:path.join(OUT,'1440-after-enter.png')});
  check('1440 Enter (바다 탐색하기): 탐색 지도 with the same species and map position, at the top, restoration back to auto',
    !s.on&&s.view==='explore'&&s.v==='explore'&&s.sel===S&&s.map===M&&s.entered==='1'&&s.y===0&&s.restore==='auto',JSON.stringify(s));

  // 탐색 지도: F5, then 지표 살펴보기
  s=way('F5 on 탐색 지도',await reloadNow(p));st=await started(p);
  check('1440 F5 on 탐색 지도: the entry screen from the loader',fromLoader(s,st),JSON.stringify({s,st}));
  await watchToReady(p);await connected(p);await gateClick(p,'.gate-more');s=await state(p);
  check('1440 지표 살펴보기 after F5: 비교와 지표, same species and map position',!s.on&&s.view==='compare'&&s.v==='compare'&&s.sel===S&&s.map===M,JSON.stringify(s));

  // 근거와 방법: F5, then 전체 출처·방법 보기
  await p.evaluate(()=>setView('method'));await sleep(300);
  s=way('F5 on 근거와 방법',await reloadNow(p));st=await started(p);
  check('1440 F5 on 근거와 방법: the entry screen from the loader',fromLoader(s,st),JSON.stringify({s,st}));
  await watchToReady(p);await connected(p);await gateClick(p,'.gate-method');s=await state(p);
  check('1440 전체 출처·방법 보기 after F5: 근거와 방법, same species',!s.on&&s.view==='method'&&s.v==='method'&&s.sel===S,JSON.stringify(s));

  // Ctrl+F5 / Shift+F5: a reload that skips the cache
  const cdp=await ctx.newCDPSession(p);
  await Promise.all([p.waitForEvent('domcontentloaded'),cdp.send('Page.reload',{ignoreCache:true})]);s=way('Ctrl+F5 (reload, cache skipped)',await state(p));st=await started(p);
  check('1440 Ctrl+F5: the entry screen from the loader',fromLoader(s,st),JSON.stringify({s,st}));
  await watchToReady(p);await connected(p);await p.keyboard.press('Enter');s=await until(p,s=>!s.on,5000);
  check('1440 Enter after Ctrl+F5: 탐색 지도, same species',!s.on&&s.view==='explore'&&s.sel===S,JSON.stringify(s));

  // a shared link opened in this tab while the map is up: only the # part changes, the same page stays
  await p.goto(`${URL0}#s=${S}&v=compare&m=${M}`);await sleep(1500);s=way('shared link opened in the tab showing the map (only # changes, same page)',await state(p));
  check('1440 shared link in the same tab: no entry screen, the link\'s tab and species',!s.on&&s.view==='compare'&&s.sel===S,JSON.stringify(s));
  // the link opened as a new page in this tab (from another page): navigate
  await p.goto('about:blank');await p.goto(`${URL0}#s=${OTHER}&v=method`);await connected(p);await sleep(800);s=way('shared link, new page in the same tab',await state(p));
  check('1440 shared link as a new page in the same tab: no entry screen',s.type==='navigate'&&!s.on&&s.view==='method'&&s.sel===OTHER,JSON.stringify(s));
  // another page, then Back
  await p.goto(URL0+'expedition.html');await sleep(800);await p.goBack();await connected(p);await sleep(600);s=way('바다 탐험 → 뒤로',await state(p));
  check('1440 바다 탐험 then Back: no entry screen, the tab as left',!s.on&&s.view==='method'&&s.sel===OTHER,JSON.stringify(s));
  // the identical address opened again (Enter in the address bar): Chromium may treat it as a reload or as the same page
  await p.goto(p.url(),{waitUntil:'domcontentloaded'});s=way('the identical address opened again (with #…)',await state(p));
  check('1440 identical address again: the screen follows the type Chromium reports (observation)',(s.type==='reload')===s.on,JSON.stringify(s));
  if(s.on){await watchToReady(p);await p.keyboard.press('Enter');await until(p,s=>!s.on,5000);}
  await p.evaluate(()=>history.replaceState(null,'',location.pathname));
  await p.goto(URL0,{waitUntil:'domcontentloaded'});s=way('the address without # opened again (entered before)',await state(p));
  check('1440 address without # opened again: the screen follows the type Chromium reports (observation)',(s.type==='reload')===s.on,JSON.stringify(s));
  if(s.on){await watchToReady(p);await p.keyboard.press('Enter');await until(p,s=>!s.on,5000);}
  await connected(p);

  // a link opened while the reload's screen is up closes it, as on the first visit's screen
  s=way('F5, then a link opened while the screen is up',await reloadNow(p));s=await connected(p);
  check('1440 F5: still the screen once the data is in',s.on&&!s.ready,JSON.stringify(s));
  await p.evaluate(o=>{location.hash=`s=${o}&v=compare`;},OTHER);await sleep(1500);s=await state(p);
  check('1440 a link opened while the reload\'s screen is up: the screen closes, the link\'s tab and species',!s.on&&s.view==='compare'&&s.sel===OTHER,JSON.stringify(s));
  await ctx.close();}

// 2) 390 phone: 비교와 지표 scrolled down, F5 (what pull to refresh does)
{const ctx=await browser.newContext(PHONE),p=await page(ctx);
  await firstIn(p);
  await p.evaluate(({S})=>{selectSpecies(S);map.setView([34.6,127.9],7,{animate:false});setView('compare');},{S});await sleep(400);
  await p.evaluate(()=>scrollTo(0,900));await sleep(300);
  const before=await state(p);
  let s=way('390: F5 on 비교와 지표 (scrolled)',await reloadNow(p)),st=await started(p);
  await p.screenshot({path:path.join(OUT,'390-reload-first-second.png')});
  check('390 F5: the entry screen from the loader, the page behind at the top',before.y>0&&fromLoader(s,st)&&s.y===0&&s.v===null&&s.m===M,JSON.stringify({before:before.y,s,st}));
  s=await watchToReady(p);
  await p.screenshot({path:path.join(OUT,'390-reload-ready.png')});
  check('390 F5: usable at 8 s, never closes, no scroll behind',s.ready&&!s.closed&&s.t>=7900&&s.maxY===0&&s.hcMax===0,JSON.stringify(s));
  await connected(p);await gateClick(p,'.gate-more');s=await state(p);
  await p.screenshot({path:path.join(OUT,'390-after-enter.png')});
  check('390 지표 살펴보기: 비교와 지표 at the top, same species and map position, restoration auto',!s.on&&s.view==='compare'&&s.sel===S&&s.map===M&&s.y===0&&s.restore==='auto',JSON.stringify(s));
  await ctx.close();}

// 3) 움직임 줄이기: the system setting, and the screen's own switch
for(const [name,opt,pre] of [['system reduced motion',{...DESK,reducedMotion:'reduce'},null],['the screen\'s 움직임 줄이기 switch',DESK,'1']]){
  const ctx=await browser.newContext(opt),p=await page(ctx);
  if(pre)await p.addInitScript(v=>{try{localStorage.setItem('bbvm-reduce-motion',v);}catch{}},pre);
  await firstIn(p);
  let s=way(`F5 with ${name}`,await reloadNow(p)),st=await started(p);
  check(`${name}: F5 shows the entry screen, not usable yet`,s.type==='reload'&&s.on&&!s.ready&&st.on&&!st.ready&&st.starts===1,JSON.stringify({s,st}));
  s=await watchToReady(p);
  check(`${name}: becomes usable without closing`,s.ready&&!s.closed,JSON.stringify(s));
  await p.click('#gate-enter');s=await until(p,s=>!s.on,5000);
  check(`${name}: 바다 탐색하기 opens 탐색 지도`,!s.on&&s.view==='explore',JSON.stringify(s));
  await ctx.close();}

// 4) the app's own reload for a data file newer than its code (app.js reloadOnceForNewData)
// 4a) the map up: ↻ finds the newer file, reloads once, the map comes back without the entry screen
{const newer={on:false},ctx=await browser.newContext(DESK),p=await page(ctx,newer);
  await firstIn(p);
  await p.evaluate(({S})=>{selectSpecies(S);map.setView([34.6,127.9],7,{animate:false});setView('compare');},{S});await sleep(400);
  const loads=p.loads;newer.on=true;await p.evaluate(()=>document.getElementById('reload-data').click()); // the header's ↻
  let s=await until(p,s=>s.type==='reload'&&s.sel!==null,30000);await sleep(2500);s=way('the app\'s own reload, map up',await state(p));
  check('app\'s own reload with the map up: one reload, no entry screen, the mark used, same tab and species',p.loads-loads===1&&s.type==='reload'&&!s.on&&s.mark===null&&s.view==='compare'&&s.sel===S,JSON.stringify({loads:p.loads-loads,s}));
  await ctx.close();}
// 4b) the entry screen up (first visit): the newer file reloads once, and the screen starts again
{const newer={on:true},ctx=await browser.newContext(DESK),p=await page(ctx,newer);
  await p.goto(URL0,{waitUntil:'domcontentloaded'});
  let s=await until(p,s=>s.type==='reload',30000);s=way('the app\'s own reload, entry screen up',s);
  check('app\'s own reload with the entry screen up: the screen again from the loader, no mark',s?.type==='reload'&&s.on&&s.loader&&!s.ready&&s.mark===null,JSON.stringify(s));
  s=await watchToReady(p);await sleep(1500);
  check('app\'s own reload with the entry screen up: no second reload (no loop), usable',p.loads===2&&s.ready&&!s.closed,JSON.stringify({loads:p.loads,s}));
  await p.click('#gate-enter');s=await until(p,s=>!s.on,5000);
  check('app\'s own reload with the entry screen up: 바다 탐색하기 opens the map',!s.on&&s.view==='explore',JSON.stringify(s));
  await ctx.close();}

// 5) a shared link in a new tab: no entry screen (unchanged)
{const ctx=await browser.newContext(PHONE),p=await page(ctx);
  await p.goto(`${URL0}#s=${S}&v=compare&b=basic&t=occurrence&m=${M}`);let s=await connected(p);await sleep(800);s=way('390: shared link in a new tab',await state(p));
  check('390 shared link in a new tab: no entry screen, 비교와 지표, the link\'s species and map position',s.type==='navigate'&&!s.on&&s.view==='compare'&&s.sel===S&&s.m===M,JSON.stringify(s));
  await ctx.close();}

const errors=pages.flatMap(p=>p.errors);
check('no console errors on any page',errors.length===0,JSON.stringify(errors.slice(0,5)));
await browser.close();
console.log('\nway | navigation type | entry screen');
for(const w of ways)console.log(`${w.name} | ${w.type} | ${w.gate?'yes':'no'}`);
fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({results,ways},null,1));
const failed=results.filter(r=>!r[0]).length;
console.log(`\n${results.length-failed}/${results.length} PASS`);
process.exit(failed?1:0);
