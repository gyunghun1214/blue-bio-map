// 화면 글자 뽑기 (언어 전환 검사, 2026-10-24). 로컬 dist를 headless Chrome으로 열어 화면마다 글자·속성 글자·링크·점수를 뽑는다.
// 기준 만들기(verification/i18n-ko-baseline.txt)와 이후 비교(verification/test_i18n.mjs)가 모두 이 스크립트 하나를 쓴다.
// 흔들리지 않게: 바깥 요청은 모두 막고 Supabase는 저장 사본(dist/live-snapshot.json)으로 답한다. 시계는 2026-10-24T12:00:00+09:00에서
// 시작한다. 지구본 로딩과 애니메이션이 끝날 때까지 기다린다. 언어 버튼(.lang-switch)은 뽑지 않는다.
// node verification/i18n_extract_text.mjs <out.txt> [--lang en] [--json out.json]   (dist를 http://127.0.0.1:8765/에 띄운 뒤)
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2), OUT=args[0], LANG=args.includes('--lang')?args[args.indexOf('--lang')+1]:'ko', JSON_OUT=args.includes('--json')?args[args.indexOf('--json')+1]:'';
if(!OUT)throw Error('Usage: node verification/i18n_extract_text.mjs <out.txt> [--lang en] [--json out.json]');
const DIST=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const URL0=process.env.URL0||'http://127.0.0.1:8765/', ORIGIN=new URL(URL0).origin;
const FX=JSON.parse(fs.readFileSync(path.join(DIST,'live-snapshot.json'),'utf8'));
const CLOCK='2026-10-24T12:00:00+09:00';
const SPECIES=[['전복',397082],['미역',145721],['참조기',281273]];
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=u=>{const x=new URL(u,URL0);if(LANG!=='ko')x.searchParams.set('lang',LANG);return x.href;};

// 페이지 안에서 도는 뽑기: 글자 마디와 화면 속성(aria-label·title·placeholder·alt·data-short·data-label 등)을 문서 순서대로 한 줄씩.
// 숨은 접이식 안 글자도 뽑는다(번역이 빠진 곳을 찾으려고). 링크는 lang 매개변수를 뺀 href 목록.
// 영어 화면(--lang en)에서는 한글이 남은 곳도 따로 적는다: 사전에 없어 KO 표시가 붙은 글자(ko), 원어 그대로 둔 lang="ko" 글자(orig),
// 표시 없이 남은 글자·속성(left)과 그 위치.
const EXTRACT=`(sel=>{const SKIP=new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']),A=['aria-label','title','placeholder','alt','data-short','data-label','data-k','data-mt-more','aria-valuetext'],out=[],hrefs=[],hangul=[];
  const norm=s=>String(s).replace(/\\s+/g,' ').trim(),H=/[\\u3131-\\u318e\\uac00-\\ud7a3]/,en=document.documentElement.lang==='en';
  const where=el=>{const p=[];for(let e=el;e&&e!==document.body&&p.length<4;e=e.parentElement)p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:e.classList[0]?'.'+e.classList[0]:''));return p.join(' > ');};
  const kind=(n,el)=>el.closest('[lang="ko"]')?'orig':n&&n.nextSibling?.classList?.contains('i18n-ko')?'ko':'left';
  const walk=n=>{if(n.nodeType===3){const t=norm(n.nodeValue);if(t){out.push(t);if(en&&H.test(t))hangul.push({kind:kind(n,n.parentElement),text:t.slice(0,160),at:where(n.parentElement)});}return;}if(n.nodeType!==1||SKIP.has(n.tagName)||n.classList.contains('lang-switch'))return;
    for(const a of A)if(n.hasAttribute(a)){const v=norm(n.getAttribute(a));if(v){out.push('@'+a+'='+v);if(en&&H.test(v))hangul.push({kind:n.closest('[lang="ko"]')?'orig':'left',text:'@'+a+'='+v.slice(0,160),at:where(n)});}}
    if(n.tagName==='A'&&n.hasAttribute('href')){let h=n.getAttribute('href');try{const u=new URL(h,location.href);if(u.origin===location.origin){u.searchParams.delete('lang');h=u.pathname+u.search+u.hash;}}catch{}hrefs.push(h);}
    for(const c of n.childNodes)walk(c);};
  for(const r of document.querySelectorAll(sel))walk(r);return en?{lines:out,hrefs,hangul}:{lines:out,hrefs};})`;
// 같은 종 상세의 점수(라): 화면 데이터에서 직접 읽는다(글자가 아니라 값).
const SCORES=`(a=>{const s=data.species.find(x=>x.aphiaID===a);return {scores:Object.fromEntries(['BBVI','MCUI','MBPI','MFPI'].map(k=>[k,(v=>v===null?null:scoreValue(s,k,v))(pilotScore(s,k))])),cells:spatialCells(s).length,records:cellRecords(s)};})`;

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'i18n-'));
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws,id=0;const pending=new Map();
async function connect(){for(let i=0;i<300;i++){try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  if(port>0){const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}}catch{}await sleep(200);}
  throw Error('Chrome DevTools endpoint timeout');}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},20000);pending.set(i,{res,rej,timer});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
const until=async(e,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await evaluate(e))return true;}catch{}await sleep(200);}return false;};
// 바깥 요청 막기: 같은 출처만 통과, Supabase 목록은 저장 사본으로 답, 나머지는 실패로 돌려준다.
function onPaused(p){const u=p.request.url;
  if(u.startsWith(ORIGIN)||u.startsWith('data:'))return send('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  const k=u.includes('/rest/v1/species_profiles')?'profiles':u.includes('/rest/v1/species_map_cells')?'cells':'';
  if(k)return send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'},{name:'access-control-allow-origin',value:'*'}],body:Buffer.from(JSON.stringify(FX[k])).toString('base64')}).catch(()=>{});
  return send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
const screens={};
async function grab(name,sel){const r=await evaluate(EXTRACT+'('+JSON.stringify(sel)+')');screens[name]={...(screens[name]||{}),...r};}
const settle=async(ms=2500)=>{await sleep(ms);};
const loaded=()=>until("/연결됨|저장된 사본|불러오기 실패|연결 실패|Connected|snapshot/i.test(document.getElementById('connection-state')?.textContent||'')&&typeof data!=='undefined'&&!!data");
async function open(u){await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:u});await sleep(500);}
try{
  ws=new WebSocket(await connect());
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}else if(m.method==='Fetch.requestPaused')onPaused(m.params);};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Seoul'});
  // 시계 고정: 시작 시각만 정하고 흐름은 performance.now()를 따른다(타이머·애니메이션은 그대로 돈다).
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const T0=Date.parse('${CLOCK}'),p0=performance.now(),D=Date;
    class FD extends D{constructor(...a){a.length?super(...a):super(T0+performance.now()-p0);}static now(){return T0+performance.now()-p0;}}FD.parse=D.parse;FD.UTC=D.UTC;window.Date=FD;}`});

  // 1. 첫 화면(시작 화면): 처음 방문이라 지구본 로딩(8초)을 거친다.
  await open(q(URL0));
  await until("document.getElementById('site-gate')?.classList.contains('is-ready')||!document.documentElement.classList.contains('gate-on')",40000);
  await loaded();await settle(2500);
  await grab('gate','#site-gate');
  // 2. 탐색 지도: 들어가기를 눌러 지도로.
  await evaluate("document.getElementById('gate-enter')?.click();1");
  await until("!document.documentElement.classList.contains('gate-on')",15000);await settle(3000);
  await grab('explore','.header, main > .intro, #explore, footer');
  // 3. 종 상세 3종: 종 링크로 바로 열고, 근거 자세히 보기의 접이식을 모두 편다.
  for(const [ko,a] of SPECIES){
    await open(q(URL0+'?s='+a+'&v=explore'));await loaded();await settle(2500);
    await evaluate("document.getElementById('sp-cta')?.click();1");await settle(1200);
    await evaluate("document.querySelectorAll('#detail details, #side-panel details').forEach(d=>d.open=true);1");await settle(800);
    await grab('species-'+ko,'#side-panel, #ev-drawer');
    screens['species-'+ko].values=await evaluate(SCORES+'('+a+')');
  }
  // 4. 비교와 지표: 매트릭스, 데이터 표(자세히 줄을 모두 편 상태).
  await open(q(URL0+'?s=836033&v=compare'));await loaded();await settle(3000);
  await grab('compare-matrix','#compare');
  await evaluate("document.querySelector('[data-cmp-mode=table]')?.click();1");await settle(1500);
  await evaluate("document.querySelectorAll('#compare tr.cmp-more').forEach(r=>{r.hidden=false;r.querySelectorAll('details').forEach(d=>d.open=true)});1");await settle(800);
  await grab('compare-table','#compare');
  // 5. 근거와 방법: 접이식을 모두 편다.
  await open(q(URL0+'?s=836033&v=method'));await loaded();await settle(3000);
  await evaluate("document.querySelectorAll('#method details').forEach(d=>d.open=true);document.querySelectorAll('#method [aria-expanded=false]').forEach(b=>b.click());1");await settle(2000);
  await grab('method','#method');
  // 6. 사용법 안내 도우미를 연 상태.
  await open(q(URL0+'?s=836033&v=explore'));await loaded();await settle(2500);
  await evaluate("document.querySelector('.bbc-fab')?.click();1");await settle(2500);
  await grab('chatbot','.bbc');
  // 7. 바다 탐험.
  await open(q(URL0+'expedition.html'));await until("document.readyState==='complete'",20000);await settle(6000);
  await grab('expedition','body');
  const txt=Object.entries(screens).map(([k,v])=>`### ${k}\n`+v.lines.join('\n')).join('\n')+'\n';
  fs.writeFileSync(OUT,txt);
  if(JSON_OUT)fs.writeFileSync(JSON_OUT,JSON.stringify(screens,null,1));
  console.log(`${LANG}: ${Object.keys(screens).length} screens, ${Object.values(screens).reduce((n,v)=>n+v.lines.length,0)} lines -> ${OUT}`);
}finally{try{ws?.close();}catch{}chrome.kill();await sleep(300);try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
process.exit(0);
