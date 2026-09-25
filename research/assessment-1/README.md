# 1번 과제: 실제 종의 판단 결과 표시 — 입력 감사 (2026-09-24 UTC)

상태: **실제 종 0종 배치, 점수 0건. 1번 과제 미완료.** 이 PR은 산출 보류 사유를 종마다 보여주는 안전한 화면과, 향후 검수 완료된 입력만 표시할 수 있는 세부 근거 화면을 추가한다. 운영 DB 및 배포 파일의 점수 JSON을 만들거나 수정하지 않는다. 시범 가중치와 산출값은 외부 검증 전이다.

## 감사 범위와 식별

기준: `main` [a05dfc0](https://github.com/gyunghun1214/blue-bio-map/commit/a05dfc0063586db38083a27308402df0edf44b12)의 [스키마](../../docs/evidence-schema.md), [산출 코드](../../scripts/evaluate_candidates.py), 공개된 [별도 시연 자료](../../dist/data.json), 운영 프로필의 저장소 내 [연결 코드](../../dist/live-data.js), [README](../../README.md), 사용자 제공 제안서, 아직 main에 합쳐지지 않은 [생리활성 조사 PR #5](https://github.com/gyunghun1214/blue-bio-map/pull/5)의 [조사문](https://github.com/gyunghun1214/blue-bio-map/blob/research/bioactivity-provenance-2026-09-24/research/bioactivity/README.md) 및 [출처표](https://github.com/gyunghun1214/blue-bio-map/blob/research/bioactivity-provenance-2026-09-24/research/bioactivity/evidence.csv). PR #5의 자료를 이 브랜치에 입력으로 복제하거나 MBPI 승인으로 취급하지 않았다.

운영 화면의 종 목록은 런타임에 원격 발행 프로필을 읽는다. 이 Git 스냅샷은 사용자 언급 **현재 8종의 전체 이름, 최신 승인학명과 AphiaID, 행별 입력**을 포함하지 않는다. 운영 DB를 수정하거나 이 감사에서 공개 프로필 목록을 별도 동결하지 않았다. 따라서 아래 3종은 저장소에 고정된 별도 시연 자료의 범위이고, 운영 8종 전체의 종별 검수 결과로 일반화하지 않는다. 운영 모드에서는 내려온 각각의 실제 종에 보류 사유를 동적으로 보여준다.

| 저장소에서 확인한 후보 | 승인 학명·AphiaID (저장소 표기) | MFPI 입력 확인 | MBPI 입력 확인 | MCUI 입력 확인 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 돌기해삼 | *Apostichopus japonicus* · 241776 | 영양 원값의 가식부 100 g 기준·단위 및 가식부 비율·양식 근거·3종 비교집단 검수 미완 | PR #5의 holotoxin A₁–진균 MIC/MFC는 확인; 논문 구조와 외부 CID 연결 미확정, 동일 표적·assay층 pChEMBL 비교집단 없음 | [IUCN EN A2bd 원평가](https://www.iucnredlist.org/species/180424/1629389) 확인: 2013년 발표·2010-05-19 평가·북서태평양 전 분포(한국 단독 평가 아님). **역사적 평가**이며 현행 재평가 여부는 미확인 → MCUI 입력 미승인 | MFPI·MBPI·MCUI·BBVI 보류 |
| 다시마 | *Saccharina japonica* · 377084 | 영양 단위·가식부 기준·가식부 비율·양식 근거·비교집단 검수 미완 | PR #5의 Lj5는 다당류 **분획**의 효소 IC50; 단일 화합물 ID와 pChEMBL 비교집단 없음 | 평가 범위·등급·연도가 연결된 검수 IUCN 입력 없음 | 모두 보류 |
| 참굴 | *Magallana gigas* · 836033 (별도 시연 파일 표기) | 저장소 요약만으로 동일 기준 원자료·가식부·양식 근거를 함께 검수할 수 없음 | 종–단일 화합물 ID–표적/assay–측정값–원논문 연결 미검수 | 검수된 평가 등급·연도·범위 없음 | 모두 보류 |
| 그 밖의 운영 프로필 | 이 Git 스냅샷에서 8종 명단 동결 불가 | 각 종 원자료와 단위/가식부 기준 추가 검수 필요 | 행별 화학 식별자·assay 원문 검수 필요 | 평가 연도·범위 검수 필요 | 런타임 종별 보류 표시; 명단 확인 후 재감사 |

위 학명·AphiaID는 저장소와 PR #5의 *인용 표기*를 사용했다. 이 감사에서 WoRMS의 현재 taxon 상태를 별도로 실시간 재검증하지 못했으므로, 실제 점수 승인 전 승인학명과 AphiaID를 최신 원레코드에서 다시 확인해야 한다. 현재 출현기록 수, 화합물 건수, 영양 항목 수, 출현 격자는 어떤 점수의 대리값도 아니다.

> **통합 시 수정 (2026-09-25, 로컬 `main` ea72b22 기준):** 이 감사는 a05dfc0 기준으로 작성되어 돌기해삼 IUCN 평가를 “없음”으로 적었다. [PR #7 보전 조사](../species-conservation/README.md)에서 2013년 발표 EN A2bd 원평가를 확인했으므로 위 표를 고쳤다. 화면은 이 평가를 ‘역사적 평가’로 표시하고 ‘현행 평가: 확인 보류’를 따로 보여준다. MCUI·BBVI는 계속 보류하며 새 점수를 만들지 않았다. 운영 8종 후보 명단과 학명·AphiaID는 [종 점검표](../species-conservation/species-check.csv)에 있으나 종별 입력 감사는 여전히 필요하다. 운영 ‘해삼’과 시연 ‘돌기해삼’은 같은 AphiaID 241776이다([검토 기록](../reviews/2026-09-24_research-prs.md)).

## 연결 확인 상태와 원문

| 출처 | 연결된 정량 내용과 남은 경계 | 이용조건·조회일 |
| --- | --- | --- |
| [Liao et al. 2024](https://doi.org/10.1111/bph.16333), DOI 10.1111/bph.16333 | 돌기해삼 채집 시료의 holotoxin A₁, *Candida albicans* SC5314 MIC 2 µg/mL 및 MFC 2 µg/mL. 분자식 후보가 다른 PubChem CID가 있어 독립 ID 미확정; ChEMBL 시험생물은 기원종 아님. MIC/MFC를 IC50/pChEMBL로 변환하지 않음. **현행 MBPI 입력 미승인.** | 원문 링크와 짧은 사실 요약만; 전문 재배포 권한 미확인. PR #5 조사 조회 2026-09-24 UTC |
| [Ke et al. 2020](https://doi.org/10.1002/cbdv.202000233), DOI 10.1002/cbdv.202000233 | 다시마 Lj5 분획의 α-glucosidase IC50 153.27 ± 22.89 µg/mL. 단일 CID/InChIKey 없고 효소 생물학적 기원 미명시. **현행 소분자 MBPI 입력 미승인.** | 원문 링크와 짧은 사실 요약만; 전문 재배포 권한 미확인. PR #5 조사 조회 2026-09-24 UTC |
| [WoRMS 종 레코드](https://www.marinespecies.org/) / [OBIS](https://obis.org/) | 시연 자료 및 PR #5의 AphiaID 인용. 원논문의 기원종과 이름 연결은 별도 검수 필요. 출현기록은 개체수·자원량·노력 보정 추세가 아님 | [WoRMS 텍스트 CC BY](https://www.marinespecies.org/about.php); 종별 상세 이용조건은 원레코드 확인. PR #5 조회 2026-09-24 UTC |
| [CMNPD](https://docs.cmnpd.org/terms-and-conditions) / [ChEMBL](https://chembl.gitbook.io/chembl-interface-documentation/about) | PR #5는 이 논문과 결속된 레코드 단위 ID 검증 미완으로 기록. CMNPD 수록 건수나 ChEMBL `assay_organism`은 종의 정량 효능을 입증하지 않음 | 각각 CC BY-NC-SA 4.0 / CC BY-SA 3.0 안내; PR #5 조회 2026-09-24 UTC |
| 영양 원레코드 / IUCN 종별 평가 | 점수 산출에 적합한 종별 가식부 원값·단위/측정법 **미확보**. IUCN은 돌기해삼 2013년 EN 원평가(역사적)만 확인, 현행 평가와 나머지 7종 평가는 **미확인** | 자료별 URL·이용조건·조회일을 입력 단계에서 기록해야 함 |

## 산출 및 화면 규칙

- [기존 입력 스키마](../../docs/evidence-schema.md)의 `schema_version: 1`, 출처 URL·이용조건·조회일, 승인 학명·AphiaID, 검수 플래그, 개별 화합물 ID, 표적·assay별 pChEMBL, 가식부 100 g 영양·등급, 가식부 비율·양식 근거, IUCN 평가를 유지한다. 질량 농도 MIC/MFC와 다당류 분획은 이 규칙의 소분자 pChEMBL 입력이 아니다.
- 영양은 각 항목의 동일 기준 비교 3종 이상, 생리활성은 동일 표적·assay의 서로 다른 화합물 3개 이상이어야 한다. MFPI 또는 MBPI가 없으면 BBVI 보류, MCUI가 없으면 매트릭스 보류. 미확인은 0점으로 바꾸지 않는다.
- 현재 코드의 **검증 전 시범 지표**: MFPI = 영양 백분위와 품질등급의 평균 × 0.8 + 가식부 비율 × 10 + 양식 근거 × 10; MBPI = 동일 표적·assay 화합물 백분위에 독립 문헌 계수 적용한 최댓값; BBVI = MFPI·MBPI 가중평균(기본 각 0.5), MCUI는 별도 축. IUCN 등급의 시범 매핑과 노력 보정 추세 조건은 스키마 문서를 따른다. 계수 및 점수는 외부 보정·역검증 전.
- 선택 종 패널은 각 축의 보류 사유, 원논문 조사와 현재 지표에서 제외한 이유를 보여준다. 향후 검수된 `dist/assessments.json`을 **별도 검토 후 발행한 경우에만** 동명·동일 AphiaID 및 근거 구성 항목을 확인하고 축별 점수·원문/이용조건·산출 시점·가중치를 보여준다. 실제 매트릭스는 네 점수가 모두 있을 때만 점을 찍는다. A–D는 버튼으로 켜는 임의값 예시로 분리한다.
- 공개 1° 셀과 출현기록은 개체수·자원량 또는 채집 장소가 아니다. 원좌표·민감 지점은 표시하거나 새로 저장하지 않았다.

## 재감사에 필요한 일

1. 운영 8종의 발행 목록을 승인 학명·AphiaID·프로필 기준일과 함께 동결하여 WoRMS 원레코드와 대조한다.
2. 종별 영양 원레코드의 측정 대상·방법·가식부 기준·단위·값, 가식부 비율·양식 가능성의 검수 출처 및 동기준 3종 이상 비교집단을 확보한다.
3. 종 기원 시료에서 단일 화합물 구조 ID까지 추적하고 동일 target/assay의 원논문 pChEMBL 행과 비교집단을 검수한다. PR #5의 미해결 ID와 분획을 점수에 사용하지 않는다.
4. IUCN의 종별 평가 범위·등급·평가 연도·원문 링크를 검수하고 DD/NE·미평가를 보류한다. 출현기록만으로 개체군 변화 추정 금지.
5. 이용조건과 외부 사례 검증을 통과한 뒤에야 선택 종의 결과 JSON 공개 여부를 별도 판단한다. 이 PR은 그 승인을 포함하지 않는다.

## 추가 (2026-09-25): 첫 실제 판단 사례를 만들려면

- **해삼 MCUI**: 2026년 IUCN EN 평가(Hamel & Mercier 2026)가 현행 평가로 확인됐다([보전 조사 추가 확인](../species-conservation/README.md)). 팀원이 IUCN 원문에서 기준·평가일·범위를 확인하면 아래 입력으로 시범 MCUI(EN → 80, 검증 전)를 산출할 수 있다. 확인 전에는 `reviewed`를 true로 두지 않는다.

```json
"conservation": {"category": "EN", "assessment_year": 2026, "source_id": "iucn-2026-apostichopus", "reviewed": true,
                 "current_status_check": {"is_current": true, "source_id": "iucn-2026-apostichopus", "checked_on": "YYYY-MM-DD"}}
```
  출처 등록: `"iucn-2026-apostichopus": {"url": "https://doi.org/10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en", "license": "IUCN terms of use", "accessed": "YYYY-MM-DD"}`

- **매트릭스 배치**에는 MCUI만으로는 부족하다. BBVI가 필요하고, BBVI는 MFPI와 MBPI가 **모두** 있어야 한다. MFPI는 food-1 형식(가식부 100 g 생물 기준 영양 원값·방법·시료, 동기준 3종 이상, 가식부 비율, 양식 근거), MBPI는 동일 표적·assay 화합물 3개 이상의 pChEMBL 자료가 필요하다. 현재 저장소에는 두 입력 모두 없다.
- 즉 제출 전에 실현 가능한 "실제 사례"는 해삼의 **시범 MCUI 1축**이며, 매트릭스 점은 영양·생리활성 원자료 검수 후에야 가능하다.
