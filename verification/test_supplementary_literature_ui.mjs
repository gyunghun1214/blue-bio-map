// 4.13 (prereg-4.13-2026-10-14 3-D): '관련 문헌(점수 미사용)' from dist/supplementary-literature.json. The list sits under the
// MBPI section and as a small card line; it is read by no score, matrix, map colour or chip, and its count is never the
// '최상위 근거 독립 재현 확인 중' label (formerly '근거 논문 1편'). Schema gate as for trait-evidence.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), lit=JSON.parse(read('supplementary-literature.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.rows=supplementaryRows;globalThis.line=supplementaryLine;globalThis.litRows=litRows;'+
  'globalThis.setData=d=>{data=d};globalThis.setLit=f=>{supplementaryLit=supplementaryRows(f,[])};'+
  'globalThis.axis=axisState;globalThis.type=matrixType;globalThis.label=bbviLabel;globalThis.RELATION=LIT_RELATION;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,label:a.korean_name,name:a.scientific_name,cells:[],
  assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{version:report.method_version,method:report.method,sources:report.sources}});
const by=n=>species.find(s=>s.label===n);

// The file: schema, a DOI on every row, allowed relations only, and never a paper a score already uses.
assert.equal(lit.schema_version,'supplementary-literature-1');
const scored=new Set(species.flatMap(s=>(s.assessment.bioactivity_trace||[]).flatMap(x=>x.original_paper_dois||[])).map(d=>d.toLowerCase()));
for(const r of lit.records){
  assert.match(r.doi,/^10\.\d{4,9}\/\S+$/,r.doi);
  assert.ok(Object.keys(ctx.RELATION).includes(r.relation),r.relation);
  assert.ok(!scored.has(r.doi.toLowerCase()),r.doi+' is used by a score');
  assert.ok(['full_text','abstract'].includes(r.checked_via),r.doi);
  assert.ok(species.some(s=>s.aphiaID===r.aphia_id),r.doi);
}
// team decision 2026-10-14: a source without a DOI (고등어 YVA, 한국수산학회지 2000) is not listed
assert.ok(!lit.records.some(r=>r.aphia_id===127022&&/YVA/.test(r.finding)));

// Scores, labels and matrix types are the same with no file, with the file and with every row changed.
const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s)].join('|')).join('\n');
ctx.setLit(null);const none=snap();
ctx.setLit(lit);assert.equal(snap(),none);
ctx.setLit({...lit,records:lit.records.map(r=>({...r,relation:'new_quantitative',aphia_id:species[0].aphiaID,finding:'IC50 0.0001 µM'}))});assert.equal(snap(),none);
// the only readers of the map are the list, the card line and the loader
assert.deepEqual([...new Set(app.match(/supplementaryLit\b/g))],['supplementaryLit']);
assert.equal((app.match(/supplementaryLit\b/g)||[]).length,3);

// Display: the list opened under the MBPI section, contrary evidence first, each row with why it is not scored.
// 2026-10-17 (LKH): the list stays in supplementary-literature.json (read and gated as before) and is not drawn.
ctx.setLit(lit);
const withRows=species.filter(s=>ctx.litRows(s).length);
assert.ok(withRows.length>0);
for(const s of withRows)assert.equal(ctx.line(s),'',`${s.label}: the related-paper list is not drawn`);
for(const s of species.filter(s=>!ctx.litRows(s).length)){assert.equal(ctx.line(s),'');}
const ecklonia=by('감태');
assert.equal(ctx.litRows(ecklonia).filter(r=>r.relation==='contrary').length,1,'the contrary row stays read from the file');
assert.equal(ctx.line(ecklonia),'');
// a report outside the verified line shows nothing
assert.equal(ctx.line({...ecklonia,assessment:{...ecklonia.assessment,report_version:'pilot-1'}}),'');

// Schema gate: a newer schema is reported and not read, an unknown one is ignored, bad rows are dropped.
let out=[];assert.equal(ctx.rows({...lit,schema_version:'supplementary-literature-2'},out).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'supplementary-literature.json',version:'supplementary-literature-2'}]);
out=[];assert.equal(ctx.rows({...lit,schema_version:'other'},out).size,0);assert.equal(out.length,0);
assert.equal(ctx.rows({...lit,records:[{...lit.records[0],doi:''}]},[]).size,0);
assert.equal(ctx.rows({...lit,records:[{...lit.records[0],relation:'scored'}]},[]).size,0);
console.log(`supplementary literature UI: ${lit.records.length} records, ${withRows.length} species, scores unchanged`);
