// 검증 성적표: the top of the method tab lists every post-hoc check from dist/posthoc-scorecard.json (built from
// posthoc.validation_sets by scripts/build_posthoc_scorecard.py), and the MFPI·MBPI·MCUI journey cards carry one badge each.
// A same-data or two-species consistency check is never shown as 통과, no failed check is shown with the word '실패', and the
// file reaches no score, label or matrix type. Schema gate as for the other display files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), html=read('index.html'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('posthoc-scorecard.json'));
const els={};const el=id=>els[id]??={id,innerHTML:'',textContent:'',hidden:false,dataset:{},title:''};
const badges=['MFPI','MBPI','MCUI'].map(k=>({dataset:{ind:k},hidden:true,textContent:'',title:''}));
const ctx={document:{getElementById:el,querySelectorAll:sel=>sel.includes('mt-vbadge')?badges:[]}};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.file=scorecardFile;globalThis.render=renderScorecard;globalThis.setSc=f=>{posthocScorecard=f};globalThis.setData=d=>{data=d};'+
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

// The table: one row per check in order, six cells, the calm result labels.
ctx.render();
const body=els['mt-vc-body'].innerHTML, rows=body.split('<tr ').slice(1);
assert.equal(rows.length,file.rows.length);
for(const [i,r] of file.rows.entries()){
  assert.ok(rows[i].includes(`data-key="${r.key}"`),r.key);
  assert.equal((rows[i].match(/data-label="/g)||[]).length,6,r.key);
  assert.ok(rows[i].includes(`>${r.outcome_label}</span>`),r.key);
  if(['consistent_same_data','reproduced_n2'].includes(r.result))assert.ok(!/통과/.test(rows[i].split('data-label="결과"')[1].split('</td>')[0]),r.key);
  for(const p of r.records)assert.ok(rows[i].includes(`href="${file.repository}${p}"`),p);
}
assert.ok(!/실패/.test(body+els['mt-vc-sum'].textContent+els['mt-vc-counts'].innerHTML+els['mt-vc-foot'].textContent),'no 실패 on screen');
assert.match(els['mt-vc-sum'].textContent,new RegExp(`^${report.method_version} 기준 · 사후 검증 ${file.total}건 중 기준 통과 1건 · 7건은 결과를 보기 전에 기준을 정했습니다\\.$`));
assert.match(els['mt-vc-ind'].innerHTML,/<b>식량 MFPI<\/b><span>검증 통과<\/span>.*<b>생리활성 MBPI<\/b><span>방법 검증 기준 미충족<\/span>.*<b>보전 MCUI<\/b><span>제한적 확인<\/span>/);
// journey badges: the site's neutral wording (plainWords) for MBPI
assert.deepEqual(badges.map(b=>[b.dataset.ind,b.hidden,b.textContent,b.dataset.state]),
  [['MFPI',false,'검증 통과','passed'],['MBPI',false,'방법 검증 기준 미충족','not_passed'],['MCUI',false,'제한적 확인','limited']]);
assert.match(badges[2].title,/일관성 확인\(독립 아님\) 2/);

// No file: the badges hide and the summary says so.
ctx.setSc(null);ctx.render();
assert.ok(badges.every(b=>b.hidden));assert.equal(els['mt-vc-body'].innerHTML,'');assert.match(els['mt-vc-sum'].textContent,/읽지 못했습니다/);

// Schema gate.
let out=[];assert.equal(ctx.file({...file,schema_version:'posthoc-scorecard-2'},out),null);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'posthoc-scorecard.json',version:'posthoc-scorecard-2'}]);
out=[];assert.equal(ctx.file({...file,schema_version:'other'},out),null);assert.equal(out.length,0);
assert.equal(ctx.file({...file,display_only:false},[]),null);
assert.equal(ctx.file({...file,rows:[{...file.rows[0],outcome_class:'통과됨'}]},[]),null);

// The page: the scorecard is the first block of the method tab; one badge per journey card.
const method=html.split('<section id="method"')[1];
assert.ok(method.indexOf('id="mt-scorecard"')<method.indexOf('class="mt-hero"'));
for(const k of ['MFPI','MBPI','MCUI'])assert.equal((html.match(new RegExp(`<span class="mt-vbadge" data-ind="${k}" hidden></span>`,'g'))||[]).length,1,k);
console.log(`posthoc scorecard UI: ${file.total} checks ${JSON.stringify(file.counts)}, scores unchanged`);
