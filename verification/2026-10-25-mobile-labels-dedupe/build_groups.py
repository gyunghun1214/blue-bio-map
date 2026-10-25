"""dedupe-groups.json 만들기(B1): 지침 '배경' 표의 여덟 묶음 + group.mjs가 찾은 묶음, 그리고 각 묶음의 처리.
  node verification/2026-10-25-mobile-labels-dedupe/scan.mjs tmp/scan-390.json      (dist를 8765에 띄운 main 기준 사본에서)
  node verification/2026-10-25-mobile-labels-dedupe/group.mjs tmp/scan-390.json > tmp/groups-raw.json
  python verification/2026-10-25-mobile-labels-dedupe/build_groups.py tmp/groups-raw.json
checks는 uicheck.mjs가 390px 한국어 화면에서 본다: screen의 보이는 글(innerText)에 phrase가 나오는 횟수 = n (">=1"은 1 이상).
screen: explore(지도 탭, 시트 닫힘) · sheet-occ(출현 기록 보기에서 연 '지도 읽는 법' 시트) · sheet-value(활용 × 보전 보기에서 연 시트) ·
compare(비교와 지표, '읽는 법'과 '비교 기준' 팝업을 연 채) · method(근거와 방법, 01~04와 접는 칸을 모두 연 채)
"""
import json, pathlib, sys
HERE = pathlib.Path(__file__).resolve().parent
raw = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')) if len(sys.argv) > 1 else []

G = [
 dict(id='cell-4deg', title='4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시', kind='한 화면 안(지도 시트)',
      places=[dict(screen='explore 시트', selector='.map-legend-more>span.dup-sheet', text='셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.'),
              dict(screen='explore 시트', selector='.legend-why>p>span.dup-sheet', text='셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.')],
      base='탐색 지도 \'지도 읽는 법\' 시트', treatment='화면 안 숨김(시트에서 뒤에 오는 쪽)',
      reason="시트는 출현 기록 보기에서 'ⓘ 범례' → '색의 의미', 활용 × 보전 보기에서 유형 범례('색의 의미') → 'ⓘ 범례' 순으로 담는다. 보기마다 뒤 것을 숨긴다. 근거와 방법에는 같은 문장이 없다(국가 시스템 표의 '1°·4° 격자'는 다른 뜻). 지도 위 칩 '4° 공개 셀 · 민감종 보호로 넓게 공개 (테두리만)'은 app.js가 그리는 짧은 칩이라 그대로.",
      checks=[dict(screen='sheet-occ', phrase='4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.', n=1),
              dict(screen='sheet-value', phrase='4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.', n=1)]),
 dict(id='sea-only', title='셀 색은 바다 부분에만 칠함', kind='한 화면 안 + 탭 사이',
      places=[dict(screen='explore 시트', selector='.map-legend-more>span.dup-sheet · .legend-why>p>span.dup-sheet', text='셀 색은 바다 부분에만 칠합니다.'),
              dict(screen='method', selector='.method-bottom details.mc-more li.dup-m', text='공개 셀은 Natural Earth 1:10m 육지 경계로 바다 부분만 칠합니다.')],
      base='탐색 지도 \'지도 읽는 법\' 시트', treatment='화면 안 숨김 + 탭 사이 숨김·링크(근거와 방법 → 지도 읽는 법 보기)',
      reason='지도 표시 규칙이라 기준 위치는 지도 시트.',
      checks=[dict(screen='sheet-occ', phrase='셀 색은 바다 부분에만 칠합니다.', n=1), dict(screen='sheet-value', phrase='셀 색은 바다 부분에만 칠합니다.', n=1),
              dict(screen='method', phrase='육지 경계로 바다 부분만 칠합니다.', n=0)]),
 dict(id='red-dots', title='붉은 점 = 기록이 있는 칸의 위치(넓게 묶음)', kind='탭 사이(지도 범례 안 반복은 app.js 글)',
      places=[dict(screen='explore 시트', selector='.map-legend-more>small.key-note', text='점 = 기록이 있는 칸의 위치(넓게 묶음) · 기록 수 = 공개 관측 기록 건수'),
              dict(screen='explore', selector='#map-symbol-label (app.js)', text='점 = 기록 수 구간(도식) 기록이 있는 칸의 위치(넓게 묶음)'),
              dict(screen='explore 시트', selector='#map-review-note (app.js)', text='붉은 점은 공개 셀의 도식적 표시입니다(기록이 있는 칸의 위치, 넓게 묶음).'),
              dict(screen='explore', selector='#map-legend-note (정적 글은 app.js가 바로 덮어씀)', text='붉은 점 = 기록이 있는 칸의 위치(넓게 묶음)'),
              dict(screen='method', selector='.method-bottom li.dup-m', text='지도의 붉은 점은 공개 셀 안에 고정한 도식적 무늬로, 기록이 있는 칸의 위치(넓게 묶음)를 보여 줍니다. 점은 바다 부분에만 찍습니다.')],
      base='탐색 지도 \'지도 읽는 법\' 시트', treatment='탭 사이 숨김·링크(근거와 방법 → 지도 읽는 법 보기)',
      reason="지도 범례 안의 세 번 중 둘(#map-symbol-label 칩, #map-review-note)은 app.js가 그리는 글이라 범위 밖. #map-legend-note의 정적 글은 화면에 나오기 전에 app.js가 바꾼다. 남은 정적 범례 줄(.key-note)은 버블 줄 바로 아래의 한 줄 범례라 규칙 3으로 둔다.",
      checks=[dict(screen='method', phrase='지도의 붉은 점은 공개 셀 안에 고정한 도식적 무늬로', n=0),
              dict(screen='sheet-occ', phrase='점 = 기록이 있는 칸의 위치(넓게 묶음)', n='>=1')]),
 dict(id='record-count', title='기록 수 = 공개 관측 기록 건수', kind='탭 사이',
      places=[dict(screen='explore 시트', selector='.map-legend-more>small.key-note', text='기록 수 = 공개 관측 기록 건수'),
              dict(screen='method', selector='.method-bottom li.dup-m', text='기록 수 = 공개 관측 기록 건수입니다.')],
      base='탐색 지도 \'지도 읽는 법\' 시트', treatment='탭 사이 숨김·링크(근거와 방법 → 지도 읽는 법 보기)',
      reason="시트 안에서는 #map-review-note(app.js)에도 같은 말이 있어 두 번 나온다(범위 밖).",
      checks=[dict(screen='method', phrase='기록 수 = 공개 관측 기록 건수입니다.', n=0),
              dict(screen='sheet-occ', phrase='기록 수 = 공개 관측 기록 건수', n='>=1')]),
 dict(id='bubbles', title='축소한 지도의 붉은 버블 = 공개 셀을 해역별로 묶음', kind='탭 사이',
      places=[dict(screen='explore 시트', selector='#map-legend-note (app.js)', text='축소한 지도에서는 칸을 해역별 버블로 묶어 먼저 보여 줍니다. …'),
              dict(screen='explore 시트', selector='.map-legend-more .key-bubble', text='큰 버블 = 공개 셀 묶음 · 숫자 = 셀 수'),
              dict(screen='method', selector='.method-bottom details.mc-more li.dup-m', text='축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시입니다. 크기는 모인 셀 수, 진하기는 셀당 기록 수 구간입니다. 확대하면 셀별 붉은 점이 나옵니다. 선택 종의 기록 셀 수·기록 수·연도는 지도 위 칩에 한 번만 적습니다.')],
      base='탐색 지도 \'지도 읽는 법\' 시트', treatment='탭 사이 숨김·링크(근거와 방법 → 지도 읽는 법 보기)',
      reason="지침 B2 표의 '버블'. 같은 덩어리('자료를 읽을 때')의 다른 숨김과 링크 하나를 같이 쓴다.",
      checks=[dict(screen='method', phrase='축소한 지도의 붉은 버블은', n=0), dict(screen='sheet-occ', phrase='큰 버블 = 공개 셀 묶음', n='>=1')]),
 dict(id='plain-names', title='쉬운 이름은 기준선 50 위·아래를 읽은 것, 유형은 연구 순서를 고르기 위한 분류', kind='탭 사이',
      places=[dict(screen='compare', selector="#cmp-read-pop p.cmp-read-plain.dup-m", text='쉬운 이름은 두 값이 탐색용 기준선 50 위인지 아래인지를 읽은 것이고, 유형은 연구 순서를 고르기 위한 분류입니다.'),
              dict(screen='method', selector='#mt-types-note #mc-rest-types', text="‘활용 지표 높음’ 같은 앞의 짧은 말은 두 지표가 탐색용 기준선 위인지 아래인지를 읽은 것이고, 유형은 연구 순서를 고르기 위한 분류입니다.")],
      base="근거와 방법 '유형과 셀 색'", treatment="탭 사이 숨김·링크(비교와 지표 → 근거와 방법 '유형과 셀 색', 접힌 문단을 편다)",
      reason='한 문장이지만 그래프 옆 라벨이 아닌 설명 문단이고, 지침 배경 표에 있는 묶음이다.',
      checks=[dict(screen='compare', phrase='쉬운 이름은 두 값이 탐색용 기준선 50 위인지 아래인지를', n=0),
              dict(screen='method', phrase='앞의 짧은 말은 두 지표가 탐색용 기준선 위인지 아래인지를 읽은 것이고', n=1)]),
 dict(id='two-axes', title='두 축(활용·보전)은 더하지 않고 따로 봄', kind='탭 사이',
      places=[dict(screen='compare', selector='#cmp-read-pop .matrix-explanation>p.dup-m', text='활용 가능성이 높아도 보전이 필요할 수 있습니다. 두 값을 합쳐 위험이 가려지지 않도록 분리합니다.'),
              dict(screen='compare', selector="#cmp-read-pop ul.cmp-read-more li (둘째)", text='두 값은 따로 봅니다 · 점 색은 유형입니다 · 자원 감소 신호로 정한 MCUI는 숫자 옆 괄호와 점 툴팁에 적습니다'),
              dict(screen='compare', selector='.cmp-limit', text='두 축은 따로 봅니다 · 점 위치가 곧 판단입니다'),
              dict(screen='method', selector='.mt-flow 흐름도(aria-label) · #mt-quad-card · .mt-panel-foot', text='활용가치와 보전 시급성. 독립된 두 축으로 함께 읽습니다.'),
              dict(screen='method', selector='.mt-strengths li (TWO PERSPECTIVES 카드)', text='두 축으로 연구 방향을 살펴봅니다.'),
              dict(screen='explore 시트(활용 × 보전)', selector='#value-legend .value-lead', text='두 지수는 따로 봅니다. 셀 색은 그 칸에 기록된 종의 유형입니다.')],
      base='근거와 방법 2×2 카드(#mt-quad-card)', treatment="탭 사이 숨김·링크(비교와 지표 '두 축을 따로 보는 이유' 문단 → 근거와 방법 2×2 카드)",
      reason="비교와 지표의 두 문장 설명 문단만 숨긴다. '읽는 법' 목록 둘째 줄은 일부만 겹쳐서(규칙 5), 그래프 아래 줄 · 흐름도 · 2×2 아래 줄 · 유형 범례 첫 줄은 그래프·범례 옆 한 줄이라(규칙 3), 근거와 방법 TWO PERSPECTIVES 카드는 한 줄 카드라 그대로.",
      checks=[dict(screen='compare', phrase='두 값을 합쳐 위험이 가려지지 않도록 분리합니다.', n=0),
              dict(screen='compare', phrase='두 축은 따로 봅니다 · 점 위치가 곧 판단입니다', n=1),
              dict(screen='method', phrase='독립된 두 축으로 함께 읽습니다.', n=1)]),
 dict(id='mcui-brackets', title="MCUI 숫자 옆 괄호 = 그 값을 정한 범주, '어획량 감소' 표시", kind='탭 사이',
      places=[dict(screen='compare', selector='#cmp-read-pop ul.cmp-read-more li (첫째)', text='MCUI 숫자 옆 괄호는 그 값을 정한 범주입니다(예: 10 (LC), 60 (LC + 어획량 감소)) · 같은 점수는 이름 가나다순'),
              dict(screen='compare', selector='#cmp-read-pop ul.cmp-read-more li (둘째)', text='… · 자원 감소 신호로 정한 MCUI는 숫자 옆 괄호와 점 툴팁에 적습니다'),
              dict(screen='compare', selector='#matrix-note (app.js)', text="KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘어획량 감소’로 적습니다."),
              dict(screen='method', selector=".method-bottom details.mc-more li ('매트릭스 점 색은…')", text="자원 감소 신호(KOSIS 어획량 추세)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘어획량 감소’로 적습니다.")],
      base="근거와 방법 '자료를 읽을 때'", treatment='그대로 둠',
      reason="비교와 지표 '읽는 법' 목록 두 줄은 다른 내용(같은 점수 순서, 점 색, 툴팁)과 ' · '로 이어진 한 항목이라 일부만 겹친다(규칙 5: 마크업을 쪼개지 않는다). 같은 탭의 #matrix-note는 app.js 글(범위 밖).",
      checks=[]),
 dict(id='weight-050', title='공식 가중치 w = 0.50 고정, 슬라이더는 탐색용', kind='탭 사이',
      places=[dict(screen='compare', selector='#bbvi-weight-help>span.dup-m', text='공식 산출값은 w = 0.50으로 고정입니다.'),
              dict(screen='method', selector="#method-03 li 'BBVI 가중치'", text="공식 산출은 w = 0.50 고정입니다. ‘비교와 지표’의 가중치 슬라이더는 이용 목적별 탐색용이며, …"),
              dict(screen='method', selector='.mt-ix.bbvi .mt-ix-w', text='공식 가중치 w = 0.50')],
      base="근거와 방법 03 '규칙 고정'", treatment="탭 사이 숨김·링크(비교와 지표 '비교 기준' 팝업 → 근거와 방법 03, 첫 항목의 접는 칸을 편다)",
      reason="비교와 지표 설명 문단에서 그 문장만 span으로 감쌌다. 슬라이더 옆 '공식 0.50' 눈금 · '공식값 0.50으로' 단추 · 흐름도 BBVI 상자의 '공식 가중치 w = 0.50'은 그래프·조작 옆 짧은 라벨이라 그대로.",
      checks=[dict(screen='compare', phrase='공식 산출값은 w = 0.50으로 고정입니다.', n=0),
              dict(screen='method', phrase='공식 산출은 w = 0.50 고정입니다.', n=1)]),
]
# group.mjs가 더 찾은 묶음: 모두 '그대로 둠'(이유 붙임)
def reason_for(g):
    sels = ' '.join(x['sel'] for x in g)
    t = ' '.join(x['sentence'] for x in g)
    if '4° 셀은' in t or '바다 부분에만 칠합니다' in t:
        return None  # groups의 cell-4deg · sea-only
    if 'all-sources' in sels or 'source-area' in sels or 'tr>td>div>ul>li' in sels:
        return '출처 이름(데이터셋·문헌 제목) 목록: 같은 출처가 종 상세와 전체 출처 목록에 나오는 것은 자료 표기라 그대로'
    if 'stock-decline' in sels or 'dt-x' in sels or 'cmp-more' in sels or 'sr-only' in sels or 'ax-aux' in sels:
        return 'app.js가 그리는 종별 근거(자원 감소 신호 · 비교 표 펼침)라 범위 밖'
    if 'latin' in sels or 'species-card' in sels or 'cmp-row>th' in sels:
        return '학명 · 종 카드: 자료 값이라 그대로'
    if 'mt-ck' in sels:
        return '근거와 방법 04 검증 기록 표의 기록 파일 이름(행마다 자기 기록): 자료 표기라 그대로'
    if 'gate-next-cost' in sels:
        return '첫 화면 다음 단계의 운영비 줄: operations.js가 그리는 글이라 범위 밖'
    if 'gate-lockup' in sels or 'gate-brand' in sels or 'mt-nat-table' in sels:
        return '사이트 이름'
    if 'v-selected' in sels:
        return 'app.js가 상태에 따라 하나만 보이는 안내(보기마다 하나)'
    if 'matrix-note' in sels:
        return "app.js 글(#matrix-note)이라 범위 밖. 근거와 방법 '자료를 읽을 때'가 기준 위치(그대로 보임)"
    if 'cmp-type' in sels or 'mt-h-' in sels or 'type-table' in sels or 'cp-typeline' in sels or 'ax-type' in sels or 'sp-type' in sels:
        return '유형 이름(쉬운 이름 · 공식 유형 이름) 라벨: 화면마다 필요한 이름이라 그대로'
    return '그대로'
auto = []
for g in raw:
    places = []
    seen = set()
    for x in g:
        k = (x['view'], x['sel'], x['sentence'])
        if k in seen:
            continue
        seen.add(k)
        places.append(dict(screen=x['view'], selector=x['sel'], text=x['sentence'], visible_first=x['visibleFirst']))
    if len(places) > 40:
        places = places[:3] + [dict(note=f'… 같은 문장 {len(places) - 3}곳 더')]
    r = reason_for(g)
    auto.append(dict(places=places, treatment='그대로 둠', reason=r) if r else dict(places=places, treatment="groups의 'cell-4deg' · 'sea-only'로 처리"))
out = dict(made='2026-10-25', width=390, lang='ko',
           how='scan.mjs(390px, 접힌 곳까지 연 상태) → group.mjs(문장 단위, 같은 문장 · 2-gram 자카드 0.75 이상 · 20자 이상). 지침 배경 표의 여덟 묶음은 뜻이 같아도 글자가 달라 자동으로 다 잡히지 않아 손으로 묶었다(groups). auto_groups는 자동으로 잡힌 나머지와 그 처리.',
           groups=G, auto_groups=auto)
(HERE / 'dedupe-groups.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(len(G), 'groups,', len(auto), 'auto groups')
