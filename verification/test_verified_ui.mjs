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
  globalThis.state=axisState;
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
for(const s of next.species.slice(0,5))assert.match(dom.comparison.innerHTML,new RegExp(`data-score-aphia="${s.aphiaID}" data-score-axis="OCC"`),`${s.label} occurrence button`);
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
// Axis fault: only MFPI and the dependent BBVI are hidden as a technical error; MBPI and MCUI stay.
let oyster=next.species[0];
assert.equal(ctx.score(oyster,'MFPI'),null,'browser must reject score that differs from its trace');
assert.equal(oyster.assessment.axis_errors.MFPI,'technical_error');
assert.equal(oyster.assessment.axis_errors.BBVI,'technical_error');
assert.equal(ctx.score(oyster,'MCUI'),original.species.find(s=>s.aphia_id===836033).scores.MCUI,'one axis error must not hide other axes');
assert.equal(ctx.state(oyster,'MFPI').label,'기술 오류');
assert.notEqual(ctx.state(oyster,'MBPI').kind,'technical_error');
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
assert.equal(ctx.score(next.species[0],'MFPI'),null,'browser must recalculate percentile from frozen peer values, not trust a self-consistent forged score');
assert.equal(next.species[0].assessment.axis_errors.MFPI,'technical_error');
const falsePeer=report();
falsePeer.species.find(s=>s.aphia_id===145721).food_trace.nutrients.protein_g.peer_values[0].value=0.1;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>falsePeer});
next={live:true,species:[sp(145721,'Undaria pinnatifida','미역')]};await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),null,'changed peer values must invalidate the published rank');
assert.equal(ctx.state(next.species[0],'MFPI').kind,'technical_error');
const badMcui=report();
badMcui.species.find(s=>s.aphia_id===241776).scores.MCUI=60;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>badMcui});
next={live:true,species:[sp(241776,'Apostichopus japonicus','해삼')]};await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MCUI'),null,'MCUI must equal the pilot mapping of its IUCN category');
assert.deepEqual(Object.keys(next.species[0].assessment.axis_errors),['MCUI'],'an MCUI fault leaves MFPI, MBPI and BBVI untouched');
const noName=report();
noName.species.find(s=>s.aphia_id===836033).scientific_name='Another oyster';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>noName});
next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'accepted taxon join needs both name and AphiaID');
assert.equal(ctx.state(next.species[0],'MCUI').label,'기술 오류','identity fault hides the whole species as a technical error');
for(const [fetcher,why] of [[async()=>{throw new Error('offline')},'network'],[async()=>({status:503,ok:false}),'HTTP 503'],
    [async()=>({status:200,ok:true,json:async()=>{throw new SyntaxError('bad json')}}),'unreadable JSON']]){
  ctx.fetch=fetcher;next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
  for(const axis of ['MFPI','MBPI','MCUI','BBVI'])
    assert.equal(ctx.state(next.species[0],axis).label,'조회 실패',`${why}: lookup failure is not a withheld score`);
}
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

// All 30 published rows (8 operating + 22 candidates) attach without a technical or lookup fault.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};
await ctx.attach(next);
assert.equal(next.species.length,30);
for(const s of next.species){
  assert.equal(s.assessmentState,undefined,`${s.label}: no species-level fault`);
  assert.equal(Object.keys(s.assessment.axis_errors).length,0,`${s.label}: no axis fault in the published report`);
  const row=[...original.species,...original.candidate_species].find(r=>r.aphia_id===s.aphiaID);
  for(const axis of ['MFPI','MBPI','MCUI','BBVI'])assert.equal(ctx.score(s,axis),row.scores[axis],`${s.label} ${axis}`);
}
// Ecklonia 67.5: the scored ACE measurements come first; the SARS-CoV 3CLpro paper is only a follow-up lead.
ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
html=ctx.renderScores(next.species.find(s=>s.aphiaID===371986));
const mbpiBody=html.slice(html.indexOf('data-axis="MBPI"'),html.indexOf('data-axis="MCUI"'));
for(const text of ['점수에 쓴 값 · dieckol','1.47','ACE:EC-3.4.15.1','HHL25mM','wijesinghe-2011-cell-free-ACE-IC50','90 × 근거 계수 0.75 = 67.5','10.4162/nrp.2011.5.2.93','독립 원논문 1편','최댓값'])
  assert.ok(mbpiBody.includes(text),`Ecklonia MBPI evidence missing ${text}`);
assert.ok(mbpiBody.indexOf('dieckol')<mbpiBody.indexOf('후속 조사 단서'),'scored ACE evidence precedes the leads');
assert.ok(mbpiBody.indexOf('후속 조사 단서')<mbpiBody.indexOf('3CLpro'),'3CLpro appears only under follow-up leads');
assert.doesNotMatch(mbpiBody,/점수 제외/);

// BBVI: a held report value is never recomputed; the weight re-mixes only a BBVI the report found eligible.
const withBio=(status,bbvi)=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033),e=r.candidate_species.find(s=>s.aphia_id===371986);
  o.bioactivity_trace=structuredClone(e.bioactivity_trace);o.scores.MBPI=67.5;o.score_status.MBPI='산출됨';
  o.scores.BBVI=bbvi;o.score_status.BBVI=status;return r;};
const oysterOnly=async r=>{ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);return next.species[0];};
oyster=await oysterOnly(withBio('산출됨',66.5));
assert.equal(ctx.score(oyster,'BBVI'),66.5);
vm.runInContext('bbviWeight=.8',ctx);
assert.equal(ctx.score(oyster,'BBVI'),65.9,'weight updates an eligible BBVI');
oyster=await oysterOnly(withBio('산출 보류',null));
assert.equal(ctx.score(oyster,'MBPI'),67.5);
assert.equal(ctx.score(oyster,'BBVI'),null,'a single-paper hold is not bypassed by pilotScore');
vm.runInContext('bbviWeight=.5',ctx);
assert.equal(ctx.score(oyster,'BBVI'),null);

// Peptide and small-molecule MBPI are validated as separate strata.
const peptide=()=>({stratum_kind:'peptide',stratum_id:'ahtpdb-ace-ic50-hhl-cushman-cheung',peptide_sequence:'AEYLCEAC',pIC50:2.368,
  peer_peptides:352,percentile:1.42,evidence_factor:.75,adjusted:1.065,original_paper_dois:['10.3389/fnut.2022.981163']});
const withPeptide=trace=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033);o.bioactivity_trace=trace;o.scores.MBPI=1.1;o.score_status.MBPI='산출됨';return r;};
oyster=await oysterOnly(withPeptide([peptide()]));
assert.equal(ctx.score(oyster,'MBPI'),1.1,'peptide stratum accepted by its own rule');
oyster=await oysterOnly(withPeptide([{...peptide(),peptide_sequence:undefined}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','peptide without a sequence is rejected');
oyster=await oysterOnly(withPeptide([{...peptide(),stratum_kind:undefined,compound_id:'CID:1'}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','a peptide row cannot pass as a small molecule');
oyster=await oysterOnly(withPeptide([peptide(),{...original.candidate_species.find(s=>s.aphia_id===371986).bioactivity_trace[0],adjusted:1.0,percentile:1.3333333}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','peptide and compound strata never mix');
assert.equal(ctx.score(oyster,'MFPI'),65.5,'an MBPI fault leaves MFPI');

// National MCUI is its own branch and never passes as a global IUCN value.
const withNational=(basis,score)=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033);
  o.national_assessment={...o.national_red_list_fact,label:'국가 평가'};o.mcui_basis=basis;o.scores.MCUI=score;o.score_status.MCUI='산출됨';return r;};
oyster=await oysterOnly(withNational('national',10));
assert.equal(ctx.score(oyster,'MCUI'),10,'reviewed national LC maps to 10 in its own stratum');
vm.runInContext('data=globalThis.next',Object.assign(ctx,{next}));
assert.match(ctx.renderScores(oyster),/한국 국가 평가 기반 시범 MCUI[^]*1371쪽/);
oyster=await oysterOnly(withNational('national',35));
assert.equal(ctx.state(oyster,'MCUI').kind,'technical_error','national score must equal its category mapping');
oyster=await oysterOnly(withNational(undefined,10));
assert.equal(ctx.state(oyster,'MCUI').kind,'technical_error','a national fact cannot pass as a global IUCN MCUI');
console.log('PASS: v2 report joins, screen values equal report, MFPI/MCUI traces, blank-as-missing, IUCN states, inconsistent-score guards, research candidates');
