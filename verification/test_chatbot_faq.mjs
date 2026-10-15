// 사용법 안내 챗봇(FAQ): id 중복 없음, '화면에서 보여주기' 선택자가 index.html에 있음, 대표 질문 매칭과 '모르겠어요',
// 답변에 유형·탭 이름·판단문과 기준값 하드코딩 없음({plain:} 자리표시), chatbot.js/css의 ?v= 해시.
// Run: node verification/test_chatbot_faq.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const html=read('index.html');
const ctx={};vm.createContext(ctx);  // document가 없으면 화면 부분은 건너뛴다
const js=read('chatbot.js');
vm.runInContext(js+';Object.assign(globalThis,{CHATBOT_FAQ,CHATBOT_STARTERS,CHATBOT_TAB_LINKS,chatbotMatch,chatbotMascot,chatbotFact,CHATBOT_MASCOT_STATES});',ctx);
const {CHATBOT_FAQ:faq,CHATBOT_STARTERS:starters,CHATBOT_TAB_LINKS:tabLinks,chatbotMatch:match,chatbotMascot:mascot,chatbotFact:fact,CHATBOT_MASCOT_STATES:moods}=ctx;

// (1) id가 겹치지 않고, 대표 질문·이어서 물어볼 질문이 실제 항목을 가리킴
const ids=faq.map(f=>f.id);
assert.equal(new Set(ids).size,ids.length,'FAQ id 중복');
for(const id of [...starters.map(s=>s[0]),...faq.flatMap(f=>f.next||[])])assert.ok(ids.includes(id),`없는 FAQ id: ${id}`);

// (2) '화면에서 보여주기'가 누르거나 표시하는 선택자는 index.html에 정적으로 있어야 함
const present=sel=>sel.split(/\s+/).every(part=>[...part.matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)="([^"]+)"\]/g)].every(([,id,cls,attr,val])=>
  id?html.includes(`id="${id}"`):cls?new RegExp(`class="[^"]*\\b${cls}\\b`).test(html):html.includes(`${attr}="${val}"`)));
for(const f of faq.filter(f=>f.show))for(const sel of [...f.show.click,f.show.target])assert.ok(present(sel),`${f.id}: index.html에 없는 선택자 ${sel}`);

// (3) 예시 질문은 기대한 답으로, 관계없는 질문은 '모르겠어요'(null)로
for(const f of faq)for(const q of f.q)assert.equal(match(q)?.id,f.id,`예시 질문 "${q}"`);
for(const [q,id] of [['지도가 뭘 보여줘?','overview'],['색깔이 무슨 뜻이야','colors'],['식량 특성으로 종 찾고 싶어','chips'],['종끼리 비교하려면?','compare'],
  ['mbpi 0점이면 효능 없는거야?','mbpi'],['2x2 아이콘 사용법','mini-grid'],['붉은 점은 실제 위치야?','red-dots'],['이 바다 개발해도 돼?','sea-score']])
  assert.equal(match(q)?.id,id,`"${q}"`);
for(const q of ['오늘 날씨 어때','점심 메뉴 추천해줘','안녕','','?!'])assert.equal(match(q),null,`"${q}"는 모르겠어요로 가야 함`);
// (3b) 2026-10-15 심사 예상 질문: 키워드가 겹쳐 다른 항목으로 가지 않는지(질문 그대로와 말을 바꾼 것)
for(const [q,id] of [['미역은 왜 매트릭스에 없어요?','matrix-missing'],['매트릭스에 없는 종이 있어요?','matrix-missing'],
  ['‘근거 논문 1편’이 무슨 뜻이에요?','evidence-level'],["'근거 논문 1편'이 무슨 뜻이에요?",'evidence-level'],
  ['50점은 누가 정했어요?','threshold'],['구분선 50은 누가 정했나요','threshold'],
  ['참굴 10점과 고등어 10점은 같은 뜻이에요?','same-score'],['MCUI 같은 점수면 같은 뜻이야?','same-score'],
  ['살오징어는 IUCN에서 LC인데 왜 60점이에요?','squid'],['오징어는 왜 MCUI가 60점이야','squid'],
  ['검증은 통과했어요?','validation'],['지표 검증 통과했나요','validation'],
  ['MCUI는 뭐예요','mcui'],['매트릭스 점은 어떻게 읽어요','matrix']])
  assert.equal(match(q)?.id,id,`심사 질문 "${q}" → ${match(q)?.id}`);
// (3c) 정해진 답만: AI·서버 호출 없음, 입력창 근처 표기, 답이 없을 때 세 탭(index.html의 탭 버튼과 같은 순서)
assert.ok(!/fetch\(|['"]\/?api\/|Workers AI로/.test(js),'chatbot.js가 서버나 AI에 질문을 보내면 안 됨');
assert.ok(js.includes('<p class="bbc-note">AI 아님 · 정해진 답변</p>')&&js.includes('<strong id="bbc-title">사용법 안내 도우미</strong>'),'이름과 표기');
assert.ok(js.includes("'준비된 답이 없어요."),'매칭 실패 문구');
assert.equal(tabLinks.map(t=>t[0]).join(),[...html.matchAll(/<button data-view="(\w+)"/g)].map(m=>m[1]).join(),'세 탭 바로가기');
// (3d) 값 자리표시: 아는 종류만, 종 이름은 자료에 있는 종, 앱 자료가 없을 때도 빈칸·undefined 없이 안내 문구
const names=(a=>[...a.species,...a.candidate_species].map(s=>s.korean_name))(JSON.parse(read('assessments.json')));
for(const f of faq)for(const [tok,kind,arg] of f.a.matchAll(/\{(\w+)(?::([^}]+))?\}/g)){
  assert.ok(['tab','type','plain','rule','matrix','score','basis','mcuiwhy'].includes(kind),`${f.id}: 모르는 자리표시 ${tok}`);
  if(['score','basis','mcuiwhy'].includes(kind)){assert.ok(names.includes(arg.split(':')[0]),`${f.id}: 자료에 없는 종 ${tok}`);
    const out=fact(kind,arg);assert.ok(out&&!/undefined|null|NaN/.test(out),`${f.id}: 자료 없을 때 ${tok} → ${out}`);}
}
assert.ok(fact('matrix')&&!/undefined/.test(fact('matrix')));

// (4) 유형·탭 이름과 '높음' 기준값은 답변에 직접 쓰지 않고 자리표시로 읽어 옴
const tabs=[...html.matchAll(/<button data-view="\w+"[^>]*>([^<]+)</g)].map(m=>m[1]);
const types=[...html.matchAll(/<span role="listitem" data-key="\w+"><b>([^<]+)</g)].map(m=>m[1]);
assert.equal(tabs.length,3);assert.equal(types.length,4);
for(const f of faq){
  for(const name of [...tabs,...types])assert.ok(!f.a.includes(name),`${f.id}: 하드코딩된 이름 '${name}'`);
  assert.ok(!/\b50\b|#[0-9a-f]{3,6}\b/i.test(f.a),`${f.id}: 기준값이나 색 코드 하드코딩`);
}

// (4b) 2026-10-13 판단문(‘써도 됨’ 등)도 답변에 직접 쓰지 않고 {plain:사분면 키}로 app.js의 matrixTypePlain에서 읽음(문구는 한 곳에서 관리).
// 앱 함수가 없으면 종 카드를 보라고 안내. 판단문 FAQ는 네 판단문을 모두 자리표시로 부름
const app=read('app.js'),matrix=JSON.parse(read('assessments.json')).method.matrix;
// 4.14: the words come from the report (matrix.types[].plain); MATRIX_PLAIN_DEFAULT is the same four for older reports
const plainLines=[/^const MATRIX_PLAIN_DEFAULT=.*$/m,/^const MATRIX_PLAIN=.*$/m,/^const matrixTypePlain=.*$/m].map(r=>app.match(r)[0]);
const plainWords=Object.values(vm.runInNewContext('('+plainLines[0].replace(/^const MATRIX_PLAIN_DEFAULT=/,'').replace(/;$/,'')+')'));
assert.equal(plainWords.length,4);
assert.deepEqual([...plainWords].sort(),Object.values(matrix.types).map(t=>t.plain).sort(),'the default words are the report words');
for(const f of faq)for(const w of plainWords)assert.ok(!f.a.includes(w),`${f.id}: 하드코딩된 판단문 '${w}'`);
assert.equal(vm.runInContext("chatbotPlain('high_bbvi_low_mcui')",ctx),'종 카드에 적힌 판단문','앱 함수가 없을 때');
vm.runInContext(plainLines.join('\n'),ctx);ctx.matrixRule=()=>matrix;
for(const [key,t] of Object.entries(matrix.types))
  assert.equal(vm.runInContext(`chatbotPlain('${key}')`,ctx),vm.runInContext(`matrixTypePlain('${t.id}')`,ctx),`{plain:${key}}`);
assert.equal(vm.runInContext("chatbotPlain('no_such_key')",ctx),'종 카드에 적힌 판단문');
const verdict=faq.find(f=>f.id==='verdict');
assert.deepEqual([...verdict.a.matchAll(/\{plain:(\w+)\}/g)].map(m=>m[1]).sort(),Object.keys(matrix.types).sort(),'판단문 FAQ: 네 판단문');
for(const f of faq)for(const [,k] of f.a.matchAll(/\{(?:plain|type):(\w+)\}/g))assert.ok(matrix.types[k],`${f.id}: 없는 사분면 키 ${k}`);

// (5) ?v=는 LF로 맞춘 파일의 sha256 앞 10자리
for(const file of ['chatbot.js','chatbot.css']){
  const expected=crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...html.matchAll(new RegExp(`["/]${file.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]),[expected],`${file}?v= must be ${expected}`);
}
// (6) 멍이: 7개 상태 모두 SVG, crop은 입출수공이 잘리지 않는 viewBox, id 속성 없음(여러 번 그려도 충돌 없음)
// 움직임(2026-10-11): 상태 클래스와 부위 <g>(몸 전체·입출수공·눈·입)가 있고, 처진 수공은 SVG 속성이 아니라 CSS(.bbc-m-unknown).
// face 'smile'은 눈·입만 welcome 것(웃는 눈·열린 입), 'talk'는 입만 열린 입. face가 없으면 상태 그림 그대로.
assert.equal(Object.keys(moods).length,7);
const happyEyes='Q48 69.5',openMouth='M54.5 81.5 Q60 90.5 65.5 81.5 Z';
for(const s of Object.keys(moods))for(const crop of [false,true]){
  const svg=mascot(s,40,crop);
  assert.ok(svg.startsWith('<svg'),`${s}: <svg로 시작해야 함`);
  assert.ok(!svg.includes(' id='),`${s}: id 속성 금지`);
  if(crop)assert.ok(svg.includes('viewBox="8 12 104 104"'),`${s}: crop viewBox`);
  assert.ok(svg.includes(`class="bbc-mascot bbc-m-${s}${crop?' bbc-m-crop':''}"`),`${s}: 상태 클래스`);
  for(const part of ['bbc-m-all','bbc-m-sL','bbc-m-sR','bbc-m-body','bbc-m-look','bbc-m-eyes','bbc-m-mouth'])
    assert.equal(svg.split(`class="${part}"`).length-1,1,`${s}: 부위 ${part} 하나`);
  assert.ok(!/<g[^>]*transform=/.test(svg),`${s}: 묶음(<g>)에 transform 속성 없음(움직임은 CSS)`);
  for(const face of ['smile','talk']){
    const f=mascot(s,40,crop,face);
    assert.ok(f.startsWith('<svg')&&!f.includes(' id='),`${s}/${face}: <svg·id 없음`);
    assert.ok(f.includes(openMouth),`${s}/${face}: 열린 입`);
    assert.equal(f.includes(happyEyes),face==='smile'||moods[s].e==='happy',`${s}/${face}: 눈`);
    assert.equal(f.replace(/<g class="bbc-m-look">[\s\S]*?<\/g><\/g><g class="bbc-m-mouth">[\s\S]*?<\/g>/,''),svg.replace(/<g class="bbc-m-look">[\s\S]*?<\/g><\/g><g class="bbc-m-mouth">[\s\S]*?<\/g>/,''),`${s}/${face}: 눈·입 밖은 그대로`);
  }
}
assert.ok(mascot('unknown',40,true).includes('class="bbc-m-sweat"'),'잘 모르겠어요: 땀방울 클래스');
console.log(`PASS: chatbot FAQ ${faq.length}개 · 심사 질문 매칭 · AI 호출 없음 · 값 자리표시 · id 고유 · 선택자 존재 · 매칭/모르겠어요 · 이름 하드코딩 없음 · ?v= 해시 · 멍이 ${Object.keys(moods).length}상태 · 부위·표정 바꾸기`);
