// 유형 표시 모양을 원으로 통일한 뒤 확인 (2026-10-18): 매트릭스 점·사분면 이름·범례·데이터 표·종 프로필·탐색 지도 카드·
// '활용 × 보전' 2×2 범례의 모양, 자원 감소 신호 종(살오징어·우뭇가사리·참조기)의 점, 바뀐 문장, 가중치 슬라이더·밀집 구간,
// 390·768·1100·1440px 가로 넘침, 콘솔 오류. dist/를 127.0.0.1:8765로 띄운 뒤
// FIXTURE=dist/live-snapshot.json node verification/2026-10-18-matrix-markers-circle/capture.mjs [출력 폴더] [before|after]
// before(main)에서는 캡처와 측정값만 남기고 판정은 after에서만 한다. after는 before-measured.json과 색·위치를 비교한다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const OUT=process.argv[2]||new URL('.',import.meta.url).pathname, STAGE=process.argv[3]||'after', BASE='http://127.0.0.1:8765/';
const STOCK=[342067,372119,281273], GLYPH=/[▲■◆◇△□◼▴]/;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const results=[],measured={},log=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
async function open(w,h){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];
  await page.addInitScript("try{sessionStorage.setItem('bbvm-intro-entered','1')}catch{}");
  if(process.env.FIXTURE){const fx=fs.readFileSync(process.env.FIXTURE,'utf8');
    await page.addInitScript(`{const FX=${fx};const r=k=>Promise.resolve(new Response(JSON.stringify(FX[k]),{status:200,headers:{'content-type':'application/json'}}));window.fetch=(o=>(u,...a)=>{const s=String(u);if(s.includes('/rest/v1/species_profiles'))return r('profiles');if(s.includes('/rest/v1/species_map_cells'))return r('cells');return o(u,...a);})(window.fetch);}`);}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|net::/.test(m.text()))errors.push(m.text());});
  await page.goto(BASE);
  const ready=()=>page.waitForFunction(()=>typeof selected!=='undefined'&&selected&&typeof overlay!=='undefined'&&overlay.getLayers().length>0,null,{timeout:30000});
  for(let i=0;i<3;i++){try{await ready();await page.waitForTimeout(1500);await ready();break;}catch(e){if(i===2)throw e;await page.waitForLoadState('load');}}
  await page.evaluate(()=>document.querySelectorAll('.bbc-hint').forEach(e=>e.hidden=true));return {page,errors};
}
const toCompare=async(page,mode='matrix')=>{await page.evaluate(m=>{setView('compare');setCompareMode(m);},mode);await page.waitForTimeout(700);};
// What the matrix and the type marks draw right now (computed styles, so CSS and markup both count).
const probe=page=>page.evaluate(([STOCK,GLYPHS])=>{
  const G=new RegExp(GLYPHS),cs=e=>getComputedStyle(e),bf=e=>getComputedStyle(e,'::before');
  const round=e=>{const s=cs(e);return s.borderTopLeftRadius==='50%'||parseFloat(s.borderTopLeftRadius)>=e.getBoundingClientRect().width/2-0.5;};
  const pts=[...document.querySelectorAll('#matrix-points .matrix-point.pilot')];
  const point=p=>{const s=cs(p),b=bf(p),r=p.getBoundingClientRect();return {aphia:Number(p.dataset.aphia),name:p.dataset.name,type:p.dataset.type,tag:p.tagName,
    left:p.style.left,bottom:p.style.bottom,mp:p.style.getPropertyValue('--mp'),bg:s.backgroundColor,border:s.borderTopColor,radius:s.borderTopLeftRadius,round:round(p),
    w:Math.round(r.width*10)/10,before:b.content,beforeTransform:b.transform,clustered:p.hasAttribute('data-clustered'),current:p.getAttribute('aria-current')==='true',
    aria:p.getAttribute('aria-label'),title:p.title,cls:p.className};};
  const mark=e=>{const s=e.matches('strong')?bf(e):cs(e),r=e.matches('strong')?null:e.getBoundingClientRect();
    return {cls:e.className||e.tagName,clip:s.clipPath,radius:s.borderTopLeftRadius,w:s.width,h:s.height,bg:s.backgroundColor,transform:s.transform,
      round:s.clipPath==='none'&&(s.borderTopLeftRadius==='50%'||(r?parseFloat(s.borderTopLeftRadius)>=r.width/2-0.5:false))};};
  const text=sel=>[...document.querySelectorAll(sel)].map(e=>e.textContent).join(' | ');
  return {
    points:pts.map(point),
    quadrants:[...document.querySelectorAll('#compare .matrix .quadrant.typed strong')].map(e=>({text:e.textContent,...mark(e)})),
    shapes:[...document.querySelectorAll('.shape,.cp-shape,.mt-shape,.lg-dot,.mt-dot')].filter(e=>e.getClientRects().length).map(mark),
    legend:document.getElementById('cmp-legend')?.textContent||'',
    legendStock:!!document.querySelector('#cmp-legend .lg-dot.stock'),
    glyphs:Object.fromEntries([['card list','#species-list'],['quadrants','#compare .matrix .quadrant'],['legend','#cmp-legend'],['type cards','#compare .mt-card'],
      ['data table','#comparison'],['profile','#cmp-profile,#cmp-drawer'],['value legend','#value-legend,#map-legend'],['side panel','#side-panel']]
      .map(([k,s])=>[k,(text(s).match(G)||[''])[0]])),
    read:document.getElementById('cmp-read-pop')?.textContent||'',
    method:document.querySelector('.method-bottom')?.textContent||'',
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
},[STOCK,GLYPH.source]);
const shot=(page,name,sel)=>sel?page.locator(sel).first().screenshot({path:`${OUT}/${STAGE}-${name}.png`}):page.screenshot({path:`${OUT}/${STAGE}-${name}.png`});

{
  const {page,errors}=await open(1440,900);
  // explore: the species list cards and the right panel
  await shot(page,'explore-list','#species-list');
  measured.explore=await probe(page);
  // '활용 × 보전' layer: the 2×2 key of the map
  await page.evaluate(()=>document.querySelector('[data-map-mode=value],[data-mode=value]')?.click());await page.waitForTimeout(800);
  measured.valueLayer=await probe(page);await shot(page,'1440-explore-value');
  // compare: matrix with 살오징어 selected (a stock-decline species), then the read popover
  await toCompare(page);await page.evaluate(()=>pickCompare(342067));await page.waitForTimeout(600);
  measured.matrix=await probe(page);await shot(page,'1440-compare-matrix','#cmp-matrix-view');
  await page.evaluate(()=>document.getElementById('cmp-read-toggle').click());await page.waitForTimeout(300);
  measured.readOpen=await probe(page);await shot(page,'1440-compare-read','#cmp-matrix-view');
  await page.evaluate(()=>document.getElementById('cmp-read-toggle').click());
  // a dense cluster opened: the listed names and their marks
  measured.cluster=await page.evaluate(async()=>{const b=document.querySelector('#matrix-points .matrix-cluster-btn');if(!b)return null;b.click();await new Promise(r=>setTimeout(r,400));
    const pop=document.getElementById('matrix-cluster-pop'),marks=[...pop.querySelectorAll('i,.shape,.mt-dot,.lg-dot')].map(e=>{const s=getComputedStyle(e);return {cls:e.className,clip:s.clipPath,radius:s.borderTopLeftRadius,transform:s.transform};});
    return {open:!pop.hidden,text:pop.textContent,marks};});
  await shot(page,'1440-compare-cluster','#cmp-matrix-view');
  await page.evaluate(()=>closeClusterPop(false));
  // the weight slider at both ends: a species changes type, so its point colour changes and its shape stays
  measured.weight={};
  for(const k of [0,20]){await page.evaluate(k=>setBbviStep(k),k);await page.waitForTimeout(500);measured.weight[k]=(await probe(page)).points;}
  await page.evaluate(()=>setBbviStep(weightStep(officialWeight())));await page.waitForTimeout(400);
  // the data table and the profile drawer of 살오징어
  await toCompare(page,'table');measured.table=await probe(page);await shot(page,'1440-compare-table','#cmp-table-view');
  measured.tableSquid=await page.evaluate(()=>document.querySelector('[data-score-aphia="342067"][data-score-axis=MCUI]')?.outerHTML||'');
  await toCompare(page);measured.profile=await probe(page);
  // method: '자료를 읽을 때'
  await page.evaluate(()=>setView('method'));await page.waitForTimeout(500);measured.methodView=await probe(page);
  measured.errors1440=errors;
  await page.close();
}
{
  const {page,errors}=await open(390,844);
  await toCompare(page);await shot(page,'390-compare-matrix','#cmp-matrix-view');
  measured.m390=await probe(page);measured.errors390=errors;await page.close();
}
measured.overflow={};
for(const w of [390,768,1100,1440]){const {page,errors}=await open(w,900);const o={explore:(await probe(page)).over};
  await toCompare(page);o.matrix=(await probe(page)).over;await toCompare(page,'table');o.table=(await probe(page)).over;
  await page.evaluate(()=>setView('method'));await page.waitForTimeout(300);o.method=(await probe(page)).over;o.errors=errors.length;measured.overflow[w]=o;await page.close();}
fs.writeFileSync(`${OUT}/${STAGE}-measured.json`,JSON.stringify(measured,null,1));

if(STAGE==='after'){
  const M=measured, pts=M.matrix.points, before=JSON.parse(fs.readFileSync(`${OUT}/before-measured.json`,'utf8'));
  log('Matrix: every species point is a round <button> with no ::before diamond',pts.length>0&&pts.every(p=>p.tag==='BUTTON'&&p.round&&(p.before==='none'||p.before==='normal')&&!/stock/.test(p.cls)),pts.filter(p=>!p.round||(p.before!=='none'&&p.before!=='normal')).map(p=>p.name));
  const norm=pts.filter(p=>!p.current&&!p.clustered&&!STOCK.includes(p.aphia)),stock=pts.filter(p=>STOCK.includes(p.aphia)&&!p.current&&!p.clustered);
  const widths=new Set(norm.map(p=>p.w));
  log('Stock-decline species (우뭇가사리·참조기) draw like every other point: same element, same size, own type colour',stock.length>0&&stock.every(p=>widths.has(p.w)&&p.bg===norm.find(n=>n.type===p.type)?.bg||!norm.some(n=>n.type===p.type)&&widths.has(p.w)),stock.map(p=>[p.name,p.w,p.type,p.bg]));
  const squid=pts.find(p=>p.aphia===342067);
  log('살오징어 (selected) is the large ring circle in its type colour; aria-label keeps 자원 감소',squid&&squid.round&&squid.current&&/자원 감소/.test(squid.aria)&&/자원 감소/.test(squid.title),squid&&{w:squid.w,bg:squid.bg,aria:squid.aria});
  log('Quadrant names: four marks, all circles of the same size in the type colour',M.matrix.quadrants.length===4&&M.matrix.quadrants.every(q=>q.round&&q.w===M.matrix.quadrants[0].w),M.matrix.quadrants.map(q=>[q.text,q.clip,q.radius,q.w]));
  const allShapes=[M.explore,M.valueLayer,M.matrix,M.table,M.profile].flatMap(x=>x.shapes).filter(s=>!/lg-dot/.test(s.cls));
  log('Type marks (explore cards, panel, 2×2 key, type cards, profile, table): all circles, no clip-path or 45° turn',allShapes.length>0&&allShapes.every(s=>s.round&&s.transform==='none'),allShapes.filter(s=>!s.round||s.transform!=='none').map(s=>s.cls));
  const glyphs=Object.entries({...M.explore.glyphs,...Object.fromEntries(Object.entries(M.matrix.glyphs).map(([k,v])=>['matrix '+k,v])),...Object.fromEntries(Object.entries(M.table.glyphs).map(([k,v])=>['table '+k,v]))}).filter(([,v])=>v);
  log('No ▲ ■ ◆ ◇ △ □ in the card list, quadrants, legend, type cards, data table, profile, map legend or side panel',glyphs.length===0,glyphs);
  log("Legend: no '자원 감소 신호' item; 선택한 종 stays",!M.matrix.legendStock&&!M.matrix.legend.includes('자원 감소 신호')&&M.matrix.legend.includes('선택한 종'),M.matrix.legend);
  log('Data table: 살오징어 MCUI keeps 60.0 (LC + 자원 감소) and has no ◆ mark',/60\.0<small class="cv-cat">\(LC \+ 자원 감소\)<\/small>/.test(M.tableSquid)&&!/◆|cv-stock/.test(M.tableSquid),M.tableSquid.slice(0,300));
  const readNew='두 값은 따로 봅니다 · 점 색은 유형입니다 · 자원 감소 신호로 정한 MCUI는 숫자 옆 괄호와 점 툴팁에 적습니다';
  log("'읽는 법' has the new sentence and no 마름모",M.readOpen.read.includes(readNew)&&!M.readOpen.read.includes('마름모'));
  log("'자료를 읽을 때' has the new sentence and no 마름모",M.methodView.method.includes('자원 감소 신호(KOSIS 어획량 추세)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘자원 감소’로 적습니다.')&&!M.methodView.method.includes('마름모'));
  const bp=new Map(before.matrix.points.map(p=>[p.aphia,p]));
  const moved=pts.filter(p=>{const b=bp.get(p.aphia);return !b||b.left!==p.left||b.bottom!==p.bottom||b.mp!==p.mp||b.type!==p.type;});
  log('Types, colours and positions of all points are the same as before',pts.length===before.matrix.points.length&&moved.length===0,moved.map(p=>p.name));
  const w0=new Map(M.weight[0].map(p=>[p.aphia,p])),changed=M.weight[20].filter(p=>w0.get(p.aphia)&&w0.get(p.aphia).type!==p.type);
  log('Weight slider ends: species that change type change colour and stay circles',changed.length>0&&changed.every(p=>p.round&&w0.get(p.aphia).round&&p.mp!==w0.get(p.aphia).mp)&&[...M.weight[0],...M.weight[20]].every(p=>p.round),changed.map(p=>[p.name,w0.get(p.aphia).type,p.type]));
  log('Dense cluster opened: listed marks are circles or plain names (no polygon, no 45° turn)',!!M.cluster?.open&&M.cluster.marks.every(m=>m.clip==='none'&&m.transform==='none'),M.cluster);
  log('390 matrix: points are circles',M.m390.points.length>0&&M.m390.points.every(p=>p.round));
  const over=Object.entries(M.overflow).filter(([,o])=>o.explore>0||o.matrix>0||o.table>0||o.method>0);
  log('No horizontal overflow at 390·768·1100·1440 (explore, matrix, table, method)',over.length===0,M.overflow);
  const errs=[...M.errors1440,...M.errors390,...Object.values(M.overflow).filter(o=>o.errors)];
  log('No console errors',errs.length===0,errs);
  fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
  console.log(`${results.filter(r=>r.ok).length} PASS / ${results.filter(r=>!r.ok).length} FAIL`);
}
await browser.close();
