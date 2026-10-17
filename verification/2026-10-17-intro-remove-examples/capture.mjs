// 첫 화면 예시 카드 제거 확인 (2026-10-17): 390·768·1100·1440 첫 화면 캡처와 측정(가로 넘침, 지구본과 글 간격, 콘솔 오류,
// 카드 흔적, 움직임 줄이기). dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-17-intro-remove-examples/capture.mjs [출력 폴더] [접두어] [BASE]
// 전 화면(main)을 찍을 때는 접두어 before, BASE에 main을 띄운 주소를 준다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname,TAG=process.argv[3]||'after',BASE=process.argv[4]||'http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h,still){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  // FIXTURE answers the two Supabase reads (the cloud blocks them), as uicheck.mjs does
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  if(still)await page.addInitScript(()=>{try{localStorage.setItem('bbvm-reduce-motion','1');}catch{}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE);await page.waitForFunction(()=>document.getElementById('site-gate')?.classList.contains('is-ready'),null,{timeout:30000});
  await page.waitForTimeout(1800);return {page,errors};
}
const measure=page=>page.evaluate(()=>{
  const el=document.getElementById('site-gate'),w=innerWidth,h=innerHeight,band=el.querySelector('.gate-globe');
  const stacked=getComputedStyle(band).display!=='none',bb=band.getBoundingClientRect();
  const tb=n=>{const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return {r:b.right,t:b.top,b:b.bottom,l:b.left};};
  const vis=s=>[...el.querySelectorAll(s)].filter(n=>n.getClientRects().length);
  const title=[...el.querySelector('.gate-title').children].map(s=>({...tb(s),title:true}));
  const copy=vis('.gate-why-k,.gate-problems li,.gate-lead,.gate-more,.gate-note,.gate-counts').map(tb);
  const btn=vis('#gate-enter,.gate-more').map(n=>{const b=n.getBoundingClientRect();return {r:b.right,t:b.top,b:b.bottom};});
  const f=globeFrame(w,h,stacked?{top:bb.top,bottom:bb.bottom}:null,stacked?[]:title.concat(copy));
  // side by side: how far each line of copy (and each button) stays left of the globe's edge on its rows (negative = under the globe)
  const gap=b=>{const dy=Math.max(0,b.t-f.cy,f.cy-b.b);return dy>=f.R?Infinity:(f.cx-Math.sqrt(f.R*f.R-dy*dy))-b.r;};
  const hero=el.querySelector('.gate-hero');
  return {stacked,over:document.documentElement.scrollWidth-document.documentElement.clientWidth,hero:hero.scrollWidth-hero.clientWidth,
    copyGap:stacked?null:Math.min(...copy.concat(btn).map(gap)),bandTop:stacked?Math.round(bb.top):null,
    copyBottom:Math.round(Math.max(...copy.concat(btn).map(b=>b.b))),globe:{cx:Math.round(f.cx),cy:Math.round(f.cy),R:Math.round(f.R)},
    cards:el.querySelectorAll('.gate-ex,[data-ex]').length,said:['활용 지표 1위','보전 지표 높음','어획량 감소 신호'].filter(t=>el.textContent.includes(t)),
    still:el.classList.contains('is-still'),enter:el.querySelector('#gate-enter').getBoundingClientRect().bottom<=h};});
for(const [w,h] of [[1440,900],[1100,800],[768,1024],[390,844]])for(const still of [false,true]){
  const {page,errors}=await open(w,h,still),m=await measure(page),k=`${TAG} ${w}px${still?' 움직임 줄이기':''}`;
  // over: the page's own sideways scroll (scrollWidth - clientWidth). hero: the same inside .gate-hero, kept for the record (at 1440 the
  // legend's credit line reaches 3–4 px past it, before this change too; .gate-hero does not scroll sideways there)
  log(`${k}: 가로 넘침 없음`,m.over<=0,{over:m.over,hero:m.hero});
  log(`${k}: 지구본이 글·버튼과 겹치지 않음`,m.stacked?m.bandTop>=m.copyBottom:m.copyGap>=0,{stacked:m.stacked,copyGap:m.copyGap,bandTop:m.bandTop,copyBottom:m.copyBottom,globe:m.globe});
  log(`${k}: 바다 탐색하기 버튼이 첫 화면 안`,m.enter);
  log(`${k}: 콘솔 오류 없음`,errors.length===0,errors);
  if(still)log(`${k}: 움직임 줄이기 켜짐`,m.still);
  if(TAG==='after')log(`${k}: 예시 카드 없음(DOM·글자)`,m.cards===0&&m.said.length===0,{cards:m.cards,said:m.said});
  if(!still)await page.screenshot({path:`${OUT}/${TAG}-${w}-intro.png`});
  await page.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/${TAG}-results.json`,JSON.stringify(results,null,1));
const fail=results.filter(r=>!r.ok).length;console.log(`${results.length-fail} PASS / ${fail} FAIL`);process.exit(fail?1:0);
