// 2026-10-15 (개선 프롬프트 6): the OBIS trend is shown per species although its MCUI adjustment is off since 4.11. The species
// profile carries the class, the effort-corrected ratio, the dominant-dataset check and the '점수 미반영' label; a decline signal
// with an MCUI under the matrix line is marked ⚠ on its matrix point and listed in the method tab. No score or type changes.
// 2026-10-17 (LKH): the trend is no longer drawn (no profile block, no ⚠, no method-tab list); the record keeps occurrence_trend
// and the renderers below stay defined (checked here) but are not called.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('dist/app.js'), html=read('dist/index.html');
const report=JSON.parse(read('dist/assessments.json'));
const rows=[...report.species,...report.candidate_species];
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';globalThis.api={warn:obisWarn,profile:cpObisTrend,detail:occurrenceTrendDetail,off:obisOffLabel,list:obisWarnList};',ctx);
ctx.info={method:report.method,sources:report.sources,version:report.method_version};
ctx.rows=rows;
vm.runInContext('data={assessmentInfo:globalThis.info,species:globalThis.rows.map(a=>({label:a.korean_name,aphiaID:a.aphia_id,assessment:a}))}',ctx);
const sp=name=>({label:name,assessment:rows.find(a=>a.korean_name===name)});

// the facts the prompt names, read from the report
const anchovy=sp('멸치').assessment;
assert.equal(anchovy.occurrence_trend.class,'decline_signal');
assert.equal(anchovy.occurrence_trend.dataset_check.confirms_decline,true);
assert.equal(anchovy.occurrence_trend.mcui_adjustment,0);
assert.equal(anchovy.scores.MCUI,10);
assert.equal(report.method.conservation.effort_adjustment,0,'the OBIS adjustment stays off');
assert.equal(report.posthoc.validation_sets.MCUI_trend.result,'failed');

assert.equal(ctx.api.off(),'점수 미반영(4.11부터, 검증 실패)');
// the ⚠ list: decline signal and MCUI under the matrix line, nothing else
const cut=report.method.matrix.mcui_threshold;
const expected=rows.filter(a=>a.occurrence_trend.class==='decline_signal'&&a.scores.MCUI!==null&&a.scores.MCUI<cut).map(a=>a.korean_name).sort();
assert.deepEqual(ctx.api.list().map(s=>s.label).sort(),expected);
assert.deepEqual(expected,['가리맛조개','멸치','참조기']);
assert.equal(ctx.api.warn(sp('살오징어')),false,'살오징어 has a decline signal but its MCUI is above the line');
assert.equal(ctx.api.warn(sp('멍게')),false,'no MCUI, no ⚠');

// profile block for every species: class label and the suspension label; numbers only where a ratio exists
for(const a of rows){
  const s={label:a.korean_name,assessment:a},t=a.occurrence_trend,out=ctx.api.profile(s);
  assert.ok(out.includes('OBIS 출현 추세')&&out.includes(t.label)&&out.includes('점수 미반영(4.11부터, 검증 실패)'),`${a.korean_name}: profile block`);
  if(Number.isFinite(t.reporting_rate_ratio))assert.ok(out.includes(`조사 노력 보정 보고율 비 <b>${t.reporting_rate_ratio.toFixed(2)}</b>`),`${a.korean_name}: ratio`);
  assert.equal(out.includes('⚠'),ctx.api.warn(s),`${a.korean_name}: ⚠ only on the list`);
  assert.ok(!/undefined|NaN|null/.test(out),`${a.korean_name}: no empty field`);
  assert.ok(ctx.api.detail(s).includes('점수 미반영(4.11부터, 검증 실패)'),`${a.korean_name}: detail label`);
}
const p=ctx.api.profile(sp('멸치'));
assert.ok(p.includes('감소 신호')&&p.includes('0.31')&&p.includes('주 데이터셋 감소 확인(0.20)')&&p.includes('<details class="cp-obis-more">'));

// 2026-10-17 (LKH): no matrix point, legend or method-tab line carries the trend; the method card keeps the KOSIS signal only
assert.doesNotMatch(app,/class="mp-obis"|OBIS 감소 신호 · MCUI/);
for(const fn of ['cpObisTrend','occurrenceTrendDetail','obisWarnList'])assert.equal(app.split(fn).length-1,1,`${fn} is defined and never called`);
for(const text of ['id="method-obis"','KOSIS 자원 감소 신호'])assert.ok(html.includes(text),`method tab: ${text}`);
for(const text of ['부분적으로','조사 노력이 줄어든 것을 생물이 줄어든 것으로 잘못 읽을 위험','id="obis-warn-list"','prereg-draft-independent-decline-2026-10-15.md','OBIS 출현 추세'])
  assert.ok(!html.includes(text),`method tab does not draw: ${text}`);
assert.ok(fs.existsSync(new URL('../research/verified-indices/prereg-draft-independent-decline-2026-10-15.md',import.meta.url)));
console.log(`ok OBIS trend display (${rows.length} species, ⚠ ${expected.join('·')})`);
