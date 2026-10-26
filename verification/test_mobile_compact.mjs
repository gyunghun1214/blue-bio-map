// 2026-10-25 휴대폰 글 양 줄이기 (verification/2026-10-25-mobile-compact-text): 마크업·CSS·스크립트만 보는 검사(브라우저 없이).
// 화면 동작(390px 시트·접기, 1440px 그대로)은 uicheck.mjs의 'mobile-compact' 검사들이 본다.
//   node verification/test_mobile_compact.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('mobile-compact.css'),js=read('mobile-compact.js'),headers=read('_headers');

// (1) 불러오기: CSS는 문서의 다른 모든 스타일시트 다음(휴대폰 글자 크기 mobile-type.css가 맨 아래에 있어 그 바로 뒤),
// 스크립트는 app.js 다음(defer). 둘 다 1년 캐시 목록에.
const head=html.slice(0,html.indexOf('</head>'));
const sheets=[...html.replace(/<noscript>[^]*?<\/noscript>/g,'').matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
// 2026-10-25 휴대폰 반복 설명 정리(mobile-dedupe.css), 2026-10-26 휴대폰 지도 출처 ⓘ(map-attribution.css)·멍이(meongi.css)만 이 파일 뒤에 온다
assert.equal(sheets.filter(f=>!['mobile-dedupe.css','map-attribution.css','meongi.css'].includes(f)).at(-1),'mobile-compact.css',`mobile-compact.css is the last stylesheet (before mobile-dedupe.css, map-attribution.css, meongi.css): ${sheets}`);
assert.ok(sheets.indexOf('mobile-compact.css')>sheets.indexOf('intro.css'));
if(sheets.includes('mobile-type.css'))assert.match(html,/<link rel="stylesheet" href="mobile-type\.css\?v=[0-9a-f]{10}"><link rel="stylesheet" href="mobile-compact\.css\?v=[0-9a-f]{10}">/,'right after mobile-type.css');
assert.match(head,/<script defer src="app\.js\?v=[0-9a-f]{10}"><\/script><script defer src="mobile-compact\.js\?v=[0-9a-f]{10}"><\/script>/);
for(const f of ['/mobile-compact.css','/mobile-compact.js'])assert.match(headers,new RegExp(`\\n${f.replace('.','\\.')}\\n  Cache-Control: public, max-age=31536000, immutable\\n`),f);

// (2) 접는 칸: HTML에서 열려 있고(스크립트가 없어도 글이 보인다), summary는 비어 있고 이름은 '더 보기'.
const folds=[...html.matchAll(/<details class="mc-more"( open)?>(<summary[^>]*>[^<]*<\/summary>)/g)];
assert.equal(folds.length,11,'11 folds: 읽는 법 목록 · 국가 시스템 표 · 02 세 항목 · ChEMBL 둘째 문단 · 03 네 항목 · 자료를 읽을 때');
for(const [,open,sum] of folds){assert.equal(open,' open','<details class="mc-more" open> in the HTML');assert.equal(sum,'<summary aria-label="더 보기"></summary>');}
// 목록 항목의 시작 마크업(<li><b>…)은 그대로: <details>는 첫 문장 뒤에만, <li>에 class 없음
for(const m of html.matchAll(/<li([^>]*)>((?:(?!<\/li>).)*?)<details class="mc-more"/g)){
  assert.ok(!/class=/.test(m[1]),'no class on the <li>: '+m[0].slice(0,60));
  assert.match(m[2],/^<b>[^<]+<\/b> .+다\. $/,'the <li> starts with <b>… and the first sentence before the fold: '+m[2].slice(0,60));
}
for(const s of ['<li><b>의약 후보 MBPI(MBPI-Rx, 보조)</b> ACE·잔틴 산화효소 펩타이드 층을 뺀 MBPI입니다. <details','<li id="method-mbpi-kind"><b>MBPI 근거 종류</b> ','<li><b>MFPI · 식량</b> ','<li><b>MBPI · 생리활성</b> ','<li><b>MCUI · 보전</b> '])
  assert.ok(html.includes(s),s);
// 문단 안(<p> 안에는 <details>를 둘 수 없다): 비어 있는 단추 + 접히는 span, 단추가 가리키는 id가 있다
const btns=[...html.matchAll(/<button type="button" class="mc-more-btn" aria-label="더 보기" aria-expanded="true" aria-controls="([^"]+)"><\/button>/g)];
assert.equal(btns.length,1);for(const [,id] of btns)assert.ok(html.includes(`<span class="mc-rest" id="${id}">`),id);

// (3) 지도 읽는 법 시트: 글자 없는 껍데기, 대화상자, 제목은 기존 '지도 읽는 법' 제목
assert.ok(html.includes('<div id="map-guide" class="map-guide" role="dialog" aria-modal="true" aria-labelledby="map-guide-title" hidden><div class="mg-back" data-mg-close></div><div class="mg-panel"><button type="button" class="mg-close" data-mg-close aria-label="닫기"></button><div class="mg-body"></div></div></div></section>'));
assert.ok(html.includes('<details class="map-notes" open><summary id="map-guide-title">지도 읽는 법</summary>'));
assert.ok(html.indexOf('id="map-guide"')>html.indexOf('<section id="explore"')&&html.indexOf('id="map-guide"')<html.indexOf('<section id="compare"'),'the sheet is in the explore view');

// (4) CSS: 넓은 화면은 접는 칸이 없는 것처럼, 휴대폰 글자는 content로만, 첫 화면 문구는 760px 이하에서만 숨김, 12px 미만 글자 없음
const block=q=>{const i=css.indexOf(`@media ${q}{`);assert.ok(i>=0,q);let d=0,j=i;for(;j<css.length;j++){if(css[j]==='{')d++;else if(css[j]==='}'&&--d===0)break;}return css.slice(i,j+1);};
const wide=block('(min-width:741px)');
assert.match(wide,/details\.mc-more\{display:contents\}/);assert.match(wide,/\.mc-more>summary,\.mc-more-btn\{display:none\}/);
assert.match(block('(max-width:760px)'),/\{\s*\.gate-connect\{display:none\}/);
assert.ok(!/gate-(task|connect)/.test(css.replace(block('(max-width:760px)'),'').replace(/\/\*[^]*?\*\//g,'')),'the contest lines are hidden only on phones');
assert.match(css,/summary::before\{content:"더 보기"\}/);assert.match(css,/\[open\]>summary::before\{content:"접기"\}/);
for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,'new CSS text 12px or more: '+m[0]);
assert.ok(!/\.(map-notes|map-legend-more|legend-why|map-info)[^{]*\{[^}]*display:none/.test(css.replace(/#explore \.map-below>\.map-notes\{display:none\}/,'')),'the map notes are hidden only from the flow under the map');

// (5) 스크립트: 휴대폰(740px)에서만 접고 시트를 연다, 인라인 처리기 없음(CSP)
assert.match(js,/matchMedia\('\(max-width:740px\)'\)/);
assert.ok(!/on(click|load|keydown)=/.test(html.slice(html.indexOf('<div id="map-guide"'),html.indexOf('</section>',html.indexOf('<div id="map-guide"')))));
console.log(`PASS: mobile-compact — ${folds.length} folds open in the HTML with an empty 더 보기 summary, one paragraph button, the map guide sheet shell, CSS last, ?v= and cache headers`);
