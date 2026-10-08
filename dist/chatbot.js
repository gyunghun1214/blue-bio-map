'use strict';
// 사용법 안내 챗봇(FAQ만). 서버가 없으므로 AI 답변은 하지 않는다.
// 답변 속 {tab:id}·{type:사분면 키}·{rule}은 화면에 보일 때 앱의 실제 글자와 기준값으로 바꾼다(하드코딩 금지).
// 화면 이동은 상태를 직접 바꾸지 않고 기존 버튼을 .click()해서 앱의 처리 로직을 그대로 탄다.
// app.js와 같은 전역 렉시컬 범위를 쓰므로 최상위 이름은 모두 CHATBOT_/chatbot 접두어를 붙인다.
const CHATBOT_FAQ=[
  {id:'overview',q:['이 지도는 뭘 보여주나요?','이 사이트는 뭐예요','무엇을 하는 지도인가요','처음인데 어떻게 봐요'],
    k:['지도','사이트','소개','처음','무엇','뭘보여','사용법','어떻게봐'],
    a:'한반도 주변 바다의 해양생물을 종별로 골라 활용 근거와 보전 정보를 함께 비교하는 연구 프로토타입이에요. 화면은 {tab:explore}, {tab:compare}, {tab:method} 세 탭으로 나뉘어요. 지도는 공개 출현기록(OBIS·GBIF)이 있는 격자를 보여 주며, 붉은 점은 실제 발견 좌표가 아니에요.',
    show:{click:['[data-view="explore"]'],target:'.tabs'},next:['map-modes','colors','indices']},
  {id:'map-modes',q:['출현 기록과 활용 × 보전 모드는 뭐가 달라요','지도 모드 바꾸기','출현 기록 모드는 뭐예요'],
    k:['모드','출현기록','활용보전','왼쪽위','지도내용','전환'],
    a:'지도 왼쪽 위에서 ‘출현 기록’과 ‘활용 × 보전’을 바꿀 수 있어요. ‘출현 기록’은 선택한 종의 공개 출현기록(OBIS·GBIF)이 있는 격자를 보여 주고, ‘활용 × 보전’은 출현기록이 있는 셀을 4가지 유형 색으로 칠해요.',
    show:{click:['[data-view="explore"]'],target:'.map-mode'},next:['colors','red-dots']},
  {id:'colors',q:['색깔(4가지 유형)은 무슨 뜻이에요?','셀 색이 무슨 의미예요','네 가지 유형이 뭐예요','회색 셀은 뭐예요','점선 테두리는 뭐예요'],
    k:['색','색깔','유형','4가지','네가지','회색','점선','셀색','범례'],
    a:'‘활용 × 보전’에서는 셀을 {type:high_bbvi_low_mcui}, {type:high_bbvi_high_mcui}, {type:low_bbvi_high_mcui}, {type:low_bbvi_low_mcui} 네 유형 색으로 칠해요. {rule} 셀 색은 그 셀에 기록된 종 중 우선순위가 가장 높은 유형 하나이고, 해역의 자원량이나 해역 점수가 아니에요. 유형이 섞인 셀은 촘촘한 점선 테두리, 회색은 ‘유형 없음’(BBVI·MCUI 한 쌍이 없음)이에요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]'],target:'#value-mini'},next:['mini-grid','sea-score']},
  {id:'mini-grid',q:['오른쪽 위 2×2 아이콘은 뭐예요','사분면 아이콘 사용법','한 유형만 보고 싶어요','ⓘ 버튼은 뭐예요'],
    k:['2×2','2x2','사분면','아이콘','ⓘ','한유형만','유형만','오른쪽위'],
    a:'‘활용 × 보전’ 모드에서는 오른쪽 위 ‘위성’·‘수심’ 버튼 아래에 2×2 아이콘이 나와요. 칸에 마우스를 올리면 유형 이름이 뜨고, 누르면 그 유형 셀만 보여요. 여러 칸을 함께 켤 수 있고, ⓘ를 누르면 자세한 범례와 ‘우선 조사 대상’·‘미탐색 후보’ 체크박스가 나와요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]'],target:'#value-mini'},next:['sufficiency','unexplored']},
  {id:'chips',q:['신약·식량 특성으로 종 찾기','활용 특성 칩은 어떻게 써요','식량으로 쓸 수 있는 종만 보고 싶어요','칩을 여러 개 켜면 어떻게 돼요','결과가 하나도 없어요'],
    k:['칩','신약','식량','활용특성','특성','찾기','필터','결과없'],
    a:'왼쪽 ‘탐색 후보’ 목록 위의 활용 특성 칩(신약·식량)을 켜면 그 특성의 근거가 채택된 종만 남아요. 여러 개를 켜면 모두 만족하는 종만 남아요. 결과가 없으면 안내에 나오는 ‘끄기’ 버튼으로 칩 하나를 꺼 보세요.',
    show:{click:['[data-view="explore"]'],target:'#use-chips'},next:['select-species','compare']},
  {id:'select-species',q:['종을 골라서 지도에서 보기','종 선택은 어떻게 해요','특정 종을 검색하고 싶어요','종 카드를 누르면 어떻게 돼요'],
    k:['종선택','고르','골라','검색','카드','학명','종이름','탐색후보'],
    a:'왼쪽 ‘탐색 후보’ 목록에서 종 카드를 누르면 그 종이 선택되고 지도와 오른쪽 근거 패널이 그 종으로 바뀌어요. 검색창에 종 이름이나 학명을 넣거나 분류군·근거 상태로 좁힐 수 있어요. ‘활용 × 보전’ 모드에서는 카드에 마우스를 올리면 그 종의 셀에 노란 점선이 생기고, 선택한 종의 셀은 굵은 실선 테두리로 보여요.',
    show:{click:['[data-view="explore"]'],target:'#species-list'},next:['cell-click','compare']},
  {id:'cell-click',q:['셀을 누르면 뭐가 나와요','격자를 클릭하면 어떻게 돼요','확인 종 활용 가능 종 숫자는 뭐예요'],
    k:['셀','격자','클릭','누르면','확인종','활용가능종','보전우선종','근거부족종'],
    a:'지도의 셀을 누르면 그 격자의 확인 종·활용 가능 종·보전 우선 종·근거 부족 종 수와 종 이름이 나와요. 이 수는 종별 지표로 센 것이고, 셀이나 해역에 매긴 점수가 아니에요.',
    show:{click:['[data-view="explore"]'],target:'#map'},next:['sea-score','colors']},
  {id:'compare',q:['종끼리 비교하기','여러 종을 비교하고 싶어요','비교표는 어떻게 봐요','근거 보기 버튼은 뭐예요'],
    k:['비교','비교표','나란히','근거보기','지도셀목록','이전','다음','가로스크롤'],
    a:'{tab:compare} 탭의 종 비교표(‘무엇을 알고, 무엇이 부족한가’)에서 모든 종을 나란히 볼 수 있어요. 왼쪽 확인 항목 열은 고정되고 종 열은 가로로 스크롤되며, ‘이전’·‘다음’ 버튼은 한 화면씩 넘겨요. 칸의 ‘근거 보기’를 누르면 그 종의 근거 패널이, ‘지도·셀 목록 보기’를 누르면 그 종의 지도 셀이 열려요.',
    show:{click:['[data-view="compare"]'],target:'#comparison'},next:['matrix','labels']},
  {id:'matrix',q:['활용 × 보전 매트릭스는 뭐예요','매트릭스 점은 어떻게 읽어요','왜 두 지표를 합치지 않나요'],
    k:['매트릭스','합치지','따로','두축'],
    a:'{tab:compare} 탭의 ‘활용 × 보전 매트릭스’는 가로축 BBVI(활용가치)와 세로축 MCUI(보전 시급성)에 종을 점으로 놓아요. 두 값은 일부러 합치지 않아요. 활용가치가 높다고 보전 필요성이 가려지면 안 되기 때문이에요.',
    show:{click:['[data-view="compare"]'],target:'#matrix'},next:['indices','colors']},
  {id:'indices',q:['BBVI·MCUI·정보충분도가 뭔가요?','지표가 뭐예요','점수는 어떻게 매겨요'],
    k:['지표','bbvi','mcui','정보충분도','점수','약어'],
    a:'BBVI(활용가치)는 식량 지표 MFPI와 신약 지표 MBPI를 합친 값이고, MCUI(보전 시급성)는 보전 평가 범주를 점수로 옮긴 값이에요(공식 평가가 없으면 자체 예비평가). 두 값은 합치지 않고 따로 보여 줘요. 정보충분도는 자료가 얼마나 갖춰졌는지 보여 주는 별도 표시로, 점수와 섞지 않아요. BBVI는 검증 미통과라 참고값으로 봐 주세요.',
    show:{click:['[data-view="method"]'],target:'.method-grid'},next:['mfpi','mbpi','mcui']},
  {id:'bbvi',q:['BBVI는 어떻게 계산해요','활용가치는 뭐예요','식량 가중치 슬라이더는 뭐예요'],
    k:['bbvi','활용가치','가중치','슬라이더','통합'],
    a:'BBVI(활용가치)는 MFPI(식량)와 MBPI(신약)를 합친 값이에요. {tab:compare} 탭의 ‘기본 통합 BBVI 식량 가중치’ 슬라이더로 두 축의 비중을 바꿔 볼 수 있어요. BBVI는 검증 미통과라 참고값으로 봐 주세요.',
    show:{click:['[data-view="compare"]'],target:'.weight-control'},next:['mfpi','mbpi']},
  {id:'mfpi',q:['MFPI는 뭐예요','식량 지표는 어떻게 매겨요','EPA DHA는 점수에 들어가요'],
    k:['mfpi','식량지표','영양','식품성분','epa','dha','ufish'],
    a:'MFPI(식량 지표)는 국가표준식품성분 DB 10.4의 고정 비교집단과 견줘 매긴 값이에요. 빠진 성분은 같은 종 부표본이나 FAO/INFOODS uFiSh 값으로 채우고 표시해요. EPA·DHA는 보여 주기만 하고 점수에는 넣지 않아요.',
    show:{click:['[data-view="method"]'],target:'.method-grid'},next:['validation','mbpi']},
  {id:'mbpi',q:['MBPI는 뭐예요','신약 지표는 어떻게 매겨요','MBPI가 0점이면 효능이 없는 건가요'],
    k:['mbpi','신약지표','생리활성','펩타이드','chembl','0점','하한값','효능'],
    a:'MBPI(신약 지표)는 ChEMBL 화합물, ACE 저해·항균·항암·잔틴 산화효소 억제 펩타이드, 감태 분리 화합물을 층별로 따로 백분위로 매겨요. 같은 표적·같은 시험 조건끼리만 비교하고, 근거 계수를 곱한 뒤 가장 높은 항목을 종의 값으로 써요. 근거가 없는 종은 0점(하한값)이고 효능이 없다는 뜻이 아니에요. 검증 미통과라 참고값으로 봐 주세요.',
    show:{click:['[data-view="method"]'],target:'.method-grid'},next:['validation','mcui']},
  {id:'mcui',q:['MCUI는 뭐예요','보전 시급성은 어떻게 정해요','적색목록 평가가 없으면 어떻게 해요'],
    k:['mcui','보전','시급','적색목록','iucn','rapidlc','예비평가','멸종'],
    a:'MCUI(보전 시급성)는 IUCN 적색목록 2026-1 현행 평가를 먼저 쓰고, 없으면 한국 국가 평가, 서식국 공식 평가, 지방 공식 목록 순서로 써요. 어디에도 평가가 없으면 자체 예비평가(Rapid LC, LC 상당 10점, 역검증 미통과)를 써요. OBIS 출현 추세는 보조 요소이고, 출현기록 수만으로 판정하지 않아요.',
    show:{click:['[data-view="method"]'],target:'.method-grid'},next:['validation','matrix']},
  {id:'validation',q:['지표는 검증됐나요','검증 미통과는 무슨 뜻이에요','빈칸은 왜 없어요'],
    k:['검증','미통과','통과','신뢰','빈칸','대체규칙'],
    a:'MFPI(식량)는 같은 종을 국가표준식품성분 DB와 일본 식품성분표로 각각 계산해 순위를 비교하는 검증을 통과했어요. MBPI(신약)와 BBVI(활용가치)는 ‘검증 미통과’ 라벨이 붙어 있어 참고값으로 봐야 해요. 4.3부터 빈칸은 없고, 공식 근거가 없는 칸은 미리 정한 대체 규칙으로 채운 뒤 라벨로 밝혀요.',
    show:{click:['[data-view="method"]'],target:'.method-grid'},next:['labels','indices']},
  {id:'labels',q:['값 옆의 라벨은 무슨 뜻이에요','단일 논문 하한값 라벨이 뭐예요','지방 목록 예비평가 라벨'],
    k:['라벨','단일논문','하한값','예비평가','지방목록'],
    a:'값 옆의 라벨(단일 논문·하한값·예비평가·지방 목록)은 근거의 수준을 알려 주는 표시이고, 가치가 높고 낮음을 뜻하지 않아요. 규칙을 다 채우지 못한 값에 붙어요.',
    show:{click:['[data-view="compare"]'],target:'#comparison'},next:['validation','compare']},
  {id:'sufficiency',q:['정보충분도는 뭐예요','우선 조사 대상은 뭐예요','우선 조사 체크박스는 뭐예요'],
    k:['정보충분도','우선조사','조사대상','충분도','자료부족'],
    a:'정보충분도는 지표에 필요한 자료가 얼마나 갖춰졌는지 보여 주는 표시예요. ‘우선 조사 대상’은 정보충분도가 낮거나 보전 평가가 없는 종으로, 2×2 아이콘의 ⓘ 범례에서 체크박스로 지도에 켤 수 있어요. 둘 다 점수와 섞지 않는 별도 표시예요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]','#value-info'],target:'.value-layers'},next:['unexplored','indices']},
  {id:'unexplored',q:['미탐색 후보는 뭐예요','30종 밖 미탐색 후보 목록','새로 발견된 종인가요'],
    k:['미탐색','근연종','30종밖','같은속','발견'],
    a:'‘미탐색 후보’는 BBVI(활용가치)가 높은 종과 같은 속인 근연종이에요. 근연종의 점수를 옮겨 추정하지 않아서 점수가 없고, 조사 단서일 뿐 발견이 아니에요. ⓘ 범례의 ‘미탐색 후보’ 체크박스와 30종 밖 목록에서 볼 수 있어요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]','#value-info'],target:'.value-layers'},next:['sufficiency','bbvi']},
  {id:'period-effort',q:['기간 필터는 뭐예요','회색 음영 조사량은 뭐예요','점이 없는 바다는 종이 없는 건가요'],
    k:['기간','조사량','음영','회색음영','조사가부족','없는바다'],
    a:'지도 왼쪽 위의 기간 버튼은 기록을 모은 기간이 여러 개인 종을 기간별로 나눠 볼 때 써요. 회색 음영 ‘조사량’은 그 바다가 얼마나 조사됐는지 보여 주며, 이 종의 기록 수와는 관계없어요. 음영이 옅은 바다에 점이 없다면 종이 없어서가 아니라 조사가 부족해서일 수 있어요.',
    show:{click:['[data-view="explore"]','[data-map-mode="occurrence"]'],target:'#occurrence-legend'},next:['red-dots','map-modes']},
  {id:'map-buttons',q:['위성 수심 배경 바꾸기','링크 복사는 뭐예요','전체 보기 버튼','확대 축소는 어떻게 해요'],
    k:['위성','수심','배경','링크복사','공유','전체보기','확대','축소'],
    a:'지도 오른쪽 위에서 ‘위성’과 ‘수심’ 배경을 바꿀 수 있어요. ‘링크 복사’는 지금 보는 종·탭·배경 지도·기간·지도 위치·활용 특성 칩을 링크 하나로 복사하고, ‘전체 보기’는 선택 종의 전체 범위로 지도를 돌려요. 확대·축소는 지도 오른쪽 아래의 +/− 버튼으로 해요.',
    show:{click:['[data-view="explore"]'],target:'.map-title'},next:['map-modes','select-species']},
  {id:'red-dots',q:['붉은 점이 실제 발견 위치인가요','빨간 점은 뭐예요','버블은 뭐예요'],
    k:['붉은점','빨간점','좌표','위치','버블'],
    a:'아니요, 붉은 점은 공개 격자 안에 고정한 도식적 무늬라서 실제 발견 좌표가 아니에요. 점과 기록 수로는 개체수나 자원량을 알 수 없어요. 축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시예요.',
    show:{click:['[data-view="explore"]','[data-map-mode="occurrence"]'],target:'#occurrence-legend'},next:['period-effort','sea-score']},
  {id:'sea-score',q:['해역 점수나 자원량을 알 수 있나요','어느 바다가 가치가 높아요','이 바다를 개발해도 되나요'],
    k:['해역','자원량','해역점수','바다점수','개발','어느바다'],
    a:'이 지도는 해역 점수나 자원량을 만들지 않아요. 지표는 종 단위이고, 종별 지표를 해역 단위로 합치지 않아요. 셀 색은 출현기록이 있는 셀에 그 셀에 기록된 종의 유형을 표시한 것일 뿐이에요.',
    show:{click:['[data-view="method"]'],target:'.method-bottom'},next:['colors','indices']},
  {id:'sources',q:['자료 출처는 어디예요','종과 화합물은 어떻게 연결해요','AphiaID는 뭐예요'],
    k:['출처','자료','데이터','aphiaid','worms','inchikey','pubchem','연결'],
    a:'종은 WoRMS AphiaID로, 화합물은 InChIKey·PubChem CID로 연결해요. 사용한 자료 목록은 {tab:method} 탭 아래 ‘사용한 자료와 수집 방법’에 있어요.',
    show:{click:['[data-view="method"]'],target:'.source-section'},next:['validation','overview']}
];
const CHATBOT_STARTERS=[['overview','이 지도는 뭘 보여주나요?'],['colors','색깔(4가지 유형)은 무슨 뜻이에요?'],['chips','신약·식량 특성으로 종 찾기'],
  ['select-species','종을 골라서 지도에서 보기'],['compare','종끼리 비교하기'],['indices','BBVI·MCUI·정보충분도가 뭔가요?']];
const CHATBOT_PARTICLES=['으로','에서','이랑','하고','까지','부터','한테','은','는','이','가','을','를','의','에','로','도','요','와','과','만'];
// 소문자 → 낱말마다 끝 조사 하나 제거(조사보다 2글자 이상 긴 낱말만) → 공백·문장부호 없이 이어 붙임.
function chatbotNormalize(text){
  return String(text||'').toLowerCase().split(/[^\p{L}\p{N}×]+/u).filter(Boolean).map(w=>{
    const p=CHATBOT_PARTICLES.find(p=>w.length>=p.length+2&&w.endsWith(p));return p?w.slice(0,-p.length):w;}).join('');
}
const chatbotBigrams=s=>{const out=new Set();for(let i=0;i<s.length-1;i++)out.add(s.slice(i,i+2));return out;};
function chatbotSimilar(a,b){
  const x=chatbotBigrams(a),y=chatbotBigrams(b);if(!x.size||!y.size)return 0;
  let n=0;for(const g of x)if(y.has(g))n++;return 2*n/(x.size+y.size);
}
// 점수 = 가장 비슷한 질문 예시(바이그램 Dice) + 들어 있는 키워드 수 × 0.3. 기준 미달이면 null(모르겠어요).
// ponytail: 단순 바이그램·키워드 일치. 항목이 수백 개로 늘거나 오답이 잦으면 가중치 학습이나 AI 연결을 검토.
const CHATBOT_MIN_SCORE=.45;
function chatbotMatch(text){
  const q=chatbotNormalize(text);if(q.length<2)return null;
  let best=null,top=0;
  for(const f of CHATBOT_FAQ){
    const sim=Math.max(...f.q.map(e=>chatbotSimilar(q,chatbotNormalize(e))));
    const hits=f.k.filter(k=>q.includes(chatbotNormalize(k))).length;
    const score=sim+.3*hits;
    if(score>top){top=score;best=f;}
  }
  return top>=CHATBOT_MIN_SCORE?best:null;
}

if(typeof document!=='undefined')(function(){
  const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
  const HINT_KEY='bbChatHintSeen';
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile=()=>matchMedia('(max-width: 767.98px)').matches;
  const visible=el=>!!el&&el.getClientRects().length>0;
  const byId=id=>CHATBOT_FAQ.find(f=>f.id===id);
  const q=s=>`‘${s}’`;

  // 자리표시를 앱의 실제 글자로. 읽을 수 없으면 범례를 보라고 안내한다.
  function rule(){try{return typeof matrixRule==='function'?matrixRule():null;}catch{return null;}}
  function typeLabel(key){
    const t=rule()?.types?.[key];
    if(t){try{if(typeof matrixTypeLabel==='function'){const l=matrixTypeLabel(t.id);if(l&&l!==t.id)return l;}}catch{}if(t.label)return t.label;}
    return document.querySelector(`.value-grid [data-key="${key}"] b`)?.textContent.trim()||'범례 ⓘ의 유형';
  }
  function fill(text){
    return text.replace(/\{tab:(\w+)\}/g,(_,v)=>q(document.querySelector(`.tabs button[data-view="${v}"]`)?.textContent.trim()||v))
      .replace(/\{type:(\w+)\}/g,(_,k)=>q(typeLabel(k)))
      .replace(/\{rule\}/g,()=>{const r=rule(),b=r?.bbvi_threshold,m=r?.mcui_threshold;
        return Number.isFinite(b)&&Number.isFinite(m)?(b===m?`BBVI(활용가치)와 MCUI(보전 시급성)가 각각 ${b} 이상이면 ‘높음’으로 봐요.`:`BBVI(활용가치) ${b}, MCUI(보전 시급성) ${m} 이상이면 ‘높음’으로 봐요.`)
          :'‘높음’의 기준은 범례 ⓘ에서 확인하세요.';});
  }

  const root=document.createElement('div');root.className='bbc';
  root.innerHTML='<div class="bbc-hint" hidden><span>처음이세요? 사용법을 알려드릴게요</span><button type="button" class="bbc-hint-x" aria-label="안내 닫기">×</button></div>'+
    '<section class="bbc-panel" id="bbc-panel" role="dialog" aria-modal="false" aria-labelledby="bbc-title" hidden>'+
    '<header class="bbc-head"><strong id="bbc-title">사용법 안내</strong><button type="button" class="bbc-close" aria-label="사용법 안내 닫기">×</button></header>'+
    '<div class="bbc-log" role="log" aria-live="polite"></div>'+
    '<p class="bbc-note">FAQ에 없는 질문은 답을 만들기 위해 Cloudflare Workers AI로 보내요.</p>'+
    '<form class="bbc-form"><input type="text" class="bbc-input" aria-label="궁금한 점 입력" placeholder="궁금한 점을 적어 보세요" autocomplete="off" maxlength="200"><button type="submit">보내기</button></form></section>'+
    '<button type="button" class="bbc-fab" aria-label="사용법 안내 열기" aria-expanded="false" aria-controls="bbc-panel"><span aria-hidden="true">?</span></button>';
  document.body.append(root);
  const [hint,panel,fab]=['.bbc-hint','.bbc-panel','.bbc-fab'].map(s=>root.querySelector(s));
  const log=root.querySelector('.bbc-log'),input=root.querySelector('.bbc-input');

  // 탐색 지도 탭(폭 768px 이상)에서는 버튼과 대화창을 지도 확대/축소 컨트롤 왼쪽에 둔다: 근거 패널과 확대/축소를 가리지 않게.
  function place(){
    let right=16;const z=document.querySelector('.leaflet-control-zoom');
    if(!mobile()&&document.querySelector('#explore.active')&&visible(z))right=Math.max(16,document.documentElement.clientWidth-z.getBoundingClientRect().left+12);
    root.style.setProperty('--bbc-right',right+'px');
    if(panel.hidden)return;
    // 열려 있으면 높이를 줄여 위쪽 지도 컨트롤(2×2·위성/수심·확대/축소)과 겹치지 않게 한다.
    panel.style.maxHeight='';
    const p=panel.getBoundingClientRect();let top=p.top;
    for(const s of ['#value-mini','.basemap-switch','.leaflet-control-zoom']){
      const el=document.querySelector(s);if(!visible(el))continue;const r=el.getBoundingClientRect();
      if(r.right>p.left&&r.left<p.right&&r.bottom>top&&r.top<p.bottom)top=r.bottom+8;
    }
    if(top>p.top)panel.style.maxHeight=Math.max(260,p.bottom-top)+'px';
  }
  function dismissHint(){if(!hint.hidden){hint.hidden=true;store.set(HINT_KEY,'1');}}
  function add(cls,text){const p=document.createElement('div');p.className='bbc-msg '+cls;p.textContent=text;log.append(p);return p;}
  function buttons(list,cls){
    const box=document.createElement('div');box.className='bbc-chips '+(cls||'');
    for(const [id,label] of list){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.faq=id;box.append(b);}
    log.append(box);
  }
  function answer(f){
    const m=add('bbc-bot',fill(f.a));
    if(f.show){const b=document.createElement('button');b.type='button';b.className='bbc-show';b.textContent='화면에서 보여주기';b.dataset.show=f.id;m.append(b);}
    if(f.next)buttons(f.next.map(id=>[id,byId(id).q[0]]),'bbc-next');
    log.scrollTop=log.scrollHeight;
  }
  function unknown(text){add('bbc-bot',text||'이 부분은 아직 잘 모르겠어요. 아래 질문 중에서 골라 보거나 다른 말로 물어봐 주세요.');buttons(CHATBOT_STARTERS);log.scrollTop=log.scrollHeight;}
  // FAQ가 못 찾은 질문만 AI(Worker /api/ask, worker/index.mjs)에 묻는다. 시간 초과·오류·한도 초과·정적 서버(404)면 FAQ 안내로 돌아간다.
  async function askAi(text){
    const wait=add('bbc-bot bbc-wait','답을 찾는 중이에요…');log.scrollTop=log.scrollHeight;
    let reply=null,status=0;
    try{
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch('api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text}),signal:ctl.signal});
      clearTimeout(timer);status=r.status;
      if(r.ok)reply=(await r.json())?.answer;
    }catch{}
    wait.remove();
    if(typeof reply!=='string'||!reply.trim())return unknown(status===429?'질문이 많아 지금은 AI 답변을 쓸 수 없어요. 1분쯤 뒤에 다시 물어보거나 아래 질문 중에서 골라 주세요.':'');
    const m=add('bbc-bot bbc-ai',reply.trim());
    const tag=document.createElement('small');tag.className='bbc-ai-tag';tag.textContent='AI 답변 · 참고용 · 화면 글만 근거로 만들었어요';m.append(tag);
    log.scrollTop=log.scrollHeight;
  }
  function ask(text,id){
    add('bbc-user',text);
    const f=id?byId(id):chatbotMatch(text);
    if(f)answer(f);else if(id)unknown();else askAi(text);
  }
  function open(){
    dismissHint();panel.hidden=false;fab.setAttribute('aria-expanded','true');fab.setAttribute('aria-label','사용법 안내 닫기');
    if(!log.childElementCount){add('bbc-bot','안녕하세요! 이 지도 사용법을 알려드릴게요. 아래에서 고르거나 궁금한 점을 직접 적어 보세요.');buttons(CHATBOT_STARTERS);}
    place();input.focus();
  }
  function close(){panel.hidden=true;fab.setAttribute('aria-expanded','false');fab.setAttribute('aria-label','사용법 안내 열기');fab.focus();}

  // 기존 버튼을 눌러 이동한 뒤 대상에 잠깐 테두리. 이미 켜진 토글은 다시 누르지 않는다(누르면 꺼지거나 범례가 닫힘).
  // 원래 클릭이 document까지 올라간 뒤 실행해야 ⓘ 범례의 '바깥 클릭이면 닫기'에 걸리지 않는다.
  function show(f){
    if(mobile())close();
    setTimeout(()=>{
      try{
        for(const s of f.show.click){const b=document.querySelector(s);
          if(!b||b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-expanded')==='true'||b.getAttribute('aria-current')==='page')continue;b.click();}
        setTimeout(()=>{
          const t=document.querySelector(f.show.target);if(!visible(t))return;
          t.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});
          t.classList.remove('bbc-flash');void t.offsetWidth;t.classList.add('bbc-flash');
          setTimeout(()=>t.classList.remove('bbc-flash'),2600);
          // 대화창이 강조한 곳을 가리면 접는다(대화 내용은 남아 있어 다시 열면 이어진다).
          setTimeout(()=>{if(panel.hidden)return;const a=t.getBoundingClientRect(),p=panel.getBoundingClientRect();
            if(a.right>p.left&&a.left<p.right&&a.bottom>p.top&&a.top<p.bottom)close();},450);
        },120);
      }catch{}
    },0);
  }

  fab.addEventListener('click',()=>panel.hidden?open():close());
  root.querySelector('.bbc-close').addEventListener('click',close);
  root.querySelector('.bbc-hint-x').addEventListener('click',dismissHint);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  root.querySelector('.bbc-form').addEventListener('submit',e=>{e.preventDefault();const t=input.value.trim();if(!t)return;input.value='';ask(t);});
  log.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.show)show(byId(b.dataset.show));else if(b.dataset.faq)ask(b.textContent,b.dataset.faq);
  });
  addEventListener('resize',place);
  // 탭은 탭 버튼 말고도(‘선택 종 비교하기’, ‘근거 보기’ 등) 바뀌므로 #explore의 class 변화를 지켜본다.
  const explore=document.getElementById('explore');
  if(explore)new MutationObserver(()=>requestAnimationFrame(place)).observe(explore,{attributes:true,attributeFilter:['class']});
  addEventListener('load',()=>setTimeout(place,300));
  place();
  if(!store.get(HINT_KEY))hint.hidden=false;
})();
