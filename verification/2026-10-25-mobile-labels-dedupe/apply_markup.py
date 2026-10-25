"""2026-10-25 휴대폰 반복 설명 정리: index.html에 class · id · 링크(.see-also)만 더한다(글자는 그대로).
한 번만 돌린다. 각 바꿈은 원문에 정확히 한 번 있어야 하고, 바꾼 뒤 각 요소의 글자(textContent)가 같아야 한다.
  python verification/2026-10-25-mobile-labels-dedupe/apply_markup.py
"""
import pathlib, re, sys
P = pathlib.Path(__file__).resolve().parents[2] / 'dist' / 'index.html'
s = P.read_text(encoding='utf-8')
SEE = lambda key, label: f'<button type="button" class="see-also" data-see="{key}" aria-label="{label}"></button>'
TO_METHOD, TO_MAP = '근거와 방법에서 자세히 보기', '지도 읽는 법 보기'
EDITS = [
    # 비교와 지표 '읽는 법': 두 축을 따로 보는 이유(두 문장) → 근거와 방법 2×2 카드
    ('<h3>두 축을 따로 보는 이유</h3><p>활용 가능성이 높아도',
     '<h3>두 축을 따로 보는 이유</h3><p class="dup-m">활용 가능성이 높아도'),
    ('가려지지 않도록 분리합니다.</p><div class="rule">',
     '가려지지 않도록 분리합니다.</p>' + SEE('mt-quad-card', TO_METHOD) + '<div class="rule">'),
    # 비교와 지표 '읽는 법': 쉬운 이름과 유형 → 근거와 방법 '유형과 셀 색'
    ('<p class="cmp-read-plain">쉬운 이름은 두 값이 탐색용 기준선 50 위인지 아래인지를 읽은 것이고, 유형은 연구 순서를 고르기 위한 분류입니다.</p>',
     '<p class="cmp-read-plain dup-m">쉬운 이름은 두 값이 탐색용 기준선 50 위인지 아래인지를 읽은 것이고, 유형은 연구 순서를 고르기 위한 분류입니다.</p>' + SEE('mt-types-note', TO_METHOD)),
    # 비교와 지표 가중치 설명: 공식값 0.50 고정 문장 → 근거와 방법 03 '규칙 고정'
    ('두 근거의 비중을 바꿔 봅니다. 공식 산출값은 w = 0.50으로 고정입니다. 두 축이 모두',
     '두 근거의 비중을 바꿔 봅니다. <span class="dup-m">공식 산출값은 w = 0.50으로 고정입니다.</span> 두 축이 모두'),
    ('비교집단은 고정됩니다.</p></div><dl class="cmp-basis-moves">',
     '비교집단은 고정됩니다.</p>' + SEE('method-03', TO_METHOD) + '</div><dl class="cmp-basis-moves">'),
    # 탐색 지도 시트 안(한 화면 안 반복): 범례 문단과 '색의 의미'의 같은 두 문장 → 시트에서 뒤에 오는 쪽을 숨김(mobile-dedupe.css)
    ('<span>셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.</span>',
     '<span class="dup-sheet">셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.</span>'),
    ('지표는 종 단위로 봅니다. 셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.</p>',
     '지표는 종 단위로 봅니다. <span class="dup-sheet">셀 색은 바다 부분에만 칠합니다. 4° 셀은 민감종 보호를 위해 넓게 공개한 범위로, 테두리만 표시합니다.</span></p>'),
    # 근거와 방법 '자료를 읽을 때': 지도 표시 규칙(기록 수 · 붉은 점 · 바다만 칠함 · 버블) → 탐색 지도 '지도 읽는 법' 시트
    ('<ul class="large-list"><li>기록 수 = 공개 관측 기록 건수입니다.</li>',
     '<ul class="large-list"><li class="dup-m">기록 수 = 공개 관측 기록 건수입니다.</li>'),
    ('<li>지도의 붉은 점은 공개 셀 안에 고정한 도식적 무늬로, 기록이 있는 칸의 위치(넓게 묶음)를 보여 줍니다. 점은 바다 부분에만 찍습니다.</li></ul>',
     '<li class="dup-m">지도의 붉은 점은 공개 셀 안에 고정한 도식적 무늬로, 기록이 있는 칸의 위치(넓게 묶음)를 보여 줍니다. 점은 바다 부분에만 찍습니다.</li></ul>' + SEE('map-guide', TO_MAP)),
    ('<li>공개 셀은 Natural Earth 1:10m 육지 경계로 바다 부분만 칠합니다.</li>',
     '<li class="dup-m">공개 셀은 Natural Earth 1:10m 육지 경계로 바다 부분만 칠합니다.</li>'),
    ('<li>축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시입니다.',
     '<li class="dup-m">축소한 지도의 붉은 버블은 공개 셀을 해역별로 묶은 표시입니다.'),
    # 링크 대상 id(기존 id는 그대로, 없던 곳에만)
    ('<div class="mt-quad-card" data-node="quad">', '<div class="mt-quad-card" id="mt-quad-card" data-node="quad">'),
    ('<p class="fine">종 단위 유형입니다. <span class="mc-rest" id="mc-rest-types">', '<p class="fine" id="mt-types-note">종 단위 유형입니다. <span class="mc-rest" id="mc-rest-types">'),
]
text = lambda h: re.sub(r'<[^>]+>', '', h)
before = text(s)
for old, new in EDITS:
    n = s.count(old)
    if n != 1:
        sys.exit(f'expected once, found {n}: {old[:70]}')
    assert text(old) == text(new), old[:60]
    s = s.replace(old, new)
assert text(s) == before
P.write_text(s, encoding='utf-8', newline='\n')
print(f'{len(EDITS)} edits, text unchanged')
