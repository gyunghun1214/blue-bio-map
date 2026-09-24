'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'basic';
let bioactivityReport = null; // PR #5 research snapshot only; never an approved scoring input.
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
    ['정량 활성 연결 검증', false], // published summary counts have no compound–assay–paper join
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
      if(!a.source_ids.every(id=>report.sources?.[id]?.url))continue;
      if(!['MFPI','MBPI','MCUI','BBVI'].every(k=>a.scores[k]===null||(Number.isFinite(a.scores[k])&&a.scores[k]>=0&&a.scores[k]<=100)))continue;
      s.assessment=a;
    }
    next.assessmentInfo={foodWeight:report.food_weight,generatedAt:report.generated_at,sources:report.sources};
  } catch { /* A malformed optional report must not hide the underlying species evidence. */ }
}


// Optional read-only research snapshot. No field here flows into assessments or scoring.
async function loadBioactivityResearch() {
  bioactivityReport=null;
  try {
    const response=await fetch('bioactivity-evidence.json',{cache:'no-store'});
    if(!response.ok)return;
    const report=await response.json();
    if(report.schema_version===1 && report.status==='research_unapproved' && Array.isArray(report.cases))
      bioactivityReport=report;
  } catch { /* Missing research notes do not suppress the published species profile. */ }
}
function bioactivityEvidence(s) {
  const entry=bioactivityReport?.cases.find(c=>c.aphia_id===s.aphiaID && c.scientific_name===s.name);
  const heading='<h3>정량 생리활성 연결 검증 보류</h3>';
  if(!entry)return heading+'<div class="withheld"><b>종별 원문 연결 미확인</b>발행 요약의 화합물·활성 건수만으로 기원종, 시험물질, 표적, 값과 원논문을 이어 붙일 수 없습니다. 자료 미확인은 활성 없음 또는 0점이 아닙니다.</div>';
  const assays=entry.measurements.map(m=>row(m.endpoint,m.value+' '+m.unit)).join('');
  return heading+`<p class="fine">PR #5 조사 요약 · ${esc(bioactivityReport.reviewed_at)} 조회 · 승인된 MBPI 입력 아님 · ${sourceLink(bioactivityReport.source_pr,'조사 PR ↗')}</p>
    ${row('기원종(저장소 학명)',entry.scientific_name+' · AphiaID '+entry.aphia_id)}
    ${row('보고 물질',entry.material+' · '+entry.kind)}
    ${row('논문 내 식별',entry.paper_identifier)}
    ${row('외부 화학 ID',entry.external_identifier||'미확정 · CID/InChIKey 연결 보류','pending')}
    ${row('표적·시험 생물',entry.target)}
    ${row('실험 종류',entry.method)}${assays}
    <p class="fine">원논문 ${sourceLink(entry.url,entry.source+' · DOI '+entry.doi+' ↗')} · 조회 ${esc(entry.accessed)} · 이용조건: ${esc(entry.terms)}</p>
    <div class="withheld"><b>${esc(entry.status)}</b>확인: ${esc(entry.confirmed)}<br>끊긴 연결: ${esc(entry.gap)}</div>
    <p class="fine">${esc(entry.caveat)} 실험실 결과는 종 전체의 약효나 임상 효능을 입증하지 않습니다.</p>`;
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
  const evidence=[['학명·식별자','WoRMS 연결','done'],['출현기록','OBIS 연결','done'],['식량 근거 · MFPI','자료 미확인',''],['생리활성 · MBPI','정량 연결 검증 보류',''],['보전 평가 · MCUI','평가 미조회','']];
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>SPECIES EVIDENCE</span><span class="verified">정명 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 식별번호를 기준으로 합니다.</p></div><div><h3>연결된 근거 <span class="fine">2 / 5 항목 · 품질 점수 아님</span></h3>${evidence.map(e=>`<div class="evidence-item"><span>${e[0]}</span><span class="${e[2]}">${e[1]}</span></div>`).join('')}${bioactivityEvidence(s)}<div class="withheld"><b>통합점수 산출 보류</b>활용·보전 자료를 검수한 뒤 점수 계산 여부를 결정합니다. 미확인 자료를 0점으로 처리하지 않습니다.</div></div><div class="source-area"><h3>출처와 범위</h3><a class="source-link" href="${esc(safeUrl(s.wormsUrl))}" target="_blank" rel="noopener"><span>WoRMS · 학명 확인</span><span>↗</span></a><a class="source-link" href="${esc(safeUrl(s.queryUrl))}" target="_blank" rel="noopener"><span>OBIS · 조회 조건과 응답</span><span>↗</span></a><p class="fine">조회 응답 ${s.reportedTotal.toLocaleString()}건 중 ${s.retrievedCount.toLocaleString()}건 취득, 선별 후 ${s.recordCount.toLocaleString()}건 표시. 연도 미기재 ${s.undated}건. 기록 간 중복·동정 정확성은 추가 검수 대상입니다.</p><button class="text-button" id="detail-sources">데이터셋 ${s.sources.length}개와 이용 조건 보기 →</button></div>`;
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
    ? row('CMNPD 보고 화합물 · 활성 입증 아님',count(c.compound_count,'개'))
      +row('정량 활성 요약 · 원문 연결 미검증',c.quantitative_bioactivity_count===0?'요약 0건 · 활성 부재 판정 아님':count(c.quantitative_bioactivity_count))
      +(c.note?`<p class="fine">${esc(c.note)}</p>`:'')
      +`<p class="fine">출처 ${cmnpd?sourceLink(cmnpd.url,'CMNPD ↗'):'CMNPD'} · ${cmnpd?sourceLink(cmnpd.licenseUrl,'CC BY-NC-SA 4.0'):'CC BY-NC-SA 4.0'} — 비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다.</p>`
    : row('보고 화합물',c.status==='not_collected'?'미수집':'정보 없음','pending');
  const conservation={
    withheld_insufficient_evidence:row('보전평가','근거 부족으로 보류','pending')+row('검토 기록',`IUCN 검색 기록 ${count(k.search_record_count)} · 평가 ${count(k.assessment_count)}`)+(k.note?`<p class="fine">${esc(k.note)}</p>`:''),
    not_reviewed:row('보전평가','미검토','pending')
  }[k.status]||row('보전평가','정보 없음','pending');
  return `<h3>영양 근거</h3>${nutrition}${aquaculture}<h3>화합물 목록 요약 · 효능 판단 아님</h3>${compounds}<h3>보전</h3>${conservation}`;
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
  const pilotRows=pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':pilotScore(s,k).toFixed(1))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  const withheld=pilot?'근거가 부족한 항목은 산출 보류로 유지합니다. 시범 수치는 외부 사례 검증 전의 연구용 결과입니다.':score;
  $('detail').innerHTML=`<div class="detail-head"><div class="detail-top"><span>발행된 자료 요약</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p><div class="identity"><span>AphiaID</span><strong>${s.aphiaID}</strong></div><p class="fine">국명은 탐색용 표시명입니다.</p></div><div><h3>이번 수집에서 확인한 것</h3><p>${esc(s.summary)}</p>${occurrence}<p class="fine">${esc(i.limitations)}</p>${mapSection(s)}${evidence}${bioactivityEvidence(s)}${row('자료 연결 현황',`${coverage.known}/5 항목 · 품질 점수 아님`)}<p class="fine">추가 확인: ${esc(coverage.missing.join(' · ')||'연결 여부는 모두 확인됨')}. 자료가 있어도 단위·시험 조건·평가 범위 등 품질 검증이 필요합니다.</p>${pilotRows}<div class="withheld"><b>${pilot?'시범 분석 주의':'통합점수 산출 보류'}</b>${withheld}</div></div><div class="source-area"><h3>출처와 이용조건</h3>${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>`<p>${sourceLink(data.assessmentInfo.sources[id].url,'시범 산출 근거 '+id+' ↗')} · ${esc(data.assessmentInfo.sources[id].license)}</p>`).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 원자료 자동 수집 기능은 아직 없습니다.</p></div>`;
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
  const entries=[['학명·식별자',s=>`WoRMS 확인<small>AphiaID ${s.aphiaID}</small>`],
    ['출현기록',s=>s.live&&s.cells.length?`${s.cells.length}셀 · 조사 지점 ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 1° 셀 · GBIF CC0·CC BY</small>`:s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · ${s.live?'위치 검토 중':s.cells.length+'격자'}<small>${years(s)} · 조회·선별된 자료</small>`],
    ['식량 근거 · MFPI',s=>pilotScore(s,'MFPI')!==null?pilotCell(s,'MFPI'):v2(s,({nutrition:n={}})=>n.status==='available'?`영양 ${count(n.record_count)}<small>실측 ${count(n.measured_count)} · 계산 ${count(n.calculated_count)} · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['생리활성 · MBPI',s=>pilotScore(s,'MBPI')!==null?pilotCell(s,'MBPI'):v2(s,({compounds:c={}})=>c.status==='available'?`CMNPD 목록 ${count(c.compound_count,'개')}<small>약효 아님 · 정량 요약 ${count(c.quantitative_bioactivity_count)} · 종–물질–시험–원문 연결 보류</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인')],
    ['보전 평가 · MCUI',s=>pilotScore(s,'MCUI')!==null?pilotCell(s,'MCUI'):v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),'평가 미조회')],
    ['자료 연결 현황',s=>s.live?`${evidenceCoverage(s).known}/5 항목<small>출처·수량 확인 · 품질 점수 아님</small>`:pending('2/5 항목 · 품질 점수 아님')],
    ['통합점수 · BBVI',s=>pilotScore(s,'BBVI')!==null?pilotCell(s,'BBVI'):'<strong>산출 보류</strong>']];
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 ${data.species.length}종의 자료 연결 현황</caption><thead><tr><th scope="col">확인 항목</th>${data.species.map(s=>`<th scope="col">${esc(s.label)}<small>${esc(s.name)}</small></th>`).join('')}</tr></thead><tbody>${entries.map(([title,cell])=>`<tr><th scope="row">${title}</th>${data.species.map(s=>`<td>${cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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
  await loadBioactivityResearch();await loadCollection();registerTools();
}
$('collection').addEventListener('change',loadCollection);$('reload-data').addEventListener('click',loadCollection);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('search').addEventListener('input',()=>{if(data)renderList();});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
start();
