// 2026-10-26 (LKH) 휴대폰 탐색 지도 배경 지도 출처 ⓘ 점검 (Playwright).
// dist/를 8765(이 브랜치)·8766(main, 전후 비교용)으로 띄운 상태에서:
//   SUPA=fixture node verification/2026-10-26-map-attribution-info/check.mjs [출력 폴더]
// 위성(GIBS)·수심(GEBCO) 타일은 막힌 곳에서도 레이어가 살아 있도록 작은 그림으로 대신 준다(TILES=real이면 common.mjs 방식).
// BROWSER=webkit이면 WebKit(iPhone Safari 엔진)으로 돌린다. 결과: <폴더>/check.json, 전후 캡처.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData,shot} from '../2026-10-25-mobile-ux/common.mjs';
const OUT=process.argv[2]||'tmp/map-attribution';fs.mkdirSync(OUT,{recursive:true});
const NEW=process.env.B||'http://127.0.0.1:8765/',OLD=process.env.MAIN||'http://127.0.0.1:8766/';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
let browser;
if(process.env.BROWSER==='webkit'){const {webkit}=await import('playwright');browser=await webkit.launch();}
else browser=await launch();
const kit=process.env.BROWSER==='webkit'?'-webkit':'';
const res={},bad=[];
const ok=(name,cond,info)=>{res[name]={ok:!!cond,info};if(!cond){bad.push(name);console.log('FAIL',name,JSON.stringify(info));}else console.log('PASS',name);};
async function page(base,w,h,phone){
  const o=await open(browser,{w,h,phone,supa:process.env.SUPA||'fixture'});
  if(process.env.TILES!=='real')await o.ctx.route(/gibs\.earthdata\.nasa\.gov|gebco\.net/,r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
  await o.ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbChatHintSeen','1');localStorage.removeItem('basemap');}catch{}});
  await o.page.goto(base);await waitData(o.page);await sleep(2000);
  return o;
}
const rects=p=>p.evaluate(()=>{const r=e=>{if(!e)return null;const x=e.getBoundingClientRect();return x.width?{l:Math.round(x.left),t:Math.round(x.top),r:Math.round(x.right),b:Math.round(x.bottom)}:null;};
  const q=s=>document.querySelector(s),btn=q('#map .attr-toggle'),txt=q('#map .attr-text');
  return {attr:r(q('.leaflet-control-attribution')),toggle:r(btn),text:r(txt)||(txt?null:r(q('.leaflet-control-attribution'))),textVisible:txt?getComputedStyle(txt).display!=='none':true,
    textContent:q('.leaflet-control-attribution').textContent,expanded:btn?.getAttribute('aria-expanded'),label:btn?.getAttribute('aria-label'),controls:btn?.getAttribute('aria-controls')===txt?.id,
    toggleDisplay:btn?getComputedStyle(btn).display:'(none)',zoom:r(q('.leaflet-control-zoom')),full:r(q('.map-full-ctl')),legend:r(q('#explore .map-ui-bl')),head:r(q('#sheet-head')),stage:r(q('#explore .map-stage')),
    fs:txt?parseFloat(getComputedStyle(txt).fontSize):parseFloat(getComputedStyle(q('.leaflet-control-attribution')).fontSize),focus:document.activeElement===btn,vw:innerWidth,doc:document.documentElement.scrollWidth};});
const apart=(a,b)=>!a||!b||a.r<=b.l||b.r<=a.l||a.b<=b.t||b.b<=a.t;
const exploreText=p=>p.evaluate(()=>document.getElementById('explore').textContent.replace(/\s+/g,' ').trim());

// ---- 전후: 탐색 지도 textContent, 넓은 화면 출처 줄 자리 ----
for(const [w,h,phone] of [[390,844,true],[1440,900,false]]){
  const a=await page(OLD,w,h,phone),b=await page(NEW,w,h,phone);
  const [ta,tb,ra,rb]=[await exploreText(a.page),await exploreText(b.page),await rects(a.page),await rects(b.page)];
  ok(`${w}${kit} explore textContent same as main`,ta===tb,{len:[ta.length,tb.length],at:[...ta].findIndex((c,i)=>c!==tb[i])});
  await shot(a.page,OUT,`before-${w}${kit}`);await shot(b.page,OUT,`after-${w}${kit}`);
  if(!phone)ok(`${w}${kit} no ⓘ, attribution line where it was`,rb.toggleDisplay==='none'&&JSON.stringify(ra.attr)===JSON.stringify(rb.attr)&&ra.textContent===rb.textContent&&JSON.stringify(ra.zoom)===JSON.stringify(rb.zoom),{ra,rb});
  else ok(`${w}${kit} zoom and enlarge buttons where they were`,JSON.stringify(ra.zoom)===JSON.stringify(rb.zoom)&&JSON.stringify(ra.full)===JSON.stringify(rb.full),{zoom:[ra.zoom,rb.zoom],full:[ra.full,rb.full]});
  for(const o of [a,b])await o.ctx.close();
}

// ---- 390: 접힘·펼침·닫기·자리 ----
{
  const {page:p,ctx,errors}=await page(NEW,390,844,true);
  const clear=s=>apart(s.toggle,s.head)&&apart(s.toggle,s.zoom)&&apart(s.toggle,s.full)&&apart(s.toggle,s.legend)&&s.toggle.b<=s.head.t;
  let s=await rects(p);res.closed=s;
  ok('390 closed: ⓘ visible, name 배경 지도 출처 보기, aria-expanded=false, credits folded',s.toggle&&s.toggleDisplay!=='none'&&s.label==='배경 지도 출처 보기'&&s.expanded==='false'&&s.controls&&!s.textVisible,s);
  ok('390 closed: ⓘ above the sheet edge, clear of 범례, zoom and enlarge buttons; 28px circle in a 44px target',clear(s)&&s.toggle.r-s.toggle.l>=44&&s.toggle.b-s.toggle.t>=44,s);
  ok('390 closed: nothing of the credits peeks over the sheet edge',!s.textVisible&&s.attr.b<=s.head.t,s);
  await p.tap('#map .attr-toggle');await sleep(300);s=await rects(p);await shot(p,OUT,`after-390-open${kit}`);
  ok('390 tap ⓘ: credits shown (aria-expanded=true), bubble inside the screen and the map, ≥13px',s.expanded==='true'&&s.textVisible&&s.text.l>=16&&s.text.r<=s.vw-16&&s.text.t>=s.stage.t&&s.text.b<=s.head.t&&s.fs>=13&&/NASA GIBS/.test(s.textContent),s);
  await p.keyboard.press('Escape');await sleep(200);s=await rects(p);
  ok('390 Esc closes, focus stays on ⓘ',s.expanded==='false'&&!s.textVisible&&s.focus,s);
  await p.tap('#map .attr-toggle');await sleep(200);
  const spot=await p.evaluate(()=>{const m=document.getElementById('map').getBoundingClientRect();
    for(let y=m.top+120;y<m.bottom-80;y+=17)for(let x=m.left+60;x<m.right-80;x+=23){const e=document.elementFromPoint(x,y);if(e&&e.closest('#map')&&!e.closest('.leaflet-control,.leaflet-interactive,.map-ui,.leaflet-marker-icon,.map-ui-tl,.map-ui-tr,.map-ui-bl,button,a,canvas'))return {x:Math.round(x),y:Math.round(y)};}return null;});
  await p.touchscreen.tap(spot.x,spot.y);await sleep(300);s=await rects(p);
  ok('390 tap on an empty map spot closes',spot&&s.expanded==='false'&&!s.textVisible,{spot,s});
  await p.tap('#map .attr-toggle');await sleep(200);s=await rects(p);
  ok('390 tap ⓘ again opens, a second tap closes',s.expanded==='true'&&(await p.tap('#map .attr-toggle'),await sleep(200),(await rects(p)).expanded==='false'),s);
  // 위성 ↔ 수심: 펼친 출처가 그 레이어의 출처로 바뀐다(Leaflet이 다시 쓴다)
  await p.tap('[data-basemap="depth"]');await sleep(500);await p.tap('#map .attr-toggle');await sleep(200);const depth=await rects(p);
  await p.tap('[data-basemap="satellite"]');await sleep(500);const sat=await rects(p);
  ok('390 depth ↔ satellite: the open credits follow the layer',/GEBCO_2026/.test(depth.textContent)&&!/NASA/.test(depth.textContent)&&depth.textVisible&&/NASA GIBS/.test(sat.textContent)&&!/GEBCO/.test(sat.textContent),{depth:depth.textContent,sat:sat.textContent});
  await p.keyboard.press('Escape');
  // 키보드: Enter·Space로 열고 닫는다
  await p.focus('#map .attr-toggle');await p.keyboard.press('Enter');await sleep(150);const kOpen=await rects(p);await p.keyboard.press('Space');await sleep(150);const kClose=await rects(p);
  ok('390 keyboard: Enter opens, Space closes, focus ring on the circle',kOpen.expanded==='true'&&kClose.expanded==='false'&&kClose.focus,{kOpen:kOpen.expanded,kClose:kClose.expanded});
  // 시트 중간(페이지를 조금 올림): 단추가 시트 윗선을 따라 올라가고, 열려 있던 출처는 접힌다
  await p.tap('#map .attr-toggle');await sleep(150);
  await p.evaluate(()=>scrollTo(0,160));await sleep(500);s=await rects(p);await shot(p,OUT,`after-390-sheet-mid${kit}`);
  ok('390 sheet half up: ⓘ rides above the sheet edge, still clear of the buttons; the open credits closed',clear(s)&&s.toggle.b>=s.head.t-12&&s.expanded==='false',s);
  await p.tap('#map .attr-toggle');await sleep(200);s=await rects(p);await shot(p,OUT,`after-390-sheet-mid-open${kit}`);
  ok('390 sheet half up: open bubble stays inside the map above the sheet',s.expanded==='true'&&s.text.t>=s.stage.t&&s.text.b<=s.head.t&&s.text.l>=16,s);
  await p.evaluate(()=>scrollTo(0,0));await sleep(500);s=await rects(p);
  ok('390 sheet back down: ⓘ back above the sheet edge',clear(s)&&s.toggle.b>=s.head.t-12,s);
  // 지도 크게 보기: 시트가 내려가면 단추도 함께 내려간다
  await p.tap('.map-full-btn');await sleep(900);s=await rects(p);await shot(p,OUT,`after-390-map-full${kit}`);
  ok('390 map enlarged: ⓘ follows the sheet edge down',clear(s)&&s.toggle.b>=s.head.t-12,s);
  await p.tap('.map-full-btn');await sleep(900);
  // 시트를 다 올리면 단추는 시트 밑에 가려도 된다(지도 위 맨 앞이 아니다)
  await p.evaluate(()=>document.getElementById('sheet-handle').click());await sleep(900);
  const hidden=await p.evaluate(()=>{const b=document.querySelector('#map .attr-toggle').getBoundingClientRect(),e=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return !e?.closest('.attr-toggle');});
  ok('390 sheet fully up: ⓘ under the sheet',hidden,hidden);
  ok('390 no console errors',!errors.length,errors);
  await ctx.close();
}
// ---- 360~1440: 가로 넘침·콘솔 오류 ----
for(const [w,h,phone] of [[360,780,true],[430,932,true],[740,900,true],[741,900,false],[1024,800,false],[1440,900,false]]){
  const {page:p,ctx,errors}=await page(NEW,w,h,phone);
  if(phone){await p.tap('#map .attr-toggle').catch(()=>{});await sleep(200);}
  const s=await rects(p);
  ok(`${w}${kit} no sideways scroll${phone?' with the credits open':''}, ⓘ only ≤740px, no console errors`,s.doc<=s.vw&&(w<=740?s.toggleDisplay!=='none'&&(!s.textVisible||s.text.l>=0&&s.text.r<=s.vw):s.toggleDisplay==='none'&&s.textVisible)&&!errors.length,{s,errors});
  await ctx.close();
}
fs.writeFileSync(path.join(OUT,`check${kit}.json`),JSON.stringify(res,null,1));
await browser.close();
console.log(bad.length?`${bad.length} FAIL`:'ALL PASS');process.exit(bad.length?1:0);
