# 자료원·근거 변경과 MBPI 영향: verified-4.12 → verified-4.13

`python scripts/lineage.py diff --from verified-4.12 --to verified-4.13`로 생성. 변경 유형: `fallback` 대체, `dedup` 중복 해소, `identifier` 식별자 변경, `version` 버전 변경, `conversion` 환산 방식 변경, `evidence` 근거 기록 변경, `method` 계산 규칙 변경, `unexplained` 설명 안 됨.

MBPI가 바뀐 종 1개 (|변화| 큰 순), 변경 항목 4건.

- **넙치(Paralichthys olivaceus)** MBPI 29.2→43.2: 근거 기록 변경 — SEQ:SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK|amp-dbaasp-mic-broth-bacillus-subtilis: 항목 추가 (기록 1건) [verified-4.13#0001]; SEQ:SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK|amp-dbaasp-mic-broth-escherichia-coli: 항목 추가 (기록 1건) [verified-4.13#0002]; SEQ:SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK|amp-dbaasp-mic-broth-staphylococcus-aureus: 항목 추가 (기록 1건) [verified-4.13#0003]; SEQ:SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK|amp-dbaasp-mic-broth-vibrio-anguillarum: 항목 추가 (기록 1건) [verified-4.13#0004]

## 이 실행의 변경 설명 (config `changes_from`)

verified-4.12 (2026-10-14). The 2026-10-14 evidence brief, registered in research/verified-indices/prereg-4.13-2026-10-14.md in its own commit before the inputs and code. No rule changed. (1) The AMP supplement gains the four cohort targets of 넙치 P35 (Xu, Yuan & Sun 2022, Int J Mol Sci 23:12722, full text read 2026-10-14): MBPI 29.2 -> 43.2, BBVI 44.3 -> 51.3. (2) Seven reviewed records whose value this run could not verify in the original text, or which the fixed rules do not cover (PBS-buffer MIC, a sample with no scientific name), join the partial supplement and score nothing. (3) Three compound caveats gained their original-measurement sources. (4) A new display file, dist/supplementary-literature.json, lists related papers that no score uses; the indicator build does not read it. Items needing a rule change are listed as decisions in the pre-registration and stay out of the scores.
