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
  // Reviewed candidate cells (scripts/build_expansion_cells.py). An entry failing any identity, grid, licence
  // or citation check releases no cells for that species (fail closed); the other species stay available.
  const asSource=(x,changes,accessed)=>({id:x.id||x.url,title:x.title,url:x.url,citation:`${x.title}. ${x.source==='OBIS'?'OBIS':'GBIF.org'}를 통해 접근.`,
    licenseUrl:licenseUrl[x.licenses?.[0]],license:(x.licenses||[]).join(' · '),changes,accessed});
  const openLicences=l=>Array.isArray(l)&&l.length>0&&l.every(x=>licenseUrl[x]);
  const validCell=(c,size)=>c.sizeDeg===size&&Number.isInteger(c.lat0/size)&&Number.isInteger(c.lon0/size)
    &&c.lat0+size>33&&c.lat0<=38.7&&c.lon0+size>124&&c.lon0<=132
    &&Number.isSafeInteger(c.sites)&&c.sites>=1&&Number.isSafeInteger(c.records)&&c.records>=c.sites
    &&Number.isSafeInteger(c.yearStart)&&Number.isSafeInteger(c.yearEnd)&&c.yearStart<=c.yearEnd&&c.historical===(c.yearEnd<2000)
    &&typeof c.outsideKoreanEEZ==='boolean'&&typeof c.period==='string'&&Array.isArray(c.seaAreas)&&openLicences(c.licenses)
    &&Array.isArray(c.citations)&&c.citations.length>0
    &&c.citations.every(x=>/^https:\/\/(www\.gbif\.org|obis\.org)\/dataset\/[\w-]+$/.test(x.url)&&openLicences(x.licenses));
  let releaseById=new Map();
  try{
    const res=await fetch('expansion-public-cells.json',{cache:'no-store'});
    if(res.ok){
      const release=await res.json(), names=new Map(candidateRows.map(c=>[c.aphiaID,c.name]));
      if(release.schemaVersion==='candidate-public-cells-2'&&Array.isArray(release.species)
         &&new Set(release.species.map(e=>e.aphiaID)).size===release.species.length)
        releaseById=new Map(release.species.filter(e=>names.get(e.aphiaID)===e.name&&[1,4].includes(e.sizeDeg)
          &&Array.isArray(e.cells)&&e.cells.every(c=>validCell(c,e.sizeDeg))
          &&e.review?.status===(e.cells.length?'cells_published':'no_eligible_records')
          &&e.review.accepted===e.cells.reduce((a,c)=>a+c.records,0))
          .map(e=>[e.aphiaID,{...e,reviewedOn:release.reviewedOn}]));
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
          .map(x=>asSource(x,'공개 기준을 통과한 기록만 1° 셀로 집계. 원좌표·레코드 ID 미공개.',info.map?.retrieved))],
      cells:cellsOf(p.species_id),
      wormsUrl:taxonomy?.url,wormsCitation:taxonomy?.citation||'학명 출처 확인 필요',
      v2,noOccurrences,
      publishedAt:p.published_at,status:cellsOf(p.species_id).length?`공개 ${cellsOf(p.species_id)[0].sizeDeg}° 셀`:'조사 범위 표시',scores:null};
  });
  const existing=new Set(species.map(s=>s.aphiaID));
  for(const c of candidateRows){
    if(existing.has(c.aphiaID))continue;
    existing.add(c.aphiaID);
    const audit=auditById.get(c.aphiaID), entry=releaseById.get(c.aphiaID), cells=entry?.cells||[];
    const records=cells.reduce((a,x)=>a+x.records,0);
    // Reviewed occurrence cells are not a current distribution, abundance or a verified score.
    const info={summary_version:2,occurrence_status:cells.length?'reviewed_public_cells':entry?'no_eligible_records':'release_unverified',record_count:cells.length?records:null,
      map:cells.length?{source:`${[...new Set(cells.flatMap(x=>x.sources))].join('·')} 검수 기록 · ${[...new Set(cells.flatMap(x=>x.licenses))].join('·')}`}:null,
      conservation:{status:audit?.iucn?.record?.category?'checklist_record':'not_reviewed'},
      nutrition:{status:audit?.nutrition?.foodCode?'candidate_row':'not_collected'},
      compounds:{status:'not_collected'},production:{},
      limitations:entry?'출현 셀은 검수 통과 기록의 집계입니다. 조사 노력·양식/방류 여부(원자료 표시가 없으면 구분 불가)는 보정하지 않았습니다.':'출현 검수 파일을 확인하지 못해 이 종의 셀을 공개하지 않습니다.'};
    species.push({aphiaID:c.aphiaID,label:c.label,name:c.name,group:c.group,live:true,catalog:true,
      reason:c.reason,taxonNote:c.taxonNote,audit,review:entry?.review,sensitivity:entry?.sensitivity,reviewedOn:entry?.reviewedOn,
      recordCount:cells.length?records:null,yearStart:cells.length?Math.min(...cells.map(x=>x.yearStart)):null,yearEnd:cells.length?Math.max(...cells.map(x=>x.yearEnd)):null,cells,
      summary:'종 후보 선정 이유: '+c.reason+'. '+(cells.length?`검수 통과 출현기록 ${records}건을 ${entry.sizeDeg}° 셀로 공개. 현재 분포·개체수 아님.`:entry?'공개 기준을 통과한 출현기록 없음 · 종 부재 아님.':'출현 검수 자료 확인 실패.'),
      info,productionSummary:'식량·생리활성·IUCN 원평가와 지표 검수 전.',
      sources:[...new Map(cells.flatMap(x=>x.citations).map(x=>[x.url,asSource(x,`검수 기준을 통과한 기록만 ${entry.sizeDeg}° 셀로 집계. 원좌표·레코드 ID 미공개.`,entry.reviewedOn)])).values()],
      wormsUrl:c.wormsUrl,wormsCitation:'WoRMS 종 상세 · 학명 검토 '+c.taxonomyReviewedOn,
      v2:true,noOccurrences:false,publishedAt:cells.length?entry.reviewedOn:null,
      status:cells.length?`검수 기록 ${records}건 · 공개 ${entry.sizeDeg}° 셀`:entry?'공개 가능한 기록 없음':'검수 자료 확인 실패',scores:null});
  }
  const withCells=[...releaseById.values()].filter(e=>e.cells.length).length;
  const latest=rows.map(p=>String(p.published_at||'').slice(0,10)).filter(Boolean).sort().pop()||'날짜 미기재';
  // The only place the two groups are counted; status texts read these values and never add them into one "N종 연결".
  const publishedCount=rows.length, candidateCount=species.length-rows.length;
  return {live:true,snapshotAt,species,publishedCount,candidateCount,collectedAt:latest,notes:`운영 발행 ${publishedCount}종과 조사 후보 ${candidateCount}종을 별도로 표시합니다. ${releaseById.size?`조사 후보 ${releaseById.size}종의 GBIF·OBIS 개별 기록을 학명·연도·좌표 품질·중복·이용조건·민감도 기준으로 검수해 ${withCells}종의 통과 기록만 1°(채취 민감 종 4°) 셀로 발행했습니다. 2000년 이전 기록과 한국·북한 EEZ 밖 기록은 따로 표시합니다.`:'조사 후보의 출현 검수 파일을 확인하지 못해 후보 종의 셀을 발행하지 않았습니다.'} 조사 후보 ${candidateCount}종의 신규 지표는 보류입니다. IUCN 체크리스트와 RDA 식품명 후보는 원평가·종 연결 검수 전입니다. 출현 기록 조회 범위는 124–132°E · 33–38.7°N입니다. 추가 수집 자료(OBIS)와 합산하지 않습니다. 기존 공개 해삼은 4°, 다른 기존 공개 셀은 1°이며 원좌표는 공개하지 않습니다. 검증 전 시범 지표는 별도 보고서(assessments.json)에서 불러오며, 산출되지 않은 항목은 0점이 아니라 보류로 표시합니다.`};
}
