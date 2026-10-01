# verified-pilot-3.5: 검수된 근거 행 추가 (2026-10-01)

- 공개 방법: `verified-pilot-3.5` (`config/verified-indices-v3.5.json`, `scripts/build_verified_indices.py`의 기본 설정)
- 이전 방법: `verified-pilot-3.4`. 공개본은 `research/verified-indices/archive/assessments-verified-pilot-3.4.json`에 그대로 보관하고 테스트로 재현한다.
- 규칙, 계수, 임계값, 비교집단, 가중치는 바뀌지 않았다. 바뀐 것은 근거 행뿐이다.

## 1. 가져온 근거

3.x 이전 `main`을 기준으로 만든 두 브랜치의 검수 결과를 3.4 설정 위에 다시 얹었다.

| 출처 | 내용 | 검수 |
|---|---|---|
| `sunny/bbvm-0928-pr2-evidence` (588715c) | 펩타이드 4행: 가시파래 KAF, 가리맛조개 VQY, 큰가리비 VW, 해삼 HDWWKER. 양식 기록 3건: 참조기, 넙치, 꽃게 | 원문을 다시 연 독립 검증자 3명 중 2명 이상 통과. 결정은 `research/followup-decisions/`의 2026-09-28 PR 2 기록과 같다. |
| PR #65 `evidence/papers-20260930` (88f43ef) | 미역 Sato 2002 디펩타이드 7행을 부분 근거에서 점수 사용으로 변경(원문에서 합성품·HHL 확인). 넙치 Ko 2016 MEVFVP·VSQLTR 추가 | 조원 판정(verdict-share, 2026-09-29) 중 통과 행만 사용 |

받아들이지 않은 것은 원 기록대로 제외를 유지했다.
- 해삼 THDWWKER: 단위가 두 가지로 인쇄됐다.
- 해삼 DDQYHIF: 서열이 두 가지로 인쇄됐다.
- Yokoyama 1992 IY: 분리물이며 합성품이 아니다.
- Suetsuna 2004, Himaya 2012: 제외. Chen 2018: 보류.

## 2. 3.4 이전 재현을 지키는 방식

3.1~3.4 설정은 `evidence-v3.json`과 `mfpi-aquaculture-2026-09-30.json`을 읽는다. 이 두 파일을 고치면 과거 공개본의 재현이 깨진다. 그래서 새 근거는 3.5 설정만 읽는 파일에 넣었다.

- `research/verified-indices/evidence-v3.5.json`: `evidence-v3.json`에 위 펩타이드 행과 출처를 더한 사본. `snapshot_date` 2026-10-01.
- `research/verified-indices/mfpi-aquaculture-2026-10-01.json`: 3.3 양식 기록 5건에 3건을 더한 사본.
- 빌더 변경: 펩타이드 보충 파일이 근거 파일보다 늦은 날짜여도 된다. 이때 보고서의 입력 기준일(`generated_at`)이 그 날짜를 따른다. 기존 설정의 파일은 날짜가 같으므로 결과가 같다(2.3·3.1~3.4 보관본 재현 테스트 통과).

## 3. 양식 기록과 3.3 기준

3.3 기준은 "종묘·치어부터 수확까지, 또는 한 양식 철 전체의 양성이 시스템·지역·기간과 함께 기록될 것"이다. 세 기록은 이 기준으로 다시 읽었다.

- 넙치: 완도·제주 육상 수조 양식장 71곳 조사(2023). 충족한다.
- 꽃게: 중국 산둥·저장의 상업 연못 양식. 충족하지만 한국 자료가 아니다. 한국 입지·종묘·비용은 따로 검토해야 한다.
- 참조기: 2세대 양식 어미로 전 주기를 보여 준다. 다만 상업 양식 근거는 인용 없는 서론 한 문장뿐이다. 경계선 사례로 표시하고 기록의 `limitations`에 적었다.

## 4. 결과 (3.4 → 3.5)

| 종 | 축 | 3.4 | 3.5 | 표시 |
|---|---|---|---|---|
| 미역 | MBPI | 19.6 | 71.5 | 참고값(단일 논문). IW 1.5 µM가 최고 항목. 디펩타이드라 종 특이성이 낮다. |
| 해삼 | MBPI | – | 8.7 | 참고값(단일 논문) |
| 가시파래 | MBPI | – | 73.3 | 참고값(단일 논문) |
| 큰가리비 | MBPI | – | 27.3 | 참고값(단일 논문). BBVI는 `mbpi_single_source`로 보류, 참고 통합값 41.8 |
| 가리맛조개(화면 표기 맛조개) | MBPI | – | 56.9 | 참고값(단일 논문) |
| 넙치 | MBPI | – | 29.2 | 참고값(단일 논문). BBVI 보류, 참고 통합값 41.3 |
| 참조기 | MFPI | – | 39.8 | |
| 넙치 | MFPI | – | 53.3 | |
| 꽃게 | MFPI | – | 53.5 | |

산출 종 수는 MFPI 11 → 14, MBPI 8 → 13이다. MCUI 14와 BBVI 1(참굴 80.9)은 그대로다. 새 MBPI가 모두 논문 1편에 기대므로 BBVI와 매트릭스 점은 늘지 않는다. 다른 22종의 네 축 값은 바뀌지 않았다(`VerifiedPilot35Tests`).

## 5. 이번에 하지 않은 것

- 가리맛조개 표시명 변경과 RDA "맛조개" 행(*Solen strictus*)의 비연결 관측 표시. sunny 브랜치에 있었지만 공유 파일(`evidence.json`, `dist/candidate-catalog.json`)을 바꾸므로 과거 공개본 재현과 함께 따로 처리한다. 값에는 영향이 없다.
- MEXT 아연 대체치, CC BY-NC 출현 셀, 해안선 1 km 버퍼: 2026-10-01 팀장 결정에 따라 별도 작업으로 진행한다.

## 재현

```text
PYTHONUTF8=1 python scripts/build_verified_indices.py --check
PYTHONUTF8=1 python scripts/build_matrix_readiness.py --check
PYTHONUTF8=1 python -m unittest discover -s verification -p 'test_*.py'
```
