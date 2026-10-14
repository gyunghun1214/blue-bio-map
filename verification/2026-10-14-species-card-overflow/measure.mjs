// '탐색 후보' 카드 글자 넘침 측정 (2026-10-14). uicheck.mjs와 같은 방식(의존성 없는 헤드리스 Chrome).
// node verification/2026-10-14-species-card-overflow/measure.mjs <out.json> [list-1440.png]
// Env: URL0 (default http://127.0.0.1:8765/), CHROME_PATH, FIXTURE (uicheck.mjs와 같음).
// 첫 화면(지구본)에서 '바다 탐색하기'를 눌러 탐색 지도로 들어간 뒤, 폭마다 다음을 잰다.
//  - list: #species-list의 scrollWidth/clientWidth (741px 이상에서 scrollWidth > clientWidth면 가로 스크롤)
//  - over: 카드 안 보이는 요소·글자의 오른쪽 끝이 카드 오른쪽 끝(테두리)을 넘는 종 이름과 넘친 px
// 화면 낭독용 sr-only, 숨겨 둔 .count/.card-scores(clip)는 화면에 보이지 않으므로 재지 않는다.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const [OUT,SHOT]=process.argv.slice(2);
if(!OUT)throw Error('Usage: node verification/2026-10-14-species-card-overflow/measure.mjs <out.json> [list-1440.png]');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const WIDTHS=[1920,1440,1300,1100,900,390];
const LOOK=['홍합(참담치)','우뭇가사리','살오징어','톳','멍게','큰가리비','고등어','멸치','참조기','방어'];
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

// 카드마다: 보이는 요소의 상자와 글자(Range) 상자의 오른쪽 끝 중 가장 큰 값 - 카드 오른쪽 끝(테두리 안쪽까지 포함한 border-box).
const MEASURE=`(()=>{
  const list=document.getElementById('species-list'),cards=[...list.querySelectorAll('.species-card')];
  const hidden=(el,card)=>{for(let n=el;n&&n!==card;n=n.parentElement){const cs=getComputedStyle(n);if(n.classList.contains('sr-only')||cs.clip!=='auto'||cs.display==='none'||cs.visibility==='hidden')return true;}return false;};
  const over=[];
  for(const card of cards){
    const edge=card.getBoundingClientRect().right;let right=-Infinity;
    for(const el of card.querySelectorAll('*')){if(hidden(el,card))continue;const r=el.getBoundingClientRect();if(r.width>0)right=Math.max(right,r.right);}
    const walk=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    for(let t;(t=walk.nextNode());){if(!t.textContent.trim()||hidden(t.parentElement,card))continue;const rg=document.createRange();rg.selectNodeContents(t);for(const r of rg.getClientRects())if(r.width>0)right=Math.max(right,r.right);}
    if(right>edge+0.5)over.push({label:card.querySelector(':scope>b').textContent,px:+(right-edge).toFixed(1)});
  }
  const line=c=>c.querySelector('.card-line')?.getBoundingClientRect().height||0;
  return {cards:cards.length,list:{scrollWidth:list.scrollWidth,clientWidth:list.clientWidth},page:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
    over,lineHeights:Object.fromEntries(cards.map(c=>[c.querySelector(':scope>b').textContent,Math.round(line(c))]))};
})()`;
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
  // 첫 화면: 준비되면 '바다 탐색하기'를 누른다(첫 화면이 안 뜨는 경우는 그대로 지도).
  let entered=false;
  for(let i=0;i<120;i++){await sleep(250);
    const g=await evaluate("(()=>{const g=document.getElementById('site-gate');return {on:document.documentElement.classList.contains('gate-on'),ready:!!g&&g.classList.contains('is-ready')}})()").catch(()=>null);
    if(g&&g.on&&g.ready){await evaluate("document.getElementById('gate-enter').click();1");entered=true;break;}
    if(g&&!g.on&&await evaluate("typeof data!=='undefined'&&!!data?.species?.length").catch(()=>false))break;}
  for(let i=0;i<120;i++){await sleep(250);if(await evaluate("!document.documentElement.classList.contains('gate-on')&&document.querySelectorAll('#species-list .species-card').length>0").catch(()=>false))break;}
  await sleep(800);
  const result={measuredAt:new Date().toISOString(),url:URL0,enteredByButton:entered,widths:{}};
  for(const w of WIDTHS){
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:w<=740?844:900,deviceScaleFactor:1,mobile:w<=740});
    await sleep(700);
    const m=await evaluate(MEASURE);
    m.listScrolls=w>=741&&m.list.scrollWidth>m.list.clientWidth;
    result.widths[w]=m;
    console.log(`${w}px: ${m.cards}장, 넘침 ${m.over.length}종${m.over.length?' ('+m.over.map(o=>o.label+' +'+o.px+'px').join(', ')+')':''}, 목록 ${m.list.scrollWidth}/${m.list.clientWidth}${m.listScrolls?' 가로 스크롤':''}`);
    if(w===1440&&SHOT){
      const r=await evaluate("(()=>{const p=document.getElementById('species-list').closest('aside,section,.pane')||document.getElementById('species-list');const b=p.getBoundingClientRect();return {x:b.left,y:b.top,width:b.width,height:b.height}})()");
      const s=await send('Page.captureScreenshot',{format:'png',clip:{...r,scale:1}});
      fs.writeFileSync(SHOT,Buffer.from(s.data,'base64'));
    }
  }
  result.look=Object.fromEntries(LOOK.map(l=>[l,Object.fromEntries(WIDTHS.map(w=>[w,result.widths[w].over.find(o=>o.label===l)?.px??0]))]));
  fs.mkdirSync(path.dirname(path.resolve(OUT)),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,1)+'\n');
  console.log('wrote',OUT);
}finally{
  try{ws?.close();}catch{}
  chrome.kill();
}
