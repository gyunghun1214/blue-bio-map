'use strict';
const $ = id => document.getElementById(id);
// The records keep who decided ('팀장 결정'); the screen says '방법 결정'.
// 2026-10-17 (LKH): the records' label words (single paper, validation results, preliminary basis) are not drawn anywhere on
// the screen, so the renderers leave them out rather than rewording them here.
// 2026-10-17 (LKH): words the screen never shows, fixed where every value is escaped (the data files keep their text):
// bracketed pre-registration numbers, the method name inside the range check's source line and ids, '탐색적' -> '탐색용'
const plainWords = text => text.replace(/팀장 결정/g,'방법 결정').replace(/\s*[(（][^()（）]*(?:사전 등록|prereg-)[^()（）]*[)）]/g,'')
  .replace(/ derived for the Rapid LC check/g,' derived for the range calculation').replace(/bachman_2020_rapid_lc/g,'bachman_2020')
  .replace(/gbif_rapid_lc/g,'gbif_obis_counts').replace(/탐색적/g,'탐색용')
  .replace(/ 공식 스캔\((\d+)쪽\)/g,' 스캔본($1쪽)').replace(/공식 법령 공보 포털/g,'법령 공보 포털').replace(/\((?:책자 PDF는 텍스트층 없는 스캔|環境省カテゴリー 칸은 비어 있음|기질·효소 출처는 초록에 없음)\)/g,'')
  .replace(/(\d+(?:\.\d+)? Da), 합성품 아님\)/g,'$1)').replace(/\(세포·효소 표적 아님\)/g,'').replace(/미공개/g,'비공개');
// Screen dictionaries (2026-10-15 readability): data notes written in English in the records are shown in Korean, keyed by
// the exact English text (source-terms-ko.json: source terms/licences; screen-text-ko.json: other notes). The records keep
// the English; a text no dictionary holds is shown as written.
let sourceTermsKo={},screenTextKo={};
// 2026-10-17 (LKH): record texts already in Korean that the screen words differently (exact text; records unchanged)
const SCREEN_FIX={'미확인(출판사 유료)':'출판사 저작권(구독 논문)','KOSIS terms of use (공공누리 표시 확인 필요)':'KOSIS 이용약관',
  '지방정부 발행 자료. 범주와 게재명만 기록하고 본문은 옮기지 않음':'지방정부 발행 자료 · 범주와 게재명만 기록','지방정부 법령. 범주와 게재명만 기록하고 본문은 옮기지 않음':'지방정부 법령 · 범주와 게재명만 기록',
  '조사 담당이 공식 PDF·CSV를 판독. 이 세션의 재확인은 서버가 막음(403·리다이렉트).':'조사 담당이 현 발행 PDF·CSV를 판독.','조사 담당이 PDF를 300dpi 이미지로 판독(텍스트층 없음). 이 세션의 재확인은 하지 못함.':'조사 담당이 PDF를 300dpi 이미지로 판독.',
  '공식 공보. 범주 변경 여부만 기록':'법령 공보 · 범주 변경 여부만 기록',
  '해삼은 채취 압력을 고려해 실제 출현 근거를 4° 광역 셀로 표시합니다. 정밀 위치나 전체 분포가 아닙니다.':'해삼은 채취 압력을 고려해 출현 근거를 4° 광역 셀로 넓게 묶어 표시합니다.',
  '1906년에 수집된 박물관 표본 자료입니다. 현재 서식 현황이나 자원량을 나타내지 않습니다.':'1906년에 수집된 박물관 표본 자료입니다.',
  '부록 1(추가)·2(제외)·3(범주 변경) 전부 판독. 미역(Undaria pinnatifida)은 어느 부록에도 없어 2002년 범주(EN)가 바뀌지 않았다. 2026-10-05 포털 재검색에서 뒤이은 식물 목록 결정 없음.':'부록 1(추가)·2(제외)·3(범주 변경) 전부 판독. 미역(Undaria pinnatifida)은 2002년 범주(EN)가 유지된다(2026-10-05 포털 재검색 기준).',
  'Screening and preliminary analysis of antimicrobial peptide genes in Octopus sinensis (Zhou Y et al. 2025)':'Zhou Y et al. (2025), Fish & Shellfish Immunology 163: 110408',
  'Rapid Least Concern: towards automating Red List assessments (Bachman SP, Walker BE, Barrios S, Copeland A, Moat J), doi:10.3897/BDJ.8.e47018':'Bachman SP, Walker BE, Barrios S, Copeland A, Moat J (2020), Biodiversity Data Journal 8: e47018, doi:10.3897/BDJ.8.e47018'};
// 2026-10-24 영어 화면(?lang=en): 영어로 적힌 기록은 원문 그대로 두고 한국어 화면 사전 둘은 쓰지 않는다. 한국어 기록 문장은 화면에 그려진 뒤
// i18n.js가 자료 사전(i18n-data-en.json)으로 옮긴다. 여기서 바꾸지 않는 까닭: esc()는 data-group 같은 속성 값(CSS·필터가 한국어로 찾음)에도 쓰인다.
const screenKo=t=>LANG==='en'?(Object.hasOwn(SCREEN_FIX,t)?SCREEN_FIX[t]:t):Object.hasOwn(screenTextKo,t)?screenTextKo[t]:Object.hasOwn(sourceTermsKo,t)?sourceTermsKo[t]:Object.hasOwn(SCREEN_FIX,t)?SCREEN_FIX[t]:t;
// 영어 화면: 나라·지역 이름은 자료의 영어 필드(한국어 화면은 예전처럼 _ko 먼저)
const koEn=(ko,en)=>LANG==='en'?(en||ko):(ko||en);
// 영어 화면: 일반명이 없어 이름 자리에 학명을 쓴 종은 학명 줄을 비우고, 일반명이 있으면 출처를 작게 적는다(speciesNamesEn)
const latinOf=s=>LANG==='en'&&s.label===s.name?'':s.name;
const nameSourceNote=s=>LANG==='en'&&s.enName?`<p class="fine">Common name: ${esc(s.enNameSource.replace(/ vernacular$/,''))}</p>`:'';
const escRaw = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const esc = value => escRaw(plainWords(screenKo(String(value ?? ''))));
// 2026-10-21 (site v4 08): plain Korean for the abbreviations a panel shows, beside the first one of each kind in that panel,
// and the method version by its Korean name ('verified-4.19' → '방법 4.19판'). Display only: records, file names and links keep
// their own strings (only text between tags changes, never an attribute or a URL).
const methodName=v=>String(v??'').replace(/(?<![\w-])verified-(\d+\.\d+)(?![\w.])/g,LANG==='en'?'Method v$1':'방법 $1판'); // 영어 화면: Method v4.19
// [pattern, gloss, category]: a gloss counts only when written right after the term; a category inside brackets reads '(LC·관심대상)'
const glossTerm=(term,ko,cat=false)=>[new RegExp(`(?<![A-Za-z0-9])${term}(?![A-Za-z0-9]|\\(|<span class="gloss">)`),ko,cat];
const GLOSS=[glossTerm('IC50','절반을 막는 농도'),glossTerm('EC50','절반 효과 농도'),glossTerm('Ki','결합 세기, 낮을수록 강함'),
  glossTerm('MIC','최소 억제 농도'),glossTerm('[µμ]M','마이크로몰'),
  ...[['LC','관심대상'],['NT','준위협'],['VU','취약'],['EN','위기'],['CR','위급']].map(([c,ko])=>glossTerm(c,ko,true))];
function glossHtml(html){
  const seen=new Set();let svg=0;
  return String(html??'').split(/(<[^>]*>)/).map(part=>{
    if(part.startsWith('<')){if(/^<svg\b/i.test(part))svg++;else if(/^<\/svg>/i.test(part))svg=Math.max(0,svg-1);return part;}
    let t=methodName(part);if(svg)return t;
    for(const [re,ko,cat] of GLOSS){if(seen.has(re))continue;const m=re.exec(t);if(!m)continue;seen.add(re);
      const at=m.index+m[0].length,inside=cat&&t[m.index-1]==='(';
      t=t.slice(0,at)+`<span class="gloss">${inside?'·'+ko:'('+ko+')'}</span>`+t.slice(at);}
    return t;}).join('');
}
// esc() for a Korean line that keeps English original wording (a title with its Korean name, a quoted phrase): each
// Hangul-free stretch of two or more English words is wrapped in <span lang="en">. Text with no Hangul is left to enAttr.
const escL = value => {const t=plainWords(screenKo(String(value ?? '')));if(!/[\u3131-\u318e\uac00-\ud7a3]/.test(t))return escRaw(t);
  return t.split(/([\u3131-\u318e\uac00-\ud7a3]+)/).map((p,i)=>{const m=i%2?null:p.match(/^([^A-Za-z]*)([A-Za-z][\s\S]*[A-Za-z.]|[A-Za-z])([\s\S]*)$/);
    return m&&(m[2].match(/\b[A-Za-z]*[a-z][A-Za-z]*\b/g)||[]).filter(w=>w.length>1).length>=2?`${escRaw(m[1])}<span lang="en">${escRaw(m[2])}</span>${escRaw(m[3])}`:escRaw(p);}).join('');};
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
  relaxed:{short:'ChEMBL 표적(펩타이드)',long:t=>`펩타이드를 ChEMBL 표적 비교집단(활성 기록 ${t.cohort_records}건)에서 순위`},
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
// 2026-10-17: a species without MBPI-Rx is outside the drug-target strata; the reason says where its items are
const rxReason=r=>r.reason===data?.assessmentInfo?.method?.mbpi_rx?.reasons?.only_excluded?'항목이 모두 제외 층(ACE·잔틴 산화효소 펩타이드)에 있습니다':r.reason;
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
// An original record left in English (title, citation, licence, measurement) is marked lang="en": no Hangul and 2+ words.
const enAttr=(html,lang='en')=>{const t=String(html??'').replace(/<[^>]*>/g,'');return /[\u3131-\u318e\uac00-\ud7a3]/.test(t)||(t.match(/[A-Za-z]{2,}/g)||[]).length<2?'':` lang="${lang}"`;};
// a whole original (name, list, target, measurement) shown in its own language: lang="en" (ru, ja by script) when it has
// no Hangul, else escL
const orig=(value,lang)=>{const v=esc(value),t=String(value??''),a=enAttr(v,lang||(/[\u0400-\u04ff]/.test(t)?'ru':/[\u3040-\u30ff]/.test(t)?'ja':'en'));return a?`<span${a}>${v}</span>`:escL(value);};
// Sources whose publisher moved the file for good (reports/link-check, 2026-10-15). The data keeps the address as it was
// read; the link opens the new address and says so. Same list in expedition.js.
const MOVED_LINKS = {
  'https://www.fao.org/3/I6655EN/uFiSh1.0.xlsx':'https://openknowledge.fao.org/server/api/core/bitstreams/11bf98db-a942-43ff-9271-6b8adf1166c9/content',
  'https://www.fao.org/3/I6655EN/i6655en.pdf':'https://openknowledge.fao.org/server/api/core/bitstreams/d48eb825-b91f-431f-8374-f882c1d647a4/content'
};
const sourceLink = (url,label) => {const text=esc(label);return MOVED_LINKS[url]
  ? `<a href="${esc(MOVED_LINKS[url])}" target="_blank" rel="noopener" title="원래 주소: ${esc(url)}"${enAttr(text)}>${escL(label)}</a> <small class="moved-link">원문 이동됨</small>`
  : `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener"${enAttr(text)}>${escL(label)}</a>`;};
const recordLabel = s => !s.noOccurrences&&Number.isSafeInteger(s.recordCount) ? s.recordCount.toLocaleString()+'건' : '—';
// Evidence stages are independent of the operational DB's old inventory counters.
// A paper or a search with no matching assessment never becomes a scored input.
// A candidate release file newer than this code is not a failed review; only a refresh is needed (live-data.js).
const releaseMissing = s => s.releaseOutdated ? '검수 자료 새 버전 있음 · 새로고침(F5)' : '새로고침(F5)으로 검수 자료 다시 불러오기';
const coverageStages={checked_none:'조사 완료',searched_none:'조사 완료',unavailable:'—',found:'원자료 발견',linked:'종 연결',verified:'원문 확인',calculated:'시범 산출',validated:'정식 산출'};
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
// 2026-10-17 (LKH): no validation result is drawn, passed or not (one shown alone reads the others as failed)
const pilotLabel = (key,info) => released(info)?'정식 산출':'시범 지표';
const validationNote = () => '';
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
      detail:s.cells?.length?'공개 출현 셀에 종을 연결했습니다(공개된 관측 기록 기준).':'공개 출현 기록 건수입니다.'},
    {name:'영양',stage:pilotScore(s,'MFPI')!==null?(validationResult('MFPI')==='passed'?'validated':'calculated'):foodLinked?'linked':foodRows.length||extras.length||nutrition.status==='available'?'found':'unavailable',
      detail:pilotScore(s,'MFPI')!==null?(validationResult('MFPI')==='passed'?`동기준 영양·가식부·양식 근거로 ${released()?'정식':'시범'} MFPI를 산출했습니다. MFPI 방법은 같은 종의 일본 식품성분표 값으로 다시 계산해도 순위가 유지되는지 본 방법 검증(${validationN('MFPI')||'?'}종 비교)을 통과했습니다. 이 종의 값을 따로 검증한 것은 아닙니다.`:'동기준 영양·가식부·양식 근거로 '+(released()?'정식':'검증 전 시범')+' MFPI를 산출했습니다.'):foodLinked?'종별 원값은 확인했으나 시료 상태·가식부·동일 기준 비교 또는 양식 근거가 부족해 MFPI는 보류합니다.':'영양 자료가 있더라도 이 종의 비교 가능한 원값인지 확인해야 합니다.'},
    {name:'생리활성',stage:pilotScore(s,'MBPI')!==null&&!a?.mbpi_floor?(validationResult('MBPI')==='passed'?'validated':'calculated'):bioLinked?'linked':partial.length||compounds.status==='available'?'found':released()&&a?.chembl_links?.paper_search?.searched_on?'searched_none':'unavailable',
      detail:pilotScore(s,'MBPI')!==null&&a?.mbpi_floor?`${a.mbpi_label}: 어느 비교집단 층에도 규칙을 채우는 항목이 없어 하한값 ${a.mbpi_floor.value}을 썼습니다(방법 결정 2026-10-05). ${a.mbpi_floor.meaning}`:pilotScore(s,'MBPI')!==null?`${bestBio(a)?.stratum_kind==='chembl'?`종→화합물 공개 연결(LOTUS·원논문)과 ChEMBL 같은 표적·종말점 비교집단으로 ${released()?'정식':'시범'} MBPI를 산출했습니다(${bestBio(a).label}).`:'기원종·확정 구조·정량 실험·동일 층 비교집단을 검수해 '+(released()?'정식':'시범')+' MBPI를 산출했습니다.'}`:partial.length?'논문 단서만으로는 기원종→확정 물질→정량 시험→동일 조건 비교집단을 모두 연결하지 못했습니다. MBPI는 보류합니다.':'화합물 건수나 시험 생물만으로 종의 정량 활성은 확인되지 않습니다.'},
    {name:'보전',stage:pilotScore(s,'MCUI')!==null?(validationResult('MCUI')==='passed'?'validated':'calculated'):conservation?.iucn_state==='assessed'?'linked':conservation?.recheck?'checked_none':'unavailable',
      detail:(stockMcui(s)?stockLead(s)+' ':'')+(earlyMcui(s)?`보전 평가 범주를 확인해 ${released()?'정식':'시범'} MCUI를 산출했습니다.`
        :nationalMcui(s)?`한국 국가생물적색자료집 등급으로 ${released()?'정식':'시범'} MCUI를 산출했습니다.`
        :preliminaryMcui(s)?`분포 범위 계산(IUCN 기준 B 적용)으로 ${released()?'정식':'시범'} MCUI를 산출했습니다.`
        :substituteMcui(s)?`${esc(mcuiBasisLabel(s))} ${released()?'정식':'시범'} MCUI를 산출했습니다.`
        :pilotScore(s,'MCUI')!==null?'검수된 IUCN 평가와 현행 여부를 확인해 독립적인 '+(released()?'정식':'시범')+' MCUI를 산출했습니다.'
        :'—')}
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
// (evidence_profile)
const evRule=()=>data?.assessmentInfo?.method?.evidence_profile||null;
const evProfile=s=>VERIFIED.includes(s?.assessment?.report_version)&&evRule()?s.assessment.evidence_profile||null:null;
// 2026-10-19 (LKH 9/10): every index number on screen is written by scoreNumber (score-format.js, shared with the sea
// expedition): BBVI and MBPI whole numbers, MFPI and MCUI one decimal, for every species and whatever the evidence behind it
// (until 10-19 a replicated top item, 미역's alone, kept one decimal). The line a number may not cross is its matrix line,
// judged on the value its type is judged on: the BBVI before rounding (raw; at the explore weight when the caller has none).
// Sorting, types and the files keep their values.
function scoreValue(s,key,v,raw){
  const rule=matrixRule(), line=key==='BBVI'?rule?.bbvi_threshold:key==='MCUI'?rule?.mcui_threshold:null;
  if(raw===undefined&&key==='BBVI'&&s&&Number.isFinite(v)&&v===pilotScore(s,'BBVI'))raw=bbviRawAt(s,bbviWeight)??v;
  return scoreNumber(key,v,line,raw??v);
}
// 7/15: an MCUI number always carries its category ('10.0 (LC)'); the helpers sit below, called only at render time
function scoreText(s,key,v,raw){
  const t=scoreValue(s,key,v,raw);
  if(t!=='–'&&key==='MCUI'&&s&&typeof mcuiCatTag==='function'){const c=mcuiCatTag(s);if(c)return `${t} (${c})`;}
  return t;
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
// An MBPI-Rx with no drug-target item reads '의약 표적 층 대상 외', never 0. Neither enters BBVI, the matrix or the type.
// MBPI-Rx sits on the MBPI scale, so every MBPI-Rx number reads as MBPI does: a whole number (scoreValue, 2026-10-19).
const cpMbpiKind=s=>{
  const k=mbpiKindOf(s), r=mbpiRxOf(s);
  const badge=k?`<p class="cp-kind"><span class="cp-kind-badge" data-kind="${k.kind}">${esc(k.long)}</span><span class="cp-kind-share">최상위 근거 · ${esc(mbpiKindShare(k))}</span></p>`:'';
  const rx=!r?'':`<div class="cp-sub cp-rx"><span class="cp-rx-name">MBPI-Rx <small>의약 표적만</small></span>`+(r.value===null?'<span class="cp-rx-none">—</span>'
    :`<span class="cp-bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,r.value))}%"></i></span><b class="cp-rx-num">${scoreValue(s,'MBPI',r.value)}</b>`)+'</div>';
  return badge+rx;
};
const axisStateNote={lookup_failed:'지표 보고서를 불러오지 못했습니다. 산출 보류가 아니며, 다시 불러오기로 재시도할 수 있습니다.',
  technical_error:'공개 보고서의 근거를 화면에서 다시 계산했을 때 맞지 않아 이 값을 숨겼습니다. 자료 부족에 따른 산출 보류와 다릅니다.',
  client_outdated:'지표 보고서가 이 화면 코드보다 새 버전입니다. 산출 보류나 기술 오류가 아니며, 페이지를 새로고침(F5)하면 최신 값이 보입니다.'};
const pilotCell = (s,key) => pilotScore(s,key)===null ? '<span class="pending">산출 보류</span>'
  : `${scoreText(s,key,pilotScore(s,key))}<small>시범 지표 · 타당성 미검증</small>`;

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
// All gates report first; a single reload then fetches the new app.js for every newer file at once. The mark just before
// it tells intro.js the reload is the app's own, not the visitor's F5: it shows no entry screen for it (2026-10-18). With
// the entry screen up there is no mark, so the reloaded page shows that screen again from the start.
function reloadOnceForNewData(outdated){
  if(!outdated.map(firstSeen).includes(true))return false;
  try{const c=document.documentElement.classList;if(!c.contains('gate-on')||c.contains('gate-leaving'))sessionStorage.setItem('bbvm-app-reload','1');}catch{}
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
// Farming stage per species (dist/aquaculture-tier.json, scripts/build_aquaculture_tier.py, 2026-10-15): 상업 양식 중 (KOSIS
// 해면양식 production of the species' own item, or a record or the FAO CASIP sheet naming commercial culture), 시험·연구 양식,
// 기록 없음 (the farming record stops before a full cycle). Display only: the MFPI farming term stays the reviewed record's
// feasible flag. Schema 1 is read; a higher number is a newer file; anything else is ignored and the two chips stay at 0.
let aquacultureTier=new Map(), aquacultureTierFile=null;
const AQUA_TIERS=['commercial','trial','none'];
// 2026-10-17 (LKH): the 'none' tier (a rearing attempt that stopped before a full cycle) is worded by what the record holds
const AQUA_NONE_SHOWN={tier_label:'사육 시도',basis:'보고서 양식 기록의 사육 시도 단계'};
function aquacultureTierRows(file,outdated){
  const v=/^aquaculture-tier-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'aquaculture-tier.json',version:file.schema_version});
  const rows=new Map();aquacultureTierFile=null;
  if(file?.schema_version!=='aquaculture-tier-1'||file.display_only!==true||!Array.isArray(file.rows))return rows;
  for(const r of file.rows)if(Number.isInteger(r?.aphia_id)&&AQUA_TIERS.includes(r.tier)&&r.tier_label&&r.basis)rows.set(r.aphia_id,r.tier==='none'?{...r,...AQUA_NONE_SHOWN}:r);
  aquacultureTierFile=file;return rows;
}
// one line for the food detail: the stage, its basis and where the basis comes from
function aquacultureTierLine(aphia){
  const r=aquacultureTier.get(aphia);if(!r)return '';
  const src=aquacultureTierFile?.sources||{}, link=r.source_id===src.kosis?.source_id?src.kosis:r.source_id===src.fao_casip?.source_id?src.fao_casip:null;
  const ref=link?` · <a href="${esc(link.url)}" target="_blank" rel="noopener">${r.source_id===src.kosis?.source_id?'KOSIS':'FAO 양식종 자료집'} ↗</a>`:r.tier==='commercial'?' · '+verifiedSource(r.source_id,'근거 ↗'):'';
  return `<p class="aqua-tier" data-tier="${esc(r.tier)}"><b>양식 단계</b> ${esc(r.tier_label)} · ${esc(r.basis)}${ref}</p>`;
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
function supplementaryLine(s){
  const rows=litRows(s);
  return '';  // 2026-10-17 (LKH): the related-paper list stays in supplementary-literature.json and is not drawn
  if(!rows.length)return '';
  const contrary=rows.filter(r=>r.relation==='contrary').length;
  const doi=d=>`<a href="https://doi.org/${encodeURI(d)}" target="_blank" rel="noopener">${esc(d)}</a>`;
  return `<details class="score-disclosure lit-disclosure"><summary><span>관련 문헌 · 점수 미사용</span><b>${esc(rows.length+'편'+(contrary?' · 반대 근거 '+contrary+'편':''))}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">문헌 조사(2026-10-14)에서 찾았지만 고정 규칙에 맞지 않아 점수에 쓰지 않은 논문입니다. MBPI·BBVI·MCUI·매트릭스·지도 색에 들어가지 않고, '최상위 근거 독립 재현 확인 중' 표시(MBPI 1위 항목의 독립 재현 여부)와도 다른 수입니다.</p>`+
    `<ul class="lit-list">${rows.map(r=>`<li data-relation="${esc(r.relation)}"><b class="lit-rel">${esc(LIT_RELATION[r.relation])}</b> ${esc(r.title_ko)} <span class="lit-src"${enAttr(r.journal)}>(${esc(r.journal)}, ${esc(r.year)}) ${doi(r.doi)}</span>`+
      `<p class="fine">${esc(r.finding)}</p><p class="fine lit-why">점수 미사용: ${esc(r.not_scored_reason)} · ${esc(r.checked_on)} ${r.checked_via==='full_text'?'원문':'초록'} 확인</p></li>`).join('')}</ul>`+
    `</div></details>`;
}
// Method change ledger (research/method-changelog.json, copied to dist/ by scripts/build_method_changelog.py): one entry per
// published method version with its date, reason, pre-registration and score impact. It feeds the method tab's timeline
// (fold 04) and the freeze date beside the version in the header. Schema 'method-changelog-1' is read; a higher number is a
// newer file this code does not know; anything else is ignored and the timeline says the record could not be read.
let methodChangelog=null;
function changelogFile(file,outdated){
  const v=/^method-changelog-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'method-changelog.json',version:file.schema_version});
  return file?.schema_version==='method-changelog-1'&&Array.isArray(file.entries)&&file.entries.length?file:null;
}
// the freeze date shown beside the version: only when the ledger's current version is the version on screen
const frozenOn=info=>methodChangelog?.current?.method_version===info?.version?methodChangelog.current.frozen_on||'':'';
// Release stamp (2026-10-19, LKH): dist/release.json names the build shown at the presentation ({"label","date","commit"},
// and an optional "note" for a fix made after the freeze; README '제출 뒤 동결'). With no commit the popover shows the
// method version as before.
let releaseInfo=null;
const releaseText=r=>{const c=String(r?.commit??'').trim();return /^[0-9a-f]{7,40}$/i.test(c)?[[r.label,r.date].map(x=>String(x??'').trim()).filter(Boolean).join(' '),`커밋 ${c.slice(0,7).toLowerCase()}`,String(r.note??'').trim()].filter(Boolean).join(' · '):'';};
function renderPopVersion(){
  const info=data?.assessmentInfo;
  $('pop-version').textContent=releaseText(releaseInfo)||(data&&info?.version?`${released(info)?'':'시범 '}${methodName(info.version)}${frozenOn(info)?` · ${frozenOn(info)} 동결`:''}`:'');
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
// Candidate-compound search layer (dist/cmnpd-candidates.json, built by scripts/build_cmnpd_candidates.py): how many compounds
// CMNPD 1.0 reports for the species, shown in the species profile with '점수 미사용' and the CMNPD licence. MBPI is computed
// from ChEMBL and the peptide databases only; nothing here reaches a score, the matrix, the map colours or a chip. Only CMNPD IDs
// and counts are published. Schema 1 is read; a higher number is a newer file this code does not know; anything else is ignored.
let cmnpdCandidates={rows:new Map(),source:null,totals:null};
function cmnpdRows(file,outdated){
  const v=/^cmnpd-candidates-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'cmnpd-candidates.json',version:file.schema_version});
  const rows=new Map();
  if(file?.schema_version!=='cmnpd-candidates-1'||file.display_only!==true||file.used_in_scores!==false||!Array.isArray(file.species))return {rows,source:null,totals:null};
  for(const r of file.species)if(Number.isSafeInteger(r?.aphia_id)&&Number.isSafeInteger(r.compound_count)&&r.compound_count>=0)rows.set(r.aphia_id,r);
  return {rows,source:file.source||null,totals:file.totals||null};
}
// '근거와 방법' fold 02: the counts behind 'why ChEMBL', read from the same file (no number is written into the page by hand)
function cmnpdMethodText(){
  const t=cmnpdCandidates.totals, src=cmnpdCandidates.source;
  if(!t||!src||!data?.species)return '';
  return `${src.accessed} 조회 기준, ${t.species}종 중 ${t.species_with_compounds}종에서 CMNPD 보고 화합물 ${t.pairs.toLocaleString()}개를 찾았습니다. `+
    `후보 화합물 탐색에 쓰는 참고 자료이며, MBPI는 종–화합물 연결(위키데이터 P703·원논문)과 ChEMBL 활성값으로 계산합니다.`;
}
function cmnpdLine(s){
  const r=cmnpdCandidates.rows.get(s?.aphiaID), src=cmnpdCandidates.source;
  if(!r||!src)return '';
  const lic=sourceLink(src.license_url,src.license);
  const tip=`CMNPD 1.0에서 이 종의 학명과 WoRMS 이명(${r.names_searched}개)으로 찾은 보고 화합물 수입니다(${src.accessed} 조회). 화합물 ID와 개수만 싣습니다. MBPI는 ChEMBL 표준화 활성값으로 계산합니다.`;
  return `<p class="cp-cmnpd" title="${esc(tip)}"><b>후보 화합물 탐색 <span class="cp-cmnpd-tag">참고 자료</span></b>`+
    `${sourceLink(src.url,'CMNPD')} 보고 화합물 <strong>${r.compound_count.toLocaleString()}개</strong> · ${lic}</p>`;
}
// 검증 기록 (dist/posthoc-scorecard.json, built by scripts/build_posthoc_scorecard.py from posthoc.validation_sets). A same-data
// or two-species consistency check is never shown as 통과. Display only: nothing here reaches a score, the matrix, the map
// colours or a chip. Schema 1 is read; a higher number is a newer file; anything else is ignored.
// 2026-10-19 (team lead, LKH: '되살리기'): the verification records are on screen again, replacing the 2026-10-17 decision
// that no verification state is shown. Fold 04 of the method tab lists every check with its stored result
// (renderPosthocTable), and the species detail's MBPI and preliminary MCUI lines link to their rows (openChecks). The
// journey-card badges were not brought back: renderVerifyBadges keeps any badge left in the markup hidden and empty.
let posthocScorecard=null;
const SCORECARD_OC={'통과':'pass','실패':'fail','실패 후 사용 중단':'stopped','일관성 확인(독립 아님)':'consistent','검증 불성립':'void'};
function scorecardFile(file,outdated){
  const v=/^posthoc-scorecard-(\d+)$/.exec(file?.schema_version||'');
  if(v&&Number(v[1])>1)outdated.push({file:'posthoc-scorecard.json',version:file.schema_version});
  if(file?.schema_version!=='posthoc-scorecard-1'||file.display_only!==true||!Array.isArray(file.rows))return null;
  return file.rows.every(r=>r&&SCORECARD_OC[r.outcome_class])?file:null;
}
function renderVerifyBadges(){
  document.querySelectorAll('#method .mt-vbadge[data-ind]').forEach(b=>{b.hidden=true;b.textContent='';b.title='';delete b.dataset.state;});
}
// 04 검증 기록: one row per check, in the file's order. The result reads in words as well as colour (a consistency check that
// is not independent has its own words, colour and dashed border, never the 통과 look), and the line above the table counts
// each class. The numbers a row quotes come from its record file (figure, read there by the build) with that record's version.
const CHECK_COUNT_LABEL={'통과':'통과','실패':'기준 미충족','실패 후 사용 중단':'미충족 후 사용 중단','일관성 확인(독립 아님)':'일관성 확인(독립 아님)','검증 불성립':'검증 불성립'};
const checkVersion=v=>String(v||'').replace(/^verified-pilot-/,'시범 ').replace(/^verified-/,'');
function renderPosthocTable(){
  const body=$('mt-ck-body');if(!body)return;
  const sc=posthocScorecard;
  if(!sc){
    $('mt-ck-title').textContent='검증 기록';body.innerHTML='';$('mt-ck-foot').textContent='';
    $('mt-ck-sum').textContent=data?'검증 기록 파일(posthoc-scorecard.json)을 읽지 못했습니다. 기록은 저장소의 research/verified-indices에 있습니다.':'검증 기록을 불러오는 중입니다.';return;
  }
  $('mt-ck-title').textContent=`검증 기록 ${sc.total}건`;
  $('mt-ck-sum').innerHTML=Object.keys(SCORECARD_OC).filter(c=>sc.counts?.[c]).map(c=>`<span data-oc="${SCORECARD_OC[c]}">${esc(CHECK_COUNT_LABEL[c])} ${esc(sc.counts[c])}</span>`).join(' · ');
  const record=p=>`<a href="${escRaw(sc.repository+p)}" target="_blank" rel="noopener" title="${escRaw(p)}">${escRaw(p.split('/').pop())} ↗</a>`;
  const commitUrl=c=>sc.repository.replace(/\/blob\/[^/]+\/$/,'/commit/')+c;
  body.innerHTML=[...sc.rows].sort((a,b)=>a.order-b.order).map(r=>{const oc=SCORECARD_OC[r.outcome_class];
    return `<tr data-oc="${oc}" data-key="${esc(r.key)}" id="mt-ck-${esc(r.key)}">`+
      `<th scope="row"><b>${esc(r.name)}</b><small class="mt-ck-rec">기록 ${r.records.map(record).join('')}${r.record_note?`<span>${esc(r.record_note)}</span>`:''}</small></th>`+
      `<td data-label="무엇을 확인했나"><span>${esc(r.checked)}</span></td>`+
      `<td data-label="사전 등록"><b>${esc(r.preregistered_label)}</b><small>${esc(r.preregistered_note)}</small></td>`+
      `<td data-label="결과"><span class="mt-ck-pill" data-oc="${oc}">${esc(r.outcome_label)}</span>`+
        `${r.figure?`<small class="mt-ck-fig">${esc(checkVersion(r.figure.record_version))} 기록: ${esc(r.figure.text)}</small>`:''}</td>`+
      `<td data-label="그 뒤 처리"><b${r.action==='none'?' class="mt-ck-na"':''}>${esc(r.action_label)}</b><small>${esc(r.action_detail)}</small>`+
        `${r.action_history?`<small class="mt-ck-hist">${esc(r.action_history)}</small>`:''}</td></tr>`;}).join('')+
    // 2026-10-21 (site v4 09): checks registered before any result: the pre-registration file, the commit that added it
    // alone, and when the result comes; never counted above (its result is not stored yet)
    (Array.isArray(sc.registered)?sc.registered:[]).filter(r=>r?.key&&r.name&&r.prereg&&/^[0-9a-f]{7}$/.test(r.prereg_commit||'')&&/^\d{4}-\d{2}$/.test(r.results_due||'')).map(r=>
      `<tr data-oc="registered" data-key="${esc(r.key)}" id="mt-ck-${esc(r.key)}">`+
      `<th scope="row"><b>${esc(r.name)}</b><small class="mt-ck-rec">기록 ${record(r.prereg)}</small></th>`+
      `<td data-label="무엇을 확인했나"><span>${esc(r.checked)}</span></td>`+
      `<td data-label="사전 등록"><b>예</b><small><a href="${escRaw(commitUrl(r.prereg_commit))}" target="_blank" rel="noopener">사전 등록 커밋 ${esc(r.prereg_commit)} ↗</a></small></td>`+
      `<td data-label="결과"><span class="mt-ck-pill" data-oc="registered">등록됨</span><small class="mt-ck-fig">${esc(r.results_due)} 공개 예정</small></td>`+
      `<td data-label="그 뒤 처리"><b class="mt-ck-na">결과가 나오면 이 줄에 적음</b></td></tr>`).join('');
  $('mt-ck-foot').textContent=`‘일관성 확인(독립 아님)’은 점수를 만든 자료와 같은 자료로 보거나 2종만 비교한 확인이라 통과로 세지 않습니다. `+
    `‘검증 불성립’은 미리 정한 최소 표본 수에 못 미쳐 판정하지 못했다는 뜻입니다. 사전 등록 ‘예’ ${sc.preregistered}건은 결과를 보기 전에 기준을 정했습니다. `+
    `결과 칸의 숫자는 각 기록 파일에 저장된 그때 값이고, 기록 파일은 프로젝트 GitHub 저장소에 있습니다. ${checkVersion(sc.report_version)} 기준.`;
  // the full history of rule changes stays a file (the 2026-10-17 timeline is not drawn again; LKH 2026-10-21, option A)
  const ledger=$('mt-ck-ledger');if(ledger)ledger.innerHTML=`지표 규칙이 바뀐 이력 전체: ${record('research/method-changelog.json')}`;
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
      '공공누리 제3유형':'https://www.kogl.or.kr/info/licenseType3.do'}[l],l)).join(' · ');
    return `<li>${sourceLink(x.url,x.title||'제공처 원문')}${terms?' · '+terms:''}</li>`;
  }).join('');
}
function mapJudgmentStatus(s) {
  const n=spatialCells(s).length,type=matrixType(s);
  if(matrixRule()){
    $('map-judgment').textContent=`이 종의 매트릭스 유형: ${type?matrixTypeLabel(type)+(separateMcui(s)?'(MCUI '+mcuiBasisLabel(s)+')':''):'—'}`+
      (type&&s.cells?.length?` · 활용 × 보전 지도에서 이 종이 기록된 ${n}개 셀 색에 반영됩니다(종 단위 값).`:'');
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
const IUCN_HISTORICAL = {"241776":{"category":"EN A2bd","published":2013,"assessed":"2010-05-19","scope":"북서태평양 전 분포 대상","url":"https://www.iucnredlist.org/species/180424/1629389",
  "current":{"category":"EN","published":2026,"citation":"Hamel & Mercier 2026","scope":"전 세계(Global) 평가","url":"https://doi.org/10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en","found_via":"GBIF의 IUCN 적색목록 체크리스트(2026-07-28판)","checked":"2026-09-25"}}};
// Wording follows the MCUI gate: a pilot MCUI exists only after a sourced, dated current-status check.
function iucnHistoricalText(h,s){
  const base=`IUCN ${h.category}: ${h.published}년 발표(${h.assessed} 평가) · ${h.scope}.`;
  const t=s&&pilotScore(s,'MCUI')!==null?s.assessment.conservation_trace:null;
  if(t&&t.record_id&&t.publication_year&&t.publication_year!==h.published)
    return `IUCN 현행 평가 ${t.category} ${t.criteria||''}: ${t.publication_year}년 발표(${t.assessment_date} 평가) · 전 지구 범위. 이전 ${h.category}(${h.published}년 발표, ${h.assessed} 평가)는 대체된 역사적 평가입니다. ${released()?'MCUI':'검증 전 시범 MCUI'}에는 현행 평가만 사용했습니다.`;
  return t
    ? `${base} ${released()?'지표':'시범'} 보고서가 ${t.current_status_checked_on}에 출처 ${t.current_status_source_id}로 이 평가가 현행 IUCN 평가임을 재확인해, ${released()?'MCUI':'검증 전 시범 MCUI'}에 사용했습니다. 전 세계 범위의 평가입니다.`
    : h.current
    ? `IUCN ${h.current.category}: ${h.current.published}년 발표(${h.current.citation}) · ${h.current.scope}. ${h.published}년 ${h.category} 평가(${h.assessed} 평가)를 대체한 현행 평가입니다. 등급과 인용은 ${h.current.found_via}에서 ${h.current.checked}에 확인했고, 평가 기준·평가일·범위는 원문 검수 전입니다.`
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
const CASE_NOTES = {"241776":{"title":"돌기해삼 원논문","url":"https://doi.org/10.1111/bph.16333","detail":"Holotoxin A₁의 Candida albicans SC5314 MIC·MFC 각 2 µg/mL(원논문에서 직접 확인). 이 생물에서 나온 물질의 실험 결과입니다."},"377084":{"title":"다시마 원논문","url":"https://doi.org/10.1002/cbdv.202000233","detail":"Lj5 다당류 분획의 α-glucosidase IC50 153.27 ± 22.89 µg/mL(원논문 확인). 다당류 분획의 실험 결과라 화합물 항목과 따로 적습니다."}};
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
const officialNote=s=>{const o=officialBbvi(s);return weightOff()&&o!==null&&o!==pilotScore(s,'BBVI')?`공식 ${scoreText(s,'BBVI',o,bbviRawAt(s,officialWeight())??o)}`:'';};
// a shared link's w: a number in 0–1 snaps to the nearest step; anything else is the official weight
const hashWeightStep=v=>{const n=Number(v);return String(v??'').trim()!==''&&Number.isFinite(n)&&n>=0&&n<=1?weightStep(n):weightStep(officialWeight());};
// 2026-10-13 design 2: a plain verdict before the formal type name (display only; data, hash and CSV keep the type id)
// 4.14 (prereg-4.14-2026-10-14 7): the report's own position words ('활용 지표 높음'), not a use or harvest verdict; an older
// report without them gets the same neutral words
const MATRIX_PLAIN_DEFAULT={sustainable_use:'활용 지표 높음',baseline_survey:'두 지표 모두 낮음',alternative_production:'두 지표 모두 높음',conservation_priority:'보전 지표 높음'};
const MATRIX_PLAIN=new Proxy({},{get:(_,id)=>Object.values(matrixRule()?.types||{}).find(t=>t.id===id)?.plain||MATRIX_PLAIN_DEFAULT[id]});
// 2026-10-17 (team lead): a species without a type shows '—' in the type slot, with no reason line
const matrixTypePlain=id=>MATRIX_PLAIN[id]||'—';
// 2026-10-17 (#10): what the line and the types are, in positive words (the report keeps its own threshold_label and type_note)
const thresholdWord=()=>'탐색용 기준선';
const matrixPlainNote=()=>{const r=matrixRule();return '연구 순서를 고르기 위한 분류'+(r?` · ${thresholdWord()}: BBVI ${r.bbvi_threshold} 이상이면 활용 지표 높음, MCUI ${r.mcui_threshold} 이상이면 보전 지표 높음`:'');};
// 4.14 (prereg-4.14-2026-10-14 7): visible words that keep '보전평가 미확인' apart from an official low-risk category
const consShort=(s,long)=>{const c=s?.assessment?.conservation_status;if(!c||!data?.assessmentInfo?.method?.mcui_scope)return '';
  // 2026-10-17: a scored MCUI reads the same for every basis ('10.0 (LC)'); its source is named only in the species detail
  if(c.state==='official_scored'||c.state==='preliminary_scored')return stockMcui(s)?'어획량 감소':'';
  if(c.mcui_role==='stock_decline_lower_bound')return long?c.mcui_role_label:'평가 미확인 · 자원 감소 하한';
  return c.state==='official_dd'?'공식 DD(정보 부족)':c.state==='official_ne'?'공식 NE(미평가)':c.state==='lookup_failed'?'조회 실패':long?c.label:'보전평가 미확인';};
// the verdict word in a light type colour for the dark explore panels (theme.css .vd-*); null = '—' in grey
const verdictWord=t=>`<b class="verdict vd-${t||'none'}">${esc(matrixTypePlain(t))}</b>`;
// A Korean national-assessment MCUI is its own stratum: labelled apart and never ranked or plotted with IUCN-based MCUI.
const nationalMcui = s => s?.assessment?.mcui_basis==='national'&&pilotScore(s,'MCUI')!==null;
// After 3.14: another range state's national list. Like the Korean national basis, it is its own stratum: labelled, drawn with
// the separate matrix marker and never ranked or pooled with IUCN-based MCUI.
// 4.2 (team-lead decision 2026-10-04): a sub-national red list is a second substitute basis, below every national one.
const SUBSTITUTE_BASES=['range_state','sub_national','preliminary'];
const subNationalMcui = s => s?.assessment?.mcui_basis==='sub_national'&&pilotScore(s,'MCUI')!==null;
// 4.17 (prereg-4.17-2026-10-15): with no IUCN global or Korean national category, a range-state list or the Rapid LC check
// stands in as a preliminary assessment until an official result is published. It is never called IUCN or official; the
// detail's MCUI section names it and its basis. 2026-10-19 (LKH, '되살리기'): a Rapid LC value (mcui_basis 'preliminary',
// rawPreliminaryMcui; a range state's national list is not marked) carries '예비' beside its number everywhere
// ('10.0 (LC·예비)', mcuiCatTag), a hollow matrix point, and in the detail one line with its back-test and a link to its row
// of the method tab's 검증 기록 (preliminaryMcuiLine).
const earlyMcui = s => s?.assessment?.conservation_status?.state==='preliminary_scored'&&pilotScore(s,'MCUI')!==null;
// 4.3 (team-lead decision 2026-10-05): a scored Rapid LC check, the last basis, with its own marker and label.
const rawPreliminaryMcui = s => s?.assessment?.mcui_basis==='preliminary'&&pilotScore(s,'MCUI')!==null;
const preliminaryMcui = s => rawPreliminaryMcui(s)&&!earlyMcui(s);
// the axis label of one species' value: a scored Rapid LC is never called an official category
// 4.12 (prereg-4.12-2026-10-14): an MCUI set by the KOSIS catch-trend signal, beside its extinction-risk basis; not an IUCN category.
const stockMcui = s => s?.assessment?.mcui_driver==='stock_decline'&&pilotScore(s,'MCUI')!==null;
// the catch change as people read it: a 79.8% fall is '−79.8%', a 28.6% rise '+28.6%'
const stockChange = d => d?.decline_pct===null||d?.decline_pct===undefined?'':(d.decline_pct>0?'−':d.decline_pct<0?'+':'±')+Math.abs(d.decline_pct).toFixed(1)+'%';
// 2026-10-21 (site v4 06): the decline bands are shown by what they measure, '어획량 감소 신호(80% 이상)', not by the report's
// band words; the report, the scores and the bands stay as they are. Any other label (no signal, farming-led, …) as written
const stockBandLabel = d => {const b=(data?.assessmentInfo?.method?.mcui_stock_decline?.bands||[]).find(x=>x.label===d?.label);
  return b&&Number.isFinite(b.min_decline)?`어획량 감소 신호(${Math.round(b.min_decline*100)}% 이상)`:String(d?.label||'');};
const stockLabel = s => '자원 감소 신호 · 어획량 '+stockChange(s.assessment.stock_decline);
// 7/15 (2026-10-15): MCUI is the conservation category turned into a number (LC 10 · NT 35 · VU 60 · EN 80 · CR 100) plus the
// stock-decline signal, so a number never stands alone: the category that set it rides beside it, '10.0 (LC)', '80.0 (EN, A2bd)',
// '60.0 (LC + 자원 감소)'. Display only: no value, mapping or type changes. The tag never says 'IUCN' or '공식'. 2026-10-19 (LKH):
// a Rapid LC value adds '예비' ('10.0 (LC·예비)', judged on mcui_basis alone), on the cards, the compare table, the matrix
// tooltips and the species detail alike.
const MCUI_DEF='보전 상태 등급(IUCN·국가) + 자원 감소 신호';
// beside one species' value the definition names only that species' own source (IUCN or 국가); a preliminary basis gets none (4.17)
const mcuiDefOf = s => {const b=s?.assessment?.mcui_basis,src=b==='iucn'?'IUCN':b==='national'?'국가':'';return `보전 상태 등급${src?`(${src})`:''} + 자원 감소 신호`;};
const mcuiCategory = s => {const a=s?.assessment;return a?.conservation_status?.category||(a?.mcui_basis==='national'?a.national_assessment?.category:a?.mcui_basis==='iucn'?a.conservation_trace?.category:null)||null;};
// IUCN criteria (e.g. A2bd) exist only for an IUCN global basis; national and other lists publish none in our records
const mcuiCriteria = s => s?.assessment?.mcui_basis==='iucn'&&s.assessment.conservation_trace?.criteria||null;
function mcuiCatTag(s,short){
  if(pilotScore(s,'MCUI')===null)return '';
  const cat=mcuiCategory(s), crit=short?null:mcuiCriteria(s), stock=stockMcui(s);
  if(!cat)return stock?'어획량 감소':'';
  return cat+(crit?', '+crit:'')+(rawPreliminaryMcui(s)?'·예비':'')+(stock?(short?'+감소':' + 어획량 감소'):'');
}
// the published year of the category behind the MCUI; a Rapid LC check carries the report year
function mcuiAssessYear(s){
  const a=s?.assessment, c=a?.conservation_status;if(!a||pilotScore(s,'MCUI')===null)return null;
  if(a.mcui_basis==='iucn'&&Number.isFinite(a.conservation_trace?.assessment_year))return a.conservation_trace.assessment_year;
  const used=(c?.assessments||[]).find(x=>x.used_for_mcui);
  const y=used?parseInt(String(used.year),10):a.mcui_basis==='preliminary'?parseInt(String(data?.assessmentInfo?.generatedAt||''),10):NaN;
  return Number.isFinite(y)?y:null;
}
const TREND_KO={Decreasing:'감소',Stable:'안정',Increasing:'증가',Unknown:'알 수 없음'};
// '보조 정보': the continuous facts already in the record, one line. Shown only, never added to the MCUI.
function mcuiAuxParts(s){
  const a=s?.assessment;if(!a||pilotScore(s,'MCUI')===null)return [];
  const parts=[], y=mcuiAssessYear(s), now=parseInt(String(data?.assessmentInfo?.generatedAt||''),10);
  if(y){const old=a.mcui_basis==='iucn'&&typeof a.conservation_trace?.assessment_older_than_10y==='boolean'?a.conservation_trace.assessment_older_than_10y:Number.isFinite(now)&&now-y>10;
    parts.push(`평가 ${y}년`);}
  const crit=mcuiCriteria(s), cat=mcuiCategory(s);
  if(crit)parts.push('기준 '+crit);
  const tr=a.mcui_basis==='iucn'?a.conservation_trace?.population_trend:null;
  if(tr&&tr!=='Unknown')parts.push('개체군 추세 '+(TREND_KO[tr]||tr));
  const d=a.stock_decline;
  if(d&&d.match_level!=='none')parts.push(d.decline_pct===null||d.decline_pct===undefined?String(d.label||'').replace(/^자원 감소 신호: ?/,'자원 감소율 · '):
    `어획량 변화 ${stockChange(d)} (KOSIS 어획량 통계)`+(Number.isFinite(d.reference_2025p?.coastal_t)?` · 2025년 잠정 ${Math.round(d.reference_2025p.coastal_t).toLocaleString()}톤`:'')+(Number.isFinite(d.score)?` · 어획량 감소 신호 ${scoreValue(s,'MCUI',d.score)}점`:` · ${String(d.label||'자원 감소 신호 없음').replace(/^자원 감소 신호: ?/,'').replace(/^(.+) · 해당 없음$/,'자원 감소 신호 해당 없음($1)')}`));
  return parts;
}
const mcuiAuxLine = s => {const p=mcuiAuxParts(s);return p.length?'보조 정보 · '+p.join(' · '):'';};
// the tie rule shown wherever species are put in MCUI order
// a big MCUI number keeps its category in a smaller line of type: '10.0 (LC)' → 10.0<small>(LC)</small>
const catSmall=(text,cls)=>String(text).replace(/^(\S+) \((.+)\)$/,`$1 <small class="${cls}">($2)</small>`);
const MCUI_TIE_RULE='같은 MCUI 점수의 종은 이름 가나다순으로 보여 주고, 매트릭스에서는 같은 높이에서 BBVI 순서로 가로로 놓습니다';
// the MCUI before the max, for the lines that describe the extinction-risk basis itself
const extinctionMcui = s => pilotScore(s,'MCUI')===null?null:s.assessment?.mcui_driver?s.assessment.mcui_extinction_risk:pilotScore(s,'MCUI');
// 2026-10-17 (LKH): one axis label for every basis; no check result, back-test or evidence label rides beside a value
const axisLabel = (s,key,info) => pilotLabel(key,info);
const mcuiBacktest = () => '';
// 2026-10-21 (사이트 v4 prompt 04, evaluation C2·J2): beside every MBPI number, the substance its top item was measured on and
// the kind of test, from the item itself: a peptide by its sequence ('VW 펩타이드 · ACE 저해 IC50'), a ChEMBL compound by its
// name ('Halocynthiaxanthin · HIV-1 역전사효소 저해 IC50'). Nothing is looked up or guessed: without a name or a test kind, ''.
const MBPI_TARGET_KO={'Human immunodeficiency virus type 1 reverse transcriptase':'HIV-1 역전사효소 저해','Human immunodeficiency virus 1':'HIV-1 항바이러스'};
const compoundName = n => {const t=String(n||'').trim();return t?t.charAt(0)+t.slice(1).toLowerCase():'';};
function mbpiMaterial(s){
  const st=mbpiStratumOf(s), x=st&&bestBio(s.assessment);if(!x)return '';
  if(x.stratum_kind==='chembl'){
    const name=compoundName(x.compound_name), test=MBPI_TARGET_KO[x.target_name];
    return name&&test&&x.standard_type?`${name} · ${test} ${x.standard_type}`:'';
  }
  const seq=String(x.peptide_sequence||'').trim(), kind=MBPI_ASSAY_KIND[st.key], ends=[...new Set((x.measurements||[]).map(m=>m.endpoint))];
  return seq&&kind&&ends.length&&ends.every(Boolean)?`${seq} 펩타이드 · ${kind} ${ends.join('·')}`:'';
}
const basisNote = (s,key) => key==='MCUI'&&separateMcui(s)?' · '+mcuiBasisShort(s):
  key==='MBPI'&&pilotScore(s,'MBPI')!==null?(mbpiMaterial(s)?' · '+mbpiMaterial(s):'')+(bestBio(s.assessment)?.stratum_kind==='xo'?' · XO 문헌 비교집단':bestBio(s.assessment)?.stratum_kind==='relaxed'?' · ChEMBL 표적 비교집단':''):'';
const axisTag = (s,key,info) => axisLabel(s,key,info)+basisNote(s,key);
const rawSubstituteMcui = s => SUBSTITUTE_BASES.includes(s?.assessment?.mcui_basis)&&pilotScore(s,'MCUI')!==null;
const substituteMcui = s => rawSubstituteMcui(s)&&!earlyMcui(s);
const extinctionSeparate = s => nationalMcui(s)||substituteMcui(s);
const separateMcui = s => extinctionSeparate(s)||stockMcui(s);
const subRegions = s => (s.assessment.mcui_substitute?.record?.regions||[]).map(r=>koEn(r.region_ko,r.region)).join(', ');
const extinctionBasisLabel = s => s?.assessment?.conservation_status&&!s.assessment.mcui_basis?'':nationalMcui(s)?'한국 국가 평가 기반':subNationalMcui(s)?`지방 목록 참고값(${subRegions(s)})`:preliminaryMcui(s)?'분포 범위 계산 기반':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||''} 정부 평가 기반`.trim():earlyMcui(s)?'보전 평가 범주 기반':'IUCN 기반';
const mcuiBasisLabel = s => stockMcui(s)?stockLabel(s):extinctionBasisLabel(s);
const mcuiBasisShort = s => stockMcui(s)?'자원 감소 신호':nationalMcui(s)?'국가 평가':subNationalMcui(s)?'지방 목록 참고값':preliminaryMcui(s)?'분포 범위 계산':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||''} 정부 평가`.trim():'';
// 3.15 (team-lead decision 2026-10-02): reference only. A met Rapid LC check is shown beside the withheld MCUI like the BBVI
// 참고값; it stays out of scores.MCUI, the matrix, the map colours and every ranking.
const mcuiReference = s => s?.assessment?.scores?.MCUI===null&&!s.assessment.axis_errors?.MCUI&&s.assessment.mcui_substitute?.use==='reference_only'?s.assessment.mcui_substitute:null;
const rapidLcCheck = () => '';
// the national branch also covers IUCN categories without a pilot number (DD), so say which case applies
const iucnGlobalNote = s => {const c=s.assessment?.conservation_trace;return c?.category?`IUCN 전 지구 ${c.category}(${c.assessment_year||'평가연도 미기재'}) · ${released()?'점수 대응 없음':'시범 숫자 없음'}`:c?.iucn_state==='not_in_red_list'?`IUCN 전 지구 평가 없음(검색 0건 · ${c.recheck?.checked_on||c.search?.checked_on||'날짜 미기재'})`:'IUCN 전 지구 평가 미확인';};
// Computed values first, then the axes still on hold: "MFPI 65.5 · MBPI·MCUI 보류".
function scoreSummary(s){
  // 4.14: an MCUI without an official category is '보전평가 미확인', not on hold
  const keys=['MFPI','MBPI','MCUI'], unknown=pilotScore(s,'MCUI')===null&&consShort(s)==='보전평가 미확인', held=keys.filter(k=>pilotScore(s,k)===null&&!(k==='MCUI'&&unknown));
  return [...keys.filter(k=>!held.includes(k)&&!(k==='MCUI'&&unknown)).map(k=>`${k}${k==='MCUI'&&separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${scoreText(s,k,pilotScore(s,k))}`),held.length?held.join('·')+' 보류':''].filter(Boolean).join(' · ');
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
// The compare drawer's '근거 자세히 보기' (#decision-detail inside #cmp-more): each indicator, how it is built and its sources.
// 2026-10-17 (LKH): no follow-up list, check result or evidence label is drawn; the species card list left the page.
function showDecision(s){
  const panel=$('decision-detail');
  if(!s||!panel)return;
  const a=s.assessment, info=data.assessmentInfo||{}, reasons=assessmentBlockers(s), study=CASE_NOTES[s.aphiaID];
  let html=`<h3>${esc(s.label)} · 실제 종 근거</h3><p class="fine">${esc(s.name)} · AphiaID ${s.aphiaID}${a?' · '+(released(info)?'정식 산출':'시범 지표'):''}</p>`;
  for(const k of ['MFPI','MBPI','MCUI','BBVI']){
    const st=axisState(s,k), note=axisStateNote[st.kind]||reasons[k]||(k==='MBPI'&&a?.mbpi_floor?'':'검수된 입력을 사용한 '+(released(info)?'정식':'시범')+' 산출값'+basisNote(s,k)+'.');
    html+=`<div class="decision-axis"><b>${k}: ${st.value===null?esc(st.label):scoreText(s,k,st.value)+' / 100'}</b>${note?`<p>${esc(note)}</p>`:''}</div>`;
  }
  const plan=followupDecision(s);
  if(plan?.sourceUrls.length)html+='<h4>연결된 조회 출처 · 각 축의 원문·이용조건은 아래 참조</h4><ul>'+plan.sourceUrls.map(url=>'<li>'+sourceLink(url,url.split('/')[2]+' ↗')+'</li>').join('')+'</ul>';
  if(a){
    const f=pilotScore(s,'MFPI')!==null?a.food_trace:null;
    if(f){
      html+='<h4>MFPI 구성</h4><ul>';
      for(const [key,n] of Object.entries(f.nutrients||{})){
        html+=`<li>${escL(key)}: 가식부 100 g당 ${escL(num(n.value))} ${escL(n.unit)} · ${escL(n.grade)}${n.substitute?' · '+escL(subLabel(n.substitute))+' '+escL(substituteRef(n.substitute)):''} · 동기준 비교 ${escL((n.peer_values||n.peers)?.length)}개 식품 · 백분위 ${escL(n.percentile??'—')} · ${escL(n.substitute?.source_id||n.source_id||f.source_id)}</li>`;
      }
      const tier=aquacultureTier.get(s.aphiaID)?.tier_label;
      html+=`<li>가식부 비율 ${escL(f.edible_fraction?.value)} (${escL(f.edible_fraction?.source_id)}) · 양식 ${escL(tier||(f.aquaculture?.feasible?'가능성 검토됨':'사육 시도'))} (${escL(f.aquaculture?.source_id)})</li></ul>`;
    }
    if(pilotScore(s,'MBPI')!==null&&a.bioactivity_trace?.length){
      html+='<h4>MBPI 구성</h4><ul>';
      for(const b of a.bioactivity_trace){
        // pilot-1 traces name the stratum as [target, assay] and a ChEMBL median; verified reports name a stratum id.
        if(!b.stratum_id){html+=`<li>${escL(b.compound_id)} · 표적 ${escL(b.stratum?.[0])}, assay ${escL(b.stratum?.[1])} · 중앙 pChEMBL ${escL(b.median_pchembl)} · 비교 화합물 ${escL(b.peer_count)}개 · 백분위 ${escL(b.rank)} · 근거 계수 ${escL(b.evidence_factor)} · ${escL((b.reference_ids||[]).join(', '))}</li>`;continue;}
        const m=(b.measurements||[])[0], {name,raw}=bioItemHtml(b);
        html+=`<li>${name} · 비교 코호트 ${escL(b.stratum_id)} `+
          `(${b.stratum_kind==='chembl'?`${escL(b.stratum_label)} · 활성 기록 ${escL(b.cohort_records)}건`:escL(b.peer_compounds??b.peer_peptides)+'개'}) · ${m?`원값 ${raw} · `:''}백분위 ${escL(b.percentile)} × 근거 계수 ${escL(b.evidence_factor)} = ${escL(Math.round(b.adjusted*10)/10)} · 원논문 ${escL((b.original_paper_dois||[]).join(', '))}</li>`;
      }
      html+='</ul>';
    }
    const c=a.conservation_trace;
    if(c)html+=`<h4>MCUI 구성</h4><p>${escL(mcuiComposition(s))}</p>`+(stockMcui(s)?`<p>${escL(stockLead(s))}</p>`:'');
    html+=`<h4>계산과 기준일</h4><p>MFPI: 영양 백분위·등급 80%, 가식부 10%, 양식 근거 10%. MBPI: 층마다 따로 매긴 백분위 × 근거 계수. ChEMBL 화합물은 같은 표적·같은 종말점(IC50·Ki 등) 활성 기록 안에서, ACE 저해 펩타이드는 AHTPDB ACE IC50(HHL 기질) 고정 비교집단 안에서 pIC50으로, 항균 펩타이드는 액체배지 미량희석 MIC를 pMIC = 6 − log10(MIC µM)로 바꿔 표적 세균별 DBAASP 고정 비교집단(액체배지 MIC) 안에서, 항암 펩타이드는 세포 생존 시험 IC50을 pIC50 = 6 − log10(IC50 µM)로 바꿔 암세포주별 CancerPPD 2.0 고정 비교집단 안에서, ${info.method?.xo_bioactivity?'잔틴 산화효소(XO) 억제 펩타이드는 XO IC50을 pIC50으로 바꿔 문헌으로 만든 비교집단 안에서, ':''}감태 분리 화합물은 같은 논문·같은 시험 조건 안에서 순위를 매깁니다. 층끼리는 섞어 비교하지 않고, 종의 MBPI는 모든 층 항목 가운데 가장 높은 값입니다. BBVI: MFPI ${escL(info.foodWeight*100)}% + MBPI ${escL((1-info.foodWeight)*100)}%. MCUI는 별도 축. 산출 ${escL(info.generatedAt||'미기재')}. ${released(info)?`가중치는 팀이 정한 고정 규칙(${escL(methodName(info.version))})이며 점수는 정식 산출값입니다`:'가중치와 점수는 시범값입니다'}.</p>`;
    html+='<h4>원문·이용조건</h4><ul>'+a.source_ids.map(id=>`<li>${[sourceLink(info.sources?.[id]?.url,id+' ↗'),info.sources?.[id]?.license&&orig(info.sources[id].license),info.sources?.[id]?.accessed&&'조회 '+escL(info.sources[id].accessed)].filter(Boolean).join(' · ')}</li>`).join('')+'</ul>';
  }
  {const h=IUCN_HISTORICAL[s.aphiaID];if(h)html+=`<h4>IUCN 평가 · ${pilotScore(s,'MCUI')!==null?(h.current?`${h.current.published}년 현행 평가 · ${P_()}MCUI`:(released()?'현행 여부 재확인':'현행 여부 재확인(시범)')):h.current?'2026년 현행 평가 확인 · 원문 검수 전':'역사적 평가'}</h4><p>${escL(iucnHistoricalText(h,s))} ${sourceLink(h.current?.url||h.url,'IUCN 평가 레코드 ↗')}</p>`;}
  if(study)html+=`<h4>별도 원문 조사 · 참고</h4><p>${escL(study.detail)} ${sourceLink(study.url,study.title+' ↗')}</p>`;
  html+='<p class="fine">실험값은 이 생물에서 나온 물질의 실험 결과이고, 지도 출현 셀은 기록이 있는 칸의 위치(넓게 묶음)입니다.</p>';
  panel.innerHTML=glossHtml(html);panel.hidden=false;
}
// one line on the MCUI's basis for the compare drawer; a preliminary basis gets the '범주 출처' line only
function mcuiComposition(s){
  const a=s.assessment, c=a.conservation_trace, v=extinctionMcui(s);
  if(a.mcui_basis==='national')return `한국 국가 평가 기반 ${P_()}MCUI · ${a.national_assessment?.category} · 국가생물적색자료집 2024 ${a.national_assessment?.list_page_printed}쪽`;
  if(earlyMcui(s))return `${categorySourceLine(s)} · ${a.conservation_status?.category} → ${v===null?'—':scoreValue(s,'MCUI',v)}`;
  if(extinctionSeparate(s))return `${extinctionBasisLabel(s)} ${P_()}MCUI · ${a.mcui_substitute?.category} → ${v===null?'—':scoreValue(s,'MCUI',v)}`;
  if(!c?.category)return '';
  const check=c.current_status_check?.checked_on??c.current_status_checked_on, src=c.current_status_check?.source_id??c.current_status_source_id;
  return `IUCN ${c.category}${c.assessment_year?' · 평가 '+c.assessment_year:''} · 출처 ${c.source_id||'—'}${check?` · 현행 평가 확인 ${check}${src?` (${src})`:''}`:''}`;
}
// 2026-10-19 (LKH, 사이트 v3 2/10): the MCUI section of a Rapid LC species opens with what the value is, how it was judged,
// how its method fared in the back-test (posthoc.validation_sets.MCUI_preliminary as stored) and when it is replaced, and a
// link to that check's row of the method tab's 검증 기록.
function preliminaryMcuiLine(s){
  if(!rawPreliminaryMcui(s))return '';
  const b=data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary, r=validationResult('MCUI_preliminary'), missed=b?.false_lc_for_threatened?.length;
  const check=r==='passed'?'역검증 기준 통과':r==='failed'?`역검증에서 ${missed?`위협종 ${missed}종을 놓쳐 `:''}기준 미충족`:'';
  return `<p class="fine mcui-prelim"><b>${esc(['예비 평가(공식 평가 전)','분포 범위 계산',check,'IUCN이나 국가 평가가 나오면 교체'].filter(Boolean).join(' · '))}</b>`+
    `${b?` <button type="button" class="go-checks" data-go-checks="MCUI_preliminary">검증 기록 보기</button>`:''}</p>`;
}
// 2026-10-17 (LKH): the one line naming where a preliminary category comes from, in the species detail only (never '공식')
function categorySourceLine(s){
  const a=s?.assessment;if(!earlyMcui(s))return '';
  if(a.mcui_basis==='preliminary')return '범주 출처: 분포 범위 계산(IUCN 기준 B 적용, 이 지도에서 계산)';
  const used=(a.conservation_status?.assessments||[]).find(x=>x.used_for_mcui), r=a.mcui_substitute?.record||{};
  const country=LANG==='en'?(used?.country||r.country||''):(used?.country_ko||r.country_ko||''); // 영어 화면: 자료의 country(영어)
  const year=used?.year??data?.assessmentInfo?.method?.mcui_scope?.reference_assessment_years?.[used?.source_id||r.source_id];
  return `범주 출처: ${country?country+' ':''}정부 평가 목록${year?`(${year})`:''}`;
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
        `<p class="fine">방법 ${escL(n.method)} · 시료 ${escL(n.sample_region)}, ${escL(n.sample_year)} · 동기준 비교 ${n.peers.length}종 · ${sourceLink(src.url,'원자료 ↗')} · 조회 ${escL(src.accessed)} · 이용조건 ${orig(src.license)}</p>`;
    }).join('');
    const e=f.edible_fraction,q=f.aquaculture;
    return '<h3>식량 가능성 · '+pilotLabel('MFPI')+'</h3>'+trace+
      row('가식부 비율',String(e.value)+' · '+e.method)+
      `<p class="fine">${sourceLink(sources[e.source_id].url,'가식부 원자료 ↗')} · 조회 ${escL(sources[e.source_id].accessed)} · 이용조건 ${orig(sources[e.source_id].license)}</p>`+
      row('양식 근거',q.feasible?'가능성 근거 검토됨':'가능성 근거 불충분')+
      `<p class="fine">범위 ${escL(q.region)}, ${q.assessment_year} · 방법 ${escL(q.method)} · 제약 ${escL(q.limitations)} · ${sourceLink(sources[q.source_id].url,'양식 원자료 ↗')} · 조회 ${escL(sources[q.source_id].accessed)} · 이용조건 ${orig(sources[q.source_id].license)}</p>`+
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
    `<div class="withheld"><b>동일 기준 종별 원자료 미확인</b>${escL(inventory)} ${escL(farming)} 단백질(g), 철·아연·칼슘(mg)의 생물 가식부 100 g 실측·계산·대용값과 방법·시료 시기, 가식부 비율, 양식 근거, 동기준 비교 3종 이상 및 이용조건을 원레코드에서 확인해야 합니다. 보류 항목은 0점이 아닙니다.</div>`;
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
  return v!==null?`${P_()}MCUI${separateMcui(s)?'('+mcuiBasisShort(s)+')':''} ${scoreValue(s,'MCUI',v)}`:shortReason[a.withheld_reasons?.MCUI]||'MCUI 산출 보류';
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
  return src?sourceLink(src.url,label||src.title||id):escL(label||id||'출처 미확인');
}
function observedRows(f){
  return (f.observed_rows||[]).map(o=>`<div class="score-fact"><b>${orig(o.reported_food_name)} · ${escL(o.food_item_id)}${o.linked?'':' · 종 연결 안 함'}</b>`+
    `<span>${Object.entries(nutrientNames).map(([k,label])=>`${label} ${o.values[k]===null?'결측(빈칸)':escL(o.values[k])+' '+(k==='protein_g'?'g':'mg')}`).join(' · ')}`+
    ` / 100 g 가식부 · 폐기율 ${o.refuse_pct===null?'결측':escL(o.refuse_pct)+'%'} · 출처 표기 ${escL(o.row_source||'없음')}</span></div>`+
    `<p class="fine">${escL(o.link_evidence||'')} ${o.source_id?verifiedSource(o.source_id,String(o.food_item_id).startsWith('LIT:')?'원논문 ↗':'일본 식품성분표 2020(8정판) ↗'):verifiedSource('rda_db_10_4','RDA 식품성분 DB 10.4 ↗')}`+
    `${o.link_source_id?' · 종 연결 근거 '+verifiedSource(o.link_source_id,'국가 생물종·식품원료 목록 ↗'):''}</p>`).join('');
}
// Display only: four significant digits (the trace keeps the source value).
const num=v=>Number.isFinite(v)?String(Number(v.toPrecision(4))):v;
const substituteRef=s=>(s.taxon_level==='subsample'?'RDA ':s.taxon_level==='mext'?'MEXT 8정판 ':'uFiSh1.0 ')+s.food_item_id;
const SUB_NAME={family:'같은 과 종 성분표',genus:'같은 속 종 성분표',mext:'일본 식품성분표 8정판(같은 종)',species:'다른 성분표(같은 종)',subsample:'같은 종 국내 부표본(RDA)'};
const subLabel=s=>SUB_NAME[s?.taxon_level]||s?.label||'';
function substituteText(s){
  return s.taxon_level==='subsample'
    ?`<b>${escL(subLabel(s))}</b>: 같은 표에서 같은 종의 부표본 행 ${escL(Object.entries(s.values||{}).map(([id,v])=>id+' '+num(v)).join(', '))}`+
      `(${orig(s.food_name)})의 ${s.n>1?'평균':'값'}을 썼습니다. 이 부표본 행들은 이 종의 값에만 씁니다. ${verifiedSource(s.source_id,'RDA ↗')}`
    :s.taxon_level==='mext'
    ?`<b>${escL(subLabel(s))}</b>: 일본 식품성분표 2020(8정판) ${escL(s.food_item_id)} ${orig(s.food_name)}`+
      `(${escL(s.taxon_label)}, 가식부 100 g)의 값을 썼습니다. 종 연결: ${escL(s.link_evidence||'')} ${verifiedSource(s.source_id,'MEXT ↗')}`
    :`<b>${escL(subLabel(s))}</b>: FAO/INFOODS uFiSh1.0 ${escL(s.food_item_id)} `+
      `${orig(s.food_name)}(${[escL(s.taxon_label),'섭취 부위 '+escL(s.part),s.doc_code&&'문서 코드 '+escL(s.doc_code),s.n!=null&&'n '+escL(s.n)].filter(Boolean).join(', ')})의 값을 썼습니다. `+
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
const supplementalRecord=o=>`<p class="fine">별도 원값(점수 미사용) ${escL(o.record_id)} · ${escL(o.sample_state)} · ${escL(o.basis)}: `+
  `${Object.entries(o.values||{}).map(([key,v])=>`${escL(nutrientNames[key]||key)} ${escL(v.value)} ${escL(v.unit)}`).join(' / ')}. `+
  `${verifiedSource(o.source_id,'원자료 ↗')}</p>`;
function verifiedFoodDetail(s){
  const f=s.assessment.food_trace||{};
  const search=Object.entries(f.substitute_search||{});
  if(!Number.isFinite(s.assessment.scores.MFPI))return observedRows(f)+
    (search.length?`<p class="fine">빠진 성분의 대체치 후보: ${escL(search.map(([k,v])=>(nutrientNames[k]||k)+' '+(v?(String(v).startsWith('MEXT:')?'MEXT 8정판 '+String(v).slice(5):(String(v).startsWith('K')?'RDA ':'uFiSh1.0 ')+v):'후보 없음')).join(' · '))}. `+
      `${f.substitute_row?'빠진 성분은 채울 수 있지만 아래 다른 이유로 보류합니다.':'채울 후보가 없는 성분이 있어 보류합니다.'}</p>`:'')+
    (f.supplemental_nutrition||[]).map(supplementalRecord).join('');
  // 3.17: EPA and DHA ride beside the scored components, clearly outside the score
  const fatty=f.display_fatty_acids?`<div class="score-fact"><b>EPA + DHA ${escL(num(f.display_fatty_acids.sum_mg))} mg / 100 g 가식부 · 참고값</b>`+
    `<span>EPA ${escL(num(f.display_fatty_acids.epa_mg))} · DHA ${escL(num(f.display_fatty_acids.dha_mg))} mg · 1일 영양성분 기준치 ${escL(f.display_fatty_acids.reference_mg)} mg의 ${Math.round(f.display_fatty_acids.sum_mg/f.display_fatty_acids.reference_mg*100)}% · 출처 표기 ${orig(f.display_fatty_acids.row_source)}</span></div>`+
    `<p class="fine">MFPI는 단백질·칼슘·철·아연 네 성분으로 산출합니다. EPA·DHA는 함께 보는 참고값이며, 오메가-3는 수치와 1일 기준치 대비 비율로 적습니다.</p>`:'';
  const raw=fatty+Object.entries(f.nutrients||{}).map(([key,n])=>
    `<div class="score-fact"><b>${escL(nutrientNames[key]||key)} ${escL(num(n.value))} ${escL(n.unit)} / 100 g 가식부</b>`+
    `<span>${escL(n.grade)} · 고정 비교집단 백분위 ${escL(n.percentile)} · 신뢰도 계수 ${escL(n.evidence_factor)}</span></div>`+
    (n.substitute?`<p class="fine">${substituteText(n.substitute)}</p>`:'')).join('')+
    // 3.7: a scored species can still carry unused records (e.g. 톳 freeze-dried zinc); they stay visible with their reason
    (f.supplemental_nutrition||[]).map(o=>o.substitute_use?`<p class="fine">별도 원값 기록 ${escL(o.record_id)}: ${escL(o.substitute_use)}.</p>`:supplementalRecord(o)).join('');
  const omitted=f.omitted_components||[];
  const outside=f.outside_cohort?`<p class="fine">${f.row_table==='mext'?`일본 식품성분표 2020(8정판) ${escL(String(f.source_food_item_id).slice(5))} ${orig(f.reported_food_name)}(같은 종 생것, 가식부 100 g)을 이 종의 영양 행과 폐기율로 썼습니다(신뢰도 계수 0.85). `:''}${f.row_table==='literature'&&f.literature_moisture?`${escL(f.literature_moisture.label)}: 이 종을 분석한 자료(${verifiedSource(f.source_id,'원문 ↗')})의 건물 기준 값을 같은 종 다른 시료의 생시료 수분(중앙값 ${escL(f.literature_moisture.moisture_pct)}%: ${escL(f.literature_moisture.values.map(v=>v.value).join('·'))}%)으로 날것 기준(가식부 100 g)으로 환산했습니다(방법 결정 2026-10-04, 신뢰도 계수 ${escL(data.assessmentInfo?.method?.nutrition?.grade_factors?.literature_converted)}). 수분 값 출처: ${escL(f.literature_moisture.values.map(v=>v.source).join(' / '))}. `:f.row_table==='literature'?`이 종을 직접 분석한 원논문(${verifiedSource(f.source_id,'원문 ↗')})의 건물 기준 값을 같은 시료의 수분으로 날것 기준(가식부 100 g)으로 환산해 이 종의 영양 행으로 썼습니다(신뢰도 계수 ${escL(data.assessmentInfo?.method?.nutrition?.grade_factors?.literature_converted)}). `:''}${omitted.length?`평균에 쓴 성분: ${escL(Object.keys(f.nutrients||{}).map(k=>nutrientNames[k]||k).join('·'))}. `:''}`+
    `${(f.substituted_components||[]).length?'대체치가 있어 ':''}이 종은 고정 비교집단에 넣지 않고, 비교집단과 자기 자신 안에서 순위를 매겼습니다(다른 종의 순위는 그대로입니다).</p>`:'';
  const c=f.components||{}, e=f.edible_fraction, q=f.aquaculture;
  const cohort=(data.assessmentInfo.cohorts||[]).find(x=>x.cohort_id===f.cohort_id);
  return `<p>${orig(f.reported_food_name)} (${orig(f.english_name)}) · 식품코드 ${escL(f.source_food_item_id)} · 출처 표기 ${orig(f.row_source)} · ${verifiedSource(f.source_id,'원자료 ↗')}</p>`+raw+outside+
    `<p><b>점수 구성</b> 영양값 ${escL(c.nutrient_value_contribution)} − 자료 신뢰도 감점 ${escL(c.evidence_grade_deduction)} + 가식부 ${escL(c.edible_fraction_contribution)} + 양식 ${escL(c.aquaculture_contribution)} = ${scoreValue(s,'MFPI',s.assessment.scores.MFPI)}</p>`+
    `<p class="fine">고정 비교집단 ${escL(f.cohort_id)} · ${escL(f.cohort_species)}개 식품${cohort?' ('+escL(cohort.foods.join(', '))+')':''}. ${escL(f.cohort_criteria)} MFPI는 같은 비교집단 안에서 비교합니다.</p>`+
    // the edible fraction carries its own sample and caveats, the way the aquaculture line below already does
    `<p>가식부 ${escL((e.value*100).toFixed(1))}% · ${escL(e.method)}${e.region?` 시료: ${escL(e.region)}${e.sample_period?` (${escL(e.sample_period)})`:''}.`:''}· ${verifiedSource(e.source_id,'원자료 ↗')}</p>`+
    aquacultureTierLine(s.aphiaID??s.assessment.aphia_id)+
    `<p>${q.feasible?'양식 방법':'양식 시도 기록'}: ${escL(screenKo(String(q.method??'')).replace(/\.\s*$/,''))}. 적용 범위: ${escL(q.region)} (${escL(q.year)}). ${verifiedSource(q.source_id,'양식 근거 ↗')}</p>`+
    (f.yield_sensitivity||[]).map(y=>`<p class="fine">가식부 ${escL((y.fraction*100).toFixed(2))}% (${escL(y.region||'')}) 대입 시 MFPI ${scoreValue(s,'MFPI',Number(y.mfpi_at_same_nutrients))} · ${verifiedSource(y.source_id,'독립 자료 ↗')}</p>`).join('')+
    (f.weight_sensitivity||[]).map(w=>`<p class="fine">가중치 ${w.nutrient_weight}/${w.edible_fraction_weight}/${w.aquaculture_weight} 적용 시 MFPI ${scoreValue(s,'MFPI',Number(w.mfpi))}</p>`).join('')+
    (f.grade_sensitivity?`<p class="fine">신뢰도 계수를 모두 1로 두면 MFPI ${scoreValue(s,'MFPI',Number(f.grade_sensitivity.all_grade_factors_1))}</p>`:'')+
    (f.cross_checks||[]).map(x=>`<p class="fine">교차 점검 ${escL(x.cohort_id)} (${escL(x.cohort_species)}종): MFPI ${scoreValue(s,'MFPI',Number(x.mfpi))}. ${escL(x.note)}</p>`).join('');
}
// Name and raw values of one MBPI item as escaped HTML. The score evidence (verifiedBioTrace) and the comparison tab
// (showDecision) share it, so each stratum is worded in one place.
function bioItemHtml(x){
  const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer', xo=x.stratum_kind==='xo', rx=x.stratum_kind==='relaxed';
  const m=(x.measurements||[])[0]||{};
  const name=rx?`펩타이드 ${escL(x.peptide_name||x.peptide_sequence)} (${escL(x.peptide_sequence)}${x.sequence_modifications?' · '+escL(x.sequence_modifications):''})`:xo?`잔틴 산화효소 억제 펩타이드 ${escL(x.peptide_name||x.peptide_sequence)} (${escL(x.peptide_sequence)})`:anti?`항암 펩타이드 ${escL(x.peptide_name||x.peptide_sequence)} (${escL(x.peptide_sequence)})`:amp?`항균 펩타이드 ${escL(x.peptide_name||x.peptide_sequence)} (${escL(x.peptide_sequence)}${x.sequence_modifications?' · '+escL(x.sequence_modifications):''})`:peptide?`펩타이드 ${escL(x.peptide_sequence)}`:ch?
    `${escL(x.compound_name||x.compound_id)} · ${sourceLink(`https://www.ebi.ac.uk/chembl/explore/compound/${x.compound_id}`,x.compound_id)}`:
    `${escL(m.compound_name||x.compound_id)} · ${m.structure_url?sourceLink(m.structure_url,x.compound_id):escL(x.compound_id)}${m.molecular_formula?' · '+escL(m.molecular_formula):''}`;
  const raw=rx?(x.measurements||[]).map(v=>orig(`${v.target_name} ${v.endpoint} ${v.relation} ${num(v.value)} ${v.unit} · ${v.assay||''}`)).join(' / ')+` · pChEMBL 환산 ${escL(x.pchembl)}`:xo?(x.measurements||[]).map(v=>orig(`XO IC50 ${v.relation} ${peptideValue(v)} · ${v.enzyme_source||''} · ${v.readout||''}`)).join(' / ')+` · pIC50 ${escL(x.pIC50)}`:anti?(x.measurements||[]).map(v=>orig(`${v.cell_line} IC50 ${v.relation} ${num(v.value)} ${v.unit}${v.value_as_published?' ('+v.value_as_published+')':''} · ${v.method}${v.exposure?' '+v.exposure:''}`)).join(' / ')+` · pIC50 ${escL(x.pIC50)}`:
    amp?(x.measurements||[]).map(v=>orig(`${v.target_species}${v.target_strain?' '+v.target_strain:''} MIC ${v.relation} ${v.value} ${v.unit} · ${v.medium}`)).join(' / ')+` · pMIC ${escL(x.pMIC)}`:
    peptide?(x.measurements||[]).map(v=>orig(`${v.target} ${v.endpoint} ${v.relation} ${peptideValue(v)} · 기질 ${v.substrate}`)).join(' / ')+` · pIC50 ${escL(x.pIC50)}`:
    ch?`${escL(x.stratum_label)} · 표적 ${orig(x.target_name)} (${escL(x.target_chembl_id)}, ${escL(x.target_type)}${x.target_organism?', '+orig(x.target_organism):''}) · ${escL(x.standard_type)} 중앙 pChEMBL ${escL(x.median_pchembl)} · 활성 ${escL(x.activity_ids.length)}건`:
    (x.measurements||[]).map(v=>`IC50 ${escL(v.relation||'')} ${escL(v.raw_value)}${v.raw_sd!==undefined?' ± '+escL(v.raw_sd):''} ${escL(v.raw_unit)}`).join(' / ');
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
  const doiLink=d=>`<a href="https://doi.org/${encodeURI(d)}" target="_blank" rel="noopener">${escL(d)}</a>`;
  // e.g. "Do et al. 2012" from the provider line; the DOI link when the provider names no author-year.
  const originNames=origin.map(d=>{const m=(best.measurements||[]).find(v=>v.original_paper_doi?.toLowerCase()===d),
    ay=/\(([^()]*\d{4})\)/.exec(data.assessmentInfo?.sources?.[m?.source_id]?.provider||'');return ay?`${escL(ay[1])} (${doiLink(d)})`:doiLink(d);}).join(', ');
  // ponytail: the strongest rows only; a ChEMBL trace can hold dozens, and every row stays in assessments.json.
  const SHOWN=12, sorted=[...items].sort((x,y)=>y.adjusted-x.adjusted);
  const rows=sorted.slice(0,SHOWN).map(x=>{
    const used=Math.abs(x.adjusted-top)<1e-9;
    const peptide=x.stratum_kind==='peptide', ch=x.stratum_kind==='chembl', amp=x.stratum_kind==='amp', anti=x.stratum_kind==='anticancer', xo=x.stratum_kind==='xo', rx=x.stratum_kind==='relaxed';
    const m=(x.measurements||[])[0]||{};
    const {name,raw}=bioItemHtml(x);
    const cohort=rx?`${orig(x.target_name)} ${escL(x.standard_type)} ChEMBL 활성 기록 ${escL(x.cohort_records)}건(고정 스냅숏)`:xo?`잔틴 산화효소 IC50 펩타이드 ${escL(x.peer_peptides)}개(문헌 비교집단)`:anti?`${escL(x.cell_line)} IC50 펩타이드 ${escL(x.peer_peptides)}개${x.self_in_cohort?' · 이 펩타이드 자신은 비교집단에서 제외':''}`:
      amp?`${orig(x.target_species)} MIC 펩타이드 ${escL(x.peer_peptides)}개`:peptide?`펩타이드 ${escL(x.peer_peptides)}개`:ch?`ChEMBL 활성 기록 ${escL(x.cohort_records)}건`:`화합물 ${escL(x.peer_compounds)}개`;
    return `<div class="score-fact${used?' score-used':''}"><b>${used?'점수에 쓴 값 · ':''}${name}</b>`+
      (t=>`<span${enAttr(t)}>${t}</span></div>`)(`${raw}${m.target_id?' · 표적 '+escL(m.target_id):''}${m.test_system?' · '+orig(m.test_system):''}`)+
      (m.conditions_key?`<p class="fine">시험 조건: ${escL(m.conditions_key)}</p>`:'')+
      ((peptide||amp||anti||xo||rx)?(x.measurements||[]).map(v=>{const src=data.assessmentInfo?.sources?.[v.source_id];
        return `<p class="fine">원값 출처: ${verifiedSource(v.source_id,(src?.provider||'원논문')+' ↗')} · 이용조건 ${orig(src?.license||'—')} · 조회 ${escL(src?.accessed||'미기재')}</p>`;}).join(''):'')+
      (ch?`<p class="fine">비교 코호트 ${escL(x.stratum_id)} (${cohort}) · 백분위 ${escL(x.percentile)} × 근거 계수 ${escL(x.evidence_factor)}(종 연결 ${escL(x.link_factor)} × 활성 ${escL(x.activity_factor)}) = ${escL(Math.round(x.adjusted*10)/10)} · 종 연결 논문 ${x.original_paper_dois.map(doiLink).join(', ')} · ChEMBL 문서 ${escL(x.document_chembl_ids.join(', '))}</p><p class="fine">이 생물에서 나온 물질의 실험 결과입니다(공개 생리활성 기록).</p>`:
      `<p class="fine">비교 코호트 ${escL(x.stratum_id)} (${cohort}) · 백분위 ${escL(x.percentile)} × 근거 계수 ${escL(x.evidence_factor)} = ${escL(Math.round(x.adjusted*10)/10)}${x.percentile===0?' · 백분위 0은 비교집단의 모든 값보다 약한 실측값이라는 뜻입니다':''}${x.percentile===100?` · 백분위 100은 이 비교집단의 ${escL(x.peer_peptides)}개 값보다 모두 강하다는 뜻입니다`:''} · 원논문 ${(x.original_paper_dois||[]).map(doiLink).join(', ')}</p>`)+
      '';
  }).join('');
  // A peptide percentile ranks against the fixed AHTPDB cohort (CC BY-NC 4.0), so the cohort is cited where the rank is shown.
  const ampRule=best.stratum_kind==='amp'?data.assessmentInfo?.method?.amp_bioactivity:null;
  const antiRule=best.stratum_kind==='anticancer'?data.assessmentInfo?.method?.anticancer_bioactivity:null;
  const xoRule=best.stratum_kind==='xo'?data.assessmentInfo?.method?.xo_bioactivity:null;
  const rxBest=best.stratum_kind==='relaxed'?data.assessmentInfo?.method?.relaxed_bioactivity:null;
  const pep=best.stratum_kind==='peptide'?data.assessmentInfo?.method?.peptide_bioactivity:null;
  const pepSrc=pep?data.assessmentInfo?.sources?.[pep.cohort_source_id]:null;
  const ch=best.stratum_kind==='chembl', rule3=data.assessmentInfo?.method?.chembl_bioactivity;
  const scope=rxBest?`ChEMBL ${orig(best.target_name)} ${escL(best.standard_type)} 활성 기록 ${escL(best.cohort_records)}건(고정 스냅숏) 안의 상대 순위입니다.`:xoRule?`PubMed 문헌으로 만든 고정 비교집단(잔틴 산화효소 IC50, 펩타이드 ${escL(best.peer_peptides)}개, 중앙 pIC50 ${escL(best.cohort_median_pIC50)}) 안의 상대 순위입니다.`:antiRule?`CancerPPD 2.0에서 고른 고정 비교집단(${escL(best.cell_line)} 세포주 IC50, 펩타이드 ${escL(best.peer_peptides)}개${best.self_in_cohort?' · 이 펩타이드 자신은 제외':''}, 중앙 pIC50 ${escL(best.cohort_median_pIC50)}) 안의 상대 순위입니다.`:
    ampRule?`DBAASP에서 고른 고정 비교집단(${orig(best.target_species)} 대상 MIC, 액체배지, 펩타이드 ${escL(best.peer_peptides)}개, 중앙 pMIC ${escL(best.cohort_median_pMIC)}) 안의 상대 순위입니다. 비교집단은 균종마다 따로 둡니다.`:
    pep?`AHTPDB에서 고른 고정 비교집단(${escL(pep.target)} ${escL(pep.endpoint)}, 기질 ${escL(pep.substrate)}, 펩타이드 ${escL(best.peer_peptides)}개) 안의 상대 순위입니다.`:
    ch?`ChEMBL 같은 표적·같은 종말점(${escL(best.standard_type)}) 활성 기록 ${escL(best.cohort_records)}건 안의 상대 순위입니다.`:
    '같은 논문·같은 시험 조건 안의 상대 순위입니다.';
  const independence=ch?`종 연결 논문 ${dois.length}편 · ChEMBL 문서 ${escL(new Set(best.document_chembl_ids).size)}건 → 약한 쪽 ${escL(best.independent_sources)}편`:
    reps.length?`DOI ${dois.length}편(기원 ${origin.length} + 효능 재현 ${reps.length})`:`원논문 ${dois.length}편`;
  const single=mbpiSources(best)<2;
  const chemblLimit=ch?`종→화합물 연결은 위키데이터 P703(LOTUS) 또는 검수한 원논문입니다. 분류군 ${escL(data.assessmentInfo?.chemblCommonLimit)}개를 넘는 흔한 대사물과 승인 약물(max_phase 4) 연결은 뺐고, 점수에 쓰는 연결은 원문 제목·초록과 PubChem 기록으로 검수했습니다. `:'';
  return `<h4>점수 근거 · ${escL(items.length)}개 측정값${items.length>SHOWN?` (상위 ${SHOWN}개 표시, 전체는 공개 JSON)`:''}</h4>${rows}`+
    `<p class="fine">집계: 코호트 안 조정값 중 ${cfg.primary_aggregation==='max'?'최댓값':escL(cfg.primary_aggregation||'미기재')} · 민감도 ${escL((cfg.sensitivity_aggregations||[]).join('·')||'미기재')}${a.sensitivity?.range_from_aggregation?' 범위 '+escL(a.sensitivity.range_from_aggregation.join('–')):''}</p>`+
    `<p class="fine">읽는 법: 백분위는 ${scope} ${chemblLimit}이 생물에서 나온 물질의 ${antiRule?'암세포주 증식 억제 농도(IC50)':ampRule?'세균 배양 억제 농도(MIC)':ch?'시험관·세포·병원체 시험값':'세포 밖(효소) 시험값'}입니다.</p>`+
    (xoRule?`<p class="fine">비교집단 출처: ${verifiedSource(xoRule.cohort_source_id,(data.assessmentInfo?.sources?.[xoRule.cohort_source_id]?.provider)||'문헌 비교집단')}</p>`+(best.cohort_members?.length?`<details class="fine"><summary>비교집단 회원 ${best.cohort_members.length}개 보기(서열 · IC50 µM · DOI)</summary><p lang="en">${best.cohort_members.map(m=>escL(m.sequence)+' '+escL(m.ic50_uM)+' · '+m.dois.map(doiLink).join(', ')).join('<br>')}</p></details>`:''):'')+
    (rxBest?`<p class="fine">비교집단 출처: ${verifiedSource(rxBest.cohort_source_id,(data.assessmentInfo?.sources?.[rxBest.cohort_source_id]?.provider)||'ChEMBL')} · 활동 ID 전체와 pChEMBL 값은 공개 스냅숏에 있고, 이 화면은 함께 실린 pChEMBL ${escL(best.cohort_records)}건으로 백분위를 다시 계산해 검사합니다.</p>`+((best.other_targets||[]).length?`<p class="fine">다른 표적: ${best.other_targets.map(t=>escL(`${t.target_name} ${t.standard_type} ${num(t.value)} ${t.unit} · 백분위 ${t.percentile} (기록 ${t.cohort_records}건)`)).join(' / ')} — 백분위가 가장 높은 표적 하나만 점수에 씁니다.</p>`:''):'')+
    (ampRule?`<p class="fine">비교집단 출처: ${verifiedSource(ampRule.cohort_source_id||'dbaasp_amp',(data.assessmentInfo?.sources?.[ampRule.cohort_source_id||'dbaasp_amp']?.provider)||'DBAASP')}</p>`:'')+
    (ch&&rule3?`<p class="fine">출처: ${rule3.source_ids.map(id=>{const src=data.assessmentInfo?.sources?.[id];return `${verifiedSource(id,(src?.provider||id)+' ↗')} (${orig(src?.license||'—')}, 조회 ${escL(src?.accessed||'미기재')})`;}).join(' · ')} · ID와 값만 저장했습니다.</p>`:'')+
    (pep?`<p class="fine">비교집단 출처: ${verifiedSource(pep.cohort_source_id,(pepSrc?.provider||'AHTPDB')+' ↗')} · ${`<span${enAttr(esc(pepSrc?.citation||'인용 미기재'))}>${escL(pepSrc?.citation||'인용 미기재')}</span>`} · 이용조건 ${orig(pepSrc?.license||'—')} · 행 ID와 IC50 값만 써서 백분위로 가공했습니다.</p>`:'');
}
// Paper values are stored in µM; values of 1000 µM and above are also shown in mM as the paper reports them.
// After 3.14 a synthetic peptide reported only in µg/mL is converted with its sequence mass; the paper's value stays beside it.
const peptideValue = r => (r.unit==='uM'?(r.value>=1000?`${r.value/1000} mM (${r.value} µM)`:`${r.value} µM`):`${r.value} ${r.unit||''}`)+
  (r.converted_from?` (원문 ${r.converted_from.value} µg/mL ÷ 서열 분자량 ${r.converted_from.molecular_weight} g/mol)`:'');
function verifiedBioDetail(s){
  const trace=verifiedBioTrace(s);
  // 2026-10-17 (LKH): the follow-up leads (bioactivity_partial) and the rejected species -> compound links stay in the records only
  const raw=(s.assessment.peptide_raw_values||[]).map(r=>{const src=data.assessmentInfo?.sources?.[r.source_id];
    return `<div class="score-fact"><b>원값·출처 · 펩타이드 ${escL(r.sequence)}</b><span>${escL(`${r.target} ${r.endpoint} ${r.relation} ${peptideValue(r)}${r.substrate?' · 기질 '+r.substrate:''}`)}</span></div>`+
      `<p class="fine">${verifiedSource(r.source_id,(src?.provider||'원논문')+' ↗')} · DOI ${escL(r.original_paper_doi)} · 이용조건 ${orig(src?.license||'—')} · 조회 ${escL(src?.accessed||'—')}</p>`;}).join('');
  const rawHtml=raw?'<h4>참고 원값·출처</h4>'+raw:'';
  const cl=s.assessment.chembl_links, n=cl?.counts||{}, ps=cl?.paper_search, rule3=data.assessmentInfo?.method?.chembl_bioactivity;
  if(trace)return trace+rawHtml;
  // 3.1: what the automated species -> compound -> ChEMBL chain found, and the original-paper search for species without a P703 link.
  const linkChain=cl?`<p class="fine">종→화합물 공개 연결(위키데이터 P703·LOTUS${ps?', 검수 원논문':''}) ${escL(n.linked||0)}건 · 참고문헌 DOI 있음 ${escL(n.with_reference_doi||0)}건 · 흔한 대사물 제외 ${escL(n.common_metabolite||0)}건 · 승인 약물 제외 ${escL(n.approved_drug||0)}건 · 검수 제외 ${escL(n.rejected_by_review||0)}건 → ChEMBL 비교 코호트(활성 기록 ${escL(rule3?.minimum_cohort_records)}건 이상)에 든 화합물 ${escL(n.scored_compounds||0)}개.`+
    (ps?` CMNPD·PubChem 분류군·Europe PMC 원논문도 찾았습니다(${escL(ps.searched_on)}, Europe PMC ${escL(ps.europepmc_hits)}건 중 ${escL(ps.papers_screened)}건 선별, 인정 연결 ${escL(ps.accepted_links)}건 · CMNPD 검색 부분은 CC BY-NC-SA 4.0 조건).`:'')+'</p>':'';
  const fl=s.assessment.mbpi_floor;
  return (fl?`<p><b>${escL(s.assessment.mbpi_label)} · MBPI ${scoreValue(s,'MBPI',Number(fl.value))}</b>: ${escL(fl.meaning)} 규칙: ${escL(fl.prereg)} 1.5절(방법 결정 2026-10-05).</p>`:
    '')+rawHtml+linkChain;
}
// 4.14 (prereg-4.14-2026-10-14 2·3): the conservation category and the list behind the MCUI.
// 2026-10-17 (LKH): a preliminary basis is named by one '범주 출처' line; lists no score uses stay in the records.
const SCOPE_KO={global:'IUCN 전 지구',korea:'한국 국가',other_country:'정부 평가',sub_national:'지방 평가'};
function conservationStatusBlock(s){
  const c=s.assessment?.conservation_status, scope=data.assessmentInfo?.method?.mcui_scope;
  if(!c||!scope)return '';
  const map=/\(([^)]*LC[^)]*)\)/.exec(c.mapping_note||'')?.[1];
  const head=`<p><b>보전 상태 범주${c.category?': '+escL(c.category):''}</b></p>`, tail=map?`<p class="fine">범주 → 숫자: ${escL(map)}</p>`:'';
  if(earlyMcui(s))return head+preliminaryMcuiLine(s)+`<p class="fine">${escL(categorySourceLine(s))}</p>`+tail;
  const where=x=>[koEn(x.region_ko,x.region),koEn(x.country_ko,x.country)].filter(Boolean).join(', ');
  const rows=c.assessments.filter(x=>x.used_for_mcui).map(x=>`<li>${escL(SCOPE_KO[x.scope]||x.scope)}${where(x)?' ('+escL(where(x))+')':''} · ${orig(x.list)}${x.year?' '+escL(x.year):''} · ${escL(x.category_as_published)}`+
    ` · MCUI 멸종위험 성분에 사용${x.source_id&&data.assessmentInfo?.sources?.[x.source_id]?' · '+verifiedSource(x.source_id,'원목록 ↗'):''}</li>`).join('');
  return head+(rows?`<ul class="fine">${rows}</ul>`:'')+tail;
}
// the same state in one sentence for the evidence-stage line
function verifiedNationalFact(s){return conservationStatusBlock(s)+verifiedNationalFactBody(s);}
function verifiedNationalFactBody(s){
  const b=s.assessment.national_assessment;
  if(s.assessment.mcui_basis==='national'&&b)return `<p><b>한국 국가 평가 기반 ${P_()}MCUI</b>: ${escL(b.category)} · 게재명 ${orig(b.name_as_published)} · `+
    `목록 ${escL(b.list_page_printed)}쪽(뷰어 ${escL(b.list_page_viewer)}쪽) · 범위 ${escL(b.scope)} · ${escL(b.assessment_basis)} · ${verifiedSource(b.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    (data.assessmentInfo?.method?.national_red_list?.page_recheck?.checked_on?`<p class="fine">목록·찾아보기 쪽 재확인 ${escL(data.assessmentInfo.method.national_red_list.page_recheck.checked_on)}${b.first_edition_category?` · 초판·개정판 등급 ${escL(b.first_edition_category)} → ${escL(b.category)}${b.change?` (${escL(b.change)})`:''}`:''}</p>`:'')+
    (b.crosswalk?`<p class="fine">학명 대응(확인 ${escL(b.crosswalk.checked_on)}): ${escL(b.crosswalk.evidence)}</p>`:'');
  // After 3.14: another range state's national list gives a separately labelled MCUI (shown with its inputs).
  const sub=s.assessment.mcui_substitute;
  if(earlyMcui(s))return '';  // 2026-10-17: named by the '범주 출처' line above
  if(subNationalMcui(s)&&sub){
    const rec=sub.record, bt=rec.backtest||{}, rule=data.assessmentInfo?.method?.mcui_substitutes?.sub_national||{};
    const rows=(rec.regions||[]).map(x=>`<li>${escL(koEn(x.region_ko,x.region))}(${escL(koEn(x.country_ko,x.country))}) · ${escL(x.category_as_published)} → ${escL(x.category)} · 게재명 ${orig(x.name_as_published)} · ${orig(x.list)} ${escL(x.edition)} · ${verifiedSource(x.source_id,'원목록 ↗')}${x.currency_source_id?' · 현행 확인 '+verifiedSource(x.currency_source_id,'개정 원본 ↗'):''}${x.note?'<br>'+escL(x.note):''}</li>`).join('');
    return `<p><b>${escL(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${escL(sub.category)} → ${scoreValue(s,'MCUI',extinctionMcui(s))} · 지역 ${escL((rec.regions||[]).length)}곳의 중앙값 · ${escL(bt.label||'')}</p>`+
      `<ul class="fine">${rows}</ul>`+
      `<p class="fine">${escL(rule.limitation||'')} 국가·전 지구 수준의 멸종 위험이 아니며, IUCN 기반 MCUI와 비교·순위에 쓰지 않습니다.</p>`+
      `<p class="fine">역검증: ${escL(bt.criterion||'')} 결과 ${escL(bt.label||'')}. 기준은 값을 모으기 전에 정해 커밋했습니다(${escL(bt.prereg||'')}). 결과와 상관없이 값은 그대로 쓰고 결과를 함께 보입니다.</p>`;
  }
  if(preliminaryMcui(s)&&sub){
    const r=sub.record, t=r.thresholds||{}, ps=data.assessmentInfo?.method?.mcui_substitutes?.preliminary_scored||{};
    return `<p><b>${escL(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${escL(sub.pilot_mapping||sub.category)} · EOO ${escL(r.eoo_km2.toLocaleString())} km²(기준 ${escL(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${escL(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${escL(r.aoo_cells)}칸, 기준 ${escL(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${escL(r.records)}건(기준 ${escL(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      (r.official_unscored?.length?`<p class="fine">공식 목록에 이름은 있으나 점수 범주가 아닌 기록(점수에 쓰지 않음):</p><ul class="fine">${r.official_unscored.map(x=>`<li>${escL(koEn(x.region_ko,x.region))}(${escL(x.country_ko||'')}) · ${escL(x.category_as_published)} · 게재명 ${orig(x.name_as_published)} · ${orig(x.list)} ${escL(x.edition)} · ${escL(x.excluded_reason)}${x.source_id?' · '+verifiedSource(x.source_id,'원목록 ↗'):x.url?' · '+sourceLink(x.url,'원목록 ↗'):''}</li>`).join('')}</ul>`:'')+
      `<p class="fine">IUCN·한국 국가·서식국 국가·지방 목록 어디에도 이 종의 점수가 되는 범주가 없어 쓰는 마지막 근거입니다(방법 결정 2026-10-05).${r.official_unscored?.length?' 이름은 있지만 점수 범주가 아닌 공식 목록 기록은 아래에 따로 적었습니다.':''} GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${escL(r.native_box.lat.join('–'))}°, 경도 ${escL(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했고, OBIS 보고율 추세는 ${escL(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}입니다. `+
      `${(ps.limitations||[]).map(esc).join(' ')} IUCN 기반 MCUI와 비교·순위에 쓰지 않고 매트릭스에는 회색 점선 점으로 따로 놓습니다.</p>`+subNationalReference(sub)+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${escL(b.n)}종): ${escL(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}`+
        `${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${escL(b.false_lc_for_threatened.join('·'))}`:''}. ${escL(b.reason)}</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  if(substituteMcui(s)&&sub){
    const r=sub.record;
    return `<p><b>${escL(extinctionBasisLabel(s))} ${P_()}MCUI</b>: ${escL(r.category_as_published)} → ${escL(sub.category)}${r.rank_out?' 상당(평가했으나 위협 범주 없음 · 방법 결정 2026-10-04)':''} · 게재명 ${orig(r.name_as_published)} · ${orig(r.list)} · 범위 ${escL(r.scope)} · ${verifiedSource(r.source_id,'원목록 ↗')}</p>`+
      `<p class="fine">${escL(r.continuity.replace(/\.$/,''))}. ${escL(r.limitations)}</p>`;
  }
  // 3.15 (team-lead decision 2026-10-02): reference only. The Rapid LC record is shown beside the withheld MCUI, never as a score.
  const ref=mcuiReference(s);
  if(ref&&ref.basis!=='preliminary')return '';
  if(ref){
    const r=ref.record, t=r.thresholds||{};
    return `<p><b>자체 예비검토(Rapid LC) 참고 정보 · 공식 평가 아님 · MCUI 점수 아님</b>: 넓은 분포·기록 수 기준만 확인(낮은 멸종위험을 확정하지 않음) · EOO ${escL(r.eoo_km2.toLocaleString())} km²(기준 ${escL(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${escL(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${escL(r.aoo_cells)}칸, 기준 ${escL(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${escL(r.records)}건(기준 ${escL(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      `<p class="fine">GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${escL(r.native_box.lat.join('–'))}°, 경도 ${escL(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했습니다. OBIS 보고율 추세: ${escL(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}. `+
      `공식 IUCN 평가가 아니며, 어획 등에 따른 감소(기준 A)는 OBIS 추세로만 확인했습니다. MCUI 점수·매트릭스·지도 색·순위에 쓰지 않습니다.</p>`+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${escL(b.n)}종): ${escL(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}`+
        `${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${escL(b.false_lc_for_threatened.join('·'))}`:''}. ${escL(b.reason)}</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  // 4.11 (prereg 5.2): the OBIS reporting-rate ratio reached the decline threshold, so the met Rapid LC check gives no MCUI.
  if(pilotScore(s,'MCUI')===null&&sub?.result==='decline_ratio_reached'){
    const r=sub.record, rule=data.assessmentInfo?.method?.conservation?.trend;
    return `<p><b>자체 예비평가(Rapid LC) 쓰지 않음 · MCUI 없음</b>: OBIS 보고율 비(${escL(Number(r.reporting_rate_ratio).toFixed(3))})가 감소 기준(${escL(rule?.decline_ratio)}) 이하입니다.</p>`+
      `<p class="fine">가장 큰 데이터셋 안에서 감소가 확인되지 않았더라도, 확인되지 않은 감소를 '감소 없음'으로 읽지 않습니다(사전 등록 ${escL(data.assessmentInfo?.method?.mcui_substitutes?.preliminary_trend_block?.prereg||'')}). 분포 기록(EOO ${escL(r.eoo_km2.toLocaleString())} km² · AOO ${escL(r.aoo_km2.toLocaleString())} km² · 좌표 기록 ${escL(r.records)}건)은 참고로만 적습니다.</p>`;
  }
  const n=s.assessment.national_red_list_fact;
  return n?`<p>국가 평가(한국 범위): ${escL(n.category)} · 게재명 ${orig(n.name_as_published)} · 목록 ${escL(n.list_page_printed)}쪽 · ${verifiedSource(n.source_id,'국가생물적색자료집 2024 ↗')}</p>`+
    '<p class="fine">한국 범위의 참고 정보입니다. 이 종의 MCUI는 IUCN 전 지구 평가를 바탕으로 합니다.</p>':'';
}
// 4.17 (prereg-4.17-2026-10-15 2): the preliminary assessment behind the MCUI, with its inputs, in the species detail only
function preliminaryBasisDetail(s,sub){
  const r=sub.record||{}, label=s.assessment.conservation_status.preliminary?.label||'예비 평가';
  const value=`${escL(sub.category)} → ${scoreValue(s,'MCUI',extinctionMcui(s))}`;
  if(rawPreliminaryMcui(s)){
    const t=r.thresholds||{};
    return `<p><b>${escL(label)} · 자체 예비평가(Rapid LC)</b>: ${value} · EOO ${escL(r.eoo_km2.toLocaleString())} km²(기준 ${escL(t.eoo_km2?.toLocaleString())} 초과) · `+
      `AOO ${escL(r.aoo_km2.toLocaleString())} km²(10 km 격자 ${escL(r.aoo_cells)}칸, 기준 ${escL(t.aoo_km2?.toLocaleString())} 초과) · 좌표 기록 ${escL(r.records)}건(기준 ${escL(t.records)}건 이상) · ${verifiedSource(r.method_source_id,'Rapid LC 방법 ↗')}</p>`+
      `<p class="fine">GBIF·OBIS의 1990년 이후 원서식 범위(위도 ${escL(r.native_box.lat.join('–'))}°, 경도 ${escL(r.native_box.lon.join('–'))}°) 좌표 기록으로 계산했습니다. OBIS 보고율 추세: ${escL(data.assessmentInfo?.method?.conservation?.trend?.labels?.[r.trend_class]||r.trend_class||'없음')}.${obisRatioNote(s)}</p>`+
      subNationalReference(sub)+
      (b=>b?`<p class="fine">방법 역검증(이미 평가가 있는 ${escL(b.n)}종): ${escL(b.agreement)}종 일치 · ${b.result==='passed'?'기준 통과':'기준 미충족'}${b.false_lc_for_threatened?.length?` — LC로 판정한 위협 범주 종: ${escL(b.false_lc_for_threatened.join('·'))}`:''}. 공식 평가가 나오면 그 값으로 바꿉니다.</p>`:'')(data.assessmentInfo?.method?.posthoc?.validation_sets?.MCUI_preliminary);
  }
  return `<p><b>${escL(label)} · ${escL(koEn(r.country_ko,r.country)||'서식국')} 국가 평가</b>: ${escL(r.category_as_published)} → ${value}${r.rank_out?' (평가했으나 위협 범주 없음 → LC 상당 · 방법 결정 2026-10-04)':''} · 게재명 ${orig(r.name_as_published)} · ${orig(r.list)} · 범위 ${escL(r.scope)} · ${verifiedSource(r.source_id,'원목록 ↗')}</p>`+
    (r.continuity||r.limitations?`<p class="fine">${escL(screenKo(r.continuity||'').replace(/\.$/,''))}${r.continuity?'. ':''}${escL(r.limitations||'')}</p>`:'')+subNationalReference(sub);
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
  const rows=(ref.regions||[]).map(x=>`<li>${escL(koEn(x.region_ko,x.region))}(${escL(koEn(x.country_ko,x.country))}) · ${escL(x.category_as_published)} → ${escL(x.category)} · 게재명 ${orig(x.name_as_published)} · ${orig(x.list)} ${escL(x.edition)} · ${verifiedSource(x.source_id,'원목록 ↗')}${x.note?'<br>'+escL(x.note):''}</li>`).join('');
  return `<p class="fine"><b>지방 목록 참고값 · MCUI 점수 아님</b>: ${escL(ref.chosen_category)} · ${escL(ref.backtest?.label||'')}. 과대평가 역검증을 통과하지 못한 지방 목록은 4.11부터 점수에 쓰지 않습니다.</p><ul class="fine">${rows}</ul>`;
}
function verifiedConservationDetail(s){
  const c=s.assessment.conservation_trace;
  // 2026-10-17 (LKH): the IUCN record where the MCUI rests on it; a national or other basis is named by its own block below
  if(!c?.category||s.assessment.mcui_basis!=='iucn')return '';
  const check=c.current_status_check, trend=c.population_trend&&c.population_trend!=='Unknown'?' · 개체군 추세 '+escL(TREND_KO[c.population_trend]||c.population_trend):'';
  return `<p>${escL(c.category)}${c.criteria?' '+escL(c.criteria):''} (기준 ${escL(c.criteria_version)}) · 평가일 ${escL(c.assessment_date)} · 발표 ${escL(c.publication_year)} · 범위 ${escL(c.scope==='global'?'전 지구':c.scope)}${trend}. ${verifiedSource(c.source_id,'IUCN 평가 ↗')}</p>`+
    (c.pilot_mapping?`<p>원래 등급과 ${released()?'점수 대응':'시범 숫자'}: ${escL(String(c.pilot_mapping).replace(/,\s*IUCN 점수 아님/,''))}</p>`:'')+
    (check?.is_current?`<p class="fine">현행 평가 확인: ${escL(check.red_list_version)}, ${escL(check.checked_on)} · ${verifiedSource(check.source_id,'확인 근거 ↗')}. ${escL(c.verification)}</p>`:'')+
    (c.previous_assessments||[]).map(p=>`<p class="fine">이전 평가 ${escL(p.record_id)} · ${escL(p.category)} ${escL(p.criteria||'')} · ${escL(p.assessment_date)} 평가 · ${escL(p.status)}</p>`).join('');
}
// 4.12: one sentence on how the stock signal set the MCUI, e.g. 'IUCN LC 10 · 자원 감소 60 → 높은 값 60'
function stockCompare(s){
  const a=s.assessment,d=a?.stock_decline,ext=a?.mcui_extinction_risk,v=pilotScore(s,'MCUI');
  if(!d||v===null)return '';
  const c=a.conservation_trace,basis=a.mcui_basis==='iucn'&&c?.category?'IUCN '+c.category:mcuiBasisShortOf(s);
  // 2026-10-17 (LKH): without an extinction-risk number the line names the decline value and the MCUI only
  const n=x=>x===null?'—':scoreValue(s,'MCUI',x);
  if(ext===null)return `어획량 감소 신호 ${n(d.score)} → MCUI ${n(v)}`;
  return `${basis} ${n(ext)} · 어획량 감소 신호 ${n(d.score)} → ${a.mcui_driver==='tie'?'같은 값':'높은 값'} ${n(v)}`;
}
const mcuiBasisShortOf = s => nationalMcui(s)?'한국 국가 평가':subNationalMcui(s)?'지방 목록 참고값':preliminaryMcui(s)?'분포 범위 계산':substituteMcui(s)?`${s.assessment.mcui_substitute?.record?.country_ko||''} 정부 평가`.trim():earlyMcui(s)?'멸종위험 평가':'IUCN';
const stockLead = s => {const d=s.assessment.stock_decline,low=s.assessment.conservation_status?.mcui_role==='stock_decline_lower_bound';
  return `KOSIS 연근해 어획량이 ${stockChange(d)} 변해 ${stockBandLabel(d)} ${scoreValue(s,'MCUI',d.score)}점이 ${low?'탐색용 기준선 이상이라 이 종의 MCUI가':'멸종위험 근거보다 높아 MCUI가'} 되었습니다(${stockCompare(s)}). 자원 감소 신호는 KOSIS 어획량 통계에서 온 값입니다.`;};
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
// 2026-10-21 (site v4 05): for a species farmed far more than caught, the last year's farming and coastal catch beside the
// averages, read from the same KOSIS series (assessments.json, built from data/raw/kosis_DT_1EW0004_*); any gap hides the line
function stockLatestLine(d){
  const y=d.years?.at(-1),a=d.aquaculture_t?.at(-1),c=d.coastal_t?.at(-1),pa=d.reference_2025p?.aquaculture_t,whole=v=>Number.isInteger(v)&&v>=0;
  if(d.unscored_reason!=='aquaculture_dominant'||!Number.isInteger(y)||!whole(a)||!whole(c))return '';
  return `<p class="sd-latest">${y}년 양식 ${a.toLocaleString('ko-KR')}톤 · 연근해 어획 ${c.toLocaleString('ko-KR')}톤${whole(pa)?` · ${y+1}년 잠정 양식 ${pa.toLocaleString('ko-KR')}톤`:''} (KOSIS 어업생산동향조사)</p>`;
}
// 4.12 (prereg-4.12-2026-10-14): the stock-decline block for the species detail and the data table's expanded row
function stockDeclineDetail(s,compact=false){
  const d=s.assessment?.stock_decline,rule=data.assessmentInfo?.method?.mcui_stock_decline;
  if(!d||!rule||s.assessment?.axis_errors?.MCUI||d.match_level==='none')return '';
  const t=n=>Math.round(n).toLocaleString(), level=rule.match_levels?.[d.match_level]||d.match_level;
  const head=d.score===null?esc(stockBandLabel(d)):`${esc(stockBandLabel(d))} · ${scoreValue(s,'MCUI',d.score)}점`;
  const compare=d.score===null?'':stockCompare(s);
  const body=`<div class="sd-row">${stockSpark(d,rule)}<div><p class="sd-means">기준 평균 ${t(d.baseline_mean_t)}톤(${rule.baseline_years[0]}~${String(rule.baseline_years.at(-1)).slice(2)}) → 최근 평균 ${t(d.recent_mean_t)}톤(${rule.recent_years[0]}~${String(rule.recent_years.at(-1)).slice(2)}) <b>(${esc(stockChange(d))})</b></p>${stockLatestLine(d)}`+
    `<p class="fine">KOSIS 품종 ${esc(d.kosis_item)} · 연결 ${esc(level)}${d.capped_broader?' · 묶음 통계라 상한 '+esc(rule.broader_cap)+'점':''} · 최근 3년 양식 비중 ${esc(Number(d.aquaculture_share_recent_pct).toFixed(1))}%`+
    `${d.unscored_reason==='aquaculture_dominant'?' · 양식 비중이 커서 감소율은 참고로 적습니다':d.unscored_reason==='small_catch'?' · 어획 규모가 작아 감소율은 참고로 적습니다':''} · 2025년 잠정치 ${Number.isFinite(d.reference_2025p?.coastal_t)?t(d.reference_2025p.coastal_t)+'톤':'없음'}(점수 미사용)</p></div></div>`;
  return `<div class="stock-decline${d.score!==null?' scored':''}"><h4>자원 감소 신호 · KOSIS 어획량 추세 · <b>${head}</b></h4>`+
    (compare?`<p class="sd-compare">${esc(compare)}</p>`:'')+body+
    `<p class="fine">KOSIS 어획량 통계로 계산한 값입니다${compact?'':'(IUCN 기준 A의 30·50·80% 구간 적용)'}. ${verifiedSource(d.source_id,'KOSIS ↗')}</p></div>`;
}
// 3.4: OBIS reporting-rate check beside MCUI (figure stage 3: distribution recency, decline vs survey gap)
function occurrenceTrendDetail(s){
  const t=s.assessment?.occurrence_trend,rule=data.assessmentInfo?.method?.conservation?.trend;
  if(!t||!rule)return '';
  const p=rule.periods,n=t.species_records,e=t.effort_records,yr=x=>x.slice(0,4),f2=x=>Number(x).toFixed(2);
  const ratio=Number.isFinite(t.reporting_rate_ratio)?` · 보고율 비 ${f2(t.reporting_rate_ratio)} (95% 구간 ${f2(t.ci[0])}–${f2(t.ci[1])}) · 같은 강 기록 변화 ×${f2(t.effort_ratio)} · 전체 분류군 기준 민감도 ${f2(t.all_taxa_sensitivity?.reporting_rate_ratio)}`:'';
  const gain=t.mcui_base===null?0:Math.min(100,t.mcui_base+t.mcui_adjustment)-t.mcui_base;
  const paused=data.assessmentInfo?.method?.conservation?.effort_adjustment_suspended;
  const effect=t.class==='decline_signal'&&!t.mcui_adjustment&&paused?paused.note+(t.mcui_base===null?'':' MCUI에 더하거나 빼지 않았습니다.'):t.mcui_adjustment?(gain?`감소 신호라 MCUI ${scoreValue(s,'MCUI',t.mcui_base)}에 +${gain}을 더했습니다.`:`감소 신호이지만 MCUI가 이미 상한 100이라 바뀌지 않았습니다.`)
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
  return `<h4>${obisWarn(s)?'<i class="obis-warn-mark" title="감소 신호 · MCUI 구분선 미만" aria-hidden="true">⚠</i>':''}OBIS 출현 추세 · 보조 요소 · <b>${esc(t.label)}</b>${obisOffLabel()?` <span class="obis-off">${esc(obisOffLabel())}</span>`:''}</h4>`+
    `<p>비교 셀 ${esc(t.cells_compared)}개(1°)의 기록 ${esc(yr(p.past[0]))}–${esc(yr(p.past[1]))} ${esc(n.past)}건 → ${esc(yr(p.recent[0]))}–${esc(yr(p.recent[1]))} ${esc(n.recent)}건`+
    ` (지도 범위 전체 ${esc(t.records_in_map_extent?.past)} → ${esc(t.records_in_map_extent?.recent)}건) · 같은 셀의 ${esc(t.effort_group)} 전체 기록 ${esc(e.past)} → ${esc(e.recent)}건${ratio}. `+
    `분포 최신성: 과거에만 기록된 셀 ${esc(t.cells_past_only)}개 · 최근에만 기록된 셀 ${esc(t.cells_recent_only)}개 · 최근 기록 연도 ${esc(t.latest_record_year??'없음')}. ${esc(effect)} ${verifiedSource(t.source_id,'OBIS ↗')}</p>`+
    checked+dataset+iucn+
    `<p class="fine">보고율 = 종 기록 ÷ 같은 셀·기간의 같은 강 기록(지도의 회색 조사량 음영과 다른 척도). 감소 신호는 보고율이 30% 이상 줄고 95% 구간이 1 아래이며, 과거 최대 데이터셋 안에서도 같을 때입니다. 보고율은 개체수·자원량이 아닙니다. 95% 구간은 기록을 서로 독립으로 보므로 같은 조사에서 나온 기록이 몰리면 실제보다 좁습니다. 종 단위 결과를 해역 등급으로 옮기지 않습니다.</p>`;
}
// 2026-10-15 (개선 프롬프트 6): the OBIS trend stays visible per species although its MCUI adjustment is off since 4.11.
// No score, type or threshold changes here; the class and numbers are the report's own (re-checked by verifiedConservationValid).
const obisOffLabel=()=>{const p=data?.assessmentInfo?.method?.conservation?.effort_adjustment_suspended;return p?`점수 미반영(${obisOffSince(p)}부터, 검증 실패)`:'';};
const obisOffSince=p=>(String(p?.prereg||'').match(/prereg-(\d+\.\d+)-/)||[])[1]||'4.11';
// a decline signal beside an MCUI under the matrix line: the species the adjustment would have flagged, listed and marked ⚠
function obisWarn(s){
  const t=s?.assessment?.occurrence_trend,v=pilotScore(s,'MCUI'),cut=matrixRule()?.mcui_threshold;
  return !!(t&&t.class==='decline_signal'&&v!==null&&Number.isFinite(cut)&&v<cut&&data?.assessmentInfo?.method?.conservation?.effort_adjustment_suspended);
}
const obisWarnList=()=>(data?.species||[]).filter(obisWarn);
const obisDatasetText=d=>!d?'주 데이터셋 비교 없음':Number.isFinite(d.reporting_rate_ratio)?`주 데이터셋 ${d.confirms_decline?'감소 확인':'감소 확인 안 됨'}(${Number(d.reporting_rate_ratio).toFixed(2)})`:'주 데이터셋 두 기간 비교 불가';
// the species profile (비교와 지표): class, effort-corrected ratio and dataset check up front, the long reading folded
function cpObisTrend(s){
  const t=s?.assessment?.occurrence_trend,rule=data?.assessmentInfo?.method?.conservation?.trend;
  if(!t||!rule||s.assessment?.axis_errors?.MCUI)return '';
  const f2=x=>Number(x).toFixed(2),has=Number.isFinite(t.reporting_rate_ratio),warn=obisWarn(s),cut=matrixRule()?.mcui_threshold;
  const nums=has?`조사 노력 보정 보고율 비 <b>${f2(t.reporting_rate_ratio)}</b> · ${esc(obisDatasetText(t.dataset_check))}`:'두 기간을 비교할 기록이 부족해 비율을 내지 않았습니다';
  const more=has?`<p>보고율은 종 기록을 같은 1° 셀·같은 기간의 ${esc(t.effort_group)} 전체 기록으로 나눈 값입니다. ${esc(rule.periods.past[0].slice(0,4))}–${esc(rule.periods.past[1].slice(0,4))} 대비 ${esc(rule.periods.recent[0].slice(0,4))}–${esc(rule.periods.recent[1].slice(0,4))}의 보고율 비는 ${f2(t.reporting_rate_ratio)}(95% 구간 ${f2(t.ci[0])}–${f2(t.ci[1])})이고, 같은 기간 ${esc(t.effort_group)} 조사 기록은 ×${f2(t.effort_ratio)}로 변했습니다. 감소 신호는 비가 ${esc(rule.decline_ratio)} 이하이고 95% 구간이 1 아래이며, 과거 기록이 가장 많은 데이터셋 안에서도 같을 때입니다.</p>`:'';
  return `<div class="cp-obis${warn?' warn':''}" data-class="${esc(t.class)}"><p class="cp-obis-head">${warn?'<i class="obis-warn-mark" aria-hidden="true">⚠</i>':''}<span>OBIS 출현 추세</span><b>${esc(t.label)}</b>${obisOffLabel()?`<span class="obis-off">${esc(obisOffLabel())}</span>`:''}</p>`+
    `<p class="cp-obis-nums">${nums}</p>`+
    `<details class="cp-obis-more"><summary>추세 읽는 법</summary>${more}`+
    (warn?`<p>감소 신호가 있지만 MCUI가 ${scoreValue(s,'MCUI',pilotScore(s,'MCUI'))}점으로 구분선 ${esc(cut)}점 아래입니다. 4.10까지의 규칙이라면 +${esc(data.assessmentInfo.method.conservation.effort_adjustment_suspended.previous_value)}이 더해졌을 종이라 ⚠로 표시합니다. 점수와 유형은 그대로입니다.</p>`:'')+
    `<p>${esc(data.assessmentInfo.method.conservation.effort_adjustment_suspended?.note||'')} 조사 노력이 줄어든 것을 생물이 줄어든 것으로 잘못 읽을 위험이 있어, 보고율은 개체수·자원량으로 쓰지 않습니다.</p></details></div>`;
}
// 근거와 방법 탭: the list of decline signals with an MCUI under the line (species, class, current MCUI)
function renderObisWarnList(){
  const st=$('obis-stock-species');if(st&&data){const xs=data.species.filter(x=>x.assessment?.mcui_driver==='stock_decline');st.textContent=xs.length?`${xs.map(x=>x.label).join('·')} ${xs.length}종`:'없음';}
  const box=$('obis-warn-list');if(!box)return;
  if(!data){box.textContent='자료를 불러오면 목록이 채워집니다.';return;}
  const all=(data.species||[]).filter(s=>s.assessment?.occurrence_trend?.class==='decline_signal'),cut=matrixRule()?.mcui_threshold;
  box.innerHTML=all.length?`<table class="obis-warn-table"><caption class="sr-only">OBIS 감소 신호 종</caption><thead><tr><th scope="col">종</th><th scope="col">추세 분류</th><th scope="col">보고율 비</th><th scope="col">현재 MCUI</th><th scope="col">표시</th></tr></thead><tbody>`+
    all.map(s=>{const t=s.assessment.occurrence_trend,v=pilotScore(s,'MCUI');
      return `<tr><th scope="row">${esc(s.label)}</th><td>${esc(t.label)}</td><td>${Number(t.reporting_rate_ratio).toFixed(2)}</td><td>${v===null?'—':scoreValue(s,'MCUI',v)}${s.assessment.mcui_driver==='stock_decline'?' (KOSIS 자원 감소 신호)':''}</td><td>${obisWarn(s)?`⚠ 구분선 ${esc(cut)} 미만`:`구분선 ${esc(cut)} 이상`}</td></tr>`;}).join('')+'</tbody></table>':'<p>감소 신호 종이 없습니다.</p>';
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
  return `<h4>${esc(r.label)}</h4><div class="score-fact"><b>참고값 ${scoreValue(null,'BBVI',r.value)}</b><span>${esc(`${r.formula}, w = ${r.food_weight} · MFPI ${r.inputs.MFPI}(${r.mfpi_cohort}) · MBPI ${r.inputs.MBPI}(${r.mbpi_stratum}, 원논문 ${r.mbpi_original_paper_dois.join(', ')})`)}</span></div>`+
    `<p class="fine">가중치 민감도: ${esc(Object.entries(r.sensitivity).map(([w,v])=>`w ${w} → ${scoreValue(null,'BBVI',v)}`).join(' · '))}. ${esc(r.limits.join(' '))} BBVI 점수·매트릭스·순위에 쓰지 않습니다.</p>`;
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
  return `같은 ${rankKo[u.rank]||u.rank}(${u.taxon})에 BBVI${Number.isFinite(min)?' '+min+' 이상인':'가 있는'} 친척 종(${u.relatives.map(relativeLabel).join(', ')})이 있습니다`;
}
function sufficiencyCut(a){
  const cut=data?.assessmentInfo?.method?.unexplored_threshold;
  return Math.round(a.information_sufficiency.mean_ratio*100)+'%'+(Number.isFinite(cut)?', 기준 '+Math.round(cut*100)+'% 미만':'');
}
// Axis colours and names (species-card mini bars use them too).
// Short Korean names that sit on the score tiles with their abbreviation (2026-10-15 readability: first use names the index).
const TILE_KO={MFPI:'식량',MBPI:'생리활성',MCUI:'보전',BBVI:'활용'}, tileLabel=k=>`<small><span class="tile-ko">${TILE_KO[k]}</span>${k}</small>`;
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
  return SENS_WEIGHTS.map(w=>{const raw=bbviRawAt(s,w);return {w,raw,value:raw===null?null:round1(raw),type:raw===null?null:matrixTypeAt(s,raw)};});
}
function weightSensitivityLine(s){
  const rows=weightSensitivity(s);if(!rows)return '';
  const types=new Set(rows.map(r=>r.type));
  // 2026-10-18 (LKH, 휴대폰): the line sits in a fold that only phones close (theme.css .detail-fold); wider screens show it as before
  return `<details class="detail-fold ax-sens-fold"${foldOpen()}><summary>가중치별 BBVI</summary><p class="ax-note ax-sens">MFPI 가중치별 BBVI: ${rows.map(r=>`${r.w.toFixed(1)}${r.w===officialWeight()?'(기본)':''} ${scoreText(s,'BBVI',r.value,r.raw??undefined)} ${esc(r.type?matrixTypePlain(r.type):'—')}`).join(' · ')}`+
    ` · ${types.size>1?'가중치에 따라 유형이 바뀜':'세 가중치에서 유형 같음'}</p></details>`;
}
// species whose type differs between weights 0.2 · 0.5 · 0.8 (the method section count)
const weightTypeChanges=()=>(data?.species||[]).filter(s=>{const r=weightSensitivity(s);return r&&new Set(r.map(x=>x.type)).size>1;});
function axisCards(s){
  const rule=matrixRule(),type=matrixType(s),key=Object.entries(rule?.types||{}).find(([,t])=>t.id===type)?.[0];
  const held=k=>{const st=axisState(s,k),ref=k==='BBVI'?bbviReference(s):null;return `<span class="ax-held">${esc(ref!==null?'참고값 '+scoreValue(null,'BBVI',ref):st.label)}</span>`;};
  const main=(k,cut)=>{const v=axisState(s,k).value;return v===null?held(k):`<strong class="ax-num">${k==='MCUI'?catSmall(esc(scoreText(s,k,v)),'ax-cat'):scoreText(s,k,v)}</strong>${axisBar(v,cut,true)}`;};
  const sub=(k,name,note)=>{const v=axisState(s,k).value;
    return `<div class="ax-sub"><span>${name} <b>${k}</b></span>${v===null?held(k):`<strong>${scoreText(s,k,v)}</strong>${axisBar(v)}`}${note?`<small>${esc(note)}</small>`:''}</div>`;};
  const mbpiNote=[mbpiStratumOf(s)?.short,basisNote(s,'MBPI').replace(/^ · /,'')].filter(Boolean).join(' · '),mfpiNote=s.assessment?.food_trace?.literature_moisture?.label||'';
  const mcuiNote=[consShort(s,true),axisState(s,'MCUI').value===null?'':mcuiBasisLabel(s)].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · ');
  const chip=type?`<p class="ax-type" title="${esc(matrixPlainNote())}"><i style="background-color:${matrixTypeColour[type]}" aria-hidden="true"></i>${verdictWord(type)}<span class="ax-type-name">${esc(matrixTypeLabel(type))}</span></p>`
    :`<p class="ax-type none"><i aria-hidden="true"></i>—</p>`;
  // where the species' cells sit on the value map: the cell colour is the first type in the cell, so it can differ from the species' own
  const cells=[...valueCellGroups(true).values()].filter(g=>g.species.has(s.aphiaID)),same=cells.filter(g=>cellMatrixType(g).type===type).length;
  // 2026-10-13: '활용 × 보전' opens on the species view (its own cells in its own colour); the all-species view keeps the cell rule
  const where=!cells.length?'':!type?`‘활용 × 보전’에서는 이 종의 공개 셀 ${cells.length}개를 회색으로 칠합니다.`
    :`‘활용 × 보전’에서는 이 종의 공개 셀 ${cells.length}개를 이 색으로 칠합니다. `+(same===cells.length?'‘모든 종 겹쳐 보기’에서도 모두 이 색입니다.'
      :same?`‘모든 종 겹쳐 보기’에서는 그중 ${same}개가 이 색이고, 나머지는 같은 셀에 있는 우선순위가 높은 유형의 색입니다.`
      :'‘모든 종 겹쳐 보기’에서는 모두 같은 셀에 있는 우선순위가 높은 유형의 색입니다.');
  const quad=`<span class="ax-quad" aria-hidden="true">${AXIS_QUAD.map(q=>{const id=rule?.types?.[q]?.id;return `<i class="${q===key?'on':''}" style="background-color:${matrixTypeColour[id]||'#b7c0ca'}"></i>`;}).join('')}</span>`;
  return `<section class="axis-cards" aria-label="두 축 요약 · 아래 지표 칸과 같은 값">${chip}`+
    `<div class="ax-card"><div class="ax-head"><h3>활용가치 <b>BBVI</b> <small class="ax-nature">탐색용 합성지표</small></h3><small>${rule?thresholdWord()+' '+rule.bbvi_threshold+' · ':''}w = ${bbviWeight.toFixed(2)}</small></div>`+
      `<div class="ax-main">${main('BBVI',rule?.bbvi_threshold)}</div>${officialNote(s)?`<p class="ax-note">탐색 보기(${esc(weightPair())}) · ${esc(officialNote(s))}</p>`:''}${weightSensitivityLine(s)}`+
      sub('MFPI','식량',mfpiNote)+sub('MBPI','생리활성',mbpiNote)+'</div>'+
    '<p class="ax-sep"><span>합치지 않고 따로 봅니다</span></p>'+
    `<div class="ax-card"><div class="ax-head"><h3>보전 시급성 <b>MCUI</b></h3><small>${rule?thresholdWord()+' '+rule.mcui_threshold:''}</small></div>`+
      `<p class="ax-note ax-def">${esc(mcuiDefOf(s))}</p><div class="ax-main">${main('MCUI',rule?.mcui_threshold)}</div>${mcuiNote?`<p class="ax-note">${esc(mcuiNote)}</p>`:''}${mcuiAuxLine(s)?`<p class="ax-note ax-aux">${esc(mcuiAuxLine(s))}</p>`:''}</div>`+
    (rule?`<div class="ax-where">${quad}<p>${esc(where||'이 종은 지금 보는 기간에 공개 셀이 없습니다.')}</p></div>`:'')+'</section>';
}

// 2026-10-12: the MBPI section opens with the stratum of the scored item. 2026-10-19 (LKH, 사이트 v3 3/10): above it, one line
// on what the number was measured on: '근거: [표적 종류] [종말점] 시험 [N]건 · 분리 화합물·펩타이드의 시험값이며 종 추출물
// 효능 시험은 아님', N = the measurements of the scored item (bestBio: its ChEMBL activity records, or its measured values),
// and below it the stored result of the MBPI check with a link to its row of the method tab's 검증 기록. Species detail only:
// the sea expedition's cards keep their wording.
const MBPI_ASSAY_KIND={ace_peptide:'ACE 저해',ace_compound:'ACE 저해',xo:'잔틴 산화효소 억제',anticancer:'암세포주',amp:'항균',relaxed:'ChEMBL 표적',compound:'분리 화합물'};
function mbpiAssayLine(s){
  const st=mbpiStratumOf(s), x=st&&bestBio(s.assessment);if(!x)return '';
  const chembl=x.stratum_kind==='chembl', kind=chembl?x.stratum_label:MBPI_ASSAY_KIND[st.key];
  const ends=chembl?[x.standard_type]:[...new Set((x.measurements||[]).map(m=>m.endpoint))];
  const n=chembl?(x.activity_ids||[]).length:(x.measurements||[]).length;
  if(!kind||!n||!ends.every(Boolean))return '';
  const material=chembl?compoundName(x.compound_name):String(x.peptide_sequence||'').trim()?`${x.peptide_sequence} 펩타이드`:'';
  return `근거: ${material?material+' · ':''}${kind}${st.key==='anticancer'&&x.cell_line?' '+x.cell_line:''} ${ends.join('·')} 시험 ${n}건 · 분리 화합물·펩타이드의 시험값이며 종 추출물 효능 시험은 아님`;
}
function mbpiFirstLine(s){
  const st=mbpiStratumOf(s), k=mbpiKindOf(s), assay=mbpiAssayLine(s), r=validationResult('MBPI');
  const check=r&&st?`MBPI 검증: ${r==='passed'?'통과':'기준 미충족'}(신약 기원종 순위) · 1차 선별용`:'';
  return (assay||st?`<p class="fine mbpi-first">${assay?`<b>${escL(assay)}</b>`:''}${st?`${assay?'<br>':''}근거 층: ${escL(st.long)}`:''}${k?`<br>근거 종류: ${escL(k.long)} · ${esc(mbpiKindShare(k))}`:''}</p>`:'')+
    (check?`<p class="fine mbpi-check">${esc(check)} <button type="button" class="go-checks" data-go-checks="MBPI">검증 기록 보기</button></p>`:'');
}
// 4.10: one line under the MBPI section for the secondary MBPI-Rx (mbpiRxOf); it opens to the published post-hoc reason, the
// classification criterion and the pre-registration. A null value reads 없음 with the published reason, never 0.
function mbpiRxLine(s){
  const r=mbpiRxOf(s), rule=data.assessmentInfo?.method?.mbpi_rx, v=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI_RX;
  if(!r)return '';
  const head=r.value===null?'—':scoreValue(s,'MBPI',r.value)+' · '+r.stratum.short;
  return `<details class="score-disclosure rx-disclosure"><summary><span>${esc(rule.label)}</span><b>${esc(head)}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">MBPI와 같은 규칙으로 모으되 ${esc(rule.excluded_label)} 층의 항목은 뺀 보조 값입니다. 기본 MBPI·BBVI·매트릭스와 따로 봅니다.</p>`+
    (r.value===null?'':`<p class="fine">근거 층: ${escL(r.stratum.long)}</p>`)+
    `<p class="fine">층 분류 기준: ${esc(rule.criterion)}</p></div></details>`;
}
// 4.11 (prereg 4): MBPI is the maximum over items, so the spread of the scored items is shown beside it, display only.
function mbpiBreadthLine(s){
  const b=s.assessment?.mbpi_breadth, rule=data.assessmentInfo?.method?.mbpi_breadth;
  if(!b||!rule||!b.item_count||pilotScore(s,'MBPI')===null)return '';
  // 4.14 (prereg-4.14-2026-10-14 8): independent papers, max and mean, and each item's material class (display only)
  const more=Number.isInteger(b.independent_paper_count);
  const head=`항목 ${b.item_count}개 · 중앙값 ${Number(b.median).toFixed(1)}${more?` · 최댓값 ${Number(b.max).toFixed(1)} · 평균 ${Number(b.mean).toFixed(1)}`:''} · 상위 2개 평균 ${Number(b.top2_mean).toFixed(1)}`;
  const mats=more?Object.entries(b.material_counts||{}).map(([k,n])=>`${MATERIAL_KO[k]||k} ${n}개`).join(' · '):'';
  return `<details class="score-disclosure breadth-disclosure"><summary><span>${esc(rule.label)}</span><b>${esc(head)}</b></summary><div class="score-disclosure-body">`+
    `<p class="fine">MBPI는 점수 항목 중 가장 높은 값이고, 점수 항목 전체의 중앙값과 상위 두 항목 평균을 함께 보입니다. 기본 MBPI·BBVI·매트릭스·순위와 따로 보는 표시입니다.</p>`+
    (more?(mats?`<p class="fine">소재 구분: ${esc(mats)}. 원문 시료 기술로 나눈 표시용 구분입니다.</p>`:'')+
      `<p class="fine">${b.measured_zero_items?`백분위 0 항목 ${b.measured_zero_items}개는 비교집단 맨 아래의 실제 측정값입니다. `:''}이 생물에서 나온 물질의 시험관·세포 시험 결과입니다.</p>`:'')+
    `</div></details>`;
}
// 4.14: the material classes of mbpi-material-4.14 (display words only)
const MATERIAL_KO={natural_isolate:'종에서 분리한 물질',hydrolysate_purified:'가수분해·발효물에서 정제한 펩타이드',hydrolysate_sequence_synthetic:'가수분해물 서열의 합성품',
  hydrolysate_unspecified:'가수분해물 유래 물질',native_sequence_synthetic:'유전자 서열(천연 펩타이드)의 합성품',synthetic_derivative:'합성 유도체',symbiont_derived:'공생미생물 유래'};
function renderVerifiedIndices(s){
  const a=s.assessment;
  const names={MFPI:'식량 가능성',MBPI:'생리활성',MCUI:'보전 평가',BBVI:'통합 활용'};
  const mv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MFPI;
  const bv=data.assessmentInfo?.method?.posthoc?.validation_sets?.MBPI;
  // 3.27: the drug-origin check is computed; its result and reason open the MBPI section, as the MFPI scope note does
  // 2026-10-17 (LKH): no check result, evidence profile, OBIS trend or label paragraph in these sections
  const bodies={MFPI:verifiedFoodDetail(s),MBPI:mbpiFirstLine(s)+verifiedBioDetail(s),MCUI:verifiedConservationDetail(s)+verifiedNationalFact(s)+stockDeclineDetail(s),
    BBVI:'<p>기본 BBVI = w × MFPI + (1−w) × MBPI. MCUI는 별도 축입니다. 화면의 w는 두 값을 합치는 비율만 바꾸며 고정 비교집단은 그대로입니다. MFPI만 보는 “식량 전용”과 MBPI만 보는 “생리활성 전용”은 기본 BBVI와 다른 보기입니다.</p>'+
referenceCombination(s)};
  const unexplored=a.unexplored_candidate?`<p class="fine">다음 탐색 후보: ${esc(unexploredLine(a.unexplored_candidate))}. 기본 가중치 w = 0.5 기준입니다.</p>`:'';
  return `<section class="verified-scores"><h3>실제 원자료 기반 ${released()?'정식 산출':'시범 지표'}${esc(validationNote(data.assessmentInfo))}</h3>`+
    `<p class="fine">자료 스냅샷 ${esc(data.assessmentInfo?.generatedAt?.slice(0,10))} · 방법론 ${esc(methodName(data.assessmentInfo?.version))} · MFPI·MBPI·MCUI는 각각 독립적으로 판정합니다. `+
    `숫자는 종 단위 연구용 지표입니다.</p>`+
    ` ${Object.keys(names).map(key=>{
      const st=axisState(s,key),value=st.value,reason=a.withheld_reasons?.[key];
      const label=key==='MCUI'&&value!==null&&separateMcui(s)?' · '+mcuiBasisLabel(s):'';
      const note=axisStateNote[st.kind];
      return `<details class="score-disclosure" data-axis="${key}"><summary><span>${esc(key)} · ${esc(names[key])}</span>`+
        `<b>${value===null?esc(st.label):scoreText(s,key,value)+' · '+axisLabel(s,key)+(key==='MBPI'&&mbpiStratumOf(s)?' · '+esc(mbpiStratumOf(s).short):'')+label}</b></summary>`+
        `<div class="score-disclosure-body">${note?`<p class="pending">${esc(note)}</p>`:value===null?`<p class="pending">${esc(scoreReason[reason]||reason||'산출 보류')}</p>`:''}`+
        `${note?'':bodies[key]}${key==='MFPI'&&value!==null?'<p class="fine">산식: 동기준 영양 백분위 × 신뢰도 계수 80% + 가식부 비율 10% + 양식 근거 10%. 이 비중과 계수는 '+(released()?'팀이 정한 고정 규칙':'팀의 시범 규칙')+'입니다.</p>':''}`+
        `</div></details>`+(key==='MBPI'?mbpiRxLine(s)+mbpiBreadthLine(s)+supplementaryLine(s):'');
    }).join('')}${unexplored}</section>`;
}

// LME names from the cell files, shown in Korean. Other values ('해역명 미확인', a bare LME number) pass through; the CSV
// keeps the source names. Kept above setView: test_map_boundary.mjs loads only the code before it with the popup code.
const SEA_KO={'Yellow Sea':'황해','East China Sea':'동중국해','Sea of Japan':'동해','Kuroshio Current':'쿠로시오 해류'};
const SEA_EN={'Sea of Japan':'East Sea'};
const seaName=x=>LANG==='en'?SEA_EN[x]||x:SEA_KO[x]||x; // 영어 화면: 자료의 해역(LME) 영어 이름(동해는 East Sea)
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
  if(changed&&view!=='explore'&&phoneSheet()&&drawerIsOpen())closeDrawer(false); // 2026-10-25: 휴대폰 상세 시트는 다른 탭으로 가면 닫는다
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
  {id:'farmed',group:'식량',label:'상업 양식',tier:'commercial'},
  {id:'farmed_trial',group:'식량',label:'시험·연구 양식',tier:'trial'},
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
  farmed:['양식','양식가능','상업양식','aquaculture'],
  farmed_trial:['시험양식','연구양식','시험·연구양식'],
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
const nutrientLine=(v,id)=>`${num(v.value)} ${v.unit||''}/100 g · 기준 ${num(Math.round(CLAIM_REF[id]*CLAIM_SHARE[id]*100)/100)} 이상${v.substitute?' · '+subLabel(v.substitute):''}`;
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
    // 가식부 칩은 MFPI에 이미 들어간 가식부 비율을 보여줄 뿐이고, 양식 칩 둘은 양식 단계 파일(표시 전용)을 읽는다. 점수는 바뀌지 않는다.
    if(id==='whole'){const ef=a.food_trace?.edible_fraction;return ef&&ef.value===1?{text:`가식부 100%(폐기율 0%) · 출처 ${ef.record_id}`,score:pilotScore(s,'MFPI')}:null;}
    const tier=traitById(id)?.tier;
    if(tier){const r=aquacultureTier.get(s.aphiaID);return r&&r.tier===tier&&a.food_trace?.aquaculture?.feasible===true?{text:`${r.tier_label} · ${r.basis}`,score:pilotScore(s,'MFPI')}:null;}
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
  return {text:`${t.tier==='extract'?'추출물 · ':''}${t.name} · ${t.assay} ${t.endpoint} ${num(t.value)} ${t.unit} · 시험값 ${rows.length}개(doi ${t.doi}) · 참고 표시`,score:null,display:true};
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
    :displayOnly(c.id)?`문헌 근거가 있는 ${n}종`:`채택된 근거가 있는 ${n}종`;
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
    :c.id==='farmed'?'KOSIS 해면양식 통계에 그 종의 품종으로 2022~2024년 생산이 있거나, 양식 기록 원문·FAO 양식종 자료집이 그 종의 상업 양식을 적은 종(국외 포함). 표시 전용 분류입니다'
    :c.id==='farmed_trial'?'연구 시설이나 시험 양식장에서 한 주기 이상 키운 기록이 있는 종. 표시 전용 분류입니다'
    :c.id==='omega3'?`EPA+DHA가 1일 기준치(330 mg)의 ${Math.round(OMEGA_SHARE*100)}% 이상(100 g당). 팀 표시 기준입니다`
    :displayOnly(c.id)?(hasExtractRow(c.id)?'이 생물에서 나온 단일 화합물·펩타이드 또는 추출물·분획의 문헌 시험값입니다(‘추출물’ 표시). ':'이 생물에서 나온 단일 화합물·펩타이드의 문헌 시험값입니다. ')+'표시 전용 근거입니다'
    :'보고서에 채택된 MBPI 근거의 시험 표적 기준입니다(이 생물에서 나온 물질의 실험 결과)';
// A food chip hides species with a measured value under the claim line apart from species with no value at all.
const measured=(s,id)=>{const a=s.assessment;if(!a||pilotScore(s,'MFPI')===null)return false;if(id==='omega3')return Number.isFinite(a.food_trace?.display_fatty_acids?.sum_mg);if(id==='whole')return Number.isFinite(a.food_trace?.edible_fraction?.value);if(traitById(id)?.tier)return aquacultureTier.has(s.aphiaID);return (id==='mineral'?Object.keys(MINERALS):[id]).some(k=>Number.isFinite(a.food_trace?.nutrients?.[k]?.value));};
function hiddenLine(on,shown,base){
  const hidden=base.filter(s=>!shown.includes(s)),below=hidden.filter(s=>on.every(c=>useEvidence(s,c.id)||(c.group==='식량'&&measured(s,c.id)))).length;
  return `<p>숨김 ${hidden.length}종${below?` · 기준 미달 ${below}종`:''}.</p>`;
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
  return `<span class="use-line">${[...activeUses].map(id=>esc(useEvidence(s,id)?.text||'')).join('<br>')}<br>활용 특성: ${traitTags(s)}<br>MCUI ${mc===null?'—':scoreText(s,'MCUI',mc)}${consShort(s)?' ('+esc(consShort(s,true))+')':''} · 매트릭스 유형 ${t?esc(matrixTypeLabel(t)):'—'}</span>`;
}

// Four axis values on every card ('–' = withheld, never 0), so the list can be scanned without opening a species.
// 7/15: a compact value chip keeps the MCUI category beside the number, in short ('LC', 'LC+감소'); the full tag is its title
const scoreChip=(s,k,v)=>{const t=k==='MCUI'?mcuiCatTag(s,true):'';return t?`${scoreValue(s,k,v)}<small class="mcui-cat" title="${esc(glossHtml(esc(mcuiCatTag(s))).replace(/<[^>]+>/g,''))}"> (${esc(t)})</small>`:scoreText(s,k,v);};
const cardScores=s=>s.assessment?'<span class="card-scores">'+['MFPI','MBPI','MCUI','BBVI'].map(k=>{const n=axisState(s,k).value;
  return `<i class="${n===null?'held':''}" title="${GAUGE_NAME[k]}">${tileLabel(k)}${n===null?'–':scoreChip(s,k,n)}</i>`;}).join('')+
  // 2026-10-15: the MBPI stratum line under the four values left the 탐색 후보 card (LKH); it stays in the species detail
  '</span>':'';
// 2026-10-13 design 2 (card shape A): the use and conservation values and the verdict on one line, so the list compares at a
// glance. Never summed; the same values as the four card scores. Screen readers hear the full names, the BBVI's paper label,
// the MCUI basis and the formal type name (sr-only text, so the card's innerText keeps every word the checks read).
// 2026-10-15: the MCUI category from scoreText ('80.0 (VU + 어획량 감소)') sits beside the big number in small type and may wrap,
// so it never runs under the verdict on the 탐색 후보 card
const cardNum=t=>{const m=/^(\S+) \((.+)\)$/.exec(t);return m?`<b>${m[1]}</b><small class="cl-cat"> (${esc(m[2])})</small>`:`<b>${t}</b>`;};
// 2026-10-15 explore design match: a type mark always beside its words. 2026-10-18: one circle for every type, told apart by
// matrixTypeColour and the words beside it (theme.css .shape); an untyped species gets a dashed ring.
const typeShape=(t,cls='')=>`<i class="shape shape-${t||'none'}${cls?' '+cls:''}"${t?` style="--tc:${matrixTypeColour[t]}"`:''} aria-hidden="true"></i>`;
function cardLine(s){
  if(!s.assessment)return '';
  const rule=matrixRule(),t=matrixType(s),b=axisState(s,'BBVI').value,m=axisState(s,'MCUI').value;
  const basis=m===null?'':mcuiBasisLabel(s),num=(v,k='MCUI')=>v===null?'–':scoreText(s,k,v);
  const cons=consShort(s),cat=m===null?'':mcuiCatTag(s);
  return `<span class="card-line"><span class="cl-v" title="통합 활용 BBVI ${num(b,'BBVI')}"><span class="sr-only">BBVI 통합 활용 </span><span aria-hidden="true">활용 </span><b>${num(b,'BBVI')}</b></span>`+
    `<span class="cl-v${m!==null&&rule&&m>=rule.mcui_threshold?' high':''}" title="보전 시급성 MCUI ${num(m)}${basis?' · '+esc(basis):''}"><span class="sr-only">, MCUI 보전 시급성 </span><span aria-hidden="true">보전 </span><b>${m===null?'–':scoreValue(s,'MCUI',m)}</b>${cat?rawPreliminaryMcui(s)?`<small class="cl-cat"> (${esc(cat)})</small>`:`<span class="sr-only"> (${esc(cat)})</span>`:''}${cons?`<span class="sr-only cl-cons${m===null?' unknown':''}"> ${esc(cons)}</span>`:''}${basis?`<span class="sr-only"> ${esc(basis)}</span>`:''}</span>`+
    `<span class="card-verdict" title="${esc(matrixPlainNote())}"><span class="sr-only">, 판단 </span>${typeShape(t,'cv-shape')}${verdictWord(t)}${t?`<span class="sr-only">(${esc(matrixTypeLabel(t))})</span>`:''}</span></span>`;
}
function renderList() {
  const query=$('search').value.trim().toLowerCase();
  const group=$('species-group').value;
  const base=data.species.filter(s=>(group==='all'||s.group===group)
    &&[s.label,s.name,s.group,String(s.aphiaID),...[s.koLabel,s.enName].filter(Boolean)].some(v=>v.toLowerCase().includes(query)));
  const matches=useSorted(base.filter(useMatch));
  $('species-count').textContent=`${matches.length}종`;filterCount();
  const extra=$('use-extra');
  if(extra){extra.innerHTML=useSuggestion($('search').value)+useNote(matches,base);
    extra.querySelector('[data-use-suggest]')?.addEventListener('click',e=>{$('search').value='';setUses([...activeUses,e.currentTarget.dataset.useSuggest]);});
    extra.querySelectorAll('[data-use-off]').forEach(b=>b.addEventListener('click',()=>toggleUse(b.dataset.useOff)));
    extra.querySelector('[data-use-clear]')?.addEventListener('click',()=>setUses([]));}
  // Re-rendering on select must not jump the (horizontal on phones) list back to the start or drop keyboard focus.
  const list=$('species-list'),left=list.scrollLeft,top=list.scrollTop,refocus=list.contains(document.activeElement);
  $('species-list').innerHTML=matches.length?matches.map(s=>`<div class="sc-wrap${selected?.aphiaID===s.aphiaID?' selected':''}"><label class="sc-check" title="비교 담기 · 최대 ${CMP_MAX}종"><input type="checkbox" data-basket="${s.aphiaID}"${cmpBasket.includes(s.aphiaID)?' checked':''} aria-label="${esc(s.label)} 비교 담기"></label><button class="species-card ${selected?.aphiaID===s.aphiaID?'selected':''}" data-species="${s.aphiaID}" data-group="${esc(s.group)}" data-type="${matrixType(s)||'none'}"${matrixType(s)?` style="--tc:${matrixTypeColour[matrixType(s)]}"`:''} aria-pressed="${selected?.aphiaID===s.aphiaID}">${typeShape(matrixType(s),'sc-shape')}<span class="group">${esc(s.group)}</span><b title="${esc(s.label)}">${esc(s.label)}</b><em lang="la" title="${esc(s.name)}">${esc(latinOf(s))}</em>${cardLine(s)}<span class="count"><span>지도 표시 기록</span><strong>${s.cells.length?`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}셀`:'—'}</strong></span>${cardScores(s)}${useCardLine(s)}</button></div>`).join(''):'<p class="empty">일치하는 후보가 없습니다.<br>다른 이름으로 검색해 보세요.</p>';
  $('species-list').querySelectorAll('[data-species]').forEach(button=>{
    button.addEventListener('click',()=>selectSpecies(Number(button.dataset.species)));
    for(const [ev,on] of [['mouseenter',1],['focus',1],['mouseleave',0],['blur',0]])button.addEventListener(ev,()=>hoverSpecies(on&&Number(button.dataset.species)));
  });
  $('species-list').querySelectorAll('[data-basket]').forEach(box=>{
    box.addEventListener('click',e=>e.stopPropagation());
    box.addEventListener('change',e=>{e.stopPropagation();if(!toggleBasket(box.dataset.basket)){box.checked=false;$('status-live').textContent=`비교는 최대 ${CMP_MAX}종까지 담을 수 있습니다.`;}else $('status-live').textContent=`${data.species.find(x=>x.aphiaID===Number(box.dataset.basket))?.label||''} 비교 ${box.checked?'담음':'뺌'} · ${cmpBasket.length}/${CMP_MAX}`;});
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
  const head=$('detail').querySelector('.detail-head');
  if(s.assessment)head?.insertAdjacentHTML('afterend',axisCards(s));
  // 2026-10-15 (application doc): a both-high species shows alternative production before the map summary, then the two links
  ($('detail').querySelector('.axis-cards')||head)?.insertAdjacentHTML('afterend',altProductionBlock(s)+speciesActions(s));
  renderSidePanel(s);
}
// 2026-10-15 explore design match: from 1180px the right panel shows the summary only (name, type, the evidence badge, BBVI
// and MCUI apart, the two links and '근거 자세히 보기'); everything else in #detail opens in the evidence drawer over the
// panel. Below 1180px the panel is not shown and #detail stays in its column or the phone sheet, as before. Not in the link.
let detailOpen=false;
const wideLayout=()=>!!globalThis.matchMedia?.('(min-width:1180px)').matches;
// a species picture only where a reviewed original exists: none yet, so every species shows its taxon group's icon (no emoji,
// no stock photo). A reviewed picture goes here, e.g. {836033:{src:'vendor/species/<file>',w,h,alt}} (vendor/species/SOURCE.txt)
const SPECIES_ART={};
const mcuiBasisWord=s=>{const a=s?.assessment;if(!a||pilotScore(s,'MCUI')===null)return '';
  if(earlyMcui(s))return ''; // 4.17: no basis word for a preliminary basis (2026-10-19: a Rapid LC value says '예비' in its tag)
  return a.mcui_basis==='iucn'?'IUCN 평가':a.mcui_basis==='national'?'국가 평가':subNationalMcui(s)?'지방 목록 참고값':preliminaryMcui(s)?'분포 범위 계산':substituteMcui(s)?`${a.mcui_substitute?.record?.country_ko||''} 정부 평가`.trim():'';};
// the evidence badge: the published replication words of the top MBPI item (or the BBVI label); none when there is neither
function evidenceBadge(s){
  return '';  // 2026-10-17 (LKH): the right panel carries no evidence label
  const e=evProfile(s),r=evRule();
  if(e&&r&&e.item_count>0)return e.top_item_replication==='replicated'?r.screen_label_replicated||'':r.screen_label||'';
  return bbviLabel(s)||'';
}
const spInfo=(id,label,body)=>`<span class="sp-info-wrap"><button type="button" class="sp-info" aria-expanded="false" aria-controls="${id}" aria-label="${esc(label)} 설명">ⓘ</button><span id="${id}" class="sp-pop" role="note" hidden>${body}</span></span>`;
function renderSidePanel(s){
  const box=$('sp-species');if(!box||!s)return;
  const rule=matrixRule(),t=matrixType(s),art=SPECIES_ART[s.aphiaID],badge=evidenceBadge(s);
  const b=axisState(s,'BBVI'),m=axisState(s,'MCUI');
  const bar=(v,cls)=>v===null?'':`<span class="sp-bar ${cls}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>`;
  const held=st=>`<span class="sp-held">${esc(st.label)}</span>`;
  const cat=m.value===null?'':mcuiCatTag(s),word=mcuiBasisWord(s);
  const bbviPop=`식량(MFPI)과 생리활성(MBPI) 근거를 합친 탐색용 활용 지표입니다(w = ${bbviWeight.toFixed(2)}${rule?` · ${esc(thresholdWord())} ${rule.bbvi_threshold}`:''}). 보전 시급성 MCUI와 따로 봅니다.`;
  const mcuiPop=`${esc(mcuiDefOf(s))}을 0–100점으로 옮긴 값입니다${rule?` · ${esc(thresholdWord())} ${rule.mcui_threshold}`:''}. 활용가치 BBVI와 따로 봅니다.`;
  const badgePop=esc(badge);
  box.innerHTML=`<div class="sp-head"><div class="sp-names"><h2 id="sp-name">${esc(s.label)}</h2><p class="sp-latin" lang="la">${esc(latinOf(s))}</p></div>`+
    (art?`<img class="sp-art" src="${art.src}" width="${art.w}" height="${art.h}" alt="${esc(art.alt)}" decoding="async">`:`<span class="sp-art sp-art-icon">${groupBadge(s)}</span>`)+`</div>`+
    `<p class="sp-type" title="${esc(matrixPlainNote())}">${typeShape(t,'sp-shape')}<b>${esc(t?matrixTypePlain(t):'—')}</b>${t?`<span class="sr-only"> (${esc(matrixTypeLabel(t))})</span>`:''}</p>`+
    (badge?`<div class="sp-badge-row"><button type="button" class="sp-badge" data-drawer-go="evidence">${esc(badge)} <span aria-hidden="true">›</span></button>${spInfo('sp-pop-badge','근거 배지',badgePop)}</div>`:'')+
    `<section class="sp-score sp-bbvi" aria-labelledby="sp-bbvi-h"><div class="sp-score-head"><h3 id="sp-bbvi-h">활용가치 BBVI</h3>${spInfo('sp-pop-bbvi','활용가치 BBVI',bbviPop)}</div><p class="sp-range">0–100점</p>`+
      `<div class="sp-score-row">${b.value===null?held(b):`<strong class="sp-num">${scoreText(s,'BBVI',b.value)}</strong>`}${bar(b.value,'use')}</div>`+
      (officialNote(s)?`<p class="sp-sub">${esc(officialNote(s))} · ${esc(weightPair())}</p>`:'')+`</section>`+
    `<section class="sp-score sp-mcui" aria-labelledby="sp-mcui-h"><div class="sp-score-head"><h3 id="sp-mcui-h">보전 시급성 MCUI</h3>${spInfo('sp-pop-mcui','보전 시급성 MCUI',mcuiPop)}</div><p class="sp-range">0–100점</p>`+
      `<div class="sp-score-row">${m.value===null?held(m):`<strong class="sp-num">${scoreValue(s,'MCUI',m.value)}</strong>`}${bar(m.value,'cons')}</div>`+
      ([cat,word].filter(Boolean).length?`<p class="sp-cat">${glossHtml(esc([cat,word].filter(Boolean).join(' · ')))}</p>`:'')+`</section>`+
    `<p class="sp-sep"><span>두 축은 별도로 봅니다.</span></p>`+
    `<div class="sp-actions">${speciesActionButtons(s)}</div>`;
  box.querySelector('.sp-badge')?.addEventListener('click',()=>openDrawer('evidence'));
  syncCtaLabel();
}
function syncCtaLabel(){const c=$('sp-cta');if(c)c.setAttribute('aria-expanded',String(drawerIsOpen()));document.querySelector('#sheet-summary .ss-open')?.setAttribute('aria-expanded',String(drawerIsOpen()));}
// ⓘ: click or Enter opens the short note under the button (not hover-only); Escape or a click elsewhere closes it
function closeSpPops(except){document.querySelectorAll('#side-panel .sp-info[aria-expanded=true]').forEach(b=>{if(b===except)return;b.setAttribute('aria-expanded','false');$(b.getAttribute('aria-controls')).hidden=true;});}
// ---- evidence drawer (#ev-drawer around #detail): over the right panel and part of the map; the map keeps its centre and zoom
let drawerReturn=null;
const drawerIsOpen=()=>$('ev-drawer')?.classList.contains('open')||false;
function syncDrawer(){
  const d=$('ev-drawer');if(!d)return;const wide=wideLayout(),open=wide&&d.classList.contains('open');
  // below 1180px the drawer box is display:contents (theme.css) and #detail is the old column or sheet, always readable
  d.inert=wide&&!open;
  if(wide){d.setAttribute('role','dialog');d.setAttribute('aria-modal','false');}else{d.removeAttribute('role');d.removeAttribute('aria-modal');}
  syncCtaLabel();
}
function openDrawer(target,from){
  const d=$('ev-drawer');if(!d||!selected)return;
  if(!wideLayout()){const t=drawerTarget(target);(t||$('detail')).scrollIntoView({behavior:'smooth',block:'start'});return;}
  drawerReturn=from||document.activeElement;
  d.classList.add('open');detailOpen=true;syncDrawer();
  $('ev-drawer-title').textContent=`${selected.label} · 근거 자세히 보기`;
  const t=drawerTarget(target);
  for(let x=t?.closest('details');x;x=x.parentElement?.closest('details'))x.open=true;
  const body=$('detail');
  if(t&&t!==body){const top=t.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-8;body.scrollTop=Math.max(0,top);t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1600);}
  else body.scrollTop=0;
  (t&&t.matches('summary,button,a')?t:d.querySelector('.evd-close')).focus({preventScroll:true});
}
function drawerTarget(target){
  const d=$('detail');if(!target)return d;
  if(target==='evidence')return d.querySelector('.ax-evidence')||d.querySelector('.ev-profile')||d.querySelector('.axis-cards')||d;
  if(['MFPI','MBPI','MCUI','BBVI'].includes(target))return d.querySelector(`[data-axis="${target}"]`)||d.querySelector('.axis-cards')||d;
  return d.querySelector(target)||d;
}
function closeDrawer(restore=true){
  const d=$('ev-drawer');if(!d||!d.classList.contains('open'))return;
  d.classList.remove('open');detailOpen=false;syncDrawer();
  if(restore){const ok=x=>x&&document.contains(x)&&x.offsetParent!==null&&!x.closest('#ev-drawer');(ok(drawerReturn)?drawerReturn:$('sp-cta'))?.focus({preventScroll:true});}
  drawerReturn=null;
}
// kept for the checks that open every fold (readability_check): nothing in #detail folds any more, the drawer holds it all
function foldDetail(){}
// the species pane's selects and 활용 특성 chips fold the same way under '필터 더 보기' (selected chips stay in #use-extra)
let filtersOpen=false;
function syncFolds(){
  const wide=wideLayout();
  const ff=$('filter-fold'),ft=$('filter-toggle');
  if(ff&&ft){const folded=wide&&!filtersOpen;ff.classList.toggle('folded',folded);ff.inert=folded;ft.setAttribute('aria-expanded',String(!folded));}
}
function filterCount(){
  const n=activeUses.size+($('species-group').value!=='all'),c=$('filter-count');
  if(c){c.textContent=n?`${n}개 사용 중`:'';c.hidden=!n;}
}

// Counts come from the published evidence_summary. A missing key is "정보 없음", never 0.
const count = (v,unit='건') => Number.isFinite(v) ? `${v.toLocaleString()}${unit}` : '정보 없음';
const row = (label,value,cls='',lang='en') => {const v=esc(value);return `<div class="evidence-item"><span>${esc(label)}</span><b class="${cls}"${enAttr(v,lang)}>${escL(value)}</b></div>`;};

// The operating profile summary was published before the index report. Where the report reviewed an axis, show its
// result instead of the profile's older "미수집/미검토/보류"; profile counts that do exist are kept as they are.
function indexReviewRow(s,key,label){
  const a=VERIFIED.includes(s.assessment?.report_version)?s.assessment:null;
  const seen=a&&{MFPI:a.food_trace?.observed_rows?.length,MBPI:a.bioactivity_trace?.length||a.bioactivity_partial?.length,MCUI:a.conservation_trace?.reviewed}[key];
  if(!seen)return null;
  const v=pilotScore(s,key);
  return row(label,`지표 보고서에서 검토 · ${key} ${v===null?(key==='MCUI'&&s.assessment?.conservation_status?'미산출 · '+consShort(s,true):'산출 보류'):scoreText(s,key,v)}${key==='MCUI'&&separateMcui(s)&&!(v!==null&&stockMcui(s))?' ('+mcuiBasisShort(s)+')':''}`,v===null?'pending':'done')+
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

// 2026-10-17 (LKH): what stays of liveEvidence: the CMNPD reported-compound count with its licence line and the source-paper case
function liveCompounds(s){
  const c=s.info?.compounds||{};
  if(c.status!=='available'||!Number.isFinite(c.compound_count)||!c.compound_count)return '';
  const cmnpd=s.sources.find(x=>x.id==='cmnpd-1.0'), study=CASE_NOTES[s.aphiaID];
  return `<h3>화합물 근거</h3>${row('보고 화합물',count(c.compound_count,'개'),'done')}`+
    (study?`<p class="fine"><b>원문 조사 사례 · 참고 자료</b> ${esc(study.detail)} ${sourceLink(study.url,study.title+' ↗')}</p>`:'')+
    `<p class="fine">출처 ${cmnpd?sourceLink(cmnpd.url,'CMNPD ↗'):'CMNPD'} · ${cmnpd?sourceLink(cmnpd.licenseUrl,'CC BY-NC-SA 4.0'):'CC BY-NC-SA 4.0'} — 비상업 이용·출처 표시·동일조건 변경허락이 이 요약에도 적용됩니다.</p>`;
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
  return `<h3>지도에 표시한 기록 <span class="fine"${enAttr(esc(scope))}>${esc(scope)}</span></h3>${row('지도 표시 기록',`${cellRecords(s).toLocaleString()}건 · ${spatialCells(s).length}개 격자(${cells[0].sizeDeg}°)`)}${row('기록 연도',cellYears(s))}${historical?row('과거 기록(2000년 이전)',`${historical.toLocaleString()}건`):''}${outside?row('한국·북한 EEZ 밖 셀',`${outside.toLocaleString()}건`):''}${row('해역',[...new Set(cells.flatMap(c=>(c.seaAreas||[]).map(seaName)))].filter(x=>x!=='해역명 미확인').join(' · ')||'—')}${row('출처',s.info?.map?.source||'—')}${row('이용조건',[...new Set(cells.flatMap(c=>(c.citations||[]).flatMap(x=>x.licenses||[])))].join(' · ')||'—')}${excluded?row('제외 사유',excluded):''}`;
}
// Why records did not become cells: candidates carry a two-source review, operating species a map outcome.
function exclusionLine(s){
  if(s.review)return withheldLine(s.review);
  return Object.entries(s.info?.map?.outcome||{}).filter(([k,n])=>k!=='accepted'&&n>0).map(([k,n])=>`${REASONS[k]||k} ${count(n)}`).join(' · ');
}
// The repository has no verified species photos: the detail head shows the taxon group's icon instead (fixed size, theme.css).
const groupBadge=s=>`<span class="group-icon" data-group="${esc(s.group)}"><i aria-hidden="true"></i><small>${esc(s.group)}</small></span>`;
function renderCandidateDetail(s){
  const more=(title,body)=>body?`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`:'';
  const heading=(status)=>`<div class="detail-head">${groupBadge(s)}<div class="detail-top"><span>공개 기준 적용 자료</span><span class="verified">${status}</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(latinOf(s))}</p>${nameSourceNote(s)}</div>`;
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
    const sourceRow=(label,x)=>row(label,`조회 ${x.queried.toLocaleString()}건${x.accepted?` · 통과 ${x.accepted.toLocaleString()}건`:''}${x.openDatasets?` · 개방 이용조건 데이터셋 ${x.openDatasets}개`:''}${x.genusFallback?' · 속 단위 조회 후 원자료 학명으로 선별':''}`);
    const scored=['MFPI','MBPI','MCUI','BBVI'].filter(k=>pilotScore(s,k)!==null);
    const limit=s.cells.length?'검수 통과 기록의 집계 셀입니다(공개된 관측 기록 기준).':'';
    $('detail').innerHTML=glossHtml(heading(s.cells.length?`공개 ${s.cells[0].sizeDeg}° 셀`:'학명 연결 확인')+
      `<div class="detail-summary">${identity}<div id="detail-map-summary">${mapSummaryHtml(periodView(s))}</div>`+
      (pilot?(mbpi===null?'':row('생리활성 근거',`${P_()}MBPI ${scoreText(s,'MBPI',mbpi)} · ${pilotLabel('MBPI')} · ${bestBio(pilot).stratum_kind==='chembl'?esc(bestBio(pilot).stratum_label)+' · ':''}같은 비교집단 안의 상대 백분위`,'linked'))+renderVerifiedIndices(s)+
        `<p class="detail-limit">${limit} ${scored.map(k=>k+'('+esc(axisTag(s,k))+')').join(' / ')}${scored.length===4?' 네 지표를 모두 산출했습니다.':''}</p></div>`:
      axisStateSection(s)+`<h3>근거 상태</h3>`+
      row('식량 근거',n.foodCode?'식품명 후보 · 종 연결 미확인':'연결된 식품 행 없음','pending')+
      row('생리활성 근거','원문 연결 미검수','pending')+
      row('보전 평가',i.record?.category?'체크리스트 기록 · 원평가 미검수':'연결된 평가 미확인','pending')+
      `<p class="detail-limit">${limit} MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.</p></div>`)+
      '<div class="detail-more-list">'+
      more('근거 자세히 보기',(pilot?'':`<h3>선정 이유</h3><p>${esc(s.reason)}</p>`+row('식량·영양',food,'pending')+row('생리활성',bioDetail,'pending'))+
        (bioRows?`<table><caption>감태 유래 분리 화합물 · ACE/HHL, 37°C, IC₅₀ · 원문 Table 2</caption><thead><tr><th>화합물 · 구조</th><th>원값</th><th>백분위 · 근거 계수</th></tr></thead><tbody>${bioRows}</tbody></table><p>${sourceLink(compounds[0].measurements[0].paper_url,'분리·NMR·시험 원논문 ↗')}</p>`:'')+
        (pilot?'':row('보전',conservation,'pending'))+
        (pilot?'':row('MFPI / MBPI / MCUI / BBVI','모두 산출 보류 · 원자료 발견은 점수가 아닙니다','pending')+
        '<p class="fine">정보충분도: 출현 조회·식품명 후보·체크리스트 연결 상태만 표시합니다. 검증된 지표 점수와 구분합니다.</p>'))+
      more('활용 전 확인할 제도',institutionChecks(s))+
      more('수집·선별 기준',(r?sourceRow('GBIF',r.gbif)+sourceRow('OBIS',r.obis)+(r.gbif.nibrPoints?row('국립생물자원관 표본',`표본 ${r.gbif.nibrPoints.specimens.toLocaleString()}건(생물지리정보 채집 지점) · 조회 범위 안 ${r.gbif.nibrPoints.pointsInBox.toLocaleString()}건(GBIF 조회 수에 포함) · 통과 ${r.gbif.nibrPoints.accepted.toLocaleString()}건`):'')+
          row('통과 기록의 원자료 학명',r.names.join(', ')||'—','','la')+row('공개 해상도',String(s.sensitivity||'—').replace(/^민감도 미평가: ?/,''))+
          '<p class="fine">검수 기준: WoRMS 학명 확인 · CC0·CC BY 4.0·CC BY-NC 4.0 기록만(비상업 연구용, 2026-10-01부터 BY-NC 포함) · 연도 1개(여러 해 범위 제외) · GBIF 좌표 경고·불확실성 10 km 초과·원자료 일반화 제외 · OBIS 해안선에서 1 km보다 안쪽 육상 좌표 제외(조간대 기록 보존) · 화석·사육·시장 구입 표본 제외 · GBIF와 OBIS에 함께 게시된 같은 기록은 한 번만 셉니다. 국립생물자원관 표본은 같은 표본번호의 국립생물자원관 생물지리정보 채집 지점·일자를 씁니다(2026-10-01). 2000년 이전 기록은 과거 기간으로, 모든 기록이 한국·북한 EEZ(OBIS 해역 정보) 밖인 셀은 따로 표시합니다.</p>'
          :row('출현 검수',releaseMissing(s),'pending')))+
      more('출처와 이용조건','<p>'+sourceLink(s.wormsUrl,'WoRMS 승인 학명 원문 ↗')+' · '+esc(s.wormsCitation)+'</p>'+
        (r?'<p>'+sourceLink(r.gbif.query,'GBIF 원검색·범위 ↗')+' · '+sourceLink(r.obis.query,'OBIS 원검색·범위 ↗')+' · 검수 '+esc(s.reviewedOn)+
          ' · 셀 요약: <a href="expansion-public-cells.json" target="_blank" rel="noopener">검수 파일(JSON) ↗</a></p>':'')+
        (s.sources.length?'<details><summary>셀에 쓴 데이터셋 '+s.sources.length+'개 (자료별 이용조건)</summary><ul>'+
          s.sources.map(x=>'<li>'+sourceLink(x.url,x.title||'원 데이터셋')+' · '+`<span${enAttr(esc(x.license))}>${orig(x.license)}</span>`+'</li>').join('')+'</ul></details>':'')+
        (n.foodCode&&!pilot?.food_trace?'<p>RDA 식품명 원행: '+sourceLink(n.rowUrl,n.foodName+' ↗')+
          ' · '+esc(values)+' · 생것, 가식부 100 g 기준(폐기율 별도) · 조회 '+esc(data?.assessmentInfo?.generatedAt?.slice(0,10)||'2026-09-25')+
          ' · 공공누리 제1유형</p>':'')+
        (i.record?'<p>IUCN 체크리스트 원자료: '+sourceLink(i.checklistRecordUrl||i.record.reference,'평가 메타데이터 ↗')+
          ' · '+sourceLink(i.record.reference,'원평가 페이지 ↗')+(i.record.citation?' · '+`<span${enAttr(esc(i.record.citation))}>${escL(i.record.citation)}</span>`:'')+'</p>':''))+'</div>');
    return;
  }
  const details=[['분포·지도','미수집 · 공개 셀 없음'],['식량·영양','원값·시료 상태·가식부·양식 근거 미검수'],['생리활성','기원종·화합물·assay 연결 미검수'],['보전','IUCN 원평가·현행 상태 미검수'],['MFPI / MBPI / MCUI / BBVI','전부 산출 보류']];
  $('detail').innerHTML=glossHtml(heading('분포 미수집')+
    `<div class="detail-summary">${identity}<h3>지도에 표시한 기록</h3>${row('공개 상태','자료 미수집 · 공개 셀 없음','pending')}`+
    `<h3>근거 상태</h3>`+
    row('식량 근거','원자료 미검수','pending')+row('생리활성 근거','원문 연결 미검수','pending')+
    row('보전 평가','원평가 미검수','pending')+
    '<p class="detail-limit">지도에 셀이 없는 것은 종 부재가 아닙니다. MFPI·MBPI·MCUI·BBVI 모두 산출 보류입니다.</p></div>'+
    '<div class="detail-more-list">'+
    more('근거 자세히 보기',`<h3>선정 이유</h3><p>${esc(s.reason)}</p>`+
      (s.taxonNote?`<p class="fine">${esc(s.taxonNote)}</p>`:'')+
      details.map(([label,status])=>row(label,status,'pending')).join('')+
      '<p class="fine">정보충분도: 학명 연결만 확인 · 그 밖의 근거 미수집. 보류 항목은 0점이 아닙니다.</p>')+
    more('활용 전 확인할 제도',institutionChecks(s))+
    more('수집·선별 기준','<p>한국 주변 출현 여부, 식품 적합성 및 보전 필요성은 아직 평가하지 않았습니다. 분포를 발행하려면 종 식별·이용조건·좌표 품질·민감도 검수 후 공개 격자만 게시해야 합니다.</p>')+
    more('출처와 이용조건','<p>'+sourceLink(s.wormsUrl,'WoRMS 승인 학명 원문 ↗')+' · '+esc(s.wormsCitation)+'</p>')+
    '</div>');
}

function renderLiveDetail(s) {
  const i=s.info, cells=s.cells||[];
  const separate=!isMapRun(s)&&Number.isSafeInteger(s.recordCount)
    ? `<h3>${cells.length?'별도 수집 기록':'수집 기록 · 지도에는 조회 범위 표시'}</h3>${row('기록 수',recordLabel(s))}${row('관측 기간',years(s))}<p class="fine">${esc(s.summary)}</p>`
    : s.noOccurrences&&!cells.length
    ? row('출현자료','미수집','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>한반도 주변 자료 조회 범위를 지도에 표시합니다. 이 범위가 이 종의 출현 위치나 분포를 뜻하지는 않습니다.</div>`
    : !cells.length&&!Number.isSafeInteger(s.recordCount)
    ? row('출현자료','기록 수 미확인','pending')+`<div class="withheld"><b>지도에 조사 범위 표시</b>발행 자료의 기록 수를 확인할 수 없어 0건으로 표시하지 않습니다. 지도에는 출현 위치 대신 자료 조회 범위를 표시합니다.</div>`
    : isMapRun(s)?`<p class="fine">${esc(s.summary)}</p>`:'';
  // 2026-10-17 (LKH): the older collection summary (liveEvidence) gave way to the indicator sections; of it only the reported-compound count stays
  const evidence=s.v2?liveCompounds(s):'';
  const score=s.v2?'활용·보전 근거를 검수하는 중이라 점수를 계산하지 않았습니다. 미수집·보류 항목을 0점으로 처리하지 않습니다.':esc(s.productionSummary);
  const pilot=s.assessment;
  const pilotRows=!pilot?axisStateSection(s):VERIFIED.includes(pilot?.report_version)?renderVerifiedIndices(s)
    :pilot?`<h3>시범 지표 · 타당성 미검증</h3>${['MFPI','MBPI','MCUI','BBVI'].map(k=>row(k,pilotScore(s,k)===null?'산출 보류':scoreText(s,k,pilotScore(s,k)))).join('')}<p class="fine">BBVI는 활용 축, MCUI는 별도의 보전 축입니다. IUCN ${esc(pilot.iucn_category||'미평가')} · 평가 연도 ${esc(pilot.iucn_assessment_year||'미확인')}${pilot.iucn_review_older_than_10y?' · 오래된 평가':''}${pilot.scores.MCUI===null&&pilot.iucn_category?' · 현행 평가 확인 보류':''}. 임상·어획 사례를 통한 사후 검증 전까지 의사결정에 바로 사용하지 마세요.</p>`:'';
  // 2026-10-17 (LKH): an older profile row (no v2 keys) still shows its own production summary under the indicators
  const withheld=pilot?'규칙을 다 채우지 못한 값은 라벨(최상위 근거 독립 재현 확인 중·하한값·예비평가·지방 목록)로 구분합니다. '+(released()?'산출값은 연구용 결과입니다':'시범 수치는 연구용 결과입니다')+validationNote()+'.'+(s.v2?'':' '+score):score;
  // A status says whether an indicator was computed; "일부 근거 확인" is evidence without an indicator.
  const axes=[['MFPI','식량 근거'],['MBPI','생리활성 근거'],['MCUI','보전 평가']].map(([k,label])=>{
    const st=axisState(s,k), v=st.value, status=st.kind!=='withheld'||VERIFIED.includes(pilot?.report_version)?st.label:'산출 보류';
    return row(label,v===null?(status==='산출 보류'?status:status+' · 지표 미산출'):`${scoreText(s,k,v)} · ${esc(axisTag(s,k))}`,v===null?'pending':'done')
      .replace('<div class="evidence-item">',`<div class="evidence-item axis axis-${k}" style="--v:${v===null?0:Math.max(0,Math.min(100,v))}%">`);
  }).join('');
  const more=(title,body)=>`<details class="detail-more"><summary>${title}</summary><div class="detail-more-body">${body}</div></details>`;
  $('detail').innerHTML=glossHtml(`<div class="detail-head">${groupBadge(s)}<div class="detail-top"><span>공개 기준 적용 자료</span><span class="verified">학명 연결 확인</span></div><h2>${esc(s.label)}</h2><p class="latin">${esc(latinOf(s))}</p>${nameSourceNote(s)}</div>`+
    `<div class="detail-summary"><div id="detail-map-summary">${mapSummaryHtml(periodView({...s,cells}))}</div><details class="detail-fold"${foldOpen()}><summary>근거 상태</summary><h3>근거 상태</h3>${axes}<p class="detail-limit">공개된 관측 기록 기준입니다.</p></details></div>`+
    `<div class="detail-more-list">`+
    more('근거 자세히 보기',`${pilotRows}${evidence}${foodEvidencePanel(s)}${pilot?(s.v2?'':`<p class="fine">${score}</p>`):`<div class="withheld"><b>통합점수 산출 보류</b>${withheld}</div>`}`)+
    more('활용 전 확인할 제도',institutionChecks(s))+
    more('수집·선별 기준',`${row('AphiaID',s.aphiaID)}${row('원자료 학명',(i.original_names||[]).join(', ')||'—','','la')}<p class="fine">국명은 탐색용 표시명입니다. 자료 연결은 학명과 AphiaID를 기준으로 합니다.</p>${mapSection({...s,cells})}${separate}`)+
    more('출처와 이용조건',`<div class="source-area">${sourceLink(s.wormsUrl,'WoRMS · 학명 원문 ↗')}${s.sources.map(x=>`<p>${sourceLink(x.url,x.title+' ↗')}</p>`).join('')}${pilot?pilot.source_ids.map(id=>{const src=data.assessmentInfo.sources[id];return `<p>${sourceLink(src.url,((mcuiReference(s)?.source_ids||[]).includes(id)?'참고 정보 출처 ':'지표 근거 ')+id+' ↗')} · ${orig(src.license)}${src.notice?`<br><span class="fine">${escL(src.notice)}</span>`:''}</p>`;}).join(''):''}<button class="text-button" id="detail-sources">인용문과 이용조건 보기 →</button><p class="fine">발행 ${esc(s.publishedAt?.slice(0,10))} · 근거 보고서는 별도 스냅샷입니다.</p></div>`)+
    `</div>`);
  $('detail-sources').addEventListener('click',()=>{setView('method',false);document.querySelector('.source-section').scrollIntoView({behavior:'smooth'});});
}

// Published 1° map cells (public.species_map_cells, rules map-1). Cells only: no coordinates or record ids exist in the API.
const REASONS={on_land_obis_rule:'육지 위 좌표(OBIS 해안선 기준)',duplicate:'같은 기록 중복',under_existing_db_review:'별도 수집 기록(따로 표시)',
  species_held_until_sensitivity_review:'민감도 검토 대상 종',bad_coordinate_issue:'GBIF 좌표 오류 표시',uncertainty_over_10km:'좌표 불확실성 10 km 초과',
  coordinates_generalized_at_source:'제공처가 좌표를 흐리게 처리',no_year:'관측 연도 없음',
  taxon_not_verified:'학명 대조 제외',absent_or_dropped:'부재·삭제 기록',fossil_specimen:'화석 표본',license_not_open:'공개 이용조건 밖',
  multi_year_range:'여러 해에 걸친 날짜',coordinate_issue:'GBIF 좌표 오류 표시',generalized_at_source:'제공처가 좌표를 흐리게 처리',
  captive_or_cultivated:'양식·사육 표시 기록',market_purchase_point:'시장 구입 표본',locality_contradicts_coordinates:'장소 설명과 좌표 불일치'};
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
    :'';
  return `종 단위 값: ${axes} · ${iucn}`;
}
// A checklist, not a legal determination: cells are 1°/4° and cannot settle jurisdiction (application doc: 관할·이익공유, 2026-10-15).
// Where the records sit: candidates carry a record-level Korean/North Korean EEZ check (OBIS area lookup, review.outsideKoreanEEZ);
// operating species carry only the provider's country field per cell, so that is what their row says.
const LAW_ABS_KR='https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%9C%A0%EC%A0%84%EC%9E%90%EC%9B%90%EC%9D%98%EC%A0%91%EA%B7%BC%C2%B7%EC%9D%B4%EC%9A%A9%EB%B0%8F%EC%9D%B4%EC%9D%B5%EA%B3%B5%EC%9C%A0%EC%97%90%EA%B4%80%ED%95%9C%EB%B2%95%EB%A5%A0';
const sharePct=(n,total)=>{if(!total)return '—';const p=100*n/total,r=Math.round(p);return `${n&&n<total&&(r===0||r===100)?p.toFixed(1):r}%`;};
function recordJurisdiction(s){
  const r=s.review;
  if(r&&Number.isFinite(r.accepted)&&Number.isFinite(r.outsideKoreanEEZ)&&r.accepted>0){
    const out=r.outsideKoreanEEZ,inside=r.accepted-out;
    return {kind:'eez',total:r.accepted,inside,out,
      text:`한국·북한 EEZ 안 ${inside.toLocaleString()}건(${sharePct(inside,r.accepted)}) · 밖 ${out.toLocaleString()}건(${sharePct(out,r.accepted)})`};
  }
  const cells=s.cells||[];if(!cells.length)return null;
  const by={};let total=0;
  for(const c of cells){const k=(c.countries||[]).length?c.countries.join('·'):'국가 표기 없음';by[k]=(by[k]||0)+c.records;total+=c.records;}
  const name={KR:'한국(KR)',JP:'일본(JP)',CN:'중국(CN)',KP:'북한(KP)',RU:'러시아(RU)',TW:'대만(TW)'};
  const parts=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const other=parts.filter(([k])=>k!=='KR').reduce((a,[,n])=>a+n,0);
  return {kind:'country',total,inside:by.KR||0,out:other,untagged:by['국가 표기 없음']||0,
    text:parts.map(([k,n])=>`${k.split('·').map(x=>name[x]||x).join('·')} ${n.toLocaleString()}건(${sharePct(n,total)})`).join(' · ')};
}
function institutionChecks(s){
  const j=recordJurisdiction(s);
  // TODO(원문 확인 필요): 「유전자원의 접근·이용 및 이익 공유에 관한 법률」의 국내 유전자원 접근 신고·이익 공유 조항과
  // 적용 대상(연구·상업 이용 구분)을 법령 원문으로 확인한 뒤 아래 문구를 조항 단위로 다듬는다. 지금은 확인 안내만 한다.
  const where=!j?''
    :j.kind==='eez'?row('기록 위치(EEZ 안·밖)',j.text)+'<p class="fine">검수를 통과한 기록마다 OBIS 해역 정보로 한국·북한 EEZ 안인지 확인한 기록 단위 건수입니다.</p>'
    :row('기록 위치(국가 표기)',j.text)+'<p class="fine">공개 셀에 붙은 기록의 국가 메타데이터(제공처 국가 표기) 기준입니다.</p>';
  const foreign=j&&j.out>0;
  const highSeas=!j?'공해에서 채집하거나 공해 자원을 이용한다면 BBNJ 협정 해당 가능성을 확인합니다.'
    :j.kind==='eez'?(j.out?`한국·북한 EEZ 밖 기록 ${j.out.toLocaleString()}건 가운데 공해 기록이 있다면 BBNJ 협정 해당 가능성을 확인합니다.`
      :'공개 기록은 모두 한국·북한 EEZ 안입니다. 공해에서 새로 채집·이용한다면 BBNJ 협정 해당 가능성을 따로 확인합니다.')
    :`공개 셀은 ${j.untagged?'일부를 빼고 ':'모두 '}국가 표기가 붙은 기록입니다. 공해 기록인지는 원자료 좌표로 확인하고, 공해 기록이 있다면 BBNJ 협정 해당 가능성을 확인합니다.`;
  return `<p class="fine inst-lead">확인 안내 · 활용 전에 확인할 제도와 이 종의 기록 위치입니다.</p>${where}<ul class="why">
<li><b>국내 유전자원 · 나고야의정서</b>한국 관할 해역 기록의 생물을 연구·개발에 쓰기 전에 ${sourceLink(LAW_ABS_KR,'「유전자원의 접근·이용 및 이익 공유에 관한 법률」 ↗')}(약칭 유전자원법, 나고야의정서 국내 이행법)의 접근·이익 공유 절차가 해당하는지 법령 원문으로 확인합니다.</li>
<li><b>해외 관할 해역</b>${foreign?`한국 밖으로 표시된 기록 ${j.out.toLocaleString()}건처럼 `:''}해외 관할 해역의 기록은 해당 국가의 유전자원 접근·이익공유(ABS) 절차를 ${sourceLink('https://absch.cbd.int/','ABS 정보공유체계 ↗')}에서 확인합니다.</li>
<li><b>공해 · BBNJ</b>${highSeas} ${sourceLink('https://www.un.org/bbnjagreement/en','BBNJ 협정 ↗')}</li>
<li><b>확인 순서</b>채집·연구 전에는 원문과 소관 기관에 관할을 확인합니다.</li></ul>`;
}
// Application doc: "두 지표 모두 높은 종은 좌표보다 대체생산 정보를 먼저 노출". The official type (report weight, not the slider)
// decides, so the order does not jump while someone drags the weight. Only reviewed records are quoted; anything else reads 조사 필요.
const AQUACULTURE_KO={
  342067:'성숙한 살오징어가 실험실 대형 수조(300 m³, 깊이 6 m)에서 알덩이를 낳았고, 부화한 유생은 최대 10일 살았습니다. 2026년 연구는 야생 유생의 먹이를 조사하고 있습니다.'
};
const altFirst=s=>!!s&&officialType(s)==='alternative_production';
function altProductionBlock(s,compact=false){
  if(!altFirst(s))return '';
  const q=s.assessment?.food_trace?.aquaculture;
  const farmed=q?.reviewed?`${q.feasible?'양식 사례 있음':'사육 시도 기록'} · ${AQUACULTURE_KO[s.aphiaID]||esc(String(q.method||'').replace(/\.\s*$/,''))} ${verifiedSource(q.source_id,'양식 연구 원문 ↗')}`:'';
  const mcui=pilotScore(s,'MCUI');
  const rows=(farmed?`<div class="alt-row"><span>양식 연구</span><p>${farmed}</p></div>`:'')+
    (mcui===null?'':`<div class="alt-row"><span>보전 지표</span><p>MCUI ${scoreText(s,'MCUI',mcui)} · ${esc(mcuiBasisLabel(s))}</p></div>`);
  return `<section class="alt-production${compact?' compact':''}" aria-label="대체생산·양식 연구 현황"><h3>대체생산·양식 연구 현황 <span class="fine">두 지표 모두 높은 종 · 출현 지도보다 먼저</span></h3>${rows}`+
    (compact?'':'<p class="fine">두 지표가 모두 높은 종은 신청서 원칙에 따라 출현 위치보다 대체생산 정보를 먼저 보여 줍니다. 공식 유형(w = 0.50) 기준입니다.</p>')+'</section>';
}
// Citizen observation (external link only) and the planned precise-coordinate procedure (nothing is requested or stored).
const inatUrl=s=>`https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(String(s.name||'').split(/\s+/).slice(0,2).join(' '))}`;
const speciesActionButtons=s=>`<a class="detail-act" href="${esc(inatUrl(s))}" target="_blank" rel="noopener" title="iNaturalist에서 ${esc(s.name)} 관찰 기록 보기 · 외부 사이트"><svg class="act-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>관찰 기록 보러가기 ↗</a><button type="button" class="detail-act" data-coord-request aria-haspopup="dialog"><svg class="act-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>정밀 좌표 이용 신청</button>`;
const speciesActions=s=>`<div class="detail-actions">${speciesActionButtons(s)}</div>`;
function openCoordDialog(){
  const d=$('coord-dialog');if(!d)return;
  $('coord-dialog-species').textContent=selected?`${selected.label} · ${selected.name}`:'';
  if(!d.open)d.showModal();d.querySelector('.coord-close').focus();
}
function mapSection(s){
  const m=s.info.map;if(!m)return '';
  const degree=s.cells[0]?.sizeDeg||1;
  const single=spatialCells(s).filter(rows=>rows.some(c=>c.sites===1)).length;
  // 2026-10-17 (LKH): the per-reason exclusion counts stay in the review file; the screen shows what the cells use
  const map3=/^map-3/.test(m.rules||'');  // 2026-10-01: CC BY-NC 4.0 records and a 1 km coastline buffer
  const why=m.status==='held_sensitivity_review'?`<div class="withheld"><b>조사 범위 표시</b>출현 셀은 아직 발행되지 않았습니다. 지도에는 자료를 조회한 한반도 주변 범위를 표시합니다. ${esc(m.note)}</div>`:`<ul class="why">
<li><b>이용조건</b>${map3?`CC0·CC BY·CC BY-NC 4.0 기록을 썼습니다. CC BY-NC ${count(m.used_licences?.['CC BY-NC 4.0']??m.nc_records)}은 2026-10-01 결정에 따라 비상업 연구용으로 표시합니다.`:`CC0·CC BY 4.0 기록을 썼습니다.`}</li>
<li><b>좌표 품질</b>${map3?'OBIS 해안선 거리로 해안선에서 1 km보다 안쪽 육지 좌표를 제외했고(조간대 기록 보존)':'OBIS 해안선 거리로 육지 위 좌표를 제외했고'} 남은 좌표는 원자료 그대로 썼습니다. 불확실성 10 km 초과, 제공처가 흐리게 처리한 좌표, GBIF 좌표 오류 표시도 제외했습니다.</li>
<li><b>좌표 불확실성</b>값이 적히지 않은 기록은 ${degree}° 셀에서만 썼습니다.</li>
<li><b>민감도</b>${degree===4?'채취 압력을 고려해 4° 광역 셀을 적용했습니다.':'GBIF 지침에서 가장 엄격한 공개 수준인 1°를 적용했습니다.'}</li>
<li><b>중복</b>같은 표본 번호는 한 번만 셌고, 셀은 이번 검수 기록으로 만들었습니다.</li>
<li><b>원좌표</b>원좌표와 기록 ID는 비공개로 둡니다.</li></ul>`;
  return `<h3>지도 셀</h3><p class="fine">선별된 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 보여줍니다(점 간격 = 기록 수 구간). 붉은 점은 기록이 있는 칸의 위치(넓게 묶음)이며 원좌표는 비공개입니다.</p>${row('공개 셀',s.cells.length?`${spatialCells(s).length}개 · ${degree}°×${degree}°${spatialCells(s).length===s.cells.length?'':` · 기간별 ${s.cells.length}행`}`:'없음',s.cells.length?'done':'pending')}${s.cells.length?row(sitesLabel(s),count(cellSites(s),'곳')):''}${single?`<p class="fine">조사 지점이 1곳인 셀 ${single}개도 ${degree}° 범위로 넓게 묶어 표시합니다.</p>`:''}${m.note&&m.status!=='held_sensitivity_review'&&isMapRun(s)?`<p class="fine">${esc(m.note)}</p>`:''}<h3>${m.status==='held_sensitivity_review'?'지도 표시 기준':'왜 공개할 수 있는가'}</h3>${why}<h3>조회와 선별 <span class="fine">GBIF 조회 ${esc(m.retrieved)}</span></h3>${row('조회 기록(2000년 이후)',count(m.queried_records))}${row('CC0·CC BY 기록',count(m.open_records))}${map3?row('CC BY-NC 기록(비상업 연구용)',count(m.nc_records)):''}${Number.isFinite(m.outcome?.accepted)?row('셀에 쓴 기록',count(m.outcome.accepted)):''}<p class="fine">셀은 그 기간에 공개된 관측 기록이 있는 칸입니다(공개된 관측 기록 기준).</p>`;
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
// One colour for every species so the pattern reads at a glance. 2026-10-11 navy redesign: a lighter red that holds on the navy
// map, and the light rim on every basemap (the outline fallback is navy too now).
// 2026-10-15 explore design match: neutral blue-grey instead of red, so the pattern never reads as an alert or a value colour
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
  return v===null?'BBVI —':'BBVI '+scoreText(s,'BBVI',v);
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
  const bubble=L.circleMarker([b.lat,b.lon],{radius:r,color:'#ff8d84',weight:2,opacity:1,fillColor:DOT_RED,fillOpacity:BUBBLE_FILL[band],className:'occ-bubble'});
  bubble._zoomMark=true;
  bubble.bindTooltip?.(`공개 ${size}° 셀 ${n}개 · 선별 기록 ${b.records.toLocaleString()}건(셀당 평균 ${BUBBLE_BAND[band]} 구간) · ${esc(bbviTagText(occurrenceSpecies))}(종 단위 값)<br><small>누르면 확대되어 셀별 붉은 점으로 펼쳐집니다. 버블 위치는 셀 중심의 평균입니다(넓게 묶은 관측 지역).</small>`);
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
  $('map-symbol-label').textContent=(bubbles?'버블 = 공개 셀 묶음 · 숫자 = 셀 수':`점선 = ${size}° 셀 · 점 = 기록 수 구간(도식)`)+'\n기록이 있는 칸의 위치(넓게 묶음)';
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
// interactive (the '선택 격자' tab): each count is a button that narrows the species rows below to that group
function cellSummaryHtml(list,interactive=false){
  if(!list.length)return '';
  const g=cellSpeciesGroups(list), names=xs=>xs.length?xs.map(s=>esc(s.label)).join(', '):'없음';
  const tile=(n,label,key)=>interactive?`<button type="button" class="cs-tile" data-cell-filter="${key}" aria-pressed="${key==='all'}"><b>${n}</b><span>${label}</span></button>`:`<div><b>${n}</b><span>${label}</span></div>`;
  const names_=`<p class="fine cell-summary-names">확인 종: ${names(g.all)}<br>활용 지표 높음(BBVI ${g.bt} 이상 · ${thresholdWord()}): ${names(g.use)}<br>보전 지표 높음(MCUI ${g.mt} 이상 · ${thresholdWord()}): ${names(g.cons)}<br>종 단위 값 기준입니다. 한 종이 여러 묶음에 들어갈 수 있습니다.</p>`;
  // 2026-10-17 (LKH): three counts only (확인 종 · 활용 지표 높은 종 · 보전 지표 높은 종)
  return `<div class="cell-summary" role="group" aria-label="이 격자 종 요약${interactive?' · 누르면 아래 종 목록을 그 묶음으로 좁힘':''}">${tile(g.all.length,'확인 종','all')}${tile(g.use.length,'활용 지표 높은 종','use')}${tile(g.cons.length,'보전 지표 높은 종','cons')}</div>`+
    (interactive?`<details class="cell-rules"><summary>읽는 법</summary>${names_}</details>`:names_);
}
const cellSummaryTip=list=>{const g=cellSpeciesGroups(list);return ` · 활용 지표 높음 ${g.use.length}종 · 보전 지표 높음 ${g.cons.length}종`;};
// GBIF sensitive-species best practice: say what was generalised, what was withheld and why.
function generalizationNote(size){
  const sens=size>=4?'채취 압력을 고려해 GBIF 지침의 가장 엄격한 등급(1°)보다 넓은 4° 셀 적용'
    :'GBIF 지침의 가장 엄격한 공개 등급(1°) 적용';
  return `<br><b>공개 일반화 (GBIF 민감종 지침 용어)</b><ul><li>dataGeneralizations: 좌표를 ${size}° 셀로 일반화, 좌표 이동·무작위화 없음</li><li>informationWithheld: 원좌표·기록 ID 비공개</li><li>민감도: ${esc(sens)}</li></ul>`;
}
function cellPopupNotice(size){
  return `<br><small>붉은 점은 이 ${size}° 공개 셀의 도식적 표시입니다(기록이 있는 칸의 위치, 넓게 묶음). 점의 촘촘함은 기록 수 구간을 나타냅니다(기록 수 = 공개 관측 기록 건수).</small>`;
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
const wideCellNote=names=>`<b>${esc(names)} · 민감종 보호</b> — 채취 압력이 있어 4° 단위로 공개합니다(넓게 묶은 관측 지역). 테두리 안 바다에 기록이 있는 칸입니다.`;
function setMapLegend(s){
  // Species without published cells only show the query extent (studyBounds).
  const extentOnly=s&&!s.cells.length, size=s?.cells?.[0]?.sizeDeg||1;
  // 2026-10-13 design 2: two lines stay open, the mark and its label (bubbles or dots by zoom: setKeyLine) and the effort row;
  // the bubble row, the note and the full text sit in 'ⓘ 범례'.
  $('key-dot-mark').hidden=!!extentOnly;$('key-bubble-mark').hidden=true;
  for(const row of document.querySelectorAll('#occurrence-legend .key-bubble,#occurrence-legend .key-note'))row.hidden=!!extentOnly;
  $('map-symbol-label').textContent=extentOnly?'점선 테두리 = 자료를 찾아본 범위':`점선 = ${size}° 셀 · 점 = 기록 수 구간(도식)\n기록이 있는 칸의 위치(넓게 묶음)`;
  $('map-legend-note').textContent=extentOnly?'점선 테두리는 자료를 찾아본 범위입니다.':'축소한 지도에서는 칸을 해역별 버블로 묶어 먼저 보여 줍니다. 버블이 클수록 기록 칸이 많이 모여 있고, 진할수록 칸당 기록이 많습니다(점 간격과 같은 구간). 버블을 누르거나 확대하면 칸별 붉은 점으로 펼쳐집니다. 칸을 누르면 그 칸의 확인 종·활용 지표 높은 종·보전 지표 높은 종 수가 먼저 나옵니다. 점 간격: 칸 안의 기록이 많을수록 점이 촘촘합니다(1–4 · 5–19 · 20–99 · 100건 이상, 1°·4° 칸 모두 같은 면적 기준. 4° 칸은 5건 이상이면 같은 밀도). 점은 기록 수 구간을 나타내는 도식이고, 점 위치는 기록이 있는 칸 안의 표시입니다. 점선 테두리가 칸의 경계이고, 점은 바다 부분에만 그립니다. 칸을 누르면 실제 기록 수·기간·출처가 나옵니다.';
}

// Fitted cells stay clear of the floating controls (top-left buttons, bottom-left legend) so every cell can be clicked.
// From 1180px the species list and the detail float over the map (2026-10-11): their widths are added on each side.
// Fit padding: the floating panels' widths plus the height of each map control box over the free part of the map, on the edge
// it sits at (from 1180px, 2026-10-15 시안: the mode bar and chip at the top and the 2×2 key at the bottom left of the free part).
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
  const side=b=>b&&b.width>0&&b.width<m.width/2&&b.right>m.left+1&&b.left<m.right-1?b:null, l=side(box('.species-pane')), r=side(box('#side-panel'))||side(box('#detail'));
  return {left:l?Math.max(0,Math.round(l.right-m.left)):0,right:r?Math.max(0,Math.round(m.right-r.left)):0};
}
// 2026-10-13 design 2: one chip over the map names the selected species with its cells, records and years (the values of
// #map-count, #map-cells and #map-years, written at the same places) in place of a BBVI tag on every cell. Display only.
function setMapChip(s,text,title=''){
  const chip=$('map-chip');if(!chip)return;
  chip.hidden=!text;if(!text)return;
  const t=s?matrixType(s):null;
  chip.innerHTML=(s?`<i class="mc-dot${t?'':' none'}"${t?` style="background-color:${matrixTypeColour[t]}"`:''} aria-hidden="true"></i><b>${esc(s.label)}</b> <span class="mc-sep" aria-hidden="true">·</span> `:'')+`<span>${esc(text)}</span>`;
  chip.title=title;
}
// 2026-10-15 design match: public cells and records on the chip, the record years in its title
const chipCells=pv=>`공개 셀 ${spatialCells(pv).length}개 · 기록 ${cellRecords(pv).toLocaleString()}건`;
function renderCellMap(s,color){
  occurrenceSpecies=s;dotCells=[];cellLayers=[]; // renderMap has cleared the overlay
  const degree=s.cells[0]?.sizeDeg||1;
  $('map-review-note').textContent=`선별된 ${s.catalog?'GBIF·OBIS':'GBIF'} 출현기록을 공개 ${degree}° 셀의 붉은 점 무늬로 표시합니다. 붉은 점은 공개 셀의 도식적 표시입니다(기록이 있는 칸의 위치, 넓게 묶음). 기록 수 = 공개 관측 기록 건수.${s.catalog?' 2000년 이전 과거 기록과 한국·북한 EEZ 밖 기록은 셀 팝업에 따로 표시합니다.':''}`;
  mapJudgmentStatus(s);
  for(const rows of spatialCells(s)){
    const c=rows[0];
    // One hit area per spatial cell; every period row stays readable in its popup.
    const periods=rows.map(r=>`<li><b>공개 집계 기간 ${esc(r.period)}</b> · 기록 연도 ${esc(years(r))}${r.historical?'<br><b>과거 기록(2000년 이전)</b>':''}${r.outsideKoreanEEZ?'<br><b>한국·북한 EEZ 밖 기록</b>':''}<br>선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳<br>해역 메타데이터 ${esc(r.seaAreas.filter(x=>x!=='해역명 미확인').map(x=>'LME '+seaName(x)).join(', ')||'—')}${r.countries?.length?' · 국가 메타데이터 '+esc(r.countries.join(', ')):''}<br>출처·이용조건<ul>${occurrenceCitationLinks(r)||'<li>—</li>'}</ul></li>`).join('');
    cellLayers.push(cellShape(c.lat0,c.lon0,c.sizeDeg,{...cellFrame(),...(c.sizeDeg>=4?{edge:'plain',opacity:.9}:{})}).addTo(overlay));
    cellLayers.at(-1).bindPopup(glossHtml(`<strong>${esc(s.label)} · 선별 출현기록 ${c.sizeDeg}° 셀</strong>${c.sizeDeg>=4?'<p class="wide-note">'+wideCellNote(s.label)+'</p>':''}${cellSummaryHtml(cellSpeciesAt(c.lat0,c.lon0,c.sizeDeg))||'<br>'}<b>지표는 종 단위 값입니다</b><br>${esc(speciesAxesLine(s))}<br>공간 해상도 ${c.sizeDeg}°×${c.sizeDeg}°${Number.isFinite(c.resolutionM)?` · 가장 짧은 변 약 ${esc(Math.floor(c.resolutionM/1000))} km`:''}<br>${rows.length>1?`기간 ${rows.length}개 · 선별 기록 합계 ${esc(rows.reduce((a,r)=>a+r.records,0))}건. 같은 지점이 여러 기간에 있을 수 있어 조사 지점은 기간별로만 셉니다.<br>`:''}<b>${rows.length>1?'기간별 근거':'이 셀의 근거'}</b><ol class="cell-periods">${periods}</ol><small>공개 기준(이용조건·좌표 품질)을 통과한 기록입니다(공개된 관측 기록 기준).</small>`+effortLine(c.lat0,c.lon0,c.sizeDeg)+generalizationNote(c.sizeDeg)+cellPopupNotice(c.sizeDeg)));
    addCellDots(c.lat0,c.lon0,c.sizeDeg,rows.reduce((a,r)=>a+r.records,0)); // one pattern per spatial cell
  }
  // Not animated: Leaflet 1.1 drops a fit requested while another zoom animation runs (quick species switches).
  // 2026-10-17 (LKH): the first view of every species is bubbles, so the fit stops at the last bubble zoom (it was 7, one past it:
  // few or close cells, or a wide screen, opened on dots). A shared link's own zoom (applyHash) still wins.
  if(s.aphiaID!==lastFitted){lastFitted=s.aphiaID;map.fitBounds(s.cells.flatMap(c=>[[c.lat0,c.lon0],[c.lat0+c.sizeDeg,c.lon0+c.sizeDeg]]),{...fitPad(40),maxZoom:BUBBLE_MAX_ZOOM,animate:false});}
  drawOccurrence();
  $('map-count').textContent=cellRecords(s).toLocaleString();$('map-cells').textContent=spatialCells(s).length;$('map-years').textContent=cellYears(s);
  setMapChip(s,chipCells(s),`기록 연도 ${cellYears(s)}`);
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
    const detail=g.map(r=>`<div>${esc(r.period)}${r.historical?' · 과거 기록(2000년 이전)':''}${r.outsideKoreanEEZ?' · 한국·북한 EEZ 밖':''} · 해역 ${esc((r.seaAreas||[]).filter(x=>x!=='해역명 미확인').map(seaName).join(', ')||'—')} · 기록 연도 ${esc(years(r))} · 선별 기록 ${esc(r.records)}건 · 조사 지점 ${esc(r.sites)}곳<ul>${occurrenceCitationLinks(r)||'<li>—</li>'}</ul></div>`).join('');
    return `<tr><th scope="row">${esc(range(c))}</th><td>${detail}</td><td>${map?`<button type="button" class="text-button" data-cell="${i}">지도에서 열기</button>`:'—'}</td></tr>`;
  }).join('');
  box.innerHTML=`<details><summary>셀 목록 표로 보기 (${groups.length}개 · 키보드·화면 낭독기용)</summary><button type="button" class="text-button" id="cell-csv">CSV 내려받기 (공개 집계·출처 포함)</button><table><caption class="sr-only">${esc(s.label)}의 공개 셀별 근거. 셀 범위는 공개 집계 범위입니다(넓게 묶은 관측 지역).</caption><thead><tr><th scope="col">셀 범위</th><th scope="col">기간·집계·출처</th><th scope="col">지도</th></tr></thead><tbody>${rows}</tbody></table><p class="fine">지표는 종 단위 값입니다. 셀 범위는 기록이 있는 칸의 위치(넓게 묶음)입니다.</p></details>`;
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
  if(!periods.length){box.innerHTML='';return;}
  // 2026-10-15 design match: one dropdown '공개 집계 기간 · 전체 ⌄'; a species with one period shows it without a menu
  const many=periods.length>1,now=periodFilter==='all'||!many?'전체':periodFilter;
  box.innerHTML=`<button type="button" class="pf-toggle" aria-expanded="false"${many?' aria-controls="pf-menu"':' aria-disabled="true" title="이 종의 공개 집계 기간은 하나입니다"'}><span class="pf-k">공개 집계 기간</span> · <b>${esc(now)}</b></button>`+
    (many?`<div id="pf-menu" class="pf-menu" role="group" aria-label="공개 집계 기간 고르기" hidden>${['all',...periods].map(p=>`<button type="button" data-period="${esc(p)}" aria-pressed="${p===periodFilter}">${p==='all'?'전체':esc(p)}</button>`).join('')}</div>`:'');
  const toggle=box.querySelector('.pf-toggle'),menu=$('pf-menu');
  if(many)toggle.addEventListener('click',()=>periodMenu(menu.hidden));
  box.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{periodFilter=b.dataset.period;renderMap();writeHash();box.querySelector('.pf-toggle')?.focus({preventScroll:true});}));
}
function periodMenu(open){const m=$('pf-menu'),t=document.querySelector('#period-filter .pf-toggle');if(!m||!t)return;m.hidden=!open;t.setAttribute('aria-expanded',String(open));if(open)m.querySelector('[aria-pressed=true]')?.focus();}
document.addEventListener?.('click',e=>{if($('pf-menu')&&!$('pf-menu').hidden&&!e.target.closest?.('#period-filter'))periodMenu(false);});
document.addEventListener?.('keydown',e=>{if(e.key==='Escape'&&$('pf-menu')&&!$('pf-menu').hidden){periodMenu(false);document.querySelector('#period-filter .pf-toggle')?.focus();}});
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
  return n===null?'':`<br>조사량 참고: 이 셀 범위의 OBIS 전체 종 기록 ${n.toLocaleString()}건(${esc(effortData.startdate.slice(0,4))}년 이후)`;
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
  const note='공개 집계 셀 · 기록이 있는 칸의 위치(넓게 묶음) · 지표는 종 단위 값';
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
// 2026-10-15 design match: the cell clicked for the '선택 격자' tab, a bright dashed outline over the tone of its neighbours
const PICKED_OUTLINE={color:'#E5EDF1',weight:2.5,dashArray:'6 4',opacity:1};
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
  const own=matrixType(selected),t=cellMatrixType(g).type,head=`선택 종 ${selected.label}: ${own?matrixTypeLabel(own):'—'}`;
  return !t?head:own===t?head+' = 이 셀 색':`${head} / 이 셀 색: ${matrixTypeLabel(t)}(같은 셀의 ${colourSpecies(g)} 때문${own?' · 우선순위 규칙':''})`;
}
const sufficiencyLayers={priority:false,unexplored:false};
function valueSpeciesType(s){
  // 2026-10-17 (LKH): the type with its BBVI and MCUI only; no evidence label, sufficiency or survey flag beside them
  const t=matrixType(s);if(!t)return '';
  return '<p class="value-type">'+`매트릭스 유형 <b>${esc(matrixTypeLabel(t))}</b> · BBVI ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))}(현재 가중치${officialNote(s)?' · '+esc(officialNote(s)):''}) × MCUI ${scoreValue(s,'MCUI',pilotScore(s,'MCUI'))}${separateMcui(s)?'('+mcuiBasisLabel(s)+')':''}`+'</p>';
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
  const sel=selected&&g.species.has(selected.aphiaID)?{...base,...SELECTED_OUTLINE(),weight:3.5}:{...base,edge:active?'active':'plain'};
  return active?{...sel,...PICKED_OUTLINE}:sel;
}
// 2026-10-13 species view: the selected species' cells only, in its own type colour with a dashed border of the same colour.
// Every drawn cell is the selected species', so no yellow outline; an untyped species keeps the held grey of the all-species map.
// A clicked cell gets a heavier border of the same colour; its fill stays the tone of the other cells (2026-10-15).
function speciesCellStyle(type,active){
  const c=matrixTypeColour[type];
  const st=c?{color:c,weight:1.5,dashArray:'3 3',opacity:.95,fillColor:c,fillOpacity:CELL_FILL,edge:active?'active':'plain'}
    :{color:'#657588',weight:1.5,dashArray:'5 4',opacity:.95,fillColor:'#b7c0ca',fillOpacity:.25,edge:active?'active':'plain'};
  return active?{...st,...PICKED_OUTLINE}:st;
}
// Typed species whose MCUI is a national list (Korean or range state): the cell colour then rests on a national assessment.
const nationalTyped=g=>[...g.species.values()].filter(s=>matrixType(s)&&extinctionSeparate(s)&&!subNationalMcui(s)&&!preliminaryMcui(s)).length;
// 3.27: typed species whose BBVI carries the single-paper label
const singleTyped=g=>[...g.species.values()].filter(s=>matrixType(s)&&bbviLabel(s)&&!s.assessment?.mbpi_floor).length;
// 4.3: sub-national values are counted apart, never as national
const typedNotes=g=>{const t=[...g.species.values()].filter(matrixType),n=f=>t.filter(f).length;
  return [['국가 평가 기반 MCUI',nationalTyped(g)],['지방 목록 MCUI',n(subNationalMcui)]].filter(([,k])=>k).map(([l,k])=>' · '+l+' '+k+'종').join('');};
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
  const report=data.assessmentInfo||{};
  // 2026-10-17 (LKH): value and basis only; no evidence label, stage list or empty-slot wording ('—' where a value is missing)
  const scores=['BBVI','MFPI','MBPI','MCUI'].map(k=>{
    const st=axisState(s,k),n=st.value;
    const state=n===null?'—':scoreText(s,k,n)+(k==='MCUI'&&separateMcui(s)?' · '+mcuiBasisLabel(s)+(released()?'':' 시범'):' · '+axisTag(s,k));
    return '<div class="value-axis"><b>'+k+'</b><span>'+esc(state)+'</span>'+(n===null&&axisStateNote[st.kind]?'<small>'+esc(axisStateNote[st.kind])+'</small>':'')+'</div>';
  }).join('');
  const sources=(s.assessment?.source_ids||[]).map(id=>report.sources?.[id]).filter(Boolean);
  const links=sources.map(src=>'<li>'+[sourceLink(src.url,src.title||src.name||'지표 근거'),src.license&&esc(src.license),src.accessed&&'조회 '+esc(src.accessed)].filter(Boolean).join(' · ')+'</li>').join('');
  const raw=s.assessment?.food_trace?.nutrients,state=s.assessment?.food_trace?.sample_state;
  const rawText=raw?Object.entries(raw).map(([k,v])=>[k+' '+(v.substitute?subLabel(v.substitute)+' '+substituteRef(v.substitute)+' ':'')+num(v.value)+(v.unit?' '+v.unit:''),v.sample_state||state].filter(Boolean).join(' / ')).join(' · '):'원값은 종별 지표 상세에서 확인';
  const cons=s.assessment?.conservation_trace;
  // One line per species (name + four axis values); the evidence text opens on demand.
  const pills=['BBVI','MCUI'].map(k=>{const n=axisState(s,k).value;return '<span class="vs-pill'+(n===null?' held':'')+'">'+k+' '+(n===null?'–':scoreValue(s,k,n))+'</span>';}).join('');
  const dates=[report.generatedAt&&'평가 보고서 '+esc(report.generatedAt.slice(0,10)),(s.publishedAt||data.collectedAt)&&'출현 자료 '+esc((s.publishedAt||'').slice(0,10)||data.collectedAt)].filter(Boolean);
  return '<details class="value-species" data-aphia="'+esc(s.aphiaID)+'"><summary><h4>'+typeShape(matrixType(s),'vs-shape')+esc(s.label)+' <small lang="la">'+esc(s.name)+'</small><span class="sr-only"> · '+esc(matrixTypePlain(matrixType(s)))+'</span></h4><span class="vs-pills">'+pills+'</span></summary><div class="value-species-body">'+
    '<p>종 단위 근거 · AphiaID '+esc(s.aphiaID)+(Number.isFinite(records)?' · 이 셀 출현 기록 '+records.toLocaleString()+'건':'')+'</p>'+(traitTags(s)?'<p class="fine">활용 특성: '+traitTags(s)+'</p>':'')+valueSpeciesType(s)+
    '<div class="value-axes">'+scores+'</div><p class="fine">원자료: '+esc(rawText)+
    (nationalMcui(s)?' · 한국 국가생물적색자료집 '+esc(s.assessment.national_assessment.category)+' / 목록 '+esc(s.assessment.national_assessment.list_page_printed)+'쪽'
      :cons?.category?' · IUCN '+esc(cons.category)+((cons.assessment_date||cons.assessment_year)?' / 평가 '+esc(cons.assessment_date||cons.assessment_year):''):'')+'</p>'+
    '<p class="fine">'+dates.concat('이용조건: '+esc('GBIF·OBIS · CC0·CC BY·CC BY-NC 4.0(CC BY-NC는 비상업 연구용)')).join(' · ')+'</p>'+
    (links?'<details><summary>지표 근거 원문과 이용조건</summary><ul>'+links+'</ul></details>':'')+
    '<button type="button" class="text-button" data-value-species="'+esc(s.aphiaID)+'">종별 상세 근거 보기 →</button></div></details>';
}
function showValueCell(key,all=false){
  selectedValueCell=key;
  const group=valueCellGroups(all).get(key),panel=$('value-cell-detail');
  if(!group){panel.innerHTML='<p>선택한 공개 격자가 현재 기간의 자료에 없습니다. 지도의 다른 격자를 선택하세요.</p>';return;}
  const species=[...group.species.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
  // the selected species' own type and the cell's colour type, each with its shape, so the two are never read as one
  const ct=cellMatrixType(group).type,mine=selected&&group.species.has(selected.aphiaID),own=mine?matrixType(selected):null;
  const types=matrixRule()?'<div class="cell-types">'+(mine?'<p>'+typeShape(own)+'<span>선택 종 유형 · <b>'+esc(matrixTypePlain(own))+'</b> ('+esc(selected.label)+')</span></p>':'')+
    '<p>'+typeShape(ct)+'<span>셀 대표 유형(모든 종 겹쳐 보기 색) · <b>'+esc(ct?matrixTypePlain(ct):'—')+'</b></span></p></div>':'';
  panel.innerHTML='<h3>선택한 공개 격자 · 종별 근거</h3><p class="cell-where">'+
    esc(cellRange(group))+' ('+esc(group.size)+'° 공개 범위)</p>'+types+(selectedCellLine(group)?'<p class="value-selected-line fine">'+esc(selectedCellLine(group))+'</p>':'')+
    cellSummaryHtml(species,true)+'<p class="fine">연결 종 '+species.length+'종 · 지표는 종 단위 '+(released()?'값':'시범값')+'입니다.</p>'+
    '<div class="vs-list">'+species.map(s=>valueSpeciesCard(s,group.records?.get(s.aphiaID))).join('')+'</div>'+
    '<details class="cell-rules"><summary>셀 색 규칙</summary><p class="fine">해당 공개 셀에 기록이 있는 종만 표시합니다.'+cellTypeLine(group)+'</p></details>';
  const sets=cellSpeciesGroups(species);
  panel.querySelectorAll('[data-cell-filter]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.getAttribute('aria-pressed')==='true'&&b.dataset.cellFilter!=='all'?'all':b.dataset.cellFilter,keep=new Set(sets[key].map(s=>String(s.aphiaID)));
    panel.querySelectorAll('[data-cell-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.cellFilter===key)));
    panel.querySelectorAll('.value-species[data-aphia]').forEach(r=>{r.hidden=!keep.has(r.dataset.aphia);});
    $('status-live').textContent=`이 격자 종 ${keep.size}종 표시`;
  }));
  panel.querySelectorAll('[data-value-species]').forEach(button=>button.addEventListener('click',()=>{
    selectSpecies(Number(button.dataset.valueSpecies));
    if(wideLayout()){setSideTab('species');openDrawer(null,$('sp-cta'));return;} // from 1180px: that species' evidence drawer
    const detail=$('detail');detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
}
function cellTypeLine(g){
  if(!matrixRule())return '';
  const {type,counts}=cellMatrixType(g),kinds=Object.entries(counts),typedN=kinds.reduce((n,[,k])=>n+k,0);
  if(!type)return ' 이 셀은 회색 음영·점선 테두리로 둡니다.';
  return ` 셀 색 ${matrixTypeLabel(type)}(색을 정한 종: ${colourSpecies(g)}) · 유형별 ${typedN}종(${kinds.map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')})${typedNotes(g)}${kinds.length>1?' · 여러 유형이라 우선순위 규칙으로 한 색 선택':''}. ${colourRuleLine()}. 색은 출현 기록 셀 × 종 유형(종 단위 값)입니다.`;
}
const cellCentre=g=>[g.lat+g.size/2,g.lon+g.size/2];
function drawSufficiency(g){
  const names=flag=>[...g.species.values()].filter(s=>s.assessment?.[flag]).map(s=>s.label);
  const layers=[['unexplored','unexplored_candidate','같은 속 친척 종 · 다음 탐색 후보',{color:'#6b3fa0',fillColor:'#efe6fa',radius:4,weight:2,dashArray:'2 2'}]];
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
  return part('unexplored','unexplored_candidate','다음 탐색 후보');
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
  $('value-rule').textContent=rule?`${thresholdWord()}: BBVI·MCUI 각 ${rule.bbvi_threshold} 이상이면 높음(BBVI는 현재 가중치에서 반올림 전 값에 적용). 여러 종이 있는 셀은 ${rule.cell_colour_precedence.map(matrixTypeLabel).join(' > ')} 순으로 한 색을 쓰고, 유형이 섞인 셀은 촘촘한 점선 테두리로 표시합니다.`:'이 보고서에는 매트릭스 유형 규칙이 없어 모든 셀을 판단 보류로 둡니다.';
  $('map-review-note').textContent=rule?'공개 격자를 선택하면 그 셀에 기록된 종별 BBVI·MCUI·영양 원값·출현 기록과 근거를 볼 수 있습니다. 색은 출현 기록이 있는 셀 × 종 유형입니다(종 단위 값).':'공개 격자를 선택하면 연결 종의 식량·생리활성·보전 지표와 보류 사유를 확인할 수 있습니다. 모든 격자는 판단 보류이며 회색 음영·점선 테두리는 가치·보전 등급이 아닙니다.';
  $('map-judgment').textContent=rule?`종 유형으로 칠한 공개 격자 ${typed}곳${groups.size-typed?` · 회색 격자 ${groups.size-typed}곳`:''} · 셀 색은 종 단위 유형입니다.`:'해역별 조합 분류 0곳 · 공개 격자 '+groups.size+'개 판단 보류. 종별 BBVI·MCUI 한 쌍과 검증된 해역 집계 규칙이 없어 네 유형으로 분류하지 않습니다.';
  if(own){const t=matrixType(selected);
    $('map-judgment').textContent=`${selected.label}의 공개 셀 ${spatialCells(periodView(selected)).length}곳을 `+(t?`이 종의 유형 ‘${matrixTypePlain(t)}’(${matrixTypeLabel(t)}) 색으로 칠했습니다.`:'회색으로 칠했습니다.')+' 유형은 종 단위 값입니다.';}
  else if(activeUses.size)$('map-judgment').textContent+=` 활용 특성 ‘${[...activeUses].map(id=>traitById(id).label).join(' × ')}’ 적용 중: 모두 만족하는 종의 셀만 색으로 칠하고, 나머지 공개 격자는 흐린 회색으로 남깁니다.`;
  if(!own&&typeFilter.size)$('map-judgment').textContent+=` 유형 보기 ‘${[...typeFilter].map(matrixTypeLabel).join(', ')}’ 적용 중: 이 유형 셀만 지도에 그립니다(셀 수는 그대로).`;
  renderValueLegend(groups,own);
  const layerCounts=sufficiencyCounts(groups);
  $('layer-unexplored-count').textContent=`${layerCounts.unexplored.n}종 · 지도 표시 ${layerCounts.unexplored.shown}종`;
  // 2026-10-17 (LKH): the priority-survey layer left the legend; the next-candidate layer lists only what it draws
  $('layer-nocell').textContent='';
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
    // range, colour and who set it, the selected species' own type, then the counts and the colour rule
    const sel=selectedCellLine(g),counted=(type?(mixed?'유형 혼재 ':'')+Object.entries(counts).map(([t,k])=>matrixTypeLabel(t)+' '+k+'종').join(', ')+typedNotes(g):'')+cellSummaryTip([...g.species.values()])+sufficiencyTip(g);
    layer.bindTooltip((g.size>=4?wideCellNote([...g.species.values()].map(x=>x.label).join(', '))+'<br>':'')+cellRange(g)+' · 공개 '+g.size+'° 격자 · '+g.species.size+'종<br>'+(type?'<b>색 '+matrixTypeLabel(type)+'</b>(색을 정한 종: '+esc(colourSpecies(g))+')':'회색 셀')+
      (sel?'<br><b>'+esc(sel)+'</b>':'')+'<br>'+counted.replace(/^ · /,'')+(rule?'<br>'+colourRuleLine():''),{className:'value-tip'});
    layer.on('tooltipopen',({tooltip:t})=>placeTip(t));
    drawSufficiency(g);
    // renderMap redraws the cells, so the tapped cell's tooltip opens again on its new layer (touch has no hover)
    layer.on('click',()=>{pickedValueCell=key;showValueCell(key);renderMap();valueRects.find(([x])=>valueCellKey(x.lat,x.lon,x.size)===key)?.[1].openTooltip();if(wideLayout())setSideTab('cell');panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  // Outside candidates (the next ones to explore): a marker per public cell, hidden while use chips filter the species.
  if(sufficiencyLayers.unexplored&&!activeUses.size)for(const g of outsideCells().values()){
    const names=[...g.species.values()].map(outsideLabel);
    L.circleMarker(cellCentre(g),{color:'#6b3fa0',fillColor:'#efe6fa',radius:5,weight:2,dashArray:'2 2',fillOpacity:.9})
      .bindTooltip(`같은 속 친척 종 · 다음 탐색 후보 ${names.length}종 · ${esc(names.join(', '))}`).addTo(overlay);
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
  const verdict=t?`${matrixTypePlain(t)}(${matrixTypeLabel(t)})`:'—';
  $('map-count').textContent=n?cellRecords(pv).toLocaleString():'—';$('map-cells').textContent=String(n);$('map-years').textContent=n?cellYears(pv):'—';
  setMapChip(s,n?chipCells(pv):'이 기간 공개 셀 0개',n?`기록 연도 ${cellYears(pv)}`:'');
  if(!mine.size)panel.innerHTML='<p class="catalog-alert">‘모든 종 겹쳐 보기’에서 다른 종의 격자를 볼 수 있습니다.</p>';
  else{if(!mine.has(selectedValueCell))selectedValueCell=mine.keys().next().value;showValueCell(selectedValueCell,true);}
  if(!map)return;
  for(const [key,g] of valueCellOrder(mine)){
    const active=key===pickedValueCell,cellType=cellMatrixType(g).type,k=g.records.get(id);
    const layer=cellShape(g.lat,g.lon,g.size,speciesCellStyle(t,active)).addTo(overlay);
    valueRects.push([g,layer,active]);
    const flags=sufficiencyTip(g).replace(/^ · /,'');
    layer.bindTooltip((g.size>=4?wideCellNote(s.label)+'<br>':'')+cellRange(g)+' · 공개 '+g.size+'° 격자<br><b>'+esc(s.label)+(Number.isFinite(k)?' 기록 '+k.toLocaleString()+'건':'')+'</b> · '+esc(verdict)+
      '<br>이 셀의 다른 종 '+(g.species.size-1)+'종 · ‘모든 종 겹쳐 보기’ 색: '+esc(cellType?matrixTypeLabel(cellType):'—')+(flags?'<br>'+esc(flags):''),{className:'value-tip'});
    layer.on('tooltipopen',({tooltip:x})=>placeTip(x));
    drawSufficiency(g);
    layer.on('click',()=>{pickedValueCell=key;showValueCell(key,true);renderMap();valueRects.find(([x])=>valueCellKey(x.lat,x.lon,x.size)===key)?.[1].openTooltip();if(wideLayout())setSideTab('cell');panel.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }
  if(sufficiencyLayers.unexplored&&!activeUses.size)for(const g of outsideCells().values()){
    const names=[...g.species.values()].map(outsideLabel);
    L.circleMarker(cellCentre(g),{color:'#6b3fa0',fillColor:'#efe6fa',radius:5,weight:2,dashArray:'2 2',fillOpacity:.9})
      .bindTooltip(`같은 속 친척 종 · 다음 탐색 후보 ${names.length}종 · ${esc(names.join(', '))}`).addTo(overlay);
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
    mini.innerHTML=`${typeShape(t.id,'vm-shape')}<span class="vm-name" aria-hidden="true">${esc(matrixTypePlain(t.id))}</span><span class="vm-short" aria-hidden="true">${esc(TYPE_SHORT[t.id]||'')}</span><span class="vm-n" aria-hidden="true">${tally[t.id]||0}</span>`;mini.dataset.type=t.id;mini.dataset.tip=t.label;
    mini.ariaLabel=`${t.label} ${tally[t.id]||0}셀 · 누르면 `+(own?'모든 종 겹쳐 보기에서 ':'')+'이 유형만 보기';
    mini.style.background=c+alpha;mini.style.borderColor=c;
    mini.classList.toggle('vm-own',own&&ownType===t.id);mini.classList.toggle('vm-zero',own&&ownType!==t.id);
    mini.setAttribute('aria-pressed',String(!own&&typeFilter.has(t.id)));
  });
  if($('v-none-count'))$('v-none-count').textContent=none+'셀';
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
    :`셀 색 = 회색 · ${esc(selected.label)}`;
  $('value-view').setAttribute('aria-pressed',String(!own));
  if(!rule)return;
  $('v-axis-x').textContent=`BBVI(활용가치) → · ${thresholdWord()} ${rule.bbvi_threshold}`;
  $('v-axis-y').textContent=`MCUI(보전 시급성) → · ${thresholdWord()} ${rule.mcui_threshold}`;
  $('v-rule-line').textContent=own?'셀 색 = 선택 종의 유형(종 단위 값)':colourRuleLine();
}
// Method tab: one row per type in the colour precedence. Thresholds come from the report.
function renderTypeTable(){
  // 4.14 (prereg-4.14-2026-10-14 9): how many species change type between food weights 0.2 · 0.5 · 0.8 (the method section)
  // 4.16: the species whose top MBPI item is independently replicated, and those with a replication the rules did not count
  const er=$('method-ev-replicated');if(er&&data){const by=st=>data.species.filter(s=>evProfile(s)?.top_item_replication===st);const rp=by('replicated'),tr=by('attempted_not_counted');
    er.textContent=`${data.species.length}종 중 ${rp.length}종${rp.length?'('+rp.map(s=>s.label).join(', ')+')':''}${tr.length?`, 재현 기록이 있으나 기준 외인 종은 ${tr.length}종(${tr.map(s=>s.label).join(', ')})`:''}`;}
  renderObisWarnList();
  const wc=$('method-weight-changes');if(wc&&data){const xs=weightTypeChanges();wc.textContent=`${xs.length}종`+(xs.length?`(${xs.map(s=>s.label).join(', ')})`:'');}
  const rule=matrixRule(),body=document.querySelector('#type-table tbody');if(!body)return;
  if(!rule){body.innerHTML='<tr><td colspan="5">이 보고서에는 매트릭스 유형 규칙이 없어 모든 셀을 판단 보류(회색)로 둡니다.</td></tr>';return;}
  const key=id=>Object.keys(rule.types).find(k=>rule.types[k].id===id),cmp=(id,i)=>key(id).split('_')[i]==='high'?'≥':'<';
  const alpha=Math.round(CELL_FILL*255).toString(16),sw=(bg,bd)=>`<i class="type-swatch" style="background:${bg};border-color:${bd}"></i>`;
  body.innerHTML=rule.cell_colour_precedence.map((id,i)=>`<tr><td>${sw(matrixTypeColour[id]+alpha,matrixTypeColour[id])}</td><td><b>${esc(matrixTypePlain(id))}</b> · ${esc(matrixTypeLabel(id))}</td>`+
    `<td>BBVI ${cmp(id,0)} ${rule.bbvi_threshold} · MCUI ${cmp(id,2)} ${rule.mcui_threshold}</td><td>${esc(thresholdWord())} BBVI ${rule.bbvi_threshold} · MCUI ${rule.mcui_threshold} (같은 값은 높음)</td>`+
    `<td>우선순위 ${i+1}위${i?'':' · 이 유형 종이 하나라도 있으면 이 색'}</td></tr>`).join('');
}
function renderOutsideList(){
  const box=$('unexplored-outside');if(!box)return;
  box.hidden=!unexploredOutside.length;
  if(!unexploredOutside.length)return;
  const bbvi=r=>`${LANG==='en'&&r.name||r.label} BBVI ${scoreValue(null,'BBVI',Number(r.BBVI))}`; // 영어 화면: 학명
  box.innerHTML=`<summary>30종 밖 같은 속 친척 종 ${unexploredOutside.length}종 목록</summary><p class="fine">지도 범위에 기록이 있고, BBVI가 ${esc(data?.assessmentInfo?.method?.unexplored_candidates?.relative_min_bbvi??50)} 이상(기본 가중치 w = ${esc(data?.assessmentInfo?.foodWeight??0.5)} 기준)인 30종과 같은 속인 종입니다. 다음 탐색 순서를 고르기 위한 목록입니다.</p><ul>`+
    unexploredOutside.map(s=>`<li><b>${esc(LANG!=='en'&&s.koreanName||s.name)}</b>${LANG!=='en'&&s.koreanName?` <i>${esc(s.name)}</i>`:''} · 같은 속 ${esc(s.relatives.map(bbvi).join(', '))}${s.cells.length?` · 공개 셀 ${new Set(s.cells.map(c=>valueCellKey(c.lat0,c.lon0,c.sizeDeg))).size}곳 · 기록 ${s.cells.reduce((n,c)=>n+(c.records||0),0).toLocaleString()}건`:''}</li>`).join('')+'</ul>';
}
function setMapMode(mode){
  if(!['occurrence','value'].includes(mode))return;
  mapMode=mode;lastFitted=null;
  if(mode==='value'){valueView='species';typeFilter.clear();pickedValueCell=null;} // 2026-10-13: the value mode opens on the selected species' cells
  document.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode)));
  $('occurrence-legend').hidden=mode==='value';$('value-mini').hidden=mode!=='value';setValueInfo(false);
  // the legend box stays in both modes: the occurrence key with its fold button, or the one-line value key with the view switch
  $('legend-toggle').hidden=mode==='value';$('value-key').hidden=mode!=='value';$('value-view').hidden=mode!=='value';
  $('value-cell-detail').hidden=mode!=='value';
  $('effort-toggle').disabled=mode==='value';
  renderMap();writeHash();
}

// Short status next to the map so phones see the name and index summary without reaching the detail pane.
function renderMapSelected(s){
  const where=s.catalog&&s.cells.length?s.status+' · 공개된 관측 기록 기준':s.status;
  $('map-selected').innerHTML=`<b>${esc(s.label)}</b> <span>${esc(scoreSummary(s).replace(/\b(MFPI|MBPI|MCUI)\b/g,k=>TILE_KO[k]+' '+k))} · ${esc(where)}</span>`;
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
  $('map-source').textContent=s.cells.length?`공개 기준 자료 · 공개 ${s.cells[0].sizeDeg}° 셀`:'공개 기준 자료 · 자료 조회 범위';
  setMapLegend(s);
  if(s.catalog&&!s.cells.length){$('map-symbol-label').textContent=s.review?'공개 기준 통과 기록 없음 · 셀 없음':releaseMissing(s)+' · 셀 없음';$('map-legend-note').textContent='빈 지도는 해당 종이 이 해역에 없다는 뜻이 아닙니다.';}
  // The effort shading counts every taxon in OBIS, so it reads the same under all 30 species (2026-10-24: was off for the 22 candidates).
  $('effort-toggle').disabled=false;
  drawEffort();
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
// 2026-10-25 휴대폰: 지도 아래 14px는 종 시트가 덮으므로(theme.css margin-top:-14px) 팝업을 그보다 위에 둔다. 넓은 화면은 그대로 10px.
function syncPopupPad(){const i=mapInsets();L.Popup.prototype.options.autoPanPaddingTopLeft=L.point(i.left+10,10);L.Popup.prototype.options.autoPanPaddingBottomRight=L.point(i.right+10,phoneSheet()?24:10);}

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
  initWheelZoom();
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

// 2026-10-17 (LKH): on a computer, Ctrl(⌘) + wheel and touchpad pinch zoom the map, only over the map (as embedded Google Maps do).
// A plain wheel still scrolls the page (scrollWheelZoom stays off) and shows a short hint; outside .map-stage the browser's own
// page zoom is left alone. Chrome, Edge and Firefox send a pinch as a ctrlKey wheel; Safari sends gesture* events, which iPhone
// and iPad Safari also send for finger pinches that Leaflet's touchZoom already handles, so those are skipped while a finger is down.
// Whole zoom steps only: the bubbles and the m= link expect them. moveend/zoomend redraw and rewrite the hash as before.
const WHEEL_STEP_PX=60,WHEEL_STEP_LINES=1,WHEEL_GAP_MS=150,WHEEL_IDLE_MS=250,PINCH_STEP=1.25,WHEEL_HINT_MS=1500,WHEEL_HINT_MAX=3;
let wheelHints=0; // hints shown this page load (not stored)
function initWheelZoom(){
  const box=map.getContainer(),stage=box.closest('.map-stage')||box;
  let sum=0,lastWheel=-Infinity,lastStep=-Infinity,gesture=null,touches=0,hintTimer=0;
  const at=e=>Number.isFinite(e.clientX)?map.mouseEventToContainerPoint(e):map.getSize().divideBy(2);
  const step=(dir,e,now)=>{
    lastStep=now;sum=0;
    const z=map.getZoom(),next=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),Math.round(z)+dir));
    if(next!==z)map.setZoomAround(at(e),next);
  };
  const mac=/mac/i.test(navigator.userAgentData?.platform||navigator.platform||'');
  const hint=document.createElement('div');hint.className='map-wheel-hint';hint.setAttribute('aria-hidden','true');
  hint.textContent=mac?'⌘ + 스크롤 또는 두 손가락을 벌려 지도를 확대합니다':'Ctrl + 스크롤로 지도를 확대합니다';
  stage.appendChild(hint);
  // one hint per burst of scrolling (it stays while the wheel keeps turning), at most WHEEL_HINT_MAX per page load; mouse and touchpad only
  const showHint=e=>{
    if(!globalThis.matchMedia?.('(hover:hover) and (pointer:fine)').matches||!box.contains(e.target))return;
    if(hintTimer)clearTimeout(hintTimer);
    else{if(wheelHints>=WHEEL_HINT_MAX)return;wheelHints++;hint.classList.add('on');}
    hintTimer=setTimeout(()=>{hint.classList.remove('on');hintTimer=0;},WHEEL_HINT_MS);
  };
  stage.addEventListener('wheel',e=>{
    if(!(e.ctrlKey||e.metaKey)){showHint(e);return;}
    e.preventDefault(); // also between steps, or the page would zoom in the gap
    if(gesture)return;  // Safari sending both: the gesture moves the map
    const now=performance.now(),u=e.deltaMode===0?e.deltaY/WHEEL_STEP_PX:e.deltaMode===1?e.deltaY/WHEEL_STEP_LINES:Math.sign(e.deltaY);
    if(now-lastWheel>WHEEL_IDLE_MS||Math.sign(u)!==Math.sign(sum))sum=0;
    lastWheel=now;
    if(!u||now-lastStep<WHEEL_GAP_MS)return; // one step per WHEEL_GAP_MS, so momentum scrolling does not run through several
    sum+=u;
    if(Math.abs(sum)>=1)step(sum<0?1:-1,e,now);
  },{passive:false});
  const fingers=e=>{touches=e.touches.length;};
  for(const t of ['touchstart','touchend','touchcancel'])stage.addEventListener(t,fingers,{passive:true});
  stage.addEventListener('gesturestart',e=>{if(touches)return;e.preventDefault();gesture={base:e.scale||1};},{passive:false});
  stage.addEventListener('gesturechange',e=>{
    if(touches||!gesture)return;e.preventDefault();
    const now=performance.now(),r=e.scale/gesture.base;
    if(now-lastStep<WHEEL_GAP_MS||!(r>=PINCH_STEP||r<=1/PINCH_STEP))return;
    gesture.base=e.scale;step(r>1?1:-1,e,now);
  },{passive:false});
  stage.addEventListener('gestureend',e=>{if(!gesture)return;e.preventDefault();gesture=null;},{passive:false});
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
    const mbpiLabel=key==='MBPI'&&value!==null?basisNote(s,key).replace(/^ · /,'')||null:key==='MFPI'&&value!==null?s.assessment.food_trace?.literature_moisture?.label||null:null;
    // 2026-10-17 (LKH): a cell carries the value, its axis name and basis only (no reference value, evidence label or group tag)
    return `<button class="score-cell" data-score-aphia="${s.aphiaID}" data-score-axis="${key}" aria-label="${esc(s.label)} ${key} ${value===null?status:scoreText(s,key,value)}${mbpiLabel?' · '+esc(mbpiLabel):''}${cohort?' · '+esc(cohortLabel)+' 고정 비교집단':''}${key==='MCUI'&&value!==null&&separateMcui(s)?' · '+esc(mcuiBasisLabel(s))+' · '+esc(axisLabel(s,key))+(subNationalMcui(s)&&mcuiBacktest(s)?' · '+esc(mcuiBacktest(s)):''):''} 근거 보기">`+
      `${value===null?esc(status):scoreText(s,key,value)}<small>${value===null?esc(shortReason[s.assessment.withheld_reasons?.[key]]||'근거·보류 사유')+' · 보기':axisLabel(s,key)+(mbpiLabel?' · '+esc(mbpiLabel):'')+' · 근거 보기'}</small>`+
      (cohort?`<small>고정 비교집단 ${esc(cohortLabel)}${cohortCount?' '+cohortCount+'개 식품':''}</small>`:'')+
      (key==='MCUI'&&separateMcui(s)?'<small>'+esc(mcuiBasisLabel(s))+'</small>':'')+'</button>';
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
    const num=key==='MCUI'&&v!==null?m[2].replace(/^(\S+) \((.+)\)$/,(_,n,c)=>`${n}<small class="cv-cat" title="${glossHtml(`(${c})`).replace(/<[^>]+>/g,'')}">(${c})</small>`):m[2];  // 7/15: the category under the number
    return {main:`<button${m[1].replace('class="score-cell"','class="score-cell cv"')}><span class="cv-num${v===null?' cv-word':''}">${num}${off?`<small class="cv-official">(${off})</small>`:''}</span>${bar}</button>`,
      more:full.replace('class="score-cell"','class="score-cell cmp-more-cell"').replace('data-score-aphia=','data-more-aphia=').replace('data-score-axis=','data-more-axis=')};
  };
  // 4.10: the secondary MBPI-Rx, a number and a bar (no evidence button: its line and reason sit under the detail's MBPI);
  // '–' when the species has none. Its sort key keeps those rows last in both directions.
  const rxCell=s=>{const r=mbpiRxOf(s);return r&&r.value!==null?`<span class="cv rx-cv"><span class="cv-num">${scoreValue(s,'MBPI',r.value)}</span><span class="cv-bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,r.value))}%"></i></span></span>`
    :'<span class="cv rx-cv"><span class="cv-num rx-none">—</span></span>';};
  const rxMore=s=>{const r=mbpiRxOf(s);if(!r)return null;
    return r.value===null?'—':`${scoreValue(s,'MBPI',r.value)}<small>${esc(r.stratum.short)} · MBPI·BBVI와 별도인 보조 지표</small>`;};
  // 2026-10-13 dark data table: the plain verdict over the formal type name, in the type colour ([data-type] --qt in compare.css)
  const typeBadge=s=>{const t=matrixType(s);return t?`<span class="dt-type" data-type="${t}" title="${esc(matrixPlainNote())}"><b><i aria-hidden="true"></i>${esc(matrixTypePlain(t))}</b><small>${esc(matrixTypeLabel(t))}</small></span>`
    :'<span class="dt-type none"><b>—</b></span>';};
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
      `<p class="dt-x-sub">${esc([axisLabel(s,'BBVI'),'MFPI·MBPI 가중 합',calc!==v?'반올림 전 MFPI·MBPI로 계산해 마지막 자리가 다름':'',officialNote(s)?'탐색 보기 · '+officialNote(s):''].filter(Boolean).join(' · '))}</p>`;
  };
  const mcuiBox=s=>{
    const c=evidenceCoverage(s).checks.find(x=>x.name==='보전'), v=pilotScore(s,'MCUI');
    const sub=v===null?shortReason[s.assessment?.withheld_reasons?.MCUI]||'근거·보류 사유는 MCUI 값을 눌러 봅니다'
      :[axisLabel(s,'MCUI'),mcuiBasisLabel(s)].filter(Boolean).join(' · ');
    // 4.17 (prereg-4.17 5): a preliminary assessment is named in the species detail, not in the table
    const main=earlyMcui(s)?(stockMcui(s)?stockLead(s):`보전 평가 범주를 확인해 ${released()?'정식':'시범'} MCUI를 산출했습니다. 평가 근거는 종 상세에서 볼 수 있습니다.`):c?.detail||'';
    return `<p class="dt-x-main">${esc(main)}</p><p class="dt-x-sub">${esc(sub)}</p>${v!==null&&mcuiAuxLine(s)?`<p class="dt-x-sub dt-x-aux">${esc(mcuiAuxLine(s))}</p>`:''}`;
  };
  const occBox=(s,occ)=>(s.cells.length?`<p class="dt-x-main">공개 ${s.cells[0].sizeDeg}° 셀 ${spatialCells(s).length.toLocaleString()}곳 · 기록 ${cellRecords(s).toLocaleString()}건</p><p class="dt-x-sub">기록 수 = 공개 관측 기록 건수</p>`:`<p class="dt-x-main">${occ}</p>`)+
    `<button type="button" class="score-cell dt-x-link" data-score-aphia="${s.aphiaID}" data-score-axis="OCC" aria-label="${esc(s.label)} 출현기록 지도·셀 목록 보기">탐색 지도에서 보기 <span aria-hidden="true">→</span></button>`;
  const row=s=>{
    const id=s.aphiaID, cells=Object.fromEntries(['MFPI','MBPI','BBVI','MCUI'].map(k=>[k,valueCell(s,k)])), occ=occurrenceCell(s), open=cmpOpen.has(id), rx=rxMore(s);
    const more=[['학명·식별자',`WoRMS 확인<small>${esc(s.name)} · AphiaID ${id}</small>`],['출현기록',occ],
      ...['MFPI','MBPI','BBVI','MCUI'].flatMap(k=>[...cells[k].more?[[titles[k],cells[k].more]]:[],...k==='MBPI'&&rx?[['의약 후보 MBPI · 보조',rx]]:[]])];
    return `<tr class="cmp-row" data-aphia="${id}"><th scope="row"><b>${esc(s.label)}</b><small>${esc(latinOf(s))}</small><span class="dt-meta">${esc(s.group)}</span></th><td class="cmp-type">${typeBadge(s)}</td>`+
      ['MFPI','MBPI','BBVI','MCUI'].map(k=>`<td class="cmp-val" data-k="${k}">${cells[k].main}</td>`+(k==='MBPI'?`<td class="cmp-val cmp-rx">${rxCell(s)}</td>`:'')).join('')+
      `<td class="cmp-x"><button type="button" class="cmp-more-btn" aria-expanded="${open}" aria-controls="cmp-more-${id}" aria-label="${esc(s.label)} 근거 자세히"><svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></td></tr>`+
      `<tr class="cmp-more" id="cmp-more-${id}"${open?'':' hidden'}><td colspan="8"><div class="dt-x"><div class="dt-x3"><section><h4>BBVI 계산</h4>${bbviBox(s)}</section><section><h4>MCUI 기반</h4>${mcuiBox(s)}</section><section><h4>출현 기록</h4>${occBox(s,occ)}</section></div>${stockDeclineDetail(s,true)}`+
      `<details class="dt-x-all" data-aphia="${id}"${cmpAllOpen.has(id)?' open':''}><summary>지표별 근거 전문 <small>비교집단 · 라벨 · 원문 근거</small></summary><div class="cmp-more-grid">${more.map(([t,h])=>`<div><h4>${t}</h4>${h}</div>`).join('')}</div></details></div></td></tr>`;
  };
  $('comparison').innerHTML=`<table><caption class="sr-only">탐색 후보 ${data.species.length}종의 지표와 유형 · 정렬: ${cmpSortLabel()}</caption>`+
    `<thead><tr>${sortTh('name','종')}<th scope="col" class="cmp-type-h">유형</th>${sortTh('MFPI','MFPI<small>식량</small>')}${sortTh('MBPI','MBPI<small>생리활성</small>')}${sortTh('MBPI_RX','MBPI-Rx<small>의약 표적 보조</small>')}`+
    `${sortTh('BBVI',`BBVI<small>MFPI·MBPI 합성${cut.BBVI!=null?' · 기준선 '+cut.BBVI:''}</small>`)}${sortTh('MCUI',`MCUI<small title="${esc(MCUI_DEF)}">보전 등급 + 어획량 감소 신호${cut.MCUI!=null?' · 기준선 '+cut.MCUI:''}</small>`)}<th scope="col" class="cmp-x-h"><span class="sr-only">근거 자세히</span></th></tr></thead>`+
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
const cmpSortLabel=()=>!cmpSort.key?'기본 순서':cmpSort.key==='name'?(cmpSort.dir==='asc'?'이름 가나다순':'이름 역순'):`${CMP_SORT_NAME[cmpSort.key]||cmpSort.key} ${cmpSort.dir==='desc'?'높은 순':'낮은 순'}${CMP_MIXED_NOTE[cmpSort.key]?(cmpSort.key==='MCUI'?' (탐색용 순서 · 같은 점수는 가나다순)':' (탐색용 순서)'):cmpGroup(data.species[0],cmpSort.key)!==null?(cmpSort.key==='MFPI'?' (비교집단별)':' (층별)'):''}`;
// 4.14 (prereg-4.14-2026-10-14 8): MFPI is a percentile inside its RDA cohort and MBPI inside its item's stratum, so a sort on
// either groups the rows by cohort or stratum and orders them only inside a group; '' = no value (last)
const COHORT_KO=id=>/seaweed/.test(id||'')?'해조류':/animal/.test(id||'')?'수산동물':id||'';
function cmpGroup(s,k){
  if(k==='MFPI')return pilotScore(s,'MFPI')===null?'':'비교집단 '+COHORT_KO(s.assessment?.food_trace?.cohort_id);
  if(k==='MBPI')return mbpiStratumOf(s)?'층 '+mbpiStratumOf(s).short:'';
  if(k==='MBPI_RX'){const r=mbpiRxOf(s);return r?.value!=null&&r.stratum?'층 '+r.stratum.short:'';}
  return null;
}
const CMP_MIXED_NOTE={BBVI:'MFPI·MBPI 합성지표 · 비교집단이 다른 두 점수를 합친 값의 탐색용 순서',
  MCUI:'보전 상태 등급과 자원 감소 신호를 한 척도로 놓은 탐색용 순서 · 같은 점수는 이름 가나다순'};
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
    return sign*(x-y)||(k==='MCUI'?a.label.localeCompare(b.label,'ko'):0)||i-j;});  // 7/15: equal MCUI → 가나다순 (MCUI_TIE_RULE)
  return list.map(([s])=>s);
}
// the divider rows of a sorted table: a group head before each cohort or stratum, or the mixed-order notice on top
function cmpDividers(list,cols){
  const k=cmpSort.key;if(!k||k==='name')return list.map(()=>'');
  if(CMP_MIXED_NOTE[k])return list.map((s,i)=>i?'':`<tr class="cmp-group mixed"><th colspan="${cols}" scope="rowgroup">${esc(CMP_MIXED_NOTE[k])}</th></tr>`);
  const none=k==='MBPI_RX'?'기능성 펩타이드(ACE·XO) 근거':'—';
  let last;return list.map(s=>{const g=cmpGroup(s,k)||none;if(g===last)return '';last=g;
    return `<tr class="cmp-group"><th colspan="${cols}" scope="rowgroup">${esc(g)}${g===none?'':' · 이 묶음 안의 순서'+(k==='MFPI'?' · 백분위는 같은 비교집단 안의 위치':' · 백분위는 같은 층 안의 위치')}</th></tr>`;});
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
  if(wideLayout()&&target.closest('#sp-cell'))setSideTab('cell');
  if(wideLayout()&&target.closest('#detail')){openDrawer(axis);if(!target.matches('summary,button,a'))target.tabIndex=-1;target.focus({preventScroll:true});return;} // the evidence drawer over the right panel
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
  $('matrix-note').innerHTML=value?'가상 수치 · 실제 종과 무관한 A–D 사례입니다. 0–100의 임의 수치로 화면 동작만 설명합니다.':assessed.length?`${released()?'정식 산출':'시범 지표'} ${assessed.length}종.${matrixRule()?' 점 색은 그 종의 유형 색이고, 같은 높이에 몰린 점은 위아래로 조금 비켜 놓은 뒤 짧은 선으로 실제 높이를 가리킵니다. MCUI는 '+MCUI_DEF+'이고, 동점 규칙은 '+MCUI_TIE_RULE+'.':''}${assessed.some(separateMcui)?' MCUI 기반은 점 툴팁과 아래 유형별 목록에 적습니다.':''}${assessed.some(stockMcui)?' KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘어획량 감소’로 적습니다.':''}`:'실제 종의 두 축을 산출하지 못해 배치하지 않았습니다. 아래에서 종별 보류 사유와 확인된 원문을 볼 수 있습니다. <button type="button" class="link-button" id="simulate-inline">가상 작동 예시 보기 →</button>';
  $('simulate-inline')?.addEventListener('click',()=>toggleSimulation(true));
  const unplaced=value?[]:(data?.species||[]).filter(s=>!assessedForMatrix(s));
  // every published species is placed; a species without the pair would be listed by name only (2026-10-17, LKH)
  $('matrix-unplaced').innerHTML=unplaced.length?`<div>${unplaced.map(s=>`<button type="button" data-aphia="${s.aphiaID}">${esc(s.label)}</button>`).join('')}</div>`:'';
  $('matrix-unplaced').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>pickCompare(Number(b.dataset.aphia))));
  const count=$('cmp-types-count');if(count)count.textContent=value?'가상 예시를 보는 동안 비워 둡니다':`${assessed.length}종 배치${unplaced.length?` · 나머지 ${unplaced.length}종`:''}`;
  const points=[['A',24,74,'보전 연구 우선 검토'],['B',77,76,'활용·보전 병행 검토'],['C',25,25,'기초조사 검토'],['D',77,25,'활용 연구 검토']];
  $('matrix-points').innerHTML=value?points.map(([label,x,y,meaning])=>`<button class="matrix-point" style="left:${x}%;bottom:${y}%" title="가상 ${label}: 활용 ${x}, 보전 ${y} / ${meaning}" aria-label="가상 ${label}: 활용 ${x}, 보전 ${y}. ${meaning}">${label}</button>`).join(''):assessed.map(s=>{const kind=separateMcui(s)?' · MCUI '+mcuiBasisLabel(s):'',type=matrixType(s),meaning=type?' / '+matrixTypeLabel(type):'';
    return `<button data-aphia="${s.aphiaID}"${selected?.aphiaID===s.aphiaID?' aria-current="true"':''} class="matrix-point pilot${separateMcui(s)?' national':''}${subNationalMcui(s)?' subnational':''}${rawPreliminaryMcui(s)?' prelim':''}" style="left:${pilotScore(s,'BBVI')}%;bottom:${pilotScore(s,'MCUI')}%${type?';--mp:'+matrixTypeColour[type]:''}" data-b="${pilotScore(s,'BBVI')}" data-m="${pilotScore(s,'MCUI')}" data-name="${esc(s.label)}" data-type="${type||''}" title="${esc(s.label)} · ${P_()}BBVI ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))}, MCUI ${scoreText(s,'MCUI',pilotScore(s,'MCUI'))}${kind}${esc(meaning)}" aria-label="${esc(s.label)} ${P_()}활용 지표 ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))}, 보전 지표 ${scoreText(s,'MCUI',pilotScore(s,'MCUI'))}${kind}${esc(meaning)}"><span class="point-label${pilotScore(s,'BBVI')>=50?' left':''}" aria-hidden="true">${esc(s.label)}</span></button>`;}).join('');
  $('matrix-points').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{
    if(!value){pickCompare(assessed[i].aphiaID);return;}
    const [label,x,y,meaning]=points[i];$('matrix-note').textContent=`가상 ${label} · 활용 ${x} / 보전 ${y} → ${meaning}. 화면 동작을 보여 주는 가상 예시입니다.`;
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
  mtAssessed=assessed;renderTypeGrid();
}
// 2026-10-15 final design: four type cards in a row (a circle in each type colour), each with its species count and name chips for the current
// weight, group and search (dimmed points are left out of the count). '외 N종' opens the remaining names in place and
// '더 보기' shows that type in the data table. Names, counts and types are read from the data, never typed in.
let mtAssessed=[];const mtOpen=new Set(), MT_CHIPS=3, MT_ORDER=['low_bbvi_high_mcui','high_bbvi_high_mcui','low_bbvi_low_mcui','high_bbvi_low_mcui'];
function renderTypeGrid(){
  const box=$('matrix-types'), rule=matrixRule();if(!box)return;
  if(!rule||!mtAssessed.length){box.innerHTML='';box.hidden=true;return;}
  box.hidden=false;
  const shown=mtAssessed.filter(cmpMatch), filtered=cmpFiltered();
  box.innerHTML=`<h2 class="sr-only">유형별 종 목록</h2>`+MT_ORDER.map(key=>{const t=rule.types[key];if(!t)return '';
    const list=shown.filter(s=>matrixType(s)===t.id).sort((a,b)=>a.label.localeCompare(b.label,'ko')), open=mtOpen.has(t.id), rest=list.length-MT_CHIPS;
    const chip=(s,i)=>`<button type="button" class="mt-chip${i>=MT_CHIPS?' mt-extra':''}" data-aphia="${s.aphiaID}"${selected?.aphiaID===s.aphiaID?' aria-current="true"':''}>${esc(s.label)}${separateMcui(s)?`<span class="sr-only"> · MCUI ${esc(mcuiBasisShort(s))}</span>`:''}</button>`;
    return `<section class="mt-card${open?' open':''}" data-type="${t.id}" aria-labelledby="mt-h-${t.id}"><div class="mt-top"><h3 id="mt-h-${t.id}" title="${esc(t.label)}"><i class="mt-shape" aria-hidden="true"></i>${esc(matrixTypePlain(t.id))}<span class="sr-only"> (${esc(t.label)})</span></h3>`+
      `<span class="mt-n">종 수 <b>${list.length}</b>${filtered?'<span class="sr-only"> · 검색·분류 조건 기준</span>':''}</span><button type="button" class="mt-go" data-mt-table="${t.id}" aria-label="${esc(matrixTypePlain(t.id))} ${list.length}종을 데이터 표에서 보기">더 보기 <span aria-hidden="true">›</span></button></div>`+
      `<div class="mt-chips">${list.map(chip).join('')||'<em class="mt-none">현재 0종</em>'}${rest>0?`<button type="button" class="mt-rest" data-mt-more="외 ${rest}종" aria-expanded="${open}">${open?'접기':`외 ${rest}종`}</button>`:''}</div></section>`;}).join('');
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
  // soft: rectangles only the unselected labels avoid (English screen: the quadrant names, since scientific names are long)
  const placeLabels=(pts,extra,soft=[])=>{
    const taken=[...all.map(b=>b.getBoundingClientRect()),...extra];
    const blocked=(r,b)=>r.left<frame.left||r.right>frame.right||r.top<frame.top||r.bottom>frame.bottom||
      taken.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top)||
      (!sel(b)&&soft.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top));
    // crowded points choose first, so the free space near a cluster goes to the cluster
    const near=b=>{const c=b.getBoundingClientRect();return pts.filter(o=>{const d=o.getBoundingClientRect();return Math.abs(d.x-c.x)<90&&Math.abs(d.y-c.y)<40;}).length;};
    for(const b of pts.slice().sort((a,c)=>sel(c)-sel(a)||near(c)-near(a)||a.dataset.b-c.dataset.b)){
      const l=b.querySelector('.point-label');if(!l)continue;
      l.classList.remove('hidden-label');
      place(l,['right',0]);
      const h=l.getBoundingClientRect().height+2;
      const fit=[['right',0],['left',0],['above',0],['below',0],['right',-h],['right',h],['left',-h],['left',h],['above',-h],['below',h],['right',-2*h],['right',2*h],['left',-2*h],['left',2*h]]
        .find(c=>{place(l,c);return !blocked(l.getBoundingClientRect(),b);});
      if(fit)taken.push(l.getBoundingClientRect());
      else{place(l,[parseFloat(b.dataset.b)>=50?'left':'right',0]);l.classList.add('hidden-label');}
    }
  };
  const qn=LANG==='en'?[...box.parentElement.querySelectorAll('.quadrant :is(strong,span)')].filter(e=>e.textContent.trim()).map(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect();}):[];
  placeLabels(all,[],qn);
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
      placeLabels(all.filter(b=>!sel(b)&&!b.hasAttribute('data-clustered')),[...shapes,...keep],qn);
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
  if(k==='MBPI'&&mbpiStratumOf(s))parts.push(mbpiStratumOf(s).short); // 2026-10-12: the top item's stratum, as on cards and in the detail
  if(k==='MCUI'&&pilotScore(s,'MCUI')!==null)parts.push(mcuiBasisLabel(s));
  return [...new Set(parts.filter(Boolean).join(' · ').split(' · '))].join(' · ');  // 4.12: a stock basis names itself in two places
}
// 2026-10-13 design 3: one short chip beside a value's heading. MCUI shows its basis in short ('한국 국가 평가', 'IUCN 평가');
// other axes the first label piece after '정식 산출', which every species shares. The pieces are cmpTag's own words.
const cmpPieces=(s,k)=>cmpTag(s,k).split(' · ').filter(p=>p&&p!=='정식 산출');
const cmpMcuiChip=s=>pilotScore(s,'MCUI')===null?'':mcuiBasisLabel(s).replace(/\(.*\)$/,'').replace(/ 기반$/,'').replace(/^IUCN$/,'IUCN 평가');
const cmpChip=(s,k)=>k==='MCUI'&&cmpMcuiChip(s)||cmpPieces(s,k)[0]||'';
// The use labels no chip carries, on one line under the use block: the MBPI stratum first, then each remaining piece once,
// led by the axes it belongs to (참굴: 생리활성 근거: ACE 펩타이드 · …). Nothing is dropped or new.
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
const clusterBbvi=id=>{const s=cmpById(id);return s?scoreValue(s,'BBVI',pilotScore(s,'BBVI')):'–';};
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
    btn.type='button';btn.className='matrix-cluster-btn';btn.dataset.cluster=g.ids.join(',');const warnN=g.ids.filter(id=>byId.get(id)?.classList?.contains('obis-warn')).length;  // ⚠ of a hidden member stays visible on its pill
    btn.innerHTML=`${warnN?'<i class="mp-obis-pill" aria-hidden="true">⚠</i>':''}${LANG==='en'?esc(T_('{0}종 묶음',{0:g.ids.length})):g.ids.length+'종'}<span class="mcb-act"> ${LANG==='en'?esc(T_('· 펼치기')):'· 펼치기'}</span>`;  // English is written here, not by the page translator, so the button is measured at its English width
    btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','matrix-cluster-pop');
    btn.setAttribute('aria-label',`점이 몰린 ${g.ids.length}종 · BBVI ${clusterBbvi(g.ids[0])}–${clusterBbvi(g.ids.at(-1))} · MCUI ${scoreValue(null,'MCUI',g.m)}${warnN?` · OBIS 감소 신호 ${warnN}종(점수 미반영)`:''} · 종 목록 펼치기`);
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
    // English screen: the scientific-name labels and longer quadrant names leave less room, so before sitting inside its
    // box a button also tries the box's ends and beside the earlier buttons, inside, below or above the box, never on an
    // earlier button (spots clear of the points first)
    const inBox=LANG==='en'?[ix,L+2,R-w-2,...pills.flatMap(o=>[o.right+gap,o.left-gap-w])].flatMap(x=>[iy,B+3,T-h-3].map(y=>({left:x,top:y,right:x+w,bottom:y+h})))
      .filter(r=>r.left>=frame.left+2&&r.right<=frame.right-2&&r.top>=frame.top+2&&r.bottom<=frame.bottom-2&&!hit(r,pills))
      .sort((a,c)=>hit(a,free)-hit(c,free)):[];
    const spot=[up[0],down[0],...up.slice(1),...down.slice(1),...up2,...up3].find(r=>r&&ok(r))||inBox[0]||{left:ix,top:iy,right:ix+w,bottom:iy+h};
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
  pop.innerHTML=`<p class="mc-head">BBVI ${clusterBbvi(list[0].aphiaID)}–${clusterBbvi(list.at(-1).aphiaID)} · MCUI ${scoreValue(list[0],'MCUI',pilotScore(list[0],'MCUI'))}${(t=>t.size===1&&[...t][0]?` (${esc([...t][0])})`:'')(new Set(list.map(x=>mcuiCatTag(x))))} · ${list.length}종 · 점 위치 순(왼쪽부터)</p><ul class="mc-list">${list.map(s=>{const t=matrixType(s);
    return `<li><button type="button" data-aphia="${s.aphiaID}"><i class="mc-dot${rawPreliminaryMcui(s)?' hollow':''}" style="--mp:${t?matrixTypeColour[t]:'#a9bbc6'}" aria-hidden="true"></i><b>${esc(s.label)}</b><span>BBVI ${scoreText(s,'BBVI',pilotScore(s,'BBVI'))} · MCUI ${scoreText(s,'MCUI',pilotScore(s,'MCUI'))}</span><small>${esc(cmpMcuiChip(s))}</small></button></li>`;}).join('')}</ul>`;
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
  renderTypeCards();syncGroupCounts();cmpPageLine();renderTypeGrid();
  if(!note)return;
  note.innerHTML=!on?'':n?`${data.species.length}종 중 ${n}종 표시${cmpMode==='matrix'?' · 나머지 점은 흐리게 남겨 둡니다':''} <button type="button" class="cmp-link" data-cmp-clear>필터 해제</button>`:
    `<b>검색 결과 없음</b> · ${cmpFilter.q?'‘'+esc(cmpFilter.q)+'’에 맞는 ':''}${cmpFilter.group!=='all'?esc(cmpFilter.group)+' ':''}${typed?'‘'+esc(matrixTypePlain(cmpFilter.type==='none'?null:cmpFilter.type))+'’ 유형 ':''}생물이 없습니다. 다른 조건으로 다시 찾아보세요. <button type="button" class="cmp-link" data-cmp-clear>필터 해제</button>`;
  note.classList.toggle('empty-result',on&&!n);
}
function setCompareFilter(next){
  Object.assign(cmpFilter,next);
  document.querySelectorAll('[data-cmp-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cmpType===cmpFilter.type)));
  document.querySelectorAll('[data-cmp-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cmpGroup===cmpFilter.group)));
  if($('cmp-search').value.trim().toLowerCase()!==cmpFilter.q)$('cmp-search').value=cmpFilter.q;
  applyCompareFilter();
}
// Data table (2026-10-13; four since 2026-10-17): type cards counting the species the group and search leave, by the type at the current weight;
// a card keeps only its type in the table. Built once, then counts and pressed states are updated in place (focus stays).
const CMP_TYPE_ORDER=['sustainable_use','alternative_production','conservation_priority','baseline_survey'];
function renderTypeCards(){
  const box=$('cmp-type-cards');if(!box?.dataset||!data)return;
  const known=Object.values(matrixRule()?.types||{}).map(t=>t.id);
  const ids=[...CMP_TYPE_ORDER.filter(id=>known.includes(id)),...known.filter(id=>!CMP_TYPE_ORDER.includes(id))];
  if(box.dataset.ids!==ids.join()){
    box.dataset.ids=ids.join();
    box.innerHTML=ids.map(id=>`<button type="button" class="dt-card" data-cmp-type="${id}"${id==='none'?'':` data-type="${id}"`} aria-pressed="false"><span class="dt-card-name"><i aria-hidden="true"></i>${esc(matrixTypePlain(id==='none'?null:id))}</span>`+
      `<span class="dt-card-n"><b></b> 종</span><span class="dt-card-sub">${esc(matrixTypeLabel(id))}</span></button>`).join('');
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
  // 2026-10-15 design: short legend names; the full judgement each one stands for is in the title, for screen readers and in '읽는 법'
  const lg=(cls,short,full)=>`<span title="${esc(full)}"><i class="lg-dot${cls?' '+cls:''}" aria-hidden="true"></i>${esc(short)}${full!==short?`<span class="sr-only"> (${esc(full)})</span>`:''}</span>`;
  // 2026-10-18: every point is a circle; an MCUI from the stock-decline signal reads in the number's brackets and the tooltip.
  // 2026-10-19 (LKH): a Rapid LC value is a hollow circle in its type colour, named in one legend line while any is placed
  const prelim=data.species.some(s=>assessedForMatrix(s)&&rawPreliminaryMcui(s));
  if($('cmp-legend'))$('cmp-legend').innerHTML=lg('sel','선택한 종','선택한 종')+(prelim?lg('hollow','속 빈 원 = 공식 평가 전 예비 판정','속 빈 원 = 공식 평가 전 예비 판정'):'');
  markWeightPoints();
  applyCompareFilter();
}
function syncCompareSelection(){
  if(!data||!$('cmp-profile'))return;
  renderCompareProfile();
  if(!simulated){syncCompareMatrix();if(currentView==='compare'&&cmpMode==='matrix')declutterPointLabels();}
  if($('cmp-drawer')?.open&&selected)showCompareMore(false);
}
// a point, a list name or a table row picks the species; the profile beside the matrix follows (below it on narrow screens)
function pickCompare(id){
  if(!cmpById(id))return;
  selectSpecies(Number(id));
  if(globalThis.matchMedia?.('(max-width:1100px)').matches)$('cmp-profile').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
}
// 2026-10-15 final design (compare-target): the profile keeps what the design shows (name, type, the two big values with their
// bars, MFPI·MBPI under BBVI, the MCUI category and basis) and every other line moves, unchanged, into the '근거 자세히 보기'
// drawer (renderCompareDrawer). Its numbers follow the one rule (scoreValue); the MCUI category sits under the number.
// species artwork: the explore map's SPECIES_ART, empty for now, so every species shows its group icon tile; a reviewed
// picture added there shows here too. No other picture stands in for a species.
const cmpArtOf=id=>SPECIES_ART[id]||null;
const cmpArt=s=>{const a=cmpArtOf(s.aphiaID);return a?`<img class="cp-art-img" src="${esc(a.src)}" alt="" width="${a.w}" height="${a.h}" decoding="async">`:`<span class="cp-tile">${cmpIcon(s)}</span>`;};
function renderCompareProfile(){
  const box=$('cmp-profile'), s=selected;if(!box)return;
  if(!data||!s){box.innerHTML='<p class="loading">자료를 불러오는 중입니다.</p>';return;}
  if(currentView==='compare')loadCompareStops();
  const t=matrixType(s), inBasket=cmpBasket.includes(s.aphiaID), full=!inBasket&&cmpBasket.length>=CMP_MAX, rule=matrixRule(), go=cmpExpeditionLink(cmpStops,s.aphiaID);
  const num=k=>{const st=axisState(s,k);return st.value===null?`<span class="cp-state">${esc(st.label)}</span>`:scoreValue(s,k,st.value);};
  // a thin mark at the type threshold (matrixRule); a missing value draws no bar
  const bar=(k,cut=null)=>{const v=pilotScore(s,k);return v===null?'':`<span class="cp-bar${k==='MCUI'?' sand':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i>${cut==null?'':`<b class="cp-cut" style="left:${cut}%"></b>`}</span>`;};
  const ev=(k,cls,inner)=>`<button type="button" class="${cls}" data-prof-axis="${k}" aria-label="${k==='OCC'?esc(s.label)+' 출현 기록 지도 보기':`${esc(s.label)} ${k} ${pilotScore(s,k)===null?esc(axisState(s,k).label):scoreText(s,k,pilotScore(s,k))} · ${esc(cmpTag(s,k))} · 근거 보기`}">${inner}</button>`;
  const sub=(k,name)=>`<div class="cp-sub">${ev(k,'cp-sub-name',`<span>${name}</span>`)}${bar(k)}${ev(k,'cp-sub-num',num(k))}</div>`;
  const info=(id,name)=>`<button type="button" class="cp-info" data-drawer-sec="${id}" aria-haspopup="dialog" aria-label="${name} 근거와 설명 보기"><span aria-hidden="true">i</span></button>`;
  const badge=cmpChip(s,'BBVI'), cat=pilotScore(s,'MCUI')===null?'':[mcuiCatTag(s),cmpMcuiChip(s)].filter(Boolean).join(' · ');
  box.innerHTML=`<div class="cp-head"><div class="cp-id"><h2 id="cmp-profile-name">${esc(s.label)}</h2><p class="cp-latin"><i lang="la">${esc(latinOf(s))}</i></p></div>`+
    `<span class="cp-art" role="img" aria-label="${cmpArtOf(s.aphiaID)?esc(cmpArtOf(s.aphiaID).alt):esc(s.group)+' 아이콘'}">${cmpArt(s)}</span>`+
    `<button type="button" id="cmp-add" class="cmp-ghost cp-add" aria-pressed="${inBasket}"${full?' aria-disabled="true"':''} aria-describedby="cmp-add-note">${inBasket?'담김 ✓':'+ 비교 담기'}</button>`+
    `<span id="cmp-add-note" class="cp-add-note">${inBasket?'<span class="sr-only">다시 누르면 비교에서 빠집니다</span>':full?'최대 3종까지 담을 수 있습니다':''}</span>`+
    // the plain verdict carries the formal type name for screen readers and on hover (the drawer shows it too)
    `<p class="cp-typeline${t?'':' none'}"${t?` data-type="${t}" title="${esc(matrixTypeLabel(t)+' · '+matrixPlainNote())}"`:''}><i class="cp-shape" aria-hidden="true"></i><b>${esc(matrixTypePlain(t))}</b><span class="sr-only">${t?' ('+esc(matrixTypeLabel(t))+')':''}</span></p></div>`+
    `<section class="cp-use" aria-label="활용가치"><div class="cp-h"><h3>활용가치 <span>BBVI</span></h3>${info('use','활용가치 BBVI')}${badge?`<span class="cp-chip">${esc(badge)}</span>`:''}</div>`+
    `<div class="cp-bigrow">${ev('BBVI','cp-big',num('BBVI'))}${bar('BBVI',rule?.bbvi_threshold)}</div>${officialNote(s)?`<p class="cp-official">탐색 가중치 값 · ${esc(officialNote(s))}</p>`:''}${sub('MFPI','식량 MFPI')}${sub('MBPI','생리활성 MBPI')}</section>`+
    `<section class="cp-con" aria-label="보전 시급성"><div class="cp-h"><h3>보전 시급성 <span>MCUI</span></h3>${info('con','보전 시급성 MCUI')}</div>`+
    `<div class="cp-bigrow">${ev('MCUI','cp-big',num('MCUI'))}${bar('MCUI',rule?.mcui_threshold)}</div>${cat?`<p class="cp-basis">${esc(cat)}</p>`:''}<p class="cp-apart">두 축은 별도로 봅니다.</p></section>`+
    `<div class="cp-actions"><button type="button" id="cmp-open-more" class="cmp-solid" aria-haspopup="dialog" aria-controls="cmp-drawer" aria-describedby="cmp-open-more-note">근거 자세히 보기 <span aria-hidden="true">→</span></button><span id="cmp-open-more-note" class="sr-only">유형·지표 구성·후보 화합물·보전 평가·원문을 엽니다 · 숫자를 누르면 그 지표의 근거</span>`+
    `<p class="cp-links">${ev('OCC','cmp-link','출현 기록 지도')}<span class="cp-dot" aria-hidden="true">·</span><a id="cmp-expedition" class="cmp-link" href="${go?.href||'expedition.html'}"${go?'':' hidden'}>${esc(go?.text||'바다 탐험에서 보기')}</a></p></div>`;
}
// '근거 자세히 보기' drawer: every profile line that is not on the face, then the species' evidence and sources (showDecision).
// One scroll (the body); a modal <dialog> keeps focus inside, Escape and ✕ close it and focus goes back to the opener.
// Selection, search, filter, weight and basket are untouched by opening or closing it.
function renderCompareDrawer(s){
  const box=$('cmp-drawer-axes');if(!box||!s)return;
  const t=matrixType(s), rest=cmpUseRest(s), p=(cls,txt)=>txt?`<p class="${cls}">${esc(txt)}</p>`:'';
  $('cmp-drawer-title').innerHTML=`${esc(s.label)} <i lang="la">${esc(latinOf(s))}</i>`;
  box.innerHTML=`<section class="cdr-sec" id="cdr-type" aria-labelledby="cdr-type-h"><h3 id="cdr-type-h">유형</h3><p class="cdr-type"${t?` data-type="${t}"`:''}><i class="cp-shape" aria-hidden="true"></i><b>${esc(matrixTypePlain(t))}</b> ${t?esc(matrixTypeLabel(t)):''}</p>${p('cdr-note',matrixPlainNote())}</section>`+
    `<section class="cdr-sec" id="cdr-use" aria-labelledby="cdr-use-h"><h3 id="cdr-use-h">활용가치 BBVI · 식량 MFPI · 생리활성 MBPI</h3>${p('cdr-tag','BBVI · '+cmpTag(s,'BBVI'))}${p('cdr-tag','MFPI · '+cmpTag(s,'MFPI'))}${p('cdr-tag','MBPI · '+cmpTag(s,'MBPI'))}`+
      `${officialNote(s)?p('cdr-note',`탐색 가중치(${weightPair()}) 값 · ${officialNote(s)}`):''}${weightSensitivityLine(s)}${cpMbpiKind(s)}${rest?p('cp-rest',rest):''}${cmnpdLine(s)}</section>`+
    `<section class="cdr-sec" id="cdr-con" aria-labelledby="cdr-con-h"><h3 id="cdr-con-h">보전 시급성 MCUI</h3>${p('cp-def',mcuiDefOf(s))}${pilotScore(s,'MCUI')===null?p('cdr-note',axisState(s,'MCUI').label):p('cdr-tag','MCUI '+scoreText(s,'MCUI',pilotScore(s,'MCUI'))+' · '+cmpTag(s,'MCUI'))}${p('cp-aux',mcuiAuxLine(s))}</section>`+
    altProductionBlock(s,true);
}
function cmpMoreSync(){
  const d=$('cmp-drawer');if(!d)return;
  $('cmp-open-more')?.setAttribute('aria-expanded',String(!!d.open));
}
let cmpDrawerFrom=null;
function showCompareMore(focus=true,sec=null,from=null){
  const s=selected, d=$('cmp-drawer');if(!s||!d)return;
  renderCompareDrawer(s);
  showDecision(s);
  cmpDrawerFrom=from||$('cmp-open-more');
  if(!d.open)d.showModal?.();
  cmpMoreSync();
  const body=$('cmp-drawer-body'), target=sec?$(sec):null;
  if(body)body.scrollTop=target?target.offsetTop-body.offsetTop-8:0;
  if(focus){const h=target?.querySelector('h3')||d.querySelector('.cdr-close');if(h&&h.matches('h3'))h.tabIndex=-1;h?.focus({preventScroll:true});}
}
// closing the drawer returns focus to the button that opened it
function closeCompareMore(){
  const d=$('cmp-drawer');if(d?.open)d.close();
}
function onCompareDrawerClosed(){
  cmpMoreSync();
  const back=cmpDrawerFrom&&document.contains(cmpDrawerFrom)?cmpDrawerFrom:$('cmp-open-more');cmpDrawerFrom=null;
  if(currentView==='compare')back?.focus({preventScroll:true});
}
function toggleBasket(id){
  id=Number(id);
  if(cmpBasket.includes(id))cmpBasket=cmpBasket.filter(x=>x!==id);else if(cmpBasket.length<CMP_MAX)cmpBasket=[...cmpBasket,id];else return false;
  renderCompareTray();renderCompareProfile();syncBasketChecks();return true;
}
// the 탐색 후보 checkboxes show the same basket as '비교와 지표'
function syncBasketChecks(){document.querySelectorAll('#species-list [data-basket]').forEach(b=>{b.checked=cmpBasket.includes(Number(b.dataset.basket));});}
// The tray always shows three places: a basket species, or a dashed empty slot. The matrix selection and the basket are
// separate: nothing enters the basket until '+ 비교 담기'.
function renderCompareTray(){
  const box=$('cmp-tray');if(!box||!data)return;
  const list=cmpBasket.map(cmpById).filter(Boolean), ready=list.length>=2;
  box.classList.toggle('empty',!list.length);
  const slots=[...list.map(s=>`<li class="ct-card">${cmpIcon(s)}<span class="ct-name"><b>${esc(s.label)}</b><em lang="la">${esc(latinOf(s))}</em></span><button type="button" class="ct-x" data-basket-remove="${s.aphiaID}" aria-label="${esc(s.label)} 비교에서 빼기">✕</button></li>`),
    ...Array.from({length:CMP_MAX-list.length},()=>`<li class="ct-slot"><button type="button" class="ct-add" data-basket-add>+ 비교 담기로 추가</button></li>`)];
  box.innerHTML=`<h2 class="ct-head">선택한 생물 <span class="ct-count">${list.length} / ${CMP_MAX}</span></h2>`+
    `<button type="button" class="ct-toggle cmp-ghost" aria-expanded="${box.classList.contains('open')}" aria-controls="cmp-tray-list">담은 생물 <b>${list.length}/${CMP_MAX}</b> <span aria-hidden="true">▾</span></button><ul id="cmp-tray-list" class="ct-list">${slots.join('')}</ul>`+
    `<div class="ct-go"><button type="button" id="cmp-compare-go" class="cmp-ghost ct-go-btn" aria-disabled="${!ready}" aria-describedby="cmp-go-note">나란히 비교 <span aria-hidden="true">→</span></button><small id="cmp-go-note" class="sr-only">${ready?'담은 순서대로 나란히 봅니다':'2종 이상 담으면 비교할 수 있습니다'}</small></div>`;
}
// Side-by-side view of the basket. A bar is drawn only where the values share one scale: MFPI within one comparison group,
// MCUI within one assessment basis. Otherwise each value stands with its basis. No total, rank or pick.
function renderCompareDialog(){
  const list=cmpBasket.map(cmpById).filter(Boolean), body=$('cmp-dialog-body');if(!body)return;
  const same=(k,key)=>{const vals=list.filter(s=>pilotScore(s,k)!==null).map(key);return vals.length===list.length&&new Set(vals).size===1;};
  const together={MFPI:same('MFPI',cmpCohort),MBPI:list.every(s=>pilotScore(s,'MBPI')!==null),BBVI:list.every(s=>pilotScore(s,'BBVI')!==null),MCUI:same('MCUI',s=>s.assessment?.mcui_basis||'iucn')};
  const why={MFPI:'비교집단별 값',MCUI:'평가 기반별 값'};
  const cell=(s,k)=>{const st=axisState(s,k), v=pilotScore(s,k);
    return `<td class="cd-val">${v===null?`<span class="cp-state">${esc(st.label)}</span>`:`<b>${scoreText(s,k,v)}</b>${k==='BBVI'&&officialNote(s)?`<small class="cd-official">(${esc(officialNote(s))})</small>`:''}`}${v!==null&&together[k]?`<span class="cp-bar ${k==='MCUI'?'sand':''}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>`:''}<small>${esc(cmpTag(s,k))}</small>${v!==null&&!together[k]&&why[k]?`<small class="cd-no">${why[k]}</small>`:''}</td>`;};
  const row=(k,name,cls='')=>`<tr class="${cls}"><th scope="row">${name}</th>${list.map(s=>cell(s,k)).join('')}</tr>`;
  const text=(name,fn,cls='')=>`<tr class="${cls}"><th scope="row">${name}</th>${list.map(s=>`<td>${fn(s)}</td>`).join('')}</tr>`;
  const go=s=>['MFPI','MBPI','BBVI','MCUI','OCC'].map(k=>`<button type="button" class="cmp-chip" data-dlg-aphia="${s.aphiaID}" data-dlg-axis="${k}">${k==='OCC'?'출현 기록 지도':k}</button>`).join('');
  body.innerHTML=`<p class="cd-note">담은 순서대로 놓았습니다. 막대는 같은 척도의 값끼리 그립니다.</p><div class="cd-scroll"><table class="cd-table"><caption class="sr-only">선택한 생물 ${list.length}종 비교</caption>`+
    `<thead><tr><td></td>${list.map(s=>`<th scope="col">${cmpIcon(s)}<b>${esc(s.label)}</b><em>${esc(latinOf(s))}</em>${matrixType(s)?`<span class="cp-type" style="--tc:${matrixTypeColour[matrixType(s)]}">${esc(matrixTypeLabel(matrixType(s)))}</span>`:''}</th>`).join('')}</tr></thead><tbody>`+
    `<tr class="cd-sec use"><th scope="rowgroup" colspan="${list.length+1}">활용가치</th></tr>`+row('BBVI','활용가치 BBVI','use')+row('MFPI','식량 MFPI','use')+row('MBPI','생리활성 MBPI','use')+
    text('MFPI 비교집단',s=>cmpCohort(s)?esc(cmpCohortLabel(cmpCohort(s)))+' 고정 비교집단':'—','use')+
    `<tr class="cd-sec con"><th scope="rowgroup" colspan="${list.length+1}">보전 시급성</th></tr>`+row('MCUI','보전 시급성 MCUI','con')+
    text('MCUI 평가 기반',s=>pilotScore(s,'MCUI')===null?'—':esc(mcuiBasisLabel(s)),'con')+text('근거 보기',go)+`</tbody></table></div>`;
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
  el.style.setProperty('--w',k/W_STEPS*100+'%');el.style.setProperty('--w0',k0/W_STEPS*100+'%');el.parentElement?.style?.setProperty('--w0',String(k0/W_STEPS));
  // the line under the toolbar: official or exploratory weight (never a full-width banner)
  if($('cmp-wline')){$('cmp-wline').classList.toggle('off',off);$('cmp-wline-name').textContent=off?'탐색 가중치':'공식 가중치';
    $('cmp-wline-text').textContent=off?` · ${weightPair()} · 공식값 ${officialWeight().toFixed(2)}`:` · ${weightPair()}`;const r=$('cmp-wline').querySelector('[data-w-reset]');if(r)r.hidden=!off;}
  $('bbvi-weight-value').textContent=weightPair();
  if($('cmp-w-official'))$('cmp-w-official').textContent=officialWeight().toFixed(2);
  document.querySelectorAll('[data-w-preset]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.wPreset)===k)));
  document.querySelectorAll('[data-w-reset]').forEach(b=>{b.disabled=!off;if(b.id==='cmp-weight-reset')b.textContent=`공식값 ${officialWeight().toFixed(2)}으로`;});
  document.querySelectorAll('.w-badge').forEach(b=>{b.hidden=!off;const t=b.querySelector('.w-badge-text');if(t)t.textContent=`탐색 보기 · 사용자 가중치 ${weightPair()} · 공식 산출값은 ${officialWeight().toFixed(2)}`;});
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
  if(any)$('cmp-legend')?.insertAdjacentHTML?.('beforeend',`<span title="현재 가중치에서 공식값(${officialWeight().toFixed(2)})일 때와 유형이 다른 종"><i class="lg-dot wmove" aria-hidden="true"></i>공식값과 유형이 다른 종<span class="sr-only"> (공식값 ${officialWeight().toFixed(2)} 기준)</span></span>`);
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
const memoKo=t=>t&&(sourceTermsKo[t]||t);
// A source's name and citation stay as published (lang="en" when English); the Korean note sits under them.
const cite=(title,citation)=>{const t=esc(title),c=esc(citation);return `<strong${enAttr(t)}>${escL(title)}</strong><span${enAttr(c)}>${escL(citation)}</span>`;};
function renderSources(){
  const info=data.assessmentInfo;
  $('snapshot-date').textContent=$('snapshot-date').title=`발행 ${data.collectedAt}`+(info?.version?` · 지표 ${methodName(info.version)}${frozenOn(info)?` · ${frozenOn(info)} 동결`:''}${info.generatedAt?' · 산출 '+String(info.generatedAt).slice(0,10):''}`:'');$('collection-note').textContent=data.notes;
  const all=new Map();data.species.forEach(s=>s.sources.forEach(src=>all.set(src.id,src)));
  // Indicator sources (the report's own registry) are cited here too, so a comparison cohort is named on the method tab.
  const report=data.assessmentInfo||{};
  const indicatorSrc=[...new Set(data.species.flatMap(s=>s.assessment?.source_ids||[]))]
    .map(id=>[id,report.sources?.[id]]).filter(([,src])=>src);
  const indicator=indicatorSrc
    .map(([id,src])=>`<div class="citation">${cite(src.title||src.provider||id,src.citation||src.provider||'')}<br>${sourceLink(src.url,'원문 ↗')}${src.license?' · '+orig(memoKo(src.license)):''}<br><span>${[memoKo(src.terms),src.accessed&&src.accessed+' 조회'].filter(Boolean).map(x=>orig(x)).join(' · ')}</span></div>`).join('');
  $('all-sources').innerHTML=data.species.map(s=>`<div class="citation">${cite(s.label+' · 학명',s.wormsCitation)}<br>${sourceLink(s.wormsUrl,'WoRMS 원문 ↗')} · ${sourceLink('https://www.marinespecies.org/about.php','WoRMS 이용조건 · CC BY 텍스트')}</div>`).join('')+Array.from(all.values()).map(s=>`<div class="citation">${cite(s.title,s.citation)}<br>${sourceLink(s.url,'데이터셋 원문 ↗')} · ${sourceLink(s.licenseUrl,s.license)}<br><span>변경: ${esc(s.changes||'종별 건수·기간 요약, 승인학명 연결, 좌표 미공개.')} ${esc(s.accessed||data.collectedAt)} 접근.</span></div>`).join('')+indicator;
  // 2026-10-17 (#9): the list sits in one fold; its title counts the entries
  const nSrc=$('all-sources').querySelectorAll('.citation').length;if($('all-sources-n'))$('all-sources-n').textContent=nSrc?`${nSrc}건`:'';
  sourceParts=nSrc?{indicator:indicatorSrc.length,datasets:all.size,names:data.species.length}:null;renderSourceParts();
}
// 2026-10-19 (LKH, prompt 7/10): under the list's title, what its entries are and how the entry screen's '근거 출처' count
// relates to them. That count is the rows of license-matrix.json that feed an indicator or the map's cells (intro.js
// evidenceSourceCount, the same uses as below): the indicator sources of this list plus the datasets of the map's cells,
// counted once per dataset and licence. Every number is counted here; none is typed in.
const SOURCE_EVIDENCE_USES=['MFPI','MBPI','MCUI','출현 지도 셀'];
let sourceParts=null,licenseRows=null;
function renderSourceParts(){
  const el=$('all-sources-parts');if(!el)return;
  const ev=Array.isArray(licenseRows)?licenseRows.filter(r=>Array.isArray(r?.uses)&&r.uses.some(u=>SOURCE_EVIDENCE_USES.includes(u))):[];
  const cells=ev.filter(r=>r.uses.includes('출현 지도 셀')).length;
  el.textContent=[sourceParts&&`지표 근거 ${sourceParts.indicator}건 · 데이터셋 인용 ${sourceParts.datasets}건 · 종별 학명 ${sourceParts.names}건.`,
    ev.length&&`첫 화면의 근거 출처 ${ev.length}건은 지표 근거 ${ev.length-cells}건과 지도 셀에 쓴 데이터셋 ${cells}건(이용조건별로 셈)입니다.`].filter(Boolean).join(' ');
  el.hidden=!el.textContent;
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
    const list=rows.map(r=>`<li>${r.url?sourceLink(r.url,licenseName(r)):orig(licenseName(r))} · ${r.license_url?sourceLink(r.license_url,r.license):orig(r.license||'이용조건 미기재')}${r.share_alike?' · 동일조건':''} · ${esc(r.uses.join(', '))}</li>`).join('');
    return `<tr data-group="${esc(g)}"><th scope="row"><span class="lic-badge">${esc(m.groups[g].label)}</span><small>${esc(m.groups[g].note)}</small></th>`+
      `<td class="lic-n" data-k="출처">${esc(rows.length)}</td>`+
      `<td data-k="주요 출처">${orig(names.slice(0,6).join(' · '))}${names.length>6?` 외 ${esc(names.length-6)}곳`:''}${rows.length?`<details class="lic-list"><summary>전체 ${esc(rows.length)}건 보기</summary><ul>${list}</ul></details>`:''}</td>`+
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
  const block=(k,key)=>{const b=(ind[k][key]||[]).slice(0,4);return b.length?`<li><b>${esc(AXIS_NAME[k])}</b> ${escL(b.map(x=>`${x.name} ${x.species}종`).join(' · '))}</li>`:'';};
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
    `<ul>${Object.entries(byBasis).sort((a,b)=>b[1].length-a[1].length).map(([basis,xs])=>`<li><b>${esc(basis)}</b> ${esc(xs.length)}건: ${orig(uniq(xs.map(x=>x.title)).slice(0,8).join(' · '))}${xs.length>8?` 외 ${esc(xs.length-8)}건`:''}</li>`).join('')}</ul>`;
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
// 2026-10-17 (#1): the entry screen's three example cards, read from the loaded data: the highest BBVI; the species whose IUCN
// category is EN or CR (newest assessment first, two at most); of the species whose MCUI the KOSIS catch-decline signal
// sets, the one whose catch fell most in tonnes. Names drop a bracketed note ('전복(종 수준)' → '전복').
function gateExamples(){
  const list=data?.species||[],one=s=>({id:s.aphiaID,name:String(s.label||'').replace(/\s*\(.*\)$/,'')});
  const top=list.filter(s=>pilotScore(s,'BBVI')!==null).sort((a,b)=>pilotScore(b,'BBVI')-pilotScore(a,'BBVI'))[0];
  const iucn=s=>s.assessment?.mcui_basis==='iucn'&&pilotScore(s,'MCUI')!==null?s.assessment.conservation_trace:null;
  const red=list.filter(s=>['CR','EN'].includes(iucn(s)?.category)).sort((a,b)=>(iucn(b).assessment_year||0)-(iucn(a).assessment_year||0)).slice(0,2);
  const fell=s=>(s.assessment.stock_decline.baseline_mean_t||0)-(s.assessment.stock_decline.recent_mean_t||0);
  const stock=list.filter(s=>stockMcui(s)&&Number.isFinite(s.assessment.stock_decline?.decline_pct)).sort((a,b)=>fell(b)-fell(a))[0];
  return [top&&{kind:'use',species:[one(top)],value:'BBVI '+scoreText(top,'BBVI',pilotScore(top,'BBVI'))},
    red.length&&{kind:'conservation',species:red.map(one),value:'IUCN '+[...new Set(red.map(s=>iucn(s).category))].join('·')},
    stock&&{kind:'stock',species:[one(stock)],value:'KOSIS '+stockChange(stock.assessment.stock_decline)}].filter(Boolean);
}
const loadDone=state=>loadProgress('done',{state,snapshotAt:data?.snapshotAt||null,published:data?.publishedCount,candidates:data?.candidateCount,
  examples:(()=>{try{return data?gateExamples():[];}catch{return [];}})(),cells:data?[...new Map(data.species.flatMap(s=>s.cells||[]).map(c=>[`${c.lat0},${c.lon0},${c.sizeDeg}`,{lat:c.lat0,lon:c.lon0,size:c.sizeDeg}])).values()]:[]});
// Header status chips: the notice (version · research use) opens its full text; a snapshot or newer-file status gets a
// yellow chip whose popover holds the banner sentence and the reload button. A load with no data keeps the red banner.
// 영어 화면에서는 i18n.js가 이 글자를 영어로 바꿔 두므로 두 말을 다 본다(한국어 화면은 예전과 같다)
const loadFailedText=t=>t==='불러오기 실패'||t===T_('불러오기 실패');
// 2026-10-24 종 영어 일반명(species-names-en.json: WoRMS·FAO에서 확인한 이름만, 지어내지 않음). 검색은 두 언어 모두 한국어명·영어명·학명으로 찾는다.
// 영어 화면의 종 이름은 일반명, 없으면 학명 하나(학명 줄은 비운다). 한국어 화면의 이름·학명 줄은 예전 그대로다.
function speciesNamesEn(list,names){for(const s of list){const n=names?.[s.aphiaID];s.enName=typeof n?.en==='string'&&n.en?n.en:null;s.enNameSource=s.enName?String(n.source||''):'';s.koLabel=s.label;if(LANG==='en')s.label=s.enName||s.name;}}
function updateStatusChips(){
  const err=$('error'),alert=err.classList.contains('in-chip')&&!err.hidden;
  // 2026-10-13 design 2: one chip instead of three header badges (status, team tag, prototype); the popover keeps the full text
  $('notice-chip').classList.toggle('load-failed',!data&&loadFailedText($('connection-state').textContent));
  // 2026-10-15 explore design match: the chip reads '연구 프로토타입'; the version and freeze date sit in its popover
  // (2026-10-19: or the presentation build from release.json, once its commit is filled in)
  $('notice-chip-text').innerHTML=!data?(loadFailedText($('connection-state').textContent)?'자료를 불러오지 못했어요':'자료 불러오는 중'):(data.offline?'오프라인 시연 · ':'')+'연구 프로토타입';
  renderPopVersion();
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
// detail folds (.detail-fold) render open everywhere but on a phone, where the user opens them (2026-10-18, LKH)
const foldOpen=()=>phoneSheet()?'':' open';
function sheetSummary(s){
  const box=$('sheet-summary');if(!box)return;
  const t=matrixType(s), v=k=>{const x=pilotScore(s,k);
    return `<i class="${x===null?'held':''}">${tileLabel(k)}${x===null?'–':scoreChip(s,k,x)}</i>`;};
  const chip=t?`<span class="type-chip" title="${esc(matrixPlainNote())}"><i style="background-color:${matrixTypeColour[t]}" aria-hidden="true"></i>${verdictWord(t)} ${esc(matrixTypeLabel(t))}</span>`:'';
  const scores=['MFPI','MBPI','BBVI','MCUI'].map(v).join('');
  // 2026-10-25 휴대폰: 요약 전체(이름·유형·점수 4칸)가 한 단추다. 누르면 종 상세가 아래에서 올라오는 시트로 열린다(openPhoneSheet).
  // 단추 안에는 문단(p)을 둘 수 없어 같은 class의 span을 쓴다. 넓은 화면은 그대로 문단 두 줄.
  box.innerHTML=phoneSheet()?`<button type="button" class="ss-open" aria-haspopup="dialog" aria-controls="ev-drawer" aria-expanded="${drawerIsOpen()}"><span class="ss-name"><b>${esc(s.label)}</b> ${chip} <span class="ss-more">근거 자세히 보기</span></span><span class="ss-scores card-scores">${scores}</span></button>`
    :`<p class="ss-name"><b>${esc(s.label)}</b> ${chip}</p><p class="ss-scores card-scores">${scores}</p>`;
}
// 2026-10-25 휴대폰 상세 시트: 근거 서랍(#ev-drawer, 넓은 화면에서는 오른쪽 서랍)을 740px 이하에서는 화면 전체를 덮는 시트로 연다.
// 닫으면(✕·닫기·Esc) 시트가 내려가고 목록·지도·스크롤 위치는 연 때 그대로다. 닫기는 closeDrawer()를 같이 쓴다.
function openPhoneSheet(target,from){
  const d=$('ev-drawer');if(!d||!selected||!phoneSheet())return;
  drawerReturn=from||document.activeElement;
  d.classList.add('open');detailOpen=true;d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');syncCtaLabel();
  $('ev-drawer-title').textContent=`${selected.label} · 근거 자세히 보기`;
  const t=drawerTarget(target),body=$('detail');
  for(let x=t?.closest('details');x;x=x.parentElement?.closest('details'))x.open=true;
  body.scrollTop=t&&t!==body?Math.max(0,t.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-8):0;
  d.querySelector('.evd-close')?.focus({preventScroll:true});
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
  $('species-list').textContent='자료를 불러오는 중입니다.';$('detail').textContent='';$('comparison').textContent='';if($('cmp-drawer')?.open)$('cmp-drawer').close();$('cmp-profile').innerHTML='<p class="loading">자료를 불러오는 중입니다.</p>';$('cmp-tray').textContent='';$('matrix-unplaced').textContent='';$('cell-table').textContent='';$('decision-detail').textContent='';$('decision-detail').hidden=true;$('all-sources').textContent='';$('collection-note').textContent='';$('snapshot-date').textContent='';$('species-count').textContent='—';
  for(const id of ['map-count','map-cells','map-years'])$(id).textContent='—';
  $('map-review-note').textContent='자료를 확인하는 중입니다.';$('value-cell-detail').textContent='';$('map-selected').textContent='';$('sheet-summary').textContent='';
  setMapLegend(null);
  $('score-disclaimer').textContent='자료를 불러오는 중입니다.';
  $('map-judgment').textContent='해역별 활용·보전 판단: 입력 확인 중';
  $('map-source').textContent='공개 기준 자료 · 공개 1° 셀';
  try{
    const [next,readiness,traits,outside,literature,searches,cmnpd,scorecard,changelog,aquaTier,namesEn]=await Promise.all([loadPublishedProfiles(),
      ...['matrix-readiness.json','trait-evidence.json','unexplored-candidates.json','supplementary-literature.json','replication-search.json','cmnpd-candidates.json','posthoc-scorecard.json','method-changelog.json','aquaculture-tier.json','species-names-en.json']
        .map(f=>readData(f,FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null))]);
    next.outdated??=[];matrixReadiness=readinessRows(readiness,next.outdated);aquacultureTier=aquacultureTierRows(aquaTier,next.outdated);traitDisplay=traitDisplayRows(traits,next.outdated);supplementaryLit=supplementaryRows(literature,next.outdated);replicationSearch=replicationSearchRows(searches,next.outdated);cmnpdCandidates=cmnpdRows(cmnpd,next.outdated);posthocScorecard=scorecardFile(scorecard,next.outdated);methodChangelog=changelogFile(changelog,next.outdated);
    unexploredOutside=unexploredRows(outside,next.outdated);
    next.readinessAssessmentDate=readiness?.assessments_snapshot||null;next.readinessCandidateDate=readiness?.candidate_snapshot||null;
    if(request!==requestNumber)return;
    await attachPilotAssessments(next);
    speciesNamesEn(next.species,namesEn);
    if(request!==requestNumber)return;
    if(reloadOnceForNewData(next.outdated))return;
    $('score-disclaimer').innerHTML=next.species.some(s=>s.assessment)?'<strong>연구용 산출이며 채집·정책·투자 판단에 바로 사용하지 마세요.</strong> '+(released(next.assessmentInfo)?'지표는 <strong>정식 산출</strong>('+esc(methodName(next.assessmentInfo.version))+')입니다':'일부 종에 <strong>시범 지표</strong>가 있습니다')+validationNote(next.assessmentInfo)+'.':'이 자료에는 활용가치·보전 지표를 <strong>산출하지 않았습니다.</strong> 학명·출현 근거만 봅니다.';
    data=next;
    if(!data.species?.length){$('species-list').textContent='아직 발행된 종이 없습니다.';$('connection-state').textContent='연결됨 · 발행 자료 없음';$('map-review-note').textContent='발행된 자료가 없습니다.';loadDone('empty');return;}
    selected=data.species.find(s=>s.cells?.length)||data.species[0];mapJudgmentStatus(selected);renderUseChips();renderList();renderDetail();renderMap();renderComparison();renderSources();renderTypeTable();renderCompare();if(typeof renderMethodPage==='function')renderMethodPage();
    // Three live states: connected, connected but 0 published (not a failure, no snapshot), unreachable (dated snapshot).
    const counts=`${data.species.length}종`;
    // Offline demo: the snapshot is the plan, not a failure, so its date stays in the status line without the alert.
    $('connection-state').textContent=data.offline?`오프라인 시연 · 저장된 공개 자료 사본 (${data.snapshotAt} 기준) · ${counts}`
      :data.snapshotAt?`연결 실패 · 저장된 사본 사용 (${data.snapshotAt} 기준) · ${counts}`:'공개 기준 자료 연결됨 · '+counts;
    if(data.snapshotAt&&!data.offline){$('error').hidden=false;$('error').textContent=`실시간 자료(운영 DB)를 불러오지 못해 ${data.snapshotAt}에 저장한 공개 자료 사본을 보여 드려요. 그 뒤 발행된 변경은 반영되지 않았어요.`;}
    else if(!data.publishedCount)$('score-disclaimer').innerHTML=`지금 보이는 ${data.candidateCount}종은 공개 데이터 기준 자료입니다.`;
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
  // 영어 화면은 한국어 화면 사전 둘을 받지 않는다(영어 기록은 원문 그대로). 대신 자료 사전(i18n.js가 받는 중)을 첫 그림 전에 기다린다.
  const termsReq=LANG==='en'?null:readData('source-terms-ko.json',FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null); // optional: English notes without it
  const screenReq=LANG==='en'?I18N_DATA_READY:readData('screen-text-ko.json',FRESH_READ).then(r=>r.ok?r.json():null).catch(()=>null); // optional too
  const licReq=fetch('license-matrix.json').then(r=>r.ok?r.json():null).catch(()=>null); // optional: the section stays hidden without it; drawn below once the Korean notes are in
  licReq.then(m=>loadProgress('sources',{license:m})); // the entry screen counts its evidence sources (intro.js, 2026-10-17 #1)
  licReq.then(m=>{licenseRows=Array.isArray(m?.rows)?m.rows:null;renderSourceParts();}); // and the method tab says how that count relates to its list
  fetch('release.json').then(r=>r.ok?r.json():null).then(r=>{releaseInfo=r;renderPopVersion();},()=>{}); // optional: the version stays without it
  const mapReq=readData('countries.json',FRESH_READ);mapReq.catch(()=>{}); // asked for now, used once effort.json is in (they no longer wait for each other)
  try{const r=await readData('effort.json',FRESH_READ);if(r.ok){effortData=await r.json();$('effort-date').textContent=`OBIS · ${effortData.retrieved} 조회`;}}catch{/* optional layer */}
  {const t=await termsReq;if(t?.schema==='source-terms-ko-1'&&t.by_text&&typeof t.by_text==='object')sourceTermsKo=t.by_text;}
  {const t=await screenReq;if(t?.schema==='screen-text-ko-1'&&t.by_text&&typeof t.by_text==='object')screenTextKo=t.by_text;}
  licReq.then(renderLicense); // drawn once the Korean notes are in, so its licence notes read in Korean too
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
globalThis.matchMedia?.('(max-width:740px)').addEventListener?.('change',()=>{map?.invalidateSize();sheetSync();
  if(selected)sheetSummary(selected);if(!phoneSheet()&&!wideLayout())closeDrawer(false);}); // 2026-10-25: 요약 단추·상세 시트는 휴대폰에만
$('sheet-summary').addEventListener('click',e=>{const b=e.target.closest('.ss-open');if(b)openPhoneSheet(null,b);});
// the filter fold, the right panel and the evidence drawer apply from 1180px only: re-sync when the window crosses that line
function syncWide(){
  syncFolds();
  if(!wideLayout())closeDrawer(false);
  syncDrawer();
  // from 1180px the summaries, the cell panel and the cell table under the map move into the '선택 격자' tab (the page never
  // scrolls there); below it they go back under the map
  const below=document.querySelector('.map-below'),home=document.querySelector('#explore .map-pane'),slot=$('sp-cell');
  if(below&&home&&slot){const want=wideLayout()?slot:home;if(below.parentElement!==want)want.append(below);}
  // the 2×2 key sits bottom-left and '모든 종 겹쳐 보기' joins the top-right buttons from 1180px; below it both go back to
  // their earlier homes (the small key under the top-right buttons, the overlay button inside the bottom-left colour key)
  const mini=$('value-mini'),view=$('value-view'),tr=document.querySelector('#explore .map-ui-tr'),bl=document.querySelector('#explore .map-ui-bl'),vkey=$('value-key');
  if(mini&&view&&tr&&bl&&vkey){
    if(wideLayout()){if(mini.parentElement!==bl)bl.insertBefore(mini,vkey);if(view.parentElement!==tr)tr.insertBefore(view,$('copy-link'));}
    else{if(mini.parentElement!==tr)tr.append(mini);if(view.parentElement!==vkey)vkey.append(view);}
  }
  map?.invalidateSize();
}
globalThis.matchMedia?.('(min-width:1180px)').addEventListener?.('change',syncWide);
$('filter-toggle')?.addEventListener('click',()=>{filtersOpen=!filtersOpen;syncFolds();});
syncWide(); // fold the filters before the data arrives, so the list does not jump when it renders
// From 1180px the occurrence key sits under the floating species list, which ends above it whatever the key's height (open,
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
// '검증 기록 보기' (species detail): the method tab at that check's row of fold 04, out of the evidence drawer first
function openChecks(key){
  if(drawerIsOpen())closeDrawer(false);
  setView('method',false);
  const t=(key&&$('mt-ck-'+key))||$('mt-checks');
  requestAnimationFrame(()=>{methodGo(t);t?.classList.add('flash');setTimeout(()=>t?.classList.remove('flash'),1800);});
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-go-checks]');if(!b)return;e.preventDefault();openChecks(b.dataset.goChecks);});
// the citation list fold (#9): a way in that asks for the sources opens it
function openSources(){const f=$('mt-sources-fold');if(f)f.open=true;}
const METHOD_GO={journey:()=>$('mt-journey'),sources:()=>document.querySelector('#method .source-section'),flow:()=>document.querySelector('#method .flow-wrap')};
// footer '출처 목록 참조': opens the method tab at the source list (the licence table left the screen on 2026-10-17)
document.querySelectorAll('[data-foot-go]').forEach(b=>b.addEventListener('click',()=>{setView('method',false);openSources();methodGo(document.querySelector('#method .source-section'));}));
document.querySelectorAll('[data-mt-go]').forEach(b=>b.addEventListener('click',()=>{const t=METHOD_GO[b.dataset.mtGo]?.();if(b.dataset.mtGo==='sources')openSources();methodGo(t);
  if(b.dataset.mtGo==='sources')$('all-sources')?.focus({preventScroll:true});}));
// Research scope number (the species of the loaded collection; '—' until then or after a failure) and the
// four quadrant names from the report's matrix rule. The diagram places no species, points or scores.
function renderMethodPage(){
  renderMethodChangelog();
  const n=v=>Number.isFinite(v)?String(v):'—';
  if($('mt-cmnpd'))$('mt-cmnpd').textContent=cmnpdMethodText();
  renderVerifyBadges();renderPosthocTable();
  $('mt-total').textContent=n(data?.species?.length);
  const rule=matrixRule();if(!rule)return;
  document.querySelectorAll('#method .mt-q').forEach(q=>{const t=rule.types?.[q.dataset.q];if(!t)return;q.dataset.type=t.id;q.querySelector('b').textContent=matrixTypePlain(t.id);q.querySelector('span').textContent=t.label;});
  $('mt-quad-rule').textContent=`각각 ${rule.bbvi_threshold===rule.mcui_threshold?rule.bbvi_threshold:'BBVI '+rule.bbvi_threshold+' · MCUI '+rule.mcui_threshold} 이상이면 높음`;
}
// ---------- 04 방법은 언제, 왜 바뀌었나요? (method change timeline) ----------
// From the ledger, newest day first. Each version shows its summary and a '사전 등록' mark when a pre-registration was
// committed before its code; the reason, when it was decided against its results, the score impact and the records sit in
// its own fold. The ledger keeps who decided; the screen says '방법 결정'.
const CL_TIMING={'결과 확인 전':'결과를 보기 전에 정함','결과 확인 후':'결과를 본 뒤 정함','미확인':'결정 순서를 적은 기록 없음','규칙 변경 없음':'규칙 변경 없음 · 고정 규칙 안의 반영'};
const CL_REPO='https://github.com/gyunghun1214/blue-bio-map/blob/main/';
const clSlug=v=>'mt-cl-'+String(v).replace(/[^a-z0-9]+/gi,'-');
function clImpact(x){
  if(!x)return '직전 버전 보관본이 없어 세지 못함';
  const axes=Object.entries(x.by_axis||{}).filter(([,n])=>n).map(([k,n])=>`${k} ${n}종`).join(' · ');
  return (x.species_changed?`${x.species_changed}종 값 변동${axes?' ('+axes+')':''}`:'값 변동 없음')+
    (x.matrix_type_changed===null||x.matrix_type_changed===undefined?'':` · 유형 변동 ${x.matrix_type_changed}종`)+
    (Number.isInteger(x.matrix_points)?` · 매트릭스 점 ${x.matrix_points}개`:'');
}
function renderMethodChangelog(){
  const box=$('mt-changelog');if(!box)return;
  const L=methodChangelog;
  if(!L){box.innerHTML=`<p class="fine">${data?'변경 기록 파일(method-changelog.json)을 읽지 못했습니다. 기록은 저장소의 research/method-changelog.json에 있습니다.':'자료를 불러오는 중입니다.'}</p>`;return;}
  const c=L.constants||{},still=['mfpi_weights','bbvi_default_food_weight','matrix_thresholds'].every(k=>c[k]&&!c[k].changed_in?.length);
  const doc=path=>`<a href="${esc(CL_REPO+path)}" target="_blank" rel="noopener">${esc(path.split('/').pop())}</a>`;
  const item=e=>`<li class="mt-cl-item" id="${clSlug(e.method_version)}" data-decision="${esc(e.decision_date||'')}" data-published="${esc(e.published_on)}">`+
    `<p class="mt-cl-head"><b>${esc(e.method_version.replace('verified-',''))}</b><span class="mt-cl-kind">${esc(e.kind)}</span>${e.preregistration?'<span class="mt-cl-pre">사전 등록</span>':''}</p>`+
    `<p class="mt-cl-sum">${esc(e.summary)}</p>`+
    `<details class="mt-cl-more"><summary>이유 · 결정 · 점수 영향</summary><dl>`+
    `<dt>이유</dt><dd>${esc(e.reason)}</dd>`+
    `<dt>결정</dt><dd>${esc(e.decided_by)}${e.decision_date?' · '+esc(e.decision_date):''}</dd>`+
    `<dt>결정 시점</dt><dd>${esc(CL_TIMING[e.timing]||e.timing)} · ${esc(e.timing_basis)}</dd>`+
    `<dt>점수 영향</dt><dd>${esc(clImpact(e.score_impact))}${e.compared_with?` <small>(${esc(e.compared_with.replace('verified-',''))}와 비교)</small>`:''}</dd>`+
    `<dt>기록</dt><dd>${[e.preregistration?'사전 등록 '+doc(e.preregistration):'',...(e.records||[]).map(doc)].filter(Boolean).join(' · ')||'—'}</dd>`+
    `</dl></details></li>`;
  const days=new Map();
  for(const e of [...L.entries].reverse()){if(!days.has(e.published_on))days.set(e.published_on,[]);days.get(e.published_on).push(e);}
  const n=L.counts||{};
  box.innerHTML=`<div class="mt-cl-top"><p class="mt-cl-now">지금 버전 <b>${esc(L.current?.label||'')}</b></p><p class="fine">${esc(L.current?.note||'')}</p>`+
    `<ul class="mt-cl-facts"><li><b>${esc(n.versions)}</b>공개한 방법 버전</li><li><b>${esc(n.rule_changed)}</b>규칙·판단이 바뀐 버전</li><li><b>${esc(n.preregistered)}</b>사전 등록을 거친 변경</li>`+
    `<li><b>${still?0:'—'}</b>가중치·구분선 변경</li></ul>`+
    `<p class="fine">${still?`가중치(MFPI ${esc(c.mfpi_weights.value.join('·'))}, BBVI ${esc(c.bbvi_default_food_weight.value.toFixed(1))})와 구분선 ${esc(c.matrix_thresholds.value[0])}은 처음 정한 값 그대로입니다. `:''}`+
    `‘사전 등록’은 그 버전의 규칙을 코드와 값보다 먼저 단독 커밋으로 남긴 변경입니다. 결정 시점은 기록에 적힌 대로이며, 원장 전체는 ${doc('research/method-changelog.json')}에 있습니다.</p></div>`+
    `<ol class="mt-cl-days">${[...days].map(([d,es])=>`<li class="mt-cl-day"><p class="mt-cl-date"><time datetime="${esc(d)}">${esc(d)}</time><small>${es.length}개 버전</small></p><ol class="mt-cl-list">${es.map(item).join('')}</ol></li>`).join('')}</ol>`;
}
// '방법 결정' anywhere on the page opens fold 04 at that decision date. Text from the records arrives through many renderers,
// so the words are turned into buttons where they land (never inside a button, link, summary or the timeline itself).
const DECISION_WORD=/(?:(\d{4}-\d{2}-\d{2}) )?방법 결정(?: (\d{4}-\d{2}-\d{2})|\((\d{4}-\d{2}-\d{2})\))?/g;
function linkDecisions(root){
  // 2026-10-17: the change timeline left the method tab, so the words stay plain text
  if(!root||typeof document==='undefined'||!document.getElementById('mt-changelog'))return;
  const skip='button,a,summary,option,textarea,script,style,title,svg,.mt-changelog,.status-pop,.bbc-panel';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.includes('방법 결정')&&!n.parentElement?.closest(skip)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const text=node.nodeValue,frag=document.createDocumentFragment();let last=0;
    for(const m of text.matchAll(DECISION_WORD)){
      frag.append(text.slice(last,m.index));
      const b=document.createElement('button');b.type='button';b.className='md-link';b.textContent=m[0];
      b.dataset.decision=m[1]||m[2]||m[3]||'';b.title='방법 변경 기록에서 이 결정 보기';frag.append(b);last=m.index+m[0].length;
    }
    frag.append(text.slice(last));node.replaceWith(frag);
  }
}
function openChangelog(date){
  setView('method',false);
  const fold=$('mt-acc-04');if(fold)fold.open=true;
  const items=[...document.querySelectorAll('#mt-changelog .mt-cl-item')];
  const hits=date?items.filter(i=>i.dataset.decision===date):[];
  const target=hits[0]||(date&&items.find(i=>i.dataset.published===date))||fold;
  requestAnimationFrame(()=>{methodGo(target);for(const t of hits.length?hits:[target]){t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1800);}});
}
if(typeof document!=='undefined'&&globalThis.MutationObserver){
  new MutationObserver(list=>{for(const r of list)for(const n of r.addedNodes)linkDecisions(n.nodeType===1?n:n.parentNode);}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const b=e.target.closest?.('.md-link');if(!b)return;e.preventDefault();openChangelog(b.dataset.decision);});
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
for(const id of ['species-group'])$(id).addEventListener('change',()=>{if(data)renderList();});
let comparisonFrame=0;const queueComparisonSync=()=>{if(data&&!comparisonFrame)comparisonFrame=requestAnimationFrame(()=>{comparisonFrame=0;syncComparison();});};
$('comparison').addEventListener('scroll',queueComparisonSync,{passive:true});addEventListener('resize',queueComparisonSync);
$('effort-toggle').addEventListener('change',e=>{effortOn=e.target.checked;drawEffort();});
// 2026-10-18 (LKH, 휴대폰): phones start with the map legend folded to a '범례' pill and the map notes closed, so the map and the
// species sheet get the first screen; both open with a tap as before. Decided once at load (not on resize).
if(phoneSheet()){
  const t=$('legend-toggle');if(t){t.parentElement.classList.add('legend-collapsed');t.setAttribute('aria-expanded','false');t.title=t.ariaLabel='범례 펼치기';}
  document.querySelectorAll('details.map-notes[open]').forEach(d=>{d.open=false;});
}
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
for(const [id,layer] of [['layer-unexplored','unexplored']])$(id).addEventListener('change',e=>{sufficiencyLayers[layer]=e.target.checked;if(data&&mapMode==='value')renderMap();});
$('copy-link').addEventListener('click',()=>{writeHash();const done=m=>{$('basemap-status').classList.remove('fallback');$('basemap-status').textContent=m;};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(()=>done('현재 화면 링크를 복사했습니다.'),()=>done('주소창의 링크를 복사하세요.'));else done('주소창의 링크를 복사하세요.');});$('reset-map').addEventListener('click',fitMap);$('go-compare').addEventListener('click',()=>{setView('compare');if(cmpBasket.length>=2)openCompareDialog();});$('simulate').addEventListener('click',()=>toggleSimulation(!simulated));
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
document.addEventListener('click',e=>{if(!$('cmp-basis-pop').hidden&&!e.target.closest('.cmp-weight'))setBasisPop(false);});
$('cmp-read-toggle').addEventListener('click',()=>setReadPop($('cmp-read-pop').hidden));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cmp-read-pop').hidden){setReadPop(false);$('cmp-read-toggle').focus();}});
document.addEventListener('click',e=>{if(!$('cmp-read-pop').hidden&&!e.target.closest('.cmp-read'))setReadPop(false);});
// the group list: a row picks the species (it leaves the box and gets its label), then focus goes to its point
$('matrix-cluster-pop').addEventListener('click',e=>{const b=e.target.closest('button[data-aphia]');if(!b)return;pickCompare(Number(b.dataset.aphia));
  $('matrix-points').querySelector('.matrix-point[aria-current="true"]')?.focus({preventScroll:true});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('matrix-cluster-pop').hidden)closeClusterPop(true);});
document.addEventListener('click',e=>{if(!$('matrix-cluster-pop').hidden&&!e.target.closest('#matrix-cluster-pop,.matrix-cluster-btn'))closeClusterPop(false);});
// one listener per region: the profile and the tray redraw their buttons
// '정밀 좌표 이용 신청': explains the planned procedure only; no form, nothing is sent or stored
let coordReturn=null;
for(const id of ['detail','side-panel'])$(id)?.addEventListener('click',e=>{const b=e.target.closest('[data-coord-request]');if(b){coordReturn=b;openCoordDialog();}});
$('coord-dialog')?.addEventListener('click',e=>{const d=$('coord-dialog');if(e.target===d||e.target.closest('.coord-close')){d.close();(coordReturn&&document.contains(coordReturn)&&coordReturn.offsetParent?coordReturn:document.querySelector('#detail [data-coord-request]'))?.focus();}});
// ---- right panel (from 1180px): tabs, ⓘ notes, the evidence drawer ----
function setSideTab(tab,focus=false){
  const cell=tab==='cell';
  for(const [id,on] of [['sp-tab-species',!cell],['sp-tab-cell',cell]]){const b=$(id);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  $('sp-species').hidden=cell;$('sp-cell').hidden=!cell;$('side-panel').dataset.tab=cell?'cell':'species';
  if(focus)$(cell?'sp-tab-cell':'sp-tab-species').focus();
}
$('sp-tab-species')?.addEventListener('click',()=>setSideTab('species'));
$('sp-tab-cell')?.addEventListener('click',()=>setSideTab('cell'));
document.querySelector('#side-panel .sp-tabs')?.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setSideTab(e.key==='ArrowRight'||e.key==='End'?'cell':'species',true);}});
$('side-panel')?.addEventListener('click',e=>{
  const i=e.target.closest('.sp-info');
  if(i){const pop=$(i.getAttribute('aria-controls')),open=i.getAttribute('aria-expanded')!=='true';closeSpPops(i);i.setAttribute('aria-expanded',String(open));pop.hidden=!open;return;}
  if(!e.target.closest('.sp-pop'))closeSpPops();
  if(e.target.closest('#sp-cta'))openDrawer(null,$('sp-cta'));
});
document.addEventListener('click',e=>{if(!e.target.closest?.('#side-panel'))closeSpPops();});
$('ev-drawer')?.addEventListener('click',e=>{
  if(e.target.closest('.evd-close,.evd-done'))closeDrawer();
  else if(e.target.closest('.evd-compare')){closeDrawer(false);openEvidenceCompare();}
});
// Escape closes the topmost layer: an ⓘ note, then the drawer; Tab stays inside the open drawer (focus trap)
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const open=document.querySelector('#side-panel .sp-info[aria-expanded=true]');
    if(open){closeSpPops();open.focus();return;}
    if(drawerIsOpen()&&!document.querySelector('dialog[open]')){closeDrawer();}
    return;}
  if(e.key!=='Tab'||!drawerIsOpen()||!(wideLayout()||phoneSheet()))return; // 2026-10-25: 휴대폰 상세 시트도 Tab이 시트 안에 머문다
  const d=$('ev-drawer'),f=[...d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,summary,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null||x===document.activeElement);
  if(!f.length)return;const first=f[0],last=f.at(-1);
  if(!d.contains(document.activeElement)){e.preventDefault();first.focus();}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
// '비교와 지표에서 보기': the compare tab with this species picked (its profile shows the same values)
function openEvidenceCompare(){if(!selected)return;setView('compare');if(typeof pickCompare==='function')pickCompare(selected.aphiaID);}
$('cmp-profile').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!selected)return;
  if(b.id==='cmp-add'){if(!toggleBasket(selected.aphiaID))$('cmp-add-note').textContent='최대 3종까지 담을 수 있습니다. 아래에서 한 종을 빼 주세요.';else $('cmp-add').focus();return;}
  if(b.id==='cmp-open-more'){showCompareMore(true,null,b);return;}
  if(b.dataset.drawerSec){showCompareMore(true,'cdr-'+b.dataset.drawerSec,b);return;}
  if(b.dataset.profAxis)openEvidence(selected.aphiaID,b.dataset.profAxis,`#cmp-profile [data-prof-axis="${b.dataset.profAxis}"]${b.classList.contains('cp-sub-num')?'.cp-sub-num':b.classList.contains('cp-sub-name')?'.cp-sub-name':''}`);
});
$('cmp-tray').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.basketRemove){const i=cmpBasket.indexOf(Number(b.dataset.basketRemove));toggleBasket(b.dataset.basketRemove);
    ($('cmp-tray').querySelectorAll('.ct-x')[Math.min(i,cmpBasket.length-1)]||$('cmp-tray').querySelector('.ct-add')||$('cmp-add'))?.focus();return;}
  if(b.hasAttribute('data-basket-add')){if(selected&&!cmpBasket.includes(selected.aphiaID)){toggleBasket(selected.aphiaID);$('cmp-tray').querySelector('.ct-add,.ct-x')?.focus();}else $('cmp-search').focus();return;}
  if(b.classList.contains('ct-toggle')){const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));$('cmp-tray').classList.toggle('open',open);return;}
  if(b.id==='cmp-compare-go'&&!openCompareDialog()){const n=$('cmp-go-note');n.textContent='2종 이상 담으면 비교할 수 있습니다. 프로필의 ‘+ 비교 담기’를 눌러 주세요.';n.classList.remove('sr-only');}
});
$('cmp-dialog').querySelector('.cmp-dialog-close').addEventListener('click',()=>$('cmp-dialog').close());
$('cmp-drawer').querySelector('.cdr-close').addEventListener('click',closeCompareMore);
$('cmp-drawer').addEventListener('click',e=>{if(e.target===$('cmp-drawer'))closeCompareMore();}); // the backdrop
$('cmp-drawer').addEventListener('close',onCompareDrawerClosed);
// the type cards: '외 N종' opens the rest of the names in place; '더 보기' shows that type in the data table
$('matrix-types').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.aphia){pickCompare(Number(b.dataset.aphia));return;}
  if(b.dataset.mtMore){const c=b.closest('.mt-card'),open=b.getAttribute('aria-expanded')!=='true';c.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));b.textContent=open?'접기':b.dataset.mtMore;mtOpen[open?'add':'delete'](c.dataset.type);return;}
  if(b.dataset.mtTable){setCompareMode('table');setCompareFilter({type:b.dataset.mtTable});$('cmp-table-view').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}});
$('cmp-dialog').addEventListener('click',e=>{if(e.target===$('cmp-dialog'))$('cmp-dialog').close();}); // the backdrop
$('cmp-dialog').addEventListener('close',()=>{if(currentView==='compare')$('cmp-compare-go')?.focus();});
// a row's species name in the table picks it too (the value buttons keep opening their evidence)
$('comparison').addEventListener('click',e=>{const th=e.target.closest('tbody tr.cmp-row th');if(th)pickCompare(Number(th.parentElement.dataset.aphia));});
start();
