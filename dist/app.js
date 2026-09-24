'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
const studyBounds = [[33,124],[38.7,132]];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'basic';
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
    ['영양', n.status==='available' && Number.isSafeInteger(n.record_count) && n.record_count>0],
    ['정량 활성', c.status==='available' && Number.isSafeInteger(c.quantitative_bioactivity_count) && c.quantitative_bioactivity_count>0],
    ['보전 평가', k.status==='available' && Number.isSafeInteger(k.assessment_count) && k.assessment_count>0]
  ];
  return {known:checks.filter(([,present])=>present).length, missing:checks.filter(([,present])=>!present).map(([name])=>name)};
}
const pilotScore = (s,key) => {
  const value=s.assessment?.scores?.[key];
  return Number.isFinite(value) && value>=0 && value<=100 ? value : null;
};
const pilotCell = (s,key) => pilotScore(s,key)===null ? '<span class="pending">산출 보류</span>'
  : `${pilotScore(s,key).toFixed(1)}<small>시범 지표 · 타당성 미검증</small>`;

async function attachPilotAssessments(next) {
  if(!next.live)return;
  let response;
  try { response=await fetch('assessments.json',{cache:'no-store'}); } catch { return; }
  if(response.status===404)return;
  if(!response.ok)return;
  try {
    const report=await response.json();
    if(report.method_version!=='pilot-1'||report.status!=='provisional_unvalidated'||!Array.isArray(report.species))return;
    const byId=new Map(report.species.map(s=>[s.aphia_id,s]));
    if(byId.size!==report.species.length)return;
    for(const s of next.species){
      const a=byId.get(s.aphiaID);
      if(a?.scientific_name!==s.name||!a.scores||!Array.isArray(a.source_ids)||!a.source_ids.length)continue;
      if(!a.source_ids.every(id=>report.sources?.[id]?.url?.startsWith('https://')&&report.sources[id].license&&report.sources[id].accessed))continue;
      if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>a.scores[k]===null||(Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100)))continue;
      // A published score must carry inspectable components, not only a value.
      if(a.scores.MFPI!==null&&!a.food_trace?.nutrients)continue;
      if(a.scores.MBPI!==null&&(!Array.isArray(a.bioactivity_trace)||!a.bioactivity_trace.length))continue;
      if(a.scores.MCUI!==null&&(!a.conservation_trace?.category||!a.conservation_trace?.assessment_year))continue;
      if(a.scores.BBVI!==null){
        if(['MFPI','MBPI','MCUI'].some(k=>a.scores[k]===null))continue;
        if(!Number.isFinite(report.food_weight)||report.food_weight<0||report.food_weight>1)continue;
        const expected=report.food_weight*a.scores.MFPI+(1-report.food_weight)*a.scores.MBPI;
        if(Math.abs(a.scores.BBVI-expected)>.11)continue;
      }
      s.assessment=a;
    }
    next.assessmentInfo={foodWeight:report.food_weight,generatedAt:report.generated_at,sources:report.sources};
  } catch { /* A malformed optional report must not hide the underlying species evidence. */ }
}

// A species score does not establish a spatial decision. There is no reviewed
// cell-level join, sampling-effort adjustment or comparison cohort in the public data.
function cellAssessmentStatus(s,c) {
  const reasons=[];
  if(!s.live)reasons.push('별도 시연 격자: 운영 공개 셀의 평가 입력과 연결되지 않음');
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
    ? `해역별 활용·보전 판단: 승인 0곳 · 표시된 ${s.cells.length}개 셀 모두 판단 보류. 셀을 눌러 원자료와 부족한 근거를 확인하세요.`
    : '해역별 활용·보전 판단: 승인 0곳 · 공개 출현 셀이 없어 해역 판단도 보류합니다.';
}

// Original IUCN assessments verified in research/species-conservation. Historical records only:
// not the current status, not a Korea-only assessment and not an MCUI input until a current check.
const IUCN_HISTORICAL = {"241776":{"category":"EN A2bd","published":2013,"assessed":"2010-05-19","scope":"북서태평양 전 분포(한국 단독 평가 아님)","url":"https://www.iucnredlist.org/species/180424/1629389"}};
const iucnHistoricalText = h => `IUCN ${h.category}: ${h.published}년 발표(${h.assessed} 평가) · ${h.scope}. 역사적 평가이며, 현행 평가 여부는 확인하지 않았습니다.`;
function iucnHistoricalRows(s){
  const h=IUCN_HISTORICAL[s.aphiaID];if(!h)return '';
  return row('IUCN 원평가',`${h.category} · ${h.published}년 발표 (역사적 평가)`)+row('현행 평가','확인 보류','pending')
    +`<p class="fine">${esc(iucnHistoricalText(h))} 2026년 한국 현황이나 MCUI로 바꾸지 않습니다. ${sourceLink(h.url,'IUCN 평가 레코드 ↗')}</p>`;
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
    reasons.MFPI=gaps.join(' · ');
  }
  if(pilotScore(s,'MBPI')===null){
    const base=c.status==='available'&&Number.isFinite(c.compound_count)
      ? `보고 화합물 ${c.compound_count}개는 활성 근거가 아님.`
      : '화합물–정량 시험 연결 미확인.';
    reasons.MBPI=base+' 기원종–단일 화합물 ID–표적·assay–pChEMBL–원논문과 동일 층 비교집단 검수 필요.';
  }
  if(pilotScore(s,'MCUI')===null){
    const h=IUCN_HISTORICAL[s.aphiaID];
    reasons.MCUI=h
      ? iucnHistoricalText(h)+' 현행 평가 확인 전이라 MCUI 입력으로 쓰지 않음. 출현기록 수는 개체군 변화가 아님.'
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
function renderDecisionList(){
  const list=$('decision-list'), panel=$('decision-detail');
  list.innerHTML=data.species.map(s=>{
    const ready=assessedForMatrix(s), missing=Object.keys(assessmentBlockers(s)).filter(k=>k!=='BBVI');
    return `<button type="button" class="decision-card" data-aphia="${s.aphiaID}" aria-controls="decision-detail"><strong>${esc(s.label)}</strong><em>${esc(s.name)} · AphiaID ${s.aphiaID}</em><span>${ready?'검증 전 시범 지표 · 근거 확인':'산출 보류 · '+esc(missing.join(' · '))}</span></button>`;
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
  if(a){
    const f=a.food_trace;
    if(f){
      html+='<h4>MFPI 구성</h4><ul>';
      for(const [key,n] of Object.entries(f.nutrients||{})){
        html+=`<li>${esc(key)}: 가식부 100 g당 ${esc(n.per_100g_edible)} ${key==='protein_g'?'g':'mg'} · ${esc(n.grade)} · 동종 비교 ${esc(n.peer_count)}종 · 백분위 ${esc(n.percentile)} · ${esc(n.source_id)}</li>`;
      }
      html+=`<li>가식부 비율 ${esc(f.edible_fraction)} (${esc(f.edible_fraction_source)}) · 양식 근거 ${f.aquaculture?'있음':'없음'} (${esc(f.aquaculture_source)})</li></ul>`;
    }
    if(a.bioactivity_trace?.length){
      html+='<h4>MBPI 구성</h4><ul>';
      for(const b of a.bioactivity_trace)html+=`<li>${esc(b.compound_id)} · 표적 ${esc(b.stratum?.[0])}, assay ${esc(b.stratum?.[1])} · 중앙 pChEMBL ${esc(b.median_pchembl)} · 비교 화합물 ${esc(b.peer_count)}개 · 백분위 ${esc(b.rank)} · 독립 문헌 ${esc(b.independent_references)}건 · 근거 계수 ${esc(b.evidence_factor)} · ${esc((b.reference_ids||[]).join(', '))}</li>`;
      html+='</ul>';
    }
    const c=a.conservation_trace;
    if(c)html+=`<h4>MCUI 구성</h4><p>IUCN ${esc(c.category||'미확인')} · 평가 ${esc(c.assessment_year||'미확인')} · 출처 ${esc(c.source_id||'미확인')}${a.iucn_review_older_than_10y?' · 10년 초과 평가':''}. ${c.obis_trend?`노력 보정 추세 ${esc(c.obis_trend.direction)} (${esc(c.obis_trend.source_id)})`:'출현기록만으로 추세 보정하지 않음.'}</p>`;
    html+=`<h4>계산과 기준일</h4><p>MFPI: 영양 백분위·등급 80%, 가식부 10%, 양식 근거 10%. MBPI: 동일 표적·assay층 화합물 백분위 × 문헌 계수. BBVI: MFPI ${esc(info.foodWeight*100)}% + MBPI ${esc((1-info.foodWeight)*100)}%. MCUI는 별도 축. 산출 ${esc(info.generatedAt||'미기재')}. 모든 가중치와 점수는 검증 전 시범값입니다.</p>`;
    html+='<h4>원문·이용조건</h4><ul>'+a.source_ids.map(id=>`<li>${sourceLink(info.sources?.[id]?.url,id+' ↗')} · ${esc(info.sources?.[id]?.license||'이용조건 미확인')} · 조회 ${esc(info.sources?.[id]?.accessed||'미기재')}</li>`).join('')+'</ul>';
  }
  if(IUCN_HISTORICAL[s.aphiaID])html+=`<h4>IUCN 원평가 · 역사적 평가</h4><p>${esc(iucnHistoricalText(IUCN_HISTORICAL[s.aphiaID]))} ${sourceLink(IUCN_HISTORICAL[s.aphiaID].url,'IUCN 평가 레코드 ↗')}</p>`;
  if(study)html+=`<h4>별도 원문 조사 · 지표 입력 아님</h4><p>${esc(study.detail)} ${sourceLink(study.url,study.title+' ↗')}</p>`;
  html+='<p class="fine">실험값은 사람 대상 약효가 아니며, 지도 출현 셀은 개체수·자원량·채집 지점이 아닙니다.</p>';
  $('decision-detail').innerHTML=html;
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
  const evidence=[['학명·식별자','WoRMS 연결','done'],['출현기록','OBIS 연결','done'],['식량 근거 · MFPI','자료 미확인',''],['생리활성 · MBPI','자료 미확인',''],['보전 평가 · MCUI',IUCN_HISTORICAL[s.aphiaID]?'산출 보류 · IUCN 역사적 평가만 확인':'평가 미조회','']];
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>SPECIES EVIDENCE</span><span class="verified">정명 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 식별번호를 기준으로 합니다.</p></div><div><h3>연결된 근거 <span class="fine">2 / 5 항목 · 품질 점수 아님</span></h3>${evidence.map(e=>`<div class="evidence-item"><span>${e[0]}</span><span class="${e[2]}">${e[1]}</span></div>`).join('')}${iucnHistoricalRows(s)}<div class="withheld"><b>통합점수 산출 보류</b>활용·보전 자료를 검수한 뒤 점수 계산 여부를 결정합니다. 미확인 자료를 0점으로 처리하지 않습니다.</div></div><div class="source-area"><h3>출처와 범위</h3><a class="source-link" href="${esc(safeUrl(s.wormsUrl))}" target="_blank" rel="noopener"><span>WoRMS · 학명 확인</span><span>↗</span></a><a class="source-link" href="${esc(safeUrl(s.queryUrl))}" target="_blank" rel="noopener"><span>OBIS · 조회 조건과 응답</span><span>↗</span></a><p class="fine">지도 도트는 선별된 출현기록의 1° 격자 집계를 도식화한 것입니다. 점은 실제 관측 위치나 기록 1건을 뜻하지 않습니다.</p><p class="fine">조회 응답 ${s.reportedTotal.toLocaleString()}건 중 ${s.retrievedCount.toLocaleString()}건 취득, 선별 후 ${s.recordCount.toLocaleString()}건 표시. 연도 미기재 ${s.undated}건. 기록 간 중복·동정 정확성은 추가 검수 대상입니다.</p><button class="text-button" id="detail-sources">데이터셋 ${s.sources.length}개와 이용 조건 보기 →</button></div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method');document.querySelector('.source-section').scrollIntoView({behavior:'smooth',block:'start'});});
}

// Counts come from the published evidence_summary. A missing key is "정보 없음", never 0.
const count = (v,unit='건') => Number.isFinite(v) ? `${v.toLocaleString()}${unit}` : '정보 없음';
const row = (label,value,cls='') => `<div class="evidence-item"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`;

function liveEvidence(s) {
  const i=s.info,n=i.nutrition||{},c=i.compounds||{},k=i.conservation||{},p=i.production||{};
  const cmnpd=s.sources.find(x=>x.id==='cmnpd-1.0');
  const nutrition=n.status==='available'
    ? row('영양 성분 값',count(n.record_count),'done')
      +row('실측 · 계산',`실측 ${count(n.measured_count)} · 계산 ${count(n.calculated_count)}`+(n.proxy_count?` · 대용 ${count(n.proxy_count)}`:''))
      +row('근거 기록',`AFCD 근거 기록 ${count(n.evidence_record_count)}`)
      +row('불확실성',`단위 미확정 ${count(n.unit_unconfirmed_count)} · 기준량 가정 ${count(n.basis_assumed_count)}`)
      +(n.note?`<p class="fine">${esc(n.note)}</p>`:'')
    : row('영양 성분 값',n.status==='not_collected'?'미수집':'정보 없음','pending');
  const aquaculture=Number.isFinite(p.aquaculture_evidence_count)&&p.aquaculture_evidence_count>0
    ? `<p class="fine">보조 · 양식 표시 근거 ${count(p.aquaculture_evidence_count)}: ${esc(p.note||'생산량 통계가 아닙니다.')}</p>`:'';
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
  return `<h3>영양 근거</h3>${nutrition}${aquaculture}<h3>화합물 근거</h3>${compounds}<h3>보전</h3>${conservation}${iucnHistoricalRows(s)}`;
}

function renderLiveDetail(s) {
  const i=s.info;
  const coverage=evidenceCoverage(s);
  const occurrence=String(i.collection||'').startsWith('gbif_map_')||String(i.collection||'').startsWith('gbif_sea_cucumber_map_')
    ? row('출현기록',`GBIF 공개 기록 ${count(s.recordCount)}`)+row('관측 기간',years(s))+row('원자료 학명',(i.original_names||[]).join(', '))
    : s.noOccurrences
    ? row('출현자료','미수집','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>한반도 주변 자료 조회 범위를 지도에 표시합니다. 이 범위가 이 종의 출현 위치나 분포를 뜻하지는 않습니다.</div>`
    : Number.isSafeInteger(s.recordCount)
      ? `<div class="evidence-item"><span>수집된 기록</span><b>${recordLabel(s)}</b></div><div class="evidence-item"><span>관측 기간</span><b>${years(s)}</b></div><div class="evidence-item"><span>원자료 학명</span><span>${esc((i.original_names||[]).join(', '))}</span></div><div class="withheld"><b>지도에 조사 범위 표시</b>좌표 불확실성 미기재 ${count(i.uncertainty_missing)} · 육지 위 품질경고 ${count(i.on_land_count)}. 공개 출현 셀 대신 자료 조회 범위를 표시하며, 좌표를 이동하거나 결측을 0으로 바꾸지 않았습니다.</div>`
      : row('출현자료','기록 수 미확인','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>발행 자료의 기록 수를 확인할 수 없어 0건으로 표시하지 않습니다. 지도에는 출현 위치 대신 자료 조회 범위를 표시합니다.</div>`;
  const evidence=s.v2?liveEvidence(s):'';
  const score=s.v2?'활용·보전 근거를 검수하는 중이라 점수를 계산하지 않았습니다. 미수집·보류 항목을 0점으로 처리하지 않습니다.':esc(s.productionSummary);
  const pilot=s.assessment;
  const pilotRows=pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':pilotScore(s,k).toFixed(1))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  const withheld=pilot?'근거가 부족한 항목은 산출 보류로 유지합니다. 시범 수치는 외부 사례 검증 전의 연구용 결과입니다.':score;
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>발행된 자료 요약</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다.</p></div><div><h3>이번 수집에서 확인한 것</h3><p>${esc(s.summary)}</p>${occurrence}<p class="fine">${esc(i.limitations)}</p>${mapSection(s)}${evidence}${row('자료 연결 현황',`${coverage.known}/5 항목 · 품질 점수 아님`)}<p class="fine">추가 확인: ${esc(coverage.missing.join(' · ')||'연결 여부는 모두 확인됨')}. 자료가 있어도 단위·시험 조건·평가 범위 등 품질 검증이 필요합니다.</p>${pilotRows}<div class="withheld"><b>${pilot?'시범 분석 주의':'통합점수 산출 보류'}</b>${withheld}</div></div><div class="source-area"><h3>출처와 이용조건</h3>${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>`<p>${sourceLink(data.assessmentInfo.sources[id].url,'시범 산출 근거 '+id+' ↗')} · ${esc(data.assessmentInfo.sources[id].license)}</p>`).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 원자료 자동 수집 기능은 아직 없습니다.</p></div>`;
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
  const degree=s.cells[0]?.sizeDeg||1;
  const single=s.cells.filter(c=>c.sites===1).length;
  const excluded=Object.entries(m.outcome||{}).filter(([k])=>k!=='accepted').map(([k,n])=>row(REASONS[k]||k,count(n))).join('')||row('제외','없음');
  const why=m.status==='held_sensitivity_review'?`<div class="withheld"><b>조사 범위 표시</b>출현 셀은 아직 발행되지 않았습니다. 지도에는 자료를 조회한 한반도 주변 범위를 표시합니다. ${esc(m.note)}</div>`:`<ul class="why">
<li><b>이용조건</b>CC0·CC BY 4.0 기록만 썼습니다. CC BY-NC ${count(m.nc_records)}은 비상업 이용 결정 전이라 쓰지 않았습니다.</li>
<li><b>좌표 품질</b>OBIS 해안선 거리로 육지 위 좌표를 제외했고 좌표를 옮기지 않았습니다. 불확실성 10 km 초과, 제공처가 흐리게 처리한 좌표, GBIF 좌표 오류 표시도 제외했습니다.</li>
<li><b>불확실성 결측</b>0으로 보지 않고 ${degree}° 셀에서만 썼습니다.</li>
<li><b>민감도</b>${degree===4?'채취 압력을 고려해 4° 광역 셀을 적용했습니다.':'아직 평가하지 않아 GBIF 지침에서 가장 엄격한 공개 수준인 1°를 적용했습니다.'}</li>
<li><b>중복·기존 자료</b>같은 표본 번호는 한 번만 셌고, 운영 DB에서 검토 중인 기존 기록은 쓰지 않았습니다.</li>
<li><b>비공개</b>원좌표와 기록 ID는 공개하지 않습니다.</li></ul>`;
  return `<h3>지도 셀</h3><p class="fine">선별된 출현기록을 공개 ${degree}° 셀의 도트 밀도 구간으로 보여줍니다. 도트는 실제 관측점·조사 지점·기록 1건이 아니며 원좌표는 공개하지 않습니다.</p>${row('공개 셀',s.cells.length?`${s.cells.length}개 · ${degree}°×${degree}°`:'없음',s.cells.length?'done':'pending')}${s.cells.length?row('조사 지점',count(cellSites(s),'곳'))+row('셀에 쓴 기록',count(cellRecords(s)))+row('셀 기록 연도',years({yearStart:Math.min(...s.cells.map(c=>c.yearStart)),yearEnd:Math.max(...s.cells.map(c=>c.yearEnd))})):''}${single?`<p class="fine">조사 지점이 1곳뿐인 셀 ${single}개: ${degree}° 범위 안의 대략적인 조사 위치가 드러납니다.</p>`:''}${m.note&&m.status!=='held_sensitivity_review'?`<p class="fine">${esc(m.note)}</p>`:''}<h3>${m.status==='held_sensitivity_review'?'지도 표시 기준':'왜 공개할 수 있는가'}</h3>${why}<h3>조회와 제외 <span class="fine">GBIF ${esc(m.retrieved)}</span></h3>${row('조회 기록(2000년 이후)',count(m.queried_records))}${row('CC0·CC BY 기록',count(m.open_records))}${excluded}<p class="fine">사유가 겹치는 기록은 사유마다 셉니다. 셀은 그 기간에 기록이 있었다는 뜻입니다. 분포 전체, 개체수, 자원량을 뜻하지 않습니다.</p>`;
}


// The public datasets contain only 1° (sea cucumber: 4°) aggregates. Dots are fixed schematic marks,
// not observations, and never encode individual record coordinates or a 1:1 count.
let landPolygons=[], dotRenderer;
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
function dotColumns(records){
  // These four bands are visual categories, not observed site or record totals.
  if(records>=100)return 5;
  if(records>=20)return 4;
  if(records>=5)return 3;
  return 2;
}
function addCellDots(lat0,lon0,size,records,color){
  if(!Number.isFinite(records)||records<=0)return;
  const cols=dotColumns(records);
  // Fixed inset grid: no random jitter, false precision or publication of raw coordinates.
  for(let row=0;row<cols;row++)for(let col=0;col<cols;col++){
    const lat=lat0+size*(.14+.72*(row+.5)/cols),lon=lon0+size*(.14+.72*(col+.5)/cols);
    if(onLand(lat,lon))continue; // Natural Earth coast approximation; no marks on mapped land.
    const dot=L.circleMarker([lat,lon],{renderer:dotRenderer,radius:map.getZoom()>=6?3:2.2,
      stroke:false,fillColor:color,fillOpacity:basemap==='basic'?.8:.95,interactive:false});
    dot._schematicDot=true;dot.addTo(overlay);
  }
}
function cellPopupNotice(size){
  return `<br><small>도트는 ${size}° 셀의 기록 수 구간을 보여주는 도식입니다. 각 점은 실제 출현 위치·기록 1건·조사 지점 1곳을 뜻하지 않습니다. 선별된 출현기록은 개체수·자원량·생물학적 가치·현재 한국 전체 분포가 아닙니다.</small>`;
}
function setMapLegend(live,s){
  // Live species without published cells only show the query extent (studyBounds).
  const extentOnly=live&&s&&!s.cells.length, size=s?.cells?.[0]?.sizeDeg||1;
  document.querySelector('.map-symbol').hidden=!!extentOnly;
  $('map-symbol-label').textContent=extentOnly?'점선 테두리: 자료 조회 범위':live?`선별된 출현기록 · 공개 ${size}° 셀`:'선별된 출현기록 · 별도 OBIS 시연 1° 격자';
  $('map-legend-note').textContent=extentOnly?'공개 출현 셀이 없습니다. 테두리는 출현 위치나 분포가 아닙니다.':'도트 밀도: 셀 기록 수 구간(1–4 / 5–19 / 20–99 / 100건 이상). 점 위치·개수는 실제 기록이나 조사 지점이 아닙니다. 셀을 누르면 실제 집계값과 출처가 나옵니다.';
}

function renderCellMap(s,color){
  const degree=s.cells[0]?.sizeDeg||1;
  $('map-review-note').textContent=`선별된 GBIF 출현기록을 공개 ${degree}° 셀의 도트 패턴으로 표시합니다. 도트는 실제 좌표가 아닙니다. 색은 선택 종 구분이며 가치·보전 등급이 아니고, 기록 수는 개체수·자원량·현재 한국 전체 분포를 뜻하지 않습니다.`;
  mapJudgmentStatus(s);
  const spatialTotals=new Map();
  for(const c of s.cells){
    const key=c.lat0+','+c.lon0;
    spatialTotals.set(key,(spatialTotals.get(key)||0)+c.records);
  }
  const dotted=new Set();
  for(const c of s.cells){
    // Transparent hit area: the dots are not interactive, so the cell carries the evidence popup.
    L.rectangle([[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]],{stroke:false,fillColor:color,fillOpacity:.001}).addTo(overlay)
      .bindPopup(`<strong>${esc(s.label)} · 선별 출현기록 ${c.sizeDeg}° 셀</strong><br><b>해역별 활용·보전 판단: 보류</b><br>기록 연도 ${esc(years(c))} · 공개 집계 기간 ${esc(c.period)}<br>기록의 해역 메타데이터 ${esc(c.seaAreas.map(x=>x==='해역명 미확인'?x:'LME '+x).join(', '))} · 국가 메타데이터 ${esc(c.countries.join(', ')||'미기재')}<br>공간 해상도 ${c.sizeDeg}°×${c.sizeDeg}° · 가장 짧은 변 약 ${esc(Number.isFinite(c.resolutionM)?Math.floor(c.resolutionM/1000):'미확인')} km<br>조사 지점 ${esc(c.sites)}곳 · 선별 기록 ${esc(c.records)}건${c.uncertaintyMissing?` · 좌표 불확실성 결측 ${esc(c.uncertaintyMissing)}건`:''}<br><b>이 셀의 출처·이용조건</b><ul>${occurrenceCitationLinks(c)||'<li>셀별 제공처 확인 필요</li>'}</ul><b>판단 보류 이유</b><ul>${cellAssessmentStatus(s,c).reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>CC0·CC BY 공개 기준 및 좌표 품질 필터를 통과한 일부 기록입니다. 조사 노력·중복·시기·경계 효과가 해역 간 비교용으로 보정되지 않았습니다. 원좌표·개체수·자원량·한국 전체 분포가 아닙니다.</small>`+cellPopupNotice(c.sizeDeg));
    const key=c.lat0+','+c.lon0;
    if(!dotted.has(key)){addCellDots(c.lat0,c.lon0,c.sizeDeg,spatialTotals.get(key),color);dotted.add(key);}
  }
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.map(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{padding:[60,60],maxZoom:7});}
  $('map-count').textContent=cellSites(s).toLocaleString();$('map-count').nextElementSibling.textContent='조사 지점';$('map-cells').textContent=s.cells.length;$('map-years').textContent=years({yearStart:Math.min(...s.cells.map(c=>c.yearStart)),yearEnd:Math.max(...s.cells.map(c=>c.yearEnd))});
}
function renderMap() {
  if(!map)return;
  map.invalidateSize(); // the detail pane can change the map column height
  overlay.clearLayers();
  const s=selected;if(!s)return;const color=colors[data.species.indexOf(s)%colors.length];
  $('map-source').textContent=s.live?(s.cells.length?`운영 지도 · 공개 ${s.cells[0].sizeDeg}° 셀`:'운영 지도 · 자료 조회 범위'):'OBIS 출현기록 · 시연 격자';
  $('map-count').nextElementSibling.textContent='수집된 기록';
  setMapLegend(s.live,s);
  if(s.live&&s.cells.length)return renderCellMap(s,color);
  mapJudgmentStatus(s);
  $('map-review-note').textContent=!s.live?'별도 OBIS 시연의 선별 출현기록을 1° 도트 패턴으로 표시합니다. 운영 DB와 별개입니다. 점은 실제 좌표나 기록 1건이 아니며, 기록 수와 색은 개체수·자원량·가치·보전 등급·현재 한국 전체 분포가 아닙니다.':'테두리는 자료를 조회한 범위(124–132°E · 33–38.7°N)입니다. 이 종의 출현 위치나 분포를 뜻하지 않습니다.';
  if(s.live){
    L.rectangle(studyBounds,{color:basemap==='basic'?'#267bab':'#ffd166',weight:2,dashArray:'10 7',fillColor:'#267bab',fillOpacity:.07})
      .addTo(overlay).bindPopup(`<strong>${esc(s.label)} · 자료 조회 범위</strong><br>124–132°E · 33–38.7°N<br><small>출현 위치나 분포 범위가 아닙니다.</small>`);
    if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(studyBounds,{padding:[30,30]});}
  }
  for(const cell of s.cells){
    L.rectangle([[cell.lat-.5,cell.lon-.5],[cell.lat+.5,cell.lon+.5]],{stroke:false,fillColor:color,fillOpacity:.001}).addTo(overlay)
      .bindPopup(`<strong>${esc(s.label)} · 자료 조회 범위</strong><br>124–132°E · 33–38.7°N<br><small>출현 위치나 분포 범위가 아닙니다.</small>`+cellPopupNotice(1));
    addCellDots(cell.lat-.5,cell.lon-.5,1,cell.count,color);
  }
  $('map-count').textContent=Number.isSafeInteger(s.recordCount)?s.recordCount.toLocaleString():'—';$('map-cells').textContent=s.live?'0':s.cells.length;$('map-years').textContent=years(s);
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
  prepareLandMask(geography);
  map=L.map('map',{zoomControl:true,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7});fitMap();
  initBasemaps(geography);
  const labels=[['대한민국',36.4,127.4],['북한',40.1,126.6],['일본',35.5,136.8],['중국',39,119.5]];
  for(const [name,lat,lon] of labels)L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'geo-label',html:name,iconSize:[70,20],iconAnchor:[25,10]})}).addTo(map);
  for(const [name,lat,lon] of [['서해',35.3,123],['동해',39,132],['남해',32.5,128]])L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'sea-label',html:name,iconSize:[60,20]})}).addTo(map);
  const dotPane=map.createPane('dotPane');dotPane.style.zIndex=390;dotPane.style.pointerEvents='none';
  dotRenderer=L.canvas({pane:'dotPane',padding:.5});
  overlay=L.layerGroup().addTo(map);
  map.on('zoomend',()=>overlay.eachLayer(layer=>{if(layer._schematicDot)layer.setRadius(map.getZoom()>=6?3:2.2);}));
  map.attributionControl.setPrefix('Leaflet');map.attributionControl.addAttribution('OBIS · GBIF');fitMap();setBasemap(savedBasemap());
}

function renderComparison(){
  const pending=t=>`<span class="pending">${t}</span>`;
  const v2=(s,fn,fallback)=>s.v2?fn(s.info):pending(fallback);
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],
    ['출현기록',s=>s.live&&s.cells.length?`${s.cells.length}셀 · 조사 지점 ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 ${s.cells[0].sizeDeg}° 셀 · GBIF CC0·CC BY</small>`:s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · ${s.live?'조사 범위 표시':s.cells.length+'격자'}<small>${years(s)} · 조회·선별된 자료</small>`],
    ['식량 근거 · MFPI',s=>pilotScore(s,'MFPI')!==null?pilotCell(s,'MFPI'):v2(s,({nutrition:n={}})=>n.status==='available'?`영양 ${count(n.record_count)}<small>실측 ${count(n.measured_count)} · 계산 ${count(n.calculated_count)} · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['생리활성 · MBPI',s=>pilotScore(s,'MBPI')!==null?pilotCell(s,'MBPI'):v2(s,({compounds:c={}})=>c.status==='available'?`보고 화합물 ${count(c.compound_count,'개')}<small>${c.quantitative_bioactivity_count===0?'정량 활성 자료 없음':'정량 활성 자료 '+count(c.quantitative_bioactivity_count)}</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['보전 평가 · MCUI',s=>pilotScore(s,'MCUI')!==null?pilotCell(s,'MCUI'):v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),IUCN_HISTORICAL[s.aphiaID]?'산출 보류':'평가 미조회')+(IUCN_HISTORICAL[s.aphiaID]?`<small>IUCN ${IUCN_HISTORICAL[s.aphiaID].category} · ${IUCN_HISTORICAL[s.aphiaID].published}년 발표 · 역사적 평가 · 현행 평가 확인 보류</small>`:'')],
    ['자료 연결 현황',s=>s.live?`${evidenceCoverage(s).known}/5 항목<small>출처·수량 확인 · 품질 점수 아님</small>`:pending('2/5 항목 · 품질 점수 아님')],
    ['통합점수 · BBVI',s=>pilotScore(s,'BBVI')!==null?pilotCell(s,'BBVI'):'<strong>산출 보류</strong>']];
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 ${data.species.length}종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${data.species.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${data.species.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function toggleSimulation(value){
  simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);
  const assessed=data?.species.filter(assessedForMatrix)||[];
  $('matrix-note').textContent=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`시범 지표 ${assessed.length}종 · BBVI와 MCUI가 모두 산출된 종만 표시합니다. 타당성 미검증.`:'실제 종의 두 축을 산출하지 못해 배치하지 않았습니다. 아래에서 종별 보류 사유와 확인된 원문을 볼 수 있습니다.';
  const points=[['A',24,74,'보전 우선 검토'],['B',77,76,'대체생산 연구 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map((s,i)=>`<button class="matrix-point pilot" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%" title="${esc(s.label)} · 시범 BBVI ${pilotScore(s,'BBVI')}, MCUI ${pilotScore(s,'MCUI')}" aria-label="${esc(s.label)} 시범 활용 지표 ${pilotScore(s,'BBVI')}, 보전 지표 ${pilotScore(s,'MCUI')}. 타당성 미검증">${i+1}</button>`).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){showDecision(assessed[i]);$('decision-detail').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
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
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';$('decision-list').textContent='';$('decision-detail').textContent='';$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';
  setMapLegend(live,null);
  $('data-label').textContent=live?'운영 자료':'기존 시연';
  $('score-disclaimer').innerHTML='학명·출현 자료를 연결한 첫 버전입니다. 활용가치와 보전 점수는 <strong>아직 산출하지 않았습니다.</strong>';
  $('scope-bounds').textContent=live?'124–132°E · 33–38.7°N · 시험 범위':'122–136°E · 30–43°N · 시연 범위';
  $('map-judgment').textContent='해역별 활용·보전 판단: 입력 확인 중';
  $('map-source').textContent=live?'운영 지도 · 공개 1° 셀':'OBIS 출현기록 · 시연 격자';
  try{
    const next=live?await loadPublishedProfiles():await fetch('data.json').then(r=>{if(!r.ok)throw Error('시연 자료를 불러오지 못했습니다.');return r.json();});
    if(request!==requestNumber)return;
    if(live)await attachPilotAssessments(next);
    if(request!==requestNumber)return;
    if(next.species.some(s=>s.assessment))$('score-disclaimer').innerHTML='일부 종에 <strong>검증 전 시범 지표</strong>가 있습니다. 연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];mapJudgmentStatus(selected);renderList();renderDetail();renderMap();renderComparison();renderDecisionList();renderSources();
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
start();
