# 자료원·근거 변경과 MBPI 영향: verified-4.2 → verified-4.3

`python scripts/lineage.py diff --from verified-4.2 --to verified-4.3`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 4개 (|변화| 큰 순), 변경 항목 5건.

- **참조기(Larimichthys polyactis)** MBPI 산출 보류→53.8: 근거 기록 변경 — SEQ:APPERKYSVW|xo-peptide-literature-2026-10-05: 항목 추가 (기록 1건) [verified-4.3#0002]; SEQ:WDDMEKIW|xo-peptide-literature-2026-10-05: 항목 추가 (기록 1건) [verified-4.3#0003]
- **방어(Seriola quinqueradiata)** MBPI 산출 보류→0.0: 대체 — 종 전체: MBPI 하한값 규칙(4.3 사전 등록 1.5): 어느 층에도 항목 없음 [verified-4.3#0001]
- **참문어(동아시아 종)(Octopus sinensis)** MBPI 산출 보류→0.0: 대체 — 종 전체: MBPI 하한값 규칙(4.3 사전 등록 1.5): 어느 층에도 항목 없음 [verified-4.3#0004]
- **갑오징어(Acanthosepion esculentum)** MBPI 산출 보류→0.0: 대체 — 종 전체: MBPI 하한값 규칙(4.3 사전 등록 1.5): 어느 층에도 항목 없음 [verified-4.3#0005]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.2 (2026-10-04). Team-lead decisions of 2026-10-05 ("fill every value; drop every pilot or withheld state"), pre-registered before any value was computed in research/verified-indices/prereg-fill-all-4.3-2026-10-05.md: (1) MCUI: when IUCN, the Korean national list, every range-state national list and every sub-national list are silent, a met Rapid LC check (thresholds and snapshot unchanged since 3.15) is scored as LC-equivalent 10 with the label '자체 예비평가(Rapid LC) · 역검증 미통과' and its own matrix marker; this reverses the 2026-10-04 decision that kept it reference-only. (2) MCUI: the 미역 row of the Primorsky Krai governor decree No. 272 (2002), read in the docs.cntd.ru legal-database text and checked current against the official 2022 amendment scan No. 723-пп, counts as read in the original under the 4.2 pre-registration. (3) MBPI: a fourth peptide stratum, xanthine-oxidase (XO) IC50, with a literature-built fixed cohort (members confirmed by two independent checks). (4) MBPI: a species' own single-substance value that fails exactly one condition may be scored with a label naming the relaxed condition. (5) MBPI: a species with no item in any stratum gets the floor value 0 labelled '효능 근거 미확인(하한값)' (meaning: no qualifying evidence yet, not 'no activity'); its BBVI is 0.5 x MFPI, labelled 'MBPI 하한값 포함'. The extensions were decided after seeing which cells they would fill; the pre-registration says so. No cohort, weight, coefficient or threshold of MFPI, of the existing MBPI strata or of IUCN/national/sub-national MCUI changes.
