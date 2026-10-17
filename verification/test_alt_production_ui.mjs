// Both-high block '대체생산·양식 연구 현황' (2026-10-17 #8): its text comes from dist/alternative-production-notes.json, a
// display-only file kept apart from the score files, so the same block fits any species of that type. A row without text is
// not drawn, every added row names an official source (government press release or peer-reviewed paper), no score reads the
// file, and the expedition card takes its one line from the same file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), report=JSON.parse(read('assessments.json')), notes=JSON.parse(read('alternative-production-notes.json'));
const ctx={};vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';'+app.slice(app.indexOf('// Application doc: "두 지표 모두 높은 종'),app.indexOf('// Citizen observation'))+
  ';globalThis.setData=d=>{data=d};globalThis.setNotes=f=>{altNotes=altNotesRows(f,[])};globalThis.notesRows=altNotesRows;globalThis.block=altProductionBlock;'+
  'globalThis.typeOf=officialType;globalThis.score=pilotScore;',ctx);
const species=[...report.species,...report.candidate_species].map(a=>({aphiaID:a.aphia_id,name:a.korean_name,assessment:{...a,report_version:report.method_version}}));
ctx.setData({species,assessmentInfo:{method:report.method,sources:report.sources}});
const squid=species.find(s=>s.aphiaID===342067), note=notes.alternative_production_notes['342067'];
const rowsOf=h=>[...h.matchAll(/<div class="alt-row"><span>([^<]*)<\/span><p>([\s\S]*?)<\/p><\/div>/g)].map(m=>({label:m[1],html:m[2],
  links:[...m[2].matchAll(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(x=>[x[2],x[1].replace(/&amp;/g,'&')])}));

// the file: schema 1, display only, one note per both-high species (today 살오징어 only), keyed by AphiaID
assert.equal(notes.schema_version,'alternative-production-notes-1');
assert.equal(notes.display_only,true);
assert.deepEqual(species.filter(s=>ctx.typeOf(s)==='alternative_production').map(s=>s.aphiaID),[342067]);
assert.deepEqual(Object.keys(notes.alternative_production_notes),['342067']);
// every added row has an official source with its dates; the card line is one short line
for(const r of note.rows){
  assert.ok(r.label&&r.text&&r.sources.length>0,r.label);
  for(const x of r.sources){assert.match(x.url,/^https:\/\//);assert.match(x.label,/ ↗$/);assert.match(x.published,/^\d{4}-\d{2}-\d{2}$/);assert.equal(x.checked,'2026-10-17');}
}
assert.ok(note.card_summary&&note.card_summary.length<=60&&!/\n/.test(note.card_summary));

// screen words (rules 2026-10-17): no wording that shows a weakness of the data or the method, no negative guidance, nothing
// that claims a farming success the sources do not hold
const shown=[note.aquaculture_text,note.card_summary,...note.rows.flatMap(r=>[r.label,r.text,...r.sources.map(x=>x.label)])].join(' ');
assert.doesNotMatch(shown,/미충족|미통과|실패|불성립|사용 중단|제한적|예비|공식|자체 평가|재현|근거 논문 1편|단일 논문|조사 필요|확인 필요|미확인|미산출|점수 없음|정보충분도|공백|사후 검증|사전 등록|검증|자료 없음|상업 이용 불가|조사 후보/);
assert.doesNotMatch(shown,/아님|아닙니다|아니에요|아니라|않음|않습니다|않아요|뜻하지|못했|없습니다/);
assert.doesNotMatch(shown,/완전양식|양식 성공|세계 최초|성공/);

// with the file: 양식 연구 (the report's record, its Korean line) → 국내 연구 (three sources) → 보전 지표
ctx.setNotes(notes);
let rows=rowsOf(ctx.block(squid));
assert.deepEqual(rows.map(r=>r.label),['양식 연구','국내 연구','보전 지표']);
assert.ok(rows[0].html.startsWith(`사육 시도 기록 · ${note.aquaculture_text} <a `),rows[0].html);
assert.ok(rows[1].html.startsWith(note.rows[0].text+' <a '),rows[1].html);
assert.deepEqual(rows[1].links,note.rows[0].sources.map(x=>[x.label,x.url]));
assert.match(rows[2].html,/^MCUI /);
// the compare profile's compact block has the same rows
assert.deepEqual(rowsOf(ctx.block(squid,true)).map(r=>r.label),['양식 연구','국내 연구','보전 지표']);
// other types get no block
for(const s of species.filter(x=>x.aphiaID!==342067))assert.equal(ctx.block(s),'',s.name);

// a row without text is not drawn: an empty 국내 연구, an empty Korean farming line (the English record is never drawn instead)
const blank=JSON.parse(JSON.stringify(notes));blank.alternative_production_notes['342067'].rows[0].text='  ';blank.alternative_production_notes['342067'].aquaculture_text='';
ctx.setNotes(blank);
rows=rowsOf(ctx.block(squid));
assert.deepEqual(rows.map(r=>r.label),['보전 지표']);
assert.doesNotMatch(ctx.block(squid),/mesocosm|not reared|paralarval/);
// without the file (or with an unknown or non-display file) the block keeps only the MCUI row
for(const f of [null,{...notes,schema_version:'alternative-production-notes-0'},{...notes,display_only:false}]){
  ctx.setNotes(f);assert.deepEqual(rowsOf(ctx.block(squid)).map(r=>r.label),['보전 지표']);
}
// a sources entry that is not a web address is left out
const odd=JSON.parse(JSON.stringify(notes));odd.alternative_production_notes['342067'].rows[0].sources[1].url='javascript:alert(1)';
ctx.setNotes(odd);
assert.equal(rowsOf(ctx.block(squid))[1].links.length,2);
// a newer file is reported, so an old page reloads for new code
const out=[];assert.equal(ctx.notesRows({...notes,schema_version:'alternative-production-notes-2'},out).size,0);
assert.deepEqual(JSON.parse(JSON.stringify(out)),[{file:'alternative-production-notes.json',version:'alternative-production-notes-2'}]);

// no score, type or map colour reads the file: the scores are the same with and without it, and only the block reads altNotes
const scores=()=>species.map(s=>[s.aphiaID,ctx.typeOf(s),...['MFPI','MBPI','MCUI','BBVI'].map(k=>ctx.score(s,k))]);
ctx.setNotes(null);const without=JSON.stringify(scores());ctx.setNotes(notes);
assert.equal(JSON.stringify(scores()),without);
assert.deepEqual([...app.matchAll(/altNotes\.get\(/g)].length,1);
assert.ok(app.slice(app.indexOf('function altProductionBlock'),app.indexOf('// Citizen observation')).includes('altNotes.get(s.aphiaID)'));
assert.doesNotMatch(app,/AQUACULTURE_KO/);
// the file is read with the other display files, early and in loadCollection
assert.match(read('live-data.js'),/'aquaculture-tier\.json','alternative-production-notes\.json'\]\)startEarly\(f,FRESH\)/);
assert.match(app,/'aquaculture-tier\.json','alternative-production-notes\.json'\]\s*\.map\(f=>readData\(f,FRESH_READ\)/);
assert.match(app,/altNotes=altNotesRows\(altNotesFile,next\.outdated\)/);

// the expedition card: its pure helper reads the same file, and only the both-high stop gets the line
const exp=read('expedition.js'), pure={};vm.createContext(pure);
vm.runInContext(exp.split('// ---- browser ----')[0]+';globalThis.altCardLine=altCardLine;',pure);
assert.equal(pure.altCardLine(notes,342067),note.card_summary);
assert.equal(pure.altCardLine(notes,836033),'');
assert.equal(pure.altCardLine(null,342067),'');
assert.equal(pure.altCardLine({...notes,display_only:false},342067),'');
assert.match(exp,/const notes=fetch\('alternative-production-notes\.json'\)/);
assert.match(exp,/\$\{alt\?`<p class="x-alt"><b>대체생산·양식 연구<\/b> \$\{esc\(alt\)\}<\/p>`:''\}/);
console.log('PASS: both-high block from alternative-production-notes.json (양식 연구 → 국내 연구 with 3 official sources → 보전 지표; no row without text; no score reads it) and the expedition card line');
