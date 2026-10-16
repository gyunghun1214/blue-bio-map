// 검증 성적표·05 삭제 확인 (2026-10-16): 근거와 방법 탭 1440·390 캡처와 390·768·1100·1440px 측정.
// dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-16-method-remove-scorecard/capture.mjs [출력 폴더] [before|after]
// before(main)에서는 캡처만 남기고 판정은 after에서만 한다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, STAGE=process.argv[3]||'after', BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#v=method');
  await page.waitForFunction(()=>document.querySelector('#method.active')&&document.getElementById('mt-total')?.textContent!=='—'&&[...document.querySelectorAll('#method .mt-vbadge')].some(b=>!b.hidden),null,{timeout:30000});
  await page.waitForTimeout(600);await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));return {page,errors};
}
for(const [w,h] of [[1440,900],[1100,800],[768,1024],[390,844]]){
  const {page,errors}=await open(w,h);
  const m=await page.evaluate(()=>{
    document.querySelectorAll('#method details').forEach(d=>d.open=true);const all=[...document.querySelectorAll('#method details.mt-acc')].map(d=>d.id);
    const t=document.getElementById('method').textContent;
    return {over:document.documentElement.scrollWidth-document.documentElement.clientWidth,folds:all,
      first:document.querySelector('#method').firstElementChild.id,
      top:Math.round(document.getElementById('mt-mcui-map').getBoundingClientRect().top+scrollY),
      gone:['mt-scorecard','mt-vc-body','mt-vc-ind','mt-acc-05','promise-table','promise-count'].filter(id=>document.getElementById(id)),
      text:['VALIDATION SCORECARD','검증 성적표','신청서 약속','구현 현황','이 탭 위쪽'].filter(s=>t.includes(s)),
      mcuiLine:[...document.querySelectorAll('#method-03 li')].map(li=>li.textContent).find(x=>x.startsWith('MCUI 보전 상태 등급'))||'',
      badges:[...document.querySelectorAll('#method .mt-vbadge')].map(b=>[b.dataset.ind,b.hidden,b.textContent])};});
  if(STAGE==='after'){
    log(`${w}px: no page-wide horizontal overflow (all folds open)`,m.over<=0,{over:m.over});
    log(`${w}px: scorecard and fold 05 gone from the DOM`,m.gone.length===0&&m.text.length===0,{gone:m.gone,text:m.text});
    log(`${w}px: MCUI table is the first block of the method tab`,m.first==='mt-mcui-map',{first:m.first,top:m.top});
    log(`${w}px: folds 01–04 only`,JSON.stringify(m.folds)===JSON.stringify(['mt-acc-01','mt-acc-02','mt-acc-03','mt-acc-04']),m.folds);
    log(`${w}px: MCUI line says (대응표는 이 탭 맨 위)`,m.mcuiLine.includes('(대응표는 이 탭 맨 위)'),m.mcuiLine.slice(0,90));
    log(`${w}px: three journey badges shown`,m.badges.length===3&&m.badges.every(b=>!b[1]&&b[2]),m.badges);
    log(`${w}px: no page errors`,errors.length===0,errors);
  }
  if(w===1440||w===390){
    await page.evaluate(()=>{document.querySelectorAll('#method details').forEach(d=>d.open=false);scrollTo(0,0);});await page.waitForTimeout(300);
    await page.screenshot({path:`${OUT}/${STAGE}-${w}-top.png`});
    await page.evaluate(()=>{const d=document.getElementById('mt-acc-01');d?.scrollIntoView({block:'start'});scrollBy(0,-80);});await page.waitForTimeout(300);
    await page.screenshot({path:`${OUT}/${STAGE}-${w}-folds.png`});
  }
  await page.close();
}
await browser.close();
if(STAGE==='after')fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1)+'\n');
process.exit(results.every(r=>r.ok)?0:1);
