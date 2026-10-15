import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const report=()=>structuredClone(original);
// 4.11 (prereg 3) drops the 6-compound 감태 ACE cohort, so the fixtures built on that item read the archived 4.10 report.
const arch410=JSON.parse(fs.readFileSync(new URL('../research/verified-indices/archive/assessments-verified-4.10.json',import.meta.url),'utf8'));
const report410=()=>structuredClone(arch410);
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
  globalThis.plain=plainWords;
  globalThis.scoreText=scoreText;
  globalThis.evText=evidenceProfileText;
  globalThis.evDep=evidenceDependence;
  globalThis.evCard=evidenceCardLine;`,ctx);

let next={live:true,species:all()};
await ctx.attach(next);
const by=aphia=>next.species.find(s=>s.aphiaID===aphia);
// Every value shown in the browser equals the reproducible report (score trace <-> screen match).
for(const s of original.species)for(const axis of ['MFPI','MBPI','MCUI','BBVI'])
  assert.equal(ctx.score(by(s.aphia_id),axis),s.scores[axis],`${s.korean_name} ${axis}`);
assert.equal(ctx.score(by(836033),'MFPI'),71.6);  // 3.6: calcium joins protein, iron and zinc
assert.equal(ctx.score(by(241776),'MCUI'),80);
assert.equal(ctx.score(by(836033),'BBVI'),71.9,'4.11: the LQP replication is a zein peptide (another origin), so the oyster BBVI rests on one paper');
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);

let html=ctx.renderScores(by(836033));
for(const text of ['9.66 g','8.72 mg','15.9 mg','K4040020000a','rda-10.4-raw-marine-animals','25개 식품','자료 신뢰도 감점','가식부 16.0%','428 mg','칼슘','정식 산출 · 공식 평가 범주','비교하지 않습니다'])
  assert.ok(html.includes(text),`missing visible trace: ${text}`);
// 3.27: the MBPI drug-origin check is computed and failed, so MBPI and the BBVI built on it carry that label
assert.match(html,/data-axis=\"BBVI\"><summary><span>BBVI · 통합 활용<\/span><b>72 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 재현 미확인<\/b>/);
// 3.27 review: a labelled BBVI is described as a score everywhere, with the factor actually applied and matrix wording only when placed
{const cov=ctx.plain(ctx.coverage(by(241776)).checks.find(c=>c.name==='생리활성').detail);  // raw text keeps the data's words; the screen rewords it
  assert.ok(cov.includes("BBVI에도 '최상위 근거 재현 미확인' 표시를 붙입니다")&&!cov.includes('BBVI에 쓰지 않습니다'),cov);
  const placed=ctx.renderScores(by(241776)),unplaced=ctx.renderScores((s=>({...s,assessment:{...s.assessment,scores:{...s.assessment.scores,MCUI:null}}}))(by(250680))),  // 4.3: 멍게 is placed now, so the unplaced wording is checked on a copy without its MCUI
   squid=ctx.renderScores(by(342067));
  assert.ok(placed.includes('근거 계수(0.75)')&&placed.includes('매트릭스에서는 속이 빈 점입니다'),'placed labelled BBVI note');
  assert.ok(unplaced.includes('ChEMBL 항목은 종 연결 원논문과 활성 문서 중 적은 쪽')&&unplaced.includes('MCUI가 없어 매트릭스·지도 색에는 들어가지 않습니다')&&!unplaced.includes('속이 빈 점'),'unplaced labelled BBVI note');
  assert.ok(squid.includes('3시간')&&squid.includes('액틴'),'squid peptide caveat shown');}
// 3.3 fills 홍합 zinc from uFiSh; 톳 (a seaweed; uFiSh covers fish and shellfish only) keeps a blank zinc.
// 3.6: that blank is left out of the mean (3 of 4 components) and said so, never scored 0
html=ctx.renderScores(by(494972));
assert.match(html,/아연 값이 비어 있어 평균에서 뺐습니다\(0점 아님/,'blank zinc shown as omitted, not zero');
assert.ok(!html.includes('아연 0 mg'));
// 3.15: 살오징어's missing aquaculture record is now a reviewed 'not feasible' record (Puneeta 2015), so MFPI scores with the
// MEXT zinc substitute and an aquaculture part of 0; MFPI carries its post-hoc validation result (cross-table check passed)
html=ctx.renderScores(by(342067));
assert.match(html,/<b>46\.1 · 정식 산출 · 방법 검증 통과\(11종 비교\)<\/b>/);
assert.match(html,/양식 가능 근거 없음\(양식 점수 0\)/);
assert.doesNotMatch(html,/필수 성분이 모자랍니다/);
html=ctx.renderScores(by(241776));
// 3.4: the MCUI label says the OBIS trend is now an auxiliary element, and the trend is shown beside the IUCN facts
for(const text of ['EN A2bd','2025-09-30','EN → 80','IUCN 기반 MCUI, OBIS 출현 추세(조사 노력 보정) 보조 반영','이전 평가','OBIS 출현 추세 · 보조 요소'])
  assert.ok(html.includes(text),`missing conservation fact: ${text}`);
html=ctx.renderScores(by(342067));
assert.match(html,/Needs updating/);assert.match(html,/10년 넘은 평가/);
assert.match(html,/구조 ID ✗/,'bioactivity chain step shown');
html=ctx.renderScores(by(145721));
// 4.3 (team-lead decisions 2026-10-05): 미역 took the Primorsky Krai decree No. 272 (EN); 멍게 the scored Rapid LC check.
// 4.11 (prereg 5.1·5.2): the failed back-test makes the Primorsky row reference only, so 미역 falls to the met Rapid LC check;
// 멍게's reporting-rate ratio 0.655 reached the decline threshold, so its check gives no MCUI.
// 4.14 (prereg-4.14 2·3): neither the Primorsky row nor the Rapid LC check is an IUCN global or Korean national category, so
// 미역 has no MCUI; the state is said in words and both lists stay visible as references
assert.match(html,/data-axis="MCUI"><summary><span>MCUI · 보전 평가<\/span><b>보전평가 미확인 · 자체 예비검토 참고\(공식 평가 아님 · 역검증 기준 미충족\) · 점수 아님/);
// 4.14: a Rapid LC reference never reads as a likely low-risk category
assert.doesNotMatch(html,/LC 가능성|예비 평가 참고/);
assert.match(html,/<b>보전평가 상태: 보전평가 미확인 · 다른 나라·지역 평가 참고<\/b>/);
assert.match(html,/다른 나라 지방 평가 \(연해주, 러시아\) · [^<]*\(EN\) \(EN에 해당하는 이름 · 숫자로 바꾸지 않음\) · 참고 · MCUI·유형·지도 색에 쓰지 않음/);
assert.match(html,/자체 예비검토\(Rapid LC\) · 공식 평가 아님<\/b>/);
assert.doesNotMatch(html,/시범 MCUI|정식 산출 · 역검증 기준 미충족 · 자체 예비평가/);
{const sq=ctx.renderScores(by(250680));
  assert.match(sq,/data-axis="MCUI"><summary><span>MCUI · 보전 평가<\/span><b>보전평가 미확인<\/b>/);
  assert.match(sq,/자체 예비평가\(Rapid LC\) 쓰지 않음 · MCUI 없음<\/b>: OBIS 보고율 비\(0\.655\)가 감소 기준\(0\.7\) 이하입니다/);
  assert.doesNotMatch(sq,/Rapid LC 충족 → LC 상당 → 10/);}
{const lc=ctx.renderScores(by(145721));
  assert.doesNotMatch(lc,/Rapid LC 충족 → LC 상당 → 10/,'4.14: the met check gives no number');
  assert.match(lc,/방법 역검증\(이미 평가가 있는 14종\): 11종 일치 · 기준 미충족 — LC로 판정한 위협 범주 종: 해삼·전복\(종 수준\)/);
  assert.doesNotMatch(lc,/공식 평가 범주 · 자체/);}
assert.match(html,/결과 0건/);
html=ctx.renderScores(by(494972));
for(const fact of ['Sargassum fusiformis','63.16 ± 3.6 µg/mL','MCF-7','10.1002/cbdv.202100848','구조 ID ✗','시료 연도 원문 기재 없음','Publisher terms'])
  assert.ok(html.includes(fact),`unscored paper-local result must retain ${fact}`);
// verified-pilot-3.1: the ChEMBL stratum scored 톳 (45.3, one linking paper); 3.10: the synthetic GKY peptide (Suetsuna 1998)
// outranks it at 65.0; 3.28: Chen 2016 re-measured synthetic GKY (HHL), so the factor 0.75 went and it was 86.6.
// 4.11 (prereg 2): that GKY was synthesised from a kelp sequence (another origin), so the factor 0.75 is back: 65.0.
// The paper-local MCF-7 result stays unscored.
assert.equal(ctx.score(by(494972),'MBPI'),65);
// 3.27 gave the single-paper item a labelled BBVI (64.2 · 최상위 근거 재현 미확인); 3.28's replication lifted the label; 4.11 restores it
assert.equal(ctx.score(by(494972),'BBVI'),64.2);
assert.match(ctx.renderScores(by(494972)),/data-axis="BBVI"><summary><span>BBVI · 통합 활용<\/span><b>64 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 재현 미확인<\/b>/);

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
// 3.5: 해삼 has a reviewed peptide MBPI (HDWWKER); 3.27 gives 살오징어 one too (Wako 1996), so the inventory guard is
// checked on 우뭇가사리, which has none
// 4.0: 우뭇가사리 gains a reviewed MBPI too (pheophorbide A), so the guard runs on a copy whose MBPI items are removed
{const g=by(372119),bare={...g,...liveMeta,assessment:{...g.assessment,scores:{...g.assessment.scores,MBPI:null,BBVI:null},bioactivity_trace:[]}};
  assert.notEqual(ctx.coverage(bare).checks[3].stage,'calculated','500 inventory entries cannot become MBPI');}
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
  // 4.0: the zero-result IUCN search was repeated on 2026-10-04, so the stage reads '평가 없음 확인' (checked_none), not 미확인
  // 4.2: 톳 gets a sub-national MCUI (Ishikawa/Okinawa VU), so the conservation stage is calculated, not '평가 없음 확인'.
  // 4.14: the sub-national list is a reference again, so 톳's conservation stage is '평가 없음 확인' (IUCN and Korean lists searched)
  494972:['verified','linked','validated','calculated','checked_none'],
  // 3.16: Russia's Red Data Book gives 우뭇가사리 a range-state MCUI, so its conservation check reaches '시범 산출'
  // 4.0: pheophorbide A (Korean 'G. amansii' mapped to G. elegans) gives 우뭇가사리 a single-paper ChEMBL MBPI
  372119:['verified','linked','validated','calculated','calculated'],
  // 3.27: 살오징어 gets a single-paper peptide MBPI (YALPHA, Wako 1996)
  342067:['verified','linked','validated','calculated','calculated'],
  250680:['verified','linked','validated','calculated','checked_none'],  // 4.3: scored Rapid LC MCUI; 4.11: none (reporting-rate ratio at the decline threshold)
  // 3.5: the sea cucumber gets a single-paper peptide MBPI (HDWWKER, Wang 2024).
  241776:['verified','linked','validated','calculated','calculated'],
  // 2.2: wakame's reviewed peptide trace gives a single-paper MBPI; 2.3 gives the oyster a BBVI; 3.12 replicates wakame IY, 3.14 IW (BBVI 71.0); 4.11 counts only the wakame-purified VW (BBVI 68.0).
  145721:['verified','linked','validated','calculated','checked_none']  // 4.3: Primorsky Krai EN; 4.11: the met Rapid LC check; 4.14: both references
};
for(const [id,expected] of Object.entries(stages)){
  const s=published.species.find(x=>x.aphiaID===Number(id));
  assert.deepEqual(Array.from(ctx.coverage(s).checks,c=>c.stage),expected,`${s.label}: published snapshot versus report`);
  // 3.27: a labelled single-paper BBVI is a score too
  assert.equal(ctx.score(s,'BBVI'),{836033:71.9,145721:67.9,241776:36.1,250680:33.1,342067:51.5,494972:64.2,506159:35.5,372119:45.1}[id]??null);
}

// The side-by-side table must name each incompatible MFPI cohort where a number appears.
// Same elements as index.html: every species in one table (design 05, 2026-10-10: a row per species, sortable) with a count/sort label.
const el=()=>({innerHTML:'',textContent:'',disabled:false,handlers:{},querySelectorAll(){return []},
  addEventListener(type,fn){this.handlers[type]=fn},click(){this.handlers.click()}});
const dom={comparison:el(),'comparison-page':el()};
ctx.document={getElementById:id=>dom[id]??null};
// the type chip reads the map's type colours (defined after setView)
vm.runInContext(app.match(/^const matrixTypeColour=.*$/m)[0]+app.slice(app.indexOf('function renderComparison(){'),app.indexOf('function toggleSimulation('))+';globalThis.compare=renderComparison',ctx);
for(const item of next.species)Object.assign(item,{cells:[],noOccurrences:true,info:{nutrition:{status:'not_collected'},compounds:{status:'not_collected'},conservation:{status:'not_reviewed'}}});
const headers=()=>[...dom.comparison.innerHTML.matchAll(/<th scope="row"><b>([^<]+)<\/b><small>/g)].map(m=>m[1]);
const labels=next.species.map(s=>s.label);
assert.equal(labels.length,8);
ctx.compare();
assert.deepEqual(headers(),labels,'one table shows all species in order');
// The label names the whole count and the current order (default: the catalogue order).
assert.equal(dom['comparison-page'].textContent,'총 8종 · 정렬: 기본 순서(운영 발행 → 조사 후보)');
// Both cohorts appear (미역 seaweed, 멍게 animal); assert each against its own column.
assert.match(dom.comparison.innerHTML,/고정 비교집단 수산동물 25개 식품 · 집단 간 점수 비교 불가/);
assert.match(dom.comparison.innerHTML,/고정 비교집단 해조류 3개 식품 · 집단 간 점수 비교 불가/);
assert.match(dom.comparison.innerHTML,/data-score-aphia="145721" data-score-axis="MFPI"[^>]*해조류 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/data-score-aphia="250680" data-score-axis="MFPI"[^>]*수산동물 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/>46\.7<small>정식 산출 · 방법 검증 통과\(11종 비교\)/);  // 3.15: MFPI labels read the cross-table result
assert.match(dom.comparison.innerHTML,/>52\.8<small>/);  // 3.6 calcium
// 4.3: 미역's MCUI was the Primorsky value, 멍게's the scored Rapid LC check. 4.11: 미역 takes the Rapid LC check (the failed
// back-test makes the Primorsky row reference only) and 멍게 has none (reporting-rate ratio at the decline threshold).
// 4.14 (prereg-4.14 2·7): both are '보전평가 미확인' in words; 미역's Rapid LC check rides along as a reference, never a number
assert.match(dom.comparison.innerHTML,/data-more-aphia="145721" data-more-axis="MCUI"[^>]*>보전평가 미확인<small>IUCN 검색 0건 · 낮은 점수 아님 · 보기<\/small><small>자체 예비검토 참고 · 공식 평가 아님 · 역검증 기준 미충족 · 점수 아님<\/small>/);
assert.match(dom.comparison.innerHTML,/data-more-aphia="250680" data-more-axis="MCUI"[^>]*>보전평가 미확인<small>IUCN 검색 0건 · 낮은 점수 아님 · 보기<\/small>/);
assert.match(dom.comparison.innerHTML,/data-more-aphia="372119" data-more-axis="MCUI"[^>]*>80\.0<small>/,'우뭇가사리 keeps its stock-decline lower bound');
assert.doesNotMatch(dom.comparison.innerHTML,/>10\.0<small>정식 산출 · 역검증 기준 미충족/);
// 3.4: 살오징어 MCUI 10.0 -> 20.0 (OBIS reporting-rate decline signal adds 10); 4.11 suspends the +10, so 10.0; 해삼 stays 80.0.
// 4.12: the KOSIS catch fell 79.8% (2015-17 -> 2022-24), so the stock-decline signal 60 is the higher value; a diamond marks it
assert.match(dom.comparison.innerHTML,/>80\.0<small>/);
assert.match(dom.comparison.innerHTML,/data-more-aphia="342067" data-more-axis="MCUI"[^>]*>60\.0<small>정식 산출 · 같은 자료 확인\(독립 검증 아님\) · 근거 보기<\/small><small>자원 감소 신호 · 어획량 −79\.8% · IUCN 기반 MCUI와 비교 불가<\/small>/);
assert.match(dom.comparison.innerHTML,/data-score-aphia="342067" data-score-axis="MCUI"[^>]*><span class="cv-num">60\.0<i class="cv-stock"/);
assert.match(dom.comparison.innerHTML,/<p class="sd-compare">IUCN LC 10 · 자원 감소 60 → 높은 값 60<\/p>/);
assert.match(dom.comparison.innerHTML,/기준 평균 121,486톤\(2015~17\) → 최근 평균 24,507톤\(2022~24\) <b>\(−79\.8%\)<\/b>/);
assert.equal((dom.comparison.innerHTML.match(/class="stock-decline/g)||[]).length,next.species.length,'every species shows its stock-decline line');
for(const s of next.species)assert.match(dom.comparison.innerHTML,new RegExp(`data-score-aphia="${s.aphiaID}" data-score-axis="OCC"`),`${s.label} occurrence button`);
assert.match(dom.comparison.innerHTML,/data-score-aphia="836033" data-score-axis="MFPI"[^>]*수산동물 고정 비교집단/);
assert.match(dom.comparison.innerHTML,/>71\.6<small>정식 산출 · 방법 검증 통과\(11종 비교\)/);
// 3.3: 홍합 zinc comes from uFiSh. 3.6: 톳 (a seaweed; uFiSh covers fish and shellfish only) leaves its blank zinc out of the mean.
assert.match(dom.comparison.innerHTML,/data-more-aphia="494972" data-more-axis="MFPI"[^>]*해조류 고정 비교집단[^>]*>63\.3<small>정식 산출 · 방법 검증 통과\(11종 비교\)/,'3 of 4 components score');
assert.match(dom.comparison.innerHTML,/data-more-aphia="506159" data-more-axis="MFPI"[^>]*>60\.9<small>정식 산출 · 방법 검증 통과\(11종 비교\)/,'substituted zinc gives a scored MFPI');

// design 05: a header sorts the rows (BBVI high → low, values without a score last) and the label says so; back to the default
vm.runInContext("cmpSort={key:'BBVI',dir:'desc'}",ctx);ctx.compare();
{const want=next.species.map((s,i)=>[s,i]).sort(([a,i],[b,j])=>{const x=ctx.score(a,'BBVI'),y=ctx.score(b,'BBVI');return x===null||y===null?(x===null)-(y===null)||i-j:y-x||i-j;}).map(([s])=>s.label);
assert.deepEqual(headers(),want,'BBVI high → low');}
assert.match(dom.comparison.innerHTML,/<th scope="col" aria-sort="descending"><button type="button" class="cmp-sort" data-sort="BBVI">/);
// 4.14 (prereg-4.14 8): a BBVI sort says it mixes cohorts and is no validated order, on the label and atop the rows
assert.equal(dom['comparison-page'].textContent,'총 8종 · 정렬: BBVI 높은 순 (탐색적 · 검증된 우열 아님)');
assert.match(dom.comparison.innerHTML,/<tbody><tr class="cmp-group mixed"><th colspan="8" scope="rowgroup">탐색적 합성지표 · 비교집단이 다른 점수를 섞은 순서 · 검증된 우열 아님<\/th><\/tr>/);
// an MFPI sort groups by RDA cohort first (seaweed and animal rows never interleave) and orders only inside a group
vm.runInContext("cmpSort={key:'MFPI',dir:'desc'}",ctx);ctx.compare();
{const cohortOf=l=>next.species.find(s=>s.label===l).assessment.food_trace.cohort_id, seq=headers().map(cohortOf);
  assert.equal(seq.filter((c,i)=>i&&c!==seq[i-1]).length,1,'two cohort blocks, one change');
  for(const c of new Set(seq)){const v=headers().filter(l=>cohortOf(l)===c).map(l=>ctx.score(next.species.find(s=>s.label===l),'MFPI'));
    assert.deepEqual(v,[...v].sort((a,b)=>b-a),'high → low inside '+c);}
  assert.equal((dom.comparison.innerHTML.match(/<tr class="cmp-group"><th colspan="8" scope="rowgroup">비교집단 /g)||[]).length,2);
  assert.equal(dom['comparison-page'].textContent,'총 8종 · 정렬: MFPI 높은 순 (비교집단별)');}
vm.runInContext("cmpSort={key:null,dir:null}",ctx);ctx.compare();assert.deepEqual(headers(),labels,'default order again');
assert.doesNotMatch(dom.comparison.innerHTML,/cmp-group/,'no divider rows in the default order');

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
// 4.14 (prereg-4.14 2·3): 미역's Rapid LC check is a reference with no number. A reference that carries a value, a check scored
// again, or a state that claims an official category is refused as an MCUI fault (and never read as a low MCUI).
for(const [forge,why] of [[a=>{a.mcui_substitute.value=10;},'a reference carrying a value'],
    [a=>{a.mcui_substitute.use='scored';a.mcui_substitute.value=10;a.mcui_basis='preliminary';a.scores.MCUI=10;a.score_status.MCUI='산출됨';},'a Rapid LC check scored again'],
    [a=>{a.conservation_status.state='official_scored';a.conservation_status.label='공식 평가';},'a state claiming an official category'],
    [a=>{a.conservation_status.assessments[0].used_for_mcui=true;},'a regional list used for MCUI']]){
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
// 4.0: 넙치 gains a range-state MCUI (Fisheries Agency of Japan 'ランク外'), so the no-assessment example is 조피볼락
next={live:true,species:[cand(231750,'Ruditapes philippinarum','바지락'),cand(274849,'Sebastes schlegelii','조피볼락'),sp(397082,'Haliotis discus','전복(종 수준)')]};
await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),60.4);
// 4.3 scored the met Rapid LC check 10; 4.14 (prereg-4.14 2) keeps it as a reference: no MCUI, '보전평가 미확인'
assert.equal(ctx.score(next.species[1],'MCUI'),null);
assert.equal(next.species[1].assessment.withheld_reasons.MCUI,'not_in_red_list');
assert.equal(next.species[1].assessment.mcui_basis,null);
assert.equal(next.species[1].assessment.mcui_substitute.use,'reference_only');
assert.equal(next.species[1].assessment.conservation_status.state,'self_preliminary_only');
assert.equal(ctx.state(next.species[1],'MCUI').label,'보전평가 미확인');
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
// 4.11 (prereg 3): 감태's top item is the ChEMBL dieckol record (56.8); the paper's 6-compound ACE cohort gives no item.
ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
html=ctx.renderScores(next.species.find(s=>s.aphiaID===371986));
assert.equal(ctx.score(next.species.find(s=>s.aphiaID===371986),'MBPI'),56.8);
assert.doesNotMatch(html.slice(html.indexOf('data-axis="MBPI"'),html.indexOf('data-axis="MCUI"')),/HHL25mM|90 × 근거 계수 0\.75 = 67\.5/);
// Ecklonia 67.5 (4.10 archive): the scored ACE measurements come first; the SARS-CoV 3CLpro paper is only a follow-up lead.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report410()});
next={live:true,species:[cand(371986,'Ecklonia cava','감태')]};await ctx.attach(next);
ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
html=ctx.renderScores(next.species.find(s=>s.aphiaID===371986));
const mbpiBody=html.slice(html.indexOf('data-axis="MBPI"'),html.indexOf('data-axis="MCUI"'));
for(const text of ['점수에 쓴 값 · dieckol','1.47','ACE:EC-3.4.15.1','HHL25mM','wijesinghe-2011-cell-free-ACE-IC50','90 × 근거 계수 0.75 = 67.5','10.4162/nrp.2011.5.2.93','독립 원논문 1편','최댓값'])
  assert.ok(mbpiBody.includes(text),`Ecklonia MBPI evidence missing ${text}`);
assert.match(mbpiBody,/67\.5 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 재현 미확인/);
assert.match(ctx.plain(ctx.summary(next.species.find(s=>s.aphiaID===371986))),/MBPI 67\.5 \(최상위 근거 재현 미확인\)/);
assert.ok(mbpiBody.indexOf('dieckol')<mbpiBody.indexOf('후속 조사 단서'),'scored ACE evidence precedes the leads');
assert.ok(mbpiBody.indexOf('후속 조사 단서')<mbpiBody.indexOf('3CLpro'),'3CLpro appears only under follow-up leads');
assert.doesNotMatch(mbpiBody,/점수 제외/);
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report410()});
next={live:true,species:[cand(371986,'Ecklonia cava','감태')]};await ctx.attach(next);
ctx.next=next;vm.runInContext('data=globalThis.next;comparisonFocus=null',ctx);ctx.compare();
assert.match(dom.comparison.innerHTML,/data-score-aphia="371986" data-score-axis="MBPI"[^>]*최상위 근거 재현 미확인/);
assert.match(dom.comparison.innerHTML,/>67\.5<small>정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 재현 미확인 · 근거 보기/);
const badLabel=report410();badLabel.candidate_species.find(s=>s.aphia_id===371986).mbpi_label=null;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>badLabel});
next={live:true,species:[cand(371986,'Ecklonia cava','감태')]};await ctx.attach(next);
assert.equal(ctx.state(next.species[0],'MBPI').kind,'technical_error','missing reference label must not turn a single-paper result into an ordinary score');

// BBVI: a held report value is never recomputed; the weight re-mixes only a BBVI the report found eligible.
const withBio=(status,bbvi,independent=false)=>{const r=report410(),o=r.species.find(s=>s.aphia_id===836033),e=r.candidate_species.find(s=>s.aphia_id===371986);
  o.bioactivity_trace=structuredClone(e.bioactivity_trace);o.scores.MBPI=67.5;o.score_status.MBPI='산출됨';
  o.mbpi_label=r.method.bbvi.single_source_mbpi_label;
  if(independent){const best=o.bioactivity_trace.reduce((p,x)=>x.adjusted>p.adjusted?x:p);
    best.original_paper_dois.push('10.0000/synthetic-independent');best.evidence_factor=1;best.adjusted=best.percentile;
    o.scores.MBPI=best.adjusted;o.mbpi_label=null;}
  o.scores.BBVI=bbvi;o.score_status.BBVI=status;return r;};
const oysterOnly=async r=>{ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);return next.species[0];};
oyster=await oysterOnly(withBio('산출됨',69.6));  // 3.6: 0.5 x MFPI 71.6 + 0.5 x 67.5
assert.equal(ctx.state(oyster,'BBVI').kind,'technical_error','a single-paper MBPI cannot enter BBVI without the policy label, even when the arithmetic matches');
// 3.27 (team-lead decision 2026-10-03): under the report's policy the same BBVI is a score when it carries the label
{const r=withBio('산출됨',69.6);r.species.find(s=>s.aphia_id===836033).bbvi_label=r.method.bbvi.single_source_bbvi_label;
  oyster=await oysterOnly(r);assert.equal(ctx.score(oyster,'BBVI'),69.6,'a labelled single-paper BBVI is a score');
  const old=withBio('산출됨',69.6);old.species.find(s=>s.aphia_id===836033).bbvi_label=old.method.bbvi.single_source_bbvi_label;delete old.method.bbvi.single_source_policy;
  oyster=await oysterOnly(old);assert.equal(ctx.state(oyster,'BBVI').kind,'technical_error','the label alone cannot admit it without the policy');}
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
const withPeptide=trace=>{const r=report(),o=r.species.find(s=>s.aphia_id===836033);o.bioactivity_trace=trace;o.scores.MBPI=1.1;o.score_status.MBPI='산출됨';o.mbpi_label=r.method.bbvi.single_source_mbpi_label;return r;};
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
assert.match(ctx.renderScores(oyster),/한국 국가 평가 기반 MCUI[^]*1371쪽/);
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
assert.equal(ctx.iucnGlobalNote(by(836033)),'IUCN 전 지구 평가 없음(검색 0건 · 2026-09-25)');  // 4.0: a dated zero-result search is stated as such
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
assert.equal(ctx.nationalMcui(by(1666974)),true);
assert.equal(ctx.iucnGlobalNote(by(1666974)),'IUCN 전 지구 DD(2009) · 점수 대응 없음');
assert.ok(ctx.coverage(by(1666974)).checks.some(c=>c.detail?.startsWith('IUCN 전 지구 DD(2009) · 점수 대응 없음. 그래서 한국 국가생물적색자료집')),'갑오징어 MCUI detail names the IUCN DD assessment');
next={live:true,species:all()};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
// verified-pilot-2.2: the reviewed peptide values are scored in the AHTPDB cohort; paper values and both licences stay visible.
// 3.5: Sato 2002 dipeptides are scored after the full-text review; KNFL stays listed.
// 3.12: Suetsuna 2000's synthetic IY replicates Sato's IY potency (two DOIs, 81.0).
// 3.14: Lin 2018's purified IW replicates Sato's IW, so IW (two DOIs, 95.3) is the top item.
// 3.25: Michelke 2018's synthetic IW (1.91 uM) is a second replication of the top item, so its line counts three DOIs; Saito/Nomura add synthetic IY/VW.
// 4.11 (prereg 2): only Suetsuna 2004's VW purified from wakame counts; every other row is shown with its reason. VW (89.2) leads.
html=ctx.renderScores(by(145721));
assert.ok(!html.includes('<h4>원값·출처 · 점수 미사용</h4>'),'145721: scored values are not repeated as unscored raw values');
{const mbpi=html.slice(html.indexOf('MBPI · 생리활성'),html.indexOf('data-axis="MCUI"'));
  for(const text of ['89.2 · 정식 산출 · 방법 검증 기준 미충족','정제 IW','재현 시료 클로렐라','IY','6.1 µM','10.1021/jf020482t','IW','1.5 µM','KNFL','225.87 µM','10.3390/md19030177','CC BY 4.0',
    '기질 HHL','효능 재현','합성 IY 2.65 µM','재현 시료 미역','차이 0.362','독립 DOI로 셈','DOI 2편(기원 1 + 효능 재현 1)','다른 기원의 측정이라 효능만 재현합니다','이 종에서 정제한 시료를 다른 논문이 잰 값','짧은 서열이라 여러 생물의 단백질에서 나올 수 있으며','합성 IW 1.91 µM','재현 시료 화학 합성 IW','합성 IY 2.4 µM','합성 VW 1.68 µM',
    '펩타이드 352개','doi:10.1093/nar/gku1141','공개 DB · 개발자 이메일 확인(2026-09-27): 누구나 사용 가능'])
    assert.ok(mbpi.includes(text),`wakame MBPI missing ${text}`);
  assert.doesNotMatch(mbpi,/참고값\(최상위 근거 재현 미확인\)/);}
assert.equal(ctx.score(by(145721),'MBPI'),89.2);
assert.equal(ctx.score(by(145721),'BBVI'),67.9);  // 4.14: unrounded inputs (68.0 from the rounded 46.7 and 89.2)
// 2026-10-12: the MBPI section opens with one line from published values only (the post-hoc result, the aggregation range),
// then the top item's stratum; the summary names the stratum too, and the reason paragraph below stays.
{const mbpi=html.slice(html.indexOf('MBPI · 생리활성'),html.indexOf('data-axis="MCUI"'));
  assert.match(mbpi,/<b>89\.2 · 정식 산출 · 방법 검증 기준 미충족 · ACE 펩타이드<\/b><\/summary>/);
  assert.ok(mbpi.includes('<p class="fine mbpi-first"><b>사후 검증 기준 미충족(약물 기원종 3종 중 2종 계산) · 집계 방식에 따라 19.6–89.2</b><br>근거 층: ACE 저해 펩타이드(AHTPDB 352개 안 순위 · 식품 단백질 유래가 주를 이루는 항고혈압 펩타이드 모음)</p>'),'wakame first line');
  assert.ok(mbpi.indexOf('mbpi-first')<mbpi.indexOf('사후 검증(약물 기원종'),'the first line sits above the reason paragraph');
  assert.ok(mbpi.includes('기준 미충족입니다'),'the published reason reads in the neutral words');}
assert.doesNotMatch(html,/미통과/);
{const mbpi=ctx.renderScores(by(241776)).split('data-axis="MBPI"')[1].split('data-axis="MCUI"')[0];
  assert.ok(mbpi.includes('<b>사후 검증 기준 미충족(약물 기원종 3종 중 2종 계산) · 집계 방식에 따라 바뀌지 않음(항목 1개)</b><br>근거 층: ACE 저해 펩타이드'),'sea cucumber first line');}
// verified-pilot-2.3: oyster LQP potency replicated by a synthetic peptide from another origin; the origin claim is still one paper.
// 4.11 (prereg 2): that zein-derived row no longer counts, so LQP keeps the factor 0.75 (72.2) and the single-paper label.
html=ctx.renderScores(by(836033));
{const mbpi=html.slice(html.indexOf('MBPI · 생리활성'),html.indexOf('data-axis="MCUI"'));
  for(const text of ['72 · 정식 산출 · 방법 검증 기준 미충족 · 최상위 근거 재현 미확인','LQP','1.18 µM','10.5352/jls.2012.22.2.220','Publisher copyright','AEYLCEAC','4.287 mM (4287 µM)','10.3389/fnut.2022.981163','CC BY 4.0',
    '효능 재현','합성 LQP 2 µM','재현 시료 옥수수 α-제인','차이 0.229','다른 기원의 측정이라 효능만 재현합니다','10.1271/bbb1961.55.1313','효능만 재현하며 기원 근거나 점수 값이 되지 않습니다',
    '원논문 1편 → 독립 재현 없음 계수 0.75','이 종의 시료로 잰 독립 재현 논문이 아직 없습니다','펩타이드 352개','doi:10.1093/nar/gku1141'])
    assert.ok(mbpi.includes(text),`oyster MBPI missing ${text}`);
  assert.doesNotMatch(mbpi,/참고값\(최상위 근거 재현 미확인\)/);}
assert.ok(!html.includes('참고 통합값'),'a real BBVI replaces the reference combination');
assert.equal(ctx.score(by(836033),'MBPI'),72.2);
assert.equal(ctx.summary(by(836033)),'MFPI 71.6 · MBPI 72 (단일 논문) · MCUI(국가 평가) 10.0');
// A used replication must be listed among the independent DOIs and cite a published source, or the MBPI is a fault (4.11: 미역 VW).
for(const mutate of [o=>{o.bioactivity_trace.find(i=>i.peptide_sequence==='VW').independent_dois.push('10.0000/other')},
  o=>{o.source_ids=o.source_ids.filter(id=>id!=='suetsuna_2004_wakame')}]){
  const r=report(),o=r.species.find(s=>s.aphia_id===145721);mutate(o);
  ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});const n={live:true,species:[sp(145721,'Undaria pinnatifida','미역')]};await ctx.attach(n);
  assert.equal(ctx.state(n.species[0],'MBPI').kind,'technical_error');
}
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:all()};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
// Peptide partial leads render their sequence and value, not an empty compound row.
assert.match(ctx.renderScores(by(145721)),/펩타이드 YNKL · ACE IC50 = 21 µM/);
// 2026-10-08: the axis-pairs box was removed; the matrix shows every placed species (team-lead decision).
assert.equal(typeof ctx.axisPairs,'undefined');
// Reference combination: shown beside BBVI only when both inputs equal the published axes; never a score.
const refReport=report410(),refOyster=refReport.species.find(s=>s.aphia_id===836033);
refOyster.scores.MBPI=67.5;refOyster.score_status.MBPI='산출됨';
refOyster.mbpi_label=refReport.method.bbvi.single_source_mbpi_label;  // 3.27 label '최상위 근거 재현 미확인'; the legacy reference path stays tested
refOyster.withheld_reasons.BBVI='mbpi_single_source';refOyster.scores.BBVI=null;refOyster.score_status.BBVI='산출 보류';
refOyster.bioactivity_trace=arch410.candidate_species.find(s=>s.aphia_id===371986).bioactivity_trace;
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

// 4.10 (2026-10-12): the secondary, exploratory MBPI-Rx. The browser re-derives it from the trace (the MBPI rule over the strata
// the pre-registration classed 'include') and shows it as one line under the detail's MBPI, a column in the compare data table
// and a line in #method-03. A null reads 없음 with the published reason, never 0; a value that does not re-check is not shown.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
vm.runInContext('globalThis.rxOf=mbpiRxOf',ctx);
{const rows=[...original.species,...original.candidate_species],rule=original.method.mbpi_rx,vs=original.method.posthoc.validation_sets.MBPI_RX;
  const rxv=s=>rows.find(r=>r.aphia_id===s.aphiaID).mbpi_rx.value;
// 4.13: 넙치's top item is now outside the excluded strata, so it has an MBPI-Rx value (11 -> 10 nulls)
  assert.equal(rows.length,30);assert.equal(rows.filter(r=>r.mbpi_rx.value===null).length,10);
  for(const r of rows){const got=ctx.rxOf(by(r.aphia_id));
    assert.ok(got,`${r.korean_name}: MBPI-Rx re-checks from the trace`);
    assert.equal(got.value,r.mbpi_rx.value,`${r.korean_name} MBPI-Rx`);
    assert.equal(ctx.score(by(r.aphia_id),'MBPI'),r.scores.MBPI,`${r.korean_name}: MBPI unchanged`);}
  const line=h=>{const i=h.indexOf('class="score-disclosure rx-disclosure"');return i<0?'':h.slice(i,h.indexOf('</details>',i)+10);};
  let h=ctx.renderScores(by(836033));
  assert.ok(h.indexOf('data-axis="MBPI"')<h.indexOf('rx-disclosure')&&h.indexOf('rx-disclosure')<h.indexOf('data-axis="MCUI"'),'the line sits right under MBPI');
  const oy=line(h);
  assert.ok(oy.includes('<summary><span>의약 후보 MBPI(보조, 탐색적)</span><b>62.6 · 항균 펩타이드 · 사후 검증 기준 미충족(탐색적 재검토)</b></summary>'),oy);
  for(const t of ['이 종에서 뺀 항목 2개','근거 층: 항균 펩타이드(DBAASP','층 분류 기준: 그 층의 비교집단이 식품 단백질','사후 검증(약물 기원종 3종 중 2종 계산): ACE 저해·잔틴 산화효소 펩타이드 층을 뺀',
    `사전 등록: ${rule.prereg}`,'기본 MBPI·BBVI·매트릭스에는 쓰지 않습니다'])assert.ok(oy.includes(t),`oyster MBPI-Rx line: ${t}`);
  assert.ok(line(ctx.renderScores(by(371986))).includes('<b>56.8 · ChEMBL 화합물 · 사후 검증 기준 미충족(탐색적 재검토)</b>'),'감태: the ChEMBL dieckol item (4.11 drops the 6-compound ACE cohort)');
  assert.ok(line(ctx.renderScores(by(494972))).includes('<b>45.3 · ChEMBL 화합물 · '),'톳: the ChEMBL item once the ACE peptides are out');
  for(const r of rows.filter(r=>r.mbpi_rx.value===null)){const l=line(ctx.renderScores(by(r.aphia_id)));
    assert.ok(l.includes(`<b>없음 · ${r.mbpi_rx.reason} · 사후 검증 기준 미충족(탐색적 재검토)</b>`)&&!l.includes('근거 층:')&&l.includes(`이 종에서 뺀 항목 ${r.mbpi_rx.excluded_item_count}개`),`${r.korean_name}: ${l}`);}
  // the line never repeats an old word and is not a fifth axis (no data-axis, so evidence buttons still find their own section)
  assert.doesNotMatch(oy,/미통과|data-axis/);
  // a value that does not re-check from the trace, a stratum missing from the classification or a wrong reason hides the line
  for(const [id,mutate] of [[836033,r=>{r.species.find(s=>s.aphia_id===836033).mbpi_rx.value=70}],
    [836033,r=>{delete r.method.mbpi_rx.classified_strata['amp-dbaasp-mic-broth-staphylococcus-aureus']}],
    [836033,r=>{const o=r.species.find(s=>s.aphia_id===836033);o.mbpi_rx.top_item.trace_index=o.bioactivity_trace.findIndex(x=>x.stratum_id==='ahtpdb-ace-ic50-hhl-cushman-cheung')}],
    [836033,r=>{r.species.find(s=>s.aphia_id===836033).mbpi_rx.excluded_item_count=0}],
    [836033,r=>{r.species.find(s=>s.aphia_id===836033).mbpi_rx.stratum_id='ahtpdb-ace-ic50-hhl-cushman-cheung'}],
    [145721,r=>{r.species.find(s=>s.aphia_id===145721).mbpi_rx.reason='MBPI 항목이 없습니다'}],
    [145721,r=>{Object.assign(r.species.find(s=>s.aphia_id===145721).mbpi_rx,{value:0,reason:null})}]]){
    const r=report();mutate(r);ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});
    const n={live:true,species:[sp(id,original.species.find(s=>s.aphia_id===id).scientific_name,'x')]};await ctx.attach(n);
    vm.runInContext('data=globalThis.n',Object.assign(ctx,{n}));
    assert.equal(ctx.rxOf(n.species[0]),null,`fault ${mutate}`);assert.ok(!ctx.renderScores(n.species[0]).includes('rx-disclosure'));
    assert.equal(ctx.state(n.species[0],'MBPI').kind,'scored','an MBPI-Rx fault never touches MBPI');}
  // an MBPI that is itself hidden (a technical error) takes its MBPI-Rx along
  {const r=report();r.species.find(s=>s.aphia_id===836033).scores.MBPI=99;ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});
    const n={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(n);vm.runInContext('data=globalThis.n',Object.assign(ctx,{n}));
    assert.equal(ctx.state(n.species[0],'MBPI').kind,'technical_error');assert.equal(ctx.rxOf(n.species[0]),null);
    assert.ok(!ctx.renderScores(n.species[0]).includes('rx-disclosure'),'no MBPI-Rx line beside a hidden MBPI');}
  ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});await ctx.attach(next);vm.runInContext('data=globalThis.next',ctx);
  // the compare data table: one MBPI-Rx column after MBPI with its own sort key; '–' (never 0 or a button) for no value
  for(const item of next.species)Object.assign(item,{cells:[],noOccurrences:true,info:{nutrition:{status:'not_collected'},compounds:{status:'not_collected'},conservation:{status:'not_reviewed'}}});
  vm.runInContext("cmpSort={key:null,dir:null}",ctx);ctx.compare();
  let t=dom.comparison.innerHTML;
  assert.deepEqual([...t.matchAll(/data-sort="([A-Za-z_]+)"/g)].map(m=>m[1]),['name','MFPI','MBPI','MBPI_RX','BBVI','MCUI']);
  // 2026-10-13 dark data table: 종·유형·5 values·expand (근거 수준·출현기록·자료 연결 현황 moved into the expanded row)
  assert.ok(t.includes('MBPI-Rx<small>보조·탐색적</small>')&&(t.match(/<th scope="col"/g)||[]).length===8&&!t.includes('colspan="11"')&&t.includes('colspan="8"'));
  const cell=id=>t.split(`<tr class="cmp-row" data-aphia="${id}">`)[1].split('cmp-rx">')[1].split('</td>')[0];
  assert.match(cell(836033),/^<span class="cv rx-cv"><span class="cv-num">62\.6<\/span><span class="cv-bar" aria-hidden="true"><i style="width:62\.6%"><\/i><\/span><\/span>$/);
  assert.match(cell(504357),/<span class="cv-num">75\.0<\/span>/);
  for(const r of rows.filter(r=>r.mbpi_rx.value===null))assert.equal(cell(r.aphia_id),'<span class="cv rx-cv"><span class="cv-num rx-none" aria-hidden="true">–</span><span class="sr-only">없음</span></span>',r.korean_name);
  assert.ok(t.includes('<h4>의약 후보 MBPI · 보조, 탐색적</h4>62.6<small>항균 펩타이드 · 사후 검증 기준 미충족(탐색적 재검토) · MBPI·BBVI에 쓰지 않음</small>'),'oyster 자세히');
  assert.ok(t.includes('<h4>의약 후보 MBPI · 보조, 탐색적</h4>없음<small>제외 층(ACE·잔틴 산화효소 펩타이드) 밖의 항목이 없습니다 · 사후 검증 기준 미충족(탐색적 재검토) · 점수 아님</small>'),'wakame 자세히');
  // sorting by it (4.14, prereg-4.14 8): grouped by the top item's stratum (groups in catalogue order of first appearance), high → low
  // or low → high only inside a group, the species without a value (10 since 4.13) last in catalogue order both ways
  vm.runInContext('globalThis.rxGroup=s=>cmpGroup(s,"MBPI_RX")',ctx);
  const order=[];for(const s of next.species){const g=ctx.rxGroup(s);if(g&&!order.includes(g))order.push(g);}
  const rank=s=>{const g=ctx.rxGroup(s);return g?order.indexOf(g):Infinity;};
  const want=dir=>next.species.map((s,i)=>[s,i]).sort(([a,i],[b,j])=>{if(rank(a)!==rank(b))return rank(a)-rank(b);const x=rxv(a),y=rxv(b);return x===null||y===null?(x===null)-(y===null)||i-j:(dir==='desc'?y-x:x-y)||i-j;}).map(([s])=>s.label);
  assert.ok(order.length>1,'MBPI-Rx values sit in more than one stratum');
  for(const dir of ['desc','asc']){vm.runInContext(`cmpSort={key:'MBPI_RX',dir:'${dir}'}`,ctx);ctx.compare();t=dom.comparison.innerHTML;
    assert.deepEqual(headers(),want(dir),`MBPI-Rx ${dir}`);
    assert.deepEqual(headers().slice(-next.species.filter(s=>rxv(s)===null).length),next.species.filter(s=>rxv(s)===null).map(s=>s.label),'no value last');
    assert.equal((t.match(/<tr class="cmp-group"><th colspan="8" scope="rowgroup">층 /g)||[]).length,order.length,'one head per stratum');
    assert.match(t,new RegExp(`aria-sort="${dir==='desc'?'descending':'ascending'}"><button type="button" class="cmp-sort" data-sort="MBPI_RX">`));
    assert.equal(dom['comparison-page'].textContent,`총 30종 · 정렬: MBPI-Rx ${dir==='desc'?'높은 순':'낮은 순'} (층별)`);}
  vm.runInContext("cmpSort={key:null,dir:null}",ctx);
  // #method-03 states the published result and the pre-registration path
  const page=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),m3=page.slice(page.indexOf('id="method-03"'),page.indexOf('</article>',page.indexOf('id="method-03"')));
  const li=m3.slice(m3.indexOf('<li><b>의약 후보 MBPI(보조)'));
  assert.ok(li.startsWith(`<li><b>의약 후보 MBPI(보조) · ${{passed:'통과',failed:'기준 미충족'}[vs.result]}</b> ACE·잔틴 산화효소 펩타이드 층을 뺀 탐색적 재검토입니다.`),li);
  assert.ok(li.includes(`사전 등록 ${rule.prereg}</li>`)&&!/미통과/.test(m3),li);}
// 4.11 (prereg 4): MBPI breadth is one display-only line under MBPI (after MBPI-Rx), from the published item values.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
{const h=ctx.renderScores(by(836033)),i=h.indexOf('breadth-disclosure');
  assert.ok(h.indexOf('rx-disclosure')<i&&i<h.indexOf('data-axis="MCUI"'),'the breadth line sits under MBPI, after MBPI-Rx');
  // 4.14 (prereg-4.14 8): independent papers, max and mean join the line; the material classes and the floor note sit below it
  assert.ok(h.includes('<summary><span>MBPI 근거 폭 · 탐색적</span><b>항목 6개 · 독립 논문 4편 · 중앙값 24.6 · 최댓값 72.2 · 평균 32.5 · 상위 2개 평균 67.4</b></summary>'));
  assert.ok(h.includes('소재 구분: 가수분해물 서열의 합성품 2개 · 유전자 서열(천연 펩타이드)의 합성품 1개 · 종에서 분리한 물질 3개')&&h.includes('치료 효과·식품 안전성·제품 가치를 뜻하지 않습니다'));
  assert.ok(h.includes('기본 MBPI·BBVI·매트릭스·순위에는 쓰지 않습니다'));
  for(const r of [...original.species,...original.candidate_species].filter(r=>r.scores.MBPI!==null&&r.mbpi_breadth?.item_count)){
    const b=r.mbpi_breadth,x=ctx.renderScores(by(r.aphia_id));
    assert.ok(x.includes(`항목 ${b.item_count}개 · 독립 논문 ${b.independent_paper_count}편 · 중앙값 ${b.median.toFixed(1)} · 최댓값 ${b.max.toFixed(1)} · 평균 ${b.mean.toFixed(1)} · 상위 2개 평균 ${b.top2_mean.toFixed(1)}`),r.korean_name);
    assert.equal(b.max,r.scores.MBPI,r.korean_name+': the max is the MBPI');}
  const r=report();r.species.find(s=>s.aphia_id===836033).scores.MBPI=99;ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});
  const n={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(n);vm.runInContext('data=globalThis.n',Object.assign(ctx,{n}));
  assert.ok(!ctx.renderScores(n.species[0]).includes('breadth-disclosure'),'no breadth line beside a hidden MBPI');}
// 4.16 (formal-release-4.16-2026-10-15): the evidence profile, one line from evidence_profile on every species, amount and
// replication apart; an MBPI or BBVI without a replicated top item is a whole number on screen, the report keeps its decimals.
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
next={live:true,species:[...all(),...original.candidate_species.map(s=>cand(s.aphia_id,s.scientific_name,s.korean_name))]};await ctx.attach(next);ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
{const rule=original.method.evidence_profile,rows=[...original.species,...original.candidate_species];
  assert.equal(rows.length,30);
  assert.equal(ctx.evText(by(836033)),'MBPI 근거 · 산출 항목 6 · 독립 논문 4편 · 최상위 항목 재현 시도 있음(인정 안 됨: 다른 기원 시료) · 관련 문헌(점수 미사용) 0편');
  assert.equal(ctx.evText(by(836033),true),'근거 · 항목 6 · 독립 논문 4편 · 최상위 재현 시도(불인정) · 관련 문헌 0편');
  assert.equal(ctx.evDep(by(836033)),'최상위 항목 제외 시 MBPI 63 · 근거 계수(0.75) 적용 전 백분위 96');
  assert.equal(ctx.evText(by(145721)),'MBPI 근거 · 산출 항목 8 · 독립 논문 3편 · 최상위 항목 재현됨 · 관련 문헌(점수 미사용) 0편');
  assert.equal(ctx.evDep(by(145721)),'최상위 항목 제외 시 MBPI 71.5 · 근거 계수(1) 적용 전 백분위 89.2');
  for(const r of rows){const s=by(r.aphia_id),e=r.evidence_profile,t=ctx.evText(s),h=ctx.renderScores(s);
    assert.ok(t.startsWith(`${rule.label} · 산출 항목 ${e.item_count} · 독립 논문 ${e.independent_paper_count}편 · ${rule.replication_labels[e.top_item_replication].replace(/\)$/,'')}`),r.korean_name+': '+t);
    assert.ok(t.endsWith(`관련 문헌(점수 미사용) ${e.unscored_related_count}편`),t);
    if(e.replication_exclusion_reason_ko)assert.ok(t.includes(': '+e.replication_exclusion_reason_ko+')'),t);
    assert.ok(h.includes(ctx.plain(t).replace(/&/g,'&amp;')),r.korean_name+': the MBPI section carries the profile');
    assert.ok(ctx.evCard(s).includes('class="card-evidence"'),r.korean_name);
    assert.ok(!/근거 논문 1편|단일 논문/.test(h),r.korean_name+': no old label words');
    // whole numbers for MBPI and BBVI without a replicated top item (0.4 and the BBVI line keep their decimal)
    const whole=e.top_item_replication!=='replicated';
    for(const k of ['MBPI','BBVI']){const v=r.scores[k],txt=ctx.scoreText(s,k,v);
      if(!whole||(Math.round(v)===0&&v!==0))assert.equal(txt,v.toFixed(1),`${r.korean_name} ${k}`);
      else assert.equal(txt,String(Math.round(v)),`${r.korean_name} ${k}`);}
    assert.equal(ctx.scoreText(s,'MFPI',r.scores.MFPI),r.scores.MFPI.toFixed(1),'MFPI keeps one decimal');
    assert.equal(ctx.score(s,'BBVI'),r.scores.BBVI,'the value itself is the report value');}
  assert.equal(ctx.scoreText(by(145086),'MBPI',0.4),'0.4','a non-zero value never reads 0');
  assert.equal(ctx.scoreText(by(836033),'BBVI',49.6),'49.6','rounding never crosses the BBVI line');
  assert.equal(ctx.scoreText(by(836033),'BBVI',50.4),'50');
  assert.equal(ctx.scoreText(by(145721),'BBVI',67.9),'67.9','the replicated species keeps one decimal');
  // an older report without the profile shows no profile line and keeps one decimal
  const old=report();delete old.method.evidence_profile;ctx.fetch=async()=>({status:200,ok:true,json:async()=>old});
  const n={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(n);vm.runInContext('data=globalThis.n',Object.assign(ctx,{n}));
  assert.equal(ctx.evText(n.species[0]),'');assert.equal(ctx.scoreText(n.species[0],'BBVI',71.9),'71.9');}
console.log('PASS: v2 report joins, screen values equal report, MFPI/MCUI traces, blank-as-missing, IUCN states, inconsistent-score guards, research candidates');
