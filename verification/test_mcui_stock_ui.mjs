// verified-4.12 stock-decline signal on screen (prereg-4.12-2026-10-14): the browser re-derives every KOSIS number, label,
// score and the max from the yearly tonnes and the report's own rule, and refuses an MCUI that does not follow; the detail
// shows the catch line, the two means, the item link, the aquaculture share and where the number comes from
// (2026-10-17 (LKH): the stock-assessment state and the caution stay in the record).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('dist/app.js');
const report=JSON.parse(read('dist/assessments.json'));
const ctx={};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8'),ctx); // as on the page: language and dictionaries (i18n.js) before app.js
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(app.split('function setView')[0]+';globalThis.valid=verifiedConservationValid;globalThis.detail=stockDeclineDetail;'+
  'globalThis.recheck=stockDeclineRecheck;globalThis.change=stockChange;globalThis.band=stockBandLabel;globalThis.aux=mcuiAuxParts;globalThis.lead=stockLead;',ctx);
ctx.info={method:report.method,sources:report.sources,version:report.method_version};
vm.runInContext('data={assessmentInfo:globalThis.info,species:[]}',ctx);

const rule=report.method.mcui_stock_decline;
const rows=[...report.species,...report.candidate_species];
const by=name=>rows.find(a=>a.korean_name===name);
assert.equal(rows.length,30);
for(const a of rows){
  assert.ok(a.stock_decline,`${a.korean_name} has a stock record`);
  assert.ok(ctx.valid(a,report),`${a.korean_name} passes the browser re-check`);
}
// the three species whose MCUI moves (prereg 4), every other MCUI is the extinction-risk value
// 4.14 (prereg-4.14 3·4): 우뭇가사리's Russian list is a reference now, so its extinction-risk value is unknown (null) and the
// decline 80 is kept as a lower bound (at or above the matrix line 50)
// 4.17 (prereg-4.17 2): the Russian list is a preliminary assessment again (VU 60), and the decline 80 is the higher value
const moved={살오징어:[10,60,'어획량 급감',79.8],우뭇가사리:[60,80,'어획량 붕괴 수준',90.2],참조기:[10,35,'어획량 감소',31.4]};
for(const a of rows){
  const m=moved[a.korean_name];
  if(m){
    assert.deepEqual([a.mcui_extinction_risk,a.scores.MCUI,a.stock_decline.label,a.stock_decline.decline_pct,a.mcui_driver],[m[0],m[1],m[2],m[3],'stock_decline'],a.korean_name);
  }else{
    assert.equal(a.scores.MCUI,a.mcui_extinction_risk,a.korean_name);
    assert.ok(a.mcui_driver!=='stock_decline',a.korean_name);
  }
}
assert.equal(rows.filter(a=>a.stock_decline.score!==null).length,3);
assert.deepEqual(rows.filter(a=>a.stock_decline.match_level==='none').map(a=>a.korean_name).sort(),['감태','괭생이모자반']);
// 멍게 gets no stock score (aquaculture dominant); 4.19 (prereg-4.19 1) gives it the Rapid LC check, so its MCUI is that value
assert.equal(by('멍게').stock_decline.score,null,'멍게 has no stock score (aquaculture dominant)');
assert.equal(by('멍게').scores.MCUI,by('멍게').mcui_extinction_risk);

// tampering: every stored value is re-derived
const broken=(a,edit)=>{const b=structuredClone(a);edit(b,b.stock_decline);return ctx.valid(b,report);};
const squid=by('살오징어');
assert.equal(broken(squid,(b,d)=>{d.coastal_t[9]=120000;}),false,'a changed year is recomputed');
assert.equal(broken(squid,(b,d)=>{d.decline_pct=49;}),false,'the decline is recomputed');
assert.equal(broken(squid,(b,d)=>{d.score=80;d.label='어획량 붕괴 수준';b.scores.MCUI=80;}),false,'the band follows the decline');
assert.equal(broken(squid,(b,d)=>{b.scores.MCUI=10;}),false,'the MCUI is the higher value');
assert.equal(broken(squid,(b,d)=>{b.mcui_driver='extinction_risk';}),false,'the driver says which value won');
assert.equal(broken(squid,(b,d)=>{b.mcui_extinction_risk=60;b.mcui_driver='tie';}),false,'the extinction-risk value keeps its own check');
assert.equal(broken(squid,(b,d)=>{d.not_iucn=false;}),false,'the record says it is not an IUCN assessment');
assert.equal(broken(squid,(b,d)=>{delete b.stock_decline;}),false,'a 4.12 report needs the record');
assert.equal(broken(squid,(b,d)=>{b.source_ids=b.source_ids.filter(x=>x!==rule.source.id);}),false,'the KOSIS source is cited');
// a broader item is capped at 60: 우뭇가사리 read as a broader link must not keep 80
assert.equal(broken(by('우뭇가사리'),(b,d)=>{d.match_level='broader';}),false,'a broader link is capped at 60');
assert.deepEqual({...ctx.recheck({...by('우뭇가사리').stock_decline,match_level:'broader',score:60,label:'어획량 급감',capped_broader:true},rule)},{score:60});
// 4.14: the lower bound needed its role; 4.17: the range-state list is the preliminary extinction-risk value, so a 4.14
// lower bound (no basis, no extinction-risk value) is refused, and so is a state claiming an official category
assert.equal(broken(by('우뭇가사리'),b=>{b.mcui_extinction_risk=null;b.mcui_basis=null;b.conservation_status.mcui_role='stock_decline_lower_bound';}),false,'a preliminary list is not dropped to a lower bound');
assert.equal(broken(by('우뭇가사리'),b=>{b.conservation_status.state='official_scored';b.conservation_status.label='공식 평가';}),false,'a range-state list is never an official category');
// the unscored reasons come back from the numbers: aquaculture first, then the small baseline
assert.equal(broken(by('톳'),(b,d)=>{d.unscored_reason=null;d.score=60;d.label='어획량 급감';}),false,'aquaculture-dominant items get no score');
assert.equal(broken(by('꼬시래기'),(b,d)=>{d.unscored_reason='aquaculture_dominant';d.label=rule.labels.aquaculture_dominant;}),false,'the small-catch reason is recomputed');
// a report without the rule refuses records it does not define
const old=structuredClone(report);delete old.method.mcui_stock_decline;
assert.equal(ctx.valid(squid,old),false);

// wording: catch change with its sign, never an IUCN category name
assert.equal(ctx.change({decline_pct:79.8}),'−79.8%');
assert.equal(ctx.change({decline_pct:-28.6}),'+28.6%');
for(const a of rows)assert.doesNotMatch(a.stock_decline.label,/\b(?:LC|NT|VU|EN|CR)\b|위급|위기|취약/,a.korean_name);

// detail: the catch line, the means, the link level, the share, the 2025p note, the stock-assessment state and the caution
const html=ctx.detail({label:'살오징어',assessment:squid});
for(const text of ['자원 감소 신호 · KOSIS 어획량 추세','어획량 감소 신호(50% 이상) · 60.0점','IUCN LC 10.0 · 어획량 감소 신호 60.0 → 높은 값 60.0',
  '기준 평균 121,486톤(2015~17) → 최근 평균 24,507톤(2022~24)','(−79.8%)','KOSIS 품종 살오징어(오징어) · 연결 종 단위','최근 3년 양식 비중 0.0%',
  '2025년 잠정치 31,006톤(점수 미사용)','KOSIS 어획량 통계로 계산한 값입니다(IUCN 기준 A의 30·50·80% 구간 적용)','class="sd-spark scored"','class="sd-ref"'])
  assert.ok(html.includes(text),`살오징어 detail: ${text}`);
assert.ok(rule.caution&&!html.includes(rule.caution)&&!html.includes('확인 전'),'the caution and the assessment state stay in the record');
// a species with no KOSIS item gets no block at all (2026-10-17 (LKH): no gap line); the record keeps the reason
const kelp=ctx.detail({label:'감태',assessment:by('감태')});
assert.ok(kelp===''&&by('감태').stock_decline.unscored_reason==='no_match','감태: no item, no line');
const wakame=ctx.detail({label:'미역',assessment:by('미역')});
assert.ok(wakame.includes('양식 위주 · 해당 없음')&&wakame.includes('감소율은 참고로 적습니다')&&!wakame.includes('sd-compare'),'미역: aquaculture, no compare line');
// 2026-10-21 (site v4 05): a species farmed far more than caught shows the last year's farming and catch, from the same series
const abalone=ctx.detail({label:'전복',assessment:by('전복(종 수준)')});
assert.ok(abalone.includes('<p class="sd-latest">2024년 양식 23,491톤 · 연근해 어획 94톤 · 2025년 잠정 양식 27,376톤 (KOSIS 어업생산동향조사)</p>'),'전복: 2024 farming and catch');
const ab=by('전복(종 수준)').stock_decline;
assert.equal(ab.aquaculture_t.at(-1),23491);assert.equal(ab.coastal_t.at(-1),94);assert.equal(ab.reference_2025p.aquaculture_t,27376);
for(const a of rows){const has=ctx.detail({label:a.korean_name,assessment:a}).includes('sd-latest');
  assert.equal(has,a.stock_decline.unscored_reason==='aquaculture_dominant',`${a.korean_name}: latest-year line only for farming-led species`);}
assert.ok(!html.includes('sd-latest'),'살오징어: no latest-year line');
assert.ok(!ctx.detail({label:'전복',assessment:{...by('전복(종 수준)'),stock_decline:{...ab,aquaculture_t:[...ab.aquaculture_t.slice(0,-1),null]}}}).includes('sd-latest'),'a gap hides the line');
// 2026-10-21 (site v4 06): the bands are shown as '어획량 감소 신호(N% 이상)'; the report keeps its band words, the screen never
// says '붕괴' or '급감', and every decline number on the aux line names KOSIS, with the 2025 provisional catch beside it
assert.deepEqual(rule.bands.map(b=>ctx.band({label:b.label})),['어획량 감소 신호(30% 이상)','어획량 감소 신호(50% 이상)','어획량 감소 신호(80% 이상)']);
assert.equal(ctx.band({label:rule.labels.no_signal}),rule.labels.no_signal);
for(const a of rows){const sp={label:a.korean_name,assessment:a},d=a.stock_decline;
  const screen=[ctx.detail(sp),ctx.detail(sp,true),ctx.aux(sp).join(' · '),d.score!==null&&a.mcui_driver==='stock_decline'?ctx.lead(sp):''].join('\n');
  for(const w of ['붕괴','급감'])assert.ok(!screen.includes(w),`${a.korean_name}: no '${w}' on screen`);
  if(Number.isFinite(d.decline_pct)&&d.match_level!=='none'){const line=ctx.aux(sp).find(x=>x.startsWith('어획량 변화'));
    assert.ok(line.includes(`${ctx.change(d)} (KOSIS 어획량 통계)`),`${a.korean_name}: ${line}`);
    if(Number.isFinite(d.reference_2025p?.coastal_t))assert.ok(line.includes(`2025년 잠정 ${d.reference_2025p.coastal_t.toLocaleString()}톤`),`${a.korean_name}: 2025p`);}}
assert.ok(ctx.lead({label:'우뭇가사리',assessment:by('우뭇가사리')}).includes('어획량 감소 신호(80% 이상) 80.0점'),'우뭇가사리 lead');
for(const f of ['dist/index.html','dist/expedition.html','dist/expedition.js','dist/app.js','dist/chatbot.js'])assert.ok(!read(f).includes('붕괴'),`${f}: no '붕괴'`);
console.log('PASS: stock-decline re-check (30 species, 3 MCUI moves) · tampered years, decline, band, max, driver, cap, reasons and source refused · wording and detail');
