# `verified-4.6` — 지방 적색목록 MCUI의 정보충분도 단계 (2026-10-08)

계기: 2026-10-08 데이터 점검. 4.2부터 점수가 된 지방(현·주) 적색목록 MCUI가 정보충분도 계산에서 IUCN 단계로 떨어져, MCUI 값이 있는데도 화면에 'MCUI 0%'로 보였다.

결과: **점수·라벨·매트릭스 유형·우선 조사 대상은 하나도 바뀌지 않는다.** 바뀐 것은 지방 목록 기반 MCUI 4종의 정보충분도뿐이다.

## 1. 규칙

`unexplored_candidates.subnational_mcui_sufficiency`(빌더 `scripts/build_verified_indices.py`): `mcui_basis`가 `sub_national`이면 MCUI 세 단계를 그 MCUI를 준 지방 목록 행에서 읽는다. 서식국 국가 목록(3.14 이후)과 같은 방식이다.

| 단계 | 읽는 곳 |
|---|---|
| assessment_record | 검수한 지방 목록 행. 빌더는 원문 확인(`verified_in_original`)·종 단위·검수 완료 행만 받는다 |
| numeric_category | 고른 범주(여러 지역은 중앙값)가 `conservation.category_scores`에 있음 |
| current_check | 행마다 그 지방의 현행판임. 4.2 사전 등록 자격 2(`prereg-subnational-mcui-2026-10-04.md`)를 통과한 행만 쓴다 |

자체 예비평가(Rapid LC, `preliminary`)는 공식 평가가 아니므로 지금처럼 단계가 열린 채(0%) 남는다.

## 2. 바뀐 값

| 종 | MCUI | MCUI 정보충분도 | 평균 정보충분도 |
|---|---|---|---|
| 미역 | 80.0 (연해주 EN) | 0% → **100%** | 67% → **100%** |
| 톳 | 60.0 (이시카와·오키나와 VU) | 0% → **100%** | 61% → **94%** |
| 청각 | 35.0 (이바라키 NT) | 0% → **100%** | 61% → **94%** |
| 꽃게 | 35.0 (후쿠오카 NT) | 0% → **100%** | 67% → **100%** |

우선 조사 대상은 4.5에도 0종(가장 낮은 평균 61% > 기준 50%)이라 그대로다.

## 3. 재현

- `python scripts/build_verified_indices.py --check` (기본 설정 `config/verified-indices-v4.6.json`)
- 4.5 공개본은 `archive/assessments-verified-4.5.json`에 보관하고 `--config config/verified-indices-v4.5.json`으로 바이트 단위 재현한다(새 규칙은 4.6 설정에서만 켜진다).
- 테스트: `verification/test_verified_indices.py`의 `Verified46Tests`(4종만 바뀌고 점수·플래그 불변, Rapid LC는 열린 채).
- `dist/unexplored-candidates.json`은 `reportVersion`만 4.6으로 바꿨다. 내용은 BBVI ≥ 50 근연종에만 의존하고 BBVI가 그대로라 다시 만들어도 같다.
