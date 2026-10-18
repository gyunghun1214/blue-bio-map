// '탐색 후보' 카드: 유형 배지·학명이 카드 안쪽 여백 안에 들어가는지 잰다 (2026-10-18).
// node verification/2026-10-18-neon-card-badge-fix/measure.mjs <out.json> [shot-prefix]
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (uicheck.mjs와 같음).
// 첫 화면에서 '바다 탐색하기'를 눌러 탐색 지도로 들어간 뒤, 폭마다 카드 30장을 잰다.
//  - over: 보이는 글자·요소의 오른쪽 끝이 카드 안쪽 여백 경계(테두리 - 오른쪽 padding)를 넘은 px.
//    '…'로 자르는 상자(학명)와 그 밖의 overflow 상자 안 글자는 상자에 잘린 만큼만 잰다(화면에 보이는 만큼).
//  - verdictCut: 유형 배지 글자가 잘렸는지(scrollWidth > clientWidth) · latinCut: 학명이 '…'로 잘렸는데 title이 없는 카드
//  - heights: 카드 높이 최소·최대, verdictOwnLine: 배지가 점수 아래 줄에 있는 카드 수
//  - keep: 바뀌면 안 되는 값(체크박스 위치, 점수 글자 크기, 배지 글자, 테두리·그림자)
// 폭 260·320px 사이드바는 1440px 화면에서 #explore의 --pane-l을 바꿔 만든다(데스크톱 배치 그대로 목록만 좁힘).
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,SHOT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-18-neon-card-badge-fix/measure.mjs <out.json> [shot-prefix]');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const CASES=[[1920],[1700],[1586],[1440],[1300],[1180],[1440,'260px'],[1440,'320px'],[1100],[900],[768],[390],[375]];
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map();
async function connect(){
  for(let i=0;i<300;i++){
    try{
      const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      if(Number.isInteger(port)&&port>0){const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}
    }catch{}
    await sleep(200);
  }
  throw Error('Chrome DevTools endpoint timeout');
}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},20000);pending.set(i,{res,rej,timer});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};

const MEASURE=`(()=>{
  const list=document.getElementById('species-list'),cards=[...list.querySelectorAll('.species-card')];
  const hidden=(el,card)=>{for(let n=el;n&&n!==card;n=n.parentElement){const cs=getComputedStyle(n);if(n.classList.contains('sr-only')||cs.clip!=='auto'||cs.display==='none'||cs.visibility==='hidden')return true;}return false;};
  // the visible right end of a box: cut by every ancestor (inside the card) that hides its overflow
  const clipRight=(el,card,r)=>{for(let n=el;n&&n!==card;n=n.parentElement){const cs=getComputedStyle(n);if(cs.overflowX!=='visible')r=Math.min(r,n.getBoundingClientRect().right);}return r;};
  const px=v=>parseFloat(v)||0;
  const over=[],verdictCut=[],latinCut=[],heights=[],keep={};let own=0;
  for(const card of cards){
    const cs=getComputedStyle(card),r=card.getBoundingClientRect(),name=card.querySelector(':scope>b').textContent;
    const inner=r.right-px(cs.borderRightWidth)-px(cs.paddingRight);let right=-Infinity;
    for(const el of card.querySelectorAll('*')){if(hidden(el,card))continue;const b=el.getBoundingClientRect();if(b.width>0)right=Math.max(right,clipRight(el.parentElement,card,b.right));}
    const walk=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    for(let t;(t=walk.nextNode());){if(!t.textContent.trim()||hidden(t.parentElement,card))continue;const rg=document.createRange();rg.selectNodeContents(t);for(const q of rg.getClientRects())if(q.width>0)right=Math.max(right,clipRight(t.parentElement,card,q.right));}
    if(right>inner+0.5)over.push({label:name,px:+(right-inner).toFixed(1)});
    const v=card.querySelector('.card-verdict'),vb=v?.querySelector('.verdict');
    if(vb&&(vb.scrollWidth>vb.clientWidth+1||v.scrollWidth>v.clientWidth+1))verdictCut.push(name);
    const em=card.querySelector(':scope>em');if(em&&em.scrollWidth>em.clientWidth+1&&em.title!==em.textContent)latinCut.push(name);
    const nums=[...card.querySelectorAll('.card-line .cl-v>b')];
    if(v&&nums.length&&v.getBoundingClientRect().top>=nums[0].getBoundingClientRect().bottom-1)own++;
    heights.push(Math.round(r.height));
    const box=card.parentElement.querySelector('.sc-check')?.getBoundingClientRect();
    keep[name]={check:box?[Math.round(box.left-r.left),Math.round(box.width)]:null,numSize:nums.map(n=>getComputedStyle(n).fontSize),verdict:vb?.textContent||'',
      verdictSize:v?getComputedStyle(v).fontSize:'',border:cs.borderTopColor+' '+cs.borderTopWidth,shadow:cs.boxShadow,radius:cs.borderTopLeftRadius,padL:cs.paddingLeft,padR:cs.paddingRight};
  }
  return {cards:cards.length,listWidth:Math.round(list.clientWidth),list:{scrollWidth:list.scrollWidth,clientWidth:list.clientWidth},page:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
    over,verdictCut,latinCut,verdictOwnLine:own,height:[Math.min(...heights),Math.max(...heights)],keep};
})()`;
// a card's box and its children's boxes, to see hover/selection move nothing
const RECTS=n=>`(()=>{const c=[...document.querySelectorAll('#species-list .species-card')][${n}];if(!c)return null;const o=c.getBoundingClientRect();
  return [c,...c.querySelectorAll('*')].map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left-o.left),Math.round(b.top-o.top),Math.round(b.width),Math.round(b.height)].join(',')}).join(' ')})()`;
try{
  ws=new WebSocket(await connect());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};
  await send('Page.enable');await send('Runtime.enable');
  if(process.env.FIXTURE){
    const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    const reply=k=>`Promise.resolve(new Response(JSON.stringify(FX.${k}),{status:200,headers:{'content-type':'application/json'}}))`;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return ${reply('profiles')};if(s.includes('/rest/v1/species_map_cells'))return ${reply('cells')};return o(u,...a);})(window.fetch);}`});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:URL0});
  let entered=false;
  for(let i=0;i<120;i++){await sleep(250);
    const g=await evaluate("(()=>{const g=document.getElementById('site-gate');return {on:document.documentElement.classList.contains('gate-on'),ready:!!g&&g.classList.contains('is-ready')}})()").catch(()=>null);
    if(g&&g.on&&g.ready){await evaluate("document.getElementById('gate-enter').click();1");entered=true;break;}
    if(g&&!g.on&&await evaluate("typeof data!=='undefined'&&!!data?.species?.length").catch(()=>false))break;}
  for(let i=0;i<120;i++){await sleep(250);if(await evaluate("!document.documentElement.classList.contains('gate-on')&&document.querySelectorAll('#species-list .species-card').length>0").catch(()=>false))break;}
  await sleep(800);
  const result={measuredAt:new Date().toISOString(),url:URL0,enteredByButton:entered,cases:{}};
  for(const [w,pane] of CASES){
    const key=pane?`${w}-pane${pane}`:String(w);
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:w<=740?844:900,deviceScaleFactor:1,mobile:w<=740});
    await evaluate(`document.getElementById('explore').style.${pane?`setProperty('--pane-l','${pane}')`:`removeProperty('--pane-l')`};1`);
    await sleep(700);
    const m=await evaluate(MEASURE);
    // hover the 5th card, then select it: no box inside it may move or change size
    const n=4,before=await evaluate(RECTS(n));
    const at=await evaluate(`(()=>{const c=[...document.querySelectorAll('#species-list .species-card')][${n}];c.scrollIntoView({block:'center'});const b=c.getBoundingClientRect();return {x:b.left+b.width-20,y:b.top+b.height/2}})()`);
    const hb=await evaluate(RECTS(n));
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x,y:at.y});await sleep(250);
    const hover=await evaluate(RECTS(n));
    await evaluate(`[...document.querySelectorAll('#species-list .species-card')][${n}].click();1`);await sleep(500);
    const sel=await evaluate(RECTS(n));
    m.hoverMoves=hover!==hb;m.selectMoves=sel!==hb;
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
    result.cases[key]=m;
    console.log(`${key}: 목록 ${m.listWidth}px, ${m.cards}장, 안쪽 여백 침범 ${m.over.length}종${m.over.length?' ('+m.over.map(o=>o.label+' +'+o.px+'px').join(', ')+')':''}, 배지 잘림 ${m.verdictCut.length}, 학명 잘림·title 없음 ${m.latinCut.length}, 배지 따로 줄 ${m.verdictOwnLine}/${m.cards}, 높이 ${m.height.join('–')}, hover 흔들림 ${m.hoverMoves}, 선택 흔들림 ${m.selectMoves}, 가로 넘침 ${m.page.scrollWidth>m.page.clientWidth}`);
    if(SHOT&&[1920,1440,375].includes(w)&&!pane||SHOT&&pane==='260px'){
      await evaluate("document.getElementById('species-list').scrollTop=0;window.scrollTo(0,0);1");await sleep(300);
      const r=await evaluate("(()=>{const l=document.getElementById('species-list'),p=l.closest('.species-pane')||l,b=p.getBoundingClientRect();return {x:Math.max(0,b.left),y:Math.max(0,b.top),width:Math.min(b.width,innerWidth),height:Math.min(b.height,innerHeight-Math.max(0,b.top))}})()");
      const s=await send('Page.captureScreenshot',{format:'png',clip:{...r,scale:1}});
      fs.writeFileSync(`${SHOT}-${key}.png`,Buffer.from(s.data,'base64'));
    }
  }
  fs.mkdirSync(path.dirname(path.resolve(OUT)),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,1)+'\n');
  console.log('wrote',OUT);
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
