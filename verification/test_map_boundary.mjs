import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const pre=app.split('function setView')[0];
const mapCode='const REASONS='+app.split('const REASONS=')[1].split('function fitMap')[0];
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.match(html,/id="map-symbol-label"/);
assert.match(html,/id="map-legend-note"/);
assert.match(html,/id="map-judgment"/);

const nodes=new Map();
const popup=[], dots=[];
const context={
  document:{getElementById(id){
    if(!nodes.has(id))nodes.set(id,{textContent:'',nextElementSibling:{textContent:''}});
    return nodes.get(id);
  }},
  L:{rectangle(){
    return {addTo(){return this},bindPopup(body){popup.push(body);return this}};
  },circleMarker(latlng,options){
    const dot={latlng,options,addTo(){dots.push(this);return this}};return dot;
  }}
};
vm.createContext(context);
vm.runInContext(pre+'\n'+mapCode+'\nglobalThis.check=cellAssessmentStatus;globalThis.draw=renderCellMap;globalThis.banner=mapJudgmentStatus;',context);

const species={live:true,aphiaID:123,name:'Accepted species',label:'시험 종',cells:[]};
const cell={lat0:34,lon0:128,sizeDeg:1,resolutionM:100000,yearStart:2015,yearEnd:2020,
  period:'2015–2020',records:9,sites:2,uncertaintyMissing:1,seaAreas:['43'],
  countries:['KR'],citations:[{title:'Provider',url:'https://example.org/dataset',
    licenses:['CC BY 4.0']}]};
species.cells=[cell];
let outcome=context.check(species,cell);
assert.equal(outcome.eligible,false);
assert.match(outcome.reasons.join(' '),/BBVI·MCUI/);
assert.match(outcome.reasons.join(' '),/관측 노력/);
const incomplete={...cell,citations:[],seaAreas:['해역명 미확인'],yearStart:null};
assert.match(context.check(species,incomplete).reasons.join(' '),/제공처·이용조건 연결 미확인/);
assert.match(context.check(species,incomplete).reasons.join(' '),/기록 연도 범위 미확인/);

// Even a numeric species score does not license a grid value.
species.assessment={scores:{BBVI:90,MCUI:90}};
outcome=context.check(species,cell);
assert.equal(outcome.eligible,false);
assert.doesNotMatch(outcome.reasons.join(' '),/한 쌍이 없음/);
assert.match(outcome.reasons.join(' '),/셀에 귀속할 검수된 연결/);
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/승인 0곳/);
assert.match(nodes.get('map-judgment').textContent,/1개 셀 모두 판단 보류/);

context.species=species;
context.layer={clearLayers(){}};
context.mapStub={zoom:7,fitBounds(){},getZoom(){return this.zoom}};
vm.runInContext('let lastFitted;overlay=globalThis.layer;map=globalThis.mapStub;',context);
context.draw(species,'#123456');
assert.equal(popup.length,1);
assert.match(popup[0],/해역별 활용·보전 판단: 보류/);
assert.match(popup[0],/2015–2020/);
assert.match(popup[0],/LME 43/);
assert.match(popup[0],/https:\/\/example.org\/dataset/);
assert.match(popup[0],/CC BY 4.0/);
assert.match(popup[0],/관측 노력·중복/);
assert.doesNotMatch(popup[0],/BBVI 90/);
// Schematic dots must stay inside the cell and never take the click from the evidence popup.
assert.equal(dots.length,36,'9 records -> 5–19 band -> 6x6 per 1°');
assert.ok(dots.every(d=>d.options.fillColor==='#d7263d'),'one red for the schematic pattern');
assert.ok(dots.every(d=>d.options.interactive===false));
assert.ok(dots.every(({latlng:[lat,lon]})=>lat>34&&lat<35&&lon>128&&lon<129));
assert.match(popup[0],/붉은 점은 실제 발견 좌표가 아닌 이 1° 공개 셀의 도식적 표시/);
// Wider published cells (sea cucumber: 4°) keep their real size in the popup and dot layout.
popup.length=0;dots.length=0;
species.cells=[{...cell,sizeDeg:4,lat0:32,lon0:124,records:2}];
context.draw(species,'#123456');
assert.match(popup[0],/선별 출현기록 4° 셀/);
assert.match(popup[0],/4°×4°/);
assert.equal(dots.length,256,'4° cell keeps the 1° density (16x16 for the 1–4 band), not a few point-like marks');
assert.ok(dots.some(({latlng:[lat]})=>lat>35)&&dots.every(({latlng:[lat,lon]})=>lat>32&&lat<36&&lon>124&&lon<128),'dots spread over, and stay inside, the 4° cell');
assert.ok(dots.every(d=>d.options.interactive===false));
// Two period rows at one location: one hit area whose popup lists both periods in full.
popup.length=0;dots.length=0;
const later={...cell,period:'2021–2026',yearStart:2023,yearEnd:2023,records:15,sites:4,uncertaintyMissing:0,
  citations:[{title:'Second provider',url:'https://example.org/second',licenses:['CC0 1.0']}]};
species.cells=[cell,later];
context.draw(species,'#123456');
assert.equal(popup.length,1,'one clickable area per spatial cell, not one per period');
for(const x of [/공개 집계 기간 2015–2020/,/기록 연도 2015–2020/,/선별 기록 9건 · 조사 지점 2곳/,/https:\/\/example.org\/dataset/,/CC BY 4.0/,
  /공개 집계 기간 2021–2026/,/기록 연도 2023/,/선별 기록 15건 · 조사 지점 4곳/,/https:\/\/example.org\/second/,/CC0 1.0/,/기간 2개 · 선별 기록 합계 24건/])
  assert.match(popup[0],x);
assert.equal(dots.length,64,'one 8x8 pattern for the 24-record total (20–99 band), drawn once');
assert.ok(dots.every(d=>d.options.interactive===false));
assert.equal(nodes.get('map-cells').textContent,1);
assert.match(nodes.get('map-count').nextElementSibling.textContent,/기간별 합계/);
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/1개 셀 모두 판단 보류/);
species.cells=[];
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/공개 출현 셀이 없어/);
// Bands stay visible and very busy cells are capped for speed.
dots.length=0;species.cells=[{...cell,sizeDeg:4,lat0:32,lon0:124,records:500}];context.draw(species,'#123456');
assert.equal(dots.length,576,'4° cell capped at 24x24');
assert.ok(dots.every(d=>d.options.radius>0&&d.options.interactive===false));
// At an overview zoom dots keep >= 6 px apart instead of fusing into a solid red block.
dots.length=0;context.mapStub.zoom=5;context.draw(species,'#123456');
assert.equal(dots.length,15*15,'4° cell at zoom 5: spacing-capped grid');
context.mapStub.zoom=7;
console.log('PASS: selected occurrences and unapproved spatial decisions remain separate');
