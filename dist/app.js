'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
const studyBounds = [[33,124],[38.7,132]];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'basic', bbviWeight = .5, mapMode = 'occurrence', selectedValueCell = null, comparisonPage = 0, matrixReadiness = new Map();
const VERIFIED = ['verified-pilot-2','verified-pilot-2.1','verified-pilot-2.2','verified-pilot-2.3','verified-pilot-3.1','verified-pilot-3.2','verified-pilot-3.3','verified-pilot-3.4','verified-pilot-3.5','verified-pilot-3.6','verified-pilot-3.7','verified-pilot-3.8','verified-pilot-3.9','verified-pilot-3.10','verified-pilot-3.11','verified-pilot-3.12','verified-pilot-3.13','verified-pilot-3.14','verified-pilot-3.15','verified-pilot-3.16','verified-pilot-3.17','verified-pilot-3.18','verified-pilot-3.19','verified-pilot-3.20','verified-pilot-3.21','verified-pilot-3.22','verified-pilot-3.23','verified-pilot-3.24','verified-pilot-3.25'];
// 2.1 and later: an MBPI resting on fewer than the minimum independent DOIs is labelled and never enters BBVI.
const singleSourceRule = version => VERIFIED.indexOf(version)>=1;
// 2.3: a used cross-origin potency replication adds its DOI to independent_dois; without it the origin DOIs count.
const mbpiDois = x => new Set((x.independent_dois||x.original_paper_dois).map(d=>d.toLowerCase()));
// 3.1: a ChEMBL item needs both the species link and the activity on separate papers, so the weaker side counts.
const mbpiSources = x => x.stratum_kind==='chembl'?x.independent_sources:mbpiDois(x).size;
const bestBio = a => (a?.bioactivity_trace||[]).reduce((p,x)=>!p||x.adjusted>p.adjusted?x:p,null);
const years = item => item.yearStart ? (item.yearStart===item.yearEnd ? String(item.yearStart) : `${item.yearStart}–${item.yearEnd}`) : '연도 미기재';
const safeUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : '#';
const sourceLink = (url,label) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)}</a>`;
const recordLabel = s => s.noOccurrences ? '출현자료 미수집'
  : Number.isSafeInteger(s.recordCount) ? s.recordCount.toLocaleString()+'건' : '기록 수 미확인';
// Evidence stages are independent of the operational DB's old inventory counters.
// A paper or a search with no matching assessment never becomes a scored input.
// A candidate release file newer than this code is not a failed review; only a refresh is needed (live-data.js).
const releaseMissing = s => s.releaseOutdated ? '검수 자료 새 버전 있음 · 새로고침(F5)' : '검수 자료 확인 실패';
const coverageStages={unavailable:'미확인',found:'원자료 발견',linked:'종 연결',verified:'원문 확인',calculated:'시범 산출',validated:'방법 검증 통과'};
// After 3.14 (team-lead decision 2026-10-01): an axis is labelled by its own post-hoc validation result (method.posthoc), never by
// intent. BBVI counts as validated only when both MFPI and MBPI passed. A failed or missing check keeps the pilot label.
const validationResult = (key,info=data?.assessmentInfo) => {
  const sets=info?.method?.posthoc?.validation_sets||{}, r=k=>['passed','failed'].includes(sets[k]?.result)?sets[k].result:null;
  return key==='BBVI'?(r('MFPI')==='passed'&&r('MBPI')==='passed'?'passed':r('MFPI')==='failed'||r('MBPI')==='failed'?'failed':null):r(key);
};
// a passed check is a method check on n species (validation_sets[key].n), so the label says so rather than implying each species was checked
const validationN = (key,info=data?.assessmentInfo) => info?.method?.posthoc?.validation_sets?.[key]?.n;
const pilotLabel = (key,info) => ({passed:'시범 지표 · 방법 검증 통과'+(validationN(key,info)?`(${validationN(key,info)}종 비교)`:''),failed:'시범 지표 · 사후 검증 미통과'})[validationResult(key,info)]||'검증 전 시범 지표';
const validationNote = info => ' (사후 검증: '+['MFPI','MBPI','MCUI'].map(k=>k+' '+({passed:'통과',failed:'미통과'}[validationResult(k,info)]||'전')).join(' · ')+')';
function evidenceCoverage(s) {
  if(s.catalog&&s.audit){
    const a=s.audit;
    const checks=[
      {name:'학명',stage:'verified',detail:'WoRMS 승인명과 AphiaID 연결. 별도 GBIF 동의어는 원문 확인 뒤 연결.'},
      {name:'출현',stage:s.cells.length?'linked':s.review?.gbif.queried||s.review?.obis.queried?'found':'unavailable',
        detail:s.review?`${reviewLine(s.review)}. ${s.cells.length?'통과 기록만 공개 셀에 연결.':'공개 기준 통과 기록 없음 · 종 부재가 아님.'} 제외: ${withheldLine(s.review)}.`:`출현 ${releaseMissing(s)}.`},
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
    {name:'영양',stage:pilotScore(s,'MFPI')!==null?(validationResult('MFPI')==='passed'?'validated':'calculated'):foodLinked?'linked':foodRows.length||extras.length||nutrition.status==='available'?'found':'unavailable',
      detail:pilotScore(s,'MFPI')!==null?(validationResult('MFPI')==='passed'?`동기준 영양·가식부·양식 근거로 시범 MFPI를 산출했습니다. MFPI 방법은 같은 종의 일본 식품성분표 값으로 다시 계산해도 순위가 유지되는지 본 방법 검증(${validationN('MFPI')||'?'}종 비교)을 통과했습니다. 이 종의 값을 따로 검증한 것은 아닙니다.`:'동기준 영양·가식부·양식 근거로 검증 전 시범 MFPI를 산출했습니다.'):foodLinked?'종별 원값은 확인했으나 시료 상태·가식부·동일 기준 비교 또는 양식 근거가 부족해 MFPI는 보류합니다.':'영양 자료가 있더라도 이 종의 비교 가능한 원값인지 확인해야 합니다.'},
    {name:'생리활성',stage:pilotScore(s,'MBPI')!==null?(validationResult('MBPI')==='passed'?'validated':'calculated'):bioLinked?'linked':partial.length||compounds.status==='available'?'found':'unavailable',
      detail:pilotScore(s,'MBPI')!==null?`${bestBio(a)?.stratum_kind==='chembl'?`종→화합물 공개 연결(LOTUS·원논문)과 ChEMBL 같은 표적·종말점 비교집단으로 시범 MBPI를 산출했습니다(${bestBio(a).label}).`:'기원종·확정 구조·정량 실험·동일 층 비교집단을 검수해 시범 MBPI를 산출했습니다.'}${a.mbpi_label?` ${a.mbpi_label}: 독립 원논문 재현 전이라 BBVI에 쓰지 않습니다.`:''}`:partial.length?'논문 단서만으로는 기원종→확정 물질→정량 시험→동일 조건 비교집단을 모두 연결하지 못했습니다. MBPI는 보류합니다.':'화합물 건수나 시험 생물만으로 종의 정량 활성은 확인되지 않습니다.'},
    {name:'보전',stage:pilotScore(s,'MCUI')!==null?(validationResult('MCUI')==='passed'?'validated':'calculated'):conservation?.iucn_state==='assessed'?'linked':'unavailable',
      detail:nationalMcui(s)?`${iucnGlobalNote(s)}. 그래서 한국 국가생물적색자료집 등급으로 시범 MCUI를 산출했습니다. IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.`:substituteMcui(s)?`${iucnGlobalNote(s)}이고 한국 국가 평가도 없어, ${esc(mcuiBasisLabel(s))} 시범 MCUI를 산출했습니다. 공식 IUCN 평가가 아니며 IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.`:pilotScore(s,'MCUI')!==null?'검수된 IUCN 평가와 현행 여부를 확인해 독립적인 시범 MCUI를 산출했습니다.':conservation?.iucn_state==='not_in_red_list'?'IUCN을 검색했으나 이 종의 평가 레코드를 확인하지 못했습니다. 공식 NE 판정이 아닙니다.':'현행 평가의 등급·범위·평가일을 확인하기 전까지 MCUI를 보류합니다.'}
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
const coverageGuide='학명·출현·영양·생리활성·보전 자료를 원자료 발견 → 종 연결 → 원문 확인 → 시범 산출 → 방법 검증 통과 단계로 표시합니다. 단계는 완성률이나 근거 품질 점수가 아닙니다. 평가 검색 0건은 공식 미평가(NE)가 아닙니다.';

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
  const value=s.assessment?.scores?.[key];
  if(!Number.isFinite(value)||value<0||value>100)return null;
  // A held report BBVI stays held. The weight only re-mixes a BBVI the report itself found eligible.
  if(key==='BBVI' && VERIFIED.includes(s.assessment.report_version)){
    const food=s.assessment.scores.MFPI, bio=s.assessment.scores.MBPI;
    return s.assessment.score_status?.BBVI==='산출됨'&&Number.isFinite(food)&&Number.isFinite(bio)
      ? Math.round((bbviWeight*food+(1-bbviWeight)*bio)*10)/10 : null;
  }
  return value;
};
// One axis state for every view: comparison, detail, summary, popup, matrix, CSV and WebMCP.
// "조회 실패" (report not reached) and "기술 오류" (trace did not re-check) are never "산출 보류".
function axisState(s,key){
  const value=pilotScore(s,key);
  if(value!==null)return {value,kind:'scored',label:value.toFixed(1)};
  if(s.assessmentState==='lookup_failed')return {value,kind:'lookup_failed',label:'조회 실패'};
  if(s.assessmentState==='client_outdated')return {value,kind:'client_outdated',label:'새 버전 있음'};
  if(s.assessmentState==='technical_error'||s.assessment?.axis_errors?.[key])return {value,kind:'technical_error',label:'기술 오류'};
  return {value,kind:'withheld',label:s.assessment?.score_status?.[key]||'산출 보류'};
}
const axisStateNote={lookup_failed:'지표 보고서를 불러오지 못했습니다. 산출 보류가 아니며, 다시 불러오기로 재시도할 수 있습니다.',
  technical_error:'공개 보고서의 근거를 화면에서 다시 계산했을 때 맞지 않아 이 값을 숨겼습니다. 자료 부족에 따른 산출 보류와 다릅니다.',
  client_outdated:'지표 보고서가 이 화면 코드보다 새 버전입니다. 산출 보류나 기술 오류가 아니며, 페이지를 새로고침(F5)하면 최신 값이 보입니다.'};
const pilotCell = (s,key) => pilotScore(s,key)===null ? '<span class="pending">산출 보류</span>'
  : `${pilotScore(s,key).toFixed(1)}<small>시범 지표 · 타당성 미검증</small>`;

function verifiedFoodValid(a,report){
  if(a.scores.MFPI===null)return true;
  const f=a.food_trace, config=report.method?.nutrition, sources=report.sources||{};
  // The trace must name one fixed primary cohort, and its size must match the published cohort.
  const cohort=(report.comparison_cohorts||[]).find(c=>c.cohort_id===f?.cohort_id&&c.role==='primary');
  // 3.3: a species whose RDA row misses a component is ranked against the fixed cohort plus itself and never joins it.
  const sub=config?.substitutes, outside=f?.outside_cohort===true;
  if(outside&&!sub)return false;
  if(!f||!config||!cohort||!Number.isInteger(cohort.size)||cohort.size<3||f.cohort_species!==cohort.size||
     !['nutrient_weight','edible_fraction_weight','aquaculture_weight'].every(k=>
       Number.isFinite(config[k])&&config[k]>=0&&config[k]<=1)||
     Math.abs(config.nutrient_weight+config.edible_fraction_weight+config.aquaculture_weight-1)>1e-8||
     !Array.isArray(cohort.food_item_ids)||!Array.isArray(f.cohort_food_item_ids)||
     f.cohort_food_item_ids.length!==cohort.size||
     f.cohort_food_item_ids.some((id,i)=>id!==cohort.food_item_ids[i])||
     f.cohort_food_item_ids.includes(f.source_food_item_id)===outside||
     f.sample_state!=='raw'||f.basis!=='100 g edible portion'||!sources[f.source_id]||
     f.edible_fraction?.reviewed!==true||f.aquaculture?.reviewed!==true||
     typeof f.aquaculture.feasible!=='boolean')return false;
  let nutrient=0, own=0;
  const peers=outside?[...cohort.food_item_ids,f.source_food_item_id]:cohort.food_item_ids;
  // the species' own linked RDA row: a substitute only where that row is blank, its own value everywhere else
  const ownRow=outside?(f.observed_rows||[]).find(o=>o.linked&&o.food_item_id===f.source_food_item_id):null;
  if(outside&&!ownRow)return false;
  // 3.7: a component blank in the species' own row may be left out of the mean (listed, never 0) when enough remain
  const omitted=f.omitted_components||[];
  if(omitted.length&&(!outside||!Number.isInteger(config.minimum_components)||
     Object.keys(config.components||{}).length-omitted.length<config.minimum_components||
     omitted.some(k=>!(k in (config.components||{}))||f.nutrients?.[k]!==undefined||ownRow.values?.[k]!==null)))return false;
  for(const [name,unit] of Object.entries(config.components||{})){
    if(omitted.includes(name))continue;
    const n=f.nutrients?.[name], s=n?.substitute, sample=s?.taxon_level==='subsample', mext=s?.taxon_level==='mext';
    // 3.6: a MEXT 2020 same-species raw item (edible portion), only for the components the rule lists, at the rule's grade
    if(s&&(!outside||!sub.levels?.includes(s.taxon_level)||(!sample&&!mext&&!sub.parts?.includes(s.part))||s.label!==sub.labels?.[s.taxon_level]||
       !sources[s.source_id]||(mext&&(s.source_id!==sub.mext?.source_id||!sub.mext?.components?.includes(name)||s.part!=='edible portion'))||
       (sample?!['domestic_table','foreign_table_cited'].includes(n.grade)
         :n.grade!==(mext?sub.mext?.grade:s.taxon_level==='species'?sub.species_grade_by_doc?.[s.doc_code]||'proxy':'proxy'))))return false;
    // a sub-sample value is the mean of reviewed same-species rows of the same table
    if(sample){
      const ids=String(s.food_item_id).split('+'),vals=ids.map(id=>s.values?.[id]);
      if(!ids.every(id=>(sub.subsample_links||[]).some(l=>l.food_item_id===id&&l.aphia_id===a.aphia_id&&l.reviewed===true))||
         !vals.every(Number.isFinite)||Math.abs(vals.reduce((x,y)=>x+y,0)/vals.length-n.value)>1e-4)return false;
    }
    if(outside&&(s?ownRow.values?.[name]!==null:ownRow.values?.[name]!==n?.value))return false;
    own+=!s;
    if(!n||!Number.isFinite(n.value)||n.value<0||n.unit!==unit||
        !Number.isFinite(n.percentile)||!Number.isFinite(n.percentile_unrounded)||n.percentile_unrounded<0||n.percentile_unrounded>100||
        !Number.isFinite(n.evidence_factor)||!n.method||!Array.isArray(n.peer_values)||
        n.peer_values.length!==peers.length||!n.peer_values.every((p,i)=>
          p?.food_item_id===peers[i]&&Number.isFinite(p.value)&&p.value>=0)||
        n.peer_values.find(p=>p.food_item_id===f.source_food_item_id)?.value!==n.value||
        n.evidence_factor!==config.grade_factors?.[n.grade])return false;
    const values=n.peer_values.map(p=>p.value);
    const rank=100*(values.filter(v=>v<n.value).length+.5*values.filter(v=>v===n.value).length)/values.length;
    if(Math.abs(n.percentile_unrounded-rank)>1e-8||
       Math.abs(n.percentile-Math.round(rank*100)/100)>1e-8)return false;
    nutrient+=n.percentile_unrounded*n.evidence_factor;
  }
  if(!own)return false;  // a score never rests only on other foods' values
  // 3.9: a MEXT 2020 same-species raw item is the species' own row only when no RDA row is linked to it, at the MEXT grade
  const mextRow=f.row_table==='mext'&&!!sub?.mext?.species_row_groups&&f.source_id===sub.mext.source_id&&String(f.source_food_item_id).startsWith('MEXT:')&&
    (f.observed_rows||[]).filter(o=>o.linked).length===1&&f.edible_fraction?.source_id===sub.mext.source_id&&
    Object.values(f.nutrients||{}).every(n=>n.grade===sub.mext.grade&&!n.substitute);
  // after 3.12: a reviewed paper's analysis of the species (same-sample moisture) is its row only when neither RDA nor MEXT has one
  const lit=sub?.literature, litRow=f.row_table==='literature'&&!!lit?.species_row_groups&&(lit.source_ids||[]).includes(f.source_id)&&
    String(f.source_food_item_id).startsWith('LIT:')&&(f.observed_rows||[]).filter(o=>o.linked).length===1&&f.edible_fraction?.source_id===f.source_id&&
    Object.values(f.nutrients||{}).every(n=>n.grade===lit.grade&&!n.substitute);
  if(f.row_table!==undefined&&!mextRow&&!litRow)return false;
  if(outside&&!omitted.length&&own===Object.keys(config.components||{}).length&&!mextRow&&!litRow)return false;  // outside the cohort only because of a substitute, an omission, a MEXT or a literature row
  const fraction=f.edible_fraction;
  if(!Number.isFinite(fraction.value)||fraction.value<0||fraction.value>1||!sources[fraction.source_id]||
     !sources[f.aquaculture.source_id])return false;
  const expected=config.nutrient_weight*nutrient/(Object.keys(config.components).length-omitted.length)+
    100*config.edible_fraction_weight*fraction.value+100*config.aquaculture_weight*Number(f.aquaculture.feasible);
  return Math.abs(expected-a.scores.MFPI)<.06;
}
// 3.4: an OBIS decline signal adds the published adjustment to a computed MCUI; the class is re-derived from its counts.
function rateRatio(n,e,rule){
  const k=rule.continuity,ratio=((n.recent+k)/e.recent)/((n.past+k)/e.past),spread=Math.exp(rule.z*Math.sqrt(1/(n.past+k)+1/(n.recent+k)));
  return [ratio,ratio/spread,ratio*spread];
}
const near=(x,y)=>Number.isFinite(x)&&Math.abs(x-y)<=.0006;
function trendAdjustment(a,report){
  const t=a.occurrence_trend,rule=report.method?.conservation?.trend;
  if(!t)return rule?null:0;
  if(!rule)return null;
  const n=t.species_records,e=t.effort_records,counts=x=>[x?.species_records?.past,x?.species_records?.recent,x?.effort_records?.past,x?.effort_records?.recent];
  if(!counts(t).every(Number.isFinite))return null;
  let cls='undetermined';
  if(t.cells_compared>0&&n.past>=rule.min_past_records){
    const [ratio,low,high]=rateRatio(n,e,rule),all=t.all_taxa_sensitivity;
    if(!near(t.reporting_rate_ratio,ratio)||!near(t.ci?.[0],low)||!near(t.ci?.[1],high)||!near(t.effort_ratio,e.recent/e.past)||
       !counts(all).slice(2).every(Number.isFinite)||!near(all.reporting_rate_ratio,rateRatio(n,all.effort_records,rule)[0]))return null;
    // the dominant-dataset check: same formula on that dataset's species and class records
    const d=t.dataset_check;
    let confirms=false;
    if(d){
      const dn=d.species_records,de=d.effort_records;
      if(d.cells_compared>0&&dn?.past>=rule.min_past_records){
        if(!counts(d).every(Number.isFinite))return null;
        const [dr,dl,dh]=rateRatio(dn,de,rule);
        if(!near(d.reporting_rate_ratio,dr)||!near(d.ci?.[0],dl)||!near(d.ci?.[1],dh))return null;
        confirms=dr<=rule.decline_ratio&&dh<1;
      }
      if(d.confirms_decline!==confirms)return null;
    }
    cls=ratio<=rule.decline_ratio?(high<1&&confirms?'decline_signal':'undetermined')
      :high<1?'decline_below_threshold':n.recent<n.past&&e.recent<e.past?'survey_gap':'no_clear_decline';
  }
  if(cls!==t.class||t.label!==rule.labels?.[cls])return null;
  // the base is the published MCUI before the trend, so the shown '+10' always matches the score
  const adjust=cls==='decline_signal'&&t.mcui_base!==null?report.method.conservation.effort_adjustment:0;
  if(t.mcui_adjustment!==adjust)return null;
  if(t.mcui_base===null?a.scores.MCUI!==null:a.scores.MCUI!==Math.min(100,t.mcui_base+adjust))return null;
  return adjust;
}
function verifiedConservationValid(a,report){
  const adjust=trendAdjustment(a,report);
  if(adjust===null)return false;
  const sub=a.mcui_substitute, rule=report.method?.mcui_substitutes, r=sub?.record, t=rule?.thresholds;
  const sourced=()=>!!(sub.source_ids||[]).length&&sub.source_ids.every(id=>report.sources?.[id]);
  // 3.15 (team-lead decision 2026-10-02): reference only. A met Rapid LC check rides beside a withheld MCUI, re-checked against the
  // published thresholds; a record that carries a value, or a report that scores it, is refused.
  if(sub?.use==='reference_only')return a.scores.MCUI===null&&a.mcui_basis!=='preliminary'&&sub.value===null&&sub.basis==='preliminary'&&
    !!t&&sub.category===rule.preliminary_category&&sourced()&&r?.eoo_km2>t.eoo_km2&&r.aoo_km2>t.aoo_km2&&
    r.aoo_km2===r.aoo_cells*t.aoo_cell_km**2&&r.records>=t.records&&r.trend_class!=='decline_signal'&&
    // attached only where the builder may attach one (no IUCN or national assessment), with the thresholds and trend it was checked on
    (rule.applies_when_reason||[]).includes(a.withheld_reasons?.MCUI)&&a.conservation_trace?.iucn_state==='not_in_red_list'&&!a.national_assessment&&
    ['eoo_km2','aoo_km2','aoo_cell_km','records'].every(k=>r.thresholds?.[k]===t[k])&&(!a.occurrence_trend||r.trend_class===a.occurrence_trend.class)&&
    Array.isArray(r.native_box?.lat)&&Array.isArray(r.native_box?.lon);
  if(a.scores.MCUI===null)return true;
  const raw=report.method?.conservation?.category_scores||{};
  const scores=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Math.min(100,v+adjust)]));
  const substituted=a.mcui_basis==='range_state';
  const category=a.mcui_basis==='national'?a.national_assessment?.category:substituted?sub?.category:a.conservation_trace?.category;
  if(a.occurrence_trend&&a.occurrence_trend.mcui_base!==raw[category])return false;
  // After 3.14: another range state's national list (the only substitute basis that gives an MCUI).
  if(substituted)return !!sub&&!!rule&&sub.basis==='range_state'&&sourced()&&r?.reviewed===true&&!!r.country&&!!r.name_as_published&&
    r.category===sub.category&&scores[sub.category]===a.scores.MCUI;
  // National branch: a Korean national assessment is its own stratum, never mixed with global IUCN.
  if(a.mcui_basis==='national'){
    const n=a.national_assessment;
    return n?.reviewed===true&&/^national/.test(n.scope||'')&&!!report.sources?.[n.source_id]?.url&&
      Number.isInteger(n.list_page_printed)&&!!n.name_as_published&&n.scientific_name===a.scientific_name&&
      scores[n.category]===a.scores.MCUI;
  }
  const c=a.conservation_trace,check=c?.current_status_check;
  const checked=new Date((check?.checked_on||'')+'T00:00:00Z');
  return c?.reviewed===true&&check?.is_current===true&&!!report.sources?.[c.source_id]&&
    !!report.sources?.[check.source_id]&&/^\d{4}-\d{2}-\d{2}$/.test(check.checked_on||'')&&
    !Number.isNaN(checked.getTime())&&checked.toISOString().slice(0,10)===check.checked_on&&
    check.checked_on<=report.snapshot_date&&Number(check.checked_on.slice(0,4))>=c.assessment_year&&
    scores[c.category]===a.scores.MCUI;
}
function verifiedBioValid(a,report){
  if(a.scores.MBPI===null)return true;
  const items=a.bioactivity_trace, min=report?.method?.bioactivity?.minimum_compounds_per_stratum??3;
  if(!Array.isArray(items)||!items.length)return false;
  const common=x=>!!x.stratum_id&&Array.isArray(x.original_paper_dois)&&x.original_paper_dois.length>0&&
    Number.isFinite(x.percentile)&&x.percentile>=0&&x.percentile<=100&&Number.isFinite(x.evidence_factor)&&
    Number.isFinite(x.adjusted)&&Math.abs(x.percentile*x.evidence_factor-x.adjusted)<.06;
  // Peptides and small molecules are separate strata with separate identity fields; a trace never mixes them.
  const peptide=x=>x.stratum_kind==='peptide'&&typeof x.peptide_sequence==='string'&&/^[A-Z]+$/.test(x.peptide_sequence)&&
    Number.isInteger(x.peer_peptides)&&x.peer_peptides>=min&&Number.isFinite(x.pIC50);
  const compound=x=>x.stratum_kind===undefined&&!!x.compound_id&&Array.isArray(x.activity_ids)&&x.activity_ids.length>0&&
    Number.isInteger(x.peer_compounds)&&x.peer_compounds>=min;
  // 3.18 AMP stratum: one cohort per target bacterium, MIC only, so the item carries pMIC and its target, never a substrate.
  const ampRule3=report?.method?.amp_bioactivity;
  const amp=x=>!!ampRule3&&x.stratum_kind==='amp'&&typeof x.peptide_sequence==='string'&&/^[A-Z]+$/.test(x.peptide_sequence)&&
    Number.isInteger(x.peer_peptides)&&x.peer_peptides>=ampRule3.minimum_peptides&&Number.isFinite(x.pMIC)&&
    typeof x.target_species==='string'&&x.pIC50===undefined&&Array.isArray(x.measurements)&&x.measurements.length>0&&
    x.measurements.every(m=>m.endpoint===ampRule3.endpoint&&m.relation==='='&&m.unit==='uM'&&m.method===ampRule3.method&&
      m.target_species===x.measurements[0].target_species&&Number.isFinite(m.value)&&m.value>0&&
      report.sources?.[m.source_id]&&a.source_ids.includes(m.source_id))&&
    a.source_ids.includes(ampRule3.cohort_source_id);
  // 3.21 anticancer stratum: one cohort per cancer cell line, IC50 only, so the item carries pIC50 and its cell line.
  const antiRule3=report?.method?.anticancer_bioactivity;
  const anti=x=>!!antiRule3&&x.stratum_kind==='anticancer'&&typeof x.peptide_sequence==='string'&&/^[A-Z]+$/.test(x.peptide_sequence)&&
    Number.isInteger(x.peer_peptides)&&x.peer_peptides>=antiRule3.minimum_peptides&&Number.isFinite(x.pIC50)&&
    typeof x.cell_line==='string'&&x.pMIC===undefined&&Array.isArray(x.measurements)&&x.measurements.length>0&&
    x.measurements.every(m=>m.endpoint===antiRule3.endpoint&&m.relation==='='&&m.unit==='uM'&&
      antiRule3.accepted_methods.includes(m.method)&&m.cell_line===x.measurements[0].cell_line&&
      Number.isFinite(m.value)&&m.value>0&&report.sources?.[m.source_id]&&a.source_ids.includes(m.source_id))&&
    a.source_ids.includes(antiRule3.cohort_source_id);
  const replicated=x=>x.independent_dois===undefined||Array.isArray(x.independent_dois)&&Array.isArray(x.potency_replications)&&
    [...mbpiDois(x)].sort().join()===[...new Set([...x.original_paper_dois,...x.potency_replications.filter(r=>r.used).map(r=>r.original_paper_doi)]
      .map(d=>d.toLowerCase()))].sort().join()&&x.potency_replications.every(r=>!r.used||report.sources?.[r.source_id]?.url&&a.source_ids.includes(r.source_id));
  // 3.1 ChEMBL stratum: link factor (species-link DOIs) x activity factor (ChEMBL documents), cohort of at least the minimum records.
  const rule3=report?.method?.chembl_bioactivity, bio=report?.method?.bioactivity||{};
  const docFactor=n=>n===1?bio.single_doi_factor:bio.multiple_doi_factor;
  const chembl=x=>!!rule3&&x.stratum_kind==='chembl'&&!!x.compound_id&&!!x.target_chembl_id&&!!x.standard_type&&x.label===rule3.label&&
    !!rule3.strata?.[x.chembl_stratum]&&Array.isArray(x.activity_ids)&&x.activity_ids.length>0&&
    Array.isArray(x.document_chembl_ids)&&x.document_chembl_ids.length>0&&Number.isInteger(x.cohort_records)&&x.cohort_records>=rule3.minimum_cohort_records&&
    x.link_factor===docFactor(mbpiDois(x).size)&&x.activity_factor===docFactor(new Set(x.document_chembl_ids).size)&&
    Math.abs(x.link_factor*x.activity_factor-x.evidence_factor)<1e-9&&
    x.independent_sources===Math.min(mbpiDois(x).size,new Set(x.document_chembl_ids).size)&&rule3.source_ids.every(id=>a.source_ids.includes(id))&&
    (!rule3.link_review||x.link_review==='accepted');
  if(items.some(x=>!common(x)||!(peptide(x)||compound(x)||chembl(x)||amp(x)||anti(x))||!replicated(x)))return false;
  // Peptides and reviewed compounds never share a trace; 3.1 adds the ChEMBL stratum beside either, 3.18 the AMP one and
  // 3.21 the anticancer one, and MBPI is the max over strata.
  if(new Set(items.filter(x=>!['chembl','amp','anticancer'].includes(x.stratum_kind)).map(x=>x.stratum_kind||'compound')).size>1)return false;
  if(Math.abs(a.scores.MBPI-Math.max(...items.map(x=>x.adjusted)))>=.06)return false;
  if(singleSourceRule(report.method_version)){
    const rule=report.method?.bbvi, best=bestBio(a);
    if(!Number.isInteger(rule?.minimum_independent_mbpi_dois)||rule.minimum_independent_mbpi_dois<2||
       !rule.single_source_mbpi_label)return false;
    const papers=mbpiSources(best);
    if(a.mbpi_label!==(papers<rule.minimum_independent_mbpi_dois?rule.single_source_mbpi_label:null))return false;
  }
  return true;
}
// Shared-source faults hide the whole species (null). Otherwise each axis is re-checked on its own:
// a failed axis is hidden alone, and a failed MFPI or MBPI also takes the dependent BBVI.
function verifiedAxisErrors(a,report){
  if(!a?.scores||!a.score_status||!Array.isArray(a.source_ids)||!a.source_ids.every(id=>report.sources?.[id]?.url))return null;
  const errors=['MFPI','MBPI','MCUI','BBVI'].filter(k=>!(a.scores[k]===null||
      Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100)||(a.scores[k]!==null)!==(a.score_status[k]==='산출됨'));
  const check=(k,valid)=>{if(errors.includes(k))return;try{if(!valid())errors.push(k);}catch{errors.push(k);}};
  const w=report.food_weight;
  check('MFPI',()=>verifiedFoodValid(a,report));
  check('MBPI',()=>verifiedBioValid(a,report));
  check('MCUI',()=>verifiedConservationValid(a,report));
  check('BBVI',()=>{
    if(a.scores.BBVI===null)return true;
    if(!Number.isFinite(a.scores.MFPI)||!Number.isFinite(a.scores.MBPI)||
       Math.abs(a.scores.BBVI-(w*a.scores.MFPI+(1-w)*a.scores.MBPI))>.06)return false;
    if(singleSourceRule(report.method_version)){
      const best=bestBio(a);
      const minimum=report.method?.bbvi?.minimum_independent_mbpi_dois;
      return Number.isInteger(minimum)&&best&&
        mbpiSources(best)>=minimum;
    }
    return true;
  });
  if(errors.some(k=>k==='MFPI'||k==='MBPI')&&!errors.includes('BBVI'))errors.push('BBVI');
  return errors;
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
// A data file in a known format with a higher version than this code was written for (a tab left open across a
// deploy, or a cached app.js) is not broken data. Unknown or malformed versions stay errors.
function newerVersion(value,known,prefix){
  const parts=v=>typeof v==='string'&&v.startsWith(prefix)&&/^\d+(\.\d+)*$/.test(v.slice(prefix.length))?v.slice(prefix.length).split('.').map(Number):null;
  const a=parts(value),b=parts(known);
  if(!a||!b)return false;
  for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);
  return false;
}
// One sessionStorage key per file: each file and version reloads the page at most once per tab. A storage error
// counts as already tried, so the page never loops; it then shows "새 버전 있음" instead.
function firstSeen({file,version}){
  try{const key='reload:'+file,seen=sessionStorage.getItem(key)===String(version);sessionStorage.setItem(key,String(version));return !seen;}
  catch{return false;}
}
// All gates report first; a single reload then fetches the new app.js for every newer file at once.
function reloadOnceForNewData(outdated){
  if(!outdated.map(firstSeen).includes(true))return false;
  location.reload();
  return true;
}
// matrix-readiness.json schema 1 is read; a higher integer schema is newer data; anything else is ignored.
function readinessRows(readiness,outdated){
  if(Number.isSafeInteger(readiness?.schema_version)&&readiness.schema_version>1)outdated.push({file:'matrix-readiness.json',version:readiness.schema_version});
  return new Map(readiness?.schema_version===1&&Array.isArray(readiness.species)?readiness.species.map(row=>[row.aphia_id,row]):[]);
}
async function attachPilotAssessments(next) {
  // "조회 실패": the report was not reached or not readable. "기술 오류": it was read but did not re-check.
  // Both differ from "산출 보류", which the report itself states for missing evidence.
  const failed=state=>{for(const s of next.species)s.assessmentState=state;};
  let response;
  try { response=await fetch('assessments.json',{cache:'no-store'}); } catch { failed('lookup_failed'); return; }
  if(!response.ok){ failed('lookup_failed'); return; }
  let report;
  try { report=await response.json(); } catch { failed('lookup_failed'); return; }
  try {
    if(newerVersion(report.method_version,VERIFIED.at(-1),'verified-pilot-')){
      (next.outdated??=[]).push({file:'assessments.json',version:report.method_version});failed('client_outdated');return;
    }
    const verified=VERIFIED.includes(report.method_version);
    if(!['pilot-1',...VERIFIED].includes(report.method_version)||report.status!=='provisional_unvalidated'||!Array.isArray(report.species)){ failed('technical_error'); return; }
    const rows=[...report.species,...(verified&&Array.isArray(report.candidate_species)?report.candidate_species:[])];
    const byId=new Map(rows.map(s=>[s.aphia_id,s]));
    if(byId.size!==rows.length){ failed('technical_error'); return; }
    for(const s of next.species){
      let a=byId.get(s.aphiaID);
      if(!a)continue; // not in the report: the species simply has no assessment row
      // Identity faults (wrong name, operating/candidate swap, missing score block) hide the whole species.
      if(a.scientific_name!==s.name||!a.scores||!Array.isArray(a.source_ids)||
         !!s.catalog!==(a.candidate_label==='조사 후보')){ s.assessmentState='technical_error'; continue; }
      if(verified){
        const errors=verifiedAxisErrors(a,report);
        if(!errors){ s.assessmentState='technical_error'; continue; }
        s.assessment={...a,scores:{...a.scores,...Object.fromEntries(errors.map(k=>[k,null]))},
          axis_errors:Object.fromEntries(errors.map(k=>[k,'technical_error'])),report_version:report.method_version};
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
      sources:report.sources,method:report.method,cohort:report.comparison_cohort,cohorts:report.comparison_cohorts||[],version:report.method_version,
      chemblCommonLimit:report.chembl_common_taxon_limit};
  } catch { failed('technical_error'); /* A malformed optional report must not hide the underlying species evidence. */ }
}

// A species score does not establish a spatial decision. There is no reviewed
// cell-level join, sampling-effort adjustment or comparison cohort in the public data.
function cellAssessmentStatus(s,c) {
  const reasons=[];
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
      'CC BY 4.0':'https://creativecommons.org/licenses/by/4.0/','CC BY-NC 4.0':'https://creativecommons.org/licenses/by-nc/4.0/',
      '공공누리 제3유형':'https://www.kogl.or.kr/info/licenseType3.do'}[l],l)).join(' · ')||'이용조건 미확인';
    return `<li>${sourceLink(x.url,x.title||'제공처 원문')} · ${terms}</li>`;
  }).join('');
}
function mapJudgmentStatus(s) {
  const n=spatialCells(s).length,type=matrixType(s);
  if(matrixRule()){
    $('map-judgment').textContent=(type?`이 종의 매트릭스 유형: ${matrixTypeLabel(type)}${separateMcui(s)?'(MCUI '+mcuiBasisLabel(s)+')':''}`:'이 종은 BBVI·MCUI 한 쌍이 없어 매트릭스 유형이 없습니다')+
      (!s.cells?.length?' · 공개 출현 셀이 없어 활용 × 보전 지도에 반영되지 않습니다.':type?` · 활용 × 보전 지도에서 이 종이 기록된 ${n}개 셀 색에 반영됩니다(해역 점수 아님).`:` · 표시된 ${n}개 셀은 이 종 기준으로 판단 보류.`);
    return;
  }
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
  if(pilotScore(s,'BBVI')===null)reasons.BBVI=
    scoreReason[s.assessment?.withheld_reasons?.BBVI]||'MFPI와 MBPI가 모두 산출되어야 계산 가능.';
  // A verified report's own withheld reason outranks the operating profile's older 미수집/미검토 (published before the report).
  const told=VERIFIED.includes(s.assessment?.report_version)?s.assessment.withheld_reasons||{}:{};
  for(const k of ['MFPI','MBPI','MCUI'])if(reasons[k]&&scoreReason[told[k]])reasons[k]=scoreReason[told[k]];
  return reasons;
}
// verified-pilot-3.2 places a national MCUI too (marked apart); older reports keep it off the IUCN matrix.
const matrixRule=()=>data?.assessmentInfo?.method?.matrix||null;
function assessedForMatrix(s){
  return ['MFPI','MBPI','MCUI','BBVI'].every(k=>pilotScore(s,k)!==null)&&(!nationalMcui(s)||!!matrixRule()?.include_national_mcui)&&(!substituteMcui(s)||(matrixRule()?.include_substitute_mcui||[]).includes(s.assessment.mcui_basis));
}
// Type from the on-screen BBVI (slider weight) and MCUI; the report's thresholds, a value at the threshold is high.
function matrixType(s){
  const rule=matrixRule();
  if(!rule||!assessedForMatrix(s))return null;
  const key=(pilotScore(s,'BBVI')>=rule.bbvi_threshold?'high':'low')+'_bbvi_'+(pilotScore(s,'MCUI')>=rule.mcui_threshold?'high':'low')+'_mcui';
  return rule.types?.[key]?.id||null;
}
const matrixTypeLabel=id=>Object.values(matrixRule()?.types||{}).find(t=>t.id===id)?.label||id;
// A Korean national-assessment MCUI is its own stratum: labelled apart and never ranked or plotted with IUCN-based MCUI.
const nationalMcui = s => s?.assessment?.mcui_basis==='national'&&pilotScore(s,'MCUI')!==null;
// After 3.14: another range state's national list. Like the Korean national basis, it is its own stratum: labelled, drawn with
// the separate matrix marker and never ranked or pooled with IUCN-based MCUI.
const substituteMcui = s => s?.assessment?.mcui_basis==='range_state'&&pilotScore(s,'MCUI')!==null;
const separateMcui = s => nationalMcui(s)||substituteMcui(s);
const mcuiBasisLabel = s => nationalMcui(s)?'한국 국가 평가 기반':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||'서식국'} 국가 평가 기반`:'IUCN 기반';
const mcuiBasisShort = s => nationalMcui(s)?'국가 평가':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||'서식국'} 평가`:'';
// 3.15 (team-lead decision 2026-10-02): reference only. A met Rapid LC check is shown beside the withheld MCUI like the BBVI
// 참고값; it stays out of scores.MCUI, the matrix, the map colours and every ranking.
const mcuiReference = s => s?.assessment?.scores?.MCUI===null&&!s.assessment.axis_errors?.MCUI&&s.assessment.mcui_substitute?.use==='reference_only'?s.assessment.mcui_substitute:null;
const rapidLcCheck = () => ({passed:'역검증 통과',failed:'역검증 미통과'})[data?.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary?.result]||'';
// the national branch also covers IUCN categories without a pilot number (DD), so say which case applies
const iucnGlobalNote = s => {const c=s.assessment?.conservation_trace;return c?.category?`IUCN 전 지구 ${c.category}(${c.assessment_year||'평가연도 미기재'}) · 시범 숫자 없음`:'IUCN 전 지구 평가 미확인';};
// Computed values first, then the axes still on hold: "MFPI 65.5 · MBPI·MCUI 보류".
function scoreSummary(s){
  const keys=['MFPI','MBPI','MCUI'], held=keys.filter(k=>pilotScore(s,k)===null);
  return [...keys.filter(k=>!held.includes(k)).map(k=>`${k}${k==='MCUI'&&separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${pilotScore(s,k).toFixed(1)}${k==='MBPI'&&s.assessment?.mbpi_label?' ('+s.assessment.mbpi_label+')':''}`),held.length?held.join('·')+' 보류':''].filter(Boolean).join(' · ');
}
// Follow-up tasks are an evidence-gap inventory, never a value or urgency rank.
// Refuse stale, wrong-taxon or score-inconsistent readiness rows.
function followupDecision(s){
  if(!s)return null;
  const row=matrixReadiness.get(s.aphiaID);
  if(!row||row.scientific_name!==s.name||row.scope!==(s.catalog?'expansion_22':'operating_8'))return null;
  // BBVI is compared with the report value: the on-screen weight may re-mix an eligible BBVI.
  if(['MFPI','MBPI','MCUI','BBVI'].some(k=>row.scores?.[k]!==(k==='BBVI'?s.assessment?.scores?.BBVI??null:pilotScore(s,k))))return null;
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
    '<details class="followup-brief"><summary>다음 조사 과제</summary><div class="detail-more-body"><h3>현재 판단 가능 범위 · 보류 이유 · 다음 조사</h3>'+
    '<p><b>현재 판단 가능 범위:</b> '+esc(plan.known.length?plan.known.map(k=>k+'('+pilotLabel(k)+')').join(' / ')+'만 축별로 해석':'산출된 시범 지표 없음')+
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
    return `<button type="button" class="decision-card" data-aphia="${s.aphiaID}" aria-controls="decision-detail"><strong>${esc(s.label)}</strong><em>${esc(s.name)} · AphiaID ${s.aphiaID}</em><span>${ready?(matrixType(s)?esc(matrixTypeLabel(matrixType(s)))+' · ':'')+pilotLabel('BBVI')+' · 근거 확인':esc(scoreSummary(s))}</span></button>`;
  }).join('');
  list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>showDecision(data.species.find(s=>s.aphiaID===Number(b.dataset.aphia)))));
  panel.textContent='종을 선택하면 산출 여부, 부족한 입력과 확인 가능한 원문을 볼 수 있습니다.';
}
function showDecision(s){
  if(!s)return;
  $('decision-list').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.aphia)===s.aphiaID)));
  const a=s.assessment, info=data.assessmentInfo||{}, reasons=assessmentBlockers(s), study=CASE_NOTES[s.aphiaID];
  let html=`<h3>${esc(s.label)} · 실제 종 근거</h3><p class="fine">${esc(s.name)} · AphiaID ${s.aphiaID} · ${a?'시범 지표'+esc(validationNote(info)):esc(axisState(s,'MFPI').kind==='withheld'?'산출 보류':axisState(s,'MFPI').label)}</p>`;
  for(const k of ['MFPI','MBPI','MCUI','BBVI']){
    const st=axisState(s,k);
    html+=`<div class="decision-axis"><b>${k}: ${st.value===null?esc(st.label):st.value.toFixed(1)+' / 100'}</b><p>${esc(axisStateNote[st.kind]||reasons[k]||'검수된 입력을 사용한 시범 산출값 · '+({passed:'방법 검증 통과',failed:'사후 검증 미통과'}[validationResult(k,info)]||'외부 사례 검증 전')+'.')}</p></div>`;
  }
  const plan=followupDecision(s);
  if(plan){
    const date=s.catalog?data.readinessCandidateDate:data.readinessAssessmentDate;
    html+='<section class="followup-panel"><h4>현재 판단 가능한 범위</h4>'+
      '<p>'+esc(plan.known.length?'산출 지표: '+plan.known.map(k=>k+'('+pilotLabel(k,info)+')').join(' / ')+' (축별로만 해석)':'시범 산출 지표 없음. 확인된 원자료의 연결 상태만 설명 가능')+
      '. BBVI×MCUI 종합 배치 '+(pilotScore(s,'BBVI')!==null&&pilotScore(s,'MCUI')!==null?'시범 조건 충족':'보류')+'. 출현 셀은 분포·개체수·자원량 또는 해역 가치가 아닙니다.</p>'+
      '<h4>판단 보류 이유</h4><p>'+esc(plan.blocked.length?plan.blocked.map(k=>k==='MBPI'?k+' '+(plan.row.bioactivity_missing_steps||[]).map(x=>matrixReasonLabel[x]||x).join('·'):k+' '+(matrixReasonLabel[plan.row.axis_reasons?.[k]]||plan.row.axis_reasons?.[k]||'필수 근거 미충족')).join(' / '):'축별 시범 산출 가능. 실행 권고는 별도 검증 필요')+'</p>'+
      '<h4>다음 조사 · 순위 아님</h4><dl>'+
      '<dt>연구기관</dt><dd>'+plan.research.map(esc).join('<br>')+'</dd>'+
      '<dt>정부·보전기관</dt><dd>'+plan.conservation.map(esc).join('<br>')+'</dd>'+
      '<dt>기업의 검토 과제</dt><dd>'+esc(plan.industry)+'</dd></dl>'+
      '<p class="fine">근거 수준: '+(plan.known.length?esc('시범 지표 일부'+validationNote(info))+' · ':'')+'나머지 축은 보류 · '+esc(s.catalog?'조사 후보':'운영 발행 종')+
      ' · 자료 스냅샷 '+esc(date||'미확인')+' · 제안 표시일 '+esc(data.readinessAssessmentDate||'미확인')+
      ' · 비교집단/비용/실행가능성 기준으로 순위를 매기지 않았습니다.</p>'+
      '<h4>연결된 조회 출처 · 각 축의 원문·이용조건은 아래 참조</h4><ul>'+plan.sourceUrls.map(url=>'<li>'+sourceLink(url,url.split('/')[2]+' ↗')+'</li>').join('')+'</ul></section>';
  }else html+='<p class="fine">검수 상태 파일과 종명·AphiaID·축별 값의 연결을 확인하지 못해 후속조사 제안을 보류합니다.</p>';
  if(a){
    const f=pilotScore(s,'MFPI')!==null?a.food_trace:null;
    if(f){
      html+='<h4>MFPI 구성</h4><ul>';
      for(const [key,n] of Object.entries(f.nutrients||{})){
        html+=`<li>${esc(key)}: 가식부 100 g당 ${esc(num(n.value))} ${esc(n.unit)} · ${esc(n.grade)}${n.substitute?' · '+esc(n.substitute.label)+' '+esc(substituteRef(n.substitute)):''} · 동기준 비교 ${esc((n.peer_values||n.peers)?.length)}개 식품 · 백분위 ${esc(n.percentile??'미기재')} · ${esc(n.substitute?.source_id||n.source_id||f.source_id)}</li>`;
      }
      html+=`<li>가식부 비율 ${esc(f.edible_fraction?.value)} (${esc(f.edible_fraction?.source_id)}) · 양식 근거 ${f.aquaculture?.feasible?'가능성 검토됨':'불충분'} (${esc(f.aquaculture?.source_id)})</li></ul>`;
    }
    if(pilotScore(s,'MBPI')!==null&&a.bioactivity_trace?.length){
      html+='<h4>MBPI 구성</h4><ul>';
      for(const b of a.bioactivity_trace){
        // pilot-1 traces name the stratum as [target, assay] and a ChEMBL median; verified reports name a stratum id.
        if(!b.stratum_id){html+=`<li>${esc(b.compound_id)} · 표적 ${esc(b.stratum?.[0])}, assay ${esc(b.stratum?.[1])} · 중앙 pChEMBL ${esc(b.median_pchembl)} · 비교 화합물 ${esc(b.peer_count)}개 · 백분위 ${esc(b.rank)} · 독립 문헌 ${esc(b.independent_references)}건 · 근거 계수 ${esc(b.evidence_factor)} · ${esc((b.reference_ids||[]).join(', '))}</li>`;continue;}
        const m=(b.measurements||[])[0], {name,raw}=bioItemHtml(b);
        html+=`<li>${name} · 비교 코호트 ${esc(b.stratum_id)} `+
          `(${b.stratum_kind==='chembl'?`${esc(b.stratum_label)} · 활성 기록 ${esc(b.cohort_records)}건`:esc(b.peer_compounds??b.peer_peptides)+'개'}) · ${m?`원값 ${raw} · `:''}백분위 ${esc(b.percentile)} × 근거 계수 ${esc(b.evidence_factor)} = ${esc(Math.round(b.adjusted*10)/10)} · 원논문 ${esc((b.original_paper_dois||[]).join(', '))}</li>`;
      }
      html+='</ul>';
    }
    const c=a.conservation_trace;
    if(c)html+=`<h4>MCUI 구성</h4><p>${a.mcui_basis==='national'?`한국 국가 평가 기반 시범 MCUI · ${esc(a.national_assessment?.category)} · 국가생물적색자료집 2024 ${esc(a.national_assessment?.list_page_printed)}쪽 · 전 지구 IUCN과 비교하지 않음 · `:''}IUCN ${esc(c.category||'미확인')} · 평가 ${esc(c.assessment_year||'미확인')} · 출처 ${esc(c.source_id||'미확인')}${a.iucn_review_older_than_10y?' · 10년 초과 평가':''} · 현행 평가 ${pilotScore(s,'MCUI')===null||a.mcui_basis==='national'?'확인 보류':`확인 ${esc(c.current_status_check?.checked_on??c.current_status_checked_on)} (${esc(c.current_status_check?.source_id??c.current_status_source_id)})`}. ${c.obis_trend?`노력 보정 추세 ${esc(c.obis_trend.direction)} (${esc(c.obis_trend.source_id)})`:'출현기록만으로 추세 보정하지 않음.'}</p>`;
    html+=`<h4>계산과 기준일</h4><p>MFPI: 영양 백분위·등급 80%, 가식부 10%, 양식 근거 10%. MBPI: 층마다 따로 매긴 백분위 × 근거 계수. ChEMBL 화합물은 같은 표적·같은 종말점(IC50·Ki 등) 활성 기록 안에서, ACE 저해 펩타이드는 AHTPDB ACE IC50(HHL 기질) 고정 비교집단 안에서 pIC50으로, 항균 펩타이드는 액체배지 미량희석 MIC를 pMIC = 6 − log10(MIC µM)로 바꿔 표적 세균별 DBAASP 고정 비교집단(액체배지 MIC) 안에서, 항암 펩타이드는 세포 생존 시험 IC50을 pIC50 = 6 − log10(IC50 µM)로 바꿔 암세포주별 CancerPPD 2.0 고정 비교집단 안에서, 감태 분리 화합물은 같은 논문·같은 시험 조건 안에서 순위를 매깁니다. 층끼리는 섞어 비교하지 않고, 종의 MBPI는 모든 층 항목 가운데 가장 높은 값입니다. BBVI: MFPI ${esc(info.foodWeight*100)}% + MBPI ${esc((1-info.foodWeight)*100)}%. MCUI는 별도 축. 산출 ${esc(info.generatedAt||'미기재')}. 가중치는 검증 전이며 점수는 시범값입니다${esc(validationNote(info))}.</p>`;
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
    return '<h3>식량 가능성 · '+pilotLabel('MFPI')+'</h3>'+trace+
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
  assessment_lookup_failed:'IUCN 조회 실패',category_not_numeric:'IUCN DD · 숫자 없음',requires_MFPI_and_MBPI:'MFPI·MBPI 둘 다 필요',
  mbpi_single_source:'MBPI 단일 논문 · BBVI 보류'};
// Conservation as the verified report reviewed it, for the chip and cell line that otherwise read the older profile status.
const reportConservation=s=>{
  const a=VERIFIED.includes(s.assessment?.report_version)?s.assessment:null;
  if(!a?.conservation_trace?.reviewed)return null;
  const v=pilotScore(s,'MCUI');
  return v!==null?`시범 MCUI${separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${v.toFixed(1)}`:shortReason[a.withheld_reasons?.MCUI]||'MCUI 산출 보류';
};
const scoreReason={
  comparable_nutrition_missing:'같은 시료 상태의 고정 영양 비교집단에 이 종의 행이 없습니다.',
  food_row_not_species_specific:'식품성분표 행이 종 수준으로 확인되지 않아(예: 일반명 “해삼”) 이 종의 값으로 쓰지 않습니다.',
  component_missing_in_source:'원자료에 필수 성분이 모자랍니다(3.6까지 단백질·철·아연 모두, 3.7부터 칼슘을 더한 4개 중 3개 이상). 빈칸은 0이 아니라 결측입니다.',
  species_edible_yield_unverified:'이 종의 원자료 가식부 비율을 검증하지 못했습니다.',
  aquaculture_method_unverified:'지역·시기·방법이 확인된 양식 근거가 부족합니다.',
  compound_origin_assay_chain_or_fixed_cohort_missing:'기원종·구조·시험값·원논문을 완결해 연결한 비교집단이 없습니다.',
  original_assessment_not_reviewed:'IUCN 기록을 찾았지만 원평가를 검수하지 못했습니다.',
  not_in_red_list:'IUCN 적색목록 2026-1에서 이 종(및 확인한 동의어)의 평가를 찾지 못했습니다. IUCN이 부여한 공식 NE 범주나 낮은 점수가 아닙니다.',
  assessment_lookup_failed:'IUCN 평가 조회에 실패했습니다. 평가가 없다는 뜻이 아닙니다.',
  category_not_numeric:'DD(정보 부족) 등 시범 숫자 매핑이 없는 범주입니다. 낮은 점수로 바꾸지 않습니다.',
  assessment_not_current:'확인한 평가가 현행 평가가 아닙니다.',
  current_status_unverified:'현행 IUCN 평가 여부를 확인하지 못했습니다.',
  requires_MFPI_and_MBPI:'기본 통합 BBVI에는 MFPI와 MBPI 두 축이 모두 필요합니다.',
  mbpi_single_source:'MBPI 최고 항목을 뒷받침하는 독립 원논문이 두 편 미만이라 BBVI 통합을 보류합니다. 다른 DOI라도 같은 실험의 재사용인지 원문에서 확인해야 합니다.'
};
const nutrientNames={protein_g:'단백질',iron_mg:'철',zinc_mg:'아연',calcium_mg:'칼슘'};
function verifiedSource(id,label){
  const src=data?.assessmentInfo?.sources?.[id];
  return src?sourceLink(src.url,label||src.title||id):esc(label||id||'출처 미확인');
}
function observedRows(f){
  return (f.observed_rows||[]).map(o=>`<div class="score-fact"><b>${esc(o.reported_food_name)} · ${esc(o.food_item_id)}${o.linked?'':' · 종 연결 안 함'}</b>`+
    `<span>${Object.entries(nutrientNames).map(([k,label])=>`${label} ${o.values[k]===null?'결측(빈칸)':esc(o.values[k])+' '+(k==='protein_g'?'g':'mg')}`).join(' · ')}`+
    ` / 100 g 가식부 · 폐기율 ${o.refuse_pct===null?'결측':esc(o.refuse_pct)+'%'} · 출처 표기 ${esc(o.row_source||'없음')}</span></div>`+
    `<p class="fine">${esc(o.link_evidence||'')} ${o.source_id?verifiedSource(o.source_id,String(o.food_item_id).startsWith('LIT:')?'원논문 ↗':'일본 식품성분표 2020(8정판) ↗'):verifiedSource('rda_db_10_4','RDA 식품성분 DB 10.4 ↗')}`+
    `${o.link_source_id?' · 종 연결 근거 '+verifiedSource(o.link_source_id,'국가 생물종·식품원료 목록 ↗'):''}</p>`).join('');
}
// Display only: four significant digits (the trace keeps the source value).
const num=v=>Number.isFinite(v)?String(Number(v.toPrecision(4))):v;
const substituteRef=s=>(s.taxon_level==='subsample'?'RDA ':s.taxon_level==='mext'?'MEXT 8정판 ':'uFiSh1.0 ')+s.food_item_id;
function substituteText(s){
  return s.taxon_level==='subsample'
    ?`<b>${esc(s.label)}</b>: 이 종의 연결 RDA 행에 값이 없어, 같은 표에서 같은 종의 부표본 행 ${esc(Object.entries(s.values||{}).map(([id,v])=>id+' '+num(v)).join(', '))}`+
      `(${esc(s.food_name)})의 ${s.n>1?'평균':'값'}을 썼습니다. 이 부표본 행들은 고정 비교집단에 넣지 않습니다. ${verifiedSource(s.source_id,'RDA ↗')}`
    :s.taxon_level==='mext'
    ?`<b>${esc(s.label)}</b>: 이 종의 연결 RDA 행과 uFiSh에 같은 종 값이 없어 일본 식품성분표 2020(8정판) ${esc(s.food_item_id)} ${esc(s.food_name)}`+
      `(${esc(s.taxon_label)}, 가식부 100 g)의 값을 썼습니다. 종 연결: ${esc(s.link_evidence||'')} ${verifiedSource(s.source_id,'MEXT ↗')}`
    :`<b>${esc(s.label)}</b>: 이 종의 연결 RDA 행에 값이 없어 FAO/INFOODS uFiSh1.0 ${esc(s.food_item_id)} `+
      `${esc(s.food_name)}(${esc(s.taxon_label)}, 섭취 부위 ${esc(s.part)}, 문서 코드 ${esc(s.doc_code||'없음')}, n ${esc(s.n??'미기재')})의 값을 썼습니다. `+
      `${verifiedSource(s.source_id,'uFiSh ↗')}`;
}
// The evidence files keep reasons in English (research notes); the page shows them in Korean. A reason missing here
// prints as written, and verification/test_detail_render.mjs reports it.
const REASON_KO={
  "Extract and purchased standard cannot be linked as one species-derived single compound activity.":"추출물과 구입한 표준품의 결과를 이 종에서 나온 단일 화합물의 활성 하나로 연결할 수 없습니다.",
  "No confirmed CID/InChIKey to assay chain; MIC/MFC cannot be converted to IC50.":"CID/InChIKey부터 시험까지 확인된 연결이 없고, MIC/MFC는 IC50으로 환산할 수 없습니다.",
  "Single-concentration viability is not pChEMBL.":"단일 농도 세포 생존율은 pChEMBL 값이 아닙니다.",
  "Structure ID, tabulated IC50 and producing organism are not established.":"구조 식별, 표로 제시된 IC50, 생산 생물이 확인되지 않았습니다.",
  "A real isolated-peptide IC50 is available, but an exact public structure join and comparable fixed cohort are not yet verified; do not mix peptides with small molecules.":"분리 펩타이드의 실측 IC50은 있지만, 공개 구조와의 정확한 연결과 비교 가능한 고정 비교집단을 아직 확인하지 못했습니다. 펩타이드와 저분자 화합물은 섞지 않습니다.",
  "Whole-extract animal outcomes cannot be assigned to a single compound or converted to pChEMBL.":"추출물 전체로 얻은 동물 실험 결과는 단일 화합물에 돌리거나 pChEMBL로 환산할 수 없습니다.",
  "Dried product is not comparable with the frozen raw/fresh seaweed MFPI cohort; the product's zero refuse is not a verified yield of fresh Gelidium elegans. No wet-weight conversion or cohort reassignment.":"건조 제품은 냉동·생 해조류로 이루어진 MFPI 비교집단과 비교할 수 없습니다. 제품의 폐기율 0은 생 우뭇가사리(Gelidium elegans)에서 확인한 가식부 비율이 아닙니다. 습중량 환산이나 비교집단 변경은 하지 않았습니다.",
  "Quantified fraction effects and qualitative single-compound observations are not an eligible compound-level MBPI input.":"분획의 정량 효과와 단일 화합물의 정성 관찰은 화합물 단위 MBPI 입력 조건에 맞지 않습니다.",
  "Paper-local IC50 is real but incomplete source-taxonomy and exact-molecule joins and no comparable assay cohort prohibit MBPI; cell viability is not proof of clinical efficacy.":"논문에 실린 IC50은 실측값이지만, 기원 분류와 정확한 분자 연결이 불완전하고 비교 가능한 시험 비교집단이 없어 MBPI에 쓸 수 없습니다. 세포 생존율은 임상 효능의 증거가 아닙니다.",
  "The fixed MFPI seaweed cohort uses raw/fresh 100 g edible portion. This freeze-dried single-region zinc value cannot fill a blank in the RDA raw row or be ranked against fresh foods without a validated conversion and same-state cohort.":"MFPI 해조류 고정 비교집단은 생것 가식부 100 g 기준입니다. 한 지역의 동결건조 시료에서 얻은 이 아연 값은 검증된 환산과 같은 상태의 비교집단 없이는 RDA 생것 행의 빈칸을 채우거나 생 식품과 순위를 비교할 수 없습니다.",
  "Isolated peptide origin is documented, but the accessible assay record is insufficient for a reproducible potency percentile.":"분리 펩타이드의 기원은 기록되어 있지만, 열람할 수 있는 시험 기록만으로는 재현 가능한 효능 백분위를 낼 수 없습니다.",
  "Different reference program from fixed AFCD oyster cohort; uFiSh EDIBLE=0.51 uses a generic mussel reference, not a species-specific confirmed fraction.":"AFCD 굴 고정 비교집단과 참조 체계가 다릅니다. uFiSh EDIBLE=0.51은 일반 홍합 참조값이며 이 종에서 확인한 가식부 비율이 아닙니다.",
  "Mineral wet/dry basis is inferred from methods but not explicit in Table 5; whole-to-edible fraction and aquaculture site-method are not supplied. No conversion or ranking applied.":"무기질 값이 습중량 기준인지 건중량 기준인지는 방법에서 추정한 것으로 표 5에 명시되어 있지 않습니다. 전체 중량 대비 가식부 비율과 양식 장소·방법도 나와 있지 않습니다. 환산이나 순위 비교는 하지 않았습니다.",
  "A partly characterized hydrolysate peptide cannot support a compound-identified, comparable MBPI percentile.":"일부만 특성이 밝혀진 가수분해물 펩타이드로는 화합물이 확인된, 비교 가능한 MBPI 백분위를 낼 수 없습니다.",
  "Origin, structure and numeric endpoint are traceable, but the method has no fixed comparable stratum; PR-A adds no cohorts.":"기원·구조·수치 종말점은 추적할 수 있지만, 이 시험법에는 비교 가능한 고정 층이 없습니다. 비교집단은 새로 추가하지 않았습니다.",
  "same paper as the origin measurement":"원측정과 같은 논문",
};
const reasonKo=t=>REASON_KO[t]||t?.replace(/^pIC50 gap above (\S+)$/,'pIC50 차이가 기준 $1 초과');
const supplementalRecord=o=>`<p class="fine">별도 원값 ${esc(o.record_id)} · ${esc(o.sample_state)} · ${esc(o.basis)}: `+
  `${Object.entries(o.values||{}).map(([key,v])=>`${esc(nutrientNames[key]||key)} ${esc(v.value)} ${esc(v.unit)}`).join(' / ')}. `+
  `${esc(reasonKo(o.exclusion_reason))} ${verifiedSource(o.source_id,'원자료 ↗')}</p>`;
function verifiedFoodDetail(s){
  const f=s.assessment.food_trace||{};
  const search=Object.entries(f.substitute_search||{});
  if(!Number.isFinite(s.assessment.scores.MFPI))return observedRows(f)+
    (search.length?`<p class="fine">빠진 성분의 대체치 후보: ${esc(search.map(([k,v])=>(nutrientNames[k]||k)+' '+(v?(String(v).startsWith('MEXT:')?'MEXT 8정판 '+String(v).slice(5):(String(v).startsWith('K')?'RDA ':'uFiSh1.0 ')+v):'후보 없음')).join(' · '))}. `+
      `${f.substitute_row?'빠진 성분은 채울 수 있지만 아래 다른 이유로 보류합니다.':'채울 후보가 없는 성분이 있어 보류합니다.'}</p>`:'')+
    (f.supplemental_nutrition||[]).map(supplementalRecord).join('');
  // 3.17: EPA and DHA ride beside the scored components, clearly outside the score
  const fatty=f.display_fatty_acids?`<div class="score-fact"><b>EPA + DHA ${esc(num(f.display_fatty_acids.sum_mg))} mg / 100 g 가식부 · 점수 아님</b>`+
    `<span>EPA ${esc(num(f.display_fatty_acids.epa_mg))} · DHA ${esc(num(f.display_fatty_acids.dha_mg))} mg · 1일 영양성분 기준치 ${esc(f.display_fatty_acids.reference_mg)} mg의 ${Math.round(f.display_fatty_acids.sum_mg/f.display_fatty_acids.reference_mg*100)}% · 출처 표기 ${esc(f.display_fatty_acids.row_source)}</span></div>`+
    `<p class="fine">MFPI는 단백질·칼슘·철·아연 네 성분으로만 산출합니다. EPA·DHA는 표시 전용이며 점수·백분위·비교집단에 들어가지 않습니다. 오메가-3에는 식약처 함량강조표시 기준이 없어 ‘풍부’ 같은 표현 대신 수치와 기준치 대비 비율만 적습니다.</p>`:'';
  const raw=fatty+Object.entries(f.nutrients||{}).map(([key,n])=>
    `<div class="score-fact"><b>${esc(nutrientNames[key]||key)} ${esc(num(n.value))} ${esc(n.unit)} / 100 g 가식부</b>`+
    `<span>${esc(n.grade)} · 고정 비교집단 백분위 ${esc(n.percentile)} · 신뢰도 계수 ${esc(n.evidence_factor)}</span></div>`+
    (n.substitute?`<p class="fine">${substituteText(n.substitute)}</p>`:'')).join('')+
    // 3.7: a scored species can still carry unused records (e.g. 톳 freeze-dried zinc); they stay visible with their reason
    (f.supplemental_nutrition||[]).map(o=>o.substitute_use?`<p class="fine">별도 원값 기록 ${esc(o.record_id)}: ${esc(o.substitute_use)}.</p>`:supplementalRecord(o)).join('');
  const omitted=f.omitted_components||[];
  const outside=f.outside_cohort?`<p class="fine">${f.row_table==='mext'?`RDA 식품성분 DB에 이 종으로 연결된 행이 없어 일본 식품성분표 2020(8정판) ${esc(String(f.source_food_item_id).slice(5))} ${esc(f.reported_food_name)}(같은 종 생것, 가식부 100 g)을 이 종의 영양 행과 폐기율로 썼습니다(신뢰도 계수 0.85). `:''}${f.row_table==='literature'?`RDA 식품성분 DB와 일본 식품성분표에 이 종의 행이 없어, 이 종을 직접 분석한 원논문(${verifiedSource(f.source_id,'원문 ↗')})의 건물 기준 값을 같은 시료의 수분으로 날것 기준(가식부 100 g)으로 환산해 이 종의 영양 행으로 썼습니다(신뢰도 계수 ${esc(data.assessmentInfo?.method?.nutrition?.grade_factors?.literature_converted)}). `:''}${omitted.length?`원자료에 ${esc(omitted.map(k=>nutrientNames[k]||k).join('·'))} 값이 비어 있어 평균에서 뺐습니다(0점 아님, 사용 성분 ${Object.keys(f.nutrients||{}).length}/${Object.keys(f.nutrients||{}).length+omitted.length}). `:''}`+
    `${(f.substituted_components||[]).length?'대체치가 있어 ':''}이 종은 고정 비교집단에 넣지 않고, 비교집단과 자기 자신 안에서 순위를 매겼습니다(다른 종의 순위는 바뀌지 않습니다).</p>`:'';
  const c=f.components||{}, e=f.edible_fraction, q=f.aquaculture;
  const cohort=(data.assessmentInfo.cohorts||[]).find(x=>x.cohort_id===f.cohort_id);
  return `<p>${esc(f.reported_food_name)} (${esc(f.english_name)}) · 식품코드 ${esc(f.source_food_item_id)} · 출처 표기 ${esc(f.row_source)} · ${verifiedSource(f.source_id,'원자료 ↗')}</p>`+raw+outside+
    // 3.23: the reviewed limitations of a literature row sit with the paragraph that explains the row
    (f.literature_limitations?`<p class="fine">원논문 자료의 한계: ${esc(f.literature_limitations)}</p>`:'')+
    `<p><b>점수 구성</b> 영양값 ${esc(c.nutrient_value_contribution)} − 자료 신뢰도 감점 ${esc(c.evidence_grade_deduction)} + 가식부 ${esc(c.edible_fraction_contribution)} + 양식 ${esc(c.aquaculture_contribution)} = ${esc(s.assessment.scores.MFPI)}</p>`+
    `<p class="fine">고정 비교집단 ${esc(f.cohort_id)} · ${esc(f.cohort_species)}개 식품${cohort?' ('+esc(cohort.foods.join(', '))+')':''}. ${esc(f.cohort_criteria)} 비교집단이 다른 종의 MFPI끼리는 비교하지 않습니다.</p>`+
    // the edible fraction carries its own sample and caveats, the way the aquaculture line below already does
    `<p>가식부 ${esc((e.value*100).toFixed(1))}% · ${esc(e.method)}${e.region?` 시료: ${esc(e.region)}${e.sample_period?` (${esc(e.sample_period)})`:''}.`:''}${e.limitations?` 제약: ${esc(e.limitations)}`:''} · ${verifiedSource(e.source_id,'원자료 ↗')}</p>`+
    `<p>${q.feasible?'양식 방법':'양식 가능 근거 없음(양식 점수 0) · 확인한 시도'}: ${esc(String(q.method??'').replace(/\.\s*$/,''))}. 적용 범위: ${esc(q.region)} (${esc(q.year)}). 제약: ${esc(q.limitations)} ${verifiedSource(q.source_id,'양식 근거 ↗')}</p>`+
    (f.yield_sensitivity||[]).map(y=>`<p class="fine">가식부 ${esc((y.fraction*100).toFixed(2))}% (${esc(y.region||'')}) 대입 시 MFPI ${esc(Number(y.mfpi_at_same_nutrients).toFixed(1))} · ${verifiedSource(y.source_id,'독립 자료 ↗')}</p>`).join('')+
    (f.weight_sensitivity||[]).map(w=>`<p class="fine">가중치 ${w.nutrient_weight}/${w.edible_fraction_weight}/${w.aquaculture_weight} 적용 시 MFPI ${esc(Number(w.mfpi).toFixed(1))}</p>`).join('')+
    (f.grade_sensitivity?`<p class="fine">신뢰도 계수를 모두 1로 두면 MFPI ${esc(Number(f.grade_sensitivity.all_grade_factors_1).toFixed(1))}</p>`:'')+
    (f.cross_checks||[]).map(x=>`<p class="fine">교차 점검 ${esc(x.cohort_id)} (${esc(x.cohort_species)}종): MFPI ${esc(Number(x.mfpi).toFixed(1))}. ${esc(x.note)}</p>`).join('')+
    (f.uncertainty||[]).map(x=>`<p class="fine">불확실성: ${esc(x)}</p>`).join('');
}
// Name and raw values of one MBPI item as escaped HTML. The score evidence (verifiedBioTrace) and the comparison tab
// (showDecision) share it, so each stratum is worded in one place.
function bioItemHtml(x){
  const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer';
  const m=(x.measurements||[])[0]||{};
  const name=anti?`항암 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)})`:amp?`항균 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)}${x.sequence_modifications?' · '+esc(x.sequence_modifications):''})`:peptide?`펩타이드 ${esc(x.peptide_sequence)}`:ch?
    `${esc(x.compound_name||x.compound_id)} · ${sourceLink(`https://www.ebi.ac.uk/chembl/explore/compound/${x.compound_id}`,x.compound_id)}`:
    `${esc(m.compound_name||x.compound_id)} · ${m.structure_url?sourceLink(m.structure_url,x.compound_id):esc(x.compound_id)}${m.molecular_formula?' · '+esc(m.molecular_formula):''}`;
  const raw=anti?(x.measurements||[]).map(v=>esc(`${v.cell_line} IC50 ${v.relation} ${num(v.value)} ${v.unit}${v.value_as_published?' ('+v.value_as_published+')':''} · ${v.method}${v.exposure?' '+v.exposure:''}`)).join(' / ')+` · pIC50 ${esc(x.pIC50)}`:
    amp?(x.measurements||[]).map(v=>esc(`${v.target_species}${v.target_strain?' '+v.target_strain:''} MIC ${v.relation} ${v.value} ${v.unit} · ${v.medium}`)).join(' / ')+` · pMIC ${esc(x.pMIC)}`:
    peptide?(x.measurements||[]).map(v=>esc(`${v.target} ${v.endpoint} ${v.relation} ${peptideValue(v)} · 기질 ${v.substrate}`)).join(' / ')+` · pIC50 ${esc(x.pIC50)}`:
    ch?`${esc(x.stratum_label)} · 표적 ${esc(x.target_name)} (${esc(x.target_chembl_id)}, ${esc(x.target_type)}${x.target_organism?', '+esc(x.target_organism):''}) · ${esc(x.standard_type)} 중앙 pChEMBL ${esc(x.median_pchembl)} · 활성 ${esc(x.activity_ids.length)}건`:
    (x.measurements||[]).map(v=>`IC50 ${esc(v.relation||'')} ${esc(v.raw_value)}${v.raw_sd!==undefined?' ± '+esc(v.raw_sd):''} ${esc(v.raw_unit)}`).join(' / ');
  return {name,raw};
}
// The scored evidence comes first: one row per compound or peptide in the fixed stratum, the one that
// sets MBPI marked. Paper-local results that were not scored follow as leads, never as the main evidence.
function verifiedBioTrace(s){
  const a=s.assessment, items=a.bioactivity_trace||[];
  if(!items.length||a.axis_errors?.MBPI)return '';
  const cfg=data.assessmentInfo?.method?.bioactivity||{};
  const top=Math.max(...items.map(x=>x.adjusted));
  // Independence is judged on the value that sets MBPI, as the BBVI rule does; other rows are other peptides or compounds.
  const best=items.find(x=>Math.abs(x.adjusted-top)<1e-9);
  const dois=[...mbpiDois(best)], origin=[...new Set(best.original_paper_dois.map(d=>d.toLowerCase()))];
  const reps=(best.potency_replications||[]).filter(r=>r.used);
  const doiLink=d=>`<a href="https://doi.org/${encodeURI(d)}" target="_blank" rel="noopener">${esc(d)}</a>`;
  // e.g. "Do et al. 2012" from the provider line; the DOI link when the provider names no author-year.
  const originNames=origin.map(d=>{const m=(best.measurements||[]).find(v=>v.original_paper_doi?.toLowerCase()===d),
    ay=/\(([^()]*\d{4})\)/.exec(data.assessmentInfo?.sources?.[m?.source_id]?.provider||'');return ay?`${esc(ay[1])} (${doiLink(d)})`:doiLink(d);}).join(', ');
  // ponytail: the strongest rows only; a ChEMBL trace can hold dozens, and every row stays in assessments.json.
  const SHOWN=12, sorted=[...items].sort((x,y)=>y.adjusted-x.adjusted);
  const rows=sorted.slice(0,SHOWN).map(x=>{
    const used=Math.abs(x.adjusted-top)<1e-9;
    const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer';
    const m=(x.measurements||[])[0]||{};
    const {name,raw}=bioItemHtml(x);
    const cohort=anti?`${esc(x.cell_line)} IC50 펩타이드 ${esc(x.peer_peptides)}개${x.self_in_cohort?' · 이 펩타이드 자신은 비교집단에서 제외':''}`:
      amp?`${esc(x.target_species)} MIC 펩타이드 ${esc(x.peer_peptides)}개`:peptide?`펩타이드 ${esc(x.peer_peptides)}개`:ch?`ChEMBL 활성 기록 ${esc(x.cohort_records)}건`:`화합물 ${esc(x.peer_compounds)}개`;
    return `<div class="score-fact${used?' score-used':''}"><b>${used?'점수에 쓴 값 · ':''}${name}</b>`+
      `<span>${raw}${m.target_id?' · 표적 '+esc(m.target_id):''}${m.test_system?' · '+esc(m.test_system):''}</span></div>`+
      (m.conditions_key?`<p class="fine">시험 조건: ${esc(m.conditions_key)}</p>`:'')+
      (x.caveat?`<p class="fine">주의: ${esc(x.caveat)}</p>`:'')+
      ((peptide||amp||anti)?(x.measurements||[]).map(v=>{const src=data.assessmentInfo?.sources?.[v.source_id];
        return `<p class="fine">원값 출처: ${verifiedSource(v.source_id,esc(src?.provider||'원논문')+' ↗')} · 이용조건 ${esc(src?.license||'미확인')} · 조회 ${esc(src?.accessed||'미기재')}</p>`;}).join(''):'')+
      (ch?`<p class="fine">비교 코호트 ${esc(x.stratum_id)} (${cohort}) · 백분위 ${esc(x.percentile)} × 근거 계수 ${esc(x.evidence_factor)}(종 연결 ${esc(x.link_factor)} × 활성 ${esc(x.activity_factor)}) = ${esc(Math.round(x.adjusted*10)/10)} · 종 연결 논문 ${x.original_paper_dois.map(doiLink).join(', ')} · ChEMBL 문서 ${esc(x.document_chembl_ids.join(', '))}</p><p class="fine">${esc(x.label)}</p>`:
      `<p class="fine">비교 코호트 ${esc(x.stratum_id)} (${cohort}) · 백분위 ${esc(x.percentile)} × 근거 계수 ${esc(x.evidence_factor)} = ${esc(Math.round(x.adjusted*10)/10)}${x.percentile===0?' · 백분위 0은 비교집단의 모든 값보다 약한 실측값이라는 뜻이며, 자료가 없다는 뜻이 아닙니다':''}${x.percentile===100?` · 백분위 100은 이 비교집단의 ${esc(x.peer_peptides)}개 값보다 모두 강하다는 뜻이며, 더 강한 물질이 없다는 뜻은 아닙니다`:''} · 원논문 ${(x.original_paper_dois||[]).map(doiLink).join(', ')}</p>`)+
      (x.potency_replications||[]).map(r=>{const src=data.assessmentInfo?.sources?.[r.source_id];
        return `<div class="score-fact"><b>효능 재현 · ${r.material==='purified_isolate'?'정제':'합성'} ${esc(x.peptide_sequence)} ${esc(peptideValue(r))} · 재현 시료 ${esc(r.origin_label||r.origin_material)}</b>`+
          `<span>pIC50 ${esc(r.pIC50)} · 차이 ${esc(r.pIC50_gap)} · ${r.used?'독립 DOI로 셈':'쓰지 않음: '+esc(reasonKo(r.reason))}</span></div>`+
          `<p class="fine">출처: ${verifiedSource(r.source_id,esc(src?.provider||'원논문')+' ↗')} · DOI ${doiLink(r.original_paper_doi)} · 이용조건 ${esc(src?.license||'미확인')} · 조회 ${esc(src?.accessed||'미기재')}. 효능만 재현하며 기원 근거나 점수 값이 되지 않습니다.</p>`;}).join('');
  }).join('');
  // A peptide percentile ranks against the fixed AHTPDB cohort (CC BY-NC 4.0), so the cohort is cited where the rank is shown.
  const ampRule=best.stratum_kind==='amp'?data.assessmentInfo?.method?.amp_bioactivity:null;
  const antiRule=best.stratum_kind==='anticancer'?data.assessmentInfo?.method?.anticancer_bioactivity:null;
  const pep=best.stratum_kind==='peptide'?data.assessmentInfo?.method?.peptide_bioactivity:null;
  const pepSrc=pep?data.assessmentInfo?.sources?.[pep.cohort_source_id]:null;
  const ch=best.stratum_kind==='chembl', rule3=data.assessmentInfo?.method?.chembl_bioactivity;
  const scope=antiRule?`CancerPPD 2.0에서 고른 고정 비교집단(${esc(best.cell_line)} 세포주 IC50, 펩타이드 ${esc(best.peer_peptides)}개${best.self_in_cohort?' · 이 펩타이드 자신은 제외':''}, 중앙 pIC50 ${esc(best.cohort_median_pIC50)}) 안의 상대 순위입니다.`:
    ampRule?`DBAASP에서 고른 고정 비교집단(${esc(best.target_species)} 대상 MIC, 액체배지, 펩타이드 ${esc(best.peer_peptides)}개, 중앙 pMIC ${esc(best.cohort_median_pMIC)}) 안의 상대 순위입니다. 다른 균종 비교집단이나 ACE 비교집단과 섞지 않습니다.`:
    pep?`AHTPDB에서 고른 고정 비교집단(${esc(pep.target)} ${esc(pep.endpoint)}, 기질 ${esc(pep.substrate)}, 펩타이드 ${esc(best.peer_peptides)}개) 안의 상대 순위입니다.`:
    ch?`ChEMBL 같은 표적·같은 종말점(${esc(best.standard_type)}) 활성 기록 ${esc(best.cohort_records)}건 안의 상대 순위입니다.`:
    '같은 논문·같은 시험 조건 안의 상대 순위입니다.';
  const independence=ch?`종 연결 논문 ${dois.length}편 · ChEMBL 문서 ${esc(new Set(best.document_chembl_ids).size)}건 → 약한 쪽 ${esc(best.independent_sources)}편`:
    reps.length?`DOI ${dois.length}편(기원 ${origin.length} + 효능 재현 ${reps.length})`:`원논문 ${dois.length}편`;
  const single=mbpiSources(best)<2;
  const chemblLimit=ch?`${esc(best.label)}. 종→화합물 연결은 위키데이터 P703(LOTUS 자동 추출) 또는 검수한 원논문이며 함량·추출 조건은 알 수 없습니다. 분류군 ${esc(data.assessmentInfo?.chemblCommonLimit)}개를 넘는 흔한 대사물과 승인 약물(max_phase 4) 연결은 뺐습니다. 분류군 수는 위키데이터에 정리된 문헌 양이라 흔한 물질을 다 거르지 못하므로, 점수에 쓰는 연결은 원문 제목·초록과 PubChem 기록으로 검수했습니다. `:'';
  return `<h4>점수 근거 · ${esc(items.length)}개 측정값${items.length>SHOWN?` (상위 ${SHOWN}개 표시, 전체는 공개 JSON)`:''}</h4>${rows}`+
    `<p class="fine">집계: 코호트 안 조정값 중 ${cfg.primary_aggregation==='max'?'최댓값':esc(cfg.primary_aggregation||'미기재')} · 점수에 쓴 값의 독립 ${independence}`+
    `${single&&!ch?` → 단일 논문 계수 ${esc(cfg.single_doi_factor??items[0].evidence_factor)}`:''} · 민감도 ${esc((cfg.sensitivity_aggregations||[]).join('·')||'미기재')}${a.sensitivity?.range_from_aggregation?' 범위 '+esc(a.sensitivity.range_from_aggregation.join('–')):''}</p>`+
    `<p class="fine">한계: 백분위는 ${scope} ${chemblLimit}${single?'독립 재현 논문이 아직 없습니다. ':reps.length?`효능 재현은 별도 논문의 펩타이드 측정이고, 이 종에서 ${esc(best.peptide_sequence)}가 나온다는 기원 근거는 ${originNames} ${origin.length}편뿐입니다. `:''}${antiRule?'암세포주 증식 억제 농도(IC50)이며':ampRule?'세균 배양 억제 농도(MIC)이며':ch?'시험관·세포·병원체 시험값이며':'세포 밖(효소) 시험값이며'} 임상 효과나 제품 가치가 아닙니다.</p>`+
    (ampRule?`<p class="fine">비교집단 출처: ${verifiedSource(ampRule.cohort_source_id||'dbaasp_amp',(data.assessmentInfo?.sources?.[ampRule.cohort_source_id||'dbaasp_amp']?.provider)||'DBAASP')} · ${esc((ampRule.limitations||[])[0]||'')}</p>`:'')+
    (ch&&rule3?`<p class="fine">출처: ${rule3.source_ids.map(id=>{const src=data.assessmentInfo?.sources?.[id];return `${verifiedSource(id,(src?.provider||id)+' ↗')} (${esc(src?.license||'이용조건 미확인')}, 조회 ${esc(src?.accessed||'미기재')})`;}).join(' · ')} · ID와 값만 저장했습니다.</p>`:'')+
    (pep?`<p class="fine">비교집단 출처: ${verifiedSource(pep.cohort_source_id,esc(pepSrc?.provider||'AHTPDB')+' ↗')} · ${esc(pepSrc?.citation||'인용 미기재')} · 이용조건 ${esc(pepSrc?.license||'미확인')} · 행 ID와 IC50 값만 써서 백분위로 가공했습니다.</p>`:'');
}
// Paper values are stored in µM; values of 1000 µM and above are also shown in mM as the paper reports them.
// After 3.14 a synthetic peptide reported only in µg/mL is converted with its sequence mass; the paper's value stays beside it.
const peptideValue = r => (r.unit==='uM'?(r.value>=1000?`${r.value/1000} mM (${r.value} µM)`:`${r.value} µM`):`${r.value} ${r.unit||''}`)+
  (r.converted_from?` (원문 ${r.converted_from.value} µg/mL ÷ 서열 분자량 ${r.converted_from.molecular_weight} g/mol)`:'');
const REVIEW_CLASS={structure_mismatch:'구조 불일치',contaminant:'오염물',not_tissue:'종 조직 아님',ubiquitous_metabolite:'보편 대사물'};
function verifiedBioDetail(s){
  const items=s.assessment.bioactivity_partial||[];
  const trace=verifiedBioTrace(s);
  const steps={origin:'기원종',structure_id:'구조 ID',quantitative_endpoint:'정량값',comparable_cohort:'비교 코호트'};
  const partial=items.length?`<h4>후속 조사 단서 · 점수 미사용</h4>`+items.map(item=>{
    const values=item.sequence?esc(`펩타이드 ${item.sequence} · ${item.target||''} ${item.endpoint||''} ${item.relation||''} ${peptideValue(item)}`):(item.values||[]).map(v=>{
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
      `<p class="fine">점수에 쓰지 않은 이유: ${esc(reasonKo(item.exclusion_reason)||'비교 가능한 고정 코호트 없음')} ${verifiedSource(item.source_id,'원자료 ↗')} · DOI ${esc(source?.doi||'원문 확인 필요')} · 조회 ${esc(source?.accessed||'미기재')} · 이용조건 ${esc(source?.license||'미확인')}</p>`;
  }).join(''):'';
  const raw=(s.assessment.peptide_raw_values||[]).map(r=>{const src=data.assessmentInfo?.sources?.[r.source_id];
    return `<div class="score-fact"><b>원값·출처 · 펩타이드 ${esc(r.sequence)}</b><span>${esc(`${r.target} ${r.endpoint} ${r.relation} ${peptideValue(r)} · 기질 ${r.substrate||'미확인'}`)}</span></div>`+
      `<p class="fine">${verifiedSource(r.source_id,esc(src?.provider||'원논문')+' ↗')} · DOI ${esc(r.original_paper_doi)} · 이용조건 ${esc(src?.license||'미확인')} · 조회 ${esc(src?.accessed||'미기재')}. `+
      '같은 조건의 공개 비교집단이 없어 백분위·점수를 내지 않습니다. MBPI·BBVI에 쓰지 않습니다.</p>';}).join('');
  const rawHtml=raw?'<h4>원값·출처 · 점수 미사용</h4>'+raw:'';
  // 3.1 link review (mbpi-link-review-*.json): rejected species -> compound links, shown whether or not the species has a score.
  const cl=s.assessment.chembl_links, n=cl?.counts||{}, ps=cl?.paper_search, rule3=data.assessmentInfo?.method?.chembl_bioactivity;
  const rej=cl?.rejected_links||[];
  const rejected=rej.length?`<p class="fine">연결 검수 제외 ${esc(rej.length)}건: ${rej.map(r=>`${esc(r.compound_name)}(${esc(REVIEW_CLASS[r.class]||r.class)})`).join(' · ')}. 원문 제목·초록과 PubChem 기록으로 판단했고 어떤 점수에도 쓰지 않습니다.</p>`:'';
  if(trace)return trace+rejected+rawHtml+partial;
  // 3.1: what the automated species -> compound -> ChEMBL chain found, and the original-paper search for species without a P703 link.
  const linkChain=cl?`<p class="fine">종→화합물 공개 연결(위키데이터 P703·LOTUS${ps?', 검수 원논문':''}) ${esc(n.linked||0)}건 · 참고문헌 DOI 있음 ${esc(n.with_reference_doi||0)}건 · 흔한 대사물 제외 ${esc(n.common_metabolite||0)}건 · 승인 약물 제외 ${esc(n.approved_drug||0)}건 · 검수 제외 ${esc(n.rejected_by_review||0)}건 → ChEMBL 비교 코호트(활성 기록 ${esc(rule3?.minimum_cohort_records)}건 이상)에 든 화합물 ${esc(n.scored_compounds||0)}개.`+
    (ps?` 위키데이터 연결이 없어 CMNPD·PubChem 분류군·Europe PMC 원논문을 찾았습니다(${esc(ps.searched_on)}, Europe PMC ${esc(ps.europepmc_hits)}건 중 ${esc(ps.papers_screened)}건 선별, 인정 연결 ${esc(ps.accepted_links)}건).`:'')+' 정보충분도가 낮다는 뜻이며 자료 부재의 증거는 아닙니다.</p>':'';
  return '<p>검증된 기원종·화합물·시험 사슬을 찾지 못했습니다. 자료 부재의 증거는 아닙니다.</p>'+rawHtml+partial+linkChain+rejected+
    (!cl&&s.assessment.candidate_label&&!items.length?'<p class="fine">조사 후보 검색 범위: Wikidata/LOTUS 기원종 기록과 ChEMBL 37 정량값(2026-09-26)에서 미발견. PubChem·CMNPD·문헌 전수는 아직 조사하지 않았습니다.</p>':'');
}
function verifiedNationalFact(s){
  const b=s.assessment.national_assessment;
  if(s.assessment.mcui_basis==='national'&&b)return `<p><b>한국 국가 평가 기반 시범 MCUI</b>: ${esc(b.category)} · 게재명 ${esc(b.name_as_published)} · `+
    `목록 ${esc(b.list_page_printed)}쪽(뷰어 ${esc(b.list_page_viewer)}쪽) · 범위 ${esc(b.scope)} · ${esc(b.assessment_basis)} · ${verifiedSource(b.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    (data.assessmentInfo?.method?.national_red_list?.page_recheck?.checked_on?`<p class="fine">목록·찾아보기 쪽 재확인 ${esc(data.assessmentInfo.method.national_red_list.page_recheck.checked_on)} · 초판·개정판 등급 ${esc(b.first_edition_category||'미기재')} → ${esc(b.category)} (${esc(b.change||'변동 미기재')})</p>`:'')+
    (b.crosswalk?`<p class="fine">학명 대응(확인 ${esc(b.crosswalk.checked_on)}): ${esc(b.crosswalk.evidence)}</p>`:'')+
    '<p class="fine">국가 평가 점수는 전 지구 IUCN 기반 MCUI와 범위가 달라 서로 순위를 매기거나 비교하지 않고, '+(matrixRule()?.include_national_mcui?'매트릭스에는 네모 점으로 따로 놓습니다.':'매트릭스에도 놓지 않습니다.')+'</p>';
  // After 3.14: another range state's national list gives a separately labelled MCUI (shown with its inputs).
  const sub=s.assessment.mcui_substitute;
  if(substituteMcui(s)&&sub){
    const r=sub.record;
    return `<p><b>${esc(mcuiBasisLabel(s))} 시범 MCUI</b>: ${esc(r.category_as_published)} → ${esc(sub.category)} · 게재명 ${esc(r.name_as_published)} · ${esc(r.list)} · 범위 ${esc(r.scope)} · ${verifiedSource(r.source_id,'원목록 ↗')}</p>`+
      `<p class="fine">${esc(r.continuity.replace(/\.$/,''))}. ${esc(r.limitations)}</p>`;
  }
  // 3.15 (team-lead decision 2026-10-02): reference only. The Rapid LC record is shown beside the withheld MCUI, never as a score.
  const ref=mcuiReference(s);
  if(ref){
    const r=ref.record, t=r.thresholds||{};
    return `<p><b>예비 평가(Rapid LC) 참고 정보 · MCUI 점수 아님</b>: ${esc(ref.category)} 가능성 · EOO ${esc(r.eoo_km2.toLocaleString())} km²(기준 ${esc(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${esc(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${esc(r.aoo_cells)}칸, 기준 ${esc(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${esc(r.records)}건(기준 ${esc(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      `<p class="fine">GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${esc(r.native_box.lat.join('–'))}°, 경도 ${esc(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했습니다. OBIS 보고율 추세: ${esc(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}. `+
      `공식 IUCN 평가가 아니며, 어획 등에 따른 감소(기준 A)는 OBIS 추세로만 확인했습니다. MCUI 점수·매트릭스·지도 색·순위에 쓰지 않습니다.</p>`+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${esc(b.n)}종): ${esc(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미통과'}`+
        `${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${esc(b.false_lc_for_threatened.join('·'))}`:''}. ${esc(b.reason)}</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
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
    (s.assessment.occurrence_trend?'':'<p class="fine">OBIS·GBIF 원시 출현 건수는 개체군 추세로 쓰지 않았고, MCUI에 가감하지 않았습니다. 종 단위 평가를 출현 셀의 해역 등급으로 옮기지 않습니다.</p>');
}
// 3.4: OBIS reporting-rate check beside MCUI (figure stage 3: distribution recency, decline vs survey gap)
function occurrenceTrendDetail(s){
  const t=s.assessment?.occurrence_trend,rule=data.assessmentInfo?.method?.conservation?.trend;
  if(!t||!rule)return '';
  const p=rule.periods,n=t.species_records,e=t.effort_records,yr=x=>x.slice(0,4),f2=x=>Number(x).toFixed(2);
  const ratio=Number.isFinite(t.reporting_rate_ratio)?` · 보고율 비 ${f2(t.reporting_rate_ratio)} (95% 구간 ${f2(t.ci[0])}–${f2(t.ci[1])}) · 같은 강 기록 변화 ×${f2(t.effort_ratio)} · 전체 분류군 기준 민감도 ${f2(t.all_taxa_sensitivity?.reporting_rate_ratio)}`:'';
  const gain=t.mcui_base===null?0:Math.min(100,t.mcui_base+t.mcui_adjustment)-t.mcui_base;
  const effect=t.mcui_adjustment?(gain?`감소 신호라 MCUI ${t.mcui_base.toFixed(1)}에 +${gain}을 더했습니다.`:`감소 신호이지만 MCUI가 이미 상한 100이라 바뀌지 않았습니다.`)
    :t.mcui_base===null?'MCUI 기반 평가가 없어 이 결과로 MCUI를 만들지 않습니다.':'MCUI에 더하거나 빼지 않았습니다.';
  const d=t.dataset_check;
  const dataset=d?`<p class="fine">과거 기록이 가장 많은 데이터셋(${esc(String(d.dataset_id).slice(0,8))}…, 과거 기록의 ${Math.round(d.past_share*100)}%) 안에서만 다시 계산: `+
    (Number.isFinite(d.reporting_rate_ratio)?`${esc(d.species_records.past)}건 → ${esc(d.species_records.recent)}건, 보고율 비 ${f2(d.reporting_rate_ratio)} (${f2(d.ci[0])}–${f2(d.ci[1])})`:'두 기간 비교 불가')+
    ` · ${d.confirms_decline?'감소 확인':'감소 확인 안 됨'}. 감소 신호는 이 데이터셋 안에서도 같은 기준을 넘을 때만 인정합니다(조사 사업 종료를 감소로 읽지 않기 위해).</p>`:'';
  // IUCN's own population trend is the only independent direction; say so when it disagrees
  const pop=s.assessment.conservation_trace?.population_trend, falling=['decline_signal','decline_below_threshold'].includes(t.class);
  const iucn=(pop==='Decreasing'&&!falling)||(['Stable','Increasing'].includes(pop)&&falling)
    ?`<p class="fine">IUCN 개체군 추세(${esc(pop)})와 OBIS 보고율 결과가 다릅니다. 보고율은 개체수가 아니며, 이 차이는 이 방법이 아직 검증되지 않았음을 보여 줍니다.</p>`:'';
  return `<h4>OBIS 출현 추세 · 보조 요소 · <b>${esc(t.label)}</b></h4>`+
    `<p>비교 셀 ${esc(t.cells_compared)}개(1°)의 기록 ${esc(yr(p.past[0]))}–${esc(yr(p.past[1]))} ${esc(n.past)}건 → ${esc(yr(p.recent[0]))}–${esc(yr(p.recent[1]))} ${esc(n.recent)}건`+
    ` (지도 범위 전체 ${esc(t.records_in_map_extent?.past)} → ${esc(t.records_in_map_extent?.recent)}건) · 같은 셀의 ${esc(t.effort_group)} 전체 기록 ${esc(e.past)} → ${esc(e.recent)}건${ratio}. `+
    `분포 최신성: 과거에만 기록된 셀 ${esc(t.cells_past_only)}개 · 최근에만 기록된 셀 ${esc(t.cells_recent_only)}개 · 최근 기록 연도 ${esc(t.latest_record_year??'없음')}. ${esc(effect)} ${verifiedSource(t.source_id,'OBIS ↗')}</p>`+
    dataset+iucn+
    `<p class="fine">보고율 = 종 기록 ÷ 같은 셀·기간의 같은 강 기록(지도의 회색 조사량 음영과 다른 척도). 감소 신호는 보고율이 30% 이상 줄고 95% 구간이 1 아래이며, 과거 최대 데이터셋 안에서도 같을 때입니다. 보고율은 개체수·자원량이 아닙니다. 95% 구간은 기록을 서로 독립으로 보므로 같은 조사에서 나온 기록이 몰리면 실제보다 좁습니다. 종 단위 결과를 해역 등급으로 옮기지 않습니다.</p>`;
}
function sufficiencyText(a){
  const i=a.information_sufficiency;
  if(!i)return `네 지표 중 ${Object.values(a.scores).filter(Number.isFinite).length}개 산출.`;
  const pct=x=>Math.round(x*100)+'%';
  return `MFPI 필수 입력 ${pct(i.MFPI.ratio)} (${esc(i.MFPI.present.join(', ')||'없음')}) · MBPI 연결 단계 ${i.MBPI.best_record_steps}/4 · MCUI ${pct(i.MCUI.ratio)} · 평균 ${pct(i.mean_ratio)}. 점수와 합치지 않는 별도 표시입니다.`;
}
// Without a usable report row the four axes still get an openable entry that says why nothing is shown.
function axisStateSection(s){
  if(s.assessment||!axisStateNote[s.assessmentState])return '';
  return `<section class="verified-scores"><h3>지표 상태</h3>`+['MFPI','MBPI','MCUI','BBVI'].map(k=>
    `<details class="score-disclosure" data-axis="${k}"><summary><span>${k}</span><b>${esc(axisState(s,k).label)}</b></summary>`+
    `<div class="score-disclosure-body"><p class="pending">${esc(axisStateNote[s.assessmentState])}</p></div></details>`).join('')+'</section>';
}
// verified-pilot-2.1: shown only when both inputs equal the published axes and BBVI itself is withheld; never a score or rank.
function referenceCombination(s){
  const r=s.assessment.reference_combination;
  if(!r||s.assessment.scores?.BBVI!==null||r.used_for_score!==false||r.inputs?.MFPI!==pilotScore(s,'MFPI')||r.inputs?.MBPI!==pilotScore(s,'MBPI')||r.inputs.MFPI===null||r.inputs.MBPI===null)return '';
  return `<h4>${esc(r.label)}</h4><div class="score-fact"><b>참고값 ${esc(r.value.toFixed(1))} · 점수 아님</b><span>${esc(`${r.formula}, w = ${r.food_weight} · MFPI ${r.inputs.MFPI}(${r.mfpi_cohort}) · MBPI ${r.inputs.MBPI}(${r.mbpi_stratum}, 원논문 ${r.mbpi_original_paper_dois.join(', ')})`)}</span></div>`+
    `<p class="fine">가중치 민감도: ${esc(Object.entries(r.sensitivity).map(([w,v])=>`w ${w} → ${v}`).join(' · '))}. ${esc(r.limits.join(' '))} BBVI 점수·매트릭스·순위에 쓰지 않습니다.</p>`;
}
// After 3.14 (team-lead decision 2026-10-01): a BBVI held only because MBPI rests on one paper shows that reference value in
// the BBVI cell, labelled 참고값(단일 논문); it stays out of scores.BBVI, the matrix, the map colours and every ranking.
const bbviReference = s => s.assessment?.withheld_reasons?.BBVI==='mbpi_single_source'&&referenceCombination(s)?s.assessment.reference_combination.value:null;
// Species-level axis pairs, listed only where both values exist. Each group keeps one MCUI basis and one utilisation cohort;
// national and IUCN MCUI, or different MFPI cohorts, are never merged, ranked or turned into a sea-area value.
function axisPairsHtml(){
  const groups=new Map();
  for(const s of data?.species||[])for(const k of ['MFPI','MBPI','BBVI']){
    if(pilotScore(s,k)===null||pilotScore(s,'MCUI')===null)continue;
    const cohort=k==='MFPI'?s.assessment.food_trace?.cohort_id:k==='MBPI'?bestBio(s.assessment)?.stratum_id:'BBVI';
    const key=`${k} × MCUI(${mcuiBasisLabel(s)}) · ${cohort}`;
    groups.set(key,[...(groups.get(key)||[]),`${s.label} ${k} ${pilotScore(s,k).toFixed(1)}${k==='MBPI'&&s.assessment.mbpi_label?' ('+s.assessment.mbpi_label+')':''} · MCUI ${pilotScore(s,'MCUI').toFixed(1)}`]);
  }
  const zero=['MFPI','MBPI','BBVI'].filter(k=>![...groups.keys()].some(g=>g.startsWith(k+' ')));
  return `<b>축 쌍 보기 · 두 값이 모두 있는 종만</b><span>MFPI만의 쌍은 BBVI가 아닙니다. IUCN 기반과 그 밖의 기반(한국·서식국 국가 평가) MCUI, 서로 다른 비교집단은 합치거나 순위를 매기지 않습니다. 종 단위 값이며 해역·셀 값이 아닙니다. 나열 순서는 카탈로그 순서입니다.</span>`+
    `<ul>${[...groups].map(([k,v])=>`<li><b>${esc(k)}</b> ${v.length}종: ${esc(v.join(' / '))}</li>`).join('')}${zero.map(k=>`<li><b>${k} × MCUI</b> 0종 · 두 값을 함께 가진 종 없음</li>`).join('')}</ul>`;
}
// 3.4 priority reasons beside information sufficiency (labels published with the rule)
const surveyLabels=()=>data?.assessmentInfo?.method?.conservation?.no_assessment?.labels||{};
function surveyReasonText(a){
  return (a.priority_survey_reasons||['low_information_sufficiency']).map(w=>w==='low_information_sufficiency'?`정보충분도 낮음(필수 입력 평균 ${sufficiencyCut(a)})`:
    (surveyLabels()[w]||w)+(w==='no_conservation_assessment'?'(IUCN·국가 평가 모두 없어 MCUI 미산출)':w==='conservation_data_deficient'?' · 국가 평가도 없어 MCUI 미산출':'')).join(' · ');
}
const rankKo={genus:'속',family:'과'};
const relativeLabel=n=>data?.species?.find(x=>x.name===n)?.label||n;
function unexploredLine(u){
  const min=data?.assessmentInfo?.method?.unexplored_candidates?.relative_min_bbvi;
  return `같은 ${rankKo[u.rank]||u.rank}(${u.taxon})에 BBVI${Number.isFinite(min)?' '+min+' 이상인':'가 있는'} 근연종(${u.relatives.map(relativeLabel).join(', ')})이 있습니다`;
}
function sufficiencyCut(a){
  const cut=data?.assessmentInfo?.method?.unexplored_threshold;
  return Math.round(a.information_sufficiency.mean_ratio*100)+'%'+(Number.isFinite(cut)?', 기준 '+Math.round(cut*100)+'% 미만':'');
}
// Half-circle gauges at the top of the species evidence (same values as the disclosures below; visual only).
const GAUGE_COLOUR={MFPI:'#0b7a74',MBPI:'#1f9fb8',MCUI:'#e07a3f',BBVI:'#173f62'}, GAUGE_NAME={MFPI:'식량',MBPI:'생리활성',MCUI:'보전 시급성',BBVI:'통합 활용'};
function axisGauges(s){
  const len=Math.PI*38;
  return '<div class="axis-gauges" aria-hidden="true">'+Object.keys(GAUGE_COLOUR).map(k=>{
    const n=axisState(s,k).value, v=n===null?0:Math.max(0,Math.min(100,n)), ref=k==='BBVI'&&n===null?bbviReference(s):null;
    return `<figure class="gauge${n===null?' held':''}"><svg viewBox="0 0 100 58"><path d="M12 52a38 38 0 0 1 76 0" class="g-track"/>`+
      `<path d="M12 52a38 38 0 0 1 76 0" class="g-fill" style="stroke:${GAUGE_COLOUR[k]};stroke-dasharray:${(v/100*len).toFixed(1)} ${len.toFixed(1)}"/>`+
      `<text x="50" y="51" text-anchor="middle">${n===null?'–':n.toFixed(1)}</text></svg><figcaption>${k}<small>${n===null?(ref!==null?'참고값 '+ref.toFixed(1):'산출 보류'):GAUGE_NAME[k]}</small></figcaption></figure>`;}).join('')+'</div>';
}

function renderVerifiedIndices(s){
  const a=s.assessment;
  const names={MFPI:'식량 가능성',MBPI:'생리활성',MCUI:'보전 평가',BBVI:'통합 활용'};
  const mv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MFPI;
  const mfpiScope=validationResult('MFPI')==='passed'&&mv?`<p class="fine">방법 검증: RDA 값과 같은 종의 일본 식품성분표 2020 값으로 각각 계산한 영양 순위를 ${esc(mv.n)}종에서 비교했습니다(Spearman ρ ${esc(mv.spearman_rho)}, 단측 p ${esc(mv.permutation_p_one_sided)}). 성분표에 따라 순위가 바뀌는지만 본 것이며, 이 종의 값이나 가중치를 따로 검증한 것은 아닙니다.</p>`:'';
  const bodies={MFPI:mfpiScope+verifiedFoodDetail(s),MBPI:verifiedBioDetail(s),MCUI:verifiedConservationDetail(s)+verifiedNationalFact(s)+occurrenceTrendDetail(s),
    BBVI:'<p>기본 BBVI = w × MFPI + (1−w) × MBPI. MCUI는 별도 축입니다. 화면에서 w를 바꾸어도 고정 비교집단은 바뀌지 않습니다. MFPI만 보는 “식량 전용”과 MBPI만 보는 “생리활성 전용”은 기본 BBVI와 다른 보기입니다.</p>'+referenceCombination(s)};
  const surveyWhy=surveyReasonText(a);
  const unexplored=(a.priority_survey?`<p class="pending">우선 조사 대상 · ${surveyWhy}. 점수와 섞지 않는 별도 표시입니다.</p>`:'')+
    (a.unexplored_candidate?`<p class="pending">미탐색 후보: ${esc(unexploredLine(a.unexplored_candidate))}. 기본 가중치 w = 0.5 기준이며, 이 종의 점수는 추정하지 않습니다.</p>`:'');
  return `<section class="verified-scores"><h3>실제 원자료 기반 시범 지표${esc(validationNote(data.assessmentInfo))}</h3>`+
    `<p class="fine">자료 스냅샷 ${esc(data.assessmentInfo?.generatedAt?.slice(0,10))} · 방법론 ${esc(data.assessmentInfo?.version)} · MFPI·MBPI·MCUI는 각각 독립적으로 판정합니다. `+
    `숫자는 종 단위 연구용 지표이며 지도 셀이나 해역에 전가하지 않습니다.</p>`+
    ` ${Object.keys(names).map(key=>{
      const st=axisState(s,key),value=st.value,reason=a.withheld_reasons?.[key];
      const label=key==='MCUI'&&value!==null&&separateMcui(s)?' · '+mcuiBasisLabel(s):'';
      const note=axisStateNote[st.kind];
      return `<details class="score-disclosure" data-axis="${key}"><summary><span>${esc(key)} · ${esc(names[key])}</span>`+
        `<b>${value===null?(key==='BBVI'&&!note&&bbviReference(s)!==null?`참고값 ${esc(bbviReference(s).toFixed(1))} · ${esc(a.mbpi_label||'단일 논문')} · 점수 아님`:key==='MCUI'&&!note&&mcuiReference(s)?`${esc(st.label)} · 예비 평가 참고 ${esc(mcuiReference(s).category)} 가능성${rapidLcCheck()?'('+rapidLcCheck()+')':''} · 점수 아님`:esc(st.label)):value.toFixed(1)+' · '+pilotLabel(key)+(key==='MBPI'&&a.mbpi_label?' · '+esc(a.mbpi_label):'')+label}</b></summary>`+
        `<div class="score-disclosure-body">${note?`<p class="pending">${esc(note)}</p>`:value===null?`<p class="pending">${esc(scoreReason[reason]||reason||'산출 보류')}</p>`:''}`+
        `${note?'':bodies[key]}${key==='MFPI'&&value!==null?'<p class="fine">산식: 동기준 영양 백분위 × 신뢰도 계수 80% + 가식부 비율 10% + 양식 근거 10%. 이 비중과 계수는 팀의 시범 규칙입니다.</p>':''}`+
        `</div></details>`;
    }).join('')}${unexplored}<p class="fine">정보충분도: ${sufficiencyText(a)} `+
    `민감도 범위는 통계적 신뢰구간이 아닙니다.</p></section>`;
}

// LME names from the cell files, shown in Korean. Other values ('해역명 미확인', a bare LME number) pass through; the CSV
// keeps the source names. Kept above setView: test_map_boundary.mjs loads only the code before it with the popup code.
const SEA_KO={'Yellow Sea':'황해','East China Sea':'동중국해','Sea of Japan':'동해','Kuroshio Current':'쿠로시오 해류'};
const seaName=x=>SEA_KO[x]||x;
function setView(view,toTop=true) {
  if (!['explore','compare','method'].includes(view)) throw new Error('지원하지 않는 화면입니다.');
  const changed=view!==currentView;
  currentView=view;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===view));
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(view==='explore' && map) requestAnimationFrame(()=>map.invalidateSize());
  // A real tab change starts at the top. Callers that then scroll to their own target (source list, evidence) pass
  // toTop=false, so the page does not jump up first and then travel the whole way back down.
  if(changed&&toTop)window.scrollTo(0,0);
  writeHash();
}

// ---------- 활용 특성으로 찾기 (find by use trait) ----------
// Chips come only from evidence the report already adopted: MBPI items in bioactivity_trace (by assay target) and the
// species' own nutrient row against the MFDS nutrient-claim thresholds. Nothing is tagged by hand, and rejected or
// withheld records (chembl_links.rejected_links, bioactivity_partial, a withheld axis) never reach a chip. A trait
// with no adopted evidence stays a grey, unclickable chip ("0종 · 근거 수집 전") and turns on by itself once a report
// adopts an item its rule matches.
// MFDS 식품등의 표시기준 [별지 1] 영양성분 강조표시: '고/풍부' = 100 g당 1일 영양성분 기준치의 단백질 20%, 무기질 30%.
const CLAIM_REF={protein_g:55,calcium_mg:700,iron_mg:12,zinc_mg:8.5}, CLAIM_SHARE={protein_g:.2,calcium_mg:.3,iron_mg:.3,zinc_mg:.3};
const MINERALS={calcium_mg:'칼슘',iron_mg:'철',zinc_mg:'아연'};
const OMEGA_SHARE=.3; // team display rule for EPA+DHA: no MFDS claim exists, so the mineral '고/풍부' share is reused
const targetText=t=>(t.target_name||'')+' '+(t.target_organism||'');
const BACTERIA=/bacter|coccus|Escherichia|Staphylococcus|Pseudomonas|Bacillus|Mycobacterium|Vibrio|Salmonella|Streptococcus|Klebsiella/i;
const FUNGI=/Candida|Aspergillus|Cryptococcus|Fusarium|Trichophyton|Saccharomyces/i;
// An MBPI item takes the first drug trait whose rule matches (the precedence the 3.12 counts were checked with);
// a trait with a parent (내성균 under 항균) is counted under its parent as well.
const USE_TRAITS=[
  {id:'ace',group:'신약',label:'혈압(ACE 저해)',match:t=>t.stratum_kind==='peptide'||/wijesinghe|ACE/i.test(t.stratum_id||'')||/angiotensin/i.test(targetText(t))},
  {id:'virus',group:'신약',label:'바이러스',match:t=>/virus|SARS|HIV|dengue|influenza/i.test(targetText(t))},
  {id:'dementia',group:'신약',label:'치매 관련 효소',match:t=>/cholinesterase|beta-secretase/i.test(targetText(t))},
  {id:'parasite',group:'신약',label:'기생충',match:t=>/Trypanosoma|Plasmodium|Leishmania|Toxoplasma|Schistosoma|Giardia/i.test(targetText(t))},
  {id:'cancer',group:'신약',label:'항암',match:t=>t.stratum_kind==='anticancer'||t.target_type==='CELL-LINE'},
  {id:'microbe',group:'신약',label:'항균',match:t=>t.stratum_kind==='amp'||t.target_type==='ORGANISM'&&BACTERIA.test(targetText(t))},
  {id:'resistant',group:'신약',label:'내성균',parent:'microbe',match:t=>t.target_type==='ORGANISM'&&/resistan|MRSA|VRE|MDR/i.test(targetText(t))},
  {id:'fungus',group:'신약',label:'항진균',match:t=>t.target_type==='ORGANISM'&&FUNGI.test(targetText(t))},
  {id:'pain',group:'신약',label:'진통',match:t=>/opioid receptor|TRPV1|cyclooxygenase/i.test(targetText(t))},
  {id:'antioxidant',group:'신약',label:'항산화',match:t=>/DPPH|ABTS|radical/i.test(targetText(t))},
  {id:'diabetes',group:'신약',label:'항당뇨',match:t=>/glucosidase|dipeptidyl peptidase|PTP1B|amylase/i.test(targetText(t))},
  {id:'protein_g',group:'식량',label:'고단백'},
  {id:'mineral',group:'식량',label:'미네랄'},
  {id:'omega3',group:'식량',label:'오메가-3'},
];
// Search words that point at a trait chip, kept apart from the rules so wording can grow without touching evidence.
const TRAIT_SYNONYMS={
  ace:['혈압','고혈압','ace','안지오텐신','항고혈압'],
  virus:['바이러스','항바이러스','hiv','코로나','sars','뎅기','인플루엔자'],
  dementia:['치매','알츠하이머','콜린에스테라아제','bace'],
  parasite:['기생충','트리파노소마','말라리아','수면병','리슈마니아'],
  cancer:['항암','암','종양','세포독성'],
  microbe:['항균','세균','항생제'],
  fungus:['항진균','진균','곰팡이','칸디다','무좀'],
  resistant:['내성균','내성','슈퍼박테리아','mrsa'],
  pain:['진통','통증'],
  antioxidant:['항산화','활성산소'],
  diabetes:['항당뇨','당뇨','혈당'],
  protein_g:['단백질','고단백','protein'],
  mineral:['미네랄','무기질','칼슘','철','철분','아연'],
  omega3:['오메가-3','오메가3','오메가','omega','omega-3','dha','epa','불포화지방'],
};
let activeUse=null;
const traitById=id=>USE_TRAITS.find(c=>c.id===id);
// ChEMBL items carry a link review; peptide and reviewed-compound items are adopted by their stratum.
const isAdopted=t=>t.link_review===undefined||t.link_review==='accepted';
function traitIdsOf(t){
  const first=USE_TRAITS.find(c=>c.match&&!c.parent&&c.match(t));
  return first?[first.id,...USE_TRAITS.filter(c=>c.parent===first.id&&c.match(t)).map(c=>c.id)]:[];
}
const overClaim=(a,id)=>{const v=a.food_trace?.nutrients?.[id];return v&&Number.isFinite(v.value)&&v.value>=CLAIM_REF[id]*CLAIM_SHARE[id]?v:null;};
const nutrientLine=(v,id)=>`${num(v.value)} ${v.unit||''}/100 g · 기준 ${num(Math.round(CLAIM_REF[id]*CLAIM_SHARE[id]*10)/10)} 이상${v.substitute?' · '+v.substitute.label:''}`;
// Evidence line for one species and one trait, or null. Values are the species' adopted items, never a relative's.
function useEvidence(s,id){
  const a=s.assessment;if(!a)return null;
  if(id==='omega3'){
    const fa=a.food_trace?.display_fatty_acids;
    if(a.axis_errors?.MFPI||!fa||fa.sum_mg<fa.reference_mg*OMEGA_SHARE)return null;
    const borrowed=/JAPAN|USDA/.test(fa.row_source||'')?` · ${fa.row_source} 차용값`:'';
    return {text:`EPA+DHA ${num(fa.sum_mg)} mg/100 g · 1일 기준치 ${fa.reference_mg} mg의 ${Math.round(fa.sum_mg/fa.reference_mg*100)}%${borrowed}`,score:pilotScore(s,'MFPI')};
  }
  if(traitById(id)?.group==='식량'){
    if(a.axis_errors?.MFPI||pilotScore(s,'MFPI')===null)return null;
    const hits=(id==='mineral'?Object.keys(MINERALS):[id]).map(k=>[k,overClaim(a,k)]).filter(([,v])=>v);
    return hits.length?{text:hits.map(([k,v])=>(MINERALS[k]||'단백질')+' '+nutrientLine(v,k)).join(' · '),score:pilotScore(s,'MFPI')}:null;
  }
  if(a.axis_errors?.MBPI||pilotScore(s,'MBPI')===null)return null;
  const hits=(a.bioactivity_trace||[]).filter(t=>isAdopted(t)&&traitIdsOf(t).includes(id)).sort((x,y)=>y.adjusted-x.adjusted);
  if(!hits.length)return null;
  const t=hits[0], m=(t.measurements||[])[0]||{};
  const what=t.stratum_kind==='anticancer'?`항암 펩타이드 ${t.peptide_name||t.peptide_sequence} · ${t.cell_line} IC50 ${t.measurements.length>1?`${num(10**(6-t.pIC50))} ${m.unit} (노출 ${t.measurements.length}개 중앙값)`:`${num(m.value)} ${m.unit}`}`
    :t.stratum_kind==='amp'?`항균 펩타이드 ${t.peptide_name||t.peptide_sequence} · ${t.target_species} MIC ${t.measurements.length>1?`${num(10**(6-t.pMIC))} ${m.unit} (균주 ${t.measurements.length}개 중앙값)`:`${m.value} ${m.unit}`}`
    :t.stratum_kind==='peptide'?`펩타이드 ${t.peptide_sequence} · ACE IC50 ${peptideValue(m)}`
    :t.stratum_kind==='chembl'?`${t.compound_name||t.compound_id} · ${t.target_name} ${t.standard_type} pChEMBL ${t.median_pchembl}`
    :`${m.compound_name||t.compound_id||'화합물'} · ACE IC50 ${m.raw_value??''} ${m.raw_unit||''}`;
  return {text:`${what} · 근거 ${hits.length}건`,score:pilotScore(s,'MBPI')};
}
const useCount=id=>(data?.species||[]).filter(s=>useEvidence(s,id)).length;
// A chip's state comes from its count alone, so a grey chip activates as soon as adopted evidence matches it.
function traitChip(c,n){
  const on=activeUse===c.id;
  return `<button type="button" class="use-chip${n?'':' gap'}${on?' on':''}" data-use="${c.id}"${n?` aria-pressed="${on}"`:' disabled'} title="${n?`채택된 근거가 있는 ${n}종`:'채택된 근거가 아직 없습니다'}">${esc(c.label)} <b>${n?n+'종':'0종 · 근거 수집 전'}</b></button>`;
}
function renderUseChips(){
  const box=$('use-chips');if(!box||!data)return;
  box.innerHTML='<p class="use-title">활용 특성으로 찾기</p>'+['신약','식량'].map(g=>`<div class="use-row" role="group" aria-label="${g} 활용 특성"><span class="use-group">${g}</span><span class="use-row-chips">`+
    USE_TRAITS.filter(c=>c.group===g).map(c=>traitChip(c,useCount(c.id))).join('')+'</span></div>').join('');
  box.querySelectorAll('[data-use]:not([disabled])').forEach(b=>b.addEventListener('click',()=>setUse(activeUse===b.dataset.use?null:b.dataset.use)));
}
function setUse(id){
  activeUse=id&&useCount(id)?id:null;renderUseChips();renderList();
  if(mapMode==='value')renderMap();
  writeHash();
}
const useMatch=s=>!activeUse||!!useEvidence(s,activeUse);
// Search words that name a trait ("혈압", "항암", "DHA") show its chip, or say it has no adopted evidence yet.
// Other words only search names.
const termHit=(words,q)=>words.some(w=>w===q||(q.length>1&&w.startsWith(q)));
function useSuggestion(query){
  const raw=query.trim(), q=raw.toLowerCase();if(!q)return '';
  const c=USE_TRAITS.find(c=>termHit(TRAIT_SYNONYMS[c.id]||[],q));
  if(c){
    if(activeUse===c.id)return '';
    const n=useCount(c.id);
    return n?`<button type="button" class="use-suggest" data-use-suggest="${c.id}">‘${esc(raw)}’ → <b>${esc(c.group)} · ${esc(c.label)}</b> ${n}종 보기</button>`
      :`<p class="use-suggest gap">‘${esc(raw)}’ → ${esc(c.group)} ${traitChip(c,0)} 채택된 근거가 아직 없어 선택할 수 없습니다.</p>`;
  }
  return '';
}
// shown/base: species the trait keeps, out of those already passing the name, group and evidence filters.
function useNote(shown,base){
  if(!activeUse)return '';
  const c=traitById(activeUse);
  const rule=c.id==='protein_g'?`식약처 영양성분 강조표시 ‘고/풍부’ 기준(100 g당 1일 기준치의 ${Math.round(CLAIM_SHARE.protein_g*100)}%) 이상`
    :c.id==='mineral'?`칼슘·철·아연 중 하나 이상이 식약처 ‘고/풍부’ 기준(100 g당 1일 기준치의 ${Math.round(CLAIM_SHARE.calcium_mg*100)}%) 이상`
    :c.id==='omega3'?`EPA+DHA가 1일 기준치(330 mg)의 ${Math.round(OMEGA_SHARE*100)}% 이상(100 g당). 오메가-3에는 식약처 함량강조표시 기준이 없어 팀 표시 기준이며, 점수에는 쓰지 않습니다`
    :'보고서에 채택된 MBPI 근거의 시험 표적 기준이며 효능 판정이 아닙니다';
  return `<p class="use-note"><b>${esc(c.group)} · ${esc(c.label)}</b> ${shown}종 · ${rule}. 숨김: 근거 미확인 ${base-shown}종(가치가 낮다는 뜻 아님). <button type="button" class="text-button" data-use-clear>해제</button></p>`;
}
// Result cards always carry conservation and the matrix type, so a trait filter never shows use alone.
function useCardLine(s){
  if(!activeUse)return '';
  const e=useEvidence(s,activeUse), mc=pilotScore(s,'MCUI'), t=matrixType(s);
  return `<span class="use-line">${esc(e?.text||'')}<br>MCUI ${mc===null?'미산출':mc.toFixed(1)} · 매트릭스 유형 ${t?esc(matrixTypeLabel(t)):'없음(미배치)'}</span>`;
}

// Four axis values on every card ('–' = withheld, never 0), so the list can be scanned without opening a species.
const cardScores=s=>s.assessment?'<span class="card-scores">'+['MFPI','MBPI','MCUI','BBVI'].map(k=>{const n=axisState(s,k).value;
  return `<i class="${n===null?'held':''}" title="${GAUGE_NAME[k]}"><small>${k}</small>${n===null?'–':n.toFixed(1)}</i>`;}).join('')+'</span>':'';
function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const group=$('species-group').value, evidence=$('species-evidence').value;
  const base=data.species.filter(s=>(group==='all'||s.group===group)
    &&(evidence==='all'||(evidence==='published'?!s.catalog:!!s.catalog))
    &&[s.label,s.name,s.group,String(s.aphiaID)].some(v=>v.toLowerCase().includes(query)));
  const matches=base.filter(useMatch);
  $('species-count').textContent=`${matches.length}종`;
  const extra=$('use-extra');
  if(extra){extra.innerHTML=useSuggestion($('search').value)+useNote(matches.length,base.length);
    extra.querySelector('[data-use-suggest]')?.addEventListener('click',e=>{$('search').value='';setUse(e.currentTarget.dataset.useSuggest);});
    extra.querySelector('[data-use-clear]')?.addEventListener('click',()=>setUse(null));}
  // Re-rendering on select must not jump the (horizontal on phones) list back to the start or drop keyboard focus.
  const list=$('species-list'),left=list.scrollLeft,top=list.scrollTop,refocus=list.contains(document.activeElement);
  $('species-list').innerHTML=matches.length?matches.map(s=>`<button class="species-card ${selected?.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" data-group="${esc(s.group)}" aria-pressed="${selected?.aphiaID===s.aphiaID}"><span class="group">${esc(s.group)}</span><b>${esc(s.label)}</b><em>${esc(s.name)}</em><span class="count"><span>지도 표시 기록</span><strong>${s.cells.length?`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}셀`:s.catalog?(s.review?'공개 가능 기록 없음':releaseMissing(s)):'공개 셀 없음'}</strong></span>${cardScores(s)}${useCardLine(s)}</button>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species))));
  list.scrollLeft=left;list.scrollTop=top;
  if(refocus)list.querySelector('.species-card.selected')?.focus({preventScroll:true});
}

function selectSpecies(id) {
  const item=data?.species.find(s=>s.aphiaID===id);
  if(!item)throw new Error('목록에 없는 종입니다.');
  selected=item;comparisonPage=Math.floor(data.species.indexOf(item)/5);periodFilter='all';renderList();renderDetail();renderMap();renderComparison();writeHash();
}

function renderDetail() {
  const s=selected;
  if(s.catalog)renderCandidateDetail(s);else renderLiveDetail(s);
  // The four values first, as gauges under the name; the evidence below stays the reference.
  if(s.assessment)$('detail').querySelector('.detail-head')?.insertAdjacentHTML('afterend',axisGauges(s));
  appendFollowupBrief(s);
}

// Counts come from the published evidence_summary. A missing key is "정보 없음", never 0.
const count = (v,unit='건') => Number.isFinite(v) ? `${v.toLocaleString()}${unit}` : '정보 없음';
const row = (label,value,cls='') => `<div class="evidence-item"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`;

// The operating profile summary was published before the index report. Where the report reviewed an axis, show its
// result instead of the profile's older "미수집/미검토/보류"; profile counts that do exist are kept as they are.
function indexReviewRow(s,key,label){
  const a=VERIFIED.includes(s.assessment?.report_version)?s.assessment:null;
  const seen=a&&{MFPI:a.food_trace?.observed_rows?.length,MBPI:a.bioactivity_trace?.length||a.bioactivity_partial?.length,MCUI:a.conservation_trace?.reviewed}[key];
  if(!seen)return null;
  const v=pilotScore(s,key);
  return row(label,`지표 보고서에서 검토 · ${key} ${v===null?'산출 보류':v.toFixed(1)}${key==='MCUI'&&separateMcui(s)?' ('+mcuiBasisShort(s)+')':''}`,v===null?'pending':'done')+
    `<p class="fine">운영 요약(발행 ${esc((s.publishedAt||'').slice(0,10)||'날짜 미확인')})은 지표 보고서보다 먼저 작성되어 이 항목을 반영하지 않았습니다. 원값과 보류 사유는 위 ${key} 근거에서 확인합니다.</p>`;
}
function liveEvidence(s) {
  const i=s.info,n=i.nutrition||{},c=i.compounds||{},k=i.conservation||{},p=i.production||{};
  const cmnpd=s.sources.find(x=>x.id==='cmnpd-1.0');
  const nutrition=n.status!=='available'&&indexReviewRow(s,'MFPI','영양 기록 수')||(n.status==='available'
    ? row('영양 기록 수 · 수집 현황',count(n.record_count))
      +row('기록 분류 · 영양값 아님',`실측 ${count(n.measured_count)} · 계산 ${count(n.calculated_count)}`+(n.proxy_count?` · 대용 ${count(n.proxy_count)}`:''))
      +row('참고 기록 수',`AFCD ${count(n.evidence_record_count)}`)
      +row('불확실성',`단위 미확정 ${count(n.unit_unconfirmed_count)} · 기준량 가정 ${count(n.basis_assumed_count)}`)
      +(n.note?`<p class="fine">${esc(n.note)}</p>`:'')
    : row('영양 기록 수',n.status==='not_collected'?'미수집':'정보 없음','pending'));
  const aquaculture=Number.isFinite(p.aquaculture_evidence_count)&&p.aquaculture_evidence_count>0
    ? `<p class="fine">양식 관련 요약 ${count(p.aquaculture_evidence_count)} · 기술적 가능성 판정 아님: ${esc(p.note||'방법·해역·시기 추가 검수 필요.')}</p>`:'';
  const compounds=c.status!=='available'&&indexReviewRow(s,'MBPI','보고 화합물')||(c.status==='available'
    ? row('보고 화합물',count(c.compound_count,'개'),'done')
      +row('정량 활성 자료',c.quantitative_bioactivity_count===0?'확인한 자료에서 없음':count(c.quantitative_bioactivity_count))
      +(c.note?`<p class="fine">${esc(c.note)}</p>`:'')
      +(CASE_NOTES[s.aphiaID]?`<p class="fine"><b>별도 원문 조사 · 지표 입력 아님</b> ${esc(CASE_NOTES[s.aphiaID].detail)} ${sourceLink(CASE_NOTES[s.aphiaID].url,CASE_NOTES[s.aphiaID].title+' ↗')}</p>`:'')
      +`<p class="fine">출처 ${cmnpd?sourceLink(cmnpd.url,'CMNPD ↗'):'CMNPD'} · ${cmnpd?sourceLink(cmnpd.licenseUrl,'CC BY-NC-SA 4.0'):'CC BY-NC-SA 4.0'} — 비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다.</p>`
    : row('보고 화합물',c.status==='not_collected'?'미수집':'정보 없음','pending'));
  const conservation=indexReviewRow(s,'MCUI','보전평가')||{
    withheld_insufficient_evidence:row('보전평가','근거 부족으로 보류','pending')+row('검토 기록',`IUCN 검색 기록 ${count(k.search_record_count)} · 평가 ${count(k.assessment_count)}`)+(k.note?`<p class="fine">${esc(k.note)}</p>`:''),
    not_reviewed:row('보전평가','미검토','pending')
  }[k.status]||row('보전평가','정보 없음','pending');
  return `<h3>영양 자료 수집 현황 · 식량가치 아님</h3>${nutrition}${aquaculture}<p class="fine">공개 요약에는 성분별 원값·단위·시료 상태·가식부 100 g 기준이 연결되지 않았습니다. 기록 건수와 실측/계산 건수는 종 간 영양 비교값이 아닙니다. 별도로 검토한 원자료는 아래 지표 근거에서 확인할 수 있습니다.</p><h3>화합물 근거</h3>${compounds}<h3>보전</h3>${conservation}${iucnHistoricalRows(s)}`;
}

// The profile's record_count/period describe its own collection run. Only a gbif_*map_* run is the map's record set;
// an older run (the OBIS pilot) is shown apart so its count and years never read as the map summary.
const isMapRun=s=>/^gbif_(sea_cucumber_)?map_/.test(String(s.info?.collection||''));
// Top of the live panel: what the map shows now (period filter applied), from the published cells only.
function mapSummaryHtml(s){
  const cells=s.cells||[];
  const scope=periodFilter==='all'||!cells.length?'전체 기간':`선택 기간 ${periodFilter}`;
  const excluded=exclusionLine(s);
  if(!cells.length)return s.catalog?`<h3>지도에 표시한 기록</h3>${row('분포',s.review?`${reviewLine(s.review)} · 셀 없음`:releaseMissing(s)+' · 셀 없음','pending')}${s.review?row('제외 사유',withheldLine(s.review),'pending'):''}`+
    row('다음 단계',s.review?'제외 사유별 원자료 이용조건·좌표를 다시 확인하고, 개방 이용조건 기록이 생기면 집계 셀을 만듭니다':'출현 검수 파일을 다시 불러와 확인합니다','pending')+
    `<p class="detail-context">셀이 없는 것은 종 부재가 아닙니다. 확인되지 않은 셀을 대신 만들지 않습니다.</p>`
    :`<h3>지도에 표시한 기록</h3>${row('지도 표시 기록','없음 · 자료 조회 범위만 표시','pending')}${excluded?row('제외 사유',excluded,'pending'):''}`;
  const historical=flaggedRecords(s,'historical'), outside=flaggedRecords(s,'outsideKoreanEEZ');
  return `<h3>지도에 표시한 기록 <span class="fine">${esc(scope)}</span></h3>${row('지도 표시 기록',`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}개 격자(${cells[0].sizeDeg}°)`)}${row('기록 연도',cellYears(s))}${historical?row('과거 기록(2000년 이전)',`${historical.toLocaleString()}건 · 현재 분포 근거 아님`):''}${outside?row('한국·북한 EEZ 밖 셀',`${outside.toLocaleString()}건`):''}${row('해역',[...new Set(cells.flatMap(c=>(c.seaAreas||[]).map(seaName)))].join(' · ')||'해역명 미확인')}${row('출처',s.info?.map?.source||'출처 미기재')}${row('이용조건',[...new Set(cells.flatMap(c=>(c.citations||[]).flatMap(x=>x.licenses||[])))].join(' · ')||'셀별 확인 필요')}${excluded?row('제외 사유',excluded):''}`;
}
// Why records did not become cells: candidates carry a two-source review, operating species a map outcome.
function exclusionLine(s){
  if(s.review)return withheldLine(s.review);
  return Object.entries(s.info?.map?.outcome||{}).filter(([k,n])=>k!=='accepted'&&n>0).map(([k,n])=>`${REASONS[k]||k} ${count(n)}`).join(' · ');
}
function renderCandidateDetail(s){
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  const heading=(status)=>`<div class="detail-head"><div class="detail-top"><span>신규 조사 후보</span><span class="pending">${status}</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`;
  const identity=`<p class="detail-context">AphiaID ${esc(s.aphiaID)} · ${esc(s.group)} · ${sourceLink(s.wormsUrl,'WoRMS 학명 확인 ↗')}</p>`;
  if(s.audit){
    const a=s.audit, n=a.nutrition, i=a.iucn, r=s.review;
    const pilot=s.assessment, mbpi=pilotScore(s,'MBPI');
    // The table's columns fit only the reviewed compound stratum (no stratum_kind, 감태); other strata are listed in the score evidence.
    const compounds=mbpi===null?[]:(pilot.bioactivity_trace||[]).filter(t=>!t.stratum_kind&&t.measurements?.length);
    const bioRows=compounds.map(t=>t.measurements.map(m=>`<tr><td>${sourceLink(m.structure_url,m.compound_name+' · '+t.compound_id)}</td><td>${esc(m.relation)} ${esc(m.raw_value)} ± ${esc(m.raw_sd)} ${esc(m.raw_unit)}</td><td>${esc(t.percentile)} · ${esc(t.evidence_factor)}</td></tr>`).join('')).join('');
    // 3.1: count only the scoring item's stratum; ChEMBL items of other target x endpoint cohorts are listed apart
    const trace=pilot?.bioactivity_trace||[], same=trace.filter(x=>x.stratum_id===bestBio(pilot)?.stratum_id), other=trace.length-same.length;
    const papers=new Set(same.flatMap(x=>x.original_paper_dois||[]).map(d=>d.toLowerCase())).size;
    // 3.24: a used potency replication is the second paper behind the top item (its BBVI rests on it), so the summary names it
    const replicated=(bestBio(pilot)?.potency_replications||[]).filter(r=>r.used).length;
    const bioDetail=mbpi===null?'기원종→화합물→assay 원문 미검수':`검증 전 시범 MBPI ${mbpi.toFixed(1)} · 같은 시험 조건 측정값 ${same.length}개, 원논문 ${papers}편${papers<2?', 독립 재현 미확인':''}${other?` · 다른 비교집단 ${other}개는 점수 근거에 따로 표시`:''}. 같은 코호트 안의 상대 백분위이며 임상 효능·종 간 가치 순위가 아닙니다.`;
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
    $('detail').innerHTML=heading(s.cells.length?`공개 ${s.cells[0].sizeDeg}° 셀`:r?'공개 가능한 기록 없음':releaseMissing(s))+
      `<div class="detail-summary">${identity}<div id="detail-map-summary">${mapSummaryHtml(periodView(s))}</div>`+
      (pilot?'<p class="pending">조사 후보 · 운영 8종과 같은 규칙으로 축별 판정했지만 후보 목록에서 옮기지 않습니다.</p>'+
        (mbpi===null?'':row('생리활성 근거',`검증 전 시범 MBPI ${mbpi.toFixed(1)} · ${bestBio(pilot).stratum_kind==='chembl'?`${bestBio(pilot).stratum_label} · ${bestBio(pilot).label}`:`원논문 ${papers}편${replicated?` + 효능 재현 ${replicated}편`:''}`} · 같은 코호트 안의 상대 백분위`,'linked'))+renderVerifiedIndices(s)+
        `<p class="detail-limit">${limit} ${scored.length?scored.map(k=>k+'('+pilotLabel(k)+')').join(' / ')+'만 산출했고 나머지 축은 보류입니다.':'MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.'}</p></div>`:
      axisStateSection(s)+`<h3>근거 상태 <span class="fine">판정 아님</span></h3>`+
      row('식량 근거',n.foodCode?'식품명 후보 · 종 연결 미확인':'연결된 식품 행 없음','pending')+
      row('생리활성 근거','원문 연결 미검수','pending')+
      row('보전 평가',i.record?.category?'체크리스트 기록 · 원평가 미검수':'연결된 평가 미확인','pending')+
      `<p class="detail-limit">${limit} MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.</p></div>`)+
      '<div class="detail-more-list">'+
      more('근거 자세히 보기',`<h3>선정 이유</h3><p>${esc(s.reason)}</p>`+
        (s.taxonNote?`<p class="fine">${esc(s.taxonNote)}</p>`:'')+
        (pilot?'':row('식량·영양',food,'pending')+row('생리활성',bioDetail,'pending'))+
        (bioRows?`<table><caption>감태 유래 분리 화합물 · ACE/HHL, 37°C, IC₅₀ · 원문 Table 2</caption><thead><tr><th>화합물 · 구조</th><th>원값</th><th>백분위 · 근거 계수</th></tr></thead><tbody>${bioRows}</tbody></table><p>${sourceLink(compounds[0].measurements[0].paper_url,'분리·NMR·시험 원논문 ↗')} · 검수 기록은 팀 저장소(비공개)에 보관</p>`:'')+
        (pilot?'':row('보전',conservation,'pending'))+
        (pilot?'':row('MFPI / MBPI / MCUI / BBVI','모두 산출 보류 · 원자료 발견은 점수가 아닙니다','pending')+
        '<p class="fine">정보충분도: 출현 조회·식품명 후보·체크리스트 연결 상태만 표시합니다. 검증된 지표 점수와 구분합니다.</p>'))+
      more('수집·선별 기준',(r?sourceRow('GBIF',r.gbif)+sourceRow('OBIS',r.obis)+(r.gbif.nibrPoints?row('국립생물자원관 표본',`GBIF에 좌표 없는 표본 ${r.gbif.nibrPoints.specimens.toLocaleString()}건 · 생물지리정보 채집 지점이 조회 범위 안 ${r.gbif.nibrPoints.pointsInBox.toLocaleString()}건(GBIF 조회 수에 포함) · 통과 ${r.gbif.nibrPoints.accepted.toLocaleString()}건`):'')+row('제외 사유',withheldLine(r))+
          row('통과 기록의 원자료 학명',r.names.join(', ')||'없음')+row('공개 해상도',s.sensitivity||'미기재')+
          '<p class="fine">검수 기준: WoRMS 학명 확인 · CC0·CC BY 4.0·CC BY-NC 4.0 기록만(비상업 연구용, 2026-10-01부터 BY-NC 포함) · 연도 1개(여러 해 범위 제외) · GBIF 좌표 경고·불확실성 10 km 초과·원자료 일반화 제외 · OBIS 해안선에서 1 km보다 안쪽 육상 좌표 제외(조간대 기록 보존) · 화석·사육·시장 구입 표본 제외 · GBIF와 OBIS에 함께 게시된 같은 기록은 한 번만 셉니다. 국립생물자원관 표본은 GBIF에 좌표가 없어 같은 표본번호로 국립생물자원관 생물지리정보의 채집 지점·일자를 씁니다(2026-10-01). 2000년 이전 기록은 과거 기간으로, 모든 기록이 한국·북한 EEZ(OBIS 해역 정보) 밖인 셀은 따로 표시합니다. 양식·방류 여부는 원자료 표시가 없으면 구분하지 못합니다.</p>'
          :row('출현 검수',releaseMissing(s),'pending'))+
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
  const evidence=s.v2?liveEvidence(s):'';
  const score=s.v2?'활용·보전 근거를 검수하는 중이라 점수를 계산하지 않았습니다. 미수집·보류 항목을 0점으로 처리하지 않습니다.':esc(s.productionSummary);
  const pilot=s.assessment;
  const pilotRows=!pilot?axisStateSection(s):VERIFIED.includes(pilot?.report_version)?renderVerifiedIndices(s)
    :pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':pilotScore(s,k).toFixed(1))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}${pilot.scores.MCUI===null&&pilot.iucn_category?' · 현행 평가 확인 보류':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  const withheld=pilot?'근거가 부족한 항목은 산출 보류로 유지합니다. 시범 수치는 연구용 결과입니다'+validationNote()+'.'+(s.v2?'':' '+score):score;
  // A status says whether an indicator was computed; "일부 근거 확인" is evidence without an indicator.
  const axes=[['MFPI','식량 근거'],['MBPI','생리활성 근거'],['MCUI','보전 평가']].map(([k,label])=>{
    const st=axisState(s,k), v=st.value, status=st.kind!=='withheld'||VERIFIED.includes(pilot?.report_version)?st.label:'산출 보류';
    return row(label,v===null?(status==='산출 보류'?status:status+' · 지표 미산출'):`${v.toFixed(1)} · ${pilotLabel(k)}${k==='MBPI'&&s.assessment?.mbpi_label?' · '+esc(s.assessment.mbpi_label):''}`,v===null?'pending':'done')
      .replace('<div class="evidence-item">',`<div class="evidence-item axis axis-${k}" style="--v:${v===null?0:Math.max(0,Math.min(100,v))}%">`);
  }).join('');
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>공개 기준 적용 자료</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`+
    `<div class="detail-summary"><div id="detail-map-summary">${mapSummaryHtml(periodView({...s,cells}))}</div><h3>근거 상태 <span class="fine">판정 아님</span></h3>${axes}<p class="detail-limit">현재 확보한 출현기록이며, 전체 분포·개체수·자원량이 아닙니다.</p></div>`+
    `<div class="detail-more-list">`+
    more('근거 자세히 보기',`${pilotRows}${evidence}${foodEvidencePanel(s)}${row('자료 연결 현황','5개 항목의 단계 · 품질 점수 아님')}${coverageBar(s)}<p class="fine">${esc(coverageGuide)}</p>${coverageNotes(s)}<div class="withheld"><b>${pilot?'시범 분석 주의':'통합점수 산출 보류'}</b>${withheld}</div>`)+
    more('수집·선별 기준',`${row('AphiaID',s.aphiaID)}${row('원자료 학명',(i.original_names||[]).join(', ')||'미기재')}<p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 AphiaID를 기준으로 합니다.</p>${mapSection({...s,cells})}${separate}${institutionChecks(s)}`)+
    more('출처와 이용조건',`<div class="source-area">${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>{const src=data.assessmentInfo.sources[id];return `<p>${sourceLink(src.url,((mcuiReference(s)?.source_ids||[]).includes(id)?'참고 정보 출처 ':'지표 근거 ')+id+' ↗')} · ${esc(src.license)}${src.notice?`<br><span class="fine">${esc(src.notice)}</span>`:''}</p>`;}).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 근거 보고서는 별도 스냅샷입니다.</p></div>`)+
    `</div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method',false);document.querySelector('.source-section').scrollIntoView({behavior:'smooth'});});
}

// Published 1° map cells (public.species_map_cells, rules map-1). Cells only: no coordinates or record ids exist in the API.
const REASONS={on_land_obis_rule:'육지 위 좌표(OBIS 해안선 기준)',duplicate:'같은 기록 중복',under_existing_db_review:'운영 DB에서 검토 중인 기존 기록',
  species_held_until_sensitivity_review:'민감도 검토 전 보류 종',bad_coordinate_issue:'GBIF 좌표 오류 표시',uncertainty_over_10km:'좌표 불확실성 10 km 초과',
  coordinates_generalized_at_source:'제공처가 좌표를 흐리게 처리',no_year:'관측 연도 없음',
  taxon_not_verified:'학명 미확인',absent_or_dropped:'부재·삭제 기록',fossil_specimen:'화석 표본',license_not_open:'이용조건 미충족(허용 범위 밖·불명)',
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
  const axes=['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return `${k} ${st.value!==null?'시범값 있음':st.kind==='withheld'?'보류':st.label}`;}).join(' · ');
  const h=IUCN_HISTORICAL[s.aphiaID], k=s.info?.conservation||{};
  const iucn=h?(h.current&&pilotScore(s,'MCUI')===null?`IUCN ${h.current.category} ${h.current.published}년 발표(원문 검수 전, 2013 평가 대체)`:(pilotScore(s,'MCUI')!==null&&s.assessment?.conservation_trace?.publication_year?`IUCN ${s.assessment.conservation_trace.category} ${s.assessment.conservation_trace.criteria||''} ${s.assessment.conservation_trace.publication_year}년 발표(원문 검수 · 시범 MCUI, 2013 평가 대체)`:`IUCN ${h.category} ${h.published}년 발표(${pilotScore(s,'MCUI')===null?'역사적 평가 · 현행 확인 보류':'현행 재확인 · 시범'})`))
    :reportConservation(s)?`보전 ${reportConservation(s)}(지표 보고서)`
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
  const map3=/^map-3/.test(m.rules||'');  // 2026-10-01: CC BY-NC 4.0 records and a 1 km coastline buffer
  const why=m.status==='held_sensitivity_review'?`<div class="withheld"><b>조사 범위 표시</b>출현 셀은 아직 발행되지 않았습니다. 지도에는 자료를 조회한 한반도 주변 범위를 표시합니다. ${esc(m.note)}</div>`:`<ul class="why">
<li><b>이용조건</b>${map3?`CC0·CC BY·CC BY-NC 4.0 기록을 썼습니다. CC BY-NC ${count(m.nc_records)}은 2026-10-01 결정에 따라 비상업 연구용으로 표시합니다.`:`CC0·CC BY 4.0 기록만 썼습니다. CC BY-NC ${count(m.nc_records)}은 비상업 이용 결정 전이라 쓰지 않았습니다.`}</li>
<li><b>좌표 품질</b>${map3?'OBIS 해안선 거리로 해안선에서 1 km보다 안쪽 육지 좌표를 제외했고(조간대 기록 보존)':'OBIS 해안선 거리로 육지 위 좌표를 제외했고'} 좌표를 옮기지 않았습니다. 불확실성 10 km 초과, 제공처가 흐리게 처리한 좌표, GBIF 좌표 오류 표시도 제외했습니다.</li>
<li><b>불확실성 결측</b>0으로 보지 않고 ${degree}° 셀에서만 썼습니다.</li>
<li><b>민감도</b>${degree===4?'채취 압력을 고려해 4° 광역 셀을 적용했습니다.':'아직 평가하지 않아 GBIF 지침에서 가장 엄격한 공개 수준인 1°를 적용했습니다.'}</li>
<li><b>중복·기존 자료</b>같은 표본 번호는 한 번만 셌고, 운영 DB에서 검토 중인 기존 기록은 쓰지 않았습니다.</li>
<li><b>비공개</b>원좌표와 기록 ID는 공개하지 않습니다.</li></ul>`;
  return `<h3>지도 셀</h3><p class="fine">선별된 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 보여줍니다(점 간격 = 기록 수 구간). 붉은 점은 실제 발견 좌표·조사 지점·기록 1건이 아니며 원좌표는 공개하지 않습니다.</p>${row('공개 셀',s.cells.length?`${spatialCells(s).length}개 · ${degree}°×${degree}°${spatialCells(s).length===s.cells.length?'':` · 기간별 ${s.cells.length}행`}`:'없음',s.cells.length?'done':'pending')}${s.cells.length?row(sitesLabel(s),count(cellSites(s),'곳')):''}${single?`<p class="fine">조사 지점이 1곳뿐인 셀 ${single}개: ${degree}° 범위 안의 대략적인 조사 위치가 드러납니다.</p>`:''}${m.note&&m.status!=='held_sensitivity_review'&&isMapRun(s)?`<p class="fine">${esc(m.note)}</p>`:''}<h3>${m.status==='held_sensitivity_review'?'지도 표시 기준':'왜 공개할 수 있는가'}</h3>${why}<h3>조회와 제외 <span class="fine">GBIF ${esc(m.retrieved)}</span></h3>${row('조회 기록(2000년 이후)',count(m.queried_records))}${row('CC0·CC BY 기록',count(m.open_records))}${map3?row('CC BY-NC 기록(비상업 연구용)',count(m.nc_records)):''}${excluded}<p class="fine">사유가 겹치는 기록은 사유마다 셉니다. 셀은 그 기간에 기록이 있었다는 뜻입니다. 분포 전체, 개체수, 자원량을 뜻하지 않습니다.</p>`;
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
  ? {color:'#7a0f1d',weight:.4,opacity:.55,fillColor:DOT_RED,fillOpacity:.8}
  : {color:'#ffffff',weight:.65,opacity:.9,fillColor:DOT_RED,fillOpacity:.88};
// Smaller schematic marks reveal the grid pattern; zoom caps and cell click areas stay independent.
function dotRadius(spacingDeg){
  const z=map.getZoom(), pxPerDeg=256*2**z/360;
  return Math.max(1.1,Math.min([1.5,1.5,1.8,2.2,2.6,3][Math.max(0,Math.min(5,z-3))],spacingDeg*pxPerDeg*.27));
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
function generalizationNote(size){
  const sens=size>=4?'채취 압력을 고려해 GBIF 지침의 가장 엄격한 등급(1°)보다 넓은 4° 셀 적용'
    :'민감도 미평가 → GBIF 지침의 가장 엄격한 공개 등급(1°) 적용';
  return `<br><b>공개 일반화 (GBIF 민감종 지침 용어)</b><ul><li>dataGeneralizations: 좌표를 ${size}° 셀로 일반화, 좌표 이동·무작위화 없음</li><li>informationWithheld: 원좌표·기록 ID 비공개</li><li>민감도: ${esc(sens)}</li><li>민감도 재검토 예정일: 미정(민감도 평가 후 결정)</li></ul>`;
}
function cellPopupNotice(size){
  return `<br><small>붉은 점은 실제 발견 좌표가 아닌 이 ${size}° 공개 셀의 도식적 표시입니다. 점의 촘촘함은 기록 수 구간만 나타내며, 각 점은 출현 위치·기록 1건·조사 지점 1곳이 아닙니다. 선별된 출현기록은 개체수·자원량·생물학적 가치·현재 한국 전체 분포가 아닙니다.</small>`;
}
// Faint frame so a coastal cell whose dots are mostly masked still reads as an aggregate area, not a point.
// Cell boundary in a non-red ink so it stays distinct from the red dots on every basemap.
const cellFrame=()=>({color:basemap==='basic'?'#1f4e6b':'#ffffff',weight:1.2,opacity:basemap==='basic'?.75:.9,dashArray:'4 4',fillColor:DOT_RED,fillOpacity:basemap==='basic'?.06:.1});
function setMapLegend(s){
  // Species without published cells only show the query extent (studyBounds).
  const extentOnly=s&&!s.cells.length, size=s?.cells?.[0]?.sizeDeg||1;
  document.querySelector('.map-symbol').hidden=!!extentOnly;
  $('map-symbol-label').textContent=extentOnly?'점선 테두리 = 자료를 찾아본 범위':`붉은 점 = 이 종 기록이 있는 ${size}° 칸 (실제 발견 좌표 아님)`;
  $('map-legend-note').textContent=extentOnly?'공개된 기록 칸이 없습니다. 테두리는 이 종이 사는 곳이나 분포가 아닙니다.':'점 간격: 칸 안의 기록이 많을수록 점이 촘촘합니다(1–4 · 5–19 · 20–99 · 100건 이상, 1°·4° 칸 모두 같은 면적 기준). 점 하나가 기록 하나는 아니고, 점 위치도 실제 발견 지점이 아닙니다. 점선 테두리가 칸의 경계이고, 육지 위에는 점을 그리지 않습니다. 칸을 누르면 실제 기록 수·기간·출처가 나옵니다.';
}

// Fitted cells stay clear of the floating controls (top-left buttons, bottom-left legend) so every cell can be clicked.
function fitPad(p){const h=sel=>document.querySelector?.(sel)?.getBoundingClientRect().height||0;return {paddingTopLeft:[p,p+h('.map-ui-tl')],paddingBottomRight:[p,p+h('.map-ui-bl')]};}
function renderCellMap(s,color){
  const degree=s.cells[0]?.sizeDeg||1;
  $('map-review-note').textContent=`선별된 ${s.catalog?'GBIF·OBIS':'GBIF'} 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 표시합니다. 붉은 점은 실제 발견 좌표가 아닌 공개 셀의 도식적 표시이며 가치·보전 등급도 아닙니다. 기록 수는 개체수·자원량·현재 분포나 한국 전체 분포를 뜻하지 않습니다.${s.catalog?' 2000년 이전 과거 기록과 한국·북한 EEZ 밖 기록은 셀 팝업에 따로 표시합니다. 양식·방류 개체는 원자료 표시가 없으면 구분하지 못합니다.':''}`;
  mapJudgmentStatus(s);
  for(const rows of spatialCells(s)){
    const c=rows[0], reasons=[...new Set(rows.flatMap(r=>cellAssessmentStatus(s,r).reasons))];
    // One hit area per spatial cell; every period row stays readable in its popup.
    const periods=rows.map(r=>`<li><b>공개 집계 기간 ${esc(r.period)}</b> · 기록 연도 ${esc(years(r))}${r.historical?'<br><b>과거 기록(2000년 이전) · 현재 분포 근거 아님</b>':''}${r.outsideKoreanEEZ?'<br><b>한국·북한 EEZ 밖 기록</b>':''}<br>선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳${r.uncertaintyMissing?` · 좌표 불확실성 결측 ${esc(r.uncertaintyMissing)}건`:''}<br>해역 메타데이터 ${esc(r.seaAreas.map(x=>x==='해역명 미확인'?x:'LME '+seaName(x)).join(', '))}${r.countries?' · 국가 메타데이터 '+esc(r.countries.join(', ')||'미기재'):''}<br>출처·이용조건<ul>${occurrenceCitationLinks(r)||'<li>셀별 제공처 확인 필요</li>'}</ul></li>`).join('');
    cellLayers.push(L.rectangle([[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]],cellFrame()).addTo(overlay));
    cellLayers.at(-1).bindPopup(`<strong>${esc(s.label)} · 선별 출현기록 ${c.sizeDeg}° 셀</strong><br><b>해역별 활용·보전 판단: 보류</b><br>${esc(speciesAxesLine(s))}<br>공간 해상도 ${c.sizeDeg}°×${c.sizeDeg}° · 가장 짧은 변 약 ${esc(Number.isFinite(c.resolutionM)?Math.floor(c.resolutionM/1000):'미확인')} km<br>${rows.length>1?`기간 ${rows.length}개 · 선별 기록 합계 ${esc(rows.reduce((a,r)=>a+r.records,0))}건. 같은 지점이 여러 기간에 있을 수 있어 조사 지점은 기간별로만 셉니다.<br>`:''}<b>${rows.length>1?'기간별 근거':'이 셀의 근거'}</b><ol class="cell-periods">${periods}</ol><b>판단 보류 이유</b><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>공개 기준(이용조건·좌표 품질)을 통과한 일부 기록입니다. 조사 노력·중복·시기·경계 효과가 해역 간 비교용으로 보정되지 않았습니다. 원좌표·개체수·자원량·한국 전체 분포가 아닙니다.</small>`+effortLine(c.lat0,c.lon0,c.sizeDeg)+generalizationNote(c.sizeDeg)+cellPopupNotice(c.sizeDeg));
    addCellDots(c.lat0,c.lon0,c.sizeDeg,rows.reduce((a,r)=>a+r.records,0)); // one pattern per spatial cell
  }
  // Not animated: Leaflet 1.1 drops a fit requested while another zoom animation runs (quick species switches).
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{...fitPad(40),maxZoom:7,animate:false});}
  $('map-count').textContent=cellRecords(s).toLocaleString();$('map-cells').textContent=spatialCells(s).length;$('map-years').textContent=cellYears(s);
}
// The same cell evidence as the popups, as a table: reachable by keyboard and screen readers, and without the map.
let cellLayers=[];
function renderCellTable(s){
  const box=$('cell-table');
  if(!s?.cells?.length){box.innerHTML='';return;}
  const groups=spatialCells(s);
  const range=c=>`${c.lat0}–${c.lat0+c.sizeDeg}°N · ${c.lon0}–${c.lon0+c.sizeDeg}°E`;
  const rows=groups.map((g,i)=>{
    const c=g[0];
    const detail=g.map(r=>`<div>${esc(r.period)}${r.historical?' · 과거 기록(2000년 이전)':''}${r.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':''} · 해역 ${esc((r.seaAreas||[]).map(seaName).join(', ')||'미확인')} · 기록 연도 ${esc(years(r))} · 선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳<ul>${occurrenceCitationLinks(r)||'<li>셀별 제공처 확인 필요</li>'}</ul></div>`).join('');
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
  if(!s||periodFilter==='all')return s;
  const cells=s.cells.filter(c=>c.period===periodFilter);
  return cells.length?{...s,cells}:s;
}
function renderPeriodFilter(s){
  // Chronological: a "2000년 이전" label must not sort between the numeric ranges.
  const first=p=>Math.min(...s.cells.filter(c=>c.period===p).map(c=>c.yearStart));
  const box=$('period-filter'), periods=s?[...new Set(s.cells.map(c=>c.period))].sort((a,b)=>first(a)-first(b)):[];
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
  return n===null?'':`<br>조사량 참고: 이 셀 범위의 OBIS 전체 종 기록 ${n.toLocaleString()}건(${esc(effortData.startdate.slice(0,4))}년 이후) · 이 종의 존재·개체수와 무관`;
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
  const head=['species_label','scientific_name','aphia_id','cell_south','cell_north','cell_west','cell_east','cell_deg','period','year_start','year_end','records','sites','sources','licenses','sea_areas','note'];
  const note='공개 집계 셀 · 실제 발견 좌표 아님 · 해역별 판단 보류';
  const rows=s.cells.map(c=>[s.label,s.name,s.aphiaID,c.lat0,c.lat0+c.sizeDeg,c.lon0,c.lon0+c.sizeDeg,c.sizeDeg,c.period,c.yearStart,c.yearEnd,c.records,c.sites,(c.citations||[]).map(x=>x.title).join('; '),(c.licenses||[...new Set((c.citations||[]).flatMap(x=>x.licenses||[]))]).join('; '),(c.seaAreas||[]).join('; '),note+(c.historical?' · 2000년 이전 과거 기록':'')+(c.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':'')]);
  return '﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n');
}
// Shareable view: species, tab, basemap, period, map view and use-trait chip live in the URL hash.
function readHash(){try{return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));}catch{return {};}}
function writeHash(){
  if(!data||!selected)return;
  const p=new URLSearchParams({s:selected.aphiaID,v:currentView,b:basemap,t:mapMode});
  if(periodFilter!=='all')p.set('p',periodFilter);
  if(activeUse)p.set('u',activeUse);
  if(map){const c=map.getCenter();p.set('m',`${map.getZoom()}/${c.lat.toFixed(2)}/${c.lng.toFixed(2)}`);}
  try{history.replaceState(null,'','#'+p.toString());}catch{}
}
function applyHash(h){
  const s=data?.species.find(x=>x.aphiaID===Number(h.s));
  if(s)selectSpecies(s.aphiaID);
  if(h.p&&selected?.cells.some(c=>c.period===h.p)){periodFilter=h.p;renderMap();}
  if(h.u&&traitById(h.u))setUse(h.u); // a chip that has no evidence in this report stays off
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
    if(!useMatch(s))continue;
    for(const c of periodView(s).cells){
      const lat=c.lat0,lon=c.lon0,size=c.sizeDeg;
      if(![lat,lon,size].every(Number.isFinite))continue;
      const key=valueCellKey(lat,lon,size);
      if(!groups.has(key))groups.set(key,{lat,lon,size,species:new Map(),records:new Map()});
      const g=groups.get(key);g.species.set(s.aphiaID,s);
      if(Number.isFinite(c.records??c.count))g.records.set(s.aphiaID,(g.records.get(s.aphiaID)||0)+(c.records??c.count));
    }
  }
  return groups;
}
// Figure 5 legend colours. A cell with several typed species takes the first type in the report's precedence.
const matrixTypeColour={baseline_survey:'#3f7fcf',sustainable_use:'#2f9a57',conservation_priority:'#d7392f',alternative_production:'#f2b233'};
function cellMatrixType(g){
  const counts={};
  for(const s of g.species.values()){const t=matrixType(s);if(t)counts[t]=(counts[t]||0)+1;}
  return {type:(matrixRule()?.cell_colour_precedence||[]).find(t=>counts[t])||null,counts};
}
const sufficiencyLayers={priority:false,unexplored:false};
function valueSpeciesType(s){
  const t=matrixType(s),a=s.assessment,i=a?.information_sufficiency;
  const nationalOff=!t&&nationalMcui(s)&&pilotScore(s,'BBVI')!==null&&matrixRule()&&!matrixRule().include_national_mcui;
  const type=t?`매트릭스 유형 <b>${esc(matrixTypeLabel(t))}</b> · BBVI ${pilotScore(s,'BBVI').toFixed(1)}(현재 가중치) × MCUI ${pilotScore(s,'MCUI').toFixed(1)}${separateMcui(s)?'('+mcuiBasisLabel(s)+')':''}`
    :nationalOff?'매트릭스 유형 없음 · 국가 평가 기반 MCUI는 이 규칙에서 매트릭스 제외(두 값은 산출됨)'
    :'매트릭스 유형 없음 · BBVI·MCUI 한 쌍 미산출(낮은 가치라는 뜻이 아님)';
  // 3.4: the label has two reasons; only the sufficiency reason quotes the 50% cut
  const why=a?.priority_survey_reasons||['low_information_sufficiency'];
  const survey=!a?.priority_survey?Math.round(i?.mean_ratio*100)+'%'
    :(why.includes('low_information_sufficiency')?sufficiencyCut(a):Math.round(i.mean_ratio*100)+'%')+' · 우선 조사 대상('+why.map(w=>w==='low_information_sufficiency'?'정보충분도':surveyLabels()[w]||w).join(' · ')+')';
  const info=i?` · 정보충분도 ${survey}${a.unexplored_candidate?' · 미탐색 후보(같은 '+esc(rankKo[a.unexplored_candidate.rank]||a.unexplored_candidate.rank)+' '+esc(a.unexplored_candidate.taxon)+')':''} (점수와 별도)`:'';
  return '<p class="value-type">'+type+info+'</p>';
}
// Larger extents first and typed cells last, so a held 4° extent never covers a coloured 1° cell or takes its click.
const valueCellOrder=groups=>[...groups].sort(([,a],[,b])=>b.size-a.size||!!cellMatrixType(a).type-!!cellMatrixType(b).type);
function valueCellStyle(g,active){
  const {type,counts}=cellMatrixType(g),mixed=Object.keys(counts).length>1;
  return type?{color:active?'#173f62':mixed?'#102e45':matrixTypeColour[type],weight:active?2.5:mixed?2:1.5,dashArray:mixed?'2 3':null,
      fillColor:matrixTypeColour[type],fillOpacity:active?.62:.48}
    :{color:active?'#173f62':'#657588',weight:active?2.5:1.5,dashArray:'5 4',fillColor:'#b7c0ca',fillOpacity:active?.36:.25};
}
// Typed species whose MCUI is national: the cell colour then rests on a Korean national assessment.
const nationalTyped=g=>[...g.species.values()].filter(s=>matrixType(s)&&separateMcui(s)).length;
// Flagged species on the map and without a public cell, so an empty layer is explained rather than silent.
function sufficiencyCounts(groups){
  const onMap=new Set([...groups.values()].flatMap(g=>[...g.species.keys()]));
  return Object.fromEntries([['priority','priority_survey'],['unexplored','unexplored_candidate']].map(([layer,flag])=>{
    const all=(data?.species||[]).filter(s=>s.assessment?.[flag]);
    return [layer,{n:all.length,shown:all.filter(s=>onMap.has(s.aphiaID)).length,missing:all.filter(s=>!onMap.has(s.aphiaID)).map(s=>s.label)}];
  }));
}
function valueSpeciesCard(s,records){
  const blockers=assessmentBlockers(s),report=data.assessmentInfo||{};
  const scores=['BBVI','MFPI','MBPI','MCUI'].map(k=>{
    const st=axisState(s,k),n=st.value;
    const state=n===null?(st.kind==='withheld'?'산출 보류':st.label):n.toFixed(1)+(k==='MCUI'&&separateMcui(s)?' · '+mcuiBasisLabel(s)+' 시범 · IUCN 기반과 비교 불가':' · '+pilotLabel(k));
    return '<div class="value-axis"><b>'+k+'</b><span>'+esc(state)+'</span>'+(n===null?'<small>'+esc(axisStateNote[st.kind]||blockers[k]||'필수 근거 미확인')+'</small>':'')+'</div>';
  }).join('');
  const stage=evidenceCoverage(s).checks.map(c=>c.name+' '+coverageStages[c.stage]).join(' · ');
  const sourceIds=s.assessment?.source_ids||[];
  const sources=sourceIds.map(id=>report.sources?.[id]).filter(Boolean);
  const refIds=mcuiReference(s)?.source_ids||[];
  const links=sources.map((src,i)=>'<li>'+(refIds.includes(sourceIds.filter(id=>report.sources?.[id])[i])?'참고 정보(점수 아님) · ':'')+sourceLink(src.url,src.title||src.name||'지표 근거')+' · '+esc(src.license||'이용조건 미기재')+' · 조회 '+esc(src.accessed||'미기재')+'</li>').join('');
  const raw=s.assessment?.food_trace?.nutrients;
  const rawText=raw?Object.entries(raw).map(([k,v])=>k+' '+(v.substitute?'원자료 결측 → '+v.substitute.label+' '+substituteRef(v.substitute)+' '+num(v.value):num(v.value))+' '+(v.unit||'단위 미확인')+' / '+(v.sample_state||s.assessment.food_trace.sample_state||'시료 상태 미기재')).join(' · '):'원값은 종별 지표 상세에서 확인';
  const cons=s.assessment?.conservation_trace;
  // One line per species (name + four axis values); the evidence text opens on demand.
  const pills=['BBVI','MFPI','MBPI','MCUI'].map(k=>{const n=axisState(s,k).value;return '<span class="vs-pill'+(n===null?' held':'')+'">'+k+' '+(n===null?'–':n.toFixed(1))+'</span>';}).join('');
  return '<details class="value-species"><summary><h4>'+esc(s.label)+' <small>'+esc(s.name)+'</small></h4><span class="vs-pills">'+pills+'</span></summary><div class="value-species-body">'+
    '<p>종 단위 근거 · AphiaID '+esc(s.aphiaID)+' · '+esc(stage)+(Number.isFinite(records)?' · 이 셀 출현 기록 '+records.toLocaleString()+'건':'')+'</p>'+valueSpeciesType(s)+
    '<div class="value-axes">'+scores+'</div><p class="fine">원자료(점수 아님): '+esc(rawText)+
    (nationalMcui(s)?' · 한국 국가생물적색자료집 '+esc(s.assessment.national_assessment.category)+' / 목록 '+esc(s.assessment.national_assessment.list_page_printed)+'쪽 · '+esc(iucnGlobalNote(s))
      :cons?' · IUCN '+esc(cons.category||'등급 미기재')+' / 평가 '+esc(cons.assessment_date||cons.assessment_year||'일자 미기재'):'')+'</p>'+
    '<p class="fine">평가 보고서 '+esc(report.generatedAt?.slice(0,10)||'미발행')+
    ' · 출현 자료 '+esc(s.publishedAt?.slice(0,10)||data.collectedAt||'미기재')+
    ' · 이용조건: '+esc('운영 8종 GBIF CC0·CC BY 4.0 · 후보 22종 GBIF·OBIS CC0·CC BY·CC BY-NC 4.0(비상업 연구용)')+'</p>'+
    (links?'<details><summary>지표 근거 원문과 이용조건</summary><ul>'+links+'</ul></details>':'<p class="fine">이 종에 연결된 지표 근거 원문은 아직 없습니다.</p>')+
    '<button type="button" class="text-button" data-value-species="'+esc(s.aphiaID)+'">종별 상세 근거 보기 →</button></div></details>';
}
function showValueCell(key){
  selectedValueCell=key;
  const group=valueCellGroups().get(key),panel=$('value-cell-detail');
  if(!group){panel.innerHTML='<p>선택한 공개 격자가 현재 기간의 자료에 없습니다. 지도의 다른 격자를 선택하세요.</p>';return;}
  const species=[...group.species.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
  panel.innerHTML='<h3>선택한 공개 격자 · 종별 근거</h3><p>'+
    esc(group.lat)+'–'+esc(group.lat+group.size)+'°N · '+esc(group.lon)+'–'+esc(group.lon+group.size)+'°E ('+esc(group.size)+'° 공개 범위)</p>'+
    '<p class="fine">연결 종 '+species.length+'종 · 해당 공개 셀에 기록이 있는 종만 표시합니다. 지표는 종 전체에 대한 시범값이며 이 해역에서 측정한 값이 아닙니다. 셀의 합산 점수·우선순위는 산출하지 않았습니다.'+cellTypeLine(group)+'</p>'+
    species.map(s=>valueSpeciesCard(s,group.records?.get(s.aphiaID))).join('');
  panel.querySelectorAll('[data-value-species]').forEach(button=>button.addEventListener('click',()=>{
    selectSpecies(Number(button.dataset.valueSpecies));
    const detail=$('detail');detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
}
function cellTypeLine(g){
  if(!matrixRule())return '';
  const {type,counts}=cellMatrixType(g),kinds=Object.entries(counts),typedN=kinds.reduce((n,[,k])=>n+k,0),nat=nationalTyped(g);
  if(!type)return ' 이 셀에는 매트릭스 유형을 산출한 종이 없어 회색 음영·점선 테두리(판단 보류)로 둡니다.';
  return ` 셀 색 ${matrixTypeLabel(type)} · 유형 산출 ${typedN}종(${kinds.map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')})${nat?' · 국가 평가 기반 MCUI '+nat+'종':''}${g.species.size>typedN?' · 유형 없음 '+(g.species.size-typedN)+'종':''}${kinds.length>1?' · 여러 유형이라 우선순위 규칙으로 한 색 선택':''}. 색은 출현 기록 셀 × 종 유형이며 해역의 자원량·분포가 아닙니다.`;
}
const cellCentre=g=>[g.lat+g.size/2,g.lon+g.size/2];
function drawSufficiency(g){
  const names=flag=>[...g.species.values()].filter(s=>s.assessment?.[flag]).map(s=>s.label);
  const layers=[['priority','priority_survey','우선 조사 대상(정보충분도 낮음 또는 보전 평가 없음)',{color:'#102e45',fillColor:'#ffffff',radius:7,weight:2,dashArray:null}],
    ['unexplored','unexplored_candidate','미탐색 후보(근연종 BBVI 높음)',{color:'#6b3fa0',fillColor:'#efe6fa',radius:4,weight:2,dashArray:'2 2'}]];
  for(const [layer,flag,label,style] of layers){
    const list=names(flag);
    if(!sufficiencyLayers[layer]||!list.length)continue;
    // not interactive: the cell rectangle under it keeps the click and carries the names in its tooltip
    L.circleMarker(cellCentre(g),{...style,fillOpacity:.9,interactive:false}).addTo(overlay);
  }
}
function sufficiencyTip(g){
  const part=(layer,flag,label)=>{
    const list=[...g.species.values()].filter(s=>s.assessment?.[flag]).map(s=>s.label);
    return sufficiencyLayers[layer]&&list.length?' · '+label+' '+list.length+'종('+list.join(', ')+')':'';
  };
  return part('priority','priority_survey','우선 조사 대상')+part('unexplored','unexplored_candidate','미탐색 후보');
}
function renderValueMap(){
  const groups=valueCellGroups(),panel=$('value-cell-detail'),rule=matrixRule();
  const typed=[...groups.values()].filter(g=>cellMatrixType(g).type).length;
  $('map-source').textContent='활용 × 보전 · GBIF 공개 격자';
  const cut=data.assessmentInfo?.method?.unexplored_threshold;
  $('value-rule').textContent=rule?`기준: BBVI·MCUI 각 ${rule.bbvi_threshold} 이상이면 높음(BBVI는 현재 가중치, 소수 한 자리로 반올림한 값에 적용). 여러 종이 있는 셀은 ${rule.cell_colour_precedence.map(matrixTypeLabel).join(' > ')} 순으로 한 색을 쓰고, 유형이 섞인 셀은 촘촘한 점선 테두리로 표시합니다.${Number.isFinite(cut)?` 우선 조사 대상은 필수 입력 충족 비율 평균이 ${Math.round(cut*100)}% 미만인 종${data.assessmentInfo?.method?.conservation?.no_assessment?'과, IUCN 평가가 없거나 DD이고 국가 평가도 없어 MCUI가 없는 종'+(data.assessmentInfo.method.mcui_substitutes?'(예비 평가 참고 정보만 있는 종 포함)':''):''}입니다.`:''}`:'이 보고서에는 매트릭스 유형 규칙이 없어 모든 셀을 판단 보류로 둡니다.';
  $('map-review-note').textContent=rule?'공개 격자를 선택하면 그 셀에 기록된 종별 BBVI·MCUI·영양 원값·출현 기록과 보류 사유를 볼 수 있습니다. 색은 출현 기록이 있는 셀 × 종 유형이며 해역의 자원량·분포·해역 점수가 아닙니다.':'공개 격자를 선택하면 연결 종의 식량·생리활성·보전 지표와 보류 사유를 확인할 수 있습니다. 모든 격자는 판단 보류이며 회색 음영·점선 테두리는 가치·보전 등급이 아닙니다.';
  $('map-judgment').textContent=rule?`종 유형으로 칠한 공개 격자 ${typed}곳 · 유형 산출 종이 없는 격자 ${groups.size-typed}곳(회색 음영·점선 테두리). 셀의 합산 점수나 해역 등급은 만들지 않습니다.`:'해역별 조합 분류 0곳 · 공개 격자 '+groups.size+'개 판단 보류. 종별 BBVI·MCUI 한 쌍과 검증된 해역 집계 규칙이 없어 네 유형으로 분류하지 않습니다.';
  if(activeUse){const c=traitById(activeUse);$('map-judgment').textContent+=` 활용 특성 ‘${c.group} · ${c.label}’ 칩 적용 중: 그 근거가 있는 종의 셀만 표시합니다(출현 기록 보기에는 적용하지 않음).`;}
  const layerCounts=sufficiencyCounts(groups);
  $('layer-priority-count').textContent=`${layerCounts.priority.n}종 · 지도 표시 ${layerCounts.priority.shown}종`;
  $('layer-unexplored-count').textContent=`${layerCounts.unexplored.n}종 · 지도 표시 ${layerCounts.unexplored.shown}종`;
  const noCell=[['우선 조사 대상',layerCounts.priority],['미탐색 후보',layerCounts.unexplored]].filter(([,c])=>c.missing.length);
  $('layer-nocell').textContent=noCell.map(([name,c])=>`${name} 중 공개 출현 셀이 없어 지도에 표시되지 않는 종 ${c.missing.length}종: ${c.missing.join(', ')}`).join(' · ')+
    (noCell.length?'. 셀이 없다는 것은 종 부재나 분포 없음을 뜻하지 않습니다.':'');
  $('map-count').textContent='—';$('map-cells').textContent=String(groups.size);$('map-years').textContent='—';
  if(!groups.size){panel.innerHTML='<h3>공개 격자 없음</h3><p>이 자료와 기간에는 공개된 출현 격자가 없어 종을 해역에 연결할 수 없습니다. 종 목록에서 개별 근거를 확인하세요.</p>';return;}
  if(!selectedValueCell||!groups.has(selectedValueCell))selectedValueCell=groups.keys().next().value;
  showValueCell(selectedValueCell);
  if(selected?.catalog&&!selected.cells.length)$('value-cell-detail').insertAdjacentHTML('afterbegin','<p class="catalog-alert">선택한 종은 공개 가능한 출현 격자가 없어 아래 격자와 연결되지 않습니다. 격자를 누르면 다른 종의 근거를 볼 수 있습니다.</p>');
  if(!map)return;
  if(!map.getPane('valueGlow')){map.createPane('valueGlow').style.zIndex=390;}
  for(const g of groups.values()){const t=cellMatrixType(g).type;if(t)L.rectangle([[g.lat-g.size*.15,g.lon-g.size*.15],[g.lat+g.size*1.15,g.lon+g.size*1.15]],{pane:'valueGlow',stroke:false,fillColor:matrixTypeColour[t],fillOpacity:.5,interactive:false}).addTo(overlay);}
  for(const [key,g] of valueCellOrder(groups)){
    const active=key===selectedValueCell,{type,counts}=cellMatrixType(g),mixed=Object.keys(counts).length>1,nat=nationalTyped(g);
    const layer=L.rectangle([[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]],valueCellStyle(g,active)).addTo(overlay);
    const untyped=g.species.size-Object.values(counts).reduce((n,k)=>n+k,0);
    layer.bindTooltip('공개 '+g.size+'° 격자 · '+g.species.size+'종 · '+(type?'색 '+matrixTypeLabel(type)+(mixed?' · 유형 혼재 ':' · ')+Object.entries(counts).map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')+(nat?' · 국가 평가 기반 MCUI '+nat+'종':'')+(untyped?' · 유형 없음 '+untyped+'종':''):'유형 산출 종 없음 · 판단 보류')+sufficiencyTip(g));
    drawSufficiency(g);
    layer.on('click',()=>{showValueCell(key);renderMap();panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  if(lastFitted!=='value'){
    lastFitted='value';
    map.fitBounds([...groups.values()].flatMap(g=>[[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]]),
      {...fitPad(35),maxZoom:7,animate:false});
  }
}
function setMapMode(mode){
  if(!['occurrence','value'].includes(mode))return;
  mapMode=mode;lastFitted=null;
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode)));
  $('occurrence-legend').hidden=mode==='value';$('value-legend').hidden=mode!=='value';
  $('value-cell-detail').hidden=mode!=='value';
  $('effort-toggle').disabled=mode==='value';
  renderMap();writeHash();
}

// Short status next to the map so phones see name, published/candidate and index summary without reaching the detail pane.
function renderMapSelected(s){
  const where=s.catalog&&s.cells.length?s.status+' · 현재 분포 아님':s.status;
  $('map-selected').innerHTML=`<b>${esc(s.label)}</b> <span class="kind${s.catalog?' cand':''}">${s.catalog?'조사 후보':'운영 발행'}</span> <span>${esc(scoreSummary(s))} · ${esc(where)}</span>`;
}
function renderMap() {
  if(selected)renderMapSelected(selected);
  renderPeriodFilter(selected);
  if(mapMode==='value'){$('cell-table').innerHTML='';}else renderCellTable(periodView(selected)); // before the map check: the table also works when the map failed to load
  if(map)map.invalidateSize(); // the detail pane can change the map column height
  overlay?.clearLayers();dotCells=[];cellLayers=[];
  if(mapMode==='value'){effortLayer?.clearLayers();renderValueMap();return;}
  if(!map)return;
  const s=selected;if(!s)return;const color=colors[data.species.indexOf(s)%colors.length];
  $('map-source').textContent=s.catalog?(s.cells.length?`조사 후보 · 검수 기록 공개 ${s.cells[0].sizeDeg}° 셀`:s.review?'조사 후보 · 공개 가능한 기록 없음':'조사 후보 · '+releaseMissing(s)):s.cells.length?`공개 기준 자료 · 공개 ${s.cells[0].sizeDeg}° 셀`:'공개 기준 자료 · 자료 조회 범위';
  setMapLegend(s);
  if(s.catalog&&!s.cells.length){$('map-symbol-label').textContent=s.review?'공개 기준 통과 기록 없음 · 셀 없음':releaseMissing(s)+' · 셀 없음';$('map-legend-note').textContent='빈 지도는 해당 종이 이 해역에 없다는 뜻이 아닙니다.';}
  $('effort-toggle').disabled=!!s.catalog;
  if(s.catalog)effortLayer?.clearLayers();else drawEffort();
  if($('detail-map-summary'))$('detail-map-summary').innerHTML=mapSummaryHtml(periodView(s));
  if(s.cells.length)return renderCellMap(periodView(s),color);
  // verified-pilot-3.2: the type line replaces the old 'both withheld' wording, which no longer holds once a candidate is typed
  if(s.catalog){if(matrixRule())mapJudgmentStatus(s);else $('map-judgment').textContent=(pilotScore(s,'MBPI')!==null?'종별 시범 MBPI만 산출 · BBVI·MCUI와 해역 판단 보류 · ':'종별 점수와 해역 판단 모두 보류 · ')+(s.review?'공개 가능한 출현기록 없음':'출현 '+releaseMissing(s));$('map-review-note').textContent=s.review?`${reviewLine(s.review)}. 제외 사유: ${withheldLine(s.review)}. 셀이 없는 것은 종 부재나 전체 분포를 뜻하지 않습니다.`:'출현 검수 파일을 확인하지 못해 셀을 표시하지 않습니다. 종 부재가 아닙니다.';
    $('map-count').textContent='—';$('map-cells').textContent='0';$('map-years').textContent='—';return;}
  mapJudgmentStatus(s);
  $('map-review-note').textContent='테두리는 자료를 조회한 범위(124–132°E · 33–38.7°N)입니다. 이 종의 출현 위치나 분포를 뜻하지 않습니다.';
  L.rectangle(studyBounds,{color:basemap==='basic'?'#267bab':'#ffd166',weight:2,dashArray:'10 7',fillColor:'#267bab',fillOpacity:.07})
    .addTo(overlay).bindPopup(`<strong>${esc(s.label)} · 자료 조회 범위</strong><br>124–132°E · 33–38.7°N<br><small>출현 위치나 분포 범위가 아닙니다.</small>`);
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(studyBounds,{padding:[30,30],animate:false});}
  $('map-count').textContent='0';$('map-cells').textContent='0';$('map-years').textContent='—';
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
  map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7});L.control.zoom({position:'bottomright'}).addTo(map);fitMap();
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
    const st=axisState(s,key);
    // Lookup failures and technical errors are shown as such, with the button still opening the explanation.
    if(st.kind==='lookup_failed'||st.kind==='technical_error'||st.kind==='client_outdated')
      return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${st.label} 설명 보기">${esc(st.label)}<small>산출 보류 아님 · 보기</small></button>`;
    if(!VERIFIED.includes(s.assessment?.report_version))return pilotScore(s,key)!==null?pilotCell(s,key):null;
    const value=st.value,status=st.label;
    const cohort=key==='MFPI'&&value!==null?s.assessment.food_trace?.cohort_id:null;
    const cohortLabel=cohort==='rda-10.4-raw-marine-animals'?'수산동물':cohort==='rda-10.4-raw-seaweeds'?'해조류':cohort;
    const cohortCount=cohort?(data.assessmentInfo?.cohorts||[]).find(c=>c.cohort_id===cohort)?.food_item_ids?.length:null;
    const mbpiLabel=key==='MBPI'&&value!==null?s.assessment.mbpi_label:null;
    const mcuiRef=key==='MCUI'&&value===null&&mcuiReference(s)?`예비 평가 참고 · ${mcuiReference(s).category} 가능성${rapidLcCheck()?' · '+rapidLcCheck():''} · 점수 아님`:null;
    const reference=key==='BBVI'&&value===null?bbviReference(s):null;
    if(reference!==null)return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} BBVI 참고값 ${reference.toFixed(1)} · ${esc(s.assessment.mbpi_label||'단일 논문')} · 점수·매트릭스 미사용 근거 보기">`+
      `${reference.toFixed(1)}<small>BBVI 참고값 · ${esc(s.assessment.mbpi_label||'단일 논문')} · 점수·매트릭스 미사용 · 보기</small>`+(s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')+'</button>';
    return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${value===null?status:value.toFixed(1)}${mbpiLabel?' · '+esc(mbpiLabel):''}${cohort?' · '+esc(cohortLabel)+' 고정 비교집단 · 다른 집단과 비교 불가':''}${mcuiRef?' · '+esc(mcuiRef):''} 근거 보기">`+
      `${value===null?esc(status):value.toFixed(1)}<small>${value===null?esc(shortReason[s.assessment.withheld_reasons?.[key]]||'근거·보류 사유')+' · 보기':pilotLabel(key)+(mbpiLabel?' · '+esc(mbpiLabel):'')+' · 근거 보기'}</small>`+
      (cohort?`<small>고정 비교집단 ${esc(cohortLabel)}${cohortCount?' '+cohortCount+'개 식품':''} · 집단 간 점수 비교 불가</small>`:'')+
      (key==='MCUI'&&separateMcui(s)?'<small>'+esc(mcuiBasisLabel(s))+' · IUCN 기반 MCUI와 비교 불가</small>':'')+
      (mcuiRef?`<small>${esc(mcuiRef)}</small>`:'')+
      (s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')+'</button>';
  };
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],
    ['출현기록',s=>`<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="OCC" aria-label="${esc(s.label)} 출현기록 지도·셀 목록 보기">`+occurrenceCell(s)+'<small>지도·셀 목록 보기</small></button>'],
  ];
  function occurrenceCell(s){return s.cells.length?`${cellCountLabel(s)} · ${sitesLabel(s)} ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 ${s.cells[0].sizeDeg}° 셀 · ${s.info?.map?.source||'GBIF CC0·CC BY'}${flaggedRecords(s,'historical')?` · 2000년 이전 ${flaggedRecords(s,'historical')}건`:''}</small>`:s.catalog?pending(s.review?`${reviewLine(s.review)} · 공개 셀 없음`:releaseMissing(s)):s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · 조사 범위 표시<small>${years(s)} · 조회·선별된 자료</small>`;}
  entries.push(
    ['식량 근거 · MFPI',s=>axisCell(s,'MFPI')||(s.catalog&&s.audit?.nutrition?.foodCode?pending('RDA 식품명 후보 · 종 연결 보류'):v2(s,({nutrition:n={}})=>n.status==='available'?`영양 기록 ${count(n.record_count)}<small>수집 현황 · 단위/가식부 검증 전 · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인'))],
    ['생리활성 · MBPI',s=>axisCell(s,'MBPI')||v2(s,({compounds:c={}})=>c.status==='available'?`보고 화합물 ${count(c.compound_count,'개')}<small>${c.quantitative_bioactivity_count===0?'정량 활성 자료 없음':'정량 활성 자료 '+count(c.quantitative_bioactivity_count)}</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['보전 평가 · MCUI',s=>axisCell(s,'MCUI')||(s.catalog&&s.audit?.iucn?.record?.category?pending('IUCN 체크리스트 '+s.audit.iucn.record.category+' · 점수 보류'):v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),IUCN_HISTORICAL[s.aphiaID]?'산출 보류':'평가 미조회')+(IUCN_HISTORICAL[s.aphiaID]?`<small>IUCN ${IUCN_HISTORICAL[s.aphiaID].category} · ${IUCN_HISTORICAL[s.aphiaID].published}년 발표 · 역사적 평가 · 현행 평가 확인 보류</small>`:''))],
    ['자료 연결 현황',s=>`<span class="sr-only">5개 항목의 검증 단계 · 점수 아님</span>${coverageBar(s)}<small>발견·종 연결·원문 확인·${Object.values(data.assessmentInfo?.method?.posthoc?.validation_sets||{}).some(v=>v.result==='passed')?'시범 산출·방법 검증 통과를':'시범 산출을'} 구분 · 점수 아님</small>`],
    ['통합점수 · BBVI',s=>axisCell(s,'BBVI')||'<strong>산출 보류</strong>']);
  $('comparison').innerHTML=`<p class="fine coverage-guide">${esc(coverageGuide)} 각 지표 칸을 누르면 원값·원문·보류 사유가 열립니다.</p><table><caption class="sr-only">탐색 후보 ${data.species.length}종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${compared.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${compared.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('comparison').querySelectorAll('[data-score-aphia]').forEach(button=>button.addEventListener('click',()=>
    openEvidence(Number(button.dataset.scoreAphia),button.dataset.scoreAxis)));
}
// One open behaviour for every comparison button: occurrence opens the map and cell list, an index axis
// opens its evidence. Collapsed parents are opened, and the return button restores page, scroll and focus.
function openEvidence(aphia,axis){
  const page=comparisonPage, returnScroll=$('comparison').scrollLeft;
  if(axis==='OCC'){lastFitted=null;if(mapMode!=='occurrence')setMapMode('occurrence');}
  selectSpecies(aphia);setView('explore',false);
  const back=document.createElement('button');
  back.type='button';back.className='text-button comparison-return';back.textContent='← 비교표로 돌아가기';
  $('detail').prepend(back);
  back.addEventListener('click',()=>{
    comparisonPage=page;renderComparison();setView('compare');
    const cell=$('comparison').querySelector(`[data-score-aphia="${aphia}"][data-score-axis="${axis}"]`);
    cell?.focus({preventScroll:true});cell?.scrollIntoView({block:'center'});
    $('comparison').scrollLeft=returnScroll;
  });
  const target=axis==='OCC'?($('cell-table').querySelector('details')||$('detail-map-summary')):$('detail').querySelector(`[data-axis="${axis}"]`);
  if(!target){back.focus();return;}
  for(let d=target.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;
  const focus=target.matches('details')?target.querySelector('summary'):target;
  if(!focus.matches('summary,button,a'))focus.tabIndex=-1;
  focus.focus({preventScroll:true});
  (axis==='OCC'&&target.closest('#cell-table')?$('map'):target).scrollIntoView({behavior:'smooth',block:'start'});
}

// The BBVI weight only matters once some species has both MFPI and MBPI.
function updateWeightControl(){
  const n=data.species.filter(s=>pilotScore(s,'BBVI')!==null).length;
  $('bbvi-weight').disabled=!n;
  $('bbvi-weight-status').textContent=n?`BBVI 산출 종 ${n}종`:'BBVI 산출 종 0종 · MFPI·MBPI와 BBVI의 독립 근거 조건을 모두 충족하면 조절됩니다';
}
const matrixReasonLabel={food_row_not_species_specific:'종별 식품 원값 연결 필요',component_missing_in_source:'필수 영양 성분 결측',not_in_red_list:'IUCN 평가 검색 미확인',assessment_lookup_failed:'IUCN 원평가 조회 필요',origin:'기원종',structure_id:'확정 구조',quantitative_endpoint:'정량 시험',comparable_cohort:'동일 조건 비교집단',species_link:'식품 행의 종 연결',raw_nutrition:'영양 원값',complete_raw_nutrition:'단백질·철·아연 원값',edible_fraction:'가식부 비율',aquaculture:'양식 근거',fixed_comparable_cohort:'고정 비교집단',comparable_nutrition_missing:'고정 비교집단의 종 행',requires_MFPI_and_MBPI:'MFPI·MBPI 둘 다 필요',mbpi_single_source:'MBPI 독립 원논문 부족',aquaculture_method_unverified:'양식 근거',category_not_numeric:'IUCN DD · 숫자 없음'};
function matrixBlockerText(s){
  const row=matrixReadiness.get(s.aphiaID);
  if(!row||row.scientific_name!==s.name)return scoreSummary(s);
  const reason=row.axis_reasons;
  const food=row.scores.MFPI===null?`MFPI ${Array.isArray(reason.MFPI)?reason.MFPI.map(k=>matrixReasonLabel[k]||k).join('·'):(matrixReasonLabel[reason.MFPI]||reason.MFPI)}`:null;
  const bio=row.scores.MBPI===null?`MBPI ${row.bioactivity_missing_steps.map(k=>matrixReasonLabel[k]||k).join('·')}`:null;
  const cons=row.scores.MCUI===null?`MCUI ${reason.MCUI==='not_in_red_list'?'IUCN 평가 검색 미확인':row.scope==='expansion_22'?'IUCN 원평가 검수 필요':'IUCN 원평가 확인 필요'}`:null;
  // Computed pilot values come first, so a held axis never hides a value the report did calculate.
  const done=['MFPI','MBPI','MCUI'].filter(k=>pilotScore(s,k)!==null).map(k=>`${k} ${pilotScore(s,k).toFixed(1)}`);
  // A national MCUI is placed only from verified-pilot-3.2 (marked apart); say which, or a species with every axis looks placeable.
  const national=row.scores.MCUI!==null&&row.mcui_basis==='national'?(matrixRule()?.include_national_mcui?'MCUI 한국 국가 평가 · BBVI가 생기면 매트릭스에 구분 표시':'MCUI 한국 국가 평가 · IUCN 매트릭스 제외'):row.scores.MCUI!==null&&row.mcui_basis==='range_state'?((matrixRule()?.include_substitute_mcui||[]).includes(row.mcui_basis)?'MCUI 서식국 국가 평가 · BBVI가 생기면 매트릭스에 구분 표시':'MCUI 서식국 국가 평가 · 매트릭스·지도 색 제외'):null;
  return [...done,food,bio,cons,national].filter(Boolean).join(' / ');
}
function toggleSimulation(value){
  simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);
  const assessed=data?.species.filter(assessedForMatrix)||[];
  $('matrix-note').innerHTML=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`시범 지표 ${assessed.length}종 · BBVI와 MCUI가 모두 산출된 종만 표시합니다.${assessed.some(nationalMcui)?' 네모 점은 한국 국가 평가 기반 MCUI로, IUCN 기반과 같은 척도가 아닙니다.':''} 타당성 미검증.`:'실제 종의 두 축을 산출하지 못해 배치하지 않았습니다. 아래에서 종별 보류 사유와 확인된 원문을 볼 수 있습니다. <button type="button" class="link-button" id="simulate-inline">가상 작동 예시 보기 →</button>';
  $('simulate-inline')?.addEventListener('click',()=>toggleSimulation(true));
  const unplaced=value?[]:(data?.species||[]).filter(s=>!assessedForMatrix(s));
  const kinds=data?` (운영 발행 ${unplaced.filter(s=>!s.catalog).length}종 · 조사 후보 ${unplaced.filter(s=>s.catalog).length}종)`:'';
  $('matrix-unplaced').innerHTML=unplaced.length?`<b>${matrixRule()?'매트릭스 미배치':'정보 부족 · 후속조사 대상'} ${unplaced.length}종${kinds}${matrixRule()?' (BBVI·MCUI 한 쌍 없음)':''}</b><span>네 유형과 별개입니다. 낮은 가치가 아니라 두 축을 산출할 근거가 아직 없다는 뜻입니다.${matrixRule()?' 정보충분도 기준의 ‘우선 조사 대상’과는 다른 목록입니다.':''} 표시 순서는 기존 카탈로그 순서이며 가치·보전·조사 우선순위가 아닙니다. 항목별 차단 사유는 종 상세의 원문에서 확인할 수 있습니다.</span><div>${unplaced.map(s=>`<button type="button" data-aphia="${s.aphiaID}">${esc(s.label)} <small>${esc(matrixBlockerText(s))}</small></button>`).join('')}</div>`:'';
  $('matrix-unplaced').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{showDecision(data.species.find(s=>s.aphiaID===Number(b.dataset.aphia)));$('decision-detail').scrollIntoView({behavior:'smooth',block:'nearest'});}));
  $('axis-pairs').innerHTML=value||!data?'':axisPairsHtml();
  const points=[['A',24,74,'보전 우선·모니터링'],['B',77,76,'대체생산·배양 연구'],['C',25,25,'기초조사·관찰 대상'],['D',77,25,'지속가능 활용 후보']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map(s=>{const kind=nationalMcui(s)?' · MCUI 한국 국가 평가 기반':'',type=matrixType(s),meaning=type?' / '+matrixTypeLabel(type):'';
    return `<button class="matrix-point pilot${separateMcui(s)?' national':''}" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%" title="${esc(s.label)} · 시범 BBVI ${pilotScore(s,'BBVI')}, MCUI ${pilotScore(s,'MCUI')}${kind}${esc(meaning)}" aria-label="${esc(s.label)} 시범 활용 지표 ${pilotScore(s,'BBVI')}, 보전 지표 ${pilotScore(s,'MCUI')}${kind}${esc(meaning)}. 타당성 미검증"><span class="point-label${pilotScore(s,'BBVI')>=50?' left':''}" aria-hidden="true">${esc(s.label)}</span></button>`;}).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){showDecision(assessed[i]);$('decision-detail').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
    const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 실제 종의 평가 결과가 아니며, 분류 기준 역시 예시입니다.`;
  }));
}

function renderSources(){
  const info=data.assessmentInfo;
  $('snapshot-date').textContent=$('snapshot-date').title=`발행 ${data.collectedAt}`+(info?.version?` · 지표 ${info.version}${info.generatedAt?' · 산출 '+String(info.generatedAt).slice(0,10):''}`:'');$('collection-note').textContent=data.notes;
  const all=new Map();data.species.forEach(s=>s.sources.forEach(src=>all.set(src.id,src)));
  // Indicator sources (the report's own registry) are cited here too, so a comparison cohort is named on the method tab.
  const report=data.assessmentInfo||{};
  const indicator=[...new Set(data.species.flatMap(s=>s.assessment?.source_ids||[]))]
    .map(id=>[id,report.sources?.[id]]).filter(([,src])=>src)
    .map(([id,src])=>`<div class="citation"><strong>${esc(src.title||src.provider||id)}</strong><span>${esc(src.citation||src.provider||'')}</span><br>${sourceLink(src.url,'원문 ↗')} · ${esc(src.license||'이용조건 미기재')}<br><span>${esc(src.terms||'')} ${esc(src.accessed||'')} 조회.</span></div>`).join('');
  $('all-sources').innerHTML=data.species.map(s=>`<div class="citation"><strong>${esc(s.label)} · 학명</strong><span>${esc(s.wormsCitation)}</span><br>${sourceLink(s.wormsUrl,'WoRMS 원문 ↗')} · ${sourceLink('https://www.marinespecies.org/about.php','WoRMS 이용조건 · CC BY 텍스트')}</div>`).join('')+Array.from(all.values()).map(s=>`<div class="citation"><strong>${esc(s.title)}</strong><span>${esc(s.citation)}</span><br>${sourceLink(s.url,'데이터셋 원문 ↗')} · ${sourceLink(s.licenseUrl,s.license)}<br><span>변경: ${esc(s.changes||'종별 건수·기간 요약, 승인학명 연결, 좌표 미공개.')} ${esc(s.accessed||data.collectedAt)} 접근.</span></div>`).join('')+indicator;
}

function registerTools(){
  const ctx=document.modelContext;if(!ctx?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const options={signal:lifecycle.signal};
  for(const tool of [
    {name:'read_biobio_evidence',title:'후보종 근거 현황 읽기',description:'실제 표시된 종별 근거 연결 현황과 시범 지표 상태를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('인자가 없어야 합니다.');return {view:currentView,selectedAphiaID:selected?.aphiaID,simulated,species:(data?.species||[]).map(s=>({label:s.label,aphiaID:s.aphiaID,records:s.recordCount,status:s.status,
  axes:Object.fromEntries(['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return [k,{value:st.value,state:st.kind,label:st.label,...(k==='MCUI'&&separateMcui(s)?{basis:nationalMcui(s)?'korea_national':'range_state_national',comparableWithIucnMcui:false}:{})}];})),
  scoreStatus:s.assessment?'provisional_unvalidated':s.assessmentState||'unscored'}))};}},
    {name:'select_biobio_species',title:'탐색할 종 선택',description:'AphiaID로 후보를 선택하고 실제 지도와 근거 카드를 표시합니다.',inputSchema:{type:'object',properties:{aphiaID:{type:'integer'}},required:['aphiaID'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Number.isInteger(input.aphiaID)||Object.keys(input).some(k=>k!=='aphiaID'))throw new Error('정수 AphiaID를 입력하세요.');selectSpecies(input.aphiaID);$('search').value='';renderList();setView('explore');return {selected:selected.label,aphiaID:selected.aphiaID,status:selected.status};}}
  ])try{Promise.resolve(ctx.registerTool(tool,options)).catch(()=>{});}catch{}
}

let requestNumber=0;
async function loadCollection(){
  const request=++requestNumber;
  data=null;selected=null;selectedValueCell=null;comparisonPage=0;activeUse=null;overlay?.clearLayers();lastFitted=null;fitMap();$('search').value='';$('error').hidden=true;
  $('connection-state').textContent='자료를 불러오는 중';
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';$('decision-list').textContent='';$('matrix-unplaced').textContent='';$('axis-pairs').textContent='';$('cell-table').textContent='';$('decision-detail').textContent='';$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';$('value-cell-detail').textContent='';$('map-selected').textContent='';
  setMapLegend(null);
  $('score-disclaimer').textContent='자료를 불러오는 중입니다.';
  $('map-judgment').textContent='해역별 활용·보전 판단: 입력 확인 중';
  $('map-source').textContent='공개 기준 자료 · 공개 1° 셀';
  try{
    const [next,readiness]=await Promise.all([loadPublishedProfiles(),
      fetch('matrix-readiness.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
    next.outdated??=[];matrixReadiness=readinessRows(readiness,next.outdated);
    next.readinessAssessmentDate=readiness?.assessments_snapshot||null;next.readinessCandidateDate=readiness?.candidate_snapshot||null;
    if(request!==requestNumber)return;
    await attachPilotAssessments(next);
    if(request!==requestNumber)return;
    if(reloadOnceForNewData(next.outdated))return;
    $('score-disclaimer').innerHTML=next.species.some(s=>s.assessment)?'일부 종에 <strong>시범 지표</strong>가 있습니다'+validationNote(next.assessmentInfo)+'. 연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.':'이 자료에는 활용가치·보전 지표를 <strong>산출하지 않았습니다.</strong> 학명·출현 근거만 봅니다.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];mapJudgmentStatus(selected);renderUseChips();renderList();renderDetail();renderMap();renderComparison();renderDecisionList();renderSources();
    // Three live states: connected, connected but 0 published (not a failure, no snapshot), unreachable (dated snapshot).
    const counts=`운영 발행 ${data.publishedCount}종 · 조사 후보 ${data.candidateCount}종`;
    $('connection-state').textContent=data.snapshotAt?`연결 실패 · 저장된 사본 사용 (${data.snapshotAt} 기준) · ${counts}`:'공개 기준 자료 연결됨 · '+counts;
    if(data.snapshotAt){$('error').hidden=false;$('error').textContent=`운영 DB에 연결하지 못해 ${data.snapshotAt}에 저장한 공개 자료 사본을 표시합니다. 그 뒤 발행된 변경은 반영되지 않았습니다.`;}
    else if(!data.publishedCount)$('score-disclaimer').innerHTML=`운영 DB에는 연결됐지만 <strong>운영 발행 자료가 0종</strong>입니다. 지금 보이는 ${data.candidateCount}종은 모두 조사 후보이며, 지표는 산출하지 않았습니다.`;
    if(data.outdated.length){$('error').hidden=false;$('error').textContent=(data.snapshotAt?$('error').textContent+' ':'')+`새 버전 있음: ${data.outdated.map(o=>o.file).join(', ')}이(가) 이 화면 코드보다 새 버전입니다. 자료 결함이 아니며 페이지를 새로고침(F5)하면 최신 화면이 보입니다.`;}
    toggleSimulation(false);updateWeightControl();
    if(startHash){const h=startHash;startHash=null;if(h.s||h.v)applyHash(h);}
  }catch(error){if(request!==requestNumber)return;$('error').hidden=false;$('error').textContent=error.message;$('connection-state').textContent='불러오기 실패';$('species-list').textContent='다시 불러오기를 눌러 주세요.';$('map-review-note').textContent='자료 연결을 확인할 수 없습니다.';}
}
let startHash={};
async function start(){
  startHash=readHash();
  if(matchMedia('(max-width:740px)').matches)document.querySelector('.map-legend-more').open=false; // phones: keep the map near the first screen
  try{const r=await fetch('effort.json');if(r.ok){effortData=await r.json();$('effort-date').textContent=`OBIS · ${effortData.retrieved} 조회`;}}catch{/* optional layer */}
  try{const r=await fetch('countries.json');if(!r.ok)throw Error('map');const geography=await r.json();if(typeof L!=='undefined')initMap(geography);}catch{$('map').textContent='배경 지도를 불러오지 못했습니다. 종 요약은 계속 볼 수 있습니다.';}
  await loadCollection();registerTools();
}
// ↻ reloads the data but keeps species, chip and map: writeHash already holds them, so they are re-applied like a shared
// link. The tab is left out: loading never changes it, and one picked while a slow reload runs must not be undone.
$('reload-data').addEventListener('click',()=>{startHash={...readHash(),v:null};loadCollection();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-map-mode]').forEach(button=>button.addEventListener('click',()=>setMapMode(button.dataset.mapMode)));
$('search').addEventListener('input',()=>{if(data)renderList();});
for(const id of ['species-group','species-evidence'])$(id).addEventListener('change',()=>{if(data)renderList();});
$('comparison-prev').addEventListener('click',()=>{comparisonPage=Math.max(0,comparisonPage-1);renderComparison();});
$('comparison-next').addEventListener('click',()=>{comparisonPage=Math.min(Math.ceil(data.species.length/5)-1,comparisonPage+1);renderComparison();});
$('effort-toggle').addEventListener('change',e=>{effortOn=e.target.checked;drawEffort();});
for(const [id,layer] of [['layer-priority','priority'],['layer-unexplored','unexplored']])$(id).addEventListener('change',e=>{sufficiencyLayers[layer]=e.target.checked;if(data&&mapMode==='value')renderMap();});
$('copy-link').addEventListener('click',()=>{writeHash();const done=m=>{$('basemap-status').textContent=m;};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(()=>done('현재 화면 링크를 복사했습니다.'),()=>done('주소창의 링크를 복사하세요.'));else done('주소창의 링크를 복사하세요.');});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
$('bbvi-weight').addEventListener('input',event=>{
  bbviWeight=Number(event.target.value);$('bbvi-weight-value').textContent=bbviWeight.toFixed(2);
  if(data){renderComparison();renderDetail();toggleSimulation(simulated);if(mapMode==='value')renderMap();} // cell types move with the weight
});
start();
