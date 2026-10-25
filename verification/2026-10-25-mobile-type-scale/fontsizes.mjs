// Font-size inventory (2026-10-25, 휴대폰 글자 크기 체계): every visible text element's computed font-size on the four
// screens (첫 화면, 탐색 지도, 비교와 지표, 근거와 방법), their opened states and the 멍이 guide panel, plus each state's text.
// dist/ served at 127.0.0.1:8765, then
//   node verification/2026-10-25-mobile-type-scale/fontsizes.mjs <out.json> [--width=390] [--height=844] [--shots=<folder>] [--rules]
// --text: also write each state's whole text next to the JSON (<out>-text.txt), to see what a changed hash changed.
// --all: every element with text, drawn or not (closed folds, popovers, other tabs), for finding rules; not for counting.
// --rules: for every text under 18px, also ask Chromium (CDP CSS.getMatchedStylesForNode) which rule sets its font-size,
// so a phone-only rule can copy that selector (mobile-type.css).
// FIXTURE=dist/live-snapshot.json answers the two Supabase reads where they are blocked (as uicheck.mjs does).
// A width up to 740 runs as a phone (touch, 2x, mobile viewport); wider runs as a PC.
// Each entry: state, selector path, computed font-size (px), drawn size for SVG text, first 40 letters of its own text.
// ::before/::after with letters in their content are listed too (td.cmp-val[data-k]::before and the like).
import {chromium} from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
const args=process.argv.slice(2),OUT=args.find(a=>!a.startsWith('--'));
const opt=k=>args.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const W=Number(opt('width')||390),H=Number(opt('height')||(W<=740?844:900)),SHOTS=opt('shots'),BASE=process.env.BASE||'http://127.0.0.1:8765/';
if(!OUT){console.error('usage: fontsizes.mjs <out.json> [--width=390]');process.exit(2);}
if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const phone=W<=740,RULES=args.includes('--rules'),ALL=args.includes('--all');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const fixture=process.env.FIXTURE&&fs.readFileSync(process.env.FIXTURE,'utf8');
async function open(url){
  const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone,reducedMotion:'reduce'});
  const page=await ctx.newPage();
  if(fixture)await page.addInitScript(`{const FX=${fixture};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+url);return {page,ctx,errors};
}
const ready=page=>page.waitForFunction(()=>typeof data!=='undefined'&&data?.species?.length>0&&document.querySelector('#species-list .species-card'),null,{timeout:30000}).then(()=>page.waitForTimeout(700));
const openAll=(page,root)=>page.evaluate(root=>{for(const d of document.querySelectorAll(root+' details'))d.open=true;},root);

// in-page: the inventory of one root
function inventory([root,tag,all]){
  const out=[];let q=0;const keys=new Map();
  // one element per selector path and size is asked about; the others copy its answer (e.qk)
  const mark=(el,e)=>{if(!tag||e.fs>=18||e.svg)return;const k=e.sel+'|'+e.fs;if(keys.has(k)){e.qk=keys.get(k);return;}el.setAttribute('data-fsq',q);keys.set(k,q);e.q=q++;};
  const clipped=new Map(),clips=e=>{if(!e||e===document.body)return false;if(clipped.has(e))return clipped.get(e);const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
    const v=((r.width<=1||r.height<=1)&&cs.overflow!=='visible')||clips(e.parentElement);clipped.set(e,v);return v;};
  const visible=el=>{if(all)return true;if(!el.getClientRects().length)return false;const r=el.getBoundingClientRect();if(r.width<=1&&r.height<=1)return false;
    const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0'&&!clips(el);};
  const sel=el=>{const p=[];for(let e=el;e&&e!==document.body&&p.length<4;e=e.parentElement)p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.classList.length?'.'+[...e.classList].filter(c=>!/^(selected|active|open|is-|hidden-label|far|above|below|left)/.test(c)).slice(0,2).join('.'):''));return p.join(' > ');};
  const drawn=el=>{const fs=parseFloat(getComputedStyle(el).fontSize);if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)return +(fs*Math.hypot(m.a,m.b)).toFixed(2);}return fs;};
  const seen=new Set();
  for(const r of document.querySelectorAll(root)){
    const tw=document.createTreeWalker(r,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    for(let n=tw.currentNode;n;n=tw.nextNode()){
      if(n.nodeType===1){
        const el=n;if(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName))continue;
        for(const ps of ['::before','::after']){const cs=getComputedStyle(el,ps),c=cs.content;
          if(c&&c!=='none'&&c!=='normal'&&/[A-Za-z가-힣0-9]/.test(c.replace(/^attr\(|counter\(/,''))&&cs.display!=='none'&&visible(el))
            {const e={sel:sel(el)+ps,fs:parseFloat(cs.fontSize),text:c.slice(0,40),pseudo:ps};if(tag&&!el.hasAttribute('data-fsq')&&e.fs<18){el.setAttribute('data-fsq',q);e.q=q++;}else if(el.hasAttribute('data-fsq'))e.q=+el.getAttribute('data-fsq');out.push(e);}}
        continue;
      }
      const t=n.nodeValue;if(!t.trim())continue;const el=n.parentElement;if(!el||seen.has(el)||['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName))continue;
      if(!visible(el))continue;seen.add(el);
      const e={sel:sel(el),fs:parseFloat(getComputedStyle(el).fontSize),text:t.trim().replace(/\s+/g,' ').slice(0,40)};
      if(el instanceof SVGElement){e.svg=true;e.drawn=drawn(el);}
      if(el.hasAttribute('data-fsq'))e.q=+el.getAttribute('data-fsq');else mark(el,e);
      out.push(e);
    }
  }
  return out;
}
// in-page: every letter under the roots (textContent, visible or not), and page overflow
const textOf=root=>[...document.querySelectorAll(root)].map(r=>{const c=r.cloneNode(true);c.querySelectorAll('script,style,noscript,template').forEach(x=>x.remove());return c.textContent.replace(/\s+/g,' ').trim();}).join('\n');
const states=[];
// The rule that gives each tagged element its font-size: the last matched rule declaring font-size (or font), !important
// first; none → the nearest ancestor's (inherited). Reports selector, media, file:line and the declared value.
async function findRules(page,items){
  const cdp=await page.context().newCDPSession(page);
  const sheets=new Map();cdp.on('CSS.styleSheetAdded',e=>sheets.set(e.header.styleSheetId,e.header.sourceURL));
  await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument',{depth:-1});
  const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'[data-fsq]'});
  const byQ=new Map();
  for(const nodeId of nodeIds){const {attributes}=await cdp.send('DOM.getAttributes',{nodeId});const i=attributes.indexOf('data-fsq');byQ.set(+attributes[i+1],nodeId);}
  const pick=rules=>{let best=null;for(const m of rules||[]){const st=m.rule.style;for(const pr of st.cssProperties){if(!['font-size','font'].includes(pr.name)||pr.disabled||pr.parsedOk===false||!pr.range&&m.rule.origin==='regular'&&!pr.value)continue;
      const imp=!!pr.important;if(!best||imp||!best.imp){if(best?.imp&&!imp)continue;
        const sel=m.matchingSelectors.map(i=>m.rule.selectorList.selectors[i].text).join(', ');
        best={imp,selector:sel,full:m.rule.selectorList.text,value:pr.value.replace(/\s*!important/,'')+(imp?' !important':''),origin:m.rule.origin,media:(m.rule.media||[]).map(x=>x.text).join(' & '),
          file:(sheets.get(m.rule.styleSheetId)||'').replace(/^.*\//,'').replace(/\?.*$/,''),line:st.range?st.range.startLine+1:null};}}}return best;};
  for(const it of items){if(it.q===undefined)continue;const nodeId=byQ.get(it.q);if(!nodeId)continue;
    const r=await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
    let w=null;
    if(it.pseudo){const pe=(r.pseudoElements||[]).find(p=>p.pseudoType===it.pseudo.slice(2));w=pick(pe?.matches);if(w)w.via='pseudo';}
    if(!w){w=pick(r.matchedCSSRules);if(r.inlineStyle?.cssProperties?.some(p=>p.name==='font-size'&&p.value))w={selector:'(inline style)',value:r.inlineStyle.cssProperties.find(p=>p.name==='font-size').value};}
    if(!w)for(const [d,inh] of (r.inherited||[]).entries()){w=pick(inh.matchedCSSRules);if(w){w.via='inherited '+(d+1);break;}}
    it.rule=w;}
  const byQ2=new Map(items.filter(i=>i.q!==undefined&&!i.pseudo).map(i=>[i.q,i.rule]));for(const it of items)if(it.qk!==undefined)it.rule=byQ2.get(it.qk);
  await cdp.detach();
}
async function measure(page,state,root,shot){
  await page.evaluate(()=>document.querySelectorAll('[data-fsq]').forEach(e=>e.removeAttribute('data-fsq')));
  const items=await page.evaluate(inventory,[root,RULES,ALL]);
  if(RULES)await findRules(page,items);
  const text=await page.evaluate(textOf,root);
  const over=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,iw:innerWidth}));
  states.push({state,root,overflow:over,textSha:crypto.createHash('sha256').update(text).digest('hex').slice(0,16),textLength:text.length,items});
  if(SHOTS&&shot)await page.screenshot({path:`${SHOTS}/${W}-${shot}.png`,fullPage:true});
  console.log(`${W}px ${state}: ${items.length} text elements, overflow ${over.sw-over.cw}px, innerWidth ${over.iw}`);
  return text;
}
const texts={};

// 1 entry screen: a fresh visit runs the 8 s intro; wait until it can be entered
{const {page,ctx}=await open('');
  await page.waitForFunction(()=>document.getElementById('site-gate')?.classList.contains('is-ready'),null,{timeout:30000});await page.waitForTimeout(800);
  texts.entry=await measure(page,'entry','#site-gate','entry');await ctx.close();}
// 2 explore: first screen, popovers, one species' detail with every fold open
{const {page,ctx}=await open('#v=explore');await ready(page);
  texts.explore=await measure(page,'explore','body','explore');
  await page.evaluate(()=>{document.getElementById('notice-chip')?.click();document.getElementById('value-info')?.click();});await openAll(page,'#explore');await page.waitForTimeout(300);
  await measure(page,'explore popovers','body');
  await page.evaluate(()=>{document.getElementById('notice-chip')?.click();document.getElementById('value-info')?.click();document.querySelectorAll('#explore details').forEach(d=>d.open=false);});
  const id=await page.evaluate(()=>data.species[0].aphiaID);
  await page.evaluate(id=>{selectSpecies(id);detailOpen=true;syncFolds();},id);await openAll(page,'#detail');await page.waitForTimeout(500);
  texts.detail=await measure(page,'explore detail','body','explore-detail');
  // 멍이 guide panel
  await page.evaluate(()=>document.querySelector('.bbc-fab')?.click());await page.waitForTimeout(500);
  await measure(page,'guide panel','#bbc-panel');
  await ctx.close();}
// 3 compare: matrix first screen, a selected species with two in the basket, the table with every row open, the basis popover
{const {page,ctx}=await open('#v=compare');await ready(page);await page.waitForTimeout(500);
  texts.compare=await measure(page,'compare','body','compare');
  if(SHOTS)await page.locator('#compare .matrix-wrap, #compare .matrix').first().screenshot({path:`${SHOTS}/${W}-matrix-none.png`}).catch(()=>{});
  // another species than the one selected on load (참굴), and one more in the basket
  const ids=await page.evaluate(()=>data.species.filter(s=>document.querySelector(`#matrix-points .matrix-point[data-aphia="${s.aphiaID}"]:not([data-clustered]):not([aria-current])`)).slice(0,2).map(s=>s.aphiaID));
  await page.evaluate(ids=>{pickCompare(ids[0]);toggleBasket(ids[0]);toggleBasket(ids[1]);},ids);await page.waitForTimeout(600);
  texts.compareSel=await measure(page,'compare selected','body');
  if(SHOTS)await page.locator('#compare .matrix-wrap, #compare .matrix').first().screenshot({path:`${SHOTS}/${W}-matrix-selected.png`}).catch(()=>{});
  await page.evaluate(()=>{setCompareMode('table');});await page.waitForTimeout(400);
  await page.evaluate(()=>{for(const b of document.querySelectorAll('#comparison .cmp-more-btn[aria-expanded="false"]'))b.click();document.getElementById('cmp-open-more')?.click();});
  await openAll(page,'#compare');await page.waitForTimeout(400);
  texts.compareTable=await measure(page,'compare table open','body','compare-table');
  await page.evaluate(()=>{setBasisPop(true);});await page.waitForTimeout(300);await measure(page,'compare basis','body');
  await ctx.close();}
// 4 method: first screen, every fold open
{const {page,ctx}=await open('#v=method');await ready(page);
  texts.method=await measure(page,'method','body','method');
  await openAll(page,'#method');await page.waitForTimeout(400);texts.methodOpen=await measure(page,'method folds open','body','method-open');
  await ctx.close();}
await browser.close();

// counts by size (non-SVG), and by selector and size
const count={},bySel={};
for(const s of states)for(const i of s.items){if(i.svg)continue;const k=String(i.fs);count[k]=(count[k]||0)+1;const key=i.sel.split(' > ').slice(-2).join(' > ')+' | '+i.fs;bySel[key]=(bySel[key]||0)+1;}
fs.writeFileSync(OUT,JSON.stringify({width:W,height:H,phone,base:BASE,date:new Date().toISOString(),count,bySel,states}));
if(args.includes('--text'))fs.writeFileSync(OUT.replace(/\.json$/,'-text.txt'),Object.entries(texts).map(([k,v])=>`## ${k}\n${v}`).join('\n\n')+'\n');
console.log(JSON.stringify(count));
