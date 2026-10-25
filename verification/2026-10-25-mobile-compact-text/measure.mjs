// 2026-10-25 휴대폰 글 양 줄이기: main(A, 기본 8766)과 이 브랜치(B, 기본 8765)를 같은 조건으로 열어 견준다.
// (1) 네 화면(첫 화면 · 탐색 지도 · 비교와 지표 · 근거와 방법)의 textContent가 390px · 1440px 모두 같은지
// (2) 390px에서 보이는 글(innerText) 길이: 기본 상태, 그리고 접이식(근거와 방법 01~04 · 비교와 지표 '읽는 법')을 모두 연 상태
// (3) 360 · 390 · 768 · 1100 · 1440px 가로 넘침(scrollWidth − clientWidth)
// (4) 1440px에서 접는 칸이 있는 곳을 모두 연 화면(근거와 방법 01~04 펼침 · '읽는 법' 팝업 · 지도 범례 'ⓘ 범례' · 활용 × 보전 '읽는 법 ⓘ')을
//     두 번씩 찍어 픽셀을 견준다('고정된 차이' = A1==A2, B1==B2인데 A≠B인 픽셀, pc-diff.mjs와 같은 방식). 0이어야 한다.
// (5) README용 캡처(390px 전후, 1440px 전후)
// 사용: dist를 8765(이 브랜치)·8766(main)에 띄운 뒤  node verification/2026-10-25-mobile-compact-text/measure.mjs
// Supabase는 저장 사본(dist/live-snapshot.json), 위성 타일은 tmp/tile-cache(../2026-10-25-mobile-ux/common.mjs).
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData,waitGate} from '../2026-10-25-mobile-ux/common.mjs';
const DIR='verification/2026-10-25-mobile-compact-text', OUT=process.env.OUT||'tmp/mobile-compact', SHOTS=path.join(DIR,'shots');
const SIDES={A:process.env.A||'http://127.0.0.1:8766/',B:process.env.B||'http://127.0.0.1:8765/'};
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
const b=await launch();const result={text:{},chars:{},overflow:{},pc:{}};
const VIEWS=['explore','compare','method'];
const openAll=`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));for(const d of document.querySelectorAll('#method details.mt-acc'))d.open=true;
  const p=document.getElementById('cmp-read-pop');if(p)p.hidden=false;await wait(400);return 1})()`;
async function page(side,w,h,{phone=w<741,rm='reduce'}={}){
  const o=await open(b,{w,h,dpr:1,phone,supa:'fixture',reducedMotion:rm});
  await o.ctx.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});return o;}
const goView=async(p,base,v)=>{await p.goto('about:blank');await p.goto(base+'#v='+v+'&s=836033');await waitData(p);await p.waitForLoadState('networkidle').catch(()=>{});await sleep(2500);};
// ---- (1)(2)(3)
for(const [side,base] of Object.entries(SIDES)){
  for(const [w,h] of [[390,844],[1440,900]]){
    // 첫 화면(새 탭의 첫 방문)
    {const {page:p,ctx}=await page(side,w,h);await p.goto(base);await waitGate(p);await sleep(1500);
      const g=await p.evaluate(()=>{const e=document.getElementById('site-gate');return {text:e.textContent,inner:e.innerText.length,first:[...e.querySelectorAll('.gate-center *')].filter(n=>n.children.length===0&&n.getClientRects().length&&n.getBoundingClientRect().bottom<=innerHeight).map(n=>n.textContent).join('').length,enter:Math.round(document.getElementById('gate-enter').getBoundingClientRect().bottom)};});
      result.text[`${side}-${w}-gate`]=g.text;result.chars[`${side}-${w}-gate`]={inner:g.inner,enterBottom:g.enter};
      if(w===390||w===1440)await p.screenshot({path:path.join(SHOTS,`${w}-gate-${side==='A'?'before':'after'}.png`),animations:'disabled'});
      await ctx.close();}
    const {page:p,ctx}=await page(side,w,h);
    for(const v of VIEWS){
      await goView(p,base,v);
      const r=await p.evaluate(v=>{const e=document.getElementById(v);return {text:e.textContent,inner:e.innerText.length,over:document.documentElement.scrollWidth-document.documentElement.clientWidth};},v);
      await p.evaluate(openAll);
      const r2=await p.evaluate(v=>({inner:document.getElementById(v).innerText.length,text:document.getElementById(v).textContent}),v);
      result.text[`${side}-${w}-${v}`]=r.text;result.chars[`${side}-${w}-${v}`]={inner:r.inner,innerAllOpen:r2.inner};result.overflow[`${side}-${w}-${v}`]=r.over;
      if(r2.text!==r.text)result.text[`${side}-${w}-${v}-open`]=r2.text;
    }
    await ctx.close();
  }
  for(const [w,h] of [[360,780],[768,1024],[1100,800]]){
    const {page:p,ctx}=await page(side,w,h);
    for(const v of VIEWS){await goView(p,base,v);result.overflow[`${side}-${w}-${v}`]=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);}
    await ctx.close();
  }
}
const sameText={};for(const k of Object.keys(result.text).filter(k=>k.startsWith('A-')))sameText[k.slice(2)]=result.text[k]===result.text['B'+k.slice(1)];
// ---- (4) 1440px 접는 칸을 모두 연 화면, 두 번씩
const SCREENS=[['method-open','method',openAll],['compare-read','compare',`(async()=>{document.getElementById('cmp-read-toggle').click();await new Promise(r=>setTimeout(r,500));return 1})()`],
  ['explore-legend-more','explore',`(async()=>{const s=document.querySelector('.map-legend-more');s.open=true;await new Promise(r=>setTimeout(r,500));return 1})()`],
  ['explore-value-info','explore',`(async()=>{setMapMode('value');await new Promise(r=>setTimeout(r,900));document.getElementById('value-info').click();await new Promise(r=>setTimeout(r,500));return 1})()`]];
const files={};
for(const round of [1,2])for(const [side,base] of Object.entries(SIDES)){
  const {page:p,ctx}=await page(side,1440,900,{phone:false});
  for(const [name,v,act] of SCREENS){await goView(p,base,v);await p.evaluate(act);await sleep(800);await p.mouse.move(0,899);await sleep(300);
    const f=path.join(OUT,`pc-${name}-${side}${round}.png`);await p.screenshot({path:f,fullPage:true,animations:'disabled',caret:'hide',mask:[p.locator('.bbc-fab')],maskColor:'#ff00ff'});(files[name]??={})[side+round]=f;
    if(round===1&&(name==='method-open'||name==='explore-value-info'))fs.copyFileSync(f,path.join(SHOTS,`1440-${name}-${side==='A'?'before':'after'}.png`));}
  await ctx.close();
}
const cmp=await (await b.newContext()).newPage();
for(const [name,f] of Object.entries(files)){
  result.pc[name]=await cmp.evaluate(async urls=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u;});
    const im=await Promise.all(urls.map(load));const size=im.map(i=>i.width+'x'+i.height);if(new Set(size).size>1)return {size,sameSize:false};
    const W=im[0].width,H=im[0].height,px=i=>{const c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.drawImage(i,0,0);return new Uint32Array(x.getImageData(0,0,W,H).data.buffer);};
    const [a1,a2,b1,b2]=im.map(px);let raw=0,noise=0,fixed=0;for(let k=0;k<a1.length;k++){const d=a1[k]!==b1[k],n=a1[k]!==a2[k]||b1[k]!==b2[k];if(d)raw++;if(n)noise++;if(d&&!n)fixed++;}
    return {size:size[0],raw,noise,fixed};},['A1','A2','B1','B2'].map(k=>'data:image/png;base64,'+fs.readFileSync(f[k]).toString('base64')));
}
await b.close();
const summary={sameText,chars:result.chars,overflow:result.overflow,pc:result.pc};
fs.writeFileSync(path.join(DIR,'measure.json'),JSON.stringify(summary,null,1));
console.log(JSON.stringify(summary,null,1));
const bad=Object.values(sameText).filter(x=>!x).length+Object.values(result.pc).filter(r=>r.sameSize===false||r.fixed>0).length+Object.entries(result.overflow).filter(([k,v])=>k.startsWith('B-')&&v>0).length;
console.log(bad?`문제 ${bad}건`:'textContent 같음 · PC 고정된 차이 0 · 가로 넘침 없음');process.exitCode=bad?1:0;
