// 2026-10-26 휴대폰 탐색 지도 배경 지도 출처 ⓘ (verification/2026-10-26-map-attribution-info): 마크업·CSS·스크립트만 보는 검사.
// 화면 동작(390px 접힘·펼침·닫기·자리, 1440px 그대로)은 uicheck.mjs의 'map attribution' 검사 두 개와 그 폴더의 check.mjs가 본다.
//   node verification/test_map_attribution.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),css=read('map-attribution.css'),app=read('app.js'),headers=read('_headers'),en=read('i18n-en.js');

// (1) 불러오기: 모든 스타일시트 중 마지막(mobile-dedupe.css 바로 다음), ?v= 해시, 1년 캐시
const sheets=[...html.replace(/<noscript>[^]*?<\/noscript>/g,'').matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
assert.equal(sheets.at(-1),'map-attribution.css',`map-attribution.css is the last stylesheet: ${sheets}`);
assert.equal(sheets.at(-2),'mobile-dedupe.css','right after mobile-dedupe.css');
assert.match(html,/<link rel="stylesheet" href="map-attribution\.css\?v=[0-9a-f]{10}">/);
assert.match(headers,/\n\/map-attribution\.css\n  Cache-Control: public, max-age=31536000, immutable\n/);

// (2) CSS: 단추는 넓은 화면에서 숨김, 휴대폰 규칙은 740px 이하에만. 새 글자 크기는 12px 이상, 출처 글은 13px 이상
assert.match(css,/^\.attr-toggle\{display:none\}$/m,'button hidden outside the phone rule');
const phone=css.slice(css.indexOf('@media (max-width:740px)'));
assert.ok(phone.length<css.length&&!/@media/.test(phone.slice(1)),'one phone block, no other media rules');
assert.ok(css.slice(0,css.indexOf('@media')).replace(/\/\*[^]*?\*\//g,'').trim()==='.attr-toggle{display:none}','nothing else outside the phone block');
for(const m of css.matchAll(/font-size:([^;}]+)/g))assert.ok(!/(^|[^0-9.])([0-9]|1[01])(\.\d+)?px/.test(m[1]),`font-size under 12px: ${m[1]}`);
assert.match(phone,/\.attr-open \.attr-text\{[^}]*font-size:max\(13px,var\(--fs-min\)\)/,'credits at 13px or more');
assert.match(phone,/bottom:calc\(var\(--sheet-cover,14px\) \+ 4px\)/,'button follows the sheet edge');

// (3) app.js: Leaflet의 출처 컨트롤을 그대로 쓰고(새 컨트롤 없음) 안쪽 span에 쓰게 한다. 단추는 글자 없이 aria만
assert.ok(!/L\.control\.attribution\(/.test(app),'no second attribution control');
assert.match(app,/aria-label','배경 지도 출처 보기'/);
assert.match(app,/setAttribute\('aria-controls',text\.id\)/);
assert.match(app,/ac\._update=function\(\)\{this\._container=text;/);
assert.match(app,/stage\.style\.setProperty\('--sheet-cover',cover\+'px'\)/);
assert.ok(!/attr-open[^\n]*localStorage|localStorage[^\n]*attr-open/.test(app),'open state is not stored');
// 출처 문구는 그대로
for(const s of ["attribution:'NASA GIBS · Blue Marble'","attribution:'GEBCO_2026 Grid · 항해용 아님'","setPrefix('Leaflet')","addAttribution('OBIS · GBIF')"])assert.ok(app.includes(s),s);

// (4) 영어 화면 사전에 단추 이름
assert.match(en,/"배경 지도 출처 보기":"[^"]+"/);
console.log('PASS: map-attribution — CSS last with ?v= and cache header, phone-only button, ≥13px credits, Leaflet control reused, credits unchanged, English label');
