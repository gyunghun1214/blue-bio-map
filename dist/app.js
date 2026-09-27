'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
const studyBounds = [[33,124],[38.7,132]];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'basic', bbviWeight = .5, mapMode = 'occurrence', selectedValueCell = null, comparisonPage = 0, matrixReadiness = new Map();
const VERIFIED = ['verified-pilot-2'];
const years = item => item.yearStart ? (item.yearStart===item.yearEnd ? String(item.yearStart) : `${item.yearStart}–${item.yearEnd}`) : '연도 미기재';
const safeUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : '#';
const sourceLink = (url,label) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)}</a>`;
const recordLabel = s => s.noOccurrences ? '출현자료 미수집'
  : Number.isSafeInteger(s.recordCount) ? s.recordCount.toLocaleString()+'건' : '기록 수 미확인';
// Evidence stages are independent of the operational DB's old inventory counters.
// A paper or a search with no matching assessment never becomes a scored input.
const coverageStages={unavailable:'미확인',found:'원자료 발견',linked:'종 연결',verified:'원문 확인',calculated:'시범 산출'};
function evidenceCoverage(s) {
  if(s.catalog&&s.audit){
    const a=s.audit;
    const checks=[
      {name:'학명',stage:'verified',detail:'WoRMS 승인명과 AphiaID 연결. 별도 GBIF 동의어는 원문 확인 뒤 연결.'},
      {name:'출현',stage:s.cells.length?'linked':s.review?.gbif.queried||s.review?.obis.queried?'found':'unavailable',
        detail:s.review?`${reviewLine(s.review)}. ${s.cells.length?'통과 기록만 공개 셀에 연결.':'공개 기준 통과 기록 없음 · 종 부재가 아님.'} 제외: ${withheldLine(s.review)}.`:'출현 검수 자료 확인 실패.'},
      {name:'영양',stage:a.nutrition.foodCode?'found':'unavailable',
        detail:a.nutrition.foodCode?'RDA 식품명 후보만 발견. 종 수준 시료 연결은 검수 전.':'종에 연결할 식품 행 미확인.'},
      {name:'생리활성',stage:pilotScore(s,'MBPI')!==null?'calculated':'unavailable',detail:pilotScore(s,'MBPI')!==null?'감태 분리 화합물 5종의 동일 ACE 시험 원문으로 검증 전 시범 MBPI 산출. 독립 논문 재현은 미확인.':'기원종·화합물·정량 실험 원문 미검수.'},
      {name:'보전',stage:a.iucn.record?.category?'found':'unavailable',
        detail:a.iucn.record?.category?'IUCN 게시 체크리스트에 전 지구 평가 메타데이터 있음. 원평가 일자·기준 미검수.':'체크리스트 정확한 승인명 연결 미확인. 공식 NE 아님.'}
    ];
    // A reviewed candidate assessment replaces the audit-only axis stages; name and occurrence stay audit-based.
    return s.assessment?{checks:[...checks.slice(0,2),...evidenceCoverage({...s,catalog:null}).checks.slice(2)]}:{checks};
  }
  const i=s.info||{}, a=s.assessment, f=a?.food_trace||{};
  const partial=a?.bioactivity_partial||[], conservation=a?.conservation_trace;
  const nutrition=i.nutrition||{}, compounds=i.compounds||{};
  const foodRows=f.observed_rows||[], extras=f.supplemental_nutrition||[];
  const foodLinked=foodRows.some(r=>r.linked)||extras.some(r=>r.taxon_link_evidence);
  const bioLinked=partial.some(r=>r.chain?.origin===true);
  const checks=[
    {name:'학명',stage:Number.isSafeInteger(s.aphiaID)&&!!s.wormsUrl?'verified':'unavailable',
      detail:'승인 학명·AphiaID와 WoRMS 원문을 확인한 상태입니다. 지표 점수는 아닙니다.'},
    {name:'출현',stage:s.cells?.length?'linked':!s.noOccurrences&&Number.isSafeInteger(s.recordCount)?'found':'unavailable',
      detail:s.cells?.length?'공개 출현 셀에 종을 연결했습니다. 출현기록은 개체수·자원량이나 현재 전체 분포가 아닙니다.':'기록 건수만으로 검수된 공개 셀 또는 현재 분포를 뜻하지 않습니다.'},
    {name:'영양',stage:pilotScore(s,'MFPI')!==null?'calculated':foodLinked?'linked':foodRows.length||extras.length||nutrition.status==='available'?'found':'unavailable',
      detail:pilotScore(s,'MFPI')!==null?'동기준 영양·가식부·양식 근거로 검증 전 시범 MFPI를 산출했습니다.':foodLinked?'종별 원값은 확인했으나 시료 상태·가식부·동일 기준 비교 또는 양식 근거가 부족해 MFPI는 보류합니다.':'영양 자료가 있더라도 이 종의 비교 가능한 원값인지 확인해야 합니다.'},
    {name:'생리활성',stage:pilotScore(s,'MBPI')!==null?'calculated':bioLinked?'linked':partial.length||compounds.status==='available'?'found':'unavailable',
      detail:pilotScore(s,'MBPI')!==null?'기원종·확정 구조·정량 실험·동일 층 비교집단을 검수해 시범 MBPI를 산출했습니다.':partial.length?'논문 단서만으로는 기원종→확정 물질→정량 시험→동일 조건 비교집단을 모두 연결하지 못했습니다. MBPI는 보류합니다.':'화합물 건수나 시험 생물만으로 종의 정량 활성은 확인되지 않습니다.'},
    {name:'보전',stage:pilotScore(s,'MCUI')!==null?'calculated':conservation?.iucn_state==='assessed'?'linked':'unavailable',
      detail:pilotScore(s,'MCUI')!==null?'검수된 IUCN 평가와 현행 여부를 확인해 독립적인 시범 MCUI를 산출했습니다.':conservation?.iucn_state==='not_in_red_list'?'IUCN을 검색했으나 이 종의 평가 레코드를 확인하지 못했습니다. 공식 NE 판정이 아닙니다.':'현행 평가의 등급·범위·평가일을 확인하기 전까지 MCUI를 보류합니다.'}
  ];
  return {checks};
}
function coverageBar(s){
  const checks=evidenceCoverage(s).checks;
  return `<div class="coverage-bar" role="list" aria-label="종별 자료 단계. 품질 점수나 완성률 아님">${checks.map(c=>`<span class="seg ${c.stage}" role="listitem" title="${esc(c.name+' · '+coverageStages[c.stage]+': '+c.detail)}"><b>${esc(c.name)}</b><small>${esc(coverageStages[c.stage])}</small></span>`).join('')}</div>`;
}
function coverageNotes(s){
  return '<ul class="coverage-notes">'+evidenceCoverage(s).checks.map(c=>`<li><b>${esc(c.name)} · ${esc(coverageStages[c.stage])}</b> — ${esc(c.detail)}</li>`).join('')+'</ul>';
}
const coverageGuide='학명·출현·영양·생리활성·보전 자료를 원자료 발견 → 종 연결 → 원문 확인 → 시범 산출 단계로 표시합니다. 단계는 완성률이나 근거 품질 점수가 아닙니다. 평가 검색 0건은 공식 미평가(NE)가 아닙니다.';

// Only a separately reviewed, traceable food input can expose an MFPI score.
// Older pilot reports with a number but no sample/basis/peer trace are withheld.
function foodTraceValid(s,a,sources) {
  const f=a.food_trace, ids=a.source_ids;
  if(f?.schema_version!=='food-1'||f.reviewed!==true||!Array.isArray(ids)||!f.nutrients)return false;
  const source=id=>typeof id==='string'&&ids.includes(id)&&
    /^https:\/\//.test(sources?.[id]?.url||'')&&!!sources[id].license&&!!sources[id].accessed;
  const units={protein_g:'g',iron_mg:'mg',zinc_mg:'mg'};
  const year=y=>Number.isInteger(y)&&y>=1900&&y<=new Date().getUTCFullYear();
  const basis=x=>x?.basis==='100 g edible portion'&&x.sample_state==='fresh'&&x.edible_part==='reviewed';
  for(const [name,unit] of Object.entries(units)){
    const n=f.nutrients[name];
    if(!n||n.reviewed!==true||!Number.isFinite(n.value)||n.value<0||n.unit!==unit||
       !basis(n)||!n.method||!year(n.sample_year)||!n.sample_region||!source(n.source_id)||
       !['measured','calculated','proxy'].includes(n.grade)||!Array.isArray(n.peers))return false;
    const peers=n.peers;
    if(peers.length<3||new Set(peers.map(p=>p.aphia_id)).size!==peers.length||
       !peers.some(p=>p.aphia_id===s.aphiaID&&p.value===n.value))return false;
    if(peers.some(p=>!Number.isSafeInteger(p.aphia_id)||p.aphia_id<=0||
       !Number.isFinite(p.value)||p.value<0||p.unit!==unit||!basis(p)||
       p.reviewed!==true||!source(p.source_id)||!p.method||!year(p.sample_year)||
       !p.sample_region||!['measured','calculated','proxy'].includes(p.grade)))return false;
  }
  const e=f.edible_fraction, q=f.aquaculture;
  if(e?.reviewed!==true||!Number.isFinite(e.value)||e.value<0||e.value>1||
     !e.method||!source(e.source_id))return false;
  if(q?.reviewed!==true||typeof q.feasible!=='boolean'||!q.method||
     !q.region||!year(q.assessment_year)||!q.limitations||!source(q.source_id))return false;
  return true;
}

const pilotScore = (s,key) => {
  if(key==='BBVI' && VERIFIED.includes(s.assessment?.report_version)){
    const food=s.assessment?.scores?.MFPI, bio=s.assessment?.scores?.MBPI;
    return Number.isFinite(food)&&Number.isFinite(bio)
      ? Math.round((bbviWeight*food+(1-bbviWeight)*bio)*10)/10 : null;
  }
  const value=s.assessment?.scores?.[key];
  return Number.isFinite(value) && value>=0 && value<=100 ? value : null;
};
const pilotCell = (s,key) => pilotScore(s,key)===null ? '<span class="pending">산출 보류</span>'
  : `${pilotScore(s,key).toFixed(1)}<small>시범 지표 · 타당성 미검증</small>`;

function verifiedFoodValid(a,report){
  if(a.scores.MFPI===null)return true;
  const f=a.food_trace, config=report.method?.nutrition, sources=report.sources||{};
  // The trace must name one fixed primary cohort, and its size must match the published cohort.
  const cohort=(report.comparison_cohorts||[]).find(c=>c.cohort_id===f?.cohort_id&&c.role==='primary');
  if(!f||!config||!cohort||!Number.isInteger(cohort.size)||cohort.size<3||f.cohort_species!==cohort.size||
     !['nutrient_weight','edible_fraction_weight','aquaculture_weight'].every(k=>
       Number.isFinite(config[k])&&config[k]>=0&&config[k]<=1)||
     Math.abs(config.nutrient_weight+config.edible_fraction_weight+config.aquaculture_weight-1)>1e-8||
     !Array.isArray(cohort.food_item_ids)||!Array.isArray(f.cohort_food_item_ids)||
     f.cohort_food_item_ids.length!==cohort.size||
     f.cohort_food_item_ids.some((id,i)=>id!==cohort.food_item_ids[i])||
     !f.cohort_food_item_ids.includes(f.source_food_item_id)||
     f.sample_state!=='raw'||f.basis!=='100 g edible portion'||!sources[f.source_id]||
     f.edible_fraction?.reviewed!==true||f.aquaculture?.reviewed!==true||
     typeof f.aquaculture.feasible!=='boolean')return false;
  let nutrient=0;
  for(const [name,unit] of Object.entries(config.components||{})){
    const n=f.nutrients?.[name];
    if(!n||!Number.isFinite(n.value)||n.value<0||n.unit!==unit||
        !Number.isFinite(n.percentile)||!Number.isFinite(n.percentile_unrounded)||n.percentile_unrounded<0||n.percentile_unrounded>100||
        !Number.isFinite(n.evidence_factor)||!n.method||!Array.isArray(n.peer_values)||
        n.peer_values.length!==f.cohort_species||!n.peer_values.every((p,i)=>
          p?.food_item_id===cohort.food_item_ids[i]&&Number.isFinite(p.value)&&p.value>=0)||
        n.peer_values.find(p=>p.food_item_id===f.source_food_item_id)?.value!==n.value||
        n.evidence_factor!==config.grade_factors?.[n.grade])return false;
    const values=n.peer_values.map(p=>p.value);
    const rank=100*(values.filter(v=>v<n.value).length+.5*values.filter(v=>v===n.value).length)/values.length;
    if(Math.abs(n.percentile_unrounded-rank)>1e-8||
       Math.abs(n.percentile-Math.round(rank*100)/100)>1e-8)return false;
    nutrient+=n.percentile_unrounded*n.evidence_factor;
  }
  const fraction=f.edible_fraction;
  if(!Number.isFinite(fraction.value)||fraction.value<0||fraction.value>1||!sources[fraction.source_id]||
     !sources[f.aquaculture.source_id])return false;
  const expected=config.nutrient_weight*nutrient/Object.keys(config.components).length+
    100*config.edible_fraction_weight*fraction.value+100*config.aquaculture_weight*Number(f.aquaculture.feasible);
  return Math.abs(expected-a.scores.MFPI)<.06;
}
function verifiedConservationValid(a,report){
  if(a.scores.MCUI===null)return true;
  const c=a.conservation_trace,check=c?.current_status_check;
  const checked=new Date((check?.checked_on||'')+'T00:00:00Z');
  return c?.reviewed===true&&check?.is_current===true&&!!report.sources?.[c.source_id]&&
    !!report.sources?.[check.source_id]&&/^\d{4}-\d{2}-\d{2}$/.test(check.checked_on||'')&&
    !Number.isNaN(checked.getTime())&&checked.toISOString().slice(0,10)===check.checked_on&&
    check.checked_on<=report.snapshot_date&&Number(check.checked_on.slice(0,4))>=c.assessment_year&&
    report.method?.conservation?.category_scores?.[c.category]===a.scores.MCUI;
}
function verifiedBioValid(a){
  if(a.scores.MBPI===null)return true;
  const items=a.bioactivity_trace;
  if(!Array.isArray(items)||!items.length)return false;
  if(items.some(x=>!x.stratum_id||!x.compound_id||!Array.isArray(x.activity_ids)||!x.activity_ids.length||
      !Array.isArray(x.original_paper_dois)||!x.original_paper_dois.length||
      !Number.isInteger(x.peer_compounds)||x.peer_compounds<3||
      !Number.isFinite(x.percentile)||!Number.isFinite(x.evidence_factor)||!Number.isFinite(x.adjusted)))return false;
  return Math.abs(a.scores.MBPI-Math.max(...items.map(x=>x.adjusted)))<.06;
}
function verifiedReportSpeciesValid(a,report){
  if(!a?.scores||!a.score_status||!Array.isArray(a.source_ids)||!a.source_ids.every(id=>report.sources?.[id]?.url))return false;
  if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>a.scores[k]===null||
      Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100))return false;
  if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>
      (a.scores[k]!==null)===(a.score_status[k]==='산출됨')))return false;
  if(!verifiedFoodValid(a,report)||!verifiedBioValid(a)||!verifiedConservationValid(a,report))return false;
  const w=report.food_weight;
  if(a.scores.BBVI!==null && (!Number.isFinite(a.scores.MFPI)||!Number.isFinite(a.scores.MBPI)||
      Math.abs(a.scores.BBVI-(w*a.scores.MFPI+(1-w)*a.scores.MBPI))>.06))return false;
  return true;
}

// Same rule as scripts/evaluate_candidates.py: a real calendar date, not before the assessment
// year and not after the check could have happened (report generation time, and never after now).
function realCheckDate(value,assessmentYear,generatedAt){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)return false; // 2026-02-30 rolls over
  const generated=Date.parse(generatedAt||'');
  const latest=Math.min(Date.now(),Number.isFinite(generated)?generated:Infinity);
  return Number(value.slice(0,4))>=assessmentYear&&d.getTime()<=latest;
}
async function attachPilotAssessments(next) {
  if(!next.live)return;
  let response;
  try { response=await fetch('assessments.json',{cache:'no-store'}); } catch { return; }
  if(response.status===404)return;
  if(!response.ok)return;
  try {
    const report=await response.json();
    const verified=VERIFIED.includes(report.method_version);
    if(!['pilot-1',...VERIFIED].includes(report.method_version)||report.status!=='provisional_unvalidated'||!Array.isArray(report.species))return;
    const rows=[...report.species,...(verified&&Array.isArray(report.candidate_species)?report.candidate_species:[])];
    const byId=new Map(rows.map(s=>[s.aphia_id,s]));
    if(byId.size!==rows.length)return;
    for(const s of next.species){
      let a=byId.get(s.aphiaID);
      if(a?.scientific_name!==s.name||!a.scores||!Array.isArray(a.source_ids))continue;
      if(!!s.catalog!==(a.candidate_label==='조사 후보'))continue; // research candidates never attach as operating species
      if(verified){
        if(verifiedReportSpeciesValid(a,report))s.assessment={...a,report_version:report.method_version};
        continue;
      }
      if(!a.source_ids.length)continue;
      if(!a.source_ids.every(id=>report.sources?.[id]?.url?.startsWith('https://')&&report.sources[id].license&&report.sources[id].accessed))continue;
      if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>a.scores[k]===null||(Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100)))continue;
      // A published score must carry inspectable components, not only a value.
      // PR #11: MFPI needs a reviewed, traceable food-1 input (fresh edible basis, peers, edible fraction, aquaculture).
      // Without it only MFPI and the dependent BBVI are withheld; the other axes stay.
      if(!foodTraceValid(s,a,report.sources))a={...a,scores:{...a.scores,MFPI:null,BBVI:null},food_trace:null,food_withheld:true};
      // Same rule for MBPI: a value without its assay trace is withheld (with BBVI); other axes stay.
      if(a.scores.MBPI!==null&&(!Array.isArray(a.bioactivity_trace)||!a.bioactivity_trace.length))a={...a,scores:{...a.scores,MBPI:null,BBVI:null},mbpi_withheld:true};
      // `reviewed` IUCN only means the original was read. MCUI also needs a sourced check that the
      // assessment is current; older reports lack it, so only MCUI is withheld, not the other axes.
      const t=a.conservation_trace;
      const currentChecked=t?.category&&t?.assessment_year&&t.current_status_verified===true
        &&report.sources?.[t.current_status_source_id]?.url?.startsWith('https://')&&realCheckDate(t.current_status_checked_on,t.assessment_year,report.generated_at);
      if(a.scores.MCUI!==null&&!currentChecked)a={...a,scores:{...a.scores,MCUI:null},mcui_withheld_reason:t?.mcui_withheld_reason||'current_status_unverified'};
      if(a.scores.BBVI!==null){
        if(['MFPI','MBPI'].some(k=>a.scores[k]===null))continue;
        if(!Number.isFinite(report.food_weight)||report.food_weight<0||report.food_weight>1)continue;
        const expected=report.food_weight*a.scores.MFPI+(1-report.food_weight)*a.scores.MBPI;
        if(Math.abs(a.scores.BBVI-expected)>.11)continue;
      }
      s.assessment=a;
    }
    next.assessmentInfo={foodWeight:report.food_weight,generatedAt:report.generated_at,
      sources:report.sources,method:report.method,cohort:report.comparison_cohort,cohorts:report.comparison_cohorts||[],version:report.method_version};
  } catch { /* A malformed optional report must not hide the underlying species evidence. */ }
}

// A species score does not establish a spatial decision. There is no reviewed
// cell-level join, sampling-effort adjustment or comparison cohort in the public data.
function cellAssessmentStatus(s,c) {
  const reasons=[];
  if(!s.live)reasons.push('추가 수집 격자: 공개 기준 셀의 평가 입력과 연결되지 않음');
  if(['BBVI','MCUI'].some(k=>pilotScore(s,k)===null))reasons.push('검수된 종별 BBVI·MCUI 한 쌍이 없음');
  if(!c?.citations?.length)reasons.push('해당 셀의 제공처·이용조건 연결 미확인');
  if(!Number.isFinite(c?.yearStart)||!Number.isFinite(c?.yearEnd))reasons.push('해당 셀의 기록 연도 범위 미확인');
  if(!c?.seaAreas?.length||c.seaAreas.includes('해역명 미확인'))reasons.push('해당 셀의 해역 메타데이터 미확인');
  reasons.push('종별 지표를 셀에 귀속할 검수된 연결·해역별 집계 규칙 없음');
  reasons.push('관측 노력·중복·조사 시기·국경 경계의 해역 간 비교 검증 없음');
  return {eligible:false,reasons};
}
function occurrenceCitationLinks(c) {
  return (c.citations||[]).map(x=>{
    const terms=(x.licenses||[]).map(l=>sourceLink({'CC0 1.0':'https://creativecommons.org/publicdomain/zero/1.0/',
      'CC BY 4.0':'https://creativecommons.org/licenses/by/4.0/'}[l],l)).join(' · ')||'이용조건 미확인';
    return `<li>${sourceLink(x.url,x.title||'제공처 원문')} · ${terms}</li>`;
  }).join('');
}
function mapJudgmentStatus(s) {
  $('map-judgment').textContent=s.cells?.length
    ? `해역별 활용·보전 판단: 승인 0곳 · 표시된 ${spatialCells(s).length}개 셀 모두 판단 보류. 셀을 눌러 원자료와 부족한 근거를 확인하세요.`
    : '해역별 활용·보전 판단: 승인 0곳 · 공개 출현 셀이 없어 해역 판단도 보류합니다.';
}

// Original IUCN assessments verified in research/species-conservation. Historical records only:
// not the current status, not a Korea-only assessment and not an MCUI input until a current check.
// 2026-09-25: GBIF's copy of the IUCN checklist (Red List version 2026-07-28) cites a newer 2026 assessment.
// Category and citation are confirmed; criteria, date assessed and scope detail still need a read of the assessment text.
const IUCN_HISTORICAL = {"241776":{"category":"EN A2bd","published":2013,"assessed":"2010-05-19","scope":"북서태평양 전 분포(한국 단독 평가 아님)","url":"https://www.iucnredlist.org/species/180424/1629389",
  "current":{"category":"EN","published":2026,"citation":"Hamel & Mercier 2026","scope":"전 세계(Global) 평가","url":"https://doi.org/10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en","found_via":"GBIF의 IUCN 적색목록 체크리스트(2026-07-28판)","checked":"2026-09-25"}}};
// Wording follows the MCUI gate: a pilot MCUI exists only after a sourced, dated current-status check.
function iucnHistoricalText(h,s){
  const base=`IUCN ${h.category}: ${h.published}년 발표(${h.assessed} 평가) · ${h.scope}.`;
  const t=s&&pilotScore(s,'MCUI')!==null?s.assessment.conservation_trace:null;
  if(t&&t.record_id&&t.publication_year&&t.publication_year!==h.published)
    return `IUCN 현행 평가 ${t.category} ${t.criteria||''}: ${t.publication_year}년 발표(${t.assessment_date} 평가) · 전 지구 범위. 이전 ${h.category}(${h.published}년 발표, ${h.assessed} 평가)는 대체된 역사적 평가입니다. 검증 전 시범 MCUI에는 현행 평가만 사용했고, 한국 한정 평가나 확정된 정책 판단이 아닙니다.`;
  return t
    ? `${base} 시범 보고서가 ${t.current_status_checked_on}에 출처 ${t.current_status_source_id}로 이 평가가 현행 IUCN 평가임을 재확인해, 검증 전 시범 MCUI에 사용했습니다. 전 세계 범위 평가이며 2026년 한국 한정 평가나 확정된 정책 판단이 아닙니다.`
    : h.current
    ? `IUCN ${h.current.category}: ${h.current.published}년 발표(${h.current.citation}) · ${h.current.scope}. ${h.published}년 ${h.category} 평가(${h.assessed} 평가)를 대체한 현행 평가입니다. 등급과 인용은 ${h.current.found_via}에서 ${h.current.checked}에 확인했고, 평가 기준·평가일·범위는 원문 검수 전입니다. 한국 한정 평가가 아닙니다.`
    : `${base} 역사적 평가이며, 현행 평가 여부는 확인하지 않았습니다.`;
}
function iucnHistoricalRows(s){
  const h=IUCN_HISTORICAL[s.aphiaID];if(!h)return '';
  const verified=pilotScore(s,'MCUI')!==null, stale=new Date().getFullYear()-h.published>10;
  if(h.current&&!verified)return row('IUCN 현행 평가',`${h.current.category} · ${h.current.published}년 발표 (원문 검수 전)`)
    +row('이전 평가',`${h.category} · ${h.published}년 발표 (2026년 평가로 대체)`)
    +`<p class="fine">${esc(iucnHistoricalText(h,s))} MCUI는 평가 기준·평가일·범위를 원문으로 검수한 뒤에만 씁니다. ${sourceLink(h.current.url,'2026년 평가 (DOI) ↗')} · ${sourceLink(h.url,'2013년 평가 ↗')}</p>`;
  return (stale&&!verified?row('IUCN 표기','갱신 필요(Needs updating)','pending')+'<p class="fine">IUCN은 평가 후 10년이 지나면 적색목록 사이트에 \'Needs updating\'으로 표시합니다.</p>':'')+row(h.current?'이전 평가':'IUCN 원평가',`${h.category} · ${h.published}년 발표 ${h.current?`(${h.current.published}년 평가로 대체)`:verified?'(현행 여부 재확인 · 시범)':'(역사적 평가)'}`)
    +(verified?row('현행 평가',`재확인 ${s.assessment.conservation_trace.current_status_checked_on||s.assessment.conservation_trace.current_status_check?.checked_on||'날짜 미기재'} · 시범 보고서`):row('현행 평가','확인 보류','pending'))
    +`<p class="fine">${esc(iucnHistoricalText(h,s))}${verified?'':' 2026년 한국 현황이나 MCUI로 바꾸지 않습니다.'} ${sourceLink(h.url,'IUCN 평가 레코드 ↗')}</p>`;
}
const CASE_NOTES = {"241776":{"title":"돌기해삼 원논문","url":"https://doi.org/10.1111/bph.16333","detail":"Holotoxin A₁의 Candida albicans SC5314 MIC·MFC 각 2 µg/mL은 원논문에서 직접 확인. 외부 CID의 구조 대응과 동일 표적·시험군 pChEMBL은 미확인. 사람 대상 약효 자료가 아님."},"377084":{"title":"다시마 원논문","url":"https://doi.org/10.1002/cbdv.202000233","detail":"Lj5 다당류 분획의 α-glucosidase IC50 153.27 ± 22.89 µg/mL 확인. 단일 분자 CID·InChIKey가 없으므로 현행 소분자 MBPI 입력에서 제외."}};
function assessmentBlockers(s){
  const i=s.info||{}, n=i.nutrition||{}, c=i.compounds||{}, k=i.conservation||{};
  const reasons={};
  if(pilotScore(s,'MFPI')===null){
    const gaps=[];
    if(n.status!=='available')gaps.push('검수된 영양 값 미확인');
    else {
      if(n.unit_unconfirmed_count>0)gaps.push('영양 단위 미확정');
      if(n.basis_assumed_count>0)gaps.push('가식부 100 g 기준 가정');
      gaps.push('단위·가식부 기준의 원자료와 동종 비교집단 재검수');
    }
    gaps.push('가식부 비율과 양식 가능성 근거 미연결');
    if(s.assessment?.food_withheld)gaps.unshift('보고서의 MFPI는 가식부 100 g 원값·시료·동기준 비교 추적이 검증되지 않아 보류');
    reasons.MFPI=gaps.join(' · ');
  }
  if(pilotScore(s,'MBPI')===null){
    const base=c.status==='available'&&Number.isFinite(c.compound_count)
      ? `보고 화합물 ${c.compound_count}개는 활성 근거가 아님.`
      : '화합물–정량 시험 연결 미확인.';
    reasons.MBPI=(s.assessment?.mbpi_withheld?'보고서의 MBPI는 화합물·표적·assay 추적이 없어 보류. ':'')+base+' 기원종–단일 화합물 ID–표적·assay–pChEMBL–원논문과 동일 층 비교집단 검수 필요.';
  }
  if(pilotScore(s,'MCUI')===null){
    const h=IUCN_HISTORICAL[s.aphiaID];
    reasons.MCUI=h
      ? iucnHistoricalText(h,s)+(h.current?' 원문(평가 기준·평가일·범위) 검수 전이라 MCUI 입력으로 쓰지 않음.':' 현행 평가 확인 전이라 MCUI 입력으로 쓰지 않음.')+' 출현기록 수는 개체군 변화가 아님.'
      : s.assessment?.mcui_withheld_reason
      ? `검수된 IUCN 원평가(${s.assessment.conservation_trace?.category||'등급 미기재'} · ${s.assessment.conservation_trace?.assessment_year||'연도 미기재'})는 있으나 현행 평가인지 확인한 근거가 없어 보류.`
      : k.status==='withheld_insufficient_evidence'
      ? 'IUCN 검색 이력은 있으나 해당 종의 검수된 평가 등급·연도·평가 범위가 연결되지 않음.'
      : '검수된 IUCN 평가 등급·연도·평가 범위 미확인. 출현기록 수는 개체군 변화가 아님.';
  }
  if(pilotScore(s,'BBVI')===null)reasons.BBVI='MFPI와 MBPI가 모두 산출되어야 계산 가능.';
  return reasons;
}
function assessedForMatrix(s){
  return s.live&&['MFPI','MBPI','MCUI','BBVI'].every(k=>pilotScore(s,k)!==null);
}
// Computed values first, then the axes still on hold: "MFPI 65.5 · MBPI·MCUI 보류".
function scoreSummary(s){
  const keys=['MFPI','MBPI','MCUI'], held=keys.filter(k=>pilotScore(s,k)===null);
  return [...keys.filter(k=>!held.includes(k)).map(k=>`${k} ${pilotScore(s,k).toFixed(1)}`),held.length?held.join('·')+' 보류':''].filter(Boolean).join(' · ');
}
// Follow-up tasks are an evidence-gap inventory, never a value or urgency rank.
// Refuse stale, wrong-taxon or score-inconsistent readiness rows.
function followupDecision(s){
  if(!s?.live)return null;
  const row=matrixReadiness.get(s.aphiaID);
  if(!row||row.scientific_name!==s.name||row.scope!==(s.catalog?'expansion_22':'operating_8'))return null;
  if(['MFPI','MBPI','MCUI','BBVI'].some(k=>row.scores?.[k]!==pilotScore(s,k)))return null;
  const foodReason=row.axis_reasons?.MFPI;
  const foodMissing=Array.isArray(foodReason)?foodReason:[foodReason].filter(Boolean);
  const bioMissing=row.bioactivity_missing_steps||[];
  const foodTask=foodMissing.length
    ?'종 일치·시료 상태·가식부와 양식 근거를 원문에서 확인: '+foodMissing.map(k=>matrixReasonLabel[k]||k).join('·')
    :'시범 MFPI의 식품 행·고정 비교집단·지역 시료를 독립 자료로 재검증';
  const bioTask=bioMissing.length
    ?'기원종→동정 물질→정량 시험 연결 및 동일 assay층 확보: '+bioMissing.map(k=>matrixReasonLabel[k]||k).join('·')
    :'시범 MBPI의 동일 조건 독립 문헌·반복 실험을 확인';
  const iucnTask=row.scores.MCUI===null
    ?row.axis_reasons?.MCUI==='not_in_red_list'?'IUCN 검색 미발견(공식 NE 아님): 이명·원평가 범위·갱신 여부를 다시 조회'
      :'IUCN 원평가의 범위·등급·기준·연도·현행 여부 검수'
    :'시범 MCUI의 현행 평가·지역 적용 가능성 재검토';
  return {
    row,
    research:[foodTask,bioTask],
    conservation:[iucnTask,'출현 기록의 조사 노력·연도·중복·편향 확인. 기록 감소만으로 개체군 감소를 판정하지 않음'],
    industry:'활용 실증 전에 안전성·관련 규제·ABS·권리·공급망·지속가능한 생산 근거를 별도로 검토. 적합성 또는 사업성 판정 아님',
    known:['MFPI','MBPI','MCUI'].filter(k=>pilotScore(s,k)!==null),
    blocked:['MFPI','MBPI','MCUI','BBVI'].filter(k=>pilotScore(s,k)===null),
    sourceUrls:Array.isArray(row.source_urls)?row.source_urls.filter(url=>/^https:\/\//.test(url)):[]
  };
}
function appendFollowupBrief(s){
  const plan=followupDecision(s);
  if(!plan)return;
  const target=$('detail');
  if(typeof target?.insertAdjacentHTML!=='function')return;
  target.insertAdjacentHTML('beforeend',
    '<details class="detail-more followup-brief"><summary>현재 판단 가능 범위 · 보류 이유 · 다음 조사</summary><div class="detail-more-body">'+
    '<p><b>현재 판단 가능 범위:</b> '+esc(plan.known.length?'검증 전 시범 '+plan.known.join('·')+'만 축별로 해석':'산출된 시범 지표 없음')+
    '. 실제 BBVI×MCUI 매트릭스 배치 '+(pilotScore(s,'BBVI')!==null&&pilotScore(s,'MCUI')!==null?'시범 조건 충족':'보류')+'.</p>'+
    '<p><b>판단 보류:</b> '+esc(plan.blocked.length?plan.blocked.join('·')+' 필수 근거 미충족':'실행 판단은 별도 검증 필요')+'. 미확인은 0점이 아닙니다.</p>'+
    '<p><b>연구기관:</b> '+plan.research.map(esc).join(' / ')+'</p>'+
    '<p><b>정부·보전기관:</b> '+plan.conservation.map(esc).join(' / ')+'</p>'+
    '<p><b>기업 검토:</b> '+esc(plan.industry)+'</p>'+
    '<p class="fine">점수 또는 실행 우선순위가 아닌 후속 검증 과제. 원문 링크·조회일·이용조건은 위 근거 상세/출처에서 확인합니다. 종 단위 점수를 출현 셀·해역 가치로 전가하지 않습니다.</p></div></details>');
}
function renderDecisionList(){
  const list=$('decision-list'), panel=$('decision-detail');
  list.innerHTML=data.species.map(s=>{
    const ready=assessedForMatrix(s);
    return `<button type="button" class="decision-card" data-aphia="${s.aphiaID}" aria-controls="decision-detail"><strong>${esc(s.label)}</strong><em>${esc(s.name)} · AphiaID ${s.aphiaID}</em><span>${ready?'검증 전 시범 지표 · 근거 확인':esc(scoreSummary(s))}</span></button>`;
  }).join('');
  list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>showDecision(data.species.find(s=>s.aphiaID===Number(b.dataset.aphia)))));
  panel.textContent='종을 선택하면 산출 여부, 부족한 입력과 확인 가능한 원문을 볼 수 있습니다.';
}
function showDecision(s){
  if(!s)return;
  $('decision-list').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.aphia)===s.aphiaID)));
  const a=s.assessment, info=data.assessmentInfo||{}, reasons=assessmentBlockers(s), study=CASE_NOTES[s.aphiaID];
  let html=`<h3>${esc(s.label)} · 실제 종 근거</h3><p class="fine">${esc(s.name)} · AphiaID ${s.aphiaID} · ${a?'검증 전 시범 지표':'산출 보류'}</p>`;
  for(const k of ['MFPI','MBPI','MCUI','BBVI']){
    const value=pilotScore(s,k);
    html+=`<div class="decision-axis"><b>${k}: ${value===null?'산출 보류':value.toFixed(1)+' / 100'}</b><p>${esc(reasons[k]||'검수된 입력을 사용한 시범 산출값. 외부 사례 검증 전.')}</p></div>`;
  }
  const plan=followupDecision(s);
  if(plan){
    const date=s.catalog?data.readinessCandidateDate:data.readinessAssessmentDate;
    html+='<section class="followup-panel"><h4>현재 판단 가능한 범위</h4>'+
      '<p>'+esc(plan.known.length?'검증 전 시범 지표: '+plan.known.join('·')+' (축별로만 해석)':'시범 산출 지표 없음. 확인된 원자료의 연결 상태만 설명 가능')+
      '. BBVI×MCUI 종합 배치 '+(pilotScore(s,'BBVI')!==null&&pilotScore(s,'MCUI')!==null?'시범 조건 충족':'보류')+'. 출현 셀은 분포·개체수·자원량 또는 해역 가치가 아닙니다.</p>'+
      '<h4>판단 보류 이유</h4><p>'+esc(plan.blocked.length?plan.blocked.map(k=>k==='MBPI'?k+' '+(plan.row.bioactivity_missing_steps||[]).map(x=>matrixReasonLabel[x]||x).join('·'):k+' '+(matrixReasonLabel[plan.row.axis_reasons?.[k]]||plan.row.axis_reasons?.[k]||'필수 근거 미충족')).join(' / '):'축별 시범 산출 가능. 실행 권고는 별도 검증 필요')+'</p>'+
      '<h4>다음 조사 · 순위 아님</h4><dl>'+
      '<dt>연구기관</dt><dd>'+plan.research.map(esc).join('<br>')+'</dd>'+
      '<dt>정부·보전기관</dt><dd>'+plan.conservation.map(esc).join('<br>')+'</dd>'+
      '<dt>기업의 검토 과제</dt><dd>'+esc(plan.industry)+'</dd></dl>'+
      '<p class="fine">근거 수준: '+(plan.known.length?'검증 전 시범 지표 일부 · ':'')+'나머지 축은 보류 · '+esc(s.catalog?'조사 후보':'운영 발행 종')+
      ' · 자료 스냅샷 '+esc(date||'미확인')+' · 제안 표시일 '+esc(data.readinessAssessmentDate||'미확인')+
      ' · 비교집단/비용/실행가능성 기준으로 순위를 매기지 않았습니다.</p>'+
      '<h4>연결된 원자료·조회 출처</h4><ul>'+plan.sourceUrls.map(url=>'<li>'+sourceLink(url,'원자료 ↗')+'</li>').join('')+'</ul></section>';
  }else html+='<p class="fine">검수 상태 파일과 종명·AphiaID·축별 값의 연결을 확인하지 못해 후속조사 제안을 보류합니다.</p>';
  if(a){
    const f=pilotScore(s,'MFPI')!==null?a.food_trace:null;
    if(f){
      html+='<h4>MFPI 구성</h4><ul>';
      for(const [key,n] of Object.entries(f.nutrients||{})){
        html+=`<li>${esc(key)}: 가식부 100 g당 ${esc(n.value)} ${esc(n.unit)} · ${esc(n.grade)} · 동기준 비교 ${esc(n.peers?.length)}종 · 백분위 ${esc(n.percentile??'미기재')} · ${esc(n.source_id)}</li>`;
      }
      html+=`<li>가식부 비율 ${esc(f.edible_fraction?.value)} (${esc(f.edible_fraction?.source_id)}) · 양식 근거 ${f.aquaculture?.feasible?'가능성 검토됨':'불충분'} (${esc(f.aquaculture?.source_id)})</li></ul>`;
    }
    if(a.bioactivity_trace?.length){
      html+='<h4>MBPI 구성</h4><ul>';
      for(const b of a.bioactivity_trace)html+=`<li>${esc(b.compound_id)} · 표적 ${esc(b.stratum?.[0])}, assay ${esc(b.stratum?.[1])} · 중앙 pChEMBL ${esc(b.median_pchembl)} · 비교 화합물 ${esc(b.peer_count)}개 · 백분위 ${esc(b.rank)} · 독립 문헌 ${esc(b.independent_references)}건 · 근거 계수 ${esc(b.evidence_factor)} · ${esc((b.reference_ids||[]).join(', '))}</li>`;
      html+='</ul>';
    }
    const c=a.conservation_trace;
    if(c)html+=`<h4>MCUI 구성</h4><p>IUCN ${esc(c.category||'미확인')} · 평가 ${esc(c.assessment_year||'미확인')} · 출처 ${esc(c.source_id||'미확인')}${a.iucn_review_older_than_10y?' · 10년 초과 평가':''} · 현행 평가 ${a.scores.MCUI===null?'확인 보류':`확인 ${esc(c.current_status_checked_on)} (${esc(c.current_status_source_id)})`}. ${c.obis_trend?`노력 보정 추세 ${esc(c.obis_trend.direction)} (${esc(c.obis_trend.source_id)})`:'출현기록만으로 추세 보정하지 않음.'}</p>`;
    html+=`<h4>계산과 기준일</h4><p>MFPI: 영양 백분위·등급 80%, 가식부 10%, 양식 근거 10%. MBPI: 동일 표적·assay층 화합물 백분위 × 문헌 계수. BBVI: MFPI ${esc(info.foodWeight*100)}% + MBPI ${esc((1-info.foodWeight)*100)}%. MCUI는 별도 축. 산출 ${esc(info.generatedAt||'미기재')}. 모든 가중치와 점수는 검증 전 시범값입니다.</p>`;
    html+='<h4>원문·이용조건</h4><ul>'+a.source_ids.map(id=>`<li>${sourceLink(info.sources?.[id]?.url,id+' ↗')} · ${esc(info.sources?.[id]?.license||'이용조건 미확인')} · 조회 ${esc(info.sources?.[id]?.accessed||'미기재')}</li>`).join('')+'</ul>';
  }
  {const h=IUCN_HISTORICAL[s.aphiaID];if(h)html+=`<h4>IUCN 평가 · ${pilotScore(s,'MCUI')!==null?(h.current?`${h.current.published}년 현행 평가 · 시범 MCUI`:'현행 여부 재확인(시범)'):h.current?'2026년 현행 평가 확인 · 원문 검수 전':'역사적 평가'}</h4><p>${esc(iucnHistoricalText(h,s))} ${sourceLink(h.current?.url||h.url,'IUCN 평가 레코드 ↗')}</p>`;}
  if(study)html+=`<h4>별도 원문 조사 · 지표 입력 아님</h4><p>${esc(study.detail)} ${sourceLink(study.url,study.title+' ↗')}</p>`;
  html+='<p class="fine">실험값은 사람 대상 약효가 아니며, 지도 출현 셀은 개체수·자원량·채집 지점이 아닙니다.</p>';
  $('decision-detail').innerHTML=html;
}

// Row counts are an inventory of retrieved records. They do not supply edible
// portion values or a comparable peer set.
function foodEvidencePanel(s) {
  if(VERIFIED.includes(s.assessment?.report_version))return '';
  const f=s.assessment?.food_trace, sources=data?.assessmentInfo?.sources||{};
  if(pilotScore(s,'MFPI')!==null && f && foodTraceValid(s,s.assessment,sources)){
    const names={protein_g:'단백질',iron_mg:'철',zinc_mg:'아연'};
    const trace=Object.entries(names).map(([key,label])=>{
      const n=f.nutrients[key],src=sources[n.source_id];
      return row(label,n.value+' '+n.unit+' / 100 g 가식부 · 생물(fresh) · '+n.grade)+
        `<p class="fine">방법 ${esc(n.method)} · 시료 ${esc(n.sample_region)}, ${esc(n.sample_year)} · 동기준 비교 ${n.peers.length}종 · ${sourceLink(src.url,'원자료 ↗')} · 조회 ${esc(src.accessed)} · 이용조건 ${esc(src.license)}</p>`;
    }).join('');
    const e=f.edible_fraction,q=f.aquaculture;
    return '<h3>식량 가능성 · 검증 전 시범 지표</h3>'+trace+
      row('가식부 비율',String(e.value)+' · '+e.method)+
      `<p class="fine">${sourceLink(sources[e.source_id].url,'가식부 원자료 ↗')} · 조회 ${esc(sources[e.source_id].accessed)} · 이용조건 ${esc(sources[e.source_id].license)}</p>`+
      row('양식 근거',q.feasible?'가능성 근거 검토됨':'가능성 근거 불충분')+
      `<p class="fine">범위 ${esc(q.region)}, ${q.assessment_year} · 방법 ${esc(q.method)} · 제약 ${esc(q.limitations)} · ${sourceLink(sources[q.source_id].url,'양식 원자료 ↗')} · 조회 ${esc(sources[q.source_id].accessed)} · 이용조건 ${esc(sources[q.source_id].license)}</p>`+
      '<p class="fine">MFPI 시범 산식: 동기준 3종 이상 영양 백분위(등급 보정) 80% + 가식부 비율 10% + 양식 근거 10%. 가중치는 외부 검증 전입니다.</p>';
  }
  const n=s.info?.nutrition||{},p=s.info?.production||{};
  const inventory=n.status==='available'
    ? `수집 요약 ${count(n.record_count)} · 단위 미확정 ${count(n.unit_unconfirmed_count)} · 기준량 가정 ${count(n.basis_assumed_count)}.`
    : n.status==='not_collected'?'영양 자료 미수집.':'영양 자료 원값 확인 불가.';
  const farming=Number.isFinite(p.aquaculture_evidence_count)&&p.aquaculture_evidence_count>0
    ? `양식 표시 근거 ${count(p.aquaculture_evidence_count)}도 해역·시기·방법·제약을 검수하지 못했습니다.`
    : '종별 양식 기술·해역·시기·제약을 검수한 근거가 없습니다.';
  return '<h3>식량 가능성 · MFPI 산출 보류</h3>'+
    `<div class="withheld"><b>동일 기준 종별 원자료 미확인</b>${esc(inventory)} ${esc(farming)} 단백질(g), 철·아연(mg)의 생물 가식부 100 g 실측·계산·대용값과 방법·시료 시기, 가식부 비율, 양식 근거, 동기준 비교 3종 이상 및 이용조건을 원레코드에서 확인해야 합니다. 미확인은 0점이 아닙니다.</div>`;
}

// Short table labels; the full sentence is in scoreReason. Unconfirmed is a reason, never a low value.
const shortReason={comparable_nutrition_missing:'고정 비교집단에 종 행 없음',food_row_not_species_specific:'식품 행이 종 수준 아님',
  component_missing_in_source:'필수 성분 결측',aquaculture_method_unverified:'양식 근거 부족',
  compound_origin_assay_chain_or_fixed_cohort_missing:'기원종→물질→시험 비교집단 없음',not_in_red_list:'IUCN 검색 0건 · 낮은 점수 아님',
  assessment_lookup_failed:'IUCN 조회 실패',category_not_numeric:'IUCN DD · 숫자 없음',requires_MFPI_and_MBPI:'MFPI·MBPI 둘 다 필요'};
const scoreReason={
  comparable_nutrition_missing:'같은 시료 상태의 고정 영양 비교집단에 이 종의 행이 없습니다.',
  food_row_not_species_specific:'식품성분표 행이 종 수준으로 확인되지 않아(예: 일반명 “해삼”) 이 종의 값으로 쓰지 않습니다.',
  component_missing_in_source:'원자료에 필수 성분(단백질·철·아연) 중 일부가 비어 있습니다. 빈칸은 0이 아니라 결측입니다.',
  species_edible_yield_unverified:'이 종의 원자료 가식부 비율을 검증하지 못했습니다.',
  aquaculture_method_unverified:'지역·시기·방법이 확인된 양식 근거가 부족합니다.',
  compound_origin_assay_chain_or_fixed_cohort_missing:'기원종·구조·시험값·원논문을 완결해 연결한 비교집단이 없습니다.',
  original_assessment_not_reviewed:'IUCN 기록을 찾았지만 원평가를 검수하지 못했습니다.',
  not_in_red_list:'IUCN 적색목록 2026-1에서 이 종(및 확인한 동의어)의 평가를 찾지 못했습니다. IUCN이 부여한 공식 NE 범주나 낮은 점수가 아닙니다.',
  assessment_lookup_failed:'IUCN 평가 조회에 실패했습니다. 평가가 없다는 뜻이 아닙니다.',
  category_not_numeric:'DD(정보 부족) 등 시범 숫자 매핑이 없는 범주입니다. 낮은 점수로 바꾸지 않습니다.',
  assessment_not_current:'확인한 평가가 현행 평가가 아닙니다.',
  current_status_unverified:'현행 IUCN 평가 여부를 확인하지 못했습니다.',
  requires_MFPI_and_MBPI:'기본 통합 BBVI에는 MFPI와 MBPI 두 축이 모두 필요합니다.'
};
const nutrientNames={protein_g:'단백질',iron_mg:'철',zinc_mg:'아연'};
function verifiedSource(id,label){
  const src=data?.assessmentInfo?.sources?.[id];
  return src?sourceLink(src.url,label||src.title||id):esc(label||id||'출처 미확인');
}
function observedRows(f){
  return (f.observed_rows||[]).map(o=>`<div class="score-fact"><b>${esc(o.reported_food_name)} · ${esc(o.food_item_id)}${o.linked?'':' · 종 연결 안 함'}</b>`+
    `<span>${Object.entries(nutrientNames).map(([k,label])=>`${label} ${o.values[k]===null?'결측(빈칸)':esc(o.values[k])+' '+(k==='protein_g'?'g':'mg')}`).join(' · ')}`+
    ` / 100 g 가식부 · 폐기율 ${o.refuse_pct===null?'결측':esc(o.refuse_pct)+'%'} · 출처 표기 ${esc(o.row_source||'없음')}</span></div>`+
    `<p class="fine">${esc(o.link_evidence||'')} ${verifiedSource('rda_db_10_4','RDA 식품성분 DB 10.4 ↗')}</p>`).join('');
}
function verifiedFoodDetail(s){
  const f=s.assessment.food_trace||{};
  if(!Number.isFinite(s.assessment.scores.MFPI))return observedRows(f)+
    (f.supplemental_nutrition||[]).map(o=>`<p class="fine">별도 원값 ${esc(o.record_id)} · ${esc(o.sample_state)} · ${esc(o.basis)}: `+
      `${Object.entries(o.values||{}).map(([key,v])=>`${esc(nutrientNames[key]||key)} ${esc(v.value)} ${esc(v.unit)}`).join(' / ')}. `+
      `${esc(o.exclusion_reason)} ${verifiedSource(o.source_id,'원자료 ↗')}</p>`).join('');
  const raw=Object.entries(f.nutrients||{}).map(([key,n])=>
    `<div class="score-fact"><b>${esc(nutrientNames[key]||key)} ${esc(n.value)} ${esc(n.unit)} / 100 g 가식부</b>`+
    `<span>${esc(n.grade)} · 고정 비교집단 백분위 ${esc(n.percentile)} · 신뢰도 계수 ${esc(n.evidence_factor)}</span></div>`).join('');
  const c=f.components||{}, e=f.edible_fraction, q=f.aquaculture;
  const cohort=(data.assessmentInfo.cohorts||[]).find(x=>x.cohort_id===f.cohort_id);
  return `<p>${esc(f.reported_food_name)} (${esc(f.english_name)}) · 식품코드 ${esc(f.source_food_item_id)} · 출처 표기 ${esc(f.row_source)} · ${verifiedSource(f.source_id,'원자료 ↗')}</p>`+raw+
    `<p><b>점수 구성</b> 영양값 ${esc(c.nutrient_value_contribution)} − 자료 신뢰도 감점 ${esc(c.evidence_grade_deduction)} + 가식부 ${esc(c.edible_fraction_contribution)} + 양식 ${esc(c.aquaculture_contribution)} = ${esc(s.assessment.scores.MFPI)}</p>`+
    `<p class="fine">고정 비교집단 ${esc(f.cohort_id)} · ${esc(f.cohort_species)}개 식품${cohort?' ('+esc(cohort.foods.join(', '))+')':''}. ${esc(f.cohort_criteria)} 비교집단이 다른 종의 MFPI끼리는 비교하지 않습니다.</p>`+
    `<p>가식부 ${esc((e.value*100).toFixed(1))}% · ${esc(e.method)} · ${verifiedSource(e.source_id,'원자료 ↗')}</p>`+
    `<p>양식 방법: ${esc(q.method)}. 적용 범위: ${esc(q.region)} (${esc(q.year)}). 제약: ${esc(q.limitations)} ${verifiedSource(q.source_id,'양식 근거 ↗')}</p>`+
    (f.yield_sensitivity||[]).map(y=>`<p class="fine">가식부 ${esc((y.fraction*100).toFixed(2))}% (${esc(y.region||'')}) 대입 시 MFPI ${esc(Number(y.mfpi_at_same_nutrients).toFixed(1))} · ${verifiedSource(y.source_id,'독립 자료 ↗')}</p>`).join('')+
    (f.weight_sensitivity||[]).map(w=>`<p class="fine">가중치 ${w.nutrient_weight}/${w.edible_fraction_weight}/${w.aquaculture_weight} 적용 시 MFPI ${esc(Number(w.mfpi).toFixed(1))}</p>`).join('')+
    (f.grade_sensitivity?`<p class="fine">신뢰도 계수를 모두 1로 두면 MFPI ${esc(Number(f.grade_sensitivity.all_grade_factors_1).toFixed(1))}</p>`:'')+
    (f.cross_checks||[]).map(x=>`<p class="fine">교차 점검 ${esc(x.cohort_id)} (${esc(x.cohort_species)}종): MFPI ${esc(Number(x.mfpi).toFixed(1))}. ${esc(x.note)}</p>`).join('')+
    (f.uncertainty||[]).map(x=>`<p class="fine">불확실성: ${esc(x)}</p>`).join('');
}
function verifiedBioDetail(s){
  const items=s.assessment.bioactivity_partial||[];
  const steps={origin:'기원종',structure_id:'구조 ID',quantitative_endpoint:'정량값',comparable_cohort:'비교 코호트'};
  return items.length?items.map(item=>{
    const values=(item.values||[]).map(v=>{
      const parts=[v.material, v.value!==undefined&&v.value!==null?`${v.endpoint||item.endpoint||'측정값'} ${v.relation||''} ${v.value}${v.uncertainty!==undefined?' ± '+v.uncertainty:''} ${v.unit||''}`:v.unit,
        v.dose!==undefined?`${v.dose} ${v.dose_unit||''}`:null,
        v.viability_percent!==undefined?`세포 생존율 ${v.viability_percent}%`:null].filter(Boolean);
      return parts.map(esc).join(' · ');
    }).join(' / ');
    const source=data.assessmentInfo?.sources?.[item.source_id];
    const chain=item.chain?Object.entries(steps).map(([k,label])=>`${label} ${item.chain[k]?'✓':'✗'}`).join(' → '):'';
    return `<div class="score-fact"><b>${esc(item.material_kind)} · ${esc(item.endpoint||'endpoint 미확인')}</b>`+
      `<span>${values} ${item.test_system?' · '+esc(item.test_system):''}</span></div>`+
      (item.reported_origin_scientific_name?`<p class="fine">논문 원명 ${esc(item.reported_origin_scientific_name)} → 운영 승인명 ${esc(item.origin_scientific_name)} · AphiaID ${esc(item.origin_aphia_id)}. ${esc(item.origin_name_link_status||'원명과 승인명 연결은 출처별 확인 필요')}</p>`:'')+
      (item.assay_type?`<p class="fine">시험 ${esc(item.assay_type)} · 시료 연도 ${esc(item.sample_year||'원문에서 미확인')} · 논문 발행 ${esc(item.publication_year||'출처 참고')}</p>`:'')+
      (chain?`<p class="fine">연결 단계: ${esc(chain)}</p>`:'')+
      ((item.missing||[]).length?`<p class="fine">누락: ${esc(item.missing.join(' / '))}</p>`:'')+
      `<p class="fine">점수 제외: ${esc(item.exclusion_reason)} ${verifiedSource(item.source_id,'원자료 ↗')} · DOI ${esc(source?.doi||'원문 확인 필요')} · 조회 ${esc(source?.accessed||'미기재')} · 이용조건 ${esc(source?.license||'미확인')}</p>`;
  }).join(''):'<p>검증된 기원종·화합물·시험 사슬을 찾지 못했습니다. 자료 부재의 증거는 아닙니다.</p>'+
    (s.assessment.candidate_label?'<p class="fine">조사 후보 검색 범위: Wikidata/LOTUS 기원종 기록과 ChEMBL 37 정량값(2026-09-26)에서 미발견. PubChem·CMNPD·문헌 전수는 아직 조사하지 않았습니다.</p>':'');
}
function verifiedNationalFact(s){
  const n=s.assessment.national_red_list_fact;
  return n?`<p>국가 평가(한국 범위): ${esc(n.category)} · 게재명 ${esc(n.name_as_published)} · 목록 ${esc(n.list_page_printed)}쪽 · ${verifiedSource(n.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    '<p class="fine">국가 평가는 전 지구 IUCN 평가와 범위가 달라 MCUI 점수에 넣지 않는 사실 정보입니다.</p>':'';
}
function verifiedConservationDetail(s){
  const c=s.assessment.conservation_trace;
  if(!c)return '<p>IUCN 평가 조회 기록이 없습니다. 평가 없음(NE)으로 추정하지 않습니다.</p>';
  if(c.iucn_state==='not_in_red_list')return `<p>IUCN 적색목록 검색 결과 0건 (${esc(c.search.queries.join(', '))}; ${esc(c.search.checked_on)}). `+
    `대조 검색: ${esc(c.search.positive_controls.join(', '))}. ${esc(c.search.also_checked)}. ${verifiedSource(c.source_id,'IUCN 검색 ↗')}</p><p class="fine">${esc(c.verification)}</p>`;
  const check=c.current_status_check;
  return `<p>${esc(c.category)}${c.criteria?' '+esc(c.criteria):''} (기준 ${esc(c.criteria_version)}) · 평가일 ${esc(c.assessment_date)} · 발표 ${esc(c.publication_year)} · 범위 ${esc(c.scope)} · 개체군 추세 ${esc(c.population_trend)}`+
    `${c.annotations?' · 주석 “'+esc(c.annotations)+'”':''}${c.assessment_older_than_10y?' · 10년 넘은 평가':''}. ${verifiedSource(c.source_id,'IUCN 평가 ↗')}</p>`+
    (c.pilot_mapping?`<p>원래 등급과 시범 숫자: ${esc(c.pilot_mapping)} · ${esc(c.label)}</p>`:'')+
    `<p class="fine">현행 확인: ${check?.is_current?'현행 평가 ('+esc(check.red_list_version)+', '+esc(check.checked_on)+')':'확인 보류'} · ${verifiedSource(check?.source_id,'확인 근거 ↗')}. ${esc(c.verification)}</p>`+
    (c.previous_assessments||[]).map(p=>`<p class="fine">이전 평가 ${esc(p.record_id)} · ${esc(p.category)} ${esc(p.criteria||'')} · ${esc(p.assessment_date)} 평가 · ${esc(p.status)}</p>`).join('')+
    '<p class="fine">OBIS·GBIF 원시 출현 건수는 개체군 추세로 쓰지 않았고, MCUI에 가감하지 않았습니다. 종 단위 평가를 출현 셀의 해역 등급으로 옮기지 않습니다.</p>';
}
function sufficiencyText(a){
  const i=a.information_sufficiency;
  if(!i)return `네 지표 중 ${Object.values(a.scores).filter(Number.isFinite).length}개 산출.`;
  const pct=x=>Math.round(x*100)+'%';
  return `MFPI 필수 입력 ${pct(i.MFPI.ratio)} (${esc(i.MFPI.present.join(', ')||'없음')}) · MBPI 연결 단계 ${i.MBPI.best_record_steps}/4 · MCUI ${pct(i.MCUI.ratio)} · 평균 ${pct(i.mean_ratio)}. 점수와 합치지 않는 별도 표시입니다.`;
}
function renderVerifiedIndices(s){
  const a=s.assessment;
  const names={MFPI:'식량 가능성',MBPI:'생리활성',MCUI:'보전 평가',BBVI:'통합 활용'};
  const bodies={MFPI:verifiedFoodDetail(s),MBPI:verifiedBioDetail(s),MCUI:verifiedConservationDetail(s)+verifiedNationalFact(s),
    BBVI:'<p>기본 BBVI = w × MFPI + (1−w) × MBPI. MCUI는 별도 축입니다. 화면에서 w를 바꾸어도 고정 비교집단은 바뀌지 않습니다. MFPI만 보는 “식량 전용”과 MBPI만 보는 “생리활성 전용”은 기본 BBVI와 다른 보기입니다.</p>'};
  const unexplored=a.unexplored_candidate?`<p class="pending">미탐색 후보: 같은 ${esc(a.unexplored_candidate.rank)} ${esc(a.unexplored_candidate.taxon)}의 ${esc(a.unexplored_candidate.relatives.join(', '))}에 BBVI가 있습니다. 이 종의 점수는 추정하지 않습니다.</p>`:'';
  return `<section class="verified-scores"><h3>실제 원자료 기반 지표 · 검증 전 시범 지표</h3>`+
    `<p class="fine">자료 스냅샷 ${esc(data.assessmentInfo?.generatedAt?.slice(0,10))} · 방법론 ${esc(data.assessmentInfo?.version)} · MFPI·MBPI·MCUI는 각각 독립적으로 판정합니다. `+
    `숫자는 종 단위 연구용 지표이며 지도 셀이나 해역에 전가하지 않습니다.</p>`+
    ` ${Object.keys(names).map(key=>{
      const value=pilotScore(s,key),reason=a.withheld_reasons?.[key];
      const status=a.score_status?.[key]||'산출 보류';
      return `<details class="score-disclosure" data-axis="${key}"><summary><span>${esc(key)} · ${esc(names[key])}</span>`+
        `<b>${value===null?esc(status):value.toFixed(1)+' · 검증 전 시범 지표'}</b></summary>`+
        `<div class="score-disclosure-body">${value===null?`<p class="pending">${esc(scoreReason[reason]||reason||'산출 보류')}</p>`:''}`+
        `${bodies[key]}${key==='MFPI'&&value!==null?'<p class="fine">산식: 동기준 영양 백분위 × 신뢰도 계수 80% + 가식부 비율 10% + 양식 근거 10%. 이 비중과 계수는 팀의 시범 규칙입니다.</p>':''}`+
        `</div></details>`;
    }).join('')}${unexplored}<p class="fine">정보충분도: ${sufficiencyText(a)} `+
    `민감도 범위는 통계적 신뢰구간이 아닙니다.</p></section>`;
}

function setView(view) {
  if (!['explore','compare','method'].includes(view)) throw new Error('지원하지 않는 화면입니다.');
  currentView=view;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===view));
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(view==='explore' && map) requestAnimationFrame(()=>map.invalidateSize());
  writeHash();
}

function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const group=$('species-group').value, evidence=$('species-evidence').value;
  const matches=data.species.filter(s=>(group==='all'||s.group===group)
    &&(evidence==='all'||(evidence==='published'?!!s.cells.length:!!s.catalog&&!s.cells.length))
    &&[s.label,s.name,s.group,String(s.aphiaID)].some(v=>v.toLowerCase().includes(query)));
  $('species-count').textContent=`${matches.length}종`;
  // Re-rendering on select must not jump the (horizontal on phones) list back to the start or drop keyboard focus.
  const list=$('species-list'),left=list.scrollLeft,top=list.scrollTop,refocus=list.contains(document.activeElement);
  $('species-list').innerHTML=matches.length?matches.map(s=>`<button class="species-card ${selected?.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" aria-pressed="${selected?.aphiaID===s.aphiaID}"><span class="group">${esc(s.group)}</span><b>${esc(s.label)}</b><em>${esc(s.name)}</em><span class="count"><span>지도 표시 기록</span><strong>${s.live?(s.cells.length?`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}셀`:s.catalog?(s.review?'공개 가능 기록 없음':'검수 자료 확인 실패'):'공개 셀 없음'):`${recordLabel(s)} · ${s.cells.length}셀`}</strong></span></button>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species))));
  list.scrollLeft=left;list.scrollTop=top;
  if(refocus)list.querySelector('.species-card.selected')?.focus({preventScroll:true});
}

// Status chips, not a verdict: what exists, what is withheld, and when the summary was published.
function summaryCard(s){
  const chip=(label,value,state)=>`<span class="chip ${state}"><b>${esc(label)}</b> ${esc(value)}</span>`;
  const k=s.info?.conservation||{}, h=IUCN_HISTORICAL[s.aphiaID];
  const cells=s.cells||[];
  const occ=s.live?(cells.length?chip('출현',`공개 셀 ${spatialCells(s).length}개 · ${cells[0].sizeDeg}°`,'ok'):chip('출현','조사 범위만','warn')):chip('출현',`추가 수집 격자 ${cells.length}개`,'ok');
  const axes=['MFPI','MBPI','MCUI','BBVI'].map(a=>pilotScore(s,a)===null?chip(a,'보류','warn'):chip(a,'시범값','pilot')).join('');
  const cons=h?chip('보전',h.current&&pilotScore(s,'MCUI')===null?`IUCN ${h.current.category} ${h.current.published} · 원문 검수 전`:(pilotScore(s,'MCUI')!==null&&s.assessment?.conservation_trace?.publication_year?`IUCN ${s.assessment.conservation_trace.category} ${s.assessment.conservation_trace.publication_year} · 원문 검수 · 시범 MCUI`:`IUCN ${h.category.split(' ')[0]} ${h.published} · ${pilotScore(s,'MCUI')===null?'갱신 필요':'현행 재확인'}`),'warn')
    :s.live?chip('보전',{withheld_insufficient_evidence:'평가 근거 부족',not_reviewed:'미검토'}[k.status]||'정보 없음','none'):chip('보전','미조회','none');
  const when=s.live?(s.publishedAt||'').slice(0,10):data?.collectedAt;
  return `<div class="summary-card" aria-label="상태 요약"><div class="summary-top"><b>상태 요약</b><span>판정 아님${when?' · 발행 '+esc(when):''}</span></div><div class="chips">${occ}${axes}${cons}</div>${coverageBar(s)}</div>`;
}
function selectSpecies(id) {
  const item=data?.species.find(s=>s.aphiaID===id);
  if(!item)throw new Error('목록에 없는 종입니다.');
  selected=item;comparisonPage=Math.floor(data.species.indexOf(item)/5);periodFilter='all';renderList();renderDetail();renderMap();renderComparison();writeHash();
}

function renderDetail() {
  const s=selected;
  if(s.catalog){renderCandidateDetail(s);appendFollowupBrief(s);return;}
  if(s.live){renderLiveDetail(s);appendFollowupBrief(s);return;}
  const evidence=[['학명·식별자','WoRMS 연결','done'],['출현기록','OBIS 연결','done'],['식량 근거 · MFPI','산출 보류 · 영양 원값 검증 필요',''],['생리활성 · MBPI','자료 미확인',''],['보전 평가 · MCUI',IUCN_HISTORICAL[s.aphiaID]?(IUCN_HISTORICAL[s.aphiaID].current?'산출 보류 · IUCN 2026 EN 원문 검수 전':'산출 보류 · IUCN 역사적 평가만 확인'):'평가 미조회','']];
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>SPECIES EVIDENCE</span><span class="verified">정명 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 식별번호를 기준으로 합니다.</p></div><div>${summaryCard(s)}<h3>연결된 근거 <span class="fine">2 / 5 항목 · 품질 점수 아님</span></h3>${evidence.map(e=>`<div class="evidence-item"><span>${e[0]}</span><span class="${e[2]}">${e[1]}</span></div>`).join('')}${iucnHistoricalRows(s)}<div class="withheld"><b>통합점수 산출 보류</b>활용·보전 자료를 검수한 뒤 점수 계산 여부를 결정합니다. 미확인 자료를 0점으로 처리하지 않습니다.</div></div><div class="source-area"><h3>출처와 범위</h3><a class="source-link" href="${esc(safeUrl(s.wormsUrl))}" target="_blank" rel="noopener"><span>WoRMS · 학명 확인</span><span>↗</span></a><a class="source-link" href="${esc(safeUrl(s.queryUrl))}" target="_blank" rel="noopener"><span>OBIS · 조회 조건과 응답</span><span>↗</span></a><p class="fine">지도의 붉은 점은 선별된 출현기록의 1° 격자 집계를 나타낸 도식적 표시입니다. 실제 발견 좌표나 기록 1건이 아닙니다.</p><p class="fine">조회 응답 ${s.reportedTotal.toLocaleString()}건 중 ${s.retrievedCount.toLocaleString()}건 취득, 선별 후 ${s.recordCount.toLocaleString()}건 표시. 연도 미기재 ${s.undated}건. 기록 간 중복·동정 정확성은 추가 검수 대상입니다.</p><button class="text-button" id="detail-sources">데이터셋 ${s.sources.length}개와 이용 조건 보기 →</button></div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method');document.querySelector('.source-section').scrollIntoView({behavior:'smooth',block:'start'});});
}

// Counts come from the published evidence_summary. A missing key is "정보 없음", never 0.
const count = (v,unit='건') => Number.isFinite(v) ? `${v.toLocaleString()}${unit}` : '정보 없음';
const row = (label,value,cls='') => `<div class="evidence-item"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`;

function liveEvidence(s) {
  const i=s.info,n=i.nutrition||{},c=i.compounds||{},k=i.conservation||{},p=i.production||{};
  const cmnpd=s.sources.find(x=>x.id==='cmnpd-1.0');
  const nutrition=n.status==='available'
    ? row('영양 기록 수 · 수집 현황',count(n.record_count))
      +row('기록 분류 · 영양값 아님',`실측 ${count(n.measured_count)} · 계산 ${count(n.calculated_count)}`+(n.proxy_count?` · 대용 ${count(n.proxy_count)}`:''))
      +row('참고 기록 수',`AFCD ${count(n.evidence_record_count)}`)
      +row('불확실성',`단위 미확정 ${count(n.unit_unconfirmed_count)} · 기준량 가정 ${count(n.basis_assumed_count)}`)
      +(n.note?`<p class="fine">${esc(n.note)}</p>`:'')
    : row('영양 기록 수',n.status==='not_collected'?'미수집':'정보 없음','pending');
  const aquaculture=Number.isFinite(p.aquaculture_evidence_count)&&p.aquaculture_evidence_count>0
    ? `<p class="fine">양식 관련 요약 ${count(p.aquaculture_evidence_count)} · 기술적 가능성 판정 아님: ${esc(p.note||'방법·해역·시기 추가 검수 필요.')}</p>`:'';
  const compounds=c.status==='available'
    ? row('보고 화합물',count(c.compound_count,'개'),'done')
      +row('정량 활성 자료',c.quantitative_bioactivity_count===0?'확인한 자료에서 없음':count(c.quantitative_bioactivity_count))
      +(c.note?`<p class="fine">${esc(c.note)}</p>`:'')
      +(CASE_NOTES[s.aphiaID]?`<p class="fine"><b>별도 원문 조사 · 지표 입력 아님</b> ${esc(CASE_NOTES[s.aphiaID].detail)} ${sourceLink(CASE_NOTES[s.aphiaID].url,CASE_NOTES[s.aphiaID].title+' ↗')}</p>`:'')
      +`<p class="fine">출처 ${cmnpd?sourceLink(cmnpd.url,'CMNPD ↗'):'CMNPD'} · ${cmnpd?sourceLink(cmnpd.licenseUrl,'CC BY-NC-SA 4.0'):'CC BY-NC-SA 4.0'} — 비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다.</p>`
    : row('보고 화합물',c.status==='not_collected'?'미수집':'정보 없음','pending');
  const conservation={
    withheld_insufficient_evidence:row('보전평가','근거 부족으로 보류','pending')+row('검토 기록',`IUCN 검색 기록 ${count(k.search_record_count)} · 평가 ${count(k.assessment_count)}`)+(k.note?`<p class="fine">${esc(k.note)}</p>`:''),
    not_reviewed:row('보전평가','미검토','pending')
  }[k.status]||row('보전평가','정보 없음','pending');
  return `<h3>영양 자료 수집 현황 · 식량가치 아님</h3>${nutrition}${aquaculture}<p class="fine">공개 요약에는 성분별 원값·단위·시료 상태·가식부 100 g 기준이 연결되지 않았습니다. 기록 건수와 실측/계산 건수는 종 간 영양 비교값이 아닙니다. 별도로 검토한 원자료는 아래 지표 근거에서 확인할 수 있습니다.</p><h3>화합물 근거</h3>${compounds}<h3>보전</h3>${conservation}${iucnHistoricalRows(s)}`;
}

// The profile's record_count/period describe its own collection run. Only a gbif_*map_* run is the map's record set;
// an older run (the OBIS pilot) is shown apart so its count and years never read as the map summary.
const isMapRun=s=>/^gbif_(sea_cucumber_)?map_/.test(String(s.info?.collection||''));
// Same species in the other collection (loaded alongside the live profiles; absent in tests and on failure).
let otherCollection=[];
// Top of the live panel: what the map shows now (period filter applied), from the published cells only.
function mapSummaryHtml(s){
  const cells=s.cells||[];
  const scope=periodFilter==='all'||!cells.length?'전체 기간':`선택 기간 ${periodFilter}`;
  if(!cells.length)return s.catalog?`<h3>지도에 표시한 기록</h3>${row('분포',s.review?`${reviewLine(s.review)} · 셀 없음`:'검수 자료 확인 실패 · 셀 없음','pending')}${s.review?row('제외 사유',withheldLine(s.review),'pending'):''}<p class="detail-context">셀이 없는 것은 종 부재가 아닙니다.</p>`:`<h3>지도에 표시한 기록</h3>${row('지도 표시 기록','없음 · 자료 조회 범위만 표시','pending')}`;
  const historical=flaggedRecords(s,'historical'), outside=flaggedRecords(s,'outsideKoreanEEZ');
  const other=otherCollection.find(x=>x.aphiaID===s.aphiaID);
  const comparison=other?.cells?.length
    ? `<p class="detail-context">같은 종의 별도 OBIS 수집은 ${other.cells.length}셀입니다. 지역·기간·선별 기준이 달라 두 지도는 합산하지 않습니다.</p>`
    : '';
  return `<h3>지도에 표시한 기록 <span class="fine">${esc(scope)}</span></h3>${row('지도 표시 기록',`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}개 격자(${cells[0].sizeDeg}°)`)}${row('기록 연도',cellYears(s))}${historical?row('과거 기록(2000년 이전)',`${historical.toLocaleString()}건 · 현재 분포 근거 아님`):''}${outside?row('한국·북한 EEZ 밖 셀',`${outside.toLocaleString()}건`):''}${row('출처',s.info?.map?.source||'출처 미기재')}${comparison}`;
}
function renderCandidateDetail(s){
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  const heading=(status)=>`<div class="detail-head"><div class="detail-top"><span>신규 조사 후보</span><span class="pending">${status}</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`;
  const identity=`<p class="detail-context">AphiaID ${esc(s.aphiaID)} · ${esc(s.group)} · ${sourceLink(s.wormsUrl,'WoRMS 학명 확인 ↗')}</p>`;
  if(s.audit){
    const a=s.audit, n=a.nutrition, i=a.iucn, r=s.review;
    const pilot=s.assessment, mbpi=pilotScore(s,'MBPI');
    const bioRows=mbpi===null?'':(pilot.bioactivity_trace||[]).map(t=>(t.measurements||[]).map(m=>`<tr><td>${sourceLink(m.structure_url,m.compound_name+' · '+t.compound_id)}</td><td>${esc(m.relation)} ${esc(m.raw_value)} ± ${esc(m.raw_sd)} ${esc(m.raw_unit)}</td><td>${esc(t.percentile)} · ${esc(t.evidence_factor)}</td></tr>`).join('')).join('');
    const bioDetail=mbpi===null?'기원종→화합물→assay 원문 미검수':`검증 전 시범 MBPI ${mbpi.toFixed(1)} · 동일 ACE 효소 IC₅₀ 화합물 5종, 원논문 1편, 독립 재현 미확인. 같은 논문 안의 상대 백분위이며 임상 효능·종 간 가치 순위가 아닙니다.`;
    const categories={ENDANGERED:'EN · 위기',LEAST_CONCERN:'LC · 관심대상'};
    const conservation=i.record?.category
      ?`IUCN 게시 체크리스트: ${categories[i.record.category]||i.record.category} (전 지구 평가 메타데이터 · 원평가 일자/기준 미검수)`
      :'체크리스트에서 정확한 승인명 평가 연결 미확인 · 공식 NE 판정 아님';
    const food=n.foodCode?`RDA 식품명 후보 "${n.foodName}" · 목표 종과 시료 동정 미검수`:'연결한 RDA 식품 행 없음';
    const values=n.values?['protein_g','iron_mg','zinc_mg','refuse_pct'].map((key)=>{
      const labels={protein_g:'단백질 g',iron_mg:'철 mg',zinc_mg:'아연 mg',refuse_pct:'폐기율 %'};
      return labels[key]+' '+(n.values[key]??'결측');
    }).join(' · '):'';
    const sourceRow=(label,x)=>row(label,`조회 ${x.queried.toLocaleString()}건 · 통과 ${x.accepted.toLocaleString()}건${x.datasets===undefined?'':` · 데이터셋 ${x.datasets}개 중 개방 이용조건 ${x.openDatasets}개`}${x.genusFallback?' · 속 단위 조회 후 원자료 학명으로 선별':''}`);
    const scored=['MFPI','MBPI','MCUI','BBVI'].filter(k=>pilotScore(s,k)!==null);
    const limit=s.cells.length
      ?'검수 통과 기록의 집계 셀입니다. 현재 분포·개체수·자원량이 아니며, 양식·방류 개체는 원자료 표시가 없으면 구분하지 못합니다.'
      :r?'공개 기준을 통과한 기록이 없어 셀을 두지 않았습니다. 종 부재나 전체 분포를 뜻하지 않습니다.'
      :'출현 검수 파일을 확인하지 못해 셀을 표시하지 않습니다.';
    $('detail').innerHTML=heading(s.cells.length?`공개 ${s.cells[0].sizeDeg}° 셀`:r?'공개 가능한 기록 없음':'검수 자료 확인 실패')+
      `<div class="detail-summary">${identity}<div id="detail-map-summary">${mapSummaryHtml(periodView(s))}</div>`+
      (pilot?'<p class="pending">조사 후보 · 운영 8종과 같은 규칙으로 축별 판정했지만 후보 목록에서 옮기지 않습니다.</p>'+
        (mbpi===null?'':row('생리활성 근거',`검증 전 시범 MBPI ${mbpi.toFixed(1)} · 원논문 1편 · 같은 논문 안의 상대 백분위`,'linked'))+renderVerifiedIndices(s)+
        `<p class="detail-limit">${limit} ${scored.length?scored.join('·')+'만 검증 전 시범 산출이며 나머지 축은 보류입니다.':'MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.'}</p></div>`:
      `<h3>근거 상태 <span class="fine">판정 아님</span></h3>`+
      row('식량 근거',n.foodCode?'식품명 후보 · 종 연결 미확인':'연결된 식품 행 없음','pending')+
      row('생리활성 근거','원문 연결 미검수','pending')+
      row('보전 평가',i.record?.category?'체크리스트 기록 · 원평가 미검수':'연결된 평가 미확인','pending')+
      `<p class="detail-limit">${limit} MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.</p></div>`)+
      '<div class="detail-more-list">'+
      more('근거 자세히 보기',`<h3>선정 이유</h3><p>${esc(s.reason)}</p>`+
        (s.taxonNote?`<p class="fine">${esc(s.taxonNote)}</p>`:'')+
        (pilot?'':row('식량·영양',food,'pending')+row('생리활성',bioDetail,'pending'))+
        (bioRows?`<table><caption>감태 유래 분리 화합물 · ACE/HHL, 37°C, IC₅₀ · 원문 Table 2</caption><thead><tr><th>화합물 · 구조</th><th>원값</th><th>백분위 · 근거 계수</th></tr></thead><tbody>${bioRows}</tbody></table><p>${sourceLink(pilot.bioactivity_trace[0].measurements[0].paper_url,'분리·NMR·시험 원논문 ↗')} · ${sourceLink('https://github.com/gyunghun1214/blue-bio-map/blob/main/research/verified-indices/ecklonia-ace-2026-09-27.md','검수 및 산출 설명 ↗')}</p>`:'')+
        (pilot?'':row('보전',conservation,'pending'))+
        (pilot?'':row('MFPI / MBPI / MCUI / BBVI','모두 산출 보류 · 원자료 발견은 점수가 아닙니다','pending')+
        '<p class="fine">정보충분도: 출현 조회·식품명 후보·체크리스트 연결 상태만 표시합니다. 검증된 지표 점수와 구분합니다.</p>'))+
      more('수집·선별 기준',(r?sourceRow('GBIF',r.gbif)+sourceRow('OBIS',r.obis)+row('제외 사유',withheldLine(r))+
          row('통과 기록의 원자료 학명',r.names.join(', ')||'없음')+row('공개 해상도',s.sensitivity||'미기재')+
          '<p class="fine">검수 기준: WoRMS 학명 확인 · CC0·CC BY 4.0 기록만 · 연도 1개(여러 해 범위 제외) · GBIF 좌표 경고·불확실성 10 km 초과·원자료 일반화 제외 · OBIS 해안선 기준 육상 좌표 제외 · 화석·사육·시장 구입 표본 제외 · GBIF와 OBIS에 함께 게시된 같은 기록은 한 번만 셉니다. 2000년 이전 기록은 과거 기간으로, 모든 기록이 한국·북한 EEZ(OBIS 해역 정보) 밖인 셀은 따로 표시합니다. 양식·방류 여부는 원자료 표시가 없으면 구분하지 못합니다.</p>'
          :row('출현 검수','검수 자료 확인 실패','pending'))+
        '<p class="fine">다음 단계: 식품명의 종 동정과 IUCN 원평가 기준·시점을 확인한 뒤 축별 지표를 다시 심사합니다.</p>')+
      more('출처와 이용조건','<p>'+sourceLink(s.wormsUrl,'WoRMS 승인 학명 원문 ↗')+' · '+esc(s.wormsCitation)+'</p>'+
        (r?'<p>'+sourceLink(r.gbif.query,'GBIF 원검색·범위 ↗')+' · '+sourceLink(r.obis.query,'OBIS 원검색·범위 ↗')+' · 검수 '+esc(s.reviewedOn)+
          ' · 셀과 제외 사유 요약: <a href="expansion-public-cells.json" target="_blank" rel="noopener">검수 파일(JSON) ↗</a></p>':'')+
        (s.sources.length?'<details><summary>셀에 쓴 데이터셋 '+s.sources.length+'개 (자료별 이용조건)</summary><ul>'+
          s.sources.map(x=>'<li>'+sourceLink(x.url,x.title||'원 데이터셋')+' · '+esc(x.license)+'</li>').join('')+'</ul></details>':'')+
        (n.foodCode?'<p>RDA 식품명 원행(목표 종 연결 전): '+sourceLink(n.rowUrl,n.foodName+' ↗')+
          ' · '+esc(values)+' · 생것, 가식부 100 g 기준(폐기율 별도) · 원행 출처 '+esc(n.values?.row_source||'미기재')+
          ' · '+esc(n.note)+' · 조회 '+esc(data?.assessmentInfo?.generatedAt?.slice(0,10)||'2026-09-25')+
          ' · 공공누리 제1유형</p>':'')+
        (i.record?'<p>IUCN 체크리스트 원자료: '+sourceLink(i.checklistRecordUrl||i.record.reference,'평가 메타데이터 ↗')+
          ' · '+sourceLink(i.record.reference,'원평가 페이지 ↗')+' · '+esc(i.record.citation||'인용 미기재')+'</p>':''))+'</div>';
    return;
  }
  const details=[['분포·지도','미수집 · 공개 셀 없음'],['식량·영양','원값·시료 상태·가식부·양식 근거 미검수'],['생리활성','기원종·화합물·assay 연결 미검수'],['보전','IUCN 원평가·현행 상태 미검수'],['MFPI / MBPI / MCUI / BBVI','전부 산출 보류']];
  $('detail').innerHTML=heading('분포 미수집')+
    `<div class="detail-summary">${identity}<h3>지도에 표시한 기록</h3>${row('공개 상태','자료 미수집 · 공개 셀 없음','pending')}`+
    `<h3>근거 상태 <span class="fine">판정 아님</span></h3>`+
    row('식량 근거','원자료 미검수','pending')+row('생리활성 근거','원문 연결 미검수','pending')+
    row('보전 평가','원평가 미검수','pending')+
    '<p class="detail-limit">지도에 셀이 없는 것은 종 부재가 아닙니다. MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.</p></div>'+
    '<div class="detail-more-list">'+
    more('근거 자세히 보기',`<h3>선정 이유</h3><p>${esc(s.reason)}</p>`+
      (s.taxonNote?`<p class="fine">${esc(s.taxonNote)}</p>`:'')+
      details.map(([label,status])=>row(label,status,'pending')).join('')+
      '<p class="fine">정보충분도: 학명 연결만 확인 · 그 밖의 근거 미수집. 미확인은 0점이 아닙니다.</p>')+
    more('수집·선별 기준','<p>한국 주변 출현 여부, 식품 적합성 및 보전 필요성은 아직 평가하지 않았습니다. 분포를 발행하려면 종 식별·이용조건·좌표 품질·민감도 검수 후 공개 격자만 게시해야 합니다.</p>')+
    more('출처와 이용조건','<p>'+sourceLink(s.wormsUrl,'WoRMS 승인 학명 원문 ↗')+' · '+esc(s.wormsCitation)+'</p>')+
    '</div>';
}

function renderLiveDetail(s) {
  const i=s.info, cells=s.cells||[];
  const separate=!isMapRun(s)&&Number.isSafeInteger(s.recordCount)
    ? `<h3>${cells.length?'이 수집 기록은 지도 셀에 쓰지 않음':'수집 기록 · 지도에는 조회 범위 표시'}</h3>${row('기록 수',recordLabel(s))}${row('관측 기간',years(s))}<p class="fine">${esc(s.summary)} ${esc(i.limitations)}</p><p class="fine">좌표 불확실성 미기재 ${count(i.uncertainty_missing)} · 육지 위 품질경고 ${count(i.on_land_count)}. ${i.map?.note?esc(i.map.note)+' ':''}좌표를 이동하거나 결측을 0으로 바꾸지 않았습니다.</p>`
    : s.noOccurrences&&!cells.length
    ? row('출현자료','미수집','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>한반도 주변 자료 조회 범위를 지도에 표시합니다. 이 범위가 이 종의 출현 위치나 분포를 뜻하지는 않습니다.</div>`
    : !cells.length&&!Number.isSafeInteger(s.recordCount)
    ? row('출현자료','기록 수 미확인','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>발행 자료의 기록 수를 확인할 수 없어 0건으로 표시하지 않습니다. 지도에는 출현 위치 대신 자료 조회 범위를 표시합니다.</div>`
    : isMapRun(s)?`<p class="fine">${esc(s.summary)} ${esc(i.limitations)}</p>`:'';
  const other=otherCollection.find(x=>x.aphiaID===s.aphiaID);
  const compare=other?`<h3>추가 수집 자료와 비교</h3><p class="fine">추가 수집 자료(OBIS)에도 이 종이 있습니다: 기록 ${recordLabel(other)} · ${other.cells.length}개 격자 · ${esc(years(other))}. 수집 지역(122–136°E · 30–43°N, 주변국 해역 포함)·기간(과거 기록 포함)·이용조건(CC BY-NC 포함)이 달라 셀 수가 다릅니다. 두 자료는 합산하지 않습니다.</p>`:'';
  const evidence=s.v2?liveEvidence(s):'';
  const score=s.v2?'활용·보전 근거를 검수하는 중이라 점수를 계산하지 않았습니다. 미수집·보류 항목을 0점으로 처리하지 않습니다.':esc(s.productionSummary);
  const pilot=s.assessment;
  const pilotRows=VERIFIED.includes(pilot?.report_version)?renderVerifiedIndices(s)
    :pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':pilotScore(s,k).toFixed(1))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}${pilot.scores.MCUI===null&&pilot.iucn_category?' · 현행 평가 확인 보류':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  const withheld=pilot?'근거가 부족한 항목은 산출 보류로 유지합니다. 시범 수치는 외부 사례 검증 전의 연구용 결과입니다.'+(s.v2?'':' '+score):score;
  // A status says whether an indicator was computed; "일부 근거 확인" is evidence without an indicator.
  const axes=[['MFPI','식량 근거'],['MBPI','생리활성 근거'],['MCUI','보전 평가']].map(([k,label])=>{
    const v=pilotScore(s,k), status=VERIFIED.includes(pilot?.report_version)&&pilot.score_status?.[k]||'산출 보류';
    return row(label,v===null?(status==='산출 보류'?status:status+' · 지표 미산출'):`${v.toFixed(1)} · 검증 전 시범 지표`,v===null?'pending':'done');
  }).join('');
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>공개 기준 적용 자료</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`+
    `<div class="detail-summary"><div id="detail-map-summary">${mapSummaryHtml(periodView({...s,cells}))}</div><h3>근거 상태 <span class="fine">판정 아님</span></h3>${axes}<p class="detail-limit">현재 확보한 출현기록이며, 전체 분포·개체수·자원량이 아닙니다.</p></div>`+
    `<div class="detail-more-list">`+
    more('근거 자세히 보기',`${pilotRows}${evidence}${foodEvidencePanel(s)}${row('자료 연결 현황','5개 항목의 단계 · 품질 점수 아님')}${coverageBar(s)}<p class="fine">${esc(coverageGuide)}</p>${coverageNotes(s)}<div class="withheld"><b>${pilot?'시범 분석 주의':'통합점수 산출 보류'}</b>${withheld}</div>`)+
    more('수집·선별 기준',`${row('AphiaID',s.aphiaID)}${row('원자료 학명',(i.original_names||[]).join(', ')||'미기재')}<p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 AphiaID를 기준으로 합니다.</p>${mapSection({...s,cells})}${separate}${compare}${institutionChecks(s)}`)+
    more('출처와 이용조건',`<div class="source-area">${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>{const src=data.assessmentInfo.sources[id];return `<p>${sourceLink(src.url,'지표 근거 '+id+' ↗')} · ${esc(src.license)}${src.notice?`<br><span class="fine">${esc(src.notice)}</span>`:''}</p>`;}).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 근거 보고서는 별도 스냅샷입니다.</p></div>`)+
    `</div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method');document.querySelector('.source-section').scrollIntoView({behavior:'smooth'});});
}

// Published 1° map cells (public.species_map_cells, rules map-1). Cells only: no coordinates or record ids exist in the API.
const REASONS={on_land_obis_rule:'육지 위 좌표(OBIS 해안선 기준)',duplicate:'같은 기록 중복',under_existing_db_review:'운영 DB에서 검토 중인 기존 기록',
  species_held_until_sensitivity_review:'민감도 검토 전 보류 종',bad_coordinate_issue:'GBIF 좌표 오류 표시',uncertainty_over_10km:'좌표 불확실성 10 km 초과',
  coordinates_generalized_at_source:'제공처가 좌표를 흐리게 처리',no_year:'관측 연도 없음',
  taxon_not_verified:'학명 미확인',absent_or_dropped:'부재·삭제 기록',fossil_specimen:'화석 표본',license_not_open:'이용조건 미충족(비상업·불명 등)',
  multi_year_range:'여러 해에 걸친 날짜',coordinate_issue:'GBIF 좌표 오류 표시',generalized_at_source:'제공처가 좌표를 흐리게 처리',
  captive_or_cultivated:'양식·사육 표시 기록',market_purchase_point:'시장 구입 표본(채집 위치 미상)',locality_contradicts_coordinates:'장소 설명과 좌표 불일치'};
// Candidate record review (expansion-public-cells.json): what was queried, what passed and why the rest was withheld.
const reviewLine=r=>`GBIF ${r.gbif.queried.toLocaleString()}건 · OBIS ${r.obis.queried.toLocaleString()}건 검수 · 통과 ${r.accepted.toLocaleString()}건`;
function withheldLine(r){
  const total={};
  for(const x of [r.gbif,r.obis])for(const [k,n] of Object.entries(x.excluded))total[k]=(total[k]||0)+n;
  return Object.entries(total).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${REASONS[k]||k} ${n.toLocaleString()}건`).join(' · ')||'없음';
}
const flaggedRecords=(s,key)=>s.cells.filter(c=>c[key]).reduce((a,c)=>a+c.records,0);
const cellRecords=s=>s.cells.reduce((a,c)=>a+c.records,0);
const cellSites=s=>s.cells.reduce((a,c)=>a+c.sites,0);
const cellYears=s=>years({yearStart:Math.min(...s.cells.map(c=>c.yearStart)),yearEnd:Math.max(...s.cells.map(c=>c.yearEnd))});
// Period rows of one published cell share lat0/lon0/sizeDeg. Group them: one map cell, one hit area.
const spatialCells=s=>[...s.cells.reduce((m,c)=>{const k=`${c.lat0},${c.lon0},${c.sizeDeg}`;if(!m.has(k))m.set(k,[]);m.get(k).push(c);return m;},new Map()).values()];
const cellCountLabel=s=>{const n=spatialCells(s).length;return n===s.cells.length?`${n}셀`:`${n}셀 · 기간별 ${s.cells.length}행`;};
// Summing sites over periods can count one site twice, so say what the number is.
const sitesLabel=s=>spatialCells(s).length===s.cells.length?'조사 지점':'조사 지점(기간별 합계)';

// Species-level status shown with each cell: the proposal's "zoom in to see indicators and conservation status".
function speciesAxesLine(s){
  // Status only, never the value: a species score printed on a cell would read as that sea area's score (PR #8).
  const axes=['MFPI','MBPI','MCUI','BBVI'].map(k=>`${k} ${pilotScore(s,k)===null?'보류':'시범값 있음'}`).join(' · ');
  const h=IUCN_HISTORICAL[s.aphiaID], k=s.info?.conservation||{};
  const iucn=h?(h.current&&pilotScore(s,'MCUI')===null?`IUCN ${h.current.category} ${h.current.published}년 발표(원문 검수 전, 2013 평가 대체)`:(pilotScore(s,'MCUI')!==null&&s.assessment?.conservation_trace?.publication_year?`IUCN ${s.assessment.conservation_trace.category} ${s.assessment.conservation_trace.criteria||''} ${s.assessment.conservation_trace.publication_year}년 발표(원문 검수 · 시범 MCUI, 2013 평가 대체)`:`IUCN ${h.category} ${h.published}년 발표(${pilotScore(s,'MCUI')===null?'역사적 평가 · 현행 확인 보류':'현행 재확인 · 시범'})`))
    :({withheld_insufficient_evidence:'보전평가 근거 부족으로 보류',not_reviewed:'보전평가 미검토'}[k.status]||'보전평가 정보 없음');
  return `종 단위 상태(이 셀의 값 아님): ${axes} · ${iucn}`;
}
// A checklist, not a legal determination: cells are 1°/4° and cannot settle jurisdiction.
function institutionChecks(s){
  if(!s.cells?.length)return '';
  const countries=[...new Set(s.cells.flatMap(c=>c.countries||[]))];
  const allTagged=s.cells.every(c=>c.countries?.length);
  return `<h3>활용 전 제도 확인 <span class="fine">법적 판단 아님</span></h3>${row('기록의 국가 메타데이터',countries.join(', ')||'미기재')}<ul class="why">
<li><b>국가 관할 해역</b>국가 정보가 붙은 기록은 그 나라의 유전자원 접근·이익공유(ABS) 절차 확인 대상일 수 있습니다. 한국: ${sourceLink('https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%9C%A0%EC%A0%84%EC%9E%90%EC%9B%90%EC%9D%98%EC%A0%91%EA%B7%BC%C2%B7%EC%9D%B4%EC%9A%A9%EB%B0%8F%EC%9D%B4%EC%9D%B5%EA%B3%B5%EC%9C%A0%EC%97%90%EA%B4%80%ED%95%9C%EB%B2%95%EB%A5%A0','유전자원법 ↗')} · 나고야의정서 ${sourceLink('https://absch.cbd.int/','ABS 정보공유체계 ↗')}</li>
<li><b>국가 관할권 이원 해역</b>공해·심해 자원은 ${sourceLink('https://www.un.org/bbnjagreement/en','BBNJ 협정 ↗')} 적용 여부를 따로 확인합니다. ${allTagged?'현재 공개 셀은 모두 국가 메타데이터가 붙은 기록입니다.':'국가 메타데이터가 없는 셀이 있어 관할 확인이 더 필요합니다.'}</li>
<li><b>한계</b>${s.cells[0].sizeDeg}° 셀로는 관할 경계를 판정할 수 없습니다. 채집·연구 전 원문과 소관 기관에 확인하세요.</li></ul>`;
}
function mapSection(s){
  const m=s.info.map;if(!m)return '';
  const degree=s.cells[0]?.sizeDeg||1;
  const single=spatialCells(s).filter(rows=>rows.some(c=>c.sites===1)).length;
  const excluded=Object.entries(m.outcome||{}).filter(([k])=>k!=='accepted').map(([k,n])=>row(REASONS[k]||k,count(n))).join('')||row('제외','없음');
  const why=m.status==='held_sensitivity_review'?`<div class="withheld"><b>조사 범위 표시</b>출현 셀은 아직 발행되지 않았습니다. 지도에는 자료를 조회한 한반도 주변 범위를 표시합니다. ${esc(m.note)}</div>`:`<ul class="why">
<li><b>이용조건</b>CC0·CC BY 4.0 기록만 썼습니다. CC BY-NC ${count(m.nc_records)}은 비상업 이용 결정 전이라 쓰지 않았습니다.</li>
<li><b>좌표 품질</b>OBIS 해안선 거리로 육지 위 좌표를 제외했고 좌표를 옮기지 않았습니다. 불확실성 10 km 초과, 제공처가 흐리게 처리한 좌표, GBIF 좌표 오류 표시도 제외했습니다.</li>
<li><b>불확실성 결측</b>0으로 보지 않고 ${degree}° 셀에서만 썼습니다.</li>
<li><b>민감도</b>${degree===4?'채취 압력을 고려해 4° 광역 셀을 적용했습니다.':'아직 평가하지 않아 GBIF 지침에서 가장 엄격한 공개 수준인 1°를 적용했습니다.'}</li>
<li><b>중복·기존 자료</b>같은 표본 번호는 한 번만 셌고, 운영 DB에서 검토 중인 기존 기록은 쓰지 않았습니다.</li>
<li><b>비공개</b>원좌표와 기록 ID는 공개하지 않습니다.</li></ul>`;
  return `<h3>지도 셀</h3><p class="fine">선별된 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 보여줍니다(점 간격 = 기록 수 구간). 붉은 점은 실제 발견 좌표·조사 지점·기록 1건이 아니며 원좌표는 공개하지 않습니다.</p>${row('공개 셀',s.cells.length?`${spatialCells(s).length}개 · ${degree}°×${degree}°${spatialCells(s).length===s.cells.length?'':` · 기간별 ${s.cells.length}행`}`:'없음',s.cells.length?'done':'pending')}${s.cells.length?row(sitesLabel(s),count(cellSites(s),'곳')):''}${single?`<p class="fine">조사 지점이 1곳뿐인 셀 ${single}개: ${degree}° 범위 안의 대략적인 조사 위치가 드러납니다.</p>`:''}${m.note&&m.status!=='held_sensitivity_review'&&isMapRun(s)?`<p class="fine">${esc(m.note)}</p>`:''}<h3>${m.status==='held_sensitivity_review'?'지도 표시 기준':'왜 공개할 수 있는가'}</h3>${why}<h3>조회와 제외 <span class="fine">GBIF ${esc(m.retrieved)}</span></h3>${row('조회 기록(2000년 이후)',count(m.queried_records))}${row('CC0·CC BY 기록',count(m.open_records))}${excluded}<p class="fine">사유가 겹치는 기록은 사유마다 셉니다. 셀은 그 기간에 기록이 있었다는 뜻입니다. 분포 전체, 개체수, 자원량을 뜻하지 않습니다.</p>`;
}


// The public datasets contain only 1° (sea cucumber: 4°) aggregates. Dots are fixed schematic marks,
// not observations, and never encode individual record coordinates or a 1:1 count.
let landPolygons=[], dotRenderer, effortRenderer;
function pointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
function prepareLandMask(geography){
  landPolygons=geography.features.flatMap(f=>{
    const g=f.geometry;
    const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    return polygons.map(rings=>{
      const outer=rings[0],lons=outer.map(p=>p[0]),lats=outer.map(p=>p[1]);
      return {rings,bounds:[Math.min(...lons),Math.min(...lats),Math.max(...lons),Math.max(...lats)]};
    });
  });
}
function onLand(lat,lon){
  return landPolygons.some(({rings,bounds:[west,south,east,north]})=>
    lon>=west&&lon<=east&&lat>=south&&lat<=north&&
    pointInRing(lon,lat,rings[0])&&!rings.slice(1).some(hole=>pointInRing(lon,lat,hole)));
}
// Dots per degree along one side, by record band: denser = more records. Visual bands, not counts.
function dotsPerDegree(records){
  if(records>=100)return 10;
  if(records>=20)return 8;
  if(records>=5)return 6;
  return 4;
}
// One red for every species so the pattern reads at a glance; the edge adapts to the basemap.
const DOT_RED='#d7263d';
const dotStyle=()=>basemap==='basic'
  ? {color:'#7a0f1d',weight:.6,opacity:.55,fillColor:DOT_RED,fillOpacity:.78}
  : {color:'#ffffff',weight:1,opacity:.95,fillColor:DOT_RED,fillOpacity:.92};
// Radius grows with zoom but never beyond ~40% of the dot spacing, so dots stay separate marks.
function dotRadius(spacingDeg){
  const z=map.getZoom(), pxPerDeg=256*2**z/360;
  return Math.max(1.6,Math.min([2.4,2.4,3,3.8,4.6,5.4][Math.max(0,Math.min(5,z-3))],spacingDeg*pxPerDeg*.4));
}
let dotCells=[]; // cells whose dot pattern is redrawn on zoom (reset with the overlay in renderMap)
function addCellDots(lat0,lon0,size,records){
  if(!Number.isFinite(records)||records<=0)return;
  dotCells.push([lat0,lon0,size,records]);drawCellDots(lat0,lon0,size,records);
}
function drawCellDots(lat0,lon0,size,records){
  // Same density per area for 1° and 4° cells; capped so a wide cell stays fast (≤ 24×24 before masking)
  // and so dots keep ≥ 6 px apart at the current zoom (dense cells would otherwise fuse into a solid block).
  // ponytail: at overview zooms the cap can equalize record bands; they separate again when zoomed in.
  const pxPerDeg=256*2**map.getZoom()/360;
  const cols=Math.max(2,Math.min(24,dotsPerDegree(records)*Math.max(1,Math.round(size)),Math.floor(size*pxPerDeg/6))), step=size/cols;
  // Skip the land test for cells that touch no land polygon's bounding box.
  const nearLand=landPolygons.some(({bounds:[w,s,e,n]})=>lon0<=e&&lon0+size>=w&&lat0<=n&&lat0+size>=s);
  // Fixed staggered grid inside the published cell: no jitter, no coordinates beyond the cell itself.
  for(let row=0;row<cols;row++)for(let col=0;col<cols;col++){
    const lat=lat0+step*(row+.5), lon=lon0+step*(col+(row%2?.75:.25));
    if(nearLand&&onLand(lat,lon))continue; // Natural Earth coast approximation; no marks on mapped land.
    const dot=L.circleMarker([lat,lon],{renderer:dotRenderer,radius:dotRadius(step),...dotStyle(),interactive:false});
    dot._schematicDot=true;dot.addTo(overlay);
  }
}
// GBIF sensitive-species best practice: say what was generalised, what was withheld and why.
function generalizationNote(size,live){
  const sens=!live?'추가 수집 OBIS 자료: 1° 격자 집계만 보유(민감도 평가 대상 아님)'
    :size>=4?'채취 압력을 고려해 GBIF 지침의 가장 엄격한 등급(1°)보다 넓은 4° 셀 적용'
    :'민감도 미평가 → GBIF 지침의 가장 엄격한 공개 등급(1°) 적용';
  return `<br><b>공개 일반화 (GBIF 민감종 지침 용어)</b><ul><li>dataGeneralizations: 좌표를 ${size}° 셀로 일반화, 좌표 이동·무작위화 없음</li><li>informationWithheld: 원좌표·기록 ID 비공개</li><li>민감도: ${esc(sens)}</li>${live?'<li>민감도 재검토 예정일: 미정(민감도 평가 후 결정)</li>':''}</ul>`;
}
function cellPopupNotice(size){
  return `<br><small>붉은 점은 실제 발견 좌표가 아닌 이 ${size}° 공개 셀의 도식적 표시입니다. 점의 촘촘함은 기록 수 구간만 나타내며, 각 점은 출현 위치·기록 1건·조사 지점 1곳이 아닙니다. 선별된 출현기록은 개체수·자원량·생물학적 가치·현재 한국 전체 분포가 아닙니다.</small>`;
}
// Faint frame so a coastal cell whose dots are mostly masked still reads as an aggregate area, not a point.
// Cell boundary in a non-red ink so it stays distinct from the red dots on every basemap.
const cellFrame=()=>({color:basemap==='basic'?'#1f4e6b':'#ffffff',weight:1.2,opacity:basemap==='basic'?.75:.9,dashArray:'4 4',fillColor:DOT_RED,fillOpacity:basemap==='basic'?.06:.1});
function setMapLegend(live,s){
  // Live species without published cells only show the query extent (studyBounds).
  const extentOnly=live&&s&&!s.cells.length, size=s?.cells?.[0]?.sizeDeg||1;
  document.querySelector('.map-symbol').hidden=!!extentOnly;
  $('map-symbol-label').textContent=extentOnly?'점선 테두리: 자료 조회 범위':live?`붉은 점: 공개 ${size}° 셀의 도식적 표시 (실제 발견 좌표 아님)`:'붉은 점: 추가 수집 OBIS 1° 격자의 도식적 표시 (실제 발견 좌표 아님)';
  $('map-legend-note').textContent=extentOnly?'공개 출현 셀이 없습니다. 테두리는 출현 위치나 분포가 아닙니다.':'점 간격: 셀 기록 수 구간(1–4 / 5–19 / 20–99 / 100건 이상일수록 촘촘, 1°·4° 셀 모두 면적당 같은 기준). 점 위치·개수는 실제 기록이나 조사 지점이 아닙니다. 점선 테두리가 공개 셀 범위이고 육지 위 점은 생략합니다. 셀을 누르면 실제 집계값·기간·출처가 나옵니다.';
}

function renderCellMap(s,color){
  const degree=s.cells[0]?.sizeDeg||1;
  $('map-review-note').textContent=`선별된 ${s.catalog?'GBIF·OBIS':'GBIF'} 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 표시합니다. 붉은 점은 실제 발견 좌표가 아닌 공개 셀의 도식적 표시이며 가치·보전 등급도 아닙니다. 기록 수는 개체수·자원량·현재 분포나 한국 전체 분포를 뜻하지 않습니다.${s.catalog?' 2000년 이전 과거 기록과 한국·북한 EEZ 밖 기록은 셀 팝업에 따로 표시합니다. 양식·방류 개체는 원자료 표시가 없으면 구분하지 못합니다.':''}`;
  mapJudgmentStatus(s);
  for(const rows of spatialCells(s)){
    const c=rows[0], reasons=[...new Set(rows.flatMap(r=>cellAssessmentStatus(s,r).reasons))];
    // One hit area per spatial cell; every period row stays readable in its popup.
    const periods=rows.map(r=>`<li><b>공개 집계 기간 ${esc(r.period)}</b> · 기록 연도 ${esc(years(r))}${r.historical?'<br><b>과거 기록(2000년 이전) · 현재 분포 근거 아님</b>':''}${r.outsideKoreanEEZ?'<br><b>한국·북한 EEZ 밖 기록</b>':''}<br>선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳${r.uncertaintyMissing?` · 좌표 불확실성 결측 ${esc(r.uncertaintyMissing)}건`:''}<br>해역 메타데이터 ${esc(r.seaAreas.map(x=>x==='해역명 미확인'?x:'LME '+x).join(', '))}${r.countries?' · 국가 메타데이터 '+esc(r.countries.join(', ')||'미기재'):''}<br>출처·이용조건<ul>${occurrenceCitationLinks(r)||'<li>셀별 제공처 확인 필요</li>'}</ul></li>`).join('');
    cellLayers.push(L.rectangle([[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]],cellFrame()).addTo(overlay));
    cellLayers.at(-1).bindPopup(`<strong>${esc(s.label)} · 선별 출현기록 ${c.sizeDeg}° 셀</strong><br><b>해역별 활용·보전 판단: 보류</b><br>${esc(speciesAxesLine(s))}<br>공간 해상도 ${c.sizeDeg}°×${c.sizeDeg}° · 가장 짧은 변 약 ${esc(Number.isFinite(c.resolutionM)?Math.floor(c.resolutionM/1000):'미확인')} km<br>${rows.length>1?`기간 ${rows.length}개 · 선별 기록 합계 ${esc(rows.reduce((a,r)=>a+r.records,0))}건. 같은 지점이 여러 기간에 있을 수 있어 조사 지점은 기간별로만 셉니다.<br>`:''}<b>${rows.length>1?'기간별 근거':'이 셀의 근거'}</b><ol class="cell-periods">${periods}</ol><b>판단 보류 이유</b><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>CC0·CC BY 공개 기준 및 좌표 품질 필터를 통과한 일부 기록입니다. 조사 노력·중복·시기·경계 효과가 해역 간 비교용으로 보정되지 않았습니다. 원좌표·개체수·자원량·한국 전체 분포가 아닙니다.</small>`+effortLine(c.lat0,c.lon0,c.sizeDeg)+generalizationNote(c.sizeDeg,true)+cellPopupNotice(c.sizeDeg));
    addCellDots(c.lat0,c.lon0,c.sizeDeg,rows.reduce((a,r)=>a+r.records,0)); // one pattern per spatial cell
  }
  // Not animated: Leaflet 1.1 drops a fit requested while another zoom animation runs (quick species switches).
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{padding:[40,40],maxZoom:7,animate:false});}
  $('map-count').textContent=cellRecords(s).toLocaleString();$('map-cells').textContent=spatialCells(s).length;$('map-years').textContent=cellYears(s);
}
// The same cell evidence as the popups, as a table: reachable by keyboard and screen readers, and without the map.
let cellLayers=[];
function renderCellTable(s){
  const box=$('cell-table');
  if(!s?.cells?.length){box.innerHTML='';return;}
  const live=s.live, groups=live?spatialCells(s):s.cells.map(c=>[c]);
  const range=c=>live?`${c.lat0}–${c.lat0+c.sizeDeg}°N · ${c.lon0}–${c.lon0+c.sizeDeg}°E`:`${c.lat-.5}–${c.lat+.5}°N · ${c.lon-.5}–${c.lon+.5}°E`;
  const rows=groups.map((g,i)=>{
    const c=g[0];
    const detail=live
      ? g.map(r=>`<div>${esc(r.period)}${r.historical?' · 과거 기록(2000년 이전)':''}${r.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':''} · 기록 연도 ${esc(years(r))} · 선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳<ul>${occurrenceCitationLinks(r)||'<li>셀별 제공처 확인 필요</li>'}</ul></div>`).join('')
      : `<div>기록 연도 ${esc(years(c))} · 선별 기록 ${esc(c.count)}건 · 종 전체 출처 ${s.sources.length}개(셀별 분배 미확인)</div>`;
    return `<tr><th scope="row">${esc(range(c))}</th><td>${detail}</td><td>${map?`<button type="button" class="text-button" data-cell="${i}">지도에서 열기</button>`:'—'}</td></tr>`;
  }).join('');
  box.innerHTML=`<details><summary>셀 목록 표로 보기 (${groups.length}개 · 키보드·화면 낭독기용)</summary><button type="button" class="text-button" id="cell-csv">CSV 내려받기 (공개 집계·출처 포함)</button><table><caption class="sr-only">${esc(s.label)}의 공개 셀별 근거. 셀 범위는 원좌표가 아닌 공개 집계 범위입니다.</caption><thead><tr><th scope="col">셀 범위</th><th scope="col">기간·집계·출처</th><th scope="col">지도</th></tr></thead><tbody>${rows}</tbody></table><p class="fine">해역별 활용·보전 판단은 모든 셀에서 보류입니다. 셀 범위는 공개 집계 범위이며 실제 발견 좌표가 아닙니다.</p></details>`;
  $('cell-csv').addEventListener('click',()=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([cellCsv(s)],{type:'text/csv;charset=utf-8'}));
    a.download=`blue-bio-map_${s.aphiaID}_cells.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  box.querySelectorAll('[data-cell]').forEach(b=>b.addEventListener('click',()=>{
    const layer=cellLayers[Number(b.dataset.cell)];if(!layer)return;
    map.panTo(layer.getBounds().getCenter(),{animate:false});layer.openPopup();
    const content=document.querySelector('.leaflet-popup-content');
    if(content){content.tabIndex=-1;content.focus();} // move reading focus into the opened evidence
  }));
}
// Period filter (Global Fishing Watch-style time filter) over the published period rows.
let periodFilter='all';
function periodView(s){
  if(!s?.live||periodFilter==='all')return s;
  const cells=s.cells.filter(c=>c.period===periodFilter);
  return cells.length?{...s,cells}:s;
}
function renderPeriodFilter(s){
  // Chronological: a "2000년 이전" label must not sort between the numeric ranges.
  const first=p=>Math.min(...s.cells.filter(c=>c.period===p).map(c=>c.yearStart));
  const box=$('period-filter'), periods=s?.live?[...new Set(s.cells.map(c=>c.period))].sort((a,b)=>first(a)-first(b)):[];
  if(periods.length<2){box.innerHTML='';return;}
  box.innerHTML=`<span>공개 집계 기간</span>${['all',...periods].map(p=>`<button type="button" data-period="${esc(p)}" aria-pressed="${p===periodFilter}">${p==='all'?'전체':esc(p)}</button>`).join('')}`;
  box.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{periodFilter=b.dataset.period;renderMap();writeHash();}));
}
// B-1: survey-effort background (OBIS all-taxa records per 1° cell since 2000). No dots in a lightly surveyed sea can mean no survey.
let effortData=null, effortLayer=null, effortOn=true;
const effortBand=n=>n>=10000?4:n>=1000?3:n>=100?2:1;
function effortFor(lat0,lon0,size){
  if(!effortData)return null;
  return effortData.cells.filter(c=>c.lat0>=lat0&&c.lat0<lat0+size&&c.lon0>=lon0&&c.lon0<lon0+size).reduce((a,c)=>a+c.records,0);
}
function effortLine(lat0,lon0,size){
  const n=effortFor(lat0,lon0,size);
  return n===null?'':`<br>조사 노력 참고: 이 셀 범위의 OBIS 전체 종 기록 ${n.toLocaleString()}건(${esc(effortData.startdate.slice(0,4))}년 이후) · 이 종의 존재·개체수와 무관`;
}
function drawEffort(){
  if(!map||!effortData)return;
  if(!effortLayer)effortLayer=L.layerGroup().addTo(map);
  effortLayer.clearLayers();
  if(!effortOn)return;
  const ink=basemap==='basic'?'#35566f':'#ffffff';
  for(const c of effortData.cells)L.rectangle([[c.lat0,c.lon0],[c.lat0+1,c.lon0+1]],{renderer:effortRenderer,interactive:false,stroke:false,fillColor:ink,fillOpacity:[0,.03,.06,.1,.14][effortBand(c.records)]}).addTo(effortLayer);
}
// Same aggregates as the table, for download (public cells only; nothing finer than the cell range).
function cellCsv(s){
  // Spreadsheet programs may evaluate quoted text cells beginning with formula characters.
  // Preserve numeric coordinates; mark suspicious text as text inside the quoted CSV field.
  const q=v=>{
    const raw=String(v??'');
    const safe=typeof v==='string'&&/^[\s]*[=+\-@＝＋－＠]/u.test(raw)?'\t'+raw.trimStart():raw;
    return `"${safe.replace(/"/g,'""')}"`;
  };
  const head=['species_label','scientific_name','aphia_id','cell_south','cell_north','cell_west','cell_east','cell_deg','period','year_start','year_end','records','sites','sources','licenses','note'];
  const note='공개 집계 셀 · 실제 발견 좌표 아님 · 해역별 판단 보류';
  const rows=s.live
    ? s.cells.map(c=>[s.label,s.name,s.aphiaID,c.lat0,c.lat0+c.sizeDeg,c.lon0,c.lon0+c.sizeDeg,c.sizeDeg,c.period,c.yearStart,c.yearEnd,c.records,c.sites,(c.citations||[]).map(x=>x.title).join('; '),(c.licenses||[...new Set((c.citations||[]).flatMap(x=>x.licenses||[]))]).join('; '),note+(c.historical?' · 2000년 이전 과거 기록':'')+(c.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':'')])
    : s.cells.map(c=>[s.label,s.name,s.aphiaID,c.lat-.5,c.lat+.5,c.lon-.5,c.lon+.5,1,'',c.yearStart,c.yearEnd,c.count,'',`종 전체 출처 ${s.sources.length}개(셀별 분배 미확인)`,'',note+' · 추가 수집 OBIS']);
  return '﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n');
}
// Shareable view: collection, species, tab, basemap, period and map view live in the URL hash.
function readHash(){try{return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));}catch{return {};}}
function writeHash(){
  if(!data||!selected)return;
  const p=new URLSearchParams({c:$('collection').value,s:selected.aphiaID,v:currentView,b:basemap,t:mapMode});
  if(periodFilter!=='all')p.set('p',periodFilter);
  if(map){const c=map.getCenter();p.set('m',`${map.getZoom()}/${c.lat.toFixed(2)}/${c.lng.toFixed(2)}`);}
  try{history.replaceState(null,'','#'+p.toString());}catch{}
}
function applyHash(h){
  const s=data?.species.find(x=>x.aphiaID===Number(h.s));
  if(s)selectSpecies(s.aphiaID);
  if(h.p&&selected?.cells.some(c=>c.period===h.p)){periodFilter=h.p;renderMap();}
  if(h.t==='value')setMapMode('value');
  if(h.b&&h.b!==basemap&&basemapLayers?.[h.b])setBasemap(h.b);
  const m=(h.m||'').split('/').map(Number);
  if(map&&m.length===3&&m.every(Number.isFinite))map.setView([m[1],m[2]],m[0],{animate:false});
  if(['explore','compare','method'].includes(h.v))setView(h.v);
  writeHash();
}

/* The evidence map joins published cell extents only. No occurrence coordinates or
   species scores are promoted into sea-level scores. A 4° extent stays 4°. */
const valueCellKey=(lat,lon,size)=>[lat,lon,size].join('/');
function valueCellGroups(){
  const groups=new Map();
  if(!data)return groups;
  for(const s of data.species){
    const cells=s.live?periodView(s).cells:s.cells;
    for(const c of cells){
      const lat=s.live?c.lat0:c.lat-.5,lon=s.live?c.lon0:c.lon-.5,size=s.live?c.sizeDeg:1;
      if(![lat,lon,size].every(Number.isFinite))continue;
      const key=valueCellKey(lat,lon,size);
      if(!groups.has(key))groups.set(key,{lat,lon,size,species:new Map()});
      groups.get(key).species.set(s.aphiaID,s);
    }
  }
  return groups;
}
function valueSpeciesCard(s){
  const blockers=assessmentBlockers(s),report=data.assessmentInfo||{};
  const scores=['BBVI','MFPI','MBPI','MCUI'].map(k=>{
    const n=pilotScore(s,k);
    const state=n===null?'산출 보류':n.toFixed(1)+' · 검증 전 시범';
    return '<div class="value-axis"><b>'+k+'</b><span>'+esc(state)+'</span>'+(n===null?'<small>'+esc(blockers[k]||'필수 근거 미확인')+'</small>':'')+'</div>';
  }).join('');
  const stage=s.live?evidenceCoverage(s).checks.map(c=>c.name+' '+coverageStages[c.stage]).join(' · '):'별도 수집 자료 · 지표 연결 판정 없음';
  const sourceIds=s.assessment?.source_ids||[];
  const sources=sourceIds.map(id=>report.sources?.[id]).filter(Boolean);
  const links=sources.map(src=>'<li>'+sourceLink(src.url,src.title||src.name||'지표 근거')+' · '+esc(src.license||'이용조건 미기재')+' · 조회 '+esc(src.accessed||'미기재')+'</li>').join('');
  const raw=s.assessment?.food_trace?.nutrients;
  const rawText=raw?Object.entries(raw).map(([k,v])=>k+' '+v.value+' '+(v.unit||'단위 미확인')+' / '+(v.sample_state||s.assessment.food_trace.sample_state||'시료 상태 미기재')).join(' · '):'원값은 종별 지표 상세에서 확인';
  const cons=s.assessment?.conservation_trace;
  return '<article class="value-species"><h4>'+esc(s.label)+' <small>'+esc(s.name)+'</small></h4>'+
    '<p>종 단위 근거 · AphiaID '+esc(s.aphiaID)+' · '+esc(stage)+'</p>'+
    '<div class="value-axes">'+scores+'</div><p class="fine">원자료(점수 아님): '+esc(rawText)+
    (cons?' · IUCN '+esc(cons.category||'등급 미기재')+' / 평가 '+esc(cons.assessment_date||cons.assessment_year||'일자 미기재'):'')+'</p>'+
    '<p class="fine">평가 보고서 '+esc(report.generatedAt?.slice(0,10)||'미발행')+
    ' · 출현 자료 '+esc(s.publishedAt?.slice(0,10)||data.collectedAt||'미기재')+
    ' · 이용조건: '+esc(data.live?'GBIF 공개 기준 CC0·CC BY 4.0':'OBIS 추가 수집 CC BY-NC 포함')+'</p>'+
    (links?'<details><summary>지표 근거 원문과 이용조건</summary><ul>'+links+'</ul></details>':'<p class="fine">이 종에 연결된 지표 근거 원문은 아직 없습니다.</p>')+
    '<button type="button" class="text-button" data-value-species="'+esc(s.aphiaID)+'">종별 상세 근거 보기 →</button></article>';
}
function showValueCell(key){
  selectedValueCell=key;
  const group=valueCellGroups().get(key),panel=$('value-cell-detail');
  if(!group){panel.innerHTML='<p>선택한 공개 격자가 현재 기간의 자료에 없습니다. 지도의 다른 격자를 선택하세요.</p>';return;}
  const species=[...group.species.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
  panel.innerHTML='<h3>선택한 공개 격자 · 종별 근거</h3><p>'+
    esc(group.lat)+'–'+esc(group.lat+group.size)+'°N · '+esc(group.lon)+'–'+esc(group.lon+group.size)+'°E ('+esc(group.size)+'° 공개 범위)</p>'+
    '<p class="fine">연결 종 '+species.length+'종 · 해당 공개 셀에 기록이 있는 종만 표시합니다. 지표는 종 전체에 대한 시범값이며 이 해역에서 측정한 값이 아닙니다. 셀의 합산 점수·우선순위는 산출하지 않았습니다.</p>'+
    species.map(valueSpeciesCard).join('');
  panel.querySelectorAll('[data-value-species]').forEach(button=>button.addEventListener('click',()=>{
    selectSpecies(Number(button.dataset.valueSpecies));
    const detail=$('detail');detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
}
function renderValueMap(){
  const groups=valueCellGroups(),panel=$('value-cell-detail');
  $('map-source').textContent=data.live?'활용 × 보전 · GBIF 공개 격자':'활용 × 보전 · OBIS 추가 수집 격자';
  $('map-review-note').textContent='공개 격자를 선택하면 연결 종의 식량·생리활성·보전 지표와 보류 사유를 확인할 수 있습니다. 모든 격자는 판단 보류이며 회색 빗금은 가치·보전 등급이 아닙니다.';
  $('map-judgment').textContent='해역별 조합 분류 0곳 · 공개 격자 '+groups.size+'개 판단 보류. 종별 BBVI·MCUI 한 쌍과 검증된 해역 집계 규칙이 없어 네 유형으로 분류하지 않습니다.';
  $('map-count').textContent='—';$('map-cells').textContent=String(groups.size);$('map-years').textContent='—';
  if(!groups.size){panel.innerHTML='<h3>공개 격자 없음</h3><p>이 자료와 기간에는 공개된 출현 격자가 없어 종을 해역에 연결할 수 없습니다. 종 목록에서 개별 근거를 확인하세요.</p>';return;}
  if(!selectedValueCell||!groups.has(selectedValueCell))selectedValueCell=groups.keys().next().value;
  showValueCell(selectedValueCell);
  if(selected?.catalog&&!selected.cells.length)$('value-cell-detail').insertAdjacentHTML('afterbegin','<p class="catalog-alert">선택한 종은 공개 가능한 출현 격자가 없어 아래 격자와 연결되지 않습니다. 격자를 누르면 다른 종의 근거를 볼 수 있습니다.</p>');
  if(!map)return;
  for(const [key,g] of groups){
    const active=key===selectedValueCell;
    const layer=L.rectangle([[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]],{
      color:active?'#173f62':'#657588',weight:active?2.5:1.5,dashArray:'5 4',
      fillColor:'#b7c0ca',fillOpacity:active?.36:.25
    }).addTo(overlay);
    layer.bindTooltip('공개 '+g.size+'° 격자 · '+g.species.size+'종 · 해역 판단 보류');
    layer.on('click',()=>{showValueCell(key);renderMap();panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  if(lastFitted!=='value-'+$('collection').value){
    lastFitted='value-'+$('collection').value;
    map.fitBounds([...groups.values()].flatMap(g=>[[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]]),
      {padding:[35,35],maxZoom:7,animate:false});
  }
}
function setMapMode(mode){
  if(!['occurrence','value'].includes(mode))return;
  mapMode=mode;lastFitted=null;
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode)));
  $('occurrence-legend').hidden=mode==='value';$('value-legend').hidden=mode!=='value';
  $('value-cell-detail').hidden=mode!=='value';$('period-filter').hidden=mode==='value'&&!data?.live;
  $('effort-toggle').disabled=mode==='value';
  renderMap();writeHash();
}

// Short status next to the map so phones see name, published/candidate and index summary without reaching the detail pane.
function renderMapSelected(s){
  const where=!s.live?'추가 수집 OBIS 1° 격자':s.catalog&&s.cells.length?s.status+' · 현재 분포 아님':s.status;
  $('map-selected').innerHTML=`<b>${esc(s.label)}</b> <span class="kind${s.catalog?' cand':''}">${!s.live?'추가 수집 자료':s.catalog?'조사 후보':'운영 발행'}</span> <span>${esc(scoreSummary(s))} · ${esc(where)}</span>`;
}
function renderMap() {
  if(selected)renderMapSelected(selected);
  renderPeriodFilter(selected);
  $('period-filter').hidden=mapMode==='value'&&!data?.live;
  if(mapMode==='value'){$('cell-table').innerHTML='';}else renderCellTable(periodView(selected)); // before the map check: the table also works when the map failed to load
  if(map)map.invalidateSize(); // the detail pane can change the map column height
  overlay?.clearLayers();dotCells=[];cellLayers=[];
  if(mapMode==='value'){effortLayer?.clearLayers();renderValueMap();return;}
  if(!map)return;
  const s=selected;if(!s)return;const color=colors[data.species.indexOf(s)%colors.length];
  $('map-source').textContent=s.catalog?(s.cells.length?`조사 후보 · 검수 기록 공개 ${s.cells[0].sizeDeg}° 셀`:s.review?'조사 후보 · 공개 가능한 기록 없음':'조사 후보 · 검수 자료 확인 실패'):s.live?(s.cells.length?`공개 기준 자료 · 공개 ${s.cells[0].sizeDeg}° 셀`:'공개 기준 자료 · 자료 조회 범위'):'추가 수집 자료(OBIS) · 1° 격자';
  setMapLegend(s.live,s);
  if(s.catalog&&!s.cells.length){$('map-symbol-label').textContent=s.review?'공개 기준 통과 기록 없음 · 셀 없음':'검수 자료 확인 실패 · 셀 없음';$('map-legend-note').textContent='빈 지도는 해당 종이 이 해역에 없다는 뜻이 아닙니다.';}
  $('effort-toggle').disabled=!!s.catalog;
  if(s.catalog)effortLayer?.clearLayers();else drawEffort();
  if(s.live&&$('detail-map-summary'))$('detail-map-summary').innerHTML=mapSummaryHtml(periodView(s));
  if(s.live&&s.cells.length)return renderCellMap(periodView(s),color);
  if(s.catalog){$('map-judgment').textContent=(pilotScore(s,'MBPI')!==null?'종별 시범 MBPI만 산출 · BBVI·MCUI와 해역 판단 보류 · ':'종별 점수와 해역 판단 모두 보류 · ')+(s.review?'공개 가능한 출현기록 없음':'출현 검수 자료 확인 실패');$('map-review-note').textContent=s.review?`${reviewLine(s.review)}. 제외 사유: ${withheldLine(s.review)}. 셀이 없는 것은 종 부재나 전체 분포를 뜻하지 않습니다.`:'출현 검수 파일을 확인하지 못해 셀을 표시하지 않습니다. 종 부재가 아닙니다.';
    $('map-count').textContent='—';$('map-cells').textContent='0';$('map-years').textContent='—';return;}
  mapJudgmentStatus(s);
  $('map-review-note').textContent=!s.live?'추가 수집한 OBIS 선별 출현기록을 1° 격자의 붉은 점 무늬로 표시합니다. 공개 기준 적용 자료와 합산하지 않습니다. 붉은 점은 실제 발견 좌표나 기록 1건이 아니며, 기록 수와 점은 개체수·자원량·가치·보전 등급·현재 한국 전체 분포가 아닙니다.':'테두리는 자료를 조회한 범위(124–132°E · 33–38.7°N)입니다. 이 종의 출현 위치나 분포를 뜻하지 않습니다.';
  if(s.live){
    L.rectangle(studyBounds,{color:basemap==='basic'?'#267bab':'#ffd166',weight:2,dashArray:'10 7',fillColor:'#267bab',fillOpacity:.07})
      .addTo(overlay).bindPopup(`<strong>${esc(s.label)} · 자료 조회 범위</strong><br>124–132°E · 33–38.7°N<br><small>출현 위치나 분포 범위가 아닙니다.</small>`);
    if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(studyBounds,{padding:[30,30],animate:false});}
  }
  for(const cell of s.cells){
    cellLayers.push(L.rectangle([[cell.lat-.5,cell.lon-.5],[cell.lat+.5,cell.lon+.5]],cellFrame()).addTo(overlay));
    cellLayers.at(-1).bindPopup(`<strong>${esc(s.label)} · 추가 수집 OBIS 출현 격자</strong><br><b>해역별 활용·보전 판단: 보류</b><br>${esc(speciesAxesLine(s))}<br>기록 연도 ${esc(years(cell))} · 선별 기록 ${esc(cell.count)}건<br>조회 범위 122–136°E · 30–43°N (한국·일본 등 주변 해역)<br>종 전체 출처 ${s.sources.length}개 (셀별 제공처 분배 미확인) · ${sourceLink(s.queryUrl,'OBIS 조회 조건 ↗')}<br>이용조건은 출처마다 다릅니다. 종 상세의 ‘데이터셋과 이용 조건’을 확인하세요.<br><b>판단 보류 이유</b><ul>${cellAssessmentStatus(s,cell).reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>최대 1,000건 조회·라이선스 선별. 조사 노력·중복·시기·국경 영향 미보정. 붉은 점은 개별 관측 위치가 아니며, 개체수·자원량·현재 한국 전체 분포도 아닙니다.</small>`+effortLine(cell.lat-.5,cell.lon-.5,1)+generalizationNote(1,false)+cellPopupNotice(1));
    addCellDots(cell.lat-.5,cell.lon-.5,1,cell.count);
  }
  if(!s.live&&s.cells.length&&s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.flatMap(c=>[[c.lat-.5,c.lon-.5],[c.lat+.5,c.lon+.5]]),{padding:[30,30],maxZoom:7,animate:false});}
  $('map-count').textContent=s.live?'0':Number.isSafeInteger(s.recordCount)?s.recordCount.toLocaleString():'—';$('map-cells').textContent=s.live?'0':s.cells.length;$('map-years').textContent=s.live?'—':years(s);
}

function fitMap(){if(map)map.fitBounds([[30,122],[43,136]],{padding:[8,8]});}

// Background maps. basic: Natural Earth 1:10m outline (bundled). satellite: NASA GIBS Blue Marble. depth: GEBCO WMS.
// External tiles are optional: if they fail to load, the map falls back to basic and says so.
let basemapLayers, lastFitted;
function initBasemaps(geography){
  map.createPane('basePane').style.zIndex=250; // above tiles, below cells
  const land=L.geoJSON(geography,{pane:'basePane',interactive:false,style:{fillColor:'#f3f7f6',color:'#acc1ca',weight:1,fillOpacity:1}});
  const outline=L.geoJSON(geography,{pane:'basePane',interactive:false,style:{fill:false,color:'#ffffff',weight:.8,opacity:.55}});
  const grid=L.layerGroup();
  for(let lat=25;lat<=50;lat+=5)L.polyline([[lat,110],[lat,150]],{pane:'basePane',color:'#adc9d6',weight:.5,opacity:.55,interactive:false}).addTo(grid);
  for(let lon=115;lon<=145;lon+=5)L.polyline([[22,lon],[52,lon]],{pane:'basePane',color:'#adc9d6',weight:.5,opacity:.55,interactive:false}).addTo(grid);
  const satellite=L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    {maxNativeZoom:8,maxZoom:8,attribution:'NASA GIBS · Blue Marble'});
  const depth=L.tileLayer.wms('https://wms.gebco.net/mapserv?',{layers:'gebco_latest',format:'image/png',version:'1.3.0',
    attribution:'GEBCO_2026 Grid · 항해용 아님'});
  basemapLayers={basic:[land,grid],satellite:[satellite,outline],depth:[depth,outline]};
  // Counted per activation: a server that worked earlier can still fail now.
  for(const tiles of [satellite,depth]){
    tiles.on('add',()=>{tiles.ok=0;tiles.bad=0;});
    tiles.on('tileload',()=>tiles.ok++);
    tiles.on('tileerror',()=>{if(++tiles.bad>=4&&!tiles.ok&&map.hasLayer(tiles))setBasemap('basic',true);});
  }
  document.querySelectorAll('[data-basemap]').forEach(b=>b.addEventListener('click',()=>setBasemap(b.dataset.basemap)));
}
function savedBasemap(){try{return localStorage.getItem('basemap')||'basic';}catch{return 'basic';}}
function setBasemap(name,failed=false){
  if(!basemapLayers?.[name])name='basic';
  for(const layers of Object.values(basemapLayers))for(const l of layers)map.removeLayer(l);
  for(const l of basemapLayers[name])l.addTo(map);
  basemap=name;
  $('map').classList.toggle('map-dark',name!=='basic');
  document.querySelectorAll('[data-basemap]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.basemap===name)));
  $('basemap-status').textContent=failed?'배경 지도를 불러오지 못해 기본 지도로 바꿨습니다.':'';
  try{if(!failed)localStorage.setItem('basemap',name);}catch{}
  renderMap();writeHash();
}

function initMap(geography){
  prepareLandMask(geography);
  map=L.map('map',{zoomControl:true,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7});fitMap();
  initBasemaps(geography);
  const labels=[['대한민국',36.4,127.4],['북한',40.1,126.6],['일본',35.5,136.8],['중국',39,119.5]];
  for(const [name,lat,lon] of labels)L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'geo-label',html:name,iconSize:[70,20],iconAnchor:[25,10]})}).addTo(map);
  for(const [name,lat,lon] of [['서해',35.3,123],['동해',39,132],['남해',32.5,128]])L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'sea-label',html:name,iconSize:[60,20]})}).addTo(map);
  const dotPane=map.createPane('dotPane');dotPane.style.zIndex=390;dotPane.style.pointerEvents='none';
  dotRenderer=L.canvas({pane:'dotPane',padding:.5});
  const effortPane=map.createPane('effortPane');effortPane.style.zIndex=360;effortPane.style.pointerEvents='none';
  effortRenderer=L.canvas({pane:'effortPane',padding:.5});
  map.on('moveend',writeHash);
  overlay=L.layerGroup().addTo(map);
  map.on('zoomend',()=>{overlay.eachLayer(l=>{if(l._schematicDot)overlay.removeLayer(l);});for(const c of dotCells)drawCellDots(...c);});
  map.attributionControl.setPrefix('Leaflet');map.attributionControl.addAttribution('OBIS · GBIF');fitMap();setBasemap(savedBasemap());
}

function renderComparison(){
  const compared=data.species.slice(comparisonPage*5,comparisonPage*5+5);
  $('comparison-page').textContent=`${comparisonPage+1} / ${Math.ceil(data.species.length/5)} · ${comparisonPage*5+1}–${comparisonPage*5+compared.length}종`;
  $('comparison-prev').disabled=comparisonPage===0;$('comparison-next').disabled=(comparisonPage+1)*5>=data.species.length;
  const pending=t=>`<span class="pending">${t}</span>`;
  const v2=(s,fn,fallback)=>s.v2?fn(s.info):pending(fallback);
  const axisCell=(s,key)=>{
    if(!VERIFIED.includes(s.assessment?.report_version))return pilotScore(s,key)!==null?pilotCell(s,key):null;
    const value=pilotScore(s,key),status=s.assessment.score_status?.[key]||'산출 보류';
    const cohort=key==='MFPI'&&value!==null?s.assessment.food_trace?.cohort_id:null;
    const cohortLabel=cohort==='rda-10.4-raw-marine-animals'?'수산동물':cohort==='rda-10.4-raw-seaweeds'?'해조류':cohort;
    const cohortCount=cohort?(data.assessmentInfo?.cohorts||[]).find(c=>c.cohort_id===cohort)?.food_item_ids?.length:null;
    return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${value===null?status:value.toFixed(1)}${cohort?' · '+esc(cohortLabel)+' 고정 비교집단 · 다른 집단과 비교 불가':''} 근거 보기">`+
      `${value===null?esc(status):value.toFixed(1)}<small>${value===null?esc(shortReason[s.assessment.withheld_reasons?.[key]]||'근거·보류 사유')+' · 보기':'검증 전 시범 지표 · 근거 보기'}</small>`+
      (cohort?`<small>고정 비교집단 ${esc(cohortLabel)}${cohortCount?' '+cohortCount+'개 식품':''} · 집단 간 점수 비교 불가</small>`:'')+
      (s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')+'</button>';
  };
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],
    ['출현기록',s=>s.live&&s.cells.length?`${cellCountLabel(s)} · ${sitesLabel(s)} ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 ${s.cells[0].sizeDeg}° 셀 · ${s.catalog?s.info.map.source:'GBIF CC0·CC BY'}${flaggedRecords(s,'historical')?` · 2000년 이전 ${flaggedRecords(s,'historical')}건`:''}</small>`:s.catalog?pending(s.review?`${reviewLine(s.review)} · 공개 셀 없음`:'검수 자료 확인 실패'):s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · ${s.live?'조사 범위 표시':s.cells.length+'격자'}<small>${years(s)} · 조회·선별된 자료</small>`],
    ['식량 근거 · MFPI',s=>axisCell(s,'MFPI')||(s.catalog&&s.audit?.nutrition?.foodCode?pending('RDA 식품명 후보 · 종 연결 보류'):v2(s,({nutrition:n={}})=>n.status==='available'?`영양 기록 ${count(n.record_count)}<small>수집 현황 · 단위/가식부 검증 전 · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인'))],
    ['생리활성 · MBPI',s=>axisCell(s,'MBPI')||v2(s,({compounds:c={}})=>c.status==='available'?`보고 화합물 ${count(c.compound_count,'개')}<small>${c.quantitative_bioactivity_count===0?'정량 활성 자료 없음':'정량 활성 자료 '+count(c.quantitative_bioactivity_count)}</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['보전 평가 · MCUI',s=>axisCell(s,'MCUI')||(s.catalog&&s.audit?.iucn?.record?.category?pending('IUCN 체크리스트 '+s.audit.iucn.record.category+' · 점수 보류'):v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),IUCN_HISTORICAL[s.aphiaID]?'산출 보류':'평가 미조회')+(IUCN_HISTORICAL[s.aphiaID]?`<small>IUCN ${IUCN_HISTORICAL[s.aphiaID].category} · ${IUCN_HISTORICAL[s.aphiaID].published}년 발표 · 역사적 평가 · 현행 평가 확인 보류</small>`:''))],
    ['자료 연결 현황',s=>s.live?`<span class="sr-only">5개 항목의 검증 단계 · 점수 아님</span>${coverageBar(s)}<small>발견·종 연결·원문 확인·시범 산출을 구분 · 점수 아님</small>`:pending('별도 수집 자료 · 지표 연결 판정 없음')],
    ['후속조사 · 순위 아님',s=>{const p=followupDecision(s);return p?'<span class="pending">연구·보전·산업 검토 과제 분리</span><small>종 상세에서 차단 단계·원문·다음 조사 확인</small>':pending('검수 상태 연결 확인 필요');}],
    ['통합점수 · BBVI',s=>axisCell(s,'BBVI')||'<strong>산출 보류</strong>']];
  $('comparison').innerHTML=`<p class="fine coverage-guide">${esc(coverageGuide)} 각 지표 칸을 누르면 원값·원문·보류 사유가 열립니다.</p><table><caption class="sr-only">탐색 후보 ${data.species.length}종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${compared.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${compared.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('comparison').querySelectorAll('[data-score-aphia]').forEach(button=>button.addEventListener('click',()=>{
    const returnScroll=$('comparison').scrollLeft;
    const axis=button.dataset.scoreAxis;
    const aphia=button.dataset.scoreAphia;
    selectSpecies(Number(button.dataset.scoreAphia));setView('explore');
    const back=document.createElement('button');
    back.type='button';back.className='text-button comparison-return';back.textContent='← 비교표로 돌아가기';
    $('detail').prepend(back);
    back.addEventListener('click',()=>{
      setView('compare');$('comparison').scrollLeft=returnScroll;
      $('comparison').querySelector(`[data-score-aphia="${aphia}"][data-score-axis="${axis}"]`)?.focus();
    });
    const disclosure=$('detail').querySelector(`[data-axis="${axis}"]`);
    if(disclosure){for(let d=disclosure;d;d=d.parentElement?.closest('details'))d.open=true;disclosure.querySelector('summary')?.focus({preventScroll:true});disclosure.scrollIntoView({behavior:'smooth',block:'start'});}
    else back.focus();
  }));
}

// The BBVI weight only matters once some species has both MFPI and MBPI.
function updateWeightControl(){
  const n=data.species.filter(s=>pilotScore(s,'BBVI')!==null).length;
  $('bbvi-weight').disabled=!n;
  $('bbvi-weight-status').textContent=n?`BBVI 산출 종 ${n}종`:'BBVI 산출 종 0종 · 두 축(MFPI·MBPI)이 모두 있는 종이 생기면 조절됩니다';
}
const matrixReasonLabel={food_row_not_species_specific:'종별 식품 원값 연결 필요',component_missing_in_source:'필수 영양 성분 결측',not_in_red_list:'IUCN 평가 검색 미확인',assessment_lookup_failed:'IUCN 원평가 조회 필요',origin:'기원종',structure_id:'확정 구조',quantitative_endpoint:'정량 시험',comparable_cohort:'동일 조건 비교집단',species_link:'식품 행의 종 연결',raw_nutrition:'영양 원값',complete_raw_nutrition:'단백질·철·아연 원값',edible_fraction:'가식부 비율',aquaculture:'양식 근거',fixed_comparable_cohort:'고정 비교집단',comparable_nutrition_missing:'고정 비교집단의 종 행',aquaculture_method_unverified:'양식 근거',category_not_numeric:'IUCN DD · 숫자 없음'};
function matrixBlockerText(s){
  const row=matrixReadiness.get(s.aphiaID);
  if(!row||row.scientific_name!==s.name)return scoreSummary(s);
  const reason=row.axis_reasons;
  const food=row.scores.MFPI===null?`MFPI ${Array.isArray(reason.MFPI)?reason.MFPI.map(k=>matrixReasonLabel[k]||k).join('·'):(matrixReasonLabel[reason.MFPI]||reason.MFPI)}`:null;
  const bio=row.scores.MBPI===null?`MBPI ${row.bioactivity_missing_steps.map(k=>matrixReasonLabel[k]||k).join('·')}`:null;
  const cons=row.scores.MCUI===null?`MCUI ${reason.MCUI==='not_in_red_list'?'IUCN 평가 검색 미확인':row.scope==='expansion_22'?'IUCN 원평가 검수 필요':'IUCN 원평가 확인 필요'}`:null;
  // Computed pilot values come first, so a held axis never hides a value the report did calculate.
  const done=['MFPI','MBPI','MCUI'].filter(k=>pilotScore(s,k)!==null).map(k=>`${k} ${pilotScore(s,k).toFixed(1)}`);
  return [...done,food,bio,cons].filter(Boolean).join(' / ');
}
function toggleSimulation(value){
  simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);
  const assessed=data?.species.filter(assessedForMatrix)||[];
  $('matrix-note').innerHTML=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`시범 지표 ${assessed.length}종 · BBVI와 MCUI가 모두 산출된 종만 표시합니다. 타당성 미검증.`:'실제 종의 두 축을 산출하지 못해 배치하지 않았습니다. 아래에서 종별 보류 사유와 확인된 원문을 볼 수 있습니다. <button type="button" class="link-button" id="simulate-inline">가상 작동 예시 보기 →</button>';
  $('simulate-inline')?.addEventListener('click',()=>toggleSimulation(true));
  const unplaced=value?[]:(data?.species||[]).filter(s=>!assessedForMatrix(s));
  const kinds=data?.live?` (운영 발행 ${unplaced.filter(s=>!s.catalog).length}종 · 조사 후보 ${unplaced.filter(s=>s.catalog).length}종)`:'';
  $('matrix-unplaced').innerHTML=unplaced.length?`<b>정보 부족 · 우선 조사 대상 ${unplaced.length}종${kinds}</b><span>네 유형과 별개입니다. 낮은 가치가 아니라 두 축을 산출할 근거가 아직 없다는 뜻입니다. 항목별 차단 사유는 종 상세의 원문에서 확인할 수 있습니다.</span><div>${unplaced.map(s=>`<button type="button" data-aphia="${s.aphiaID}">${esc(s.label)} <small>${esc(matrixBlockerText(s))}</small></button>`).join('')}</div>`:'';
  $('matrix-unplaced').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{showDecision(data.species.find(s=>s.aphiaID===Number(b.dataset.aphia)));$('decision-detail').scrollIntoView({behavior:'smooth',block:'nearest'});}));
  const points=[['A',24,74,'보전 우선 검토'],['B',77,76,'대체생산 연구 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map((s,i)=>`<button class="matrix-point pilot" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%" title="${esc(s.label)} · 시범 BBVI ${pilotScore(s,'BBVI')}, MCUI ${pilotScore(s,'MCUI')}" aria-label="${esc(s.label)} 시범 활용 지표 ${pilotScore(s,'BBVI')}, 보전 지표 ${pilotScore(s,'MCUI')}. 타당성 미검증">${i+1}</button>`).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){showDecision(assessed[i]);$('decision-detail').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
    const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 실제 종의 평가 결과가 아니며, 분류 기준 역시 예시입니다.`;
  }));
}

function renderSources(){
  $('snapshot-date').textContent=`${data.live?'공개 기준 자료 발행':'추가 수집 자료 수집'} ${data.collectedAt}`;$('collection-note').textContent=data.notes;
  const all=new Map();data.species.forEach(s=>s.sources.forEach(src=>all.set(src.id,src)));
  $('all-sources').innerHTML=data.species.map(s=>`<div class="citation"><strong>${esc(s.label)} · 학명</strong><span>${esc(s.wormsCitation)}</span><br>${sourceLink(s.wormsUrl,'WoRMS 원문 ↗')} · ${sourceLink('https://www.marinespecies.org/about.php','WoRMS 이용조건 · CC BY 텍스트')}</div>`).join('')+Array.from(all.values()).map(s=>`<div class="citation"><strong>${esc(s.title)}</strong><span>${esc(s.citation)}</span><br>${sourceLink(s.url,data.live?'데이터셋 원문 ↗':'OBIS 데이터셋 ↗')} · ${sourceLink(s.licenseUrl,s.license)}<br><span>${data.live?'변경: '+esc(s.changes||'종별 건수·기간 요약, 승인학명 연결, 좌표 미공개.'):'변경: 대상 종·해역 필터, 레코드 ID 중복 제거, 1° 격자 집계.'} ${esc(data.live&&s.accessed||data.collectedAt)} 접근.</span></div>`).join('');
}

function registerTools(){
  const ctx=document.modelContext;if(!ctx?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const options={signal:lifecycle.signal};
  for(const tool of [
    {name:'read_biobio_evidence',title:'후보종 근거 현황 읽기',description:'실제 표시된 종별 근거 연결 현황과 시범 지표 상태를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('인자가 없어야 합니다.');return {view:currentView,selectedAphiaID:selected?.aphiaID,simulated,species:(data?.species||[]).map(s=>({label:s.label,aphiaID:s.aphiaID,records:s.recordCount,status:s.status,scores:s.assessment?.scores||s.scores,scoreStatus:s.assessment?'provisional_unvalidated':'unscored'}))};}},
    {name:'select_biobio_species',title:'탐색할 종 선택',description:'AphiaID로 후보를 선택하고 실제 지도와 근거 카드를 표시합니다.',inputSchema:{type:'object',properties:{aphiaID:{type:'integer'}},required:['aphiaID'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Number.isInteger(input.aphiaID)||Object.keys(input).some(k=>k!=='aphiaID'))throw new Error('정수 AphiaID를 입력하세요.');selectSpecies(input.aphiaID);$('search').value='';renderList();setView('explore');return {selected:selected.label,aphiaID:selected.aphiaID,status:selected.status};}}
  ])try{Promise.resolve(ctx.registerTool(tool,options)).catch(()=>{});}catch{}
}

let requestNumber=0;
async function loadCollection(){
  const request=++requestNumber,live=$('collection').value==='live';
  data=null;selected=null;selectedValueCell=null;comparisonPage=0;overlay?.clearLayers();lastFitted=null;fitMap();$('search').value='';$('error').hidden=true;
  $('connection-state').textContent='자료를 불러오는 중';
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';$('decision-list').textContent='';$('matrix-unplaced').textContent='';$('cell-table').textContent='';$('decision-detail').textContent='';$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';$('value-cell-detail').textContent='';$('map-selected').textContent='';
  setMapLegend(live,null);
  $('data-label').textContent=live?'공개 기준 자료':'추가 수집 자료';
  $('score-disclaimer').textContent='자료를 불러오는 중입니다.';
  $('scope-bounds').textContent=live?'124–132°E · 33–38.7°N · 시험 범위':'122–136°E · 30–43°N · 추가 수집 범위';
  $('map-judgment').textContent='해역별 활용·보전 판단: 입력 확인 중';
  $('map-source').textContent=live?'공개 기준 자료 · 공개 1° 셀':'추가 수집 자료(OBIS) · 1° 격자';
  try{
    const [next,other,readiness]=await Promise.all([live?loadPublishedProfiles():fetch('data.json').then(r=>{if(!r.ok)throw Error('추가 수집 자료를 불러오지 못했습니다.');return r.json();}),
      live?fetch('data.json').then(r=>r.ok?r.json():null).catch(()=>null):null,
      fetch('matrix-readiness.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
    matrixReadiness=new Map(readiness?.schema_version===1&&Array.isArray(readiness.species)?readiness.species.map(row=>[row.aphia_id,row]):[]);
    next.readinessAssessmentDate=readiness?.assessments_snapshot||null;next.readinessCandidateDate=readiness?.candidate_snapshot||null;
    otherCollection=other?.species||[];
    if(request!==requestNumber)return;
    if(live)await attachPilotAssessments(next);
    if(request!==requestNumber)return;
    $('score-disclaimer').innerHTML=next.species.some(s=>s.assessment)?'일부 종에 <strong>검증 전 시범 지표</strong>가 있습니다. 연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.':'이 자료에는 활용가치·보전 지표를 <strong>산출하지 않았습니다.</strong> 학명·출현 근거만 봅니다.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];mapJudgmentStatus(selected);renderList();renderDetail();renderMap();renderComparison();renderDecisionList();renderSources();
    // Three live states: connected, connected but 0 published (not a failure, no snapshot), unreachable (dated snapshot).
    const counts=live?`운영 발행 ${data.publishedCount}종 · 조사 후보 ${data.candidateCount}종`:'';
    $('connection-state').textContent=data.snapshotAt?`연결 실패 · 저장된 사본 사용 (${data.snapshotAt} 기준) · ${counts}`:live?'공개 기준 자료 연결됨 · '+counts:'추가 수집 자료 · '+data.species.length+'종';
    if(data.snapshotAt){$('error').hidden=false;$('error').textContent=`운영 DB에 연결하지 못해 ${data.snapshotAt}에 저장한 공개 자료 사본을 표시합니다. 그 뒤 발행된 변경은 반영되지 않았습니다.`;}
    else if(live&&!data.publishedCount)$('score-disclaimer').innerHTML=`운영 DB에는 연결됐지만 <strong>운영 발행 자료가 0종</strong>입니다. 지금 보이는 ${data.candidateCount}종은 모두 조사 후보이며, 지표는 산출하지 않았습니다.`;
    toggleSimulation(false);updateWeightControl();
    if(startHash){const h=startHash;startHash=null;if(h.s)applyHash(h);}
  }catch(error){if(request!==requestNumber)return;$('error').hidden=false;$('error').textContent=error.message;$('connection-state').textContent='불러오기 실패';$('species-list').textContent='다시 불러오기를 눌러 주세요.';$('map-review-note').textContent='자료 연결을 확인할 수 없습니다.';}
}
let startHash={};
async function start(){
  startHash=readHash();
  if(matchMedia('(max-width:740px)').matches)document.querySelector('.map-legend-more').open=false; // phones: keep the map near the first screen
  if(['live','demo'].includes(startHash.c))$('collection').value=startHash.c;
  try{const r=await fetch('effort.json');if(r.ok){effortData=await r.json();$('effort-date').textContent=`OBIS 통계 API · ${effortData.retrieved} 조회`;}}catch{/* optional layer */}
  try{const r=await fetch('countries.json');if(!r.ok)throw Error('map');const geography=await r.json();if(typeof L!=='undefined')initMap(geography);}catch{$('map').textContent='배경 지도를 불러오지 못했습니다. 종 요약은 계속 볼 수 있습니다.';}
  await loadCollection();registerTools();
}
$('collection').addEventListener('change',loadCollection);$('reload-data').addEventListener('click',loadCollection);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-map-mode]').forEach(button=>button.addEventListener('click',()=>setMapMode(button.dataset.mapMode)));
$('search').addEventListener('input',()=>{if(data)renderList();});
for(const id of ['species-group','species-evidence'])$(id).addEventListener('change',()=>{if(data)renderList();});
$('comparison-prev').addEventListener('click',()=>{comparisonPage=Math.max(0,comparisonPage-1);renderComparison();});
$('comparison-next').addEventListener('click',()=>{comparisonPage=Math.min(Math.ceil(data.species.length/5)-1,comparisonPage+1);renderComparison();});
$('effort-toggle').addEventListener('change',e=>{effortOn=e.target.checked;drawEffort();});
$('copy-link').addEventListener('click',()=>{writeHash();const done=m=>{$('basemap-status').textContent=m;};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(()=>done('현재 화면 링크를 복사했습니다.'),()=>done('주소창의 링크를 복사하세요.'));else done('주소창의 링크를 복사하세요.');});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
$('bbvi-weight').addEventListener('input',event=>{
  bbviWeight=Number(event.target.value);$('bbvi-weight-value').textContent=bbviWeight.toFixed(2);
  if(data){renderComparison();renderDetail();toggleSimulation(simulated);}
});
start();
