'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'basic', bbviWeight = .5;
const years = item => item.yearStart ? (item.yearStart===item.yearEnd ? String(item.yearStart) : `${item.yearStart}–${item.yearEnd}`) : '연도 미기재';
const safeUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : '#';
const sourceLink = (url,label) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)}</a>`;
const recordLabel = s => s.noOccurrences ? '출현자료 미수집'
  : Number.isSafeInteger(s.recordCount) ? s.recordCount.toLocaleString()+'건' : '기록 수 미확인';
// Presence of a source is only a coverage check. It does not establish quality or a score.
function evidenceCoverage(s) {
  const i=s.info||{}, n=i.nutrition||{}, c=i.compounds||{}, k=i.conservation||{};
  const checks=[
    ['학명', Number.isSafeInteger(s.aphiaID) && !!s.wormsUrl],
    ['출현', !s.noOccurrences && Number.isSafeInteger(s.recordCount)],
    ['영양·가식부 검증', pilotScore(s,'MFPI')!==null], // summary counts do not prove comparability
    ['정량 활성', c.status==='available' && Number.isSafeInteger(c.quantitative_bioactivity_count) && c.quantitative_bioactivity_count>0],
    ['보전 평가', k.status==='available' && Number.isSafeInteger(k.assessment_count) && k.assessment_count>0]
  ];
  return {known:checks.filter(([,present])=>present).length, missing:checks.filter(([,present])=>!present).map(([name])=>name)};
}

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
  if(key==='BBVI' && s.assessment?.report_version==='verified-pilot-1'){
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
  if(!f||!config||f.cohort_id!==config.cohort_id||f.cohort_species!==report.comparison_cohort?.species_count||
     f.sample_state!=='raw'||f.basis!=='100 g edible portion'||!sources[f.source_id]||
     !sources[f.method_source_id]||f.edible_fraction?.reviewed!==true||
     f.aquaculture?.reviewed!==true||f.aquaculture.feasible!==true)return false;
  const years=f.sample_year_range;
  if(!Array.isArray(years)||years.length!==2||!years.every(x=>Number.isInteger(x)&&x>=1900&&x<=new Date().getUTCFullYear()))return false;
  let nutrient=0;
  for(const [name,unit] of Object.entries(config.components||{})){
    const n=f.nutrients?.[name];
    if(!n||!Number.isFinite(n.value)||n.value<0||n.unit!==unit||
       !Number.isFinite(n.percentile_unrounded)||n.percentile_unrounded<0||n.percentile_unrounded>100||
       !Number.isFinite(n.evidence_factor)||!n.method||!Array.isArray(n.peer_values)||
       n.peer_values.length!==f.cohort_species||!n.peer_values.every(p=>Number.isFinite(p.value)&&p.value>=0))return false;
    nutrient+=n.percentile_unrounded*n.evidence_factor;
  }
  const fraction=f.edible_fraction;
  if(!Number.isFinite(fraction.value)||fraction.value<0||fraction.value>1||!sources[fraction.source_id]||
     !sources[f.aquaculture.source_id])return false;
  const expected=config.nutrient_weight*nutrient/Object.keys(config.components).length+
    100*config.edible_fraction_weight*fraction.value+100*config.aquaculture_weight;
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

async function attachPilotAssessments(next) {
  if(!next.live)return;
  let response;
  try { response=await fetch('assessments.json',{cache:'no-store'}); } catch { return; }
  if(response.status===404)return;
  if(!response.ok)return;
  try {
    const report=await response.json();
    const verified=report.method_version==='verified-pilot-1';
    if(!['pilot-1','verified-pilot-1'].includes(report.method_version)||report.status!=='provisional_unvalidated'||!Array.isArray(report.species))return;
    const byId=new Map(report.species.map(s=>[s.aphia_id,s]));
    if(byId.size!==report.species.length)return;
    for(const s of next.species){
      const a=byId.get(s.aphiaID);
      if(a?.scientific_name!==s.name||!a.scores||!Array.isArray(a.source_ids))continue;
      if(verified){
        if(verifiedReportSpeciesValid(a,report))s.assessment={...a,report_version:report.method_version};
        continue;
      }
      if(!a.source_ids.length)continue;
      if(!a.source_ids.every(id=>report.sources?.[id]?.url))continue;
      if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>a.scores[k]===null||(Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100)))continue;
      const foodEligible=foodTraceValid(s,a,report.sources);
      s.assessment=foodEligible?a:{...a,scores:{...a.scores,MFPI:null,BBVI:null},food_trace:null,food_withheld:true};
    }
    next.assessmentInfo={foodWeight:report.food_weight,generatedAt:report.generated_at,
      sources:report.sources,method:report.method,cohort:report.comparison_cohort,version:report.method_version};
  } catch { /* A malformed optional report must not hide the underlying species evidence. */ }
}


// Row counts are an inventory of retrieved records. They do not supply edible
// portion values or a comparable peer set.
function foodEvidencePanel(s) {
  if(s.assessment?.report_version==='verified-pilot-1')return '';
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

const scoreReason={
  comparable_nutrition_missing:'같은 시료 상태의 고정 영양 비교집단에 이 종의 행이 없습니다.',
  species_edible_yield_unverified:'이 종의 원자료 가식부 비율을 검증하지 못했습니다.',
  aquaculture_method_unverified:'지역·시기·방법이 확인된 양식 근거가 부족합니다.',
  compound_origin_assay_chain_or_fixed_cohort_missing:'기원종·구조·시험값·원논문을 완결해 연결한 비교집단이 없습니다.',
  original_assessment_not_reviewed:'IUCN 역사적 기록을 찾았지만 원평가와 현행 여부를 모두 검수하지 못했습니다.',
  assessment_not_verified:'검증된 IUCN 원평가를 확보하지 못했습니다. 공식 미평가(NE)라는 뜻은 아닙니다.',
  current_status_unverified:'현행 IUCN 평가 여부를 확인하지 못했습니다.',
  requires_MFPI_and_MBPI:'기본 통합 BBVI에는 MFPI와 MBPI 두 축이 모두 필요합니다.'
};
function verifiedSource(id,label){
  const src=data?.assessmentInfo?.sources?.[id];
  return src?sourceLink(src.url,label||src.title||id):esc(label||id||'출처 미확인');
}
function verifiedFoodDetail(s){
  const f=s.assessment.food_trace||{}, names={protein_g:'단백질',iron_mg:'철',zinc_mg:'아연'};
  const raw=Object.entries(f.nutrients||{}).map(([key,n])=>
    `<div class="score-fact"><b>${esc(names[key]||key)} ${esc(n.value)} ${esc(n.unit)} / 100 g 가식부</b>`+
    `<span>${esc(n.grade)} · ${esc(n.method)} · 고정 비교집단 백분위 ${esc(n.percentile)} · 근거 계수 ${esc(n.evidence_factor)}</span></div>`).join('');
  const observations=(f.supplemental_nutrition||[]).map(o=>
    `<p class="fine">별도 원값 ${esc(o.record_id)} · ${esc(o.sample_state)} · ${esc(o.basis)}: `+
    `${Object.entries(o.values||{}).map(([key,v])=>`${esc(key)} ${esc(v.value)} ${esc(v.unit)}`).join(' / ')}. `+
    `${esc(o.exclusion_reason)} ${verifiedSource(o.source_id,'원자료 ↗')}</p>`).join('');
  const e=f.edible_fraction,q=f.aquaculture;
  const support=e&&q?`<p>가식부 비율 ${esc((e.value*100).toFixed(2))}% (${esc(e.region)}, ${esc(e.sample_period)}) · ${verifiedSource(e.source_id,'원자료 ↗')}</p>`+
    `<p>양식 방법: ${esc(q.method)}. 적용 범위: ${esc(q.region)}. 제약: ${esc(q.limitations)} ${verifiedSource(q.source_id,'FAO 근거 ↗')}</p>`:'';
  const sensitivity=(f.yield_sensitivity||[]).map(item=>
    `<p class="fine">가식부 ${esc((item.fraction*100).toFixed(2))}% 대입 시 MFPI ${esc(Number(item.mfpi_at_same_nutrients).toFixed(1))} · ${verifiedSource(item.source_id,'독립 자료 ↗')}</p>`).join('');
  const cohort=f.cohort_species?`<p class="fine">고정 비교집단 ${esc(f.cohort_id)} · ${esc(f.cohort_species)}종 (${esc((f.cohort_food_item_ids||[]).join(', '))}). `+
    `원자료 시료 공급 ${esc((f.sample_year_range||[]).join('–'))}; DB 공개 연도 ${esc(f.publication_year)}. ${verifiedSource(f.source_id,'AFCD 원값 ↗')} · ${verifiedSource(f.method_source_id,'원보고서 방법 ↗')}</p>`:'';
  return raw+cohort+support+sensitivity+observations+
    (f.uncertainty||[]).map(x=>`<p class="fine">불확실성: ${esc(x)}</p>`).join('');
}
function verifiedBioDetail(s){
  const items=s.assessment.bioactivity_partial||[];
  return items.length?items.map(item=>{
    const values=(item.values||[]).map(v=>{
      const parts=[v.material, v.value!==undefined?`${v.value} ${v.unit||''}`:null,
        v.dose!==undefined?`${v.dose} ${v.dose_unit||''}`:null,
        v.viability_percent!==undefined?`세포 생존율 ${v.viability_percent}%`:null].filter(Boolean);
      return parts.map(esc).join(' · ');
    }).join(' / ');
    return `<div class="score-fact"><b>${esc(item.material_kind)} · ${esc(item.endpoint||'endpoint 미확인')}</b>`+
      `<span>${values} ${item.test_system?' · '+esc(item.test_system):''}</span></div>`+
      `<p class="fine">점수 제외: ${esc(item.exclusion_reason)} ${verifiedSource(item.source_id,'원자료 ↗')}</p>`;
  }).join(''):'<p>검증된 기원종·화합물·시험 사슬을 찾지 못했습니다. 자료 부재의 증거는 아닙니다.</p>';
}
function verifiedConservationDetail(s){
  const c=s.assessment.conservation_trace;
  if(!c)return '<p>현재 확인 가능한 원평가가 없어 IUCN 범주를 추정하지 않습니다. 검색 실패는 공식 NE와 다릅니다.</p>';
  return `<p>역사적 기록 ${esc(c.record_id)} · ${esc(c.category||'범주 원문 미확인')} · 평가 연도 ${esc(c.assessment_year||'미확인')} · `+
    `발행 ${esc(c.publication_year||'미확인')} · 범위 ${esc(c.scope)}. ${verifiedSource(c.source_id,'기록 ↗')}</p>`+
    `<p class="fine">${esc(c.verification)} 현행 평가: ${c.current_status_check?.is_current===true?'재확인됨':'확인 보류'}. `+
    `OBIS 원시 건수는 개체군 추세 점수로 사용하지 않았습니다.</p>`;
}
function renderVerifiedIndices(s){
  const a=s.assessment;
  const names={MFPI:'식량 가능성',MBPI:'생리활성',MCUI:'보전 평가',BBVI:'통합 활용'};
  const bodies={MFPI:verifiedFoodDetail(s),MBPI:verifiedBioDetail(s),MCUI:verifiedConservationDetail(s),
    BBVI:'<p>기본 BBVI = w × MFPI + (1−w) × MBPI. MCUI는 별도 축입니다. 화면에서 w를 바꾸어도 고정 비교집단은 바뀌지 않습니다.</p>'};
  return `<section class="verified-scores"><h3>실제 원자료 기반 지표 · 검증 전 시범 지표</h3>`+
    `<p class="fine">자료 스냅샷 ${esc(data.assessmentInfo?.generatedAt?.slice(0,10))} · MFPI·MBPI·MCUI는 각각 독립적으로 판정합니다. `+
    `숫자는 종 단위 연구용 지표이며 지도 1° 셀이나 해역에 전가하지 않습니다.</p>`+
    ` ${Object.keys(names).map(key=>{
      const value=pilotScore(s,key),reason=a.withheld_reasons?.[key];
      const status=a.score_status?.[key]||'산출 보류';
      return `<details class="score-disclosure" data-axis="${key}"><summary><span>${esc(key)} · ${esc(names[key])}</span>`+
        `<b>${value===null?esc(status):value.toFixed(1)+' · '+esc(status)}</b></summary>`+
        `<div class="score-disclosure-body">${value===null?`<p class="pending">${esc(scoreReason[reason]||reason||'산출 보류')}</p>`:''}`+
        `${bodies[key]}${key==='MFPI'&&value!==null?'<p class="fine">산식: 동기준 영양 백분위·근거등급 80% + 전체 중 가식부 비율 10% + 양식 방법 근거 10%. 이 비중은 자체 시범 규칙입니다.</p>':''}`+
        `</div></details>`;
    }).join('')}<p class="fine">정보충분도: 네 지표 중 ${Object.values(a.scores).filter(Number.isFinite).length}개 산출. `+
    `민감도 범위는 통계적 신뢰구간이 아닙니다. 식량 전용 탐색은 MFPI 자체를 보되 기본 BBVI와 구분합니다.</p></section>`;
}

function setView(view) {
  if (!['explore','compare','method'].includes(view)) throw new Error('지원하지 않는 화면입니다.');
  currentView=view;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===view));
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(view==='explore' && map) requestAnimationFrame(()=>map.invalidateSize());
}

function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const matches=data.species.filter(s=>[s.label,s.name,s.group,String(s.aphiaID)].some(v=>v.toLowerCase().includes(query)));
  $('species-count').textContent=`${matches.length}종`;
  $('species-list').innerHTML=matches.length?matches.map(s=>`<button class="species-card ${selected?.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" aria-pressed="${selected?.aphiaID===s.aphiaID}"><span class="group">${esc(s.group)}</span><b>${esc(s.label)}</b><em>${esc(s.name)}</em><span class="count"><span>${s.live&&s.cells.length?'공개 셀':'수집된 기록'}</span><strong>${s.live&&s.cells.length?s.cells.length+'셀 · 지점 '+cellSites(s).toLocaleString()+'곳':recordLabel(s)}</strong></span></button>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species))));
}

function selectSpecies(id) {
  const item=data?.species.find(s=>s.aphiaID===id);
  if(!item)throw new Error('목록에 없는 종입니다.');
  selected=item;renderList();renderDetail();renderMap();
}

function renderDetail() {
  const s=selected;
  if(s.live)return renderLiveDetail(s);
  const evidence=[['학명·식별자','WoRMS 연결','done'],['출현기록','OBIS 연결','done'],['식량 근거 · MFPI','산출 보류 · 영양 원값 검증 필요',''],['생리활성 · MBPI','자료 미확인',''],['보전 평가 · MCUI','평가 미조회','']];
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>SPECIES EVIDENCE</span><span class="verified">정명 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 식별번호를 기준으로 합니다.</p></div><div><h3>연결된 근거 <span class="fine">2 / 5 항목 · 품질 점수 아님</span></h3>${evidence.map(e=>`<div class="evidence-item"><span>${e[0]}</span><span class="${e[2]}">${e[1]}</span></div>`).join('')}${foodEvidencePanel(s)}<div class="withheld"><b>통합점수 산출 보류</b>활용·보전 자료를 검수한 뒤 점수 계산 여부를 결정합니다. 미확인 자료를 0점으로 처리하지 않습니다.</div></div><div class="source-area"><h3>출처와 범위</h3><a class="source-link" href="${esc(safeUrl(s.wormsUrl))}" target="_blank" rel="noopener"><span>WoRMS · 학명 확인</span><span>↗</span></a><a class="source-link" href="${esc(safeUrl(s.queryUrl))}" target="_blank" rel="noopener"><span>OBIS · 조회 조건과 응답</span><span>↗</span></a><p class="fine">조회 응답 ${s.reportedTotal.toLocaleString()}건 중 ${s.retrievedCount.toLocaleString()}건 취득, 선별 후 ${s.recordCount.toLocaleString()}건 표시. 연도 미기재 ${s.undated}건. 기록 간 중복·동정 정확성은 추가 검수 대상입니다.</p><button class="text-button" id="detail-sources">데이터셋 ${s.sources.length}개와 이용 조건 보기 →</button></div>`;
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
      +`<p class="fine">출처 ${cmnpd?sourceLink(cmnpd.url,'CMNPD ↗'):'CMNPD'} · ${cmnpd?sourceLink(cmnpd.licenseUrl,'CC BY-NC-SA 4.0'):'CC BY-NC-SA 4.0'} — 비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다.</p>`
    : row('보고 화합물',c.status==='not_collected'?'미수집':'정보 없음','pending');
  const conservation={
    withheld_insufficient_evidence:row('보전평가','근거 부족으로 보류','pending')+row('검토 기록',`IUCN 검색 기록 ${count(k.search_record_count)} · 평가 ${count(k.assessment_count)}`)+(k.note?`<p class="fine">${esc(k.note)}</p>`:''),
    not_reviewed:row('보전평가','미검토','pending')
  }[k.status]||row('보전평가','정보 없음','pending');
  return `<h3>운영 공개 요약 · 지표 입력과 별도</h3>${nutrition}${aquaculture}<p class="fine">이 운영 요약의 기록 건수는 종 간 영양 비교값이 아닙니다. 별도로 검토한 원자료는 아래 지표 근거에서 확인할 수 있습니다.</p><h3>화합물 수집 요약</h3>${compounds}<h3>보전 수집 요약</h3>${conservation}`;
}

function renderLiveDetail(s) {
  const i=s.info;
  const coverage=evidenceCoverage(s);
  const occurrence=i.collection==='gbif_map_2026_09_24'
    ? row('출현기록',`GBIF 공개 기록 ${count(s.recordCount)}`)+row('관측 기간',years(s))+row('원자료 학명',(i.original_names||[]).join(', '))
    : s.noOccurrences
    ? row('출현자료','미수집','pending')+`<div class="withheld"><b>출현자료 미수집</b>이 종은 출현 기록을 수집하지 않아 지도에 표시할 위치가 없습니다.</div>`
    : Number.isSafeInteger(s.recordCount)
      ? `<div class="evidence-item"><span>수집된 기록</span><b>${recordLabel(s)}</b></div><div class="evidence-item"><span>관측 기간</span><b>${years(s)}</b></div><div class="evidence-item"><span>원자료 학명</span><span>${esc((i.original_names||[]).join(', '))}</span></div><div class="withheld"><b>위치 공개 검토 중</b>좌표 불확실성 미기재 ${count(i.uncertainty_missing)} · 육지 위 품질경고 ${count(i.on_land_count)}. 좌표를 이동하거나 결측을 0으로 바꾸지 않았습니다.</div>`
      : row('출현자료','기록 수 미확인','pending')+`<div class="withheld"><b>출현자료 상태 확인 필요</b>발행 자료의 기록 수를 확인할 수 없어 0건으로 표시하지 않습니다. 지도 위치도 공개하지 않습니다.</div>`;
  const evidence=s.v2?liveEvidence(s):'';
  const score=s.v2?'활용·보전 근거를 검수하는 중이라 점수를 계산하지 않았습니다. 미수집·보류 항목을 0점으로 처리하지 않습니다.':esc(s.productionSummary);
  const pilot=s.assessment;
  const pilotRows=pilot?.report_version==='verified-pilot-1'?renderVerifiedIndices(s)
    :pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':pilotScore(s,k).toFixed(1))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  const withheld=pilot?'근거가 부족한 항목은 산출 보류로 유지합니다. 시범 수치는 외부 사례 검증 전의 연구용 결과입니다.':score;
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>발행된 자료 요약</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다.</p></div><div><h3>이번 수집에서 확인한 것</h3><p>${esc(s.summary)}</p>${occurrence}<p class="fine">${esc(i.limitations)}</p>${mapSection(s)}${evidence}${foodEvidencePanel(s)}${row('자료 연결 현황',`${coverage.known}/5 항목 · 품질 점수 아님`)}<p class="fine">추가 확인: ${esc(coverage.missing.join(' · ')||'연결 여부는 모두 확인됨')}. 자료가 있어도 단위·시험 조건·평가 범위 등 품질 검증이 필요합니다.</p>${pilotRows}<div class="withheld"><b>${pilot?'시범 분석 주의':'통합점수 산출 보류'}</b>${withheld}</div></div><div class="source-area"><h3>출처와 이용조건</h3>${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>{const src=data.assessmentInfo.sources[id];return `<p>${sourceLink(src.url,'지표 근거 '+id+' ↗')} · ${esc(src.license)}${src.notice?`<br><span class="fine">${esc(src.notice)}</span>`:''}</p>`;}).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 근거 보고서는 별도 스냅샷입니다.</p></div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method');document.querySelector('.source-section').scrollIntoView({behavior:'smooth'});});
}

// Published 1° map cells (public.species_map_cells, rules map-1). Cells only: no coordinates or record ids exist in the API.
const REASONS={on_land_obis_rule:'육지 위 좌표(OBIS 해안선 기준)',duplicate:'같은 표본 중복',under_existing_db_review:'운영 DB에서 검토 중인 기존 기록',
  species_held_until_sensitivity_review:'민감도 검토 전 보류 종',bad_coordinate_issue:'GBIF 좌표 오류 표시',uncertainty_over_10km:'좌표 불확실성 10 km 초과',
  coordinates_generalized_at_source:'제공처가 좌표를 흐리게 처리',no_year:'관측 연도 없음'};
const cellRecords=s=>s.cells.reduce((a,c)=>a+c.records,0);
const cellSites=s=>s.cells.reduce((a,c)=>a+c.sites,0);

function mapSection(s){
  const m=s.info.map;if(!m)return '';
  const single=s.cells.filter(c=>c.sites===1).length;
  const excluded=Object.entries(m.outcome||{}).filter(([k])=>k!=='accepted').map(([k,n])=>row(REASONS[k]||k,count(n))).join('')||row('제외','없음');
  const why=m.status==='held_sensitivity_review'?`<div class="withheld"><b>지도 셀을 만들지 않음</b>${esc(m.note)}</div>`:`<ul class="why">
<li><b>이용조건</b>CC0·CC BY 4.0 기록만 썼습니다. CC BY-NC ${count(m.nc_records)}은 비상업 이용 결정 전이라 쓰지 않았습니다.</li>
<li><b>좌표 품질</b>OBIS 해안선 거리로 육지 위 좌표를 제외했고 좌표를 옮기지 않았습니다. 불확실성 10 km 초과, 제공처가 흐리게 처리한 좌표, GBIF 좌표 오류 표시도 제외했습니다.</li>
<li><b>불확실성 결측</b>0으로 보지 않고 1° 셀에서만 썼습니다.</li>
<li><b>민감도</b>아직 평가하지 않아 GBIF 지침에서 가장 엄격한 공개 수준인 1°를 적용했습니다.</li>
<li><b>중복·기존 자료</b>같은 표본 번호는 한 번만 셌고, 운영 DB에서 검토 중인 기존 기록은 쓰지 않았습니다.</li>
<li><b>비공개</b>원좌표와 기록 ID는 공개하지 않습니다.</li></ul>`;
  return `<h3>지도 셀</h3>${row('공개 셀',s.cells.length?s.cells.length+'개 · 1°×1°':'없음',s.cells.length?'done':'pending')}${s.cells.length?row('조사 지점',count(cellSites(s),'곳'))+row('셀에 쓴 기록',count(cellRecords(s)))+row('셀 기록 연도',years({yearStart:Math.min(...s.cells.map(c=>c.yearStart)),yearEnd:Math.max(...s.cells.map(c=>c.yearEnd))})):''}${single?`<p class="fine">조사 지점이 1곳뿐인 셀 ${single}개: 1° 범위 안의 대략적인 조사 위치가 드러납니다.</p>`:''}${m.note&&m.status!=='held_sensitivity_review'?`<p class="fine">${esc(m.note)}</p>`:''}<h3>왜 공개할 수 있는가</h3>${why}<h3>조회와 제외 <span class="fine">GBIF ${esc(m.retrieved)}</span></h3>${row('조회 기록(2000년 이후)',count(m.queried_records))}${row('CC0·CC BY 기록',count(m.open_records))}${excluded}<p class="fine">사유가 겹치는 기록은 사유마다 셉니다. 셀은 그 기간에 기록이 있었다는 뜻입니다. 분포 전체, 개체수, 자원량을 뜻하지 않습니다.</p>`;
}

function renderCellMap(s,color){
  $('map-review-note').textContent='공개 기준을 통과한 GBIF 기록만 1° 셀로 묶었습니다. 셀은 출현 확인 범위이며 분포 전체나 개체수를 뜻하지 않습니다.';
  for(const c of s.cells){
    L.rectangle([[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]],{color:{basic:'#b86b00',satellite:'#ffd166',depth:'#c2410c'}[basemap],weight:basemap==='basic'?2:2.6,dashArray:'6 4',fillColor:color,fillOpacity:basemap==='basic'?.28:.35}).addTo(overlay)
      .bindPopup(`<strong>${esc(s.label)} · 공개 1° 셀</strong><br>기간 ${years(c)} <small>(${esc(c.period)} 구간)</small><br>해역 ${esc(c.seaAreas.map(a=>a==='해역명 미확인'?a:'LME '+a).join(', '))} · 국가 ${esc(c.countries.join(', '))}<br>공간 해상도 1°×1° · 가장 짧은 변 약 ${Math.floor(c.resolutionM/1000)} km<br>조사 지점 ${c.sites}곳 <small>(기록 ${c.records}건${c.uncertaintyMissing?` · 불확실성 결측 ${c.uncertaintyMissing}건`:''})</small><br>출처 ${esc(c.citations.map(x=>x.title).join(', '))} · ${esc(c.licenses.join(', '))}<br><small>셀 범위 ${c.lat0}–${c.lat0+c.sizeDeg}°N, ${c.lon0}–${c.lon0+c.sizeDeg}°E. 원좌표·개체수·분포 범위가 아닙니다.</small>`);
  }
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.map(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{padding:[60,60],maxZoom:7});}
  $('map-count').textContent=cellSites(s).toLocaleString();$('map-count').nextElementSibling.textContent='조사 지점';$('map-cells').textContent=s.cells.length;$('map-years').textContent=years({yearStart:Math.min(...s.cells.map(c=>c.yearStart)),yearEnd:Math.max(...s.cells.map(c=>c.yearEnd))});
}

function renderMap() {
  if(!map)return;
  map.invalidateSize(); // the detail pane can change the map column height
  overlay.clearLayers();
  const s=selected;if(!s)return;const color=colors[data.species.indexOf(s)%colors.length];
  $('map-count').nextElementSibling.textContent='수집된 기록';
  if(s.live&&s.cells.length)return renderCellMap(s,color);
  $('map-review-note').textContent=!s.live?'기존 시연 자료의 1° 격자입니다. 운영 DB 자료와 별개입니다.':s.noOccurrences?'출현자료를 수집하지 않은 종입니다. 지도에 표시할 위치가 없으며, 배경 지도는 분포를 뜻하지 않습니다.':!Number.isSafeInteger(s.recordCount)?'출현기록 수를 확인할 수 없습니다. 배경 지도는 분포를 뜻하지 않습니다.':'위치 공개 검토 중입니다. 배경 지도는 분포를 뜻하지 않습니다.';
  for(const cell of s.cells){
    L.rectangle([[cell.lat-.5,cell.lon-.5],[cell.lat+.5,cell.lon+.5]],{color:{basic:color,satellite:'#ffd166',depth:'#c2410c'}[basemap],weight:1.3,fillColor:color,fillOpacity:basemap==='basic'?.23:.35}).addTo(overlay)
      .bindPopup(`<strong>${esc(s.label)}</strong><br>1° 격자 내 기록 ${cell.count}건<br>기록 연도: ${years(cell)}<br><small>격자 중심 ${cell.lat}°N, ${cell.lon}°E<br>원좌표·개체수·서식 범위가 아닙니다.</small>`);
  }
  $('map-count').textContent=Number.isSafeInteger(s.recordCount)?s.recordCount.toLocaleString():'—';$('map-cells').textContent=s.live?(s.noOccurrences?'해당 없음':'검토 중'):s.cells.length;$('map-years').textContent=years(s);
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
  renderMap();
}

function initMap(geography){
  map=L.map('map',{zoomControl:true,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7});fitMap();
  initBasemaps(geography);
  const labels=[['대한민국',36.4,127.4],['북한',40.1,126.6],['일본',35.5,136.8],['중국',39,119.5]];
  for(const [name,lat,lon] of labels)L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'geo-label',html:name,iconSize:[70,20],iconAnchor:[25,10]})}).addTo(map);
  for(const [name,lat,lon] of [['서해',35.3,123],['동해',39,132],['남해',32.5,128]])L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'sea-label',html:name,iconSize:[60,20]})}).addTo(map);
  overlay=L.layerGroup().addTo(map);
  map.attributionControl.setPrefix('Leaflet');map.attributionControl.addAttribution('OBIS · GBIF');fitMap();setBasemap(savedBasemap());
}

function renderComparison(){
  const pending=t=>`<span class="pending">${t}</span>`;
  const v2=(s,fn,fallback)=>s.v2?fn(s.info):pending(fallback);
  const axisCell=(s,key)=>{
    if(s.assessment?.report_version!=='verified-pilot-1')return pilotScore(s,key)!==null?pilotCell(s,key):null;
    const value=pilotScore(s,key),status=s.assessment.score_status?.[key]||'산출 보류';
    return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${value===null?status:value.toFixed(1)} 근거 보기">`+
      `${value===null?esc(status):value.toFixed(1)}<small>${value===null?'근거·보류 사유 보기':'검증 전 시범 지표 · 근거 보기'}</small></button>`;
  };
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],
    ['출현기록',s=>s.live&&s.cells.length?`${s.cells.length}셀 · 조사 지점 ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 1° 셀 · GBIF CC0·CC BY</small>`:s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · ${s.live?'위치 검토 중':s.cells.length+'격자'}<small>${years(s)} · 조회·선별된 자료</small>`],
    ['식량 근거 · MFPI',s=>axisCell(s,'MFPI')||v2(s,({nutrition:n={}})=>n.status==='available'?`영양 기록 ${count(n.record_count)}<small>수집 현황 · 단위/가식부 검증 전 · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['생리활성 · MBPI',s=>axisCell(s,'MBPI')||v2(s,({compounds:c={}})=>c.status==='available'?`보고 화합물 ${count(c.compound_count,'개')}<small>${c.quantitative_bioactivity_count===0?'정량 활성 자료 없음':'정량 활성 자료 '+count(c.quantitative_bioactivity_count)}</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['보전 평가 · MCUI',s=>axisCell(s,'MCUI')||v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),'평가 미조회')],
    ['자료 연결 현황',s=>s.live?`${evidenceCoverage(s).known}/5 항목<small>출처·수량 확인 · 품질 점수 아님</small>`:pending('2/5 항목 · 품질 점수 아님')],
    ['통합점수 · BBVI',s=>axisCell(s,'BBVI')||'<strong>산출 보류</strong>']];
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 ${data.species.length}종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${data.species.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${data.species.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('comparison').querySelectorAll('[data-score-aphia]').forEach(button=>button.addEventListener('click',()=>{
    selectSpecies(Number(button.dataset.scoreAphia));setView('explore');
    const disclosure=$('detail').querySelector(`[data-axis="${button.dataset.scoreAxis}"]`);
    if(disclosure){disclosure.open=true;disclosure.scrollIntoView({behavior:'smooth',block:'start'});}
  }));
}

function toggleSimulation(value){
  simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);
  const assessed=data?.species.filter(s=>pilotScore(s,'BBVI')!==null&&pilotScore(s,'MCUI')!==null)||[];
  $('matrix-note').textContent=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`시범 지표 ${assessed.length}종 · BBVI와 MCUI가 모두 산출된 종만 표시합니다. 타당성 미검증.`:'실제 종의 점수가 준비되면 이곳에 표시됩니다. 지금은 두 축을 산출하지 않아 배치하지 않습니다.';
  const points=[['A',24,74,'보전 우선 검토'],['B',77,76,'대체생산 연구 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map((s,i)=>`<button class="matrix-point pilot" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%" title="${esc(s.label)} · 시범 BBVI ${pilotScore(s,'BBVI')}, MCUI ${pilotScore(s,'MCUI')}" aria-label="${esc(s.label)} 시범 활용 지표 ${pilotScore(s,'BBVI')}, 보전 지표 ${pilotScore(s,'MCUI')}. 타당성 미검증">${i+1}</button>`).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){selectSpecies(assessed[i].aphiaID);setView('explore');return;}
    const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 실제 종의 평가 결과가 아니며, 분류 기준 역시 예시입니다.`;
  }));
}

function renderSources(){
  $('snapshot-date').textContent=`${data.live?'발행 요약 기준':'기존 시연 수집'} ${data.collectedAt}`;$('collection-note').textContent=data.notes;
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
  data=null;selected=null;overlay?.clearLayers();lastFitted=null;fitMap();$('search').value='';$('error').hidden=true;
  $('connection-state').textContent='자료를 불러오는 중';
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';
  $('data-label').textContent=live?'운영 자료':'기존 시연';
  $('score-disclaimer').innerHTML='학명·출현 자료를 연결한 첫 버전입니다. 활용가치와 보전 점수는 <strong>아직 산출하지 않았습니다.</strong>';
  $('scope-bounds').textContent=live?'124–132°E · 33–38.7°N · 시험 범위':'122–136°E · 30–43°N · 시연 범위';
  document.querySelector('.map-key').hidden=live;
  $('map-source').textContent=live?'운영 지도 · 공개 1° 셀':'OBIS 출현기록 · 시연 격자';
  try{
    const next=live?await loadPublishedProfiles():await fetch('data.json').then(r=>{if(!r.ok)throw Error('시연 자료를 불러오지 못했습니다.');return r.json();});
    if(request!==requestNumber)return;
    if(live)await attachPilotAssessments(next);
    if(request!==requestNumber)return;
    if(next.species.some(s=>s.assessment))$('score-disclaimer').innerHTML='일부 종에 <strong>검증 전 시범 지표</strong>가 있습니다. 연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];renderList();renderDetail();renderMap();renderComparison();renderSources();
    $('connection-state').textContent=live?'운영 DB 연결됨 · '+data.species.length+'종':'별도 시연 자료 · '+data.species.length+'종';
    toggleSimulation(false);
  }catch(error){if(request!==requestNumber)return;$('error').hidden=false;$('error').textContent=error.message;$('connection-state').textContent='불러오기 실패';$('species-list').textContent='다시 불러오기를 눌러 주세요.';$('map-review-note').textContent='자료 연결을 확인할 수 없습니다.';}
}
async function start(){
  try{const r=await fetch('countries.json');if(!r.ok)throw Error('map');const geography=await r.json();if(typeof L!=='undefined')initMap(geography);}catch{$('map').textContent='배경 지도를 불러오지 못했습니다. 종 요약은 계속 볼 수 있습니다.';}
  await loadCollection();registerTools();
}
$('collection').addEventListener('change',loadCollection);$('reload-data').addEventListener('click',loadCollection);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('search').addEventListener('input',()=>{if(data)renderList();});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
$('bbvi-weight').addEventListener('input',event=>{
  bbviWeight=Number(event.target.value);$('bbvi-weight-value').textContent=bbviWeight.toFixed(2);
  if(data){renderComparison();renderDetail();toggleSimulation(simulated);}
});
start();
