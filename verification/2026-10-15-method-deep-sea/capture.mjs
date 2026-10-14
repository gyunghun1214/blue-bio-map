// '근거와 방법' 심해 디자인 확인 (2026-10-15): 1440·768·390 캡처와 측정. dist/를 127.0.0.1:8765로 띄운 뒤
// node verification/2026-10-15-method-deep-sea/capture.mjs [출력 폴더]
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, BASE='http://127.0.0.1:8765/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  // FIXTURE=dist/live-snapshot.json answers the two Supabase reads (the cloud blocks them), as uicheck.mjs does
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+'#v=method');await page.waitForFunction(()=>document.getElementById('mt-total')?.textContent!=='—',null,{timeout:30000});
  await page.waitForTimeout(600);return {page,errors};
}
for(const [w,h] of [[1440,900],[768,1024],[390,844]]){
  const {page,errors}=await open(w,h);
  const m=await page.evaluate(()=>({
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    counts:['mt-total','mt-published','mt-candidates'].map(id=>document.getElementById(id).textContent),
    data:[data.species.length,data.publishedCount,data.candidateCount].map(String),
    links:document.querySelectorAll('#method .mt-links g path').length,
    quads:[...document.querySelectorAll('#method .mt-q')].map(q=>q.dataset.q+':'+q.querySelector('b').textContent+'/'+q.querySelector('span').textContent),
    open:[...document.querySelectorAll('#method details.mt-acc')].map(d=>d.open)}));
  log(`${w}px: no page-wide horizontal overflow`,m.over<=0,{over:m.over});
  log(`${w}px: scope numbers = loaded data (전체·운영·후보)`,JSON.stringify(m.counts)===JSON.stringify(m.data),{counts:m.counts,data:m.data});
  log(`${w}px: folds closed on arrival`,m.open.every(x=>!x),m.open);
  log(`${w}px: journey links ${w>1100?'drawn (5)':'hidden, stacked with arrows'}`,w>1100?m.links===5:m.links===0,{links:m.links});
  if(w===1440)log('quadrant names from the matrix rule',m.quads.join('|')==='low_bbvi_high_mcui:보전 지표 높음/보전 연구 우선 검토|high_bbvi_high_mcui:두 지표 모두 높음/활용·보전 병행 검토|low_bbvi_low_mcui:두 지표 모두 낮음/기초조사 검토|high_bbvi_low_mcui:활용 지표 높음/활용 연구 검토',m.quads);
  await page.screenshot({path:`${OUT}/${w}-full.png`,fullPage:true});
  await page.screenshot({path:`${OUT}/${w}-first-screen.png`});
  if(w===1440){
    // links: where each one starts and ends (right edge of the source box → left edge of the target box)
    const geo=await page.evaluate(()=>{const f=document.querySelector('#method .mt-flow').getBoundingClientRect(),r=k=>document.querySelector(`[data-node="${k}"]`).getBoundingClientRect();
      return [...document.querySelectorAll('#method .mt-links g path')].map(p=>{const d=p.getAttribute('d').match(/-?[\d.]+/g).map(Number);return {x1:d[0]+f.left,y1:d[1]+f.top,x2:d[6]+f.left,y2:d[7]+f.top};}).map((l,i)=>{const [a,b]=[['mfpi','bbvi'],['mbpi','bbvi'],['cons','mcui'],['bbvi','quad'],['mcui','quad']][i];
        const A=r(a),B=r(b);return {a,b,startOnA:Math.abs(l.x1-A.right)<1&&l.y1>A.top&&l.y1<A.bottom,endOnB:Math.abs(l.x2-B.left)<4&&l.y2>B.top&&l.y2<B.bottom};});});
    log('journey links start on their source box and end on their target box (no BBVI–MCUI line)',geo.every(g=>g.startOnA&&g.endOnB),geo);
    // buttons
    const go=async sel=>{const before=await page.evaluate(()=>(scrollTo(0,0),location.hash));await page.click(sel);await page.waitForTimeout(900);return page.evaluate(before=>({same:location.hash===before,y:scrollY,
      journey:Math.round(document.getElementById('mt-journey').getBoundingClientRect().top),src:Math.round(document.querySelector('#method .source-section').getBoundingClientRect().top),
      focus:document.activeElement?.id,open2:document.getElementById('mt-acc-02').open,flow:Math.round(document.querySelector('#method .flow-wrap').getBoundingClientRect().top)}),before);};
    let r=await go('[data-mt-go=journey]');log('지표 흐름 살펴보기 → journey section at the top, hash unchanged',r.journey>=0&&r.journey<140&&r.same,r);
    r=await go('[data-mt-go=sources]');log('자료 출처 보기 → sources section, #all-sources focused',r.src>=0&&r.src<140&&r.focus==='all-sources'&&r.same,r);
    await page.screenshot({path:`${OUT}/1440-sources.png`});
    r=await go('[data-mt-go=flow]');log('전체 산출 흐름 보기 → fold 02 opens, flow chart at the top',r.open2&&r.flow>=0&&r.flow<140,r);
    await page.screenshot({path:`${OUT}/1440-fold02-flow.png`});
    // flow box → fold 03 opens and the card flashes
    await page.evaluate(()=>{document.getElementById('mt-acc-03').open=false;});
    await page.click('.flow g[data-step="03"]');await page.waitForTimeout(250);
    r=await page.evaluate(()=>({open3:document.getElementById('mt-acc-03').open,flash:document.getElementById('method-03').classList.contains('flash')}));await page.waitForTimeout(800);
    r.top=await page.evaluate(()=>Math.round(document.getElementById('method-03').getBoundingClientRect().top));
    log('flow box (MBPI) → fold 03 opens, #method-03 flashes and comes to the top',r.open3&&r.flash&&r.top>=0&&r.top<160,r);
    await page.screenshot({path:`${OUT}/1440-fold03-card.png`});
    // keyboard: Enter on a flow box, then a summary toggles with Enter
    await page.evaluate(()=>{document.getElementById('mt-acc-01').open=false;scrollTo(0,0);document.querySelector('.flow g[data-step="01"]').focus();});
    await page.keyboard.press('Enter');await page.waitForTimeout(300);
    const k1=await page.evaluate(()=>document.getElementById('mt-acc-01').open);
    await page.evaluate(()=>document.querySelector('#mt-acc-01>summary').focus());await page.keyboard.press('Enter');await page.waitForTimeout(100);
    const k2=await page.evaluate(()=>document.getElementById('mt-acc-01').open);
    log('keyboard: Enter on a flow box opens fold 01; Enter on its summary closes it',k1&&!k2,{k1,k2});
    await page.evaluate(()=>{for(const d of document.querySelectorAll('#method details.mt-acc'))d.open=true;});await page.waitForTimeout(300);
    await page.screenshot({path:`${OUT}/1440-all-folds-open.png`,fullPage:true});
    const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);log('1440px all folds open: no page overflow',o<=0,{o});
    // sources content kept
    const src=await page.evaluate(()=>({cites:document.querySelectorAll('#all-sources .citation').length,species:data.species.length,worms:document.querySelectorAll('#all-sources a[href*="marinespecies"]').length,
      fine:['Natural Earth','NASA GIBS','GEBCO','Leaflet','Pretendard'].every(w=>document.querySelector('#method .source-section>.fine').textContent.includes(w))}));
    log('sources: WoRMS citations for every species with links, map/font credits kept',src.cites>=src.species&&src.worms>=src.species&&src.fine,src);
    // other tabs and back: tab state, compare page background not touched
    const tabs=await page.evaluate(async()=>{setView('compare');await new Promise(r=>setTimeout(r,300));const cbg=getComputedStyle(document.body).backgroundImage.slice(0,40);setView('explore');await new Promise(r=>setTimeout(r,300));
      const ebg=getComputedStyle(document.body).backgroundColor,mtVisible=document.getElementById('method').getClientRects().length;setView('method');await new Promise(r=>setTimeout(r,300));
      return {cbg,ebg,mtVisible,hash:location.hash,links:document.querySelectorAll('#method .mt-links g path').length,mbg:getComputedStyle(document.body).backgroundImage.slice(0,40)};});
    log('other tabs: compare keeps its own background, explore unaffected, back to method redraws links',tabs.links===5&&tabs.mtVisible===0&&tabs.hash.includes('v=method'),tabs);
  }
  if(w===390){
    await page.evaluate(()=>{for(const d of document.querySelectorAll('#method details.mt-acc'))d.open=true;});await page.waitForTimeout(300);
    const o=await page.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth,flow:(s=>s.scrollWidth>s.clientWidth)(document.querySelector('#method .flow-scroll')),
      small:[...document.querySelectorAll('#method button, #method summary')].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().height<44).map(b=>b.textContent.trim().slice(0,20))}));
    log('390px all folds open: page does not overflow, the flow chart scrolls in its own box',o.over<=0&&o.flow,o);
    log('390px: buttons and fold headers are at least 44px tall',o.small.length===0,o.small);
    await page.screenshot({path:`${OUT}/390-all-folds-open.png`,fullPage:true});
  }
  log(`${w}px: no console errors`,errors.length===0,errors);
  await page.close();
}
// 멍이 '화면에서 보여주기' for a method question opens the fold and lands on the card
{const {page}=await open(1440,900);
  const r=await page.evaluate(async()=>{setView('explore');await new Promise(r=>setTimeout(r,200));document.querySelector('[data-view="method"]').click();
    const t=document.querySelector('#method-02'),fold=t.closest('#method details');if(fold)fold.open=true;await new Promise(r=>setTimeout(r,200));return {visible:t.getClientRects().length>0,open:fold.open};});
  log('멍이 show(): a target in a closed fold becomes visible once its fold opens',r.visible&&r.open,r);await page.close();}
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
console.log(`${results.filter(r=>r.ok).length} PASS / ${results.filter(r=>!r.ok).length} FAIL`);
await browser.close();
