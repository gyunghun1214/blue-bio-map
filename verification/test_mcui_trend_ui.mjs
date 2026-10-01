// verified-pilot-3.4 OBIS trend on screen: the browser re-check re-derives each class from its counts and rejects
// a changed class, label, adjustment or count; the MCUI detail shows class, counts, interval and the MCUI effect.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const report=JSON.parse(fs.readFileSync(new URL('../dist/assessments.json',import.meta.url),'utf8'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';globalThis.valid=verifiedConservationValid;globalThis.trendDetail=occurrenceTrendDetail;',ctx);
ctx.info={method:report.method,sources:report.sources};
vm.runInContext('data={assessmentInfo:globalThis.info}',ctx);

const rows=[...report.species,...report.candidate_species];
assert.equal(rows.length,30);
for(const a of rows){
  assert.ok(a.occurrence_trend,`${a.korean_name} has a trend record`);
  assert.ok(ctx.valid(a,report),`${a.korean_name} passes the browser re-check`);
}
const rule=report.method.conservation.trend;
const pick=cls=>rows.find(a=>a.occurrence_trend.class===cls&&a.scores.MCUI!==null)||rows.find(a=>a.occurrence_trend.class===cls);
const broken=(a,change)=>{const b=structuredClone(a);change(b,b.occurrence_trend);return ctx.valid(b,report);};

const declined=rows.find(a=>a.occurrence_trend.mcui_adjustment>0);
if(declined){
  assert.equal(declined.scores.MCUI,Math.min(100,declined.occurrence_trend.mcui_base+report.method.conservation.effort_adjustment));
  assert.equal(broken(declined,(b,t)=>{t.mcui_adjustment=0;}),false,'a decline signal cannot drop its adjustment');
  assert.equal(broken(declined,(b,t)=>{t.species_records.recent=t.species_records.past;}),false,'counts must give the published ratio');
  assert.equal(broken(declined,(b,t)=>{t.class='survey_gap';t.label=rule.labels.survey_gap;}),false,'the class follows the counts');
  assert.equal(broken(declined,b=>{b.scores.MCUI=b.occurrence_trend.mcui_base;}),false,'MCUI must include the published adjustment');
}
for(const cls of Object.keys(rule.labels)){
  const a=pick(cls);
  if(!a)continue;
  assert.equal(broken(a,(b,t)=>{t.label='x';}),false,`${cls}: label follows the class`);
  if(cls!=='decline_signal')assert.equal(broken(a,(b,t)=>{t.mcui_adjustment=10;}),false,`${cls}: never adjusts MCUI`);
}
// no MCUI is ever created by a trend
for(const a of rows.filter(a=>a.occurrence_trend.mcui_base===null))assert.equal(a.scores.MCUI,null,`${a.korean_name}: no MCUI from a trend alone`);
// an older report without the rule keeps working, and a 3.4 row without its trend is rejected
const older=structuredClone(report);delete older.method.conservation.trend;
const plain=structuredClone(rows.find(a=>a.scores.MCUI!==null&&!a.occurrence_trend.mcui_adjustment));delete plain.occurrence_trend;
assert.ok(ctx.valid(plain,older),'a report without the trend rule is checked as before');
assert.equal(ctx.valid(plain,report),false,'a 3.4 row must carry its trend');

// Screen text
for(const a of rows){
  const html=ctx.trendDetail({assessment:a});
  const t=a.occurrence_trend;
  for(const text of ['OBIS 출현 추세',t.label,`${t.species_records.past}건`,`${t.species_records.recent}건`,'개체수·자원량이 아니며'])
    assert.ok(html.includes(text),`${a.korean_name} shows ${text}`);
  if(t.mcui_adjustment)assert.ok(html.includes(`+${t.mcui_adjustment}를 더했습니다`),`${a.korean_name} states the MCUI effect`);
  if(t.mcui_base===null)assert.ok(html.includes('MCUI를 만들지 않습니다'),`${a.korean_name} says no MCUI is created`);
  assert.ok(!/undefined|NaN/.test(html),`${a.korean_name}: no empty field`);
}
console.log(`ok MCUI trend UI (${rows.length} species)`);
