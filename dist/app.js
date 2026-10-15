'use strict';
const $ = id => document.getElementById(id);
// Published data still carries the older label words; the screen shows the neutral wording (team-lead decision 2026-10-08).
// 4.16 (2026-10-15): the single-paper label means the top MBPI item has no independent replication, so the screen says so.
const plainWords = text => text.replace(/역검증 미통과/g,'역검증 기준 미충족').replace(/사후 검증 미통과/g,'사후 검증 기준 미충족').replace(/검증 미통과/g,'방법 검증 기준 미충족').replace(/단일 논문/g,'최상위 근거 독립 재현 확인 중')
  .replace(/기준 미통과/g,'기준 미충족').replace(/미충족([’'")]?)(를|는|가|로|라|와)/g,(_,q,p)=>'미충족'+q+({를:'을',는:'은',가:'이',로:'으로',라:'이라',와:'과'})[p]);
const esc = value => plainWords(String(value ?? '')).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colors = ['#07867d','#267bab','#a16928'];
const studyBounds = [[33,124],[38.7,132]];
let data, selected, map, overlay, simulated = false, currentView = 'explore', basemap = 'satellite', bbviWeight = .5, mapMode = 'occurrence', selectedValueCell = null, pickedValueCell = null, comparisonFocus = null, matrixReadiness = new Map();
const VERIFIED = ['verified-pilot-2','verified-pilot-2.1','verified-pilot-2.2','verified-pilot-2.3','verified-pilot-3.1','verified-pilot-3.2','verified-pilot-3.3','verified-pilot-3.4','verified-pilot-3.5','verified-pilot-3.6','verified-pilot-3.7','verified-pilot-3.8','verified-pilot-3.9','verified-pilot-3.10','verified-pilot-3.11','verified-pilot-3.12','verified-pilot-3.13','verified-pilot-3.14','verified-pilot-3.15','verified-pilot-3.16','verified-pilot-3.17','verified-pilot-3.18','verified-pilot-3.19','verified-pilot-3.20','verified-pilot-3.21','verified-pilot-3.22','verified-pilot-3.23','verified-pilot-3.24','verified-pilot-3.25','verified-pilot-3.26','verified-pilot-3.27','verified-pilot-3.28','verified-4.0','verified-4.1','verified-4.2','verified-4.3','verified-4.4','verified-4.5','verified-4.6','verified-4.7','verified-4.8','verified-4.9','verified-4.10','verified-4.11','verified-4.12','verified-4.13','verified-4.14','verified-4.16','verified-4.17','verified-4.18','verified-4.19'];
// 2.1 and later: an MBPI resting on fewer than the minimum independent DOIs is labelled and never enters BBVI.
const singleSourceRule = version => VERIFIED.indexOf(version)>=1;
// 2.3: a used cross-origin potency replication adds its DOI to independent_dois; without it the origin DOIs count.
const mbpiDois = x => new Set((x.independent_dois||x.original_paper_dois).map(d=>d.toLowerCase()));
// 3.1: a ChEMBL item needs both the species link and the activity on separate papers, so the weaker side counts.
const mbpiSources = x => x.stratum_kind==='chembl'?x.independent_sources:mbpiDois(x).size;
const bestBio = a => (a?.bioactivity_trace||[]).reduce((p,x)=>!p||x.adjusted>p.adjusted?x:p,null);
// 2026-10-12: MBPI is the highest of percentiles taken inside separate strata, and each stratum ranks against its own
// comparison group, so a value is shown with the stratum of its top item (bestBio). One dictionary for every place that
// names it: stratum_id first, then stratum_kind, then the species' mbpi_stratum. The two ACE rows are the items the 'ace'
// use chip reads (USE_TRAITS); test_trait_display_ui.mjs keeps the two in step. 'Food' is said only of the two strata whose
// collections are mostly food-protein peptides (AHTPDB abstract: 35 sources such as milk, egg, fish; XO members' records).
const MBPI_STRATUM_LABELS={
  ace_peptide:{ace:true,short:'ACE 펩타이드',long:t=>`ACE 저해 펩타이드(AHTPDB ${t.peer_peptides}개 안 순위 · 식품 단백질 유래가 주를 이루는 항고혈압 펩타이드 모음)`},
  ace_compound:{ace:true,short:'ACE 화합물',long:t=>`ACE 저해 화합물(감태 논문 1편의 분리 화합물 ${t.peer_compounds}개 안 순위)`},
  xo:{short:'잔틴 산화효소 펩타이드',long:t=>`잔틴 산화효소 억제 펩타이드(문헌 비교집단 ${t.peer_peptides}개 안 순위 · 식품 단백질에서 찾은 서열이 많은 모음)`},
  chembl:{short:'ChEMBL 화합물',long:t=>`ChEMBL 화합물(같은 표적·같은 종말점 활성 기록 ${t.cohort_records}건 안 순위)`},
  relaxed:{short:'ChEMBL 표적(펩타이드)',long:t=>`펩타이드를 ChEMBL 표적 비교집단(활성 기록 ${t.cohort_records}건)에서 순위(완화 산출 d)`},
  anticancer:{short:'항암 펩타이드',long:t=>`항암 펩타이드(CancerPPD 2.0 ${t.cell_line} 세포주 ${t.peer_peptides}개 안 순위)`},
  amp:{short:'항균 펩타이드',long:t=>`항균 펩타이드(DBAASP ${t.target_species} MIC ${t.peer_peptides}개 안 순위)`},
  compound:{short:'분리 화합물',long:()=>'분리 화합물(같은 논문·같은 시험 조건 안 순위)'},
};
const MBPI_STRATUM_KEYS={id:{'ahtpdb-ace-ic50-hhl-cushman-cheung':'ace_peptide','wijesinghe-2011-cell-free-ACE-IC50':'ace_compound'},
  kind:{peptide:'ace_peptide',chembl:'chembl',relaxed:'relaxed',anticancer:'anticancer',amp:'amp',xo:'xo'},species:{small_molecule:'compound'}};
// The stratum of one trace item; an unregistered stratum never shows its raw id.
const itemStratum = (t,a) => {
  const key=MBPI_STRATUM_KEYS.id[t.stratum_id]||MBPI_STRATUM_KEYS.kind[t.stratum_kind]||MBPI_STRATUM_KEYS.species[a.mbpi_stratum]||null, e=MBPI_STRATUM_LABELS[key];
  return e?{key,ace:!!e.ace,short:e.short,long:e.long(t)}:{key:null,ace:false,short:'층 이름 미등록',long:'층 이름 미등록'};
};
// The stratum of the species' top MBPI item, or null without an item.
const mbpiStratum = a => {const t=bestBio(a);return t?itemStratum(t,a):null;};
// Named only beside an MBPI that comes from an item: never beside a withheld MBPI or the 0-point floor.
const mbpiStratumOf = s => !s?.assessment||axisState(s,'MBPI').value===null||s.assessment.mbpi_floor?null:mbpiStratum(s.assessment);
// 4.10 (2026-10-12): the secondary, exploratory MBPI-Rx (method.mbpi_rx) is the MBPI rule over the trace items whose stratum
// the pre-registration classed 'include' (ACE and xanthine-oxidase peptide strata out). The browser re-derives it from the
// trace as it does MBPI and shows it only in the species detail, the compare data table and #method-03, never in BBVI, cards,
// the map, the matrix or the expedition. {value, stratum} or {value:null, reason}; null when absent, MBPI hidden or a fault.
const mbpiRxOf = s => {
  const a=s?.assessment, rule=data?.assessmentInfo?.method?.mbpi_rx, rx=a?.mbpi_rx;
  if(!rule||!rx||a.axis_errors?.MBPI||axisState(s,'MBPI').value===null)return null;
  const items=a.bioactivity_trace||[], cls=rule.classified_strata||{};
  if(items.some(x=>!['include','exclude'].includes(cls[x.stratum_id])))return null;
  const kept=items.filter(x=>cls[x.stratum_id]==='include');
  if(rx.excluded_item_count!==items.length-kept.length)return null;
  if(!kept.length)return rx.value===null&&!!rx.reason&&rx.reason===rule.reasons?.[items.length?'only_excluded':'no_item']?{value:null,reason:rx.reason}:null;
  const best=Math.max(...kept.map(x=>x.adjusted)), top=items[rx.top_item?.trace_index];
  if(!top||cls[top.stratum_id]!=='include'||top.adjusted!==best||top.stratum_id!==rx.stratum_id||!Number.isFinite(rx.value)||Math.abs(rx.value-best)>=.06)return null;
  return {value:rx.value,stratum:itemStratum(top,a)};
};
// 2026-10-15 (display only): what kind of evidence an MBPI rests on. 'functional' = the strata the MBPI-Rx pre-registration
// classes 'exclude' (ACE·잔틴 산화효소 peptides, food-protein functional peptides); every other stratum is a drug target
// (항균·항암·기타 표적). Nothing is recomputed: share = functional items / scored items, kind = the class of the item MBPI takes
// (bestBio). Null where MBPI shows no item (withheld, the 0-point floor) or a stratum is unclassified.
const MBPI_KINDS={drug:{short:'의약 표적',long:'의약 표적(항균·항암·기타 표적)'},functional:{short:'기능성 펩타이드',long:'기능성 펩타이드(ACE·XO)'}};
const mbpiKindOf = s => {
  const a=s?.assessment, cls=data?.assessmentInfo?.method?.mbpi_rx?.classified_strata;
  if(!cls||!a||a.axis_errors?.MBPI||a.mbpi_floor||axisState(s,'MBPI').value===null)return null;
  const items=a.bioactivity_trace||[];
  if(!items.length||items.some(x=>!['include','exclude'].includes(cls[x.stratum_id])))return null;
  const functionalItems=items.filter(x=>cls[x.stratum_id]==='exclude').length, kind=cls[bestBio(a).stratum_id]==='exclude'?'functional':'drug';
  return {kind,...MBPI_KINDS[kind],items:items.length,functionalItems,share:functionalItems/items.length,topFunctional:kind==='functional'};
};
// 'ACE·XO 항목 3/6 (50%)': the share of the scored items in the functional strata, the same words on every surface
const mbpiKindShare = k => `ACE·XO 항목 ${k.functionalItems}/${k.items}(${Math.round(k.share*100)}%)`;
const years = item => item.yearStart ? (item.yearStart===item.yearEnd ? String(item.yearStart) : `${item.yearStart}–${item.yearEnd}`) : '연도 미기재';
const safeUrl = url => /^https?:\/\//i.test(String(url || '')) ? url : '#';
// Sources whose publisher moved the file for good (reports/link-check, 2026-10-15). The data keeps the address as it was
// read; the link opens the new address and says so. Same list in expedition.js.
const MOVED_LINKS = {
  'https://www.fao.org/3/I6655EN/uFiSh1.0.xlsx':'https://openknowledge.fao.org/server/api/core/bitstreams/11bf98db-a942-43ff-9271-6b8adf1166c9/content',
  'https://www.fao.org/3/I6655EN/i6655en.pdf':'https://openknowledge.fao.org/server/api/core/bitstreams/d48eb825-b91f-431f-8374-f882c1d647a4/content'
};
const sourceLink = (url,label) => MOVED_LINKS[url]
  ? `<a href="${esc(MOVED_LINKS[url])}" target="_blank" rel="noopener" title="원래 주소: ${esc(url)}">${esc(label)}</a> <small class="moved-link">원문 이동됨</small>`
  : `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)}</a>`;
const recordLabel = s => s.noOccurrences ? '출현자료 미수집'
  : Number.isSafeInteger(s.recordCount) ? s.recordCount.toLocaleString()+'건' : '기록 수 미확인';
// Evidence stages are independent of the operational DB's old inventory counters.
// A paper or a search with no matching assessment never becomes a scored input.
// A candidate release file newer than this code is not a failed review; only a refresh is needed (live-data.js).
const releaseMissing = s => s.releaseOutdated ? '검수 자료 새 버전 있음 · 새로고침(F5)' : '검수 자료 확인 실패';
const coverageStages={checked_none:'평가 없음 확인',searched_none:'조사 완료 · 근거 미발견',unavailable:'미확인',found:'원자료 발견',linked:'종 연결',verified:'원문 확인',calculated:'시범 산출',validated:'방법 검증 통과'};
// After 3.14 (team-lead decision 2026-10-01): an axis is labelled by its own post-hoc validation result (method.posthoc), never by
// intent. BBVI counts as validated only when both MFPI and MBPI passed. A failed or missing check keeps the pilot label.
const validationResult = (key,info=data?.assessmentInfo) => {
  const sets=info?.method?.posthoc?.validation_sets||{}, r=k=>['passed','failed'].includes(sets[k]?.result)?sets[k].result:null;
  return key==='BBVI'?(r('MFPI')==='passed'&&r('MBPI')==='passed'?'passed':r('MFPI')==='failed'||r('MBPI')==='failed'?'failed':null):r(key);
};
// a passed check is a method check on n species (validation_sets[key].n), so the label says so rather than implying each species was checked
const validationN = (key,info=data?.assessmentInfo) => info?.method?.posthoc?.validation_sets?.[key]?.n;
// 4.0 (team-lead decision 2026-10-04): a released report ('verified-4.0' and later, status 'released') is 정식 산출 under
// frozen rules. Each axis keeps its own validation result on screen; pilot reports keep the pilot wording.
const released = (info=data?.assessmentInfo) => /^verified-\d/.test(info?.version||'');
const P_ = () => released()?'':'시범 ';
const stageName = k => k==='calculated'&&released()?'정식 산출':coverageStages[k];
const pilotLabel = (key,info) => released(info)
  ? ({passed:'정식 산출 · 방법 검증 통과'+(validationN(key,info)?`(${validationN(key,info)}종 비교)`:''),failed:'정식 산출 · 방법 검증 기준 미충족'})[validationResult(key,info)]||(key==='MCUI'?'정식 산출 · 공식 평가 범주':'정식 산출')
  : ({passed:'시범 지표 · 방법 검증 통과'+(validationN(key,info)?`(${validationN(key,info)}종 비교)`:''),failed:'시범 지표 · 사후 검증 기준 미충족'})[validationResult(key,info)]||'검증 전 시범 지표';
const validationNote = info => released(info)
  ? ' (검증: '+['MFPI','MBPI'].map(k=>k+' '+({passed:'통과',failed:'기준 미충족'}[validationResult(k,info)]||'전')).join(' · ')+' · MCUI '+((info||data?.assessmentInfo)?.method?.mcui_scope?.preliminary_bases?.length?'보전 평가 범주(IUCN 전 지구·한국 국가 평가 우선)':'공식 평가 범주')+((info||data?.assessmentInfo)?.method?.mcui_scope?((info||data?.assessmentInfo).method.mcui_scope.preliminary_bases?.length?'':'(IUCN 전 지구·한국 국가 평가만, 없으면 보전평가 미확인)'):(info||data?.assessmentInfo)?.method?.mcui_substitutes?.preliminary_scored?', 공식 평가가 없는 종은 '+((info||data?.assessmentInfo)?.method?.mcui_substitutes?.sub_national?.scored_backtest_results?'자체 예비평가':'지방 목록·자체 예비평가'):'')+((info||data?.assessmentInfo)?.method?.mcui_stock_decline?' · 자원 감소 신호(KOSIS 어획량)는 같은 자료 일관성 확인':'')+')'
  : ' (사후 검증: '+['MFPI','MBPI','MCUI'].map(k=>k+' '+({passed:'통과',failed:'기준 미충족'}[validationResult(k,info)]||'전')).join(' · ')+')';
function evidenceCoverage(s) {
  if(s.catalog&&s.audit){
    const a=s.audit;
    const checks=[
      {name:'학명',stage:'verified',detail:'WoRMS 승인명과 AphiaID 연결. 별도 GBIF 동의어는 원문 확인 뒤 연결.'},
      {name:'출현',stage:s.cells.length?'linked':s.review?.gbif.queried||s.review?.obis.queried?'found':'unavailable',
        detail:s.review?`${reviewLine(s.review)}. ${s.cells.length?'통과 기록만 공개 셀에 연결.':'공개 기준 통과 기록 없음 · 종 부재가 아님.'} 제외: ${withheldLine(s.review)}.`:`출현 ${releaseMissing(s)}.`},
      {name:'영양',stage:a.nutrition.foodCode?'found':'unavailable',
        detail:a.nutrition.foodCode?'RDA 식품명 후보만 발견. 종 수준 시료 연결은 검수 전.':'종에 연결할 식품 행 미확인.'},
      {name:'생리활성',stage:pilotScore(s,'MBPI')!==null?'calculated':'unavailable',detail:pilotScore(s,'MBPI')!==null?'원논문 근거로 '+(released()?'정식':'검증 전 시범')+' MBPI 산출. 근거 수준은 종별 상세의 라벨 참조.':'기원종·화합물·정량 실험 원문 미검수.'},
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
      detail:pilotScore(s,'MFPI')!==null?(validationResult('MFPI')==='passed'?`동기준 영양·가식부·양식 근거로 ${released()?'정식':'시범'} MFPI를 산출했습니다. MFPI 방법은 같은 종의 일본 식품성분표 값으로 다시 계산해도 순위가 유지되는지 본 방법 검증(${validationN('MFPI')||'?'}종 비교)을 통과했습니다. 이 종의 값을 따로 검증한 것은 아닙니다.`:'동기준 영양·가식부·양식 근거로 '+(released()?'정식':'검증 전 시범')+' MFPI를 산출했습니다.'):foodLinked?'종별 원값은 확인했으나 시료 상태·가식부·동일 기준 비교 또는 양식 근거가 부족해 MFPI는 보류합니다.':'영양 자료가 있더라도 이 종의 비교 가능한 원값인지 확인해야 합니다.'},
    {name:'생리활성',stage:pilotScore(s,'MBPI')!==null&&!a?.mbpi_floor?(validationResult('MBPI')==='passed'?'validated':'calculated'):bioLinked?'linked':partial.length||compounds.status==='available'?'found':released()&&a?.chembl_links?.paper_search?.searched_on?'searched_none':'unavailable',
      detail:pilotScore(s,'MBPI')!==null&&a?.mbpi_floor?`${a.mbpi_label}: 어느 비교집단 층에도 규칙을 채우는 항목이 없어 하한값 ${a.mbpi_floor.value}을 썼습니다(팀장 결정 2026-10-05). ${a.mbpi_floor.meaning}`:pilotScore(s,'MBPI')!==null?`${bestBio(a)?.stratum_kind==='chembl'?`종→화합물 공개 연결(LOTUS·원논문)과 ChEMBL 같은 표적·종말점 비교집단으로 ${released()?'정식':'시범'} MBPI를 산출했습니다(${bestBio(a).label}).`:'기원종·확정 구조·정량 실험·동일 층 비교집단을 검수해 '+(released()?'정식':'시범')+' MBPI를 산출했습니다.'}${a.mbpi_label?(bbviLabel(s)?` ${a.mbpi_label}: 독립 원논문 재현 전이라 BBVI에도 '${bbviLabel(s)}' 표시를 붙입니다.`:data?.assessmentInfo?.method?.bbvi?.single_source_policy==='score_with_label'?'':` ${a.mbpi_label}: 독립 원논문 재현 전이라 BBVI에 쓰지 않습니다.`):''}`:partial.length?'논문 단서만으로는 기원종→확정 물질→정량 시험→동일 조건 비교집단을 모두 연결하지 못했습니다. MBPI는 보류합니다.':'화합물 건수나 시험 생물만으로 종의 정량 활성은 확인되지 않습니다.'},
    {name:'보전',stage:pilotScore(s,'MCUI')!==null?(validationResult('MCUI')==='passed'?'validated':'calculated'):conservation?.iucn_state==='assessed'?'linked':conservation?.recheck?'checked_none':'unavailable',
      detail:(stockMcui(s)?stockLead(s)+' ':'')+(s.assessment?.conservation_status&&data?.assessmentInfo?.method?.mcui_scope&&!s.assessment.mcui_basis?conservationStatusSentence(s):earlyMcui(s)?`${iucnGlobalNote(s)}이고 한국 국가 평가도 없어, ${esc(s.assessment.conservation_status.preliminary?.label||'예비 평가')}로 ${released()?'정식':'시범'} MCUI를 산출했습니다. IUCN 또는 국립해양생물자원관의 공식 결과가 나오면 바로 그 값으로 바꿉니다.`:nationalMcui(s)?`${iucnGlobalNote(s)}. 그래서 한국 국가생물적색자료집 등급으로 ${released()?'정식':'시범'} MCUI를 산출했습니다. IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.`:preliminaryMcui(s)?`${iucnGlobalNote(s)}이고 한국·서식국·지방 공식 목록에도 점수가 되는 범주가 없어, 분포 기록으로 확인한 자체 예비평가(Rapid LC, 역검증 기준 미충족)으로 MCUI를 산출했습니다. 공식 평가가 아니며 IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.`:substituteMcui(s)?`${iucnGlobalNote(s)}이고 한국 국가 평가도 없어, ${esc(mcuiBasisLabel(s))} ${released()?'정식':'시범'} MCUI를 산출했습니다. 공식 IUCN 평가가 아니며 IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.`:pilotScore(s,'MCUI')!==null?'검수된 IUCN 평가와 현행 여부를 확인해 독립적인 '+(released()?'정식':'시범')+' MCUI를 산출했습니다.':conservation?.iucn_state==='not_in_red_list'?(conservation.recheck?`IUCN 적색목록(${conservation.recheck.red_list_version})과 한국·서식국 공식 목록을 ${conservation.recheck.checked_on}에 다시 확인했으나 이 종의 평가 기록이 없습니다(IUCN 미평가). 낮은 점수가 아니며, IUCN 2026-2는 2026-11-26 공개 예정입니다.`:'IUCN을 검색했으나 이 종의 평가 레코드를 확인하지 못했습니다. 공식 NE 판정이 아닙니다.'):'현행 평가의 등급·범위·평가일을 확인하기 전까지 MCUI를 보류합니다.')}
  ];
  return {checks};
}
function coverageBar(s){
  const checks=evidenceCoverage(s).checks;
  return `<div class="coverage-bar" role="list" aria-label="종별 자료 단계. 품질 점수나 완성률 아님">${checks.map(c=>`<span class="seg ${c.stage}" role="listitem" title="${esc(c.name+' · '+stageName(c.stage)+': '+c.detail)}"><b>${esc(c.name)}</b><small>${esc(stageName(c.stage))}</small></span>`).join('')}</div>`;
}
function coverageNotes(s){
  return '<ul class="coverage-notes">'+evidenceCoverage(s).checks.map(c=>`<li><b>${esc(c.name)} · ${esc(stageName(c.stage))}</b> — ${esc(c.detail)}</li>`).join('')+'</ul>';
}
const coverageGuide=()=>'학명·출현·영양·생리활성·보전 자료를 원자료 발견 → 종 연결 → 원문 확인 → '+(released()?'정식':'시범')+' 산출 → 방법 검증 통과 단계로 표시합니다. 단계는 완성률이나 근거 품질 점수가 아닙니다. 평가 검색 0건은 공식 미평가(NE)가 아닙니다.';

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

// the builder's one-decimal rule (Decimal(str(x)) ROUND_HALF_UP): toPrecision drops the float tail first, so 64.15 → 64.2
const round1=x=>Math.round(Number((x*10).toPrecision(12)))/10;
// 4.14 (prereg-4.14-2026-10-14 6): the unrounded MFPI and MBPI the report computed BBVI from, when it carries them and they
// round to its published values; an older report re-mixes its rounded values as before
const unroundedInputs=s=>{const a=s.assessment,u=a?.scores_unrounded,f=a?.scores?.MFPI,b=a?.scores?.MBPI;
  return u&&Number.isFinite(u.MFPI)&&Number.isFinite(u.MBPI)&&round1(u.MFPI)===f&&round1(u.MBPI)===b?[u.MFPI,u.MBPI]:null;};
// BBVI at food weight w before display rounding (null where the report holds it). Types are judged on this value.
const bbviRawAt=(s,w)=>{
  if(!VERIFIED.includes(s.assessment?.report_version)){const v=pilotScore(s,'BBVI');return v;}
  const a=s.assessment, f=a.scores?.MFPI, b=a.scores?.MBPI;
  if(a.score_status?.BBVI!=='산출됨'||!Number.isFinite(f)||!Number.isFinite(b)||!Number.isFinite(a.scores?.BBVI))return null;
  const u=unroundedInputs(s);
  return u?w*u[0]+(1-w)*u[1]:round1(w*f+(1-w)*b);
};
const pilotScore = (s,key) => {
  const value=s.assessment?.scores?.[key];
  if(!Number.isFinite(value)||value<0||value>100)return null;
  // A held report BBVI stays held. The weight only re-mixes a BBVI the report itself found eligible.
  if(key==='BBVI' && VERIFIED.includes(s.assessment.report_version)){
    const raw=bbviRawAt(s,bbviWeight);
    return raw===null?null:round1(raw);
  }
  return value;
};
// One axis state for every view: comparison, detail, summary, popup, matrix, CSV and WebMCP.
// "조회 실패" (report not reached) and "기술 오류" (trace did not re-check) are never "산출 보류".
function axisState(s,key){
  const value=pilotScore(s,key);
  if(value!==null)return {value,kind:'scored',label:scoreText(s,key,value)};
  if(s.assessmentState==='lookup_failed')return {value,kind:'lookup_failed',label:'조회 실패'};
  if(s.assessmentState==='client_outdated')return {value,kind:'client_outdated',label:'새 버전 있음'};
  if(s.assessmentState==='technical_error'||s.assessment?.axis_errors?.[key])return {value,kind:'technical_error',label:'기술 오류'};
  if(key==='MCUI'&&consShort(s)&&consShort(s)!=='조회 실패')return {value,kind:'withheld',label:consShort(s)};
  return {value,kind:'withheld',label:s.assessment?.score_status?.[key]||'산출 보류'};
}
// 4.16 (formal-release-4.16-2026-10-15): the amount of MBPI evidence and the replication of its top item, published apart
// (evidence_profile). An MBPI or BBVI whose top item is not replicated is shown as a whole number; one decimal stays where
// rounding would cross the BBVI line or turn a non-zero value into 0. Sorting and types keep the unrounded values.
const evRule=()=>data?.assessmentInfo?.method?.evidence_profile||null;
const evProfile=s=>VERIFIED.includes(s?.assessment?.report_version)&&evRule()?s.assessment.evidence_profile||null:null;
const unreplicated=s=>{const e=evProfile(s);return !!e&&e.item_count>0&&e.top_item_replication!=='replicated';};
function scoreText(s,key,v){
  if(!Number.isFinite(v))return '–';
  if((key==='MBPI'||key==='BBVI')&&unreplicated(s)){
    const r=Math.round(v),line=key==='BBVI'?matrixRule()?.bbvi_threshold:null;
    if(!(r===0&&v!==0)&&!(Number.isFinite(line)&&(r>=line)!==(v>=line)))return String(r);
  }
  return v.toFixed(1);
}
// one line: amount first, then the top item's replication, then papers no score uses. mode 'card' is the card's short form
// (related papers only when there are any), 'front' the profile line, 'detail' adds why a replication record is outside the
// rules; that reason and the evidence factor stay in the folded detail and the method tab (LKH 2026-10-15: neutral fronts)
function evidenceProfileText(s,mode='front'){
  const e=evProfile(s),r=evRule();if(!e)return '';
  if(!e.item_count)return mode==='card'?'근거 · 산출 항목 0':`${r.label} · 산출 항목 0 · 관련 문헌(점수 미사용) ${e.unscored_related_count}편`;
  const rep=(mode==='card'?r.short_replication_labels:r.replication_labels)[e.top_item_replication]||'';
  const why=mode==='detail'&&e.replication_exclusion_reason_ko?rep.replace(/\)$/,': '+e.replication_exclusion_reason_ko+')'):rep;
  return mode==='card'?`근거 · 항목 ${e.item_count} · 독립 논문 ${e.independent_paper_count}편 · ${why}${e.unscored_related_count?` · 관련 문헌 ${e.unscored_related_count}편`:''}`
    :`${r.label} · 산출 항목 ${e.item_count} · 독립 논문 ${e.independent_paper_count}편 · ${why} · 관련 문헌(점수 미사용) ${e.unscored_related_count}편`;
}
// how much the MBPI leans on its top item: the next item's value, and the top item's percentile before the evidence factor
function evidenceDependence(s){
  const e=evProfile(s);if(!e||!e.item_count||!Number.isFinite(e.top_item_percentile))return '';
  return `최상위 항목 제외 시 MBPI ${e.mbpi_without_top_item===null?'다른 항목 없음':scoreText(s,'MBPI',e.mbpi_without_top_item)} · 근거 계수(${e.top_item_evidence_factor}) 적용 전 백분위 ${scoreText(s,'MBPI',e.top_item_percentile)}`;
}
function evidenceProfileBlock(s){
  const e=evProfile(s);if(!e)return '';
  const dep=evidenceDependence(s);
  const search=replicationSearchText(s);
  return `<p class="fine ev-profile"><b>근거 프로필</b> · ${esc(evidenceProfileText(s,'detail'))}${dep?`<br>점수 의존도: ${esc(dep)}`:''}${search?`<br><span class="ev-search">${esc(search)}</span>`:''}<br>`+
    `문헌 수(산출 항목·독립 논문)와 최상위 항목의 독립 재현은 따로 셉니다. 재현이 없으면 최상위 항목에 근거 계수가 곱해져 있고, 다른 기원 시료·같은 연구 그룹·DOI 없는 문헌은 재현으로 세지 않습니다. 표시 전용이며 점수에 쓰지 않습니다.</p>`;
}
// 4.16: the species profile carries the same line; how much MBPI leans on its top item sits in the folded MBPI detail
const cpEvidence=s=>{const t=evidenceProfileText(s);return t?`<p class="cp-evidence"><b>근거 프로필</b> ${esc(t)}</p>`:'';};
// 2026-10-15: under the profile's MBPI, the kind of its top evidence (mbpiKindOf) and the secondary MBPI-Rx on its own row.
// An MBPI-Rx with no drug-target item reads '의약 표적 근거 없음', never 0. Neither enters BBVI, the matrix or the type.
const cpMbpiKind=s=>{
  const k=mbpiKindOf(s), r=mbpiRxOf(s), a=s?.assessment;
  // the same item as MBPI's own top (a drug-target top) reads as MBPI does (scoreText); another item keeps one decimal
  const same=r?.value!=null&&a?.mbpi_rx?.top_item&&a.bioactivity_trace?.[a.mbpi_rx.top_item.trace_index]===bestBio(a);
  const badge=k?`<p class="cp-kind"><span class="cp-kind-badge" data-kind="${k.kind}">${esc(k.long)}</span><span class="cp-kind-share">최상위 근거 · ${esc(mbpiKindShare(k))}</span></p>`:'';
  const rx=!r?'':`<div class="cp-sub cp-rx"><span class="cp-rx-name">MBPI-Rx <small>의약 표적만</small></span>`+(r.value===null?'<span class="cp-rx-none">의약 표적 근거 없음</span>'
    :`<span class="cp-bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,r.value))}%"></i></span><b class="cp-rx-num">${same?scoreText(s,'MBPI',r.value):r.value.toFixed(1)}</b>`)+'</div>';
  return badge+rx;
};
const evidenceCardLine=s=>{const t=evidenceProfileText(s,'card');return t?`<span class="card-evidence" title="${esc(evidenceProfileText(s))}">${esc(t)}<span class="sr-only"> (${esc(evidenceProfileText(s))})</span></span>`:litCardLine(s);};
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
// 4.12 (prereg-4.12-2026-10-14): the KOSIS catch-trend record is re-derived from its own yearly tonnes and the report's rule.
// Returns {score} when every stored number, label and reason matches, else null. Rounded values are compared within half a step.
function stockDeclineRecheck(d,rule){
  const [y0,y1]=rule?.years||[],years=[];for(let y=y0;y<=y1;y++)years.push(y);
  if(!d||!years.length||JSON.stringify(d.years)!==JSON.stringify(years)||d.not_iucn!==true||d.stock_assessment!==rule.stock_assessment||
     d.source_id!==rule.source?.id||d.retrieved_on!==rule.retrieved_on||!rule.labels)return null;
  if(d.match_level==='none')return d.kosis_item===null&&d.coastal_t===null&&d.score===null&&d.unscored_reason==='no_match'&&d.label===rule.labels.no_match?{score:null}:null;
  const c=d.coastal_t,f=d.aquaculture_t,whole=v=>Number.isInteger(v)&&v>=0;
  if(!['species','broader'].includes(d.match_level)||!d.kosis_item||!Array.isArray(c)||!Array.isArray(f)||c.length!==years.length||f.length!==years.length||
     !c.every(v=>v===null||whole(v))||!f.every(whole))return null;
  const sum=(v,ys)=>ys.reduce((t,y)=>t+(v[years.indexOf(y)]||0),0);
  const base=sum(c,rule.baseline_years)/rule.baseline_years.length,recent=sum(c,rule.recent_years)/rule.recent_years.length;
  const farmed=sum(f,rule.recent_years),caught=sum(c,rule.recent_years),share=farmed+caught?farmed/(farmed+caught):null,D=base?1-recent/base:null;
  const close=(x,y,step)=>y===null?x===null:Number.isFinite(x)&&Math.abs(x-y)<=step/2+1e-9;
  if(!close(d.baseline_mean_t,base,.01)||!close(d.recent_mean_t,recent,.01)||!close(d.decline_pct,D===null?null:100*D,.1)||
     !close(d.aquaculture_share_recent_pct,share===null?null:100*share,.1))return null;
  const reason=c.filter(v=>v===null).length>=rule.insufficient_blank_years?'insufficient_data':share!==null&&share>=rule.aquaculture_share_max?'aquaculture_dominant':
    base<rule.min_baseline_t?'small_catch':null;
  if(reason)return d.unscored_reason===reason&&d.score===null&&d.label===rule.labels[reason]&&d.capped_broader===false?{score:null}:null;
  let band=null;for(const b of rule.bands||[])if(D>=b.min_decline)band=b;
  if(!band)return d.unscored_reason===null&&d.score===null&&d.label===rule.labels.no_signal&&d.capped_broader===false?{score:null}:null;
  const capped=d.match_level==='broader'&&band.score>rule.broader_cap;
  if(capped)band=(rule.bands||[]).filter(b=>b.score<=rule.broader_cap).sort((x,y)=>y.score-x.score)[0];
  return band&&d.unscored_reason===null&&d.score===band.score&&d.label===band.label&&d.capped_broader===capped?{score:band.score}:null;
}
// 4.12: MCUI = max(extinction-risk MCUI, stock-decline score). The extinction-risk value keeps every check below; the published
// MCUI must be the larger of the two and the driver must say which.
function verifiedConservationValid(a,report){
  const rule=report.method?.mcui_stock_decline;
  if(!rule)return !('stock_decline' in a)&&!('mcui_driver' in a)&&extinctionConservationValid(a,report);
  const ext=a.mcui_extinction_risk,stock=stockDeclineRecheck(a.stock_decline,rule)?.score;
  if(stock===undefined||!(ext===null||Number.isFinite(ext))||!extinctionConservationValid({...a,scores:{...a.scores,MCUI:ext}},report))return false;
  if(a.stock_decline.kosis_item!==null&&!(a.source_ids||[]).includes(rule.source?.id))return false;
  // 4.14 (prereg-4.14-2026-10-14 4): with no extinction-risk component the decline is a lower bound, used only at or above
  // the matrix MCUI line; below it the MCUI stays unknown and the decline is a reference
  const scope=report.method?.mcui_scope, bound=!scope||ext!==null||stock>=report.method?.matrix?.mcui_threshold;
  const up=stock!==null&&(ext===null||stock>ext)&&bound, mcui=up?stock:ext;
  if(scope&&!conservationStatusValid(a,report,ext,up))return false;
  return a.scores.MCUI===mcui&&a.mcui_driver===(mcui===null?null:up?'stock_decline':stock===ext?'tie':'extinction_risk');
}
// 4.14 (prereg-4.14-2026-10-14 2·3): one conservation state; only an IUCN global or a Korean national category gives the
// extinction-risk number, and every other list (another country, a region, a Rapid LC check) rides along without one.
function conservationStatusValid(a,report,ext,up){
  const scope=report.method.mcui_scope, c=a.conservation_status, found=c?.assessments;
  if(!c||!scope.state_labels?.[c.state]||c.label!==scope.state_labels[c.state]||!Array.isArray(found)||c.mapping_note!==scope.mapping_note)return false;
  const scored=found.filter(x=>x.used_for_mcui===true), basis=a.mcui_basis??null, early=scope.preliminary_bases||[];
  // 4.17 (prereg-4.17-2026-10-15 2): with no official category, a range-state list or the Rapid LC check is a preliminary assessment
  const scopes=['global','korea',...(early.includes('range_state')?['other_country']:[])];
  if(scored.length>1||scored.some(x=>!scopes.includes(x.scope))||found.some(x=>typeof x.used_for_mcui!=='boolean'))return false;
  if(!(basis===null||(scope.scored_bases||[]).includes(basis))||(basis===null)!==(ext===null))return false;
  if(ext!==null&&early.includes(basis))return c.state==='preliminary_scored'&&c.preliminary?.basis===basis&&c.preliminary.label===scope.preliminary_label&&
    (basis==='range_state'?scored.length===1&&scored[0].scope==='other_country':!scored.length&&c.self_preliminary?.used_for_mcui===true)&&
    c.category===a.mcui_substitute?.category;
  if(ext!==null)return c.state==='official_scored'&&scored.length===1&&scored[0].scope===(basis==='iucn'?'global':'korea')&&c.category===scored[0].category;
  if(c.state==='official_scored'||scored.length)return false;
  const sub=a.mcui_substitute;
  if(sub&&sub.value!==null&&sub.value!==undefined)return false;
  if(sub?.use==='reference_only'&&!(scope.reference_bases||[]).includes(sub.basis))return false;
  const stock=a.stock_decline?.score??null;
  if(up)return c.mcui_role==='stock_decline_lower_bound'&&c.mcui_role_label===scope.stock_lower_bound_label;
  return stock===null?!c.mcui_role:c.mcui_role==='stock_decline_reference'&&c.mcui_role_label===scope.stock_reference_label;
}
function extinctionConservationValid(a,report){
  const adjust=trendAdjustment(a,report);
  if(adjust===null)return false;
  const sub=a.mcui_substitute, rule=report.method?.mcui_substitutes, r=sub?.record, t=rule?.thresholds;
  const sourced=()=>!!(sub.source_ids||[]).length&&sub.source_ids.every(id=>report.sources?.[id]);
  // 4.14 (prereg-4.14-2026-10-14 3): every list outside IUCN global and the Korean national list is a reference without a
  // number, whatever its basis; the state and the scope of each list are re-checked in conservationStatusValid
  if(report.method?.mcui_scope&&sub?.use==='reference_only')return a.scores.MCUI===null&&!a.mcui_basis&&sub.value===null&&
    (report.method.mcui_scope.reference_bases||[]).includes(sub.basis)&&sub.reference_note===report.method.mcui_scope.reference_notes?.[sub.basis];
  if(report.method?.mcui_scope&&SUBSTITUTE_BASES.includes(a.mcui_basis)&&!(report.method.mcui_scope.preliminary_bases||[]).includes(a.mcui_basis))return false;
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
  const substituted=SUBSTITUTE_BASES.includes(a.mcui_basis);
  const category=a.mcui_basis==='national'?a.national_assessment?.category:substituted?sub?.category:a.conservation_trace?.category;
  if(a.occurrence_trend&&a.occurrence_trend.mcui_base!==raw[category])return false;
  // After 3.14: another range state's national list (the only substitute basis that gives an MCUI).
  if(substituted&&a.mcui_basis==='sub_national'){
    const rows=sub?.record?.regions;
    return !!sub&&!!rule&&sub.basis==='sub_national'&&Array.isArray(rows)&&rows.length>0&&scores[sub.category]===a.scores.MCUI&&
      rows.every(x=>x.reviewed===true&&x.verified_in_original===true&&x.species_level===true&&!!x.region&&!!x.list&&!!x.edition&&
        !!x.name_as_published&&!!x.category_as_published&&!!report.sources?.[x.source_id]?.url)&&
      ['passed','failed','inconclusive'].includes(sub.record?.backtest?.result);
  }
  // 4.3 (team-lead decision 2026-10-05): a met Rapid LC check is the last basis, scored with its failed back-test label and
  // re-checked against the published thresholds, only where no IUCN, national or sub-national category exists.
  if(substituted&&a.mcui_basis==='preliminary')return !!rule?.preliminary_scored&&sub?.use==='scored'&&sub.basis==='preliminary'&&
    sub.category===rule.preliminary_category&&sub.value===raw[sub.category]&&scores[sub.category]===a.scores.MCUI&&sub.backtest?.result==='failed'&&!!t&&sourced()&&
    r?.eoo_km2>t.eoo_km2&&r.aoo_km2>t.aoo_km2&&r.aoo_km2===r.aoo_cells*t.aoo_cell_km**2&&r.records>=t.records&&r.trend_class!=='decline_signal'&&
    a.conservation_trace?.iucn_state==='not_in_red_list'&&!a.national_assessment&&['eoo_km2','aoo_km2','aoo_cell_km','records'].every(k=>r.thresholds?.[k]===t[k])&&
    (!a.occurrence_trend||r.trend_class===a.occurrence_trend.class)&&Array.isArray(r.native_box?.lat)&&Array.isArray(r.native_box?.lon)&&
    (r.official_unscored||[]).every(x=>x.category===null&&(!x.source_id||!!report.sources?.[x.source_id]))&&
    // 4.11 (prereg 5.2): never scored once the OBIS reporting-rate ratio reaches the decline threshold
    !(rule.preliminary_trend_block&&a.occurrence_trend?.reporting_rate_ratio<=report.method.conservation?.trend?.decline_ratio);
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
  // 4.3 (team-lead decision 2026-10-05): no item in any stratum gives the labelled floor value; it carries no trace item.
  const floorRule=report?.method?.mbpi_floor;
  if(a.mbpi_floor||a.mbpi_stratum==='floor')return !!floorRule&&!!a.mbpi_floor&&a.mbpi_stratum==='floor'&&a.scores.MBPI===floorRule.value&&
    a.mbpi_floor.value===floorRule.value&&a.mbpi_label===floorRule.label&&!(a.bioactivity_trace||[]).length;
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
  // 4.3 XO stratum: one literature-built cohort, xanthine-oxidase IC50 only.
  const xoRule=report?.method?.xo_bioactivity;
  const xo=x=>!!xoRule&&x.stratum_kind==='xo'&&typeof x.peptide_sequence==='string'&&/^[A-Z]+$/.test(x.peptide_sequence)&&
    Number.isInteger(x.peer_peptides)&&x.peer_peptides>=xoRule.minimum_peptides&&Number.isFinite(x.pIC50)&&x.pMIC===undefined&&
    Array.isArray(x.measurements)&&x.measurements.length>0&&x.measurements.every(m=>m.endpoint===xoRule.endpoint&&m.target===xoRule.target&&
      m.relation==='='&&m.unit==='uM'&&Number.isFinite(m.value)&&m.value>0&&report.sources?.[m.source_id]&&a.source_ids.includes(m.source_id))&&
    a.source_ids.includes(xoRule.cohort_source_id)&&Array.isArray(x.cohort_members)&&x.cohort_members.length===x.peer_peptides&&
    x.cohort_members.every(m=>typeof m.sequence==='string'&&m.sequence!==x.peptide_sequence&&Number.isFinite(m.ic50_uM)&&m.ic50_uM>0)&&
    // the browser re-ranks the shipped members: percentile = 100 x (weaker + 0.5 x equal) / n on pIC50 = 6 - log10(uM)
    (p=>Math.abs(100*(p.filter(v=>v<x.pIC50).length+0.5*p.filter(v=>v===x.pIC50).length)/p.length-x.percentile)<0.01)(x.cohort_members.map(m=>6-Math.log10(m.ic50_uM)));
  // 4.4 relaxation (d): the species' own peptide ranked in a fixed ChEMBL target x endpoint cohort snapshot; the browser
  // re-ranks the shipped cohort pChEMBL values and re-derives pchembl = round3(9 - log10(EC50 nM)) of the item's own target row.
  const rxRule=report?.method?.relaxed_bioactivity;
  const relaxed=x=>!!rxRule&&x.stratum_kind==='relaxed'&&typeof x.peptide_sequence==='string'&&/^[A-Z]+$/.test(x.peptide_sequence)&&
    !!rxRule.allowed_relaxations?.[x.relaxation]&&x.label===rxRule.label&&!!x.target_chembl_id&&!!x.standard_type&&
    Number.isFinite(x.pchembl)&&x.pIC50===undefined&&x.pMIC===undefined&&
    Number.isInteger(x.cohort_records)&&x.cohort_records>=rxRule.minimum_cohort_records&&
    typeof x.origin_record?.accession==='string'&&typeof x.origin_record.translation==='string'&&
    x.origin_record.translation.includes(x.peptide_sequence)&&(x.origin_record.source_ids||[]).every(id=>a.source_ids.includes(id))&&
    Array.isArray(x.measurements)&&x.measurements.length>0&&
    x.measurements.every(m=>m.endpoint===x.standard_type&&m.relation==='='&&m.unit==='nM'&&Number.isFinite(m.value)&&m.value>0&&
      report.sources?.[m.source_id]&&a.source_ids.includes(m.source_id))&&
    a.source_ids.includes(rxRule.cohort_source_id)&&Array.isArray(x.cohort_pchembl)&&x.cohort_pchembl.length===x.cohort_records&&
    x.cohort_pchembl.every(Number.isFinite)&&
    (m=>!!m&&Math.abs(Math.round((9-Math.log10(m.value))*1000)/1000-x.pchembl)<1e-9)(x.measurements.find(m=>m.target_chembl_id===x.target_chembl_id))&&
    (p=>Math.abs(100*(p.filter(v=>v<x.pchembl).length+0.5*p.filter(v=>v===x.pchembl).length)/p.length-x.percentile)<0.01)(x.cohort_pchembl);
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
  if(items.some(x=>!common(x)||!(peptide(x)||compound(x)||chembl(x)||amp(x)||anti(x)||xo(x)||relaxed(x))||!replicated(x)))return false;
  // Peptides and reviewed compounds never share a trace; 3.1 adds the ChEMBL stratum beside either, 3.18 the AMP one and
  // 3.21 the anticancer one, and MBPI is the max over strata.
  if(new Set(items.filter(x=>!['chembl','amp','anticancer','xo','relaxed'].includes(x.stratum_kind)).map(x=>x.stratum_kind||'compound')).size>1)return false;
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
       Math.abs(a.scores.BBVI-(w*a.scores.MFPI+(1-w)*a.scores.MBPI))>.11)return false;
    // 4.14: computed from the unrounded inputs, rounded once; each unrounded value must round to the published one
    if(report.method?.bbvi?.unrounded_inputs){
      const u=a.scores_unrounded;
      if(!u||![u.MFPI,u.MBPI,u.BBVI].every(Number.isFinite)||round1(u.MFPI)!==a.scores.MFPI||round1(u.MBPI)!==a.scores.MBPI||
         Math.abs(u.BBVI-(w*u.MFPI+(1-w)*u.MBPI))>1e-9||round1(u.BBVI)!==a.scores.BBVI)return false;
    }else if(Math.abs(a.scores.BBVI-(w*a.scores.MFPI+(1-w)*a.scores.MBPI))>.06)return false;
    if(a.mbpi_floor)return a.bbvi_label===report.method?.mbpi_floor?.bbvi_label;
    if(singleSourceRule(report.method_version)){
      const best=bestBio(a), rule=report.method?.bbvi;
      const minimum=rule?.minimum_independent_mbpi_dois;
      // 3.27: a single-paper BBVI is a score only under the report's own policy, and then it must carry the policy's label
      const labelled=rule?.single_source_policy==='score_with_label'&&!!rule.single_source_bbvi_label;
      return Number.isInteger(minimum)&&best&&
        (mbpiSources(best)>=minimum?!a.bbvi_label:labelled&&a.bbvi_label===rule.single_source_bbvi_label);
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
// The pilot line ('verified-pilot-3.28') and the released line ('verified-4.0') share one number sequence.
function newerVersion(value,known){
  const parts=v=>{const m=typeof v==='string'&&v.match(/^verified-(?:pilot-)?(\d+(?:\.\d+)*)$/);return m?m[1].split('.').map(Number):null;};
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
// Display-only literature values for drug-use chips (team-lead decision 2026-10-03, scripts/build_trait_evidence.py).
// Schema 1 is read; a higher number is a newer file this code does not know; anything else is ignored.
let traitDisplay=new Map();
function traitDisplayRows(file,outdated){
  const v=/^trait-display-evidence-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'trait-evidence.json',version:file.schema_version});
  const rows=new Map();
  if(file?.schema_version!=='trait-display-evidence-1'||!Array.isArray(file.records))return rows;
  for(const r of file.records){
    if(!Number.isFinite(r?.value)||r.relation!=='='||!String(r.doi||'').startsWith('10.'))continue;
    const key=r.aphia_id+'|'+r.trait;rows.set(key,[...(rows.get(key)||[]),r]);
  }
  return rows;
}
// 4.12 (prereg-4.12-2026-10-14 3-D): related papers that no score uses (dist/supplementary-literature.json, built by
// scripts/build_supplementary_literature.py). Schema 1 is read; a higher number is a newer file this code does not know;
// anything else is ignored. Nothing here reaches MFPI, MBPI, MCUI, BBVI, the matrix, the map colours or a chip, and the count
// is kept apart from the single-paper label, which still means the top MBPI item has no independent replication (4.16: the
// evidence profile shows both counts side by side).
let supplementaryLit=new Map();
const LIT_RELATION={contrary:'반대 근거',same_item_followup:'같은 물질 후속',new_quantitative:'같은 종 새 정량',link_support:'종-물질 연결',context:'참고',excluded:'제외'};
function supplementaryRows(file,outdated){
  const v=/^supplementary-literature-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'supplementary-literature.json',version:file.schema_version});
  const rows=new Map();
  if(file?.schema_version!=='supplementary-literature-1'||!Array.isArray(file.records))return rows;
  for(const r of file.records){
    if(!Number.isSafeInteger(r?.aphia_id)||!/^10\.\d{4,9}\/\S+$/.test(String(r.doi||''))||!LIT_RELATION[r.relation]||!r.finding||!r.not_scored_reason)continue;
    rows.set(r.aphia_id,[...(rows.get(r.aphia_id)||[]),r]);
  }
  return rows;
}
const litRows=s=>VERIFIED.includes(s?.assessment?.report_version)?supplementaryLit.get(s.aphiaID)||[]:[];
const litCardLine=s=>litRows(s).length?`<span class="card-lit" title="점수에 쓰지 않은 관련 문헌(근거 논문 수와 다른 수)">관련 문헌 ${litRows(s).length}편 · 점수 미사용</span>`:'';
function supplementaryLine(s){
  const rows=litRows(s);
  if(!rows.length)return '';
  const contrary=rows.filter(r=>r.relation==='contrary').length;
  const doi=d=>`<a href="https://doi.org/${encodeURI(d)}" target="_blank" rel="noopener">${esc(d)}</a>`;
  return `<details class="score-disclosure lit-disclosure"><summary><span>관련 문헌 · 점수 미사용</span><b>${esc(rows.length+'편'+(contrary?' · 반대 근거 '+contrary+'편':''))}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">문헌 조사(2026-10-14)에서 찾았지만 고정 규칙에 맞지 않아 점수에 쓰지 않은 논문입니다. MBPI·BBVI·MCUI·매트릭스·지도 색에 들어가지 않고, '최상위 근거 독립 재현 확인 중' 표시(MBPI 1위 항목의 독립 재현 여부)와도 다른 수입니다.</p>`+
    `<ul class="lit-list">${rows.map(r=>`<li data-relation="${esc(r.relation)}"><b class="lit-rel">${esc(LIT_RELATION[r.relation])}</b> ${esc(r.title_ko)} <span class="lit-src">(${esc(r.journal)}, ${esc(r.year)}) ${doi(r.doi)}</span>`+
      `<p class="fine">${esc(r.finding)}</p><p class="fine lit-why">점수 미사용: ${esc(r.not_scored_reason)} · ${esc(r.checked_on)} ${r.checked_via==='full_text'?'원문':'초록'} 확인</p></li>`).join('')}</ul>`+
    `</div></details>`;
}
// Replication search record (prereg-replication-search-2026-10-15 6; dist/replication-search.json, built by
// scripts/build_replication_search.py): when and where the current top MBPI item was searched for an independent replication.
// Shown in the folded MBPI detail only. Schema 1 is read; a higher number is a newer file this code does not know; anything else
// is ignored. Nothing here reaches a score, the matrix, the map colours or a chip.
let replicationSearch=new Map();
const SEARCH_STATUS=new Set(['searched_none','not_current_item','no_record','replicated']);
function replicationSearchRows(file,outdated){
  const v=/^replication-search-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'replication-search.json',version:file.schema_version});
  const rows=new Map();
  if(file?.schema_version!=='replication-search-1'||file.display_only!==true||!Array.isArray(file.species))return rows;
  for(const r of file.species)if(Number.isSafeInteger(r?.aphia_id)&&SEARCH_STATUS.has(r.status))rows.set(r.aphia_id,r);
  return rows;
}
function replicationSearchText(s){
  const r=VERIFIED.includes(s?.assessment?.report_version)?replicationSearch.get(s.aphiaID):null;
  if(!r||r.status==='replicated')return '';
  if(r.status==='no_record')return '재현 검색 기록 없음';
  if(r.status==='not_current_item')return `재현 검색: 현재 최상위 항목 검색 전${r.earlier_item_searched_on?`(${r.earlier_item_searched_on} 검색은 이전 최상위 항목)`:''}`;
  const searched=(r.sources_searched||[]).join(' · '), closed=(r.sources_unavailable||[]).join(' · ');
  const earlier=(r.runs||[]).filter(x=>x.item_is_current&&x.searched_on!==r.last_searched_on).map(x=>x.searched_on);
  return `재현 검색: 검색했으나 독립 재현 없음(${r.last_searched_on||'날짜 미기재'}${searched?', '+searched:''})${earlier.length?` · 이전 검색 ${earlier.join(', ')}`:''}${closed?` · 열지 못한 검색원 ${closed}`:''}`;
}
// 검증 성적표 (dist/posthoc-scorecard.json, built by scripts/build_posthoc_scorecard.py from posthoc.validation_sets): the top of
// the method tab lists every post-hoc check with its normalised outcome_class, and the journey cards carry one badge per
// indicator. A same-data or two-species consistency check is never shown as 통과. Display only: nothing here reaches a score,
// the matrix, the map colours or a chip. Schema 1 is read; a higher number is a newer file; anything else is ignored.
let posthocScorecard=null;
const SCORECARD_OC={'통과':'pass','실패':'fail','실패 후 사용 중단':'stopped','일관성 확인(독립 아님)':'consistent','검증 불성립':'void'};
function scorecardFile(file,outdated){
  const v=/^posthoc-scorecard-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'posthoc-scorecard.json',version:file.schema_version});
  if(file?.schema_version!=='posthoc-scorecard-1'||file.display_only!==true||!Array.isArray(file.rows))return null;
  return file.rows.every(r=>r&&SCORECARD_OC[r.outcome_class])?file:null;
}
function renderScorecard(){
  const sc=posthocScorecard,body=$('mt-vc-body');if(!body)return;
  const badges=document.querySelectorAll('#method .mt-vbadge[data-ind]');
  if(!sc){
    $('mt-vc-sum').textContent=data?'검증 성적표 파일을 읽지 못했습니다. 지표별 검증 기록은 아래 ‘지표를 어떻게 읽나요?’에 있습니다.':'사후 검증 기록을 불러오는 중입니다.';
    for(const id of ['mt-vc-ind','mt-vc-counts','mt-vc-body','mt-vc-foot'])$(id).innerHTML='';badges.forEach(b=>b.hidden=true);return;
  }
  const n=c=>sc.counts?.[c]||0, label=c=>sc.rows.find(r=>r.outcome_class===c)?.outcome_label||c;
  const indTitle=key=>{const i=sc.indicators[key];return `사후 검증 ${i.checks}건: `+Object.entries(i.classes).map(([c,k])=>`${label(c)} ${k}`).join(' · ');};
  $('mt-vc-sum').textContent=`${sc.report_version} 기준 · 사후 검증 ${sc.total}건 중 기준 통과 ${n('통과')}건 · ${sc.preregistered}건은 결과를 보기 전에 기준을 정했습니다.`;
  $('mt-vc-ind').innerHTML=Object.keys(sc.indicators||{}).map(k=>`<li data-state="${esc(sc.indicators[k].state)}" title="${esc(indTitle(k))}"><b>${esc(k)}</b><span>${esc(sc.indicators[k].label)}</span></li>`).join('');
  $('mt-vc-counts').innerHTML=Object.keys(SCORECARD_OC).filter(c=>n(c)).map(c=>`<li data-oc="${SCORECARD_OC[c]}"><b>${n(c)}</b>${esc(label(c))}</li>`).join('');
  const file=p=>p.split('/').pop();
  body.innerHTML=sc.rows.map(r=>`<tr data-oc="${SCORECARD_OC[r.outcome_class]}" data-key="${esc(r.key)}">`+
    `<th scope="row" data-label="검증 이름">${esc(r.name)}</th>`+
    `<td data-label="무엇을 확인했나">${esc(r.checked)}</td>`+
    `<td data-label="사전 등록"><b>${esc(r.preregistered_label)}</b><small>${esc(r.preregistered_note)}</small></td>`+
    `<td data-label="결과"><span class="mt-vc-pill" data-oc="${SCORECARD_OC[r.outcome_class]}">${esc(r.outcome_label)}</span></td>`+
    `<td data-label="결과 뒤 조치">${r.action==='none'?'<b class="mt-vc-na">해당 없음</b>':`<b>${esc(r.action_label)}</b>`}<small>${esc(r.action_detail)}</small>${r.action_history?`<small class="mt-vc-hist">${esc(r.action_history)}</small>`:''}</td>`+
    `<td data-label="기록 파일">${r.records.map(p=>`<a href="${esc(sc.repository+p)}" target="_blank" rel="noopener" title="${esc(p)}">${esc(file(p))}</a>`).join('')}${r.record_note?`<small>${esc(r.record_note)}</small>`:''}</td></tr>`).join('');
  $('mt-vc-foot').textContent='‘일관성 확인(독립 아님)’은 점수를 만든 자료와 같은 자료로 보거나 2종만 비교한 확인이라 통과로 세지 않습니다. ‘검증 불성립’은 미리 정한 최소 표본 수에 못 미쳐 판정하지 못했다는 뜻입니다. 이 표는 사후 검증 기록(assessments.json)에서 자동으로 만들고, 같은 표를 CSV로도 내보냅니다. 기록 파일은 프로젝트 GitHub 저장소에 있습니다.';
  badges.forEach(b=>{const i=sc.indicators?.[b.dataset.ind];b.hidden=!i;if(!i)return;b.textContent=plainWords(i.label);b.dataset.state=i.state;b.title=indTitle(b.dataset.ind);});
}
// 4.0 (team-lead decision 2026-10-04): 미탐색 후보 outside the 30 (dist/unexplored-candidates.json). A species of the box that
// shares its genus with one of the 30 whose published BBVI is at least the threshold; no indicator was collected for it
// and no score is inferred. Only its reviewed public cells are drawn, in the 미탐색 후보 layer.
let unexploredOutside=[];
function unexploredRows(file,outdated){
  const v=/^unexplored-candidates-(\d+)$/.exec(file?.schemaVersion||'');
  if(v&&Number(v[1])>1)outdated.push({file:'unexplored-candidates.json',version:file.schemaVersion});
  if(file?.schemaVersion!=='unexplored-candidates-1'||!Array.isArray(file.species))return [];
  return file.species.filter(s=>Number.isSafeInteger(s?.aphiaID)&&s.name&&Array.isArray(s.cells)&&Array.isArray(s.relatives)&&s.relatives.length);
}
const outsideLabel=s=>s.koreanName?`${s.koreanName}(${s.name})`:s.name;
// Cells of the outside candidates in the current period (same fallback as periodView), grouped by public cell.
function outsideCells(){
  const groups=new Map();
  for(const s of unexploredOutside){
    const inPeriod=periodFilter==='all'?s.cells:s.cells.filter(c=>c.period===periodFilter);
    for(const c of inPeriod.length?inPeriod:s.cells){
      if(![c.lat0,c.lon0,c.sizeDeg].every(Number.isFinite))continue;
      const key=valueCellKey(c.lat0,c.lon0,c.sizeDeg);
      if(!groups.has(key))groups.set(key,{lat:c.lat0,lon:c.lon0,size:c.sizeDeg,species:new Map()});
      groups.get(key).species.set(s.aphiaID,s);
    }
  }
  return groups;
}
function readinessRows(readiness,outdated){
  if(Number.isSafeInteger(readiness?.schema_version)&&readiness.schema_version>1)outdated.push({file:'matrix-readiness.json',version:readiness.schema_version});
  return new Map(readiness?.schema_version===1&&Array.isArray(readiness.species)?readiness.species.map(row=>[row.aphia_id,row]):[]);
}
// live-data.js starts the first screen's files together and hands over the request under way (readEarly); revalidated,
// not re-downloaded ('no-cache'). Without that file (node tests) a plain fetch.
const FRESH_READ={cache:'no-cache'};
const readData=(url,init)=>typeof readEarly==='function'?readEarly(url,init):fetch(url,init);
async function attachPilotAssessments(next) {
  // "조회 실패": the report was not reached or not readable. "기술 오류": it was read but did not re-check.
  // Both differ from "산출 보류", which the report itself states for missing evidence.
  const failed=state=>{for(const s of next.species)s.assessmentState=state;};
  let response;
  try { response=await readData('assessments.json',FRESH_READ); } catch { failed('lookup_failed'); return; }
  if(!response.ok){ failed('lookup_failed'); return; }
  let report;
  try { report=await response.json(); } catch { failed('lookup_failed'); return; }
  try {
    if(newerVersion(report.method_version,VERIFIED.at(-1))){
      (next.outdated??=[]).push({file:'assessments.json',version:report.method_version});failed('client_outdated');return;
    }
    const verified=VERIFIED.includes(report.method_version);
    if(!['pilot-1',...VERIFIED].includes(report.method_version)||report.status!==(released({version:report.method_version})?'released':'provisional_unvalidated')||!Array.isArray(report.species)){ failed('technical_error'); return; }
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
    $('map-judgment').textContent=(type?`이 종의 매트릭스 유형: ${matrixTypeLabel(type)}${separateMcui(s)?'(MCUI '+mcuiBasisLabel(s)+')':''}`:`이 종은 매트릭스 유형이 없습니다(${untypedReason(s)})`)+
      (!s.cells?.length?' · 공개 출현 셀이 없어 활용 × 보전 지도에 반영되지 않습니다.':type?` · 활용 × 보전 지도에서 이 종이 기록된 ${n}개 셀 색에 반영됩니다(해역 점수 아님).`:` · 매트릭스 유형이 없어 활용 × 보전 지도 색에는 쓰이지 않습니다.`);
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
    return `IUCN 현행 평가 ${t.category} ${t.criteria||''}: ${t.publication_year}년 발표(${t.assessment_date} 평가) · 전 지구 범위. 이전 ${h.category}(${h.published}년 발표, ${h.assessed} 평가)는 대체된 역사적 평가입니다. ${released()?'MCUI':'검증 전 시범 MCUI'}에는 현행 평가만 사용했고, 한국 한정 평가나 확정된 정책 판단이 아닙니다.`;
  return t
    ? `${base} ${released()?'지표':'시범'} 보고서가 ${t.current_status_checked_on}에 출처 ${t.current_status_source_id}로 이 평가가 현행 IUCN 평가임을 재확인해, ${released()?'MCUI':'검증 전 시범 MCUI'}에 사용했습니다. 전 세계 범위 평가이며 2026년 한국 한정 평가나 확정된 정책 판단이 아닙니다.`
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
  return (stale&&!verified?row('IUCN 표기','갱신 필요(Needs updating)','pending')+'<p class="fine">IUCN은 평가 후 10년이 지나면 적색목록 사이트에 \'Needs updating\'으로 표시합니다.</p>':'')+row(h.current?'이전 평가':'IUCN 원평가',`${h.category} · ${h.published}년 발표 ${h.current?`(${h.current.published}년 평가로 대체)`:verified?(released()?'(현행 여부 재확인)':'(현행 여부 재확인 · 시범)'):'(역사적 평가)'}`)
    +(verified?row('현행 평가',`재확인 ${s.assessment.conservation_trace.current_status_checked_on||s.assessment.conservation_trace.current_status_check?.checked_on||'날짜 미기재'} · ${released()?'지표':'시범'} 보고서`):row('현행 평가','확인 보류','pending'))
    +`<p class="fine">${esc(iucnHistoricalText(h,s))}${verified?'':' 2026년 한국 현황이나 MCUI로 바꾸지 않습니다.'} ${sourceLink(h.url,'IUCN 평가 레코드 ↗')}</p>`;
}
const CASE_NOTES = {"241776":{"title":"돌기해삼 원논문","url":"https://doi.org/10.1111/bph.16333","detail":"Holotoxin A₁의 Candida albicans SC5314 MIC·MFC 각 2 µg/mL은 원논문에서 직접 확인. 외부 CID의 구조 대응과 동일 표적·시험군 pChEMBL은 확인하지 않음. 사람 대상 약효 자료가 아님."},"377084":{"title":"다시마 원논문","url":"https://doi.org/10.1002/cbdv.202000233","detail":"Lj5 다당류 분획의 α-glucosidase IC50 153.27 ± 22.89 µg/mL 확인. 단일 분자 CID·InChIKey가 없으므로 현행 소분자 MBPI 입력에서 제외."}};
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
  return ['MFPI','MBPI','MCUI','BBVI'].every(k=>pilotScore(s,k)!==null)&&(!nationalMcui(s)||!!matrixRule()?.include_national_mcui)&&(!substituteMcui(s)||(matrixRule()?.include_substitute_mcui||[]).includes(s.assessment.mcui_basis))
    &&(!bbviLabel(s)||!!matrixRule()?.include_single_source_bbvi);
}
// Type from the on-screen BBVI (slider weight) and MCUI; the report's thresholds, a value at the threshold is high.
// matrixTypeAt takes the BBVI to judge, so the official type (the report's BBVI) uses the same rule.
// 4.14: the BBVI judged is the unrounded one at that weight (bbviRawAt); a report without scores_unrounded keeps its rounded value
function matrixType(s){return matrixTypeAt(s,bbviRawAt(s,bbviWeight));}
function matrixTypeAt(s,bbvi){
  const rule=matrixRule();
  if(!rule||!assessedForMatrix(s))return null;
  const key=(bbvi>=rule.bbvi_threshold?'high':'low')+'_bbvi_'+(pilotScore(s,'MCUI')>=rule.mcui_threshold?'high':'low')+'_mcui';
  return rule.types?.[key]?.id||null;
}
const matrixTypeLabel=id=>Object.values(matrixRule()?.types||{}).find(t=>t.id===id)?.label||id;
// BBVI 통합 가중치 helpers (2026-10-13; the panel and its redraws sit with the '비교와 지표' code below)
const W_STEPS=20;
const officialWeight=()=>{const w=data?.assessmentInfo?.foodWeight;return Number.isFinite(w)&&w>=0&&w<=1?w:.5;};
const weightStep=w=>Math.round(w*W_STEPS);
const weightOff=()=>weightStep(bbviWeight)!==weightStep(officialWeight());
const weightPair=(w=bbviWeight)=>{const k=weightStep(w);return `MBPI ${((W_STEPS-k)/W_STEPS).toFixed(2)} · MFPI ${(k/W_STEPS).toFixed(2)}`;};
// the report's own BBVI beside an on-screen re-mix ('공식 55.1'), only when the weight is not the official one and the two differ
const officialBbvi=s=>pilotScore(s,'BBVI')===null?null:VERIFIED.includes(s.assessment?.report_version)?s.assessment.scores.BBVI:pilotScore(s,'BBVI');
const officialType=s=>matrixTypeAt(s,bbviRawAt(s,officialWeight()));
const officialNote=s=>{const o=officialBbvi(s);return weightOff()&&o!==null&&o!==pilotScore(s,'BBVI')?`공식 ${scoreText(s,'BBVI',o)}`:'';};
// a shared link's w: a number in 0–1 snaps to the nearest step; anything else is the official weight
const hashWeightStep=v=>{const n=Number(v);return String(v??'').trim()!==''&&Number.isFinite(n)&&n>=0&&n<=1?weightStep(n):weightStep(officialWeight());};
// 2026-10-13 design 2: a plain verdict before the formal type name (display only; data, hash and CSV keep the type id)
// 4.14 (prereg-4.14-2026-10-14 7): the report's own position words ('활용 지표 높음'), not a use or harvest verdict; an older
// report without them gets the same neutral words
const MATRIX_PLAIN_DEFAULT={sustainable_use:'활용 지표 높음',baseline_survey:'두 지표 모두 낮음',alternative_production:'두 지표 모두 높음',conservation_priority:'보전 지표 높음'};
const MATRIX_PLAIN=new Proxy({},{get:(_,id)=>Object.values(matrixRule()?.types||{}).find(t=>t.id===id)?.plain||MATRIX_PLAIN_DEFAULT[id]});
const matrixTypePlain=id=>MATRIX_PLAIN[id]||'유형 미산출';
const thresholdWord=()=>matrixRule()?.threshold_label||'탐색적 구분선';
const matrixPlainNote=()=>{const r=matrixRule();return (r?.type_note||'연구 분류 · 채집·이용 허용이나 지속가능성 판정이 아님')+(r?` · ${thresholdWord()}: BBVI ${r.bbvi_threshold} 이상이면 활용 지표 높음, MCUI ${r.mcui_threshold} 이상이면 보전 지표 높음(검증된 기준 아님)`:'');};
// 4.14 (prereg-4.14-2026-10-14 7): visible words that keep '보전평가 미확인' apart from an official low-risk category
const consShort=(s,long)=>{const c=s?.assessment?.conservation_status;if(!c||!data?.assessmentInfo?.method?.mcui_scope)return '';
  if(c.state==='official_scored')return '공식 '+c.category+(long&&c.category==='LC'?'(낮은 위험 범주)':'')+(stockMcui(s)?' · 자원 감소':'');
  if(c.state==='preliminary_scored')return stockMcui(s)?'자원 감소':'';  // 4.17: named only in the species detail
  if(c.mcui_role==='stock_decline_lower_bound')return long?c.mcui_role_label:'평가 미확인 · 자원 감소 하한';
  return c.state==='official_dd'?'공식 DD(정보 부족)':c.state==='official_ne'?'공식 NE(미평가)':c.state==='lookup_failed'?'조회 실패':long?c.label:'보전평가 미확인';};
// 4.14: why a species has no type, in words: an unassessed MCUI is not a missing BBVI and never a low risk
const untypedReason=s=>s&&pilotScore(s,'MCUI')===null&&consShort(s)==='보전평가 미확인'?(pilotScore(s,'BBVI')===null?'BBVI 미산출 · 보전평가 미확인':'보전평가 미확인 · MCUI 미산출'):'BBVI·MCUI 한 쌍 미산출';
const untypedWhy=s=>s&&pilotScore(s,'MCUI')===null&&consShort(s)==='보전평가 미확인'?'유형 미산출 · 보전평가 미확인':'유형 미산출 · BBVI·MCUI 한 쌍 미산출';
// the verdict word in a light type colour for the dark explore panels (theme.css .vd-*); null = '유형 미산출' in grey
const verdictWord=t=>`<b class="verdict vd-${t||'none'}">${esc(matrixTypePlain(t))}</b>`;
// A Korean national-assessment MCUI is its own stratum: labelled apart and never ranked or plotted with IUCN-based MCUI.
const nationalMcui = s => s?.assessment?.mcui_basis==='national'&&pilotScore(s,'MCUI')!==null;
// After 3.14: another range state's national list. Like the Korean national basis, it is its own stratum: labelled, drawn with
// the separate matrix marker and never ranked or pooled with IUCN-based MCUI.
// 4.2 (team-lead decision 2026-10-04): a sub-national red list is a second substitute basis, below every national one.
const SUBSTITUTE_BASES=['range_state','sub_national','preliminary'];
const subNationalMcui = s => s?.assessment?.mcui_basis==='sub_national'&&pilotScore(s,'MCUI')!==null;
// 4.17 (prereg-4.17-2026-10-15): with no IUCN global or Korean national category, a range-state list or the Rapid LC check
// stands in as a preliminary assessment until an official result is published. Outside the species detail it is drawn and
// worded like any other MCUI (never called IUCN or official); the detail's MCUI section names it and its basis.
const earlyMcui = s => s?.assessment?.conservation_status?.state==='preliminary_scored'&&pilotScore(s,'MCUI')!==null;
// 4.3 (team-lead decision 2026-10-05): a scored Rapid LC check, the last basis, with its own marker and label.
const rawPreliminaryMcui = s => s?.assessment?.mcui_basis==='preliminary'&&pilotScore(s,'MCUI')!==null;
const preliminaryMcui = s => rawPreliminaryMcui(s)&&!earlyMcui(s);
// the axis label of one species' value: a scored Rapid LC is never called an official category
// 4.12 (prereg-4.12-2026-10-14): an MCUI set by the KOSIS catch-trend signal, beside its extinction-risk basis; not an IUCN category.
const stockMcui = s => s?.assessment?.mcui_driver==='stock_decline'&&pilotScore(s,'MCUI')!==null;
// the catch change as people read it: a 79.8% fall is '−79.8%', a 28.6% rise '+28.6%'
const stockChange = d => d?.decline_pct===null||d?.decline_pct===undefined?'':(d.decline_pct>0?'−':d.decline_pct<0?'+':'±')+Math.abs(d.decline_pct).toFixed(1)+'%';
const stockLabel = s => '자원 감소 신호 · 어획량 '+stockChange(s.assessment.stock_decline);
// the MCUI before the max, for the lines that describe the extinction-risk basis itself
const extinctionMcui = s => pilotScore(s,'MCUI')===null?null:s.assessment?.mcui_driver?s.assessment.mcui_extinction_risk:pilotScore(s,'MCUI');
const axisLabel = (s,key,info) => key==='MCUI'&&stockMcui(s)?(released(info)?'정식 산출 · ':'')+'같은 자료 확인(독립 검증 아님)':key==='MCUI'&&preliminaryMcui(s)?(released(info)?'정식 산출 · ':'')+'역검증 기준 미충족':pilotLabel(key,info);
// the back-test a substitute MCUI carries, and the label pieces that travel with a value wherever no basis line sits beside it
const mcuiBacktest = s => stockMcui(s)?'':preliminaryMcui(s)?'역검증 기준 미충족':subNationalMcui(s)?s.assessment.mcui_substitute?.record?.backtest?.label||'':'';
const basisNote = (s,key) => key==='MCUI'&&separateMcui(s)?' · '+mcuiBasisShort(s)+(subNationalMcui(s)&&mcuiBacktest(s)?' · '+mcuiBacktest(s):''):
  key==='MBPI'&&pilotScore(s,'MBPI')!==null?(s.assessment?.mbpi_label?' · '+s.assessment.mbpi_label:'')+(bestBio(s.assessment)?.stratum_kind==='xo'?' · XO 문헌 비교집단':bestBio(s.assessment)?.stratum_kind==='relaxed'?' · 완화 산출(d)':''):'';
const axisTag = (s,key,info) => axisLabel(s,key,info)+basisNote(s,key);
const rawSubstituteMcui = s => SUBSTITUTE_BASES.includes(s?.assessment?.mcui_basis)&&pilotScore(s,'MCUI')!==null;
const substituteMcui = s => rawSubstituteMcui(s)&&!earlyMcui(s);
const extinctionSeparate = s => nationalMcui(s)||substituteMcui(s);
const separateMcui = s => extinctionSeparate(s)||stockMcui(s);
const subRegions = s => (s.assessment.mcui_substitute?.record?.regions||[]).map(r=>r.region_ko||r.region).join(', ');
const extinctionBasisLabel = s => s?.assessment?.conservation_status&&!s.assessment.mcui_basis?'멸종위험 평가 미확인':nationalMcui(s)?'한국 국가 평가 기반':subNationalMcui(s)?`지방 목록 참고값(${subRegions(s)})`:preliminaryMcui(s)?'자체 예비평가(Rapid LC)':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||'서식국'} 국가 평가 기반`:earlyMcui(s)?'보전 평가 범주 기반':'IUCN 기반';
const mcuiBasisLabel = s => stockMcui(s)?stockLabel(s):extinctionBasisLabel(s);
const mcuiBasisShort = s => stockMcui(s)?'자원 감소 신호':nationalMcui(s)?'국가 평가':subNationalMcui(s)?'지방 목록 참고값':preliminaryMcui(s)?'자체 예비평가':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||'서식국'} 평가`:'';
// 3.15 (team-lead decision 2026-10-02): reference only. A met Rapid LC check is shown beside the withheld MCUI like the BBVI
// 참고값; it stays out of scores.MCUI, the matrix, the map colours and every ranking.
const mcuiReference = s => s?.assessment?.scores?.MCUI===null&&!s.assessment.axis_errors?.MCUI&&s.assessment.mcui_substitute?.use==='reference_only'?s.assessment.mcui_substitute:null;
const rapidLcCheck = () => ({passed:'역검증 통과',failed:'역검증 기준 미충족'})[data?.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary?.result]||'';
// the national branch also covers IUCN categories without a pilot number (DD), so say which case applies
const iucnGlobalNote = s => {const c=s.assessment?.conservation_trace;return c?.category?`IUCN 전 지구 ${c.category}(${c.assessment_year||'평가연도 미기재'}) · ${released()?'점수 대응 없음':'시범 숫자 없음'}`:c?.iucn_state==='not_in_red_list'?`IUCN 전 지구 평가 없음(검색 0건 · ${c.recheck?.checked_on||c.search?.checked_on||'날짜 미기재'})`:'IUCN 전 지구 평가 미확인';};
// Computed values first, then the axes still on hold: "MFPI 65.5 · MBPI·MCUI 보류".
function scoreSummary(s){
  // 4.14: an MCUI without an official category is '보전평가 미확인', not on hold
  const keys=['MFPI','MBPI','MCUI'], unknown=pilotScore(s,'MCUI')===null&&consShort(s)==='보전평가 미확인', held=keys.filter(k=>pilotScore(s,k)===null&&!(k==='MCUI'&&unknown));
  return [...keys.filter(k=>!held.includes(k)&&!(k==='MCUI'&&unknown)).map(k=>`${k}${k==='MCUI'&&separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${scoreText(s,k,pilotScore(s,k))}${k==='MBPI'&&s.assessment?.mbpi_label?' ('+s.assessment.mbpi_label+')':''}`),held.length?held.join('·')+' 보류':'',unknown?'MCUI 보전평가 미확인':''].filter(Boolean).join(' · ');
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
    :(released()?'정식':'시범')+' MFPI의 식품 행·고정 비교집단·지역 시료를 독립 자료로 재검증';
  const bioTask=bioMissing.length
    ?'기원종→동정 물질→정량 시험 연결 및 동일 assay층 확보: '+bioMissing.map(k=>matrixReasonLabel[k]||k).join('·')
    :(released()?'정식':'시범')+' MBPI의 동일 조건 독립 문헌·반복 실험을 확인';
  const iucnTask=row.scores.MCUI===null
    ?row.axis_reasons?.MCUI==='not_in_red_list'?'IUCN 검색 미발견(공식 NE 아님): 이명·원평가 범위·갱신 여부를 다시 조회'
      :'IUCN 원평가의 범위·등급·기준·연도·현행 여부 검수'
    :(released()?'정식':'시범')+' MCUI의 현행 평가·지역 적용 가능성 재검토';
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
function renderDecisionList(){
  const list=$('decision-list'), panel=$('decision-detail');
  // The card face names the matrix type only; evidence labels stay in the opened detail (team-lead decision 2026-10-08).
  list.innerHTML=data.species.map(s=>{
    const ready=assessedForMatrix(s);
    return `<button type="button" class="decision-card" data-aphia="${s.aphiaID}" aria-controls="decision-detail"><strong>${esc(s.label)}</strong><em>${esc(s.name)} · AphiaID ${s.aphiaID}</em><span>${ready&&matrixType(s)?esc(matrixTypeLabel(matrixType(s))):esc(scoreSummary(s))}</span><small class="decision-more">자세히 보기</small></button>`;
  }).join('');
  // The detail opens right under the chosen card; a second click or the 접기 button closes it.
  list.querySelectorAll('.decision-card').forEach(b=>b.addEventListener('click',()=>b.getAttribute('aria-expanded')==='true'?closeDecision():showDecision(data.species.find(s=>s.aphiaID===Number(b.dataset.aphia)))));
  panel.onclick=e=>{if(e.target.closest('.decision-close'))closeDecision();};
}
function markDecisionCards(aphia){
  let card=null;
  $('decision-list').querySelectorAll('.decision-card').forEach(b=>{
    const on=Number(b.dataset.aphia)===aphia;if(on)card=b;
    b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-expanded',String(on));
    const m=b.querySelector('.decision-more');if(m)m.textContent=on?'접기':'자세히 보기';
  });
  return card;
}
function closeDecision(){
  const card=$('decision-list').querySelector('.decision-card[aria-expanded="true"]');
  markDecisionCards(null);$('decision-detail').hidden=true;
  // opened from the compare profile ('근거 자세히 보기'): close that region and go back to its button
  if($('decision-detail').parentElement?.id==='cmp-more'){$('decision-list').after($('decision-detail'));cmpMoreSync();$('cmp-open-more')?.focus({preventScroll:true});return;}
  if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'nearest'});}
}
function showDecision(s){
  if(!s)return;
  const card=markDecisionCards(s.aphiaID);
  const a=s.assessment, info=data.assessmentInfo||{}, reasons=assessmentBlockers(s), study=CASE_NOTES[s.aphiaID];
  let html=`<h3>${esc(s.label)} · 실제 종 근거</h3><p class="fine">${esc(s.name)} · AphiaID ${s.aphiaID} · ${a?(released(info)?'정식 산출':'시범 지표')+esc(validationNote(info)):esc(axisState(s,'MFPI').kind==='withheld'?'산출 보류':axisState(s,'MFPI').label)}</p>`;
  for(const k of ['MFPI','MBPI','MCUI','BBVI']){
    const st=axisState(s,k);
    html+=`<div class="decision-axis"><b>${k}: ${st.value===null?esc(st.label):scoreText(s,k,st.value)+' / 100'+(k==='BBVI'&&bbviLabel(s)?' · '+esc(bbviLabel(s)):'')}</b><p>${esc(axisStateNote[st.kind]||reasons[k]||(k==='MBPI'&&a?.mbpi_floor?a.mbpi_label+'. '+a.mbpi_floor.meaning:'검수된 입력을 사용한 '+(released(info)?'정식':'시범')+' 산출값 · '+({passed:'방법 검증 통과',failed:'사후 검증 기준 미충족'}[validationResult(k,info)]||(released(info)&&k==='MCUI'?(preliminaryMcui(s)?'역검증 기준 미충족':'공식 평가 범주'):'외부 사례 검증 전'))+basisNote(s,k)+'.'))}</p></div>`;
  }
  const plan=followupDecision(s);
  if(plan){
    const date=data.readinessCandidateDate;
    html+='<section class="followup-panel"><h4>현재 판단 가능한 범위</h4>'+
      '<p>'+esc(plan.known.length?'산출 지표: '+plan.known.map(k=>k+'('+axisTag(s,k,info)+')').join(' / ')+' (축별로만 해석)':(released(info)?'산출 지표 없음':'시범 산출 지표 없음')+'. 확인된 원자료의 연결 상태만 설명 가능')+
      '. BBVI×MCUI 종합 배치 '+(pilotScore(s,'BBVI')!==null&&pilotScore(s,'MCUI')!==null?(released(info)?'조건 충족':'시범 조건 충족'):'미충족')+'. 출현 셀은 분포·개체수·자원량 또는 해역 가치가 아닙니다.</p>'+
      '<h4>남은 확인 사항</h4><p>'+esc(plan.blocked.length?plan.blocked.map(k=>k==='MBPI'?k+' '+(plan.row.bioactivity_missing_steps||[]).map(x=>matrixReasonLabel[x]||x).join('·'):k+' '+(matrixReasonLabel[plan.row.axis_reasons?.[k]]||plan.row.axis_reasons?.[k]||'필수 근거 미충족')).join(' / '):(released(info)?'축별 정식 산출 가능':'축별 시범 산출 가능')+'. 실행 권고는 별도 검증 필요')+'</p>'+
      '<h4>다음 조사 · 순위 아님</h4><dl>'+
      '<dt>연구기관</dt><dd>'+plan.research.map(esc).join('<br>')+'</dd>'+
      '<dt>정부·보전기관</dt><dd>'+plan.conservation.map(esc).join('<br>')+'</dd>'+
      '<dt>기업의 검토 과제</dt><dd>'+esc(plan.industry)+'</dd></dl>'+
      '<p class="fine">근거 수준: '+(plan.known.length?esc((released(info)?'정식 산출 일부':'시범 지표 일부')+validationNote(info))+' · ':'')+(plan.blocked.length?'나머지 축은 미산출 · ':'네 지표 모두 산출 · ')+esc(s.catalog?'조사 후보':'운영 발행 종')+
      ' · 지표 보고서 '+esc(data.assessmentInfo?.generatedAt?.slice(0,10)||'미확인')+(s.catalog?' · 후보 목록 검수 '+esc(date||'미확인'):'')+
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
    if(c)html+=`<h4>MCUI 구성</h4><p>${a.mcui_basis==='national'?`한국 국가 평가 기반 ${P_()}MCUI · ${esc(a.national_assessment?.category)} · 국가생물적색자료집 2024 ${esc(a.national_assessment?.list_page_printed)}쪽 · 전 지구 IUCN과 비교하지 않음 · `:extinctionSeparate(s)?`${esc(extinctionBasisLabel(s))} ${P_()}MCUI · ${esc(a.mcui_substitute?.category)} → ${esc(extinctionMcui(s).toFixed(1))}${mcuiBacktest(s)?' · '+esc(mcuiBacktest(s)):''} · 전 지구 IUCN과 비교하지 않음 · `:earlyMcui(s)?`${esc(a.conservation_status.preliminary?.label||'예비 평가')} ${P_()}MCUI · ${esc(a.mcui_substitute?.category)} → ${esc(extinctionMcui(s).toFixed(1))} · 공식 결과가 나오면 바로 교체 · `:''}${c.category?`IUCN ${esc(c.category)} · 평가 ${esc(c.assessment_year||'미확인')}`:esc(iucnGlobalNote(s))} · 출처 ${esc(c.source_id||'미확인')}${a.iucn_review_older_than_10y?' · 10년 초과 평가':''} · 현행 평가 ${pilotScore(s,'MCUI')===null?'미산출':a.mcui_basis&&a.mcui_basis!=='iucn'?'해당 없음(IUCN 기반 아님)':`확인 ${esc(c.current_status_check?.checked_on??c.current_status_checked_on)} (${esc(c.current_status_check?.source_id??c.current_status_source_id)})`}. ${c.obis_trend?`노력 보정 추세 ${esc(c.obis_trend.direction)} (${esc(c.obis_trend.source_id)})`:'출현기록만으로 추세 보정하지 않음.'}</p>`+(stockMcui(s)?`<p>${esc(stockLead(s))}</p>`:'');
    html+=`<h4>계산과 기준일</h4><p>MFPI: 영양 백분위·등급 80%, 가식부 10%, 양식 근거 10%. MBPI: 층마다 따로 매긴 백분위 × 근거 계수. ChEMBL 화합물은 같은 표적·같은 종말점(IC50·Ki 등) 활성 기록 안에서, ACE 저해 펩타이드는 AHTPDB ACE IC50(HHL 기질) 고정 비교집단 안에서 pIC50으로, 항균 펩타이드는 액체배지 미량희석 MIC를 pMIC = 6 − log10(MIC µM)로 바꿔 표적 세균별 DBAASP 고정 비교집단(액체배지 MIC) 안에서, 항암 펩타이드는 세포 생존 시험 IC50을 pIC50 = 6 − log10(IC50 µM)로 바꿔 암세포주별 CancerPPD 2.0 고정 비교집단 안에서, ${info.method?.xo_bioactivity?'잔틴 산화효소(XO) 억제 펩타이드는 XO IC50을 pIC50으로 바꿔 문헌으로 만든 비교집단 안에서(회원마다 측정 조건이 다름), ':''}감태 분리 화합물은 같은 논문·같은 시험 조건 안에서 순위를 매깁니다. 층끼리는 섞어 비교하지 않고, 종의 MBPI는 모든 층 항목 가운데 가장 높은 값입니다. BBVI: MFPI ${esc(info.foodWeight*100)}% + MBPI ${esc((1-info.foodWeight)*100)}%. MCUI는 별도 축. 산출 ${esc(info.generatedAt||'미기재')}. ${released(info)?`가중치는 팀이 정한 고정 규칙(${esc(info.version)})이며 점수는 정식 산출값입니다`:'가중치는 검증 전이며 점수는 시범값입니다'}${esc(validationNote(info))}.</p>`;
    html+='<h4>원문·이용조건</h4><ul>'+a.source_ids.map(id=>`<li>${sourceLink(info.sources?.[id]?.url,id+' ↗')} · ${esc(info.sources?.[id]?.license||'이용조건 미확인')} · 조회 ${esc(info.sources?.[id]?.accessed||'미기재')}</li>`).join('')+'</ul>';
  }
  {const h=IUCN_HISTORICAL[s.aphiaID];if(h)html+=`<h4>IUCN 평가 · ${pilotScore(s,'MCUI')!==null?(h.current?`${h.current.published}년 현행 평가 · ${P_()}MCUI`:(released()?'현행 여부 재확인':'현행 여부 재확인(시범)')):h.current?'2026년 현행 평가 확인 · 원문 검수 전':'역사적 평가'}</h4><p>${esc(iucnHistoricalText(h,s))} ${sourceLink(h.current?.url||h.url,'IUCN 평가 레코드 ↗')}</p>`;}
  if(study)html+=`<h4>별도 원문 조사 · 지표 입력 아님</h4><p>${esc(study.detail)} ${sourceLink(study.url,study.title+' ↗')}</p>`;
  html+='<p class="fine">실험값은 사람 대상 약효가 아니며, 지도 출현 셀은 개체수·자원량·채집 지점이 아닙니다.</p><button type="button" class="decision-close">접기</button>';
  const panel=$('decision-detail');
  panel.innerHTML=html;panel.hidden=false;card?.after(panel);
  if(typeof cmpMoreSync==='function')cmpMoreSync(); // a card opened here: the compare region it may have left closes
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
      '<p class="fine">MFPI '+P_()+'산식: 동기준 3종 이상 영양 백분위(등급 보정) 80% + 가식부 비율 10% + 양식 근거 10%. 가중치는 외부 검증 전입니다.</p>';
  }
  const n=s.info?.nutrition||{},p=s.info?.production||{};
  const inventory=n.status==='available'
    ? `수집 요약 ${count(n.record_count)} · 단위 미확정 ${count(n.unit_unconfirmed_count)} · 기준량 가정 ${count(n.basis_assumed_count)}.`
    : n.status==='not_collected'?'영양 자료 미수집.':'영양 자료 원값 확인 불가.';
  const farming=Number.isFinite(p.aquaculture_evidence_count)&&p.aquaculture_evidence_count>0
    ? `양식 표시 근거 ${count(p.aquaculture_evidence_count)}도 해역·시기·방법·제약을 검수하지 못했습니다.`
    : '종별 양식 기술·해역·시기·제약을 검수한 근거가 없습니다.';
  return '<h3>식량 가능성 · MFPI 산출 보류</h3>'+
    `<div class="withheld"><b>동일 기준 종별 원자료 미확인</b>${esc(inventory)} ${esc(farming)} 단백질(g), 철·아연·칼슘(mg)의 생물 가식부 100 g 실측·계산·대용값과 방법·시료 시기, 가식부 비율, 양식 근거, 동기준 비교 3종 이상 및 이용조건을 원레코드에서 확인해야 합니다. 보류 항목은 0점이 아닙니다.</div>`;
}

// Short table labels; the full sentence is in scoreReason. Unconfirmed is a reason, never a low value.
const shortReason={comparable_nutrition_missing:'고정 비교집단에 종 행 없음',food_row_not_species_specific:'식품 행이 종 수준 아님',
  component_missing_in_source:'필수 성분 결측',aquaculture_method_unverified:'양식 근거 부족',
  compound_origin_assay_chain_or_fixed_cohort_missing:'기원종→물질→시험 비교집단 없음',not_in_red_list:'IUCN 검색 0건 · 낮은 점수 아님',
  assessment_lookup_failed:'IUCN 조회 실패',category_not_numeric:'IUCN DD · 숫자 없음',requires_MFPI_and_MBPI:'MFPI·MBPI 둘 다 필요',
  mbpi_single_source:'MBPI 최상위 근거 독립 재현 확인 중 · BBVI 보류'};
// Conservation as the verified report reviewed it, for the chip and cell line that otherwise read the older profile status.
const reportConservation=s=>{
  const a=VERIFIED.includes(s.assessment?.report_version)?s.assessment:null;
  if(!a?.conservation_trace?.reviewed)return null;
  const v=pilotScore(s,'MCUI');
  return v!==null?`${P_()}MCUI${separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${v.toFixed(1)}`:shortReason[a.withheld_reasons?.MCUI]||'MCUI 산출 보류';
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
  category_not_numeric:'DD(정보 부족) 등 점수 대응이 없는 범주입니다. 낮은 점수로 바꾸지 않습니다.',
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
// The evidence files keep reasons and 누락 items in English (research notes); the page shows them in Korean. One missing here
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
  "No proven isolation of the tested standard from this Undaria specimen":"시험한 표준품을 이 미역 시료에서 분리했다는 증거 없음",
  "No fixed comparable assay cohort":"비교 가능한 고정 시험 비교집단 없음",
  "ACE substrate/method not confirmed from the paper (abstract only; AHTPDB curation says Cushman-Cheung)":"ACE 기질·시험법을 논문에서 확인하지 못함(초록만 열람, AHTPDB 정리에는 Cushman-Cheung법으로 기재)",
  "Conflicting external CIDs 119551 and 163110604 need stereochemical resolution":"외부 CID 119551과 163110604가 서로 달라 입체화학 확인 필요",
  "MIC/MFC not eligible pChEMBL endpoints":"MIC/MFC는 pChEMBL에 쓸 수 있는 종말점이 아님",
  "No provenance-backed stereo-defined structure record: the only fully defined CID (154730607) is a vendor deposit.":"출처가 뒷받침하는 입체 구조 기록 없음: 구조가 완전히 정의된 유일한 CID(154730607)는 판매업체가 등록한 자료임",
  "Full article experimental chain and structure stereochemistry not independently reviewed":"논문 전문의 실험 과정과 구조 입체화학을 독립적으로 검토하지 않음",
  "No IC50/EC50 endpoint or fixed comparable assay cohort":"IC50/EC50 종말점과 비교 가능한 고정 시험 비교집단 없음",
  "IC50 values only in a figure, not in text or tables":"IC50 값이 그림에만 있고 본문·표에는 없음",
  "No absolute configuration reported":"절대 배치 보고 없음",
  "No PubChem CID/InChIKey":"PubChem CID/InChIKey 없음",
  "Authors state H. roretzi defence metabolites are primarily produced by symbiotic microorganisms: producing organism unresolved":"저자들이 멍게(H. roretzi)의 방어 대사물은 주로 공생 미생물이 만든다고 밝힘: 생산 생물 미확정",
  "No confirmed stable CID/InChIKey for the exact peptide":"이 펩타이드 자체의 확인된 고정 CID/InChIKey 없음",
  "ACE preparation source and full assay conditions not transcribed":"ACE 효소 출처와 전체 시험 조건을 옮겨 적지 않음",
  "No fixed comparable ACE-peptide assay cohort":"비교 가능한 ACE 펩타이드 고정 시험 비교집단 없음",
  "Sequence SAGSLVP (linear, all-L, free termini) computes to 629.7 Da (C27H47N7O10; RDKit InChIKey AUYBEMNUWGOKGL-WVBSATCKSA-N) but the paper reports 657 Da; the 28 Da difference is unexplained, so the structure is not confirmed.":"서열 SAGSLVP(선형, 모두 L형, 말단 자유)는 계산상 629.7 Da(C27H47N7O10, RDKit InChIKey AUYBEMNUWGOKGL-WVBSATCKSA-N)인데 논문은 657 Da로 보고함. 28 Da 차이가 설명되지 않아 구조를 확정하지 못함",
  "Sequence predicted by in silico hydrolysis of T. pacificus myosin; release from squid material not observed":"살오징어(T. pacificus) 미오신을 인실리코로 가수분해해 예측한 서열이며, 실제 오징어 시료에서 나오는 것은 관찰되지 않음",
  "No isolated exact compound linked to the intervention":"처치와 연결된, 분리·확인된 단일 화합물 없음",
  "No molecule-level target, endpoint, value or fixed comparable assay cohort":"분자 수준의 표적·종말점·값과 비교 가능한 고정 시험 비교집단 없음",
  "Fraction activity cannot be attributed to a named constituent":"분획의 활성을 특정 성분에 돌릴 수 없음",
  "No numerical qualifying IC50 for isolated fucosterol in the checked original material":"확인한 원자료에 분리 푸코스테롤의 조건에 맞는 IC50 수치 없음",
  "No fixed comparable single-compound assay cohort":"비교 가능한 단일 화합물 고정 시험 비교집단 없음",
  "Original species spelling S. fusiformis and prior isolation report require specimen-level taxonomic reconciliation with WoRMS S. fusiforme 494972":"원논문의 종명 표기 S. fusiformis와 이전 분리 보고를 WoRMS S. fusiforme(494972)와 표본 수준에서 분류학적으로 맞춰 보아야 함",
  "Full original isolation methods and exact stereochemistry / PubChem CID / InChIKey not established; non-acetylated saringosterol CID 14161394 is a different material":"원논문의 전체 분리 방법과 정확한 입체화학·PubChem CID·InChIKey가 확인되지 않음. 아세틸화되지 않은 사링고스테롤(CID 14161394)은 다른 물질임",
  "Exposure duration, detailed cell-viability protocol and a fixed like-for-like compound cohort missing":"노출 시간, 세포 생존율 시험의 세부 절차, 같은 조건의 화합물 고정 비교집단이 없음",
  "No assay-specific value, relation and unit from the accessible original abstract":"열람할 수 있는 원논문 초록에 시험별 값·관계 기호·단위가 없음",
  "Natural, recombinant and analogue assay results must not be pooled":"천연·재조합·유사체 시험 결과는 합쳐 쓸 수 없음",
  "No fixed comparable peptide cohort":"비교 가능한 펩타이드 고정 비교집단 없음",
  "Complete peptide sequence and exact public structure identifier not established":"펩타이드 전체 서열과 정확한 공개 구조 식별자가 확인되지 않음",
  "No cell-specific IC50, relation or unit in accessed original abstract":"열람한 원논문 초록에 세포주별 IC50·관계 기호·단위가 없음",
  "No fixed comparable peptide assay cohort":"비교 가능한 펩타이드 고정 시험 비교집단 없음",
  "ACE substrate/method not confirmed from the paper (abstract only)":"ACE 기질·시험법을 논문에서 확인하지 못함(초록만 열람)",
  "No fixed comparable compound stratum for this target/assay in verified-pilot-2":"verified-pilot-2에는 이 표적·시험법에 맞는 비교 가능한 화합물 고정 층이 없음",
  "Origin ambiguous: the paper's peak-by-peak IC50 list assigns this value to the pearl oyster (Pinctada fucata martensii), while its sequence sentence lists the peptide for the clam; not scored until the authors' assignment is resolved":"기원이 모호함: 논문의 피크별 IC50 목록은 이 값을 진주조개(Pinctada fucata martensii)에 배정하지만, 서열을 설명한 문장은 이 펩타이드를 바지락 것으로 적음. 저자의 배정이 정리될 때까지 점수에 쓰지 않음",
};
// 4.9: the scale is the row's own (pIC50 in the ACE stratum, pKi/pEC50 in a relaxed one), so the gap reason carries it.
const reasonKo=t=>REASON_KO[t]||t?.replace(/^(p\w+) gap above (\S+)$/,'$1 차이가 기준 $2 초과');
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
  const outside=f.outside_cohort?`<p class="fine">${f.row_table==='mext'?`RDA 식품성분 DB에 이 종으로 연결된 행이 없어 일본 식품성분표 2020(8정판) ${esc(String(f.source_food_item_id).slice(5))} ${esc(f.reported_food_name)}(같은 종 생것, 가식부 100 g)을 이 종의 영양 행과 폐기율로 썼습니다(신뢰도 계수 0.85). `:''}${f.row_table==='literature'&&f.literature_moisture?`${esc(f.literature_moisture.label)}: 같은 시료의 생시료 수분을 밝힌 원자료가 없어, 이 종을 분석한 자료(${verifiedSource(f.source_id,'원문 ↗')})의 건물 기준 값을 같은 종 다른 시료의 생시료 수분(중앙값 ${esc(f.literature_moisture.moisture_pct)}%: ${esc(f.literature_moisture.values.map(v=>v.value).join('·'))}%)으로 날것 기준(가식부 100 g)으로 환산했습니다(팀장 결정 2026-10-04, 신뢰도 계수 ${esc(data.assessmentInfo?.method?.nutrition?.grade_factors?.literature_converted)}). 수분 값 출처: ${esc(f.literature_moisture.values.map(v=>v.source).join(' / '))}. `:f.row_table==='literature'?`RDA 식품성분 DB와 일본 식품성분표에 이 종의 행이 없어, 이 종을 직접 분석한 원논문(${verifiedSource(f.source_id,'원문 ↗')})의 건물 기준 값을 같은 시료의 수분으로 날것 기준(가식부 100 g)으로 환산해 이 종의 영양 행으로 썼습니다(신뢰도 계수 ${esc(data.assessmentInfo?.method?.nutrition?.grade_factors?.literature_converted)}). `:''}${omitted.length?`원자료에 ${esc(omitted.map(k=>nutrientNames[k]||k).join('·'))} 값이 비어 있어 평균에서 뺐습니다(0점 아님, 사용 성분 ${Object.keys(f.nutrients||{}).length}/${Object.keys(f.nutrients||{}).length+omitted.length}). `:''}`+
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
  const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer', xo=x.stratum_kind==='xo', rx=x.stratum_kind==='relaxed';
  const m=(x.measurements||[])[0]||{};
  const name=rx?`완화 산출(d) 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)}${x.sequence_modifications?' · '+esc(x.sequence_modifications):''})`:xo?`잔틴 산화효소 억제 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)})`:anti?`항암 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)})`:amp?`항균 펩타이드 ${esc(x.peptide_name||x.peptide_sequence)} (${esc(x.peptide_sequence)}${x.sequence_modifications?' · '+esc(x.sequence_modifications):''})`:peptide?`펩타이드 ${esc(x.peptide_sequence)}`:ch?
    `${esc(x.compound_name||x.compound_id)} · ${sourceLink(`https://www.ebi.ac.uk/chembl/explore/compound/${x.compound_id}`,x.compound_id)}`:
    `${esc(m.compound_name||x.compound_id)} · ${m.structure_url?sourceLink(m.structure_url,x.compound_id):esc(x.compound_id)}${m.molecular_formula?' · '+esc(m.molecular_formula):''}`;
  const raw=rx?(x.measurements||[]).map(v=>esc(`${v.target_name} ${v.endpoint} ${v.relation} ${num(v.value)} ${v.unit} · ${v.assay||''}`)).join(' / ')+` · pChEMBL 환산 ${esc(x.pchembl)}`:xo?(x.measurements||[]).map(v=>esc(`XO IC50 ${v.relation} ${peptideValue(v)} · ${v.enzyme_source||''} · ${v.readout||''}`)).join(' / ')+` · pIC50 ${esc(x.pIC50)}`:anti?(x.measurements||[]).map(v=>esc(`${v.cell_line} IC50 ${v.relation} ${num(v.value)} ${v.unit}${v.value_as_published?' ('+v.value_as_published+')':''} · ${v.method}${v.exposure?' '+v.exposure:''}`)).join(' / ')+` · pIC50 ${esc(x.pIC50)}`:
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
    const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer', xo=x.stratum_kind==='xo', rx=x.stratum_kind==='relaxed';
    const m=(x.measurements||[])[0]||{};
    const {name,raw}=bioItemHtml(x);
    const cohort=rx?`${esc(x.target_name)} ${esc(x.standard_type)} ChEMBL 활성 기록 ${esc(x.cohort_records)}건(고정 스냅숏)`:xo?`잔틴 산화효소 IC50 펩타이드 ${esc(x.peer_peptides)}개(문헌 비교집단)`:anti?`${esc(x.cell_line)} IC50 펩타이드 ${esc(x.peer_peptides)}개${x.self_in_cohort?' · 이 펩타이드 자신은 비교집단에서 제외':''}`:
      amp?`${esc(x.target_species)} MIC 펩타이드 ${esc(x.peer_peptides)}개`:peptide?`펩타이드 ${esc(x.peer_peptides)}개`:ch?`ChEMBL 활성 기록 ${esc(x.cohort_records)}건`:`화합물 ${esc(x.peer_compounds)}개`;
    return `<div class="score-fact${used?' score-used':''}"><b>${used?'점수에 쓴 값 · ':''}${name}</b>`+
      `<span>${raw}${m.target_id?' · 표적 '+esc(m.target_id):''}${m.test_system?' · '+esc(m.test_system):''}</span></div>`+
      (m.conditions_key?`<p class="fine">시험 조건: ${esc(m.conditions_key)}</p>`:'')+
      (x.caveat?`<p class="fine">주의: ${esc(x.caveat)}</p>`:'')+
      ((peptide||amp||anti||xo||rx)?(x.measurements||[]).map(v=>{const src=data.assessmentInfo?.sources?.[v.source_id];
        return `<p class="fine">원값 출처: ${verifiedSource(v.source_id,esc(src?.provider||'원논문')+' ↗')} · 이용조건 ${esc(src?.license||'미확인')} · 조회 ${esc(src?.accessed||'미기재')}</p>`;}).join(''):'')+
      (ch?`<p class="fine">비교 코호트 ${esc(x.stratum_id)} (${cohort}) · 백분위 ${esc(x.percentile)} × 근거 계수 ${esc(x.evidence_factor)}(종 연결 ${esc(x.link_factor)} × 활성 ${esc(x.activity_factor)}) = ${esc(Math.round(x.adjusted*10)/10)} · 종 연결 논문 ${x.original_paper_dois.map(doiLink).join(', ')} · ChEMBL 문서 ${esc(x.document_chembl_ids.join(', '))}</p><p class="fine">${esc(x.label)}</p>`:
      `<p class="fine">비교 코호트 ${esc(x.stratum_id)} (${cohort}) · 백분위 ${esc(x.percentile)} × 근거 계수 ${esc(x.evidence_factor)} = ${esc(Math.round(x.adjusted*10)/10)}${x.percentile===0?' · 백분위 0은 비교집단의 모든 값보다 약한 실측값이라는 뜻이며, 자료가 없다는 뜻이 아닙니다':''}${x.percentile===100?` · 백분위 100은 이 비교집단의 ${esc(x.peer_peptides)}개 값보다 모두 강하다는 뜻이며, 더 강한 물질이 없다는 뜻은 아닙니다`:''} · 원논문 ${(x.original_paper_dois||[]).map(doiLink).join(', ')}</p>`)+
      (x.potency_replications||[]).map(r=>{const src=data.assessmentInfo?.sources?.[r.source_id];
        // 4.9: a relaxed item's replication is ranked on its own endpoint, so the row names its scale (pKi, pEC50, …)
        const scale=r.p_scale||'pIC50';
        return `<div class="score-fact"><b>효능 재현 · ${r.material==='purified_isolate'?'정제':'합성'} ${esc(x.peptide_sequence)} ${esc(peptideValue(r))} · 재현 시료 ${esc(r.origin_label||r.origin_material)}</b>`+
          `<span>${esc(scale)} ${esc(r.p??r.pIC50)} · 차이 ${esc(r.p_gap??r.pIC50_gap)} · ${r.used?'독립 DOI로 셈':'쓰지 않음: '+esc(reasonKo(r.reason))}</span></div>`+
          `<p class="fine">출처: ${verifiedSource(r.source_id,esc(src?.provider||'원논문')+' ↗')} · DOI ${doiLink(r.original_paper_doi)} · 이용조건 ${esc(src?.license||'미확인')} · 조회 ${esc(src?.accessed||'미기재')}. 효능만 재현하며 기원 근거나 점수 값이 되지 않습니다.</p>`;}).join('');
  }).join('');
  // A peptide percentile ranks against the fixed AHTPDB cohort (CC BY-NC 4.0), so the cohort is cited where the rank is shown.
  const ampRule=best.stratum_kind==='amp'?data.assessmentInfo?.method?.amp_bioactivity:null;
  const antiRule=best.stratum_kind==='anticancer'?data.assessmentInfo?.method?.anticancer_bioactivity:null;
  const xoRule=best.stratum_kind==='xo'?data.assessmentInfo?.method?.xo_bioactivity:null;
  const rxBest=best.stratum_kind==='relaxed'?data.assessmentInfo?.method?.relaxed_bioactivity:null;
  const pep=best.stratum_kind==='peptide'?data.assessmentInfo?.method?.peptide_bioactivity:null;
  const pepSrc=pep?data.assessmentInfo?.sources?.[pep.cohort_source_id]:null;
  const ch=best.stratum_kind==='chembl', rule3=data.assessmentInfo?.method?.chembl_bioactivity;
  const scope=rxBest?`${esc(rxBest.allowed_relaxations?.[best.relaxation]||'완화 산출(d)')} — ChEMBL ${esc(best.target_name)} ${esc(best.standard_type)} 활성 기록 ${esc(best.cohort_records)}건(고정 스냅숏) 안의 상대 순위입니다. ${esc(best.caveat||'')}`:xoRule?`PubMed 문헌으로 만든 고정 비교집단(잔틴 산화효소 IC50, 펩타이드 ${esc(best.peer_peptides)}개, 중앙 pIC50 ${esc(best.cohort_median_pIC50)}) 안의 상대 순위입니다. 측정 조건(효소 출처, 흡광·HPLC)이 회원마다 다릅니다.`:antiRule?`CancerPPD 2.0에서 고른 고정 비교집단(${esc(best.cell_line)} 세포주 IC50, 펩타이드 ${esc(best.peer_peptides)}개${best.self_in_cohort?' · 이 펩타이드 자신은 제외':''}, 중앙 pIC50 ${esc(best.cohort_median_pIC50)}) 안의 상대 순위입니다.`:
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
    `${single&&!ch?` → 독립 재현 없음 계수 ${esc(cfg.single_doi_factor??items[0].evidence_factor)}`:''} · 민감도 ${esc((cfg.sensitivity_aggregations||[]).join('·')||'미기재')}${a.sensitivity?.range_from_aggregation?' 범위 '+esc(a.sensitivity.range_from_aggregation.join('–')):''}</p>`+
    `<p class="fine">한계: 백분위는 ${scope} ${chemblLimit}${single?((best.potency_replications||[]).length&&data.assessmentInfo?.method?.bioactivity?.replication_origin_rule?'이 종의 시료로 잰 독립 재현 논문이 아직 없습니다(다른 기원의 효능 재현은 세지 않음). ':'독립 재현 논문이 아직 없습니다. '):reps.length?(data.assessmentInfo?.method?.bioactivity?.replication_origin_rule?`독립 DOI로 센 효능 재현은 이 종에서 정제한 시료를 다른 논문이 잰 값입니다(4.11부터 다른 기원의 측정은 세지 않음). `:`효능 재현은 별도 논문의 펩타이드 측정이고, 이 종에서 ${esc(best.peptide_sequence)}가 나온다는 기원 근거는 ${originNames} ${origin.length}편뿐입니다. `):''}${antiRule?'암세포주 증식 억제 농도(IC50)이며':ampRule?'세균 배양 억제 농도(MIC)이며':ch?'시험관·세포·병원체 시험값이며':'세포 밖(효소) 시험값이며'} 임상 효과나 제품 가치가 아닙니다.</p>`+
    (xoRule?`<p class="fine">비교집단 출처: ${verifiedSource(xoRule.cohort_source_id,(data.assessmentInfo?.sources?.[xoRule.cohort_source_id]?.provider)||'문헌 비교집단')}</p>`+(best.cohort_members?.length?`<details class="fine"><summary>비교집단 회원 ${best.cohort_members.length}개 보기(서열 · IC50 µM · DOI)</summary><p>${best.cohort_members.map(m=>esc(m.sequence)+' '+esc(m.ic50_uM)+' · '+m.dois.map(doiLink).join(', ')).join('<br>')}</p></details>`:''):'')+
    (rxBest?`<p class="fine">비교집단 출처: ${verifiedSource(rxBest.cohort_source_id,(data.assessmentInfo?.sources?.[rxBest.cohort_source_id]?.provider)||'ChEMBL')} · 활동 ID 전체와 pChEMBL 값은 공개 스냅숏(research/verified-indices/snapshots)에 있고, 이 화면은 함께 실린 pChEMBL ${esc(best.cohort_records)}건으로 백분위를 다시 계산해 검사합니다.</p>`+((best.other_targets||[]).length?`<p class="fine">다른 표적: ${best.other_targets.map(t=>esc(`${t.target_name} ${t.standard_type} ${num(t.value)} ${t.unit} · 백분위 ${t.percentile} (기록 ${t.cohort_records}건)`)).join(' / ')} — 백분위가 가장 높은 표적 하나만 점수에 씁니다.</p>`:''):'')+
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
      (item.assay_type?`<p class="fine">시험 ${esc(item.assay_type)} · 시료 연도 ${esc(item.sample_year||'원문 기재 없음')} · 논문 발행 ${esc(item.publication_year||'출처 참고')}</p>`:'')+
      (chain?`<p class="fine">연결 단계: ${esc(chain)}</p>`:'')+
      ((item.missing||[]).length?`<p class="fine">누락: ${esc(item.missing.map(reasonKo).join(' / '))}</p>`:'')+
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
    (ps?` 위키데이터 연결이 없어 CMNPD·PubChem 분류군·Europe PMC 원논문을 찾았습니다(${esc(ps.searched_on)}, Europe PMC ${esc(ps.europepmc_hits)}건 중 ${esc(ps.papers_screened)}건 선별, 인정 연결 ${esc(ps.accepted_links)}건 · CMNPD 검색 부분은 CC BY-NC-SA 4.0 조건).`:'')+' 정보충분도가 낮다는 뜻이며 자료 부재의 증거는 아닙니다.</p>':'';
  const fl=s.assessment.mbpi_floor;
  return (fl?`<p><b>${esc(s.assessment.mbpi_label)} · MBPI ${esc(Number(fl.value).toFixed(1))}</b>: ${esc(fl.meaning)} 규칙: ${esc(fl.prereg)} 1.5절(팀장 결정 2026-10-05).</p>`:
    '<p>검증된 기원종·화합물·시험 사슬을 찾지 못했습니다. 자료 부재의 증거는 아닙니다.</p>')+rawHtml+partial+linkChain+rejected+
    (!cl&&s.assessment.candidate_label&&!items.length?'<p class="fine">조사 후보 검색 범위: Wikidata/LOTUS 기원종 기록과 ChEMBL 37 정량값(2026-09-26)에서 미발견. PubChem·CMNPD·문헌 전수는 아직 조사하지 않았습니다.</p>':'');
}
// 4.14 (prereg-4.14-2026-10-14 2·3): the conservation state in words, then every list found by scope. Only an IUCN global or
// a Korean national category gives the extinction-risk number; another country's or a region's list stays a reference.
const SCOPE_KO={global:'IUCN 전 지구',korea:'한국 국가',other_country:'다른 나라 국가 평가',sub_national:'다른 나라 지방 평가'};
function conservationStatusBlock(s){
  const c=s.assessment?.conservation_status, scope=data.assessmentInfo?.method?.mcui_scope;
  if(!c||!scope)return '';
  const where=x=>[x.region_ko||x.region,x.country_ko||x.country].filter(Boolean).join(', ');
  const rows=c.assessments.map(x=>`<li>${esc(SCOPE_KO[x.scope]||x.scope)}${where(x)?' ('+esc(where(x))+')':''} · ${esc(x.list)}${x.year?' '+esc(x.year):''} · ${esc(x.category_as_published)}`+
    `${x.category&&x.category!==x.category_as_published?` (${esc(x.category)}에 해당하는 이름 · 숫자로 바꾸지 않음)`:''} · ${x.used_for_mcui?(x.use==='preliminary'?'예비 평가로 MCUI 멸종위험 성분에 사용':'MCUI 멸종위험 성분에 사용'):'참고 · MCUI·유형·지도 색에 쓰지 않음'}${x.source_id&&data.assessmentInfo?.sources?.[x.source_id]?' · '+verifiedSource(x.source_id,'원목록 ↗'):''}</li>`).join('');
  const why=[...new Set(c.assessments.filter(x=>!x.used_for_mcui).map(x=>x.scope==='other_country'?'range_state':'sub_national'))].map(k=>scope.reference_notes?.[k]).filter(Boolean);
  return `<p><b>보전평가 상태: ${esc(c.label)}</b>${c.mcui_role_label?' · '+esc(c.mcui_role_label):''}</p>`+
    (rows?`<ul class="fine">${rows}</ul>`:'<p class="fine">IUCN 전 지구·한국 국가·다른 나라 공식 평가 기록을 찾지 못했습니다. 공식 미평가(NE) 판정이 아니며, 보전 위험이 낮다는 뜻도 아닙니다.</p>')+
    (why.length?`<p class="fine">${why.map(esc).join(' ')}</p>`:'')+
    (c.preliminary?`<p class="fine">${esc(c.preliminary.note)}</p>`:'')+
    (c.self_preliminary&&!c.preliminary?`<p class="fine"><b>${esc(c.self_preliminary.label)}</b>: ${esc(c.self_preliminary.note)}</p>`:'')+
    (c.mcui_role==='stock_decline_lower_bound'?'<p class="fine">멸종위험 평가가 없어 자원 감소 신호 점수를 MCUI 하한으로만 씁니다(구분선 이상일 때만). 멸종위험은 이보다 높을 수도 있고, 이 값은 IUCN 평가가 아닙니다.</p>':
     pilotScore(s,'MCUI')===null?'<p class="fine">MCUI가 없는 종은 0이나 낮은 위험으로 바꾸지 않고, 매트릭스 유형과 지도 셀 색을 정하지 않습니다. 다른 지표와 출현기록은 그대로 볼 수 있습니다.</p>':'')+
    `<p class="fine">${esc(c.mapping_note)}</p>`;
}
// the same state in one sentence for the evidence-stage line
function conservationStatusSentence(s){
  const c=s.assessment.conservation_status, others=c.assessments.filter(x=>!x.used_for_mcui);
  return `${c.label}. `+(others.length?`다른 나라·지역 평가 ${others.length}건(${others.map(x=>[x.region_ko||x.country_ko||x.country,x.category_as_published].join(' ')).join(', ')})은 그 지역 개체군의 평가라 참고로만 보입니다. `:'')+
    (c.self_preliminary?(data.assessmentInfo?.method?.mcui_scope?.preliminary_bases?.length?c.self_preliminary.note+' ':'자체 예비검토(Rapid LC)는 공식 평가가 아니라 MCUI에 쓰지 않습니다. '):'')+
    (c.mcui_role==='stock_decline_lower_bound'?'자원 감소 신호 점수가 탐색적 구분선 이상이라 MCUI 하한으로만 씁니다. ':c.mcui_role==='stock_decline_reference'?'자원 감소 신호는 구분선 미만이라 참고로만 보입니다. ':'')+
    '보전 위험이 낮다는 뜻이 아닙니다.';
}
function verifiedNationalFact(s){return conservationStatusBlock(s)+verifiedNationalFactBody(s);}
function verifiedNationalFactBody(s){
  const b=s.assessment.national_assessment;
  if(s.assessment.mcui_basis==='national'&&b)return `<p><b>한국 국가 평가 기반 ${P_()}MCUI</b>: ${esc(b.category)} · 게재명 ${esc(b.name_as_published)} · `+
    `목록 ${esc(b.list_page_printed)}쪽(뷰어 ${esc(b.list_page_viewer)}쪽) · 범위 ${esc(b.scope)} · ${esc(b.assessment_basis)} · ${verifiedSource(b.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    (data.assessmentInfo?.method?.national_red_list?.page_recheck?.checked_on?`<p class="fine">목록·찾아보기 쪽 재확인 ${esc(data.assessmentInfo.method.national_red_list.page_recheck.checked_on)} · 초판·개정판 등급 ${esc(b.first_edition_category||'미기재')} → ${esc(b.category)} (${esc(b.change||'변동 미기재')})</p>`:'')+
    (b.crosswalk?`<p class="fine">학명 대응(확인 ${esc(b.crosswalk.checked_on)}): ${esc(b.crosswalk.evidence)}</p>`:'')+
    '<p class="fine">국가 평가 점수는 전 지구 IUCN 기반 MCUI와 범위가 달라 서로 순위를 매기거나 비교하지 않고, '+(matrixRule()?.include_national_mcui?'매트릭스에는 놓되 툴팁과 유형별 목록에 기반을 따로 적습니다.':'매트릭스에도 놓지 않습니다.')+'</p>';
  // After 3.14: another range state's national list gives a separately labelled MCUI (shown with its inputs).
  const sub=s.assessment.mcui_substitute;
  if(earlyMcui(s)&&sub)return preliminaryBasisDetail(s,sub);
  if(subNationalMcui(s)&&sub){
    const rec=sub.record, bt=rec.backtest||{}, rule=data.assessmentInfo?.method?.mcui_substitutes?.sub_national||{};
    const rows=(rec.regions||[]).map(x=>`<li>${esc(x.region_ko||x.region)}(${esc(x.country_ko||x.country)}) · ${esc(x.category_as_published)} → ${esc(x.category)} · 게재명 ${esc(x.name_as_published)} · ${esc(x.list)} ${esc(x.edition)} · ${verifiedSource(x.source_id,'원목록 ↗')}${x.currency_source_id?' · 현행 확인 '+verifiedSource(x.currency_source_id,'개정 원본 ↗'):''}${x.note?'<br>'+esc(x.note):''}</li>`).join('');
    return `<p><b>${esc(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${esc(sub.category)} → ${esc(extinctionMcui(s).toFixed(1))} · 지역 ${esc((rec.regions||[]).length)}곳의 중앙값 · ${esc(bt.label||'')}</p>`+
      `<ul class="fine">${rows}</ul>`+
      `<p class="fine">${esc(rule.limitation||'')} 국가·전 지구 수준의 멸종 위험이 아니며, IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.</p>`+
      `<p class="fine">역검증: ${esc(bt.criterion||'')} 결과 ${esc(bt.label||'')}. 기준은 값을 모으기 전에 정해 커밋했습니다(${esc(bt.prereg||'')}). 결과와 상관없이 값은 그대로 쓰고 결과를 함께 보입니다.</p>`;
  }
  if(preliminaryMcui(s)&&sub){
    const r=sub.record, t=r.thresholds||{}, ps=data.assessmentInfo?.method?.mcui_substitutes?.preliminary_scored||{};
    return `<p><b>${esc(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${esc(sub.pilot_mapping||sub.category)} · EOO ${esc(r.eoo_km2.toLocaleString())} km²(기준 ${esc(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${esc(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${esc(r.aoo_cells)}칸, 기준 ${esc(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${esc(r.records)}건(기준 ${esc(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      (r.official_unscored?.length?`<p class="fine">공식 목록에 이름은 있으나 점수 범주가 아닌 기록(점수에 쓰지 않음):</p><ul class="fine">${r.official_unscored.map(x=>`<li>${esc(x.region_ko||x.region)}(${esc(x.country_ko||'')}) · ${esc(x.category_as_published)} · 게재명 ${esc(x.name_as_published)} · ${esc(x.list)} ${esc(x.edition)} · ${esc(x.excluded_reason)}${x.source_id?' · '+verifiedSource(x.source_id,'원목록 ↗'):x.url?' · '+sourceLink(x.url,'원목록 ↗'):''}</li>`).join('')}</ul>`:'')+
      `<p class="fine">IUCN·한국 국가·서식국 국가·지방 목록 어디에도 이 종의 점수가 되는 범주가 없어 쓰는 마지막 근거입니다(팀장 결정 2026-10-05).${r.official_unscored?.length?' 이름은 있지만 점수 범주가 아닌 공식 목록 기록은 아래에 따로 적었습니다.':''} GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${esc(r.native_box.lat.join('–'))}°, 경도 ${esc(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했고, OBIS 보고율 추세는 ${esc(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}입니다. `+
      `${(ps.limitations||[]).map(esc).join(' ')} IUCN 기반 MCUI와 비교·순위에 쓰지 않고 매트릭스에는 회색 점선 점으로 따로 놓습니다.</p>`+subNationalReference(sub)+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${esc(b.n)}종): ${esc(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}`+
        `${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${esc(b.false_lc_for_threatened.join('·'))}`:''}. ${esc(b.reason)}</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  if(substituteMcui(s)&&sub){
    const r=sub.record;
    return `<p><b>${esc(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${esc(r.category_as_published)} → ${esc(sub.category)}${r.rank_out?' 상당(평가했으나 위협 범주 없음 · 팀장 결정 2026-10-04)':''} · 게재명 ${esc(r.name_as_published)} · ${esc(r.list)} · 범위 ${esc(r.scope)} · ${verifiedSource(r.source_id,'원목록 ↗')}</p>`+
      `<p class="fine">${esc(r.continuity.replace(/\.$/,''))}. ${esc(r.limitations)}</p>`;
  }
  // 3.15 (team-lead decision 2026-10-02): reference only. The Rapid LC record is shown beside the withheld MCUI, never as a score.
  const ref=mcuiReference(s);
  if(ref&&ref.basis!=='preliminary')return '';
  if(ref){
    const r=ref.record, t=r.thresholds||{};
    return `<p><b>자체 예비검토(Rapid LC) 참고 정보 · 공식 평가 아님 · MCUI 점수 아님</b>: 넓은 분포·기록 수 기준만 확인(낮은 멸종위험을 확정하지 않음) · EOO ${esc(r.eoo_km2.toLocaleString())} km²(기준 ${esc(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${esc(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${esc(r.aoo_cells)}칸, 기준 ${esc(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${esc(r.records)}건(기준 ${esc(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      `<p class="fine">GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${esc(r.native_box.lat.join('–'))}°, 경도 ${esc(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했습니다. OBIS 보고율 추세: ${esc(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}. `+
      `공식 IUCN 평가가 아니며, 어획 등에 따른 감소(기준 A)는 OBIS 추세로만 확인했습니다. MCUI 점수·매트릭스·지도 색·순위에 쓰지 않습니다.</p>`+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${esc(b.n)}종): ${esc(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}`+
        `${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${esc(b.false_lc_for_threatened.join('·'))}`:''}. ${esc(b.reason)}</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  // 4.11 (prereg 5.2): the OBIS reporting-rate ratio reached the decline threshold, so the met Rapid LC check gives no MCUI.
  if(pilotScore(s,'MCUI')===null&&sub?.result==='decline_ratio_reached'){
    const r=sub.record, rule=data.assessmentInfo?.method?.conservation?.trend;
    return `<p><b>자체 예비평가(Rapid LC) 쓰지 않음 · MCUI 없음</b>: OBIS 보고율 비(${esc(Number(r.reporting_rate_ratio).toFixed(3))})가 감소 기준(${esc(rule?.decline_ratio)}) 이하입니다.</p>`+
      `<p class="fine">가장 큰 데이터셋 안에서 감소가 확인되지 않았더라도, 확인되지 않은 감소를 '감소 없음'으로 읽지 않습니다(사전 등록 ${esc(data.assessmentInfo?.method?.mcui_substitutes?.preliminary_trend_block?.prereg||'')}). 분포 기록(EOO ${esc(r.eoo_km2.toLocaleString())} km² · AOO ${esc(r.aoo_km2.toLocaleString())} km² · 좌표 기록 ${esc(r.records)}건)은 참고로만 적습니다.</p>`;
  }
  const n=s.assessment.national_red_list_fact;
  return n?`<p>국가 평가(한국 범위): ${esc(n.category)} · 게재명 ${esc(n.name_as_published)} · 목록 ${esc(n.list_page_printed)}쪽 · ${verifiedSource(n.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    '<p class="fine">국가 평가는 전 지구 IUCN 평가와 범위가 달라 MCUI 점수에 넣지 않는 사실 정보입니다.</p>':'';
}
// 4.17 (prereg-4.17-2026-10-15 2): the preliminary assessment behind the MCUI, with its inputs, in the species detail only
function preliminaryBasisDetail(s,sub){
  const r=sub.record||{}, label=s.assessment.conservation_status.preliminary?.label||'예비 평가';
  const value=`${esc(sub.category)} → ${esc(extinctionMcui(s).toFixed(1))}`;
  if(rawPreliminaryMcui(s)){
    const t=r.thresholds||{};
    return `<p><b>${esc(label)} · 자체 예비평가(Rapid LC)</b>: ${value} · EOO ${esc(r.eoo_km2.toLocaleString())} km²(기준 ${esc(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${esc(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${esc(r.aoo_cells)}칸, 기준 ${esc(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${esc(r.records)}건(기준 ${esc(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      `<p class="fine">GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${esc(r.native_box.lat.join('–'))}°, 경도 ${esc(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했습니다. OBIS 보고율 추세: ${esc(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}.${obisRatioNote(s)}</p>`+
      subNationalReference(sub)+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${esc(b.n)}종): ${esc(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${esc(b.false_lc_for_threatened.join('·'))}`:''}. 공식 평가가 나오면 그 값으로 바꿉니다.</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  return `<p><b>${esc(label)} · ${esc(r.country_ko||r.country||'서식국')} 국가 평가</b>: ${esc(r.category_as_published)} → ${value}${r.rank_out?' (평가했으나 위협 범주 없음 → LC 상당 · 팀장 결정 2026-10-04)':''} · 게재명 ${esc(r.name_as_published)} · ${esc(r.list)} · 범위 ${esc(r.scope)} · ${verifiedSource(r.source_id,'원목록 ↗')}</p>`+
    (r.continuity||r.limitations?`<p class="fine">${esc((r.continuity||'').replace(/\.$/,''))}${r.continuity?'. ':''}${esc(r.limitations||'')}</p>`:'')+subNationalReference(sub);
}
// 4.19 (prereg-4.19-2026-10-15 1): a reporting-rate ratio at or below the decline ratio no longer blocks the Rapid LC check;
// its numbers stay in the species detail beside the check
function obisRatioNote(s){
  const t=s.assessment.occurrence_trend, cut=data.assessmentInfo?.method?.conservation?.trend?.decline_ratio;
  if(!t||t.reporting_rate_ratio==null||cut==null||t.reporting_rate_ratio>cut)return '';
  const d=t.dataset_check, ci=x=>x?.length===2?`(95% 구간 ${esc(x[0])}–${esc(x[1])})`:'';
  return ` 전체 보고율 비 ${esc(t.reporting_rate_ratio)}${ci(t.ci)}`+(d?`, 주된 데이터셋 안 ${esc(d.reporting_rate_ratio)}${ci(d.ci)} · 감소 ${d.confirms_decline?'확인':'확인 안 됨'}`:'')+
    '. OBIS 보고율 추세는 사후 검증에서 위협종과 LC를 가르지 못해(4.11) 점수 보정과 예비평가 판정에 쓰지 않습니다(4.19).';
}
// 4.11 (prereg 5.1): a sub-national list whose back-test failed is shown as reference beside the next basis, never as the score.
function subNationalReference(sub){
  const ref=sub?.sub_national_reference;
  if(!ref)return '';
  const rows=(ref.regions||[]).map(x=>`<li>${esc(x.region_ko||x.region)}(${esc(x.country_ko||x.country)}) · ${esc(x.category_as_published)} → ${esc(x.category)} · 게재명 ${esc(x.name_as_published)} · ${esc(x.list)} ${esc(x.edition)} · ${verifiedSource(x.source_id,'원목록 ↗')}${x.note?'<br>'+esc(x.note):''}</li>`).join('');
  return `<p class="fine"><b>지방 목록 참고값 · MCUI 점수 아님</b>: ${esc(ref.chosen_category)} · ${esc(ref.backtest?.label||'')}. 과대평가 역검증을 통과하지 못한 지방 목록은 4.11부터 점수에 쓰지 않습니다.</p><ul class="fine">${rows}</ul>`;
}
function verifiedConservationDetail(s){
  const c=s.assessment.conservation_trace;
  if(!c)return '<p>IUCN 평가 조회 기록이 없습니다. 평가 없음(NE)으로 추정하지 않습니다.</p>';
  if(c.iucn_state==='not_in_red_list')return `<p>IUCN 적색목록 검색 결과 0건 (${esc(c.search.queries.join(', '))}; ${esc(c.search.checked_on)}). `+(c.recheck?`재확인 ${esc(c.recheck.checked_on)}: 적색목록 ${esc(c.recheck.red_list_version)}에서 ${esc(c.recheck.queries.join(', '))} 검색 0건. `:'')+
    `대조 검색: ${esc(c.search.positive_controls.join(', '))}. ${esc(c.search.also_checked)}. ${verifiedSource(c.source_id,'IUCN 검색 ↗')}</p><p class="fine">${esc(c.verification)}</p>`;
  const check=c.current_status_check;
  return `<p>${esc(c.category)}${c.criteria?' '+esc(c.criteria):''} (기준 ${esc(c.criteria_version)}) · 평가일 ${esc(c.assessment_date)} · 발표 ${esc(c.publication_year)} · 범위 ${esc(c.scope)} · 개체군 추세 ${esc(c.population_trend)}`+
    `${c.annotations?' · 주석 “'+esc(c.annotations)+'”':''}${c.assessment_older_than_10y?' · 10년 넘은 평가':''}. ${verifiedSource(c.source_id,'IUCN 평가 ↗')}</p>`+
    (c.pilot_mapping?`<p>원래 등급과 ${released()?'점수 대응':'시범 숫자'}: ${esc(c.pilot_mapping)} · ${esc(c.label)}</p>`:'')+
    `<p class="fine">현행 확인: ${check?.is_current?'현행 평가 ('+esc(check.red_list_version)+', '+esc(check.checked_on)+')':'확인 보류'} · ${verifiedSource(check?.source_id,'확인 근거 ↗')}. ${esc(c.verification)}</p>`+
    (c.previous_assessments||[]).map(p=>`<p class="fine">이전 평가 ${esc(p.record_id)} · ${esc(p.category)} ${esc(p.criteria||'')} · ${esc(p.assessment_date)} 평가 · ${esc(p.status)}</p>`).join('')+
    (s.assessment.occurrence_trend?'':'<p class="fine">OBIS·GBIF 원시 출현 건수는 개체군 추세로 쓰지 않았고, MCUI에 가감하지 않았습니다. 종 단위 평가를 출현 셀의 해역 등급으로 옮기지 않습니다.</p>');
}
// 4.12: one sentence on how the stock signal set the MCUI, e.g. 'IUCN LC 10 · 자원 감소 60 → 높은 값 60'
function stockCompare(s){
  const a=s.assessment,d=a?.stock_decline,ext=a?.mcui_extinction_risk,v=pilotScore(s,'MCUI');
  if(!d||v===null)return '';
  const c=a.conservation_trace,basis=a.mcui_basis==='iucn'&&c?.category?'IUCN '+c.category:ext===null?'멸종위험 평가 없음':mcuiBasisShortOf(s);
  // 4.14 (prereg-4.14 4): with no extinction-risk value the decline is a lower bound, kept only at or above the matrix line
  if(ext===null&&a.conservation_status?.mcui_role==='stock_decline_lower_bound')
    return `멸종위험 평가 미확인 · 자원 감소 ${d.score.toFixed(0)}(구분선 ${matrixRule()?.mcui_threshold??50} 이상) → 하한 ${v.toFixed(0)}`;
  return `${basis}${ext===null?'':' '+ext.toFixed(0)} · 자원 감소 ${d.score===null?'없음':d.score.toFixed(0)} → ${a.mcui_driver==='tie'?'같은 값':'높은 값'} ${v.toFixed(0)}`;
}
const mcuiBasisShortOf = s => nationalMcui(s)?'한국 국가 평가':subNationalMcui(s)?'지방 목록 참고값':preliminaryMcui(s)?'자체 예비평가':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||'서식국'} 국가 평가`:earlyMcui(s)?'멸종위험 평가':'IUCN';
const stockLead = s => {const d=s.assessment.stock_decline,low=s.assessment.conservation_status?.mcui_role==='stock_decline_lower_bound';
  return `KOSIS 연근해 어획량이 ${stockChange(d)} 변해 자원 감소 신호(${d.label}) ${d.score.toFixed(0)}점이 ${low?'탐색적 구분선 이상이라, 멸종위험 평가가 없는 이 종의 MCUI 하한이':'멸종위험 근거보다 높아 MCUI가'} 되었습니다(${stockCompare(s)}). IUCN 평가가 아닙니다.`;};
// the 2015–2024 coastal catch as a small line: the two averaged windows lightly shaded, 2025p dashed for reference only
function stockSpark(d,rule){
  const ys=d.years,c=d.coastal_t.map(v=>v||0),ref=d.reference_2025p?.coastal_t,all=[...c,...(Number.isFinite(ref)?[ref]:[])];
  const W=264,H=74,L=6,R=34,T=8,B=16,max=Math.max(...all,1),n=ys.length,x=i=>L+i*(W-L-R)/n,y=v=>T+(H-T-B)*(1-v/max);
  const band=years=>{const i=ys.indexOf(years[0]),k=ys.indexOf(years.at(-1));return `<rect class="sd-win" x="${(x(i)-3).toFixed(1)}" y="${T-4}" width="${(x(k)-x(i)+6).toFixed(1)}" height="${H-T-B+8}" rx="3"/>`;};
  const pts=c.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last=`${x(n-1).toFixed(1)},${y(c[n-1]).toFixed(1)}`;
  const p25=Number.isFinite(ref)?`<polyline class="sd-ref" points="${last} ${x(n).toFixed(1)},${y(ref).toFixed(1)}"/><circle class="sd-refdot" cx="${x(n).toFixed(1)}" cy="${y(ref).toFixed(1)}" r="2.6"/><text x="${x(n).toFixed(1)}" y="${H-3}" text-anchor="middle">25p</text>`:'';
  return `<svg class="sd-spark${d.score!==null?' scored':''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="연근해 어획량 ${ys[0]}–${ys.at(-1)}년 ${c.map(v=>v.toLocaleString()).join(', ')}톤${Number.isFinite(ref)?`, 2025년 잠정치 ${ref.toLocaleString()}톤(점수 미사용)`:''}">`+
    band(rule.baseline_years)+band(rule.recent_years)+`<polyline class="sd-line" points="${pts}"/>${p25}`+
    `<text x="${x(0).toFixed(1)}" y="${H-3}">${ys[0]}</text><text x="${x(n-1).toFixed(1)}" y="${H-3}" text-anchor="middle">${ys.at(-1)}</text></svg>`;
}
// 4.12 (prereg-4.12-2026-10-14): the stock-decline block for the species detail and the data table's expanded row
function stockDeclineDetail(s,compact=false){
  const d=s.assessment?.stock_decline,rule=data.assessmentInfo?.method?.mcui_stock_decline;
  if(!d||!rule||s.assessment?.axis_errors?.MCUI)return '';
  const t=n=>Math.round(n).toLocaleString(), level=rule.match_levels?.[d.match_level]||d.match_level;
  const head=d.score===null?esc(d.label):`${esc(d.label)} · ${esc(d.score.toFixed(0))}점`;
  const compare=d.score===null?'':stockCompare(s);
  const body=d.match_level==='none'?`<p>KOSIS 어업생산동향조사에 이 종에 대응하는 품종이 없습니다. 점수를 매기지 않으며, 감소가 없다는 뜻이 아닙니다.</p>`:
    `<div class="sd-row">${stockSpark(d,rule)}<div><p class="sd-means">기준 평균 ${t(d.baseline_mean_t)}톤(${rule.baseline_years[0]}~${String(rule.baseline_years.at(-1)).slice(2)}) → 최근 평균 ${t(d.recent_mean_t)}톤(${rule.recent_years[0]}~${String(rule.recent_years.at(-1)).slice(2)}) <b>(${esc(stockChange(d))})</b></p>`+
    `<p class="fine">KOSIS 품종 ${esc(d.kosis_item)} · 연결 ${esc(level)}${d.capped_broader?' · 묶음 통계라 상한 '+esc(rule.broader_cap)+'점':''} · 최근 3년 양식 비중 ${esc(Number(d.aquaculture_share_recent_pct).toFixed(1))}%`+
    `${d.unscored_reason==='aquaculture_dominant'||d.unscored_reason==='small_catch'?' · 감소율은 참고로만 적고 점수를 매기지 않습니다':''} · 2025년 잠정치 ${Number.isFinite(d.reference_2025p?.coastal_t)?t(d.reference_2025p.coastal_t)+'톤':'없음'}(점수 미사용)</p></div></div>`;
  return `<div class="stock-decline${d.score!==null?' scored':''}"><h4><i class="sd-mark" aria-hidden="true">◆</i>자원 감소 신호 · KOSIS 어획량 추세 · <b>${head}</b></h4>`+
    (compare?`<p class="sd-compare">${esc(compare)}</p>`:'')+body+
    `<p class="fine">자원평가 결과: ${esc(rule.stock_assessment)}. ${esc(rule.caution)}${compact?'':' '+esc(rule.not_iucn)} ${verifiedSource(d.source_id,'KOSIS ↗')}</p></div>`;
}
// 3.4: OBIS reporting-rate check beside MCUI (figure stage 3: distribution recency, decline vs survey gap)
function occurrenceTrendDetail(s){
  const t=s.assessment?.occurrence_trend,rule=data.assessmentInfo?.method?.conservation?.trend;
  if(!t||!rule)return '';
  const p=rule.periods,n=t.species_records,e=t.effort_records,yr=x=>x.slice(0,4),f2=x=>Number(x).toFixed(2);
  const ratio=Number.isFinite(t.reporting_rate_ratio)?` · 보고율 비 ${f2(t.reporting_rate_ratio)} (95% 구간 ${f2(t.ci[0])}–${f2(t.ci[1])}) · 같은 강 기록 변화 ×${f2(t.effort_ratio)} · 전체 분류군 기준 민감도 ${f2(t.all_taxa_sensitivity?.reporting_rate_ratio)}`:'';
  const gain=t.mcui_base===null?0:Math.min(100,t.mcui_base+t.mcui_adjustment)-t.mcui_base;
  const paused=data.assessmentInfo?.method?.conservation?.effort_adjustment_suspended;
  const effect=t.class==='decline_signal'&&!t.mcui_adjustment&&paused?paused.note+(t.mcui_base===null?'':' MCUI에 더하거나 빼지 않았습니다.'):t.mcui_adjustment?(gain?`감소 신호라 MCUI ${t.mcui_base.toFixed(1)}에 +${gain}을 더했습니다.`:`감소 신호이지만 MCUI가 이미 상한 100이라 바뀌지 않았습니다.`)
    :t.mcui_base===null?'MCUI 기반 평가가 없어 이 결과로 MCUI를 만들지 않습니다.':'MCUI에 더하거나 빼지 않았습니다.';
  const tv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_trend;
  const checked=t.mcui_adjustment&&tv?.result==='failed'?`<p class="fine">추세 요소(+${esc(t.mcui_adjustment)}) 사후 검증: 기준 미충족. ${esc(tv.reason)}</p>`:'';
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
    checked+dataset+iucn+
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
// the BBVI cell, labelled 참고값(single-paper label); it stays out of scores.BBVI, the matrix, the map colours and every ranking (3.15–3.26).
const bbviReference = s => s.assessment?.withheld_reasons?.BBVI==='mbpi_single_source'&&referenceCombination(s)?s.assessment.reference_combination.value:null;
// 3.27 (team-lead decision 2026-10-03): a BBVI whose top MBPI item rests on one paper is a score, and its label travels with it
const bbviLabel = s => pilotScore(s,'BBVI')!==null&&s?.assessment?.bbvi_label?s.assessment.bbvi_label:null;
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
// Axis colours and names (species-card mini bars use them too).
const GAUGE_COLOUR={MFPI:'#0b7a74',MBPI:'#1f9fb8',MCUI:'#e07a3f',BBVI:'#173f62'}, GAUGE_NAME={MFPI:'식량',MBPI:'생리활성',MCUI:'보전 시급성',BBVI:'통합 활용'};
// Top of the species evidence: the use value (BBVI, built from MFPI and MBPI) and the conservation need (MCUI) as two cards
// that are never summed, the species' type and where it sits in the 2×2. Same values as the disclosures below, which stay
// the reference; held axes draw no bar and are never shown as 0.
const AXIS_QUAD=['low_bbvi_high_mcui','high_bbvi_high_mcui','low_bbvi_low_mcui','high_bbvi_low_mcui'];
function axisBar(v,cut,big){
  return `<span class="ax-bar${big?' big':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i>${Number.isFinite(cut)?`<b style="left:${cut}%"></b>`:''}</span>`;
}
// 4.14 (prereg-4.14-2026-10-14 9): BBVI and type at food weight 0.2 · 0.5 (official) · 0.8, from the unrounded inputs. A display
// of how much the composite leans on the weight, not a confidence interval.
const SENS_WEIGHTS=[.2,.5,.8];
function weightSensitivity(s){
  if(!VERIFIED.includes(s.assessment?.report_version)||pilotScore(s,'BBVI')===null)return null;
  return SENS_WEIGHTS.map(w=>{const raw=bbviRawAt(s,w);return {w,value:raw===null?null:round1(raw),type:raw===null?null:matrixTypeAt(s,raw)};});
}
function weightSensitivityLine(s){
  const rows=weightSensitivity(s);if(!rows)return '';
  const types=new Set(rows.map(r=>r.type));
  return `<p class="ax-note ax-sens">MFPI 가중치별 BBVI(탐색): ${rows.map(r=>`${r.w.toFixed(1)}${r.w===officialWeight()?'(공식)':''} ${scoreText(s,'BBVI',r.value)} ${esc(r.type?matrixTypePlain(r.type):'유형 미산출')}`).join(' · ')}`+
    ` · ${types.size>1?'가중치에 따라 유형이 바뀜':'세 가중치에서 유형 같음'} · 통계적 신뢰구간이 아님</p>`;
}
// species whose type differs between weights 0.2 · 0.5 · 0.8 (the method section count)
const weightTypeChanges=()=>(data?.species||[]).filter(s=>{const r=weightSensitivity(s);return r&&new Set(r.map(x=>x.type)).size>1;});
function axisCards(s){
  const rule=matrixRule(),type=matrixType(s),key=Object.entries(rule?.types||{}).find(([,t])=>t.id===type)?.[0];
  const held=k=>{const st=axisState(s,k),ref=k==='BBVI'?bbviReference(s):null;return `<span class="ax-held">${esc(ref!==null?'참고값 '+ref.toFixed(1)+' · 점수 아님':st.label)}</span>`;};
  const main=(k,cut)=>{const v=axisState(s,k).value;return v===null?held(k):`<strong class="ax-num">${scoreText(s,k,v)}</strong>${axisBar(v,cut,true)}`;};
  const sub=(k,name,note)=>{const v=axisState(s,k).value;
    return `<div class="ax-sub"><span>${name} <b>${k}</b></span>${v===null?held(k):`<strong>${scoreText(s,k,v)}</strong>${axisBar(v)}`}${note?`<small>${esc(note)}</small>`:''}</div>`;};
  const one=bbviLabel(s),mbpiNote=[mbpiStratumOf(s)?.short,basisNote(s,'MBPI').replace(/^ · /,'')].filter(Boolean).join(' · '),mfpiNote=s.assessment?.food_trace?.literature_moisture?.label||'';
  const mcuiNote=[consShort(s,true),axisState(s,'MCUI').value===null?'':mcuiBasisLabel(s)+(mcuiBacktest(s)?' · '+mcuiBacktest(s):'')].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · ');
  const chip=type?`<p class="ax-type" title="${esc(matrixPlainNote())}"><i style="background-color:${matrixTypeColour[type]}" aria-hidden="true"></i>${verdictWord(type)}<span class="ax-type-name">${esc(matrixTypeLabel(type))}</span></p>`
    :`<p class="ax-type none"><i aria-hidden="true"></i>${esc(untypedWhy(s))}</p>`;
  // where the species' cells sit on the value map: the cell colour is the first type in the cell, so it can differ from the species' own
  const cells=[...valueCellGroups(true).values()].filter(g=>g.species.has(s.aphiaID)),same=cells.filter(g=>cellMatrixType(g).type===type).length;
  // 2026-10-13: '활용 × 보전' opens on the species view (its own cells in its own colour); the all-species view keeps the cell rule
  const where=!cells.length?'':!type?`‘활용 × 보전’에서는 이 종의 공개 셀 ${cells.length}개를 회색(유형 미산출)으로 칠합니다. 유형이 없어 ‘모든 종 겹쳐 보기’의 셀 색은 정하지 않습니다.`
    :`‘활용 × 보전’에서는 이 종의 공개 셀 ${cells.length}개를 이 색으로 칠합니다. `+(same===cells.length?'‘모든 종 겹쳐 보기’에서도 모두 이 색입니다.'
      :same?`‘모든 종 겹쳐 보기’에서는 그중 ${same}개가 이 색이고, 나머지는 같은 셀에 있는 우선순위가 높은 유형의 색입니다.`
      :'‘모든 종 겹쳐 보기’에서는 모두 같은 셀에 있는 우선순위가 높은 유형의 색입니다.');
  const quad=`<span class="ax-quad" aria-hidden="true">${AXIS_QUAD.map(q=>{const id=rule?.types?.[q]?.id;return `<i class="${q===key?'on':''}" style="background-color:${matrixTypeColour[id]||'#b7c0ca'}"></i>`;}).join('')}</span>`;
  return `<section class="axis-cards" aria-label="두 축 요약 · 아래 지표 칸과 같은 값">${chip}`+
    `<div class="ax-card"><div class="ax-head"><h3>활용가치 <b>BBVI</b> <small class="ax-nature">탐색적 합성지표</small></h3><small>${rule?'탐색적 구분선 '+rule.bbvi_threshold+' · ':''}w = ${bbviWeight.toFixed(2)}</small></div>`+
      `<div class="ax-main">${main('BBVI',rule?.bbvi_threshold)}</div>${evidenceProfileText(s)?`<p class="ax-note ax-evidence">${esc(evidenceProfileText(s))}</p>`:one?`<p class="ax-note">${esc(one)}</p>`:''}${officialNote(s)?`<p class="ax-note">탐색 보기(${esc(weightPair())}) · ${esc(officialNote(s))}</p>`:''}${weightSensitivityLine(s)}`+
      sub('MFPI','식량',mfpiNote)+sub('MBPI','생리활성',mbpiNote)+'</div>'+
    '<p class="ax-sep"><span>합치지 않고 따로 봅니다</span></p>'+
    `<div class="ax-card"><div class="ax-head"><h3>보전 시급성 <b>MCUI</b></h3><small>${rule?'탐색적 구분선 '+rule.mcui_threshold:''}</small></div>`+
      `<div class="ax-main">${main('MCUI',rule?.mcui_threshold)}</div>${mcuiNote?`<p class="ax-note">${esc(mcuiNote)}</p>`:''}</div>`+
    (rule?`<div class="ax-where">${quad}<p>${esc(where||'이 종은 지금 보는 기간에 공개 셀이 없습니다.')}</p></div>`:'')+'</section>';
}

// 2026-10-12: the MBPI section opens with one line: the post-hoc result and the aggregation range as published (nothing
// recomputed), then the stratum of the scored item. The reason paragraph and the aggregation line below stay as they were.
function mbpiFirstLine(s){
  const a=s.assessment, bv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI, r=validationResult('MBPI');
  const range=a.sensitivity?.range_from_aggregation, st=mbpiStratumOf(s), k=mbpiKindOf(s);
  const parts=[r&&bv?`사후 검증 ${r==='passed'?'통과':'기준 미충족'}(약물 기원종 ${bv.n}종 중 ${bv.computed}종 계산)`:'',
    Array.isArray(range)&&range.length===2?(range[0]===range[1]?`집계 방식에 따라 바뀌지 않음(항목 ${(a.bioactivity_trace||[]).length}개)`:`집계 방식에 따라 ${range.join('–')}`):''].filter(Boolean);
  return parts.length||st?`<p class="fine mbpi-first">${parts.length?`<b>${esc(parts.join(' · '))}</b>`:''}${st?`${parts.length?'<br>':''}근거 층: ${esc(st.long)}`:''}${k?`<br>근거 종류: ${esc(k.long)} · ${esc(mbpiKindShare(k))}`:''}</p>`:'';
}
// 4.10: one line under the MBPI section for the secondary MBPI-Rx (mbpiRxOf); it opens to the published post-hoc reason, the
// classification criterion and the pre-registration. A null value reads 없음 with the published reason, never 0.
function mbpiRxLine(s){
  const r=mbpiRxOf(s), rule=data.assessmentInfo?.method?.mbpi_rx, v=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI_RX;
  if(!r)return '';
  const check=['passed','failed'].includes(v?.result)?`사후 검증 ${v.result==='passed'?'통과':'기준 미충족'}(탐색적 재검토)`:'';
  const head=[r.value===null?'의약 표적 근거 없음':r.value.toFixed(1)+' · '+r.stratum.short,check].filter(Boolean).join(' · ');
  return `<details class="score-disclosure rx-disclosure"><summary><span>${esc(rule.label)}</span><b>${esc(head)}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">MBPI와 같은 규칙으로 모으되 ${esc(rule.excluded_label)} 층의 항목은 뺀 값입니다(이 종에서 뺀 항목 ${esc(s.assessment.mbpi_rx.excluded_item_count)}개). 남는 항목이 없으면 0점 하한값 대신 '의약 표적 근거 없음'으로 둡니다. 기본 MBPI·BBVI·매트릭스에는 쓰지 않습니다.</p>`+
    (r.value===null?`<p class="fine">${esc(r.reason)}.</p>`:`<p class="fine">근거 층: ${esc(r.stratum.long)}</p>`)+
    `<p class="fine">층 분류 기준: ${esc(rule.criterion)}</p>`+
    (check&&v.reason?`<p class="fine">사후 검증(약물 기원종 ${esc(v.n)}종 중 ${esc(v.computed)}종 계산): ${esc(v.reason)}</p>`:'')+
    `<p class="fine">사전 등록: ${esc(rule.prereg)}</p></div></details>`;
}
// 4.11 (prereg 4): MBPI is the maximum over items, so the spread of the scored items is shown beside it, display only.
function mbpiBreadthLine(s){
  const b=s.assessment?.mbpi_breadth, rule=data.assessmentInfo?.method?.mbpi_breadth;
  if(!b||!rule||!b.item_count||pilotScore(s,'MBPI')===null)return '';
  // 4.14 (prereg-4.14-2026-10-14 8): independent papers, max and mean, and each item's material class (display only)
  const more=Number.isInteger(b.independent_paper_count);
  const head=`항목 ${b.item_count}개${more?` · 독립 논문 ${b.independent_paper_count}편`:''} · 중앙값 ${Number(b.median).toFixed(1)}${more?` · 최댓값 ${Number(b.max).toFixed(1)} · 평균 ${Number(b.mean).toFixed(1)}`:''} · 상위 2개 평균 ${Number(b.top2_mean).toFixed(1)}`;
  const mats=more?Object.entries(b.material_counts||{}).map(([k,n])=>`${MATERIAL_KO[k]||k} ${n}개`).join(' · '):'';
  return `<details class="score-disclosure breadth-disclosure"><summary><span>${esc(rule.label)} · 탐색적</span><b>${esc(head)}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">MBPI는 점수 항목 중 가장 높은 값이라, 시험된 항목이 많은 종일수록 높게 나오기 쉽습니다(4.10에서 항목 수와 MBPI의 순위상관 0.64). 그래서 점수 항목 전체의 중앙값과 상위 두 항목 평균을 함께 보입니다. 기본 MBPI·BBVI·매트릭스·순위에는 쓰지 않습니다.</p>`+
    (more?`<p class="fine">독립 논문 수는 모든 점수 항목의 원논문과 쓰인 재현 논문의 DOI를 합친 수입니다. 같은 논문이 여러 데이터베이스·여러 표적에 있어도 1편으로 셉니다(상위 2개 평균은 같은 논문의 두 항목일 수 있습니다).</p>`+
      (mats?`<p class="fine">소재 구분: ${esc(mats)}. 원문 시료 기술로 나눈 표시용 구분이며 점수에 쓰지 않습니다. 가수분해물 서열의 합성품이나 합성 유도체는 종에서 바로 얻은 물질이 아닙니다.</p>`:'')+
      `<p class="fine">${b.floor_zero?'근거가 없어 준 하한 0(측정값 아님)입니다.':'근거가 없어 주는 하한 0(4.3)을 받지 않았습니다.'}${b.measured_zero_items?` 측정했으나 비교집단 맨 아래(백분위 0)인 항목 ${b.measured_zero_items}개는 근거 없음과 다른 실제 측정값입니다.`:''} 시험관·세포 시험 결과이며 치료 효과·식품 안전성·제품 가치를 뜻하지 않습니다.</p>`:'')+
    `<p class="fine">사전 등록: ${esc(rule.prereg)}</p></div></details>`;
}
// 4.14: the material classes of mbpi-material-4.14 (display words only)
const MATERIAL_KO={natural_isolate:'종에서 분리한 물질',hydrolysate_purified:'가수분해·발효물에서 정제한 펩타이드',hydrolysate_sequence_synthetic:'가수분해물 서열의 합성품',
  hydrolysate_unspecified:'가수분해물 유래(정제·합성 미기재)',native_sequence_synthetic:'유전자 서열(천연 펩타이드)의 합성품',synthetic_derivative:'합성 유도체',symbiont_derived:'공생미생물 유래'};
function renderVerifiedIndices(s){
  const a=s.assessment;
  const names={MFPI:'식량 가능성',MBPI:'생리활성',MCUI:'보전 평가',BBVI:'통합 활용'};
  const mv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MFPI;
  const bv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI;
  // 3.27: the drug-origin check is computed; its result and reason open the MBPI section, as the MFPI scope note does
  const mbpiScope=validationResult('MBPI')&&bv?.reason?`<p class="fine">사후 검증(약물 기원종 ${esc(bv.n)}종 중 ${esc(bv.computed)}종 계산): ${validationResult('MBPI')==='passed'?'통과':'기준 미충족'}. ${esc(bv.reason)}</p>`:'';
  const mfpiScope=validationResult('MFPI')==='passed'&&mv?`<p class="fine">방법 검증: RDA 값과 같은 종의 일본 식품성분표 2020 값으로 각각 계산한 영양 순위를 ${esc(mv.n)}종에서 비교했습니다(Spearman ρ ${esc(mv.spearman_rho)}, 단측 p ${esc(mv.permutation_p_one_sided)}). 성분표에 따라 순위가 바뀌는지만 본 것이며, 이 종의 값이나 가중치를 따로 검증한 것은 아닙니다.</p>`:'';
  const bodies={MFPI:mfpiScope+verifiedFoodDetail(s),MBPI:mbpiFirstLine(s)+evidenceProfileBlock(s)+mbpiScope+verifiedBioDetail(s),MCUI:verifiedConservationDetail(s)+verifiedNationalFact(s)+stockDeclineDetail(s)+occurrenceTrendDetail(s),
    BBVI:'<p>기본 BBVI = w × MFPI + (1−w) × MBPI. MCUI는 별도 축입니다. 화면에서 w를 바꾸어도 고정 비교집단은 바뀌지 않습니다. MFPI만 보는 “식량 전용”과 MBPI만 보는 “생리활성 전용”은 기본 BBVI와 다른 보기입니다.</p>'+
      (a.mbpi_floor?'<p class="fine">BBVI '+esc(bbviLabel(s)||'')+': MBPI가 하한값 '+esc(a.mbpi_floor.value)+'점이라 BBVI = w × MFPI + (1−w) × '+esc(a.mbpi_floor.value)+'입니다. '+esc(a.mbpi_floor.meaning)+' 규칙을 채우는 MBPI 근거가 생기면 그 값으로 바뀝니다.'+(assessedForMatrix(s)?' 매트릭스에서는 회색 테두리의 빈 점입니다.':'')+'</p>':
       bbviLabel(s)?'<p class="fine">BBVI '+esc(bbviLabel(s))+': MBPI 최상위 항목을 다른 연구팀이 같은 종 시료로 재현한 논문이 아직 없습니다'+(bestBio(a)?.stratum_kind==='chembl'?'(ChEMBL 항목은 종 연결 원논문과 활성 문서 중 적은 쪽이 1편)':'')+(evProfile(s)?'. 그 종의 근거 양과는 다른 표시입니다('+esc(evidenceProfileText(s))+')':'')+'. MBPI에는 이 근거 계수('+esc(bestBio(a)?.evidence_factor)+')가 이미 곱해져 있습니다. 팀장 결정(2026-10-03)에 따라 '+(assessedForMatrix(s)?'점수·매트릭스·지도에 쓰되 이 표시를 붙이고, 독립 논문 재현이 확인되면 표시를 뗍니다. 매트릭스에서는 속이 빈 점입니다.':'점수로 쓰되 이 표시를 붙이고, 독립 논문 재현이 확인되면 표시를 뗍니다. '+(pilotScore(s,'MCUI')===null?'MCUI가 없어 ':'')+'매트릭스·지도 색에는 들어가지 않습니다.')+'</p>':'')+referenceCombination(s)};
  const surveyWhy=surveyReasonText(a);
  const unexplored=(a.priority_survey?`<p class="pending">우선 조사 대상 · ${surveyWhy}. 점수와 섞지 않는 별도 표시입니다.</p>`:'')+
    (a.unexplored_candidate?`<p class="pending">미탐색 후보: ${esc(unexploredLine(a.unexplored_candidate))}. 기본 가중치 w = 0.5 기준이며, 이 종의 점수는 추정하지 않습니다.</p>`:'');
  return `<section class="verified-scores"><h3>실제 원자료 기반 ${released()?'정식 산출':'시범 지표'}${esc(validationNote(data.assessmentInfo))}</h3>`+
    `<p class="fine">자료 스냅샷 ${esc(data.assessmentInfo?.generatedAt?.slice(0,10))} · 방법론 ${esc(data.assessmentInfo?.version)} · MFPI·MBPI·MCUI는 각각 독립적으로 판정합니다. `+
    `숫자는 종 단위 연구용 지표이며 지도 셀이나 해역에 전가하지 않습니다.</p>`+
    ` ${Object.keys(names).map(key=>{
      const st=axisState(s,key),value=st.value,reason=a.withheld_reasons?.[key];
      const label=key==='MCUI'&&value!==null&&separateMcui(s)?' · '+mcuiBasisLabel(s):'';
      const note=axisStateNote[st.kind];
      return `<details class="score-disclosure" data-axis="${key}"><summary><span>${esc(key)} · ${esc(names[key])}</span>`+
        `<b>${value===null?(key==='BBVI'&&!note&&bbviReference(s)!==null?`참고값 ${esc(bbviReference(s).toFixed(1))} · ${esc(a.mbpi_label||'최상위 근거 독립 재현 확인 중')} · 점수 아님`:key==='MCUI'&&!note&&mcuiReference(s)?`${esc(st.label)} · ${mcuiReference(s).basis==='range_state'?`다른 나라 평가 참고 ${esc(mcuiReference(s).record?.country_ko||'')} ${esc(mcuiReference(s).record?.category_as_published||mcuiReference(s).category)}`:`자체 예비검토 참고(공식 평가 아님${rapidLcCheck()?' · '+rapidLcCheck():''})`} · 점수 아님`:esc(st.label)):scoreText(s,key,value)+' · '+axisLabel(s,key)+(key==='MBPI'&&a.mbpi_label?' · '+esc(a.mbpi_label):'')+(key==='MBPI'&&mbpiStratumOf(s)?' · '+esc(mbpiStratumOf(s).short):'')+(key==='BBVI'&&bbviLabel(s)?' · '+esc(bbviLabel(s)):'')+label}</b></summary>`+
        `<div class="score-disclosure-body">${note?`<p class="pending">${esc(note)}</p>`:value===null?`<p class="pending">${esc(scoreReason[reason]||reason||'산출 보류')}</p>`:''}`+
        `${note?'':bodies[key]}${key==='MFPI'&&value!==null?'<p class="fine">산식: 동기준 영양 백분위 × 신뢰도 계수 80% + 가식부 비율 10% + 양식 근거 10%. 이 비중과 계수는 '+(released()?'팀이 정한 고정 규칙':'팀의 시범 규칙')+'입니다.</p>':''}`+
        `</div></details>`+(key==='MBPI'?mbpiRxLine(s)+mbpiBreadthLine(s)+supplementaryLine(s):'');
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
  if(view==='compare'){if(data)syncComparison();loadCompareStops();requestAnimationFrame(declutterPointLabels);}
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
// An AMP item names its bacterium, not the strain; the strain of each adopted MIC row says whether it is a resistant one
// (Cg-BigDef1 was measured on four MRSA isolates as well as on susceptible S. aureus).
const RESISTANT=/resistan|MRSA|VRE|MDR/i;
const resistantRows=t=>t.stratum_kind==='amp'?(t.measurements||[]).filter(m=>RESISTANT.test(m.target_strain||'')):[];
// An MBPI item takes the first drug trait whose rule matches (the precedence the 3.12 counts were checked with);
// a trait with a parent (내성균 under 항균) is counted under its parent as well.
// 2026-10-12: 혈압(ACE 저해) and 항산화 sit in their own row, '기능성(식품 소재)': the ACE stratum ranks food-protein
// antihypertensive peptides, and the 항산화 rows are display-only literature values. Only the group moved; the array order
// (traitIdsOf takes the first matching chip), ids, rules and link parameters (u=ace) are unchanged.
const USE_GROUPS=['신약','기능성(식품 소재)','식량'];
const useGroupLabel = g => {const i=g.indexOf('(');return i<0?esc(g):esc(g.slice(0,i))+'<small>'+esc(g.slice(i))+'</small>';};
const USE_TRAITS=[
  {id:'ace',group:'기능성(식품 소재)',label:'혈압(ACE 저해)',match:t=>t.stratum_kind==='peptide'||/wijesinghe|ACE/i.test(t.stratum_id||'')||/angiotensin/i.test(targetText(t))},
  {id:'virus',group:'신약',label:'바이러스',match:t=>/virus|SARS|HIV|dengue|influenza/i.test(targetText(t))},
  {id:'dementia',group:'신약',label:'치매 관련 효소',match:t=>/cholinesterase|beta-secretase/i.test(targetText(t))},
  {id:'parasite',group:'신약',label:'기생충',match:t=>/Trypanosoma|Plasmodium|Leishmania|Toxoplasma|Schistosoma|Giardia/i.test(targetText(t))},
  {id:'cancer',group:'신약',label:'항암',match:t=>t.stratum_kind==='anticancer'||t.target_type==='CELL-LINE'},
  {id:'microbe',group:'신약',label:'항균',match:t=>t.stratum_kind==='amp'||t.target_type==='ORGANISM'&&BACTERIA.test(targetText(t))},
  {id:'resistant',group:'신약',label:'내성균',parent:'microbe',match:t=>t.target_type==='ORGANISM'&&RESISTANT.test(targetText(t))||resistantRows(t).length>0},
  {id:'fungus',group:'신약',label:'항진균',match:t=>t.target_type==='ORGANISM'&&FUNGI.test(targetText(t))},
  {id:'pain',group:'신약',label:'진통',match:t=>/opioid receptor|TRPV1|cyclooxygenase/i.test(targetText(t))},
  {id:'antioxidant',group:'기능성(식품 소재)',label:'항산화',match:t=>/DPPH|ABTS|radical/i.test(targetText(t))},
  {id:'diabetes',group:'신약',label:'항당뇨',match:t=>/glucosidase|dipeptidyl peptidase|PTP1B|phosphatase non-receptor type 1\b|amylase/i.test(targetText(t))},
  {id:'protein_g',group:'식량',label:'고단백'},
  {id:'mineral',group:'식량',label:'미네랄'},
  {id:'calcium_mg',group:'식량',label:'칼슘'},
  {id:'iron_mg',group:'식량',label:'철분'},
  {id:'zinc_mg',group:'식량',label:'아연'},
  {id:'omega3',group:'식량',label:'오메가-3'},
  {id:'whole',group:'식량',label:'가식부 100%'},
  {id:'farmed',group:'식량',label:'양식 가능'},
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
  mineral:['미네랄','무기질'],
  calcium_mg:['칼슘','calcium'],
  iron_mg:['철','철분','iron'],
  zinc_mg:['아연','zinc'],
  omega3:['오메가-3','오메가3','오메가','omega','omega-3','dha','epa','불포화지방'],
  whole:['가식부','통째로','폐기율','버릴것없는'],
  farmed:['양식','양식가능','aquaculture'],
};
// Chips combine with AND: a species stays only when it has evidence for every chip that is on (insertion order kept,
// so the last chip turned on is the one the empty-result button turns off).
let activeUses=new Set(), useReturn=null; // useReturn {from,to,period,view}: the screen a chip moved the selection away from
const traitById=id=>USE_TRAITS.find(c=>c.id===id);
// ChEMBL items carry a link review; peptide and reviewed-compound items are adopted by their stratum.
const isAdopted=t=>t.link_review===undefined||t.link_review==='accepted';
function traitIdsOf(t){
  const first=USE_TRAITS.find(c=>c.match&&!c.parent&&c.match(t));
  return first?[first.id,...USE_TRAITS.filter(c=>c.parent===first.id&&c.match(t)).map(c=>c.id)]:[];
}
const overClaim=(a,id)=>{const v=a.food_trace?.nutrients?.[id];return v&&Number.isFinite(v.value)&&v.value>=CLAIM_REF[id]*CLAIM_SHARE[id]?v:null;};
const nutrientLine=(v,id)=>`${num(v.value)} ${v.unit||''}/100 g · 기준 ${num(Math.round(CLAIM_REF[id]*CLAIM_SHARE[id]*100)/100)} 이상${v.substitute?' · '+v.substitute.label:''}`;
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
    // 가식부·양식 칩은 MFPI에 이미 들어간 가식부 비율과 양식 사례 기록을 그대로 보여줄 뿐, 점수를 바꾸지 않는다.
    if(id==='whole'){const ef=a.food_trace?.edible_fraction;return ef&&ef.value===1?{text:`가식부 100%(폐기율 0%) · 출처 ${ef.record_id}`,score:pilotScore(s,'MFPI')}:null;}
    if(id==='farmed'){const q=a.food_trace?.aquaculture;return q&&q.feasible===true&&q.reviewed===true?{text:`양식 사례 있음 · 출처 ${q.source_id}`,score:pilotScore(s,'MFPI')}:null;}
    const hits=(id==='mineral'?Object.keys(MINERALS):[id]).map(k=>[k,overClaim(a,k)]).filter(([,v])=>v);
    return hits.length?{text:hits.map(([k,v])=>(MINERALS[k]||'단백질')+' '+nutrientLine(v,k)).join(' · '),score:pilotScore(s,'MFPI')}:null;
  }
  const hits=a.axis_errors?.MBPI||pilotScore(s,'MBPI')===null?[]
    :(a.bioactivity_trace||[]).filter(t=>isAdopted(t)&&traitIdsOf(t).includes(id)).sort((x,y)=>y.adjusted-x.adjusted);
  if(!hits.length)return displayEvidence(s,id);
  const t=hits[0], m=(t.measurements||[])[0]||{};
  if(id==='resistant'&&resistantRows(t).length){
    const r=resistantRows(t), v=r.map(x=>x.value), lo=Math.min(...v), hi=Math.max(...v);
    return {text:`항균 펩타이드 ${t.peptide_name||t.peptide_sequence} · ${t.target_species} 내성 균주 ${r.length}개 MIC ${lo===hi?num(lo):num(lo)+'–'+num(hi)} ${r[0].unit} · 근거 ${hits.length}건`,score:pilotScore(s,'MBPI')};
  }
  const what=t.stratum_kind==='anticancer'?`항암 펩타이드 ${t.peptide_name||t.peptide_sequence} · ${t.cell_line} IC50 ${t.measurements.length>1?`${num(10**(6-t.pIC50))} ${m.unit} (노출 ${t.measurements.length}개 중앙값)`:`${num(m.value)} ${m.unit}`}`
    :t.stratum_kind==='amp'?`항균 펩타이드 ${t.peptide_name||t.peptide_sequence} · ${t.target_species} MIC ${t.measurements.length>1?`${num(10**(6-t.pMIC))} ${m.unit} (균주 ${t.measurements.length}개 중앙값)`:`${m.value} ${m.unit}`}`
    :t.stratum_kind==='peptide'?`펩타이드 ${t.peptide_sequence} · ACE IC50 ${peptideValue(m)}`
    :t.stratum_kind==='chembl'?`${t.compound_name||t.compound_id} · ${t.target_name} ${t.standard_type} pChEMBL ${t.median_pchembl}`
    :`${m.compound_name||t.compound_id||'화합물'} · ACE IC50 ${m.raw_value??''} ${m.raw_unit||''}`;
  return {text:`${what} · 근거 ${hits.length}건`,score:pilotScore(s,'MBPI')};
}
// A literature value outside every score, shown only when no adopted MBPI item reaches the chip. The lowest value of the
// species' rows in the first row's unit leads; the line says it is not a score.
function displayEvidence(s,id){
  const rows=traitDisplay.get(s.aphiaID+'|'+id);if(!rows?.length)return null;
  // a % response (in vivo inhibition) leads with the highest value, a concentration with the lowest
  const t=[...rows].filter(r=>r.unit===rows[0].unit).sort((x,y)=>/%/.test(rows[0].unit)?y.value-x.value:x.value-y.value)[0];
  return {text:`${t.tier==='extract'?'추출물 · ':''}${t.name} · ${t.assay} ${t.endpoint} ${num(t.value)} ${t.unit} · 시험값 ${rows.length}개(doi ${t.doi}) · 표시 전용, 점수 미반영`,score:null,display:true};
}
const hasExtractRow=id=>(data?.species||[]).some(s=>traitDisplay.get(s.aphiaID+'|'+id)?.some(r=>r.tier==='extract'));
const displayOnly=id=>{const e=(data?.species||[]).map(s=>useEvidence(s,id)).filter(Boolean);return e.length>0&&e.every(x=>x.display);};
const useCount=id=>(data?.species||[]).filter(s=>useEvidence(s,id)).length;
const hasAll=(s,ids)=>ids.every(id=>useEvidence(s,id));
const useMatch=s=>hasAll(s,[...activeUses]);
// Species left if this chip were on together with the current ones; for a chip that is on, the current result.
const useLeft=id=>(data?.species||[]).filter(s=>hasAll(s,[...activeUses,id])).length;
// Results lead with the first chip's own axis (신약 → MBPI, 식량 → MFPI); species without that score keep their order last.
// 4.14 (prereg-4.14-2026-10-14 8): a trait chip filters only. The list keeps its own order and is never re-ranked by MFPI or
// MBPI, whose values sit in different cohorts and strata.
function useSorted(list){return list;}
// A chip's state comes from its own count, so a grey chip activates as soon as adopted evidence matches it.
// With chips on, the badge says what adding it would leave; a chip that would leave none is faded but still clickable.
function traitChip(c,n){
  const on=activeUses.has(c.id), left=n&&activeUses.size?useLeft(c.id):n;
  const title=!n?'채택된 근거가 아직 없습니다':activeUses.size&&!on?`지금 선택에 더하면 ${left}종(모두 만족)`
    :displayOnly(c.id)?`문헌 근거(표시 전용, 점수 미반영)가 있는 ${n}종`:`채택된 근거가 있는 ${n}종`;
  return `<button type="button" class="use-chip${n?'':' gap'}${on?' on':''}${n&&!left?' zero':''}" data-use="${c.id}"${n?` aria-pressed="${on}"`:' disabled'} title="${title}">${on?'✓ ':''}${esc(c.label)} <b>${n?left+'종':'0종 · 근거 수집 전'}</b></button>`;
}
function renderUseChips(){
  const box=$('use-chips');if(!box||!data)return;
  const focus=box.contains(document.activeElement)?document.activeElement.dataset.use:null;
  box.innerHTML='<p class="use-title">활용 특성으로 찾기 · 여러 개를 켜면 모두 만족하는 종</p>'+USE_GROUPS.map(g=>`<div class="use-row" role="group" aria-label="${esc(g)} 활용 특성"><span class="use-group">${useGroupLabel(g)}</span><span class="use-row-chips">`+
    USE_TRAITS.filter(c=>c.group===g).map(c=>traitChip(c,useCount(c.id))).join('')+'</span></div>').join('');
  box.querySelectorAll('[data-use]:not([disabled])').forEach(b=>b.addEventListener('click',()=>toggleUse(b.dataset.use)));
  if(focus)box.querySelector(`[data-use="${focus}"]`)?.focus(); // keyboard toggling keeps its place
}
const toggleUse=id=>setUses(activeUses.has(id)?[...activeUses].filter(x=>x!==id):[...activeUses,id]);
// The occurrence map draws one species, so when the selected species drops out of the result the top result is
// selected; clearing every chip returns to the species, period and map view from before, unless the user picked
// another species meanwhile.
function setUses(ids){
  activeUses=new Set(ids.filter(id=>traitById(id)&&useCount(id)));
  renderUseChips();
  const first=useSorted((data?.species||[]).filter(useMatch))[0];
  if(first&&mapMode==='value')lastFitted=null; // fit the result cells; an empty result leaves the map where it is
  if(first&&selected&&!useMatch(selected)){
    useReturn={...(useReturn||{from:selected.aphiaID,period:periodFilter,view:map&&[map.getCenter(),map.getZoom()]}),to:first.aphiaID};
    return selectSpecies(first.aphiaID);
  }
  if(!activeUses.size&&useReturn){
    const r=useReturn;useReturn=null;
    if(selected?.aphiaID===r.to){lastFitted=r.from;selectSpecies(r.from);periodFilter=r.period;if(r.view)map.setView(...r.view,{animate:false});renderMap();writeHash();return;}
  }
  renderList();
  if(mapMode==='value')renderMap();
  writeHash();
}
// Search words that name a trait ("혈압", "항암", "DHA") show its chip, or say it has no adopted evidence yet.
// Other words only search names.
const termHit=(words,q)=>words.some(w=>w===q||(q.length>1&&w.startsWith(q)));
function useSuggestion(query){
  const raw=query.trim(), q=raw.toLowerCase();if(!q)return '';
  const c=USE_TRAITS.find(c=>termHit(TRAIT_SYNONYMS[c.id]||[],q));
  if(c){
    if(activeUses.has(c.id))return '';
    const n=useCount(c.id);
    return n?`<button type="button" class="use-suggest" data-use-suggest="${c.id}">‘${esc(raw)}’ → <b>${esc(c.group)} · ${esc(c.label)}</b> ${n}종 보기</button>`
      :`<p class="use-suggest gap">‘${esc(raw)}’ → ${esc(c.group)} ${traitChip(c,0)} 채택된 근거가 아직 없어 선택할 수 없습니다.</p>`;
  }
  return '';
}
const useRule=c=>c.id==='protein_g'?`식약처 영양성분 강조표시 ‘고/풍부’ 기준(100 g당 1일 기준치의 ${Math.round(CLAIM_SHARE.protein_g*100)}%) 이상`
    :c.id==='mineral'?`칼슘·철·아연 중 하나 이상이 식약처 ‘고/풍부’ 기준(100 g당 1일 기준치의 ${Math.round(CLAIM_SHARE.calcium_mg*100)}%) 이상`
    :MINERALS[c.id]?`${MINERALS[c.id]}이 식약처 ‘고/풍부’ 기준(100 g당 1일 기준치의 ${Math.round(CLAIM_SHARE[c.id]*100)}%, ${num(Math.round(CLAIM_REF[c.id]*CLAIM_SHARE[c.id]*100)/100)} mg) 이상`
    :c.id==='whole'?'보고서에 채택된 가식부 비율이 100%(폐기율 0%)인 종. MFPI의 가식부 항목과 같은 값이며, 칩은 보여주기만 합니다'
    :c.id==='farmed'?'보고서에 채택·검토된 양식 사례 기록이 있는 종(MFPI의 양식 가능성 항목과 같은 근거). 현재 국내 상업 양식 여부나 경제성을 뜻하지 않습니다'
    :c.id==='omega3'?`EPA+DHA가 1일 기준치(330 mg)의 ${Math.round(OMEGA_SHARE*100)}% 이상(100 g당). 오메가-3에는 식약처 함량강조표시 기준이 없어 팀 표시 기준이며, 점수에는 쓰지 않습니다`
    :displayOnly(c.id)?(hasExtractRow(c.id)?'이 종에서 나온 단일 화합물·펩타이드의 문헌 시험값이며, 단일 물질 근거가 없는 종은 추출물·분획 시험값입니다(‘추출물’ 표시, 팀장 결정 2026-10-04). ':'이 종에서 나온 단일 화합물·펩타이드의 문헌 시험값입니다. ')+'팀장 결정(2026-10-03)에 따른 표시 전용 근거로 점수·매트릭스·지도 색에는 쓰지 않으며 효능 판정이 아닙니다'
    :'보고서에 채택된 MBPI 근거의 시험 표적 기준이며 효능 판정이 아닙니다';
// A food chip hides species with a measured value under the claim line apart from species with no value at all.
const measured=(s,id)=>{const a=s.assessment;if(!a||pilotScore(s,'MFPI')===null)return false;if(id==='omega3')return Number.isFinite(a.food_trace?.display_fatty_acids?.sum_mg);if(id==='whole')return Number.isFinite(a.food_trace?.edible_fraction?.value);if(id==='farmed')return a.food_trace?.aquaculture?.reviewed===true;return (id==='mineral'?Object.keys(MINERALS):[id]).some(k=>Number.isFinite(a.food_trace?.nutrients?.[k]?.value));};
function hiddenLine(on,shown,base){
  const hidden=base.filter(s=>!shown.includes(s)),below=hidden.filter(s=>on.every(c=>useEvidence(s,c.id)||(c.group==='식량'&&measured(s,c.id)))).length;
  return `<p>숨김 ${hidden.length}종: ${below?`기준 미달 ${below}종 · `:''}근거 미확인 ${hidden.length-below}종(가치가 낮다는 뜻 아님).</p>`;
}
// shown/base: species lists after the chips and before them (name, group and evidence filters already applied).
function useNote(shown,base){
  if(!activeUses.size)return '';
  const on=[...activeUses].map(traitById), last=on.at(-1);
  const pills=on.map(c=>`<button type="button" class="use-pill" data-use-off="${c.id}" aria-label="${esc(c.label)} 해제">${esc(c.label)} <span aria-hidden="true">✕</span></button>`).join(' × ');
  const undo=shown.length?'':`<p class="use-empty">선택한 조건을 모두 만족하는 종이 없습니다. <button type="button" class="text-button" data-use-off="${last.id}">‘${esc(last.label)}’ 끄기 → ${base.filter(s=>hasAll(s,on.slice(0,-1).map(c=>c.id))).length}종</button></p>`;
  return `<div class="use-note"><p class="use-sum">${pills} <b>${shown.length}종</b> <button type="button" class="text-button" data-use-clear>전체 해제</button></p>${undo}`+
    on.map(c=>`<p><b>${esc(c.group)} · ${esc(c.label)}</b> ${useRule(c)}.</p>`).join('')+
    hiddenLine(on,shown,base)+'</div>';
}
// Every trait the species has evidence for, the chips that are on in bold.
const traitTags=s=>USE_TRAITS.filter(c=>useEvidence(s,c.id)).map(c=>activeUses.has(c.id)?`<b>${esc(c.label)}</b>`:esc(c.label)).join(' · ');
// Result cards always carry conservation and the matrix type, so a trait filter never shows use alone.
function useCardLine(s){
  if(!activeUses.size)return '';
  const mc=pilotScore(s,'MCUI'), t=matrixType(s);
  return `<span class="use-line">${[...activeUses].map(id=>esc(useEvidence(s,id)?.text||'')).join('<br>')}<br>활용 특성: ${traitTags(s)}<br>MCUI ${mc===null?'미산출':mc.toFixed(1)}${consShort(s)?' ('+esc(consShort(s,true))+')':''} · 매트릭스 유형 ${t?esc(matrixTypeLabel(t)):esc(untypedWhy(s))}</span>`;
}

// Four axis values on every card ('–' = withheld, never 0), so the list can be scanned without opening a species.
const cardScores=s=>s.assessment?'<span class="card-scores">'+['MFPI','MBPI','MCUI','BBVI'].map(k=>{const n=axisState(s,k).value;
  const one=k==='BBVI'&&bbviLabel(s);
  return `<i class="${n===null?'held':one?'single':''}" title="${GAUGE_NAME[k]}${one?' · '+esc(one):''}"><small>${k}</small>${n===null?(k==='MCUI'&&consShort(s)?`<span class="held-word" title="${esc(consShort(s,true))}">미확인</span>`:'–'):scoreText(s,k,n)}${one?'<span class="sr-only"> '+esc(one)+'</span>':''}</i>`;}).join('')+
  // the MBPI's stratum on its own line under the four values, hidden and shown with them
  ((st=>st?`<span class="card-stratum" title="MBPI 1위 항목의 근거 층 · ${esc(st.long)}">MBPI 근거 · ${esc(st.short)}</span>`:'')(mbpiStratumOf(s)))+'</span>':'';
// 2026-10-13 design 2 (card shape A): the use and conservation values and the verdict on one line, so the list compares at a
// glance. Never summed; the same values as the four card scores. Screen readers hear the full names, the BBVI's paper label,
// the MCUI basis and the formal type name (sr-only text, so the card's innerText keeps every word the checks read).
function cardLine(s){
  if(!s.assessment)return '';
  const rule=matrixRule(),t=matrixType(s),b=axisState(s,'BBVI').value,m=axisState(s,'MCUI').value,one=b!==null&&bbviLabel(s);
  const basis=m===null?'':mcuiBasisLabel(s)+(mcuiBacktest(s)?' · '+mcuiBacktest(s):''),num=(v,k='MCUI')=>v===null?'–':scoreText(s,k,v);
  return `<span class="card-line"><span class="cl-v${one?' single':''}" title="통합 활용 BBVI ${num(b,'BBVI')}${one?' · '+esc(one):''}"><span class="sr-only">BBVI 통합 활용 </span><span aria-hidden="true">활용 </span><b>${num(b,'BBVI')}</b>${one?`<span class="sr-only"> ${esc(one)}</span>`:''}</span>`+
    `<span class="cl-v${m!==null&&rule&&m>=rule.mcui_threshold?' high':''}" title="보전 시급성 MCUI ${num(m)}${basis?' · '+esc(basis):''}"><span class="sr-only">, MCUI 보전 시급성 </span><span aria-hidden="true">보전 </span><b>${num(m)}</b>${consShort(s)?`<small class="cl-cons${m===null?' unknown':''}">${esc(consShort(s))}</small>`:''}${basis?`<span class="sr-only"> ${esc(basis)}</span>`:''}</span>`+
    `<span class="card-verdict" title="${esc(matrixPlainNote())}"><span class="sr-only">, 판단 </span>${verdictWord(t)}${t?`<span class="sr-only">(${esc(matrixTypeLabel(t))})</span>`:''}</span></span>`;
}
function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const group=$('species-group').value, evidence=$('species-evidence').value;
  const base=data.species.filter(s=>(group==='all'||s.group===group)
    &&(evidence==='all'||(evidence==='published'?!s.catalog:!!s.catalog))
    &&[s.label,s.name,s.group,String(s.aphiaID)].some(v=>v.toLowerCase().includes(query)));
  const matches=useSorted(base.filter(useMatch));
  $('species-count').textContent=`${matches.length}종`;filterCount();
  const extra=$('use-extra');
  if(extra){extra.innerHTML=useSuggestion($('search').value)+useNote(matches,base);
    extra.querySelector('[data-use-suggest]')?.addEventListener('click',e=>{$('search').value='';setUses([...activeUses,e.currentTarget.dataset.useSuggest]);});
    extra.querySelectorAll('[data-use-off]').forEach(b=>b.addEventListener('click',()=>toggleUse(b.dataset.useOff)));
    extra.querySelector('[data-use-clear]')?.addEventListener('click',()=>setUses([]));}
  // Re-rendering on select must not jump the (horizontal on phones) list back to the start or drop keyboard focus.
  const list=$('species-list'),left=list.scrollLeft,top=list.scrollTop,refocus=list.contains(document.activeElement);
  $('species-list').innerHTML=matches.length?matches.map(s=>`<button class="species-card ${selected?.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" data-group="${esc(s.group)}" data-type="${matrixType(s)||'none'}"${matrixType(s)?` style="--tc:${matrixTypeColour[matrixType(s)]}"`:''} aria-pressed="${selected?.aphiaID===s.aphiaID}"><span class="group">${esc(s.group)}</span><b>${esc(s.label)}</b><em>${esc(s.name)}</em>${cardLine(s)}<span class="count"><span>지도 표시 기록</span><strong>${s.cells.length?`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}셀`:s.catalog?(s.review?'공개 가능 기록 없음':releaseMissing(s)):'공개 셀 없음'}</strong></span>${cardScores(s)}${evidenceCardLine(s)}${useCardLine(s)}</button>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>{
    button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species)));
    for(const [ev,on] of [['mouseenter',1],['focus',1],['mouseleave',0],['blur',0]])button.addEventListener(ev,()=>hoverSpecies(on&&Number(button.dataset.species)));
  });
  list.scrollLeft=left;list.scrollTop=top;
  if(refocus)list.querySelector('.species-card.selected')?.focus({preventScroll:true});
}

function selectSpecies(id) {
  const item=data?.species.find(s=>s.aphiaID===id);
  if(!item)throw new Error('목록에 없는 종입니다.');
  selected=item;comparisonFocus=item.aphiaID;periodFilter='all';pickedValueCell=null;renderList();renderDetail();renderMap();renderComparison();syncCompareSelection();writeHash();
}

function renderDetail() {
  const s=selected;
  if(s.catalog)renderCandidateDetail(s);else renderLiveDetail(s);
  // The two axes first, as separate cards under the name; the evidence below stays the reference.
  if(s.assessment)$('detail').querySelector('.detail-head')?.insertAdjacentHTML('afterend',axisCards(s));
  foldDetail();
}
// 2026-10-11 design concept (team decision: fold like the concept): on wide screens the floating card shows the name and the
// two axis cards, and '근거 자세히 보기' opens everything below them. Nothing is removed; the fold is clipped and inert, not
// display:none, so the text stays laid out (the checks read it), and below 1281px nothing folds. Not in the link.
let detailOpen=false;
const wideLayout=()=>!!globalThis.matchMedia?.('(min-width:1281px)').matches;
function foldDetail(){
  const d=$('detail'),anchor=d.querySelector('.axis-cards')||d.querySelector('.detail-head');
  if(!anchor||!anchor.nextElementSibling)return;
  const fold=document.createElement('div');fold.id='detail-fold';fold.className='detail-fold';
  while(anchor.nextSibling)fold.append(anchor.nextSibling);
  anchor.insertAdjacentHTML('afterend','<button type="button" class="detail-cta" aria-controls="detail-fold"><span></span></button>');
  d.append(fold);
  d.querySelector('.detail-cta').addEventListener('click',()=>{detailOpen=!detailOpen;syncFolds();});
  syncFolds();
}
// the species pane's selects and 활용 특성 chips fold the same way under '필터 더 보기' (selected chips stay in #use-extra)
let filtersOpen=false;
function syncFolds(){
  const wide=wideLayout(),fold=$('detail-fold'),cta=document.querySelector('#detail .detail-cta');
  if(fold&&cta){const folded=wide&&!detailOpen;fold.classList.toggle('folded',folded);fold.inert=folded;
    cta.setAttribute('aria-expanded',String(!folded));cta.firstElementChild.textContent=detailOpen?'근거 접기':'근거 자세히 보기';}
  const ff=$('filter-fold'),ft=$('filter-toggle');
  if(ff&&ft){const folded=wide&&!filtersOpen;ff.classList.toggle('folded',folded);ff.inert=folded;ft.setAttribute('aria-expanded',String(!folded));}
}
function filterCount(){
  const n=activeUses.size+($('species-group').value!=='all')+($('species-evidence').value!=='all'),c=$('filter-count');
  if(c){c.textContent=n?`${n}개 사용 중`:'';c.hidden=!n;}
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
  return row(label,`지표 보고서에서 검토 · ${key} ${v===null?(key==='MCUI'&&s.assessment?.conservation_status?'미산출 · '+consShort(s,true):'산출 보류'):scoreText(s,key,v)}${key==='MCUI'&&separateMcui(s)?' ('+mcuiBasisShort(s)+')':''}`,v===null?'pending':'done')+
    `<p class="fine">운영 요약(발행 ${esc((s.publishedAt||'').slice(0,10)||'날짜 미확인')})은 지표 보고서보다 먼저 작성되어 이 항목을 반영하지 않았습니다. 원값과 근거는 위 ${key} 항목에서 확인합니다.</p>`;
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
// The repository has no verified species photos: the detail head shows the taxon group's icon instead (fixed size, theme.css).
const groupBadge=s=>`<span class="group-icon" data-group="${esc(s.group)}"><i aria-hidden="true"></i><small>${esc(s.group)}</small></span>`;
function renderCandidateDetail(s){
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  const heading=(status)=>`<div class="detail-head">${groupBadge(s)}<div class="detail-top"><span>신규 조사 후보</span><span class="pending">${status}</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`;
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
    const bioDetail=mbpi===null?'기원종→화합물→assay 원문 미검수':pilot?.mbpi_floor?`MBPI ${scoreText(s,'MBPI',mbpi)} · ${pilot.mbpi_label}. ${pilot.mbpi_floor.meaning}`:`${released()?'정식 산출':'검증 전 시범'} MBPI ${scoreText(s,'MBPI',mbpi)} · 같은 시험 조건 측정값 ${same.length}개, 원논문 ${papers}편${papers<2?', 독립 재현 미확인':''}${other?` · 다른 비교집단 ${other}개는 점수 근거에 따로 표시`:''}. 같은 코호트 안의 상대 백분위이며 임상 효능·종 간 가치 순위가 아닙니다.`;
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
        (mbpi===null?'':pilot.mbpi_floor?row('생리활성 근거',`${P_()}MBPI ${scoreText(s,'MBPI',mbpi)} · ${pilot.mbpi_label} · ${pilot.mbpi_floor.meaning}`,'linked'):row('생리활성 근거',`${P_()}MBPI ${scoreText(s,'MBPI',mbpi)} · ${pilotLabel('MBPI')} · ${bestBio(pilot).stratum_kind==='chembl'?`${bestBio(pilot).stratum_label} · ${bestBio(pilot).label}`:`원논문 ${papers}편${replicated?` + 효능 재현 ${replicated}편`:''}`} · 같은 코호트 안의 상대 백분위`,'linked'))+renderVerifiedIndices(s)+
        `<p class="detail-limit">${limit} ${scored.length?scored.map(k=>k+'('+esc(axisTag(s,k))+')').join(' / ')+(scored.length===4?' 네 지표를 모두 산출했습니다.':'만 산출했고 나머지 축은 아직 산출하지 못했습니다.'):'MFPI·MBPI·MCUI·BBVI 모두 아직 산출하지 못했습니다.'}</p></div>`:
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
      '<p class="fine">정보충분도: 학명 연결만 확인 · 그 밖의 근거 미수집. 보류 항목은 0점이 아닙니다.</p>')+
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
  const withheld=pilot?'규칙을 다 채우지 못한 값은 라벨(최상위 근거 독립 재현 확인 중·하한값·예비평가·지방 목록)로 구분합니다. '+(released()?'산출값은 연구용 결과입니다':'시범 수치는 연구용 결과입니다')+validationNote()+'.'+(s.v2?'':' '+score):score;
  // A status says whether an indicator was computed; "일부 근거 확인" is evidence without an indicator.
  const axes=[['MFPI','식량 근거'],['MBPI','생리활성 근거'],['MCUI','보전 평가']].map(([k,label])=>{
    const st=axisState(s,k), v=st.value, status=st.kind!=='withheld'||VERIFIED.includes(pilot?.report_version)?st.label:'산출 보류';
    return row(label,v===null?(status==='산출 보류'?status:status+' · 지표 미산출'):`${scoreText(s,k,v)} · ${esc(axisTag(s,k))}`,v===null?'pending':'done')
      .replace('<div class="evidence-item">',`<div class="evidence-item axis axis-${k}" style="--v:${v===null?0:Math.max(0,Math.min(100,v))}%">`);
  }).join('');
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  $('detail').innerHTML=`<div class="detail-head">${groupBadge(s)}<div class="detail-top"><span>공개 기준 적용 자료</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(s.name)}</p></div>`+
    `<div class="detail-summary"><div id="detail-map-summary">${mapSummaryHtml(periodView({...s,cells}))}</div><h3>근거 상태 <span class="fine">판정 아님</span></h3>${axes}<p class="detail-limit">현재 확보한 출현기록이며, 전체 분포·개체수·자원량이 아닙니다.</p></div>`+
    `<div class="detail-more-list">`+
    more('근거 자세히 보기',`${pilotRows}${evidence}${foodEvidencePanel(s)}${row('자료 연결 현황','5개 항목의 단계 · 품질 점수 아님')}${coverageBar(s)}<p class="fine">${esc(coverageGuide())}</p>${coverageNotes(s)}<div class="withheld"><b>${pilot?(released()?'분석 주의':'시범 분석 주의'):'통합점수 산출 보류'}</b>${withheld}</div>`)+
    more('수집·선별 기준',`${row('AphiaID',s.aphiaID)}${row('원자료 학명',(i.original_names||[]).join(', ')||'미기재')}<p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 AphiaID를 기준으로 합니다.</p>${mapSection({...s,cells})}${separate}${institutionChecks(s)}`)+
    more('출처와 이용조건',`<div class="source-area">${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>{const src=data.assessmentInfo.sources[id];return `<p>${sourceLink(src.url,((mcuiReference(s)?.source_ids||[]).includes(id)?'참고 정보 출처 ':'지표 근거 ')+id+' ↗')} · ${esc(src.license)}${src.notice?`<br><span class="fine">${esc(src.notice)}</span>`:''}</p>`;}).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 근거 보고서는 별도 스냅샷입니다.</p></div>`)+
    `</div>`;
  $('detail-sources').addEventListener('click',()=>{setView('method',false);document.querySelector('.source-section').scrollIntoView({behavior:'smooth'});});
}

// Published 1° map cells (public.species_map_cells, rules map-1). Cells only: no coordinates or record ids exist in the API.
const REASONS={on_land_obis_rule:'육지 위 좌표(OBIS 해안선 기준)',duplicate:'같은 기록 중복',under_existing_db_review:'운영 DB에서 검토 중인 기존 기록',
  species_held_until_sensitivity_review:'민감도 검토 전 보류 종',bad_coordinate_issue:'GBIF 좌표 오류 표시',uncertainty_over_10km:'좌표 불확실성 10 km 초과',
  coordinates_generalized_at_source:'제공처가 좌표를 흐리게 처리',no_year:'관측 연도 없음',
  taxon_not_verified:'학명 검증 불가',absent_or_dropped:'부재·삭제 기록',fossil_specimen:'화석 표본',license_not_open:'이용조건 미충족(허용 범위 밖·불명)',
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
  const axes=['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return `${k} ${st.value!==null?(released()?'산출값 있음':'시범값 있음'):st.kind==='withheld'&&!(k==='MCUI'&&s.assessment?.conservation_status)?'보류':st.label}`;}).join(' · ');
  const h=IUCN_HISTORICAL[s.aphiaID], k=s.info?.conservation||{};
  const iucn=h?(h.current&&pilotScore(s,'MCUI')===null?`IUCN ${h.current.category} ${h.current.published}년 발표(원문 검수 전, 2013 평가 대체)`:(pilotScore(s,'MCUI')!==null&&s.assessment?.conservation_trace?.publication_year?`IUCN ${s.assessment.conservation_trace.category} ${s.assessment.conservation_trace.criteria||''} ${s.assessment.conservation_trace.publication_year}년 발표(원문 검수 · ${P_()}MCUI, 2013 평가 대체)`:`IUCN ${h.category} ${h.published}년 발표(${pilotScore(s,'MCUI')===null?'역사적 평가 · 현행 확인 보류':released()?'현행 재확인':'현행 재확인 · 시범'})`))
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
<li><b>이용조건</b>${map3?`CC0·CC BY·CC BY-NC 4.0 기록을 썼습니다. CC BY-NC ${count(m.used_licences?.['CC BY-NC 4.0']??m.nc_records)}은 2026-10-01 결정에 따라 비상업 연구용으로 표시합니다.`:`CC0·CC BY 4.0 기록만 썼습니다. CC BY-NC ${count(m.nc_records)}은 비상업 이용 결정 전이라 쓰지 않았습니다.`}</li>
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
// One red for every species so the pattern reads at a glance. 2026-10-11 navy redesign: a lighter red that holds on the navy
// map, and the light rim on every basemap (the outline fallback is navy too now).
const DOT_RED='#ff6464';
const dotStyle=()=>({color:'#ffffff',weight:.65,opacity:.9,fillColor:DOT_RED,fillOpacity:.88});
// Smaller schematic marks reveal the grid pattern; zoom caps and cell click areas stay independent.
function dotRadius(spacingDeg){
  const z=map.getZoom(), pxPerDeg=256*2**z/360;
  return Math.max(1.1,Math.min([1.5,1.5,1.8,2.2,2.6,3][Math.max(0,Math.min(5,z-3))],spacingDeg*pxPerDeg*.27));
}
let dotCells=[]; // cells whose dot pattern is redrawn on zoom (reset with the overlay in renderMap)
function addCellDots(lat0,lon0,size,records){
  if(!Number.isFinite(records)||records<=0)return;
  dotCells.push([lat0,lon0,size,records]); // drawn by drawOccurrence: bubbles or dots, depending on the zoom
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
// 2026-10-03 team-lead request: overview zooms show regional bubbles first; zooming in splits them into each cell's red dots.
// A bubble groups published cells only (their centres, never record coordinates). Size = number of cells, shade = records per
// cell in the same bands as the dot density. No species score is folded into the bubble: that would be a sea-area score.
const BUBBLE_MAX_ZOOM=6, BUBBLE_FILL={4:.3,6:.45,8:.6,10:.75};
const BUBBLE_BAND={4:'1–4건',6:'5–19건',8:'20–99건',10:'100건 이상'};
let occurrenceSpecies=null;
const bubbleView=()=>dotCells.length>0&&map.getZoom()<=BUBBLE_MAX_ZOOM;
function cellBubbles(cells,zoom){
  const block=zoom<=5?4:2, groups=new Map();
  for(const c of cells){
    const [lat0,lon0,size,records]=c, lat=lat0+size/2, lon=lon0+size/2, key=Math.floor(lat/block)+'/'+Math.floor(lon/block);
    if(!groups.has(key))groups.set(key,{cells:[],records:0,lat:0,lon:0});
    const g=groups.get(key);g.cells.push(c);g.records+=records;g.lat+=lat;g.lon+=lon;
  }
  return [...groups.values()].map(g=>({...g,lat:g.lat/g.cells.length,lon:g.lon/g.cells.length}));
}
// Species-level pilot BBVI with its single-paper label, for the bubble tooltip: a species value, not this sea area's value.
// From 2026-10-03 (PR #122) it was also a tag on every cell; on 2026-10-13 (design 2) one map chip took their place (setMapChip).
function bbviTagText(s){
  const v=s?pilotScore(s,'BBVI'):null;
  return v===null?'BBVI 미산출':'BBVI '+scoreText(s,'BBVI',v)+(bbviLabel(s)?' · '+bbviLabel(s):'');
}
function zoomIntoCells(bounds){
  const z=Math.max(BUBBLE_MAX_ZOOM+1,Math.min(map.getMaxZoom(),map.getBoundsZoom(bounds)));
  // Same zoom as before; only the centre shifts so the cells land in the middle of the map the floating panels leave free.
  const i=mapInsets(), target=L.latLngBounds(bounds).getCenter();
  map.setView(i.left===i.right?target:map.unproject(map.project(target,z).subtract([(i.left-i.right)/2,0]),z),z);
}
function drawBubble(b){
  const n=b.cells.length, band=dotsPerDegree(b.records/n), size=b.cells[0][2];
  const r=Math.min(30,9+5*Math.sqrt(n));
  const bounds=b.cells.flatMap(([lat0,lon0,s])=>[[lat0,lon0],[lat0+s,lon0+s]]);
  const bubble=L.circleMarker([b.lat,b.lon],{radius:r,color:'#ff8d84',weight:2.2,opacity:1,fillColor:DOT_RED,fillOpacity:BUBBLE_FILL[band],className:'occ-bubble'});
  bubble._zoomMark=true;
  bubble.bindTooltip?.(`공개 ${size}° 셀 ${n}개 · 선별 기록 ${b.records.toLocaleString()}건(셀당 평균 ${BUBBLE_BAND[band]} 구간) · ${esc(bbviTagText(occurrenceSpecies))}(종 전체 ${released()?'값':'시범값'} · 이 해역 값 아님)<br><small>누르면 확대되어 셀별 붉은 점으로 펼쳐집니다. 버블 위치는 셀 중심의 평균이며 실제 발견 좌표가 아닙니다.</small>`);
  bubble.on?.('click',()=>zoomIntoCells(bounds));
  bubble.addTo(overlay);
  const count=L.marker([b.lat,b.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'bubble-count',html:String(n),iconSize:[40,20]})});
  count._zoomMark=true;count.addTo(overlay);
}
// 2026-10-13 design 2: the legend's first line names what the map shows at this zoom, bubbles or dots. Species with cells only:
// the query-extent and candidate lines stay setMapLegend's and renderMap's.
function setKeyLine(bubbles){
  if(!occurrenceSpecies?.cells?.length)return;
  const size=occurrenceSpecies.cells[0].sizeDeg||1;
  $('key-bubble-mark').hidden=!bubbles;$('key-dot-mark').hidden=bubbles;
  $('map-symbol-label').textContent=(bubbles?'버블 = 공개 셀 묶음 · 숫자 = 셀 수':`점선 = ${size}° 셀 · 점 = 기록 수 구간(도식)`)+'\n실제 생물 발견 좌표 아님';
}
function drawOccurrence(){
  if(!map||!overlay)return;
  overlay.eachLayer(l=>{if(l._schematicDot||l._zoomMark)overlay.removeLayer(l);});
  const bubbles=bubbleView();setKeyLine(bubbles);
  // The cell frames carry the evidence popups; they come back with the dots so every cell stays clickable when zoomed in.
  for(const frame of cellLayers){if(bubbles)overlay.removeLayer(frame);else if(!overlay.hasLayer(frame))frame.addTo(overlay);}
  if(bubbles){for(const b of cellBubbles(dotCells,map.getZoom()))drawBubble(b);return;}
  for(const c of dotCells)drawCellDots(...c);
}
// 2026-10-03 team-lead request: one glance per grid cell. Counts species by their species-level pilot values; a species can
// sit in more than one group. Nothing here is a value measured in this cell or a sea-area score.
function cellSpeciesAt(lat0,lon0,size){
  return (data?.species||[]).filter(s=>periodView(s).cells.some(c=>c.lat0===lat0&&c.lon0===lon0&&c.sizeDeg===size));
}
function cellSpeciesGroups(list){
  const rule=matrixRule(), bt=rule?.bbvi_threshold??50, mt=rule?.mcui_threshold??50;
  return {bt,mt,all:list,
    use:list.filter(s=>(pilotScore(s,'BBVI')??-1)>=bt),
    cons:list.filter(s=>(pilotScore(s,'MCUI')??-1)>=mt),
    gap:list.filter(s=>!s.assessment||s.assessment.priority_survey),
    // 4.14 (prereg-4.14-2026-10-14 5): species with no conservation number, counted apart and never read as low MCUI
    unknown:list.filter(s=>!!s.assessment&&pilotScore(s,'MCUI')===null)};
}
function cellSummaryHtml(list){
  if(!list.length)return '';
  const g=cellSpeciesGroups(list), names=xs=>xs.length?xs.map(s=>esc(s.label)).join(', '):'없음';
  const tile=(n,label)=>`<div><b>${n}</b><span>${label}</span></div>`;
  return `<div class="cell-summary" role="group" aria-label="이 격자 종 요약">${tile(g.all.length,'확인 종')}${tile(g.use.length,'활용 지표 높은 종')}${tile(g.cons.length,'보전 지표 높은 종')}${tile(g.unknown.length,'보전평가 미확인 종')}${tile(g.gap.length,'근거 부족 종')}</div>`+
    `<p class="fine cell-summary-names">확인 종: ${names(g.all)}<br>활용 지표 높음(BBVI ${g.bt} 이상 · 탐색적 구분선): ${names(g.use)}<br>보전 지표 높음(MCUI ${g.mt} 이상 · 탐색적 구분선): ${names(g.cons)}<br>보전평가 미확인(MCUI 없음 · 낮은 위험이라는 뜻 아님): ${names(g.unknown)}<br>근거 부족(우선 조사 대상 또는 지표 평가 없음): ${names(g.gap)}<br>종 전체 ${released()?'값':'시범값'} 기준이며 이 격자에서 측정한 값이 아닙니다. 한 종이 여러 묶음에 들어갈 수 있습니다.</p>`;
}
const cellSummaryTip=list=>{const g=cellSpeciesGroups(list);return ` · 활용 지표 높음 ${g.use.length}종 · 보전 지표 높음 ${g.cons.length}종 · 보전평가 미확인 ${g.unknown.length}종 · 근거 부족 ${g.gap.length}종`;};
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
// Cell boundary in a non-red ink so it stays distinct from the red dots on every basemap (all navy since 2026-10-11:
// a quieter light dash, so the frames do not outshine the dots).
const cellFrame=()=>({color:'#d8e6ee',weight:1.1,opacity:.6,dashArray:'4 4',fillColor:DOT_RED,fillOpacity:.1});
// 2026-10-14 land mask: a cell never paints the land. A 1° cell is filled over its sea part only (cell-sea-geometry.json,
// scripts/build_cell_sea_geometry.py, cut with the same countries.json) and keeps its square for the edge, click, tooltip and
// popup; a 4° cell (sensitive species, published wide) is an outline only, 2 px inside its square so it does not run on the 1°
// edges. Without the file or a cell's key the square is filled as before. Display only: cells, counts and types are unchanged.
// Style key `edge`: the cell's own border ('plain', or 'active' for the clicked cell); selected, hover and dim styles leave it out.
let cellSea=null;
const seaOf=(lat,lon,size)=>size===1?cellSea?.[`${lat},${lon},1`]||null:null;
const seaLatLngs=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(([x,y])=>[y,x])));
// [square style, sea style] for one setStyle call; only the keys given are passed on, as Leaflet merges styles
function cellStyles(sea,wide,s){
  if(wide)return [{...s,...(s.edge?{color:s.fillColor||s.color,weight:s.edge==='active'?3.5:2.5,dashArray:'9 6'}:{}),fill:true,fillOpacity:0},null];
  if(!sea)return [s,null];
  const square={...s,...(s.edge==='plain'?{weight:1,opacity:.45*(s.opacity??1)}:{})};
  if(sea.seaFraction===1)return [square,null];
  const fill={stroke:false};if('fillColor' in s)fill.fillColor=s.fillColor;if('fillOpacity' in s)fill.fillOpacity=s.fillOpacity;
  return [{...square,fill:true,fillOpacity:0},fill];
}
let CellShape=null;
function cellShape(lat,lon,size,style){
  const sea=seaOf(lat,lon,size),wide=size>=4;
  if(!sea&&!wide)return L.rectangle([[lat,lon],[lat+size,lon+size]],style); // no geometry for this cell: the whole square, as before
  CellShape??=L.Rectangle.extend({
    initialize(bounds,info,style){
      this._info=info;this._full=L.latLngBounds(bounds);
      this._sea=info.sea?.type?L.polygon(seaLatLngs(info.sea),{interactive:false,stroke:false}):null;
      L.Rectangle.prototype.initialize.call(this,bounds,{});this.setStyle(style);
    },
    setStyle(s){
      const [square,sea]=cellStyles(this._info.sea,this._info.wide,s);
      if(this._sea&&sea)this._sea.setStyle(sea);
      return L.Rectangle.prototype.setStyle.call(this,square);
    },
    onAdd(m){
      this._sea?.addTo(m); // under the square, which keeps the click
      L.Rectangle.prototype.onAdd.call(this,m);
      if(this._info.wide){m.on('zoomend',this._inset,this);this._inset();}
    },
    onRemove(m){
      if(this._sea)m.removeLayer(this._sea);
      if(this._info.wide)m.off('zoomend',this._inset,this);
      L.Rectangle.prototype.onRemove.call(this,m);
    },
    _inset(){
      const m=this._map,z=m.getZoom(),a=m.project(this._full.getSouthWest(),z).add([2,-2]),b=m.project(this._full.getNorthEast(),z).add([-2,2]);
      this.setBounds(L.latLngBounds(m.unproject(a,z),m.unproject(b,z)));
    }
  });
  return new CellShape([[lat,lon],[lat+size,lon+size]],{sea,wide},style);
}
// First line of a 4° cell's tooltip or popup: the cell is wide on purpose, and land inside it is not where the species lives.
const wideCellNote=names=>`<b>${esc(names)} · 민감종 보호</b> — 채취 압력이 있어 4° 단위로만 공개합니다. 테두리 안 바다 어딘가에 기록이 있다는 뜻이며, 육지에 사는 것이 아닙니다.`;
function setMapLegend(s){
  // Species without published cells only show the query extent (studyBounds).
  const extentOnly=s&&!s.cells.length, size=s?.cells?.[0]?.sizeDeg||1;
  // 2026-10-13 design 2: two lines stay open, the mark and its label (bubbles or dots by zoom: setKeyLine) and the effort row;
  // the bubble row, the note and the full text sit in 'ⓘ 범례'.
  $('key-dot-mark').hidden=!!extentOnly;$('key-bubble-mark').hidden=true;
  for(const row of document.querySelectorAll('#occurrence-legend .key-bubble,#occurrence-legend .key-note'))row.hidden=!!extentOnly;
  $('map-symbol-label').textContent=extentOnly?'점선 테두리 = 자료를 찾아본 범위':`점선 = ${size}° 셀 · 점 = 기록 수 구간(도식)\n실제 생물 발견 좌표 아님`;
  $('map-legend-note').textContent=extentOnly?'공개된 기록 칸이 없습니다. 테두리는 이 종이 사는 곳이나 분포가 아닙니다.':'축소한 지도에서는 칸을 해역별 버블로 묶어 먼저 보여 줍니다. 버블이 클수록 기록 칸이 많이 모여 있고, 진할수록 칸당 기록이 많습니다(점 간격과 같은 구간). 버블을 누르거나 확대하면 칸별 붉은 점으로 펼쳐집니다. 칸을 누르면 그 칸의 확인 종·활용 지표 높은 종·보전 지표 높은 종·보전평가 미확인 종·근거 부족 종 수가 먼저 나옵니다. 점 간격: 칸 안의 기록이 많을수록 점이 촘촘합니다(1–4 · 5–19 · 20–99 · 100건 이상, 1°·4° 칸 모두 같은 면적 기준. 4° 칸은 5건 이상이면 같은 밀도). 점 하나가 기록 하나는 아니고, 점 위치도 실제 발견 지점이 아닙니다. 점선 테두리가 칸의 경계이고, 육지 위에는 점을 그리지 않습니다. 칸을 누르면 실제 기록 수·기간·출처가 나옵니다.';
}

// Fitted cells stay clear of the floating controls (top-left buttons, bottom-left legend) so every cell can be clicked.
// From 1281px the species list and the detail float over the map (2026-10-11): their widths are added on each side.
// Fit padding: the floating panels' widths plus the height of each map control box over the free part of the map, on the edge
// it sits at (from 1281px the mode bar is at the bottom and the key sits under the species list, outside the free part).
function fitPad(p){
  const i=mapInsets(),m=document.getElementById?.('map')?.getBoundingClientRect?.(),edge={top:0,bottom:0};
  for(let [sel,side] of [['.map-ui-tl','top'],['.map-ui-bl','bottom'],['#map-chip','top']]){
    const b=document.querySelector?.(sel)?.getBoundingClientRect();if(!b?.height)continue;
    if(m?.height){if(b.right<=m.left+i.left+1||b.left>=m.right-i.right-1)continue;side=b.top+b.height/2<m.top+m.height/2?'top':'bottom';}
    // the summary chip sits below the mode bar from 741 to 1280px: keep fitted cells clear of its lower edge, not just its height
    edge[side]=Math.max(edge[side],m?.height&&sel==='#map-chip'?(side==='top'?b.bottom-m.top:m.bottom-b.top):b.height);
  }
  return {paddingTopLeft:[p+i.left,p+edge.top],paddingBottomRight:[p+i.right,p+edge.bottom]};
}
// Width of the map each floating panel covers, in px; 0 for a panel beside the map (1201–1280px), below it or full width (phones).
function mapInsets(){
  const m=document.getElementById?.('map')?.getBoundingClientRect?.(),box=sel=>document.querySelector?.(sel)?.getBoundingClientRect?.();
  if(!m?.width)return {left:0,right:0};
  const side=b=>b&&b.width>0&&b.width<m.width/2&&b.right>m.left+1&&b.left<m.right-1?b:null, l=side(box('.species-pane')), r=side(box('#detail'));
  return {left:l?Math.max(0,Math.round(l.right-m.left)):0,right:r?Math.max(0,Math.round(m.right-r.left)):0};
}
// 2026-10-13 design 2: one chip over the map names the selected species with its cells, records and years (the values of
// #map-count, #map-cells and #map-years, written at the same places) in place of a BBVI tag on every cell. Display only.
function setMapChip(s,text){
  const chip=$('map-chip');if(!chip)return;
  chip.hidden=!text;if(!text)return;
  const t=s?matrixType(s):null;
  chip.innerHTML=(s?`<i class="mc-dot${t?'':' none'}"${t?` style="background-color:${matrixTypeColour[t]}"`:''} aria-hidden="true"></i><b>${esc(s.label)}</b> `:'')+`<span>${esc(text)}</span>`;
}
function renderCellMap(s,color){
  occurrenceSpecies=s;dotCells=[];cellLayers=[]; // renderMap has cleared the overlay
  const degree=s.cells[0]?.sizeDeg||1;
  $('map-review-note').textContent=`선별된 ${s.catalog?'GBIF·OBIS':'GBIF'} 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 표시합니다. 붉은 점은 실제 발견 좌표가 아닌 공개 셀의 도식적 표시이며 가치·보전 등급도 아닙니다. 기록 수는 개체수·자원량·현재 분포나 한국 전체 분포를 뜻하지 않습니다.${s.catalog?' 2000년 이전 과거 기록과 한국·북한 EEZ 밖 기록은 셀 팝업에 따로 표시합니다. 양식·방류 개체는 원자료 표시가 없으면 구분하지 못합니다.':''}`;
  mapJudgmentStatus(s);
  for(const rows of spatialCells(s)){
    const c=rows[0], reasons=[...new Set(rows.flatMap(r=>cellAssessmentStatus(s,r).reasons))];
    // One hit area per spatial cell; every period row stays readable in its popup.
    const periods=rows.map(r=>`<li><b>공개 집계 기간 ${esc(r.period)}</b> · 기록 연도 ${esc(years(r))}${r.historical?'<br><b>과거 기록(2000년 이전) · 현재 분포 근거 아님</b>':''}${r.outsideKoreanEEZ?'<br><b>한국·북한 EEZ 밖 기록</b>':''}<br>선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳${r.uncertaintyMissing?` · 좌표 불확실성 결측 ${esc(r.uncertaintyMissing)}건`:''}<br>해역 메타데이터 ${esc(r.seaAreas.map(x=>x==='해역명 미확인'?x:'LME '+seaName(x)).join(', '))}${r.countries?' · 국가 메타데이터 '+esc(r.countries.join(', ')||'미기재'):''}<br>출처·이용조건<ul>${occurrenceCitationLinks(r)||'<li>셀별 제공처 확인 필요</li>'}</ul></li>`).join('');
    cellLayers.push(cellShape(c.lat0,c.lon0,c.sizeDeg,{...cellFrame(),...(c.sizeDeg>=4?{edge:'plain',opacity:.9}:{})}).addTo(overlay));
    cellLayers.at(-1).bindPopup(`<strong>${esc(s.label)} · 선별 출현기록 ${c.sizeDeg}° 셀</strong>${c.sizeDeg>=4?'<p class="wide-note">'+wideCellNote(s.label)+'</p>':''}${cellSummaryHtml(cellSpeciesAt(c.lat0,c.lon0,c.sizeDeg))||'<br>'}<b>해역별 활용·보전 판단: 하지 않음(지표는 종 단위)</b><br>${esc(speciesAxesLine(s))}<br>공간 해상도 ${c.sizeDeg}°×${c.sizeDeg}° · 가장 짧은 변 약 ${esc(Number.isFinite(c.resolutionM)?Math.floor(c.resolutionM/1000):'미확인')} km<br>${rows.length>1?`기간 ${rows.length}개 · 선별 기록 합계 ${esc(rows.reduce((a,r)=>a+r.records,0))}건. 같은 지점이 여러 기간에 있을 수 있어 조사 지점은 기간별로만 셉니다.<br>`:''}<b>${rows.length>1?'기간별 근거':'이 셀의 근거'}</b><ol class="cell-periods">${periods}</ol><b>해역 판단을 하지 않는 이유</b><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>공개 기준(이용조건·좌표 품질)을 통과한 일부 기록입니다. 조사 노력·중복·시기·경계 효과가 해역 간 비교용으로 보정되지 않았습니다. 원좌표·개체수·자원량·한국 전체 분포가 아닙니다.</small>`+effortLine(c.lat0,c.lon0,c.sizeDeg)+generalizationNote(c.sizeDeg)+cellPopupNotice(c.sizeDeg));
    addCellDots(c.lat0,c.lon0,c.sizeDeg,rows.reduce((a,r)=>a+r.records,0)); // one pattern per spatial cell
  }
  // Not animated: Leaflet 1.1 drops a fit requested while another zoom animation runs (quick species switches).
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{...fitPad(40),maxZoom:7,animate:false});}
  drawOccurrence();
  $('map-count').textContent=cellRecords(s).toLocaleString();$('map-cells').textContent=spatialCells(s).length;$('map-years').textContent=cellYears(s);
  setMapChip(s,`기록 셀 ${spatialCells(s).length}개 · ${cellRecords(s).toLocaleString()}건 · ${cellYears(s)}`);
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
  box.innerHTML=`<details><summary>셀 목록 표로 보기 (${groups.length}개 · 키보드·화면 낭독기용)</summary><button type="button" class="text-button" id="cell-csv">CSV 내려받기 (공개 집계·출처 포함)</button><table><caption class="sr-only">${esc(s.label)}의 공개 셀별 근거. 셀 범위는 원좌표가 아닌 공개 집계 범위입니다.</caption><thead><tr><th scope="col">셀 범위</th><th scope="col">기간·집계·출처</th><th scope="col">지도</th></tr></thead><tbody>${rows}</tbody></table><p class="fine">해역별 활용·보전 판단은 하지 않습니다(지표는 종 단위). 셀 범위는 공개 집계 범위이며 실제 발견 좌표가 아닙니다.</p></details>`;
  $('cell-csv').addEventListener('click',()=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([cellCsv(s)],{type:'text/csv;charset=utf-8'}));
    a.download=`blue-bio-map_${s.aphiaID}_cells.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  box.querySelectorAll('[data-cell]').forEach(b=>b.addEventListener('click',()=>{
    const layer=cellLayers[Number(b.dataset.cell)];if(!layer)return;
    if(map.getZoom()<=BUBBLE_MAX_ZOOM)map.setView(layer.getBounds().getCenter(),BUBBLE_MAX_ZOOM+1,{animate:false}); // bubbles hide the cell frames
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
// Off on first open since the 2026-10-11 navy redesign (the 조사량 box in the legend turns it on); not kept in the link.
let effortData=null, effortLayer=null, effortOn=false;
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
  // 2026-10-14: over the sea part of the cell only (cell-sea-geometry.json), the whole square without it
  for(const c of effortData.cells){
    const sea=seaOf(c.lat0,c.lon0,1),style={renderer:effortRenderer,interactive:false,stroke:false,fillColor:'#ffffff',fillOpacity:[0,.03,.06,.1,.14][effortBand(c.records)]};
    if(sea?.seaFraction===0)continue;
    (sea?.type?L.polygon(seaLatLngs(sea),style):L.rectangle([[c.lat0,c.lon0],[c.lat0+1,c.lon0+1]],style)).addTo(effortLayer);
  }
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
  const note='공개 집계 셀 · 실제 생물 발견 좌표 아님 · 해역별 판단 안 함';
  const rows=s.cells.map(c=>[s.label,s.name,s.aphiaID,c.lat0,c.lat0+c.sizeDeg,c.lon0,c.lon0+c.sizeDeg,c.sizeDeg,c.period,c.yearStart,c.yearEnd,c.records,c.sites,(c.citations||[]).map(x=>x.title).join('; '),(c.licenses||[...new Set((c.citations||[]).flatMap(x=>x.licenses||[]))]).join('; '),(c.seaAreas||[]).join('; '),note+(c.historical?' · 2000년 이전 과거 기록':'')+(c.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':'')]);
  return '﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n');
}
// Shareable view: species, tab, basemap, period, map view and use-trait chip live in the URL hash.
// A shared link carries the screen after '#'. The same keys written as a query (?v=compare) open the same screen (the
// hash wins where both name a key) and move into the hash on the first write; other query keys (?offline=1) stay.
const LINK_KEYS=['s','v','t','b','m','p','u','w'];
function readHash(){try{const q=new URLSearchParams(location.search),o={};for(const k of LINK_KEYS)if(q.has(k))o[k]=q.get(k);
  return {...o,...Object.fromEntries(new URLSearchParams(location.hash.slice(1)))};}catch{return {};}}
// The tab a link opens: one of the three views, else none (the tab stays as it is). Kept with readHash for the node test.
const linkView=h=>['explore','compare','method'].includes(h?.v)?h.v:null;
function writeHash(){
  if(!data||!selected)return;
  const p=new URLSearchParams({s:selected.aphiaID,v:currentView,b:basemap,t:mapMode});
  if(periodFilter!=='all')p.set('p',periodFilter);
  if(activeUses.size)p.set('u',[...activeUses].join(','));
  if(weightOff())p.set('w',(weightStep(bbviWeight)/W_STEPS).toFixed(2)); // the official weight stays out of the link
  if(map){const c=map.getCenter();p.set('m',`${map.getZoom()}/${c.lat.toFixed(2)}/${c.lng.toFixed(2)}`);}
  try{const q=new URLSearchParams(location.search);LINK_KEYS.forEach(k=>q.delete(k));const rest=q.toString();
    history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')+'#'+p.toString());}catch{}
}
function applyHash(h){
  const s=data?.species.find(x=>x.aphiaID===Number(h.s));
  if('w' in h)setBbviStep(hashWeightStep(h.w));
  if(h.u)setUses(h.u.split(',')); // before the species, so the linked species wins; a chip without evidence stays off
  if(s)selectSpecies(s.aphiaID);
  if(h.p&&selected?.cells.some(c=>c.period===h.p)){periodFilter=h.p;renderMap();}
  if(h.t==='value')setMapMode('value');
  if(h.b&&h.b!==basemap&&basemapLayers?.[h.b])setBasemap(h.b);
  const m=(h.m||'').split('/').map(Number);
  if(map&&m.length===3&&m.every(Number.isFinite))map.setView([m[1],m[2]],m[0],{animate:false});
  const v=linkView(h);if(v)setView(v);
  writeHash();
}

/* The evidence map joins published cell extents only. No occurrence coordinates or
   species scores are promoted into sea-level scores. A 4° extent stays 4°. */
const valueCellKey=(lat,lon,size)=>[lat,lon,size].join('/');
function valueCellGroups(all=false){
  const groups=new Map();
  if(!data)return groups;
  for(const s of data.species){
    if(!all&&!useMatch(s))continue;
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
const TYPE_SHORT={conservation_priority:'보전',alternative_production:'대체',baseline_survey:'조사',sustainable_use:'활용'};
// Selected-species outline and the card-hover outline share the hover yellow; hover is dashed so a hovered
// species stays apart from the selected one. Change the colour or weight here only.
const SELECTED_OUTLINE=()=>({color:'#ffd166',dashArray:null,opacity:1}); // every basemap is dark navy since 2026-10-11
const HOVER_OUTLINE={color:'#ffd166',weight:4,dashArray:'6 4',opacity:1};
const CELL_FILL=.48;  // the map's cell fill; the legend swatches use the same alpha so both read alike
function cellMatrixType(g){
  const counts={};
  for(const s of g.species.values()){const t=matrixType(s);if(t)counts[t]=(counts[t]||0)+1;}
  return {type:(matrixRule()?.cell_colour_precedence||[]).find(t=>counts[t])||null,counts};
}
const cellRange=g=>`${g.lat}–${g.lat+g.size}°N · ${g.lon}–${g.lon+g.size}°E`;
const colourRuleLine=()=>`셀 색 = 그 셀에 기록된 종 중 우선순위 첫 유형(${matrixRule().cell_colour_precedence.map(matrixTypeLabel).join(' > ')})`;
// The species of the cell's colour type, by name (not a value rank), at most three.
function colourSpecies(g){
  const t=cellMatrixType(g).type,names=[...g.species.values()].filter(s=>t&&matrixType(s)===t).map(s=>s.label).sort((a,b)=>a.localeCompare(b,'ko'));
  return names.slice(0,3).join(', ')+(names.length>3?` 외 ${names.length-3}종`:'');
}
// The selected species' own type beside the cell colour, so a cell of another colour explains itself.
function selectedCellLine(g){
  if(!selected||!g.species.has(selected.aphiaID)||!matrixRule())return '';
  const own=matrixType(selected),t=cellMatrixType(g).type,head=`선택 종 ${selected.label}: ${own?matrixTypeLabel(own):'유형 미산출'}`;
  return !t?head+' / 이 셀 색: 유형 미산출':own===t?head+' = 이 셀 색':`${head} / 이 셀 색: ${matrixTypeLabel(t)}(같은 셀의 ${colourSpecies(g)} 때문${own?' · 우선순위 규칙':''})`;
}
const sufficiencyLayers={priority:false,unexplored:false};
function valueSpeciesType(s){
  const t=matrixType(s),a=s.assessment,i=a?.information_sufficiency;
  const nationalOff=!t&&nationalMcui(s)&&pilotScore(s,'BBVI')!==null&&matrixRule()&&!matrixRule().include_national_mcui;
  const type=t?`매트릭스 유형 <b>${esc(matrixTypeLabel(t))}</b> · BBVI ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))}(현재 가중치${bbviLabel(s)?' · '+esc(bbviLabel(s)):''}${officialNote(s)?' · '+esc(officialNote(s)):''}) × MCUI ${pilotScore(s,'MCUI').toFixed(1)}${separateMcui(s)?'('+mcuiBasisLabel(s)+')':''}`
    :nationalOff?'매트릭스 유형 미산출 · 국가 평가 기반 MCUI는 이 규칙에서 매트릭스 제외(두 값은 산출됨)'
    :`매트릭스 유형 미산출 · ${untypedReason(s)}(낮은 가치·낮은 위험이라는 뜻이 아님)`;
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
  // 2026-10-15: a clicked cell is marked by its border only; its fill keeps the tone of the cells around it
  const base=type?{color:active?'#173f62':mixed?'#102e45':matrixTypeColour[type],weight:active?2.5:mixed?2:1.5,dashArray:mixed?'2 3':null,
      fillColor:matrixTypeColour[type],fillOpacity:CELL_FILL}
    :{color:active?'#173f62':'#657588',weight:active?2.5:1.5,dashArray:'5 4',fillColor:'#b7c0ca',fillOpacity:.25};
  // cells holding the selected species get a thick solid yellow outline; the fill keeps the cell's own colour
  return selected&&g.species.has(selected.aphiaID)?{...base,...SELECTED_OUTLINE(),weight:active?4.5:3.5}:{...base,edge:active?'active':'plain'};
}
// 2026-10-13 species view: the selected species' cells only, in its own type colour with a dashed border of the same colour.
// Every drawn cell is the selected species', so no yellow outline; an untyped species keeps the held grey of the all-species map.
// A clicked cell gets a heavier border of the same colour; its fill stays the tone of the other cells (2026-10-15).
function speciesCellStyle(type,active){
  const c=matrixTypeColour[type];
  return c?{color:c,weight:active?3:1.5,dashArray:'3 3',opacity:.95,fillColor:c,fillOpacity:CELL_FILL,edge:active?'active':'plain'}
    :{color:'#657588',weight:active?2.5:1.5,dashArray:'5 4',opacity:.95,fillColor:'#b7c0ca',fillOpacity:.25,edge:active?'active':'plain'};
}
// Typed species whose MCUI is a national list (Korean or range state): the cell colour then rests on a national assessment.
const nationalTyped=g=>[...g.species.values()].filter(s=>matrixType(s)&&extinctionSeparate(s)&&!subNationalMcui(s)&&!preliminaryMcui(s)).length;
// 3.27: typed species whose BBVI carries the single-paper label
const singleTyped=g=>[...g.species.values()].filter(s=>matrixType(s)&&bbviLabel(s)&&!s.assessment?.mbpi_floor).length;
// 4.3: sub-national, Rapid LC and floor values are counted apart, never as national or single-paper
const typedNotes=g=>{const t=[...g.species.values()].filter(matrixType),n=f=>t.filter(f).length;
  return [['국가 평가 기반 MCUI',nationalTyped(g)],['지방 목록 MCUI',n(subNationalMcui)],['자체 예비평가 MCUI',n(preliminaryMcui)],['최상위 근거 독립 재현 확인 중 BBVI',singleTyped(g)],
    ['MBPI 하한값 포함 BBVI',n(s=>!!s.assessment?.mbpi_floor)]].filter(([,k])=>k).map(([l,k])=>' · '+l+' '+k+'종').join('');};
// Flagged species on the map and without a public cell, so an empty layer is explained rather than silent.
function sufficiencyCounts(groups){
  const onMap=new Set([...groups.values()].flatMap(g=>[...g.species.keys()]));
  return Object.fromEntries([['priority','priority_survey'],['unexplored','unexplored_candidate']].map(([layer,flag])=>{
    const all=(data?.species||[]).filter(s=>s.assessment?.[flag]), out=layer==='unexplored'?unexploredOutside:[];
    const outOn=new Set([...outsideCells().values()].flatMap(g=>[...g.species.keys()]));
    return [layer,{n:all.length+out.length,shown:all.filter(s=>onMap.has(s.aphiaID)).length+out.filter(s=>outOn.has(s.aphiaID)).length,
      missing:[...all.filter(s=>!onMap.has(s.aphiaID)).map(s=>s.label),...out.filter(s=>!outOn.has(s.aphiaID)).map(outsideLabel)]}];
  }));
}
function valueSpeciesCard(s,records){
  const blockers=assessmentBlockers(s),report=data.assessmentInfo||{};
  const scores=['BBVI','MFPI','MBPI','MCUI'].map(k=>{
    const st=axisState(s,k),n=st.value;
    const state=n===null?(st.kind==='withheld'?'산출 보류':st.label):scoreText(s,k,n)+(k==='MCUI'&&separateMcui(s)?' · '+mcuiBasisLabel(s)+(released()?'':' 시범')+(mcuiBacktest(s)?' · '+mcuiBacktest(s):'')+' · IUCN 기반과 비교 불가':' · '+axisTag(s,k))+(k==='BBVI'&&bbviLabel(s)?' · '+bbviLabel(s):'');
    return '<div class="value-axis"><b>'+k+'</b><span>'+esc(state)+'</span>'+(n===null?'<small>'+esc(axisStateNote[st.kind]||blockers[k]||'필수 근거 미확인')+'</small>':'')+'</div>';
  }).join('');
  const stage=evidenceCoverage(s).checks.map(c=>c.name+' '+stageName(c.stage)).join(' · ');
  const sourceIds=s.assessment?.source_ids||[];
  const sources=sourceIds.map(id=>report.sources?.[id]).filter(Boolean);
  const refIds=mcuiReference(s)?.source_ids||[];
  const links=sources.map((src,i)=>'<li>'+(refIds.includes(sourceIds.filter(id=>report.sources?.[id])[i])?'참고 정보(점수 아님) · ':'')+sourceLink(src.url,src.title||src.name||'지표 근거')+' · '+esc(src.license||'이용조건 미기재')+' · 조회 '+esc(src.accessed||'미기재')+'</li>').join('');
  const raw=s.assessment?.food_trace?.nutrients;
  const rawText=raw?Object.entries(raw).map(([k,v])=>k+' '+(v.substitute?'원자료 결측 → '+v.substitute.label+' '+substituteRef(v.substitute)+' '+num(v.value):num(v.value))+' '+(v.unit||'단위 미확인')+' / '+(v.sample_state||s.assessment.food_trace.sample_state||'시료 상태 미기재')).join(' · '):'원값은 종별 지표 상세에서 확인';
  const cons=s.assessment?.conservation_trace;
  // One line per species (name + four axis values); the evidence text opens on demand.
  const pills=['BBVI','MFPI','MBPI','MCUI'].map(k=>{const n=axisState(s,k).value;return '<span class="vs-pill'+(n===null?' held':'')+'">'+k+' '+(n===null?'–':scoreText(s,k,n))+'</span>';}).join('');
  return '<details class="value-species"><summary><h4>'+esc(s.label)+' <small>'+esc(s.name)+'</small></h4><span class="vs-pills">'+pills+'</span></summary><div class="value-species-body">'+
    '<p>종 단위 근거 · AphiaID '+esc(s.aphiaID)+' · '+esc(stage)+(Number.isFinite(records)?' · 이 셀 출현 기록 '+records.toLocaleString()+'건':'')+'</p>'+(traitTags(s)?'<p class="fine">활용 특성: '+traitTags(s)+'</p>':'')+valueSpeciesType(s)+
    '<div class="value-axes">'+scores+'</div><p class="fine">원자료(점수 아님): '+esc(rawText)+
    (nationalMcui(s)?' · 한국 국가생물적색자료집 '+esc(s.assessment.national_assessment.category)+' / 목록 '+esc(s.assessment.national_assessment.list_page_printed)+'쪽 · '+esc(iucnGlobalNote(s))
      :cons?' · IUCN '+esc(cons.category||'등급 미기재')+' / 평가 '+esc(cons.assessment_date||cons.assessment_year||'일자 미기재'):'')+'</p>'+
    '<p class="fine">평가 보고서 '+esc(report.generatedAt?.slice(0,10)||'미발행')+
    ' · 출현 자료 '+esc(s.publishedAt?.slice(0,10)||data.collectedAt||'미기재')+
    ' · 이용조건: '+esc('운영 8종 GBIF · 후보 22종 GBIF·OBIS · CC0·CC BY·CC BY-NC 4.0(CC BY-NC는 비상업 연구용)')+'</p>'+
    (links?'<details><summary>지표 근거 원문과 이용조건</summary><ul>'+links+'</ul></details>':'<p class="fine">이 종에 연결된 지표 근거 원문은 아직 없습니다.</p>')+
    '<button type="button" class="text-button" data-value-species="'+esc(s.aphiaID)+'">종별 상세 근거 보기 →</button></div></details>';
}
function showValueCell(key,all=false){
  selectedValueCell=key;
  const group=valueCellGroups(all).get(key),panel=$('value-cell-detail');
  if(!group){panel.innerHTML='<p>선택한 공개 격자가 현재 기간의 자료에 없습니다. 지도의 다른 격자를 선택하세요.</p>';return;}
  const species=[...group.species.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
  panel.innerHTML='<h3>선택한 공개 격자 · 종별 근거</h3><p>'+
    esc(cellRange(group))+' ('+esc(group.size)+'° 공개 범위)</p>'+(selectedCellLine(group)?'<p class="value-selected-line">'+esc(selectedCellLine(group))+'</p>':'')+
    cellSummaryHtml(species)+'<p class="fine">연결 종 '+species.length+'종 · 해당 공개 셀에 기록이 있는 종만 표시합니다. 지표는 종 전체에 대한 '+(released()?'값':'시범값')+'이며 이 해역에서 측정한 값이 아닙니다. 셀의 합산 점수·우선순위는 산출하지 않았습니다.'+cellTypeLine(group)+'</p>'+
    species.map(s=>valueSpeciesCard(s,group.records?.get(s.aphiaID))).join('');
  panel.querySelectorAll('[data-value-species]').forEach(button=>button.addEventListener('click',()=>{
    selectSpecies(Number(button.dataset.valueSpecies));
    const detail=$('detail');detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
}
function cellTypeLine(g){
  if(!matrixRule())return '';
  const {type,counts}=cellMatrixType(g),kinds=Object.entries(counts),typedN=kinds.reduce((n,[,k])=>n+k,0);
  if(!type)return ' 이 셀에는 매트릭스 유형을 산출한 종이 없어 회색 음영·점선 테두리(유형 미산출)로 둡니다.';
  return ` 셀 색 ${matrixTypeLabel(type)}(색을 정한 종: ${colourSpecies(g)}) · 유형 산출 ${typedN}종(${kinds.map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')})${typedNotes(g)}${g.species.size>typedN?' · 유형 미산출 '+(g.species.size-typedN)+'종':''}${kinds.length>1?' · 여러 유형이라 우선순위 규칙으로 한 색 선택':''}. ${colourRuleLine()}. 색은 출현 기록 셀 × 종 유형이며 해역의 자원량·분포가 아닙니다.`;
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
// Hovering or focusing a species card outlines the value-map cells that species is recorded in.
let valueRects=[],hoverRects=[];
function hoverSpecies(id){
  // species view: the hovered species' cells as yellow dashed outlines over the selected species' colours, gone on leave
  for(const l of hoverRects)overlay?.removeLayer(l);hoverRects=[];
  if(ownView()){
    if(!id||id===selected.aphiaID||!map)return;
    for(const g of valueCellGroups(true).values())if(g.species.has(id))
      hoverRects.push(L.rectangle([[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]],{...HOVER_OUTLINE,fill:false,interactive:false}).addTo(overlay));
    return;
  }
  for(const [g,layer,active] of valueRects){
    const on=id&&g.species.has(id);
    layer.setStyle(on?HOVER_OUTLINE:valueCellStyle(g,active));
    if(on)layer.bringToFront();
  }
}
// The map-corner 2×2 icon: hovering a type dims the other cells, clicking toggles that type in the filter (several at once).
// Display only: types, colours and counts stay the legend's.
const typeFilter=new Set();
// 2026-10-13: two views of the value map. 'species' (the default each time the mode opens) colours only the selected species'
// cells in its type colour; 'all' is the map from before, every species overlaid. Not in the link: t=value opens the species view.
let valueView='species';
const ownView=()=>mapMode==='value'&&valueView==='species'&&!!selected;
function dimTypes(id){
  if(ownView())return; // one colour on the species view; a type button switches to the all-species view
  for(const [g,layer,active] of valueRects){
    const base=valueCellStyle(g,active);
    layer.setStyle(id&&cellMatrixType(g).type!==id?{...base,opacity:.2,fillOpacity:.06}:base);
  }
}
function setValueInfo(open){$('value-legend').hidden=!open;$('value-info').setAttribute('aria-expanded',String(open));}
function renderValueMap(){
  const groups=valueCellGroups(),panel=$('value-cell-detail'),rule=matrixRule(),own=ownView();
  const typed=[...groups.values()].filter(g=>cellMatrixType(g).type).length;
  $('map-source').textContent=own?'활용 × 보전 · 선택 종 · GBIF 공개 격자':'활용 × 보전 · GBIF 공개 격자';
  const cut=data.assessmentInfo?.method?.unexplored_threshold;
  $('value-rule').textContent=rule?`${thresholdWord()}: BBVI·MCUI 각 ${rule.bbvi_threshold} 이상이면 높음(검증된 기준 아님 · BBVI는 현재 가중치에서 반올림 전 값에 적용). 여러 종이 있는 셀은 ${rule.cell_colour_precedence.map(matrixTypeLabel).join(' > ')} 순으로 한 색을 쓰고, 유형이 섞인 셀은 촘촘한 점선 테두리로 표시합니다.${Number.isFinite(cut)?` 우선 조사 대상은 필수 입력 충족 비율 평균이 ${Math.round(cut*100)}% 미만인 종${data.assessmentInfo?.method?.conservation?.no_assessment?'과, IUCN 평가가 없거나 DD이고 국가 평가도 없어 MCUI가 없는 종'+(data.assessmentInfo.method.mcui_substitutes&&!data.assessmentInfo.method.mcui_substitutes.preliminary_scored?'(예비 평가 참고 정보만 있는 종 포함)':''):''}입니다.`:''}`:'이 보고서에는 매트릭스 유형 규칙이 없어 모든 셀을 판단 보류로 둡니다.';
  $('map-review-note').textContent=rule?'공개 격자를 선택하면 그 셀에 기록된 종별 BBVI·MCUI·영양 원값·출현 기록과 근거를 볼 수 있습니다. 색은 출현 기록이 있는 셀 × 종 유형이며 해역의 자원량·분포·해역 점수가 아닙니다.':'공개 격자를 선택하면 연결 종의 식량·생리활성·보전 지표와 보류 사유를 확인할 수 있습니다. 모든 격자는 판단 보류이며 회색 음영·점선 테두리는 가치·보전 등급이 아닙니다.';
  $('map-judgment').textContent=rule?`종 유형으로 칠한 공개 격자 ${typed}곳 · 유형 산출 종이 없는 격자 ${groups.size-typed}곳(회색 음영·점선 테두리). 셀의 합산 점수나 해역 등급은 만들지 않습니다.`:'해역별 조합 분류 0곳 · 공개 격자 '+groups.size+'개 판단 보류. 종별 BBVI·MCUI 한 쌍과 검증된 해역 집계 규칙이 없어 네 유형으로 분류하지 않습니다.';
  if(own){const t=matrixType(selected);
    $('map-judgment').textContent=`${selected.label}의 공개 셀 ${spatialCells(periodView(selected)).length}곳을 `+(t?`이 종의 유형 ‘${matrixTypePlain(t)}’(${matrixTypeLabel(t)}) 색으로 칠했습니다.`:`유형 미산출(${untypedReason(selected)}) · 회색으로 칠했습니다.`)+' 유형은 종 단위 값이며 셀의 값이나 해역 등급이 아닙니다.';}
  else if(activeUses.size)$('map-judgment').textContent+=` 활용 특성 ‘${[...activeUses].map(id=>traitById(id).label).join(' × ')}’ 적용 중: 모두 만족하는 종의 셀만 색으로 칠하고, 나머지 공개 격자는 흐린 회색으로 남깁니다.`;
  if(!own&&typeFilter.size)$('map-judgment').textContent+=` 유형 보기 ‘${[...typeFilter].map(matrixTypeLabel).join(', ')}’ 적용 중: 이 유형 셀만 지도에 그립니다(셀 수는 그대로).`;
  renderValueLegend(groups,own);
  const layerCounts=sufficiencyCounts(groups);
  $('layer-priority-count').textContent=`${layerCounts.priority.n}종 · 지도 표시 ${layerCounts.priority.shown}종`;
  $('layer-unexplored-count').textContent=`${layerCounts.unexplored.n}종 · 지도 표시 ${layerCounts.unexplored.shown}종`;
  const noCell=[['우선 조사 대상',layerCounts.priority],['미탐색 후보',layerCounts.unexplored]].filter(([,c])=>c.missing.length);
  $('layer-nocell').textContent=noCell.map(([name,c])=>`${name} 중 공개 출현 셀이 없어 지도에 표시되지 않는 종 ${c.missing.length}종: ${c.missing.join(', ')}`).join(' · ')+
    (noCell.length?'. 셀이 없다는 것은 종 부재나 분포 없음을 뜻하지 않습니다.':'');
  if(own)return renderSpeciesValueMap();
  $('map-count').textContent='—';$('map-cells').textContent=String(groups.size);$('map-years').textContent='—';
  setMapChip(null,`모든 종 겹쳐 보기 · 공개 격자 ${groups.size}곳`+(selected?` · ${selected.label} 셀 ${[...groups.values()].filter(g=>g.species.has(selected.aphiaID)).length}개(노란 실선)`:''));
  if(!groups.size)panel.innerHTML=activeUses.size?'<h3>조건을 모두 만족하는 종의 격자 없음</h3><p>선택한 활용 특성을 모두 가진 종이 없습니다. 종 목록에서 마지막 항목을 끄거나 전체 해제하세요.</p>'
    :'<h3>공개 격자 없음</h3><p>이 자료와 기간에는 공개된 출현 격자가 없어 종을 해역에 연결할 수 없습니다. 종 목록에서 개별 근거를 확인하세요.</p>';
  else{
    if(!selectedValueCell||!groups.has(selectedValueCell))selectedValueCell=groups.keys().next().value;
    showValueCell(selectedValueCell);
    if(selected?.catalog&&!selected.cells.length)$('value-cell-detail').insertAdjacentHTML('afterbegin','<p class="catalog-alert">선택한 종은 공개 가능한 출현 격자가 없어 아래 격자와 연결되지 않습니다. 격자를 누르면 다른 종의 근거를 볼 수 있습니다.</p>');
  }
  if(!map)return;
  // Cells the chips leave out stay as faint grey, so the map shows where the result is and where it is not.
  if(activeUses.size)for(const g of valueCellGroups(true).values())if(!groups.has(valueCellKey(g.lat,g.lon,g.size)))
    cellShape(g.lat,g.lon,g.size,{color:'#8a96a3',opacity:.35,weight:1,fillColor:'#b7c0ca',fillOpacity:.2,interactive:false,edge:'plain'}).addTo(overlay);
  for(const [key,g] of valueCellOrder(groups)){
    const active=key===pickedValueCell,{type,counts}=cellMatrixType(g),mixed=Object.keys(counts).length>1;
    if(typeFilter.size&&!typeFilter.has(type))continue;
    const layer=cellShape(g.lat,g.lon,g.size,valueCellStyle(g,active)).addTo(overlay);
    valueRects.push([g,layer,active]);
    const untyped=g.species.size-Object.values(counts).reduce((n,k)=>n+k,0);
    // range, colour and who set it, the selected species' own type, then the counts and the colour rule
    const sel=selectedCellLine(g),counted=(type?(mixed?'유형 혼재 ':'')+Object.entries(counts).map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')+typedNotes(g)+(untyped?' · 유형 미산출 '+untyped+'종':''):'')+cellSummaryTip([...g.species.values()])+sufficiencyTip(g);
    layer.bindTooltip((g.size>=4?wideCellNote([...g.species.values()].map(x=>x.label).join(', '))+'<br>':'')+cellRange(g)+' · 공개 '+g.size+'° 격자 · '+g.species.size+'종<br>'+(type?'<b>색 '+matrixTypeLabel(type)+'</b>(색을 정한 종: '+esc(colourSpecies(g))+')':'유형 산출 종 없음')+
      (sel?'<br><b>'+esc(sel)+'</b>':'')+'<br>'+counted.replace(/^ · /,'')+(rule?'<br>'+colourRuleLine():''),{className:'value-tip'});
    layer.on('tooltipopen',({tooltip:t})=>placeTip(t));
    drawSufficiency(g);
    // renderMap redraws the cells, so the tapped cell's tooltip opens again on its new layer (touch has no hover)
    layer.on('click',()=>{pickedValueCell=key;showValueCell(key);renderMap();valueRects.find(([x])=>valueCellKey(x.lat,x.lon,x.size)===key)?.[1].openTooltip();panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  // Outside candidates have no score and no type: a marker per public cell, hidden while use chips filter the species.
  if(sufficiencyLayers.unexplored&&!activeUses.size)for(const g of outsideCells().values()){
    const names=[...g.species.values()].map(outsideLabel);
    L.circleMarker(cellCentre(g),{color:'#6b3fa0',fillColor:'#efe6fa',radius:5,weight:2,dashArray:'2 2',fillOpacity:.9})
      .bindTooltip(`미탐색 후보(30종 밖) ${names.length}종 · ${esc(names.join(', '))} · 점수 없음, 근연종 BBVI를 옮기지 않음`).addTo(overlay);
  }
  renderOutsideList();
  if(groups.size&&lastFitted!=='value'){
    lastFitted='value';
    map.fitBounds([...groups.values()].flatMap(g=>[[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]]),
      {...fitPad(35),maxZoom:7,animate:false});
  }
}
// The species view: the selected species' cells (period filter only; the use chips select species, not cells) in its type
// colour. The panel opens on its first cell and lists every species there; the flags and the outside candidates stay as in
// the all-species view. Only a cell the user clicked (pickedValueCell, cleared on a new species) is drawn as chosen: the panel's
// first cell is not, or one cell (mostly Jeju's) stood out from the rest for no reason the map could explain (2026-10-15).
function renderSpeciesValueMap(){
  const s=selected,id=s.aphiaID,pv=periodView(s),t=matrixType(s),panel=$('value-cell-detail');
  const mine=new Map([...valueCellGroups(true)].filter(([,g])=>g.species.has(id))),n=spatialCells(pv).length;
  const verdict=t?`${matrixTypePlain(t)}(${matrixTypeLabel(t)})`:`유형 미산출(${untypedReason(s)})`;
  $('map-count').textContent=n?cellRecords(pv).toLocaleString():'—';$('map-cells').textContent=String(n);$('map-years').textContent=n?cellYears(pv):'—';
  setMapChip(s,n?`기록 셀 ${n}개 · ${cellRecords(pv).toLocaleString()}건 · ${cellYears(pv)}`:'공개 셀 없음 · '+verdict);
  if(!mine.size)panel.innerHTML='<p class="catalog-alert">선택한 종은 공개 가능한 출현 격자가 없어 지도에 칠할 셀이 없습니다. 셀이 없다는 것은 종 부재나 분포 없음을 뜻하지 않습니다. ‘모든 종 겹쳐 보기’에서 다른 종의 격자를 볼 수 있습니다.</p>';
  else{if(!mine.has(selectedValueCell))selectedValueCell=mine.keys().next().value;showValueCell(selectedValueCell,true);}
  if(!map)return;
  for(const [key,g] of valueCellOrder(mine)){
    const active=key===pickedValueCell,cellType=cellMatrixType(g).type,k=g.records.get(id);
    const layer=cellShape(g.lat,g.lon,g.size,speciesCellStyle(t,active)).addTo(overlay);
    valueRects.push([g,layer,active]);
    const flags=sufficiencyTip(g).replace(/^ · /,'');
    layer.bindTooltip((g.size>=4?wideCellNote(s.label)+'<br>':'')+cellRange(g)+' · 공개 '+g.size+'° 격자<br><b>'+esc(s.label)+(Number.isFinite(k)?' 기록 '+k.toLocaleString()+'건':'')+'</b> · '+esc(verdict)+
      '<br>이 셀의 다른 종 '+(g.species.size-1)+'종 · ‘모든 종 겹쳐 보기’ 색: '+esc(cellType?matrixTypeLabel(cellType):'유형 미산출')+(flags?'<br>'+esc(flags):''),{className:'value-tip'});
    layer.on('tooltipopen',({tooltip:x})=>placeTip(x));
    drawSufficiency(g);
    layer.on('click',()=>{pickedValueCell=key;showValueCell(key,true);renderMap();valueRects.find(([x])=>valueCellKey(x.lat,x.lon,x.size)===key)?.[1].openTooltip();panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  if(sufficiencyLayers.unexplored&&!activeUses.size)for(const g of outsideCells().values()){
    const names=[...g.species.values()].map(outsideLabel);
    L.circleMarker(cellCentre(g),{color:'#6b3fa0',fillColor:'#efe6fa',radius:5,weight:2,dashArray:'2 2',fillOpacity:.9})
      .bindTooltip(`미탐색 후보(30종 밖) ${names.length}종 · ${esc(names.join(', '))} · 점수 없음, 근연종 BBVI를 옮기지 않음`).addTo(overlay);
  }
  renderOutsideList();
  if(lastFitted!=='value:'+id){
    lastFitted='value:'+id;
    if(mine.size)map.fitBounds([...mine.values()].flatMap(g=>[[g.lat,g.lon],[g.lat+g.size,g.lon+g.size]]),{...fitPad(35),maxZoom:7,animate:false});else fitMap();
  }
}
// The map sits under the floating legend and mode bar (#map is its own stacking context, so z-index cannot lift a tooltip over
// them): open the tooltip on the side that leaves the most of it inside the map and outside those boxes.
function placeTip(t){
  const boxes=['.map-ui-bl','.map-ui-tl','#map-chip'].map(s=>document.querySelector(s)?.getBoundingClientRect()).filter(b=>b?.width),m=map.getContainer().getBoundingClientRect(),i=mapInsets();
  const frame={left:m.left+i.left,right:m.right-i.right,top:m.top,bottom:m.bottom}; // the floating panels hide the map's sides
  const cut=(a,b)=>({left:Math.max(a.left,b.left),right:Math.min(a.right,b.right),top:Math.max(a.top,b.top),bottom:Math.min(a.bottom,b.bottom)});
  const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
  const seen=()=>{const r=cut(t.getElement().getBoundingClientRect(),frame);return area(r)-boxes.reduce((n,b)=>n+area(cut(r,b)),0);};
  let best=['auto',-1];
  for(const d of ['auto','right','left','top','bottom']){t.options.direction=d;t.update();const v=seen();if(v>best[1])best=[d,v];}
  t.options.direction=best[0];t.update();
}
// The 2×2 legend: report labels, the map's own colours and fill, and the cell count per type (sums to the public cells).
function renderValueLegend(groups,own=false){
  const rule=matrixRule(),tally={},alpha=Math.round(CELL_FILL*255).toString(16),mine=own?[...valueCellGroups(true).values()].filter(g=>g.species.has(selected.aphiaID)).length:0;
  let none=0;
  // the counts follow the colours drawn: the species view has one colour on its own cells, the all-species view one per cell
  if(own){const t=matrixType(selected);if(t)tally[t]=mine;else none=mine;}
  else for(const g of groups.values()){const t=cellMatrixType(g).type;if(t)tally[t]=(tally[t]||0)+1;else none++;}
  const ownType=own?matrixType(selected):null;
  document.querySelectorAll('#value-legend [data-key]').forEach(el=>{
    const t=rule?.types?.[el.dataset.key],c=matrixTypeColour[t?.id];if(!t)return;
    el.querySelector('b').textContent=t.label;el.querySelector('em').textContent=(tally[t.id]||0)+'셀';
    el.style.background=c+alpha;el.style.borderColor=c;
    // the map-corner icon takes the same label, colour and count (short name above the count; the count keeps its own span)
    const mini=document.querySelector(`.vm-grid [data-key="${el.dataset.key}"]`);
    mini.innerHTML=`<span class="vm-name" aria-hidden="true">${esc(TYPE_SHORT[t.id]||'')}</span><span class="vm-n">${tally[t.id]||0}</span>`;mini.dataset.type=t.id;mini.dataset.tip=t.label;
    mini.ariaLabel=`${t.label} ${tally[t.id]||0}셀 · 누르면 `+(own?'모든 종 겹쳐 보기에서 ':'')+'이 유형만 보기';
    mini.style.background=c+alpha;mini.style.borderColor=c;
    mini.classList.toggle('vm-own',own&&ownType===t.id);mini.classList.toggle('vm-zero',own&&ownType!==t.id);
    mini.setAttribute('aria-pressed',String(!own&&typeFilter.has(t.id)));
  });
  $('v-none-count').textContent=none+'셀';
  // Name the selected species and draw the swatch in the map's own outline colour, so the outline explains itself.
  const n=selected?[...groups.values()].filter(g=>g.species.has(selected.aphiaID)).length:0;
  $('v-selected-name').textContent=selected?` · 지금: ${selected.label} ${n}셀`:'';
  const sw=document.querySelector('#value-legend .v-selected');
  sw.style.borderColor=own?matrixTypeColour[ownType]||'#657588':SELECTED_OUTLINE().color;sw.style.borderStyle=own?'dashed':'';
  $('v-selected-all').hidden=own;$('v-selected-species').hidden=!own;
  // the one-line key under the species list: what the cell colour is in this view, and the switch between the views
  const key=$('value-key-swatch'),c=matrixTypeColour[ownType];
  // all-species view: the four type colours as the corner icon lays them out, in the selected species' yellow outline
  const quad=['high_bbvi_high_mcui','high_bbvi_low_mcui','low_bbvi_low_mcui','low_bbvi_high_mcui'].map((k,i)=>`${matrixTypeColour[rule?.types?.[k]?.id]||'#b7c0ca'}${alpha} ${i*25}% ${i*25+25}%`).join(',');
  const wideOwn=own&&selected.cells.some(x=>x.sizeDeg>=4); // 2026-10-14: a 4° species' cells are outlines only
  key.className='vk-swatch'+(own?(c?'':' none'):' all')+(wideOwn?' wide':'');key.style.background=own?(wideOwn?'transparent':c?c+alpha:''):`conic-gradient(${quad})`;key.style.borderColor=own&&c?c:'';
  $('value-key-text').innerHTML=!own?'셀 색 = 그 셀에 기록된 종 중 우선순위 첫 유형 · 노란 실선 = 선택 종'
    :ownType?`셀 색 = ${esc(selected.label)}의 유형 ${verdictWord(ownType)} <span class="vk-type">(${esc(matrixTypeLabel(ownType))})</span>`
    :`셀 색 = 회색 · ${esc(selected.label)}: ${verdictWord(null)} <span class="vk-type">(${esc(untypedReason(selected))})</span>`;
  $('value-view').setAttribute('aria-pressed',String(!own));
  if(!rule)return;
  $('v-axis-x').textContent=`BBVI(활용가치) → · ${thresholdWord()} ${rule.bbvi_threshold}`;
  $('v-axis-y').textContent=`MCUI(보전 시급성) → · ${thresholdWord()} ${rule.mcui_threshold}`;
  $('v-rule-line').textContent=own?'셀 색 = 선택 종의 유형(종 단위, 셀 값 아님)':colourRuleLine();
}
// Method tab: one row per type in the colour precedence, then the untyped cell. Thresholds come from the report.
function renderTypeTable(){
  // 4.14 (prereg-4.14-2026-10-14 9): how many species change type between food weights 0.2 · 0.5 · 0.8 (the method section)
  // 4.16: the species whose top MBPI item is independently replicated, and those with a replication the rules did not count
  const er=$('method-ev-replicated');if(er&&data){const by=st=>data.species.filter(s=>evProfile(s)?.top_item_replication===st);const rp=by('replicated'),tr=by('attempted_not_counted');
    er.textContent=`${data.species.length}종 중 ${rp.length}종${rp.length?'('+rp.map(s=>s.label).join(', ')+')':''}${tr.length?`, 재현 기록이 있으나 기준 외인 종은 ${tr.length}종(${tr.map(s=>s.label).join(', ')})`:''}`;}
  const wc=$('method-weight-changes');if(wc&&data){const xs=weightTypeChanges();wc.textContent=`${xs.length}종`+(xs.length?`(${xs.map(s=>s.label).join(', ')})`:'');}
  const rule=matrixRule(),body=document.querySelector('#type-table tbody');if(!body)return;
  if(!rule){body.innerHTML='<tr><td colspan="5">이 보고서에는 매트릭스 유형 규칙이 없어 모든 셀을 판단 보류(회색)로 둡니다.</td></tr>';return;}
  const key=id=>Object.keys(rule.types).find(k=>rule.types[k].id===id),cmp=(id,i)=>key(id).split('_')[i]==='high'?'≥':'<';
  const alpha=Math.round(CELL_FILL*255).toString(16),sw=(bg,bd)=>`<i class="type-swatch" style="background:${bg};border-color:${bd}"></i>`;
  body.innerHTML=rule.cell_colour_precedence.map((id,i)=>`<tr><td>${sw(matrixTypeColour[id]+alpha,matrixTypeColour[id])}</td><td><b>${esc(matrixTypePlain(id))}</b> · ${esc(matrixTypeLabel(id))}</td>`+
    `<td>BBVI ${cmp(id,0)} ${rule.bbvi_threshold} · MCUI ${cmp(id,2)} ${rule.mcui_threshold}</td><td>${esc(thresholdWord())} BBVI ${rule.bbvi_threshold} · MCUI ${rule.mcui_threshold} (같은 값은 높음)</td>`+
    `<td>우선순위 ${i+1}위${i?'':' · 이 유형 종이 하나라도 있으면 이 색'}</td></tr>`).join('')+
    `<tr><td>${sw('rgba(183,192,202,.25)','#657588')}</td><td>${esc(rule.untyped_label||'유형 미산출')}</td><td>BBVI·MCUI 한 쌍 미산출(보전평가 미확인 포함)</td><td>—</td><td>유형을 산출한 종이 없는 셀 · 회색 점선</td></tr>`;
}
function renderOutsideList(){
  const box=$('unexplored-outside');if(!box)return;
  box.hidden=!unexploredOutside.length;
  if(!unexploredOutside.length)return;
  const bbvi=r=>`${r.label} BBVI ${Number(r.BBVI).toFixed(1)}`;
  box.innerHTML=`<summary>30종 밖 미탐색 후보 ${unexploredOutside.length}종 목록 · 점수 없음</summary><p class="fine">지도 범위에 기록이 있고, BBVI가 ${esc(data?.assessmentInfo?.method?.unexplored_candidates?.relative_min_bbvi??50)} 이상(기본 가중치 w = ${esc(data?.assessmentInfo?.foodWeight??0.5)} 기준)인 30종과 같은 속인 종입니다. 이 종들의 지표는 수집하지 않았고 근연종 점수를 옮기지 않습니다. 조사 단서이지 발견이 아닙니다.</p><ul>`+
    unexploredOutside.map(s=>`<li><b>${esc(s.koreanName||s.name)}</b>${s.koreanName?` <i>${esc(s.name)}</i>`:''} · 같은 속 ${esc(s.relatives.map(bbvi).join(', '))} · 공개 셀 ${new Set(s.cells.map(c=>valueCellKey(c.lat0,c.lon0,c.sizeDeg))).size}곳${s.cells.length?` · 기록 ${s.cells.reduce((n,c)=>n+(c.records||0),0).toLocaleString()}건`:s.review?.status==='fetch_check_failed'?' · GBIF 기록 수 대조 불일치로 셀 미표시':' · 공개 가능한 기록 없음'}</li>`).join('')+'</ul>';
}
function setMapMode(mode){
  if(!['occurrence','value'].includes(mode))return;
  mapMode=mode;lastFitted=null;
  if(mode==='value'){valueView='species';typeFilter.clear();pickedValueCell=null;} // 2026-10-13: the value mode opens on the selected species' cells
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode)));
  $('occurrence-legend').hidden=mode==='value';$('value-mini').hidden=mode!=='value';setValueInfo(false);
  // the legend box stays in both modes: the occurrence key with its fold button, or the one-line value key with the view switch
  $('legend-toggle').hidden=mode==='value';$('value-key').hidden=mode!=='value';
  $('value-cell-detail').hidden=mode!=='value';
  $('effort-toggle').disabled=mode==='value';
  renderMap();writeHash();
}

// Short status next to the map so phones see name, published/candidate and index summary without reaching the detail pane.
function renderMapSelected(s){
  const where=s.catalog&&s.cells.length?s.status+' · 현재 분포 아님':s.status;
  $('map-selected').innerHTML=`<b>${esc(s.label)}</b> <span class="kind${s.catalog?' cand':''}">${s.catalog?'조사 후보':'운영 발행'}</span> <span>${esc(scoreSummary(s))} · ${esc(where)}</span>`;
  sheetSummary(s);
}
function renderMap() {
  if(selected)renderMapSelected(selected);
  renderPeriodFilter(selected);
  if(mapMode==='value'){$('cell-table').innerHTML='';}else renderCellTable(periodView(selected)); // before the map check: the table also works when the map failed to load
  if(map)map.invalidateSize(); // the detail pane can change the map column height
  overlay?.clearLayers();dotCells=[];cellLayers=[];valueRects=[];occurrenceSpecies=null;
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
  if(s.catalog){if(matrixRule())mapJudgmentStatus(s);else $('map-judgment').textContent=(pilotScore(s,'MBPI')!==null?'종별 '+P_()+'MBPI만 산출 · BBVI·MCUI와 해역 판단 보류 · ':'종별 점수와 해역 판단 모두 보류 · ')+(s.review?'공개 가능한 출현기록 없음':'출현 '+releaseMissing(s));$('map-review-note').textContent=s.review?`${reviewLine(s.review)}. 제외 사유: ${withheldLine(s.review)}. 셀이 없는 것은 종 부재나 전체 분포를 뜻하지 않습니다.`:'출현 검수 파일을 확인하지 못해 셀을 표시하지 않습니다. 종 부재가 아닙니다.';
    $('map-count').textContent='—';$('map-cells').textContent='0';$('map-years').textContent='—';setMapChip(s,'공개 셀 없음');return;}
  mapJudgmentStatus(s);
  $('map-review-note').textContent='테두리는 자료를 조회한 범위(124–132°E · 33–38.7°N)입니다. 이 종의 출현 위치나 분포를 뜻하지 않습니다.';
  L.rectangle(studyBounds,{color:'#ffd166',weight:2,dashArray:'10 7',fillColor:'#267bab',fillOpacity:.07})
    .addTo(overlay).bindPopup(`<strong>${esc(s.label)} · 자료 조회 범위</strong><br>124–132°E · 33–38.7°N<br><small>출현 위치나 분포 범위가 아닙니다.</small>`);
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;const i=mapInsets();map.fitBounds(studyBounds,{paddingTopLeft:[30+i.left,30],paddingBottomRight:[30+i.right,30],animate:false});}
  $('map-count').textContent='0';$('map-cells').textContent='0';$('map-years').textContent='—';setMapChip(s,'공개 셀 없음');
}

function fitMap(){if(!map)return;const i=mapInsets();map.fitBounds([[30,122],[43,136]],{paddingTopLeft:[8+i.left,8],paddingBottomRight:[8+i.right,8]});}
// Evidence popups pan into the part of the map the floating panels leave free (read by Leaflet each time a popup opens).
function syncPopupPad(){const i=mapInsets();L.Popup.prototype.options.autoPanPaddingTopLeft=L.point(i.left+10,10);L.Popup.prototype.options.autoPanPaddingBottomRight=L.point(i.right+10,10);}

// Background maps: satellite (NASA GIBS Blue Marble with shaded relief and bathymetry, the default) and depth (GEBCO WMS).
// 2026-10-11 design concept: the relief and the shelf/deep-sea shading of that Blue Marble read through the navy tint (theme.css).
// basic (bundled Natural Earth 1:10m outline) has had no button since 2026-10-03: the map falls back to it, and says so, only when external tiles fail to load.
let basemapLayers, lastFitted;
function initBasemaps(geography){
  map.createPane('basePane').style.zIndex=250; // above tiles, below cells
  // 2026-10-11 navy redesign: the outline fallback is navy sea (the #map background) with blue-grey land.
  const land=L.geoJSON(geography,{pane:'basePane',interactive:false,style:{fillColor:'#263d47',color:'#4d6b79',weight:1,fillOpacity:1}});
  const outline=L.geoJSON(geography,{pane:'basePane',interactive:false,style:{fill:false,color:'#d8e6ee',weight:.8,opacity:.5}});
  const grid=L.layerGroup();
  for(let lat=25;lat<=50;lat+=5)L.polyline([[lat,110],[lat,150]],{pane:'basePane',color:'#3c5a6c',weight:.5,opacity:.6,interactive:false}).addTo(grid);
  for(let lon=115;lon<=145;lon+=5)L.polyline([[22,lon],[52,lon]],{pane:'basePane',color:'#3c5a6c',weight:.5,opacity:.6,interactive:false}).addTo(grid);
  // Offline demo (live-data.js): the same imagery saved beforehand as tiles under offline-tiles/ (scripts/offline/prepare-offline.ps1).
  const offline=globalThis.BBVM_OFFLINE===true;
  const satellite=L.tileLayer(offline?'offline-tiles/satellite/{z}/{y}/{x}.jpeg':'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    {maxNativeZoom:8,maxZoom:8,attribution:'NASA GIBS · Blue Marble'});
  const depth=offline?L.tileLayer('offline-tiles/depth/{z}/{x}/{y}.png',{maxNativeZoom:8,maxZoom:8,attribution:'GEBCO_2026 Grid · 항해용 아님'})
    :L.tileLayer.wms('https://wms.gebco.net/mapserv?',{layers:'gebco_latest',format:'image/png',version:'1.3.0',
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
function savedBasemap(){try{return localStorage.getItem('basemap');}catch{return null;}}
function setBasemap(name,failed=false){
  if(!failed&&name!=='depth')name='satellite'; // also a 'basic' stored or linked before 2026-10-03
  for(const layers of Object.values(basemapLayers))for(const l of layers)map.removeLayer(l);
  for(const l of basemapLayers[name])l.addTo(map);
  basemap=name;
  $('map').classList.toggle('map-dark',name!=='basic');
  $('map').dataset.tiles=name; // theme.css tints the tiles per basemap (satellite toward navy; depth only darker, no hue shift)
  document.querySelectorAll('[data-basemap]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.basemap===name)));
  const warn=!failed?'':globalThis.BBVM_OFFLINE===true?'오프라인 시연: 저장된 배경 지도가 없어 경계선만 있는 지도로 바꿨습니다.':'배경 지도를 불러오지 못해 경계선만 있는 지도로 바꿨습니다.';
  // the fallback note is a small ⚠ beside 위성·수심 (tooltip and label carry the sentence); #basemap-status keeps the text for checks
  $('basemap-status').textContent=warn;$('basemap-status').classList.toggle('fallback',failed);
  $('basemap-warn').hidden=!failed;$('basemap-warn').title=warn;$('basemap-warn').setAttribute('aria-label',warn||'배경 지도 상태');
  try{if(!failed)localStorage.setItem('basemap',name);}catch{}
  renderMap();writeHash();
}

function initMap(geography){
  prepareLandMask(geography);
  const still=!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // no zoom or fade animation then
  map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:8,scrollWheelZoom:false,maxBounds:[[20,105],[53,150]],maxBoundsViscosity:.7,zoomAnimation:!still,fadeAnimation:!still,markerZoomAnimation:!still});L.control.zoom({position:'bottomright'}).addTo(map);fitMap();
  syncPopupPad();map.on('resize',syncPopupPad);
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
  map.on('zoomend',drawOccurrence);
  map.attributionControl.setPrefix('Leaflet');map.attributionControl.addAttribution('OBIS · GBIF');fitMap();setBasemap(savedBasemap());
}

function renderComparison(){
  const compared=cmpSorted(), keep=$('comparison').scrollLeft, keepTop=$('comparison').scrollTop;
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
    const mbpiLabel=key==='MBPI'&&value!==null?basisNote(s,key).replace(/^ · /,'')||null:key==='BBVI'&&value!==null?bbviLabel(s):key==='MFPI'&&value!==null?s.assessment.food_trace?.literature_moisture?.label||null:null;
    // 4.14: another country's list is named as such, never as a Rapid LC 'likely' category
    const mcuiRef=key==='MCUI'&&value===null&&mcuiReference(s)?(r=>r.basis==='range_state'?`다른 나라 평가 참고 · ${r.record?.country_ko||r.record?.country||''} ${r.record?.category_as_published||r.category} · 점수 아님`
      :`자체 예비검토 참고 · 공식 평가 아님${rapidLcCheck()?' · '+rapidLcCheck():''} · 점수 아님`)(mcuiReference(s)):null;
    const reference=key==='BBVI'&&value===null?bbviReference(s):null;
    if(reference!==null)return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} BBVI 참고값 ${reference.toFixed(1)} · ${esc(s.assessment.mbpi_label||'최상위 근거 독립 재현 확인 중')} · 점수·매트릭스 미사용 근거 보기">`+
      `${reference.toFixed(1)}<small>BBVI 참고값 · ${esc(s.assessment.mbpi_label||'최상위 근거 독립 재현 확인 중')} · 점수·매트릭스 미사용 · 보기</small>`+(s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')+'</button>';
    return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${value===null?status:scoreText(s,key,value)}${mbpiLabel?' · '+esc(mbpiLabel):''}${cohort?' · '+esc(cohortLabel)+' 고정 비교집단 · 다른 집단과 비교 불가':''}${mcuiRef?' · '+esc(mcuiRef):''}${key==='MCUI'&&value!==null&&separateMcui(s)?' · '+esc(mcuiBasisLabel(s))+' · '+esc(axisLabel(s,key))+(subNationalMcui(s)&&mcuiBacktest(s)?' · '+esc(mcuiBacktest(s)):''):''} 근거 보기">`+
      `${value===null?esc(status):scoreText(s,key,value)}<small>${value===null?esc(shortReason[s.assessment.withheld_reasons?.[key]]||'근거·보류 사유')+' · 보기':axisLabel(s,key)+(mbpiLabel?' · '+esc(mbpiLabel):'')+' · 근거 보기'}</small>`+
      (cohort?`<small>고정 비교집단 ${esc(cohortLabel)}${cohortCount?' '+cohortCount+'개 식품':''} · 집단 간 점수 비교 불가</small>`:'')+
      (key==='MCUI'&&separateMcui(s)?'<small>'+esc(mcuiBasisLabel(s))+(subNationalMcui(s)&&mcuiBacktest(s)?' · '+esc(mcuiBacktest(s)):'')+' · IUCN 기반 MCUI와 비교 불가</small>':'')+
      (mcuiRef?`<small>${esc(mcuiRef)}</small>`:'')+
      (s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')+'</button>';
  };
  function occurrenceCell(s){return s.cells.length?`${cellCountLabel(s)} · ${sitesLabel(s)} ${cellSites(s).toLocaleString()}곳<small>기록 ${cellRecords(s).toLocaleString()}건 · 공개 ${s.cells[0].sizeDeg}° 셀 · ${s.info?.map?.source||'GBIF CC0·CC BY'}${flaggedRecords(s,'historical')?` · 2000년 이전 ${flaggedRecords(s,'historical')}건`:''}</small>`:s.catalog?pending(s.review?`${reviewLine(s.review)} · 공개 셀 없음`:releaseMissing(s)):s.noOccurrences?pending('미수집'):!Number.isSafeInteger(s.recordCount)?pending('기록 수 미확인'):`${s.recordCount.toLocaleString()}건 · 조사 범위 표시<small>${years(s)} · 조회·선별된 자료</small>`;}
  const fallback={
    MFPI:s=>s.catalog&&s.audit?.nutrition?.foodCode?pending('RDA 식품명 후보 · 종 연결 보류'):v2(s,({nutrition:n={}})=>n.status==='available'?`영양 기록 ${count(n.record_count)}<small>수집 현황 · 단위/가식부 검증 전 · 기준량 가정 ${count(n.basis_assumed_count)}</small>`:pending(n.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인'),
    MBPI:s=>v2(s,({compounds:c={}})=>c.status==='available'?`보고 화합물 ${count(c.compound_count,'개')}<small>${c.quantitative_bioactivity_count===0?'정량 활성 자료 없음':'정량 활성 자료 '+count(c.quantitative_bioactivity_count)}</small>`:pending(c.status==='not_collected'?'미수집':'정보 없음'),'자료 미확인'),
    MCUI:s=>s.catalog&&s.audit?.iucn?.record?.category?pending('IUCN 체크리스트 '+s.audit.iucn.record.category+' · 점수 보류'):v2(s,({conservation:k={}})=>pending({withheld_insufficient_evidence:'근거 부족으로 보류',not_reviewed:'미검토'}[k.status]||'정보 없음'),IUCN_HISTORICAL[s.aphiaID]?'산출 보류':'평가 미조회')+(IUCN_HISTORICAL[s.aphiaID]?`<small>IUCN ${IUCN_HISTORICAL[s.aphiaID].category} · ${IUCN_HISTORICAL[s.aphiaID].published}년 발표 · 역사적 평가 · 현행 평가 확인 보류</small>`:''),
    BBVI:()=>'<strong>산출 보류</strong>'};
  const titles={MFPI:'식량 근거 · MFPI',MBPI:'생리활성 · MBPI',BBVI:'통합점수 · BBVI',MCUI:'보전 평가 · MCUI'};
  const rule=matrixRule(), cut={BBVI:rule?.bbvi_threshold,MCUI:rule?.mcui_threshold};
  // the compact cell: the same button (attributes and aria-label) with the number and a bar; the full button goes to 자세히
  const valueCell=(s,key)=>{
    const full=axisCell(s,key);if(!full)return {main:fallback[key](s),more:''};
    const m=full.match(/^<button([^>]*)>([^<]*)<small>/);if(!m)return {main:full,more:''};
    const v=pilotScore(s,key);
    const bar=v!==null?`<span class="cv-bar${key==='MCUI'&&cut.MCUI!=null&&v>=cut.MCUI?' hi':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i>${cut[key]!=null?`<b style="left:${cut[key]}%"></b>`:''}</span>`:'<small>보기</small>';
    const off=key==='BBVI'?officialNote(s):'';
    const stock=key==='MCUI'&&stockMcui(s)?`<i class="cv-stock" title="${esc(stockLabel(s))} · IUCN 기반과 같은 척도가 아님" aria-hidden="true">◆</i>`:'';
    return {main:`<button${m[1].replace('class="score-cell"','class="score-cell cv"')}><span class="cv-num${v===null?' cv-word':''}">${m[2]}${stock}${off?`<small class="cv-official">(${off})</small>`:''}</span>${bar}</button>`,
      more:full.replace('class="score-cell"','class="score-cell cmp-more-cell"').replace('data-score-aphia=','data-more-aphia=').replace('data-score-axis=','data-more-axis=')};
  };
  // 4.10: the secondary MBPI-Rx, a number and a bar (no evidence button: its line and reason sit under the detail's MBPI);
  // '–' when the species has none. Its sort key keeps those rows last in both directions.
  const rxCell=s=>{const r=mbpiRxOf(s);return r&&r.value!==null?`<span class="cv rx-cv"><span class="cv-num">${r.value.toFixed(1)}</span><span class="cv-bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,r.value))}%"></i></span></span>`
    :'<span class="cv rx-cv"><span class="cv-num rx-none" aria-hidden="true">–</span><span class="sr-only">의약 표적 근거 없음</span></span>';};
  const rxMore=s=>{const r=mbpiRxOf(s),v=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI_RX;if(!r)return null;
    const check=['passed','failed'].includes(v?.result)?` · 사후 검증 ${v.result==='passed'?'통과':'기준 미충족'}(탐색적 재검토)`:'';
    return r.value===null?`의약 표적 근거 없음<small>${esc(r.reason)}${check} · 점수 아님</small>`:`${r.value.toFixed(1)}<small>${esc(r.stratum.short)}${check} · MBPI·BBVI에 쓰지 않음</small>`;};
  // 2026-10-13 dark data table: the plain verdict over the formal type name, in the type colour ([data-type] --qt in compare.css)
  const typeBadge=s=>{const t=matrixType(s);return t?`<span class="dt-type" data-type="${t}" title="${esc(matrixPlainNote())}"><b><i aria-hidden="true"></i>${esc(matrixTypePlain(t))}</b><small>${esc(matrixTypeLabel(t))}</small></span>`
    :'<span class="dt-type none"><b>유형 미산출</b><small>매트릭스 미배치</small></span>';};
  const sortTh=(key,label)=>{const on=cmpSort.key===key;return `<th scope="col" aria-sort="${on?(cmpSort.dir==='asc'?'ascending':'descending'):'none'}"><button type="button" class="cmp-sort" data-sort="${key}">${label}<i aria-hidden="true">${on?(cmpSort.dir==='asc'?'↑':'↓'):'↕'}</i></button></th>`;};
  // The expanded row: BBVI as the sum it is (current weight), the MCUI basis sentence, the public cells; then the evidence-level
  // chips, then every long label the cells used to carry, folded. All words come from the same helpers as the detail pane.
  const wk=weightStep(bbviWeight), wFood=(wk/W_STEPS).toFixed(2), wBio=((W_STEPS-wk)/W_STEPS).toFixed(2);
  const bbviBox=s=>{
    const v=pilotScore(s,'BBVI'), f=pilotScore(s,'MFPI'), b=pilotScore(s,'MBPI');
    if(v===null||f===null||b===null||!VERIFIED.includes(s.assessment?.report_version))
      return `<p class="dt-x-main">${esc(axisState(s,'BBVI').label)}</p><p class="dt-x-sub">${esc(shortReason[s.assessment?.withheld_reasons?.BBVI]||'근거·보류 사유는 BBVI 값을 눌러 봅니다')}</p>`;
    // the same mix as pilotScore, on the shown one-decimal inputs; '≈' where the unrounded inputs (4.14) give another last digit
    const f1=Number(f.toFixed(1)), b1=Number(b.toFixed(1)), calc=round1(bbviWeight*f1+(1-bbviWeight)*b1);
    return `<p class="dt-x-main dt-x-sum">${wFood} × MFPI ${f1.toFixed(1)} + ${wBio} × MBPI ${b1.toFixed(1)} ${calc===v?'=':'≈'} <b>${v.toFixed(1)}</b></p>`+
      `<p class="dt-x-sub">${esc([axisLabel(s,'BBVI'),'탐색적 합성지표',bbviLabel(s),calc!==v?'반올림 전 MFPI·MBPI로 계산해 마지막 자리가 다름':'',officialNote(s)?'탐색 보기 · '+officialNote(s):''].filter(Boolean).join(' · '))}</p>`;
  };
  const mcuiBox=s=>{
    const c=evidenceCoverage(s).checks.find(x=>x.name==='보전'), v=pilotScore(s,'MCUI');
    const sub=v===null?shortReason[s.assessment?.withheld_reasons?.MCUI]||'근거·보류 사유는 MCUI 값을 눌러 봅니다'
      :[axisLabel(s,'MCUI'),separateMcui(s)?mcuiBasisLabel(s)+(subNationalMcui(s)&&mcuiBacktest(s)?' · '+mcuiBacktest(s):'')+' · IUCN 기반 MCUI와 비교 불가':mcuiBasisLabel(s)].join(' · ');
    // 4.17 (prereg-4.17 5): a preliminary assessment is named in the species detail, not in the table
    const main=earlyMcui(s)?(stockMcui(s)?stockLead(s):`보전 평가 범주를 확인해 ${released()?'정식':'시범'} MCUI를 산출했습니다. 평가 근거는 종 상세에서 볼 수 있습니다.`):c?.detail||'';
    return `<p class="dt-x-main">${esc(main)}</p><p class="dt-x-sub">${esc(sub)}</p>`;
  };
  const occBox=(s,occ)=>(s.cells.length?`<p class="dt-x-main">공개 ${s.cells[0].sizeDeg}° 셀 ${spatialCells(s).length.toLocaleString()}곳 · 기록 ${cellRecords(s).toLocaleString()}건</p><p class="dt-x-sub">기록 수는 개체수·자원량이 아닙니다.</p>`:`<p class="dt-x-main">${occ}</p>`)+
    `<button type="button" class="score-cell dt-x-link" data-score-aphia="${s.aphiaID}" data-score-axis="OCC" aria-label="${esc(s.label)} 출현기록 지도·셀 목록 보기">탐색 지도에서 보기 <span aria-hidden="true">→</span></button>`;
  const chipRow=s=>{
    const list=evidenceChipList(s), cov=evidenceCoverage(s).checks.find(x=>x.name==='보전');
    if(cov?.stage==='checked_none')list.push('보전 '+stageName(cov.stage));  // the coverage column left the table; this stage stays
    return `<div class="dt-x-ev"><b>근거 수준</b>${list.length?list.map(c=>`<span class="ev-chip${/예비평가|역검증|평가 없음/.test(c)?' warn':''}">${esc(c)}</span>`).join(''):'<span class="ev-chip none">추가 라벨 없음</span>'}</div>`;
  };
  const row=s=>{
    const id=s.aphiaID, cells=Object.fromEntries(['MFPI','MBPI','BBVI','MCUI'].map(k=>[k,valueCell(s,k)])), occ=occurrenceCell(s), open=cmpOpen.has(id), rx=rxMore(s);
    const more=[['학명·식별자',`WoRMS 확인<small>${esc(s.name)} · AphiaID ${id}</small>`+(s.catalog?'<small>조사 후보 · 운영 8종과 별도</small>':'')],['출현기록',occ],
      ...['MFPI','MBPI','BBVI','MCUI'].flatMap(k=>[...cells[k].more?[[titles[k],cells[k].more]]:[],...k==='MBPI'&&rx?[['의약 후보 MBPI · 보조, 탐색적',rx]]:[]])];
    return `<tr class="cmp-row" data-aphia="${id}"><th scope="row"><b>${esc(s.label)}</b><small>${esc(s.name)}</small><span class="dt-meta">${esc(s.group)} · ${s.catalog?'조사 후보':'운영 발행'}</span></th><td class="cmp-type">${typeBadge(s)}</td>`+
      ['MFPI','MBPI','BBVI','MCUI'].map(k=>`<td class="cmp-val" data-k="${k}">${cells[k].main}</td>`+(k==='MBPI'?`<td class="cmp-val cmp-rx">${rxCell(s)}</td>`:'')).join('')+
      `<td class="cmp-x"><button type="button" class="cmp-more-btn" aria-expanded="${open}" aria-controls="cmp-more-${id}" aria-label="${esc(s.label)} 근거 자세히"><svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></td></tr>`+
      `<tr class="cmp-more" id="cmp-more-${id}"${open?'':' hidden'}><td colspan="8"><div class="dt-x"><div class="dt-x3"><section><h4>BBVI 계산</h4>${bbviBox(s)}</section><section><h4>MCUI 기반</h4>${mcuiBox(s)}</section><section><h4>출현 기록</h4>${occBox(s,occ)}</section></div>${stockDeclineDetail(s,true)}${chipRow(s)}`+
      `<details class="dt-x-all" data-aphia="${id}"${cmpAllOpen.has(id)?' open':''}><summary>지표별 근거 전문 <small>비교집단 · 라벨 · 원문 근거</small></summary><div class="cmp-more-grid">${more.map(([t,h])=>`<div><h4>${t}</h4>${h}</div>`).join('')}</div></details></div></td></tr>`;
  };
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 ${data.species.length}종의 지표와 유형 · 정렬: ${cmpSortLabel()}</caption>`+
    `<thead><tr>${sortTh('name','종')}<th scope="col" class="cmp-type-h">유형</th>${sortTh('MFPI','MFPI<small>식량</small>')}${sortTh('MBPI','MBPI<small>생리활성</small>')}${sortTh('MBPI_RX','MBPI-Rx<small>보조·탐색적</small>')}`+
    `${sortTh('BBVI',`BBVI<small>탐색적 합성${cut.BBVI!=null?' · 구분선 '+cut.BBVI:''}</small>`)}${sortTh('MCUI',`MCUI<small>보전${cut.MCUI!=null?' · 구분선 '+cut.MCUI:''}</small>`)}<th scope="col" class="cmp-x-h"><span class="sr-only">근거 자세히</span></th></tr></thead>`+
    `<tbody>${(d=>compared.map((s,i)=>d[i]+row(s)).join(''))(cmpDividers(compared,8))}</tbody></table>`;
  $('comparison').querySelectorAll('[data-score-aphia]').forEach(button=>button.addEventListener('click',()=>
    openEvidence(Number(button.dataset.scoreAphia),button.dataset.scoreAxis)));
  $('comparison').querySelectorAll('[data-more-aphia]').forEach(button=>button.addEventListener('click',()=>
    openEvidence(Number(button.dataset.moreAphia),button.dataset.moreAxis)));
  $('comparison').querySelectorAll('.cmp-more-btn').forEach(button=>button.addEventListener('click',()=>{
    const id=Number(button.closest('tr').dataset.aphia),open=!cmpOpen.has(id);open?cmpOpen.add(id):cmpOpen.delete(id);
    button.setAttribute('aria-expanded',String(open));$('cmp-more-'+id).hidden=!open;}));
  $('comparison').querySelectorAll('details.dt-x-all').forEach(d=>d.addEventListener('toggle',()=>{const id=Number(d.dataset.aphia);d.open?cmpAllOpen.add(id):cmpAllOpen.delete(id);}));
  $('comparison').querySelectorAll('.cmp-sort').forEach(button=>button.addEventListener('click',()=>{
    const k=button.dataset.sort, first=k==='name'?'asc':'desc';
    cmpSort=cmpSort.key!==k?{key:k,dir:first}:cmpSort.dir===first?{key:k,dir:first==='asc'?'desc':'asc'}:{key:null,dir:null};
    renderComparison();$('comparison').querySelector(`[data-sort="${k}"]`)?.focus();}));
  $('comparison').scrollLeft=keep;$('comparison').scrollTop=keepTop;if(typeof applyCompareFilter==='function')applyCompareFilter();syncComparison();
}
// A species picked elsewhere (comparisonFocus) is scrolled into the table box and briefly highlighted once the tab is visible.
function syncComparison(){
  const c=$('comparison'),shown=c.clientWidth>0;
  if(shown&&comparisonFocus){
    const tr=c.querySelector(`tr.cmp-row[data-aphia="${comparisonFocus}"]`),head=c.querySelector('thead');
    if(tr&&head){c.scrollTop+=tr.getBoundingClientRect().top-head.getBoundingClientRect().bottom-4;tr.classList.remove('flash');void tr.offsetWidth;tr.classList.add('flash');}
    comparisonFocus=null;
  }
  cmpPageLine();
}
// '총 n종': the rows the search, group and type filters leave in the table (cmpRowShown sits with the compare code below)
function cmpPageLine(){
  const n=typeof cmpRowShown==='function'?data.species.filter(cmpRowShown).length:data.species.length;
  $('comparison-page').textContent=`총 ${n}종 · 정렬: ${cmpSortLabel()}`;
}
// Design 05 (2026-10-10): one row per species, sortable columns. Value cells keep their evidence buttons (number + thin bar,
// the full label in aria-label); every long line that used to sit in a cell moves, unchanged, to the row's "자세히" panel.
let cmpSort={key:null,dir:null};const cmpOpen=new Set(), cmpAllOpen=new Set();
const CMP_SORT_NAME={name:'이름순',MFPI:'MFPI',MBPI:'MBPI',MBPI_RX:'MBPI-Rx',BBVI:'BBVI',MCUI:'MCUI'};
const cmpSortLabel=()=>!cmpSort.key?'기본 순서(운영 발행 → 조사 후보)':cmpSort.key==='name'?(cmpSort.dir==='asc'?'이름 가나다순':'이름 역순'):`${CMP_SORT_NAME[cmpSort.key]||cmpSort.key} ${cmpSort.dir==='desc'?'높은 순':'낮은 순'}${CMP_MIXED_NOTE[cmpSort.key]?' (탐색적 · 검증된 우열 아님)':cmpGroup(data.species[0],cmpSort.key)!==null?(cmpSort.key==='MFPI'?' (비교집단별)':' (층별)'):''}`;
// 4.14 (prereg-4.14-2026-10-14 8): MFPI is a percentile inside its RDA cohort and MBPI inside its item's stratum, so a sort on
// either groups the rows by cohort or stratum and orders them only inside a group; '' = no value (last)
const COHORT_KO=id=>/seaweed/.test(id||'')?'해조류':/animal/.test(id||'')?'수산동물':id||'';
function cmpGroup(s,k){
  if(k==='MFPI')return pilotScore(s,'MFPI')===null?'':'비교집단 '+COHORT_KO(s.assessment?.food_trace?.cohort_id);
  if(k==='MBPI')return mbpiStratumOf(s)?'층 '+mbpiStratumOf(s).short:'';
  if(k==='MBPI_RX'){const r=mbpiRxOf(s);return r?.value!=null&&r.stratum?'층 '+r.stratum.short:'';}
  return null;
}
const CMP_MIXED_NOTE={BBVI:'탐색적 합성지표 · 비교집단이 다른 점수를 섞은 순서 · 검증된 우열 아님',
  MCUI:'평가 범위·근거가 다른 값(IUCN 전 지구·한국 국가·자원 감소 신호)을 섞은 순서 · 검증된 우열 아님 · MCUI가 없는 종은 맨 뒤'};
function cmpSorted(){
  const list=data.species.map((s,i)=>[s,i]);if(!cmpSort.key)return data.species.slice();
  const k=cmpSort.key, sign=cmpSort.dir==='asc'?1:-1, grouped=cmpGroup(data.species[0],k)!==null;
  const order=new Map();if(grouped)for(const s of data.species){const g=cmpGroup(s,k);if(g&&!order.has(g))order.set(g,order.size);}
  const rank=s=>{const g=cmpGroup(s,k);return g?order.get(g):Infinity;};
  list.sort(([a,i],[b,j])=>{
    if(k==='name')return sign*a.label.localeCompare(b.label,'ko')||i-j;
    if(grouped&&rank(a)!==rank(b))return rank(a)-rank(b);
    const val=s=>k==='MBPI_RX'?mbpiRxOf(s)?.value??null:pilotScore(s,k), x=val(a),y=val(b);
    if(x===null||y===null)return (x===null)-(y===null)||i-j;  // values without a score (MBPI-Rx '–' too) stay last in both directions
    return sign*(x-y)||i-j;});
  return list.map(([s])=>s);
}
// the divider rows of a sorted table: a group head before each cohort or stratum, or the mixed-order notice on top
function cmpDividers(list,cols){
  const k=cmpSort.key;if(!k||k==='name')return list.map(()=>'');
  if(CMP_MIXED_NOTE[k])return list.map((s,i)=>i?'':`<tr class="cmp-group mixed"><th colspan="${cols}" scope="rowgroup">${esc(CMP_MIXED_NOTE[k])}</th></tr>`);
  let last;return list.map(s=>{const g=cmpGroup(s,k)||'값 없음';if(g===last)return '';last=g;
    return `<tr class="cmp-group"><th colspan="${cols}" scope="rowgroup">${esc(g)} · 이 묶음 안에서만 순서${k==='MFPI'?' · 다른 비교집단의 같은 백분위는 같은 영양 수준이 아님':g!=='값 없음'?' · 다른 층의 같은 백분위는 같은 효능이 아님':''}</th></tr>`;});
}
// the labels a species carries, one short chip each (never folded into one "단일 논문 vs 정식" switch)
function evidenceChipList(s){
  const a=s.assessment||{}, chips=[];
  if(pilotScore(s,'MFPI')!==null&&a.food_trace?.literature_moisture?.label)chips.push('MFPI '+a.food_trace.literature_moisture.label);
  if(pilotScore(s,'MBPI')!==null){if(a.mbpi_label)chips.push('MBPI '+a.mbpi_label);const k=bestBio(a)?.stratum_kind;if(k==='xo')chips.push('MBPI XO 문헌 비교집단');if(k==='relaxed')chips.push('MBPI 완화 산출(d)');}
  if(bbviLabel(s))chips.push('BBVI '+bbviLabel(s));
  if(pilotScore(s,'MCUI')!==null&&separateMcui(s)){chips.push('MCUI '+mcuiBasisLabel(s).replace(/ 기반$/,''));if(mcuiBacktest(s))chips.push('MCUI '+mcuiBacktest(s));}
  return chips;
}
function evidenceChips(s){
  const chips=evidenceChipList(s);
  return chips.length?chips.map(c=>`<span class="ev-chip">${esc(c)}</span>`).join(''):'<span class="ev-chip none">추가 라벨 없음</span>';
}
// One open behaviour for every comparison button: occurrence opens the map and cell list, an index axis
// opens its evidence. Collapsed parents are opened, and the return button restores the horizontal scroll and focus.
// from: a selector of the button outside the table that opened it (compare profile, side-by-side view); the return goes
// back to that view and button. Without it the return restores the table as before.
function openEvidence(aphia,axis,from=null){
  const returnScroll=$('comparison').scrollLeft, returnTop=$('comparison').scrollTop, returnMode=cmpMode;
  if(axis==='OCC'){lastFitted=null;if(mapMode!=='occurrence')setMapMode('occurrence');}
  selectSpecies(aphia);setView('explore',false);
  const back=document.createElement('button');
  back.type='button';back.className='text-button comparison-return';back.textContent=from?'← 비교와 지표로 돌아가기':'← 비교표로 돌아가기';
  $('detail').prepend(back);
  back.addEventListener('click',()=>{
    setView('compare');
    if(from){setCompareMode(returnMode);if(from.startsWith('#cmp-dialog-body')&&cmpBasket.length>1)openCompareDialog();const b=document.querySelector(from);b?.focus({preventScroll:true});b?.scrollIntoView({block:'center'});return;}
    setCompareMode('table');
    const cell=$('comparison').querySelector(`[data-score-aphia="${aphia}"][data-score-axis="${axis}"]`), more=cell?.closest('tr.cmp-more');
    if(more?.hidden){cmpOpen.add(aphia);more.hidden=false;$('comparison').querySelector(`tr.cmp-row[data-aphia="${aphia}"] .cmp-more-btn`)?.setAttribute('aria-expanded','true');} // the map button sits in the expanded row
    $('comparison').scrollTop=returnTop;
    cell?.focus({preventScroll:true});cell?.scrollIntoView({block:'center'});
    $('comparison').scrollLeft=returnScroll;
  });
  const target=axis==='OCC'?($('cell-table').querySelector('details')||$('detail-map-summary')):$('detail').querySelector(`[data-axis="${axis}"]`);
  if(!target){back.focus();return;}
  if(target.closest('.detail-fold.folded')){detailOpen=true;syncFolds();} // asked for this evidence: open '근거 자세히 보기'
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
  if($('cmp-w-status'))$('cmp-w-status').textContent='비교집단은 고정됩니다 · '+$('bbvi-weight-status').textContent;
  document.querySelectorAll('[data-w-preset]').forEach(b=>b.disabled=!n);
  syncWeightControl();
}
const matrixReasonLabel={food_row_not_species_specific:'종별 식품 원값 연결 필요',component_missing_in_source:'필수 영양 성분 결측',not_in_red_list:'공식 평가 없음(IUCN·국가 목록 확인)',assessment_lookup_failed:'IUCN 원평가 조회 필요',origin:'기원종',structure_id:'확정 구조',quantitative_endpoint:'정량 시험',comparable_cohort:'동일 조건 비교집단',species_link:'식품 행의 종 연결',raw_nutrition:'영양 원값',complete_raw_nutrition:'단백질·철·아연 원값',edible_fraction:'가식부 비율',aquaculture:'양식 근거',fixed_comparable_cohort:'고정 비교집단',comparable_nutrition_missing:'고정 비교집단의 종 행',requires_MFPI_and_MBPI:'MFPI·MBPI 둘 다 필요',mbpi_single_source:'MBPI 독립 원논문 부족',aquaculture_method_unverified:'양식 근거',category_not_numeric:'IUCN DD · 숫자 없음'};
function matrixBlockerText(s){
  const row=matrixReadiness.get(s.aphiaID);
  if(!row||row.scientific_name!==s.name)return scoreSummary(s);
  const reason=row.axis_reasons;
  const food=row.scores.MFPI===null?`MFPI ${Array.isArray(reason.MFPI)?reason.MFPI.map(k=>matrixReasonLabel[k]||k).join('·'):(matrixReasonLabel[reason.MFPI]||reason.MFPI)}`:null;
  const bio=row.scores.MBPI===null?`MBPI ${row.bioactivity_missing_steps.map(k=>matrixReasonLabel[k]||k).join('·')}`:null;
  const cons=row.scores.MCUI===null?`MCUI ${reason.MCUI==='not_in_red_list'?'공식 평가 없음(IUCN·국가 목록 확인)':row.scope==='expansion_22'?'IUCN 원평가 검수 필요':'IUCN 원평가 확인 필요'}`:null;
  // Computed pilot values come first, so a held axis never hides a value the report did calculate.
  const done=['MFPI','MBPI','MCUI'].filter(k=>pilotScore(s,k)!==null).map(k=>`${k} ${scoreText(s,k,pilotScore(s,k))}`);
  // A national MCUI is placed only from verified-pilot-3.2 (marked apart); say which, or a species with every axis looks placeable.
  const national=row.scores.MCUI!==null&&row.mcui_basis==='national'?(matrixRule()?.include_national_mcui?'MCUI 한국 국가 평가 · BBVI가 생기면 매트릭스에 구분 표시':'MCUI 한국 국가 평가 · IUCN 매트릭스 제외'):row.scores.MCUI!==null&&['range_state','sub_national','preliminary'].includes(row.mcui_basis)?((matrixRule()?.include_substitute_mcui||[]).includes(row.mcui_basis)?`MCUI ${(({sub_national:'지방 목록 참고값',preliminary:'자체 예비평가'})[row.mcui_basis]||'서식국 국가 평가')} · BBVI가 생기면 매트릭스에 구분 표시`:`MCUI ${(({sub_national:'지방 목록 참고값',preliminary:'자체 예비평가'})[row.mcui_basis]||'서식국 국가 평가')} · 매트릭스·지도 색 제외`):null;
  return [...done,food,bio,cons,national].filter(Boolean).join(' / ');
}
function toggleSimulation(value){
  closeClusterPop(false);simulated=value;$('simulate').setAttribute('aria-pressed',String(value));$('simulate').textContent=value?'가상 예시 닫기':'가상 작동 예시 보기';$('matrix-note').classList.toggle('simulating',value);$('compare').classList.toggle('simulating',value);
  const assessed=data?.species.filter(assessedForMatrix)||[];
  $('matrix-note').innerHTML=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`${released()?'정식 산출':'시범 지표'} ${assessed.length}종 · BBVI와 MCUI가 모두 산출된 종만 표시합니다.${matrixRule()?' 점 색은 그 종의 유형 색이고, 같은 높이에 몰린 점은 위아래로 조금 비켜 놓은 뒤 짧은 선으로 실제 높이를 가리킵니다.':''}${assessed.some(s=>bbviLabel(s)&&!s.assessment?.mbpi_floor)?' 속이 빈 점은 MBPI 최상위 항목이 다른 연구팀 논문으로 재현되지 않은 BBVI(최상위 근거 독립 재현 확인 중)입니다. 그 종의 논문 수와는 다른 표시입니다.':''}${assessed.some(s=>s.assessment?.mbpi_floor)?' 회색 점선 테두리의 빈 점은 MBPI 하한값(0, 효능 근거 미확인)이 들어간 BBVI입니다.':''}${assessed.some(separateMcui)?' MCUI 기반은 점 툴팁과 아래 유형별 목록에 적습니다.'+(n=>n?' '+n+' 기반 MCUI는 IUCN 기반과 같은 척도가 아닙니다.':'')([assessed.some(nationalMcui)?'한국 국가 평가':'',assessed.some(s=>substituteMcui(s)&&!subNationalMcui(s)&&!preliminaryMcui(s))?'서식국 국가 평가':''].filter(Boolean).join('·')):''}${assessed.some(subNationalMcui)?' 지방(현·주) 목록 참고값은 국가 평가가 없는 종에만 쓰며 '+esc(assessed.find(subNationalMcui).assessment.mcui_substitute?.record?.backtest?.label||'')+'입니다.':''}${assessed.some(preliminaryMcui)?' 자체 예비평가(Rapid LC) MCUI는 점수가 되는 공식 범주가 어디에도 없는 종에만 쓰며 역검증 기준 미충족입니다.':''}${assessed.some(stockMcui)?' 마름모 점은 KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종입니다. 어획량 추세 기반 MCUI · IUCN 기반과 같은 척도가 아님.':''} ${released()?'검증 결과'+validationNote().trim():'타당성 미검증'}.`:'실제 종의 두 축을 산출하지 못해 배치하지 않았습니다. 아래에서 종별 보류 사유와 확인된 원문을 볼 수 있습니다. <button type="button" class="link-button" id="simulate-inline">가상 작동 예시 보기 →</button>';
  $('simulate-inline')?.addEventListener('click',()=>toggleSimulation(true));
  const unplaced=value?[]:(data?.species||[]).filter(s=>!assessedForMatrix(s));
  const kinds=data?` (운영 발행 ${unplaced.filter(s=>!s.catalog).length}종 · 조사 후보 ${unplaced.filter(s=>s.catalog).length}종)`:'';
  $('matrix-unplaced').innerHTML=unplaced.length?`<b>${matrixRule()?'매트릭스 미배치':'정보 부족 · 후속조사 대상'} ${unplaced.length}종${kinds}${matrixRule()?' (BBVI·MCUI 한 쌍 없음)':''}</b><span>네 유형과 별개입니다. 낮은 가치가 아니라 두 축을 산출할 근거가 아직 없다는 뜻입니다.${matrixRule()?' 정보충분도 기준의 ‘우선 조사 대상’과는 다른 목록입니다.':''} 표시 순서는 기존 카탈로그 순서이며 가치·보전·조사 우선순위가 아닙니다. 항목별 차단 사유는 종 상세의 원문에서 확인할 수 있습니다.</span><div>${unplaced.map(s=>`<button type="button" data-aphia="${s.aphiaID}">${esc(s.label)} <small>${esc(matrixBlockerText(s))}</small></button>`).join('')}</div>`:'';
  $('matrix-unplaced').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>pickCompare(Number(b.dataset.aphia))));
  const count=$('cmp-types-count');if(count)count.textContent=value?'가상 예시를 보는 동안 비워 둡니다':`${assessed.length}종 배치${unplaced.length?` · 미배치 ${unplaced.length}종`:''} · 사분면 색 기준`;
  const points=[['A',24,74,'보전 연구 우선 검토'],['B',77,76,'활용·보전 병행 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map(s=>{const kind=separateMcui(s)?' · MCUI '+mcuiBasisLabel(s):'',type=matrixType(s),meaning=type?' / '+matrixTypeLabel(type):'';
    const one=bbviLabel(s)?` · BBVI ${bbviLabel(s)}`:'';
    return `<button data-aphia="${s.aphiaID}"${selected?.aphiaID===s.aphiaID?' aria-current="true"':''} class="matrix-point pilot${separateMcui(s)?' national':''}${stockMcui(s)?' stock':''}${subNationalMcui(s)?' subnational':''}${preliminaryMcui(s)?' rapidlc':''}${s.assessment?.mbpi_floor?' floor':''}${one?' single':''}" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%${type?';--mp:'+matrixTypeColour[type]:''}" data-b="${pilotScore(s,'BBVI')}" data-m="${pilotScore(s,'MCUI')}" data-name="${esc(s.label)}" data-type="${type||''}" title="${esc(s.label)} · ${P_()}BBVI ${unreplicated(s)?scoreText(s,'BBVI',pilotScore(s,'BBVI')):pilotScore(s,'BBVI')}${esc(one)}, MCUI ${pilotScore(s,'MCUI')}${kind}${esc(meaning)}" aria-label="${esc(s.label)} ${P_()}활용 지표 ${unreplicated(s)?scoreText(s,'BBVI',pilotScore(s,'BBVI')):pilotScore(s,'BBVI')}${esc(one)}, 보전 지표 ${pilotScore(s,'MCUI')}${kind}${esc(meaning)}. ${released()?'방법 검증 기준 미충족':'타당성 미검증'}"><span class="point-label${pilotScore(s,'BBVI')>=50?' left':''}" aria-hidden="true">${esc(s.label)}</span></button>`;}).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){pickCompare(assessed[i].aphiaID);return;}
    const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 실제 종의 평가 결과가 아니며, 분류 기준 역시 예시입니다.`;
  }));
  renderMatrixTypes(value?[]:assessed);syncCompareMatrix();
  if(!value)declutterPointLabels();
}
// Design 02: the four quadrants take a faint wash of their type colour and the rule's type name; below the graph, one box
// per type lists its species (a reading path without colour). Names are buttons that open the same evidence as the point.
// 2026-10-13 design 3: a quadrant shows its plain verdict over the formal name (never instead of it), an empty one says
// '현재 0종', and the '읽는 법' table pairs the two names with the old quadrant notes.
const QUADRANT_KEYS={q1:'low_bbvi_high_mcui',q2:'high_bbvi_high_mcui',q3:'low_bbvi_low_mcui',q4:'high_bbvi_low_mcui'};
const typeOfficial=t=>t.label.replace(/\s*·\s*/g,' · ');
function renderMatrixTypes(assessed){
  const rule=matrixRule(), box=$('matrix-types');
  for(const [q,key] of Object.entries(QUADRANT_KEYS)){
    const el=document.querySelector?.('#matrix .'+q), t=rule?.types?.[key];if(!el)continue;
    el.style.setProperty('--qc',t?matrixTypeColour[t.id]||'':'');el.classList.toggle('typed',!!t);
    if(!t)continue;
    const plain=MATRIX_PLAIN[t.id], row=document.querySelector?.(`#cmp-read-types [data-q="${q}"]`);el.dataset.type=t.id;
    if(el.querySelector('strong'))el.querySelector('strong').textContent=plain||t.label;
    if(el.querySelector('span'))el.querySelector('span').textContent=plain?typeOfficial(t):'';
    if(el.querySelector('.q-empty'))el.querySelector('.q-empty').hidden=!assessed.length||assessed.some(s=>matrixType(s)===t.id);
    if(row?.querySelector('th')){row.dataset.type=t.id;row.querySelector('th').innerHTML=`<i class="mt-sw" style="background-color:${matrixTypeColour[t.id]||''}" aria-hidden="true"></i>${esc(matrixTypePlain(t.id))}`;row.querySelector('td').textContent=t.label;}
  }
  if($('cmp-read-plain'))$('cmp-read-plain').textContent=matrixPlainNote();
  if(!box)return;
  if(!rule||!assessed.length){box.innerHTML='';return;}
  const cell=key=>{const t=rule.types[key];if(!t)return '';const list=assessed.filter(s=>matrixType(s)===t.id).sort((a,b)=>a.label.localeCompare(b.label,'ko'));
    // design 3: the plain verdict heads the card, above the box with the formal name (the box itself reads as before)
    return `<section class="mt-cell" data-type="${t.id}">${MATRIX_PLAIN[t.id]?`<p class="mt-plain">${esc(matrixTypePlain(t.id))}</p>`:''}<div class="mt-box"><b><i class="mt-sw" style="background-color:${matrixTypeColour[t.id]}" aria-hidden="true"></i>${esc(t.label)} <span>${list.length}종</span></b><div>${list.map(s=>`<button type="button" data-aphia="${s.aphiaID}"><i class="mt-dot${bbviLabel(s)?' hollow':''}" aria-hidden="true"></i>${esc(s.label)}${bbviLabel(s)?`<small class="sr-only"> · BBVI ${esc(bbviLabel(s))}</small>`:''}${separateMcui(s)?`<small> · MCUI ${esc(mcuiBasisShort(s))}</small>`:''}</button>`).join('')||'<em>없음</em>'}</div></div></section>`;};
  box.innerHTML=`<p class="mt-key"><span><i class="mt-dot" aria-hidden="true"></i> 최상위 근거 독립 재현 확인</span><span><i class="mt-dot hollow" aria-hidden="true"></i> 최상위 근거 독립 재현 확인 중</span>${assessed.some(stockMcui)?'<span><i class="mt-dot stock" aria-hidden="true"></i> 자원 감소 신호로 정한 MCUI</span>':''}<span>MCUI 기반 표시가 없으면 IUCN 기반</span></p><div class="mt-grid">${['low_bbvi_high_mcui','high_bbvi_high_mcui','low_bbvi_low_mcui','high_bbvi_low_mcui'].map(cell).join('')}</div>`;
  box.querySelectorAll('button[data-aphia]').forEach(b=>b.addEventListener('click',()=>pickCompare(Number(b.dataset.aphia))));
}
// Design 02: 17 species share MCUI 10. A point that would overlap one already placed moves up or down (alternating) by the
// least that clears it, never more than half way to the next MCUI value in use and never across the MCUI threshold; a short
// line points back to its true height. Order is fixed: BBVI ascending, then name. Title and aria-label keep the true values.
function spreadMatrixPoints(){
  const box=$('matrix-points'), frame=box?.parentElement?.getBoundingClientRect?.();
  if(!frame?.width||simulated)return;
  box.querySelectorAll('.matrix-tick').forEach(t=>t.remove());
  // design 3: a point in a 'N종 밀집' box stays at its true height (the box marks the group); the others spread as before
  const all=[...box.querySelectorAll('.matrix-point.pilot')], pts=all.filter(b=>!b.hasAttribute('data-clustered'));
  all.filter(b=>b.hasAttribute('data-clustered')).forEach(b=>{b.style.bottom=b.dataset.m+'%';b.dataset.dy=0;});
  if(!pts.length)return;
  const W=frame.width, H=frame.height, size=pts[0].offsetWidth||22, gap=size+2, r=size/2, cut=matrixRule()?.mcui_threshold;
  const rows=[...new Set(pts.map(b=>+b.dataset.m))].sort((a,b)=>a-b), placed=[];
  const order=pts.slice().sort((a,b)=>a.dataset.b-b.dataset.b||a.dataset.name.localeCompare(b.dataset.name,'ko'));
  let flip=false;
  for(const b of order){
    const m=+b.dataset.m, x=b.dataset.b/100*W, y=m/100*H, i=rows.indexOf(m);
    let up=Math.min(i<rows.length-1?(rows[i+1]-m)/200*H:Infinity,H-y-r), down=Math.min(i>0?(m-rows[i-1])/200*H:Infinity,y-r);
    if(cut!=null){if(m<cut)up=Math.min(up,(cut-m)/100*H-r);else down=Math.min(down,(m-cut)/100*H-r);}
    up=Math.max(0,Math.floor(up));down=Math.max(0,Math.floor(down));
    const clear=dy=>Math.min(Infinity,...placed.map(([px,py])=>Math.hypot(px-x,py-y-dy)));
    let dy=null, best=[-1,0];
    for(let k=0;k<=Math.max(up,down)&&dy===null;k++)for(const c of flip?[-k,k]:[k,-k]){
      if(c>up||-c>down)continue;const d=clear(c);if(d>=gap){dy=c;break;}if(d>best[0])best=[d,c];
    }
    if(dy===null)dy=best[1];
    if(dy)flip=!flip;
    placed.push([x,y+dy]);
    b.style.bottom=dy?`calc(${m}% + ${dy}px)`:m+'%';b.dataset.dy=dy;
    if(Math.abs(dy)>r){const t=document.createElement('span');t.className='matrix-tick'+(dy>0?' up':' down');t.setAttribute('aria-hidden','true');
      t.style.cssText=`left:${b.dataset.b}%;bottom:calc(${m}% + ${Math.min(0,dy)}px);height:${Math.abs(dy)}px`;box.prepend(t);}
  }
}
// 3.27: twelve points share the low-MCUI band. A label that would cover another label or point, or leave the matrix, moves
// to the other side of its point, then up or down by its own height, else hides; the point keeps its title, aria-label and click.
// 2026-10-13 design 3: a crowded group (matrixClusters) with any label that hid or needed a leader line is drawn as one dashed
// box and an 'N종 밀집 · 펼치기' button; its points keep their place (small, faint, out of the tab order, still clickable)
// and the other labels are placed again around the box. The simulated example is never grouped.
function declutterPointLabels(){
  const box=$('matrix-points'), frame=box?.parentElement?.getBoundingClientRect();  // points are placed in the .matrix frame
  if(!frame?.width)return;  // the comparison tab is hidden; setView and resize run it again
  closeClusterPop(false);
  spreadMatrixPoints();
  box.querySelectorAll('.matrix-cluster,.matrix-cluster-btn').forEach(e=>e.remove());
  box.querySelectorAll('[data-clustered]').forEach(b=>{b.removeAttribute('data-clustered');if(b.matches('.matrix-point')&&!b.hasAttribute('data-dim'))b.removeAttribute('tabindex');});
  const all=[...box.querySelectorAll('.matrix-point.pilot')];
  // design 02: right, left, above, below; then beside the point one or two label heights up or down
  const place=(l,[pos,dy])=>{l.classList.toggle('left',pos==='left');l.classList.toggle('above',pos==='above');l.classList.toggle('below',pos==='below');
    l.style.transform=pos==='above'||pos==='below'?`translate(-50%,${dy}px)`:`translateY(calc(-50% + ${dy}px))`;
    // a label moved off its point's height keeps a thin leader line back to the point
    const far=dy&&(pos==='left'||pos==='right');l.classList.toggle('far',!!far);
    if(far){const tx=pos==='left'?6:-6;l.style.setProperty('--ll',Math.hypot(tx,dy)+'px');l.style.setProperty('--la',Math.atan2(-dy,tx)+'rad');}};
  // the selected species places its name first, so its label is the one that stays (compare design, 2026-10-12)
  const sel=b=>b.getAttribute('aria-current')==='true';
  const placeLabels=(pts,extra)=>{
    const taken=[...all.map(b=>b.getBoundingClientRect()),...extra];
    const blocked=r=>r.left<frame.left||r.right>frame.right||r.top<frame.top||r.bottom>frame.bottom||
      taken.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top);
    // crowded points choose first, so the free space near a cluster goes to the cluster
    const near=b=>{const c=b.getBoundingClientRect();return pts.filter(o=>{const d=o.getBoundingClientRect();return Math.abs(d.x-c.x)<90&&Math.abs(d.y-c.y)<40;}).length;};
    for(const b of pts.slice().sort((a,c)=>sel(c)-sel(a)||near(c)-near(a)||a.dataset.b-c.dataset.b)){
      const l=b.querySelector('.point-label');if(!l)continue;
      l.classList.remove('hidden-label');
      place(l,['right',0]);
      const h=l.getBoundingClientRect().height+2;
      const fit=[['right',0],['left',0],['above',0],['below',0],['right',-h],['right',h],['left',-h],['left',h],['above',-h],['below',h],['right',-2*h],['right',2*h],['left',-2*h],['left',2*h]]
        .find(c=>{place(l,c);return !blocked(l.getBoundingClientRect());});
      if(fit)taken.push(l.getBoundingClientRect());
      else{place(l,[parseFloat(b.dataset.b)>=50?'left':'right',0]);l.classList.add('hidden-label');}
    }
  };
  placeLabels(all,[]);
  let groups=[];
  if(!simulated){
    const byId=new Map(all.map(b=>[Number(b.dataset.aphia),b])), loose=id=>{const l=byId.get(id)?.querySelector('.point-label');return !!l&&(l.classList.contains('hidden-label')||l.classList.contains('far'));};
    groups=matrixClusters(all.map(b=>({aphia:Number(b.dataset.aphia),b:+b.dataset.b,m:+b.dataset.m,type:b.dataset.type||'',selected:sel(b)}))).filter(g=>g.ids.some(loose));
    // on a narrow plot two boxed groups of one row and quadrant whose boxes would touch become one box
    const cutV=matrixRule()?.bbvi_threshold??50, px=v=>v/100*frame.width;
    groups=groups.reduce((out,g)=>{const p=out.at(-1);
      if(p&&p.m===g.m&&(p.max<cutV)===(g.max<cutV)&&px(g.min-p.max)<30)out[out.length-1]={...p,max:g.max,ids:[...p.ids,...g.ids]};else out.push(g);return out;},[]);
    if(groups.length){
      for(const id of groups.flatMap(g=>g.ids)){const b=byId.get(id);if(!b)continue;b.setAttribute('data-clustered','');b.tabIndex=-1;
        const l=b.querySelector('.point-label');if(l){l.classList.remove('far','above','below','left');l.style.transform='';l.classList.add('hidden-label');}}
      spreadMatrixPoints();  // the rest spread again without the boxed points
      // the selected label is placed again around the boxes, before the buttons; the boxes, buttons and that label are what
      // the other labels then avoid
      let keep=[];
      const shapes=drawMatrixClusters(groups,byId,frame,boxes=>{const s=all.filter(sel);placeLabels(s,boxes);return keep=s.map(b=>b.querySelector('.point-label')?.getBoundingClientRect()).filter(Boolean);});
      placeLabels(all.filter(b=>!sel(b)&&!b.hasAttribute('data-clustered')),[...shapes,...keep]);
    }
  }
  syncClusterDims();
  const hidden=all.filter(b=>!b.hasAttribute('data-clustered')&&b.querySelector('.point-label.hidden-label')).length, boxed=groups.reduce((n,g)=>n+g.ids.length,0), note=$('matrix-note');
  let line=$('matrix-hidden');
  if(!line&&note&&(hidden||boxed)){line=document.createElement('span');line.id='matrix-hidden';note.append(line);}
  if(line)line.textContent=(boxed?` 점이 몰린 ${groups.length}곳(${boxed}종)은 상자로 묶었습니다. ‘펼치기’를 누르면 종 목록이 열리고, 상자 안 점도 누를 수 있습니다.`:'')+
    (hidden?` 이름표가 겹치는 점 ${hidden}개는 이름을 숨겼습니다. 점에 마우스를 올리거나 키보드로 고르면 이름이 보이고, 누르면 종 상세가 열립니다.`:'');
}
globalThis.addEventListener?.('resize',()=>{clearTimeout(declutterPointLabels.t);declutterPointLabels.t=setTimeout(declutterPointLabels,150);});

// ---------- 비교와 지표: deep-sea layout (2026-10-12) ----------
// Presentation only: every value, label, type and placement comes from the functions above. The tab keeps its own search,
// group filter, view (matrix | table) and a basket of up to three species; none of it enters the URL (the selected species
// does, as s). A filter dims matrix points instead of removing them, and the note says how many are shown.
let cmpMode='matrix', cmpBasket=[];const cmpFilter={q:'',group:'all',type:null}, CMP_MAX=3;
const cmpById=id=>data?.species.find(s=>s.aphiaID===Number(id))||null;
const cmpMatch=s=>!!s&&(cmpFilter.group==='all'||s.group===cmpFilter.group)&&(!cmpFilter.q||[s.label,s.name,String(s.aphiaID)].some(v=>String(v).toLowerCase().includes(cmpFilter.q)));
const cmpFiltered=()=>cmpFilter.group!=='all'||!!cmpFilter.q;
// the data table also takes a type card ('none' = 유형 미산출); the matrix keeps dimming by group and search only
const cmpTypeOf=s=>matrixType(s)||'none';
const cmpRowShown=s=>cmpMatch(s)&&(!cmpFilter.type||cmpTypeOf(s)===cmpFilter.type);
const cmpCohort=s=>pilotScore(s,'MFPI')===null?null:s.assessment?.food_trace?.cohort_id||null;
const cmpCohortLabel=c=>c==='rda-10.4-raw-marine-animals'?'수산동물':c==='rda-10.4-raw-seaweeds'?'해조류':c||'';
const cmpIcon=s=>`<span class="group-icon" data-group="${esc(s.group)}" aria-hidden="true"><i></i></span>`;
// the labels that travel with one value (the same words the table's 자세히 panel uses), short and next to the number
function cmpTag(s,k){
  const info=data?.assessmentInfo||{}, parts=[axisTag(s,k,info)];
  if(k==='MFPI'&&cmpCohort(s))parts.unshift(cmpCohortLabel(cmpCohort(s))+' 비교집단');
  if(k==='BBVI'&&bbviLabel(s))parts.push(bbviLabel(s));
  if(k==='MBPI'&&mbpiStratumOf(s))parts.push(mbpiStratumOf(s).short); // 2026-10-12: the top item's stratum, as on cards and in the detail
  if(k==='MCUI'&&pilotScore(s,'MCUI')!==null)parts.push(separateMcui(s)?mcuiBasisLabel(s)+' · IUCN 기반 MCUI와 직접 비교 불가':mcuiBasisLabel(s));
  return [...new Set(parts.filter(Boolean).join(' · ').split(' · '))].join(' · ');  // 4.12: a stock basis names itself in two places
}
// 2026-10-13 design 3: one short chip beside a value's heading. MCUI shows its basis in short ('한국 국가 평가', 'IUCN 평가');
// other axes the first label piece after '정식 산출', which every species shares. The pieces are cmpTag's own words.
const cmpPieces=(s,k)=>cmpTag(s,k).split(' · ').filter(p=>p&&p!=='정식 산출');
const cmpMcuiChip=s=>pilotScore(s,'MCUI')===null?'':mcuiBasisLabel(s).replace(/\(.*\)$/,'').replace(/ 기반$/,'').replace(/^IUCN$/,'IUCN 평가');
const cmpChip=(s,k)=>k==='MCUI'&&cmpMcuiChip(s)||cmpPieces(s,k)[0]||'';
// The use labels no chip carries, on one line under the use block: the MBPI stratum first, then each remaining piece once,
// led by the axes it belongs to (참굴: 생리활성 근거: ACE 펩타이드 · BBVI·MBPI 최상위 근거 독립 재현 확인 중 · …). Nothing is dropped or new.
function cmpUseRest(s){
  const st=mbpiStratumOf(s)?.short, chip=cmpChip(s,'BBVI'), seen=new Map();
  for(const k of ['BBVI','MBPI','MFPI'])for(const p of cmpPieces(s,k)){
    if((k==='BBVI'&&p===chip)||(k==='MBPI'&&p===st))continue;
    const key=/ 비교집단$/.test(p)?'식량 비교집단: '+p.replace(/ 비교집단$/,''):p;
    seen.set(key,[...(seen.get(key)||[]),k]);
  }
  return [st?'생리활성 근거: '+st:'',...[...seen].map(([p,ks])=>p.startsWith('식량 비교집단: ')?p:ks.join('·')+' '+p)].filter(Boolean).join(' · ');
}
// '바다 탐험에서 보기': expedition.html opens a route stop by #stop=N (1-based over the route stops, which lead the file);
// a stop off the route has no such link, so the page opens with the label saying so; a species with no stop gets no link.
let cmpStops=null, cmpStopsLoad=null;
const cmpExpeditionLink=(stops,aphia)=>{if(!Array.isArray(stops))return null;const i=stops.filter(s=>s.on_route!==false&&s.cell).findIndex(s=>s.aphia_id===aphia);
  return i>=0?{href:`expedition.html#stop=${i+1}`,text:'바다 탐험에서 보기'}:stops.some(s=>s.aphia_id===aphia)?{href:'expedition.html',text:'바다 탐험 열기(항로 밖 지점)'}:null;};
function syncExpeditionLink(){
  const a=$('cmp-expedition'), go=selected?cmpExpeditionLink(cmpStops,selected.aphiaID):null;if(!a)return;
  a.hidden=!go;if(go){a.href=go.href;a.textContent=go.text;}
}
function loadCompareStops(){  // once, when the tab is first shown; a failed load only hides the link
  cmpStopsLoad??=fetch('expedition-stops.json').then(r=>r.ok?r.json():null).then(d=>{cmpStops=Array.isArray(d?.stops)?d.stops:[];},()=>{cmpStops=[];}).then(syncExpeditionLink);
}
// Crowded points: the same MCUI value on the same side of the BBVI threshold (one quadrant), chained in BBVI order while
// neighbours are under CLUSTER_GAP apart; a chain of CLUSTER_MIN or more is a candidate. The selected species never joins.
// Pure: points are [{aphia,b,m,type,selected}], groups are [{m,min,max,ids}] (ids in BBVI order; groups low MCUI first, then left to right).
const CLUSTER_GAP=4, CLUSTER_MIN=4;
function matrixClusters(points){
  const cut=matrixRule()?.bbvi_threshold??50, rows=new Map(), out=[];
  for(const p of points){if(p.selected)continue;const key=`${p.m}|${p.b>=cut}|${p.type||''}`;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(p);}
  for(const row of rows.values()){
    row.sort((a,c)=>a.b-c.b||a.aphia-c.aphia);
    let run=[];
    for(const p of row){if(run.length&&p.b-run.at(-1).b>=CLUSTER_GAP){if(run.length>=CLUSTER_MIN)out.push(run);run=[];}run.push(p);}
    if(run.length>=CLUSTER_MIN)out.push(run);
  }
  return out.map(run=>({m:run[0].m,min:run[0].b,max:run.at(-1).b,ids:run.map(p=>p.aphia)})).sort((a,c)=>a.m-c.m||a.min-c.min);
}
const fmt1=v=>String(+Number(v).toFixed(1));
// The box hugs its points (at their true height) and stops short of the BBVI threshold line and of a box beside it. Its
// button sits just above or below it, centred if it can, else slid sideways while it still covers more of its own box than
// of any other, clear of the other points, the kept label, the quadrant names and earlier buttons; on a narrow plot one or
// two rows higher; else inside its box. Pointing at or opening a button lights its box. placeKeep(boxes) places the
// selected label once the boxes are known and returns the rectangles the buttons must leave clear.
function drawMatrixClusters(groups,byId,frame,placeKeep=()=>[]){
  const box=$('matrix-points'), shapes=[], pills=[], pad=7, gap=8, cutV=matrixRule()?.bbvi_threshold??50, cut=frame.left+cutV/100*frame.width;
  const hit=(r,list)=>list.some(o=>r.left<o.right+gap&&r.right+gap>o.left&&r.top<o.bottom+gap&&r.bottom+gap>o.top);
  const inGroup=new Set(groups.flatMap(g=>g.ids));
  const free=[...box.querySelectorAll('.matrix-point.pilot')].filter(b=>!inGroup.has(Number(b.dataset.aphia))).map(b=>b.getBoundingClientRect());
  // the quadrant names' text, not their full-width boxes
  const names=[...box.parentElement.querySelectorAll('.quadrant :is(strong,span)')].filter(e=>e.textContent.trim()).map(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect();});
  const rects=groups.map(g=>{
    const rs=g.ids.map(id=>byId.get(id)?.getBoundingClientRect()).filter(Boolean), pl=Math.min(...rs.map(r=>r.left)), pr=Math.max(...rs.map(r=>r.right));
    let L=pl-pad, R=pr+pad;if(g.max<cutV)R=Math.min(R,cut-2);else L=Math.max(L,cut+2);
    return {pl,pr,L:Math.max(frame.left+1,L),R:Math.min(frame.right-1,R),T:Math.max(frame.top+1,Math.min(...rs.map(r=>r.top))-pad),B:Math.min(frame.bottom-1,Math.max(...rs.map(r=>r.bottom))+pad)};
  });
  // two boxes on one row meet half way between their nearest points
  const byLeft=rects.slice().sort((a,c)=>a.L-c.L);
  for(let i=0;i<byLeft.length;i++)for(let j=i+1;j<byLeft.length;j++){const a=byLeft[i],c=byLeft[j];
    if(a.T<c.B&&c.T<a.B&&a.R+2>c.L){const mid=(a.pr+c.pl)/2;a.R=Math.min(a.R,mid-1);c.L=Math.max(c.L,mid+1);}}
  const keep=placeKeep(rects.map(r=>({left:r.L,top:r.T,right:r.R,bottom:r.B})));
  groups.forEach((g,i)=>{
    const {L,R,T,B}=rects[i], rect=document.createElement('span');
    rect.className='matrix-cluster';rect.dataset.cluster=g.ids.join(',');rect.setAttribute('aria-hidden','true');
    rect.style.cssText=`left:${L-frame.left}px;top:${T-frame.top}px;width:${R-L}px;height:${B-T}px`;box.prepend(rect);
    const btn=document.createElement('button');  // '· 펼치기' folds away on a phone; the aria-label keeps it
    btn.type='button';btn.className='matrix-cluster-btn';btn.dataset.cluster=g.ids.join(',');btn.innerHTML=`${g.ids.length}종 밀집<span class="mcb-act"> · 펼치기</span>`;
    btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','matrix-cluster-pop');
    btn.setAttribute('aria-label',`점이 몰린 ${g.ids.length}종 · BBVI ${fmt1(g.min)}–${fmt1(g.max)} · MCUI ${fmt1(g.m)} · 종 목록 펼치기`);
    btn.addEventListener('click',()=>btn.getAttribute('aria-expanded')==='true'?closeClusterPop(true):openClusterPop(btn));
    const lit=on=>()=>rect.toggleAttribute('data-hot',on||btn.getAttribute('aria-expanded')==='true');
    btn.addEventListener('pointerenter',lit(true));btn.addEventListener('pointerleave',lit(false));btn.addEventListener('focus',lit(true));btn.addEventListener('blur',lit(false));
    box.append(btn);
    const w=btn.offsetWidth, h=btn.offsetHeight, block=[...free,...keep,...names,...pills];
    const span=(r,o)=>Math.min(r.right,o.R)-Math.max(r.left,o.L);
    const other=r=>Math.max(0,...rects.filter((o,j)=>j!==i&&o.T<B&&o.B>T).map(o=>span(r,o)));  // the boxes on its own row
    const ok=r=>r.top>=frame.top+2&&r.bottom<=frame.bottom-2&&!hit(r,block)&&span(r,rects[i])>other(r)&&!rects.some(o=>r.left<o.R&&r.right>o.L&&r.top<o.B&&r.bottom>o.T);
    const m=Math.min(24,(R-L)/2), lo=Math.max(frame.left+2,L-w+m), hi=Math.min(frame.right-w-2,R-m), cx=Math.min(Math.max((L+R-w)/2,lo),hi);
    const row=y=>[cx,...block.filter(o=>o.top<y+h+gap&&o.bottom+gap>y).flatMap(o=>[o.right+gap,o.left-gap-w])].filter(x=>x>=lo&&x<=hi)
      .sort((a,c)=>Math.abs(a-cx)-Math.abs(c-cx)).map(x=>({left:x,top:y,right:x+w,bottom:y+h}));
    const up=row(T-h-3), down=row(B+3), up2=row(T-2*h-3-gap), up3=row(T-3*h-3-2*gap);
    const ix=Math.min(Math.max((L+R-w)/2,frame.left+2),frame.right-w-2), iy=(T+B-h)/2;
    const spot=[up[0],down[0],...up.slice(1),...down.slice(1),...up2,...up3].find(r=>r&&ok(r))||{left:ix,top:iy,right:ix+w,bottom:iy+h};
    btn.style.left=spot.left-frame.left+'px';btn.style.top=spot.top-frame.top+'px';
    pills.push(spot);shapes.push({left:L,top:T,right:R,bottom:B},spot);
  });
  return shapes;
}
// '펼치기': the group's species as buttons in point order (left to right: BBVI, then name), never numbered or ranked. A row
// picks the species like its point; it leaves the group and gets its label. Esc or a click outside closes it.
function openClusterPop(btn){
  const pop=$('matrix-cluster-pop'), frame=pop?.parentElement;if(!pop||!frame)return;
  const list=btn.dataset.cluster.split(',').map(cmpById).filter(Boolean).sort((a,c)=>pilotScore(a,'BBVI')-pilotScore(c,'BBVI')||a.label.localeCompare(c.label,'ko'));
  if(!list.length)return;
  closeClusterPop(false);setBasisPop(false);setReadPop(false);
  const b=list.map(s=>pilotScore(s,'BBVI'));
  pop.innerHTML=`<p class="mc-head">BBVI ${fmt1(Math.min(...b))}–${fmt1(Math.max(...b))} · MCUI ${fmt1(pilotScore(list[0],'MCUI'))} · ${list.length}종 · 점 위치 순(왼쪽부터)</p><ul class="mc-list">${list.map(s=>{const t=matrixType(s);
    return `<li><button type="button" data-aphia="${s.aphiaID}"><i class="mc-dot${bbviLabel(s)?' hollow':''}${s.assessment?.mbpi_floor?' floor':''}" style="--mp:${t?matrixTypeColour[t]:'#a9bbc6'}" aria-hidden="true"></i><b>${esc(s.label)}</b><span>BBVI ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))} · MCUI ${fmt1(pilotScore(s,'MCUI'))}</span><small>${esc([bbviLabel(s)?'BBVI '+bbviLabel(s):'',s.assessment?.mbpi_floor?'MBPI 하한값':'',cmpMcuiChip(s)].filter(Boolean).join(' · '))}</small></button></li>`;}).join('')}</ul>`;
  pop.hidden=false;btn.setAttribute('aria-expanded','true');btn.querySelector('.mcb-act').textContent=' · 접기';syncClusterDims();
  btn.parentElement.querySelector(`.matrix-cluster[data-cluster="${btn.dataset.cluster}"]`)?.setAttribute('data-hot','');
  // beside the box (right, else left), else above it; on a phone across the screen, 8px from each edge
  const f=frame.getBoundingClientRect(), r=(btn.parentElement.querySelector(`.matrix-cluster[data-cluster="${btn.dataset.cluster}"]`)||btn).getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight, vw=document.documentElement.clientWidth;
  let left=r.right+10, top=r.top+r.height/2-h/2;
  if(left+w>Math.min(f.right,vw-8)){left=r.left-10-w;if(left<Math.max(f.left,8)){left=r.left+r.width/2-w/2;top=r.top-10-h;}}
  left=Math.min(Math.max(left,8),vw-8-w);top=Math.max(top,f.top-40);
  pop.style.left=left-f.left+'px';pop.style.top=top-f.top+'px';
  pop.querySelector('button')?.focus({preventScroll:true});
}
function closeClusterPop(focus=true){
  const pop=$('matrix-cluster-pop');if(!pop||pop.hidden)return;
  pop.hidden=true;pop.innerHTML='';
  const b=document.querySelector?.('#matrix-points .matrix-cluster-btn[aria-expanded="true"]');
  if(b){b.setAttribute('aria-expanded','false');b.querySelector('.mcb-act').textContent=' · 펼치기';b.parentElement.querySelector(`.matrix-cluster[data-cluster="${b.dataset.cluster}"]`)?.toggleAttribute('data-hot',b.matches(':hover'));if(focus)b.focus();}
}
// a group's button and its list rows dim like the points when the filter leaves none (or not that species) shown
function syncClusterDims(){
  const on=cmpFiltered();
  document.querySelectorAll?.('#matrix-points .matrix-cluster-btn').forEach(b=>b.toggleAttribute('data-dim',on&&!b.dataset.cluster.split(',').some(id=>cmpMatch(cmpById(id)))));
  document.querySelectorAll?.('#matrix-cluster-pop button[data-aphia]').forEach(b=>b.toggleAttribute('data-dim',on&&!cmpMatch(cmpById(b.dataset.aphia))));
}
function setCompareMode(mode){
  cmpMode=mode==='table'?'table':'matrix';
  $('cmp-matrix-view').hidden=cmpMode!=='matrix';$('cmp-table-view').hidden=cmpMode!=='table';
  if($('compare')?.dataset)$('compare').dataset.cmpMode=cmpMode;placeWeightSlider();
  document.querySelectorAll('[data-cmp-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cmpMode===cmpMode)));
  applyCompareFilter();
  if(cmpMode==='table'){if(data)syncComparison();}else requestAnimationFrame(declutterPointLabels);
}
function applyCompareFilter(){
  if(!data)return;
  const typed=cmpMode==='table'&&!!cmpFilter.type, on=cmpFiltered()||typed, n=data.species.filter(cmpMode==='table'?cmpRowShown:cmpMatch).length, note=$('cmp-filter-note');
  $('comparison').querySelectorAll('tr.cmp-row').forEach(tr=>{const out=!cmpRowShown(cmpById(tr.dataset.aphia));
    tr.classList.toggle('cmp-out',out);$('cmp-more-'+tr.dataset.aphia)?.classList.toggle('cmp-out',out);});
  $('matrix-points').querySelectorAll('.matrix-point.pilot[data-aphia]').forEach(b=>{const out=on&&!cmpMatch(cmpById(b.dataset.aphia));
    if(out){b.setAttribute('data-dim','');b.tabIndex=-1;}else{b.removeAttribute('data-dim');if(!b.hasAttribute('data-clustered'))b.removeAttribute('tabindex');}});
  syncClusterDims();
  $('matrix-types').querySelectorAll('button[data-aphia]').forEach(b=>b.toggleAttribute('data-dim',on&&!cmpMatch(cmpById(b.dataset.aphia))));
  renderTypeCards();syncGroupCounts();cmpPageLine();
  if(!note)return;
  note.innerHTML=!on?'':n?`${data.species.length}종 중 ${n}종 표시${cmpMode==='matrix'?' · 나머지 점은 흐리게 남겨 둡니다':''} <button type="button" class="cmp-link" data-cmp-clear>필터 해제</button>`:
    `<b>검색 결과 없음</b> · ${cmpFilter.q?'‘'+esc(cmpFilter.q)+'’에 맞는 ':''}${cmpFilter.group!=='all'?esc(cmpFilter.group)+' ':''}${typed?'‘'+esc(matrixTypePlain(cmpFilter.type==='none'?null:cmpFilter.type))+'’ 유형 ':''}생물이 없습니다. 자료 오류가 아니라 조건에 맞는 종이 없다는 뜻입니다. <button type="button" class="cmp-link" data-cmp-clear>필터 해제</button>`;
  note.classList.toggle('empty-result',on&&!n);
}
function setCompareFilter(next){
  Object.assign(cmpFilter,next);
  document.querySelectorAll('[data-cmp-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cmpType===cmpFilter.type)));
  document.querySelectorAll('[data-cmp-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cmpGroup===cmpFilter.group)));
  if($('cmp-search').value.trim().toLowerCase()!==cmpFilter.q)$('cmp-search').value=cmpFilter.q;
  applyCompareFilter();
}
// Data table (2026-10-13): five type cards counting the species the group and search leave, by the type at the current weight;
// a card keeps only its type in the table. Built once, then counts and pressed states are updated in place (focus stays).
const CMP_TYPE_ORDER=['sustainable_use','alternative_production','conservation_priority','baseline_survey'];
function renderTypeCards(){
  const box=$('cmp-type-cards');if(!box?.dataset||!data)return;
  const known=Object.values(matrixRule()?.types||{}).map(t=>t.id);
  const ids=[...CMP_TYPE_ORDER.filter(id=>known.includes(id)),...known.filter(id=>!CMP_TYPE_ORDER.includes(id)),'none'];
  if(box.dataset.ids!==ids.join()){
    box.dataset.ids=ids.join();
    box.innerHTML=ids.map(id=>`<button type="button" class="dt-card" data-cmp-type="${id}"${id==='none'?'':` data-type="${id}"`} aria-pressed="false"><span class="dt-card-name"><i aria-hidden="true"></i>${esc(matrixTypePlain(id==='none'?null:id))}</span>`+
      `<span class="dt-card-n"><b></b> 종</span><span class="dt-card-sub">${esc(id==='none'?'보전평가 미확인 등':matrixTypeLabel(id))}</span></button>`).join('');
  }
  const base=data.species.filter(cmpMatch);
  box.querySelectorAll('[data-cmp-type]').forEach(b=>{b.querySelector('.dt-card-n b').textContent=String(base.filter(s=>cmpTypeOf(s)===b.dataset.cmpType).length);
    b.setAttribute('aria-pressed',String(b.dataset.cmpType===cmpFilter.type));});
}
// species per group on the group buttons (shown in the data table only, compare.css)
function syncGroupCounts(){
  document.querySelectorAll?.('[data-cmp-group]').forEach(b=>{if(!b.querySelector)return;let n=b.querySelector('.cmp-gn');if(!n){n=document.createElement('span');n.className='cmp-gn';b.append(n);}
    const g=b.dataset.cmpGroup;n.textContent=String(data.species.filter(s=>g==='all'||s.group===g).length);});
}
// One slider: the same #bbvi-weight (handlers, steps, aria) sits in the table's tool row in 데이터 표 and goes back to the
// '비교 기준' panel in 매트릭스, so the two views never hold two weights.
let weightHome=null;
function placeWeightSlider(){
  const el=$('bbvi-weight'), slot=$('cmp-w-slot');if(!el||!slot?.append)return;
  weightHome||={parent:el.parentNode,next:el.nextSibling};
  if(cmpMode==='table'){if(el.parentNode!==slot)slot.append(el);}
  else if(el.parentNode!==weightHome.parent)weightHome.parent.insertBefore(el,weightHome.next);
  $('cmp-wrow').hidden=cmpMode!=='table';
}
// The ring, the legend and the dims follow the matrix redraw (weight, simulation) and the selected species.
function syncCompareMatrix(){
  const box=$('matrix-points');if(!data||!box?.querySelectorAll)return;
  box.querySelectorAll('.matrix-point.pilot[data-aphia]').forEach(b=>Number(b.dataset.aphia)===selected?.aphiaID?b.setAttribute('aria-current','true'):b.removeAttribute('aria-current'));
  const floor=data.species.some(s=>assessedForMatrix(s)&&s.assessment?.mbpi_floor);
  if($('cmp-legend'))$('cmp-legend').innerHTML=`<span><i class="lg-dot" aria-hidden="true"></i>최상위 근거 독립 재현 확인</span><span><i class="lg-dot hollow" aria-hidden="true"></i>최상위 근거 독립 재현 확인 중</span>${floor?'<span><i class="lg-dot floor" aria-hidden="true"></i>MBPI 하한값</span>':''}${data.species.some(s=>assessedForMatrix(s)&&stockMcui(s))?'<span title="어획량 추세 기반 MCUI · IUCN 기반과 같은 척도가 아님"><i class="lg-dot stock" aria-hidden="true"></i>자원 감소 신호 MCUI</span>':''}<span><i class="lg-dot sel" aria-hidden="true"></i>선택한 종</span>`;
  markWeightPoints();
  applyCompareFilter();
}
function syncCompareSelection(){
  if(!data||!$('cmp-profile'))return;
  renderCompareProfile();
  if(!simulated){syncCompareMatrix();if(currentView==='compare'&&cmpMode==='matrix')declutterPointLabels();}
  if($('cmp-more')&&!$('cmp-more').hidden&&selected)showCompareMore(false);
}
// a point, a list name or a table row picks the species; the profile beside the matrix follows (below it on narrow screens)
function pickCompare(id){
  if(!cmpById(id))return;
  selectSpecies(Number(id));
  if(globalThis.matchMedia?.('(max-width:1100px)').matches)$('cmp-profile').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
}
function renderCompareProfile(){
  const box=$('cmp-profile'), s=selected;if(!box)return;
  if(!data||!s){box.innerHTML='<p class="loading">자료를 불러오는 중입니다.</p>';return;}
  if(currentView==='compare')loadCompareStops();
  const t=matrixType(s), inBasket=cmpBasket.includes(s.aphiaID), full=!inBasket&&cmpBasket.length>=CMP_MAX, rule=matrixRule(), go=cmpExpeditionLink(cmpStops,s.aphiaID);
  const num=k=>{const st=axisState(s,k);return st.value===null?`<span class="cp-state">${esc(st.label)}</span>`:scoreText(s,k,st.value);};
  // design 3: the two main bars mark the type threshold (matrixRule) with a white tick; a missing value draws no bar
  const bar=(k,cut=null)=>{const v=pilotScore(s,k);return v===null?'':`<span class="cp-bar${k==='MCUI'?' sand':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i>${cut==null?'':`<b class="cp-cut" style="left:${cut}%"></b>`}</span>`;};
  const ev=(k,cls,inner)=>`<button type="button" class="${cls}" data-prof-axis="${k}" aria-label="${esc(s.label)} ${k} ${pilotScore(s,k)===null?esc(axisState(s,k).label):scoreText(s,k,pilotScore(s,k))} · ${esc(cmpTag(s,k))} · 근거 보기">${inner}</button>`;
  const sub=(k,name)=>`<div class="cp-sub">${ev(k,'cp-sub-name',`<span>${name}</span>`)}${bar(k)}${ev(k,'cp-sub-num',num(k))}</div>`;
  const chip=k=>cmpChip(s,k)?`<span class="cp-chip">${esc(cmpChip(s,k))}</span>`:'', rest=cmpUseRest(s);
  box.innerHTML=`<div class="cp-head"><div class="cp-id"><div class="cmp-eyebrow">SPECIES PROFILE</div><h2 id="cmp-profile-name">${esc(s.label)}</h2><p class="cp-latin">${esc(s.name)}</p></div>`+
    `<button type="button" id="cmp-add" class="cmp-ghost cp-add" aria-pressed="${inBasket}"${full?' aria-disabled="true"':''} aria-describedby="cmp-add-note">${inBasket?'담김 ✓':'+ 비교 담기'}</button>`+
    `<span class="cp-tile" role="img" aria-label="종 사진 없음 · ${esc(s.group)} 아이콘">${cmpIcon(s)}</span>`+
    `<span id="cmp-add-note" class="cp-add-note">${inBasket?'<span class="sr-only">다시 누르면 비교에서 빠집니다</span>':full?'최대 3종까지 담을 수 있습니다':''}</span>`+
    // the plain verdict never stands alone: the formal type name follows it (unplaced: 유형 미산출 and why)
    `<p class="cp-typeline${t?'':' none'}"${t?` data-type="${t}" title="${esc(matrixPlainNote())}"`:''}><i class="cp-sw"${t?` style="background-color:${matrixTypeColour[t]}"`:''} aria-hidden="true"></i><b>${esc(matrixTypePlain(t))}</b><span>${t?esc(matrixTypeLabel(t)):'매트릭스 미배치 · BBVI·MCUI 한 쌍 없음'}</span><span class="cp-status">${s.catalog?'조사 후보':'운영 발행'}</span></p></div>`+
    `<section class="cp-use" aria-label="활용 가치"><div class="cp-main"><h3><b>활용 가치</b> <span>BBVI</span></h3>${chip('BBVI')}${ev('BBVI','cp-big',num('BBVI'))}${bar('BBVI',rule?.bbvi_threshold)}${officialNote(s)?`<p class="cp-official">${esc(officialNote(s))} · 탐색 보기</p>`:''}</div>${sub('MFPI','식량 MFPI')}${sub('MBPI','생리활성 MBPI')}${cpMbpiKind(s)}${rest?`<p class="cp-rest">${esc(rest)}</p>`:''}${cpEvidence(s)}</section>`+
    `<section class="cp-con" aria-label="보전 필요성"><div class="cp-main"><h3><b>보전 필요성</b> <span>MCUI</span></h3>${chip('MCUI')}${ev('MCUI','cp-big',num('MCUI'))}${bar('MCUI',rule?.mcui_threshold)}</div><p class="cp-tag">${esc(cmpTag(s,'MCUI'))}</p></section>`+
    `<div class="cp-actions"><button type="button" id="cmp-open-more" class="cmp-solid" aria-expanded="${!$('cmp-more').hidden}" aria-controls="cmp-more" aria-describedby="cmp-open-more-note">근거 자세히 보기 <span aria-hidden="true">→</span></button><span id="cmp-open-more-note" class="sr-only">판단 범위·남은 확인 사항·원문을 펼칩니다 · 숫자를 누르면 그 지표의 근거</span>`+
    `<p class="cp-links">${ev('OCC','cmp-link','출현 기록 지도')}<a id="cmp-expedition" class="cmp-link" href="${go?.href||'expedition.html'}"${go?'':' hidden'}>${esc(go?.text||'바다 탐험에서 보기')}</a></p></div>`;
}
// '근거 자세히 보기': the species' follow-up text (showDecision) opens in its own region under the two panels
function cmpMoreSync(){
  const box=$('cmp-more');if(!box?.contains)return;
  const open=box.contains($('decision-detail'))&&!$('decision-detail').hidden;box.hidden=!open;$('cmp-open-more')?.setAttribute('aria-expanded',String(open));
}
function showCompareMore(focus=true){
  const s=selected;if(!s)return;
  showDecision(s);markDecisionCards(null);const panel=$('decision-detail');$('cmp-more').append(panel);panel.hidden=false;cmpMoreSync();
  if(focus){$('cmp-more').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
    const h=panel.querySelector('h3');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
}
function toggleBasket(id){
  id=Number(id);
  if(cmpBasket.includes(id))cmpBasket=cmpBasket.filter(x=>x!==id);else if(cmpBasket.length<CMP_MAX)cmpBasket=[...cmpBasket,id];else return false;
  renderCompareTray();renderCompareProfile();return true;
}
function renderCompareTray(){
  const box=$('cmp-tray');if(!box||!data)return;
  const list=cmpBasket.map(cmpById).filter(Boolean), ready=list.length>=2;
  box.classList.toggle('empty',!list.length);
  if(!list.length){box.innerHTML=`<p class="ct-empty"><b>선택한 생물 0 / ${CMP_MAX}</b> <span>프로필의 ‘+ 비교 담기’로 종을 모으면 여기서 나란히 비교할 수 있습니다.</span></p>`;return;}
  const slots=[...list.map(s=>`<li class="ct-card">${cmpIcon(s)}<span class="ct-name"><b>${esc(s.label)}</b><em>${esc(s.name)}</em></span><button type="button" class="ct-x" data-basket-remove="${s.aphiaID}" aria-label="${esc(s.label)} 비교에서 빼기">✕</button></li>`),
    ...Array.from({length:CMP_MAX-list.length},()=>`<li class="ct-slot"><button type="button" class="ct-add" data-basket-add>+ 생물 추가</button></li>`)];
  box.innerHTML=`<div class="ct-head"><h2>선택한 생물</h2><span class="ct-count">${list.length} / ${CMP_MAX}</span></div>`+
    `<button type="button" class="ct-toggle cmp-ghost" aria-expanded="${box.classList.contains('open')}" aria-controls="cmp-tray-list">담은 생물 <b>${list.length}/${CMP_MAX}</b> <span aria-hidden="true">▾</span></button><ul id="cmp-tray-list" class="ct-list">${slots.join('')}</ul>`+
    `<div class="ct-go"><button type="button" id="cmp-compare-go" class="cmp-solid" aria-disabled="${!ready}" aria-describedby="cmp-go-note">선택한 생물 비교하기 <span aria-hidden="true">→</span></button><small id="cmp-go-note">${ready?'담은 순서대로 나란히 봅니다':'2종 이상 담으면 비교할 수 있습니다'}</small></div>`;
}
// Side-by-side view of the basket. A bar is drawn only where the values share one scale: MFPI within one comparison group,
// MCUI within one assessment basis. Otherwise each value stands with its basis and "직접 비교 불가". No total, rank or pick.
function renderCompareDialog(){
  const list=cmpBasket.map(cmpById).filter(Boolean), body=$('cmp-dialog-body');if(!body)return;
  const same=(k,key)=>{const vals=list.filter(s=>pilotScore(s,k)!==null).map(key);return vals.length===list.length&&new Set(vals).size===1;};
  const together={MFPI:same('MFPI',cmpCohort),MBPI:list.every(s=>pilotScore(s,'MBPI')!==null),BBVI:list.every(s=>pilotScore(s,'BBVI')!==null),MCUI:same('MCUI',s=>s.assessment?.mcui_basis||'iucn')};
  const why={MFPI:'비교집단이 달라 직접 비교 불가',MCUI:'평가 기반이 달라 직접 비교 불가'};
  const cell=(s,k)=>{const st=axisState(s,k), v=pilotScore(s,k);
    return `<td class="cd-val">${v===null?`<span class="cp-state">${esc(st.label)}</span>`:`<b>${scoreText(s,k,v)}</b>${k==='BBVI'&&officialNote(s)?`<small class="cd-official">(${esc(officialNote(s))})</small>`:''}`}${v!==null&&together[k]?`<span class="cp-bar ${k==='MCUI'?'sand':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>`:''}<small>${esc(cmpTag(s,k))}</small>${v!==null&&!together[k]&&why[k]?`<small class="cd-no">${why[k]}</small>`:''}</td>`;};
  const row=(k,name,cls='')=>`<tr class="${cls}"><th scope="row">${name}</th>${list.map(s=>cell(s,k)).join('')}</tr>`;
  const text=(name,fn,cls='')=>`<tr class="${cls}"><th scope="row">${name}</th>${list.map(s=>`<td>${fn(s)}</td>`).join('')}</tr>`;
  const go=s=>['MFPI','MBPI','BBVI','MCUI','OCC'].map(k=>`<button type="button" class="cmp-chip" data-dlg-aphia="${s.aphiaID}" data-dlg-axis="${k}">${k==='OCC'?'출현 기록 지도':k}</button>`).join('');
  body.innerHTML=`<p class="cd-note">담은 순서대로 놓았습니다. 막대는 같은 척도일 때만 그립니다. 합계·순위·추천은 만들지 않습니다.</p><div class="cd-scroll"><table class="cd-table"><caption class="sr-only">선택한 생물 ${list.length}종 비교</caption>`+
    `<thead><tr><td></td>${list.map(s=>`<th scope="col">${cmpIcon(s)}<b>${esc(s.label)}</b><em>${esc(s.name)}</em>${matrixType(s)?`<span class="cp-type" style="--tc:${matrixTypeColour[matrixType(s)]}">${esc(matrixTypeLabel(matrixType(s)))}</span>`:''}</th>`).join('')}</tr></thead><tbody>`+
    `<tr class="cd-sec use"><th scope="rowgroup" colspan="${list.length+1}">활용 가치</th></tr>`+row('BBVI','활용 가치 BBVI','use')+row('MFPI','식량 MFPI','use')+row('MBPI','생리활성 MBPI','use')+
    text('MFPI 비교집단',s=>cmpCohort(s)?esc(cmpCohortLabel(cmpCohort(s)))+' 고정 비교집단':'—','use')+
    `<tr class="cd-sec con"><th scope="rowgroup" colspan="${list.length+1}">보전 필요성</th></tr>`+row('MCUI','보전 필요성 MCUI','con')+
    text('MCUI 평가 기반',s=>pilotScore(s,'MCUI')===null?'—':esc(mcuiBasisLabel(s)),'con')+
    text('근거 상태',s=>esc(s.catalog?'조사 후보':'운영 발행')+' · '+evidenceChips(s))+text('근거 보기',go)+`</tbody></table></div>`;
  body.querySelectorAll('[data-dlg-aphia]').forEach(b=>b.addEventListener('click',()=>{const sel=`#cmp-dialog-body [data-dlg-aphia="${b.dataset.dlgAphia}"][data-dlg-axis="${b.dataset.dlgAxis}"]`;
    $('cmp-dialog').close();openEvidence(Number(b.dataset.dlgAphia),b.dataset.dlgAxis,sel);}));
}
function openCompareDialog(){
  if(cmpBasket.length<2)return false;
  renderCompareDialog();const d=$('cmp-dialog');if(!d.open)d.showModal();d.querySelector('.cmp-dialog-close').focus();return true;
}
function setBasisPop(open){
  const pop=$('cmp-basis-pop'), b=$('cmp-basis-toggle');if(!pop)return;
  pop.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open){setReadPop(false);closeClusterPop(false);}
}
function setReadPop(open){
  const pop=$('cmp-read-pop'), b=$('cmp-read-toggle');if(!pop)return;
  pop.hidden=!open;b?.setAttribute('aria-expanded',String(open));if(open){setBasisPop(false);closeClusterPop(false);}
}
// phones drop the MBPI half so the panel title keeps its line
const updateBasisNow=()=>{const n=$('cmp-basis-now');if(n)n.innerHTML=weightOff()?weightPair().replace(/^(MBPI \S+ · )/,' · <span class="bn-long">$1</span>'):'';};
function renderCompare(){renderCompareProfile();renderCompareTray();syncCompareMatrix();updateBasisNow();}
// ---- BBVI 통합 가중치 (2026-10-13) ----
// One integer step: MFPI weight w = step/20, MBPI weight = (20 − step)/20, so the two shown weights always add up to 1.00.
// The report's food_weight is the official weight; any other step is an exploratory view and is marked as such everywhere
// a re-mixed BBVI is shown. MFPI·MBPI·MCUI, the thresholds and the unexplored candidates (report values) never move.
let weightFrame=0;
function setBbviStep(k){
  k=Number(k);k=Number.isFinite(k)?Math.max(0,Math.min(W_STEPS,Math.round(k))):weightStep(officialWeight());
  bbviWeight=k/W_STEPS;syncWeightControl();
  // a drag fires many input events: redraw once per frame
  if(data&&!weightFrame)weightFrame=(globalThis.requestAnimationFrame||(f=>setTimeout(f,16)))(()=>{weightFrame=0;redrawForWeight();});
}
function redrawForWeight(){
  const before=matrixPositions();
  renderList();renderComparison();renderDetail();toggleSimulation(simulated);renderCompareProfile();if($('cmp-dialog').open)renderCompareDialog();if(mapMode==='value')renderMap(); // cell types move with the weight; explore cards carry 활용 and the verdict
  updateBasisNow();syncWeightControl();writeHash();slideMatrixPoints(before);
}
// The panel, the badges and the list of species whose type differs from the official one.
function syncWeightControl(){
  const el=$('bbvi-weight');if(!el)return;
  const k=weightStep(bbviWeight), off=weightOff(), k0=weightStep(officialWeight());
  el.value=String(k);el.setAttribute('aria-valuetext',weightPair().replace(' · ',', '));
  el.style.setProperty('--w',k/W_STEPS*100+'%');el.style.setProperty('--w0',k0/W_STEPS*100+'%');
  $('bbvi-weight-value').textContent=weightPair();
  const [wb,wf]=weightPair().split(' · ');if($('cmp-w-bio')){$('cmp-w-bio').textContent=wb;$('cmp-w-food').textContent=wf;$('cmp-w-official').textContent=officialWeight().toFixed(2);}
  document.querySelectorAll('[data-w-preset]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.wPreset)===k)));
  document.querySelectorAll('[data-w-reset]').forEach(b=>{b.disabled=!off;if(b.id==='cmp-weight-reset')b.textContent=`공식값 ${officialWeight().toFixed(2)}으로`;});
  document.querySelectorAll('.w-badge').forEach(b=>{b.hidden=!off;const t=b.querySelector('.w-badge-text');if(t)t.textContent=`탐색 보기 · 사용자 가중치 ${weightPair()} · 공식 산출값(${officialWeight().toFixed(2)}) 아님`;});
  const floor=$('bbvi-weight-floor');if(floor)floor.hidden=!data?.species.some(s=>pilotScore(s,'BBVI')!==null&&s.assessment?.mbpi_floor);
  const moved=$('bbvi-weight-moved');if(!moved)return;
  const list=off&&data?data.species.filter(s=>matrixType(s)!==officialType(s)):[];
  moved.hidden=!off;
  moved.textContent=!off?'':list.length?`공식값과 유형이 다른 종 ${list.length}종: ${list.slice(0,6).map(s=>s.label).join(' · ')}${list.length>6?` 외 ${list.length-6}종`:''}`:'모든 종이 공식값과 같은 유형입니다.';
}
// A point whose type differs from the official one gets a dashed ring, and every re-mixed point names its official value.
function markWeightPoints(){
  const box=$('matrix-points');if(!box?.querySelectorAll||simulated)return;
  let any=false;
  box.querySelectorAll('.matrix-point.pilot[data-aphia]').forEach(b=>{
    const s=cmpById(b.dataset.aphia);if(!s)return;
    const was=officialType(s), moved=weightOff()&&was!==matrixType(s), note=officialNote(s);
    b.classList.toggle('w-moved',moved);any||=moved;
    if(note&&!b.dataset.wNote){const add=` · ${note}${moved?' · 공식 유형 '+matrixTypeLabel(was):''}`;b.title+=add;b.setAttribute('aria-label',(b.getAttribute('aria-label')||'')+add);b.dataset.wNote='1';}
  });
  // the legend is rewritten just before this runs, so the key is added at most once
  if(any)$('cmp-legend')?.insertAdjacentHTML?.('beforeend',`<span><i class="lg-dot wmove" aria-hidden="true"></i>공식값(${officialWeight().toFixed(2)})과 유형이 다른 종</span>`);
}
// The points are redrawn from scratch: each one starts where it was and slides to its new place (about 300 ms).
const matrixPositions=()=>new Map([...($('matrix-points')?.querySelectorAll?.('.matrix-point.pilot[data-aphia]')||[])].map(b=>[b.dataset.aphia,b.getBoundingClientRect()]));
function slideMatrixPoints(before){
  if(!before.size||simulated||globalThis.matchMedia?.('(prefers-reduced-motion:reduce)').matches)return;
  $('matrix-points').querySelectorAll('.matrix-point.pilot[data-aphia]').forEach(b=>{
    const r0=before.get(b.dataset.aphia), r1=b.getBoundingClientRect();if(!r0||!b.animate)return;
    const dx=r0.left-r1.left, dy=r0.top-r1.top;
    if(Math.abs(dx)>.5||Math.abs(dy)>.5)b.animate([{translate:`${dx}px ${dy}px`},{translate:'0 0'}],{duration:300,easing:'ease-out'});
  });
}
// The report's source notes (terms, licence) are written in English in the record; the method tab shows the Korean note
// from source-terms-ko.json, keyed by the English text. A note it does not hold yet is shown as written.
let sourceTermsKo={};
const memoKo=t=>t&&(sourceTermsKo[t]||t);
function renderSources(){
  const info=data.assessmentInfo;
  $('snapshot-date').textContent=$('snapshot-date').title=`발행 ${data.collectedAt}`+(info?.version?` · 지표 ${info.version}${info.generatedAt?' · 산출 '+String(info.generatedAt).slice(0,10):''}`:'');$('collection-note').textContent=data.notes;
  const all=new Map();data.species.forEach(s=>s.sources.forEach(src=>all.set(src.id,src)));
  // Indicator sources (the report's own registry) are cited here too, so a comparison cohort is named on the method tab.
  const report=data.assessmentInfo||{};
  const indicator=[...new Set(data.species.flatMap(s=>s.assessment?.source_ids||[]))]
    .map(id=>[id,report.sources?.[id]]).filter(([,src])=>src)
    .map(([id,src])=>`<div class="citation"><strong>${esc(src.title||src.provider||id)}</strong><span>${esc(src.citation||src.provider||'')}</span><br>${sourceLink(src.url,'원문 ↗')} · ${esc(memoKo(src.license)||'이용조건 미기재')}<br><span>${[memoKo(src.terms),src.accessed&&src.accessed+' 조회'].filter(Boolean).map(esc).join(' · ')}</span></div>`).join('');
  $('all-sources').innerHTML=data.species.map(s=>`<div class="citation"><strong>${esc(s.label)} · 학명</strong><span>${esc(s.wormsCitation)}</span><br>${sourceLink(s.wormsUrl,'WoRMS 원문 ↗')} · ${sourceLink('https://www.marinespecies.org/about.php','WoRMS 이용조건 · CC BY 텍스트')}</div>`).join('')+Array.from(all.values()).map(s=>`<div class="citation"><strong>${esc(s.title)}</strong><span>${esc(s.citation)}</span><br>${sourceLink(s.url,'데이터셋 원문 ↗')} · ${sourceLink(s.licenseUrl,s.license)}<br><span>변경: ${esc(s.changes||'종별 건수·기간 요약, 승인학명 연결, 좌표 미공개.')} ${esc(s.accessed||data.collectedAt)} 접근.</span></div>`).join('')+indicator;
}

// 출처별 상업 이용 구분 (license-matrix.json, scripts/build_license_matrix.py). Display only: the groups read each source's
// stated licence and are not a legal opinion; the commercial-layer count never changes a score, type or map colour.
const LICENSE_GROUPS=['commercial_ok','noncommercial','permission','review'];
function licenseName(r){return r.origin==='지표 보고서 출처'?(r.provider||r.title||r.id):(r.title||r.provider||r.id);}
function renderLicense(m){
  const box=$('mt-license');if(!box)return;
  if(m?.schema!=='license-matrix-1'||!Array.isArray(m.rows)||!m.groups||!m.commercial_layer){box.hidden=true;return;}
  const uniq=a=>[...new Set(a)];
  const body=LICENSE_GROUPS.map(g=>{
    const rows=m.rows.filter(r=>r.group===g).sort((a,b)=>b.species_count-a.species_count||licenseName(a).localeCompare(licenseName(b)));
    const names=uniq(rows.map(licenseName)), uses={};
    rows.forEach(r=>r.uses.forEach(u=>uses[u]=(uses[u]||0)+1));
    const list=rows.map(r=>`<li>${r.url?sourceLink(r.url,licenseName(r)):esc(licenseName(r))} · ${r.license_url?sourceLink(r.license_url,r.license):esc(r.license||'이용조건 미기재')}${r.share_alike?' · 동일조건':''} · ${esc(r.uses.join(', '))}</li>`).join('');
    return `<tr data-group="${esc(g)}"><th scope="row"><span class="lic-badge">${esc(m.groups[g].label)}</span><small>${esc(m.groups[g].note)}</small></th>`+
      `<td class="lic-n" data-k="출처">${esc(rows.length)}</td>`+
      `<td data-k="주요 출처">${esc(names.slice(0,6).join(' · '))}${names.length>6?` 외 ${esc(names.length-6)}곳`:''}${rows.length?`<details class="lic-list"><summary>전체 ${esc(rows.length)}건 보기</summary><ul>${list}</ul></details>`:''}</td>`+
      `<td data-k="쓰이는 곳 · 출처 수">${esc(Object.entries(uses).sort((a,b)=>b[1]-a[1]).map(([u,n])=>`${u} ${n}건`).join(' · '))}</td></tr>`;
  }).join('');
  $('license-table').querySelector('tbody').innerHTML=body;
  // commercial-layer calculation (folded)
  const L=m.commercial_layer, sc=L.scenarios.map(x=>x.id), ind=L.indicators, cells=L.map_cells.total;
  const AXIS_NAME={MFPI:'식량 잠재력 MFPI',MBPI:'생리활성 잠재력 MBPI',MCUI:'보전 시급성 MCUI',BBVI:'활용가치 BBVI',matrix_type:'활용 × 보전 유형'};
  const tr=(name,cur,vals,unit)=>`<tr><th scope="row">${esc(name)}</th><td>${esc(cur)}${unit}</td>${vals.map(v=>`<td>${esc(v)}${unit}</td>`).join('')}</tr>`;
  const rowsHtml=Object.entries(AXIS_NAME).map(([k,n])=>tr(n,ind[k].published,sc.map(x=>ind[k][x]),'종')).join('')+
    tr('출현 지도 격자',cells.all.grid_cells,sc.map(x=>cells[x].grid_cells),'칸')+
    tr('출현 지도 셀(종별)',cells.all.species_cells,sc.map(x=>cells[x].species_cells),'개')+
    tr('출현 셀이 있는 종',cells.all.species,sc.map(x=>cells[x].species),'종')+
    tr('활용 × 보전 셀 색',L.value_layer_cells.all,sc.map(x=>L.value_layer_cells[x]),'칸');
  const block=(k,key)=>{const b=(ind[k][key]||[]).slice(0,4);return b.length?`<li><b>${esc(AXIS_NAME[k])}</b> ${esc(b.map(x=>`${x.name} ${x.species}종`).join(' · '))}</li>`:'';};
  $('license-layer').querySelector('div').innerHTML=
    `<p>현재 공개 ${esc(L.species_total)}종 기준입니다. 계산만 했고 공개 점수·유형·지도 색은 바꾸지 않았습니다.</p>`+
    `<div class="mt-lic-wrap"><table class="mt-lic-table lic-layer"><thead><tr><th scope="col">항목</th><th scope="col">현재 공개</th>${L.scenarios.map(x=>`<th scope="col" title="${esc(x.detail||'')}">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`+
    `<p class="fine">${esc(L.scenarios.map(x=>`${x.label}: ${x.detail||x.label}`).join(' · '))}. 지표는 그 종의 지표 기록에 연결된 출처가 모두 조건에 맞을 때만 셉니다(확인 단계에만 쓴 출처도 포함하는 보수적 계산). BBVI는 MFPI·MBPI가, 유형은 BBVI·MCUI가 함께 남을 때 셉니다. 지도 셀은 그 셀의 검수 통과 기록 중 하나라도 CC0·CC BY이면 남습니다.</p>`+
    `<p class="lic-sub">CC0·CC BY만 남길 때 주로 빠지는 출처</p><ul>${['MFPI','MBPI','MCUI'].map(k=>block(k,'open_blockers')).join('')}</ul>`+
    `<p class="lic-sub">확인 필요 출처가 모두 가능해도 기관 승인이 필요한 출처</p><ul>${['MFPI','MBPI','MCUI'].map(k=>block(k,'upper_blockers')).join('')}</ul>`;
  // items to confirm (folded): IUCN first, then the 'review' sources grouped by reason
  const items=m.review_items||[], iucn=items.filter(x=>x.id==='iucn-redisplay'), rest=items.filter(x=>x.id!=='iucn-redisplay'), byBasis={};
  rest.forEach(x=>(byBasis[x.detail]??=[]).push(x));
  $('license-review').querySelector('summary').textContent=`확인 필요 항목 · IUCN 재게시 범위${rest.length?` 외 출처 ${rest.length}건`:''}`;
  $('license-review').querySelector('div').innerHTML=
    iucn.map(x=>`<p><b>${esc(x.title)}</b> · ${esc(x.status)} · ${sourceLink(x.url,'IUCN 이용약관 원문 ↗')}<br>${esc(x.detail)}</p>`).join('')+
    `<ul>${Object.entries(byBasis).sort((a,b)=>b[1].length-a[1].length).map(([basis,xs])=>`<li><b>${esc(basis)}</b> ${esc(xs.length)}건: ${esc(uniq(xs.map(x=>x.title)).slice(0,8).join(' · '))}${xs.length>8?` 외 ${esc(xs.length-8)}건`:''}</li>`).join('')}</ul>`;
  $('license-date').textContent=m.generated_from?.assessments?`· 지표 ${m.generated_from.assessments} 기준`:'';
  box.hidden=false;
}

function registerTools(){
  const ctx=document.modelContext;if(!ctx?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const options={signal:lifecycle.signal};
  for(const tool of [
    {name:'read_biobio_evidence',title:'후보종 근거 현황 읽기',description:'실제 표시된 종별 근거 연결 현황과 지표 상태를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('인자가 없어야 합니다.');return {view:currentView,selectedAphiaID:selected?.aphiaID,simulated,species:(data?.species||[]).map(s=>({label:s.label,aphiaID:s.aphiaID,records:s.cells.length?cellRecords(s):s.recordCount,status:s.status,
  axes:Object.fromEntries(['MFPI','MBPI','MCUI','BBVI'].map(k=>{const st=axisState(s,k);return [k,{value:st.value,state:st.kind,label:st.label,...(k==='MCUI'&&separateMcui(s)?{basis:stockMcui(s)?'stock_decline_kosis':nationalMcui(s)?'korea_national':subNationalMcui(s)?'sub_national':preliminaryMcui(s)?'rapid_lc_preliminary':'range_state_national',comparableWithIucnMcui:false}:{}),...(s.assessment?.mbpi_floor&&(k==='MBPI'||k==='BBVI')&&st.value!==null?{floor:true,label:k==='MBPI'?s.assessment.mbpi_label:bbviLabel(s)}:
    {...(k==='BBVI'&&bbviLabel(s)?{singleSource:bbviLabel(s)}:{}),...(k==='MBPI'&&st.value!==null&&s.assessment?.mbpi_label?{singleSource:s.assessment.mbpi_label}:{})})}];})),
  scoreStatus:s.assessment?(released()?'released':'provisional_unvalidated'):s.assessmentState||'unscored'}))};}},
    {name:'select_biobio_species',title:'탐색할 종 선택',description:'AphiaID로 후보를 선택하고 실제 지도와 근거 카드를 표시합니다.',inputSchema:{type:'object',properties:{aphiaID:{type:'integer'}},required:['aphiaID'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Number.isInteger(input.aphiaID)||Object.keys(input).some(k=>k!=='aphiaID'))throw new Error('정수 AphiaID를 입력하세요.');selectSpecies(input.aphiaID);$('search').value='';renderList();setView('explore');return {selected:selected.label,aphiaID:selected.aphiaID,status:selected.status};}}
  ])try{Promise.resolve(ctx.registerTool(tool,options)).catch(()=>{});}catch{}
}

// Loading steps for the entry screen (intro.js): 'map' once the coastline is in, 'done' after every loadCollection outcome.
const loadProgress=(step,detail={})=>{try{dispatchEvent(new CustomEvent('bbvm:progress',{detail:{step,...detail}}));}catch{/* no listener needed */}};
const loadDone=state=>loadProgress('done',{state,snapshotAt:data?.snapshotAt||null,published:data?.publishedCount,candidates:data?.candidateCount,
  cells:data?[...new Map(data.species.flatMap(s=>s.cells||[]).map(c=>[`${c.lat0},${c.lon0},${c.sizeDeg}`,{lat:c.lat0,lon:c.lon0,size:c.sizeDeg}])).values()]:[]});
// Header status chips: the notice (version · research use) opens its full text; a snapshot or newer-file status gets a
// yellow chip whose popover holds the banner sentence and the reload button. A load with no data keeps the red banner.
function updateStatusChips(){
  const info=data?.assessmentInfo,err=$('error'),alert=err.classList.contains('in-chip')&&!err.hidden;
  // 2026-10-13 design 2: one chip instead of three header badges (status, team tag, prototype); the popover keeps the full text
  $('notice-chip').classList.toggle('load-failed',!data&&$('connection-state').textContent==='불러오기 실패');
  $('notice-chip-text').innerHTML=!data?($('connection-state').textContent==='불러오기 실패'?'자료를 불러오지 못했어요':'자료 불러오는 중'):(data.offline?'오프라인 시연 · ':'')+'연구 프로토타입'+(info?.version?` · ${released(info)?'':'시범 '}${esc(info.version)}`:'')+'<span class="chip-tail"> · OCEAN 20</span>';
  const was=!$('alert-chip').hidden;
  $('alert-chip').hidden=!alert;
  $('alert-chip-text').textContent=!alert?'':[data?.snapshotAt?`저장 사본 · ${data.snapshotAt} 기준`:'',data?.outdated?.length?'새 버전 있음':''].filter(Boolean).join(' · ');
  $('alert-text').textContent=alert?err.textContent:'';
  if(!alert)statusPop(null);
  if(alert&&!was)$('status-live').textContent=err.textContent;  // announced once, as the banner's role=alert did
}
let openPop=null;
function statusPop(id){
  for(const [chip,pop] of [['notice-chip','notice-pop'],['alert-chip','alert-pop']]){const on=pop===id;$(pop).hidden=!on;$(chip).setAttribute('aria-expanded',String(on));}
  openPop=id;
}
// Design 07 (2026-10-10): on a phone (≤740px) the map stays at the top and the species pane slides over it as a bottom
// sheet. The page scroll is the drag; the handle button opens (sheet to the top) and closes (back to the map) for touch and keys.
const phoneSheet=()=>globalThis.matchMedia?.('(max-width:740px)').matches;
function sheetSummary(s){
  const box=$('sheet-summary');if(!box)return;
  const t=matrixType(s), v=k=>{const x=pilotScore(s,k),one=k==='BBVI'&&x!==null&&bbviLabel(s);
    return `<i class="${x===null?'held':one?'single':''}"${one?` title="${GAUGE_NAME[k]} · ${esc(one)}"`:''}><small>${k}</small>${x===null?'–':scoreText(s,k,x)}${one?'<span class="sr-only"> '+esc(one)+'</span>':''}</i>`;};
  const chip=t?`<span class="type-chip" title="${esc(matrixPlainNote())}"><i style="background-color:${matrixTypeColour[t]}" aria-hidden="true"></i>${verdictWord(t)} ${esc(matrixTypeLabel(t))}</span>`:'<span class="type-chip none"><i aria-hidden="true"></i>유형 미산출</span>';
  box.innerHTML=`<p class="ss-name"><b>${esc(s.label)}</b> <span class="kind${s.catalog?' cand':''}">${s.catalog?'조사 후보':'운영 발행'}</span> ${chip}</p><p class="ss-scores card-scores">${['MFPI','MBPI','BBVI','MCUI'].map(v).join('')}</p>`;
}
function sheetSync(){
  const h=$('sheet-head'),b=$('sheet-handle'),stage=document.querySelector('.map-stage');if(!h||!b||!stage||!phoneSheet())return;
  const open=h.getBoundingClientRect().top<stage.getBoundingClientRect().bottom-40;
  if(b.getAttribute('aria-expanded')!==String(open)){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'종 목록·상세 접고 지도 보기':'종 목록·상세 펼치기');}
}
let requestNumber=0;
async function loadCollection(){
  const request=++requestNumber;
  data=null;selected=null;selectedValueCell=null;pickedValueCell=null;comparisonFocus=null;activeUses=new Set();useReturn=null;overlay?.clearLayers();setMapChip(null,'');lastFitted=null;fitMap();$('search').value='';$('error').hidden=true;$('error').classList.remove('in-chip');
  $('connection-state').textContent='자료를 불러오는 중';updateStatusChips();
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';$('decision-list').after($('decision-detail'));$('cmp-more').hidden=true;$('cmp-profile').innerHTML='<p class="loading">자료를 불러오는 중입니다.</p>';$('cmp-tray').textContent='';$('decision-list').textContent='';$('matrix-unplaced').textContent='';$('cell-table').textContent='';$('decision-detail').textContent='';$('decision-detail').hidden=true;$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';$('value-cell-detail').textContent='';$('map-selected').textContent='';$('sheet-summary').textContent='';
  setMapLegend(null);
  $('score-disclaimer').textContent='자료를 불러오는 중입니다.';
  $('map-judgment').textContent='해역별 활용·보전 판단: 입력 확인 중';
  $('map-source').textContent='공개 기준 자료 · 공개 1° 셀';
  try{
    const [next,readiness,traits,outside,literature,searches,scorecard]=await Promise.all([loadPublishedProfiles(),
      ...['matrix-readiness.json','trait-evidence.json','unexplored-candidates.json','supplementary-literature.json','replication-search.json','posthoc-scorecard.json']
        .map(f=>readData(f,FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null))]);
    next.outdated??=[];matrixReadiness=readinessRows(readiness,next.outdated);traitDisplay=traitDisplayRows(traits,next.outdated);supplementaryLit=supplementaryRows(literature,next.outdated);replicationSearch=replicationSearchRows(searches,next.outdated);posthocScorecard=scorecardFile(scorecard,next.outdated);
    unexploredOutside=unexploredRows(outside,next.outdated);
    next.readinessAssessmentDate=readiness?.assessments_snapshot||null;next.readinessCandidateDate=readiness?.candidate_snapshot||null;
    if(request!==requestNumber)return;
    await attachPilotAssessments(next);
    if(request!==requestNumber)return;
    if(reloadOnceForNewData(next.outdated))return;
    $('score-disclaimer').innerHTML=next.species.some(s=>s.assessment)?'<strong>연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.</strong> '+(released(next.assessmentInfo)?'지표는 <strong>정식 산출</strong>('+esc(next.assessmentInfo.version)+')입니다':'일부 종에 <strong>시범 지표</strong>가 있습니다')+validationNote(next.assessmentInfo)+'.':'이 자료에는 활용가치·보전 지표를 <strong>산출하지 않았습니다.</strong> 학명·출현 근거만 봅니다.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';loadDone('empty');return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];mapJudgmentStatus(selected);renderUseChips();renderList();renderDetail();renderMap();renderComparison();renderDecisionList();renderSources();renderTypeTable();renderCompare();if(typeof renderMethodPage==='function')renderMethodPage();
    // Three live states: connected, connected but 0 published (not a failure, no snapshot), unreachable (dated snapshot).
    const counts=`운영 발행 ${data.publishedCount}종 · 조사 후보 ${data.candidateCount}종`;
    // Offline demo: the snapshot is the plan, not a failure, so its date stays in the status line without the alert.
    $('connection-state').textContent=data.offline?`오프라인 시연 · 저장된 공개 자료 사본 (${data.snapshotAt} 기준) · ${counts}`
      :data.snapshotAt?`연결 실패 · 저장된 사본 사용 (${data.snapshotAt} 기준) · ${counts}`:'공개 기준 자료 연결됨 · '+counts;
    if(data.snapshotAt&&!data.offline){$('error').hidden=false;$('error').textContent=`실시간 자료(운영 DB)를 불러오지 못해 ${data.snapshotAt}에 저장한 공개 자료 사본을 보여 드려요. 그 뒤 발행된 변경은 반영되지 않았어요.`;}
    else if(!data.publishedCount)$('score-disclaimer').innerHTML=`운영 DB에는 연결됐지만 <strong>운영 발행 자료가 0종</strong>입니다. 지금 보이는 ${data.candidateCount}종은 모두 조사 후보이며, 지표는 산출하지 않았습니다.`;
    if(data.outdated.length){$('error').hidden=false;$('error').textContent=(data.snapshotAt&&!data.offline?$('error').textContent+' ':'')+`새 버전 있음: ${data.outdated.map(o=>o.file).join(', ')}이(가) 이 화면 코드보다 새 버전입니다. 자료 결함이 아니며 페이지를 새로고침(F5)하면 최신 화면이 보입니다.`;}
    // a dated snapshot or a newer data file is a status, not a failure: it moves from the banner into the yellow header chip
    $('error').classList.toggle('in-chip',!$('error').hidden);updateStatusChips();
    toggleSimulation(false);updateWeightControl();
    if(startHash){const h=startHash;startHash=null;if(h.s||h.v||h.w)applyHash(h);}
    loadDone(data.offline?'offline':data.snapshotAt?'snapshot':data.publishedCount?'live':'empty');
  }catch(error){if(request!==requestNumber)return;
    // Neither the API nor the saved copy answered (2026-10-15): one plain line and a retry button wherever the data would be,
    // never an empty screen. The cause stays under it in small type.
    const retry='<button type="button" class="text-button data-retry">↻ 다시 시도</button>';
    const cause=/[가-힣]/.test(error?.message||'')?error.message:'운영 DB에 연결하지 못했습니다(네트워크 끊김 또는 시간 초과).'; // the browser's own words are English
    $('error').hidden=false;$('error').innerHTML=`<strong>자료를 불러오지 못했어요</strong> · ${retry}<small class="error-cause">${esc(cause)} 저장된 공개 자료 사본도 읽지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</small>`;
    $('error').classList.remove('in-chip');$('connection-state').textContent='불러오기 실패';updateStatusChips();
    $('species-list').innerHTML=`<p class="load-failed">자료를 불러오지 못했어요 · ${retry}</p>`;
    $('cmp-profile').innerHTML=`<p class="cmp-error" role="alert">자료를 불러오지 못했어요 · ${retry} 빈 결과가 아니라 연결 오류입니다.</p>`;
    $('map-review-note').textContent='자료 연결을 확인할 수 없습니다.';loadDone('error');}
}
let startHash={};
async function start(){
  startHash=readHash();
  if(matchMedia('(max-width:740px)').matches)document.querySelector('.map-legend-more').open=false; // phones: keep the map near the first screen
  const seaReq=readData('cell-sea-geometry.json',FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null); // land mask, read beside effort.json
  const termsReq=readData('source-terms-ko.json',FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null); // optional: English notes without it
  fetch('license-matrix.json').then(r=>r.ok?r.json():null).catch(()=>null).then(renderLicense); // optional: the section stays hidden without it
  const mapReq=readData('countries.json',FRESH_READ);mapReq.catch(()=>{}); // asked for now, used once effort.json is in (they no longer wait for each other)
  try{const r=await readData('effort.json',FRESH_READ);if(r.ok){effortData=await r.json();$('effort-date').textContent=`OBIS · ${effortData.retrieved} 조회`;}}catch{/* optional layer */}
  {const t=await termsReq;if(t?.schema==='source-terms-ko-1'&&t.by_text&&typeof t.by_text==='object')sourceTermsKo=t.by_text;}
  {const f=await seaReq;if(f?.schemaVersion==='cell-sea-geometry-1'&&f.cells&&typeof f.cells==='object')cellSea=f.cells;} // without it: whole squares as before
  try{const r=await mapReq;if(!r.ok)throw Error('map');const geography=await r.json();if(typeof L!=='undefined')initMap(geography);loadProgress('map',{geography});}catch{loadProgress('map');$('map').textContent='배경 지도를 불러오지 못했습니다. 종 요약은 계속 볼 수 있습니다.';}
  await loadCollection();registerTools();
}
// ↻ reloads the data but keeps species, chip and map: writeHash already holds them, so they are re-applied like a shared
// link. The tab is left out: loading never changes it, and one picked while a slow reload runs must not be undone.
$('sheet-handle').addEventListener('click',()=>{
  const open=$('sheet-handle').getAttribute('aria-expanded')==='true', smooth=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
  scrollTo({top:open?0:scrollY+$('sheet-head').getBoundingClientRect().top,behavior:smooth});
  setTimeout(sheetSync,smooth==='auto'?0:450);
});
addEventListener('scroll',()=>{if(!sheetSync.f)sheetSync.f=requestAnimationFrame(()=>{sheetSync.f=0;sheetSync();});},{passive:true});
// the map's height changes across the 740px line: tell Leaflet
globalThis.matchMedia?.('(max-width:740px)').addEventListener?.('change',()=>{map?.invalidateSize();sheetSync();});
// the folds (detail evidence, species filters) apply from 1281px only: re-sync when the window crosses that line
globalThis.matchMedia?.('(min-width:1281px)').addEventListener?.('change',syncFolds);
$('filter-toggle')?.addEventListener('click',()=>{filtersOpen=!filtersOpen;syncFolds();});
syncFolds(); // fold the filters before the data arrives, so the list does not jump when it renders
// From 1281px the occurrence key sits under the floating species list, which ends above it whatever the key's height (open,
// folded to its button, details open, hidden in the value mode): theme.css reads --key-h.
// 2026-10-13 design 2: the key is attached to the list (no gap) unless it is folded to its button.
{const key=document.querySelector('.map-ui-bl');
  if(key&&globalThis.ResizeObserver)new ResizeObserver(()=>{const h=key.offsetHeight,gap=key.classList.contains('legend-collapsed')&&$('value-key').hidden?12:0;$('explore').style.setProperty('--key-h',h?h+gap+'px':'0px');}).observe(key);}
// From 741 to 1280px the summary chip sits under the mode and period bar, whatever its height (theme.css reads --tl-h).
{const bar=document.querySelector('.map-ui-tl');
  if(bar&&globalThis.ResizeObserver)new ResizeObserver(()=>$('explore').style.setProperty('--tl-h',bar.offsetHeight+'px')).observe(bar);}
$('value-view').addEventListener('click',()=>{valueView=valueView==='species'?'all':'species';typeFilter.clear();renderMap();});
$('reload-data').addEventListener('click',()=>{startHash={...readHash(),v:null};loadCollection();});
// "↻ 다시 시도" in the failure lines (banner, list, comparison) does what the header's ↻ does
document.addEventListener('click',e=>{if(e.target.closest?.('.data-retry'))$('reload-data').click();});
// A link opened in a tab that already shows the map changes only the hash (no reload): apply it, so a shared
// 비교와 지표 link opens that tab instead of being written over by the map. replaceState (writeHash) never fires this.
addEventListener('hashchange',()=>{const h=readHash();if(data&&selected)applyHash(h);else startHash=h;});
// method-tab flow chart: a box opens the fold that holds its explanation card, then goes there (click or Enter/Space)
document.querySelectorAll('.flow [data-step]').forEach(g=>{const go=()=>{const card=$('method-'+g.dataset.step);methodGo(card);card?.classList.add('flash');setTimeout(()=>card?.classList.remove('flash'),1600);};
  g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
// ---------- 근거와 방법 (deep-sea design, 2026-10-15) ----------
// In-page moves are buttons, not href="#…": the URL hash keeps the tab, species and map state. A target inside a closed
// fold opens it first.
const smoothScroll=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
function methodGo(el){if(!el)return;const d=el.closest('details');if(d)d.open=true;el.scrollIntoView({behavior:smoothScroll(),block:'start'});}
const METHOD_GO={journey:()=>$('mt-journey'),sources:()=>document.querySelector('#method .source-section'),flow:()=>document.querySelector('#method .flow-wrap')};
// footer '출처 목록 참조': opens the method tab at the licence table
document.querySelectorAll('[data-foot-go]').forEach(b=>b.addEventListener('click',()=>{setView('method',false);const t=$('mt-license');methodGo(t&&!t.hidden?t:document.querySelector('#method .source-section'));t?.focus?.({preventScroll:true});}));
document.querySelectorAll('[data-mt-go]').forEach(b=>b.addEventListener('click',()=>{const t=METHOD_GO[b.dataset.mtGo]?.();methodGo(t);
  if(b.dataset.mtGo==='sources')$('all-sources')?.focus({preventScroll:true});}));
// Research scope numbers (운영 발행 · 조사 후보 from the loaded collection; '—' until then or after a failure) and the
// four quadrant names from the report's matrix rule. The diagram places no species, points or scores.
function renderMethodPage(){
  const n=v=>Number.isFinite(v)?String(v):'—';
  renderScorecard();
  $('mt-total').textContent=n(data?.species?.length);$('mt-published').textContent=n(data?.publishedCount);$('mt-candidates').textContent=n(data?.candidateCount);
  const rule=matrixRule();if(!rule)return;
  document.querySelectorAll('#method .mt-q').forEach(q=>{const t=rule.types?.[q.dataset.q];if(!t)return;q.dataset.type=t.id;q.querySelector('b').textContent=matrixTypePlain(t.id);q.querySelector('span').textContent=t.label;});
  $('mt-quad-rule').textContent=`각각 ${rule.bbvi_threshold===rule.mcui_threshold?rule.bbvi_threshold:'BBVI '+rule.bbvi_threshold+' · MCUI '+rule.mcui_threshold} 이상이면 높음 · 지표 쌍이 없으면 유형 미산출`;
}
// Journey links, drawn from where the boxes actually are: MFPI → BBVI, MBPI → BBVI, 보전 → MCUI, BBVI → 두 축, MCUI → 두 축.
// No line joins BBVI and MCUI. Redrawn whenever the panel changes size (also when the tab first shows it).
function drawMethodLinks(){
  const flow=document.querySelector('#method .mt-flow'),g=flow?.querySelector('.mt-links g');if(!g)return;
  const box=flow.getBoundingClientRect(),node=k=>flow.querySelector(`[data-node="${k}"]`)?.getBoundingClientRect();
  if(!box.width||getComputedStyle(flow.querySelector('.mt-links')).display==='none'){g.innerHTML='';return;}
  const link=(a,b)=>{const r1=node(a),r2=node(b);if(!r1||!r2)return '';
    const x1=r1.right-box.left,y1=r1.top+r1.height/2-box.top,x2=r2.left-box.left-2,y2=b==='quad'?y1:r2.top+r2.height/2-box.top,m=(x1+x2)/2;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${m.toFixed(1)} ${y1.toFixed(1)} ${m.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" marker-end="url(#mt-arrow)"/>`;};
  g.innerHTML=[['mfpi','bbvi'],['mbpi','bbvi'],['cons','mcui'],['bbvi','quad'],['mcui','quad']].map(([a,b])=>link(a,b)).join('');
}
{const flow=document.querySelector('#method .mt-flow');if(flow&&globalThis.ResizeObserver)new ResizeObserver(drawMethodLinks).observe(flow);}
$('notice-chip').addEventListener('click',()=>statusPop(openPop==='notice-pop'?null:'notice-pop'));
$('alert-chip').addEventListener('click',()=>statusPop(openPop==='alert-pop'?null:'alert-pop'));
$('alert-reload').addEventListener('click',()=>{statusPop(null);$('reload-data').click();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openPop){const chip=openPop==='notice-pop'?'notice-chip':'alert-chip';statusPop(null);$(chip).focus();}});
document.addEventListener('click',e=>{if(openPop&&!e.target.closest('.status-chips'))statusPop(null);});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-map-mode]').forEach(button=>button.addEventListener('click',()=>setMapMode(button.dataset.mapMode)));
$('search').addEventListener('input',()=>{if(data)renderList();});
for(const id of ['species-group','species-evidence'])$(id).addEventListener('change',()=>{if(data)renderList();});
let comparisonFrame=0;const queueComparisonSync=()=>{if(data&&!comparisonFrame)comparisonFrame=requestAnimationFrame(()=>{comparisonFrame=0;syncComparison();});};
$('comparison').addEventListener('scroll',queueComparisonSync,{passive:true});addEventListener('resize',queueComparisonSync);
$('effort-toggle').addEventListener('change',e=>{effortOn=e.target.checked;drawEffort();});
$('legend-toggle').addEventListener('click',e=>{const folded=e.currentTarget.parentElement.classList.toggle('legend-collapsed');e.currentTarget.setAttribute('aria-expanded',String(!folded));e.currentTarget.title=e.currentTarget.ariaLabel=folded?'범례 펼치기':'범례 접기';});
document.querySelectorAll('.vm-grid [data-key]').forEach(b=>{
  b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')dimTypes(b.dataset.type);});
  b.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')dimTypes(null);});
  b.addEventListener('focus',()=>{if(b.matches(':focus-visible'))dimTypes(b.dataset.type);});
  b.addEventListener('blur',()=>dimTypes(null));
  b.addEventListener('click',e=>{
    const id=b.dataset.type;if(!id)return;
    if(ownView()){valueView='all';typeFilter.clear();} // species view: open the all-species view on this type
    if(!typeFilter.delete(id))typeFilter.add(id);
    b.setAttribute('aria-pressed',String(typeFilter.has(id)));
    renderMap();if(e.pointerType==='mouse'||b.matches(':focus-visible'))dimTypes(id); // the redraw drops the hover dim
  });
});
$('value-info').addEventListener('click',()=>setValueInfo($('value-legend').hidden));
document.addEventListener('click',e=>{if(!$('value-legend').hidden&&!$('value-mini').contains(e.target))setValueInfo(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('value-legend').hidden){setValueInfo(false);$('value-info').focus();}});
for(const [id,layer] of [['layer-priority','priority'],['layer-unexplored','unexplored']])$(id).addEventListener('change',e=>{sufficiencyLayers[layer]=e.target.checked;if(data&&mapMode==='value')renderMap();});
$('copy-link').addEventListener('click',()=>{writeHash();const done=m=>{$('basemap-status').classList.remove('fallback');$('basemap-status').textContent=m;};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(()=>done('현재 화면 링크를 복사했습니다.'),()=>done('주소창의 링크를 복사하세요.'));else done('주소창의 링크를 복사하세요.');});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>setView('compare'));$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
$('bbvi-weight').addEventListener('input',event=>setBbviStep(event.target.value));
// presets and '공식값으로' (the panel, the matrix and table badges, the value-map legend)
document.addEventListener('click',e=>{const b=e.target.closest('[data-w-preset],[data-w-reset]');if(!b||b.disabled)return;
  setBbviStep(b.dataset.wPreset??weightStep(officialWeight()));});
// ---- 비교와 지표 controls (2026-10-12) ----
document.querySelectorAll('[data-cmp-mode]').forEach(b=>b.addEventListener('click',()=>setCompareMode(b.dataset.cmpMode)));
document.querySelectorAll('[data-cmp-group]').forEach(b=>b.addEventListener('click',()=>setCompareFilter({group:b.dataset.cmpGroup})));
$('cmp-search').addEventListener('input',e=>setCompareFilter({q:e.target.value.trim().toLowerCase()}));
$('cmp-filter-note').addEventListener('click',e=>{if(e.target.closest('[data-cmp-clear]')){setCompareFilter({q:'',group:'all',type:null});$('cmp-search').focus();}});
$('cmp-type-cards').addEventListener('click',e=>{const b=e.target.closest('[data-cmp-type]');if(b)setCompareFilter({type:cmpFilter.type===b.dataset.cmpType?null:b.dataset.cmpType});});
$('cmp-basis-toggle').addEventListener('click',()=>setBasisPop($('cmp-basis-pop').hidden));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cmp-basis-pop').hidden){setBasisPop(false);$('cmp-basis-toggle').focus();}});
document.addEventListener('click',e=>{if(!$('cmp-basis-pop').hidden&&!e.target.closest('.cmp-basis'))setBasisPop(false);});
$('cmp-read-toggle').addEventListener('click',()=>setReadPop($('cmp-read-pop').hidden));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cmp-read-pop').hidden){setReadPop(false);$('cmp-read-toggle').focus();}});
document.addEventListener('click',e=>{if(!$('cmp-read-pop').hidden&&!e.target.closest('.cmp-read'))setReadPop(false);});
// the group list: a row picks the species (it leaves the box and gets its label), then focus goes to its point
$('matrix-cluster-pop').addEventListener('click',e=>{const b=e.target.closest('button[data-aphia]');if(!b)return;pickCompare(Number(b.dataset.aphia));
  $('matrix-points').querySelector('.matrix-point[aria-current="true"]')?.focus({preventScroll:true});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('matrix-cluster-pop').hidden)closeClusterPop(true);});
document.addEventListener('click',e=>{if(!$('matrix-cluster-pop').hidden&&!e.target.closest('#matrix-cluster-pop,.matrix-cluster-btn'))closeClusterPop(false);});
// one listener per region: the profile and the tray redraw their buttons
$('cmp-profile').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!selected)return;
  if(b.id==='cmp-add'){if(!toggleBasket(selected.aphiaID))$('cmp-add-note').textContent='최대 3종까지 담을 수 있습니다. 아래에서 한 종을 빼 주세요.';else $('cmp-add').focus();return;}
  if(b.id==='cmp-open-more'){$('cmp-more').hidden?showCompareMore():closeDecision();return;}
  if(b.dataset.profAxis)openEvidence(selected.aphiaID,b.dataset.profAxis,`#cmp-profile [data-prof-axis="${b.dataset.profAxis}"]${b.classList.contains('cp-sub-num')?'.cp-sub-num':b.classList.contains('cp-sub-name')?'.cp-sub-name':''}`);
});
$('cmp-tray').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.basketRemove){const i=cmpBasket.indexOf(Number(b.dataset.basketRemove));toggleBasket(b.dataset.basketRemove);
    ($('cmp-tray').querySelectorAll('.ct-x')[Math.min(i,cmpBasket.length-1)]||$('cmp-tray').querySelector('.ct-add')||$('cmp-add'))?.focus();return;}
  if(b.hasAttribute('data-basket-add')){if(selected&&!cmpBasket.includes(selected.aphiaID)){toggleBasket(selected.aphiaID);$('cmp-tray').querySelector('.ct-add,.ct-x')?.focus();}else $('cmp-search').focus();return;}
  if(b.classList.contains('ct-toggle')){const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));$('cmp-tray').classList.toggle('open',open);return;}
  if(b.id==='cmp-compare-go'&&!openCompareDialog())$('cmp-go-note').textContent='2종 이상 담으면 비교할 수 있습니다. 종 상세의 ‘+ 비교 담기’를 눌러 주세요.';
});
$('cmp-dialog').querySelector('.cmp-dialog-close').addEventListener('click',()=>$('cmp-dialog').close());
$('cmp-dialog').addEventListener('click',e=>{if(e.target===$('cmp-dialog'))$('cmp-dialog').close();}); // the backdrop
$('cmp-dialog').addEventListener('close',()=>{if(currentView==='compare')$('cmp-compare-go')?.focus();});
// a row's species name in the table picks it too (the value buttons keep opening their evidence)
$('comparison').addEventListener('click',e=>{const th=e.target.closest('tbody tr.cmp-row th');if(th)pickCompare(Number(th.parentElement.dataset.aphia));});
start();
