import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Evaluate only pure/UI data helpers. The page bootstrap needs a browser.
const code=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('function setView')[0];
const specimen=()=>({live:true,species:[{aphiaID:123, name:'Accepted species',live:true}]});
const report=(name='Accepted species')=>({method_version:'pilot-1',status:'provisional_unvalidated',
  food_weight:.5,generated_at:'2026-09-23',sources:{s:{url:'https://example.org/s',license:'test',accessed:'2026-09-23'}},
  species:[{aphia_id:123,scientific_name:name,source_ids:['s'],scores:{MFPI:50,MBPI:70,MCUI:80,BBVI:60},food_trace:{nutrients:{protein_g:{per_100g_edible:10,grade:'measured',peer_count:3,percentile:50,source_id:'s'}},edible_fraction:.5,edible_fraction_source:'s',aquaculture:true,aquaculture_source:'s'},bioactivity_trace:[{compound_id:'CID:1',stratum:['target-A','binding'],median_pchembl:7,peer_count:3,rank:50,independent_references:1,evidence_factor:.75,reference_ids:['s']}],conservation_trace:{category:'EN',assessment_year:2025,source_id:'s'}}]});
const ctx={fetch:async()=>({status:404,ok:false})};
vm.createContext(ctx);
vm.runInContext(code+';globalThis.attach=attachPilotAssessments;globalThis.pilot=pilotScore;globalThis.assessed=assessedForMatrix;globalThis.blockers=assessmentBlockers;globalThis.showDecision=showDecision',ctx);

let data=specimen();
await ctx.attach(data);
assert.equal(data.species[0].assessment,undefined,'404 must leave the existing evidence visible');

ctx.fetch=async()=>({status:200,ok:true,json:async()=>report('Different species')});
data=specimen();
await ctx.attach(data);
assert.equal(data.species[0].assessment,undefined,'AphiaID alone cannot join another name');

ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});
data=specimen();
await ctx.attach(data);
assert.equal(ctx.pilot(data.species[0],'MCUI'),80);
assert.equal(ctx.pilot(data.species[0],'BBVI'),60);
assert.equal(ctx.assessed(data.species[0]),true);
const nodes=new Map();
ctx.document={getElementById(id){
  if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{toggle(){}},setAttribute(){},addEventListener(){},querySelectorAll(){return []}});
  return nodes.get(id);
}};
vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('function setView')[1].split('let requestNumber')[0].replace(/^/, 'function setView')+';globalThis.renderDetail=renderLiveDetail;globalThis.renderMatrix=toggleSimulation',ctx);
data.species[0].live=true;
data.species[0].label='시험 종';
data.species[0].info={occurrence_status:'not_collected'};
data.species[0].noOccurrences=true;
data.species[0].sources=[];
data.assessmentInfo={sources:report().sources,foodWeight:.5,generatedAt:'2026-09-23'};
ctx.next=data;
vm.runInContext('data=globalThis.next;renderDetail(data.species[0]);renderMatrix(false)',ctx);
assert.match(nodes.get('detail').innerHTML,/시범 지표 · 타당성 미검증/);
assert.match(nodes.get('detail').innerHTML,/BBVI/);
assert.match(nodes.get('matrix-points').innerHTML,/시범 활용 지표 60, 보전 지표 80/);
ctx.showDecision(data.species[0]);
assert.match(nodes.get('decision-detail').innerHTML,/가식부 100 g당 10 g/);
assert.match(nodes.get('decision-detail').innerHTML,/중앙 pChEMBL 7/);
assert.match(nodes.get('decision-detail').innerHTML,/평가 2025/);
assert.match(nodes.get('decision-detail').innerHTML,/https:\/\/example.org\/s/);

const invalid=report(); invalid.species[0].scores.BBVI=150;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>invalid});
data=specimen();
await ctx.attach(data);
assert.equal(data.species[0].assessment,undefined,'invalid scores cannot be shown');
assert.equal(ctx.assessed(data.species[0]),false);
assert.match(ctx.blockers(data.species[0]).MBPI,/화합물–정량 시험 연결 미확인/);
const orphan=report(); delete orphan.species[0].food_trace;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>orphan});
data=specimen(); await ctx.attach(data);
assert.equal(data.species[0].assessment,undefined,'A score without its component evidence must be withheld');
console.log('PASS: optional report, taxonomy join, independent axes, invalid score guard');
