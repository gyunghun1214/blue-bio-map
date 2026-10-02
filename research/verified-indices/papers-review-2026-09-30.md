> **보관본 (2026-10-02).** 이 기록은 닫힌 PR #65의 브랜치 `evidence/papers-20260930`(88f43ef)에만 있었다. 통과 행(미역 Sato 2002 7행, 넙치 Ko 2016 2행)은 `verified-pilot-3.5`가 다시 얹었고(`evidence-additions-2026-10-01.md`), 이후 바뀐 판정은 `evidence-isolates-2026-10-01.md`(3.14)에 있다: 보류였던 Chen 2018(바지락)은 '서열 확인 정제 펩타이드' 규칙으로 채택됐고, 제외였던 Suetsuna 2004(미역 천연 분리물)는 새 규칙으로 기원 행이 될 수 있지만 미역 점수를 바꾸지 않아 다시 판정하지 않았다. Himaya 2012(대구)는 서열과 질량이 맞지 않아 계속 제외다. 아래 본문은 원문 그대로다. 본문의 '재현' 절이 가리키는 설정·근거 파일(`config/verified-indices-papers-review.json` 등)은 main에 없고 그 브랜치에만 있다.

# 논문 5편 판정 결과의 통합 준비

기준 main: 7690ecab395cba165780dfe27e91ee667c93de1d. 조원 결과물 verdict-share.zip(2026-09-29)을 검토하고 통과 행만 별도 연구 시나리오에 반영했다. PDF와 판독 전문은 저장소에 넣지 않는다.

| 논문 | 판정 | 반영 |
|---|---|---|
| Sato 2002, 10.1021/jf020482t | 통과 | 기존 미역 7행을 원문 HHL·합성품 확인으로 교체. PDF 2쪽 방법, 5쪽 표 1 |
| Suetsuna 2004, 10.1016/j.jnutbio.2003.11.004 | 제외 | 표 1은 천연 분리물 IC50, 합성품은 혈압 실험에 사용 |
| Chen 2018, 10.1039/c8fo01146j | 보류 | 합성품 IC50 여부 미기재, 발효물 기원·DB 기술 불확실 |
| Himaya 2012, 10.1016/j.foodchem.2011.12.020 | 제외 | 천연 정제물 측정, 합성품 측정 없음, 서열·질량 불일치 |
| Ko 2016, 10.1016/j.procbio.2016.01.009 | 통과 | MEVFVP 79 µM, VSQLTR 105 µM, 넙치 근육, 합성품·HHL. PDF 2쪽 방법 및 5쪽 §3.4·표 3 |

미역 MBPI 19.6 → 71.5, 넙치 미산출 → 29.2. 두 종 모두 단일 DOI 참고값으로 BBVI는 보류된다. 다른 28종의 네 축 점수는 동일하다. 미역의 디펩타이드는 종 특이성이 낮다는 한계를 설명해야 한다. 넙치 MFPI 53.3이 생겨도 현재 근거로 공식 BBVI는 산출되지 않는다.

## 통합 방식과 순서

PR #63·#64 및 후속 MFPI/MCUI 작업이 진행 중이다. 현재 공개 2.3이나 진행 중인 팀원 브랜치를 덮어쓰지 않도록 별도 설정과 입력 스냅샷으로 계산했다. 기존 파일은 수정하지 않았고 역사적 계산은 유지된다. 원문 accessed=2026-09-29를 보존하고 새 입력의 snapshot_date=2026-09-30으로 정했다. 새 날짜는 새로운 외부 조회를 뜻하지 않는다.

이 변경은 연구 시나리오 준비 PR이다. 사이트 점수는 아직 바뀌지 않는다. 워크플로 PR 병합 후 최신 설정에서 이 판정 행을 사용하고 해당 방법 버전을 올리는 후속 통합이 필요하다. 공유 evidence-v3.json을 직접 바꿔 과거 버전 결과까지 바꾸는 방식은 피한다. 최신 MFPI·ChEMBL 점수와 함께 다시 계산하고 화면의 버전 검사·참고값·디펩타이드 한계·재현 테스트를 함께 갱신한다. #63·#64의 병합은 이 PR에 포함하지 않는다.

## 재현

```text
python scripts/build_verified_indices.py --evidence research/verified-indices/evidence-papers-review-20260930.json --config config/verified-indices-papers-review.json --out research/verified-indices/assessments-papers-review-20260930.json --check
python -m unittest discover -s verification -p 'test_*.py'
```

Windows에서는 PYTHONUTF8=1을 설정한다. 두 종만 변경되는지, 보류·제외 종이 점수에 들어가지 않는지, 단일 출처 BBVI가 보류되는지 및 저장 결과 재현을 검증한다.
