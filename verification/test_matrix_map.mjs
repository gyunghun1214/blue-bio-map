import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// verified-pilot-3.2 (diagram stages 4-5): BBVI x MCUI types, the map's cell colour rule and the information-sufficiency layers.
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'),report=JSON.parse(read('assessments.json')),readiness=JSON.parse(read('matrix-readiness.json'));
const config=JSON.parse(fs.readFileSync(new URL('../config/verified-indices-v4.4.json',import.meta.url),'utf8'));  // 3.27 adds the single-paper BBVI keys; 4.0 is the released set; 4.2 admits the sub-national basis; 4.3 the scored Rapid LC and floor BBVI; 4.4 the relaxation-(d) item
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>structuredClone(report)})};
vm.createContext(ctx);
// the map helpers sit after setView; take that block alone (no DOM or Leaflet calls in it)
const mapHelpers=app.match(/^\/\/ Figure 5 legend colours[^]*?(?=^function valueSpeciesCard)/m)[0];
vm.runInContext(app.split('function setView')[0]+mapHelpers+';Object.assign(globalThis,{attachPilotAssessments,matrixType,assessedForMatrix,'+
  'cellMatrixType,valueSpeciesType,matrixTypeLabel,matrixTypeColour,valueCellOrder,valueCellStyle,sufficiencyCounts,unexploredLine,nationalTyped});'+
  'globalThis.setData=v=>{data=v};globalThis.setWeight=w=>{bbviWeight=w};',ctx);

// (1) The published rule is the config's rule, and the legend shows the figure's four labels in the figure's order.
const rule=report.method.matrix;
assert.equal(report.method_version,'verified-4.4');  // 4.4 scores 참문어 under the 4.3 relaxation (d) (cephalotocin in a ChEMBL target cohort, origin on the O. sinensis genome); 4.3 fills every cell (scored Rapid LC, 미역 Primorsky EN, XO stratum, MBPI floor); 4.2 adds the sub-national MCUI basis (labelled, back-test shown), 4.1 fills 꽃게 MBPI (MCCC1-MTS, origin settled on sequence records), 4.0 releases the set (정식 산출) and fills gaps under labelled extensions, 3.28 replicates 톳's top peptide, 3.27 fills gaps (labelled single-paper BBVI, new rows), 3.3/3.6/3.7/3.9 change MFPI, 3.4 MCUI, 3.5/3.8/3.10-3.14/3.24/3.25 add evidence rows, 3.26 corrects a record sentence, 3.15 adds MCUI substitutes kept off the matrix except a range-state list; the matrix rule is 3.2's
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
// 4.3: every species is typed and none is flagged, so the card wording is checked on a copy without an MCUI
const oneFlagged=next.species.find(s=>s.assessment?.priority_survey&&!ctx.matrixType(s))||(s=>({...s,assessment:{...s.assessment,priority_survey:true,priority_survey_reasons:['low_information_sufficiency'],scores:{...s.assessment.scores,MCUI:null}}}))(next.species[0]);
assert.match(ctx.valueSpeciesType(oneFlagged),/매트릭스 유형 없음[^]*우선 조사 대상[^]*점수와 별도/);
assert.match(ctx.valueSpeciesType({...fake(80,10,'national'),label:'x'}),/지속가능 활용 후보[^]*한국 국가 평가 기반/);
// (6) The BBVI slider moves the type: at w = 1 BBVI is MFPI alone, and the client re-types with it.
const placed=next.species.find(s=>ctx.matrixType(s));
ctx.setWeight(1);
const food=placed.assessment.scores.MFPI,need=placed.assessment.scores.MCUI;
assert.equal(ctx.matrixType(placed),rule.types[(food>=50?'high':'low')+'_bbvi_'+(need>=50?'high':'low')+'_mcui'].id);
ctx.setWeight(.5);
// A published 3.2 BBVI that crosses 50 with the weight (MFPI 40, MBPI 60) really is re-typed by the slider.
const crossing={live:true,assessment:{report_version:'verified-pilot-3.2',score_status:{BBVI:'산출됨'},scores:{MFPI:40,MBPI:60,BBVI:50,MCUI:10},mcui_basis:'iucn'}};
ctx.setWeight(0);assert.equal(ctx.matrixType(crossing),'sustainable_use','w = 0: BBVI 60');
ctx.setWeight(1);assert.equal(ctx.matrixType(crossing),'baseline_survey','w = 1: BBVI 40');
ctx.setWeight(.5);assert.equal(ctx.matrixType(crossing),'sustainable_use','w = 0.5: BBVI 50 on the threshold is high');
assert.equal(ctx.matrixType(fake(80,null)),null,'no MCUI, no type');

// (7) National MCUI switched off: the cell is held and the card says why, instead of 'pair not computed'.
ctx.setData({...next,assessmentInfo:{...next.assessmentInfo,method:{...next.assessmentInfo.method,matrix:{...rule,include_national_mcui:false}}}});
assert.equal(ctx.cellMatrixType(cell(fake(80,10,'national'))).type,null);
assert.match(ctx.valueSpeciesType({...fake(80,10,'national'),label:'x'}),/국가 평가 기반 MCUI는 이 규칙에서 매트릭스 제외/);
ctx.setData(next);
assert.equal(ctx.nationalTyped(cell(fake(80,10,'national'),fake(80,10),fake(null,80,'national'))),1,'only typed national species count');

// (8) Cell style: a mixed cell gets the dark dashed border, a held cell stays grey and dashed.
const mixedStyle=ctx.valueCellStyle(cell(fake(80,10),fake(10,80)),false),oneStyle=ctx.valueCellStyle(cell(fake(80,10)),false),held=ctx.valueCellStyle(cell(fake(null,80)),false);
assert.deepEqual([mixedStyle.dashArray,mixedStyle.color,mixedStyle.fillColor],['2 3','#102e45',ctx.matrixTypeColour.conservation_priority]);
assert.deepEqual([oneStyle.dashArray,oneStyle.fillColor],[null,ctx.matrixTypeColour.sustainable_use]);
assert.deepEqual([held.dashArray,held.fillColor],['5 4','#b7c0ca']);

// (9) Draw order: a held 4° extent is drawn before the typed 1° cell inside it, so it never covers that cell or its click.
const g=(size,...species)=>({size,species:new Map(species.map((s,i)=>[i,s]))});
const order=Array.from(ctx.valueCellOrder(new Map([['typed1',g(1,fake(80,10))],['held4',g(4,fake(null,80))],['held1',g(1,fake(null,80))]])),([k])=>k);
assert.deepEqual(order,['held4','held1','typed1']);

// (10) Layer counts come from the report; a flagged species without a public cell is listed, never silently dropped.
const flagged=flag=>next.species.filter(s=>s.assessment?.[flag]);
const oyster=next.species.find(s=>s.aphiaID===836033);
const counts=ctx.sufficiencyCounts(new Map([['c',{size:1,species:new Map([[836033,oyster]])}]]));
assert.equal(counts.priority.n,flagged('priority_survey').length);
assert.equal(counts.unexplored.n,flagged('unexplored_candidate').length);
assert.equal(counts.unexplored.shown+counts.unexplored.missing.length,counts.unexplored.n);
assert.deepEqual([...counts.unexplored.missing],flagged('unexplored_candidate').filter(s=>s.aphiaID!==836033).map(s=>s.label));
// (11) The candidate sentence uses Korean rank words and the relative's Korean name.
// 3.15: 시카메굴 now has an MFPI (literature row) and a range-state MCUI, so its information sufficiency passes and no species is an unexplored candidate.
assert.equal(flagged('unexplored_candidate').length,0);
assert.equal(ctx.unexploredLine({rank:'genus',taxon:'Magallana',relatives:['참굴']}),'같은 속(Magallana)에 BBVI 50 이상인 근연종(참굴)이 있습니다');
assert.equal(ctx.unexploredLine({rank:'family',taxon:'F',relatives:['Nomen novum']}),'같은 과(F)에 BBVI 50 이상인 근연종(Nomen novum)이 있습니다');
console.log('PASS: matrix types follow the published 50/50 rule, national MCUI is marked, cell colour precedence and sufficiency layers are separate');
