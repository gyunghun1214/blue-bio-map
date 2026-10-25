// Small labels on the method cards (2026-10-21, LKH): '01 / 자료 연결', '02 / 산출 방법', '02 / 보조 근거', '02 / 자료 선택',
// '03 / 해석' read like steps that never came (no 02·03 after 01, 02 three times) and repeated the fold titles' numbers.
// The labels now carry the words only. A numbered set that stays on screen must run 01, 02, 03 … without a gap or a repeat.
// Run: node verification/test_method_kickers.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const page=read('index.html');
const files=fs.readdirSync(D).filter(f=>/\.(html|js)$/.test(f)).map(f=>[f,read(f)]);

// (1) No kicker anywhere in dist/ (html or the html a script writes) starts with a number and ' / '.
const kickerRe=/class=\\?["'](?:step|[\w-]*(?:kicker|eyebrow))\b[^"']*\\?["'][^>]*>\s*([^<]*)/g;
let kickers=0;
for(const [f,src] of files)for(const m of src.matchAll(kickerRe)){
  kickers++;
  assert.doesNotMatch(m[1],/^\s*\d+\s*\//,`${f}: kicker '${m[1].trim()}' starts with a number and ' / '`);
}
for(const [f,src] of files)assert.doesNotMatch(src,/>\s*\d{2} \/ [가-힣]/,`${f}: an 'NN / 이름' label on screen`);

// (2) The five method-card labels: words only, colour class and anchor ids unchanged.
const card=id=>{const i=page.indexOf(`id="${id}"`);assert.ok(i>0,`#${id} is on the page`);return page.slice(i,page.indexOf('</article>',i));};
for(const [id,cls,text] of [['method-01','step','자료 연결'],['method-02','step amber','산출 방법'],['method-obis','step amber','보조 근거'],
  ['method-chembl','step amber','자료 선택'],['method-03','step amber','해석']])
  assert.ok(card(id).includes(`<span class="${cls}">${text}</span>`),`#${id}: <span class="${cls}">${text}</span>`);
assert.ok(page.includes('상자를 누르면 해당 설명(자료 연결 · 산출 방법 · 해석)을 펼치고 그 자리로 이동합니다.'),'flow caption without numbers');

// (3) The flow boxes still open #method-01/02/03 (app.js: $('method-'+g.dataset.step)).
const steps=[...page.matchAll(/data-step="([^"]+)"/g)].map(m=>m[1]);
assert.ok(steps.length>0);
for(const s of new Set(steps))assert.ok(page.includes(`id="method-${s}"`),`data-step="${s}" → #method-${s}`);
assert.match(read('app.js'),/\$\('method-'\+g\.dataset\.step\)/);

// (4) The numbered sets kept on screen run 01, 02, 03 … in page order.
for(const cls of ['mt-acc-n','mt-n']){
  const ns=[...page.matchAll(new RegExp(`<span class="${cls}">(\\d+)</span>`,'g'))].map(m=>+m[1]);
  assert.ok(ns.length>1,cls);assert.deepEqual(ns,ns.map((_,i)=>i+1),`${cls}: ${ns.join(',')}`);
}
const flow=[...page.matchAll(/class="mt-step s\d"><span>(\d+)<\/span>/g)].map(m=>+m[1]);
assert.ok(flow.length>1);assert.deepEqual(flow,flow.map((_,i)=>i+1),`mt-step: ${flow.join(',')}`);

console.log(`method kickers: ${kickers} kickers without 'NN / ', 5 method-card labels, ${new Set(steps).size} flow anchors, numbered sets 01→N`);
