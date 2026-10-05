# 계보 검증: verified-4.3 (9532125)

`python scripts/lineage.py validate`로 생성. 종-화합물 연결 379건, 시험 기록 2194건, 기여 행 2151건 (포함 119건).

| 검사 | 결과 | 대상 | 실패 |
| --- | --- | ---: | ---: |
| 1. 재현성: 포함 기여 행으로 재계산한 MBPI == 발행 MBPI | PASS | 30 | 0 |
| 2. 참조 무결성: 기여 행 → bioassay_record, species_compound_link | PASS | 2151 | 0 |
| 3. 출처 필수: source_db, source_record_id, retrieved_at | PASS | 2194 | 0 |
| 4. 층 일관성: 백분위 0–100, 층 안 순위 == p값 순서 | PASS | 30 | 0 |
| 5. 변경 기록 완전성: 점수가 바뀐 모든 종이 변경 항목과 연결됨 (설명 안 됨 0건) | PASS | 115 | 0 |
| 6. 사후 검증 사례 스모크 (ziconotide·trabectedin·eribulin 기원종) | SKIP | 0 | 0 |

## 4. 층 일관성: 백분위 0–100, 층 안 순위 == p값 순서

항암 층은 비교집단에서 자기 자신을 뺀 백분위라 같은 값의 순위가 항목마다 다를 수 있다.


## 5. 변경 기록 완전성: 점수가 바뀐 모든 종이 변경 항목과 연결됨 (설명 안 됨 0건)

실행 쌍 36개


## 6. 사후 검증 사례 스모크 (ziconotide·trabectedin·eribulin 기원종)

사후 검증 기원종이 이 실행에 없다 (posthoc-3.27 별도 스냅샷에서만 점수화). 스모크 테스트 skip.


## 제외 기록 사유 (삭제하지 않고 included=false로 보존)

- approved_drug: 1308건
- common_metabolite: 534건
- rejected_by_review: 65건
- not_best_target_in_stratum_class: 46건
- target_outside_strata: 37건
- activity_comment: 11건
- status: 10건
- replication not used: 3건
- 조건 셋이 걸려 4.3의 완화 규칙(조건 하나만)을 넘습니다. 모두 넓혀도 DU-145 비교집단의 가장 약한 값보다 약해 0.0입니다.: 2건
- Extract and purchased standard cannot be linked as one species-derived single compound activity.: 1건
- No confirmed CID/InChIKey to assay chain; MIC/MFC cannot be converted to IC50.: 1건
- Structure ID, tabulated IC50 and producing organism are not established.: 1건
- Single-concentration viability is not pChEMBL.: 1건
- A real isolated-peptide IC50 is available, but an exact public structure join and comparable fixed cohort are not yet verified; do not mix peptides with small molecules.: 1건
- cohort_below_minimum: 1건
- Origin, structure and numeric endpoint are traceable, but the method has no fixed comparable stratum; PR-A adds no cohorts.: 1건
- Whole-extract animal outcomes cannot be assigned to a single compound or converted to pChEMBL.: 1건
- Quantified fraction effects and qualitative single-compound observations are not an eligible compound-level MBPI input.: 1건
- Paper-local IC50 is real but incomplete source-taxonomy and exact-molecule joins and no comparable assay cohort prohibit MBPI; cell viability is not proof of clinical efficacy.: 1건
- Isolated peptide origin is documented, but the accessible assay record is insufficient for a reproducible potency percentile.: 1건
- 원문 전문(팀장 도서관 PDF, 2026-10-05)을 읽었습니다. 합성 펩타이드·LB 액체배지·96웰은 맞지만 조건 둘(수치 없음·MIC 아님)이 걸려 4.3의 완화 규칙(조건 하나만)을 넘습니다. 곡선에서 MIC를 읽어 내는 추정은 하지 않습니다.: 1건
- 기원(이 종의 시료) 확인이 안 되어 4.3의 완화 규칙도 적용할 수 없습니다.: 1건
- A partly characterized hydrolysate peptide cannot support a compound-identified, comparable MBPI percentile.: 1건
- 정량 종말점과 비교집단이 없어 점수를 매길 수 없습니다.: 1건
- 수치 종말점이 없어 점수를 매길 수 없습니다.: 1건

채택된 종-화합물 연결 중 불확실 플래그(추정 연결·동의어/하위 분류군 일치): 19건. 점수에서 빼지 않고 정보충분도 판단용으로 남긴다.
