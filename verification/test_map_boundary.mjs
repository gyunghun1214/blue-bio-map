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
const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
assert.match(css,/\.map-symbol\{width:4px;height:4px;/,'legend marks reflect the smaller schematic dots');

const nodes=new Map();
const popup=[], dots=[], rectangles=[], markers=[];
const context={
  document:{getElementById(id){
    if(!nodes.has(id))nodes.set(id,{textContent:'',nextElementSibling:{textContent:''}});
    return nodes.get(id);
  }},
  L:{rectangle(bounds,options){
    rectangles.push({bounds,options});
    return {addTo(){return this},bindPopup(body){popup.push(body);return this}};
  },
  // 2026-10-14 land mask: 4° cells (and 1° cells with a sea part) are drawn by cellShape's L.Rectangle subclass
  Rectangle:{extend(){return function(bounds,info,style){
    const r={bounds,info,options:{},addTo(){return this},bindPopup(body){popup.push(body);return this},
      setStyle(s){this.options=context.cellStyles(info.sea,info.wide,s)[0];return this}};
    rectangles.push(r);return r.setStyle(style);
  };}},circleMarker(latlng,options){
    const dot={latlng,options,addTo(){dots.push(this);return this}};return dot;
  },marker(latlng,options){
    const m={latlng,options,addTo(){markers.push(this);return this}};return m;
  },divIcon(o){return o;}}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),context); // as on the page: app.js writes its numbers with it
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
context.layer={clearLayers(){},eachLayer(){},removeLayer(){},hasLayer(){return true}};
context.mapStub={zoom:7,fitBounds(){},getZoom(){return this.zoom}};
vm.runInContext('let lastFitted;overlay=globalThis.layer;map=globalThis.mapStub;',context);
context.draw(species,'#123456');
assert.equal(popup.length,1);
assert.equal(rectangles.length,1,'cell remains the full interactive map target');
assert.deepEqual(JSON.parse(JSON.stringify(rectangles[0].bounds)),[[34,128],[35,129]]);
assert.notEqual(rectangles[0].options.interactive,false,'smaller dots must not shrink the cell hit area');
assert.match(popup[0],/지표는 종 단위 값입니다/);  // 2026-10-17: said as what it is (was 해역별 … 하지 않음)
assert.match(popup[0],/2015–2020/);
assert.match(popup[0],/LME 43/);
assert.match(popup[0],/https:\/\/example.org\/dataset/);
assert.match(popup[0],/CC BY 4.0/);
assert.match(popup[0],/공개 기준\(이용조건·좌표 품질\)을 통과한 기록입니다/);
assert.doesNotMatch(popup[0],/BBVI 90/);
assert.match(popup[0],/종 단위 값: MFPI 보류 · MBPI 보류 · MCUI 시범값 있음 · BBVI 시범값 있음/);
assert.doesNotMatch(popup[0],/90\.0/);
// Schematic dots must stay inside the cell and never take the click from the evidence popup.
assert.equal(dots.length,36,'9 records -> 5–19 band -> 6x6 per 1°');
assert.ok(dots.every(d=>d.options.fillColor==='#ff6464'),'one red for the schematic pattern'); // 2026-10-11 navy map: lighter red (intended change 2); 2026-10-17: back to red after the 2026-10-15 blue-grey
assert.ok(dots.every(d=>d.options.interactive===false));
assert.ok(dots.every(d=>d.options.radius>=1.1&&d.options.radius<=2.6),'zoom 7 dots stay small');
assert.ok(dots.every(({latlng:[lat,lon]})=>lat>34&&lat<35&&lon>128&&lon<129));
assert.match(popup[0],/붉은 점은 이 1° 공개 셀의 도식적 표시입니다\(기록이 있는 칸의 위치, 넓게 묶음\)/);
// Wider published cells (sea cucumber: 4°) keep their real size in the popup and dot layout.
popup.length=0;dots.length=0;
species.cells=[{...cell,sizeDeg:4,lat0:32,lon0:124,records:2}];
context.draw(species,'#123456');
assert.match(popup[0],/선별 출현기록 4° 셀/);
assert.match(popup[0],/4°×4°/);
// 2026-10-14: a 4° cell is a dashed outline in the cell's own colour with no fill, still the full click area, and says why it is wide
const wide=rectangles.at(-1);
assert.deepEqual(JSON.parse(JSON.stringify(wide.bounds)),[[32,124],[36,128]]);
assert.equal(wide.options.fillOpacity,0);assert.equal(wide.options.fill,true,'no fill, but the whole square still takes the click');
assert.equal(wide.options.dashArray,'9 6');assert.equal(wide.options.weight,2.5);assert.equal(wide.options.color,'#ff6464');
assert.match(popup[0],/시험 종 · 민감종 보호<\/b> — 채취 압력이 있어 4° 단위로 공개합니다\(넓게 묶은 관측 지역\)\. 테두리 안 바다에 기록이 있는 칸입니다\./);
// any later style (hover, dim) keeps a 4° cell unfilled; a 1° cell's sea part takes the fill, the square keeps a faint edge
assert.equal(context.cellStyles(null,true,{color:'#ffd166',fillOpacity:.6})[0].fillOpacity,0);
const sea={type:'Polygon',coordinates:[],seaFraction:.5};
const [sq,fill]=context.cellStyles(sea,false,{color:'#2f9a57',weight:1.5,opacity:1,fillColor:'#2f9a57',fillOpacity:.48,edge:'plain'});
assert.deepEqual([sq.fillOpacity,sq.weight,sq.opacity,fill.fillColor,fill.fillOpacity,fill.stroke],[0,1,.45,'#2f9a57',.48,false]);
assert.deepEqual(context.cellStyles({seaFraction:1},false,{fillOpacity:.48,edge:'plain'})[1],null,'an all-sea cell fills its square');
assert.equal(context.cellStyles(sea,false,{color:'#ffd166',weight:4,dashArray:'6 4'})[0].weight,4,'hover and selected outlines are not thinned');
assert.equal('fillOpacity' in context.cellStyles(sea,false,{color:'#ffd166'})[1],false,'a hover style keeps the sea fill as it was');
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
assert.equal(nodes.get('map-count').textContent,'24','footer shows the same record total as the panel, not summed site counts');
assert.equal(nodes.get('map-years').textContent,'2015–2023');
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/1개 셀 모두 판단 보류/);
species.cells=[];
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/공개 출현 셀이 없어/);
// Bands stay visible and very busy cells are capped for speed.
dots.length=0;species.cells=[{...cell,sizeDeg:4,lat0:32,lon0:124,records:500}];context.draw(species,'#123456');
assert.equal(dots.length,576,'4° cell capped at 24x24');
assert.ok(dots.every(d=>d.options.radius>0&&d.options.interactive===false));
// 2026-10-03: overview zooms (<= 6) show one regional bubble instead of the cell's dots; zoom 7+ splits it into dots.
dots.length=0;markers.length=0;context.mapStub.zoom=5;context.draw(species,'#123456');
assert.equal(dots.length,1,'zoom 5: one bubble, no schematic dots');
assert.ok(dots[0].options.radius>=9&&dots[0].options.fillOpacity===.75,'500 records in one cell -> darkest band');
assert.deepEqual(JSON.parse(JSON.stringify(dots[0].latlng)),[34,126],'bubble sits on the published cell centre');
assert.equal(markers.filter(m=>/bbvi-tag/.test(m.options.icon.className)).length,0,'no per-cell BBVI tag on bubbles');
// 2026-10-13 design 2: the legend's first line names what the map shows at this zoom (bubbles here), with the standing note
assert.equal(nodes.get('key-bubble-mark').hidden,false);assert.equal(nodes.get('key-dot-mark').hidden,true);
assert.equal(nodes.get('map-symbol-label').textContent,'버블 = 공개 셀 묶음 · 숫자 = 셀 수\n기록이 있는 칸의 위치(넓게 묶음)');
// Bubbles group published cells by region: size = cells, never a species score.
vm.runInContext('globalThis.bubbles=cellBubbles;globalThis.tag=bbviTagText;globalThis.summary=cellSummaryHtml',context);
const grouped=context.bubbles([[33,128,1,9],[35,129,1,30],[37,131,1,2]],5);
assert.equal(grouped.length,2,'two nearby cells share a 4° block, the far one stands alone');
assert.equal(grouped.find(b=>b.cells.length===2).records,39);
assert.equal(context.bubbles([[33,128,1,9],[35,129,1,30],[37,131,1,2]],6).length,3,'zoom 6 uses 2° blocks');
// Zoomed in: no tag on the cells (2026-10-13 design 2, reverses PR #122); one chip over the map names the species with its
// cells, records and years, the same values as the numbers under the map. The species BBVI stays in the bubble tooltip.
markers.length=0;dots.length=0;context.mapStub.zoom=7;context.draw(species,'#123456');
assert.equal(markers.filter(m=>/bbvi-tag/.test(m.options.icon?.className)).length,0,'no per-cell BBVI tag');
assert.equal(nodes.get('map-chip').hidden,false);
// 2026-10-15 탐색 지도 시안: the chip reads '공개 셀 N개 · 기록 N건'; the years move to its title (still under the map)
assert.equal(nodes.get('map-chip').innerHTML,'<i class="mc-dot none" aria-hidden="true"></i><b>시험 종</b> <span class="mc-sep" aria-hidden="true">·</span> <span>공개 셀 1개 · 기록 500건</span>','no type without a report rule: grey dot');
assert.equal(nodes.get('map-chip').title,'기록 연도 2015–2020');
assert.deepEqual([nodes.get('map-cells').textContent,nodes.get('map-count').textContent,nodes.get('map-years').textContent],[1,'500','2015–2020']);
assert.equal(nodes.get('key-bubble-mark').hidden,true);assert.equal(nodes.get('key-dot-mark').hidden,false);
assert.equal(nodes.get('map-symbol-label').textContent,'점선 = 4° 셀 · 점 = 기록 수 구간(도식)\n기록이 있는 칸의 위치(넓게 묶음)','the cell size comes from the cells');
assert.equal(context.tag({assessment:{scores:{BBVI:51.54},bbvi_label:'단일 논문'}}),'BBVI 52','the value alone (2026-10-17: evidence labels stay off the screen), a whole number (2026-10-19)');
assert.equal(context.tag({assessment:{scores:{}}}),'BBVI —');
// A cell's species summary: confirmed, usable, conservation priority (2026-10-17: no evidence-gap count).
const gap={label:'근거 부족 종',assessment:{scores:{BBVI:20},priority_survey:true}}, none={label:'평가 없음 종'};
const sum=context.summary([species,gap,none]);
assert.match(sum,/<b>3<\/b><span>확인 종/);assert.match(sum,/<b>1<\/b><span>활용 지표 높은 종/);
assert.match(sum,/<b>1<\/b><span>보전 지표 높은 종/);
assert.doesNotMatch(sum,/<span>근거 부족 종<\/span>|근거 부족\(|우선 조사/,'no evidence-gap tile or list');
assert.equal(context.summary([]),'');
vm.runInContext('data={species:[globalThis.species]}',context);
popup.length=0;context.draw(species,'#123456');
assert.match(popup[0],/cell-summary/,'cell popup opens with the species summary');
assert.doesNotMatch(popup[0],/BBVI 90/,'the popup keeps status-only species axes');
vm.runInContext('data=undefined',context);
dots.length=0;context.mapStub.zoom=5;
dots.length=0;context.mapStub.zoom=8;context.draw(species,'#123456');
assert.ok(dots.every(d=>d.options.radius<=3),'zoom 8 dots never become oversized');
context.mapStub.zoom=7;
dots.length=0;
vm.runInContext("basemap='satellite'",context);
context.draw(species,'#123456');
assert.ok(dots.every(d=>d.options.radius<=2.6&&d.options.interactive===false));
assert.ok(dots.every(d=>d.options.color==='#ffffff'&&d.options.weight===.65),'light rim keeps small dots visible on satellite/depth backgrounds');
vm.runInContext("basemap='basic'",context);
// A-3: GBIF sensitive-species vocabulary; 4° cells say they are wider than GBIF's strictest level.
vm.runInContext('globalThis.gen=generalizationNote;globalThis.pv=periodView;globalThis.csv=cellCsv;globalThis.eff=effortFor;globalThis.effLine=effortLine',context);
assert.match(context.gen(1),/dataGeneralizations: 좌표를 1° 셀로 일반화, 좌표 이동·무작위화 없음/);
assert.match(context.gen(1),/informationWithheld: 원좌표·기록 ID 비공개/);
assert.match(context.gen(4),/가장 엄격한 등급\(1°\)보다 넓은 4° 셀/);
// B-1: effort sums the 1° cells inside a cell; unknown without the snapshot.
assert.equal(context.eff(34,126,1),null);
vm.runInContext("effortData={startdate:'2000-01-01',cells:[{lat0:34,lon0:126,records:10},{lat0:35,lon0:127,records:5},{lat0:40,lon0:126,records:99}]}",context);
assert.equal(context.eff(34,126,1),10);
assert.equal(context.eff(32,124,4),15,'a 4° cell sums its 16 one-degree cells');
assert.match(context.effLine(34,126,1),/조사량 참고: 이 셀 범위의 OBIS 전체 종 기록 10건\(2000년 이후\)$/);
// A-5: period filter keeps only that period's rows; an unknown period falls back to all rows.
const two={live:true,cells:[cell,{...cell,period:'2021–2026'}]};
vm.runInContext("periodFilter='2021–2026'",context);
assert.equal(context.pv(two).cells.length,1);
vm.runInContext("periodFilter='1900–1901'",context);
assert.equal(context.pv(two).cells.length,2);
vm.runInContext("periodFilter='all'",context);
// A-5: CSV = the public aggregates only (cell range, counts, sources), with BOM and quoting.
const csvText=context.csv({live:true,label:'시험, "종"',name:'Accepted species',aphiaID:123,cells:[cell]});
assert.ok(csvText.startsWith('﻿"species_label"'));
const csvRows=csvText.slice(1).split('\r\n');
assert.equal(csvRows.length,2);
assert.equal(csvRows[1],'"시험, ""종""","Accepted species","123","34","35","128","129","1","2015–2020","2015","2020","9","2","Provider","CC BY 4.0","43","공개 집계 셀 · 기록이 있는 칸의 위치(넓게 묶음) · 지표는 종 단위 값"');
console.log('PASS: selected occurrences and unapproved spatial decisions remain separate');
