// MCUI SCALE 카드 삭제 확인 (2026-10-17): 근거와 방법 탭 1440·1100·768·390 캡처와 측정.
// dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-17-remove-mcui-scale-card/capture.mjs [출력 폴더] [before|after]
// before(main)에서는 캡처만 남기고 판정은 after에서만 한다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, STAGE=process.argv[3]||'after', BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h,view){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#v='+view);
  await page.waitForFunction(v=>document.querySelector('#'+v+'.active')&&document.getElementById('mt-total')?.textContent!=='—',view,{timeout:30000});
  await page.waitForTimeout(800);await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));return {page,errors};
}
// gap = from the bottom of the fixed header/tab bar to the top of the tab's first block
const gapOf=v=>{const sec=document.getElementById(v),first=sec.firstElementChild,bar=document.querySelector('header')||document.querySelector('.topbar');
  return {first:first.id||first.className,gap:Math.round(first.getBoundingClientRect().top-(bar?bar.getBoundingClientRect().bottom:0)),padTop:getComputedStyle(sec).paddingTop}};
for(const [w,h] of [[1440,900],[1100,800],[768,1024],[390,844]]){
  const {page,errors}=await open(w,h,'method');
  const m=await page.evaluate(g=>{const f=new Function('v','return ('+g+')(v)');const t=document.getElementById('method').textContent,html=document.documentElement.outerHTML;
    return {...f('method'),over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      gone:['mt-mcui-map','MCUI SCALE','대응표는 이 탭 맨 위','mt-mm-'].filter(s=>html.includes(s)),
      line02:t.includes('범주 → 숫자는 LC 10 · NT 35 · VU 60 · EN 80 · CR 100'),scope:!!document.querySelector('#method .mt-scope'),flow:!!document.querySelector('#method .flow')}},gapOf.toString());
  const c=await (await open(w,h,'compare')).page.evaluate(g=>new Function('v','return ('+g+')(v)')('compare'),gapOf.toString());
  await page.screenshot({path:`${OUT}/${STAGE}-${w}-method-top.png`});
  if(STAGE==='after'){
    log(`${w}px: the hero (EVIDENCE & METHODS) is the first block of the method tab`,m.first==='mt-hero',{first:m.first});
    log(`${w}px: no MCUI SCALE card, class or pointer text left`,m.gone.length===0,m.gone);
    log(`${w}px: 02 keeps LC 10 · NT 35 · VU 60 · EN 80 · CR 100; scope card and flow kept`,m.line02&&m.scope&&m.flow);
    log(`${w}px: hero sits below the tab bar with the tab's own top padding (not touching, not doubled)`,m.gap>=16&&m.gap<=parseInt(m.padTop)+24,{method:{gap:m.gap,pad:m.padTop},compare:{first:c.first,gap:c.gap,pad:c.padTop}});
    log(`${w}px: no horizontal overflow`,m.over<=0,m.over);
    log(`${w}px: no console errors`,errors.length===0,errors);
  }
  await page.close();
}
await browser.close();
if(STAGE==='after'){fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
  const bad=results.filter(r=>!r.ok);console.log(`${results.length-bad.length}/${results.length} PASS`);process.exit(bad.length?1:0);}
