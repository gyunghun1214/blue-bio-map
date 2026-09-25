import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const report=()=>structuredClone(original);
const sp=(aphiaID,name,label)=>({aphiaID,name,label,live:true});
const all=()=>original.species.map(s=>sp(s.aphia_id,s.scientific_name,s.korean_name));
const ctx={fetch:async()=>({status:200,ok:true,json:async()=>report()})};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+`;
  globalThis.attach=attachPilotAssessments;
  globalThis.score=pilotScore;
  globalThis.renderScores=renderVerifiedIndices;`,ctx);

let next={live:true,species:all()};
await ctx.attach(next);
const by=aphia=>next.species.find(s=>s.aphiaID===aphia);
// Every value shown in the browser equals the reproducible report (score trace <-> screen match).
for(const s of original.species)for(const axis of ['MFPI','MBPI','MCUI','BBVI'])
  assert.equal(ctx.score(by(s.aphia_id),axis),s.scores[axis],`${s.korean_name} ${axis}`);
assert.equal(ctx.score(by(836033),'MFPI'),65.5);
assert.equal(ctx.score(by(241776),'MCUI'),80);
assert.equal(ctx.score(by(836033),'BBVI'),null,'one axis cannot become combined BBVI');
ctx.next=next;
vm.runInContext('data=globalThis.next',ctx);

let html=ctx.renderScores(by(836033));
for(const text of ['9.66 g','8.72 mg','15.9 mg','K4040020000a','rda-10.4-raw-marine-animals','25개 식품','자료 신뢰도 감점','가식부 16.0%','교차 점검','65.6','검증 전 시범 지표','비교하지 않습니다'])
  assert.ok(html.includes(text),`missing visible trace: ${text}`);
assert.match(html,/BBVI.*산출 보류/s);
html=ctx.renderScores(by(506159));
assert.match(html,/아연 결측\(빈칸\)/,'blank zinc shown as missing, not zero');
assert.match(html,/빈칸은 0이 아니라 결측/);
html=ctx.renderScores(by(241776));
for(const text of ['EN A2bd','2025-09-30','EN -&gt; 80','IUCN 기반 시범 MCUI, 출현 추세 교차검증 미완료','이전 평가'])
  assert.ok(html.includes(text),`missing conservation fact: ${text}`);
html=ctx.renderScores(by(342067));
assert.match(html,/Needs updating/);assert.match(html,/10년 넘은 평가/);
assert.match(html,/구조 ID ✗/,'bioactivity chain step shown');
html=ctx.renderScores(by(145721));
assert.match(html,/공식 NE 범주나 낮은 점수가 아닙니다/);
assert.match(html,/결과 0건/);

const bad=report();
bad.species.find(s=>s.aphia_id===836033).scores.MFPI=99;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>bad});
next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'browser must reject score that differs from its trace');
const badMcui=report();
badMcui.species.find(s=>s.aphia_id===241776).scores.MCUI=60;
ctx.fetch=async()=>({status:200,ok:true,json:async()=>badMcui});
next={live:true,species:[sp(241776,'Apostichopus japonicus','해삼')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'MCUI must equal the pilot mapping of its IUCN category');
const noName=report();
noName.species.find(s=>s.aphia_id===836033).scientific_name='Another oyster';
ctx.fetch=async()=>({status:200,ok:true,json:async()=>noName});
next={live:true,species:[sp(836033,'Magallana gigas','참굴')]};await ctx.attach(next);
assert.equal(next.species[0].assessment,undefined,'accepted taxon join needs both name and AphiaID');
console.log('PASS: v2 report joins, screen values equal report, MFPI/MCUI traces, blank-as-missing, IUCN states, inconsistent-score guards');
