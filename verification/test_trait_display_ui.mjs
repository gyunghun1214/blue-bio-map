// Drug-use chips (team-lead decision 2026-10-03): adopted MBPI items first, then display-only literature values from
// dist/trait-evidence.json, always labelled as outside every score. 내성균 counts adopted AMP rows on resistant strains.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), traits=JSON.parse(read('trait-evidence.json')), tier=JSON.parse(read('aquaculture-tier.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';'+app.slice(app.indexOf('// ---------- 활용 특성으로 찾기'),app.indexOf('function traitChip'))+
  ';globalThis.ue=useEvidence;globalThis.count=useCount;globalThis.only=displayOnly;globalThis.rows=traitDisplayRows;'+
  'globalThis.setData=d=>{data=d};globalThis.setTraits=f=>{traitDisplay=traitDisplayRows(f,[])};globalThis.setTier=f=>{aquacultureTier=aquacultureTierRows(f,[])};'+
  'globalThis.tierRows=aquacultureTierRows;globalThis.tierLine=aquacultureTierLine;'+
  'globalThis.traitIds=traitIdsOf;globalThis.stratum=mbpiStratum;globalThis.USE=USE_TRAITS;globalThis.GROUPS=USE_GROUPS;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,name:a.korean_name,assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{method:report.method,sources:report.sources}});
const ids=id=>species.filter(s=>ctx.ue(s,id)).map(s=>s.aphiaID).sort((a,b)=>a-b);

// Without the display file, only adopted evidence counts; 내성균 now reads the adopted Cg-BigDef1 MRSA rows.
ctx.setTraits(null);
assert.deepEqual(ids('resistant'),[836033]);
assert.match(ctx.ue(species.find(s=>s.aphiaID===836033),'resistant').text,/내성 균주 4개 MIC 1\.25–2\.5 uM/);
for(const id of ['fungus','pain','antioxidant','diabetes'])assert.equal(ctx.count(id),0,id);

// With it, 항산화 and 항당뇨 fill from display rows, labelled as not a score; scores are never read from them.
ctx.setTraits(traits);
assert.deepEqual(ids('antioxidant'),[281273,371986]);
assert.deepEqual(ids('diabetes'),[231750,371986]);
// 4.0 (team-lead decision 2026-10-04): 항진균 = 해삼 holotoxin A and 참굴 Cg-Prp (single substances) + 가시파래 ethanol fraction
// (extract); 진통 = 감태 70% ethanol extract. Extract rows say so first.
assert.deepEqual(ids('fungus'),[234476,241776,836033]);
assert.deepEqual(ids('pain'),[371986]);
assert.match(ctx.ue(species.find(s=>s.aphiaID===241776),'fungus').text,/^holotoxin A · Trichophyton rubrum 최소 억제 농도\(시험법 미기재\) MIC 0\.78 µg\/mL · 시험값 8개/);
assert.match(ctx.ue(species.find(s=>s.aphiaID===234476),'fungus').text,/^추출물 · 에탄올 분획 · Candida albicans/);
assert.match(ctx.ue(species.find(s=>s.aphiaID===371986),'pain').text,/^추출물 · 70% 에탄올 추출물 · .*3\.68 g · 시험값 2개/);
assert.ok(!/^추출물/.test(ctx.ue(species.find(s=>s.aphiaID===836033),'fungus').text),'a single peptide is not labelled as an extract');
for(const id of ['antioxidant','diabetes','fungus','pain']){
  assert.ok(ctx.only(id),id+' is display-only');
  // 2026-10-17 (LKH): a display-only row ends ' · 참고 표시' (it never sets a score)
  for(const s of species){const e=ctx.ue(s,id);if(e){assert.equal(e.score,null);assert.match(e.text,/ · 참고 표시$/);assert.match(e.text,/doi 10\./);}}
}
assert.equal(ctx.only('resistant'),false);
assert.match(ctx.ue(species.find(s=>s.aphiaID===371986),'antioxidant').text,/^dieckol · DPPH 라디칼 소거\(ESR\) IC50 8\.28 µM · 시험값 6개/);

// Adopted evidence wins over a display row for the same species and trait.
ctx.setTraits({...traits,records:[...traits.records,{...traits.records[0],aphia_id:836033,trait:'resistant',name:'X'}]});
assert.match(ctx.ue(species.find(s=>s.aphiaID===836033),'resistant').text,/Cg-BigDef1/);

// Schema gate: a newer schema is reported and not read, an unknown one is ignored, bad rows are dropped.
let out=[];assert.equal(ctx.rows({...traits,schema_version:'trait-display-evidence-2'},out).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'trait-evidence.json',version:'trait-display-evidence-2'}]);
out=[];assert.equal(ctx.rows({...traits,schema_version:'other'},out).size,0);assert.equal(out.length,0);
assert.equal(ctx.rows({...traits,records:[{...traits.records[0],relation:'<'}]},[]).size,0);
// 2026-10-12: 혈압(ACE 저해) and 항산화 move to the '기능성(식품 소재)' row. Only the group changes: the array order (traitIdsOf
// takes the first match), ids and rules stay, so every chip keeps its count and old links (u=ace) keep working.
ctx.setTraits(traits);
assert.deepEqual([...ctx.GROUPS],['신약','기능성(식품 소재)','식량']);
assert.deepEqual([...ctx.USE].map(c=>c.id),['ace','virus','dementia','parasite','cancer','microbe','resistant','fungus','pain','antioxidant','diabetes',
  'protein_g','mineral','calcium_mg','iron_mg','zinc_mg','omega3','whole','farmed','farmed_trial']);
assert.deepEqual([...ctx.USE].filter(c=>c.group==='기능성(식품 소재)').map(c=>c.id),['ace','antioxidant']);
assert.ok(ctx.USE.every(c=>ctx.GROUPS.includes(c.group)),'every chip sits in a drawn row');
// 2026-10-15: the farming chips read dist/aquaculture-tier.json (display only). Without it both stay at 0; the MFPI farming
// term never moves (27 species keep 10 points either way).
ctx.setTier(null);
assert.equal(ctx.count('farmed'),0);assert.equal(ctx.count('farmed_trial'),0);
ctx.setTier(tier);
assert.deepEqual(ids('farmed_trial'),[219984,234476,236157,372119,371986,413600,494853,506159,1666974].sort((a,b)=>a-b));
assert.match(ctx.ue(species.find(s=>s.aphiaID===250680),'farmed').text,/^상업 양식 중 · KOSIS 해면양식 '우렁쉥이' 2022~2024년 생산 56,213톤/);
for(const id of [342067,254538,534443]){assert.equal(ctx.ue(species.find(s=>s.aphiaID===id),'farmed'),null);assert.equal(ctx.ue(species.find(s=>s.aphiaID===id),'farmed_trial'),null);
  // 2026-10-17 (LKH): the 'none' tier is worded by what the record holds (a rearing attempt); the file keeps its label
  assert.match(ctx.tierLine(id),/양식 단계<\/b> 사육 시도 · 보고서 양식 기록의 사육 시도 단계/);
  assert.equal(tier.rows.find(r=>r.aphia_id===id).tier_label,'기록 없음');}
assert.equal(species.filter(s=>s.assessment.food_trace.components.aquaculture_contribution===10).length,27,'MFPI farming term unchanged');
assert.match(ctx.tierLine(250680),/href="https:\/\/kosis\.kr\/statHtml\/statHtml\.do\?orgId=101&amp;tblId=DT_1EW0004"[^>]*>KOSIS ↗/);
assert.match(ctx.tierLine(275816),/상업 양식 중 · 국내 상업 넙치 양식장 71곳/);
assert.match(ctx.tierLine(836033),/>FAO 양식종 자료집 ↗/);
let tierOut=[];assert.equal(ctx.tierRows({...tier,schema_version:'aquaculture-tier-2'},tierOut).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(tierOut)),[{file:'aquaculture-tier.json',version:'aquaculture-tier-2'}]);
assert.equal(ctx.tierRows({...tier,display_only:false},[]).size,0);
ctx.setTier(tier);
assert.deepEqual(Object.fromEntries(ctx.USE.map(c=>[c.id,ctx.count(c.id)])),{ace:14,virus:7,dementia:2,parasite:2,cancer:3,microbe:5,resistant:1,fungus:3,
  pain:1,antioxidant:2,diabetes:2,protein_g:16,mineral:11,calcium_mg:3,iron_mg:10,zinc_mg:3,omega3:9,whole:9,farmed:18,farmed_trial:9});
// The MBPI stratum names the top item's comparison group from one dictionary; every published stratum is registered, the
// numbers come from the item, and the ACE names are exactly the top items the 'ace' chip reads.
for(const s of species){
  const a=s.assessment, st=ctx.stratum(a), top=a.bioactivity_trace.reduce((p,x)=>!p||x.adjusted>p.adjusted?x:p,null);
  assert.ok(st&&st.key,`${s.name}: stratum registered`);
  assert.ok(!/ahtpdb|ChEMBL_37|미등록|undefined/.test(st.short+st.long),`${s.name}: ${st.long}`);
  assert.equal(st.ace,ctx.traitIds(top).includes('ace'),`${s.name}: stratum ${st.key} vs chip ${ctx.traitIds(top)}`);
}
const byName=n=>species.find(s=>s.name===n).assessment;
assert.equal(ctx.stratum(byName('미역')).short,'ACE 펩타이드');
assert.match(ctx.stratum(byName('미역')).long,/^ACE 저해 펩타이드\(AHTPDB 352개 안 순위/);
// 4.11 (prereg 3): the 감태 paper's compound cohort is below the 30-compound minimum, so its ChEMBL dieckol item leads
assert.equal(ctx.stratum(byName('감태')).long,'ChEMBL 화합물(같은 표적·같은 종말점 활성 기록 35건 안 순위)');
assert.equal(ctx.stratum(byName('참조기')).short,'잔틴 산화효소 펩타이드');
assert.equal(ctx.stratum(byName('갑오징어')).short,'ChEMBL 표적(펩타이드)');
assert.equal(ctx.stratum(byName('참굴')).short,'ACE 펩타이드');
assert.equal(ctx.stratum(byName('피조개')).short,'항암 펩타이드');
assert.equal(ctx.stratum(byName('멍게')).short,'ChEMBL 화합물');
// 4.13: 넙치's top item is now its P35 MIC, so it leads with the antimicrobial stratum and the 항균 chip instead
assert.equal(species.filter(s=>ctx.stratum(s.assessment).ace).length,13,'13 species lead with an ACE item (all AHTPDB; 감태 left with 4.11, 넙치 with 4.13)');
assert.equal(ctx.stratum(byName('넙치')).short,'항균 펩타이드');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.stratum({bioactivity_trace:[{adjusted:1,stratum_id:'new-stratum',stratum_kind:'new'}],mbpi_stratum:'new'}))),
  {key:null,ace:false,short:'층 이름 미등록',long:'층 이름 미등록'});
assert.equal(ctx.stratum({bioactivity_trace:[]}),null);
console.log('PASS: trait chips: 내성균 from adopted MRSA rows; 항산화·항당뇨·항진균·진통 from labelled display-only rows (extract tier labelled); adopted first; schema gate; 기능성(식품 소재) row keeps ids, order and counts; MBPI strata registered and in step with the ACE chip');
