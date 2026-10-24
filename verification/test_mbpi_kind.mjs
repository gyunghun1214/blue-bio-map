// MBPI evidence kind (2026-10-15), offline on dist/live-snapshot.json the way test_weight_slider runs it: the kind beside
// MBPI (의약 표적 / 기능성 펩타이드) and the ACE·XO share match an independent count from the report (method.mbpi_rx's
// excluded strata, the item MBPI takes); the profile shows MBPI-Rx beside MBPI, '—' where it has no value (2026-10-17, LKH:
// no '근거 없음' on screen), never 0; nothing here moves a score or a type; the two presets sit at w = 0.25 / 0.75, the
// report's sensitivity weights.
// Run: node verification/test_mbpi_kind.mjs            (checks)
//      node verification/test_mbpi_kind.mjs --write F  (also writes the 30-species table and the preset type changes to F)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');
const nodes=new Map();
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(k,v){this['@'+k]=v},getAttribute(k){return this['@'+k]??null},removeAttribute(){},toggleAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
  scrollIntoView(){},contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
const ctx={AbortSignal,structuredClone,console,URLSearchParams,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(){}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8'),ctx); // as on the page: language and dictionaries (i18n.js) before app.js
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={scoreText,mbpiKindOf,mbpiKindShare,cpMbpiKind,mbpiRxOf,mbpiFirstLine,pilotScore,matrixType,officialType,'+
  'assessedForMatrix,matrixTypeLabel,set w(v){bbviWeight=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);
const S=data.species, report=JSON.parse(read('assessments.json'));
const rows=new Map([...report.species,...report.candidate_species].map(r=>[r.aphia_id,r]));
const excluded=new Set(report.method.mbpi_rx.excluded_strata);
assert.equal(S.length,30,'30 species');

// (1) the kind and the share, against an independent count from the report
const before=JSON.stringify(S.map(s=>['MFPI','MBPI','MCUI','BBVI'].map(k=>T.pilotScore(s,k)).concat(T.matrixType(s))));
const table=[];
for(const s of S){
  const r=rows.get(s.aphiaID), items=r.bioactivity_trace||[], k=T.mbpiKindOf(s);
  if(!items.length||r.mbpi_floor||r.scores.MBPI===null){assert.equal(k,null,`${s.label}: no kind without an item`);table.push({s,r,k});continue;}
  const top=items.reduce((p,x)=>!p||x.adjusted>p.adjusted?x:p,null), fn=items.filter(x=>excluded.has(x.stratum_id)).length;
  assert.ok(k,`${s.label}: a kind`);
  assert.equal(k.kind,excluded.has(top.stratum_id)?'functional':'drug',`${s.label}: kind of the top item`);
  assert.equal(k.items,items.length);assert.equal(k.functionalItems,fn);assert.equal(k.share,fn/items.length);
  assert.equal(k.long,k.kind==='functional'?'기능성 펩타이드(ACE·XO)':'의약 표적(항균·항암·기타 표적)');
  // MBPI equals the top item, so a functional top means MBPI comes wholly from the ACE·XO strata
  assert.ok(Math.abs(r.scores.MBPI-top.adjusted)<.06,`${s.label}: MBPI is the top item`);
  table.push({s,r,k,top});
}
const ace=[...rows.values()].reduce((n,r)=>n+(r.bioactivity_trace||[]).filter(x=>x.stratum_id==='ahtpdb-ace-ic50-hhl-cushman-cheung').length,0);
const functionalTop=table.filter(t=>t.k?.kind==='functional');
console.log(`ACE 펩타이드 항목 ${ace}개 · 최상위 근거가 기능성 펩타이드인 종 ${functionalTop.length}종 · 의약 표적 ${table.filter(t=>t.k?.kind==='drug').length}종`);

const t0=r=>(r.bioactivity_trace||[]).reduce((p,x)=>!p||x.adjusted>p.adjusted?x:p,null);
// (2) the profile: the kind badge and MBPI-Rx beside MBPI; no value reads '—', never 0, '없음' or '근거 없음'
for(const {s,r,k} of table){
  const h=T.cpMbpiKind(s), rx=T.mbpiRxOf(s);
  if(k)assert.ok(h.includes(`<span class="cp-kind-badge" data-kind="${k.kind}">${k.long}</span>`)&&h.includes(T.mbpiKindShare(k)),`${s.label}: badge`);
  if(rx&&rx.value===null){assert.equal(r.mbpi_rx.value,null);assert.ok(h.includes('<span class="cp-rx-none">—</span>')&&!h.includes('근거 없음')&&!h.includes('cp-rx-num'),`${s.label}: no MBPI-Rx`);}
  // 2026-10-19 (LKH 9/10): MBPI-Rx is on the MBPI scale and reads as MBPI does, a whole number; the same item gives the same text
  if(rx&&rx.value!==null){const same=(r.bioactivity_trace||[])[r.mbpi_rx.top_item.trace_index]===t0(r), txt=T.scoreText(s,'MBPI',r.mbpi_rx.value);
    assert.ok(/^\d+$/.test(txt)&&h.includes(`<b class="cp-rx-num">${txt}</b>`),`${s.label}: MBPI-Rx ${r.mbpi_rx.value}`);
    if(same)assert.equal(txt,T.scoreText(s,'MBPI',T.pilotScore(s,'MBPI')),`${s.label}: same item reads as MBPI`);}
  if(k)assert.ok(T.mbpiFirstLine(s).includes(`근거 종류: ${k.long} · ${T.mbpiKindShare(k)}`),`${s.label}: detail line`);
}
// a species whose drug-target items are all gone has a functional top and no MBPI-Rx; the reverse never happens
for(const t of table.filter(t=>t.r.mbpi_rx?.value===null&&t.k))assert.equal(t.k.kind,'functional',t.s.label);
for(const t of table.filter(t=>t.k?.kind==='drug'))assert.equal(t.r.mbpi_rx.value,t.r.scores.MBPI,`${t.s.label}: a drug-target top gives MBPI-Rx = MBPI`);
// an unclassified stratum hides the kind (the same gate as MBPI-Rx)
{const keep=data.assessmentInfo.method.mbpi_rx.classified_strata, c={...keep};delete c['ahtpdb-ace-ic50-hhl-cushman-cheung'];
  data.assessmentInfo.method.mbpi_rx.classified_strata=c;const wakame=S.find(s=>s.aphiaID===145721);
  assert.equal(T.mbpiKindOf(wakame),null,'unclassified stratum → no kind');data.assessmentInfo.method.mbpi_rx.classified_strata=keep;}
assert.equal(JSON.stringify(S.map(s=>['MFPI','MBPI','MCUI','BBVI'].map(k=>T.pilotScore(s,k)).concat(T.matrixType(s)))),before,'no score or type moved');

// (3) the presets: w = 0.25 (신약 중심) and 0.75 (식량 중심), steps 5 and 15; the official 0.50 stays the default
const html=read('index.html');
assert.deepEqual([...html.matchAll(/data-w-preset="(\d+)"[^>]*>([^<]+)</g)].map(m=>[m[1],m[2]]),[['5','신약 중심 · MBPI 0.75'],['10','균형 · 0.5'],['15','식량 중심 · MFPI 0.75']]);
assert.match(html,/id="bbvi-weight"[^>]*value="10"/);
assert.equal(data.assessmentInfo.foodWeight,.5);
const moved=w=>{T.w=w;try{return S.filter(s=>T.matrixType(s)!==T.officialType(s)).map(s=>({s,from:T.officialType(s),to:T.matrixType(s),bbvi:T.pilotScore(s,'BBVI')}));}finally{T.w=.5;}};
// every re-mixed BBVI at 0.25 / 0.75 equals the report's own sensitivity value (±0.1, both round to one decimal)
for(const w of ['0.25','0.75']){T.w=Number(w);for(const s of S){const v=T.pilotScore(s,'BBVI'),o=rows.get(s.aphiaID).sensitivity?.food_weights?.[w];if(v!==null&&o!=null)assert.ok(Math.abs(v-o)<=.1+1e-9,`${s.label} w ${w}`);}T.w=.5;}
const bio=moved(.25), food=moved(.75);
console.log(`유형이 바뀌는 종: 신약 중심(w 0.25) ${bio.length}종 · 식량 중심(w 0.75) ${food.length}종`);

const out=process.argv.indexOf('--write');
if(out>0){
  const pct=k=>k?`${Math.round(k.share*100)}% (${k.functionalItems}/${k.items})`:'—';
  const kind=k=>k?k.long:'—';
  const rx=r=>r.mbpi_rx?.value==null?'의약 표적 근거 없음':r.mbpi_rx.value.toFixed(1);
  const type=t=>t?T.matrixTypeLabel(t):'유형 없음';
  const lines=[`# MBPI 근거 종류 표 (${report.method_version||data.assessmentInfo.version}, 2026-10-15)`,'',
    '`node verification/test_mbpi_kind.mjs --write <file>`로 만든 표입니다. 화면(app.js `mbpiKindOf`)과 같은 규칙입니다. 기능성 펩타이드 = MBPI-Rx 사전 등록에서 제외로 분류한 층(ACE 저해 펩타이드, 잔틴 산화효소 저해 펩타이드), 의약 표적 = 그 밖의 층(항균·항암·ChEMBL 표적 등). ACE 의존도 = 점수 항목 중 ACE·XO 층 항목의 비율. MBPI는 가장 높은 항목 하나의 값이라, 최상위 근거가 기능성 펩타이드이면 MBPI 전체가 그 층에서 나옵니다.','',
    `- ACE 펩타이드 층 항목: ${ace}개 (30종 합계)`,`- 최상위 근거가 기능성 펩타이드인 종: ${functionalTop.length}종 (${functionalTop.map(t=>t.s.label).join(', ')})`,
    `- MBPI-Rx(의약 표적만) 값이 없는 종: ${table.filter(t=>t.r.mbpi_rx?.value==null).length}종`,'',
    '| 종 | ACE·XO 의존도 | 최상위 근거 종류 | 최상위 근거 층 | MBPI | MBPI-Rx |','|---|---|---|---|---:|---:|',
    ...table.map(({s,r,k,top})=>`| ${s.label} | ${pct(k)} | ${kind(k)} | ${(top?.stratum_id||'—').replaceAll('|','\\|')} | ${r.scores.MBPI==null?'—':r.scores.MBPI.toFixed(1)} | ${rx(r)} |`),'',
    '## 프리셋을 눌렀을 때 유형이 바뀌는 종','',`공식값(w = 0.50) 대비. w는 BBVI 안 MFPI(식량)의 비중입니다. 공식 산출값은 바뀌지 않으며, 탐색 보기에서만 바뀝니다.`,'',
    ...[['신약 중심 (w = 0.25, MBPI 0.75)',bio],['식량 중심 (w = 0.75, MFPI 0.75)',food]].flatMap(([name,list])=>[`### ${name}: ${list.length}종`,'',
      ...(list.length?['| 종 | BBVI(탐색 보기) | 공식 유형 → 바뀐 유형 |','|---|---:|---|',...list.map(m=>`| ${m.s.label} | ${m.bbvi.toFixed(1)} (공식 ${rows.get(m.s.aphiaID).scores.BBVI.toFixed(1)}) | ${type(m.from)} → ${type(m.to)} |`)]:['없음']),'']),
    '## 점수 변화','','dist/assessments.json, dist/matrix-readiness.json은 이 변경에서 바뀌지 않았습니다. 이 검사는 표시를 그린 뒤에도 30종의 네 지표 값과 유형이 그대로인지 확인합니다.',''];
  fs.writeFileSync(process.argv[out+1],lines.join('\n'));
}
console.log('PASS: MBPI evidence kind = independent count (top item, ACE·XO share) · profile badge + MBPI-Rx beside MBPI, — never 0 · detail line · unclassified stratum hides it · no score or type moved · presets w 0.25 / 0.75 match report sensitivity');
