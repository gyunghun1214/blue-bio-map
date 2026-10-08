// 사용법 안내 챗봇(FAQ): id 중복 없음, '화면에서 보여주기' 선택자가 index.html에 있음, 대표 질문 매칭과 '모르겠어요',
// 답변에 유형·탭 이름과 기준값 하드코딩 없음, chatbot.js/css의 ?v= 해시.
// Run: node verification/test_chatbot_faq.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const html=read('index.html');
const ctx={};vm.createContext(ctx);  // document가 없으면 화면 부분은 건너뛴다
vm.runInContext(read('chatbot.js')+';Object.assign(globalThis,{CHATBOT_FAQ,CHATBOT_STARTERS,chatbotMatch,chatbotMascot,CHATBOT_MASCOT_STATES});',ctx);
const {CHATBOT_FAQ:faq,CHATBOT_STARTERS:starters,chatbotMatch:match,chatbotMascot:mascot,CHATBOT_MASCOT_STATES:moods}=ctx;

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

// (4) 유형·탭 이름과 '높음' 기준값은 답변에 직접 쓰지 않고 자리표시로 읽어 옴
const tabs=[...html.matchAll(/<button data-view="\w+"[^>]*>([^<]+)</g)].map(m=>m[1]);
const types=[...html.matchAll(/<span role="listitem" data-key="\w+"><b>([^<]+)</g)].map(m=>m[1]);
assert.equal(tabs.length,3);assert.equal(types.length,4);
for(const f of faq){
  for(const name of [...tabs,...types])assert.ok(!f.a.includes(name),`${f.id}: 하드코딩된 이름 '${name}'`);
  assert.ok(!/\b50\b|#[0-9a-f]{3,6}\b/i.test(f.a),`${f.id}: 기준값이나 색 코드 하드코딩`);
}

// (5) ?v=는 LF로 맞춘 파일의 sha256 앞 10자리
for(const file of ['chatbot.js','chatbot.css']){
  const expected=crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
  assert.deepEqual([...html.matchAll(new RegExp(`["/]${file.replace('.','\\.')}\\?v=([^"]+)"`,'g'))].map(m=>m[1]),[expected],`${file}?v= must be ${expected}`);
}
// (6) 멍이: 7개 상태 모두 SVG, crop은 입출수공이 잘리지 않는 viewBox, id 속성 없음(여러 번 그려도 충돌 없음)
assert.equal(Object.keys(moods).length,7);
for(const s of Object.keys(moods))for(const crop of [false,true]){
  const svg=mascot(s,40,crop);
  assert.ok(svg.startsWith('<svg'),`${s}: <svg로 시작해야 함`);
  assert.ok(!svg.includes(' id='),`${s}: id 속성 금지`);
  if(crop)assert.ok(svg.includes('viewBox="8 12 104 104"'),`${s}: crop viewBox`);
}
console.log(`PASS: chatbot FAQ ${faq.length}개 · id 고유 · 선택자 존재 · 매칭/모르겠어요 · 이름 하드코딩 없음 · ?v= 해시 · 멍이 ${Object.keys(moods).length}상태`);
