// MCUI 범주 표기 확인 (개선 7/15, 2026-10-15): 숫자 옆 범주, 설명, 보조 정보, 동점 규칙, 근거와 방법 대응표.
// dist/를 127.0.0.1:8765로 띄운 뒤 node verification/2026-10-15-mcui-category/capture.mjs [출력 폴더]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h,hash){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  await page.addInitScript(()=>{try{sessionStorage.setItem('bbvm-intro-entered','1');localStorage.setItem('bbvm-intro-entered','1');}catch{}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+'#'+hash);
  await page.waitForFunction(()=>typeof data!=='undefined'&&data?.assessmentInfo&&data.species?.some(s=>s.assessment),null,{timeout:45000});
  await page.addStyleTag({content:'.bbc-hint{display:none!important}'});await page.evaluate(()=>document.getElementById('site-gate')?.remove());
  await page.waitForTimeout(800);return {page,errors};
}
// 1) the table every species with an MCUI: number as shown, category, criteria, year, aux line
{const {page,errors}=await open(1440,900,'v=compare');
  const rows=await page.evaluate(()=>data.species.filter(s=>pilotScore(s,'MCUI')!==null).map(s=>({name:s.label,aphia:s.aphiaID,mcui:pilotScore(s,'MCUI'),shown:scoreText(s,'MCUI',pilotScore(s,'MCUI')),
    category:mcuiCategory(s),criteria:mcuiCriteria(s),year:mcuiAssessYear(s),aux:mcuiAuxLine(s),basis:s.assessment.mcui_basis,driver:s.assessment.mcui_driver,early:earlyMcui(s),matrix:assessedForMatrix(s)})));
  fs.writeFileSync(OUT+'/mcui-table.json',JSON.stringify(rows,null,1));
  log('every MCUI number carries a category in brackets',rows.every(r=>/^\d+\.\d \(.+\)$/.test(r.shown)),rows.filter(r=>!/\(/.test(r.shown)).map(r=>r.name));
  log('matrix species = MCUI species (30, verified-4.19)',rows.filter(r=>r.matrix).length===30&&rows.length===30,{n:rows.filter(r=>r.matrix).length});
  log('no tag says IUCN or 공식',rows.every(r=>!/IUCN|공식/.test(r.shown+r.aux)),rows.filter(r=>/IUCN|공식/.test(r.shown+r.aux)).map(r=>r.name));
  // the profile of every preliminary species: no IUCN / 공식 in the conservation block
  const bad=[];
  for(const r of rows.filter(r=>r.early)){
    await page.evaluate(id=>pickCompare(id),r.aphia);await page.waitForTimeout(120);
    const t=await page.evaluate(()=>document.querySelector('#cmp-profile .cp-con')?.innerText||'');
    if(/공식|IUCN(?! 기반 MCUI와 (직접 )?비교 불가| 기반과 같은 척도가 아님)/.test(t)||!/보조 정보/.test(t)||!/\(/.test(t))bad.push([r.name,t]);
  }
  log('preliminary profiles: category shown, 보조 정보 line, never IUCN/공식',!bad.length,bad);
  for(const [id,file] of [[241776,'01-1440-profile-sea-cucumber'],[342067,'02-1440-profile-common-squid'],[145721,'03-1440-profile-wakame']]){
    await page.evaluate(id=>pickCompare(id),id);await page.waitForTimeout(300);
    await page.locator('#cmp-profile').screenshot({path:`${OUT}/${file}.png`});
  }
  await page.screenshot({path:`${OUT}/04-1440-matrix.png`});
  // data table sorted by MCUI (high first): ties in name order
  await page.click('[data-cmp-mode="table"]');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{cmpSort={key:'MCUI',dir:'desc'};renderComparison();});await page.waitForTimeout(300);
  const order=await page.evaluate(()=>[...document.querySelectorAll('#comparison tr.cmp-row')].map(tr=>({id:+tr.dataset.aphia,v:pilotScore(cmpById(tr.dataset.aphia),'MCUI'),n:cmpById(tr.dataset.aphia).label})));
  const tieOk=order.every((r,i)=>!i||order[i-1].v===null||r.v===null||order[i-1].v>r.v||(order[i-1].v===r.v&&order[i-1].n.localeCompare(r.n,'ko')<=0));
  log('MCUI sort: equal scores in 가나다순',tieOk,order.map(r=>r.n+':'+r.v).join(' '));
  const label=await page.evaluate(()=>document.getElementById('comparison-page')?.textContent||'');
  log('sort line names the tie rule',/같은 점수는 가나다순/.test(label),label);
  await page.locator('#comparison').screenshot({path:`${OUT}/05-1440-data-table-mcui-sorted.png`});
  log('1440 compare: no page errors',!errors.length,errors);
  await page.close();}
// 2) method tab: the table sits under the title
{const {page,errors}=await open(1440,900,'v=method');
  const m=await page.evaluate(()=>{const c=document.getElementById('mt-mcui-map'),v=document.getElementById('mt-scorecard'),h=document.querySelector('#method .mt-hero');return {after:!!c&&(v?v.nextElementSibling===c:h?.nextElementSibling===c),cells:[...c.querySelectorAll('tbody td')].map(td=>td.textContent).join(',')};});
  log('method: MCUI table right under the validation scorecard (top of the tab), LC 10 · NT 35 · VU 60 · EN 80 · CR 100',m.after&&m.cells==='10,35,60,80,100',m);
  await page.locator('#mt-mcui-map').screenshot({path:`${OUT}/06-1440-method-mcui-table.png`});
  log('1440 method: no page errors',!errors.length,errors);await page.close();}
// 3) explore species detail (axis card) for 해삼
{const {page,errors}=await open(1440,900,'s=241776&v=explore');
  const t=await page.evaluate(()=>[...document.querySelectorAll('.axis-cards .ax-card')].at(-1)?.innerText||'');
  log('explore axis card: definition, category and 보조 정보',/보전 상태 등급\(IUCN\) \+ 자원 감소 신호/.test(t)&&/80\.0\s*\(EN, A2bd\)/.test(t)&&/보조 정보/.test(t),t);
  const card=page.locator('.axis-cards').first();if(await card.count())await card.screenshot({path:`${OUT}/07-1440-explore-axis-card-sea-cucumber.png`});
  log('1440 explore: no page errors',!errors.length,errors);await page.close();}
// 4) phone
for(const [hash,file] of [['s=342067&v=compare','08-390-profile-common-squid'],['v=method','09-390-method-mcui-table']]){
  const {page,errors}=await open(390,844,hash);
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  log(`390 ${hash}: no page-wide horizontal overflow`,over<=0,{over});
  const el=page.locator(hash.includes('method')?'#mt-mcui-map':'#cmp-profile');await el.scrollIntoViewIfNeeded();await el.screenshot({path:`${OUT}/${file}.png`});
  log(`390 ${hash}: no page errors`,!errors.length,errors);await page.close();}
await browser.close();
fs.writeFileSync(OUT+'/results.json',JSON.stringify(results,null,1));
const fails=results.filter(r=>!r.ok).length;console.log(`${results.length-fails} PASS / ${fails} FAIL`);process.exit(fails?1:0);
