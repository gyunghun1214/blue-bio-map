# `verified-4.8` — 참문어 국가 적색목록 쪽 재확인 (2026-10-08)

계기: 2026-10-08 화면 데이터 점검. 국가 평가 기반 MCUI 8종 가운데 참문어만 MCUI 정보충분도가 67%였다.

원인: 국가생물적색자료집 쪽 재확인(`national_red_list.page_recheck`, 2026-09-27)은 그때 점수가 있던 7종의 목록 쪽과 색인 쪽을 다시 읽은 기록이다. 참문어는 2026-10-01 WoRMS 대응 규칙(목록의 *Octopus vulgaris* 행 → 동아시아 종 *O. sinensis*)으로 나중에 들어와, 다시 읽은 기록이 없어 '현행 확인' 단계가 열려 있었다.

## 다시 읽은 쪽 (NIBR 전자책, 2026-10-08)

| 쪽 | 뷰어 쪽 | 읽은 내용 |
|---|---|---|
| 목록 1027쪽 | 1029 | `Octopus vulgaris Cuvier` · 참문어 |
| 찾아보기 1484쪽 | 1486 | 연체동물 · 참문어 · `Octopus vulgaris Cuvier, 1797` · 초판 NT · 개정판 NT · 유지 · 1027 |

대조: 같은 방법으로 굴(뷰어 1373 = 인쇄 1371, *Magallana gigas* 굴)을 읽어 뷰어 쪽 = 인쇄 쪽 + 2를 확인했다. 기록된 값(NT, 1027쪽, 1484쪽)과 다른 곳은 없다.

## 결과

- `page_recheck.rows`에 참문어(534443) 행을 더했다(읽은 날짜와, 2026-09-27 재확인보다 늦게 들어온 사정을 행에 적음).
- 참문어 MCUI 정보충분도 67% → **100%**, 평균 83% → **94%**. 이제 국가 평가 기반 8종이 모두 100%다.
- 점수·범주·라벨·매트릭스 유형·우선 조사 대상은 바뀌지 않는다.

## 재현

- `python scripts/build_verified_indices.py --check` (기본 설정 `config/verified-indices-v4.8.json`)
- 4.7 공개본은 `archive/assessments-verified-4.7.json`, `--config config/verified-indices-v4.7.json`으로 재현.
- 테스트: `Verified48Tests`(참문어 정보충분도만 변화, 점수가 있는 국가 평가 행은 모두 재확인 기록이 있음).

## 함께 정리한 것

- `research/expansion-30/cells-nibr-points-2026-10-01.md`: 시카메굴 표본 채집 지점의 소수 셋째 자리 좌표와 채집자 이름을 공개 1° 셀 범위로 바꿨다(원좌표 미공개 원칙).
