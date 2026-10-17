// 탐색 지도 점·버블 색 되돌리기 확인 (2026-10-17): 축소(버블)·확대(점)·범례 견본 색, 칩 유형 색, 기간 필터·링크·움직임 줄이기,
// 선택 셀 테두리, '청회색' 낱말, 390·768·1100·1440px 가로 넘침. dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-17-explore-dots-red/capture.mjs [출력 폴더] [before|after]
// before(main)에서는 캡처와 측정값만 남기고 판정은 after에서만 한다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, STAGE=process.argv[3]||'after', BASE='http://127.0.0.1:8765/';
const RED='#ff6464', RED_EDGE='#ff8d84';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],measured={},log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h,hash='',opts={}){
  const page=await browser.newPage({viewport:{width:w,height:h},reducedMotion:opts.reduce?'reduce':'no-preference'}),errors=[];
  await page.addInitScript("try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{}");
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE+(hash?'#'+hash:''));
  // the app may reload once when a data file is newer than app.js (reloadOnceForNewData); wait until the page settles
  const ready=()=>page.waitForFunction(()=>typeof selected!=='undefined'&&selected&&typeof overlay!=='undefined'&&overlay.getLayers().length>0,null,{timeout:30000});
  for(let i=0;i<3;i++){try{await ready();await page.waitForTimeout(1500);await ready();break;}catch(e){if(i===2)throw e;await page.waitForLoadState('load');}}await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));return {page,errors};
}
// Colours of what the map and legend draw right now, normalised by the browser.
const marks=page=>page.evaluate(()=>{
  const n=c=>{const e=document.createElement('i');e.style.color=c;document.body.append(e);const v=getComputedStyle(e).color;e.remove();return v;};
  const ls=overlay.getLayers(),dots=ls.filter(l=>l._schematicDot),bubbles=ls.filter(l=>l._zoomMark&&l instanceof L.CircleMarker);
  const uniq=a=>[...new Set(a)];const cs=s=>{const e=document.querySelector(s);return e?getComputedStyle(e):null;};
  const count=document.querySelector('#map .bubble-count');const t=matrixType(selected);
  return {zoom:map.getZoom(),species:selected.label,
    dots:dots.length,dotFill:uniq(dots.map(d=>d.options.fillColor)),dotStroke:uniq(dots.map(d=>d.options.color)),dotOpacity:uniq(dots.map(d=>d.options.opacity+'/'+d.options.fillOpacity)),dotRadius:uniq(dots.map(d=>d.options.radius)).slice(0,6),
    bubbles:bubbles.length,bubbleFill:uniq(bubbles.map(b=>b.options.fillColor)),bubbleEdge:uniq(bubbles.map(b=>b.options.color)),bubbleSteps:uniq(bubbles.map(b=>b.options.fillOpacity)).sort(),bubbleRadius:bubbles.map(b=>b.options.radius),
    bubbleCount:count?getComputedStyle(count).color:null,bubbleNumbers:[...document.querySelectorAll('#map .bubble-count')].map(e=>e.textContent),
    keyBubble:(s=>s&&[s.borderTopColor,s.backgroundColor])(cs('#explore .bubble-symbol')),keyDot:(s=>s&&s.backgroundImage)(cs('#key-dot-mark')),
    chipDot:document.querySelector('#map-chip .mc-dot')?.style.backgroundColor||'none',wantChip:t?n(matrixTypeColour[t]):'none',
    blueGreyWord:document.body.innerText.includes('청회색')||document.documentElement.outerHTML.includes('청회색'),
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth};
});
const isRed=m=>m.dots?JSON.stringify(m.dotFill)===JSON.stringify([RED]):JSON.stringify(m.bubbleFill)===JSON.stringify([RED])&&JSON.stringify(m.bubbleEdge)===JSON.stringify([RED_EDGE]);
const shot=(page,name)=>page.screenshot({path:`${OUT}/${STAGE}-${name}.png`});

// 1440: default screen, bubbles (zoomed out), dots (zoomed in), a cell popup, a conservation-priority species
{
  const {page,errors}=await open(1440,900);
  await shot(page,'1440-explore');
  await page.evaluate(()=>{map.setZoom(5,{animate:false});});await page.waitForTimeout(500);
  const out=measured.bubbles1440=await marks(page);await shot(page,'1440-bubbles');
  await page.evaluate(()=>{const b=overlay.getLayers().find(l=>l._zoomMark&&l instanceof L.CircleMarker);b.fire('click');});await page.waitForTimeout(1000);
  const ins=measured.dots1440=await marks(page);await shot(page,'1440-dots');
  // legend swatches are in the folded '범례'
  await page.evaluate(()=>{const d=document.querySelector('.map-legend-more');if(d)d.open=true;});await page.waitForTimeout(200);
  measured.legend1440=await page.evaluate(()=>{const c=s=>{const e=document.querySelector(s);if(!e)return null;const g=getComputedStyle(e);return {border:g.borderTopColor,bg:g.backgroundColor,img:g.backgroundImage,visible:e.getBoundingClientRect().width>0};};
    return {bubbleKey:c('.key-bubble .bubble-symbol'),dotKey:c('#key-dot-mark'),caption:c('.map-caption .dot')};});
  await shot(page,'1440-legend-open');
  // a clicked occurrence cell opens its popup over the red dots (yellow outlines belong to the '활용 × 보전' view, which draws no dots)
  await page.evaluate(()=>{const d=document.querySelector('.map-legend-more');if(d)d.open=false;const f=overlay.getLayers().find(l=>(l instanceof L.Rectangle||l instanceof L.Polygon)&&l.options.interactive!==false);f?.fire('click',{latlng:f.getBounds().getCenter()});});
  await page.waitForTimeout(600);await shot(page,'1440-cell-popup');
  // a conservation-priority species: its own type colour (#d7392f) sits on the same screen as the red dots
  measured.redType=await page.evaluate(async()=>{map.closePopup();const s=data.species.find(x=>matrixType(x)==='conservation_priority'&&x.cells.length);if(!s)return null;selectSpecies(s.aphiaID);await new Promise(r=>setTimeout(r,600));map.setZoom(7,{animate:false});await new Promise(r=>setTimeout(r,500));
    return {species:s.label,type:matrixTypeColour.conservation_priority,chip:document.querySelector('#map-chip .mc-dot')?.style.backgroundColor,dots:overlay.getLayers().filter(l=>l._schematicDot).length};});
  await shot(page,'1440-conservation-priority-species');
  measured.errors1440=errors;
  if(STAGE==='after'){
    log('1440 zoomed out: bubbles are the previous red (fill #ff6464, edge #ff8d84)',out.bubbles>0&&out.dots===0&&isRed(out),{fill:out.bubbleFill,edge:out.bubbleEdge,steps:out.bubbleSteps});
    log('1440 zoomed in: schematic dots are the previous red #ff6464 with white edge, opacity .9/.88',ins.dots>0&&isRed(ins)&&JSON.stringify(ins.dotStroke)==='["#ffffff"]'&&JSON.stringify(ins.dotOpacity)==='["0.9/0.88"]',{fill:ins.dotFill,stroke:ins.dotStroke,op:ins.dotOpacity});
    log('bubble number is white again (pre-#218 rule)',out.bubbleCount==='rgb(255, 255, 255)',out.bubbleCount);
    const L=measured.legend1440;
    log('legend bubble swatch is red (#ff8d84 edge, rgba(255,100,100,.45) fill)',L.bubbleKey&&L.bubbleKey.border==='rgb(255, 141, 132)'&&L.bubbleKey.bg==='rgba(255, 100, 100, 0.45)',L.bubbleKey);
    log('legend dot swatch is red dots',L.dotKey&&/rgb\(255, 100, 100\)/.test(L.dotKey.img)&&!/169, 198, 212/.test(L.dotKey.img),L.dotKey&&L.dotKey.img);
    log('chip dot keeps the species type colour',ins.chipDot===ins.wantChip,{chip:ins.chipDot,want:ins.wantChip});
    log("no '청회색' left on the explore screen",!ins.blueGreyWord);
    log('1440 no page errors',errors.length===0,errors);
  }
  await page.close();
}
// period filter, shared link, reduced motion: same red
{
  const {page}=await open(1440,900);
  const per=await page.evaluate(async()=>{const s=data.species.find(x=>new Set(x.cells.map(c=>c.period)).size>1);if(!s)return null;selectSpecies(s.aphiaID);await new Promise(r=>setTimeout(r,500));
    const b=[...document.querySelectorAll('#pf-menu [data-period]')].find(x=>x.dataset.period!=='all');b.click();await new Promise(r=>setTimeout(r,400));map.setZoom(7,{animate:false});await new Promise(r=>setTimeout(r,400));return {species:s.label,period:periodFilter,hash:location.hash};});
  const pm=per&&await marks(page);
  await page.evaluate(()=>{writeHash();});const hash=(await page.evaluate(()=>location.hash)).slice(1);await page.close();
  const re=await open(1440,900,hash);await re.page.evaluate(()=>{map.setZoom(7,{animate:false});});await re.page.waitForTimeout(400);const lm=await marks(re.page);await re.page.close();
  const rm=await open(1440,900,'',{reduce:true});await rm.page.evaluate(()=>{map.setZoom(5,{animate:false});});await rm.page.waitForTimeout(300);const rb=await marks(rm.page);
  await rm.page.evaluate(()=>{map.setZoom(7,{animate:false});});await rm.page.waitForTimeout(300);const rd=await marks(rm.page);await rm.page.close();
  measured.period=per;measured.periodMarks=pm;measured.link={hash,marks:lm};measured.reduced={bubbles:rb,dots:rd};
  if(STAGE==='after'){
    log('period filter: dots stay red',!!pm&&pm.dots>0&&isRed(pm),{per,fill:pm&&pm.dotFill});
    log('reopened from a copied link: dots stay red',lm.dots>0&&isRed(lm),{hash,fill:lm.dotFill});
    log('reduced motion: bubbles and dots stay red',isRed(rb)&&rb.bubbles>0&&rd.dots>0&&isRed(rd),{b:rb.bubbleFill,d:rd.dotFill});
  }
}
// 4° occurrence outline (sea cucumber or any 4° species) follows the dot colour again
{
  const {page}=await open(1440,900);
  const wide=await page.evaluate(async()=>{const s=data.species.find(x=>x.cells.some(c=>c.sizeDeg===4));if(!s)return null;selectSpecies(s.aphiaID);await new Promise(r=>setTimeout(r,500));map.setZoom(7,{animate:false});await new Promise(r=>setTimeout(r,400));
    return {species:s.label,edges:[...new Set(overlay.getLayers().filter(l=>l.options&&l.options.dashArray==='9 6').map(l=>l.options.color))]};});
  await shot(page,'1440-wide-cells');measured.wide=wide;
  if(STAGE==='after')log('4° occurrence outline is red like before #218',!!wide&&JSON.stringify(wide.edges)===JSON.stringify([RED]),wide);
  await page.close();
}
for(const [w,h] of [[1100,800],[768,1024],[390,844]]){
  const {page,errors}=await open(w,h);
  const m=await marks(page);measured['v'+w]={over:m.over,dots:m.dots,bubbles:m.bubbles};
  if(w===390)await shot(page,'390-explore');
  if(STAGE==='after'){
    log(`${w}px: no page-wide horizontal overflow`,m.over<=0,{over:m.over});
    log(`${w}px: marks are red`,isRed(m),{dots:m.dotFill,bubbles:m.bubbleFill});
    log(`${w}px: no page errors`,errors.length===0,errors);
  }
  await page.close();
}
{const m=measured;log(`1440px: no page-wide horizontal overflow`,m.dots1440.over<=0,{over:m.dots1440.over});}
await browser.close();
fs.writeFileSync(`${OUT}/${STAGE}-measured.json`,JSON.stringify(measured,null,1)+'\n');
if(STAGE==='after')fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1)+'\n');
process.exit(STAGE!=='after'||results.every(r=>r.ok)?0:1);
