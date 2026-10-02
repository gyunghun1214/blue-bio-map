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
// 3.6: 피조개 and 멸치 zinc from MEXT. 3.7: 톳·청각 leave a blank zinc out of the mean (no substitute); 멸치 now scores.
// 3.9: 고등어·맛조개·참문어 have no linked RDA row; a MEXT same-species raw item is their own row.
// 3.15: national-name links give 고등어·참문어 their RDA rows (MEXT zinc fills the blank) and 해삼·다시마·우뭇가사리·꼬시래기 rows that
// leave zinc out; 살오징어 scores with its MEXT zinc once its aquaculture record exists; 시카메굴 has a literature row.
// 3.22: 괭생이모자반 (494853) joins through the same literature route, leaving iron out of the mean.
assert.deepEqual(withSub.map(a=>a.aphia_id).sort((x,y)=>x-y),[127022,145086,219984,236157,241776,254538,342067,372119,377084,397082,413600,494853,494972,504357,506159,534443,836041,1666974]);
const akamoku=rows.find(a=>a.aphia_id===494853).food_trace;
assert.deepEqual([akamoku.row_table,akamoku.source_food_item_id,akamoku.omitted_components],['literature','LIT:murakami2011-shorneri-tables3-4',['iron_mg']]);
const kumamoto=rows.find(a=>a.aphia_id===836041).food_trace;
assert.deepEqual([kumamoto.row_table,kumamoto.source_food_item_id,kumamoto.omitted_components],['literature','LIT:liu2021-csikamea-table1',['zinc_mg']]);
// 3.23: each literature row's reviewed limitations reach the MFPI detail as an uncertainty line
for(const aphia of [494853,836041])assert.match(ctx.detail({assessment:rows.find(a=>a.aphia_id===aphia)}),/불확실성: Literature row limitations: /,String(aphia));
assert.ok(ctx.detail({assessment:rows.find(a=>a.aphia_id===494853)}).includes('Kjeldahl'),'the seaweed protein caveat is on screen');

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
// independent review (wf_649e5916-f04): the trace is checked against the species' own linked RDA row
const tamper=(aphia,change)=>{const a=structuredClone(withSub.find(x=>x.aphia_id===aphia));change(a.food_trace);return ctx.valid(a,report);};
const subKey=f=>Object.keys(f.nutrients).find(k=>f.nutrients[k].substitute);
assert.equal(tamper(506159,f=>{delete f.nutrients[subKey(f)].substitute;}),false,'a substitute cannot pose as the own RDA value');
assert.equal(tamper(397082,f=>{delete f.nutrients[subKey(f)].substitute;}),false,'a genus value cannot pose as the own RDA value');
assert.equal(tamper(506159,f=>{f.nutrients.protein_g.substitute=structuredClone(f.nutrients[subKey(f)].substitute);}),false,
  'a component the own row reports is never substituted');
assert.equal(tamper(1666974,f=>{for(const n of Object.values(f.nutrients))delete n.substitute;}),false,'outside the cohort only with a substitute');
// same-species sub-sample (대구): reviewed links only, and the value is the mean of the named rows
const cod=withSub.find(a=>a.aphia_id===254538),codZinc=cod.food_trace.nutrients.zinc_mg;
assert.equal((codZinc.substitute.taxon_level),'subsample');
assert.equal(codZinc.value,0.51);
assert.equal(tamper(254538,f=>{f.nutrients.zinc_mg.value=0.55;}),false,'the sub-sample value is the mean of its rows');
assert.equal(tamper(254538,f=>{f.nutrients.zinc_mg.substitute.food_item_id='K0440002570a+K9999999999a';}),false,'only reviewed sub-sample links');
assert.equal(tamper(254538,f=>{f.nutrients.zinc_mg.grade='proxy';f.nutrients.zinc_mg.evidence_factor=.5;}),false,'a sub-sample keeps the table grade');
// verified-pilot-3.6: MEXT 2020 same-species raw item (피조개 zinc, あかがい 10279), graded as a cited foreign table
const ark=withSub.find(a=>a.aphia_id===504357),arkZinc=ark.food_trace.nutrients.zinc_mg;
assert.deepEqual([arkZinc.substitute.taxon_level,arkZinc.substitute.food_item_id,arkZinc.value,arkZinc.grade,arkZinc.evidence_factor],['mext','10279',1.5,'foreign_table_cited',0.85]);
assert.equal(tamper(504357,f=>{f.nutrients.zinc_mg.grade='measured';f.nutrients.zinc_mg.evidence_factor=1;}),false,'a MEXT value keeps the rule grade');
assert.equal(tamper(504357,f=>{f.nutrients.zinc_mg.substitute.part='muscle';}),false,'a MEXT value is the edible portion');
assert.equal(tamper(504357,f=>{f.nutrients.zinc_mg.substitute.source_id='ufish_1_workbook';}),false,'a MEXT value cites the MEXT source');
const noMext=structuredClone(report);delete noMext.method.nutrition.substitutes.mext;
assert.equal(ctx.valid(ark,noMext),false,'a MEXT substitute without the published MEXT rule');

// verified-pilot-3.9: a MEXT row stands in for a missing RDA row, at the MEXT grade, as the species' only linked row
const razor=withSub.find(a=>a.aphia_id===413600);
assert.deepEqual([razor.food_trace.row_table,razor.food_trace.source_food_item_id,razor.food_trace.edible_fraction.value],['mext','MEXT:10280',0.65]);
const mextRow=(change,r=report)=>{const a=structuredClone(razor);change(a.food_trace);return ctx.valid(a,r);};
assert.ok(mextRow(()=>{}),'unchanged MEXT row passes');
assert.equal(mextRow(f=>{delete f.row_table;}),false,'outside the cohort only with a substitute, an omission or a MEXT row');
assert.equal(mextRow(f=>{f.nutrients.iron_mg.grade='measured';f.nutrients.iron_mg.evidence_factor=1;}),false,'a MEXT row keeps the rule grade');
assert.equal(mextRow(f=>{f.observed_rows.push({...f.observed_rows[0],food_item_id:'K9999999999a'});}),false,'a species with a linked RDA row never takes a MEXT row');
assert.equal(mextRow(f=>{f.edible_fraction.source_id='rda_db_10_4';}),false,'the refuse share comes from the same MEXT item');
assert.equal(mextRow(f=>{f.row_table='rda';}),false,'only the MEXT row table is published');
const noRows=structuredClone(report);delete noRows.method.nutrition.substitutes.mext.species_row_groups;
assert.equal(ctx.valid(razor,noRows),false,'a MEXT row without the published 3.9 rule');
assert.ok(ctx.detail({assessment:razor}).includes('일본 식품성분표 2020(8정판) 10280 ＜貝類＞ あげまき 生(같은 종 생것, 가식부 100 g)을 이 종의 영양 행과 폐기율로 썼습니다'),'the screen says why the MEXT row is used');
// Screen: every substituted component says so, with its source item and level label (and the consumed part for uFiSh).
for(const a of withSub){
  const html=ctx.detail({assessment:a});
  for(const n of Object.values(a.food_trace.nutrients).filter(n=>n.substitute))
    for(const text of n.substitute.taxon_level==='subsample'?[n.substitute.label,'같은 종의 부표본 행','K0440002570a 0.55','K0440002580a 0.47','평균']
        :n.substitute.taxon_level==='mext'?[n.substitute.label,`일본 식품성분표 2020(8정판) ${n.substitute.food_item_id}`,'가식부 100 g','종 연결:',n.substitute.taxon_label.match(/\((.+)\)/)[1]]  // standard Japanese name (アカガイ, カタクチイワシ)
        :[n.substitute.label,`uFiSh1.0 ${n.substitute.food_item_id}`,`섭취 부위 ${n.substitute.part}`])
      assert.ok(html.includes(text),`${a.korean_name} shows ${text}`);
  assert.ok(!/\d\.\d{5,}/.test(html.replace(/10\.\d{4,9}\/[^\s<]+/g,'')),`${a.korean_name}: values shown with at most four significant digits (DOIs aside)`);
  assert.ok(html.includes('고정 비교집단에 넣지 않고'),`${a.korean_name} says it is ranked outside the cohort`);
  assert.ok(!/undefined|NaN/.test(html),'no empty field on screen');
}
assert.ok(ctx.detail({assessment:rows.find(a=>a.aphia_id===254538)}).includes('양식 가능 근거 없음(양식 점수 0)'),'cod aquaculture shown as not feasible');
// 3.6: the same-species MEXT item (するめいか 10345) outranks the 3.3 family-level uFiSh proxy 093033.
// 3.15: 살오징어's only missing input was the aquaculture record; with Puneeta 2015 (feasible false) it scores, using the MEXT zinc
assert.match(ctx.detail({assessment:rows.find(a=>a.aphia_id===342067)}),/일본 식품성분표 2020\(8정판\) 10345[^]*양식 가능 근거 없음\(양식 점수 0\)/);
// 3.7: 톳 has no zinc candidate, so zinc is left out of the mean (shown, never 0) and 3 of 4 components score
assert.match(ctx.detail({assessment:rows.find(a=>a.aphia_id===494972)}),/아연 값이 비어 있어 평균에서 뺐습니다\(0점 아님, 사용 성분 3\/4\)/);
const hijiki=rows.find(a=>a.aphia_id===494972);
const omit=change=>{const a=structuredClone(hijiki);change(a.food_trace);return ctx.valid(a,report);};
assert.equal(omit(f=>{f.omitted_components=['zinc_mg','iron_mg'];delete f.nutrients.iron_mg;}),false,'below minimum_components never scores');
assert.equal(omit(f=>{f.omitted_components=['zinc_mg','protein_g'];delete f.nutrients.protein_g;}),false,'a component the own row reports is never omitted');
assert.equal(omit(f=>{f.nutrients.zinc_mg={...f.nutrients.iron_mg,value:0};}),false,'an omitted component is never scored as 0');
const old=structuredClone(report);delete old.method.nutrition.minimum_components;
assert.equal(ctx.valid(hijiki,old),false,'omission needs the published minimum_components rule');
// the 홍합 uFiSh observation record now states which component is used
assert.ok(ctx.detail({assessment:withSub.find(a=>a.aphia_id===506159)}).includes(`uFiSh1.0:093015: zinc_mg is used as a ${report.method_version} substitute`));
console.log(`ok MFPI substitutes UI (${withSub.length} species)`);
