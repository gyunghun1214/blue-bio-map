// 바다 탐험 생물 설명 파일 검사 (2026-10-31, 도연 피드백 3). dist/expedition-about.json
// (1) 탐사 지점(expedition-stops.json) 30종과 AphiaID가 하나도 빠지거나 남지 않는다
// (2) 종마다 ko·en·source_title·source_url(https)·checked(YYYY-MM-DD)가 있다 · 한국어는 공백 포함 40~90자, 1~2문장
// (3) 점수·유형 판단, 건강 효능, 최상급, 자료 약점 문구를 쓰지 않는다
// (4) 민감종(전복·피조개·해삼)은 지명을 쓰지 않는다
// (5) 화면 코드: 카드는 이름과 같은 단계(data-r="2")에 설명을 넣고, 설명이 없으면 줄째 뺀다 · 자세히 보기는 '어떤 생물인가요' + 출처
// Run: node verification/test_expedition_about.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const D=new URL('../dist/',import.meta.url), read=f=>fs.readFileSync(new URL(f,D),'utf8');
const doc=JSON.parse(read('expedition-about.json')), stops=JSON.parse(read('expedition-stops.json')).stops;
assert.equal(doc.schema,'expedition-about-1');
const A=doc.species, ids=stops.map(s=>String(s.aphia_id));
assert.deepEqual(Object.keys(A).sort(),[...ids].sort(),'one description per expedition stop, no extra');
const SENSITIVE=['397082','504357','241776'];
const PLACES=/동해|서해|남해|황해|제주|완도|독도|울릉|가막|여수|통영|거제|남해안|서해안|동해안|부산|인천|강원|경북|경남|전남|전북|충남|충북|경기|목포|진도|고흥|[가-힣]+만에서|Jeju|Wando|Dokdo|Ulleung|Yeosu|Tongyeong|Busan|Incheon|Kamak|Gamak|Yellow Sea|East Sea|South Sea/;
const SCORE=/BBVI|MCUI|MBPI|MFPI|점수|지표|유형|활용 연구|보전 연구|기초조사|index|score/i;
const HEALTH=/효능|약효|건강|치료|면역|항암|항산화|혈압|다이어트|health|cure|medic|immun|antioxid|cancer/i;
const SUPER=/가장|최고|최대|제일|으뜸|\b(?:best|most|largest|highest|finest)\b/i;
const WEAK=/준비 중|확인 중|자료 없음|정보 없음|미확인|부족|공백|not yet|unknown|missing/i;
for(const id of ids){const a=A[id],name=stops.find(s=>String(s.aphia_id)===id).korean_name;
  for(const k of ['ko','en','source_title','source_url','checked'])assert.ok(typeof a[k]==='string'&&a[k].trim(),`${name}: ${k}`);
  assert.match(a.source_url,/^https:\/\//,`${name}: https source`);
  assert.match(a.checked,/^\d{4}-\d{2}-\d{2}$/,`${name}: checked date`);
  const n=[...a.ko].length;assert.ok(n>=40&&n<=90,`${name}: Korean ${n} characters (40–90)`);
  assert.ok((a.ko.match(/다\./g)||[]).length<=2,`${name}: one or two Korean sentences`);
  assert.ok(!/[가-힣]/.test(a.en),`${name}: English has no Hangul`);
  for(const t of [a.ko,a.en]){
    assert.ok(!SCORE.test(t),`${name}: no score or type judgement: ${t}`);
    assert.ok(!HEALTH.test(t),`${name}: no health claim: ${t}`);
    assert.ok(!SUPER.test(t),`${name}: no superlative: ${t}`);
    assert.ok(!WEAK.test(t),`${name}: no weakness wording: ${t}`);
    if(SENSITIVE.includes(id))assert.ok(!PLACES.test(t),`${name}: sensitive species, no place name: ${t}`);}
}
const js=read('expedition.js'),css=read('expedition.css');
assert.match(js,/<div class="x-r x-species" data-r="2">[\s\S]*?\$\{aboutOf\(stop\)\?`<p class="x-about">\$\{esc\(aboutOf\(stop\)\)\}<\/p>`:''\}<\/div>\s*<div class="x-r" data-r="3">/,'card: description in step 2, after the name, before the scores; no line without one');
assert.match(js,/<h3>어떤 생물인가요<\/h3>[\s\S]*?\+?<section><h3>관측 위치·기간<\/h3>|어떤 생물인가요<\/h3>[\s\S]*?\n\s*<section><h3>관측 위치·기간/,'detail: 어떤 생물인가요 before 관측 위치·기간');
assert.match(js,/fetch\('expedition-about\.json'\)[^;]*\.catch\(\(\)=>null\)/,'a failed load leaves the cards without descriptions');
assert.match(css,/\.x-about\{grid-column:1\/-1;[^}]*font-size:(1[5-9]|[2-9]\d)px/,'description spans the card width at ≥15px');
assert.match(read('i18n-en.js'),/"어떤 생물인가요":"[^"]+"/,'English heading in the screen dictionary');
console.log(`PASS: expedition descriptions ${ids.length} species · sources · wording rules · card and detail placement`);
