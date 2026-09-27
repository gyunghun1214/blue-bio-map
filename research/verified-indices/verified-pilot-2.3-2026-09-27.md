# verified-pilot-2.3: 다른 기원 효능 재현 규칙 공개 (2026-09-27)

- 공개 방법: `verified-pilot-2.3` (`config/verified-indices-v2.3.json`, `scripts/build_verified_indices.py`의 기본 설정).
- 이전 방법: `verified-pilot-2.2` (`config/verified-indices-v2.2.json`, 파일은 그대로 두고 테스트로 계속 검증한다).
- 결정: 팀 결정 B (2026-09-27). 연구 규칙 `config/verified-indices-research-xo-potency.json`의 `peptide_bioactivity.cross_origin_potency`를 **같은 값으로** 공개 정의에 넣었다.
- 상태: 검증 전 시범 지표(`provisional_unvalidated`). 타당성 검증을 거치지 않았다.

## 1. 바꾼 이유

2.2에서 참굴 MBPI 최고 항목은 LQP(Do et al. 2012, IC50 1.18 µM, HHL)였다. 이 항목을 뒷받침하는 논문은 Do 2012 한 편뿐이었다. 그래서 근거 계수 0.75를 적용해 MBPI는 72.2였고, "참고값(단일 논문)" 표시를 붙였다. BBVI는 `mbpi_single_source`로 보류했다.

2.2 규칙은 두 번째 논문도 **참굴 재료에서** LQP를 동정해야 독립 재현으로 인정했다. 조사 가능한 문헌에서는 그런 논문을 찾지 못했다(아래 5절). 반면 같은 서열의 **합성 LQP**를 다른 연구진이 같은 조건(ACE, IC50, 기질 HHL, µM, 본문 숫자)으로 잰 논문은 있었다. Miyoshi et al. 1991은 옥수수 α-제인 분해물 연구이며 DOI는 10.1271/bbb1961.55.1313이다. 이 논문의 합성 LQP IC50은 2.0 µM이다. pIC50은 5.699로, Do 2012의 5.928과 0.229 차이다.

합성 펩타이드의 효능은 원재료와 관계없이 서열로 정해진다. 그래서 이 측정은 "LQP가 이 정도로 ACE를 억제한다"는 **효능 주장**을 독립적으로 재현한다. 다만 "참굴에서 LQP가 나온다"는 **기원 주장**은 재현하지 않는다. 2.3은 효능 재현만 독립 DOI로 센다. 기원 근거는 따로 표시하고, 한계로 화면에 밝힌다.

## 2. 2.2와의 차이

| 항목 | 2.2 | 2.3 |
|---|---|---|
| 항목 단위 `(기원종, 서열)` | 같음 | 같음 |
| 종의 값(pIC50) | 기원종 행의 중앙값 | 같음. 재현 값은 종의 값에 섞지 않는다 |
| DOI 계수(단일 0.75 / 복수 1.0) | 기원종 논문의 DOI 수 | `independent_dois` 수 = 기원종 논문 DOI ∪ 인정된 효능 재현 DOI |
| BBVI 독립 조건(`minimum_independent_mbpi_dois` 2) | 기원종 논문 DOI만 | 위의 `independent_dois` |
| 효능 재현 인정 조건 | 없음 | 합성 펩타이드, 같은 서열, ACE·IC50·HHL·µM, 본문에 숫자, 기원종 값과 pIC50 차이 1.0 이하, 기원종 논문과 다른 DOI |
| 새 종·새 항목 | – | 만들지 않는다. 재현 행은 항목의 `potency_replications`에만 기록된다 |

설정 차이는 `peptide_bioactivity.cross_origin_potency` 한 블록과 `method_version`·`status`·`changes_from`뿐이다. 나머지 규칙·계수·비교집단·임계값은 2.2와 같다. 참굴 전용 예외는 없다. 테스트 `VerifiedPilot23Tests.test_public_rule_matches_research_config`가 이를 확인한다.

화면(`dist/app.js`, 자산 버전 0.3.33)은 다음을 보여 준다.

- 인정된 재현 행: 합성 서열·값, 다른 기원, pIC50 차이, 출처·DOI·이용조건·조회일, "효능만 재현하며 기원 근거나 점수 값이 되지 않습니다".
- 집계 줄: "독립 DOI 2편(기원 1 + 효능 재현 1)".
- 한계 줄: "효능 재현은 다른 기원의 합성 펩타이드 측정이고, 이 종에서 LQP가 나온다는 기원 근거는 Do et al. 2012 1편뿐입니다."
- 화면은 보고서를 다시 검사한다. `independent_dois`가 기원 DOI와 인정된 재현 DOI의 합집합과 다르거나, 재현 출처가 종 출처 목록에 없으면 MBPI를 기술 오류로 숨긴다.

## 3. 바뀐 값

| 종 | 2.2 | 2.3 |
|---|---|---|
| 참굴 (836033) MBPI | 72.2 · 참고값(단일 논문) (백분위 96.31 × 0.75) | **96.3** (백분위 96.31 × 1.0), 참고값 표시 없음 |
| 참굴 BBVI | 보류(`mbpi_single_source`), 참고 통합값 표시 | **80.9** (w 0.25/0.5/0.75 → 88.6/80.9/73.2), 참고 통합값 없음 |
| 참굴 MFPI·MCUI | 65.5 · 10.0(한국 국가 평가) | 같음 |
| 나머지 29종 | – | 점수·보류 사유·표시·참고 통합값·민감도가 2.2와 같다 |

`VerifiedPilot23Tests.test_only_oyster_scores_differ_from_22`가 30종 전체를 2.2 설정 산출과 비교해 이를 고정한다.

미역(145721)은 MBPI 19.6, BBVI 보류로 그대로다. KNFL의 다른 논문(Feng et al.)은 같은 연구진의 결합 연구이고, 다른 기원에서 잰 합성 측정이 없다. 미역의 추적 기록에는 `independent_dois`와 빈 `potency_replications`가 새로 생겼지만, 점수와 표시는 바뀌지 않았다. 감태(371986) MBPI 67.5는 저분자 층이라 이 규칙과 무관하다.

**매트릭스**: 참굴 MCUI는 한국 국가 평가라 IUCN 매트릭스에 놓지 않는다. `dist/matrix-readiness.json`의 매트릭스 점은 0개 그대로다. 우선 조사 목록의 참굴 항목은 "MCUI 한국 국가 평가 · IUCN 매트릭스 제외"를 표시한다. BBVI가 산출된 종은 1종(참굴)이 되어 화면의 가중치 조절 막대가 켜진다. 축 쌍 보기에서 "BBVI × MCUI(한국 국가 평가 기반)" 묶음에 참굴 1종이 들어간다. IUCN 기반 묶음과는 섞지 않는다.

## 4. 한계

- **기원 근거는 여전히 한 편이다.** 참굴에서 LQP를 동정한 논문은 Do 2012뿐이다. 이 논문이 틀렸다면(서열 오동정, 오염 등) 효능 재현은 참굴과 무관한 사실이 된다.
- **2.3은 "효능은 두 연구진이 확인했고 기원은 한 연구진이 확인했다"는 뜻이다.** 두 편 모두 같은 물질을 참굴에서 확인했다는 뜻이 아니다.
- **효소 시험값이다.** 세포 밖(in vitro) ACE 억제값이며, 체내 흡수·혈압 효과·제품 가치를 뜻하지 않는다.
- **백분위는 AHTPDB 고정 비교집단 안의 상대 순위다.** 비교집단은 ACE IC50, 기질 HHL, 펩타이드 352개다. 다른 비교집단의 값과 비교하지 않는다.
- **pIC50 차이 1.0(10배) 허용 폭은 팀의 시범 규칙이다.** 실험실 간 변동에 대한 외부 기준으로 정한 값이 아니다.
- **BBVI 80.9는 MBPI 96.3에 크게 기댄다.** 참굴 MBPI 항목의 median·mean 민감도는 48.7이다(AEYLCEAC 1.1 포함).
- **다른 종에도 같은 규칙이 적용된다.** 현재 조건을 채우는 재현 행은 LQP 한 건뿐이다. 새 재현 행을 추가하면 다른 종의 점수도 바뀔 수 있다. 추가할 때는 `research/verified-indices/evidence-xo-potency.json`의 형식과 검사 조건을 따른다.

## 5. 참굴 기원 재현 추가 조사 (결정 C, 2026-09-27)

2.3 채택 전에, 참굴 재료에서 LQP를 다시 동정한 논문을 찾았다. 찾지 못했다.

| 경로 | 결과 |
|---|---|
| Unpaywall·OpenAlex·Semantic Scholar(연락처 research@example.org) | 유료 원논문 다섯 편 모두 무료 판 없음 |
| 중국과학원 기관 저장소(Wang 2008 등재) | 이 PC에서 접속 거부 |
| ResearchGate(Shiozaki 2010) | 403. 저자 요청만 가능 |
| 로그인·유료 우회, 불법 공유 사이트 | 쓰지 않음 |

새로 확인한 사실은 다음과 같다.

1. **2026 *Trends Food Sci Technol* 굴 펩타이드 총설**(10.1016/j.tifs.2026.105623)의 참고문헌 94편을 Crossref로 모두 확인했다. 굴 ACE 관련 인용은 Chen 2022, Feng 2022, Guo 2020(혼합물), Jo 2024 총설이다. Do 2012나 LQP 논문은 인용하지 않는다. 그래서 원문을 구해도 LQP 재현 근거가 나올 가능성은 낮다.
2. **Jo et al. 2024** 해양 ACE 펩타이드 총설(*Mar Drugs* 22:449, 10.3390/md22100449, PMC11509120, 무료)을 원문으로 읽었다. 참굴 항목은 AEYLCEAC(Chen 2022)뿐이고 LQP는 없다.
3. **Matsumoto et al. 1994**(日本食品工業学会誌 41:589, 10.3136/nskkk1962.41.589, J-STAGE, CC BY-NC-SA)는 탈락이다.
   - 굴 분해물에서 분리한 펩타이드는 LQP가 아니라 Leu-Phe(IC50 126 µM, HHL)다.
   - 합성품이 아니라 분해물에서 직접 분리한 천연 펩타이드로 쟀다.
   - 재료는 "広島県産冷凍粒カキ"로만 적혀 있고 학명이 없다. 히로시마 굴이 대부분 참굴이라고 추정해서 기원종을 채우지 않았다.
4. 영어·일본어 웹 검색에서도 굴에서 LQP를 ACE 억제 펩타이드로 보고한 두 번째 논문은 없었다.
   - 가장 가까운 결과는 참굴 LQPPR(2025 *J Agric Food Chem*)이다. 이 논문은 알코올 대사 효소(ADH) 활성화 연구라서 ACE 근거가 아니다.
5. 남은 유료 원논문 네 편(Shiozaki 2010, Wang 2008, Je, Feng 2022)은 초록 기준으로 각각 DLTDY, VVYPWTQRF, 굴 소스 억제물질, LSL을 다룬다. LQP는 다루지 않는다.

이 조사 결과는 2.3의 한계("기원 근거는 한 편")를 그대로 남긴다.

## 6. 재현 방법

```
python scripts/build_verified_indices.py --check
python scripts/build_verified_indices.py --config config/verified-indices-v2.2.json --out <임시 파일>   # 2.2 비교용
python scripts/build_verified_indices.py --config config/verified-indices-research-xo-potency.json --out research/verified-indices/assessments-research-xo-potency.json --check
python scripts/build_matrix_readiness.py --check
PYTHONUTF8=1 python -m unittest discover -s verification
```

관련 문서: `research/verified-indices/xo-potency-research-2026-09-27.md`(연구 규칙 설계), `research/verified-indices/oyster-mbpi-2026-09-27.md`(참굴 MBPI 산출 경과).
