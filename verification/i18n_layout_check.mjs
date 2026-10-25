// Text layout check for the English screen (2026-10-25): headless Chrome via DevTools (no deps), like uicheck.mjs.
// Both languages, three sizes (1440×900, 1280×720 presentation, 390×844 phone with touch), screens: entry (#site-gate),
// explore (one species picked, detail open), compare (matrix, data table, side by side), method (every <details> open),
// expedition.html. Counted per screen:
//   (가) overlap: visible text boxes (Range rects of text nodes) of two different nodes overlapping more than 4px both ways;
//       matrix dots count as boxes too (a dot over a quadrant name hides letters)
//   (나) clipped: overflow hidden/clip or ellipsis boxes whose text is wider than the box (allow-listed scrollers excepted)
//   (다) off screen: text past the right edge of the window, or the page scrolls sideways
//   (라) broken word: a text node takes more lines than it has words (a word was split, e.g. '0– / 100 / scale')
//   (마) English wording: no space before '(' ('LC(Least Concern)') or Korean corner quotes 「」『』 in English text
//   (차) English species names: see namesCheck below
//   (가′) text under a fixed bar or a panel over the map: listed, never failed
// Not counted: .sr-only, visibility:hidden, opacity 0, matrix .hidden-label, closed <details>, KO-marked originals.
// Usage: node verification/i18n_layout_check.mjs <output-directory> [--report]   (site served at URL0, default http://127.0.0.1:8765/)
//   --report: print and save the counts, never fail. Without it: English (가)(다)(마) must be 0 and Korean counts must not
//   grow past verification/i18n-layout-ko-baseline.json.
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {fileURLToPath} from 'node:url';
const OUT=process.argv[2], REPORT=process.argv.includes('--report');
if(!OUT||OUT.startsWith('--'))throw Error('Usage: node verification/i18n_layout_check.mjs <output-directory> [--report]');
fs.mkdirSync(OUT,{recursive:true});
const HERE=path.dirname(fileURLToPath(import.meta.url));
const BASE=path.join(HERE,'i18n-layout-ko-baseline.json');
const URL0=process.env.URL0||'http://127.0.0.1:8765/';
const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cdp-'));
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0','--no-first-run','--disable-gpu','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,chromeFailure=null,chromeStderr='';const pending=new Map();
chrome.stderr.on('data',c=>{chromeStderr=(chromeStderr+c).slice(-4000);});
chrome.on('exit',code=>{chromeFailure=Error(`Chrome exited ${code}`);for(const p of pending.values())p.rej(chromeFailure);pending.clear();});
async function connect(){
  for(let i=0;i<300;i++){
    if(chromeFailure)throw Error(chromeFailure.message+' '+chromeStderr.slice(-800));
    try{const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
      if(port>0){const t=await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json();const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl;}}catch{}
    await sleep(200);
  }
  throw Error('Chrome DevTools endpoint timeout');
}
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id,timer=setTimeout(()=>{pending.delete(i);rej(Error(method+': timeout'));},30000);pending.set(i,{res,rej,timer});ws.send(JSON.stringify({id:i,method,params}));});
async function openWebSocket(url){ws=new WebSocket(url);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=()=>no(Error('WebSocket error'));});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.rej(Error(m.error.message)):p.res(m.result);}};}
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
async function viewport(w,h,mobile){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',mobile?{enabled:true,maxTouchPoints:1}:{enabled:false});}
async function until(expr,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await evaluate(expr).catch(()=>false))return true;await sleep(250);}return false;}
async function shot(name){if(!want(name.split('-').slice(2).join('-')))return;const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.data,'base64'));}

// Scrollers people swipe through on purpose: wider text there is not clipped (나).
const SCROLLERS=['.species-list','.use-chips','.cmp-groups','.chips','.mt-chips','#all-sources','.table-wrap','.cmp-table-wrap','.mt-nat-wrap','.mt-ck-wrap','.leaflet-pane'];
// Runs in the page: measures the text under the given roots.
const collect=`((roots,scrollers)=>{
  const SKIP='.sr-only,script,style,noscript,template,.hidden-label,.i18n-ko,svg,title,option,select,textarea,input';
  const vw=innerWidth, sx=scrollX, sy=scrollY, out={overlap:[],under:[],clip:[],off:[],broken:[],wording:[]};
  const seen=(el)=>{for(let e=el;e&&e.nodeType===1;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||e.hidden||e.inert)return false;
    if(e.tagName==='DETAILS'&&!e.open&&!el.closest('summary'))return false;}return true;};
  const sel=e=>{const p=[];for(let x=e;x&&x.nodeType===1&&p.length<4;x=x.parentElement){p.unshift(x.tagName.toLowerCase()+(x.id?'#'+x.id:'')+(x.classList.length?'.'+[...x.classList].slice(0,2).join('.'):''));if(x.id)break;}return p.join(' > ');};
  // visible part of a rect after every clipping ancestor
  const clipOf=(el,r)=>{let a={l:r.left,t:r.top,r:r.right,b:r.bottom};for(let e=el.parentElement;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);
      if(s.overflowX!=='visible'||s.overflowY!=='visible'){const c=e.getBoundingClientRect();if(s.overflowX!=='visible'){a.l=Math.max(a.l,c.left);a.r=Math.min(a.r,c.right);}if(s.overflowY!=='visible'){a.t=Math.max(a.t,c.top);a.b=Math.min(a.b,c.bottom);}}}
    return a.r-a.l>1&&a.b-a.t>1?a:null;};
  const inScroller=el=>{for(let e=el.parentElement;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(/auto|scroll/.test(s.overflowX)&&e.scrollWidth>e.clientWidth+1)return true;}return false;};
  const blockOf=e=>e.closest('h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,button,a,label,figcaption')||(()=>{for(let x=e;x;x=x.parentElement)if(!/^inline/.test(getComputedStyle(x).display))return x;return null;})();
  const pinned=e=>{for(let x=e;x;x=x.parentElement){const p=getComputedStyle(x).position;if(p==='fixed'||p==='sticky')return x;}return null;};
  const onMap=e=>!!e.closest('.leaflet-map-pane');
  const boxes=[], nodes=[];
  for(const root of roots.map(s=>document.querySelector(s)).filter(Boolean)){
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let n=w.nextNode();n;n=w.nextNode()){
      const t=n.nodeValue.replace(/\\s+/g,' ').trim(), el=n.parentElement;if(!t||!el||el.closest(SKIP)||!seen(el))continue;
      const eb=el.getBoundingClientRect();if(eb.width<=2||eb.height<=2)continue; // visually hidden (1px clip) text
      const rg=document.createRange();rg.selectNodeContents(n);
      const rs=[...rg.getClientRects()].filter(r=>r.width>1&&r.height>1);if(!rs.length)continue;
      const lines=new Set(rs.map(r=>Math.round(r.top/4))).size, words=t.split(' ').length;
      nodes.push({n,el,t,rs});
      if(lines>words&&t.length>1)out.broken.push({sel:sel(el),text:t.slice(0,80),lines});
      let cut=0;
      for(const r of rs){const v=clipOf(el,r);if(!v)continue;boxes.push({...v,k:nodes.length-1});
        if((v.r<r.right-2||v.l>r.left+2)&&!inScroller(el))cut=Math.max(cut,Math.round(r.right-v.r+v.l-r.left));
        if(v.r>vw+1&&!inScroller(el))out.off.push({sel:sel(el),text:t.slice(0,80),over:Math.round(v.r-vw)});}
      // covered: an opaque box that is not part of this text lies over the start, middle or end of a line
      // (a panel over map buttons, a chip over a line); scrolled under a fixed bar or panned under a panel is (가′)
      const v0=clipOf(el,rs[0]);if(v0&&!onMap(el)&&getComputedStyle(el).pointerEvents!=='none'){
        for(const x of [v0.l+3,(v0.l+v0.r)/2,v0.r-3]){const y=(v0.t+v0.b)/2;if(x<0||y<0||x>vw||y>innerHeight)continue;
          const top=document.elementFromPoint(x,y);if(!top||top===el||el.contains(top)||top.contains(el))continue;
          const bg=getComputedStyle(top).backgroundColor.split(/[(),]/).filter(x=>x.trim()).map(Number).filter(n=>!isNaN(n)),a=bg.length>3?bg[3]:bg.length?1:0;
          if(a<.5&&!top.textContent.trim())continue;
          (pinned(top)!==pinned(el)?out.under:out.overlap).push({sel:sel(el)+'  ⊂  '+sel(top),text:t.slice(0,50)+'  (covered)',px:Math.round(x)+','+Math.round(y)});break;}}
      // cut sideways by a box or the page edge it sits in (the box itself has no ellipsis)
      if(cut&&!el.closest(scrollers.join(',')))out.clip.push({sel:sel(el),text:t.slice(0,80),title:!!el.closest('[title]'),cut});
      // original citations and titles keep their own spelling; a corner quote around a KO-marked original stays
      if(document.documentElement.lang==='en'&&!/[ㄱ-ㆎ가-힣]/.test(t)&&!el.closest('[lang]:not([lang="en"]),#all-sources,.citation,cite')){
        const ko=el.querySelector('.i18n-ko,[lang="ko"]')||n.previousSibling?.classList?.contains?.('i18n-ko')||n.nextSibling?.nodeType===1&&/[ㄱ-ㆎ가-힣]/.test(n.nextSibling.textContent);
        const m=t.match(ko?/[A-Za-z0-9]\\((?=[A-Za-z])/:/[A-Za-z0-9]\\((?=[A-Za-z])|[「」『』]/);if(m)out.wording.push({sel:sel(el),text:t.slice(Math.max(0,m.index-30),m.index+40)});}
    }
  }
  // matrix dots stand in the way of text too: each dot is a box of its own (a dot and its own label, or two dots, are not counted)
  for(const root of roots.map(s=>document.querySelector(s)).filter(Boolean))for(const b of root.querySelectorAll('.matrix-point')){
    if(!seen(b))continue;const r=b.getBoundingClientRect();if(r.width<2)continue;const v=clipOf(b,r);if(!v)continue;
    nodes.push({el:b,t:'● '+(b.getAttribute('aria-label')||'').slice(0,40),rs:[r],dot:true});boxes.push({...v,k:nodes.length-1});}
  // (가) sweep by top
  boxes.sort((a,b)=>a.t-b.t);
  const pairs=new Set();
  for(let i=0;i<boxes.length;i++){const a=boxes[i];for(let j=i+1;j<boxes.length&&boxes[j].t<a.b-4;j++){const b=boxes[j];if(a.k===b.k)continue;
    const ox=Math.min(a.r,b.r)-Math.max(a.l,b.l), oy=Math.min(a.b,b.b)-Math.max(a.t,b.t);if(ox<=4||oy<=4)continue;
    const A=nodes[a.k],B=nodes[b.k];
    if(A.dot&&B.dot||A.dot&&A.el.contains(B.el)||B.dot&&B.el.contains(A.el))continue;
    // lines of one heading with a tight line-height touch by their font boxes, not by their letters
    if(blockOf(A.el)===blockOf(B.el)&&oy<.35*Math.min(a.b-a.t,b.b-b.t))continue;
    const key=Math.min(a.k,b.k)+':'+Math.max(a.k,b.k);if(pairs.has(key))continue;pairs.add(key);
    // content scrolled under a fixed or sticky bar, and map labels panned under a panel, are counted apart (가′):
    // reported, not failed (the guide bubble over a card is such a case and is checked by eye)
    const under=pinned(A.el)!==pinned(B.el)||onMap(A.el)!==onMap(B.el);
    (under?out.under:out.overlap).push({sel:sel(A.el)+'  ×  '+sel(B.el),text:A.t.slice(0,50)+'  ×  '+B.t.slice(0,50),px:Math.round(ox)+'×'+Math.round(oy)});}}
  // (나) clipped boxes with their own text
  for(const root of roots.map(s=>document.querySelector(s)).filter(Boolean))for(const e of [root,...root.querySelectorAll('*')]){
    if(e.closest(SKIP)||e.closest(scrollers.join(','))&&!e.matches('input'))continue;
    const s=getComputedStyle(e);if(!(s.textOverflow==='ellipsis'||/hidden|clip/.test(s.overflowX)))continue;
    if(![...e.childNodes].some(c=>c.nodeType===3&&c.nodeValue.trim())&&!e.matches('[placeholder]'))continue;
    if(e.getBoundingClientRect().width>1&&e.scrollWidth>e.clientWidth+1&&seen(e))out.clip.push({sel:sel(e),text:(e.textContent||e.placeholder||'').replace(/\\s+/g,' ').trim().slice(0,80),title:!!e.title});}
  const ph=[...document.querySelectorAll('input[placeholder]')].filter(e=>seen(e)&&roots.some(r=>e.closest(r)));
  for(const e of ph){const c=document.createElement('canvas').getContext('2d'),s=getComputedStyle(e);c.font=s.font;
    const room=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);if(c.measureText(e.placeholder).width>room+1)out.clip.push({sel:sel(e),text:e.placeholder,title:!!e.title});}
  return {...out,doc:document.documentElement.scrollWidth,vw};
})`;

// (차) English names (en only): a picked common name shows with its scientific name on the explore cards, and alone on the
// matrix labels and type chips (the scientific name is in their title). Species without a common name are named by the scientific name.
const namesCheck=where=>evaluate(`(()=>{const bad=[],common=data.species.filter(s=>s.enName);
  if('${where}'==='explore')for(const s of common){const c=document.querySelector('[data-species="'+s.aphiaID+'"]');if(c&&!(c.textContent.includes(s.enName)&&c.textContent.includes(s.name)))bad.push({sel:'[data-species="'+s.aphiaID+'"]',text:c.textContent.replace(/\\s+/g,' ').trim().slice(0,90)});}
  else for(const s of common)for(const e of document.querySelectorAll('.matrix-point[data-aphia="'+s.aphiaID+'"] .point-label,.mt-chip[data-aphia="'+s.aphiaID+'"]'))
    if(e.textContent.includes(s.name)||!e.textContent.includes(s.enName))bad.push({sel:e.className,text:e.textContent.replace(/\\s+/g,' ').trim().slice(0,90)});
  return bad;})()`);
// While fixing: LANGS=en SIZES=1280x720 SCREENS=gate,explore limit the run (the full run is the check)
const LANGS=(process.env.LANGS||'en,ko').split(','), ONLY_SIZE=process.env.SIZES?.split(','), ONLY=process.env.SCREENS?.split(','), want=x=>!ONLY||ONLY.includes(x);
const SIZES=[[1440,900,false,'1440'],[1280,720,false,'1280x720'],[390,844,true,'390']];
const rows=[], counts={};
const add=(lang,size,screen,r)=>{
  if(!want(screen))return;
  const c={overlap:r.overlap.length,under:r.under.length,names:(r.names||[]).length,clip:r.clip.length,off:r.off.length+(r.doc>r.vw+1?1:0),broken:r.broken.length,wording:r.wording.length};
  counts[`${lang} ${size} ${screen}`]=c;
  for(const k of ['overlap','under','clip','off','broken','wording','names'])for(const x of r[k]||[])rows.push({lang,size,screen,kind:k,...x});
  if(r.doc>r.vw+1)rows.push({lang,size,screen,kind:'off',sel:'html',text:`page scrolls sideways: ${r.doc} > ${r.vw}`});
  console.log(`${lang} ${size} ${screen}: (가)${c.overlap} (가′)${c.under} (나)${c.clip} (다)${c.off} (라)${c.broken} (마)${c.wording}${lang==='en'?` (차)${c.names}`:''}`);
};
const measure=roots=>evaluate(`(${collect})(${JSON.stringify(roots)},${JSON.stringify(SCROLLERS)})`);
const HEAD=['.header'];
const t0=Date.now();
let failed=false;
try{
  await openWebSocket(await connect());
  await send('Page.enable');await send('Runtime.enable');
  if(process.env.FIXTURE){
    const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    const reply=k=>`Promise.resolve(new Response(JSON.stringify(FX.${k}),{status:200,headers:{'content-type':'application/json'}}))`;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const FX=${fx};window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return ${reply('profiles')};if(s.includes('/rest/v1/species_map_cells'))return ${reply('cells')};return o(u,...a);})(window.fetch);}`});
  }
  // the entry screen runs its 8 s first-visit piece each time it is shown
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{sessionStorage.removeItem('bbvm-intro-entered')}catch{}"});
  for(const lang of LANGS)for(const [w,h,mobile,size] of SIZES.filter(z=>!ONLY_SIZE||ONLY_SIZE.includes(z[3]))){
    await viewport(w,h,mobile);
    await send('Page.navigate',{url:'about:blank'});
    await send('Page.navigate',{url:`${URL0}?lang=${lang}`});
    await until("typeof data!=='undefined'&&!!data?.species?.length&&document.readyState==='complete'",40000);
    if(await evaluate("document.documentElement.classList.contains('gate-on')")){
      await until("document.getElementById('site-gate').classList.contains('is-ready')",30000);await sleep(600);
      add(lang,size,'gate',await measure(['#site-gate']));await shot(`${lang}-${size}-gate`);
      await evaluate("document.getElementById('gate-enter').click();1");await sleep(1200);
    }
    // explore: first listed species, detail folds open
    await evaluate(`(async()=>{setView('explore');await new Promise(r=>setTimeout(r,500));document.querySelector('[data-species]')?.click();await new Promise(r=>setTimeout(r,900));
      document.querySelectorAll('#detail details').forEach(d=>d.open=true);1})()`);await sleep(500);
    add(lang,size,'explore',{...await measure([...HEAD,'#explore']),names:lang==='en'?await namesCheck('explore'):[]});await shot(`${lang}-${size}-explore`);
    // compare: matrix, data table, side by side (three species)
    await evaluate("(async()=>{setView('compare');setCompareMode('matrix');await new Promise(r=>setTimeout(r,1200));1})()");
    add(lang,size,'compare-matrix',{...await measure([...HEAD,'#compare']),names:lang==='en'?await namesCheck('compare'):[]});await shot(`${lang}-${size}-compare-matrix`);
    await evaluate("(async()=>{setCompareMode('table');await new Promise(r=>setTimeout(r,900));1})()");
    add(lang,size,'compare-table',await measure([...HEAD,'#compare']));await shot(`${lang}-${size}-compare-table`);
    const opened=await evaluate(`(async()=>{setCompareMode('matrix');await new Promise(r=>setTimeout(r,600));cmpBasket=[];
      for(const s of data.species.filter(s=>pilotScore(s,'BBVI')!==null).slice(0,3))toggleBasket(s.aphiaID);
      const ok=openCompareDialog();await new Promise(r=>setTimeout(r,900));return !!ok;})()`);
    if(opened){add(lang,size,'compare-side',await measure(['#cmp-dialog']));await shot(`${lang}-${size}-compare-side`);
      await evaluate("document.getElementById('cmp-dialog').close();cmpBasket=[];1");}
    // method: every fold open
    await evaluate(`(async()=>{setView('method');await new Promise(r=>setTimeout(r,700));document.querySelectorAll('#method details').forEach(d=>d.open=true);await new Promise(r=>setTimeout(r,500));1})()`);
    add(lang,size,'method',await measure([...HEAD,'#method','footer']));await shot(`${lang}-${size}-method`);
    // sea expedition page
    if(want('expedition')){await send('Page.navigate',{url:`${URL0}expedition.html?lang=${lang}`});
    await until("document.readyState==='complete'&&!document.body.classList.contains('is-loading')",40000);await sleep(2500);
    add(lang,size,'expedition',await measure(['body']));await shot(`${lang}-${size}-expedition`);}
  }
  await evaluate("try{localStorage.removeItem('lang')}catch{};1");
}catch(e){console.error('Harness',e.stack);failed=true;}
finally{
  const secs=Math.round((Date.now()-t0)/1000);
  const sum=(lang,k)=>Object.entries(counts).filter(([n])=>n.startsWith(lang+' ')).reduce((a,[,c])=>a+c[k],0);
  const total={};for(const lang of ['en','ko'])total[lang]=Object.fromEntries(['overlap','under','clip','off','broken','wording','names'].map(k=>[k,sum(lang,k)]));
  fs.writeFileSync(path.join(OUT,'i18n-layout.json'),JSON.stringify({seconds:secs,total,counts,rows},null,1));
  const md=['| 언어 | 크기 | 화면 | 종류 | 선택자 | 글자 |','|---|---|---|---|---|---|',
    ...rows.map(r=>`| ${r.lang} | ${r.size} | ${r.screen} | ${r.kind} | \`${String(r.sel).replace(/\|/g,'¦')}\` | ${String(r.text).replace(/\|/g,'¦')}${r.px?` (${r.px})`:''}${r.title===false?' (title 없음)':''} |`)];
  fs.writeFileSync(path.join(OUT,'i18n-layout.md'),`# 영어 화면 글자 배치 검사\n\n${JSON.stringify(total)} · ${secs}s\n\n${md.join('\n')}\n`);
  console.log('Total',JSON.stringify(total),`${secs}s`);
  if(!REPORT&&!failed){
    const e=total.en;if(e.overlap||e.off||e.wording||e.names){console.log(`FAIL English (가)${e.overlap} (다)${e.off} (마)${e.wording} (차)${e.names} must be 0`);failed=true;}
    if(fs.existsSync(BASE)){const b=JSON.parse(fs.readFileSync(BASE,'utf8'));
      for(const [k,v] of Object.entries(total.ko))if(v>(b[k]??0)){console.log(`FAIL Korean ${k} ${v} > baseline ${b[k]}`);failed=true;}}
  }
  ws?.close();chrome.kill();
  process.exitCode=failed?1:0;
}
