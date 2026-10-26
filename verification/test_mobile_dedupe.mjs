// 2026-10-25 휴대폰 영어 눈썹 글 · 반복 설명 정리 (verification/2026-10-25-mobile-labels-dedupe): 마크업·CSS·스크립트만 보는 검사.
// 화면 동작(390px 숨김 · 단추 이동, 1440px · 영어 화면 그대로)은 uicheck.mjs의 'mobile-dedupe' 검사들이 본다.
//   node verification/test_mobile_dedupe.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('mobile-dedupe.css'),js=read('mobile-dedupe.js'),headers=read('_headers');

// (1) 불러오기: CSS는 mobile-compact.css 바로 다음(2026-10-26부터 그 뒤에는 휴대폰 지도 출처 ⓘ의 map-attribution.css만 온다),
// 스크립트는 mobile-compact.js 바로 다음. 1년 캐시.
const sheets=[...html.replace(/<noscript>[^]*?<\/noscript>/g,'').matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]).filter(f=>f!=='map-attribution.css');
assert.equal(sheets.at(-1),'mobile-dedupe.css',`mobile-dedupe.css is the last stylesheet (before map-attribution.css): ${sheets}`);
assert.equal(sheets.at(-2),'mobile-compact.css','right after mobile-compact.css');
assert.match(html,/<script defer src="mobile-compact\.js\?v=[0-9a-f]{10}"><\/script><script defer src="mobile-dedupe\.js\?v=[0-9a-f]{10}"><\/script>/);
for(const f of ['/mobile-dedupe.css','/mobile-dedupe.js'])assert.match(headers,new RegExp(`\\n${f.replace('.','\\.')}\\n  Cache-Control: public, max-age=31536000, immutable\\n`),f);

// (2) 기준 위치로 가는 단추: 글자 없음(content로만 그린다), 이름(aria-label) 있음, 대상 id가 있다
const see=[...html.matchAll(/<button type="button" class="see-also" data-see="([^"]+)" aria-label="([^"]+)"><\/button>/g)];
assert.deepEqual(see.map(m=>m[1]).sort(),['map-guide','method-03','mt-quad-card','mt-types-note'],'four buttons, one per target');
assert.equal(see.length,4,'four .see-also buttons');
assert.equal((html.match(/class="see-also"/g)||[]).length,4,'every .see-also is an empty button');
for(const [,key,label] of see){
  assert.ok(html.includes(`id="${key}"`),`target #${key}`);
  assert.equal(label,key==='map-guide'?'지도 읽는 법 보기':'근거와 방법에서 자세히 보기');
}
// 대상의 탭: 근거와 방법 셋, 탐색 지도 시트 하나
const sec=id=>{const i=html.indexOf(`id="${id}"`);return ['explore','compare','method'].filter(v=>html.lastIndexOf(`<section id="${v}"`,i)>=0).sort((a,b)=>html.lastIndexOf(`<section id="${b}"`,i)-html.lastIndexOf(`<section id="${a}"`,i))[0];};
for(const k of ['mt-quad-card','mt-types-note','method-03'])assert.equal(sec(k),'method',k);
assert.equal(sec('map-guide'),'explore');

// (3) 숨기는 글: 정해진 곳에만, 글은 그대로 남는다
const dupM=[...html.matchAll(/<(\w+) class="(?:[\w-]+ )?dup-m">([^<]*)/g)].map(m=>m[2]);
assert.deepEqual(dupM,[
  '기록 수 = 공개 관측 기록 건수입니다.',
  '지도의 붉은 점은 공개 셀 안에 고정한 도식적 무늬로, 기록이 있는 칸의 위치(넓게 묶음)를 보여 줍니다. 점은 바다 부분에만 찍습니다.',
  '공개 셀은 Natural Earth 1:10m 육지 경계로 바다 부분만 칠합니다.',
  '축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시입니다. 크기는 모인 셀 수, 진하기는 셀당 기록 수 구간입니다. 확대하면 셀별 붉은 점이 나옵니다. 선택 종의 기록 셀 수·기록 수·연도는 지도 위 칩에 한 번만 적습니다.',
  '활용 가능성이 높아도 보전이 필요할 수 있습니다. 두 값을 합쳐 위험이 가려지지 않도록 분리합니다.',
  '쉬운 이름은 두 값이 탐색용 기준선 50 위인지 아래인지를 읽은 것이고, 유형은 연구 순서를 고르기 위한 분류입니다.',
  '공식 산출값은 w = 0.50으로 고정입니다.'
].sort((a,b)=>html.indexOf(a)-html.indexOf(b)),'the .dup-m texts');
const dupSheet=[...html.matchAll(/<span class="dup-sheet">([^<]*)<\/span>/g)].map(m=>m[1]);
assert.equal(dupSheet.length,2);assert.equal(new Set(dupSheet).size,1,'the same two sentences in the legend and in 색의 의미');
// 목록 항목의 시작 마크업이 검사 대상인 줄(<li><b>…)에는 class를 달지 않았다
assert.ok(!/<li class="dup-m"><b>/.test(html));
for(const s of ['<li><b>BBVI 가중치</b> 공식 산출은 w = 0.50 고정입니다. <details','<li><b>MCUI</b> ','<li><b>의약 후보 MBPI(MBPI-Rx, 보조)</b> '])assert.ok(html.includes(s),s);

// (4) CSS: 휴대폰 한국어 화면에서만 숨긴다. 넓은 화면은 단추만 숨김, 영어 화면은 단추만 숨김. 새 글자 크기 12px 이상.
const bare=css.replace(/\/\*[^]*?\*\//g,'');
const block=q=>{const i=bare.indexOf(`@media ${q}{`);assert.ok(i>=0,q);let d=0,j=i;for(;j<bare.length;j++){if(bare[j]==='{')d++;else if(bare[j]==='}'&&--d===0)break;}return bare.slice(i,j+1);};
const phone=block('(max-width:740px)'),wide=block('(min-width:741px)');
assert.equal(wide.replace(/\s+/g,''),'@media(min-width:741px){.see-also{display:none}}','wide screens: only the buttons are hidden');
const rest=bare.replace(phone,'').replace(wide,'');
assert.equal(rest.replace(/\s+/g,''),'html.lang-en.see-also{display:none}','outside the phone block only the English screen hides the buttons');
for(const m of phone.slice(phone.indexOf("{")+1).matchAll(/([^{}]+)\{[^}]*display:none[^}]*\}/g))
  for(const sel of m[1].split(','))assert.match(sel.trim(),/^html:not\(\.lang-en\) /,'hidden only on the Korean screen: '+sel.trim());
for(const s of ['#method .mt-eyebrow','#method .mt-k','#cmp-read-pop .matrix-explanation>.eyebrow','.dup-m','.mg-body>.legend-why .dup-sheet','.mg-body>#value-legend~.map-legend-more>.dup-sheet'])
  assert.ok(phone.includes('html:not(.lang-en) '+s),s);
assert.match(phone,/\.see-also::before\{content:"근거와 방법에서 자세히 보기 →"\}/);
assert.match(phone,/\.see-also\[data-see="map-guide"\]::before\{content:"지도 읽는 법 보기 →"\}/);
assert.match(phone,/\.see-also\{[^}]*min-height:44px/);
for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,'new CSS text 12px or more: '+m[0]);
// 지표·자료 이름 칩(.mt-tag)과 단계 번호(.mt-n · .mt-acc-n · .mt-step)는 숨기지 않는다
assert.ok(!/mt-tag|mt-n\b|mt-acc-n|mt-step|gate-/.test(phone));

// (5) 스크립트: 기존 탭 이동(setView · methodGo)과 시트 여는 단추를 쓰고, 해시를 쓰지 않는다. 인라인 처리기 없음(CSP).
assert.match(js,/setView\('method',false\)/);assert.match(js,/methodGo\(t\)/);assert.match(js,/classList\.add\('flash'\)/);
assert.match(js,/\$\('value-info'\)/);assert.match(js,/\.map-legend-more>summary/);
assert.ok(!/location\.hash|history\.(push|replace)State/.test(js),'no hash');
assert.ok(!/\son(click|load|keydown)=/.test(html.match(/<button type="button" class="see-also"[^>]*>/g).join('')));
console.log(`PASS: mobile-dedupe — ${see.length} buttons to the base places, ${dupM.length} .dup-m texts, the map-sheet pair, CSS last and phone-Korean only, ?v= and cache headers`);
