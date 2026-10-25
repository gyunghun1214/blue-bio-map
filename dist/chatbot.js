'use strict';
// 사용법 안내 도우미(안내 캐릭터 멍이). 질문을 아래 FAQ에서 키워드·예시 질문으로 찾아 정해진 답만 한다. AI나 서버는 쓰지 않는다.
// 2026-10-15까지 FAQ가 못 찾은 질문을 보내던 /api/ask(Workers AI)는 지웠고, 이제는 '아래 탭에서 직접 찾아보거나…' 안내와 세 탭 바로가기를 보인다.
// 답변 속 {tab:id}·{type:사분면 키}·{plain:사분면 키}·{rule}은 화면에 보일 때 앱의 실제 글자와 기준값으로 바꾼다(하드코딩 금지).
// 화면 이동은 상태를 직접 바꾸지 않고 기존 버튼을 .click()해서 앱의 처리 로직을 그대로 탄다.
// app.js와 같은 전역 렉시컬 범위를 쓰므로 최상위 이름은 모두 CHATBOT_/chatbot 접두어를 붙인다.
// 2026-10-17 팀장 결정(화면 약점 문구 정리): 우리 데이터·방법의 약점이 드러나는 낱말(검증 결과·예비 평가·재현·정보충분도, 미확인·미산출 같은
// 빈칸 표시 등)은 사실이어도 답(a)·질문 칩(q[0])·시작 질문·탭 바로가기·대체 문구에 쓰지 않고, '아님·않음' 대신 무엇인지를 먼저 말한다.
// 사실과 다른 말로 채우지도 않는다. 라벨·근거 수준·정보충분도 항목은 화면에서 빠져 지웠다. validation은 검증·재현을 묻는 입력이 엉뚱한 답으로
// 가지 않게 남겨 두되, 근거와 방법 탭을 가리키는 중립 안내만 한다. q의 두 번째부터와 k는 입력을 맞추는 데만 쓰이고 화면에 나오지 않는다.
const CHATBOT_FAQ=[
  {id:'overview',q:['이 지도는 뭘 보여주나요?','이 사이트는 뭐예요','무엇을 하는 지도인가요','처음인데 어떻게 봐요'],
    k:['지도','사이트','소개','처음','무엇','뭘보여','사용법','어떻게봐'],
    a:'한반도 주변 바다의 해양생물을 종별로 골라 활용 근거와 보전 정보를 함께 비교하는 연구 프로토타입이에요. 화면은 {tab:explore}, {tab:compare}, {tab:method} 세 탭으로 나뉘어요. 지도는 공개 출현기록(OBIS·GBIF)이 있는 격자를 보여 주며, 붉은 점은 기록이 있는 칸의 위치(넓게 묶음)예요.',
    show:{click:['[data-view="explore"]'],target:'.tabs'},next:['map-modes','colors','indices']},
  {id:'map-modes',q:['출현 기록과 활용 × 보전 모드는 뭐가 달라요','지도 모드 바꾸기','출현 기록 모드는 뭐예요'],
    k:['모드','출현기록','활용보전','왼쪽위','지도내용','전환'],
    a:'지도 위쪽(좁은 화면에서는 지도 왼쪽 위)의 ‘출현 기록’·‘활용 × 보전’ 버튼으로 바꿀 수 있어요. ‘출현 기록’은 선택한 종의 공개 출현기록(OBIS·GBIF)이 있는 격자를 보여 주고, ‘활용 × 보전’은 먼저 선택한 종의 셀만 그 종의 유형 색으로 칠해요. 지도 오른쪽 위의 ‘모든 종 겹쳐 보기’를 누르면 모든 종의 셀을 4가지 유형 색으로 겹쳐 볼 수 있어요.',
    show:{click:['[data-view="explore"]'],target:'.map-mode'},next:['colors','red-dots']},
  {id:'colors',q:['색깔(4가지 유형)은 무슨 뜻이에요?','셀 색이 무슨 의미예요','네 가지 유형이 뭐예요','점선 테두리는 뭐예요'],
    k:['색','색깔','유형','4가지','네가지','점선','셀색','범례'],
    a:'‘활용 × 보전’의 색은 {type:high_bbvi_low_mcui}, {type:high_bbvi_high_mcui}, {type:low_bbvi_high_mcui}, {type:low_bbvi_low_mcui} 네 유형이에요. {rule} 처음 보기에서는 선택한 종의 셀만 그 종의 유형 색(같은 색 점선 테두리)으로 칠하고, ‘모든 종 겹쳐 보기’에서는 셀 색이 그 셀에 기록된 종 중 우선순위가 가장 높은 유형 하나예요. 두 보기 모두 색은 종 단위 값으로 정한 유형이에요. 겹쳐 보기에서 유형이 섞인 셀은 촘촘한 점선 테두리예요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]'],target:'#value-mini'},next:['verdict','mini-grid']},
  {id:'verdict',q:['‘활용 지표 높음’은 무슨 뜻이에요?','보전 지표 높음은 채집하면 안 된다는 뜻인가요','카드의 판단문은 어떻게 정해요'],
    k:['활용지표높음','보전지표높음','두지표','써도됨','지켜야함','판단문','권고','채집','지속가능'],
    a:'종 카드와 근거 패널의 {plain:high_bbvi_low_mcui}, {plain:low_bbvi_low_mcui}, {plain:high_bbvi_high_mcui}, {plain:low_bbvi_high_mcui}은 네 유형 {type:high_bbvi_low_mcui}, {type:low_bbvi_low_mcui}, {type:high_bbvi_high_mcui}, {type:low_bbvi_high_mcui}의 위치를 짧게 적은 말이에요. 유형은 연구 순서를 고르기 위한 분류예요. {rule} 이 값은 탐색용 기준선이에요.',
    show:{click:['[data-view="explore"]'],target:'#species-list'},next:['colors','indices']},
  {id:'mini-grid',q:['왼쪽 아래 2×2 범례는 뭐예요','오른쪽 위 2×2 아이콘은 뭐예요','사분면 아이콘 사용법','한 유형만 보고 싶어요','ⓘ 버튼은 뭐예요'],
    k:['2×2','2x2','사분면','아이콘','ⓘ','읽는법','한유형만','유형만','오른쪽위'],
    a:'‘활용 × 보전’ 모드에서는 지도 왼쪽 아래에 2×2 범례가 나와요. 칸마다 유형 색 원(●)과 위치 이름이 적혀 있고, 지금 칠한 셀 수는 마우스를 올리거나 화면 낭독기로 들을 수 있어요. 누르면 ‘모든 종 겹쳐 보기’에서 그 유형 셀만 보여요. 여러 칸을 함께 켤 수 있고, ‘읽는 법 ⓘ’을 누르면 자세한 범례와 ‘같은 속 친척 종 · 다음 탐색 후보’ 체크박스가 나와요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]'],target:'#value-mini'},next:['unexplored','colors']},
  {id:'chips',q:['신약·기능성·식량 특성으로 종 찾기','신약·식량 특성으로 종 찾기','활용 특성 칩은 어떻게 써요','식량으로 쓸 수 있는 종만 보고 싶어요','칩을 여러 개 켜면 어떻게 돼요','결과가 하나도 없어요'],
    k:['칩','신약','기능성','식량','활용특성','특성','찾기','필터','결과없'],
    a:'왼쪽 ‘탐색 후보’ 목록 위의 활용 특성 칩(신약·기능성(식품 소재)·식량 세 줄, 넓은 화면에서는 ‘필터 더 보기’ 안)을 켜면 그 특성의 근거가 채택된 종만 남아요. 혈압(ACE 저해)과 항산화는 식품 기능성 성격이라 ‘기능성(식품 소재)’ 줄에 있어요. 여러 개를 켜면 모두 만족하는 종만 남아요. 결과가 없으면 안내에 나오는 ‘끄기’ 버튼으로 칩 하나를 꺼 보세요.',
    show:{click:['[data-view="explore"]','#filter-toggle'],target:'#use-chips'},next:['select-species','compare']},
  {id:'select-species',q:['종을 골라서 지도에서 보기','종 선택은 어떻게 해요','특정 종을 검색하고 싶어요','종 카드를 누르면 어떻게 돼요'],
    k:['종선택','고르','골라','검색','카드','학명','종이름','탐색후보'],
    a:'왼쪽 ‘탐색 후보’ 목록에서 종 카드를 누르면 그 종이 선택되고 지도와 오른쪽 패널이 그 종으로 바뀌어요. 카드 앞의 체크 칸은 비교할 종을 담는 칸이고, 2종 이상 담은 뒤 ‘선택 종 비교하기’를 누르면 나란히 볼 수 있어요. 자세한 근거는 오른쪽 패널의 ‘근거 자세히 보기’에서 열려요. 검색창에 종 이름이나 학명을 넣거나 분류군(넓은 화면에서는 ‘필터 더 보기’ 안)으로 좁힐 수 있어요. ‘활용 × 보전’에서는 처음에 선택한 종의 셀만 그 종의 유형 색으로 칠하고, 다른 카드를 누르면 그 종으로 다시 칠해요. 다른 카드에 마우스를 올리면 그 종의 셀에 노란 점선이 생기고, ‘모든 종 겹쳐 보기’에서는 선택한 종의 셀이 노란 굵은 실선 테두리로 보여요.',
    show:{click:['[data-view="explore"]'],target:'#species-list'},next:['cell-click','compare']},
  {id:'cell-click',q:['셀을 누르면 뭐가 나와요','격자를 클릭하면 어떻게 돼요','확인 종 활용 지표 높은 종 숫자는 뭐예요'],
    k:['셀','격자','클릭','누르면','확인종','활용가능종','보전우선종'],
    a:'지도의 셀을 누르면 그 격자의 확인 종·활용 지표 높은 종·보전 지표 높은 종 수와 종 이름이 나와요. 이 수는 종별 지표로 센 수예요.',
    show:{click:['[data-view="explore"]'],target:'#map'},next:['sea-score','colors']},
  {id:'compare',q:['종끼리 비교하기','여러 종을 비교하고 싶어요','비교표는 어떻게 봐요','근거 보기 버튼은 뭐예요'],
    k:['비교','비교표','데이터표','나란히','근거보기','지도셀목록','정렬','자세히','이전','다음','가로스크롤','담기','선택한생물'],
    a:'{tab:compare} 탭 위쪽의 ‘데이터 표’를 누르면 모든 종을 한 표에서 나란히 볼 수 있어요. 매트릭스에서 고른 종을 ‘+ 비교 담기’로 3종까지 담아 ‘선택한 생물 비교하기’로 볼 수도 있어요. 한 행이 한 종이고, 지표 머리글을 누르면 높은 순·낮은 순으로 정렬돼요(한 번 더 누르면 기본 순서). 값 칸을 누르면 그 종의 근거 패널이, ‘지도·셀 목록 보기’를 누르면 그 종의 지도 셀이 열려요. 비교집단·MCUI 기반 같은 긴 설명은 행 끝 ‘자세히’에서 펼쳐요.',
    show:{click:['[data-view="compare"]','[data-cmp-mode="table"]'],target:'#comparison'},next:['matrix','indices']},
  {id:'matrix',q:['활용 × 보전 매트릭스는 뭐예요','매트릭스 점은 어떻게 읽어요','왜 두 지표를 합치지 않나요'],
    k:['매트릭스','합치지','따로','두축'],
    a:'{tab:compare} 탭 첫 화면의 ‘활용 × 보전’ 매트릭스는 가로축 BBVI(활용가치)와 세로축 MCUI(보전 시급성)에 종을 점으로 놓아요. 두 값은 일부러 따로 두어요. 활용가치가 높아도 보전 필요성이 함께 보이게 하려는 거예요. 사분면마다 쉬운 이름과 공식 유형 이름이 함께 적혀 있어요. 점 색은 그 종의 유형 색이에요. 한 줄에 몰린 점들은 ‘N종 밀집 · 펼치기’ 상자로 묶여 있고, 누르면 그 종 목록이 열려요. 나머지 같은 높이 점은 위아래로 조금 비켜 놓고 짧은 선으로 실제 높이를 가리켜요. 읽는 법은 그래프 오른쪽 위 ‘ⓘ 읽는 법’ 버튼에 있어요. 그래프 아래 ‘유형별 종 목록’으로 색 없이도 같은 내용을 읽을 수 있어요. 점을 누르면 오른쪽 종 프로필에 그 종의 값이 나와요.',
    show:{click:['[data-view="compare"]','[data-cmp-mode="matrix"]'],target:'#matrix'},next:['matrix-missing','threshold','indices']},
  // 2026-10-15 심사 예상 질문. 종 이름·값·근거는 {matrix}·{score:종:지표}·{basis:종}·{mcuiwhy:종}으로 화면 자료에서 읽는다.
  {id:'matrix-missing',q:['매트릭스에는 몇 종이 있어요?','매트릭스에 없는 종이 있어요?','왜 어떤 종은 매트릭스에 점이 없어요'],
    k:['매트릭스없','점이없','빠진종','빠졌','몇종'],
    a:'{tab:compare} 탭의 ‘활용 × 보전’ 매트릭스는 종마다 BBVI(활용가치)와 MCUI(보전 시급성)를 짝지어 점 하나로 놓아요. {matrix}',
    show:{click:['[data-view="compare"]','[data-cmp-mode="matrix"]'],target:'#matrix'},next:['matrix','mcui']},
  {id:'threshold',q:['50점은 누가 정했어요?','높음 기준은 왜 그 값이에요','구분선은 어떻게 정했어요','기준 50은 근거가 있어요?'],
    k:['50','누가정','구분선','기준값','높음기준','정했'],
    a:'‘높음’을 가르는 선은 연구팀이 정한 규칙이에요. {rule} 이 선은 탐색용 기준선이고, 4.0부터 산식·가중치와 함께 고정해 두었어요. 선 가까이 있는 종은 유형이 쉽게 바뀔 수 있으니 유형 이름보다 값을 함께 봐 주세요. {tab:compare} 탭 ‘비교 기준’의 가중치 슬라이더로 BBVI가 어떻게 움직이는지 확인할 수 있어요.',
    show:{click:['[data-view="compare"]','[data-cmp-mode="matrix"]'],target:'#matrix'},next:['matrix','bbvi']},
  {id:'same-score',q:['참굴 10점과 고등어 10점은 같은 뜻이에요?','MCUI 점수가 같으면 같은 위험이에요','같은 점수는 같은 뜻인가요'],
    k:['같은뜻','같은점수','점수같','같은위험','참굴','고등어'],
    a:'MCUI(보전 시급성)의 숫자는 보전 상태 범주(LC·NT·VU·EN·CR)를 정해진 점수로 옮긴 값이에요(자원 감소 신호가 있는 종은 그 점수와 비교해 높은 값). 참굴 MCUI({score:참굴:MCUI})는 {basis:참굴}, 고등어 MCUI({score:고등어:MCUI})는 {basis:고등어}에서 왔어요. 범주를 매긴 평가(전 지구 평가·국가 평가 등)는 종마다 다르니, 같은 점수도 어느 평가에서 왔는지 함께 봐 주세요. 종별 범주와 출처는 종 상세의 MCUI 칸에서 볼 수 있어요.',
    show:{click:['[data-view="compare"]','[data-cmp-mode="table"]'],target:'#comparison'},next:['mcui','squid']},
  {id:'squid',q:['살오징어는 IUCN에서 LC인데 왜 60점이에요?','LC인데 MCUI가 왜 높아요','오징어 보전 점수가 왜 높아요'],
    k:['살오징어','오징어','lc인데','60점','왜높'],
    a:'{mcuiwhy:살오징어} 4.12부터 KOSIS 연근해 어획량이 크게 줄어든 종에는 자원 감소 신호 점수를 매기고, 멸종위험 점수와 둘 중 높은 값을 MCUI로 써요. 자원 감소 신호 점수는 KOSIS 어획량 통계에서 온 값이라, 화면에는 ‘자원 감소 신호’로 따로 적어요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['mcui','same-score']},
  {id:'indices',q:['BBVI·MCUI가 뭔가요?','지표가 뭐예요','점수는 어떻게 매겨요'],
    k:['지표','bbvi','mcui','점수','약어'],
    a:'BBVI(활용가치)는 식량 지표 MFPI와 생리활성 지표 MBPI를 합친 값이고, MCUI(보전 시급성)는 보전 상태 범주를 점수로 옮기고 어획량이 크게 줄어든 종은 자원 감소 신호까지 함께 본 값이에요. 두 값은 각각 따로 보여 줘요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['mfpi','mbpi','mcui']},
  {id:'bbvi',q:['BBVI는 어떻게 계산해요','활용가치는 뭐예요','식량 가중치 슬라이더는 뭐예요'],
    k:['bbvi','활용가치','가중치','슬라이더','통합'],
    a:'BBVI(활용가치)는 MFPI(식량)와 MBPI(생리활성)를 합친 값이에요. {tab:compare} 탭 매트릭스의 ‘비교 기준’을 누르면 나오는 가중치 슬라이더와 프리셋(신약 중심 MBPI 0.75·균형·식량 중심 MFPI 0.75)으로 두 축의 비중을 바꿔 볼 수 있어요. 공식 산출값의 가중치는 고정이고, 바꾼 값은 ‘탐색 보기’ 표시와 함께 공식값을 나란히 보여 줘요.',
    show:{click:['[data-view="compare"]','[data-cmp-mode="matrix"]','#cmp-basis-toggle'],target:'.weight-control'},next:['mfpi','mbpi']},
  {id:'mfpi',q:['MFPI는 뭐예요','식량 지표는 어떻게 매겨요','EPA DHA는 점수에 들어가요'],
    k:['mfpi','식량지표','영양','식품성분','epa','dha','ufish'],
    a:'MFPI(식량 지표)는 국가표준식품성분 DB 10.4의 고정 비교집단과 견줘 매긴 값이에요. 성분값은 이 DB를 먼저 쓰고, 같은 종 부표본이나 FAO/INFOODS uFiSh 값도 출처를 표시해 함께 써요. EPA·DHA는 점수와 따로 보여 주는 참고 정보예요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['mbpi','bbvi']},
  {id:'mbpi',q:['MBPI는 뭐예요','신약 지표는 어떻게 매겨요','MBPI가 0점이면 효능이 없는 건가요'],
    k:['mbpi','신약지표','생리활성','펩타이드','chembl','0점','효능'],
    a:'MBPI(생리활성 단서 지표)는 이 생물에서 나온 물질의 실험 결과로 매기는 값이에요. ChEMBL 화합물, ACE 저해·항균·항암·잔틴 산화효소 억제 펩타이드, 감태 분리 화합물을 층별로 따로 백분위로 매기고, 같은 표적·같은 시험 조건끼리만 비교해요. 근거 계수를 곱한 뒤 가장 높은 항목을 종의 값으로 써요. 어느 층에도 항목이 없을 때의 기본값은 0점이에요. 종 프로필의 MBPI 아래에는 최상위 근거가 의약 표적(항균·항암·기타 표적)인지 기능성 펩타이드(ACE·XO)인지를 함께 보여 줘요. 의약 표적 항목만 모은 보조 값도 그 옆에 있어요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['bbvi','mcui']},
  {id:'mcui',q:['MCUI는 뭐예요','보전 시급성은 어떻게 정해요','적색목록 평가가 없으면 어떻게 해요','자원 감소 신호는 뭐예요'],
    k:['mcui','보전','시급','적색목록','iucn','멸종','어획량','자원감소'],
    a:'MCUI(보전 시급성)는 보전 상태 범주(LC·NT·VU·EN·CR)를 점수로 옮기고, 어획량이 크게 줄어든 종은 자원 감소 신호 점수와 비교해 높은 값을 써요. 범주는 IUCN 적색목록 2026-1 전 지구 평가를 먼저 쓰고, 그다음 한국 국가 평가 등을 써요. 자원 감소 신호는 4.12부터 KOSIS 연근해 어획량 통계로 매기는 35·60·80점이에요. 종마다 쓴 범주와 출처는 종 상세의 MCUI 칸에서 볼 수 있어요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['squid','matrix']},
  // 검증을 묻는 입력의 자리: 검증 결과(통과·미충족)는 말하지 않고 근거와 방법 탭만 가리킨다(2026-10-17).
  {id:'validation',q:['검증은 통과했어요?','지표는 검증됐나요','방법 검증 기준 미충족은 무슨 뜻이에요','빈칸은 왜 없어요'],
    k:['검증','미통과','미충족','통과','신뢰','빈칸','대체규칙','논문','재현'],
    a:'지표를 어떻게 계산했는지는 {tab:method} 탭에 출처와 함께 정리되어 있어요.',
    show:{click:['[data-view="method"]'],target:'#method-02'},next:['indices','sources']},
  {id:'unexplored',q:['같은 속 친척 종은 뭐예요?','다음 탐색 후보는 뭐예요','미탐색 후보는 뭐예요','30종 밖 미탐색 후보 목록','새로 발견된 종인가요'],
    k:['미탐색','근연종','30종밖','같은속','친척','다음탐색','발견'],
    a:'‘같은 속 친척 종 · 다음 탐색 후보’는 BBVI(활용가치)가 높은 종과 같은 속인 근연종이에요. 이 종들은 같은 속 친척 종이라 다음 탐색 후보로 보여 줘요. ⓘ 범례의 같은 이름 체크박스와 30종 밖 목록에서 볼 수 있어요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]','#value-info'],target:'.value-layers'},next:['bbvi','mini-grid']},
  {id:'period-effort',q:['기간 필터는 뭐예요','회색 음영 조사량은 뭐예요','점이 없는 바다는 종이 없는 건가요'],
    k:['기간','조사량','음영','회색','회색음영','조사가부족','없는바다'],
    a:'‘공개 집계 기간’ 버튼은 ‘출현 기록’·‘활용 × 보전’ 버튼 옆에 있고, 기록을 모은 기간이 여러 개인 종을 기간별로 나눠 볼 때 눌러서 골라요. 회색 음영 ‘조사량’은 그 바다에 쌓인 모든 해양생물의 OBIS 관측 기록 양이에요(옅을수록 기록이 적은 바다). 처음 화면에서는 꺼져 있고, 지도 왼쪽 아래 범례의 ‘조사량’ 칸을 켜면 보여요. 점과 이 음영을 함께 보면 기록이 많이 쌓인 바다를 알 수 있어요.',
    show:{click:['[data-view="explore"]','[data-map-mode="occurrence"]'],target:'#occurrence-legend'},next:['red-dots','map-modes']},
  {id:'map-buttons',q:['위성 수심 배경 바꾸기','링크 복사는 뭐예요','전체 보기 버튼','확대 축소는 어떻게 해요'],
    k:['위성','수심','배경','링크복사','공유','전체보기','확대','축소'],
    a:'지도 오른쪽 위에서 ‘위성’과 ‘수심’ 배경을 바꿀 수 있어요. ‘링크 복사’는 지금 보는 종·탭·배경 지도·기간·지도 위치·활용 특성 칩을 링크 하나로 복사하고, ‘전체 보기’는 선택 종의 전체 범위로 지도를 돌려요. 확대·축소는 지도 오른쪽 아래의 +/− 버튼으로 해요.',
    show:{click:['[data-view="explore"]'],target:'.map-title'},next:['map-modes','select-species']},
  {id:'red-dots',q:['붉은 점은 뭐예요?','붉은 점이 실제 발견 위치인가요','빨간 점은 뭐예요','버블은 뭐예요'],
    k:['붉은점','빨간점','좌표','위치','버블'],
    a:'지도의 붉은 점은 기록이 있는 칸의 위치(넓게 묶음)예요. 그 칸 안에 고정한 도식적 무늬로 그려요. 기록 수는 공개 관측 기록 건수예요. 축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시예요.',
    show:{click:['[data-view="explore"]','[data-map-mode="occurrence"]'],target:'#occurrence-legend'},next:['period-effort','sea-score']},
  {id:'sea-score',q:['해역 점수나 자원량을 알 수 있나요','어느 바다가 가치가 높아요','이 바다를 개발해도 되나요'],
    k:['해역','자원량','해역점수','바다점수','개발','어느바다'],
    a:'이 지도의 지표는 모두 종 단위 값이에요. 셀 색은 출현기록이 있는 셀마다 그 셀에 기록된 종의 유형을 칠한 것이고, 유형은 연구 순서를 고르기 위한 분류예요. 셀의 기록 수는 공개 관측 기록 건수예요.',
    show:{click:['[data-view="explore"]','[data-map-mode="value"]'],target:'#value-mini'},next:['colors','indices']},
  {id:'sources',q:['자료 출처는 어디예요','종과 화합물은 어떻게 연결해요','AphiaID는 뭐예요'],
    k:['출처','자료','데이터','aphiaid','worms','inchikey','pubchem','연결'],
    a:'종은 WoRMS AphiaID로, 화합물은 InChIKey·PubChem CID로 연결해요. 사용한 자료 목록은 {tab:method} 탭 아래 ‘사용한 자료와 수집 방법’에 있어요.',
    show:{click:['[data-view="method"]'],target:'.source-section'},next:['indices','overview']},
  {id:'move-mascot',q:['멍이가 화면을 가려요','멍이 위치 옮기기','멍이 버튼을 다른 곳으로 옮기고 싶어요'],
    k:['멍이','옮기','옮겨','가려','가리','끌어','드래그'],
    a:'멍이 버튼을 누른 채 끌면 원하는 자리로 옮길 수 있어요. 놓은 자리는 이 브라우저에 기억되고, 대화창 위의 ‘멍이 원래 자리로’를 누르면 처음 자리로 돌아가요.',
    next:['overview']}
];
const CHATBOT_STARTERS=[['overview','이 지도는 뭘 보여주나요?'],['colors','색깔(4가지 유형)은 무슨 뜻이에요?'],['chips','신약·기능성·식량 특성으로 종 찾기'],
  ['select-species','종을 골라서 지도에서 보기'],['compare','종끼리 비교하기'],['indices','BBVI·MCUI가 뭔가요?']];
// 답이 없을 때 보여 줄 세 탭과 그 탭에서 볼 수 있는 것.
const CHATBOT_TAB_LINKS=[['explore','종별 지도와 근거'],['compare','매트릭스와 데이터 표'],['method','산출 방법과 출처']];
// 영어 화면(i18n.js의 LANG·T_가 있을 때): 질문 칩·답·키워드를 화면 사전(i18n-en.js, '안내 도우미' 묶음)에서 읽는다.
// 키워드 사전 값은 쉼표로 나눈 영어 낱말·구(구는 정규화하면 붙어서 한 덩어리로 맞춘다).
// 한국어 화면과 vm 검사(i18n.js 없음)에서는 원문 그대로다. 영어 질문 예시를 앞에 두고(칩은 q[0]) 한국어 예시·키워드도 남겨 둔다.
const chatbotEn=()=>typeof LANG!=='undefined'&&LANG==='en';
const chatbotT=(ko,v)=>typeof T_==='function'?T_(ko,v):ko.replace(/\{(\w+)\}/g,(m,k)=>v&&Object.hasOwn(v,k)?String(v[k]):m);
const chatbotTr=s=>chatbotEn()&&typeof i18nTr==='function'&&s?i18nTr(i18nKey(s))??s:s; // 앱이 만든 한국어 낱말(유형 이름 등)
if(chatbotEn()){
  for(const f of CHATBOT_FAQ){f.q=[...f.q.map(x=>chatbotT(x)),...f.q];f.k=[...chatbotT(f.k.join(' ')).split(/\s*,\s*/),...f.k];f.a=chatbotT(f.a);}
  for(const x of [...CHATBOT_STARTERS,...CHATBOT_TAB_LINKS])x[1]=chatbotT(x[1]);
}
const CHATBOT_PARTICLES=['으로','에서','이랑','하고','까지','부터','한테','은','는','이','가','을','를','의','에','로','도','요','와','과','만'];
// 소문자 → 낱말마다 끝 조사 하나 제거(조사보다 2글자 이상 긴 낱말만) → 공백·문장부호 없이 이어 붙임.
// 영어 화면에서는 뜻이 적은 영어 낱말(what·the·is 등)도 뺀다. 바이그램 비교가 이런 낱말에 끌려가지 않게.
const CHATBOT_STOP_EN=new Set(['what','whats','is','are','was','the','a','an','do','does','did','how','i','im','to','of','in','on','for','it','its','this','that','these','me','my','can','be','with','and','or','there','about','want','see','mean','means','s','you','your','why','which','when']);
function chatbotNormalize(text){
  return String(text||'').toLowerCase().split(/[^\p{L}\p{N}×]+/u).filter(w=>w&&!(chatbotEn()&&CHATBOT_STOP_EN.has(w))).map(w=>{
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
const CHATBOT_MIN_SCORE_EN=.55; // 영어는 짧은 낱말끼리 바이그램이 쉽게 겹쳐(hello ↔ cell colour) 기준을 조금 높인다
// {plain:<사분면 키>}: 판단문(유형 앞의 짧은 말)은 app.js의 matrixTypePlain 한 곳에서 읽는다. 읽을 수 없으면 카드를 보라고 안내.
function chatbotPlain(key){
  try{const id=typeof matrixRule==='function'?matrixRule()?.types?.[key]?.id:null;if(id&&typeof matrixTypePlain==='function')return matrixTypePlain(id);}catch{}
  return chatbotT('종 카드에 적힌 판단문');
}
// {matrix}·{score:종:지표}·{basis:종}·{mcuiwhy:종}: 종의 값과 근거를 app.js가 화면에 쓰는 함수로 읽는다(숫자 하드코딩 없음).
// 자료가 아직 없거나 종을 못 찾으면 화면을 보라는 말로 바꾼다. MCUI 근거 낱말은 app.js의 mcuiBasisShortOf가 화면과 같은 말로 정한다.
// 2026-10-17 문구 규칙: 매트릭스는 놓인 종 수만 말하고(빠진 종의 이름·이유·빠진 수는 쓰지 않음), 멸종위험 점수를 모르는 종은 그 부분을 쓰지 않는다.
function chatbotFact(kind,arg){
  try{
    const list=typeof data!=='undefined'&&Array.isArray(data?.species)?data.species:null;
    if(kind==='matrix'){
      if(!list||typeof assessedForMatrix!=='function')return chatbotT('몇 종이 놓였는지는 매트릭스 아래 ‘유형별 종 목록’에서 볼 수 있어요.');
      const n=list.filter(s=>assessedForMatrix(s)).length;
      return n===list.length?chatbotT('지금은 {0}종 모두 매트릭스에 놓여 있어요.',{0:list.length}):chatbotT('지금은 매트릭스에 {0}종이 놓여 있어요.',{0:n});
    }
    // 자리표시의 종 이름은 한국어(영어 화면의 label은 학명이라 koLabel로도 찾는다). 답에 쓰는 이름은 화면의 label.
    const [name,key]=String(arg).split(':'),s=list?.find(x=>x.label===name||x.koLabel===name),nm=s?.label||name;
    const score=k=>{const v=s&&pilotScore(s,k);return Number.isFinite(v)?scoreText(s,k,v):null;};
    if(kind==='score'&&score(key)!==null)return score(key)+(chatbotEn()?'':'점');
    if(kind==='basis'&&s&&typeof mcuiBasisShortOf==='function'){const b=mcuiBasisShortOf(s);return chatbotTr(b==='IUCN'?'IUCN 전 지구 평가':b);}
    if(kind==='mcuiwhy'&&score('MCUI')!==null){
      if(!stockMcui(s))return chatbotT('{0}의 MCUI는 지금 {1}점이고 {2}에서 왔어요.',{0:nm,1:score('MCUI'),2:chatbotFact('basis',name)});
      const c=s.assessment?.conservation_status?.category,risk=extinctionMcui(s),ch=stockChange(s.assessment.stock_decline);
      const signal=ch?chatbotT('자원 감소 신호(어획량 {0})',{0:ch}):chatbotT('자원 감소 신호');
      return Number.isFinite(risk)?chatbotT('{0}의 멸종위험 범주{1}만 보면 MCUI는 {2}점이지만, {3}로 {4}점이 됐어요.',{0:nm,1:c?(chatbotEn()?' ':'')+`(${c})`:'',2:scoreValue(s,'MCUI',risk),3:signal,4:score('MCUI')})
        :chatbotT('{0}의 MCUI는 {1}로 {2}점이 됐어요.',{0:nm,1:signal,2:score('MCUI')});
    }
  }catch{}
  return chatbotT(kind==='score'?'(값은 종 상세 참고)':kind==='basis'?'종 상세에 적힌 근거':kind==='mcuiwhy'?'값과 근거는 종 상세의 MCUI 칸에서 볼 수 있어요.':'');
}
function chatbotMatch(text){
  const q=chatbotNormalize(text);if(q.length<2)return null;
  let best=null,top=0;
  for(const f of CHATBOT_FAQ){
    const sim=Math.max(...f.q.map(e=>chatbotSimilar(q,chatbotNormalize(e))));
    // 기호뿐인 키워드(ⓘ)는 정규화하면 빈 문자열이 되어 모든 질문에 걸리므로 세지 않는다.
    const hits=f.k.filter(k=>{const w=chatbotNormalize(k);return !!w&&q.includes(w);}).length;
    const score=sim+.3*hits;
    if(score>top){top=score;best=f;}
  }
  return top>=(chatbotEn()?CHATBOT_MIN_SCORE_EN:CHATBOT_MIN_SCORE)?best:null;
}

// 안내 캐릭터 '멍이'(멍게 연구원) SVG. 상태: welcome·answer·think·ai·point·unknown·rest. crop이면 바위 없이 몸·입출수공만(아바타용).
// 입수공 +, 출수공 −는 실제 멍게(Halocynthia roretzi) 모양. 색은 몸 주황 + 앱 남색(--navy)·청록(--teal) 출입증.
// 움직이는 부위는 <g>로 묶는다(chatbot.css의 bbc-m-*): 몸 전체 all 안에 입수공 sL·출수공 sR·몸통 body·눈 look>eyes·입 mouth·덧그림(땀·안경).
// 거품·물방울·물줄기·Z는 몸 밖. svg의 상태 클래스(bbc-m-think 등)로 CSS가 상태별 움직임을 고른다. 잘 모르겠어요의 처진 수공도 CSS.
// face: 'smile'이면 눈·입만 welcome의 것으로(깡충 인사·다 말했어요), 'talk'이면 입만 열린 입으로(말하기). 없으면 상태 그림 그대로.
const CHATBOT_MASCOT_STATES={welcome:{e:'happy',m:'open',x:'bub'},answer:{e:'n',m:'smile'},think:{e:'up',m:'o',x:'think'},
  ai:{e:'n',m:'flat',x:'glasses'},point:{e:'right',m:'smile',x:'jet'},unknown:{e:'small',m:'wavy',x:'sweat'},rest:{e:'sleep',m:'flat',x:'z'}};
function chatbotMascot(state,size,crop,face){
  const C={body:'#F2734B',dark:'#D9532C',light:'#F9A27F',hole:'#7A2614',navy:'#0b1b2b',cheek:'#FF8E7A',teal:'#0b7a74',rock:'#9DB2C0',water:'#5FB3C9'};
  const key=CHATBOT_MASCOT_STATES[state]?state:'answer',s=CHATBOT_MASCOT_STATES[key];
  const bumps=[[30,70,3],[27,90,3.4],[38,102,3],[90,68,3],[93,90,3.4],[82,103,3],[60,47,2.4],[46,51,2.3],[74,51,2.3],[34,82,2.1],[86,80,2.1],[60,106,2.2]];
  const eye=(dx,dy,r)=>[48,72].map(x=>`<circle cx="${x+dx}" cy="${74+dy}" r="${r}" fill="${C.navy}"/><circle cx="${x+dx+1.5}" cy="${72.4+dy}" r="1.5" fill="#fff"/>`).join('');
  const arc=(y1,y2,w)=>[48,72].map(x=>`<path d="M${x-4.5} ${y1} Q${x} ${y2} ${x+4.5} ${y1}" stroke="${C.navy}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`).join('');
  const eyes={happy:arc(75.5,69.5,2.6),sleep:arc(74,77.5,2.4),up:eye(0,-2,4.6),right:eye(2,0,4.6),small:eye(0,0,3.8),n:eye(0,0,4.6)}[face==='smile'?'happy':s.e];
  const mouth={open:`<path d="M54.5 81.5 Q60 90.5 65.5 81.5 Z" fill="${C.hole}"/>`,
    smile:`<path d="M55 82.5 Q60 87 65 82.5" stroke="${C.navy}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    o:`<ellipse cx="60" cy="84.5" rx="2.4" ry="2.8" fill="${C.navy}"/>`,
    flat:`<path d="M56.5 84 L63.5 84" stroke="${C.navy}" stroke-width="2.2" stroke-linecap="round"/>`,
    wavy:`<path d="M54 85 Q57 82 60 85 Q63 88 66 85" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round"/>`}[face==='smile'||face==='talk'?'open':s.m];
  const siphon=left=>{
    const [x,top,base]=left?[42,18,50]:[78,22,48];
    const hole=left?`<path d="M${x} ${top+.6} V${top+5.4} M${x-3} ${top+3} H${x+3}" stroke="${C.hole}" stroke-width="1.7" stroke-linecap="round"/>`
      :`<path d="M${x-3.2} ${top+3} H${x+3.2}" stroke="${C.hole}" stroke-width="1.8" stroke-linecap="round"/>`;
    return `<g class="bbc-m-${left?'sL':'sR'}"><path d="M${x-7} ${base} L${x-8} ${top+4} Q${x-8} ${top} ${x} ${top} Q${x+8} ${top} ${x+8} ${top+4} L${x+7} ${base} Z" fill="${C.body}"/><ellipse cx="${x}" cy="${top+3}" rx="8" ry="3.6" fill="${C.light}"/>${hole}</g>`;
  };
  const b=(x,y,r,cls,w)=>`<circle${cls?` class="${cls}"`:''} cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".75" stroke="${C.water}" stroke-width="${w||1.3}"/>`;
  // crop(아바타)에서는 viewBox 위 끝이 y 12라 원래 자리(y 10 위)의 거품·Z가 잘린다: 출수공 위·오른쪽 위 안쪽으로 옮기고 키운다.
  const over={glasses:[48,72].map(x=>`<circle cx="${x}" cy="74" r="7.4" fill="#fff" fill-opacity=".22" stroke="${C.navy}" stroke-width="1.7"/>`).join('')+`<path d="M55.4 73.5 Q60 71.5 64.6 73.5" stroke="${C.navy}" stroke-width="1.7" fill="none"/>`,
    sweat:`<path class="bbc-m-sweat" d="M90 54 Q86 61 90 63.5 Q94 61 90 54 Z" fill="#8FD3E8" stroke="${C.water}" stroke-width="1"/>`}[s.x]||'';
  const out={bub:b(36,8,3)+b(31,-2,2.2),
    think:crop?b(84,25,2.8,'bbc-rise',1.5)+b(91,19,3.6,'bbc-rise',1.5)+b(99,16,4.3,'bbc-rise',1.6):b(43,8,2.4,'bbc-rise')+b(40,-2,3.2,'bbc-rise')+b(45,-12,3.8,'bbc-rise'),
    jet:`<g class="bbc-m-jet"><path class="bbc-jet" d="M84 23 Q98 6 113 16" stroke="${C.water}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M108 11 L115 17 L106 19" stroke="${C.water}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    z:crop?`<circle cx="100" cy="26" r="7.5" fill="#fff" fill-opacity=".85" stroke="${C.water}" stroke-width="1.3"/><path d="M97.1 23.1 H102.9 L97.1 28.9 H102.9" stroke="${C.navy}" stroke-width="1.7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
      :`<circle cx="96" cy="10" r="9" fill="#fff" fill-opacity=".85" stroke="${C.water}" stroke-width="1.3"/><path d="M92.5 6.5 H99.5 L92.5 13.5 H99.5" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`}[s.x]||'';
  // 가만히 있을 때 출수공 위로 떠오르는 물방울(C). CSS가 움직일 때만 보이게 한다.
  const drop=['welcome','answer','ai'].includes(key)?b(79,crop?24:18,crop?3.6:2.6,'bbc-m-drop',crop?1.5:1.3):'';
  return `<svg class="bbc-mascot bbc-m-${key}${crop?' bbc-m-crop':''}" width="${size}" height="${size}" viewBox="${crop?'8 12 104 104':'0 -18 120 146'}" aria-hidden="true" focusable="false">`+
    (crop?'':`<ellipse cx="60" cy="114" rx="44" ry="8" fill="${C.rock}"/>`)+
    '<g class="bbc-m-all">'+siphon(true)+siphon(false)+
    '<g class="bbc-m-body">'+`<path d="M24 112 C13 92 14 56 34 44 C46 37 74 37 86 44 C106 56 107 92 96 112 Z" fill="${C.body}"/>`+
    `<ellipse cx="42" cy="58" rx="8" ry="4.5" fill="${C.light}" opacity=".75" transform="rotate(-24 42 58)"/>`+
    bumps.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${C.dark}"/>`).join('')+
    `<ellipse cx="39" cy="83" rx="5" ry="3" fill="${C.cheek}" opacity=".55"/><ellipse cx="81" cy="83" rx="5" ry="3" fill="${C.cheek}" opacity=".55"/>`+
    `<path d="M51 95 L60 90.5 L69 95" stroke="${C.teal}" stroke-width="1.6" fill="none"/><rect x="52.5" y="94.5" width="15" height="10.5" rx="2.2" fill="${C.teal}"/><path d="M55.5 100.5 q2.2 -2.2 4.5 0 t4.5 0" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`+
    `<g class="bbc-m-look"><g class="bbc-m-eyes">${eyes}</g></g><g class="bbc-m-mouth">${mouth}</g>`+over+'</g>'+
    out+drop+'</svg>';
}

// 멍이 여는 버튼 옮기기(끌기). 계산만 여기 두고 화면 부분이 부른다. 좌표는 화면(뷰포트) 왼쪽 위 기준 px.
// view={w,h,inset:{top,right,bottom,left}}: inset은 노치·홈 막대(safe-area) 여백.
const CHATBOT_DRAG={mouse:6,touch:10,margin:8,gap:12,minPanel:260};
// 누른 점에서 문턱값보다 많이 움직여야 끌기. 그 전에 떼면 누르기(열기/닫기). 손가락은 흔들림이 커서 문턱이 높다.
function chatbotDragStarted(dx,dy,pointerType){
  return Math.hypot(dx,dy)>(pointerType==='mouse'?CHATBOT_DRAG.mouse:CHATBOT_DRAG.touch);
}
// 버튼(size px 정사각형)을 화면 가장자리에서 margin 이상 떨어진 안쪽으로. 화면이 버튼보다 좁으면 가운데(음수면 0).
function chatbotClampFab(pos,size,view,margin=CHATBOT_DRAG.margin){
  const i=view.inset||{},axis=(v,len,a,b)=>{const lo=margin+(a||0),hi=len-size-margin-(b||0);
    return hi<lo?Math.max(0,Math.round((len-size)/2)):Math.round(Math.min(hi,Math.max(lo,v)));};
  return {x:axis(+pos.x||0,view.w,i.left,i.right),y:axis(+pos.y||0,view.h,i.top,i.bottom)};
}
// 저장은 가까운 가장자리 기준: 오른쪽 아래에 둔 버튼은 창 크기가 바뀌어도 오른쪽 아래에 남는다.
function chatbotFabAnchor(pos,size,view){
  const h=pos.x+size/2<=view.w/2?'left':'right',v=pos.y+size/2<=view.h/2?'top':'bottom';
  return {h,x:Math.max(0,Math.round(h==='left'?pos.x:view.w-pos.x-size)),v,y:Math.max(0,Math.round(v==='top'?pos.y:view.h-pos.y-size))};
}
function chatbotFabFromAnchor(a,size,view){
  return {x:a.h==='left'?a.x:view.w-a.x-size,y:a.v==='top'?a.y:view.h-a.y-size};
}
// localStorage 값 검사: {desktop:{h,x,v,y},mobile:{…}} 중 올바른 칸만 남긴다. 깨졌거나 남는 칸이 없으면 null.
function chatbotReadFabPos(raw){
  let o;try{o=JSON.parse(raw);}catch{return null;}
  if(!o||typeof o!=='object')return null;
  const ok=a=>!!a&&typeof a==='object'&&(a.h==='left'||a.h==='right')&&(a.v==='top'||a.v==='bottom')&&
    [a.x,a.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1e4);
  const out={};for(const k of ['desktop','mobile'])if(ok(o[k]))out[k]={h:o[k].h,x:o[k].x,v:o[k].v,y:o[k].y};
  return Object.keys(out).length?out:null;
}
// 옮긴 버튼 옆, 넓은 쪽으로 대화창을 연다. 오른쪽 절반이면 오른쪽 끝을, 왼쪽 절반이면 왼쪽 끝을 버튼에 맞추고,
// 아래쪽 절반이면 버튼 위로, 위쪽 절반이면 아래로. 높이가 모자라면 줄인다(최소 minPanel, 화면보다 크지 않게).
function chatbotPanelPlace(fab,panel,view,margin=CHATBOT_DRAG.margin,gap=CHATBOT_DRAG.gap){
  const w=Math.min(panel.w,view.w-2*margin);
  let left=fab.x+fab.size/2>view.w/2?fab.x+fab.size-w:fab.x;
  left=Math.max(margin,Math.min(left,view.w-margin-w));
  const above=fab.y+fab.size/2>view.h/2;
  const room=above?fab.y-gap-margin:view.h-margin-(fab.y+fab.size+gap);
  const h=Math.max(0,Math.min(panel.h,Math.max(CHATBOT_DRAG.minPanel,room),view.h-2*margin));
  let top=above?fab.y-gap-h:fab.y+fab.size+gap;
  top=Math.max(margin,Math.min(top,view.h-margin-h));
  return {left:Math.round(left),top:Math.round(top),maxHeight:Math.round(h)};
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
    if(t){try{if(typeof matrixTypeLabel==='function'){const l=matrixTypeLabel(t.id);if(l&&l!==t.id)return chatbotTr(l);}}catch{}if(t.label)return chatbotTr(t.label);}
    return document.querySelector(`.value-grid [data-key="${key}"] b`)?.textContent.trim()||chatbotT('범례 ⓘ의 유형');
  }
  function fill(text){
    return text.replace(/\{tab:(\w+)\}/g,(_,v)=>q(document.querySelector(`.tabs button[data-view="${v}"]`)?.textContent.trim()||v))
      .replace(/\{type:(\w+)\}/g,(_,k)=>q(typeLabel(k)))
      .replace(/\{plain:(\w+)\}/g,(_,k)=>q(chatbotTr(chatbotPlain(k))))
      .replace(/\{(matrix|score|basis|mcuiwhy)(?::([^}]+))?\}/g,(_,k,a)=>chatbotFact(k,a))
      .replace(/\{rule\}/g,()=>{const r=rule(),b=r?.bbvi_threshold,m=r?.mcui_threshold;
        return Number.isFinite(b)&&Number.isFinite(m)?(b===m?chatbotT('BBVI(활용가치)와 MCUI(보전 시급성)가 각각 {0} 이상이면 ‘높음’으로 봐요.',{0:b}):chatbotT('BBVI(활용가치) {0}, MCUI(보전 시급성) {1} 이상이면 ‘높음’으로 봐요.',{0:b,1:m}))
          :chatbotT('‘높음’의 기준은 범례 ⓘ에서 확인하세요.');});
  }

  const root=document.createElement('div');root.className='bbc';
  root.innerHTML='<div class="bbc-hint" hidden><span><span class="bbc-hint-lead">처음이세요? </span>멍이가 사용법을 알려드릴게요</span><button type="button" class="bbc-hint-x" aria-label="안내 닫기">×</button></div>'+
    '<section class="bbc-panel" id="bbc-panel" role="dialog" aria-modal="false" aria-labelledby="bbc-title" hidden>'+
    '<header class="bbc-head"><span class="bbc-avatar"></span><div class="bbc-titles"><strong id="bbc-title">사용법 안내 도우미</strong><small aria-hidden="true">안내 캐릭터 멍이</small></div>'+
    '<button type="button" class="bbc-reset" hidden>멍이 원래 자리로</button><button type="button" class="bbc-close" aria-label="사용법 안내 닫기">×</button></header>'+
    '<div class="bbc-log" role="log" aria-live="polite"></div>'+
    '<p class="bbc-note">미리 준비한 답변으로 안내해요</p>'+
    '<form class="bbc-form"><input type="text" class="bbc-input" aria-label="궁금한 점 입력" placeholder="궁금한 점을 적어 보세요" autocomplete="off" maxlength="200"><button type="submit">보내기</button></form></section>'+
    '<button type="button" class="bbc-fab" aria-label="사용법 안내 열기" aria-expanded="false" aria-controls="bbc-panel" title="누르면 사용법 안내 · 끌어서 옮길 수 있어요"></button>'+
    '<span class="bbc-safe" aria-hidden="true"></span>';
  document.body.append(root);
  const [hint,panel,fab]=['.bbc-hint','.bbc-panel','.bbc-fab'].map(s=>root.querySelector(s));
  const log=root.querySelector('.bbc-log'),input=root.querySelector('.bbc-input'),avatar=root.querySelector('.bbc-avatar');
  const reset=root.querySelector('.bbc-reset'),safe=root.querySelector('.bbc-safe');
  const fabFace=expanded=>{fab.innerHTML=expanded?'<span aria-hidden="true">×</span>':chatbotMascot('answer',44,true);};
  // 머리말 멍이 표정. brief면 2.6초 뒤 직전 표정으로 돌아간다('화면에서 보여주기').
  // 말하기·웃는 얼굴(speak)도 이 faceTimer를 써서, 새 표정이 오면 남은 전환이 함께 취소된다.
  let face='welcome',faceTimer=0;
  function mood(state,brief){
    clearTimeout(faceTimer);avatar.innerHTML=chatbotMascot(state,40,true);
    if(brief)faceTimer=setTimeout(()=>mood(face),2600);else face=state;
  }
  mood(face);fabFace(false);
  // 한 번 도는 움직임(깡충 .bbc-m-hop): 붙였다가 ms 뒤 뗀다. 이미 붙어 있으면 떼고 다시 붙여 처음부터. 움직임 줄이기면 하지 않는다.
  function mascotOnce(svg,cls,ms){
    if(!svg||reduced())return;
    svg.classList.remove(cls);svg.getBoundingClientRect();svg.classList.add(cls);
    clearTimeout(svg.bbcOnce);svg.bbcOnce=setTimeout(()=>svg.classList.remove(cls),ms);
  }
  // box(머리말 .bbc-avatar 또는 말풍선 행 .bbc-row) 안의 멍이만 다시 그린다. 말풍선과 그 안의 버튼은 그대로.
  function paint(box,size,state,f){
    const t=document.createElement('template');t.innerHTML=chatbotMascot(state,size,true,f);
    const svg=t.content.firstElementChild,old=box.querySelector(':scope>.bbc-mascot');
    if(old)old.replaceWith(svg);else box.prepend(svg);
    return svg;
  }
  // 말하기(H): ms 동안 열린 입으로 뻐끔거리고, 끝나면(I) 웃으며 한 번 깡충, 1초 뒤 원래 그림. 타이머는 setTimer가 맡는다.
  function speak(draw,setTimer,ms){
    draw('talk').classList.add('bbc-m-talk');
    setTimer(setTimeout(()=>{mascotOnce(draw('smile'),'bbc-m-hop',720);setTimer(setTimeout(()=>draw(),1000));},ms));
  }
  // 말풍선 옆 멍이는 마지막 하나(.bbc-live)만 움직인다. 새 말풍선이 오면 이전 것은 남은 전환을 멈추고 멈춘 그림으로.
  let live=null,rowTimer=0;
  function retire(){
    clearTimeout(rowTimer);
    if(!live)return;
    live.classList.remove('bbc-live');
    if(live.isConnected)paint(live,34,live.dataset.state);
    live=null;
  }

  // 멍이를 옮긴 자리(chatbotReadFabPos 형식). PC와 휴대폰은 화면이 달라 따로 기억한다.
  // localStorage를 못 쓰면 이 탭에서만 기억한다(posCache). 창이 작아져 잘린 자리는 저장하지 않는다(다시 키우면 원래 자리).
  const POS_KEY='bbChatFabPos',PANEL={w:360,h:520};
  let posCache=chatbotReadFabPos(store.get(POS_KEY))||{};
  const posMode=()=>mobile()?'mobile':'desktop';
  function savePos(){
    try{if(Object.keys(posCache).length)localStorage.setItem(POS_KEY,JSON.stringify(posCache));else localStorage.removeItem(POS_KEY);}catch{}
  }
  function view(){
    const s=getComputedStyle(safe),n=k=>parseFloat(s['padding'+k])||0,d=document.documentElement;
    return {w:d.clientWidth,h:d.clientHeight,inset:{top:n('Top'),right:n('Right'),bottom:n('Bottom'),left:n('Left')}};
  }
  const fabSize=()=>fab.offsetWidth||48;
  function movedPos(){
    const a=posCache[posMode()];if(!a)return null;
    const v=view(),size=fabSize();return chatbotClampFab(chatbotFabFromAnchor(a,size,v),size,v);
  }
  const clearStyle=(el,keys)=>{for(const k of keys)el.style[k]='';};
  // 옮긴 자리에 버튼을 두고, 안내 말풍선과 (PC에서 열려 있으면) 대화창을 그 옆으로.
  function placeMoved(pos){
    root.classList.add('bbc-moved');
    root.style.setProperty('--bbc-x',pos.x+'px');root.style.setProperty('--bbc-y',pos.y+'px');
    const v=view(),size=fabSize(),right=pos.x+size/2>v.w/2;
    root.classList.toggle('bbc-left',!right);  // 접을 때 밀어 넣는 쪽(chatbotFabAnchor의 h와 같은 기준)
    if(!hint.hidden){
      const side=right?pos.x-18:v.w-pos.x-size-18;
      // 휴대폰(740px 이하)에서 옆 자리가 120px보다 좁으면 버튼 위(아래쪽 절반) 또는 아래(위쪽 절반)로, 버튼과 같은 쪽 끝에 맞춰 띄운다.
      if(phone()&&side<120){
        hint.style.maxWidth=(v.w-32)+'px';
        const hw=hint.offsetWidth,hh=hint.offsetHeight,below=pos.y+size/2<=v.h/2;
        Object.assign(hint.style,{right:'auto',bottom:'auto',left:Math.max(8,Math.min(v.w-8-hw,right?pos.x+size-hw:pos.x))+'px',top:Math.max(8,below?pos.y+size+8:pos.y-8-hh)+'px'});
      }else{
        const room=Math.max(120,side);hint.style.maxWidth=room+'px';
        const hw=hint.offsetWidth,hh=hint.offsetHeight;
        Object.assign(hint.style,{right:'auto',bottom:'auto',left:Math.max(8,right?pos.x-10-hw:pos.x+size+10)+'px',top:Math.max(8,Math.round(pos.y+(size-hh)/2))+'px'});
      }
    }
    if(panel.hidden)return;
    if(mobile()){clearStyle(panel,['left','top','right','bottom','maxHeight']);return;}
    const p=chatbotPanelPlace({x:pos.x,y:pos.y,size},PANEL,v);
    Object.assign(panel.style,{left:p.left+'px',top:p.top+'px',right:'auto',bottom:'auto',maxHeight:p.maxHeight+'px'});
  }
  // 탐색 지도 탭(폭 768px 이상)에서는 버튼과 대화창을 지도 확대/축소 컨트롤 왼쪽에 둔다: 근거 패널과 확대/축소를 가리지 않게.
  // 사용자가 멍이를 옮겼으면 그 자리가 이긴다.
  function place(){
    if(!phone())untuck();  // 창이 넓어지면(741px 이상) 접힘을 바로 푼다: 넓은 화면의 누르기가 펼치기로 먹히지 않게
    reset.hidden=!posCache[posMode()];
    const pos=movedPos();
    if(pos)return placeMoved(pos);
    root.classList.remove('bbc-moved','bbc-left');hookMap();
    clearStyle(hint,['left','top','right','bottom','maxWidth']);clearStyle(panel,['left','top','right','bottom']);
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
    // 휴대폰(767px 이하)에서는 대화창이 화면 아래 시트라 지도 컨트롤 위에 겹쳐도 되므로 줄이지 않는다(2026-10-18, LKH: 시트가 손가락 두 마디로 줄던 원인).
    if(top>p.top&&!mobile())panel.style.maxHeight=Math.max(260,p.bottom-top)+'px';
  }
  function dismissHint(){if(!hint.hidden){hint.hidden=true;store.set(HINT_KEY,'1');}clearTimeout(hintTimer);}
  // 처음 안내 말풍선(2026-10-18, LKH): 첫 화면(지구본)이 닫혀 지도가 보인 뒤 HINT_MS 동안만 보이고 스스로 접힌다. 그 전에 화면을 스크롤하거나
  // 멍이 밖을 누르면 바로 접힌다. 한 번 접히면 다시 보이지 않는다(HINT_KEY). 멍이 버튼은 그대로 남는다.
  const HINT_MS=7000;let hintTimer=0;
  function showHint(){
    hint.hidden=false;place();
    hintTimer=setTimeout(dismissHint,HINT_MS);
    const once={once:true,passive:true};
    addEventListener('scroll',dismissHint,once);
    // 종 카드 줄(#species-list)을 옆으로 넘겨도 바로 접는다(2026-10-25: 휴대폰에서 말풍선이 카드 줄 위에 뜬다). 카드 누르기는 아래 pointerdown이 접는다.
    document.addEventListener('scroll',e=>{if(e.target.id==='species-list')dismissHint();},{capture:true,passive:true});
    document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))dismissHint();},once);
  }
  function hintWhenGateGone(){
    const html=document.documentElement;
    if(!html.classList.contains('gate-on'))return showHint();
    const mo=new MutationObserver(()=>{if(!html.classList.contains('gate-on')){mo.disconnect();showHint();}});
    mo.observe(html,{attributes:true,attributeFilter:['class']});
  }
  // state가 있으면(챗봇 말풍선) 왼쪽 아래 멍이 미니 아바타와 .bbc-row로 묶고 머리말 표정도 바꾼다. 돌려주는 값은 말풍선.
  // 답(answer·ai)과 첫 인사(welcome)는 뜬 직후 머리말과 그 말풍선 옆 멍이가 글 길이만큼 말한다(움직임 줄이기면 안 함).
  function add(cls,text,state){
    const p=document.createElement('div');p.className='bbc-msg '+cls;p.textContent=text;
    if(!state){log.append(p);return p;}
    retire();
    const row=document.createElement('div');row.className='bbc-row bbc-live';row.dataset.state=state;row.innerHTML=chatbotMascot(state,34,true);row.append(p);log.append(row);live=row;
    mood(state);
    if(['welcome','answer','ai'].includes(state)&&!reduced()){
      const ms=Math.min(2400,Math.max(900,text.length*25));
      speak(f=>paint(avatar,40,state,f),t=>{faceTimer=t;},ms);
      speak(f=>paint(row,34,state,f),t=>{rowTimer=t;},ms);
    }
    return p;
  }
  function buttons(list,cls){
    const box=document.createElement('div');box.className='bbc-chips '+(cls||'');
    for(const [id,label] of list){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.faq=id;box.append(b);}
    log.append(box);
  }
  function answer(f){
    const m=add('bbc-bot',fill(f.a),'answer');
    if(f.show){const b=document.createElement('button');b.type='button';b.className='bbc-show';b.textContent='화면에서 보여주기';b.dataset.show=f.id;m.append(b);}
    if(f.next)buttons(f.next.map(id=>[id,byId(id).q[0]]),'bbc-next');
    // 답의 첫 줄이 보이게 올린다(끝까지 내리면 긴 답의 앞부분이 잘림, 2026-10-18)
    const row=m.closest('.bbc-row')||m;
    log.scrollTop=Math.max(0,row.getBoundingClientRect().top-log.getBoundingClientRect().top+log.scrollTop-8);
  }
  // FAQ가 못 찾은 질문: 탭에서 찾아보라는 안내와 세 탭 바로가기(탭 이름은 화면의 버튼 글자). 답을 지어내지 않는다.
  function unknown(){
    add('bbc-bot','아래 탭에서 직접 찾아보거나, 다른 말로 다시 물어봐 주세요.','unknown');
    const box=document.createElement('div');box.className='bbc-chips bbc-tabs';
    for(const [id,what] of CHATBOT_TAB_LINKS){
      const b=document.createElement('button');b.type='button';b.dataset.tab=id;
      b.textContent=chatbotT('{0} 탭 · {1}',{0:document.querySelector(`.tabs button[data-view="${id}"]`)?.textContent.trim()||id,1:what});box.append(b);
    }
    log.append(box);log.scrollTop=log.scrollHeight;
  }
  function goTab(id){
    mood('point',true);if(mobile())close();
    setTimeout(()=>{const b=document.querySelector(`.tabs button[data-view="${id}"]`);if(b&&b.getAttribute('aria-current')!=='page')b.click();scrollTo({top:0,behavior:reduced()?'auto':'smooth'});},0);
  }
  function ask(text,id){
    add('bbc-user',text);
    const f=id?byId(id):chatbotMatch(text);
    if(f)answer(f);else unknown();
  }
  let opening=0;  // 깡충 인사 뒤 창을 열 타이머(F). 기다리는 동안의 누르기·끌기는 무시한다.
  function open(){
    dismissHint();untuck();panel.hidden=false;fab.setAttribute('aria-expanded','true');fab.setAttribute('aria-label','사용법 안내 닫기');fabFace(true);
    if(!log.childElementCount){add('bbc-bot','안녕하세요! 사용법 안내 도우미 멍이예요. 미리 준비한 답으로 이 지도 사용법을 알려드릴게요. 아래에서 고르거나 궁금한 점을 직접 적어 보세요.','welcome');buttons(CHATBOT_STARTERS);}
    place();
    // 2026-10-25 휴대폰(740px 이하): 입력칸에 바로 포커스를 주면 화면 키보드가 올라와 추천 질문을 가린다. 휴대폰에서는 마지막
    // 추천 질문 묶음의 첫 단추(없으면 닫기)로 포커스를 옮기고, 입력칸은 사람이 누를 때 키보드가 뜬다. 넓은 화면은 그대로 입력칸.
    if(matchMedia('(max-width:740px)').matches)([...panel.querySelectorAll('.bbc-chips')].at(-1)?.querySelector('button')||panel.querySelector('.bbc-close'))?.focus();
    else input.focus();
  }
  function close(){clearTimeout(opening);opening=0;panel.hidden=true;fab.setAttribute('aria-expanded','false');fab.setAttribute('aria-label','사용법 안내 열기');fabFace(false);fab.focus();}

  // 기존 버튼을 눌러 이동한 뒤 대상에 잠깐 테두리. 이미 켜진 토글은 다시 누르지 않는다(누르면 꺼지거나 범례가 닫힘).
  // 원래 클릭이 document까지 올라간 뒤 실행해야 ⓘ 범례의 '바깥 클릭이면 닫기'에 걸리지 않는다.
  function show(f){
    if(mobile())close();
    setTimeout(()=>{
      try{
        for(const s of f.show.click){const b=document.querySelector(s);
          if(!b||b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-expanded')==='true'||b.getAttribute('aria-current')==='page')continue;b.click();}
        setTimeout(()=>{
          const t=document.querySelector(f.show.target),fold=t?.closest('#method details');if(fold)fold.open=true; // 근거와 방법: 접힌 설명은 펼친 뒤 보여 준다
          if(!visible(t))return;
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

  // 2026-10-25 휴대폰(740px 이하, 아래 탭바가 있는 폭): 페이지·각 탭의 스크롤 상자·종 카드 줄 가로 스크롤·지도 끌기 동안 버튼을 화면 가장자리로
  // 반쯤 밀어 넣고 흐리게(.bbc-tucked, chatbot.css) 했다가, 멈추고 TUCK_MS 뒤 되돌린다. 크기는 그대로라 누르는 영역(48px)은 같다.
  // 대화창이 열렸거나 끄는 중이거나 키보드 포커스(:focus-visible)가 있으면 접지 않는다. 스크롤마다 레이아웃은 읽지 않는다(한 프레임에 한 번, 클래스만).
  const TUCK_MS=700,phone=()=>matchMedia('(max-width:740px)').matches;
  const still=()=>{try{if(localStorage.getItem('bbvm-reduce-motion')==='1')return true;}catch{}return reduced();};  // '움직임 줄이기'(intro.js)
  let tuckTimer=0,tuckFrame=0,mapMoving=false,pressTucked=false,hookedMap=null;
  const tucked=()=>root.classList.contains('bbc-tucked');
  function untuck(){clearTimeout(tuckTimer);tuckTimer=0;root.classList.remove('bbc-tucked');}
  function tuck(){
    if(tuckFrame)return;
    tuckFrame=requestAnimationFrame(()=>{
      tuckFrame=0;
      if(!phone()||!panel.hidden||opening||drag?.moving||fab.matches(':focus-visible'))return;
      root.classList.toggle('bbc-still',still());root.classList.add('bbc-tucked');
      clearTimeout(tuckTimer);tuckTimer=mapMoving?0:setTimeout(untuck,TUCK_MS);
    });
  }
  // 지도(app.js의 map, 자료를 받은 뒤 생긴다): 끄는 동안 접어 두고, 멈추면(moveend) TUCK_MS 뒤 되돌린다.
  function hookMap(){
    if(typeof map==='undefined'||!map?.on||hookedMap===map)return;
    hookedMap=map;
    map.on('movestart',()=>{mapMoving=true;tuck();});
    map.on('moveend',()=>{mapMoving=false;tuck();});
  }
  document.addEventListener('scroll',e=>{if(!root.contains(e.target))tuck();},{capture:true,passive:true});
  document.addEventListener('pointerdown',hookMap,{capture:true,passive:true});
  fab.addEventListener('focus',()=>{if(fab.matches(':focus-visible'))untuck();});

  // 끌기: Pointer Events로 마우스·손가락·펜을 함께 처리한다. 문턱값(chatbotDragStarted)을 넘기 전에 떼면 보통 누르기.
  // 끌어다 놓은 직후 브라우저가 보내는 click 한 번은 무시한다(키보드 Enter/Space의 click은 detail 0이라 막지 않음, 다음 누르기가 시작되면 해제).
  // Esc나 pointercancel이면 처음 자리로 돌아간다.
  let drag=null,dragEnd=-1e9,frame=0;
  const dragging=on=>{root.classList.toggle('bbc-dragging',on);document.documentElement.classList.toggle('bbc-drag-doc',on);};
  function endDrag(save){
    cancelAnimationFrame(frame);frame=0;dragging(false);
    if(save){const v=view();posCache[posMode()]=chatbotFabAnchor(drag.pos,fabSize(),v);savePos();}
    place();
  }
  fab.addEventListener('pointerdown',e=>{
    if(e.button!==0||!e.isPrimary||opening)return;
    dragEnd=-1e9;  // 새로 누르면 그 뒤 click은 이번 누르기의 것(손가락 끌기는 click을 남기지 않으므로 다음 탭을 먹지 않게)
    pressTucked=tucked()&&phone();
    // 접혀 있으면 밀어 넣은 만큼(transform)을 빼서 원래 자리에서 끌기를 시작한다
    const r=fab.getBoundingClientRect(),t=pressTucked?new DOMMatrixReadOnly(getComputedStyle(fab).transform):null;
    drag={id:e.pointerId,type:e.pointerType,sx:e.clientX,sy:e.clientY,ox:r.left-(t?.m41||0),oy:r.top-(t?.m42||0),moving:false,cancelled:false,pos:null};
    try{fab.setPointerCapture(e.pointerId);}catch{}
  });
  fab.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id||drag.cancelled)return;
    const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
    if(!drag.moving){if(!chatbotDragStarted(dx,dy,drag.type))return;drag.moving=true;untuck();dragging(true);dismissHint();}
    const v=view();drag.pos=chatbotClampFab({x:drag.ox+dx,y:drag.oy+dy},fabSize(),v);
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(drag?.pos&&!drag.cancelled)placeMoved(drag.pos);});
  });
  fab.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(drag.moving||drag.cancelled){dragEnd=performance.now();if(drag.moving&&!drag.cancelled)endDrag(true);}
    drag=null;
  });
  fab.addEventListener('pointercancel',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(drag.moving&&!drag.cancelled)endDrag(false);
    drag=null;
  });
  addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!drag?.moving||drag.cancelled)return;
    e.preventDefault();e.stopPropagation();drag.cancelled=true;endDrag(false);
  },true);
  // 열 때 깡충 인사(F): 버튼 속 멍이가 웃으며 한 번 뛰고, 거의 다 뛴 600ms 뒤 창을 연다. 움직임 줄이기면 바로 연다. 닫기는 바로.
  fab.addEventListener('click',e=>{
    if(e.detail!==0&&performance.now()-dragEnd<700){dragEnd=-1e9;return;}
    if(opening)return;
    // 접힌 버튼을 누르면 먼저 펼치기만 한다. 펼친 뒤 다시 누르면 연다.
    const wasTucked=pressTucked||tucked();pressTucked=false;
    if(wasTucked)return untuck();
    if(!panel.hidden)return close();
    if(reduced())return open();
    fab.innerHTML=chatbotMascot('answer',44,true,'smile');mascotOnce(fab.firstElementChild,'bbc-m-hop',720);
    opening=setTimeout(()=>{opening=0;open();},600);
  });
  reset.addEventListener('click',()=>{delete posCache[posMode()];savePos();place();input.focus();});
  root.querySelector('.bbc-close').addEventListener('click',close);
  root.querySelector('.bbc-hint-x').addEventListener('click',dismissHint);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  root.querySelector('.bbc-form').addEventListener('submit',e=>{e.preventDefault();const t=input.value.trim();if(!t)return;input.value='';ask(t);});
  log.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.show){mood('point',true);show(byId(b.dataset.show));}else if(b.dataset.tab)goTab(b.dataset.tab);else if(b.dataset.faq)ask(b.textContent,b.dataset.faq);
  });
  addEventListener('resize',place);
  // 탭은 탭 버튼 말고도(‘선택 종 비교하기’, ‘근거 보기’ 등) 바뀌므로 #explore의 class 변화를 지켜본다.
  const explore=document.getElementById('explore');
  if(explore)new MutationObserver(()=>requestAnimationFrame(place)).observe(explore,{attributes:true,attributeFilter:['class']});
  addEventListener('load',()=>setTimeout(place,300));
  if(!store.get(HINT_KEY))hintWhenGateGone();
  place();
})();
