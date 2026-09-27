import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const report=()=>structuredClone(original);
const sp=(aphiaID,name,label)=>({aphiaID,name,label,live:true});
const all=()=>original.species.map(s=>sp(s.aphia_id,s.scientific_name,s.korean_name));
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>report()})};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+`;
  globalThis.attach=attachPilotAssessments;
  globalThis.score=pilotScore;
  globalThis.renderScores=renderVerifiedIndices;
  globalThis.coverage=evidenceCoverage;
  globalThis.coverageBar=coverageBar;`,ctx);

let next={live:true,species:all()};
await ctx.attach(next);
const by=aphia=>next.species.find(s=>s.aphiaID===aphia);
// Every value shown in the browser equals the reproducible report (score trace <-> screen match).
for(const s of original.species)for(const axis of ['MFPI','MBPI','MCUI','BBVI'])
  assert.equal(ctx.score(by(s.aphia_id),axis),s.scores[axis],`${s.korean_name} ${axis}`);
assert.equal(ctx.score(by(836033),'MFPI'),65.5);
assert.equal(ctx.score(by(241776),'MCUI'),80);
assert.equal(ctx.score(by(836033),'BBVI'),null,'one axis cannot become combined BBVI');
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);

let html=ctx.renderScores(by(836033));
for(const text of ['9.66 g','8.72 mg','15.9 mg','K4040020000a','rda-10.4-raw-marine-animals','25개 식품','자료 신뢰도 감점','가식부 16.0%','교차 점검','65.6','검증 전 시범 지표','비교하지 않습니다'])
  assert.ok(html.includes(text),`missing visible trace: ${text}`);
assert.match(html,/BBVI.*산출 보류/s);
html=ctx.renderScores(by(506159));
assert.match(html,/아연 결측\(빈칸\)/,'blank zinc shown as missing, not zero');
assert.match(html,/빈칸은 0이 아니라 결측/);
html=ctx.renderScores(by(241776));
for(const text of ['EN A2bd','2025-09-30','EN -&gt; 80','IUCN 기반 시범 MCUI, 출현 추세 교차검증 미완료','이전 평가'])
  assert.ok(html.includes(text),`missing conservation fact: ${text}`);
html=ctx.renderScores(by(342067));
assert.match(html,/Needs updating/);assert.match(html,/10년 넘은 평가/);
assert.match(html,/구조 ID ✗/,'bioactivity chain step shown');
html=ctx.renderScores(by(145721));
assert.match(html,/공식 NE 범주나 낮은 점수가 아닙니다/);
assert.match(html,/결과 0건/);
html=ctx.renderScores(by(494972));
for(const fact of ['Sargassum fusiformis','63.16 ± 3.6 µg/mL','MCF-7','10.1002/cbdv.202100848','구조 ID ✗','시료 연도 원문에서 미확인','Publisher terms'])
  assert.ok(html.includes(fact),`unscored paper-local result must retain ${fact}`);
assert.equal(ctx.score(by(494972),'MBPI'),null);
assert.equal(ctx.score(by(494972),'BBVI'),null);

// The old operational summary has no IUCN assessment count, despite a separately
// reviewed MCUI: coverage must follow the accepted report, not the stale counter.
const liveMeta={wormUrl:'https://www.marinespecies.org/',cells:[{sizeDeg:4}],
  info:{conservation:{status:'withheld_insufficient_evidence',assessment_count:0},
    nutrition:{status:'available',record_count:50},
    compounds:{status:'available',compound_count:122,quantitative_bioactivity_count:500}}};
for(const id of [241776,342067]){
  Object.assign(by(id),liveMeta);
  assert.equal(ctx.coverage(by(id)).checks[4].stage,'calculated',`MCUI for ${id} must count despite old summary`);
}
Object.assign(by(836033),liveMeta);
assert.equal(ctx.coverage(by(836033)).checks[2].stage,'calculated','reviewed MFPI is independent of inventory counts');
assert.notEqual(ctx.coverage(by(836033)).checks[3].stage,'calculated','500 inventory entries cannot become MBPI');
assert.equal(ctx.coverage(by(836033)).checks[4].stage,'unavailable','IUCN search miss is not an assessment');
assert.match(ctx.coverageBar(by(836033)),/종 연결/);
assert.doesNotMatch(ctx.coverageBar(by(836033)),/3\/5|점수 3/);
for(const id of [372119,494972]){
  Object.assign(by(id),liveMeta);
  assert.equal(ctx.score(by(id),'MFPI'),null,'dried values cannot enter fresh cohort');
  assert.equal(ctx.coverage(by(id)).checks[2].stage,'linked','verified source taxon labels retain partial raw values');
}
html=ctx.renderScores(by(372119));
for(const fact of ['MEXT:2023:09025','16.1 g','6 mg','3 mg','dried tengusa'])
  assert.ok(html.includes(fact),`original MEXT dry value missing: ${fact}`);
html=ctx.renderScores(by(494972));
assert.match(html,/0.68 mg/);
assert.match(html,/freeze-dried/);

// Reconcile every published public profile with the frozen report, including the
// two MCUI records whose operational inventory still reports zero assessments.
const snapshot=JSON.parse(fs.readFileSync(new URL('../dist/live-snapshot.json',import.meta.url),'utf8'));
const published={live:true,species:snapshot.profiles.map(p=>({
  aphiaID:p.aphia_id,name:p.scientific_name,label:p.korean_name,live:true,
  wormsUrl:p.public_citations.find(c=>c.id==='worms-taxonomy')?.url,
  cells:snapshot.cells.filter(c=>c.species_id===p.species_id),
  info:p.evidence_summary,noOccurrences:p.evidence_summary.occurrence_status==='not_collected',
  recordCount:p.evidence_summary.record_count
}))};
await ctx.attach(published);
const stages={
  836033:['verified','linked','calculated','linked','unavailable'],
  506159:['verified','linked','linked','linked','unavailable'],
  494972:['verified','linked','linked','linked','unavailable'],
  372119:['verified','linked','linked','found','unavailable'],
  342067:['verified','linked','linked','linked','calculated'],
  250680:['verified','linked','calculated','linked','unavailable'],
  241776:['verified','linked','found','linked','calculated'],
  145721:['verified','linked','calculated','found','unavailable']
};
for(const [id,expected] of Object.entries(stages)){
  const s=published.species.find(x=>x.aphiaID===Number(id));
  assert.deepEqual(Array.from(ctx.coverage(s).checks,c=>c.stage),expected,`${s.label}: published snapshot versus report`);
  assert.equal(ctx.score(s,'BBVI'),null);
}

// The side-by-side table must name each incompatible MFPI cohort where a number appears.
// Same elements as index.html: five species per page with a page label and prev/next buttons.
const el=()=>({innerHTML:'',textContent:'',disabled:false,handlers:{},querySelectorAll(){return []},
  addEventListener(type,fn){this.handlers[type]=fn},click(){this.handlers.click()}});
const dom={comparison:el(),'comparison-page':el(),'comparison-prev':el(),'comparison-next':el()};
ctx.document={getElementById:id=>dom[id]??null};
vm.runInContext(app.slice(app.indexOf('function renderComparison(){'),app.indexOf('function toggleSimulation('))+';globalThis.compare=renderComparison',ctx);
// Wire the buttons with the app's own listener lines, not a copy of their logic.
vm.runInContext(app.split('\n').filter(l=>/^\$\('comparison-(prev|next)'\)\.addEventListener/.test(l)).join('\n'),ctx);
for(const item of next.species)Object.assign(item,{cells:[],noOccurrences:true,info:{nutrition:{status:'not_collected'},compounds:{status:'not_collected'},conservation:{status:'not_reviewed'}}});
const headers=()=>[...dom.comparison.innerHTML.matchAll(/<th scope="col">([^<]+)<small>/g)].map(m=>m[1]);
const labels=next.species.map(s=>s.label);
assert.equal(labels.length,8);
ctx.compare();
assert.deepEqual(headers(),labels.slice(0,5),'first page shows species 1-5');
assert.equal(dom['comparison-page'].textContent,'1 / 2 · 1–5종');
assert.equal(dom['comparison-prev'].disabled,true);assert.equal(dom['comparison-next'].disabled,false);
// Page 1 happens to hold both cohorts (미역 seaweed, 멍게 animal); assert each against its own column.
assert.match(dom.comparison.innerHTML,/고정 비교집단 수산동물 25개 식품 · 집단 간 점수 비교 불가/);
assert.match(dom.comparison.innerHTML,/고정 비교집단 해조류 3개 식품 · 집단 간 점수 비교 불가/);
assert.match(dom.comparison.innerHTML,/data-score-aphia="145721" data-score-axis="MFPI"[^>]*해조류 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/data-score-aphia="250680" data-score-axis="MFPI"[^>]*수산동물 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/>42\.2<small>검증 전 시범 지표/);assert.match(dom.comparison.innerHTML,/>54\.2<small>/);
assert.match(dom.comparison.innerHTML,/>80\.0<small>/);assert.match(dom.comparison.innerHTML,/>10\.0<small>/);
assert.doesNotMatch(dom.comparison.innerHTML,/65\.5/,'page 2 species must not leak into page 1');
dom['comparison-next'].click();
assert.deepEqual(headers(),labels.slice(5),'next page shows species 6-8');
assert.equal(dom['comparison-page'].textContent,'2 / 2 · 6–8종');
assert.equal(dom['comparison-prev'].disabled,false);assert.equal(dom['comparison-next'].disabled,true);
assert.match(dom.comparison.innerHTML,/data-score-aphia="836033" data-score-axis="MFPI"[^>]*수산동물 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/>65\.5<small>검증 전 시범 지표/);
assert.doesNotMatch(dom.comparison.innerHTML,/해조류 3개 식품/,'no seaweed MFPI on page 2');
assert.match(dom.comparison.innerHTML,/data-score-aphia="506159" data-score-axis="MFPI"[^>]*>일부 근거 확인<small>필수 성분 결측 · 보기/,'unscored species stay withheld, not zero');
dom['comparison-next'].click();
assert.equal(dom['comparison-page'].textContent,'2 / 2 · 6–8종','next stops at the last page');
dom['comparison-prev'].click();
assert.deepEqual(headers(),labels.slice(0,5),'previous page returns to species 1-5');
assert.equal(dom['comparison-page'].textContent,'1 / 2 · 1–5종');
dom['comparison-prev'].click();
assert.equal(dom['comparison-page'].textContent,'1 / 2 · 1–5종','prev stops at the first page');

const bad=report();
bad.species.find(s=>s.aphia_id===836033).scores.MFPI=99;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>bad});
next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'browser must reject score that differs from its trace');
const falseRank=report();
const falseFood=falseRank.species.find(s=>s.aphia_id===145721);
falseFood.food_trace.nutrients.protein_g.percentile_unrounded=99;
falseFood.food_trace.nutrients.protein_g.percentile=99;
const f=falseFood.food_trace,settings=falseRank.method.nutrition;
const nutrients=Object.values(f.nutrients);
const recalculated=settings.nutrient_weight*nutrients.reduce((sum,n)=>sum+n.percentile_unrounded*n.evidence_factor,0)/nutrients.length+
  100*settings.edible_fraction_weight*f.edible_fraction.value+
  100*settings.aquaculture_weight*Number(f.aquaculture.feasible);
falseFood.scores.MFPI=Math.round(recalculated*10)/10;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>falseRank});
next={live:true,species:[sp(145721,'Undaria pinnatifida','미역')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'browser must recalculate percentile from frozen peer values, not trust a self-consistent forged score');
const falsePeer=report();
falsePeer.species.find(s=>s.aphia_id===145721).food_trace.nutrients.protein_g.peer_values[0].value=0.1;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>falsePeer});
next={live:true,species:[sp(145721,'Undaria pinnatifida','미역')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'changed peer values must invalidate the published rank');
const badMcui=report();
badMcui.species.find(s=>s.aphia_id===241776).scores.MCUI=60;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>badMcui});
next={live:true,species:[sp(241776,'Apostichopus japonicus','해삼')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'MCUI must equal the pilot mapping of its IUCN category');
const noName=report();
noName.species.find(s=>s.aphia_id===836033).scientific_name='Another oyster';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>noName});
next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'accepted taxon join needs both name and AphiaID');
// Research candidates attach only to catalog entries and keep their own label.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
const cand=(aphiaID,name,label)=>({...sp(aphiaID,name,label),catalog:true,audit:{gbif:{retrievedCount:0},nutrition:{},iucn:{}},cells:[]});
next={live:true,species:[cand(231750,'Ruditapes philippinarum','바지락'),cand(275816,'Paralichthys olivaceus','넙치'),sp(397082,'Haliotis discus','전복(종 수준)')]};
await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),52.1);
assert.equal(ctx.score(next.species[1],'MCUI'),null,'not in Red List is never a low score');
assert.equal(next.species[1].assessment.withheld_reasons.MCUI,'not_in_red_list');
assert.equal(next.species[2].assessment,undefined,'a candidate row never attaches as an operating species');
assert.equal(ctx.coverage(next.species[0]).checks.find(c=>c.name==='영양').stage,'calculated');
console.log('PASS: v2 report joins, screen values equal report, MFPI/MCUI traces, blank-as-missing, IUCN states, inconsistent-score guards, research candidates');
