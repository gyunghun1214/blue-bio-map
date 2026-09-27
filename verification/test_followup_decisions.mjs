import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const readiness=JSON.parse(fs.readFileSync(new URL('../dist/matrix-readiness.json',import.meta.url),'utf8'));
const report=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.followup=followupDecision;globalThis.setRows=rows=>matrixReadiness=new Map(rows.map(r=>[r.aphia_id,r]));',ctx);
const byId=new Map(report.species.map(s=>[s.aphia_id,s]));
const make=row=>({
  live:true,catalog:row.scope==='expansion_22',aphiaID:row.aphia_id,
  name:row.scientific_name,label:row.korean_name,
  assessment:byId.get(row.aphia_id)
});
ctx.setRows(readiness.species);
assert.equal(readiness.species.length,30);
let scored=0;
for(const row of readiness.species){
  const species=make(row);
  const plan=ctx.followup(species);
  assert.ok(plan,`reviewed row should join: ${row.korean_name}`);
  assert.equal(plan.row.aphia_id,row.aphia_id);
  assert.equal(plan.known.length,['MFPI','MBPI','MCUI'].filter(k=>row.scores[k]!==null).length);
  assert.equal(plan.blocked.includes('BBVI'),row.scores.BBVI===null);
  assert.match(plan.conservation.join(' '),/조사 노력/);
  assert.match(plan.industry,/판정 아님/);
  assert.ok(plan.sourceUrls.every(url=>url.startsWith('https://')));
  if(plan.known.length)scored++;
  assert.equal(ctx.followup({...species,name:'Other species'}),null,'wrong taxon must not attach');
  assert.equal(ctx.followup({...species,aphiaID:999999}),null,'wrong AphiaID must not attach');
  assert.equal(ctx.followup({...species,live:false}),null,'demo never gets operational follow-up');
}
assert.equal(scored,14,'7 MFPI + 1 MBPI + 7 MCUI include one overlapping species');
const oyster=readiness.species.find(r=>r.aphia_id===836033);
assert.equal(ctx.followup({...make(oyster),assessment:{...byId.get(836033),scores:{...byId.get(836033).scores,MFPI:0}}}),null,
  'forged zero or changed published score cannot attach a follow-up row');
const kelp=readiness.species.find(r=>r.aphia_id===371986);
assert.match(ctx.followup(make(kelp)).research.join(' '),/독립 문헌/);
assert.equal(ctx.followup(make(kelp)).known.join(','),'MBPI');
assert.equal(ctx.followup(make(kelp)).blocked.includes('BBVI'),true);
assert.ok(readiness.species.every(r=>r.matrix_eligible===false),'no real matrix point yet');
console.log('PASS: 30 unranked follow-up paths, gate by taxon/scope/score, missing stays missing, no spatial recommendation');
