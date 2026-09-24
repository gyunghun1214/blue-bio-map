import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const pre=app.split('function setView')[0];
const mapCode='const REASONS='+app.split('const REASONS=')[1].split('function fitMap')[0];
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.match(html,/id="map-legend"/);
assert.match(html,/id="map-judgment"/);

const nodes=new Map();
const popup=[];
const context={
  document:{getElementById(id){
    if(!nodes.has(id))nodes.set(id,{textContent:'',nextElementSibling:{textContent:''}});
    return nodes.get(id);
  }},
  L:{rectangle(){
    return {addTo(){return this},bindPopup(body){popup.push(body);return this}};
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
context.mapStub={fitBounds(){}};
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
species.cells=[];
context.banner(species);
assert.match(nodes.get('map-judgment').textContent,/공개 출현 셀이 없어/);
console.log('PASS: selected occurrences and unapproved spatial decisions remain separate');
