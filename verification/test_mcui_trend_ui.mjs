// verified-pilot-3.4 OBIS trend on screen: the browser re-check re-derives each class from its counts (overall and inside
// the dominant dataset) and rejects a changed class, label, ratio, interval, base or adjustment; the MCUI detail shows the
// class, counts, recency, dataset check and MCUI effect; priority reasons are named.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('dist/app.js');
const report=JSON.parse(read('dist/assessments.json'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';globalThis.valid=verifiedConservationValid;globalThis.trendDetail=occurrenceTrendDetail;'+
  'globalThis.reasons=surveyReasonText;',ctx);
ctx.info={method:report.method,sources:report.sources,version:report.method_version};
vm.runInContext('data={assessmentInfo:globalThis.info,species:[]}',ctx);

const rows=[...report.species,...report.candidate_species];
assert.equal(rows.length,30);
for(const a of rows){
  assert.ok(a.occurrence_trend,`${a.korean_name} has a trend record`);
  assert.ok(ctx.valid(a,report),`${a.korean_name} passes the browser re-check`);
}
const rule=report.method.conservation.trend;
const broken=(a,change)=>{const b=structuredClone(a);change(b,b.occurrence_trend);return ctx.valid(b,report);};
const scored=rows.find(a=>Number.isFinite(a.occurrence_trend.reporting_rate_ratio)&&a.scores.MCUI!==null);
// independent review (wf_5d4c2352-11f): fields shown on screen are re-derived, not trusted
assert.equal(broken(scored,(b,t)=>{delete t.reporting_rate_ratio;}),false,'the ratio must be present and right');
assert.equal(broken(scored,(b,t)=>{t.ci=[1.2,1.9];}),false,'the interval is recomputed');
assert.equal(broken(scored,(b,t)=>{t.mcui_base=50;}),false,'the base is the category score');
assert.equal(broken(scored,(b,t)=>{t.effort_ratio=9;}),false,'the class-effort change is recomputed');
assert.equal(broken(scored,(b,t)=>{t.all_taxa_sensitivity.reporting_rate_ratio=0.1;}),false,'the all-taxa sensitivity is recomputed');
assert.equal(broken(scored,(b,t)=>{delete t.all_taxa_sensitivity;}),false,'the sensitivity must be present');
const checked=rows.find(a=>Number.isFinite(a.occurrence_trend.dataset_check?.reporting_rate_ratio));
assert.equal(broken(checked,(b,t)=>{t.dataset_check.confirms_decline=!t.dataset_check.confirms_decline;}),false,'the dataset check is recomputed');
assert.equal(broken(checked,(b,t)=>{t.dataset_check.species_records.recent+=50;}),false,'dataset counts must give the published ratio');

const declined=rows.find(a=>a.occurrence_trend.mcui_adjustment>0);
if(declined){
  assert.equal(declined.scores.MCUI,Math.min(100,declined.occurrence_trend.mcui_base+report.method.conservation.effort_adjustment));
  assert.ok(declined.occurrence_trend.dataset_check.confirms_decline,'a decline signal is confirmed inside the dominant dataset');
  assert.equal(broken(declined,(b,t)=>{t.mcui_adjustment=0;}),false,'a decline signal cannot drop its adjustment');
  assert.equal(broken(declined,(b,t)=>{t.class='survey_gap';t.label=rule.labels.survey_gap;}),false,'the class follows the counts');
  assert.equal(broken(declined,b=>{b.scores.MCUI=b.occurrence_trend.mcui_base;}),false,'MCUI must include the published adjustment');
}
for(const cls of Object.keys(rule.labels)){
  const a=rows.find(x=>x.occurrence_trend.class===cls&&x.scores.MCUI!==null)||rows.find(x=>x.occurrence_trend.class===cls);
  if(!a)continue;
  assert.equal(broken(a,(b,t)=>{t.label='x';}),false,`${cls}: label follows the class`);
  if(cls!=='decline_signal')assert.equal(broken(a,(b,t)=>{t.mcui_adjustment=10;}),false,`${cls}: never adjusts MCUI`);
}
for(const a of rows.filter(a=>a.occurrence_trend.mcui_base===null))assert.equal(a.scores.MCUI,null,`${a.korean_name}: no MCUI from a trend alone`);
// archived reports without the trend rule keep validating; a 3.4 row without its trend does not
const archived=JSON.parse(read('research/verified-indices/archive/assessments-verified-pilot-3.3.json'));
for(const a of [...archived.species,...archived.candidate_species])assert.ok(ctx.valid(a,archived),`3.3 archive ${a.korean_name} still validates`);
// 3.15 (team-lead decision 2026-10-02): reference only; a 3.14 report has no Rapid LC record and validates as before
const archived314=JSON.parse(read('research/verified-indices/archive/assessments-verified-pilot-3.14.json'));
for(const a of [...archived314.species,...archived314.candidate_species]){
  assert.equal(a.mcui_substitute,undefined);
  assert.ok(ctx.valid(a,archived314),`3.14 archive ${a.korean_name} still validates`);
}
const plain=structuredClone(rows.find(a=>a.scores.MCUI!==null&&!a.occurrence_trend.mcui_adjustment));delete plain.occurrence_trend;
assert.equal(ctx.valid(plain,report),false,'a 3.4 row must carry its trend');
// 3.15 (team-lead decision 2026-10-02): reference only. The Rapid LC record rides beside a withheld MCUI and is re-checked;
// a record that carries a value, a report that scores it, or a record below the published thresholds is refused.
const refRows=rows.filter(a=>a.mcui_substitute?.use==='reference_only');
assert.equal(refRows.length,14);
assert.ok(refRows.every(a=>a.scores.MCUI===null&&a.mcui_basis===null&&a.mcui_substitute.value===null&&a.withheld_reasons.MCUI==='not_in_red_list'));
const ref=refRows[0];
assert.equal(broken(ref,b=>{b.mcui_substitute.value=10;}),false,'a reference-only record carries no value');
assert.equal(broken(ref,b=>{b.scores.MCUI=10;b.score_status.MCUI='산출됨';b.withheld_reasons.MCUI=null;}),false,'a reference-only record never gives an MCUI');
assert.equal(broken(ref,b=>{b.mcui_basis='preliminary';}),false,'preliminary is not an MCUI basis');
assert.equal(broken(ref,b=>{b.mcui_substitute.record.records=b.mcui_substitute.record.thresholds.records-1;}),false,'the published thresholds are re-checked');
assert.equal(broken(ref,b=>{b.mcui_substitute.record.aoo_cells+=1;}),false,'AOO must equal its cells');
assert.equal(broken(ref,b=>{b.mcui_substitute.record.trend_class='decline_signal';}),false,'a decline signal is never likely LC');
assert.equal(broken(ref,b=>{b.mcui_substitute.source_ids=['missing_source'];}),false,'every source id must exist');
// attached only where the builder may attach one: never beside an IUCN or national assessment (the back-test's failure mode)
assert.equal(broken(ref,b=>{b.conservation_trace.iucn_state='assessed';b.conservation_trace.category='EN';b.withheld_reasons.MCUI='current_status_unverified';}),false,'never beside an IUCN assessment');
assert.equal(broken(ref,b=>{b.national_assessment={category:'EN'};}),false,'never beside a national assessment');
assert.equal(broken(ref,b=>{b.mcui_substitute.record.thresholds={...b.mcui_substitute.record.thresholds,eoo_km2:1};}),false,'the record carries the published thresholds');
assert.equal(broken(ref,b=>{b.mcui_substitute.record.trend_class=b.occurrence_trend?.class==='survey_gap'?'no_clear_decline':'survey_gap';}),false,'the record trend equals the re-checked trend');
assert.equal(broken(ref,b=>{delete b.mcui_substitute.record.native_box;}),false,'the range box must be present');

// Screen text
for(const a of rows){
  const html=ctx.trendDetail({assessment:a});
  const t=a.occurrence_trend;
  for(const text of ['OBIS 출현 추세',t.label,`${t.species_records.past}건`,`${t.species_records.recent}건`,'개체수·자원량이 아닙니다','분포 최신성','지도 범위 전체'])
    assert.ok(html.includes(text),`${a.korean_name} shows ${text}`);
  if(t.mcui_adjustment)assert.ok(html.includes(`+${t.mcui_adjustment}을 더했습니다`),`${a.korean_name} states the MCUI effect`);
  if(t.mcui_base===null)assert.ok(html.includes('MCUI를 만들지 않습니다'),`${a.korean_name} says no MCUI is created`);
  if(t.dataset_check)assert.ok(html.includes('과거 기록이 가장 많은 데이터셋'),`${a.korean_name} shows the dataset check`);
  assert.ok(!/undefined|NaN/.test(html),`${a.korean_name}: no empty field`);
}
// IUCN's own direction is shown when it disagrees with the OBIS result (e.g. 해삼 EN Decreasing)
const cucumber=rows.find(a=>a.aphia_id===241776);
if(!['decline_signal','decline_below_threshold'].includes(cucumber.occurrence_trend.class))
  assert.match(ctx.trendDetail({assessment:cucumber}),/IUCN 개체군 추세\(Decreasing\)와 OBIS 보고율 결과가 다릅니다/);
// priority reasons are named, both when a species has both
// 3.15 (team-lead decision 2026-10-02): reference only. A Rapid LC check gives no MCUI, so those species keep the
// no-assessment reason (8 of the 14 also have low information sufficiency) and no 'preliminary' reason exists.
assert.ok(rows.every(a=>!a.priority_survey_reasons.includes('preliminary_assessment_only')));
const both=rows.find(a=>a.priority_survey_reasons.length===2);
assert.match(ctx.reasons(both),/^정보충분도 낮음\(필수 입력 평균 \d+%, 기준 50% 미만\) · 보전 평가 없음\(IUCN·국가 평가 모두 없어 MCUI 미산출\)$/);
const onlyNoAssessment=rows.find(a=>a.priority_survey_reasons.join()==='no_conservation_assessment');
assert.equal(ctx.reasons(onlyNoAssessment),'보전 평가 없음(IUCN·국가 평가 모두 없어 MCUI 미산출)');
assert.equal(ctx.reasons({...onlyNoAssessment,priority_survey_reasons:['conservation_data_deficient']}),'IUCN 자료 부족(DD) · 국가 평가도 없어 MCUI 미산출');
assert.equal(rows.filter(a=>a.priority_survey).length,rows.filter(a=>a.priority_survey_reasons.length).length);
console.log(`ok MCUI trend UI (${rows.length} species)`);
