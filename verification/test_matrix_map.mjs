import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// verified-pilot-3.2 (diagram stages 4-5): BBVI x MCUI types, the map's cell colour rule and the information-sufficiency layers.
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'),report=JSON.parse(read('assessments.json')),readiness=JSON.parse(read('matrix-readiness.json'));
const config=JSON.parse(fs.readFileSync(new URL('../config/verified-indices-v3.2.json',import.meta.url),'utf8'));
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>structuredClone(report)})};
vm.createContext(ctx);
// the map helpers sit after setView; take that block alone (no DOM or Leaflet calls in it)
const mapHelpers=app.match(/^\/\/ Figure 5 legend colours[^]*?(?=^function valueSpeciesCard)/m)[0];
vm.runInContext(app.split('function setView')[0]+mapHelpers+';Object.assign(globalThis,{attachPilotAssessments,matrixType,assessedForMatrix,'+
  'cellMatrixType,valueSpeciesType,matrixTypeLabel,matrixTypeColour});globalThis.setData=v=>{data=v};globalThis.setWeight=w=>{bbviWeight=w};',ctx);

// (1) The published rule is the config's rule, and the legend shows the figure's four labels in the figure's order.
const rule=report.method.matrix;
assert.equal(report.method_version,'verified-pilot-3.2');
assert.deepEqual(rule,config.matrix);
assert.deepEqual(readiness.matrix_rule,rule);
assert.deepEqual([rule.bbvi_threshold,rule.mcui_threshold,rule.include_national_mcui],[50,50,true]);
const labels=['기초조사·관찰 대상','지속가능 활용 후보','보전 우선·모니터링','대체생산·배양 연구'];
assert.deepEqual(Object.values(rule.types).map(t=>t.label).sort(),[...labels].sort());
const legend=read('index.html').match(/<div id="value-legend"[^]*?<\/div>/)[0];
assert.deepEqual([...legend.matchAll(/role="listitem">([^<]+)</g)].map(m=>m[1]),labels);
assert.match(read('index.html'),/출현 기록이 있는 셀 × 그 셀에 기록된 종의 매트릭스 유형’입니다\. 해역의 자원량·분포·해역 점수가 아닙니다/);
assert.deepEqual(rule.cell_colour_precedence,['conservation_priority','alternative_production','sustainable_use','baseline_survey']);
assert.deepEqual(Object.keys(ctx.matrixTypeColour).sort(),[...rule.cell_colour_precedence].sort());

// (2) On the real report the client type equals the published type at the default weight, species by species.
const next={live:true,species:[...report.species,...report.candidate_species].map(s=>({aphiaID:s.aphia_id,name:s.scientific_name,
  label:s.korean_name,live:true,catalog:s.candidate_label==='조사 후보'}))};
await ctx.attachPilotAssessments(next);ctx.setData(next);
for(const row of readiness.species){
  const s=next.species.find(x=>x.aphiaID===row.aphia_id);
  assert.equal(ctx.matrixType(s),row.matrix_type,`${row.korean_name}: client type = published type`);
  assert.equal(!!s.assessment?.priority_survey,row.priority_survey,`${row.korean_name}: priority survey`);
}
assert.ok(readiness.species.some(r=>r.matrix_type),'at least one species is placed');

// (3) The rule itself, on synthetic axes: a value at the threshold is high; a national MCUI is placed only when the report says so.
// no report_version: pilotScore returns the given axes as they are
const fake=(BBVI,MCUI,basis='iucn')=>({live:true,assessment:{scores:{MFPI:60,MBPI:60,BBVI,MCUI},mcui_basis:basis}});
assert.equal(ctx.matrixType(fake(50,50)),'alternative_production');
assert.equal(ctx.matrixType(fake(49.9,50)),'conservation_priority');
assert.equal(ctx.matrixType(fake(50,49.9)),'sustainable_use');
assert.equal(ctx.matrixType(fake(10,10)),'baseline_survey');
assert.equal(ctx.matrixType(fake(null,80)),null,'no BBVI, no type (never a zero)');
assert.equal(ctx.matrixType(fake(80,10,'national')),'sustainable_use');
ctx.setData({assessmentInfo:{method:{matrix:{...rule,include_national_mcui:false}}}});
assert.equal(ctx.matrixType(fake(80,10,'national')),null,'national MCUI stays off when the rule excludes it');
ctx.setData({assessmentInfo:{method:{}}});
assert.equal(ctx.matrixType(fake(80,80)),null,'an older report without a matrix rule places nothing');
ctx.setData(next);

// (4) Cell colour: the first type in the precedence wins, counts are kept, untyped species never colour a cell.
const cell=(...species)=>({species:new Map(species.map((s,i)=>[i,s]))});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.cellMatrixType(cell(fake(80,10),fake(10,80),fake(10,10))))),
  {type:'conservation_priority',counts:{sustainable_use:1,conservation_priority:1,baseline_survey:1}});
assert.equal(ctx.cellMatrixType(cell(fake(80,10),fake(80,80))).type,'alternative_production');
assert.equal(ctx.cellMatrixType(cell(fake(10,10),fake(80,10))).type,'sustainable_use');
assert.equal(ctx.cellMatrixType(cell(fake(null,80),fake(null,null))).type,null);

// (5) Card text: type and information sufficiency stay separate labels.
const oneFlagged=next.species.find(s=>s.assessment?.priority_survey&&!ctx.matrixType(s));
assert.match(ctx.valueSpeciesType(oneFlagged),/매트릭스 유형 없음[^]*우선 조사 대상[^]*점수와 별도/);
assert.match(ctx.valueSpeciesType({...fake(80,10,'national'),label:'x'}),/지속가능 활용 후보[^]*한국 국가 평가 기반/);
// (6) The BBVI slider moves the type: at w = 1 BBVI is MFPI alone, and the client re-types with it.
const placed=next.species.find(s=>ctx.matrixType(s));
ctx.setWeight(1);
const food=placed.assessment.scores.MFPI,need=placed.assessment.scores.MCUI;
assert.equal(ctx.matrixType(placed),rule.types[(food>=50?'high':'low')+'_bbvi_'+(need>=50?'high':'low')+'_mcui'].id);
ctx.setWeight(.5);
console.log('PASS: matrix types follow the published 50/50 rule, national MCUI is marked, cell colour precedence and sufficiency layers are separate');
