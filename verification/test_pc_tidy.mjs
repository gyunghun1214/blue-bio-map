// 2026-10-29 휴대폰·PC 다시 점검 (verification/2026-10-29-pc-recheck): pc-tidy.css·mobile-compact.js·app.js·expedition.css 고친 곳을 브라우저 없이 본다.
//   node verification/test_pc_tidy.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('pc-tidy.css'),js=read('mobile-compact.js'),app=read('app.js'),exp=read('expedition.css'),headers=read('_headers'),bot=read('chatbot.js'),en=read('i18n-en.js');

// (1) 불러오기: map-attribution.css 바로 뒤, meongi.css 바로 앞(meongi.css가 맨 끝). ?v= 해시, 1년 캐시
const sheets=[...html.replace(/<noscript>[^]*?<\/noscript>/g,'').matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
assert.deepEqual(sheets.slice(-3),['map-attribution.css','pc-tidy.css','meongi.css'],`order: ${sheets}`);
assert.match(html,/<link rel="stylesheet" href="pc-tidy\.css\?v=[0-9a-f]{10}">/);
assert.match(headers,/\n\/pc-tidy\.css\n  Cache-Control: public, max-age=31536000, immutable\n/);

// (2) pc-tidy.css: 규칙은 넓은 화면(741px 이상) 또는 마우스(pointer:fine) 안에만. 새 글자 크기 12px 미만 없음
const bare=css.replace(/\/\*[^]*?\*\//g,'');
let depth=0,outside='';for(const ch of bare){if(ch==='{')depth++;if(depth===0)outside+=ch;if(ch==='}')depth--;}
for(const q of outside.split('}').map(x=>x.trim()).filter(Boolean))assert.match(q,/^@media \((min-width:(741|1180)px|pointer:fine)\)/,`top-level rule outside a wide/mouse media query: ${q}`);
for(const m of css.matchAll(/font-size:([^;}]+)/g))assert.ok(!/(^|[^0-9.])([0-9]|1[01])(\.\d+)?px/.test(m[1]),`font-size under 12px: ${m[1]}`);
// H1 저장 사본 칩, H2 바닥글·대화창, M2 낱말 단위, M5 필터 접기, 옮긴 멍이
assert.match(css,/\.header:has\(#alert-chip:not\(\[hidden\]\)\)\{gap:22px\}/);
assert.match(css,/:is\(#notice-chip-text,#alert-chip-text\)\{min-width:0;overflow:hidden;text-overflow:ellipsis\}/);
assert.match(css,/footer\{padding-right:max\(20px,calc\(var\(--bbc-right,16px\) \+ 72px\)\)\}/);
assert.match(css,/\.bbc-fab\[aria-expanded=true\],\.bbc-moved \.bbc-fab\{translate:none\}/);
assert.match(css,/body\{word-break:keep-all;overflow-wrap:break-word\}/);
assert.match(css,/@media \(min-width:741px\) and \(max-width:1179px\)\{\n  #explore \.filter-toggle\{display:flex/);
assert.doesNotMatch(css,/species-card>em\{white-space:normal/);  // 종 카드 한 높이(2026-10-18 규칙) 때문에 학명은 한 줄 그대로

// (3) mobile-compact.js: 멍이 비켜 앉기·지도 지명 정리가 마우스 PC에서도 돈다. 닫힌 근거 서랍(inert)·안 보이는 단추는 세지 않는다
assert.ok(!/if\(!matchMedia\('\(pointer:coarse\)'\)\.matches\)return;/.test(js),'no coarse-only early return');
assert.match(js,/const coarse=matchMedia\('\(pointer:coarse\)'\)\.matches;/);
assert.match(js,/\.leaflet-control-attribution,\[inert\]'\)&&shown\(e\)/);
assert.match(js,/!coarse&&w>8&&h>8/);
assert.match(js,/setTimeout\(dodge,1600\)/);
assert.match(js,/!coarse&&root\.classList\.contains\('bbc-moved'\)/);  // 옮긴 멍이는 PC에서 비켜 앉지 않는다

// (4) app.js: 지도 이름표를 채운 뒤 맞춘다(M3), 필터 접기는 741px부터(M5)
const cell=app.slice(app.indexOf('function renderCellMap'),app.indexOf('// The same cell evidence as the popups'));
assert.ok(cell.indexOf("setMapChip(s,chipCells(s)")>0&&cell.indexOf("setMapChip(s,chipCells(s)")<cell.indexOf('fitPad(40)'),'chip before fit');
assert.match(app,/function syncFolds\(\)\{\n[^\n]*\n  const wide=!!globalThis\.matchMedia\?\.\('\(min-width:741px\)'\)\.matches;/);
assert.match(app,/matchMedia\?\.\('\(min-width:741px\)'\)\.addEventListener\?\.\('change',syncFolds\)/);

// (5) expedition.css: 넓은 화면 13px·낱말 단위(M1), 가로 휴대폰 첫 화면 칩(M4), 점수 칸 위에서부터(L3), 닫기 여백(L4)
const wide=exp.slice(exp.indexOf('@media (min-width:761px){\n  :root{--fs-min:13px}'));
assert.ok(wide.length<exp.length,'wide expedition block');
assert.match(wide,/\.x-obs small[^{]*\{font-size:13px\}/);
assert.match(exp,/body\.is-intro \.x-route-note\{display:none\}/);
assert.match(exp,/\.x-score\{align-content:start\}/);
for(const m of exp.slice(exp.indexOf('PC 다시 점검 M1')).matchAll(/font-size:([^;}]+)/g))assert.ok(!/(^|[^0-9.])([0-9]|1[0-2])(\.\d+)?px/.test(m[1]),`expedition wide font-size under 13px: ${m[1]}`);

// (6) 멍이 첫 인사(L5): AI를 쓸 수 있을 때만 바뀌고, 두 문장 모두 영어 사전에 있다
const W1='안녕하세요! 사용법 안내 도우미 멍이예요. 미리 준비한 답으로 이 지도 사용법을 알려드릴게요. 아래에서 고르거나 궁금한 점을 직접 적어 보세요.';
const W2='안녕하세요! 사용법 안내 도우미 멍이예요. 준비한 답으로 이 지도 사용법을 알려드리고, 준비된 답이 없으면 AI(Claude)가 사이트 글로 답해요. 아래에서 고르거나 궁금한 점을 직접 적어 보세요.';
assert.ok(bot.includes(`const WELCOME='${W1}'`)&&bot.includes(`w.textContent=on?'${W2}':WELCOME`));
assert.match(bot,/add\('bbc-bot',WELCOME,'welcome'\)\.dataset\.welcome='1';checkAi\(\);/);
for(const k of [W1,W2])assert.ok(en.includes(JSON.stringify(k)+':'),`English for ${k.slice(0,30)}`);
console.log('PASS: pc-tidy — CSS between map-attribution.css and meongi.css, wide/mouse-only rules ≥12px, PC dodge, chip before fit, 741px filter fold, expedition 13px, welcome line in both languages');
