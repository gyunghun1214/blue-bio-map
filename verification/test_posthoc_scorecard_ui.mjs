// 검증 기록: dist/posthoc-scorecard.json (built from posthoc.validation_sets by scripts/build_posthoc_scorecard.py). A same-data
// or two-species consistency check is never shown as 통과, and the file reaches no score, label or matrix type. Schema gate as
// for the other display files.
// 2026-10-16: the scorecard table (top of the method tab) and fold 05 (신청서 약속 대비 구현 현황표) were taken off the page.
// 2026-10-17 (LKH): no verification state on screen, passed or not; a badge left in the markup is hidden and empty.
// 2026-10-19 (LKH, 사이트 v3 1/10 '되살리기'): the records are on screen again, as one table in fold 04 of the method tab, under
// '03 지표를 어떻게 읽나요?': 지표 · 무엇을 확인했나 · 사전 등록 · 결과 · 그 뒤 처리, a count line above it, each row's record files
// linked on GitHub (the file's repository value), and the numbers a row quotes read from its record file by the build. The
// result reads in words as well as colour, and a consistency check never looks like 통과. The journey-card badges stay off.
// 2026-10-31 (LKH): fold 04 left the method tab again, with its table, the species detail's '검증 기록 보기' buttons and the
// page's load of posthoc-scorecard.json. The file, scripts/build_posthoc_scorecard.py, its --check and the research records
// stay, so this test still checks the file and now checks that the page draws none of it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n'); // a Windows checkout (CI) has CRLF
const app=read('app.js'), html=read('index.html'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('posthoc-scorecard.json'));
const els={};const el=id=>els[id]??={id,innerHTML:'',textContent:'',hidden:false,dataset:{},title:''};
const badges=['MFPI','MBPI','MCUI'].map(k=>({dataset:{ind:k},hidden:true,textContent:'',title:''}));
const ctx={document:{getElementById:el,querySelectorAll:sel=>sel.includes('mt-vbadge')?badges:[]}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8'),ctx); // as on the page: language and dictionaries (i18n.js) before app.js
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(app.split('function setView')[0]+';globalThis.render=renderVerifyBadges;',ctx);

// The file (kept in dist and rebuilt by the build's --check): display only, built for the published report, one row per
// stored check with the stored result, each row in one of the five result classes.
const OC={'통과':'pass','실패':'fail','실패 후 사용 중단':'stopped','일관성 확인(독립 아님)':'consistent','검증 불성립':'void'};
assert.equal(file.schema_version,'posthoc-scorecard-1');
assert.equal(file.display_only,true);
assert.equal(file.report_version,report.method_version);
const sets=report.method.posthoc.validation_sets;
assert.deepEqual(file.rows.map(r=>r.key).sort(),Object.keys(sets).sort());
for(const r of file.rows){assert.equal(r.result,sets[r.key].result,r.key);assert.ok(OC[r.outcome_class],r.key+': '+r.outcome_class);}
assert.equal(file.total,8);
assert.equal(file.repository,'https://github.com/gyunghun1214/blue-bio-map/blob/main/');
assert.ok(fs.existsSync(new URL('../research/method-changelog.json',import.meta.url)),'the ledger file exists');

// The badges: hidden and empty; the file still holds each indicator state.
ctx.render();
assert.deepEqual(badges.map(b=>[b.dataset.ind,b.hidden,b.textContent,b.title,b.dataset.state]),
  [['MFPI',true,'','',undefined],['MBPI',true,'','',undefined],['MCUI',true,'','',undefined]]);
assert.deepEqual(Object.fromEntries(Object.entries(file.indicators).map(([k,i])=>[k,i.state])),{MFPI:'passed',MBPI:'not_passed',MCUI:'limited'});
assert.equal(file.indicators.MCUI.classes['일관성 확인(독립 아님)'],2);
assert.ok(!/검증|실패|통과|제한적/.test(app.split('function renderVerifyBadges')[1].split('\n}')[0]),'the badge renderer writes no state words');
assert.deepEqual(Object.keys(els),[],'the badges write nothing else');

// 2026-10-31: the page draws none of the file and does not ask for it.
const css=read('method.css'), method=html.split('<section id="method"')[1].split('</section>\n</main>')[0];
const allCss=fs.readdirSync(new URL('../dist/',import.meta.url)).filter(f=>f.endsWith('.css')).map(read).join('\n');
for(const gone of ['id="mt-acc-04"','mt-ck','id="mt-checks"','data-go-checks','go-checks','검증 기록'])assert.ok(!html.includes(gone),'index.html: '+gone);
for(const gone of ['renderPosthocTable','posthocScorecard','scorecardFile','SCORECARD_OC','CHECK_COUNT_LABEL','openChecks','data-go-checks','go-checks','mt-ck','mt-checks',"'posthoc-scorecard.json'"])
  assert.ok(!app.includes(gone),'app.js: '+gone);
assert.ok(!read('live-data.js').includes('posthoc-scorecard.json'),'live-data.js: posthoc-scorecard.json is not fetched early');
assert.ok(!/\.mt-ck|\.go-checks/.test(allCss),'no .mt-ck or .go-checks style left');
const en=read('i18n-en.js');
for(const gone of ['"검증 기록":','"검증 기록 보기":','"검증 기록 {0}건":','"검증 기록을 불러오는 중입니다.":','지표의 해석 범위 · 검증 기록'])assert.ok(!en.includes(gone),'i18n-en.js: '+gone);
assert.ok(method.includes('<p>출처 · 산출 방법 · 지표의 해석 범위</p>'),'the detail heading names the three folds');

// The page: folds 01–03, fold 03 the last; still no scorecard at the top, no fold 05 and no badge; the hero is the first
// block of the method tab.
for(const gone of ['id="mt-scorecard"','mt-vc','VALIDATION SCORECARD','검증 성적표','id="mt-acc-05"','promise-table','promise-count','신청서 약속','구현 현황','data-alt-species'])
  assert.ok(!html.includes(gone),'index.html: '+gone);
for(const gone of ['renderScorecard','mt-vc-','#promise-table','promise-count','data-alt-species'])assert.ok(!app.includes(gone),'app.js: '+gone);
for(const gone of ['.mt-vc','.promise-table','.pt-s','.pt-'])assert.ok(!css.includes(gone),'method.css: '+gone);
// 2026-10-17 (LKH): the MCUI SCALE card left the top of the tab (markup and styles); the hero opens the tab and the 03 MCUI
// line no longer points to it (02 still gives LC 10 · NT 35 · VU 60 · EN 80 · CR 100)
assert.match(method,/^[^>]*>\n<div class="mt-hero">/);
for(const gone of ['mt-mcui-map','mt-mm-','MCUI SCALE','대응표는 이 탭'])assert.ok(!html.includes(gone)&&!css.includes(gone),'MCUI SCALE card: '+gone);
assert.ok(method.includes('범주 → 숫자는 LC 10 · NT 35 · VU 60 · EN 80 · CR 100'));
assert.deepEqual([...method.matchAll(/<details class="mt-acc" id="(mt-acc-\d+)"/g)].map(m=>m[1]),['mt-acc-01','mt-acc-02','mt-acc-03']);
const f3=method.indexOf('id="mt-acc-03"');
assert.ok(method.slice(f3,f3+300).includes('지표를 어떻게 읽나요?'));
assert.ok(/<\/details>\n<\/section>\n<div class="source-section" id="mt-sources">/.test(method),'fold 03 closes the detail section, the sources follow');
assert.ok(!html.includes('id="mt-changelog"')&&!html.includes('방법은 언제, 왜 바뀌었나요?'),'the method change timeline stays off');
assert.ok(method.includes('등급은 보전 평가 범주를 점수로 옮긴 값입니다.')&&!method.includes('이 탭 위쪽'));
assert.ok(!html.includes('mt-vbadge'));
console.log(`posthoc verification file: ${file.total} checks ${JSON.stringify(file.counts)} kept in dist; not drawn or fetched (no fold 04, no 검증 기록 보기), no badge, no scorecard at the top, no fold 05`);
