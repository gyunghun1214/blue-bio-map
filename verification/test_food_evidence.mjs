import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const report=()=>({
  method_version:'pilot-1',status:'provisional_unvalidated',generated_at:'2026-09-24',food_weight:.5,
  sources:{s:{url:'https://example.org/row',license:'test terms',accessed:'2026-09-24'}},
  species:[{aphia_id:123,scientific_name:'Synthetic species',source_ids:['s'],
    scores:{MFPI:60,MBPI:70,MCUI:80,BBVI:65},food_trace:trace()}]
});
function trace(){
  const peer=(id,value,unit)=>({aphia_id:id,value,unit,basis:'100 g edible portion',
    sample_state:'fresh',edible_part:'reviewed',method:'synthetic assay',sample_year:2025,
    sample_region:'synthetic region',grade:'measured',source_id:'s',reviewed:true});
  const nutrient=(value,unit)=>({value,unit,basis:'100 g edible portion',sample_state:'fresh',
    edible_part:'reviewed',sample_year:2025,sample_region:'synthetic region',
    method:'synthetic assay',grade:'measured',source_id:'s',reviewed:true,
    peers:[peer(123,value,unit),peer(124,value+1,unit),peer(125,value+2,unit)]});
  return {schema_version:'food-1',reviewed:true,nutrients:{
    protein_g:nutrient(12,'g'),iron_mg:nutrient(2,'mg'),zinc_mg:nutrient(1,'mg')},
    edible_fraction:{value:.7,method:'synthetic dissection',source_id:'s',reviewed:true},
    aquaculture:{feasible:true,method:'synthetic cultivation',region:'synthetic region',
      assessment_year:2025,limitations:'synthetic constraints',source_id:'s',reviewed:true}};
}
const make=()=>({live:true,species:[{aphiaID:123,name:'Synthetic species',info:{
  nutrition:{status:'available',record_count:999,measured_count:200,calculated_count:799,
    unit_unconfirmed_count:44,basis_assumed_count:80},
  production:{aquaculture_evidence_count:500}},sources:[]}]});
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>report()})};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.attach=attachPilotAssessments;globalThis.score=pilotScore;globalThis.panel=foodEvidencePanel;globalThis.gate=foodTraceValid;',ctx);
vm.runInContext(app.slice(app.indexOf('const count ='),app.indexOf('function renderLiveDetail')),ctx);
let next=make();
await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),60);
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);
const panel=ctx.panel(next.species[0]);
for(const label of ['12 g / 100 g 가식부','2 mg / 100 g 가식부','양식 원자료','2025','test terms','80%'])assert.ok(panel.includes(label),label);
const inventory=vm.runInContext('liveEvidence(data.species[0])',ctx);
assert.match(inventory,/영양 기록 수 · 수집 현황/);
assert.match(inventory,/영양 자료 수집 현황 · 식량가치 아님/);
assert.match(inventory,/종 간 영양 비교값이 아닙니다/);
assert.doesNotMatch(inventory,/영양 성분 값/);

let old=report();delete old.species[0].food_trace;ctx.fetch=async()=>({status:200,ok:true,json:async()=>old});
next=make();await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),null);
assert.equal(ctx.score(next.species[0],'BBVI'),null);
ctx.next=next;vm.runInContext('data=globalThis.next',ctx);
assert.match(ctx.panel(next.species[0]),/MFPI 산출 보류/);
assert.doesNotMatch(ctx.panel(next.species[0]),/12 g \/ 100 g/);
const dried=report();dried.species[0].food_trace.nutrients.protein_g.sample_state='dried';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>dried});next=make();await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),null,'dry samples cannot be silently compared as fresh edible');
const missingTerms=report();missingTerms.sources.s.license='';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>missingTerms});next=make();await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),null);
console.log('PASS: comparable food trace gate, record-count labels, dry sample and source-terms withholding');
