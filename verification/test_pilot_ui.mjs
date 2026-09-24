import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Evaluate only pure/UI data helpers. The page bootstrap needs a browser.
const code=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('function setView')[0];
const specimen=()=>({live:true,species:[{aphiaID:123, name:'Accepted species',live:true}]});
function food1(){
  const peer=(id,value,unit)=>({aphia_id:id,value,unit,basis:'100 g edible portion',sample_state:'fresh',edible_part:'reviewed',
    method:'synthetic assay',sample_year:2025,sample_region:'synthetic region',grade:'measured',source_id:'s',reviewed:true});
  const nutrient=(value,unit)=>({...peer(123,value,unit),percentile:50,peers:[peer(123,value,unit),peer(124,value+1,unit),peer(125,value+2,unit)]});
  return {schema_version:'food-1',reviewed:true,nutrients:{protein_g:nutrient(10,'g'),iron_mg:nutrient(2,'mg'),zinc_mg:nutrient(1,'mg')},
    edible_fraction:{value:.7,method:'synthetic dissection',source_id:'s',reviewed:true},
    aquaculture:{feasible:true,method:'synthetic cultivation',region:'synthetic region',assessment_year:2025,limitations:'synthetic constraints',source_id:'s',reviewed:true}};
}
const report=(name='Accepted species')=>({method_version:'pilot-1',status:'provisional_unvalidated',
  food_weight:.5,generated_at:'2026-09-23',sources:{s:{url:'https://example.org/s',license:'test',accessed:'2026-09-23'}},
  species:[{aphia_id:123,scientific_name:name,source_ids:['s'],scores:{MFPI:50,MBPI:70,MCUI:80,BBVI:60},food_trace:food1(),bioactivity_trace:[{compound_id:'CID:1',stratum:['target-A','binding'],median_pchembl:7,peer_count:3,rank:50,independent_references:1,evidence_factor:.75,reference_ids:['s']}],conservation_trace:{category:'EN',assessment_year:2025,source_id:'s',current_status_verified:true,current_status_source_id:'s',current_status_checked_on:'2026-09-23'}}]});
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
// PR #11: a bare MFPI with an old-format (non food-1) trace is withheld with BBVI; MCUI stays.
{const legacyFood=report();legacyFood.species[0].food_trace={nutrients:{protein_g:{per_100g_edible:10}}};
ctx.fetch=async()=>({status:200,ok:true,json:async()=>legacyFood});
const d=specimen();await ctx.attach(d);
assert.equal(ctx.pilot(d.species[0],'MFPI'),null,'a bare MFPI number without food trace is withheld');
assert.equal(ctx.pilot(d.species[0],'BBVI'),null,'BBVI depends on withheld MFPI');
assert.equal(ctx.pilot(d.species[0],'MCUI'),80);
ctx.fetch=async()=>({status:200,ok:true,json:async()=>report()});}
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
// PR #11 rule: a food score without its component trace is withheld (with BBVI); the other reviewed axes stay.
assert.equal(ctx.pilot(data.species[0],'MFPI'),null,'A food score without its component evidence must be withheld');
assert.equal(ctx.pilot(data.species[0],'BBVI'),null);
assert.equal(ctx.pilot(data.species[0],'MBPI'),70);
assert.equal(data.species[0].assessment.food_withheld,true);
// The sea cucumber's 2013 IUCN EN is shown as a historical assessment, never as a current status or MCUI input.
const cucumber={aphiaID:241776,name:'Apostichopus japonicus',label:'해삼',live:true,info:{conservation:{status:'withheld_insufficient_evidence'}}};
assert.match(ctx.blockers(cucumber).MCUI,/EN A2bd: 2013년 발표\(2010-05-19 평가\)/);
assert.match(ctx.blockers(cucumber).MCUI,/역사적 평가이며 2026-1판으로 대체됐습니다/);
assert.match(ctx.blockers(cucumber).MCUI,/MCUI 입력으로 쓰지 않음/);
ctx.data={species:[cucumber]};vm.runInContext('data=globalThis.data',ctx);
ctx.showDecision(cucumber);
assert.match(nodes.get('decision-detail').innerHTML,/MCUI: 산출 보류/);
assert.match(nodes.get('decision-detail').innerHTML,/IUCN 원평가 · 역사적 평가/);
assert.match(nodes.get('decision-detail').innerHTML,/iucnredlist\.org\/species\/180424/);
// A report without a sourced current-status check (older format) must not show MCUI,
// yet the reviewed value axis stays visible and the species stays off the matrix.
const legacy=report(); delete legacy.species[0].conservation_trace.current_status_verified;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>legacy});
data=specimen(); await ctx.attach(data);
assert.equal(ctx.pilot(data.species[0],'MCUI'),null,'legacy report cannot bypass the current-status check');
assert.equal(ctx.pilot(data.species[0],'MFPI'),50);
assert.equal(ctx.pilot(data.species[0],'BBVI'),60);
assert.equal(ctx.assessed(data.species[0]),false);
assert.match(ctx.blockers(data.species[0]).MCUI,/현행 평가인지 확인한 근거가 없어 보류/);
// Sea cucumber: reviewed 2013 EN original, no current check -> MCUI withheld, historical wording kept.
const cuc=report('Apostichopus japonicus'); cuc.species[0].aphia_id=241776;
Object.assign(cuc.species[0].conservation_trace,{assessment_year:2013,current_status_verified:false,current_status_source_id:null,current_status_checked_on:null,mcui_withheld_reason:'current_status_unverified'});
ctx.fetch=async()=>({status:200,ok:true,json:async()=>cuc});
data={live:true,species:[{aphiaID:241776,name:'Apostichopus japonicus',label:'해삼',live:true,info:{}}]}; await ctx.attach(data);
assert.equal(ctx.pilot(data.species[0],'MCUI'),null);
assert.equal(ctx.pilot(data.species[0],'MBPI'),70);
assert.equal(ctx.assessed(data.species[0]),false);
assert.match(ctx.blockers(data.species[0]).MCUI,/2013년 발표.*역사적 평가/);
// checked_on must be a real date no later than the report (and now); other axes stay visible.
const tomorrow=new Date(Date.now()+864e5).toISOString().slice(0,10);
for(const bad of ['2099-99-99','2026-02-30',tomorrow,'2026-09-24','2012-12-31','2026-9-23',20260923]){
  const r=report(); r.species[0].conservation_trace.current_status_checked_on=bad;
  ctx.fetch=async()=>({status:200,ok:true,json:async()=>r});
  data=specimen(); await ctx.attach(data);
  assert.equal(ctx.pilot(data.species[0],'MCUI'),null,`checked_on ${bad} must not allow MCUI`);
  assert.equal(ctx.pilot(data.species[0],'MFPI'),50);assert.equal(ctx.pilot(data.species[0],'MBPI'),70);assert.equal(ctx.pilot(data.species[0],'BBVI'),60);
  assert.equal(ctx.assessed(data.species[0]),false,`${bad}: off the matrix`);
}
// Sea cucumber with a valid, sourced recheck: pilot MCUI shown, no contradictory "not MCUI" text,
// and never described as a Korea-only 2026 assessment or a settled policy decision.
const recheck=report('Apostichopus japonicus'); recheck.species[0].aphia_id=241776;
Object.assign(recheck.species[0].conservation_trace,{assessment_year:2013,current_status_checked_on:'2026-09-20'});
ctx.fetch=async()=>({status:200,ok:true,json:async()=>recheck});
data={live:true,species:[{aphiaID:241776,name:'Apostichopus japonicus',label:'해삼',live:true,info:{}}]}; await ctx.attach(data);
data.assessmentInfo={sources:recheck.sources,foodWeight:.5,generatedAt:'2026-09-23'};
assert.equal(ctx.pilot(data.species[0],'MCUI'),80);
ctx.next=data; vm.runInContext('data=globalThis.next;globalThis.rows=iucnHistoricalRows(data.species[0])',ctx);
ctx.showDecision(data.species[0]);
for(const html of [ctx.rows,nodes.get('decision-detail').innerHTML]){
  assert.doesNotMatch(html,/MCUI로 바꾸지 않습니다|MCUI 입력으로 쓰지 않음|현행 평가 여부는 확인하지 않았습니다/);
  assert.match(html,/2026-09-20에 출처 s로 이 평가가 현행 IUCN 평가임을 재확인/);
  assert.match(html,/2026년 한국 한정 평가나 확정된 정책 판단이 아닙니다/);
}
assert.match(ctx.rows,/재확인 2026-09-20 · 시범 보고서/);
// Without the recheck, the historical wording stays.
data.species[0].assessment=undefined;
vm.runInContext('globalThis.rows=iucnHistoricalRows(data.species[0])',ctx);
assert.match(ctx.rows,/역사적 평가/);assert.match(ctx.rows,/확인 보류/);assert.match(ctx.rows,/MCUI로 바꾸지 않습니다/);
// A verified current check pointing at an unregistered source is not enough either.
const bad=report(); bad.species[0].conservation_trace.current_status_source_id='missing';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>bad});
data=specimen(); await ctx.attach(data);
assert.equal(ctx.pilot(data.species[0],'MCUI'),null);
// An MBPI without its assay trace is withheld with BBVI; the reviewed food and conservation axes stay.
{const noAssay=report();delete noAssay.species[0].bioactivity_trace;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>noAssay});const d=specimen();await ctx.attach(d);
assert.equal(ctx.pilot(d.species[0],'MBPI'),null);assert.equal(ctx.pilot(d.species[0],'BBVI'),null);
assert.equal(ctx.pilot(d.species[0],'MFPI'),50);assert.equal(ctx.pilot(d.species[0],'MCUI'),80);
assert.match(ctx.blockers(d.species[0]).MBPI,/추적이 없어 보류/);}
console.log('PASS: optional report, taxonomy join, independent axes, invalid score guard, historical IUCN, current-status gate, real check dates, recheck wording');
