// origin-class-rule-2026-10-15: dist/origin-review.json puts '⚠ class · reason' under each suspect MBPI item, and the species
// profile and the folded MBPI detail say whether the top item's origin is confirmed, with the MBPI of confirmed items only as a
// reference. It changes no score, label, matrix type or card. Schema gate as for the other display files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('origin-review.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.rows=originRows;globalThis.top=originTopText;globalThis.flag=originFlag;globalThis.cp=cpOrigin;globalThis.detail=originDetail;'+
  'globalThis.trace=verifiedBioTrace;globalThis.cardLine=evidenceCardLine;'+
  'globalThis.setData=d=>{data=d};globalThis.setFile=f=>{originReview=originRows(f,[])};'+
  'globalThis.axis=axisState;globalThis.type=matrixType;globalThis.label=bbviLabel;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,label:a.korean_name,name:a.scientific_name,cells:[],
  assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{version:report.method_version,method:report.method,sources:report.sources}});
const by=n=>species.find(s=>s.label.startsWith(n));

assert.equal(file.schema_version,'origin-review-1');
assert.equal(file.display_only,true);
assert.equal(file.report_version,report.method_version);
assert.equal(file.species.length,species.length);

// Scores, labels, matrix types and cards are the same with no file, with the file and with every item suspect.
const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s),ctx.cardLine(s)].join('|')).join('\n');
ctx.setFile(null);const none=snap();
assert.equal(ctx.top(by('멍게')),'');assert.equal(ctx.cp(by('멍게')),'');assert.ok(!ctx.trace(by('멍게')).includes('origin-flag'));
ctx.setFile({...file,species:file.species.map(r=>({...r,top_origin:'suspect',items:r.items.map(i=>({...i,origin_class:'unknown',confirmed:false}))}))});
assert.equal(snap(),none);
ctx.setFile(file);assert.equal(snap(),none);

// Each suspect item shows one '⚠' line in the evidence list (the list shows the 12 strongest items); confirmed items none.
for(const r of file.species){
  const s=species.find(x=>x.aphiaID===r.aphia_id), html=ctx.trace(s);
  const shown=[...s.assessment.bioactivity_trace].sort((x,y)=>y.adjusted-x.adjusted).slice(0,12);
  const want=shown.filter(x=>!r.items.find(i=>i.key===x.stratum_id+'|'+(x.compound_id||x.record_ids[0])).confirmed).length;
  assert.equal((html.match(/class="fine origin-flag"/g)||[]).length,want,s.label);
  const t=ctx.top(s);
  if(r.top_origin==='confirmed')assert.equal(t,'최상위 근거 기원: 확인됨',s.label);
  else assert.match(t,new RegExp(`^최상위 근거 기원: 의심\\(${file.classes[r.top_origin_class].replace(/[()·]/g,'.')}\\) · 참고: `),s.label);
  assert.ok(ctx.detail(s).includes('<b>화합물 기원</b>'),s.label);
}
assert.equal(ctx.top(by('미역')),'최상위 근거 기원: 확인됨');
assert.equal(ctx.top(by('다시마')),'최상위 근거 기원: 의심(추출·가공 중 생성 가능) · 참고: 기원 확인 항목 없음');
assert.match(ctx.top(by('바지락')),/^최상위 근거 기원: 의심\(먹이·공생균·미생물 유래 가능\) · 참고: 기원 확인 항목만 MBPI \d/);
assert.match(ctx.cp(by('멍게')),/^<p class="cp-origin suspect"><span aria-hidden="true">⚠ <\/span>최상위 근거 기원: 의심/);
assert.match(ctx.flag(by('다시마'),by('다시마').assessment.bioactivity_trace[0]),/⚠ 추출·가공 중 생성 가능<\/b> · 푸코스테롤/);
// a report outside the verified line shows nothing
const kelp=by('다시마');
assert.equal(ctx.top({...kelp,assessment:{...kelp.assessment,report_version:'pilot-1'}}),'');

// Schema gate: a newer schema is reported and not read, an unknown one is ignored, a file not marked display-only is ignored.
let out=[];assert.equal(ctx.rows({...file,schema_version:'origin-review-2'},out).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'origin-review.json',version:'origin-review-2'}]);
out=[];assert.equal(ctx.rows({...file,schema_version:'other'},out).size,0);assert.equal(out.length,0);
assert.equal(ctx.rows({...file,display_only:false},[]).size,0);
assert.equal(ctx.rows({...file,species:[{...file.species[0],items:[{...file.species[0].items[0],origin_class:'other'}]}]},[]).size,0);
console.log(`origin review UI: ${file.species.length} species, ${file.summary.suspect_items} suspect items, top suspect ${file.summary.top_suspect_species.length} species, scores unchanged`);
