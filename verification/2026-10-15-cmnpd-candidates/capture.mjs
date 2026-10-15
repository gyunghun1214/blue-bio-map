// CMNPD 후보 화합물 탐색 줄과 '왜 ChEMBL인가' 카드 확인 (2026-10-15). dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-15-cmnpd-candidates/capture.mjs [출력 폴더]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h,hash,ready){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#'+hash);await page.waitForFunction(ready,null,{timeout:30000});await page.waitForTimeout(600);return {page,errors};
}
const file=JSON.parse(fs.readFileSync(new URL('../../dist/cmnpd-candidates.json',import.meta.url),'utf8'));
for(const [w,h] of [[1440,900],[390,844]]){
  for(const [aphia,name] of [[241776,'sea-cucumber'],[371986,'ecklonia'],[127022,'mackerel']]){
    const {page,errors}=await open(w,h,`v=compare&s=${aphia}`,()=>document.querySelector('#cmp-profile .cp-cmnpd'));
    const r=file.species.find(x=>x.aphia_id===aphia);
    const m=await page.evaluate(()=>{const p=document.querySelector('#cmp-profile .cp-cmnpd');
      return {text:p.innerText.replace(/\s+/g,' '),links:[...p.querySelectorAll('a')].map(a=>a.href),min:Math.min(...[p,...p.querySelectorAll('*')].map(e=>parseFloat(getComputedStyle(e).fontSize))),
        over:document.documentElement.scrollWidth-document.documentElement.clientWidth,inside:(()=>{const a=p.getBoundingClientRect(),b=document.getElementById('cmp-profile').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;})()};});
    log(`${w}px ${name}: line shows the CMNPD count, '점수 미사용' and the licence`,m.text.includes('후보 화합물 탐색')&&m.text.includes('점수 미사용')&&m.text.includes(`보고 화합물 ${r.compound_count}개`)&&m.links.some(u=>u.includes('terms-and-conditions')),m.text);
    log(`${w}px ${name}: no text under 11px, inside the profile, no page overflow`,m.min>=11&&m.inside&&m.over<=0,{min:m.min,inside:m.inside,over:m.over});
    log(`${w}px ${name}: no page errors`,!errors.length,errors);
    const el=await page.$('#cmp-profile');await el.scrollIntoViewIfNeeded();await el.screenshot({path:`${OUT}/${w}-profile-${name}.png`});
    await page.close();
  }
  const {page,errors}=await open(w,h,'v=method',()=>document.getElementById('mt-cmnpd')?.textContent);
  await page.evaluate(()=>{document.getElementById('mt-acc-02').open=true;});await page.waitForTimeout(300);
  const m=await page.evaluate(()=>({text:document.getElementById('mt-cmnpd').textContent,h3:document.querySelector('#method-chembl h3').textContent,over:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  log(`${w}px method: why-ChEMBL card and counts from the file`,m.h3==='왜 MBPI의 주 소스가 ChEMBL인가요?'&&m.text.includes(`CMNPD 보고 화합물 ${file.totals.pairs}개`)&&m.over<=0,m);
  log(`${w}px method: no page errors`,!errors.length,errors);
  const card=await page.$('#method-chembl');await card.scrollIntoViewIfNeeded();await card.screenshot({path:`${OUT}/${w}-method-why-chembl.png`});
  await page.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1)+'\n');
const fail=results.filter(r=>!r.ok).length;console.log(`${results.length-fail}/${results.length} PASS`);process.exit(fail?1:0);
