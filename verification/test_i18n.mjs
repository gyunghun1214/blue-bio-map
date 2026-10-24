// 언어 전환 검사 (2026-10-24). 사전 파일만 보는 검사는 늘 돌고, --browser를 붙이면 로컬 dist(http://127.0.0.1:8765/)를 열어 화면도 본다.
//   node verification/test_i18n.mjs              (다) 숫자 같음 · (바) 용어·단서 · (사) 사전 HTML의 링크·태그 · 변수 이름 · i18n.js 동작
//   node verification/test_i18n.mjs --browser    + (가) 한국어 화면이 기준과 한 글자도 다르지 않음 · (나) 영어 화면에 표시 없이 남은 한글
//                                                  · (라) 같은 종 상세의 BBVI·MCUI·MBPI·MFPI와 셀 수 · (사) 두 언어의 href 목록
// (마) 자료 사전 완성도는 python scripts/i18n_data_strings.py --check가 본다(CI unit 잡).
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import vm from 'node:vm';
import {execFileSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), D=path.join(HERE,'..','dist'), read=f=>fs.readFileSync(path.join(D,f),'utf8');
const fails=[], fail=m=>fails.push(m);
const H=/[ㄱ-ㆎ가-힣]/;

// 사전 읽기: i18n.js + i18n-en.js를 페이지처럼 한 맥락에서 돌린다(영어로).
const ctx={location:{search:'?lang=en'},URLSearchParams,console:{debug(){}}};vm.createContext(ctx);
vm.runInContext(read('i18n.js')+'\n'+read('i18n-en.js')+';globalThis.X={LANG,I18N_EN,T_,TX_,i18nKey,i18nFill,I18N_DATA,fmtNum};',ctx);
const {X}=ctx; assert.equal(X.LANG,'en');
const data=JSON.parse(read('i18n-data-en.json')); assert.equal(data.schema,'i18n-data-en-1');
const ui=Object.entries(X.I18N_EN), dat=Object.entries(data.by_text), all=[...ui.map(e=>[...e,'ui']),...dat.map(e=>[...e,'data'])];

// i18n.js 동작: ko는 원문 그대로, en은 사전 → 없으면 원문, 변수·단수복수
{const k={location:{search:''},URLSearchParams,localStorage:{getItem:()=>null}};vm.createContext(k);vm.runInContext(read('i18n.js')+';globalThis.Y={LANG,T_,TX_,fmtNum};',k);
  assert.equal(k.Y.LANG,'ko');assert.equal(k.Y.T_('  {n}종  ',{n:3}),'  3종  ','ko keeps the original exactly');assert.equal(k.Y.TX_('가'),'가');
  assert.equal(k.Y.fmtNum(1234),(1234).toLocaleString());assert.equal(k.Y.fmtNum(1234,'ko-KR'),(1234).toLocaleString('ko-KR'));
  const j={location:{search:'?lang=xx'},URLSearchParams,localStorage:{getItem:()=>'en'}};vm.createContext(j);vm.runInContext(read('i18n.js')+';globalThis.Y={LANG};',j);
  assert.equal(j.Y.LANG,'en','an unknown ?lang= is ignored, localStorage decides');}
assert.equal(X.i18nFill('{n} {n|record|records}',{n:1}),'1 record');assert.equal(X.i18nFill('{n} {n|record|records}',{n:2}),'2 records');
assert.equal(X.T_('사전에 없는 문장 {n}',{n:1}),'사전에 없는 문장 1','a missing key falls back to the Korean');

// 키는 정규화한 원문, 값에 한글 없음(원어 그대로 둔 고유 이름은 예외 목록)
const exceptions=JSON.parse(fs.readFileSync(path.join(HERE,'i18n-number-exceptions.json'),'utf8'));
const hangulOk=new Set(exceptions.hangul_kept.map(x=>x.ko));
for(const [ko,en,src] of all){
  if(X.i18nKey(ko)!==ko)fail(`${src} key not normalized: ${ko.slice(0,60)}`);
  if(typeof en!=='string'||!en.trim())fail(`${src} empty value: ${ko.slice(0,60)}`);
  else if(H.test(en.replace(/<[^>]*>/g,''))&&!hangulOk.has(ko))fail(`${src} Hangul left in the English: ${ko.slice(0,50)} → ${en.slice(0,60)}`);
}

// 변수 이름: 원문의 {이름}이 영어에도 모두 있고, 영어에 없는 변수를 쓰지 않는다
const vars=s=>[...String(s).matchAll(/\{(\w+)(?:\|[^|{}]*\|[^|{}]*)?\}/g)].map(m=>m[1]);
for(const [ko,en,src] of all){const a=new Set(vars(ko)),b=new Set(vars(en));if([...a].some(v=>!b.has(v))||[...b].some(v=>!a.has(v)))fail(`${src} placeholders differ: ${ko.slice(0,60)} | ${en.slice(0,60)}`);}

// (다) 숫자 같음: 정수·소수·% 묶음(다중집합)을 비교한다. 천 단위 쉼표를 지우고, 한국어 만·억·천은 숫자로 바꾼다. 태그 안(링크 주소)은 뺀다.
const text=s=>String(s).replace(/<[^>]*>/g,' ').replace(/\{(\w+)(?:\|[^|{}]*\|[^|{}]*)?\}/g,' ');
const nums=s=>{let t=text(s).replace(/(\d),(?=\d{3}\b)/g,'$1');
  t=t.replace(/(\d+(?:\.\d+)?)\s*억(?!제)\s*(?:(\d+(?:\.\d+)?)\s*만(?![큼족]))?/g,(m,a,b)=>String(Number(a)*1e8+(b?Number(b)*1e4:0)))
    .replace(/(\d+(?:\.\d+)?)\s*만(?![큼족])\s*(?:(\d+(?:\.\d+)?)\s*천(?!연))?/g,(m,a,b)=>String(Number(a)*1e4+(b?Number(b)*1e3:0)))
    .replace(/(\d+(?:\.\d+)?)\s*천(?!연)/g,(m,a)=>String(Number(a)*1e3));
  return (t.match(/\d+(?:\.\d+)?%?/g)||[]).map(n=>n.replace(/^0+(?=\d)/,'')).sort();};
const numOk=new Map(exceptions.numbers.map(x=>[x.ko,x.reason]));
let numChecked=0;
for(const [ko,en,src] of all){numChecked++;const a=nums(ko),b=nums(en);if(a.join('|')!==b.join('|')&&!numOk.has(ko))fail(`(다) ${src} numbers differ: [${a}] vs [${b}] · ${ko.slice(0,70)}`);}
for(const k of numOk.keys())if(!Object.hasOwn(X.I18N_EN,k)&&!Object.hasOwn(data.by_text,k))fail(`(다) stale number exception: ${k.slice(0,60)}`);

// (바) 용어 사전(docs/i18n-glossary.md 표): 원문에 한국어 용어가 있으면 영어에 지정 용어(여럿이면 그중 하나)가 있어야 한다.
const gl=fs.readFileSync(path.join(HERE,'..','docs','i18n-glossary.md'),'utf8').split('\n').map(l=>l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/)).filter(m=>m&&!/^(한국어|---)/.test(m[1])).map(m=>[m[1],m[2].split(' / ').map(s=>s.trim().toLowerCase())]);
assert.ok(gl.length>=30,`glossary rows: ${gl.length}`);
const termOk=new Set(exceptions.terms.map(x=>x.ko+'\u0000'+x.term));
let termChecked=0;
for(const [ko,en,src] of all){const t=text(ko),e=text(en).toLowerCase();
  for(const [term,alts] of gl){if(!t.includes(term))continue;termChecked++;if(!alts.some(a=>e.includes(a))&&!termOk.has(ko+'\u0000'+term))fail(`(바) ${src} term ${term} → ${alts.join(' / ')} missing: ${ko.slice(0,60)} | ${en.slice(0,80)}`);}}
// 과장어는 원문에 대응하는 말(검증·확인·보장·안전·입증)이 있을 때만
for(const [ko,en,src] of all){const m=text(en).match(/\b(proven|confirmed|guaranteed|definitely|safe|validated)\b/i);if(m&&!/검증|확인|보장|안전|입증|타당/.test(ko))fail(`(바) ${src} '${m[1]}' without a Korean basis: ${ko.slice(0,60)}`);}
// 단서어: 추정·가능성·예비·약(숫자 앞)이 영어에서 사라지지 않았는지
const HEDGE=[[/추정/,/estimat|approximat/i],[/가능성|가능할/,/may|might|could|can|possib|potential|likel|feasib/i],[/예비/,/prelim/i],[/(^|[^가-힣])약\s?\d/,/about|approx|around|~|≈/i]];
const hedgeOk=new Set(exceptions.hedges.map(x=>x.ko));
for(const [ko,en,src] of all)for(const [k,e] of HEDGE)if(k.test(text(ko))&&!e.test(text(en))&&!hedgeOk.has(ko))fail(`(바) ${src} hedge ${k} lost: ${ko.slice(0,60)} | ${en.slice(0,80)}`);

// (사) 사전의 HTML 문장(data-i18n-html): 링크 주소가 원문과 같고, 허용 태그만 쓴다
const TAGS=new Set(['a','b','strong','em','i','br','span','small']);
for(const [ko,en,src] of all){if(!/</.test(ko)&&!/</.test(en))continue;
  const hr=s=>[...s.matchAll(/href="([^"]*)"/g)].map(m=>m[1]).join(' ');if(hr(ko)!==hr(en))fail(`(사) ${src} href differs: ${ko.slice(0,60)}`);
  for(const m of en.matchAll(/<\/?([a-z0-9]+)/gi))if(!TAGS.has(m[1].toLowerCase()))fail(`(사) ${src} tag <${m[1]}> not allowed: ${ko.slice(0,60)}`);
  const ids=s=>[...s.matchAll(/\b(id|class|data-[\w-]+)="([^"]*)"/g)].map(m=>m[0]).sort().join(' ');if(ids(ko)!==ids(en))fail(`(사) ${src} ids/classes differ: ${ko.slice(0,60)}`);}

console.log(`i18n dictionaries: ${ui.length} screen + ${dat.length} data entries · numbers ${numChecked} · glossary terms ${termChecked} (${gl.length} rows)`);

// ---------- 화면 (--browser) ----------
if(process.argv.includes('--browser')){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'i18n-test-')), run=(...a)=>execFileSync(process.execPath,[path.join(HERE,'i18n_extract_text.mjs'),...a],{stdio:'inherit',timeout:600000});
  run(path.join(tmp,'ko.txt'),'--json',path.join(tmp,'ko.json'));run(path.join(tmp,'en.txt'),'--lang','en','--json',path.join(tmp,'en.json'));
  const base=fs.readFileSync(path.join(HERE,'i18n-ko-baseline.txt'),'utf8').replace(/\r\n/g,'\n'),now=fs.readFileSync(path.join(tmp,'ko.txt'),'utf8');
  // (가) 한국어 그대로
  if(base!==now){const a=base.split('\n'),b=now.split('\n');let i=0;while(i<a.length&&a[i]===b[i])i++;
    fail(`(가) Korean screen differs from verification/i18n-ko-baseline.txt from line ${i+1}: '${a[i]}' → '${b[i]}'`);}
  const ko=JSON.parse(fs.readFileSync(path.join(tmp,'ko.json'),'utf8')),en=JSON.parse(fs.readFileSync(path.join(tmp,'en.json'),'utf8'));
  let marked=0,orig=0,left=[];
  for(const [name,s] of Object.entries(en)){
    // (사) 두 언어의 링크 목록(lang 매개변수 제외)
    if(JSON.stringify(s.hrefs)!==JSON.stringify(ko[name].hrefs))fail(`(사) ${name}: href lists differ (${ko[name].hrefs.length} vs ${s.hrefs.length})`);
    // (라) 같은 종 상세의 지표와 셀 수
    if(ko[name].values&&JSON.stringify(ko[name].values)!==JSON.stringify(s.values))fail(`(라) ${name}: ${JSON.stringify(ko[name].values)} vs ${JSON.stringify(s.values)}`);
    for(const h of s.hangul||[]){if(h.kind==='ko')marked++;else if(h.kind==='orig')orig++;else left.push({screen:name,...h});}
  }
  // (나) 표시 없이 남은 한글(언어 버튼 '한국어'는 뽑지 않는다). KO 표시가 붙은 자료 문장과 원어 그대로의 출처 제목은 허용하고 수만 센다.
  console.log(`(나) English screens: ${marked} Korean texts marked KO, ${orig} original-language titles, ${left.length} left unmarked`);
  for(const h of left.slice(0,200))console.log(`  [${h.screen}] ${h.at} :: ${h.text}`);
  if(left.length)fail(`(나) ${left.length} Korean texts or attributes left on the English screens without a KO mark (listed above)`);
  fs.writeFileSync(path.join(tmp,'left.json'),JSON.stringify({marked,orig,left},null,1));
  console.log('browser outputs in',tmp);
}
if(fails.length){console.error(fails.slice(0,300).join('\n'));console.error(`FAIL: ${fails.length} problems`);process.exit(1);}
console.log('PASS: i18n dictionaries'+(process.argv.includes('--browser')?' and screens (Korean unchanged, links and scores the same)':''));
