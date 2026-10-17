// Screen dictionary (readability pass, 2026-10-15). dist/screen-text-ko.json shows English notes of the records in Korean
// on screen; the records keep the English. (1) Each key is a text that some dist/*.json record holds, (2) each value is
// Korean, (3) every number of the English stays in the Korean (no value changed in translation), (4) escL marks the English
// stretches of a Korean line with lang="en" and leaves Hangul-free text to enAttr.
// Run: node verification/test_screen_text_ko.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const dict=JSON.parse(read('screen-text-ko.json'));
assert.equal(dict.schema,'screen-text-ko-1');
const texts=new Set();
const walk=o=>{if(typeof o==='string')texts.add(o);else if(o&&typeof o==='object')for(const v of Object.values(o))walk(v);};
for(const f of fs.readdirSync(D).filter(f=>f.endsWith('.json')&&!f.endsWith('-ko.json')))walk(JSON.parse(read(f)));
const nums=t=>(t.match(/\d+(?:[.,]\d+)*/g)||[]).map(n=>n.replace(/,/g,''));
let n=0;
for(const [en,ko] of Object.entries(dict.by_text)){
  assert.ok(texts.has(en),`key is a record text: ${en.slice(0,70)}`);
  assert.match(ko,/[가-힣]/,`Korean value: ${en.slice(0,70)}`);
  const k=new Set(nums(ko));
  for(const x of nums(en))assert.ok(k.has(x),`number ${x} kept: ${en.slice(0,70)}`);
  n++;
}
assert.ok(n>=250,`dictionary holds ${n} notes`);

const app=read('app.js');
const ctx={};vm.createContext(ctx);
vm.runInContext(app.slice(0,app.indexOf('const colors')).replace(/^const |^let /gm,'var ')+';globalThis.T={escL,esc};',ctx);
ctx.screenTextKo={'Plain note.':'한국어 설명.'};
assert.equal(ctx.T.esc('Plain note.'),'한국어 설명.');
assert.equal(ctx.T.escL('참담치 양식 (Development of optimal technology, Mytilus coruscus)'),'참담치 양식 (<span lang="en">Development of optimal technology, Mytilus coruscus</span>)');
assert.equal(ctx.T.escL('Pacific oyster, Wild, Raw'),'Pacific oyster, Wild, Raw');
assert.equal(ctx.T.escL('굴 RDA DB 10.4'),'굴 RDA DB 10.4');
assert.equal(ctx.T.escL('A & B 표'),'A &amp; B 표');
console.log(`screen-text-ko: ${n} notes, keys in the records, numbers kept; escL marks English inside Korean lines`);
