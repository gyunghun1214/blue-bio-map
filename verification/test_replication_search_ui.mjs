// prereg-replication-search-2026-10-15 6: the replication search record (dist/replication-search.json) is one line in the
// folded MBPI detail: searched with no independent replication (date, sources), the current top item not yet searched, or no
// record. It is read by no score, matrix, map colour, chip, card or species profile. Schema gate as for the other display files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('replication-search.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.rows=replicationSearchRows;globalThis.text=replicationSearchText;globalThis.block=evidenceProfileBlock;'+
  'globalThis.profile=cpEvidence;'+
  'globalThis.setData=d=>{data=d};globalThis.setFile=f=>{replicationSearch=replicationSearchRows(f,[])};'+
  'globalThis.axis=axisState;globalThis.type=matrixType;globalThis.label=bbviLabel;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,label:a.korean_name,name:a.scientific_name,cells:[],
  assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{version:report.method_version,method:report.method,sources:report.sources}});
const by=n=>species.find(s=>s.label.startsWith(n));

// The file: display only, built for the published report, one row per species.
assert.equal(file.schema_version,'replication-search-1');
assert.equal(file.display_only,true);
assert.equal(file.report_version,report.method_version);
assert.equal(file.species.length,species.length);

// Scores, labels and matrix types are the same with no file, with the file and with every row changed.
const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s)].join('|')).join('\n');
ctx.setFile(null);const none=snap();
const cards=species.map(s=>ctx.profile(s)).join('\n');
ctx.setFile(file);assert.equal(snap(),none);
ctx.setFile({...file,species:file.species.map(r=>({...r,status:'no_record'}))});assert.equal(snap(),none);
// the species profile never carries it (the 탐색 후보 card has no evidence line since 2026-10-15); only the folded MBPI detail does
ctx.setFile(file);assert.equal(species.map(s=>ctx.profile(s)).join('\n'),cards);
assert.equal((app.match(/replicationSearchText\(/g)||[]).length,2);  // defined once, called once (evidenceProfileBlock)
assert.equal((app.match(/replicationSearch\b/g)||[]).length,3);       // declared, loaded, read

// Display per status.
for(const r of file.species){
  const s=species.find(x=>x.aphiaID===r.aphia_id), t=ctx.text(s);
  if(r.status==='replicated'){assert.equal(t,'');continue;}
  if(r.status==='no_record'){assert.equal(t,'재현 검색 기록 없음');continue;}
  if(r.status==='not_current_item'){assert.match(t,/^재현 검색: 현재 최상위 항목 검색 전/);continue;}
  assert.equal(r.status,'searched_none');
  assert.ok(r.sources_searched.length,s.label);
  assert.ok(t.startsWith(`재현 검색: 검색했으나 독립 재현 없음(${r.last_searched_on}, ${r.sources_searched.join(' · ')})`),t);
  for(const u of r.sources_unavailable)assert.ok(t.includes(u),u);
  for(const x of r.runs.filter(x=>x.item_is_current&&x.searched_on!==r.last_searched_on))assert.ok(t.includes(`이전 검색 `)&&t.includes(x.searched_on),t);
  assert.match(ctx.block(s),/<span class="ev-search">재현 검색: /);
}
assert.equal(ctx.text(by('미역')),'');
assert.equal(ctx.text(by('참굴')),'재현 검색: 검색했으나 독립 재현 없음(2026-10-15, PubMed · 웹 검색) · 이전 검색 2026-10-13 · 열지 못한 검색원 Europe PMC · KCI');
// 넙치: the 2026-10-13 run searched MEVFVP, so only the 2026-10-15 search of P35 is the current item's
assert.equal(ctx.text(by('넙치')),'재현 검색: 검색했으나 독립 재현 없음(2026-10-15, PubMed · 웹 검색) · 열지 못한 검색원 Europe PMC · KCI');
// a report outside the verified line shows nothing
const oyster=by('참굴');
assert.equal(ctx.text({...oyster,assessment:{...oyster.assessment,report_version:'pilot-1'}}),'');

// Schema gate: a newer schema is reported and not read, an unknown one is ignored, a file not marked display-only is ignored.
let out=[];assert.equal(ctx.rows({...file,schema_version:'replication-search-2'},out).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'replication-search.json',version:'replication-search-2'}]);
out=[];assert.equal(ctx.rows({...file,schema_version:'other'},out).size,0);assert.equal(out.length,0);
assert.equal(ctx.rows({...file,display_only:false},[]).size,0);
assert.equal(ctx.rows({...file,species:[{...file.species[0],status:'accepted'}]},[]).size,0);
const counts=Object.fromEntries(['searched_none','not_current_item','no_record','replicated'].map(k=>[k,file.species.filter(r=>r.status===k).length]));
console.log(`replication search UI: ${file.species.length} species ${JSON.stringify(counts)}, scores unchanged`);
