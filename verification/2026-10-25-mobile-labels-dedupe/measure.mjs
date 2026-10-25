// 2026-10-25 휴대폰 영어 눈썹 글 · 반복 설명: 기준(A, 기본 8766)과 이 브랜치(B, 기본 8765)를 같은 조건으로 열어 견준다.
// (1) 네 화면(첫 화면 · 탐색 지도 · 비교와 지표 · 근거와 방법)의 textContent: 390px · 1440px, 한국어 · 영어 모두 같은지
// (2) 390px 한국어에서 보이는 글(innerText) 길이: 처음 상태, 그리고 접힌 곳(근거와 방법 01~04 · '읽는 법')을 연 상태
// (3) 360 · 390 · 768 · 1100 · 1440px 가로 넘침(scrollWidth − clientWidth)
// (4) 1440px 네 화면을 두 번씩 찍어 픽셀을 견준다('고정된 차이' = A1==A2, B1==B2인데 A≠B인 픽셀). 0이어야 한다.
// (5) README용 캡처: 390px 전체 페이지 전후(네 화면), 1440px 전후, 390px 영어 화면 1장
// 사용: dist를 8765(이 브랜치)·8766(기준)에 띄운 뒤  node verification/2026-10-25-mobile-labels-dedupe/measure.mjs
// Supabase는 저장 사본(dist/live-snapshot.json), 위성 타일은 tmp/tile-cache(../2026-10-25-mobile-ux/common.mjs).
import fs from 'node:fs'; import path from 'node:path';
import {launch,open,sleep,waitData,waitGate} from '../2026-10-25-mobile-ux/common.mjs';
const DIR='verification/2026-10-25-mobile-labels-dedupe', OUT=process.env.OUT||'tmp/mobile-dedupe', SHOTS=path.join(DIR,'shots');
const SIDES={A:process.env.A||'http://127.0.0.1:8766/',B:process.env.B||'http://127.0.0.1:8765/'};
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
const b=await launch();const result={text:{},chars:{},overflow:{},pc:{}};
const VIEWS=['explore','compare','method'];
const openAll=`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));for(const d of document.querySelectorAll('#method details.mt-acc'))d.open=true;
  const p=document.getElementById('cmp-read-pop');if(p)p.hidden=false;await wait(400);return 1})()`;
async function page(w,h,{phone=w<741,rm='reduce'}={}){
  const o=await open(b,{w,h,dpr:1,phone,supa:'fixture',reducedMotion:rm});
  await o.ctx.addInitScript(()=>{try{localStorage.setItem('bbChatHintSeen','1');}catch{}});return o;}
const goView=async(p,base,v,lang='')=>{await p.goto('about:blank');await p.goto(base+(lang?'?lang='+lang:'')+'#v='+v+'&s=836033');await waitData(p);await p.waitForLoadState('networkidle').catch(()=>{});await sleep(2500);};
const tag=s=>s==='A'?'before':'after';
// ---- (1)(2)(3)(5)
for(const [side,base] of Object.entries(SIDES)){
  for(const lang of ['','en'])for(const [w,h] of [[390,844],[1440,900]]){
    const L=lang||'ko';
    {const {page:p,ctx}=await page(w,h);await p.goto(base+(lang?'?lang='+lang:''));await waitGate(p);await sleep(1500);
      const g=await p.evaluate(()=>{const e=document.getElementById('site-gate');return {text:e.textContent,inner:e.innerText.length};});
      result.text[`${side}-${L}-${w}-gate`]=g.text;if(!lang)result.chars[`${side}-${w}-gate`]={inner:g.inner};
      if(!lang)await p.screenshot({path:path.join(SHOTS,`${w}-gate-${tag(side)}.png`),fullPage:w<741,animations:'disabled'});
      await ctx.close();}
    const {page:p,ctx}=await page(w,h);
    for(const v of VIEWS){
      await goView(p,base,v,lang);
      const r=await p.evaluate(v=>{const e=document.getElementById(v);return {text:e.textContent,inner:e.innerText.length,over:document.documentElement.scrollWidth-document.documentElement.clientWidth};},v);
      if(!lang)await p.screenshot({path:path.join(OUT,`${w}-${v}-${tag(side)}.png`),fullPage:true,animations:'disabled',caret:'hide',mask:[p.locator('.bbc-fab')],maskColor:'#ff00ff'});
      if(lang&&w===390&&side==='B'&&v==='method')await p.screenshot({path:path.join(SHOTS,`390-en-method-after.png`),fullPage:false,animations:'disabled'});
      await p.evaluate(openAll);
      const r2=await p.evaluate(v=>({inner:document.getElementById(v).innerText.length,text:document.getElementById(v).textContent}),v);
      result.text[`${side}-${L}-${w}-${v}`]=r.text;if(r2.text!==r.text)result.text[`${side}-${L}-${w}-${v}-open`]=r2.text;
      if(!lang){result.chars[`${side}-${w}-${v}`]={inner:r.inner,innerAllOpen:r2.inner};result.overflow[`${side}-${w}-${v}`]=r.over;}
    }
    await ctx.close();
  }
  for(const [w,h] of [[360,780],[768,1024],[1100,800]]){
    const {page:p,ctx}=await page(w,h);
    for(const v of VIEWS){await goView(p,base,v);result.overflow[`${side}-${w}-${v}`]=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);}
    await ctx.close();
  }
}
const sameText={};for(const k of Object.keys(result.text).filter(k=>k.startsWith('A-')))sameText[k.slice(2)]=result.text[k]===result.text['B'+k.slice(1)];
// ---- (4) 1440px 네 화면(+ 근거와 방법 모두 펼침 · '읽는 법' 팝업), 두 번씩
const SCREENS=[['explore','explore',''],['compare','compare',''],['method','method',''],['method-open','method',openAll],
  ['compare-read','compare',`(async()=>{document.getElementById('cmp-read-toggle').click();await new Promise(r=>setTimeout(r,500));return 1})()`]];
const files={};
for(const round of [1,2])for(const [side,base] of Object.entries(SIDES)){
  const {page:p,ctx}=await page(1440,900,{phone:false});
  for(const [name,v,act] of SCREENS){await goView(p,base,v);if(act)await p.evaluate(act);await sleep(800);await p.mouse.move(0,899);await sleep(300);
    const f=path.join(OUT,`pc-${name}-${side}${round}.png`);await p.screenshot({path:f,fullPage:true,animations:'disabled',caret:'hide',mask:[p.locator('.bbc-fab')],maskColor:'#ff00ff'});(files[name]??={})[side+round]=f;}
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
