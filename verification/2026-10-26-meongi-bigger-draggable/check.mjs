// 2026-10-26 멍이 키우기·끌어서 옮기기·스크롤 중 흐려지기 화면 점검 (Playwright, 휴대폰은 Chromium 휴대폰 흉내).
// dist/를 127.0.0.1:8765(이 브랜치)로, 고치기 전 main을 8766으로 띄운 상태에서:
//   SUPA=fixture TILES=off node verification/2026-10-26-meongi-bigger-draggable/check.mjs [out] [base] [mainBase]
// ENGINE=webkit이면 WebKit(Safari 엔진)으로 휴대폰 부분만 다시 본다(실제 iPhone은 아님). 2026-10-26 클라우드에서는 WebKit을 내려받지 못해(다운로드 막힘) 돌리지 못했다.
import fs from 'node:fs';import path from 'node:path';
import {launch,open,sleep,shot,chromium} from './common.mjs';
import {enter} from '../2026-10-25-mascot-mobile-overlap/common.mjs';
const OUT=process.argv[2]||'verification/2026-10-26-meongi-bigger-draggable/after',BASE=process.argv[3]||'http://127.0.0.1:8765/',MAIN=process.argv[4]||'';
const WEBKIT=process.env.ENGINE==='webkit';
fs.mkdirSync(OUT,{recursive:true});
const results=[];
const check=(name,ok,info)=>{results.push({name,ok:!!ok,info});console.log((ok?'PASS':'FAIL')+' '+name+(ok?'':' :: '+JSON.stringify(info)));};
const noise=e=>!/Failed to load resource|ERR_FAILED|ERR_BLOCKED|net::/.test(e);
let browser;
if(WEBKIT){const {webkit}=await import('playwright');browser=await webkit.launch();}else browser=await launch();

// 멍이 상태: 그려진 상자(흐려짐 포함), 레이아웃 자리(left/top, transform 제외), 저장값, 대화창
const STATE=`(()=>{const f=document.querySelector('.bbc-fab'),r=f.getBoundingClientRect(),cs=getComputedStyle(f),d=document.documentElement,tabs=document.querySelector('.tabs'),
  head=document.querySelector('.header'),t=tabs&&getComputedStyle(tabs).position==='fixed'?tabs.getBoundingClientRect():null,c=typeof map!=='undefined'&&map?.getCenter?map.getCenter():null;
  let stored=null;try{stored=localStorage.getItem('bbMeongiPos');}catch{}
  return {x:f.offsetParent===null?Math.round(r.left):0,l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),ow:f.offsetWidth,oh:f.offsetHeight,
    svg:Math.round(f.querySelector('svg')?.getBoundingClientRect().width||0),left:cs.left,top:cs.top,opacity:+cs.opacity,transform:cs.transform,origin:cs.transformOrigin,cursor:cs.cursor,
    scrolling:f.classList.contains('is-scrolling'),moved:document.querySelector('.bbc').classList.contains('bbc-moved'),snap:document.querySelector('.bbc').classList.contains('bbc-snap'),
    open:!document.querySelector('.bbc-panel').hidden,stored,label:f.getAttribute('aria-label'),vw:d.clientWidth,vh:d.clientHeight,doc:d.scrollWidth,scrollY:Math.round(scrollY),
    tabsTop:t?Math.round(t.top):null,headH:head?head.offsetHeight:0,center:c?c.lat.toFixed(6)+','+c.lng.toFixed(6)+','+map.getZoom():'',focusVisible:f.matches(':focus-visible')};})()`;
const st=page=>page.evaluate(STATE);
const mid=s=>({x:s.l+s.w/2,y:s.t+s.h/2});
async function touchDrag(page,cdp,from,to,steps=10,holdEnd=false){
  if(!cdp){ // WebKit: Playwright는 터치 끌기를 직접 보내지 못해 PointerEvent(pointerType touch)를 버튼에 보낸다
    await page.evaluate(([from,to,steps])=>{const f=document.querySelector('.bbc-fab'),o={pointerId:7,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,button:0,buttons:1};
      f.dispatchEvent(new PointerEvent('pointerdown',{...o,clientX:from.x,clientY:from.y}));
      for(let i=1;i<=steps;i++)f.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:from.x+(to.x-from.x)*i/steps,clientY:from.y+(to.y-from.y)*i/steps}));
      f.dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0,clientX:to.x,clientY:to.y}));},[from,to,steps]);
    await sleep(500);return;}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}]});await sleep(16);}
  if(holdEnd)return;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(500);
}
async function tap(page,cdp,p){
  if(!cdp){await page.touchscreen.tap(p.x,p.y);return;}
  await sleep(1500);  // Chrome은 앞 터치 1초 안에 시작한 터치로는 탭(click)을 만들지 않는다(사람처럼 기다림)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+3,y:p.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const waitOpen=async page=>{let s;for(let i=0;i<20;i++){s=await st(page);if(s.open)break;await sleep(100);}return s;};
const closeChat=page=>page.evaluate(()=>{const c=document.querySelector('.bbc-close');if(!document.querySelector('.bbc-panel').hidden)c.click();document.activeElement?.blur();});
// 처음 자리로: 대화창의 '멍이 원래 자리로'와 같은 일(저장값 지움)
const clearPos=page=>page.evaluate(()=>{document.querySelector('.bbc-reset').click();document.activeElement?.blur();});
const tabText=page=>page.evaluate(()=>Object.fromEntries(['explore','compare','method'].map(id=>[id,document.getElementById(id)?.textContent.replace(/\s+/g,' ').trim()||''])));

// ---------- 390 휴대폰 ----------
{
  const {page,errors}=await open(browser,{w:390,h:844,supa:'fixture',...(WEBKIT?{}:{})}).catch(async e=>{if(!WEBKIT)throw e;const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});return {page:await ctx.newPage(),errors:[]};});
  if(WEBKIT){await page.context().route(/supabase\.co/,r=>{const FX=JSON.parse(fs.readFileSync('dist/live-snapshot.json','utf8'));const u=r.request().url();
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(u.includes('species_profiles')?FX.profiles:u.includes('species_map_cells')?FX.cells:[])});});
    await page.context().route(/gibs\.earthdata|gebco\.net|cloudflareinsights/,r=>r.abort());}
  const cdp=WEBKIT?null:await page.context().newCDPSession(page);
  await enter(page,BASE);await sleep(400);
  const tag=WEBKIT?'webkit-':'';
  let s=await st(page);
  check(`${tag}390 기본: 누르는 영역 56×56 이상, 그림 52px, 오른쪽 16px, 아래 탭 줄 위 12px(겹치지 않음)`,s.w>=56&&s.h>=56&&s.svg===52&&s.vw-(s.l+s.w)===16&&s.tabsTop-(s.t+s.h)===12,s);
  await shot(page,OUT,`${tag}390-explore-default`);
  if(!WEBKIT){await page.evaluate(()=>document.querySelector('.tabs button[data-view="compare"]').click());await sleep(700);await shot(page,OUT,'390-compare-default');
    await page.evaluate(()=>{document.querySelector('.tabs button[data-view="explore"]').click();scrollTo(0,0);});await sleep(700);}
  check(`${tag}390 aria-label: 원래 이름 뒤에 옮기는 방법을 덧붙임`,s.label==='사용법 안내 열기. 끌거나 Shift와 방향키로 옮길 수 있습니다',s.label);

  // 3px 움직였다 떼기 = 누르기(대화창 열림), 자리 그대로
  const before=s;
  if(cdp)await tap(page,cdp,mid(s));else await page.evaluate(p=>{const f=document.querySelector('.bbc-fab'),o={pointerId:3,pointerType:'touch',isPrimary:true,bubbles:true,button:0,buttons:1};
    f.dispatchEvent(new PointerEvent('pointerdown',{...o,clientX:p.x,clientY:p.y}));f.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:p.x+3,clientY:p.y}));
    f.dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0,clientX:p.x+3,clientY:p.y}));f.click();},mid(s));
  s=await waitOpen(page);
  check(`${tag}390 3px 움직이고 떼면 누르기: 대화창이 열리고 저장값 없음`,s.open&&s.stored===null,s);
  await closeChat(page);await sleep(400);s=await st(page);
  check(`${tag}390 누르기 뒤 자리 그대로`,s.l===before.l&&s.t===before.t,{before,s});

  // 40px 끌기 → 열리지 않음, 가까운 가장자리(오른쪽), 세로는 놓은 자리
  await sleep(1500);
  const from=mid(s),to={x:from.x-40,y:from.y-40};
  await touchDrag(page,cdp,from,to,8);await sleep(400);
  s=await st(page);
  const wantTop=Math.round(before.t-40);
  check(`${tag}390 40px 끌기: 대화창 안 열림, 오른쪽 가장자리에 붙음(16px), 세로는 놓은 자리`,!s.open&&s.moved&&s.vw-(s.l+s.w)===16&&Math.abs(s.t-wantTop)<=1&&JSON.parse(s.stored||'{}').side==='right',{s,wantTop});
  // 왼쪽 절반으로 끌면 왼쪽 가장자리
  await sleep(1500);
  await touchDrag(page,cdp,mid(s),{x:120,y:420},10);await sleep(400);
  s=await st(page);
  check(`${tag}390 왼쪽 절반에 놓으면 왼쪽 가장자리(16px)에 붙음, 세로 420 둘레`,!s.open&&s.l===16&&Math.abs(s.t+s.h/2-420)<=1&&JSON.parse(s.stored).side==='left',s);
  if(!WEBKIT)await shot(page,OUT,'390-explore-left');
  // 범위 밖으로 끌기
  const bounds=[];
  for(const p of [{x:200,y:-30},{x:200,y:900},{x:-40,y:400},{x:450,y:400}]){
    await sleep(cdp?1500:0);const cur=await st(page);await touchDrag(page,cdp,mid(cur),p,10);await sleep(350);const z=await st(page);
    bounds.push({to:p,l:z.l,t:z.t,b:z.t+z.h,r:z.l+z.w,ok:z.t>=z.headH+8&&z.t+z.h<=z.tabsTop-8&&z.l>=8&&z.l+z.w<=z.vw-8&&!z.open&&z.doc<=z.vw});
  }
  check(`${tag}390 헤더 위·탭 줄 아래·화면 밖으로 끌어도 범위 안(헤더 아래 8px, 탭 줄 위 8px, 좌우 8px 안)에 멈춤`,bounds.every(b=>b.ok),bounds);

  if(!WEBKIT){
    // 지도 위에서 끌기: 지도 중심 그대로. 먼저 멍이를 지도 칸(위쪽 55%)으로 옮긴다.
    await sleep(1500);let c=await st(page);await touchDrag(page,cdp,mid(c),{x:300,y:220},10);await sleep(500);
    c=await st(page);const center0=c.center;
    await sleep(1500);await touchDrag(page,cdp,mid(c),{x:120,y:300},12,true);await sleep(300);
    const during=await st(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(600);
    const after=await st(page);
    check('390 지도 위에서 멍이를 끄는 동안·뒤 지도 중심·확대 그대로, 페이지 스크롤 없음',!!center0&&during.center===center0&&after.center===center0&&during.scrollY===c.scrollY&&after.scrollY===c.scrollY,{center0,during:during.center,after:after.center});
    // 시트 위에서 끌기: 시트(페이지 스크롤)·시트 높이 그대로
    const sheet0=await page.evaluate(()=>{const h=document.getElementById('sheet-head').getBoundingClientRect(),m=document.querySelector('.map-stage').getBoundingClientRect();return {head:Math.round(h.top),map:Math.round(m.height),y:Math.round(scrollY)};});
    await sleep(1500);c=await st(page);await touchDrag(page,cdp,mid(c),{x:300,y:700},12,true);await sleep(300);
    const sheet1=await page.evaluate(()=>{const h=document.getElementById('sheet-head').getBoundingClientRect(),m=document.querySelector('.map-stage').getBoundingClientRect();return {head:Math.round(h.top),map:Math.round(m.height),y:Math.round(scrollY)};});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(600);
    const sheet2=await page.evaluate(()=>{const h=document.getElementById('sheet-head').getBoundingClientRect(),m=document.querySelector('.map-stage').getBoundingClientRect();return {head:Math.round(h.top),map:Math.round(m.height),y:Math.round(scrollY)};});
    check('390 시트 위로 끄는 동안·뒤 시트 높이(손잡이 자리)·지도 높이·페이지 스크롤 그대로',JSON.stringify(sheet0)===JSON.stringify(sheet1)&&JSON.stringify(sheet0)===JSON.stringify(sheet2),{sheet0,sheet1,sheet2});
  }

  // 다시 불러와도 놓은 자리
  s=await st(page);const kept=s;
  await page.reload();await sleep(1200);
  await page.evaluate(()=>document.getElementById('gate-enter')?.click());await sleep(1500);
  s=await st(page);
  check(`${tag}390 다시 불러와도 놓은 자리(같은 저장값·같은 좌표)`,s.stored===kept.stored&&s.l===kept.l&&Math.abs(s.t-kept.t)<=1,{kept:[kept.l,kept.t,kept.stored],s:[s.l,s.t,s.stored]});

  // 390 → 768 → 390
  const sizes=[];
  for(const [w,h] of [[768,1024],[390,844]]){await page.setViewportSize({width:w,height:h});await sleep(500);const z=await st(page);sizes.push({w,l:z.l,t:z.t,r:z.l+z.w,b:z.t+z.h,vw:z.vw,vh:z.vh,stored:z.stored});}
  check(`${tag}390 → 768 → 390: 멍이가 화면 안, 저장값 그대로, 돌아오면 같은 자리`,sizes.every(z=>z.l>=8&&z.t>=0&&z.r<=z.vw-8&&z.b<=z.vh-8&&z.stored===kept.stored)&&sizes[1].l===kept.l&&Math.abs(sizes[1].t-kept.t)<=1,sizes);

  const errs0=errors.filter(noise);check(`${tag}390 콘솔 오류 없음(끌기)`,errs0.length===0,errs0);
  await clearPos(page);
  await page.context().close();
}
// ---------- 390 스크롤하는 동안 흐려짐(새 창: 앞의 다시 불러오기·창 크기 바꾸기와 섞이지 않게) ----------
{
  const {page,errors}=await open(browser,{w:390,h:844,supa:'fixture'}).catch(async e=>{if(!WEBKIT)throw e;const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});return {page:await ctx.newPage(),errors:[]};});
  if(WEBKIT){await page.context().route(/supabase\.co/,r=>{const FX=JSON.parse(fs.readFileSync('dist/live-snapshot.json','utf8'));const u=r.request().url();
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(u.includes('species_profiles')?FX.profiles:u.includes('species_map_cells')?FX.cells:[])});});
    await page.context().route(/gibs\.earthdata|gebco\.net|cloudflareinsights/,r=>r.abort());}
  const cdp=WEBKIT?null:await page.context().newCDPSession(page);
  const tag=WEBKIT?'webkit-':'';
  await enter(page,BASE);await sleep(600);
  const s0=await st(page);
  await page.evaluate(()=>scrollBy(0,250));await sleep(250);
  const s1=await st(page);
  await sleep(500);const s2=await st(page);
  // 연달아 스크롤하는 동안은 계속 붙어 있다(마지막 스크롤 400ms 뒤 뗌)
  const keep=[];for(let i=0;i<6;i++){await page.evaluate(()=>scrollBy(0,30));await sleep(200);keep.push((await st(page)).scrolling);}
  const s1b=await st(page);await sleep(400);const s2b=await st(page);  // 마지막 스크롤 약 0.2초 뒤·0.6초 뒤
  check(`${tag}390 페이지 스크롤: is-scrolling(불투명도 .35, 0.85배), 계속 스크롤하면 유지, 멈추고 약 400ms 뒤 떨어짐, 레이아웃 자리(left/top) 그대로`,
    s1.scrolling&&Math.abs(s1.opacity-.35)<.02&&/matrix\(0\.85/.test(s1.transform)&&keep.every(Boolean)&&s1b.scrolling&&!s2b.scrolling&&!s2.scrolling&&s2.opacity===1&&s0.left===s1.left&&s0.top===s1.top&&s2.left===s0.left&&s2.top===s0.top,{s0,s1,s1b,s2});
  check(`${tag}390 흐려질 때 기준점이 붙은 가장자리(오른쪽): 오른쪽 끝 자리 그대로`,s1.l+s1.w===s0.l+s0.w&&/^56px/.test(s1.origin),{s0:[s0.l,s0.w],s1:[s1.l,s1.w,s1.origin]});
  // 시트 안 가로 스크롤(종 카드 줄)
  await page.evaluate(()=>{const l=document.getElementById('species-list');if(l)l.scrollLeft+=160;});await sleep(150);const s3=await st(page);await sleep(600);const s4=await st(page);
  check(`${tag}390 시트 안 종 카드 줄 스크롤에도 흐려지고 돌아옴`,s3.scrolling&&!s4.scrolling,{s3:s3.scrolling,s4:s4.scrolling});
  // 흐려진 동안 누르기 → 바로 원래대로, 대화창 열림
  await page.evaluate(()=>scrollBy(0,-100));await sleep(60);const s5=await st(page);
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[mid(s5)]});await sleep(30);const s5b=await st(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const s6=await waitOpen(page);
    check('390 흐려진 동안 누르기: 누르는 순간 원래대로, 대화창 열림',s5.scrolling&&!s5b.scrolling&&s5b.opacity===1&&s6.open,{s5:s5.scrolling,s5b:[s5b.scrolling,s5b.opacity],open:s6.open});
    await closeChat(page);await sleep(500);
  }
  // 지도 끌기는 스크롤이 아님
  if(!WEBKIT){
    await page.evaluate(()=>scrollTo(0,0));await sleep(800);
    const mb=await page.evaluate(()=>{const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    await sleep(1200);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[mb]});
    let any=false;for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mb.x-8*i,y:mb.y+3*i}]});await sleep(30);any=any||(await st(page)).scrolling;}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(200);
    await page.evaluate(()=>map.setZoom(map.getZoom()+1));await sleep(500);const z=await st(page);
    check('390 지도를 손가락으로 끌거나 확대해도 is-scrolling 안 붙음',!any&&!z.scrolling,{any,z:z.scrolling});
    // 키보드 포커스가 있으면 흐려지지 않음
    await page.evaluate(()=>document.querySelector('.bbc-fab').focus());await page.keyboard.press('Shift');
    await page.evaluate(()=>scrollBy(0,200));await sleep(150);const k=await st(page);
    check('390 멍이에 키보드 포커스(:focus-visible)가 있으면 스크롤해도 흐려지지 않음',k.focusVisible&&!k.scrolling,k);
    await page.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await sleep(500);
  }
  check(`${tag}390 가로 넘침 없음`,(await st(page)).doc<=390,'');
  const errs=errors.filter(noise);check(`${tag}390 콘솔 오류 없음`,errs.length===0,errs);
  await clearPos(page);
  await page.context().close();
}

if(!WEBKIT){
  // ---------- localStorage를 막은 휴대폰 ----------
  {
    const {page,errors}=await open(browser,{w:390,h:844,supa:'fixture'});
    await page.addInitScript(()=>{const deny=()=>{throw new DOMException('denied','SecurityError');};
      Object.defineProperty(window,'localStorage',{configurable:true,get:deny});});
    await page.goto(BASE);
    await page.waitForFunction(()=>document.getElementById('site-gate')?.classList.contains('is-ready'),null,{timeout:40000});await sleep(600);
    await page.evaluate(()=>document.getElementById('gate-enter')?.click());
    await page.waitForFunction(()=>!document.documentElement.classList.contains('gate-on'),null,{timeout:20000});await sleep(1500);
    const s=await st(page);
    const cdp=await page.context().newCDPSession(page);
    await touchDrag(page,cdp,mid(s),{x:100,y:400},10);await sleep(400);const d=await st(page);
    const errs=errors.filter(noise);
    check('localStorage를 막아도 오류 없이 기본 자리로 뜨고, 끌기는 이 탭에서 됨',s.vw-(s.l+s.w)===16&&s.tabsTop-(s.t+s.h)===12&&d.l===16&&errs.length===0,{s:[s.l,s.t],d:[d.l,d.t],errs});
    await page.context().close();
  }
  // ---------- 움직임 줄이기 ----------
  {
    const {page}=await open(browser,{w:390,h:844,supa:'fixture',reducedMotion:'reduce'});
    await enter(page,BASE);await sleep(300);
    const cdp=await page.context().newCDPSession(page);
    let s=await st(page);
    await touchDrag(page,cdp,mid(s),{x:120,y:400},10);
    s=await st(page);
    await page.evaluate(()=>scrollBy(0,200));await sleep(120);const f=await st(page);
    check('움직임 줄이기: 놓으면 바로 붙음(.bbc-snap 없음), 스크롤 때 크기 그대로·불투명도만 .35',!s.snap&&s.l===16&&f.scrolling&&f.transform==='none'&&Math.abs(f.opacity-.35)<.01,{s:[s.snap,s.l],f:[f.scrolling,f.transform,f.opacity]});
    await clearPos(page);await page.context().close();
  }
  // ---------- 1440 PC 마우스·키보드 ----------
  {
    const {page,errors}=await open(browser,{w:1440,h:900,phone:false,supa:'fixture'});
    await enter(page,BASE);await sleep(500);
    let s=await st(page);
    check('1440 기본: 56×56, 그림 52px, 아래 16px, 커서 grab',s.w===56&&s.h===56&&s.svg===52&&s.vh-(s.t+s.h)===16&&s.cursor==='grab',s);
    await shot(page,OUT,'1440-explore-default');
    const c0=s.center;
    // 마우스로 끌기(왼쪽 아래로)
    const m=mid(s);
    await page.mouse.move(m.x,m.y);await page.mouse.down();
    for(let i=1;i<=10;i++)await page.mouse.move(m.x+(400-m.x)*i/10,m.y+(500-m.y)*i/10);
    const during=await page.evaluate(()=>({cur:getComputedStyle(document.querySelector('.bbc-fab')).cursor,drag:document.querySelector('.bbc').classList.contains('bbc-dragging'),
      scale:getComputedStyle(document.querySelector('.bbc-fab')).transform,sel:String(getSelection())}));
    await page.mouse.up();await sleep(500);
    s=await st(page);
    check('1440 마우스 끌기: 끄는 동안 grabbing·1.08배, 놓으면 왼쪽 가장자리에 붙고 대화창 안 열림, 지도 그대로, 글자 선택 없음',
      during.cur==='grabbing'&&during.drag&&s.l===16&&Math.abs(s.t+s.h/2-500)<=1&&!s.open&&s.center===c0&&during.sel===''&&(await page.evaluate(()=>String(getSelection())))==='',{during,s});
    await shot(page,OUT,'1440-explore-left');
    // 3px 누르기 = 열기, 왼쪽에 있으면 대화창은 오른쪽으로 펼쳐지고 화면 안
    const m2=mid(s);await page.mouse.move(m2.x,m2.y);await page.mouse.down();await page.mouse.move(m2.x+3,m2.y);await page.mouse.up();
    s=await waitOpen(page);
    const pan=await page.evaluate(()=>{const r=document.querySelector('.bbc-panel').getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom)};});
    check('1440 3px 누르기는 열기, 왼쪽의 멍이 대화창은 멍이 왼쪽 끝에 맞춰 오른쪽으로 펼침(화면 안)',s.open&&s.l===16&&pan.l===16&&pan.r<=1440-8&&pan.t>=8&&pan.b<=900-8,{s,pan});
    await shot(page,OUT,'1440-left-open');
    // 대화창이 열린 채 끌기 시작하면 닫힘
    const m3=mid(s);await page.mouse.move(m3.x,m3.y);await page.mouse.down();for(let i=1;i<=5;i++)await page.mouse.move(m3.x+i*12,m3.y-i*10);
    const wasOpen=await page.evaluate(()=>!document.querySelector('.bbc-panel').hidden);await page.mouse.up();await sleep(400);
    s=await st(page);
    check('1440 대화창이 열린 채 끌기 시작하면 대화창이 닫힘',!wasOpen&&!s.open,{wasOpen,s:s.open});
    // 키보드: Shift+위 16px, Shift+오른쪽 → 오른쪽 가장자리, Shift+Home → 기본 자리·저장값 지움
    await page.evaluate(()=>document.querySelector('.bbc-fab').focus());await page.keyboard.press('Shift');
    const k0=await st(page);await page.keyboard.press('Shift+ArrowUp');await sleep(80);const k1=await st(page);
    await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+ArrowDown');await sleep(80);const k2=await st(page);
    await page.keyboard.press('Shift+ArrowRight');await sleep(350);const k3=await st(page);
    await page.keyboard.press('Shift+ArrowLeft');await sleep(350);const k4=await st(page);
    await page.keyboard.press('Shift+Home');await sleep(350);const k5=await st(page);
    const def=await page.evaluate(()=>{const z=document.querySelector('.leaflet-control-zoom');return Math.round(z?Math.max(16,document.documentElement.clientWidth-z.getBoundingClientRect().left+12):16);});
    check('1440 키보드: Shift+↑ 16px 위, Shift+↓ 16px 아래, Shift+→ 오른쪽(기본 자리 줄), Shift+← 왼쪽, Shift+Home 기본 자리·저장값 지움, 대화창 안 열림',
      k1.t===k0.t-16&&k2.t===k0.t+16&&k3.l+k3.w===1440-def&&k3.t===k2.t&&k4.l===16&&k5.stored===null&&!k5.moved&&k5.vh-(k5.t+k5.h)===16&&k5.l+k5.w===1440-def&&!k5.open,
      {k0:[k0.l,k0.t],k1:[k1.l,k1.t],k2:[k2.l,k2.t],k3:[k3.l,k3.t],k4:[k4.l,k4.t],k5:[k5.l,k5.t,k5.stored],def});
    // Enter는 그대로 누르기
    await page.keyboard.press('Enter');s=await waitOpen(page);check('1440 Enter는 그대로 열기',s.open,s.open);
    await page.keyboard.press('Escape');await sleep(300);
    // PC 스크롤(비교 탭)과 지도 휠 확대·끌기
    await page.mouse.move(700,400);await page.mouse.down();await page.mouse.move(600,350,{steps:8});await page.mouse.up();await sleep(100);
    const mapDrag=await st(page);await page.mouse.wheel(0,-300);await sleep(150);const wheel=await st(page);
    check('1440 지도 마우스 끌기·휠 확대에는 흐려지지 않음',!mapDrag.scrolling&&!wheel.scrolling,{mapDrag:mapDrag.scrolling,wheel:wheel.scrolling});
    await page.evaluate(()=>document.querySelector('.tabs button[data-view="compare"]').click());await sleep(800);
    await page.evaluate(()=>{document.activeElement?.blur();scrollBy(0,300);});await sleep(150);const p1=await st(page);await sleep(600);const p2=await st(page);
    check('1440 페이지 스크롤에도 흐려지고 멈추면 돌아옴',p1.scrolling&&!p2.scrolling,{p1:p1.scrolling,p2:p2.scrolling});
    await shot(page,OUT,'1440-compare');
    const errs=errors.filter(noise);check('1440 콘솔 오류 없음',errs.length===0,errs);
    await page.context().close();
  }
  // ---------- 가로 넘침 360~1440 ----------
  {
    const out=[];
    for(const w of [360,390,414,768,1024,1280,1440]){
      const {page}=await open(browser,{w,h:w<741?800:900,phone:w<741,supa:'fixture'});await enter(page,BASE);
      for(const v of ['explore','compare','method']){await page.evaluate(v=>{document.querySelector(`.tabs button[data-view="${v}"]`).click();scrollTo(0,0);},v);await sleep(400);
        const s=await st(page);out.push({w,v,doc:s.doc,vw:s.vw,in:s.l>=0&&s.l+s.w<=s.vw});}
      await page.context().close();
    }
    check('360~1440 세 탭 가로 넘침 없음, 멍이 화면 안',out.every(o=>o.doc<=o.vw&&o.in),out.filter(o=>o.doc>o.vw||!o.in));
  }
  // ---------- 탭 글자 전후 같음 ----------
  if(MAIN){
    const texts=[];
    for(const base of [MAIN,BASE]){const {page}=await open(browser,{w:390,h:844,supa:'fixture'});await enter(page,base);
      for(const v of ['compare','method','explore']){await page.evaluate(v=>document.querySelector(`.tabs button[data-view="${v}"]`).click(),v);await sleep(600);}
      texts.push(await tabText(page));await page.context().close();}
    const diff=Object.keys(texts[0]).filter(k=>texts[0][k]!==texts[1][k]);
    check('세 탭 textContent가 고치기 전(main)과 같음',diff.length===0,diff);
  }
}
fs.writeFileSync(path.join(OUT,(WEBKIT?'webkit-':'')+'result.json'),JSON.stringify(results,null,1));
const fails=results.filter(r=>!r.ok).length;
console.log(`${results.length-fails} PASS / ${fails} FAIL`);
await browser.close();
process.exit(fails?1:0);
