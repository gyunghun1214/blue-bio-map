// Every index number the screen shows for the 30 species, read from the rendered pages of one local server (LKH 9/10,
// 2026-10-19): node capture.mjs <base url> <out.json>. Run it once on main and once on this branch (python3 -m http.server
// in dist/ on two ports), then python3 table.py before.json after.json table.md. Needs Playwright (npm i playwright, or a
// global one with NODE_PATH set); the published rows come from dist/live-snapshot.json, outside hosts are cut off.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'); // require() so NODE_PATH reaches a global install
const [base,outFile]=process.argv.slice(2);
const FIX=new URL('../../../dist/live-snapshot.json',import.meta.url);
async function openPage(browser,url){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'ko-KR'});
  const page=await ctx.newPage(), fx=JSON.parse(fs.readFileSync(FIX,'utf8'));
  await page.route(/\/rest\/v1\/species_profiles/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fx.profiles)}));
  await page.route(/\/rest\/v1\/species_map_cells/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fx.cells)}));
  await page.route(u=>!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u.toString())&&!/\/rest\/v1\//.test(u.toString()),r=>r.abort());
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  return {page,errors};
}
const browser=await chromium.launch({headless:true});
const {page,errors}=await openPage(browser,base);
await page.waitForSelector('#site-gate.is-ready',{timeout:40000});await page.keyboard.press('Enter');
await page.waitForFunction(()=>!document.documentElement.classList.contains('gate-on'),null,{timeout:20000});
await page.waitForFunction(()=>typeof data!=='undefined'&&data?.species?.length>0,null,{timeout:40000});
await page.waitForTimeout(800);
const rows=await page.evaluate(()=>{
  const P=h=>{const d=document.createElement('div');d.innerHTML=h;return d;};
  const t=x=>x?.textContent.replace(/\s+/g,' ').trim()??null;
  const rows={};
  for(const s of data.species){
    const r=rows[s.label]={aphia:s.aphiaID};
    const card=document.querySelector(`#species-list [data-species="${s.aphiaID}"]`);
    r.card=card?[...card.querySelectorAll('.card-line .cl-v b')].map(t):null;           // [활용 BBVI, 보전 MCUI]
    r.cardTitle=card?[...card.querySelectorAll('.card-line .cl-v')].map(x=>x.title):null;
    r.chips=card?[...card.querySelectorAll('.card-scores i')].map(t):null;
    const ax=P(axisCards(s));
    r.detail=[...ax.querySelectorAll('.ax-num, .ax-sub strong')].map(t);
    r.valueType=t(P(valueSpeciesType(s)));
    r.sens=t(P(weightSensitivityLine(s)).querySelector('.ax-sens'));
    r.rxDetail=t(P(mbpiRxLine(s)).querySelector('summary b'));
    selected=s;renderCompareProfile();
    r.profile=[...document.querySelectorAll('#cmp-profile .cp-sub-num, #cmp-profile .cp-main-num, #cmp-profile .cp-num, #cmp-profile .cp-rx-num')].map(t);
    r.profileText=t(document.querySelector('#cmp-profile'));
    r.type=matrixType(s);r.officialType=officialType(s);
    r.published=['MFPI','MBPI','MCUI','BBVI'].map(k=>s.assessment?.scores?.[k]);
  }
  renderComparison();
  for(const tr of document.querySelectorAll('#comparison tr.cmp-row')){
    const s=data.species.find(x=>x.aphiaID===+tr.dataset.aphia);
    rows[s.label].table=['MFPI','MBPI','BBVI','MCUI'].map(k=>t(tr.querySelector(`td.cmp-val[data-k="${k}"] .cv-num`)));
    rows[s.label].rx=t(tr.querySelector('td.cmp-rx .cv-num'));
    const more=document.getElementById('cmp-more-'+s.aphiaID);
    rows[s.label].bbviBox=t(more?.querySelector('.dt-x-sum'));
  }
  return rows;
});
// the matrix (compare view)
await page.evaluate(()=>{location.hash='v=compare';});
await page.waitForTimeout(1500);
const matrix=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#matrix-points button[data-aphia]')].map(b=>[data.species.find(x=>x.aphiaID===+b.dataset.aphia).label,b.title])));
for(const [k,v] of Object.entries(matrix))rows[k].matrix=v;
// the sea expedition's card list
const ex=await openPage(browser,base.replace(/\/?$/,'/')+'expedition.html#view=cards');
await ex.page.waitForSelector('#cards-list .x-card',{timeout:30000});
const cards=await ex.page.evaluate(()=>[...document.querySelectorAll('#cards-list .x-card')].map(c=>({name:c.querySelector('.x-name')?.textContent.trim(),
  v:Object.fromEntries([...c.querySelectorAll('.x-score')].map(x=>[x.dataset.axis,x.querySelector('.x-val')?.textContent.replace(/\s+/g,' ').trim()]))})));
for(const c of cards)if(rows[c.name])rows[c.name].expedition=c.v;else rows['(exp) '+c.name]={expedition:c.v};
fs.writeFileSync(outFile,JSON.stringify(rows,null,1));
console.log(Object.keys(rows).length,'species',errors.length?'errors: '+errors.slice(0,3).join(' | '):'no page errors',ex.errors.length?'exp errors: '+ex.errors.slice(0,3).join(' | '):'');
await browser.close();
