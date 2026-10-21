// '근거와 방법' 꼬리표 번호 정리 확인 (2026-10-21): 세 접이식 칸을 펼친 화면을 1440·390으로 찍고, 꼬리표 글자와 앵커 이동을 잰다.
// dist/를 127.0.0.1:8765로 띄운 뒤 node verification/2026-10-21-method-kicker-numbers/capture.mjs [출력 폴더]
// (클라우드에서는 FIXTURE=dist/live-snapshot.json, 2026-10-15-method-deep-sea/capture.mjs와 같은 방식)
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+'#v=method');await page.waitForFunction(()=>document.getElementById('mt-total')?.textContent!=='—',null,{timeout:30000});
  await page.waitForTimeout(600);return {page,errors};
}
for(const [w,h] of [[1440,900],[390,844]]){
  const {page,errors}=await open(w,h);
  const k=await page.evaluate(()=>[...document.querySelectorAll('#method .method-card .step')].map(s=>({id:s.closest('article').id,text:s.textContent,cls:s.className,
    color:getComputedStyle(s).color,size:getComputedStyle(s).fontSize})));
  log(`${w}px: method-card labels are words only`,k.length===5&&k.every(x=>!/^\s*\d+\s*\//.test(x.text)),k);
  const cap=await page.evaluate(()=>document.querySelector('#method .flow-wrap figcaption').textContent);
  log(`${w}px: flow caption`,cap==='상자를 누르면 해당 설명(자료 연결 · 산출 방법 · 해석)을 펼치고 그 자리로 이동합니다.',cap);
  const nums=await page.evaluate(()=>({acc:[...document.querySelectorAll('#method .mt-acc-n')].map(n=>n.textContent),
    flow:[...document.querySelectorAll('#method .mt-step>span')].map(n=>n.textContent),cards:[...document.querySelectorAll('#method .mt-n')].map(n=>n.textContent)}));
  log(`${w}px: kept numbered sets run 01→N`,Object.values(nums).every(a=>a.every((n,i)=>+n===i+1)),nums);
  // flow boxes still open their fold and bring #method-01/02/03 up
  for(const s of ['01','02','03']){
    // the flow chart sits in fold 02: keep it open, close the others, then press the box
    await page.evaluate(()=>{document.querySelectorAll('#method details.mt-acc').forEach(d=>d.open=d.id==='mt-acc-02');scrollTo(0,0);});
    await page.evaluate(s=>document.querySelector(`.flow g[data-step="${s}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true})),s);
    await page.waitForTimeout(900);
    const r=await page.evaluate(s=>{const c=document.getElementById('method-'+s);return {open:c.closest('details')?.open,top:Math.round(c.getBoundingClientRect().top)};},s);
    log(`${w}px: flow box ${s} → #method-${s} opened and in view`,r.open&&r.top>=0&&r.top<h,r);
  }
  await page.evaluate(()=>{document.querySelectorAll('#method details.mt-acc').forEach(d=>d.open=['mt-acc-01','mt-acc-02','mt-acc-03'].includes(d.id));});
  // the sticky header would be painted over a fold taller than the window: let it scroll away for these shots only
  await page.addStyleTag({content:'body>header,.header,.site-header{position:static!important}'});
  await page.waitForTimeout(400);
  for(const n of ['01','02','03']){
    const el=page.locator('#mt-acc-'+n);await el.scrollIntoViewIfNeeded();
    await el.screenshot({path:`${OUT}/${w}-fold${n}.png`});
  }
  log(`${w}px: no page errors`,errors.length===0,errors);
  await page.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1)+'\n');
const failed=results.filter(r=>!r.ok).length;console.log(`${results.length-failed} PASS / ${failed} FAIL`);process.exit(failed?1:0);
