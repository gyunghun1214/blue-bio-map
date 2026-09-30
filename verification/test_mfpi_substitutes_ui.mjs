// verified-pilot-3.3 MFPI substitutes on screen: the browser re-check accepts the published traces and rejects
// each broken part of the rule; the trace names the substitute, its level, part and uFiSh item.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const report=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';globalThis.valid=verifiedFoodValid;globalThis.detail=verifiedFoodDetail;',ctx);
ctx.info={method:report.method,sources:report.sources,cohorts:report.comparison_cohorts};
vm.runInContext('data={assessmentInfo:globalThis.info}',ctx);

const rows=[...report.species,...report.candidate_species];
for(const a of rows)assert.ok(ctx.valid(a,report),`${a.korean_name} passes the browser re-check`);
const withSub=rows.filter(a=>a.food_trace?.outside_cohort);
assert.deepEqual(withSub.map(a=>a.aphia_id).sort((x,y)=>x-y),[254538,397082,506159,1666974]);

const a0=withSub.find(a=>a.aphia_id===397082);            // 전복: genus-level zinc
const key=Object.keys(a0.food_trace.nutrients).find(k=>a0.food_trace.nutrients[k].substitute);
const broken=(change,r=report)=>{const a=structuredClone(a0);change(a,a.food_trace,a.food_trace.nutrients[key]);return ctx.valid(a,r);};
assert.ok(broken(()=>{}),'unchanged copy passes');
assert.equal(broken((a,f,n)=>{n.grade='measured';n.evidence_factor=1;}),false,'a genus value is never graded as measured');
assert.equal(broken((a,f,n)=>{n.substitute.label='종 수준 대체치(다른 성분표)';}),false,'label follows the level');
assert.equal(broken((a,f,n)=>{n.substitute.taxon_level='order';}),false,'only species, genus or family');
assert.equal(broken((a,f,n)=>{n.substitute.part='whole';}),false,'consumed part must be fillet, flesh or muscle');
assert.equal(broken((a,f,n)=>{n.substitute.source_id='nowhere';}),false,'substitute source must be registered');
assert.equal(broken((a,f)=>{f.outside_cohort=false;}),false,'a substituted row is never a cohort member');
assert.equal(broken((a,f)=>{for(const n of Object.values(f.nutrients))n.substitute=structuredClone(f.nutrients[key].substitute);}),false,
  'a score never rests only on other foods');
const noRule=structuredClone(report);delete noRule.method.nutrition.substitutes;
assert.equal(broken(()=>{},noRule),false,'a substituted trace without the published rule');

// Screen: every substituted component says so, with the uFiSh item, level label and consumed part.
for(const a of withSub){
  const html=ctx.detail({assessment:a});
  for(const n of Object.values(a.food_trace.nutrients).filter(n=>n.substitute))
    for(const text of [n.substitute.label,`uFiSh1.0 ${n.substitute.food_item_id}`,`섭취 부위 ${n.substitute.part}`])
      assert.ok(html.includes(text),`${a.korean_name} shows ${text}`);
  assert.ok(html.includes('고정 비교집단에 넣지 않고'),`${a.korean_name} says it is ranked outside the cohort`);
  assert.ok(!/undefined|NaN/.test(html),'no empty field on screen');
}
assert.ok(ctx.detail({assessment:rows.find(a=>a.aphia_id===254538)}).includes('양식 가능 근거 없음(양식 점수 0)'),'cod aquaculture shown as not feasible');
console.log(`ok MFPI substitutes UI (${withSub.length} species)`);
