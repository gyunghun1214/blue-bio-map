import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Evaluate only pure/UI data helpers. The page bootstrap needs a browser.
const code=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('function setView')[0];
const specimen=()=>({live:true,species:[{aphiaID:123, name:'Accepted species'}]});
const report=(name='Accepted species')=>({method_version:'pilot-1',status:'provisional_unvalidated',
  food_weight:.5,generated_at:'2026-09-23',sources:{s:{url:'https://example.org/s',license:'test'}},
  species:[{aphia_id:123,scientific_name:name,source_ids:['s'],scores:{MFPI:50,MBPI:70,MCUI:80,BBVI:60}}]});
const ctx={fetch:async()=>({status:404,ok:false})};
vm.createContext(ctx);
vm.runInContext(code+';globalThis.attach=attachPilotAssessments;globalThis.pilot=pilotScore',ctx);

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
assert.equal(ctx.pilot(data.species[0],'MFPI'),null,'a bare MFPI number without food trace is withheld');
assert.equal(ctx.pilot(data.species[0],'BBVI'),null,'BBVI depends on withheld MFPI');
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
data.assessmentInfo={sources:report().sources};
ctx.next=data;
vm.runInContext('data=globalThis.next;renderDetail(data.species[0]);renderMatrix(false)',ctx);
assert.match(nodes.get('detail').innerHTML,/시범 지표 · 타당성 미검증/);
assert.match(nodes.get('detail').innerHTML,/BBVI/);
assert.equal(nodes.get('matrix-points').innerHTML,'','without reviewed MFPI no real species point is plotted');

const invalid=report(); invalid.species[0].scores.BBVI=150;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>invalid});
data=specimen();
await ctx.attach(data);
assert.equal(data.species[0].assessment,undefined,'invalid scores cannot be shown');
console.log('PASS: optional report, taxonomy join, independent axes, invalid score guard');
