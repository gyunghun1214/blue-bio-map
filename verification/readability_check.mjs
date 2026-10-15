// Readability check (2026-10-15, 개선 프롬프트 12/15): on the rendered pages, (1) list every English sentence (no Hangul,
// 4+ words) and say whether it sits in a lang block (lang="en", or "la" for scientific names), (2) count text elements
// drawn under the minimum size (12px, the --fs-min token), (3) on each screen, check that the first visible MFPI·MBPI·
// BBVI·MCUI carries its Korean name, (4) report page-wide horizontal overflow.
// dist/ served at 127.0.0.1:8765, then
//   node verification/readability_check.mjs [out folder] [--widths=375,768,1440] [--min=12]
// FIXTURE=dist/live-snapshot.json answers the two Supabase reads where they are blocked (as uicheck.mjs does).
// Exit 1 on any hit: text under the minimum, an English sentence outside a lang block, an unnamed first abbreviation,
// or horizontal overflow. The report
// (readability.json, english.txt) lists every hit with its page state and selector.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {collect} from './readability_probe.mjs';
const args=process.argv.slice(2),OUT=args.find(a=>!a.startsWith('--'))||'verification/ci-ui/readability';
const opt=k=>args.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const WIDTHS=(opt('widths')||'375,768,1440').split(',').map(Number),MIN=Number(opt('min')||12),BASE=process.env.BASE||'http://127.0.0.1:8765/';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});

const fixture=process.env.FIXTURE&&fs.readFileSync(process.env.FIXTURE,'utf8');
async function open(w,url){
  const page=await browser.newPage({viewport:{width:w,height:w<800?812:900},deviceScaleFactor:1});
  if(fixture)await page.addInitScript(`{const FX=${fixture};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+url);return {page,errors};
}
const openAll=page=>page.evaluate(()=>{for(const d of document.querySelectorAll('details'))d.open=true;});
const results=[];
async function measure(page,w,state,root='body'){
  const r=await page.evaluate(collect,[root,MIN]).catch(e=>({error:String(e),small:[],eng:[]}));
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  results.push({width:w,state,over,...r});
  console.log(`${w}px ${state}: ${r.small.length} under ${MIN}px, ${r.eng.length} English (${r.eng.filter(e=>!e.marked).length} unmarked), overflow ${over}px${r.error?' ERROR '+r.error:''}`);
}
const ready=page=>page.waitForFunction(()=>typeof data!=='undefined'&&data?.species?.length>0&&document.querySelector('#species-list .species-card'),null,{timeout:30000}).then(()=>page.waitForTimeout(500));

for(const w of WIDTHS){
  // entry screen (globe)
  {const {page}=await open(w,'');await page.waitForTimeout(1200);await measure(page,w,'entry','#site-gate');await page.close();}
  // explore: first screen, then every species' detail with every fold open
  {const {page}=await open(w,'#v=explore');await ready(page);await measure(page,w,'explore');
    if(w===WIDTHS[0])await page.screenshot({path:`${OUT}/${w}-explore.png`});
    const ids=await page.evaluate(()=>data.species.map(s=>s.aphiaID));
    for(const id of ids){await page.evaluate(id=>{selectSpecies(id);detailOpen=true;syncFolds();},id);await openAll(page);await page.waitForTimeout(60);
      await measure(page,w,`explore detail ${id}`,'#detail');}
    // status popover, filter fold, value legend
    await page.evaluate(()=>{document.getElementById('notice-chip')?.click();document.getElementById('value-info')?.click();});await openAll(page);await page.waitForTimeout(200);
    await measure(page,w,'explore popovers');
    // chatbot panel
    await page.evaluate(()=>document.querySelector('.bbc-fab')?.click());await page.waitForTimeout(400);
    await measure(page,w,'chatbot','#bbc-panel');
    await page.close();}
  // compare: first screen, every table row opened, all folds
  {const {page}=await open(w,'#v=compare');await ready(page);await page.waitForTimeout(400);await measure(page,w,'compare');
    if(w===WIDTHS[0])await page.screenshot({path:`${OUT}/${w}-compare.png`});
    await page.evaluate(()=>{for(const b of document.querySelectorAll('#comparison .cmp-more-btn[aria-expanded="false"]'))b.click();document.getElementById('cmp-open-more')?.click();});
    await openAll(page);await page.waitForTimeout(300);await measure(page,w,'compare rows open');
    await page.evaluate(()=>{setBasisPop(true);});await page.waitForTimeout(200);await measure(page,w,'compare basis');
    await page.close();}
  // method: first screen, then all folds open
  {const {page}=await open(w,'#v=method');await ready(page);await measure(page,w,'method');
    if(w===WIDTHS[0])await page.screenshot({path:`${OUT}/${w}-method.png`});
    await openAll(page);await page.waitForTimeout(300);await measure(page,w,'method folds open');await page.close();}
  // sea expedition page
  {const {page}=await open(w,'expedition.html');await page.waitForTimeout(2500);await openAll(page);await measure(page,w,'expedition');await page.close();}
}
await browser.close();

// summary: unique English sentences (marked or not) and unique small elements per width
const eng=new Map();for(const r of results)for(const e of r.eng){const k=e.text;if(!eng.has(k))eng.set(k,{...e,states:new Set()});eng.get(k).states.add(r.state.replace(/ \d+$/,''));}
const unmarked=[...eng.values()].filter(e=>!e.marked),small=new Map();
for(const r of results)for(const s of r.small){const k=r.width+' '+s.sel;if(!small.has(k))small.set(k,{width:r.width,...s,state:r.state});}
// abbreviations: on each screen's first state, the first visible use of each index carries its Korean name
const abbrBad=results.filter(r=>!/ (detail|rows|basis|popovers|folds|chatbot)/.test(r.state)).flatMap(r=>Object.entries(r.abbr||{}).filter(([,v])=>!v.named).map(([k,v])=>({width:r.width,state:r.state,abbr:k,...v})));
const over=results.filter(r=>r.over>0).map(r=>({width:r.width,state:r.state,over:r.over}));
const summary={min:MIN,widths:WIDTHS,englishUnique:eng.size,englishUnmarked:unmarked.length,englishMarked:eng.size-unmarked.length,
  smallElements:Object.fromEntries(WIDTHS.map(w=>[w,results.filter(r=>r.width===w).reduce((a,r)=>a+r.small.length,0)])),smallUnique:small.size,abbrUnnamed:abbrBad,overflow:over};
fs.writeFileSync(`${OUT}/readability.json`,JSON.stringify({summary,english:[...eng.values()].map(e=>({...e,states:[...e.states]})),small:[...small.values()]},null,1));
fs.writeFileSync(`${OUT}/english.txt`,[...eng.values()].map(e=>`${e.marked?'[en]':'[--]'} ${e.text}\n      ${e.sel} · ${[...e.states].join(', ')}`).join('\n')+'\n');
console.log(JSON.stringify(summary));
process.exit(summary.smallUnique||summary.englishUnmarked||abbrBad.length||over.length?1:0);
