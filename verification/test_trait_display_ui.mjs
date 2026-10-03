// Drug-use chips (team-lead decision 2026-10-03): adopted MBPI items first, then display-only literature values from
// dist/trait-evidence.json, always labelled as outside every score. 내성균 counts adopted AMP rows on resistant strains.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), traits=JSON.parse(read('trait-evidence.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';'+app.slice(app.indexOf('// ---------- 활용 특성으로 찾기'),app.indexOf('function traitChip'))+
  ';globalThis.ue=useEvidence;globalThis.count=useCount;globalThis.only=displayOnly;globalThis.rows=traitDisplayRows;'+
  'globalThis.setData=d=>{data=d};globalThis.setTraits=f=>{traitDisplay=traitDisplayRows(f,[])};',ctx);
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
assert.equal(ctx.count('fungus'),0);assert.equal(ctx.count('pain'),0);
for(const id of ['antioxidant','diabetes']){
  assert.ok(ctx.only(id),id+' is display-only');
  for(const s of species){const e=ctx.ue(s,id);if(e){assert.equal(e.score,null);assert.match(e.text,/표시 전용, 점수 미반영/);assert.match(e.text,/doi 10\./);}}
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
console.log('PASS: trait chips: 내성균 from adopted MRSA rows; 항산화·항당뇨 from labelled display-only rows; adopted first; schema gate');
