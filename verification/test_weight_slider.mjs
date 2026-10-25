// BBVI 통합 가중치 slider (2026-10-13), offline on dist/live-snapshot.json the way test_compare_ui runs it:
// the two shown weights add up to 1.00 at every step; w = 0 / 0.5 / 1 give MBPI / the report BBVI / MFPI and w = 0.25 / 0.75
// match the report's sensitivity values within 0.1 (both sides round to one decimal); a held BBVI stays held; the official
// value is named beside a re-mixed one and nowhere at the official weight; the list of species whose type moved matches an
// independent count; a link's w is read leniently (out of range or not a number = official) and the official weight never goes into the link.
// Run: node verification/test_weight_slider.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const app=read('app.js'), cut=app.indexOf('let startHash={};');
assert.ok(cut>0,'page bootstrap marker in app.js');
const nodes=new Map();
const el=()=>({innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(k,v){this['@'+k]=v},getAttribute(k){return this['@'+k]??null},removeAttribute(){},toggleAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
  scrollIntoView(){},contains(){return false},focus(){},getBoundingClientRect(){return {height:0}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
let lastHash='';
const ctx={AbortSignal,structuredClone,console,URLSearchParams,document:{getElementById:$,querySelector:el,querySelectorAll(){return []},activeElement:null},
  window:{addEventListener(){}},location:{hash:'',pathname:'/'},history:{replaceState(a,b,h){lastHash=h;}},requestAnimationFrame(){},matchMedia:()=>({matches:false}),
  fetch:async u=>{u=String(u);if(u.startsWith('https://'))throw TypeError('offline');
    const f=new URL(u.split('?')[0],D), ok=fs.existsSync(f);return {ok,status:ok?200:404,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))};}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8'),ctx); // as on the page: language and dictionaries (i18n.js) before app.js
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(read('live-data.js')+'\n'+app.slice(0,cut)+';globalThis.T={pilotScore,scoreText,matrixType,officialType,officialBbvi,officialNote,weightPair,weightOff,weightStep,hashWeightStep,'+
  'assessedForMatrix,syncWeightControl,writeHash,renderComparison,set w(v){bbviWeight=v},get w(){return bbviWeight},set selected(v){selected=v}};',ctx);
const T=ctx.T;
const data=await vm.runInContext(`(async()=>{const next=await loadPublishedProfiles();next.outdated??=[];await attachPilotAssessments(next);return data=next;})()`,ctx);
const S=data.species, report=JSON.parse(read('assessments.json'));
const rows=new Map([...report.species,...report.candidate_species].map(r=>[r.aphia_id,r]));
const scored=S.filter(s=>T.pilotScore(s,'BBVI')!==null);
assert.ok(scored.length>=8,'snapshot has BBVI species');
assert.equal(data.assessmentInfo.foodWeight,0.5,'the report weight is the official one');

// (1) every step: "MBPI a · MFPI b" with a + b = 1.00 exactly (two decimals)
for(let k=0;k<=20;k++){
  const [, a, b]=T.weightPair(k/20).match(/^MBPI (\d\.\d\d) · MFPI (\d\.\d\d)$/);
  assert.equal((Math.round(Number(a)*100)+Math.round(Number(b)*100)),100,`step ${k}: ${a} + ${b}`);
  assert.equal(b,(k/20).toFixed(2));
}

// (2) end points and the report: w = 0 → MBPI, w = 1 → MFPI, w = 0.5 → report BBVI, 0.25 / 0.75 → report sensitivity
const at=(w,fn)=>{T.w=w;try{return fn();}finally{T.w=.5;}};
for(const s of scored){
  const r=rows.get(s.aphiaID), f=T.pilotScore(s,'MFPI'), b=T.pilotScore(s,'MBPI');
  assert.equal(at(0,()=>T.pilotScore(s,'BBVI')),b,`${s.label}: w 0 = MBPI`);
  assert.equal(at(1,()=>T.pilotScore(s,'BBVI')),f,`${s.label}: w 1 = MFPI`);
  assert.equal(T.pilotScore(s,'BBVI'),r.scores.BBVI,`${s.label}: w 0.5 = report BBVI`);
  for(const w of ['0.25','0.75'])assert.ok(Math.abs(at(Number(w),()=>T.pilotScore(s,'BBVI'))-r.sensitivity.food_weights[w])<=.1+1e-9,`${s.label}: w ${w} = report sensitivity`);
}

// (3) a BBVI the report held stays held at every weight
{const held=structuredClone(scored[0]);held.assessment.score_status.BBVI='산출 보류';held.assessment.scores.BBVI=null;
  for(let k=0;k<=20;k++)assert.equal(at(k/20,()=>T.pilotScore(held,'BBVI')),null,`held BBVI at step ${k}`);}

// (4) the official value: never at the official weight, '공식 xx.x' (the report BBVI) where a re-mix differs
assert.equal(T.weightOff(),false);
assert.ok(S.every(s=>T.officialNote(s)===''),'no official note at the official weight');
at(.8,()=>{
  assert.equal(T.weightOff(),true);
  for(const s of scored){const o=rows.get(s.aphiaID).scores.BBVI, now=T.pilotScore(s,'BBVI');
    assert.equal(T.officialBbvi(s),o);assert.equal(T.officialNote(s),now===o?'':`공식 ${T.scoreText(s,'BBVI',o)}`,s.label);}  // 4.16: whole number without a replicated top item
  T.renderComparison();
  assert.ok($('comparison').innerHTML.includes('class="cv-official">(공식 '),'table BBVI shows the official value');
});
T.renderComparison();
assert.ok(!$('comparison').innerHTML.includes('cv-official'),'no official value in the table at the official weight');

// (5) species whose type moved: same as an independent count from the report BBVI, MFPI, MBPI and the 50/50 rule
const rule=data.assessmentInfo.method.matrix;
const independent=w=>S.filter(s=>T.assessedForMatrix(s)).filter(s=>{const r=rows.get(s.aphiaID).scores,mix=Math.round((w*r.MFPI+(1-w)*r.MBPI)*10)/10;
  return (mix>=rule.bbvi_threshold)!==(r.BBVI>=rule.bbvi_threshold);}).map(s=>s.aphiaID).sort();
for(const w of [0,.2,.35,.8,1]){
  const moved=at(w,()=>S.filter(s=>T.matrixType(s)!==T.officialType(s)).map(s=>s.aphiaID).sort());
  assert.deepEqual(moved,independent(w),`moved types at w ${w}`);
  at(w,()=>{T.syncWeightControl();
    assert.equal($('bbvi-weight-moved').hidden,false);
    assert.ok($('bbvi-weight-moved').textContent.startsWith(moved.length?`공식값과 유형이 다른 종 ${moved.length}종: `:'모든 종이 공식값과 같은 유형입니다.'),$('bbvi-weight-moved').textContent);
    assert.equal($('bbvi-weight').getAttribute('aria-valuetext'),T.weightPair().replace(' · ',', '));});
}
console.log(`moved types: w 0.8 → ${independent(.8).length}종, w 0.2 → ${independent(.2).length}종 (of ${scored.length} BBVI species)`);
T.syncWeightControl();
assert.equal($('bbvi-weight-moved').hidden,true);assert.equal($('bbvi-weight').value,'10');assert.equal($('bbvi-weight-value').textContent,'MBPI 0.50 · MFPI 0.50');

// (6) the MBPI floor line shows only while some BBVI carries the floor (none in verified-4.11)
assert.equal($('bbvi-weight-floor').hidden,!S.some(s=>T.pilotScore(s,'BBVI')!==null&&s.assessment?.mbpi_floor));
{const s=scored[0],keep=s.assessment.mbpi_floor;s.assessment.mbpi_floor={value:0};T.syncWeightControl();
  assert.equal($('bbvi-weight-floor').hidden,false,'floor line with a floor BBVI');s.assessment.mbpi_floor=keep;T.syncWeightControl();}

// (7) the link: lenient read, official weight left out
for(const [v,k] of [['0.70',14],['0.72',14],['0',0],['1',20],['1.00',20],['abc',10],['2',10],['-1',10],['',10],[undefined,10],['0x1',20]])
  assert.equal(T.hashWeightStep(v),k,`w=${v}`);
T.selected=S[0];
T.writeHash();assert.ok(!/[#&]w=/.test(lastHash),'official weight stays out of the link: '+lastHash);
at(.7,()=>{T.writeHash();assert.ok(lastHash.includes('&w=0.70'),lastHash);});
at(.35,()=>{T.writeHash();assert.ok(lastHash.includes('&w=0.35'),lastHash);});

console.log('PASS: weights add up to 1.00 at 21 steps · w 0/0.5/1 = MBPI/report BBVI/MFPI and 0.25/0.75 = report sensitivity ±0.1 (all BBVI species) · held BBVI stays held · official value only off the official weight · moved-type list = independent count · floor line · link w read and written');
