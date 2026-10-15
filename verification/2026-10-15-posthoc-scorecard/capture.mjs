// 검증 성적표 확인 (2026-10-15): 1440·375 캡처와 측정. dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-15-posthoc-scorecard/capture.mjs [출력 폴더]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const file=JSON.parse(fs.readFileSync(new URL('../../dist/posthoc-scorecard.json',import.meta.url),'utf8'));
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#v=method');await page.waitForFunction(()=>document.querySelectorAll('#mt-vc-body tr').length>0,null,{timeout:30000});
  await page.waitForTimeout(600);await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));return {page,errors};
}
for(const [w,h] of [[1440,900],[375,812]]){
  const {page,errors}=await open(w,h);
  const m=await page.evaluate(()=>({
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    rows:[...document.querySelectorAll('#mt-vc-body tr')].map(r=>[r.dataset.key,r.querySelector('.mt-vc-pill').textContent]),
    first:document.querySelector('#method').firstElementChild.id,
    top:Math.round(document.getElementById('mt-scorecard').getBoundingClientRect().top),
    badges:[...document.querySelectorAll('#method .mt-vbadge')].map(b=>[b.dataset.ind,b.hidden,b.textContent]),
    small:[...document.querySelectorAll('#mt-scorecard *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11).length,
    wrapOver:(e=>e.scrollWidth-e.clientWidth)(document.querySelector('#method .mt-vc-wrap'))}));
  log(`${w}px: scorecard is the first block of the method tab`,m.first==='mt-scorecard'&&m.top<200,{first:m.first,top:m.top});
  log(`${w}px: one row per check with its label`,JSON.stringify(m.rows)===JSON.stringify(file.rows.map(r=>[r.key,r.outcome_label])),m.rows);
  log(`${w}px: three journey badges shown`,m.badges.length===3&&m.badges.every(b=>!b[1]&&b[2]),m.badges);
  log(`${w}px: no page-wide or table horizontal overflow`,m.over<=0&&m.wrapOver<=0,{over:m.over,wrap:m.wrapOver});
  if(w<741)log(`${w}px: no scorecard text under 11px`,m.small===0,{small:m.small});
  log(`${w}px: no page errors`,errors.length===0,errors);
  const sc=await page.$('#mt-scorecard');await sc.screenshot({path:`${OUT}/${w}-scorecard.png`});
  await page.screenshot({path:`${OUT}/${w}-first-screen.png`});
  await page.evaluate(()=>document.getElementById('mt-journey').scrollIntoView());await page.waitForTimeout(500);
  const j=await page.$('#mt-journey');await j.screenshot({path:`${OUT}/${w}-journey-badges.png`});
  await page.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
const failed=results.filter(r=>!r.ok).length;console.log(`${results.length-failed} pass, ${failed} fail`);process.exit(failed?1:0);
