// 2026-10-25 (LKH) 휴대폰 '지도 크게 보기' 손가락 점검: 시트 손잡이·선택 종 요약을 손가락(CDP 터치)으로 끌어
// 지도가 커지고 돌아오는지, 단추·손잡이 누르기·↓↑ 키, 위로 쓸면 전처럼 페이지가 스크롤되는지, 가로 넘침이 없는지 본다.
// dist/를 8765로 띄운 상태에서: SUPA=fixture node verification/2026-10-25-map-full/drag.mjs [출력 폴더]
//   폭은 360×780·390×844·430×932, 영어(?lang=en)는 390. 결과: <폴더>/drag.json, 크게 본 화면 캡처.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData,shot} from '../2026-10-25-mobile-ux/common.mjs';
const OUT=process.argv[2]||'tmp/map-full';fs.mkdirSync(OUT,{recursive:true});
const BASE=process.env.B||'http://127.0.0.1:8765/';
const b=await launch(),all={};let bad=0;
for(const [w,h,q] of [[360,780,''],[390,844,''],[430,932,''],[390,844,'?lang=en']]){
  const name=`${w}${q?'-en':''}`;
  const {page,ctx,errors}=await open(b,{w,h,supa:process.env.SUPA||'fixture'});
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbChatHintSeen','1');}catch{}});
  await page.goto(BASE+q);await waitData(page);await sleep(1500);
  const cdp=await ctx.newCDPSession(page);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  // Chrome은 앞 터치 동작 뒤 1초 안의 터치를 탭으로 만들지 않으므로 끌기 사이에 사람처럼 쉰다
  const drag=async(x,y0,y1)=>{await touch('touchStart',x,y0);for(let i=1;i<=12;i++){await touch('touchMove',x,y0+(y1-y0)*i/12);await sleep(16);}await touch('touchEnd');await sleep(1200);};
  const st=()=>page.evaluate(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return [Math.round(x.top),Math.round(x.bottom)];},hd=document.getElementById('sheet-handle');
    return {y:Math.round(scrollY),map:r('#explore .map-stage'),head:r('#sheet-head'),name:r('#sheet-summary .ss-name'),tabs:r('.tabs'),full:document.querySelector('#explore .explorer').classList.contains('map-full'),
      pressed:document.querySelector('.map-full-btn').getAttribute('aria-pressed'),label:hd.getAttribute('aria-label'),leaflet:map.getSize().y,drawer:document.getElementById('ev-drawer').classList.contains('open'),doc:document.documentElement.scrollWidth,vw:innerWidth};});
  const steps={};const hx=Math.round(w/2);let s;
  steps.start=s=await st();
  await drag(hx,s.head[0]+10,s.head[0]+310);steps.handleDown=s=await st();await shot(page,OUT,`full-${name}`);
  await drag(hx,s.head[0]+10,s.head[0]-20);steps.smallUpStays=s=await st();
  await drag(hx,s.head[0]+10,s.head[0]+10-(s.map[1]-steps.start.map[1]));steps.handleUp=s=await st();
  await drag(hx,s.head[0]+10,s.head[0]+40);steps.smallDownStays=s=await st();
  await drag(40,s.name[0]+8,s.name[0]+208);steps.summaryDown=s=await st();
  await page.tap('.map-full-btn');await sleep(1200);steps.buttonOff=s=await st();
  await page.tap('.map-full-btn');await sleep(1200);steps.buttonOn=s=await st();
  await page.tap('#sheet-handle');await sleep(1200);steps.handleTap=s=await st();
  await page.focus('#sheet-handle');await page.keyboard.press('ArrowDown');await sleep(800);steps.keyDown=await st();
  await page.keyboard.press('ArrowUp');await sleep(800);steps.keyUp=s=await st();
  await drag(40,s.name[0]+8,s.name[0]-192);steps.swipeUpScrolls=s=await st();
  await page.evaluate(()=>scrollTo(0,0));await sleep(1200);
  await page.tap('#sheet-summary .ss-open');await sleep(800);steps.summaryTapOpensDetail=await st();
  const full=x=>x.full&&x.pressed==='true'&&x.y===0&&x.name[1]<=x.tabs[0]&&x.head[0]>=x.tabs[0]-100&&x.leaflet===x.map[1]-x.map[0];
  const back=x=>!x.full&&x.pressed==='false'&&x.map[1]-x.map[0]===steps.start.map[1]-steps.start.map[0]&&x.leaflet===x.map[1]-x.map[0];
  const ok={start:back(steps.start),handleDown:full(steps.handleDown),smallUpStays:full(steps.smallUpStays),handleUp:back(steps.handleUp),smallDownStays:back(steps.smallDownStays)&&steps.smallDownStays.y===0,
    summaryDown:full(steps.summaryDown),buttonOff:back(steps.buttonOff),buttonOn:full(steps.buttonOn),handleTap:back(steps.handleTap),keyDown:full(steps.keyDown),keyUp:back(steps.keyUp),
    swipeUpScrolls:!steps.swipeUpScrolls.full&&steps.swipeUpScrolls.y>100,summaryTapOpensDetail:steps.summaryTapOpensDetail.drawer,noSideways:Object.values(steps).every(x=>x.doc<=x.vw),noErrors:!errors.filter(e=>e.startsWith('pageerror')).length};
  for(const [k,v] of Object.entries(ok))if(!v){bad++;console.log(`FAIL ${name} ${k}`,JSON.stringify(steps[k]||errors));}
  all[name]={ok,steps};console.log(name,Object.values(ok).every(Boolean)?'PASS':'FAIL');
  await ctx.close();
}
fs.writeFileSync(path.join(OUT,'drag.json'),JSON.stringify(all,null,1));
await b.close();process.exit(bad?1:0);
