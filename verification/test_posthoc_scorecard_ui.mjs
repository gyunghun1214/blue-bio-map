// 검증 기록: dist/posthoc-scorecard.json (built from posthoc.validation_sets by scripts/build_posthoc_scorecard.py). A same-data
// or two-species consistency check is never shown as 통과, and the file reaches no score, label or matrix type. Schema gate as
// for the other display files.
// 2026-10-16: the scorecard table (top of the method tab) and fold 05 (신청서 약속 대비 구현 현황표) were taken off the page.
// 2026-10-17 (LKH): no verification state on screen, passed or not; a badge left in the markup is hidden and empty.
// 2026-10-19 (LKH, 사이트 v3 1/10 '되살리기'): the records are on screen again, as one table in fold 04 of the method tab, under
// '03 지표를 어떻게 읽나요?': 지표 · 무엇을 확인했나 · 사전 등록 · 결과 · 그 뒤 처리, a count line above it, each row's record files
// linked on GitHub (the file's repository value), and the numbers a row quotes read from its record file by the build. The
// result reads in words as well as colour, and a consistency check never looks like 통과. The journey-card badges stay off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n'); // a Windows checkout (CI) has CRLF
const app=read('app.js'), html=read('index.html'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('posthoc-scorecard.json'));
const els={};const el=id=>els[id]??={id,innerHTML:'',textContent:'',hidden:false,dataset:{},title:''};
const badges=['MFPI','MBPI','MCUI'].map(k=>({dataset:{ind:k},hidden:true,textContent:'',title:''}));
const ctx={document:{getElementById:el,querySelectorAll:sel=>sel.includes('mt-vbadge')?badges:[]}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.file=scorecardFile;globalThis.render=renderVerifyBadges;globalThis.table=renderPosthocTable;globalThis.setSc=f=>{posthocScorecard=f};globalThis.setData=d=>{data=d};'+
  'globalThis.esc=esc;'+
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
assert.equal(file.repository,'https://github.com/gyunghun1214/blue-bio-map/blob/main/');

// Scores, labels and types are the same with no file and with the file, and after the table is drawn.
const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s)].join('|')).join('\n');
ctx.setSc(null);const none=snap();ctx.setSc(ctx.file(file,[]));assert.equal(snap(),none);

// The badges: hidden and empty even with the file loaded; the file still holds each indicator state.
ctx.render();
assert.deepEqual(badges.map(b=>[b.dataset.ind,b.hidden,b.textContent,b.title,b.dataset.state]),
  [['MFPI',true,'','',undefined],['MBPI',true,'','',undefined],['MCUI',true,'','',undefined]]);
assert.deepEqual(Object.fromEntries(Object.entries(file.indicators).map(([k,i])=>[k,i.state])),{MFPI:'passed',MBPI:'not_passed',MCUI:'limited'});
assert.equal(file.indicators.MCUI.classes['일관성 확인(독립 아님)'],2);
assert.ok(!/검증|실패|통과|제한적/.test(app.split('function renderVerifyBadges')[1].split('\n}')[0]),'the badge renderer writes no state words');
assert.deepEqual(Object.keys(els),[],'the badges write nothing else');

// The table, drawn from the file.
ctx.table();assert.equal(snap(),none,'drawing the table changes no score, label or type');
assert.deepEqual(Object.keys(els).sort(),['mt-ck-body','mt-ck-foot','mt-ck-ledger','mt-ck-sum','mt-ck-title'],'the table writes its own elements only');
const strip=h=>h.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
assert.equal(els['mt-ck-title'].textContent,`검증 기록 ${file.total}건`);
assert.equal(file.total,8);
assert.equal(strip(els['mt-ck-sum'].innerHTML),'통과 1 · 기준 미충족 3 · 미충족 후 사용 중단 1 · 일관성 확인(독립 아님) 2 · 검증 불성립 1');
const OC={'통과':'pass','실패':'fail','실패 후 사용 중단':'stopped','일관성 확인(독립 아님)':'consistent','검증 불성립':'void'};
const body=els['mt-ck-body'].innerHTML, rows=body.split('</tr>').filter(Boolean);
const order=[...file.rows].sort((a,b)=>a.order-b.order);
// 2026-10-21 (site v4 09, LKH option A): registered checks follow the stored ones, never counted above
assert.equal(rows.length,order.length+file.registered.length);
assert.deepEqual(file.registered.map(r=>[r.key,r.prereg,r.prereg_commit,r.results_due]),
  [['MBPI_origin_rerank','research/verified-indices/prereg-mbpi-origin-rerank-2026-10.md','6b06ca8','2026-12']]);
{const tr=rows.at(-1),r=file.registered[0];
  assert.ok(tr.startsWith(`<tr data-oc="registered" data-key="${r.key}" id="mt-ck-${r.key}">`));
  assert.deepEqual([...tr.matchAll(/<td data-label="([^"]+)">/g)].map(m=>m[1]),['무엇을 확인했나','사전 등록','결과','그 뒤 처리']);
  assert.ok(tr.includes(`<a href="${file.repository}${r.prereg}" target="_blank" rel="noopener" title="${r.prereg}">prereg-mbpi-origin-rerank-2026-10.md ↗</a>`));
  assert.ok(tr.includes('<a href="https://github.com/gyunghun1214/blue-bio-map/commit/6b06ca8" target="_blank" rel="noopener">사전 등록 커밋 6b06ca8 ↗</a>'));
  assert.ok(tr.includes('<span class="mt-ck-pill" data-oc="registered">등록됨</span><small class="mt-ck-fig">2026-12 공개 예정</small>'));
  for(const w of ['아직','미정','확인 전','실패'])assert.ok(!strip(tr).includes(w),`registered row: no '${w}'`);}
assert.equal(strip(els['mt-ck-ledger'].innerHTML),'지표 규칙이 바뀐 이력 전체: method-changelog.json ↗');
assert.ok(els['mt-ck-ledger'].innerHTML.includes(`href="${file.repository}research/method-changelog.json"`));
assert.ok(fs.readFileSync(new URL('../research/method-changelog.json',import.meta.url))&&true,'the ledger file exists');
const esc=t=>ctx.esc(String(t));  // the page's own screen wording (plainWords: '탐색적' → '탐색용' and the like)
order.forEach((r,i)=>{const tr=rows[i], oc=OC[r.outcome_class];
  assert.ok(tr.startsWith(`<tr data-oc="${oc}" data-key="${r.key}" id="mt-ck-${r.key}">`),`${r.key}: row ${i+1}, its class and anchor`);
  // five cells: 지표 (a row head) · 무엇을 확인했나 · 사전 등록 · 결과 · 그 뒤 처리
  assert.deepEqual([...tr.matchAll(/<td data-label="([^"]+)">/g)].map(m=>m[1]),['무엇을 확인했나','사전 등록','결과','그 뒤 처리'],r.key);
  assert.ok(tr.includes(`<th scope="row"><b>${esc(r.name)}</b>`),r.key);
  assert.ok(tr.includes(`<span>${esc(r.checked)}</span>`)&&tr.includes(`<b>${esc(r.preregistered_label)}</b>`),r.key);
  // the result in words and in its class; a consistency check never reads or looks like 통과
  assert.ok(tr.includes(`<span class="mt-ck-pill" data-oc="${oc}">${esc(r.outcome_label)}</span>`),r.key);
  if(r.outcome_class!=='통과')assert.ok(!/>통과</.test(tr)&&!tr.includes('data-oc="pass"'),`${r.key}: never the 통과 look`);
  // each record file is a GitHub link built from the file's repository value
  for(const p of r.records)assert.ok(tr.includes(`<a href="${file.repository}${p}" target="_blank" rel="noopener" title="${p}">${p.split('/').pop()} ↗</a>`),`${r.key}: ${p}`);
  assert.equal((tr.match(/<a href=/g)||[]).length,r.records.length,r.key);
  assert.ok(tr.includes(`<b${r.action==='none'?' class="mt-ck-na"':''}>${esc(r.action_label)}</b>`),r.key);
});
assert.equal((body.match(/data-oc="pass"/g)||[]).length,2,'one passed row (its row and its pill)');
assert.equal((body.match(/<span class="mt-ck-pill" data-oc="consistent">일관성 확인\(독립 아님\)<\/span>/g)||[]).length,2);
// the numbers of slide 21, as the record files store them, beside their rows (the files hold 0.873 for the slide's 0.87)
const fig=k=>rows[order.findIndex(r=>r.key===k)].match(/<small class="mt-ck-fig">([^<]*)<\/small>/)?.[1];
assert.equal(fig('MFPI'),'시범 3.15 기록: 순위상관 0.873 · 11종');
assert.equal(fig('MBPI'),'4.11 기록: 운영 종 미역 89.2 · 신약 기원종 3종 중 값이 나온 2종: 해면 73.8 · 멍게류 56.1');
assert.equal(fig('MCUI_preliminary'),'시범 3.15 기록: 14종 중 11종 일치 · LC로 판정한 위협종 2종: 해삼·전복(종 수준)');
assert.equal((body.match(/class="mt-ck-fig"/g)||[]).length,file.rows.filter(r=>r.figure).length+file.registered.length,'a figure only where the file has one (and the due month of a registered row)');
const foot=els['mt-ck-foot'].textContent;
assert.ok(foot.includes('통과로 세지 않습니다')&&foot.includes(`사전 등록 ‘예’ ${file.preregistered}건`)&&foot.endsWith('4.19 기준.'),foot);
// no file: no rows, no count, a plain sentence
ctx.setSc(null);ctx.table();
assert.equal(els['mt-ck-body'].innerHTML,'');assert.equal(els['mt-ck-title'].textContent,'검증 기록');
assert.ok(els['mt-ck-sum'].textContent.includes('읽지 못했습니다'));
ctx.setSc(ctx.file(file,[]));

// No file: the badges hide.
ctx.setSc(null);ctx.render();
assert.ok(badges.every(b=>b.hidden));

// Schema gate.
let out=[];assert.equal(ctx.file({...file,schema_version:'posthoc-scorecard-2'},out),null);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'posthoc-scorecard.json',version:'posthoc-scorecard-2'}]);
out=[];assert.equal(ctx.file({...file,schema_version:'other'},out),null);assert.equal(out.length,0);
assert.equal(ctx.file({...file,display_only:false},[]),null);
assert.equal(ctx.file({...file,rows:[{...file.rows[0],outcome_class:'통과됨'}]},[]),null);

// The page: folds 01–04, fold 04 the table under fold 03; still no scorecard at the top, no fold 05 and no badge; the hero is
// the first block of the method tab.
const css=read('method.css'), method=html.split('<section id="method"')[1].split('</section>\n</main>')[0];
for(const gone of ['id="mt-scorecard"','mt-vc','VALIDATION SCORECARD','검증 성적표','id="mt-acc-05"','promise-table','promise-count','신청서 약속','구현 현황','data-alt-species'])
  assert.ok(!html.includes(gone),'index.html: '+gone);
for(const gone of ['renderScorecard','mt-vc-','#promise-table','promise-count','data-alt-species'])assert.ok(!app.includes(gone),'app.js: '+gone);
for(const gone of ['.mt-vc','.promise-table','.pt-s','.pt-'])assert.ok(!css.includes(gone),'method.css: '+gone);
// 2026-10-17 (LKH): the MCUI SCALE card left the top of the tab (markup and styles); the hero opens the tab and the 03 MCUI
// line no longer points to it (02 still gives LC 10 · NT 35 · VU 60 · EN 80 · CR 100)
assert.match(method,/^[^>]*>\n<div class="mt-hero">/);
for(const gone of ['mt-mcui-map','mt-mm-','MCUI SCALE','대응표는 이 탭'])assert.ok(!html.includes(gone)&&!css.includes(gone),'MCUI SCALE card: '+gone);
assert.ok(method.includes('범주 → 숫자는 LC 10 · NT 35 · VU 60 · EN 80 · CR 100'));
assert.deepEqual([...method.matchAll(/<details class="mt-acc" id="(mt-acc-\d+)"/g)].map(m=>m[1]),['mt-acc-01','mt-acc-02','mt-acc-03','mt-acc-04']);
const f3=method.indexOf('id="mt-acc-03"'), f4=method.indexOf('id="mt-acc-04"');
assert.ok(method.slice(f3,f3+300).includes('지표를 어떻게 읽나요?')&&f3<f4,'fold 04 sits right under 03 지표를 어떻게 읽나요?');
const fold4=method.slice(f4,method.indexOf('</details>',f4));
assert.ok(fold4.includes('<b id="mt-ck-title">검증 기록</b>')&&fold4.includes('<tbody id="mt-ck-body"></tbody>')&&fold4.includes('id="mt-ck-sum"')&&fold4.includes('id="mt-ck-foot"'));
assert.deepEqual([...fold4.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m=>m[1]),['지표','무엇을 확인했나','사전 등록','결과','그 뒤 처리']);
assert.ok(!html.includes('id="mt-changelog"')&&!html.includes('방법은 언제, 왜 바뀌었나요?'),'the method change timeline stays off');
assert.ok(method.includes('등급은 보전 평가 범주를 점수로 옮긴 값입니다.')&&!method.includes('이 탭 위쪽'));
assert.ok(!html.includes('mt-vbadge'));
// styles: each class has its colour, the consistency check a dashed outline of its own, the passed pill alone is filled
for(const oc of Object.values(OC))assert.ok(css.includes(`#method .mt-ck [data-oc=${oc}]{--oc:var(--oc-${oc})}`),'method.css: '+oc);
assert.match(css,/\.mt-ck-pill\[data-oc=consistent\]\{[^}]*dashed[^}]*background:none/);
assert.match(css,/\.mt-ck-pill\[data-oc=pass\]\{background:var\(--oc\)/);
const block=css.slice(css.indexOf('.mt-ck{'),css.indexOf('/* 04 method change timeline'));
assert.ok(block.length>200,'the 검증 기록 block of method.css');
for(const m of block.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(Number(m[1])>=12,'no text under 12px: '+m[0]);
console.log(`posthoc verification table: ${file.total} checks ${JSON.stringify(file.counts)} in fold 04 of the method tab, linked records, record figures, scores unchanged; no badge, no scorecard at the top, no fold 05`);
