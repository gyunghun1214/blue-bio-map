'use strict';
// Public browser key. RLS and table grants enforce access; no privileged key is used.
const publicApi = {
  url: 'https://mmsyrshjuaxdvegjhpdz.supabase.co',
  key: 'sb_publishable_IubFbkBLgmVelt1MjYndjg_dSAXbvjd'
};
// Saved copy of the same public rows (scripts/snapshot_live.py), used only when the API cannot be reached.
async function loadSnapshot(error) {
  const r=await fetch('live-snapshot.json').catch(()=>null);
  const snap=r?.ok?await r.json().catch(()=>null):null;
  if(!Array.isArray(snap?.profiles)||!Array.isArray(snap?.cells))throw error;
  return {rows:snap.profiles,cellRows:snap.cells,snapshotAt:snap.fetched_at};
}
async function fetchPublishedRows() {
  const columns='species_id,scientific_name,korean_name,aphia_id,summary,production_summary,public_citations,evidence_summary,published_at';
  const response=await fetch(`${publicApi.url}/rest/v1/species_profiles?select=${columns}&order=aphia_id.desc`,{
    headers:{apikey:publicApi.key},cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error('발행 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error('자료 응답 형식을 확인해야 합니다.');
  // Published generalized cells only (no original coordinates exist in the public API).
  const cellColumns='species_id,cell_code,resolution_m,period_start,period_end,year_start,year_end,record_count,site_count,uncertainty_missing_count,sea_areas,countries,citations';
  const cellResponse=await fetch(`${publicApi.url}/rest/v1/species_map_cells?select=${cellColumns}&order=cell_code`,{
    headers:{apikey:publicApi.key},cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  if(!cellResponse.ok)throw new Error('지도 셀을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const cellRows=await cellResponse.json();
  if(!Array.isArray(cellRows))throw new Error('지도 셀 응답 형식을 확인해야 합니다.');
  return {rows,cellRows};
}
async function loadPublishedProfiles() {
  const {rows,cellRows,snapshotAt}=await fetchPublishedRows().catch(loadSnapshot);
  const licenseUrl={'CC0 1.0':'https://creativecommons.org/publicdomain/zero/1.0/','CC BY 4.0':'https://creativecommons.org/licenses/by/4.0/'};
  const cellsOf=id=>cellRows.filter(c=>c.species_id===id).flatMap(c=>{
    const m=/^deg(1|4):N(-?\d+)E(-?\d+):/.exec(c.cell_code);if(!m)return [];
    const citations=Array.isArray(c.citations)?c.citations:[];
    return [{lat0:Number(m[2]),lon0:Number(m[3]),sizeDeg:Number(m[1]),resolutionM:c.resolution_m,yearStart:c.year_start,yearEnd:c.year_end,
      period:`${String(c.period_start).slice(0,4)}–${String(c.period_end).slice(0,4)}`,records:c.record_count,sites:c.site_count,
      uncertaintyMissing:c.uncertainty_missing_count,seaAreas:c.sea_areas?.length?c.sea_areas:['해역명 미확인'],countries:c.countries||[],
      citations,licenses:[...new Set(citations.flatMap(x=>x.licenses||[]))]}];
  });
  // Curated taxonomy-only candidates. They do not imply that a distribution query ran.
  let candidateRows=[];
  try{
    const res=await fetch('candidate-catalog.json',{cache:'no-store'});
    if(res.ok){
      const catalog=await res.json();
      if(catalog.schemaVersion==='candidate-catalog-1'&&Array.isArray(catalog.species)&&catalog.species.length===22
         &&new Set(catalog.species.map(s=>s.aphiaID)).size===22){
        candidateRows=catalog.species.filter(s=>Number.isSafeInteger(s.aphiaID)&&s.aphiaID>0
          &&typeof s.name==='string'&&typeof s.wormsUrl==='string'&&
          s.wormsUrl==='https://www.marinespecies.org/aphia.php?p=taxdetails&id='+s.aphiaID);
      }
    }
  }catch{/* A failed optional catalog does not hide the original published records. */}
  let auditById=new Map();
  try{
    const res=await fetch('expansion-evidence.json',{cache:'no-store'});
    if(res.ok){
      const evidence=await res.json();
      if(evidence.schemaVersion==='expansion-evidence-1'&&Array.isArray(evidence.species)
         &&evidence.species.length===22&&new Set(evidence.species.map(s=>s.aphiaID)).size===22)
        auditById=new Map(evidence.species.map(s=>[s.aphiaID,s]));
    }
  }catch{/* Keep taxonomy catalog available if the independent audit file is unavailable. */}
  let historicalCell=null;
  try{
    const res=await fetch('expansion-public-cells.json',{cache:'no-store'});
    if(res.ok){
      const release=await res.json(), entry=release.species?.[0], cell=entry?.cells?.[0];
      // A narrowly reviewed release. Unknown or malformed public geometry fails closed.
      if(release.schemaVersion==='candidate-public-cells-1'&&release.species.length===1
        &&entry.aphiaID===504357&&entry.name==='Anadara broughtonii'&&entry.cells.length===1
        &&cell.lat0===32&&cell.lon0===128&&cell.sizeDeg===4
        &&cell.yearStart===1930&&cell.yearEnd===1930&&cell.records===1&&cell.sites===1
        &&cell.licenses?.length===1&&cell.licenses[0]==='CC0 1.0'
        &&cell.citations?.length===1&&cell.citations[0].url==='https://www.gbif.org/dataset/44bcde48-ac71-46f2-bf73-24fc3c008b6c')
        historicalCell=cell;
    }
  }catch{/* No candidate geometry is released when the reviewed asset cannot be verified. */}
  const species=rows.map(p=>{
    const info=p.evidence_summary||{};
    const citations=Array.isArray(p.public_citations)?p.public_citations:[];
    const taxonomy=citations.find(c=>c.id==='worms-taxonomy');
    // evidence_summary v2 adds nutrition/compounds/conservation/production; older rows fall back to production_summary.
    const v2=info.summary_version===2;
    const noOccurrences=info.occurrence_status==='not_collected';
    // An absent or malformed count is unknown, not an observed zero.
    const recordCount=Number.isSafeInteger(info.record_count) && info.record_count>=0
      ? info.record_count : null;
    return {aphiaID:Number(p.aphia_id),label:p.korean_name||p.scientific_name,name:p.scientific_name,
      group:({836033:'패류',506159:'패류',494972:'해조류',372119:'해조류',342067:'기타 무척추동물',250680:'기타 무척추동물',241776:'기타 무척추동물',145721:'해조류'})[p.aphia_id]||'기타 무척추동물',live:true,recordCount:noOccurrences?null:recordCount,
      yearStart:info.period_start?Number(info.period_start.slice(0,4)):null,
      yearEnd:info.period_end?Number(info.period_end.slice(0,4)):null,
      summary:p.summary,info,productionSummary:p.production_summary,
      sources:[...citations.filter(c=>c.id!=='worms-taxonomy'),
        ...cellsOf(p.species_id).flatMap(c=>c.citations).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i&&!citations.some(y=>y.id===x.id))
          .map(x=>({id:x.id,title:x.title,url:x.url,citation:`${x.title}. GBIF.org를 통해 접근.`,licenseUrl:licenseUrl[x.licenses?.[0]],
            license:(x.licenses||[]).join(' · '),changes:'공개 기준을 통과한 기록만 1° 셀로 집계. 원좌표·레코드 ID 미공개.',accessed:info.map?.retrieved}))],
      cells:cellsOf(p.species_id),
      wormsUrl:taxonomy?.url,wormsCitation:taxonomy?.citation||'학명 출처 확인 필요',
      v2,noOccurrences,
      publishedAt:p.published_at,status:cellsOf(p.species_id).length?`공개 ${cellsOf(p.species_id)[0].sizeDeg}° 셀`:'조사 범위 표시',scores:null};
  });
  const existing=new Set(species.map(s=>s.aphiaID));
  for(const c of candidateRows){
    if(existing.has(c.aphiaID))continue;
    existing.add(c.aphiaID);
    const audit=auditById.get(c.aphiaID);
    const publicCells=c.aphiaID===504357&&audit&&historicalCell?[historicalCell]:[];
    // A GBIF search result is not a published occurrence cell or a verified score.
    const info={summary_version:2,occurrence_status:publicCells.length?'historical_public_cell':audit?'review_pending':'not_collected',record_count:null,
      map:publicCells.length?{source:'GBIF · CAS Invertebrate Zoology · CC0 1.0 (1930)'}:null,
      conservation:{status:audit?.iucn?.record?.category?'checklist_record':'not_reviewed'},
      nutrition:{status:audit?.nutrition?.foodCode?'candidate_row':'not_collected'},
      compounds:{status:'not_collected'},production:{},
      limitations:audit?'GBIF 기록은 시험 범위에서 조회했지만 공개 좌표·종 식별·민감도 검수가 완료되지 않았습니다. OBIS 종별 조회는 아직 실행하지 않았습니다.':'이 종의 출현·식량·생리활성·IUCN 원자료는 아직 수집·검수하지 않았습니다.'};
    species.push({aphiaID:c.aphiaID,label:c.label,name:c.name,group:c.group,live:true,catalog:true,
      reason:c.reason,taxonNote:c.taxonNote,audit,recordCount:publicCells.length?1:null,yearStart:publicCells.length?1930:null,yearEnd:publicCells.length?1930:null,cells:publicCells,
      summary:'종 후보 선정 이유: '+c.reason+'. '+(publicCells.length?'1930년 일본 연안 역사 표본 한 건만 4°로 공개. 현재 한국 분포 미확인.':'한반도 주변 실제 출현 여부는 미확인.'),
      info,productionSummary:publicCells.length?'1930년 표본 1건의 출현만 공개. 식량·생리활성·IUCN 원평가와 지표 검수 전.':audit?'GBIF 조회·IUCN 체크리스트·RDA 식품명 후보는 원자료 단계이며 공개/지표 검수 전.':'학명 연결만 확인. 출현·식량·생리활성·보전 근거 미수집.',
      sources:publicCells.length?publicCells[0].citations:[],wormsUrl:c.wormsUrl,wormsCitation:'WoRMS 종 상세 · 학명 검토 '+c.taxonomyReviewedOn,
      v2:true,noOccurrences:!audit,publishedAt:publicCells.length?'2026-09-25':null,status:publicCells.length?'역사 표본 1건 · 공개 4° 셀':audit?(audit.gbif.retrievedCount===0?'GBIF 검색 0건 · OBIS 미조회':'출현 조회 · 공개 보류'):'분포 미수집',scores:null});
  }
  const latest=rows.map(p=>String(p.published_at||'').slice(0,10)).filter(Boolean).sort().pop()||'날짜 미기재';
  return {live:true,snapshotAt,species,collectedAt:latest,notes:`운영 DB ${rows.length}종과 분류 검토 후보 ${species.length-rows.length}종을 별도로 표시합니다. 후보 종의 GBIF 기록을 시험 조회했고 ${historicalCell?'피조개 1930년 표본 1건만 4° 역사적 출현 셀로 발행했습니다. 나머지 21종의 분포 공개와':'피조개 표본의 공개 파일 확인 실패로 신규 종의 분포 공개와'} 22종 모두의 신규 지표는 보류입니다. IUCN 체크리스트와 RDA 식품명 후보는 원평가·종 연결 검수 전입니다. 출현 기록 시험 조회 범위는 124–132°E · 33–38.7°N입니다. 추가 수집 자료(OBIS)와 합산하지 않습니다. 기존 공개 해삼은 4°, 다른 기존 공개 셀은 1°이며 원좌표는 공개하지 않습니다. 검증 전 시범 지표는 별도 보고서(assessments.json)에서 불러오며, 산출되지 않은 항목은 0점이 아니라 보류로 표시합니다.`};
}
