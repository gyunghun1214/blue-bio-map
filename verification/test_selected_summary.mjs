import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const app=read('dist/app.js'),html=read('dist/index.html'),css=read('dist/style.css');
const report=JSON.parse(read('dist/assessments.json'));
const snapshot=JSON.parse(read('dist/live-snapshot.json'));
const catalog=JSON.parse(read('dist/candidate-catalog.json'));
const audits=JSON.parse(read('dist/expansion-evidence.json'));
const release=JSON.parse(read('dist/expansion-public-cells.json'));
const axes=['MFPI','MBPI','MCUI','BBVI'];
assert.deepEqual(Object.fromEntries(axes.map(k=>[k,report.species.filter(s=>Number.isFinite(s.scores[k])).length])),
  {MFPI:3,MBPI:0,MCUI:2,BBVI:0});
assert.match(html,/id="selection-summary"/);
assert.match(app,/function renderMap\(\) \{\s*renderSelectionSummary\(selected\);/);
assert.match(css,/@media\(max-width:740px\)\{\.selection-summary/);
const functions=app.match(/\/\/ A species-level reading aid\.[\s\S]*?(?=function renderMap\(\))/)?.[0];
assert.ok(functions,'summary implementation missing');
const scoreButtons=[];
const summaryEl={focus(){summaryEl.focused=true}};
const disclosure={open:false,querySelector:()=>summaryEl,scrollIntoView(){disclosure.scrolled=true}};
const detail={querySelector:selector=>selector.includes('MFPI')?disclosure:null,scrollIntoView(){detail.scrolled=true},focus(){detail.focused=true}};
const box={innerHTML:'',querySelectorAll:()=>scoreButtons,querySelector:()=>({addEventListener(){}})};
const button={dataset:{summaryAxis:'MFPI'},addEventListener(_type,handler){button.click=handler}};
scoreButtons.push(button);
const context={
  $:id=>id==='selection-summary'?box:detail,
  pilotScore:(s,k)=>Number.isFinite(s.assessment?.scores?.[k])?s.assessment.scores[k]:null,
  assessmentBlockers:()=>Object.fromEntries(axes.map(k=>[k,'검수된 원자료 필요'])),
  scoreReason:{requires_MFPI_and_MBPI:'MFPI와 MBPI 모두 필요',
    compound_origin_assay_chain_or_fixed_cohort_missing:'정량 실험과 비교집단 필요'},
  spatialCells:s=>[...new Set(s.cells.map(c=>[c.lat0,c.lon0,c.sizeDeg].join(',')))],
  years:c=>c.yearStart===c.yearEnd?String(c.yearStart):c.yearStart+'–'+c.yearEnd,
  obisSearchLabel:()=> 'OBIS 종별 미조회',
  esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;')
};
const {selectionSummaryModel,renderSelectionSummary}=vm.runInNewContext(
  functions+'; ({selectionSummaryModel,renderSelectionSummary})',context);
const operating=id=>{
  const profile=snapshot.profiles.find(p=>Number(p.aphia_id)===id);
  const cells=snapshot.cells.filter(c=>c.species_id===profile.species_id).map(c=>{
    const m=/deg(1|4):N(-?\d+)E(-?\d+)/.exec(c.cell_code);
    return {sizeDeg:Number(m[1]),lat0:Number(m[2]),lon0:Number(m[3]),
      yearStart:c.year_start,yearEnd:c.year_end,period:String(c.period_start).slice(0,4)+'–'+String(c.period_end).slice(0,4)};
  });
  return {aphiaID:id,label:profile.korean_name,name:profile.scientific_name,
    live:true,cells,assessment:report.species.find(a=>a.aphia_id===id)};
};
const oyster=operating(836033),cucumber=operating(241776);
let o=selectionSummaryModel(oyster);
assert.deepEqual([...o.scored.map(x=>x.axis)],['MFPI']);
assert.equal(o.scored[0].value,report.species.find(x=>x.aphia_id===836033).scores.MFPI);
assert.deepEqual([...o.held],['MBPI','MCUI','BBVI']);
assert.match(o.occurrence,/공개 1° 셀/);
renderSelectionSummary(oyster);
button.click();
assert.equal(disclosure.open,true);
assert.equal(summaryEl.focused,true);
assert.match(box.innerHTML,/MFPI 65\.5/);
assert.doesNotMatch(box.innerHTML,/BBVI [0-9]+\.[0-9]/);
assert.match(box.innerHTML,/검증 전 시범 지표/);
o=selectionSummaryModel(cucumber);
assert.deepEqual([...o.scored.map(x=>x.axis)],['MCUI']);
assert.match(o.occurrence,/공개 4° 셀/);
const candidate=catalog.species.find(x=>x.aphiaID===231750);
const vacant={...candidate,catalog:true,live:true,cells:[],audit:audits.species.find(x=>x.aphiaID===candidate.aphiaID)};
o=selectionSummaryModel(vacant);
assert.equal(o.scored.length,0);
assert.match(o.occurrence,/공개 셀 0개/);
renderSelectionSummary(vacant);
assert.doesNotMatch(box.innerHTML,/MFPI 65\.5/);
assert.match(o.occurrence,/검수 필요/);
const historical={...catalog.species.find(x=>x.aphiaID===504357),catalog:true,live:true,
  cells:release.species[0].cells,audit:audits.species.find(x=>x.aphiaID===504357)};
o=selectionSummaryModel(historical);
assert.match(o.occurrence,/1930년 일본 연안/);
assert.equal(o.scored.length,0);
assert.equal(o.held.length,4);
for(const s of [oyster,cucumber,vacant,historical]){
  assert.match(selectionSummaryModel(s).judgment,/판단 보류/);
  renderSelectionSummary(s);
  assert.match(box.innerHTML,/실제 관측 좌표·개체수·자원량/);
}
console.log('selected-summary: 4 cases and 3/0/2/0 pilot report PASS');
