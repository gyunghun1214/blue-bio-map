// 검증 배지: the MFPI·MBPI·MCUI journey cards of the method tab carry one badge each from dist/posthoc-scorecard.json (built
// from posthoc.validation_sets by scripts/build_posthoc_scorecard.py). A same-data or two-species consistency check is never
// shown as 통과, and the file reaches no score, label or matrix type. Schema gate as for the other display files.
// 2026-10-16: the scorecard table (top of the method tab) and fold 05 (신청서 약속 대비 구현 현황표) were taken off the page;
// this test now checks they are gone from the markup, the code and the styles. The file and its build check stay.
// 2026-10-17 (LKH): no verification state on screen, passed or not. The journey cards carry no badge, fold 04 (method
// change timeline) left the tab, and a badge left in the markup is hidden and empty; the file keeps every indicator state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), html=read('index.html'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('posthoc-scorecard.json'));
const els={};const el=id=>els[id]??={id,innerHTML:'',textContent:'',hidden:false,dataset:{},title:''};
const badges=['MFPI','MBPI','MCUI'].map(k=>({dataset:{ind:k},hidden:true,textContent:'',title:''}));
const ctx={document:{getElementById:el,querySelectorAll:sel=>sel.includes('mt-vbadge')?badges:[]}};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.file=scorecardFile;globalThis.render=renderVerifyBadges;globalThis.setSc=f=>{posthocScorecard=f};globalThis.setData=d=>{data=d};'+
  'globalThis.axis=axisState;globalThis.type=matrixType;globalThis.label=bbviLabel;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,label:a.korean_name,name:a.scientific_name,cells:[],
  assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{version:report.method_version,method:report.method,sources:report.sources}});

// The file: display only, built for the published report, one row per stored check with the stored result.
assert.equal(file.schema_version,'posthoc-scorecard-1');
assert.equal(file.display_only,true);
assert.equal(file.report_version,report.method_version);
const sets=report.method.posthoc.validation_sets;
assert.deepEqual(file.rows.map(r=>r.key).sort(),Object.keys(sets).sort());
for(const r of file.rows)assert.equal(r.result,sets[r.key].result,r.key);

// Scores, labels and types are the same with no file and with the file.
const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s)].join('|')).join('\n');
ctx.setSc(null);const none=snap();ctx.setSc(ctx.file(file,[]));assert.equal(snap(),none);

// The badges: hidden and empty even with the file loaded; the file still holds each indicator state.
ctx.render();
assert.deepEqual(badges.map(b=>[b.dataset.ind,b.hidden,b.textContent,b.title,b.dataset.state]),
  [['MFPI',true,'','',undefined],['MBPI',true,'','',undefined],['MCUI',true,'','',undefined]]);
assert.deepEqual(Object.fromEntries(Object.entries(file.indicators).map(([k,i])=>[k,i.state])),{MFPI:'passed',MBPI:'not_passed',MCUI:'limited'});
assert.equal(file.indicators.MCUI.classes['일관성 확인(독립 아님)'],2);
assert.ok(!/검증|실패|통과|제한적/.test(app.split('function renderVerifyBadges')[1].split('\n}')[0]),'the renderer writes no state words');
assert.deepEqual(Object.keys(els),[],'nothing else on the page is written');

// No file: the badges hide.
ctx.setSc(null);ctx.render();
assert.ok(badges.every(b=>b.hidden));

// Schema gate.
let out=[];assert.equal(ctx.file({...file,schema_version:'posthoc-scorecard-2'},out),null);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'posthoc-scorecard.json',version:'posthoc-scorecard-2'}]);
out=[];assert.equal(ctx.file({...file,schema_version:'other'},out),null);assert.equal(out.length,0);
assert.equal(ctx.file({...file,display_only:false},[]),null);
assert.equal(ctx.file({...file,rows:[{...file.rows[0],outcome_class:'통과됨'}]},[]),null);

// The page: no scorecard and no fold 05 in the markup, the code or the styles; the hero is the first block of the
// method tab; one badge per journey card.
const css=read('method.css'), method=html.split('<section id="method"')[1].split('</section>\n</main>')[0];
for(const gone of ['id="mt-scorecard"','mt-vc','VALIDATION SCORECARD','검증 성적표','id="mt-acc-05"','promise-table','promise-count','신청서 약속','구현 현황','data-alt-species'])
  assert.ok(!html.includes(gone),'index.html: '+gone);
for(const gone of ['renderScorecard','mt-vc-','#promise-table','promise-count','data-alt-species'])assert.ok(!app.includes(gone),'app.js: '+gone);
for(const gone of ['.mt-vc','[data-oc','.promise-table','.pt-s','.pt-'])assert.ok(!css.includes(gone),'method.css: '+gone);
// 2026-10-17 (LKH): the MCUI SCALE card left the top of the tab (markup and styles); the hero opens the tab and the 03 MCUI
// line no longer points to it (02 still gives LC 10 · NT 35 · VU 60 · EN 80 · CR 100)
assert.match(method,/^[^>]*>\n<div class="mt-hero">/);
for(const gone of ['mt-mcui-map','mt-mm-','MCUI SCALE','대응표는 이 탭'])assert.ok(!html.includes(gone)&&!css.includes(gone),'MCUI SCALE card: '+gone);
assert.ok(method.includes('범주 → 숫자는 LC 10 · NT 35 · VU 60 · EN 80 · CR 100'));
assert.deepEqual([...method.matchAll(/<details class="mt-acc" id="(mt-acc-\d+)"/g)].map(m=>m[1]),['mt-acc-01','mt-acc-02','mt-acc-03']);
assert.ok(!html.includes('id="mt-changelog"')&&!html.includes('방법은 언제, 왜 바뀌었나요?'));
assert.ok(method.includes('등급은 보전 평가 범주를 점수로 옮긴 값입니다.')&&!method.includes('이 탭 위쪽'));
for(const k of ['MFPI','MBPI','MCUI'])assert.equal((html.match(new RegExp(`<span class="mt-vbadge" data-ind="${k}"`,'g'))||[]).length,0,k);
assert.ok(!html.includes('mt-vbadge'));
console.log(`posthoc verification badges: ${file.total} checks ${JSON.stringify(file.counts)} kept in the file, scores unchanged; no badge, scorecard table, fold 04 or fold 05 on the page`);
