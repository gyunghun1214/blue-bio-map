// A data file newer than this page's code (a tab open across a deploy, a cached app.js) must never read as
// 기술 오류 or 검수 자료 확인 실패: reload once per file and version, then show 새 버전 있음. The reload leaves a one-time
// mark (bbvm-app-reload) so intro.js shows no entry screen for it: the visitor did not press F5 (2026-10-18). While the
// entry screen is up there is no mark: the reloaded page shows the screen again from the start.
// Run: node verification/test_client_outdated.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const json=f=>JSON.parse(read(f));
const app=read('app.js');
const report=json('assessments.json');
const store=new Map();let reloads=0;const gate=new Set(); // <html>'s classes: gate-on while the entry screen is up
const ctx={fetch:async()=>({ok:true,json:async()=>structuredClone(report)}),document:{documentElement:{classList:{contains:c=>gate.has(c)}}},
  sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},location:{reload:()=>reloads++}};
vm.createContext(ctx);
vm.runInContext(app.split('function setView')[0]+';Object.assign(globalThis,{attachPilotAssessments,axisState,newerVersion,'+
  'reloadOnceForNewData,readinessRows,traitDisplayRows,releaseMissing,VERIFIED});',ctx);
const run=async version=>{
  report.method_version=version;
  const next={live:true,species:report.species.map(s=>({aphiaID:s.aphia_id,name:s.scientific_name,label:s.korean_name,live:true}))};
  await ctx.attachPilotAssessments(next);
  return next;
};
const axes=['MFPI','MBPI','MCUI','BBVI'];
const plain=x=>JSON.parse(JSON.stringify(x)); // objects built inside vm have another realm's prototypes

// (1) A higher verified report (4.x continues the pilot numbering): one reload, then 새 버전 있음 on every axis (never 기술 오류).
let next=await run('verified-4.20');
assert.deepEqual(plain(next.outdated),[{file:'assessments.json',version:'verified-4.20'}]);
assert.equal(ctx.reloadOnceForNewData(next.outdated),true);
assert.equal(reloads,1,'first sight of a newer report reloads once');
assert.equal(store.get('bbvm-app-reload'),'1','the reload is marked as the app\'s own (intro.js: no entry screen for it)');
store.delete('bbvm-app-reload'); // intro.js reads and removes it on the reloaded page
next=await run('verified-4.20');
assert.equal(ctx.reloadOnceForNewData(next.outdated),false);
assert.equal(reloads,1,'no reload loop when the reload still serves an old app.js');
assert.equal(store.has('bbvm-app-reload'),false,'no reload, no mark');
for(const s of next.species)for(const k of axes){
  assert.equal(ctx.axisState(s,k).kind,'client_outdated',`${s.label} ${k}`);
  assert.equal(ctx.axisState(s,k).label,'새 버전 있음');
}
// A later version seen in the same tab reloads once more; still at most once per version.
next=await run('verified-4.21');
assert.equal(ctx.reloadOnceForNewData(next.outdated),true);
assert.equal(reloads,2);
store.delete('bbvm-app-reload');
// With the entry screen up (first visit, logo, the visitor's F5) the reload leaves no mark: the screen comes back from the
// start. While it is closing (gate-leaving, after Enter) the map is what the visitor sees, so the mark is left.
gate.add('gate-on');next=await run('verified-4.22');
assert.equal(ctx.reloadOnceForNewData(next.outdated),true);
assert.equal(reloads,3);
assert.equal(store.has('bbvm-app-reload'),false,'entry screen up: no mark, the screen shows again');
gate.add('gate-leaving');next=await run('verified-4.23');
assert.equal(ctx.reloadOnceForNewData(next.outdated),true);
assert.equal(store.get('bbvm-app-reload'),'1','entry screen closing: the map stays');
store.delete('bbvm-app-reload');gate.clear();

// (2) Numeric, not string, comparison; only the known dotted format is "newer".
const latest=ctx.VERIFIED.at(-1);
assert.equal(latest,'verified-4.19');
for(const v of ['verified-4.20','verified-4.19.1','verified-5','verified-4.20.1','verified-pilot-4.20'])assert.equal(ctx.newerVersion(v,latest),true,v);
for(const v of ['verified-4.18','verified-4.17','verified-4.16','verified-4.15','verified-4.14','verified-4.13','verified-4.12','verified-4.11','verified-4.10','verified-4.9','verified-4.8','verified-4.7','verified-4.6','verified-4.5','verified-4.4','verified-4.3','verified-4.2','verified-4.1','verified-4.0','verified-pilot-4','verified-pilot-3.28','verified-pilot-3.27','verified-pilot-3.26','verified-pilot-3.25','verified-pilot-3.24','verified-pilot-3.23','verified-pilot-3.22','verified-pilot-3.21','verified-pilot-3.20','verified-pilot-3.19','verified-pilot-3.18','verified-pilot-3.17','verified-pilot-3.16','verified-pilot-3.15','verified-pilot-3.14','verified-pilot-3.13','verified-pilot-3.12','verified-pilot-3.11','verified-pilot-3.10','verified-pilot-3.9','verified-pilot-3.8','verified-pilot-3.7','verified-pilot-3.6','verified-pilot-3.5','verified-pilot-3.4','verified-pilot-3.3','verified-pilot-3.2','verified-pilot-3.1','verified-pilot-3','verified-pilot-2.3','verified-pilot-1','verified-pilot-3-oyster-lqp-research','verified-pilot-3.7a',
  'verified-pilot-','bogus',null,24])assert.equal(ctx.newerVersion(v,latest),false,String(v));

// (3) Unknown or older versions are still data faults, and the current version is unchanged.
for(const v of ['bogus','verified-pilot-1','verified-pilot-3-oyster-lqp-research','research-xo-potency-2026-09-27']){
  next=await run(v);
  assert.equal(next.outdated,undefined,v);
  assert.equal(ctx.axisState(next.species[0],'MFPI').kind,'technical_error',v);
}
next=await run(latest);
assert.equal(next.outdated,undefined);
assert.ok(next.species.every(s=>s.assessmentState===undefined));

// (4) Separate keys per file; several newer files share one reload.
store.clear();reloads=0;
const both=[{file:'assessments.json',version:'verified-pilot-3.28'},{file:'matrix-readiness.json',version:2}];
assert.equal(ctx.reloadOnceForNewData(both),true);
assert.equal(reloads,1);
assert.deepEqual([...store.keys()].filter(k=>k.startsWith('reload:')).sort(),['reload:assessments.json','reload:matrix-readiness.json']);
assert.deepEqual([...store.keys()].filter(k=>!k.startsWith('reload:')),['bbvm-app-reload'],'one mark for the one reload, nothing else stored');
assert.equal(ctx.reloadOnceForNewData(both),false);
assert.equal(ctx.reloadOnceForNewData([{file:'matrix-readiness.json',version:3}]),true,'a readiness bump reloads on its own key');
assert.equal(reloads,2);

// (5) Without sessionStorage it never reloads, and still shows 새 버전 있음.
delete ctx.sessionStorage;store.clear();reloads=0;
next=await run('verified-4.20');
assert.equal(ctx.reloadOnceForNewData(next.outdated),false);
assert.equal(reloads,0,'without sessionStorage it never reloads');
assert.equal(ctx.axisState(next.species[0],'MFPI').kind,'client_outdated');

// (6) matrix-readiness.json: schema 1 is read, a higher integer is newer, anything else is ignored.
const readiness=json('matrix-readiness.json');
let outdated=[];
assert.equal(ctx.readinessRows(readiness,outdated).size,30);
assert.deepEqual(plain(outdated),[]);
for(const [version,newer] of [[2,true],['2',false],[0,false],[1.5,false],[undefined,false]]){
  outdated=[];
  assert.equal(ctx.readinessRows({...readiness,schema_version:version},outdated).size,0);
  assert.equal(outdated.length,newer?1:0,String(version));
}

// (6b) trait-evidence.json (display-only chip values): a newer schema reloads on its own key; others are ignored.
const traitFile=json('trait-evidence.json');
outdated=[];
assert.ok(ctx.traitDisplayRows(traitFile,outdated).size>0);
assert.deepEqual(plain(outdated),[]);
for(const [version,newer] of [['trait-display-evidence-2',true],['trait-display-evidence-0',false],['trait-display-evidence-x',false],[undefined,false]]){
  outdated=[];
  assert.equal(ctx.traitDisplayRows({...traitFile,schema_version:version},outdated).size,0);
  assert.equal(outdated.length,newer?1:0,String(version));
}
ctx.sessionStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};store.clear();reloads=0;
assert.equal(ctx.reloadOnceForNewData([{file:'trait-evidence.json',version:'trait-display-evidence-2'}]),true);
assert.deepEqual([...store.keys()].filter(k=>k.startsWith('reload:')),['reload:trait-evidence.json']);
assert.equal(store.get('bbvm-app-reload'),'1');
delete ctx.sessionStorage;

// (7) live-data.js schema gates: a higher number in the same family is newer; other values stay rejected.
const files={'candidate-catalog.json':json('candidate-catalog.json'),'expansion-evidence.json':json('expansion-evidence.json'),
  'expansion-public-cells.json':json('expansion-public-cells.json')};
const live={AbortSignal,fetch:async url=>({ok:true,json:async()=>url.startsWith('https://')?[]:structuredClone(files[url])})};
vm.createContext(live);
vm.runInContext(read('live-data.js')+';globalThis.load=loadPublishedProfiles;',live);
const load=async(file,key,version)=>{const saved=files[file][key];files[file][key]=version;try{return await live.load();}finally{files[file][key]=saved;}};
let loaded=await live.load();
assert.deepEqual(plain(loaded.outdated),[]);
assert.equal(loaded.species.length,22);
assert.ok(loaded.species.every(s=>!s.releaseOutdated));
loaded=await load('expansion-public-cells.json','schemaVersion','candidate-public-cells-3');
assert.deepEqual(plain(loaded.outdated),[{file:'expansion-public-cells.json',version:'candidate-public-cells-3'}]);
assert.ok(loaded.species.every(s=>s.releaseOutdated&&s.cells.length===0&&s.status==='검수 자료 새 버전 있음 · 새로고침(F5)'
  &&s.info.occurrence_status==='client_outdated'));
assert.equal(ctx.releaseMissing(loaded.species[0]),'검수 자료 새 버전 있음 · 새로고침(F5)');
for(const [file,key,version] of [['candidate-catalog.json','schemaVersion','candidate-catalog-2'],['expansion-evidence.json','schemaVersion','expansion-evidence-2']]){
  loaded=await load(file,key,version);
  assert.deepEqual(plain(loaded.outdated),[{file,version}]);
}
for(const [file,key,version] of [['expansion-public-cells.json','schemaVersion','candidate-public-cells-1'],
  ['expansion-public-cells.json','schemaVersion','candidate-public-cells-x'],['candidate-catalog.json','schemaVersion','catalog-2']]){
  loaded=await load(file,key,version);
  assert.deepEqual(plain(loaded.outdated),[],version);
}
loaded=await load('expansion-public-cells.json','schemaVersion','candidate-public-cells-1');
assert.ok(loaded.species.every(s=>!s.releaseOutdated&&s.status==='새로고침(F5)으로 검수 자료 다시 불러오기'),'a malformed release stays unloaded (2026-10-17: worded as the reload step)');
assert.equal(ctx.releaseMissing(loaded.species[0]),'새로고침(F5)으로 검수 자료 다시 불러오기');

// (8) ?v= is the first 10 hex characters of sha256 over the LF-normalized file, so every change busts the
// one-year immutable cache (dist/_headers) and the value is the same on Windows (CRLF checkout) and Linux.
const html=read('index.html');
for(const file of ['app.js','score-format.js','live-data.js','style.css','pilot.css','theme.css','intro.js','intro.css','i18n.js','mobile-compact.css','mobile-compact.js']){
  const expected=crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  const found=[...html.matchAll(new RegExp(`["/]${file.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]);
  assert.deepEqual(found,[expected],`${file}?v= must be ${expected}`);
}
// 2026-10-24: the English dictionaries are asked for by i18n.js (only on ?lang=en) with the same ?v= rule
{const i18n=read('i18n.js');for(const file of ['i18n-en.js','i18n-data-en.json']){
  const expected=crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...i18n.matchAll(new RegExp(`${file.replace(/[.-]/g,'\\$&')}\\?v=([0-9a-f]+)`,'g'))].map(m=>m[1]),[expected],`i18n.js: ${file}?v= must be ${expected}`);}}
console.log('PASS: newer data files reload once per file and version, then show 새 버전 있음; ?v= matches file hashes');
