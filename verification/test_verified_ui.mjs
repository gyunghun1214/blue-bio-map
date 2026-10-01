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
  globalThis.summary=scoreSummary;
  globalThis.coverage=evidenceCoverage;
  globalThis.coverageBar=coverageBar;
  globalThis.nationalMcui=nationalMcui;
  globalThis.iucnGlobalNote=iucnGlobalNote;
  globalThis.axisPairs=axisPairsHtml;`,ctx);

let next={live:true,species:all()};
await ctx.attach(next);
const by=aphia=>next.species.find(s=>s.aphiaID===aphia);
// Every value shown in the browser equals the reproducible report (score trace <-> screen match).
for(const s of original.species)for(const axis of ['MFPI','MBPI','MCUI','BBVI'])
  assert.equal(ctx.score(by(s.aphia_id),axis),s.scores[axis],`${s.korean_name} ${axis}`);
assert.equal(ctx.score(by(836033),'MFPI'),71.6);  // 3.6: calcium joins protein, iron and zinc
assert.equal(ctx.score(by(241776),'MCUI'),80);
assert.equal(ctx.score(by(836033),'BBVI'),83.9,'verified-pilot-2.3: the replicated LQP potency lets oyster BBVI through');
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);

let html=ctx.renderScores(by(836033));
for(const text of ['9.66 g','8.72 mg','15.9 mg','K4040020000a','rda-10.4-raw-marine-animals','25개 식품','자료 신뢰도 감점','가식부 16.0%','428 mg','칼슘','검증 전 시범 지표','비교하지 않습니다'])
  assert.ok(html.includes(text),`missing visible trace: ${text}`);
assert.match(html,/data-axis=\"BBVI\"><summary><span>BBVI · 통합 활용<\/span><b>83\.9 · 검증 전 시범 지표<\/b>/);
// 3.3 fills 홍합 zinc from uFiSh; 톳 (a seaweed; uFiSh covers fish and shellfish only) keeps a blank zinc.
// 3.6: that blank is left out of the mean (3 of 4 components) and said so, never scored 0
html=ctx.renderScores(by(494972));
assert.match(html,/아연 값이 비어 있어 평균에서 뺐습니다\(0점 아님/,'blank zinc shown as omitted, not zero');
assert.ok(!html.includes('아연 0 mg'));
// 3.15: 살오징어's missing aquaculture record is now a reviewed 'not feasible' record (Puneeta 2015), so MFPI scores with the
// MEXT zinc substitute and an aquaculture part of 0; MFPI carries its post-hoc validation result (cross-table check passed)
html=ctx.renderScores(by(342067));
assert.match(html,/<b>46\.1 · 시범 지표 · 방법 검증 통과\(11종 비교\)<\/b>/);
assert.match(html,/양식 가능 근거 없음\(양식 점수 0\)/);
assert.doesNotMatch(html,/필수 성분이 모자랍니다/);
html=ctx.renderScores(by(241776));
// 3.4: the MCUI label says the OBIS trend is now an auxiliary element, and the trend is shown beside the IUCN facts
for(const text of ['EN A2bd','2025-09-30','EN -&gt; 80','IUCN 기반 시범 MCUI, OBIS 출현 추세(조사 노력 보정) 보조 반영','이전 평가','OBIS 출현 추세 · 보조 요소'])
  assert.ok(html.includes(text),`missing conservation fact: ${text}`);
html=ctx.renderScores(by(342067));
assert.match(html,/Needs updating/);assert.match(html,/10년 넘은 평가/);
assert.match(html,/구조 ID ✗/,'bioactivity chain step shown');
html=ctx.renderScores(by(145721));
// 3.15 (team-lead decision 2026-10-02): reference only. No IUCN or Korean category, so MCUI stays withheld; the Rapid LC check
// is shown beside it like the BBVI 참고값, with its thresholds and the failed back-test, and is never a score.
assert.match(html,/data-axis="MCUI"><summary><span>MCUI · 보전 평가<\/span><b>산출 보류 · 예비 평가 참고 LC 가능성\(역검증 미통과\) · 점수 아님<\/b>/);
assert.match(html,/공식 NE 범주나 낮은 점수가 아닙니다/);
assert.match(html,/<b>예비 평가\(Rapid LC\) 참고 정보 · MCUI 점수 아님<\/b>: LC 가능성 · EOO 2,122,193 km²\(기준 30,000 초과\) · AOO 30,500 km²/);
assert.match(html,/MCUI 점수·매트릭스·지도 색·순위에 쓰지 않습니다/);
assert.match(html,/방법 역검증\(이미 평가가 있는 14종\): 11종 일치 · 기준 미통과 — LC로 판정한 위협 범주 종: 해삼·전복\(종 수준\)/);
assert.doesNotMatch(html,/시범 MCUI|예비 평가\(Rapid LC[^)]*\) 기반|평가 기록이 아님/);
assert.match(html,/결과 0건/);
html=ctx.renderScores(by(494972));
for(const fact of ['Sargassum fusiformis','63.16 ± 3.6 µg/mL','MCF-7','10.1002/cbdv.202100848','구조 ID ✗','시료 연도 원문에서 미확인','Publisher terms'])
  assert.ok(html.includes(fact),`unscored paper-local result must retain ${fact}`);
// verified-pilot-3.1: the ChEMBL stratum scored 톳 (45.3, one linking paper); 3.10: the synthetic GKY peptide (Suetsuna 1998)
// outranks it at 65.0. The paper-local MCF-7 result stays unscored.
assert.equal(ctx.score(by(494972),'MBPI'),65.0);
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
// 3.15: MFPI passed its post-hoc cross-table check, so a scored MFPI shows the fifth stage
assert.equal(ctx.coverage(by(836033)).checks[2].stage,'validated','reviewed MFPI is independent of inventory counts');
// 3.5: 해삼 has a reviewed peptide MBPI (HDWWKER), so the inventory guard is checked on 살오징어, which has none
assert.notEqual(ctx.coverage(by(342067)).checks[3].stage,'calculated','500 inventory entries cannot become MBPI');
// verified-pilot-2.3: the oyster LQP potency is replicated from another origin, so the single-paper reference label is gone.
assert.equal(ctx.coverage(by(836033)).checks[3].stage,'calculated');
assert.doesNotMatch(ctx.coverage(by(836033)).checks[3].detail,/참고값/);
// IUCN search miss is not an assessment: the oyster's MCUI comes only from the Korean national assessment, labelled as such.
assert.equal(ctx.coverage(by(836033)).checks[4].stage,'calculated');
assert.match(ctx.coverage(by(836033)).checks[4].detail,/한국 국가생물적색자료집.*IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다/);
assert.doesNotMatch(ctx.coverage(by(836033)).checks[4].detail,/IUCN 평가와/);
assert.match(ctx.coverageBar(by(836033)),/종 연결/);
assert.doesNotMatch(ctx.coverageBar(by(836033)),/3\/5|점수 3/);
for(const id of [372119,494972]){
  Object.assign(by(id),liveMeta);
  // 3.6: 톳 scores from its own raw row (3 of 4); the dried zinc value still never fills the blank.
  // 3.15: 우뭇가사리's raw RDA row is linked by its MABIK 국명 and scores 3 of 4 the same way; the dried MEXT tengusa value stays unused.
  assert.equal(ctx.score(by(id),'MFPI'),{372119:76.7,494972:63.3}[id],'dried values cannot enter fresh cohort');
  assert.equal(by(id).assessment.food_trace.nutrients.zinc_mg,undefined);
  assert.equal(ctx.coverage(by(id)).checks[2].stage,'validated','verified source taxon labels retain partial raw values');
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
// 2.1: oyster and mussel MCUI come from the Korean national assessment (labelled apart; see coverage detail test above).
const stages={
  836033:['verified','linked','validated','calculated','calculated'],
  // 3.1: the ChEMBL stratum gives mussel, hijiki and sea squirt a single-paper MBPI (BBVI withheld).
  // 3.3: mussel MFPI is calculated with its species-level uFiSh zinc (the RDA row leaves zinc blank).
  506159:['verified','linked','validated','calculated','calculated'],
  // 3.6: hijiki MFPI is calculated from 3 of 4 components (zinc blank and omitted, calcium added).
  // 3.15: MFPI shows 'validated' (cross-table check passed) and 우뭇가사리·살오징어·해삼 gain an MFPI. A Rapid LC check is
  // reference only (team-lead decision 2026-10-02), so a species without an IUCN or national category keeps MCUI 'unavailable'.
  494972:['verified','linked','validated','calculated','unavailable'],
  // 3.16: Russia's Red Data Book gives 우뭇가사리 a range-state MCUI, so its conservation check reaches '시범 산출'
  372119:['verified','linked','validated','found','calculated'],
  342067:['verified','linked','validated','linked','calculated'],
  250680:['verified','linked','validated','calculated','unavailable'],
  // 3.5: the sea cucumber gets a single-paper peptide MBPI (HDWWKER, Wang 2024).
  241776:['verified','linked','validated','calculated','calculated'],
  // 2.2: wakame's reviewed peptide trace gives a single-paper MBPI; 2.3 gives the oyster a BBVI; 3.12 replicates wakame IY, 3.14 IW (BBVI 71.0).
  145721:['verified','linked','validated','calculated','unavailable']
};
for(const [id,expected] of Object.entries(stages)){
  const s=published.species.find(x=>x.aphiaID===Number(id));
  assert.deepEqual(Array.from(ctx.coverage(s).checks,c=>c.stage),expected,`${s.label}: published snapshot versus report`);
  assert.equal(ctx.score(s,'BBVI'),{836033:83.9,145721:71.0}[id]??null);
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
assert.match(dom.comparison.innerHTML,/>46\.7<small>시범 지표 · 방법 검증 통과\(11종 비교\)/);  // 3.15: MFPI labels read the cross-table result
assert.match(dom.comparison.innerHTML,/>52\.8<small>/);  // 3.6 calcium
// 3.15 (team-lead decision 2026-10-02): reference only. The withheld MCUI keeps its reason and adds one reference line,
// shown like the BBVI 참고값 line; 해삼 (IUCN EN) has no such line.
assert.match(dom.comparison.innerHTML,/data-score-aphia="145721" data-score-axis="MCUI" aria-label="미역 MCUI 산출 보류 · 예비 평가 참고 · LC 가능성 · 역검증 미통과 · 점수 아님 근거 보기">산출 보류<small>IUCN 검색 0건 · 낮은 점수 아님 · 보기<\/small><small>예비 평가 참고 · LC 가능성 · 역검증 미통과 · 점수 아님<\/small><\/button>/);
assert.equal(dom.comparison.innerHTML.match(/<small>예비 평가 참고 · LC 가능성 · 역검증 미통과 · 점수 아님<\/small>/g).length,2,'미역·멍게 on page 1 (3.16: 우뭇가사리 now has a range-state MCUI, so no reference line)');
assert.doesNotMatch(dom.comparison.innerHTML,/data-score-aphia="241776" data-score-axis="MCUI"[^>]*예비 평가/);
// 3.4: 살오징어 MCUI 10.0 -> 20.0 (OBIS reporting-rate decline signal adds 10); 해삼 stays 80.0
assert.match(dom.comparison.innerHTML,/>80\.0<small>/);assert.match(dom.comparison.innerHTML,/data-score-aphia="342067" data-score-axis="MCUI"[^>]*>20\.0<small>/);
assert.doesNotMatch(dom.comparison.innerHTML,/71\.6/,'page 2 species must not leak into page 1');
for(const s of next.species.slice(0,5))assert.match(dom.comparison.innerHTML,new RegExp(`data-score-aphia="${s.aphiaID}" data-score-axis="OCC"`),`${s.label} occurrence button`);
dom['comparison-next'].click();
assert.deepEqual(headers(),labels.slice(5),'next page shows species 6-8');
assert.equal(dom['comparison-page'].textContent,'2 / 2 · 6–8종');
assert.equal(dom['comparison-prev'].disabled,false);assert.equal(dom['comparison-next'].disabled,true);
assert.match(dom.comparison.innerHTML,/data-score-aphia="836033" data-score-axis="MFPI"[^>]*수산동물 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/>71\.6<small>시범 지표 · 방법 검증 통과\(11종 비교\)/);
// 3.3: 홍합 zinc comes from uFiSh. 3.6: 톳 (a seaweed; uFiSh covers fish and shellfish only) leaves its blank zinc out of the mean.
assert.match(dom.comparison.innerHTML,/data-score-aphia="494972" data-score-axis="MFPI"[^>]*해조류 고정 비교집단[^>]*>63\.3<small>시범 지표 · 방법 검증 통과\(11종 비교\)/,'3 of 4 components score');
assert.match(dom.comparison.innerHTML,/data-score-aphia="506159" data-score-axis="MFPI"[^>]*>60\.9<small>시범 지표 · 방법 검증 통과\(11종 비교\)/,'substituted zinc gives a scored MFPI');
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
// 3.15 (team-lead decision 2026-10-02): reference only. A Rapid LC record that carries a value, or a report that turns it into
// an MCUI, is refused as an MCUI fault; the published record itself attaches cleanly (checked with all 30 rows below).
for(const [forge,why] of [[a=>{a.mcui_substitute.value=10;},'a reference value'],
    [a=>{a.scores.MCUI=10;a.score_status.MCUI='산출됨';a.withheld_reasons.MCUI=null;},'an MCUI from the reference'],
    [a=>{a.scores.MCUI=10;a.score_status.MCUI='산출됨';a.withheld_reasons.MCUI=null;a.mcui_basis='preliminary';delete a.mcui_substitute.use;a.mcui_substitute.value=10;},'the old scored preliminary basis']]){
  const forged=report();forge(forged.species.find(s=>s.aphia_id===145721));
  ctx.fetch=async()=>({status:200,ok:true,json:async()=>forged});
  next={live:true,species:[sp(145721,'Undaria pinnatifida','미역')]};await ctx.attach(next);
  assert.equal(ctx.score(next.species[0],'MCUI'),null,`${why} is never an MCUI`);
  assert.deepEqual(Object.keys(next.species[0].assessment.axis_errors),['MCUI'],`${why}: an MCUI fault only`);
}
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
assert.equal(ctx.score(next.species[0],'MFPI'),60.4);
// 3.15 (team-lead decision 2026-10-02): reference only. Not in the Red List and no national row, so MCUI stays withheld;
// the Rapid LC check rides beside it and never becomes a number.
assert.equal(ctx.score(next.species[1],'MCUI'),null,'not in Red List is never a low score');
assert.equal(next.species[1].assessment.withheld_reasons.MCUI,'not_in_red_list');
assert.equal(next.species[1].assessment.mcui_basis,null);
assert.equal(next.species[1].assessment.mcui_substitute.use,'reference_only');
assert.equal(next.species[1].assessment.conservation_trace.iucn_state,'not_in_red_list');
assert.equal(next.species[2].assessment,undefined,'a candidate row never attaches as an operating species');
assert.equal(ctx.coverage(next.species[0]).checks.find(c=>c.name==='영양').stage,'validated');

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
assert.match(mbpiBody,/67\.5 · 검증 전 시범 지표 · 참고값\(단일 논문\)/);
assert.match(ctx.summary(next.species.find(s=>s.aphiaID===371986)),/MBPI 67\.5 \(참고값\(단일 논문\)\)/);
assert.ok(mbpiBody.indexOf('dieckol')<mbpiBody.indexOf('후속 조사 단서'),'scored ACE evidence precedes the leads');
assert.ok(mbpiBody.indexOf('후속 조사 단서')<mbpiBody.indexOf('3CLpro'),'3CLpro appears only under follow-up leads');
assert.doesNotMatch(mbpiBody,/점수 제외/);
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:[cand(371986,'Ecklonia cava','감태')]};await ctx.attach(next);
ctx.next=next;vm.runInContext('data=globalThis.next;comparisonPage=0',ctx);ctx.compare();
assert.match(dom.comparison.innerHTML,/data-score-aphia="371986" data-score-axis="MBPI"[^>]*참고값\(단일 논문\)/);
assert.match(dom.comparison.innerHTML,/>67\.5<small>검증 전 시범 지표 · 참고값\(단일 논문\) · 근거 보기/);
const badLabel=report();badLabel.candidate_species.find(s=>s.aphia_id===371986).mbpi_label=null;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>badLabel});
next={live:true,species:[cand(371986,'Ecklonia cava','감태')]};await ctx.attach(next);
assert.equal(ctx.state(next.species[0],'MBPI').kind,'technical_error','missing reference label must not turn a single-paper result into an ordinary score');

// BBVI: a held report value is never recomputed; the weight re-mixes only a BBVI the report found eligible.
const withBio=(status,bbvi,independent=false)=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033),e=r.candidate_species.find(s=>s.aphia_id===371986);
  o.bioactivity_trace=structuredClone(e.bioactivity_trace);o.scores.MBPI=67.5;o.score_status.MBPI='산출됨';
  o.mbpi_label='참고값(단일 논문)';
  if(independent){const best=o.bioactivity_trace.reduce((p,x)=>x.adjusted>p.adjusted?x:p);
    best.original_paper_dois.push('10.0000/synthetic-independent');best.evidence_factor=1;best.adjusted=best.percentile;
    o.scores.MBPI=best.adjusted;o.mbpi_label=null;}
  o.scores.BBVI=bbvi;o.score_status.BBVI=status;return r;};
const oysterOnly=async r=>{ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);return next.species[0];};
oyster=await oysterOnly(withBio('산출됨',69.6));  // 3.6: 0.5 x MFPI 71.6 + 0.5 x 67.5
assert.equal(ctx.state(oyster,'BBVI').kind,'technical_error','a single-paper MBPI cannot enter BBVI even when the arithmetic matches');
oyster=await oysterOnly(withBio('산출됨',80.8,true));
assert.equal(ctx.score(oyster,'BBVI'),80.8);
vm.runInContext('bbviWeight=.8',ctx);
assert.equal(ctx.score(oyster,'BBVI'),75.3,'weight updates an eligible BBVI');
oyster=await oysterOnly(withBio('산출 보류',null));
assert.equal(ctx.score(oyster,'MBPI'),67.5);
assert.equal(ctx.score(oyster,'BBVI'),null,'a single-paper hold is not bypassed by pilotScore');
vm.runInContext('bbviWeight=.5',ctx);
assert.equal(ctx.score(oyster,'BBVI'),null);

// Peptide and small-molecule MBPI are validated as separate strata.
const peptide=()=>({stratum_kind:'peptide',stratum_id:'ahtpdb-ace-ic50-hhl-cushman-cheung',peptide_sequence:'AEYLCEAC',pIC50:2.368,
  peer_peptides:352,percentile:1.42,evidence_factor:.75,adjusted:1.065,original_paper_dois:['10.3389/fnut.2022.981163']});
const withPeptide=trace=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033);o.bioactivity_trace=trace;o.scores.MBPI=1.1;o.score_status.MBPI='산출됨';o.mbpi_label='참고값(단일 논문)';return r;};
oyster=await oysterOnly(withPeptide([peptide()]));
assert.equal(ctx.score(oyster,'MBPI'),1.1,'peptide stratum accepted by its own rule');
oyster=await oysterOnly(withPeptide([{...peptide(),peptide_sequence:undefined}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','peptide without a sequence is rejected');
oyster=await oysterOnly(withPeptide([{...peptide(),stratum_kind:undefined,compound_id:'CID:1'}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','a peptide row cannot pass as a small molecule');
oyster=await oysterOnly(withPeptide([peptide(),{...original.candidate_species.find(s=>s.aphia_id===371986).bioactivity_trace[0],adjusted:1.0,percentile:1.3333333}]));
assert.equal(ctx.state(oyster,'MBPI').kind,'technical_error','peptide and compound strata never mix');
assert.equal(ctx.score(oyster,'MFPI'),71.6,'an MBPI fault leaves MFPI');

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
// verified-pilot-3.2 on the real report: a national MCUI enters the matrix only with all four axes (marked apart); paper peptide values are raw, never scored.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:all()};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
for(const s of original.species.filter(s=>s.mcui_basis==='national')){
  assert.equal(ctx.score(by(s.aphia_id),'MCUI'),10,`${s.korean_name}: national LC -> 10`);
  assert.equal(ctx.nationalMcui(by(s.aphia_id)),true);
  assert.equal(ctx.assessedForMatrix(by(s.aphia_id)),s.scores.BBVI!==null,`${s.korean_name}: national MCUI is placed only with a BBVI`);
}
// a national MCUI that stands in for an IUCN DD (갑오징어 1666974, DD 2009) must not claim the IUCN assessment is missing
assert.equal(ctx.iucnGlobalNote(by(836033)),'IUCN 전 지구 평가 미확인');
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
assert.equal(ctx.nationalMcui(by(1666974)),true);
assert.equal(ctx.iucnGlobalNote(by(1666974)),'IUCN 전 지구 DD(2009) · 시범 숫자 없음');
assert.ok(ctx.coverage(by(1666974)).checks.some(c=>c.detail?.startsWith('IUCN 전 지구 DD(2009) · 시범 숫자 없음. 그래서 한국 국가생물적색자료집')),'갑오징어 MCUI detail names the IUCN DD assessment');
next={live:true,species:all()};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
// verified-pilot-2.2: the reviewed peptide values are scored in the AHTPDB cohort; paper values and both licences stay visible.
// 3.5: Sato 2002 dipeptides are scored after the full-text review; KNFL stays listed.
// 3.12: Suetsuna 2000's synthetic IY replicates Sato's IY potency (two DOIs, 81.0).
// 3.14: Lin 2018's purified IW replicates Sato's IW, so IW (two DOIs, 95.3) is the top item.
html=ctx.renderScores(by(145721));
assert.ok(!html.includes('<h4>원값·출처 · 점수 미사용</h4>'),'145721: scored values are not repeated as unscored raw values');
{const mbpi=html.slice(html.indexOf('MBPI · 생리활성'),html.indexOf('data-axis="MCUI"'));
  for(const text of ['95.3 · 검증 전 시범 지표','정제 IW','재현 시료 클로렐라','IY','6.1 µM','10.1021/jf020482t','IW','1.5 µM','KNFL','225.87 µM','10.3390/md19030177','CC BY 4.0',
    '기질 HHL','효능 재현','합성 IY 2.65 µM','재현 시료 미역','차이 0.362','독립 DOI로 셈','DOI 2편(기원 1 + 효능 재현 1)',
    '펩타이드 352개','doi:10.1093/nar/gku1141','공개 DB · 개발자 이메일 확인(2026-09-27): 누구나 사용 가능'])
    assert.ok(mbpi.includes(text),`wakame MBPI missing ${text}`);
  assert.doesNotMatch(mbpi,/참고값\(단일 논문\)/);}
assert.equal(ctx.score(by(145721),'MBPI'),95.3);
assert.equal(ctx.score(by(145721),'BBVI'),71.0);
// verified-pilot-2.3: oyster LQP potency replicated by a synthetic peptide from another origin; the origin claim is still one paper.
html=ctx.renderScores(by(836033));
{const mbpi=html.slice(html.indexOf('MBPI · 생리활성'),html.indexOf('data-axis="MCUI"'));
  for(const text of ['96.3 · 검증 전 시범 지표','LQP','1.18 µM','10.5352/jls.2012.22.2.220','Publisher copyright','AEYLCEAC','4.287 mM (4287 µM)','10.3389/fnut.2022.981163','CC BY 4.0',
    '효능 재현','합성 LQP 2 µM','재현 시료 옥수수 α-제인','차이 0.229','독립 DOI로 셈','10.1271/bbb1961.55.1313','효능만 재현하며 기원 근거나 점수 값이 되지 않습니다',
    'DOI 2편(기원 1 + 효능 재현 1)','펩타이드 352개','doi:10.1093/nar/gku1141'])
    assert.ok(mbpi.includes(text),`oyster MBPI missing ${text}`);
  assert.match(mbpi,/기원 근거는 Do et al\. 2012 \(<a [^>]*>10\.5352\/jls\.2012\.22\.2\.220<\/a>\) 1편뿐입니다/);
  assert.doesNotMatch(mbpi,/참고값\(단일 논문\)/);}
assert.ok(!html.includes('참고 통합값'),'a real BBVI replaces the reference combination');
assert.equal(ctx.score(by(836033),'MBPI'),96.3);
assert.equal(ctx.summary(by(836033)),'MFPI 71.6 · MBPI 96.3 · MCUI(국가 평가) 10.0');
// A used replication must be listed among the independent DOIs and cite a published source, or the MBPI is a fault.
for(const mutate of [o=>{o.bioactivity_trace.find(i=>i.peptide_sequence==='LQP').independent_dois=['10.5352/jls.2012.22.2.220','10.0000/other']},
  o=>{o.source_ids=o.source_ids.filter(id=>id!=='miyoshi_1991_zein')}]){
  const r=report(),o=r.species.find(s=>s.aphia_id===836033);mutate(o);
  ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});const n={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(n);
  assert.equal(ctx.state(n.species[0],'MBPI').kind,'technical_error');
}
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:all()};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
// Peptide partial leads render their sequence and value, not an empty compound row.
assert.match(ctx.renderScores(by(145721)),/펩타이드 YNKL · ACE IC50 = 21 µM/);
// Axis pairs: only species with both values; national and IUCN MCUI and different cohorts stay in separate groups.
const pairs=ctx.axisPairs();
assert.match(pairs,/MFPI × MCUI\(한국 국가 평가 기반\) · rda-10\.4-raw-marine-animals<\/b> \d+종: [^<]*참굴 MFPI 71\.6 · MCUI 10\.0/);
assert.match(pairs,/MBPI × MCUI\(한국 국가 평가 기반\) · ahtpdb-ace-ic50-hhl-cushman-cheung<\/b> 1종: 참굴 MBPI 96\.3 · MCUI 10\.0<\/li>/);
assert.match(pairs,/BBVI × MCUI\(한국 국가 평가 기반\)[^<]*<\/b> 1종: 참굴 BBVI 83\.9 · MCUI 10\.0<\/li>/);
assert.match(pairs,/MFPI만의 쌍은 BBVI가 아닙니다/);
assert.doesNotMatch(pairs,/IUCN 기반\) · [^<]*참굴/,'a national MCUI never joins the IUCN group');
// Reference combination: shown beside BBVI only when both inputs equal the published axes; never a score.
const refReport=report(),refOyster=refReport.species.find(s=>s.aphia_id===836033);
refOyster.scores.MBPI=67.5;refOyster.score_status.MBPI='산출됨';
refOyster.mbpi_label='참고값(단일 논문)';refOyster.withheld_reasons.BBVI='mbpi_single_source';refOyster.scores.BBVI=null;refOyster.score_status.BBVI='산출 보류';
refOyster.bioactivity_trace=original.candidate_species.find(s=>s.aphia_id===371986).bioactivity_trace;
refOyster.reference_combination={label:'참고 통합값 · 독립 재현 미확인',formula:'w×MFPI+(1−w)×MBPI',inputs:{MFPI:71.6,MBPI:67.5},mfpi_cohort:'rda-10.4-raw-marine-animals',
  mbpi_stratum:'fixture',mbpi_original_paper_dois:['10.0000/fixture'],food_weight:.5,value:69.6,sensitivity:{'0.25':68.5,'0.5':69.6,'0.75':70.6},limits:['독립 재현 미확인.'],used_for_score:false};
let refOy=await oysterOnly(refReport);vm.runInContext('data=globalThis.next',Object.assign(ctx,{next}));
assert.equal(ctx.score(refOy,'MBPI'),67.5,'fixture MBPI must attach');{
  html=ctx.renderScores(refOy);
  for(const text of ['참고 통합값 · 독립 재현 미확인','참고값 69.6 · 점수 아님','w 0.75 → 70.6','BBVI 점수·매트릭스·순위에 쓰지 않습니다'])assert.ok(html.includes(text),`reference: missing ${text}`);
  assert.equal(ctx.score(refOy,'BBVI'),null,'a reference combination never becomes BBVI');
}
refOyster.reference_combination.inputs.MFPI=70;
refOy=await oysterOnly(refReport);vm.runInContext('data=globalThis.next',Object.assign(ctx,{next}));
assert.ok(!ctx.renderScores(refOy).includes('참고 통합값'),'inputs that differ from the published axes are not shown');
console.log('PASS: v2 report joins, screen values equal report, MFPI/MCUI traces, blank-as-missing, IUCN states, inconsistent-score guards, research candidates');
