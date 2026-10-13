// 멍이 버튼 옮기기(chatbot.js 순수 계산): 끌기/누르기 문턱값, 화면 안으로 자르기, 가장자리 기준 저장값 왕복,
// 대화창 자리(네 모서리, 화면 안, 버튼과 겹치지 않음), 깨진 저장값 무시, '멍이 옮기기' FAQ 매칭.
// Run: node verification/test_chatbot_drag.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const ctx={};vm.createContext(ctx);  // document가 없으면 화면 부분은 건너뛴다
vm.runInContext(read('chatbot.js')+';Object.assign(globalThis,{CHATBOT_DRAG,chatbotDragStarted,chatbotClampFab,chatbotFabAnchor,chatbotFabFromAnchor,chatbotReadFabPos,chatbotPanelPlace,chatbotMatch});',ctx);
const {CHATBOT_DRAG:D,chatbotDragStarted:started,chatbotClampFab:clamp,chatbotFabAnchor:anchor,chatbotFabFromAnchor:fromAnchor,
  chatbotReadFabPos:readPos,chatbotPanelPlace:panelPlace,chatbotMatch:match}=ctx;
const plain=v=>JSON.parse(JSON.stringify(v));
const SIZE=48,M=D.margin,desk={w:1440,h:900,inset:{}},phone={w:390,h:844,inset:{top:47,right:0,bottom:34,left:0}};

// (1) 끌기 vs 누르기: 마우스 6px, 손가락·펜 10px를 넘어야 끌기
for(const [dx,dy,type,want] of [[5,0,'mouse',false],[3,4,'mouse',false],[7,0,'mouse',true],[0,-7,'mouse',true],
  [9,0,'touch',false],[11,0,'touch',true],[6,6,'touch',false],[8,8,'touch',true],[9,0,'pen',false],[11,0,'pen',true]])
  assert.equal(started(dx,dy,type),want,`${type} ${dx},${dy}`);

// (2) 화면 밖 좌표는 가장자리 margin 안으로, safe-area 여백도 비킨다. 버튼보다 좁은 화면에서도 예외 없이 0 이상.
assert.deepEqual(plain(clamp({x:-500,y:-20},SIZE,desk)),{x:M,y:M});
assert.deepEqual(plain(clamp({x:5000,y:5000},SIZE,desk)),{x:1440-SIZE-M,y:900-SIZE-M});
assert.deepEqual(plain(clamp({x:300,y:400},SIZE,desk)),{x:300,y:400});
assert.deepEqual(plain(clamp({x:0,y:0},SIZE,phone)),{x:M,y:47+M});
assert.deepEqual(plain(clamp({x:0,y:5000},SIZE,phone)),{x:M,y:844-34-SIZE-M});
for(const tiny of [{w:40,h:30,inset:{}},{w:0,h:0,inset:{}},{w:60,h:60,inset:{}}]){
  const p=clamp({x:-9,y:999},SIZE,tiny);
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0,`tiny ${JSON.stringify(tiny)} → ${JSON.stringify(p)}`);
}
assert.deepEqual(plain(clamp({x:NaN,y:undefined},SIZE,desk)),{x:M,y:M},'숫자가 아니면 왼쪽 위 안쪽');

// (3) 가장자리 기준 저장값 ↔ 좌표 왕복이 같은 자리. 오른쪽 아래에 둔 버튼은 창이 커져도 오른쪽 아래에서 같은 거리.
for(const pos of [{x:M,y:M},{x:1440-SIZE-M,y:900-SIZE-M},{x:200,y:700},{x:1100,y:120},{x:696,y:426}]){
  const a=anchor(pos,SIZE,desk);
  assert.deepEqual(plain(fromAnchor(a,SIZE,desk)),pos,`왕복 ${JSON.stringify(pos)}`);
}
const br=anchor({x:1440-SIZE-40,y:900-SIZE-30},SIZE,desk);
assert.deepEqual(plain(br),{h:'right',x:40,v:'bottom',y:30});
assert.deepEqual(plain(fromAnchor(br,SIZE,{w:1920,h:1080})),{x:1920-SIZE-40,y:1080-SIZE-30},'큰 창에서도 오른쪽 아래 같은 거리');
const tl=anchor({x:30,y:90},SIZE,desk);
assert.deepEqual(plain(tl),{h:'left',x:30,v:'top',y:90});
// 창이 작아지면 자르지만 저장값은 그대로라서, 다시 키우면 원래 자리.
const far=anchor({x:1200,y:90},SIZE,desk);  // 오른쪽에서 192px
assert.deepEqual(plain(clamp(fromAnchor(far,SIZE,phone),SIZE,phone)),{x:390-SIZE-192,y:90});
assert.deepEqual(plain(fromAnchor(far,SIZE,desk)),{x:1200,y:90});

// (4) 대화창: 버튼이 네 모서리·가운데에 있을 때 화면 안, 버튼과 겹치지 않음, 넓은 쪽으로 열림
const P={w:360,h:520},inside=(r,v)=>r.left>=M&&r.top>=M&&r.left+P.w<=v.w-M&&r.top+r.maxHeight<=v.h-M;
const overlap=(r,f)=>r.left<f.x+SIZE&&r.left+P.w>f.x&&r.top<f.y+SIZE&&r.top+r.maxHeight>f.y;
for(const v of [desk,{w:1024,h:700,inset:{}},{w:768,h:600,inset:{}}])
  for(const [name,f] of [['왼쪽 위',{x:M,y:M}],['오른쪽 위',{x:v.w-SIZE-M,y:M}],['왼쪽 아래',{x:M,y:v.h-SIZE-M}],['오른쪽 아래',{x:v.w-SIZE-M,y:v.h-SIZE-M}],
    ['가운데',{x:Math.round(v.w/2-SIZE/2)+1,y:Math.round(v.h/2-SIZE/2)+1}]]){
    const r=panelPlace({...f,size:SIZE},P,v);
    assert.ok(inside(r,v),`${v.w}×${v.h} ${name}: 화면 밖 ${JSON.stringify(r)}`);
    assert.ok(!overlap(r,f),`${v.w}×${v.h} ${name}: 버튼과 겹침 ${JSON.stringify(r)}`);
    assert.ok(r.maxHeight>=D.minPanel&&r.maxHeight<=P.h,`${name}: 높이 ${r.maxHeight}`);
    if(f.x+SIZE/2>v.w/2)assert.equal(r.left+P.w,f.x+SIZE,`${name}: 오른쪽 끝을 버튼에 맞춤`);else assert.equal(r.left,f.x,`${name}: 왼쪽 끝을 버튼에 맞춤`);
    if(f.y+SIZE/2>v.h/2)assert.ok(r.top+r.maxHeight<=f.y,`${name}: 버튼 위로`);else assert.ok(r.top>=f.y+SIZE,`${name}: 버튼 아래로`);
  }
// 높이가 모자라면 줄이되 최소 260, 화면보다 크지 않게
const mid=panelPlace({x:700,y:300,size:SIZE},P,{w:1440,h:700,inset:{}});
assert.ok(mid.maxHeight<P.h&&mid.maxHeight>=D.minPanel,JSON.stringify(mid));
const short=panelPlace({x:700,y:150,size:SIZE},P,{w:1440,h:280,inset:{}});
assert.ok(short.maxHeight<=280-2*M&&short.top>=M,JSON.stringify(short));

// (5) 깨진 저장값은 무시하고, 올바른 칸만 남긴다
for(const raw of [null,'','{','null','[]','"x"','12','{}','{"desktop":null}','{"desktop":{"h":"left","x":-1,"v":"top","y":3}}',
  '{"desktop":{"h":"middle","x":1,"v":"top","y":3}}','{"desktop":{"h":"left","x":"5","v":"top","y":3}}','{"mobile":{"h":"left","x":1e9,"v":"top","y":3}}'])
  assert.equal(readPos(raw),null,`깨진 값 ${raw}`);
assert.deepEqual(plain(readPos('{"desktop":{"h":"right","x":40,"v":"bottom","y":30,"extra":1},"mobile":{"h":"up"}}')),{desktop:{h:'right',x:40,v:'bottom',y:30}});
assert.deepEqual(plain(readPos('{"desktop":{"h":"left","x":0,"v":"top","y":0},"mobile":{"h":"right","x":8,"v":"bottom","y":8}}')),
  {desktop:{h:'left',x:0,v:'top',y:0},mobile:{h:'right',x:8,v:'bottom',y:8}});

// (6) '멍이 옮기기' FAQ는 그 질문에만 걸리고, 다른 대표 질문의 답은 그대로(test_chatbot_faq.mjs와 함께)
for(const q of ['멍이가 화면을 가려요','멍이 위치 옮기기','멍이 좀 옮기고 싶어','멍이가 지도를 가려요'])assert.equal(match(q)?.id,'move-mascot',`"${q}"`);
for(const [q,id] of [['붉은 점은 실제 위치야?','red-dots'],['지도가 뭘 보여줘?','overview'],['위성 수심 배경 바꾸기','map-buttons']])assert.equal(match(q)?.id,id,`"${q}"`);

console.log('PASS: 멍이 옮기기 · 끌기/누르기 문턱(마우스 6px·손가락 10px) · 화면 안 자르기(safe-area) · 가장자리 기준 저장 왕복 · 대화창 자리 · 깨진 저장값 무시 · FAQ');
