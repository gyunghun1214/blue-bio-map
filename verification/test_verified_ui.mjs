import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const report=()=>structuredClone(original);
const oyster=()=>({aphiaID:836033,name:'Magallana gigas',label:'참굴',live:true});
const cucumber=()=>({aphiaID:241776,name:'Apostichopus japonicus',label:'해삼',live:true});
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>report()})};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+`;
  globalThis.attach=attachPilotAssessments;
  globalThis.score=pilotScore;
  globalThis.renderScores=renderVerifiedIndices;
  globalThis.foodOk=verifiedFoodValid;`,ctx);

let next={live:true,species:[oyster(),cucumber()]};
await ctx.attach(next);
assert.equal(ctx.score(next.species[0],'MFPI'),65.6);
assert.equal(ctx.score(next.species[0],'MBPI'),null);
assert.equal(ctx.score(next.species[0],'BBVI'),null,'one value cannot become combined BBVI');
assert.equal(ctx.score(next.species[1],'MCUI'),null,'historical EN cannot become current MCUI');
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);
let html=ctx.renderScores(next.species[0]);
for(const text of ['10.8 g','4.43 mg','18.04 mg','2010–2011','65.6','66.0','66.8','고정 비교집단','AFCD 원값']){
  assert.ok(html.includes(text),`missing visible trace: ${text}`);
}
assert.match(html,/BBVI.*산출 보류/s);
html=ctx.renderScores(next.species[1]);
assert.match(html,/역사적 기록/);
assert.match(html,/현행 평가: 확인 보류/);

const bad=report();
bad.species.find(s=>s.aphia_id===836033).scores.MFPI=99;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>bad});
next={live:true,species:[oyster()]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'browser must reject score that differs from its trace');
const noName=report();
noName.species.find(s=>s.aphia_id===836033).scientific_name='Another oyster';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>noName});
next={live:true,species:[oyster()]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'accepted taxon join needs both name and AphiaID');
console.log('PASS: verified report joins, one real MFPI trace, withheld axes, inconsistent-score guard');
