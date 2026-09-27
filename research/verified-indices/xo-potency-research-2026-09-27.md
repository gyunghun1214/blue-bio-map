# 연구용 규칙: 다른 기원 효능 재현 (2026-09-27, 공개 미적용)

공개 정의(`verified-pilot-2.2`, `dist/assessments.json`)는 바꾸지 않았다. 이 문서는 승인 전 검토용 별도 산출물이다.

```
python scripts/build_verified_indices.py --config config/verified-indices-research-xo-potency.json --out research/verified-indices/assessments-research-xo-potency.json [--check]
```

## 기존 방식과 차이

| 항목 | 공개 2.2 | 연구 규칙(xo-potency) |
|---|---|---|
| 항목 단위 | `(기원종, 서열)` | 같음 |
| 종의 값(pIC50) | 기원종 행의 중앙값 | 같음. 재현 값은 종의 값에 섞지 않는다 |
| DOI 계수(0.75/1.0) | 기원종 논문의 DOI 수 | 기원종 DOI + **다른 기원에서 같은 합성 서열을 잰 논문의 DOI** |
| BBVI 독립 조건(DOI 2개) | 기원종 논문만 | 위의 합산 DOI |
| 재현으로 인정하는 조건 | – | 합성 펩타이드, 같은 표적(ACE)·지표(IC50)·기질(HHL)·단위(µM), 본문 숫자, 기원종 값과 pIC50 차이 1.0 이하, 기원종 논문과 다른 DOI |
| 새 종·새 항목 | – | 만들지 않는다. 재현 행은 `potency_replications`에만 있고 점수 항목이 되지 않는다 |

- 설정: `config/verified-indices-research-xo-potency.json`(2.2 복사본 + `peptide_bioactivity.cross_origin_potency`)
- 근거: `research/verified-indices/evidence-xo-potency.json`(공개 설정은 읽지 않는다)
- 코드: `scripts/build_verified_indices.py`의 `potency_replications()`. 설정 키가 없으면 실행되지 않아 공개·v3 산출물은 바이트 단위로 같다(`--check` 통과).

## 과학적 이유와 한계

- **나누는 두 질문**
  - 기원: "이 서열이 참굴 재료에서 나온다" → Do et al. 2012 한 편뿐이다. 이 규칙도 이것을 보강하지 않는다.
  - 효능: "합성 LQP가 ACE를 이 정도로 억제한다" → 합성 펩타이드는 기원과 무관하게 같은 분자다. 다른 연구진이 같은 조건에서 비슷한 값을 얻으면 효능 값의 재현이다.
- **pIC50 차이 1.0(10배)**: 같은 HHL 시험도 실험실마다 IC50이 수 배 달라진다는 팀 연구 가정이다. 더 크면 재현이 아니라 불일치로 보고 계수를 올리지 않는다(평균 내지 않음).
- **한계**
  - BBVI가 "참굴의 가치"를 말할 때, 기원 근거는 여전히 논문 한 편이다. 이 규칙은 효능 불확실성만 줄인다.
  - 짧은 펩타이드(디·트리펩타이드)는 여러 단백질에 흔하다. 종 특이성이 낮은 서열일수록 이 규칙의 혜택을 쉽게 받는다.
  - 저분자 층(ChEMBL 화합물, 감태 등)에는 구현하지 않았다. 같은 화합물을 다른 종에서 잰 논문을 인정할지는 따로 판단해야 한다.

## 사용한 재현 자료

- Miyoshi et al. 1991, *Agric Biol Chem* 55:1313–1318, DOI 10.1271/bbb1961.55.1313(J-STAGE 무료 PDF, 2026-09-27 전문 확인)
  - 옥수수 α-제인 thermolysin 가수분해물에서 LQP 분리(Edman, FAB-MS), 고상 합성·HPLC 정제
  - 합성 L-Leu-L-Gln-L-Pro **IC50 2.0 µM**(Table III), 분리 펩타이드 1.9 µM(Table II·고찰)
  - 조건: Hip-His-Leu 5 mM, 100 mM 붕산 pH 8.3 + 300 mM NaCl, ACE 8 mU(토끼 폐, Sigma), 37 °C 30분 — Do 2012와 같은 틀
  - Do 2012(1.18 µM, pIC50 5.928)와 pIC50 차이 0.229

## 결과 (공개 2.2 대비)

| 종 | 공개 2.2 | 연구 규칙 |
|---|---|---|
| 참굴 | MBPI 72.2(계수 0.75, 참고값), BBVI 보류 | **MBPI 96.3**(백분위 96.31 × 1.0), **BBVI 80.9**(w 0.25/0.5/0.75 → 88.6/80.9/73.2) |
| 미역 | MBPI 19.6, BBVI 보류 | 같음. KNFL의 다른 논문(2022 *Int J Biol Macromol*)은 같은 연구진(Feng et al.)의 결합 연구이고 다른 기원 측정이 없다 |
| 감태 | MBPI 67.5 | 같음(저분자 층, 규칙 미적용) |
| 나머지 27종 | – | 같음(테스트로 고정) |

- 매트릭스: 참굴 MCUI는 국가 평가라 매트릭스에 놓지 않는다. 연구 산출에서도 매트릭스 점은 0개다.
- 집계 민감도: 참굴 max 96.3, median·mean 48.7(AEYLCEAC 1.1 포함).

## 공개에 쓰려면

- 이 규칙을 공개 정의로 바꾸는 것은 팀 승인 사항이다. 승인하면 2.2의 `peptide_bioactivity`에 같은 키를 넣고 `dist/assessments.json`을 다시 만들며, 화면 문구("참고값(단일 논문)")가 참굴에서 빠진다.
- 승인 전에는 이 산출물을 발표·화면에 쓰지 않는다.

## 테스트

- `CrossOriginPotencyResearchTests`(`verification/test_verified_indices.py`)
  - 참굴만 바뀌고 종의 pIC50(5.928)과 기원 DOI는 그대로다.
  - pIC50 차이가 1.0을 넘거나 기원종 논문과 같은 DOI면 재현으로 세지 않는다.
  - 기질·합성 여부·단위·본문 숫자 조건이 틀리면 빌드가 멈춘다. 일치하는 항목이 없는 재현 행은 새 항목이나 종을 만들지 않는다.
