// Entry screen (index.html #site-gate) after the 2026-10-13 design: headless Chrome over the DevTools protocol (no deps,
// same approach as uicheck.mjs). Screenshots at the design size and the usual widths, then the ways in and their focus,
// the skip rules (shared link, same tab), the motion switch and the system setting, a failed globe file, the counts and
// cells the app loaded, the drawing loop stopping, keyboard order, and no page errors.
// Run with the site on http://127.0.0.1:8765/ :
//   node verification/2026-10-landing-globe/landing_check.mjs <outdir>            everything
//   node verification/2026-10-landing-globe/landing_check.mjs <outdir> shots      screenshots only
//   URL0=http://127.0.0.1:8766/ node ... <outdir> views                           the three app tabs by shared link (before/after)
//   URL0=http://127.0.0.1:8766/ node ... <outdir> plain                           entry screen screenshots only (works on main too)
import {spawn} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const [OUT,ONLY]=process.argv.slice(2);if(!OUT)throw Error('Usage: node landing_check.mjs <outdir> [shots|views|plain]');
fs.mkdirSync(OUT,{recursive:true});
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run',
  '--disable-gpu','--hide-scrollbars','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map(),requests=[],errors=[],contrastLog=[];
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
const results=[];const check=(name,ok,detail='')=>{results.push({name,status:ok?'PASS':'FAIL',detail:ok?'':String(detail).slice(0,1500)});console.log(ok?'PASS':'FAIL',name,ok?'':String(detail).slice(0,600));};
async function connect(){
  for(let i=0;i<300;i++){try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
    const t=await (await fetch(`http://127.0.0.1:${port}/json`)).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}catch{}await sleep(200);}
  throw Error('no DevTools endpoint');
}
const gate=()=>evaluate(`(()=>{const g=document.getElementById('site-gate'),a=document.activeElement,r=s=>{const e=g.querySelector(s);if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),b:Math.round(b.bottom)}};
  return {on:document.documentElement.classList.contains('gate-on'),hidden:g.hidden,ready:g.classList.contains('is-ready'),still:g.classList.contains('is-still'),focus:a?.id||a?.className||a?.tagName||'',
    counts:g.querySelector('.gate-counts').textContent,note:g.querySelector('.gate-note').hidden?'':g.querySelector('.gate-note').textContent,
    switchOn:g.querySelector('.gate-motion').getAttribute('aria-checked'),
    enter:r('#gate-enter'),title:r('.gate-title'),lead:r('.gate-lead'),actions:r('.gate-actions'),counts_box:r('.gate-counts'),card:r('.gate-callout'),bar:r('.gate-bar'),foot:r('.gate-foot'),
    nav:r('.gate-nav'),motion:r('.gate-motion'),sources:r('.gate-sources'),meta:r('.gate-meta'),vw:innerWidth,vh:innerHeight,doc:document.documentElement.scrollWidth,
    view:document.querySelector('.view.active')?.id,stored:sessionStorage.getItem('bbvm-intro-entered'),motionKept:localStorage.getItem('bbvm-reduce-motion')}})()`);
// the gate markup is parsed after intro.js ran in <head>, so once it exists gate-on is final for this load
async function waitReady(){for(let i=0;i<100;i++){try{const g=await gate();if(g.ready||!g.on)return g;}catch{}await sleep(150);}return gate();}
// After a way in: the leave takes 0.82 s, but right after the data arrives the app's own work can hold the main thread
// for a few hundred ms more, so wait for the screen to be gone (up to 3 s) rather than a fixed time; then, for the source
// list, until its smooth scroll has stopped.
async function waitLeft(ms=3000){const t=Date.now();let g;do{await sleep(100);g=await gate();}while(g.on&&Date.now()-t<ms);return g;}
async function waitScrolled(ms=2500){const t=Date.now();let last=null,y;do{await sleep(120);y=await evaluate('scrollY');if(y===last&&y>0)break;last=y;}while(Date.now()-t<ms);}
async function waitLoaded(){for(let i=0;i<80;i++){try{if(/연결됨|불러오기 실패|연결 실패/.test(await evaluate("document.getElementById('connection-state')?.textContent||''")))return;}catch{}await sleep(250);}}
async function shot(name,clip){const r=await send('Page.captureScreenshot',{format:'png',...(clip?{clip:{...clip,scale:1}}:{})});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}
let scripts=[];
async function onNewDocument(...sources){for(const s of scripts)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:s});scripts=[];
  for(const source of sources)scripts.push((await send('Page.addScriptToEvaluateOnNewDocument',{source})).identifier);}
// counts the entry screen's own animation frames (intro.js), apart from the app's and Leaflet's
const RAF_COUNTER="window.__introRaf=0;{const o=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){if(/intro\\.js/.test(new Error().stack||''))window.__introRaf++;return o.call(this,cb);};}";
const CELLS_SPY="addEventListener('bbvm:progress',e=>{if(e.detail?.step==='done')window.__doneCells=e.detail.cells;});";
// A first visit in this tab: storage is cleared on the site's origin, then the page is loaded from a blank page (a
// hash-only change of the same URL would not reload it).
async function open({w=1440,h=900,mobile=false,hash='',keep=false,motion=null,dpr=1}={}){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:dpr,mobile});
  if(!keep){
    if(!(await evaluate('location.href')).startsWith(URL0)){await send('Page.navigate',{url:URL0});await sleep(200);}
    await evaluate(`try{sessionStorage.clear();${motion===null?"localStorage.removeItem('bbvm-reduce-motion')":`localStorage.setItem('bbvm-reduce-motion','${motion}')`}}catch{};1`);
  }
  await send('Page.navigate',{url:'about:blank'});
  for(let i=0;i<50&&(await evaluate('location.href').catch(()=>''))!=='about:blank';i++)await sleep(50);
  requests.length=0;
  await send('Page.navigate',{url:URL0+hash});
  // Page.navigate returns before the new document commits: wait until it is the site again with its gate parsed
  for(let i=0;i<100;i++){if(await evaluate("location.href!=='about:blank'&&!!document.getElementById('site-gate')").catch(()=>false))break;await sleep(50);}
}
const overlap=(a,b)=>a&&b&&a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
// The globe as drawn (canvas pixels, independent of the layout code) against the copy lines as drawn (text ranges): no
// globe under a copy line and 1% past its end; a title line may have the globe under its last 6% (as in the design).
const globeClear=()=>evaluate(`(()=>{const g=document.getElementById('site-gate'),c=g.querySelector('.gate-sea'),x=c.getContext('2d'),k=c.width/innerWidth,w=innerWidth;
  const box=n=>{const r=document.createRange();r.selectNodeContents(n);return r.getBoundingClientRect();};
  const lines=[...g.querySelectorAll('.gate-title span')].map(s=>[s,true]).concat([...g.querySelectorAll('.gate-lead,.gate-more,.gate-note,.gate-counts')].filter(n=>n.getClientRects().length).map(n=>[n,false]));
  return lines.map(([n,title])=>{const b=box(n),l=Math.max(0,b.left),r=Math.min(w,title?b.right-.06*w:b.right+.01*w);let worst=0;
    if(r>l){const d=x.getImageData(Math.round(l*k),Math.round(b.top*k),Math.max(1,Math.round((r-l)*k)),Math.max(1,Math.round(b.height*k))).data;for(let i=3;i<d.length;i+=4)worst=Math.max(worst,d[i]);}
    return {text:n.textContent.trim().slice(0,12),alpha:worst};});})()`);
// WCAG contrast of every gate text against the pixels behind it: the boxes and colours, then the same screen with all
// gate text made transparent (backgrounds, shades and the globe stay), read back in the page. Light text is judged on
// the lightest 5% of its background, dark text on the darkest 5%. 4.5:1, or 3:1 from 24px (18.66px bold).
async function contrast(){
  const items=await evaluate(`(()=>{const out=[],hero=document.querySelector('#site-gate .gate-hero'),walk=document.createTreeWalker(hero,NodeFilter.SHOW_TEXT);
    for(let n;n=walk.nextNode();){const t=n.textContent.trim(),el=n.parentElement;if(!t||!el.getClientRects().length)continue;
      const own=el.getBoundingClientRect();if(own.width<2||own.height<2)continue; // a label kept only for screen readers (1px, clipped)
      const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();if(b.width<2||b.height<2||b.bottom<0||b.top>innerHeight)continue;
      const s=getComputedStyle(el);out.push({text:t.slice(0,16),color:s.color,size:parseFloat(s.fontSize),weight:+s.fontWeight,box:[b.left,b.top,b.width,b.height].map(Math.round)});}
    return out;})()`);
  await evaluate("(()=>{const s=document.createElement('style');s.id='lc-hide';s.textContent='#site-gate *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';document.head.append(s);return 1})()");
  await sleep(120);const png=(await send('Page.captureScreenshot',{format:'png'})).data;
  await evaluate("document.getElementById('lc-hide').remove();1");
  return evaluate(`(async()=>{const bmp=await createImageBitmap(await (await fetch('data:image/png;base64,${png}')).blob()),c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);
    const lin=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4},L=p=>.2126*lin(p[0])+.7152*lin(p[1])+.0722*lin(p[2]);
    return ${JSON.stringify(items)}.map(it=>{let [l,t,w,h]=it.box;l=Math.max(0,l);t=Math.max(0,t);w=Math.max(1,Math.min(w,bmp.width-l));h=Math.max(1,Math.min(h,bmp.height-t));
      const d=x.getImageData(l,t,w,h).data,px=[];for(let i=0;i<d.length;i+=8)px.push([d[i],d[i+1],d[i+2]]);px.sort((a,b)=>L(a)-L(b));
      const m=it.color.match(/[\\d.]+/g).map(Number),a=m.length>3?m[3]:1,over=bg=>bg.map((v,i)=>a*m[i]+(1-a)*v);
      const mid=px[px.length>>1],light=L(over(mid))>L(mid),bg=light?px[Math.floor(px.length*.95)]:px[Math.floor(px.length*.05)];
      const lt=L(over(bg)),lb=L(bg),ratio=(Math.max(lt,lb)+.05)/(Math.min(lt,lb)+.05),need=it.size>=24||(it.size>=18.66&&it.weight>=700)?3:4.5;
      return {text:it.text,size:it.size,ratio:Math.round(ratio*100)/100,need,ok:ratio>=need};});})()`);
}
const click=sel=>evaluate(`document.querySelector(${JSON.stringify(sel)}).click();1`);
async function key(k){const code={Enter:13,Tab:9}[k];for(const type of ['keyDown','keyUp'])
  await send('Input.dispatchKeyEvent',{type,key:k,code:k,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,...(type==='keyDown'&&k==='Enter'?{text:'\r'}:{})});}
try{
  ws=new WebSocket(await connect());
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(Error(m.error.message)):p.res(m.result);return;}
    if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('console.error: '+m.params.args.map(x=>x.value??x.description).join(' '));};
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Page.navigate',{url:URL0});await sleep(500);

  if(ONLY==='views'){
    // the app tabs opened by a shared link (no entry screen): compared before/after the change
    for(const [name,hash] of [['view-explore','#s=241776&v=explore'],['view-compare','#s=241776&v=compare'],['view-method','#s=241776&v=method']]){
      await open({hash});await waitLoaded();await sleep(1800);await shot(name);
    }
    throw 'done';
  }

  // ---------- screenshots: the design size first, then the usual widths ----------
  for(const [w,h,mobile] of [[1672,941],[1440,900],[1920,1080],[1280,800],[1180,820],[1024,768],[820,1180,true],[768,1024,true],[390,844,true],[360,640,true]]){
    await open({w,h,mobile});let g=await waitReady();await sleep(2200);g=await gate();await shot(`gate-${w}x${h}`);
    if(ONLY==='plain')continue;
    const boxes=['title','lead','actions','counts_box','card','bar','foot'].map(k=>[k,g[k]]).filter(([,b])=>b);
    const clipped=boxes.filter(([,b])=>b.l<0||b.r>g.vw||b.t<0||b.b>g.vh).map(([k])=>k);
    const clash=[['title','card'],['lead','card'],['actions','card'],['counts_box','card'],['card','foot'],['card','bar'],['actions','foot'],['counts_box','foot'],['nav','motion']].filter(([a,b])=>overlap(g[a],g[b]));
    check(`${w}×${h}: entry screen up, button in the first screen, nothing clipped or overlapping, no sideways scroll`,
      g.on&&g.ready&&g.enter&&g.enter.b<=g.vh&&g.enter.l>=0&&g.enter.r<=g.vw&&!clipped.length&&!clash.length&&g.doc<=g.vw,JSON.stringify({clipped,clash,g}));
    if(!await evaluate("getComputedStyle(document.querySelector('.gate-globe')).display!=='none'")){
      const lines=await globeClear();
      check(`${w}×${h}: the globe keeps clear of the copy (title lines may touch it by 6% of the width, as in the design)`,lines.every(l=>l.alpha<40),JSON.stringify(lines));
    }
    const cr=await contrast(),low=cr.filter(c=>!c.ok);
    check(`${w}×${h}: every text on the entry screen meets WCAG AA against the pixels behind it (lowest ${Math.min(...cr.map(c=>c.ratio))}:1)`,cr.length>10&&!low.length,JSON.stringify(low.length?low:cr.slice(0,3)));
    contrastLog.push({size:`${w}x${h}`,lowest:[...cr].sort((a,b)=>a.ratio/a.need-b.ratio/b.need).slice(0,4)});
  }
  if(ONLY==='plain')throw 'done';
  fs.writeFileSync(path.join(OUT,'contrast.json'),JSON.stringify(contrastLog,null,1));
  // the clipped coastline file's box sides (105°E, 53°N, 20°N, 150°E) must not show as straight lines: crops to look at
  await open({w:1672,h:941});await waitReady();await sleep(2200);
  const spots=await evaluate(`(()=>{const f=globeFrame(innerWidth,innerHeight,null);return [[105,42],[105,30],[120,53],[110,20],[150,47],[150,58]].map(([lon,lat])=>{const p=project(lon,lat);return p&&{lon,lat,x:Math.round(f.cx+p.x*f.R),y:Math.round(f.cy-p.y*f.R)};})})()`);
  for(const s of spots.filter(Boolean)){const x=Math.max(0,Math.min(1672-240,s.x-120)),y=Math.max(0,Math.min(941-160,s.y-80));await shot(`cut-${s.lon}E-${s.lat}N`,{x,y,width:240,height:160});}
  check('Cut-side crops captured on screen (105°E, 53°N, 20°N, 150°E)',spots.filter(Boolean).length>=4,JSON.stringify(spots));
  if(ONLY==='shots')throw 'done';

  // ---------- loader → entry screen → leave → map, with the globe files fetched only now ----------
  await onNewDocument(RAF_COUNTER,CELLS_SPY);
  await open();await sleep(60);await shot('loader');
  let g=await waitReady();
  check('Fresh tab: loader then entry screen, button focused, counts from the app (published/candidate split shown)',
    g.on&&g.ready&&g.focus==='gate-enter'&&g.counts===await evaluate("`${data.publishedCount+data.candidateCount}종의 해양생물(운영 발행 ${data.publishedCount} · 조사 후보 ${data.candidateCount}) · 공개 데이터 기반`"),JSON.stringify(g));
  check('Fresh tab: the globe files are fetched (the entry screen shows)',['land-50m.json','bathymetry-10m.json'].every(f=>requests.some(u=>u.includes('/vendor/globe-v1/'+f))),requests.filter(u=>u.includes('vendor')).join(' '));
  const cellsOk=await evaluate(`(()=>{const mine=new Set((window.__doneCells||[]).map(c=>c.lat+','+c.lon+','+c.size)),app=new Set(data.species.flatMap(s=>s.cells||[]).map(c=>c.lat0+','+c.lon0+','+c.sizeDeg));return {n:mine.size,same:mine.size===app.size&&[...app].every(k=>mine.has(k)),sizes:[...new Set([...mine].map(k=>k.split(',')[2]))]}})()`);
  check('Globe cells are exactly the public cells the app loaded (1° and sensitive 4°), none added',cellsOk.same&&cellsOk.n>0,JSON.stringify(cellsOk));
  await sleep(2000);
  const idle0=await evaluate('window.__introRaf');await sleep(1000);const idle1=await evaluate('window.__introRaf');
  check('Idle entry screen: no drawing loop (no intro.js animation frames while nothing changes)',idle1===idle0,`${idle0} → ${idle1}`);
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});await sleep(600);
  const resized=await evaluate('window.__introRaf');
  check('A resize redraws once and stops again',resized>idle1&&resized-idle1<=3,`${idle1} → ${resized}`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await sleep(600);
  await shot('gate-1440x900-ready');
  await click('#gate-enter');await sleep(300);
  const mid=await evaluate("document.documentElement.classList.contains('gate-leaving')");await shot('leave-mid');
  g=await waitLeft();await sleep(200);g=await gate();
  const after0=await evaluate('window.__introRaf');await sleep(1200);const after1=await evaluate('window.__introRaf');
  check('바다 탐색하기: leaves with the zoom, lands on 탐색 지도 with focus in search, remembered for this tab',mid&&!g.on&&g.hidden&&g.view==='explore'&&g.focus==='search'&&g.stored==='1',JSON.stringify({mid,...g}));
  check('After leaving: the entry screen requests no more frames and gives back its canvas',after1===after0&&await evaluate("document.querySelector('.gate-sea').width===0"),`${after0} → ${after1}`);
  await shot('arrive-explore');
  // 2026-10-18 (verification/2026-10-18-reload-shows-intro): a reload shows the entry screen again, from the loader
  await send('Page.reload',{});await sleep(400);await waitLoaded();g=await gate();
  check('Same tab, reload: the entry screen again (2026-10-18 rule)',g.on&&!g.hidden,JSON.stringify(g));
  await onNewDocument();

  // ---------- every way in ----------
  for(const [label,sel,view,focus] of [['헤더 탐색 지도','.gate-nav [data-go="explore"]','explore','search'],['헤더 비교와 지표','.gate-nav [data-go="compare"]','compare','cmp-search'],
    ['지표 살펴보기','.gate-more','compare','cmp-search'],['카드 지도에서 살펴보기','.gate-card [data-go="explore"]','explore','search'],['전체 출처·방법 보기','.gate-method','method','all-sources']]){
    await open();await waitReady();await sleep(300);await click(sel);await waitLeft();if(view==='method')await waitScrolled();await sleep(150);g=await gate();
    const extra=view==='method'?await evaluate("(()=>{const t=document.querySelector('.source-section').getBoundingClientRect().top;return {top:Math.round(t),near:t>-5&&t<innerHeight*.5}})()"):{near:true};
    check(`${label} → ${view}, focus #${focus}`,!g.on&&g.view===view&&g.focus===focus&&extra.near,JSON.stringify({...g,extra}));
    if(view==='compare'&&sel==='.gate-more')await shot('arrive-compare');
    if(view==='method')await shot('arrive-method');
  }
  // the app keeps its own state: species and map view come from the app, and the link it writes still works
  await open();await waitReady();await click('.gate-more');await waitLeft();await sleep(150);
  const state=await evaluate("({hash:location.hash,selected:selected?.aphiaID??null})");
  check('Entering 비교와 지표 keeps the app state: hash written by the app (s, v=compare), species selected by the app',/[#&]s=\d+/.test(state.hash)&&/v=compare/.test(state.hash)&&state.selected!==null,JSON.stringify(state));

  // ---------- a shared link opens the app directly and never fetches the globe ----------
  await open({hash:'#s=274849&v=compare&b=satellite&t=occurrence&m=6%2F35.21%2F127.63'});await waitLoaded();await sleep(800);g=await gate();
  const linked=await evaluate("({sel:selected?.aphiaID,view:currentView,zoom:map.getZoom(),c:map.getCenter()})");
  check('Shared link: no entry screen, opens 비교와 지표 with the linked species and map position',!g.on&&g.hidden&&linked.sel===274849&&linked.view==='compare'&&linked.zoom===6&&Math.abs(linked.c.lat-35.21)<.02&&Math.abs(linked.c.lng-127.63)<.02,JSON.stringify({g,linked}));
  check('Shared link: the globe files are never requested',!requests.some(u=>u.includes('globe-v1')),requests.filter(u=>u.includes('vendor')).join(' '));
  check('Shared link: the baked picture (globe-v2) is never requested',!requests.some(u=>u.includes('globe-v2')),requests.filter(u=>u.includes('vendor')).join(' '));

  // ---------- keyboard: order, focus ring, Enter on another control ----------
  await open();await waitReady();await sleep(300);
  const ringOf="(()=>{const a=document.activeElement,s=getComputedStyle(a);return {id:a.id||a.className,fv:a.matches(':focus-visible'),style:s.outlineStyle,kb:document.documentElement.classList.contains('kb')}})()";
  const ring0=await evaluate(ringOf);await key('Tab');const ring1=await evaluate(ringOf);
  check('Focus ring: the button has focus on arrival but no ring (mouse visitor); the first Tab turns the ring on',
    ring0.id==='gate-enter'&&ring0.style==='none'&&!ring0.kb&&ring1.kb&&ring1.style==='solid',JSON.stringify({ring0,ring1}));
  await shot('gate-after-tab',{x:0,y:520,width:700,height:200});
  await evaluate("document.querySelector('.gate-nav button').focus();1");
  const order=[await evaluate("document.activeElement.textContent.trim()")];
  for(let i=0;i<16;i++){await key('Tab');order.push(await evaluate("(a=>a.closest('#site-gate')?(a.textContent.trim()||a.getAttribute('aria-label')):'(outside)')(document.activeElement)"));}
  const expected=['탐색 지도','비교와 지표','움직임 줄이기','바다 탐색하기','지표 살펴보기→','지도에서 살펴보기↗','WoRMS','IUCN 적색목록','ChEMBL','국가표준식품성분 DB','전체 출처·방법 보기→','바다 탐험으로 시작→','링크 공유'];
  check('Tab order follows the screen: menus → switch → buttons → card → sources → footer',JSON.stringify(order.slice(0,expected.length))===JSON.stringify(expected),JSON.stringify(order));
  const ring=await evaluate("(()=>{document.querySelector('.gate-more').focus();const a=document.activeElement,s=getComputedStyle(a);return {fv:a.matches(':focus-visible'),style:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor}})()");
  check('Keyboard focus is visible (2px teal outline)',ring.style==='solid'&&ring.width==='2px'&&/140, 215, 208/.test(ring.color),JSON.stringify(ring));
  await evaluate("document.querySelector('.gate-motion').focus();1");await key('Enter');await sleep(200);g=await gate();
  check('Enter on the motion switch flips it and does not enter',g.on&&g.switchOn==='true'&&g.motionKept==='1',JSON.stringify(g));
  await evaluate("document.activeElement.blur();1");await key('Enter');await sleep(250);g=await gate();
  check('Enter elsewhere enters at once when still (no leave animation)',!g.on&&g.view==='explore',JSON.stringify(g));

  // ---------- the motion switch and the system setting ----------
  await open({keep:false,motion:'1'});g=await waitReady();
  const still=await evaluate("getComputedStyle(document.querySelector('.gate-sea')).transitionDuration");
  check('A remembered "still" survives a new visit: switch on, globe fade/zoom off',g.switchOn==='true'&&g.still&&/^0s(, 0s)*$/.test(still),JSON.stringify({g,still}));
  await click('.gate-motion');await sleep(100);g=await gate();
  check('Flipping it back is remembered too',g.switchOn==='false'&&!g.still&&g.motionKept==='0',JSON.stringify(g));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await open();g=await waitReady();
  check('System "reduce motion" and nothing remembered: the switch starts on',g.switchOn==='true'&&g.still,JSON.stringify(g));
  await shot('gate-reduced-motion');
  await click('#gate-enter');await sleep(120);g=await gate();
  check('System "reduce motion": entering is instant',!g.on&&g.view==='explore',JSON.stringify(g));
  await open({motion:'0'});g=await waitReady();
  check('System "reduce motion" but motion chosen here: the choice wins',g.switchOn==='false'&&!g.still,JSON.stringify(g));
  await send('Emulation.setEmulatedMedia',{features:[]});

  // ---------- a failed globe file: the plain sphere stays, everything else works ----------
  await send('Network.setBlockedURLs',{urls:['*land-50m.json*']});
  await open();g=await waitReady();await sleep(2000);await shot('gate-globe-failed');
  check('Globe file blocked: entry screen, card and counts still there',g.on&&g.ready&&g.card&&g.counts.length>0&&g.focus==='gate-enter',JSON.stringify(g));
  await click('#gate-enter');g=await waitLeft();
  check('Globe file blocked: entering still works',!g.on&&g.view==='explore',JSON.stringify(g));
  await send('Network.setBlockedURLs',{urls:[]});

  // ---------- the baked picture (vendor/globe-v2): one file per visit, sized for the globe and the pixel ratio ----------
  const perf=[];
  for(const [w,h,dpr,mobile,want] of [[1672,941,1,false,1600],[1672,941,2,false,2400],[1920,1080,1,false,1600],[1440,900,2,false,2400],[390,844,2,true,900],[390,844,1,true,900],[360,640,3,true,900]]){
    await open({w,h,dpr,mobile});await waitReady();await sleep(1500);
    const got=requests.filter(u=>u.includes('/vendor/globe-v2/'));
    const p=await evaluate(`(()=>{const r=performance.getEntriesByType('resource').find(e=>e.name.includes('globe-v2')),m=n=>performance.getEntriesByName(n)[0]?.startTime;
      return {file:r&&r.name.split('/').pop(),bytes:r?.encodedBodySize,ms:r&&Math.round(r.responseEnd-r.startTime),decoded:Math.round(m('bbvm-globe-decoded')),drawn:Math.round(m('bbvm-globe-drawn')),R:Math.round(globeFrame(innerWidth,innerHeight,null).R)}})()`);
    perf.push({size:`${w}x${h}@${dpr}`,...p});
    check(`${w}×${h} @${dpr}x: one picture asked for, globe-${want}.webp, decoded and drawn`,got.length===1&&got[0].endsWith(`globe-${want}.webp`)&&p.drawn>0,JSON.stringify({got,p}));
    if(w===1672&&dpr===2){
      await shot('gate-1672x941@2x');
      // the overlay and the picture share one projection and placement: the canvas over northern Japan (no cells, no
      // coast line, no card there) is the picture drawn where intro.js puts it, at no other offset within ±4 device px
      const al=await evaluate(`(async()=>{const c=document.querySelector('.gate-sea'),x=c.getContext('2d'),k=c.width/innerWidth,f=globeFrame(innerWidth,innerHeight,null);
        const file=globeFile(f.R,devicePixelRatio,navigator.connection),pad=GLOBE_PAD[file]/file,im=new Image();im.src='vendor/globe-v2/globe-'+file+'.webp';await im.decode();
        const a=project(137,44),b=project(145,35),X=q=>Math.round((f.cx+q.x*f.R)*k),Y=q=>Math.round((f.cy-q.y*f.R)*k);
        const x0=X(a),y0=Y(a),w=X(b)-x0,h=Y(b)-y0,lum=d=>{const o=new Float32Array(d.length/4);for(let i=0;i<o.length;i++)o[i]=d[4*i]*.3+d[4*i+1]*.59+d[4*i+2]*.11;return o;};
        const ref=lum(x.getImageData(x0,y0,w,h).data);let best=null;
        for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const o=new OffscreenCanvas(c.width,c.height),ox=o.getContext('2d'),s=f.R*(1+2*pad);
          ox.drawImage(im,(f.cx-s)*k+dx,(f.cy-s)*k+dy,2*s*k,2*s*k);const t=lum(ox.getImageData(x0,y0,w,h).data);let e=0;for(let i=0;i<t.length;i++)e+=(t[i]-ref[i])**2;e/=t.length;
          if(!best||e<best.e)best={dx,dy,e:Math.round(e*100)/100};}
        return {box:[x0,y0,w,h],...best};})()`);
      check('The picture and the drawn data line up: the best match of the picture is at its own place (within 2 device px)',Math.abs(al.dx)<=2&&Math.abs(al.dy)<=2&&al.e<4,JSON.stringify(al));
      // no warm bright points over the sea (the fishing fleets of the East and Yellow Seas are not on the picture); faint
      // lights on land. Sea = inside the disc, off the Natural Earth land grown 2 px, away from the card's orange point.
      const lit=await evaluate(`(async()=>{const c=document.querySelector('.gate-sea'),x=c.getContext('2d'),k=c.width/innerWidth,f=globeFrame(innerWidth,innerHeight,null);
        const L=await (await fetch('vendor/globe-v1/land-50m.json')).json(),m=new OffscreenCanvas(c.width,c.height),mx=m.getContext('2d');mx.setTransform(k,0,0,k,0,0);
        mx.beginPath();for(const r of decodeRings(L.land,L.scale)){r.forEach((p,i)=>{const q=project(p[0],p[1],true),X=f.cx+q.x*f.R,Y=f.cy-q.y*f.R;i?mx.lineTo(X,Y):mx.moveTo(X,Y);});mx.closePath();}
        mx.fillStyle='#fff';mx.fill('evenodd');mx.lineWidth=4;mx.strokeStyle='#fff';mx.stroke();
        const md=mx.getImageData(0,0,m.width,m.height).data,d=x.getImageData(0,0,c.width,c.height).data,an=project(...ANCHOR),ax=(f.cx+an.x*f.R)*k,ay=(f.cy-an.y*f.R)*k;
        let sea=0,warmSea=0,land=0,warmLand=0;const warm=i=>d[i]>=90&&d[i]-d[i+2]>=30&&d[i]>=d[i+1];
        for(let y=0;y<c.height;y++)for(let x_=0;x_<c.width;x_++){const r=Math.hypot(x_/k-f.cx,y/k-f.cy)/f.R;if(r>.97)continue;const i=4*(y*c.width+x_);
          if(md[i+3]>0){land++;if(d[i]>=70&&d[i]>=d[i+2])warmLand++;continue;}
          if(Math.hypot(x_-ax,y-ay)<16*k)continue;sea++;if(warm(i))warmSea++;}
        return {sea,warmSea,land,warmLand};})()`);
      check('No warm bright points over the sea; faint lights on land',lit.sea>1e5&&lit.warmSea===0&&lit.warmLand>200,JSON.stringify(lit));
      await shot('zoom-korea@2x',{x:980,y:300,width:300,height:220});await shot('zoom-east-yellow-sea@2x',{x:1000,y:280,width:280,height:200});
      await shot('zoom-rim@2x',{x:560,y:120,width:320,height:260});
    }
  }
  fs.writeFileSync(path.join(OUT,'perf.json'),JSON.stringify(perf,null,1));
  // blocked picture: the vector globe, and everything still works
  await send('Network.setBlockedURLs',{urls:['*globe-v2*']});
  await open({w:1672,h:941});g=await waitReady();await sleep(1500);await shot('gate-picture-blocked');
  const vec=await evaluate(`(()=>{const c=document.querySelector('.gate-sea'),x=c.getContext('2d'),f=globeFrame(innerWidth,innerHeight,null),q=project(150,25),d=x.getImageData(Math.round(f.cx+q.x*f.R),Math.round(f.cy-q.y*f.R),1,1).data;
    return {drawn:performance.getEntriesByName('bbvm-globe-drawn').length,px:[...d]}})()`);
  check('Picture blocked: the vector globe instead (deep-sea blue, opaque), the screen works',g.on&&g.ready&&vec.drawn===0&&vec.px[3]===255&&vec.px[2]>vec.px[0]+20,JSON.stringify({vec,g}));
  await click('#gate-enter');g=await waitLeft();
  check('Picture blocked: entering still works',!g.on&&g.view==='explore',JSON.stringify(g));
  await send('Network.setBlockedURLs',{urls:[]});
  // a slow phone (CPU 4x slower): the loader still ends after its minimum and the button answers at once
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  const t0=Date.now();await open({w:390,h:844,dpr:2,mobile:true});g=await waitReady();const tReady=Date.now()-t0;
  const t1=Date.now();await click('#gate-enter');g=await waitLeft();const tLeave=Date.now()-t1;
  await send('Emulation.setCPUThrottlingRate',{rate:1});
  perf.push({slowPhone:{readyMs:tReady,enterToGoneMs:tLeave}});fs.writeFileSync(path.join(OUT,'perf.json'),JSON.stringify(perf,null,1));
  // (ready itself waits for the app's data up to GATE_MAX_MS from intro.js start; at 4x it lands near that on main too)
  check(`Phone at CPU 4x: ready after ${tReady} ms, then the button answers at once (gone ${tLeave} ms later, the 0.82 s leave included)`,g.view==='explore'&&!g.on&&tLeave<2500,JSON.stringify({tReady,tLeave}));
  // after leaving: no frames, no picture kept
  check('After leaving: the picture is let go (canvas emptied)',await evaluate("document.querySelector('.gate-sea').width===0"));

  // ---------- data states: the note says what happened, numbers only when the app has them ----------
  const mocks={
    error:"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('x',{status:500})):String(u).includes('live-snapshot.json')?Promise.resolve(new Response('',{status:404})):o(u,...a))(window.fetch);",
    snapshot:"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.reject(new TypeError('Failed to fetch')):o(u,...a))(window.fetch);",
    empty:"window.fetch=(o=>(u,...a)=>String(u).includes('/rest/v1/')?Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}})):o(u,...a))(window.fetch);"};
  for(const [name,source] of Object.entries(mocks)){
    await onNewDocument(source);await open();g=await waitReady();await sleep(1500);await shot(`gate-data-${name}`);
    const app=await evaluate("({pub:data?.publishedCount??null,cand:data?.candidateCount??null})");
    const want=name==='error'?g.counts===''&&g.note.startsWith('자료를 불러오지 못했습니다'):name==='snapshot'?g.note.startsWith('운영 DB에 연결하지 못해')&&g.counts===`${app.pub+app.cand}종의 해양생물(운영 발행 ${app.pub} · 조사 후보 ${app.cand}) · 공개 데이터 기반`
      :g.note.startsWith('운영 발행 자료가 0종')&&g.counts===`${app.cand}종의 해양생물(운영 발행 0 · 조사 후보 ${app.cand}) · 공개 데이터 기반`;
    check(`Data ${name}: honest note, counts only from the app`,g.ready&&want,JSON.stringify({g,app}));
  }
  await onNewDocument();
  check('No uncaught page errors or console.error',errors.length===0,errors.join(' | '));
}catch(e){if(e!=='done')check('Harness',false,e.stack||e);}
finally{
  fs.writeFileSync(path.join(OUT,'landing-check.json'),JSON.stringify(results,null,2));
  try{ws?.close();}catch{}chrome.kill();
  console.log(`${results.filter(r=>r.status==='PASS').length} PASS / ${results.filter(r=>r.status!=='PASS').length} FAIL`);
  process.exitCode=results.some(r=>r.status!=='PASS')?1:0;
}
