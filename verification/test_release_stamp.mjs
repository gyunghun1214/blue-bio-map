// Release stamp (2026-10-19, LKH, prompt 10/10): the notice popover names the presentation build from dist/release.json
// once its commit is filled in ("발표 기준판 2026-10-27 · 커밋 abc1234", plus an optional note for a fix after the freeze);
// with the commit empty, as committed, it shows the method version as before. README gives the steps and the freeze.
// Run: node verification/test_release_stamp.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n'); // a Windows checkout (CI) has CRLF
const rel=JSON.parse(read('release.json'));
assert.deepEqual(rel,{label:'발표 기준판',date:'2026-10-27',commit:''},'committed with the commit empty: the popover is as before');
const app=read('app.js');
const ctx={};vm.createContext(ctx);
vm.runInContext(app.match(/^const releaseText=.*$/m)[0].replace(/^const /,'var '),ctx);
const t=ctx.releaseText;
for(const r of [rel,null,undefined,{},{...rel,commit:'   '},{...rel,commit:'not-a-sha'},{...rel,commit:'abc12'}])assert.equal(t(r),'',JSON.stringify(r));
assert.equal(t({...rel,commit:'abc1234'}),'발표 기준판 2026-10-27 · 커밋 abc1234');
assert.equal(t({...rel,commit:' ABC1234DEF5678 '}),'발표 기준판 2026-10-27 · 커밋 abc1234','seven characters, lower case');
assert.equal(t({...rel,commit:'def5678',note:'11-02 오탈자 수정'}),'발표 기준판 2026-10-27 · 커밋 def5678 · 11-02 오탈자 수정');
// the popover: the stamp when set, else the method version as before; the file is read once at start and is optional
assert.match(app,/function renderPopVersion\(\)\{\n  const info=data\?\.assessmentInfo;\n  \$\('pop-version'\)\.textContent=releaseText\(releaseInfo\)\|\|\(data&&info\?\.version\?`\$\{released\(info\)\?'':'시범 '\}\$\{methodName\(info\.version\)\}/,'the method version by its Korean name (site v4 08)');
assert.match(app,/fetch\('release\.json'\)\.then\(r=>r\.ok\?r\.json\(\):null\)\.then\(r=>\{releaseInfo=r;renderPopVersion\(\);\},\(\)=>\{\}\);/);
assert.equal((app.match(/renderPopVersion\(\);/g)||[]).length,2,'drawn with the status chips and when the file arrives');
// Development log (README until 2026-10-31, now docs/development-log.md): the steps before submission (one file) and the
// freeze after it; the tag is the team's to make
const readme=fs.readFileSync(new URL('../docs/development-log.md',import.meta.url),'utf8');
const sec=readme.slice(readme.indexOf('## 발표 기준판과 제출 뒤 동결'),readme.indexOf('## 자료 사용'));
for(const w of ['dist/release.json','final-2026-10-27','main에 병합하지 않는다','"note"','?fresh='])assert.ok(sec.includes(w),`development log freeze section names ${w}`);
console.log('PASS: release stamp from release.json (empty commit: the method version as before), its format, README steps and freeze');
