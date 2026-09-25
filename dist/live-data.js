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
    const info={summary_version:2,occurrence_status:'not_collected',record_count:null,
      conservation:{status:'not_reviewed'},nutrition:{status:'not_collected'},
      compounds:{status:'not_collected'},production:{},
      limitations:'이 종의 출현·식량·생리활성·IUCN 원자료는 아직 수집·검수하지 않았습니다.'};
    species.push({aphiaID:c.aphiaID,label:c.label,name:c.name,group:c.group,live:true,catalog:true,
      reason:c.reason,taxonNote:c.taxonNote,recordCount:null,yearStart:null,yearEnd:null,cells:[],
      summary:'종 후보 선정 이유: '+c.reason+'. 한반도 주변 실제 출현 여부는 미확인.',
      info,productionSummary:'학명 연결만 확인. 출현·식량·생리활성·보전 근거 미수집.',
      sources:[],wormsUrl:c.wormsUrl,wormsCitation:'WoRMS 종 상세 · 학명 검토 '+c.taxonomyReviewedOn,
      v2:true,noOccurrences:true,publishedAt:null,status:'분포 미수집',scores:null});
  }
  const latest=rows.map(p=>String(p.published_at||'').slice(0,10)).filter(Boolean).sort().pop()||'날짜 미기재';
  return {live:true,snapshotAt,species,collectedAt:latest,notes:`운영 DB ${rows.length}종과 분류 검토 후보 ${species.length-rows.length}종을 별도로 표시합니다. 후보 종의 분포·영양·보전 근거는 미수집입니다. 출현 기록 시험 조회 범위는 124–132°E · 33–38.7°N입니다. 추가 수집 자료(OBIS)와 합산하지 않습니다. 지도는 공개 기준(CC0·CC BY, OBIS 해안선 규칙)을 통과한 GBIF 기록을 일반화한 셀로 표시합니다. 기존 공개 해삼은 4°, 다른 기존 공개 셀은 1°이며 원좌표는 공개하지 않습니다. 후보 22종은 지도 셀이 없습니다. 검증 전 시범 지표는 별도 보고서(assessments.json)에서 불러오며, 산출되지 않은 항목은 0점이 아니라 보류로 표시합니다.`};
}
