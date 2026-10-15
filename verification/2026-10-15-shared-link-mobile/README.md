# 공유 링크가 휴대폰에서 지도 탭으로 바뀌던 문제 (개선 프롬프트 14/15, 2026-10-15)

## 결론
- 관찰된 증상(휴대폰에서 `#…&v=compare…` 링크를 열었더니 `v=explore`가 되고 `m=`도 바뀜)은 **PR #195 이전 코드**에서 그대로 재현된다.
  이미 지도를 보고 있던 탭에서 링크를 열면 주소의 `#` 뒤만 바뀌고 페이지는 다시 읽히지 않는다. 그때는 이 변화를 듣는 코드가 없어
  지도 화면이 그대로 남았고, 손가락으로 지도를 한 번 움직이면 `moveend → writeHash`가 지금 화면(`v=explore`, 새 `m=`, 이전 종 `s=`)으로
  주소를 덮어썼다. 휴대폰 메신저·브라우저는 링크를 이미 열린 탭에서 여는 일이 잦아서 휴대폰에서 먼저 보였다.
- 화면 폭(반응형 분기)과는 무관하다. 375·768·1440 모두 같은 결과였고, 휴대폰에서 비교 화면을 막는 코드도 없다
  (그래서 "넓은 화면에서 보기 좋아요" 안내는 넣지 않았다).
- PR #195(오늘 오전)가 대부분을 고쳤다. 남은 틈은 하나였다: **첫 화면 지구본이 떠 있는 탭**에서 링크를 열면 탭은 바뀌지만
  지구본이 그 위를 덮고 있었다. 이번 수정으로 그때도 지구본을 바로 건너뛴다(새 탭에서 링크를 연 것과 같음).

## 원인 코드 위치
| 시점 | 파일:줄 | 내용 |
|---|---|---|
| PR #195 이전 (f95fa26) | `dist/app.js:2569` | `readHash`가 `#` 뒤만 읽음 → `?v=compare` 쿼리 링크는 무시 |
| PR #195 이전 | `dist/app.js:3930` | 링크는 첫 로딩 때 한 번만 읽음(`startHash=readHash()`), `hashchange` 리스너 없음 → 열린 탭에서 연 링크 무시 |
| PR #195 이전 | `dist/app.js:3067` | `map.on('moveend',writeHash)` → 지도를 움직이면 `v=explore`·새 `m=`로 주소를 덮어씀 (증상의 `m=` 변화) |
| PR #195 이전 | `dist/intro.js:246` | 지구본 건너뛰기 판단이 `#`만 봄 → 쿼리 링크는 지구본이 덮음 |
| 오늘 main (PR #195 이후) | `dist/intro.js` 지구본 | 열린 탭의 `hashchange`를 지구본이 듣지 않음 → 지구본 화면 탭에서 연 링크는 지구본이 덮음 |

## 이번 수정
- `dist/intro.js:357` 지구본이 떠 있을 때 링크 키(`s v t b m p u`)가 담긴 `hashchange`가 오면 지구본을 바로 닫는다(`fail()`과 같은 정리).
  화면·종·지도 위치는 app.js의 기존 `hashchange` 리스너(`dist/app.js:4086`)가 적용한다.
- `dist/app.js:2678` `linkView(h)`: 링크가 여는 탭(`explore`/`compare`/`method`, 아니면 `null` = 탭 그대로)을 고르는 순수 함수로 꺼냄.
  `applyHash`(`dist/app.js:2699`)가 이것을 쓴다. 동작은 전과 같다.
- 해시 형식은 그대로다. 기존 공유 링크(`#s=…&v=…&b=…&t=…&m=…`, `?v=compare`)는 모두 같은 화면을 연다.
- 데이터·점수는 건드리지 않았다.

## 회귀 테스트
`verification/test_shared_link.mjs` (CI `verify.yml`에 이미 포함):
- 입력 링크 → 기대 탭 11건: `#…v=explore|compare|method…&m=7/35.50/128.00`, `?s=…&v=compare&m=…`, `?offline=1#v=method`,
  `?v=compare#v=method`(해시 우선), `#v=compare`, `v` 없음 → `null`, `v=map`·`v=Compare`·빈 주소 → `null`.
- `applyHash`가 `linkView`가 고른 탭을 연다.
- 지구본이 열린 탭의 `hashchange`로 닫힌다.

## 재현표
Chromium(Playwright, `/opt/pw-browsers/chromium-1194`)에서 375×812(모바일·터치, 안드로이드 UA), 768×1024(터치), 1440×900.
링크 `#s=241776&v=<탭>&b=basic&t=occurrence&m=7/35.50/128.00`. 판정은 2.5초 뒤 보이는 탭, 주소의 `v=`, 지구본 여부.
여는 방법: 새 탭 `#해시` / 그 탭 새로고침 / 새 탭 `?쿼리` / `#v=` 만 / 지구본 화면 탭에서 열기 / 지도 보던 탭에서 열기 / 첫 로딩 중에 열기.

정상 건수: PR #195 이전 39/63, 오늘 main 54/63, 수정 후 **63/63**.
`m=`은 링크에 있으면 63건 모두 `7/35.50/128.00` 그대로 남았다(`#v=`만 있는 링크는 `m=`이 없어 종 범위에 맞춤).

추가 확인(375, 지도 보던 탭에서 비교 링크를 열고 지도를 한 번 움직임):
- PR #195 이전: 보인 화면 `explore`, 주소 `#s=836033&v=explore&…&m=5/34.76/131.15` ← 관찰된 증상과 같음
- 수정 후: 보인 화면 `compare`, 주소 `v=compare` 유지

Safari·삼성 인터넷: 클라우드에는 Chromium만 있어 **확인 불가**. 수정은 표준 `hashchange`·`URLSearchParams`만 쓴다.
발표 전 휴대폰(아이폰 Safari, 갤럭시 삼성 인터넷)으로 심사위원용 링크를 직접 열어 확인할 것.

| 화면 | 여는 방법 | 링크 v | PR #195 이전 | 오늘 main | 수정 후 |
|---|---|---|---|---|---|
| 375 | 새 탭 #해시 | explore | ✅ explore | ✅ explore | ✅ explore |
| 375 | 새로고침 | explore | ✅ explore | ✅ explore | ✅ explore |
| 375 | 새 탭 ?쿼리 | explore | ⚠️ 지구본이 덮음 | ✅ explore | ✅ explore |
| 375 | #v= 만 | explore | ✅ explore | ✅ explore | ✅ explore |
| 375 | 지구본 화면 탭에서 열기 | explore | ⚠️ 지구본이 덮음 | ⚠️ 지구본이 덮음 | ✅ explore |
| 375 | 지도 보던 탭에서 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 375 | 로딩 중에 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 375 | 새 탭 #해시 | compare | ✅ compare | ✅ compare | ✅ compare |
| 375 | 새로고침 | compare | ✅ compare | ✅ compare | ✅ compare |
| 375 | 새 탭 ?쿼리 | compare | ❌ explore (해시도 explore) | ✅ compare | ✅ compare |
| 375 | #v= 만 | compare | ✅ compare | ✅ compare | ✅ compare |
| 375 | 지구본 화면 탭에서 열기 | compare | ❌ explore | ⚠️ 지구본이 덮음 | ✅ compare |
| 375 | 지도 보던 탭에서 열기 | compare | ❌ explore | ✅ compare | ✅ compare |
| 375 | 로딩 중에 열기 | compare | ✅ compare | ✅ compare | ✅ compare |
| 375 | 새 탭 #해시 | method | ✅ method | ✅ method | ✅ method |
| 375 | 새로고침 | method | ✅ method | ✅ method | ✅ method |
| 375 | 새 탭 ?쿼리 | method | ❌ explore (해시도 explore) | ✅ method | ✅ method |
| 375 | #v= 만 | method | ✅ method | ✅ method | ✅ method |
| 375 | 지구본 화면 탭에서 열기 | method | ❌ explore | ⚠️ 지구본이 덮음 | ✅ method |
| 375 | 지도 보던 탭에서 열기 | method | ❌ explore | ✅ method | ✅ method |
| 375 | 로딩 중에 열기 | method | ✅ method | ✅ method | ✅ method |
| 768 | 새 탭 #해시 | explore | ✅ explore | ✅ explore | ✅ explore |
| 768 | 새로고침 | explore | ✅ explore | ✅ explore | ✅ explore |
| 768 | 새 탭 ?쿼리 | explore | ⚠️ 지구본이 덮음 | ✅ explore | ✅ explore |
| 768 | #v= 만 | explore | ✅ explore | ✅ explore | ✅ explore |
| 768 | 지구본 화면 탭에서 열기 | explore | ⚠️ 지구본이 덮음 | ⚠️ 지구본이 덮음 | ✅ explore |
| 768 | 지도 보던 탭에서 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 768 | 로딩 중에 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 768 | 새 탭 #해시 | compare | ✅ compare | ✅ compare | ✅ compare |
| 768 | 새로고침 | compare | ✅ compare | ✅ compare | ✅ compare |
| 768 | 새 탭 ?쿼리 | compare | ❌ explore (해시도 explore) | ✅ compare | ✅ compare |
| 768 | #v= 만 | compare | ✅ compare | ✅ compare | ✅ compare |
| 768 | 지구본 화면 탭에서 열기 | compare | ❌ explore | ⚠️ 지구본이 덮음 | ✅ compare |
| 768 | 지도 보던 탭에서 열기 | compare | ❌ explore | ✅ compare | ✅ compare |
| 768 | 로딩 중에 열기 | compare | ✅ compare | ✅ compare | ✅ compare |
| 768 | 새 탭 #해시 | method | ✅ method | ✅ method | ✅ method |
| 768 | 새로고침 | method | ✅ method | ✅ method | ✅ method |
| 768 | 새 탭 ?쿼리 | method | ❌ explore (해시도 explore) | ✅ method | ✅ method |
| 768 | #v= 만 | method | ✅ method | ✅ method | ✅ method |
| 768 | 지구본 화면 탭에서 열기 | method | ❌ explore | ⚠️ 지구본이 덮음 | ✅ method |
| 768 | 지도 보던 탭에서 열기 | method | ❌ explore | ✅ method | ✅ method |
| 768 | 로딩 중에 열기 | method | ✅ method | ✅ method | ✅ method |
| 1440 | 새 탭 #해시 | explore | ✅ explore | ✅ explore | ✅ explore |
| 1440 | 새로고침 | explore | ✅ explore | ✅ explore | ✅ explore |
| 1440 | 새 탭 ?쿼리 | explore | ⚠️ 지구본이 덮음 | ✅ explore | ✅ explore |
| 1440 | #v= 만 | explore | ✅ explore | ✅ explore | ✅ explore |
| 1440 | 지구본 화면 탭에서 열기 | explore | ⚠️ 지구본이 덮음 | ⚠️ 지구본이 덮음 | ✅ explore |
| 1440 | 지도 보던 탭에서 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 1440 | 로딩 중에 열기 | explore | ✅ explore | ✅ explore | ✅ explore |
| 1440 | 새 탭 #해시 | compare | ✅ compare | ✅ compare | ✅ compare |
| 1440 | 새로고침 | compare | ✅ compare | ✅ compare | ✅ compare |
| 1440 | 새 탭 ?쿼리 | compare | ❌ explore (해시도 explore) | ✅ compare | ✅ compare |
| 1440 | #v= 만 | compare | ✅ compare | ✅ compare | ✅ compare |
| 1440 | 지구본 화면 탭에서 열기 | compare | ❌ explore | ⚠️ 지구본이 덮음 | ✅ compare |
| 1440 | 지도 보던 탭에서 열기 | compare | ❌ explore | ✅ compare | ✅ compare |
| 1440 | 로딩 중에 열기 | compare | ✅ compare | ✅ compare | ✅ compare |
| 1440 | 새 탭 #해시 | method | ✅ method | ✅ method | ✅ method |
| 1440 | 새로고침 | method | ✅ method | ✅ method | ✅ method |
| 1440 | 새 탭 ?쿼리 | method | ❌ explore (해시도 explore) | ✅ method | ✅ method |
| 1440 | #v= 만 | method | ✅ method | ✅ method | ✅ method |
| 1440 | 지구본 화면 탭에서 열기 | method | ❌ explore | ⚠️ 지구본이 덮음 | ✅ method |
| 1440 | 지도 보던 탭에서 열기 | method | ❌ explore | ✅ method | ✅ method |
| 1440 | 로딩 중에 열기 | method | ✅ method | ✅ method | ✅ method |

