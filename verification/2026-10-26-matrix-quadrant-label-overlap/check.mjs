// 2026-10-26 매트릭스 사분면 이름표가 점·밀집 구간 버튼을 피하게 — 겹침 조사와 전/후 캡처.
// 사용: 저장소 루트에서 dist를 8765(이 브랜치)·8766(고치기 전 main)에 띄운 뒤
//   SUPA=fixture TILES=off OUT=verification/2026-10-26-matrix-quadrant-label-overlap/after node verification/2026-10-26-matrix-quadrant-label-overlap/check.mjs
//   BASE=http://127.0.0.1:8766/ OUT=…/before 로 main을 같은 방식으로 잰다.
// 360·390·768·1100·1440px × 비교 기준(공식, MFPI 0.00, MFPI 1.00) × 분류(전체·해조류·패류·어류·기타 무척추동물)마다
// 보이는 사분면 이름표 두 줄의 글자 사각형과 점(지름+4px)·밀집 구간 버튼·보이는 점 이름·눈금 숫자가 겹치는 것을 모은다
// (px = 실제로 겹친 넓이, px6 = 이름표에 6px 여유를 둔 넓이). 이름표·점 자리와 매트릭스 글도 남겨 전후를 비교한다.
// 결과: <OUT>/result.json, 캡처 png.
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,waitGate,waitData,shot,sleep} from '../2026-10-25-mobile-ux/common.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:8765/', OUT=process.env.OUT||'verification/2026-10-26-matrix-quadrant-label-overlap/after';
fs.mkdirSync(OUT,{recursive:true});
const SIZES=[[360,780,true],[390,844,true],[768,1024,false],[1100,900,false],[1440,900,false]];
const GROUPS=['all','해조류','패류','어류','기타 무척추동물'], STEPS=[null,0,20];
const MEASURE=()=>{const b=e=>e.getBoundingClientRect(),vis=e=>{if(!e||e.closest('[hidden]'))return false;const c=b(e);return c.width>0&&c.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const inter=(a,c)=>Math.max(0,Math.min(a.right,c.right)-Math.max(a.left,c.left))*Math.max(0,Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top));
  // a line's text (the strong's circle mark included)
  const txt=e=>{const r=document.createRange();r.selectNodeContents(e);const x=r.getBoundingClientRect();if(!/^"/.test(getComputedStyle(e,'::before').content))return x;const s=b(e);return {left:Math.min(x.left,s.left),right:x.right,top:Math.min(x.top,s.top),bottom:Math.max(x.bottom,s.bottom)};};
  const obs=[...[...document.querySelectorAll('#matrix-points .matrix-point')].filter(vis).map(e=>{const r=b(e);return {k:'점 '+(e.dataset.name||e.textContent),r:{left:r.left-2,right:r.right+2,top:r.top-2,bottom:r.bottom+2}};}),
    ...[...document.querySelectorAll('#matrix-points .matrix-cluster-btn')].filter(vis).map(e=>({k:'버튼 '+e.textContent.trim(),r:b(e)})),
    ...[...document.querySelectorAll('#matrix-points .point-label:not(.hidden-label)')].filter(vis).map(e=>({k:'점 이름 '+e.textContent,r:b(e)})),
    ...[...document.querySelectorAll('#compare .matrix-ticks i,#compare .matrix-ticks b')].filter(vis).map(e=>({k:'눈금 '+e.textContent,r:b(e)}))];
  const hits=[];
  for(const q of document.querySelectorAll('#matrix .quadrant'))for(const p of [q.querySelector('strong'),q.querySelector('span')]){
    if(!vis(p)||!p.textContent.trim())continue;const r=txt(p),pad={left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6};
    for(const o of obs){const a6=inter(pad,o.r);if(a6>0)hits.push({q:q.classList[1],line:p.tagName==='STRONG'?1:2,what:o.k,px:Math.round(inter(r,o.r)),px6:Math.round(a6)});}}
  const m=document.getElementById('matrix'),p=b(m),rel=e=>{const r=b(e);return [Math.round(r.left-p.left),Math.round(r.top-p.top),Math.round(r.width),Math.round(r.height)];};
  return {hits,plotH:Math.round(p.height),text:m.textContent,names:[...m.querySelectorAll('.quadrant :is(strong,span)')].map(rel),
    points:[...document.querySelectorAll('#matrix-points .matrix-point')].map(e=>e.dataset.aphia+':'+e.style.left+'/'+e.style.bottom),pointBoxes:[...document.querySelectorAll('#matrix-points .matrix-point')].map(rel),
    out:[...m.querySelectorAll('.q-name[data-out]')].map(e=>e.parentElement.classList[1]),moved:[...m.querySelectorAll('.q-name')].map(e=>e.parentElement.classList[1]+':'+(e.style.translate||'-'))};};
const browser=await launch();const rows=[], errors=[];
for(const [w,h,phone] of SIZES){
  const {ctx,page,errors:pageErrors}=await open(browser,{w,h,phone,dpr:phone?2:1});
  await page.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbChatHintSeen','1');}catch{}});
  await page.goto(BASE);await waitData(page);
  if(await page.evaluate(()=>document.documentElement.classList.contains('gate-on'))){await waitGate(page);await page.evaluate(()=>document.getElementById('gate-enter').click());await sleep(1200);}
  await page.evaluate(()=>{setView('compare');setCompareMode('matrix');});await sleep(900);
  for(const step of STEPS){
    await page.evaluate(s=>setBbviStep(s===null?NaN:s),step);await sleep(700);
    for(const g of GROUPS){
      await page.evaluate(g=>setCompareFilter({q:'',group:g}),g);await sleep(150);
      rows.push({w,weight:step===null?'공식':'MFPI '+(step/20).toFixed(2),group:g,...await page.evaluate(MEASURE)});
      if(step===null&&(g==='all'||(g==='해조류'&&w===390)))await page.locator('#cmp-matrix-view .matrix-frame').screenshot({path:path.join(OUT,`${w}-${g==='all'?'전체':'해조류'}.png`),animations:'disabled'});
    }
  }
  errors.push(...pageErrors.filter(e=>!/Failed to load resource|ERR_/.test(e)).map(e=>w+' '+e));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({base:BASE,errors,rows},null,1));
for(const r of rows.filter(r=>r.hits.length))console.log(r.w,r.weight,r.group,r.hits.map(x=>`${x.q} ${x.line}줄 ${x.what} ${x.px}/${x.px6}`).join(', '));
console.log('cases',rows.length,'with hits',rows.filter(r=>r.hits.length).length,'errors',errors.length);
