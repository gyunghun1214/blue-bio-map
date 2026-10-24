// Candidate-compound layer (dist/cmnpd-candidates.json): one line in the species profile, '후보 화합물 탐색 · 참고 자료', with
// the CMNPD count and the CC BY-NC-SA 4.0 link, and the counts behind '왜 MBPI의 주 소스가 ChEMBL인가요?' in the method tab.
// 2026-10-17 (LKH): the screen no longer shows how few compounds reach ChEMBL ('그중 ChEMBL 연결 N개', the linked/unlinked counts
// in the method tab) or '점수 미사용'; the file keeps those counts and the asserts below check both.
// Scores, labels and matrix types are the same with no file, with the file and with every count changed. Schema gate as for the
// other display files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), html=read('index.html'), report=JSON.parse(read('assessments.json')), file=JSON.parse(read('cmnpd-candidates.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8'),ctx); // as on the page: language and dictionaries (i18n.js) before app.js
vm.runInContext(fs.readFileSync(new URL('../dist/score-format.js',import.meta.url),'utf8'),ctx); // as on the page: app.js writes its numbers with it
vm.runInContext(app.split('function setView')[0]+
  ';globalThis.rows=cmnpdRows;globalThis.line=cmnpdLine;globalThis.method=cmnpdMethodText;'+
  'globalThis.setData=d=>{data=d};globalThis.setFile=f=>{cmnpdCandidates=cmnpdRows(f,[])};'+
  'globalThis.axis=axisState;globalThis.type=matrixType;globalThis.label=bbviLabel;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,label:a.korean_name,name:a.scientific_name,cells:[],
  assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{version:report.method_version,method:report.method,sources:report.sources}});
const by=n=>species.find(s=>s.label.startsWith(n));

assert.equal(file.schema_version,'cmnpd-candidates-1');
assert.equal(file.display_only,true);
assert.equal(file.used_in_scores,false);
assert.equal(file.species.length,30);

const snap=()=>species.map(s=>[s.aphiaID,...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.axis(s,k).value),ctx.label(s),ctx.type(s)].join('|')).join('\n');
ctx.setFile(null);const none=snap();
assert.equal(ctx.line(by('해삼')),'');
ctx.setFile(file);assert.equal(snap(),none);
ctx.setFile({...file,species:file.species.map(r=>({...r,compound_count:999,chembl_linked:999}))});assert.equal(snap(),none);

// every species gets the line, labelled and licensed
ctx.setFile(file);
for(const r of file.species){
  const s=species.find(x=>x.aphiaID===r.aphia_id), t=ctx.line(s);
  assert.match(t,/^<p class="cp-cmnpd"/,s.label);
  assert.ok(t.includes('후보 화합물 탐색')&&t.includes('참고 자료')&&!t.includes('점수 미사용'),s.label);
  assert.ok(!t.includes('ChEMBL 연결')&&!t.includes('옮기지 않습니다'),s.label);
  assert.ok(t.includes(`보고 화합물 <strong>${r.compound_count}개</strong>`),s.label);
  assert.ok(t.includes('CC BY-NC-SA 4.0')&&t.includes('https://docs.cmnpd.org/terms-and-conditions'),s.label);
}
assert.ok(ctx.line(by('해삼')).includes('보고 화합물 <strong>122개</strong> · '));
assert.equal(file.species.find(r=>r.aphia_id===by('해삼').aphiaID).chembl_linked,0);
assert.ok(!ctx.line(by('고등어')).includes('ChEMBL 연결'));
// called once, in the species profile
assert.equal((app.match(/cmnpdLine\(/g)||[]).length,2);
assert.ok(app.includes("${rest?p('cp-rest',rest):''}${cmnpdLine(s)}</section>"));
assert.ok(!app.includes('${cpEvidence(s)}${cmnpdLine(s)}'));

// method tab: the why-ChEMBL card and the counts from the file
assert.match(html,/<article class="method-card" id="method-chembl">.*왜 MBPI의 주 소스가 ChEMBL인가요\?.*pChEMBL.*CC BY-NC-SA 4\.0.*<p class="fine" id="mt-cmnpd"><\/p><\/article>/);
const t=ctx.method(), T=file.totals;
assert.ok(t.startsWith(`${file.source.accessed} 조회 기준, 30종 중 ${T.species_with_compounds}종에서 CMNPD 보고 화합물 ${T.pairs}개를 찾았습니다.`),t);
assert.ok(!t.includes('ChEMBL 분자까지 이어진 화합물은')&&!t.includes('종 연결이 없는 화합물은'),t);
assert.equal(T.chembl_linked,file.species.reduce((n,r)=>n+r.chembl_linked,0));
assert.equal(T.chembl_listed_unlinked,file.species.reduce((n,r)=>n+(r.chembl_listed_unlinked?.length||0),0));
assert.ok(t.endsWith('후보 화합물 탐색에 쓰는 참고 자료이며, MBPI는 종–화합물 연결(위키데이터 P703·원논문)과 ChEMBL 활성값으로 계산합니다.'),t);

// schema gate
let out=[];assert.equal(ctx.rows({...file,schema_version:'cmnpd-candidates-2'},out).rows.size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'cmnpd-candidates.json',version:'cmnpd-candidates-2'}]);
out=[];assert.equal(ctx.rows({...file,schema_version:'other'},out).rows.size,0);assert.equal(out.length,0);
assert.equal(ctx.rows({...file,used_in_scores:true},[]).rows.size,0);
assert.equal(ctx.rows({...file,display_only:false},[]).rows.size,0);
console.log(`CMNPD candidate UI: 30 species, ${T.pairs} compounds in ${T.species_with_compounds} species, ChEMBL-linked ${T.chembl_linked}, scores unchanged`);
