# 생리활성 원논문 조사 결과의 화면 표시 (2026-09-24)

기준: `main` a05dfc0, 미병합 [조사 PR #5](https://github.com/gyunghun1214/blue-bio-map/pull/5), [검수 입력 스키마](../../docs/evidence-schema.md). PR #5의 자료는 **연구 조사 요약**이며 승인된 운영 자료/MBPI 입력이 아니다. `dist/bioactivity-evidence.json`은 짧은 사실과 원문 링크만 담은 정적 요약이다. 공개 페이지는 AphiaID **및** 승인 학명 문자열이 정확히 일치할 때만 해당 종 옆에 조사 내용을 보여준다. 실제 운영 8종의 현재 소속 여부는 이 Git 스냅샷으로 확인하지 못했다.

| 공개 화면 상태 | 건수 | 의미 |
| --- | ---: | --- |
| 외부 화학 ID까지 연결하고 산출 승인된 종–단일 화합물–정량시험–원문 | 0 | MBPI 입력 없음 |
| 원논문 내부 종–정제 시료–MIC/MFC 부분 확인 | 1 | 돌기해삼; PubChem CID 구조·입체화학 대조 전, 소분자 MBPI 보류 |
| 종–다당류 분획–효소 IC50 부분 확인 | 1 | 다시마; 분획은 단일 분자 식별자 없음, 소분자 MBPI 보류 |
| 그 외 종 | 화면에 해당 종이 있을 때 | 원논문 연결 미확인. 활성 0이라는 뜻 아님 |

## 연결 및 출처

- 돌기해삼 `Apostichopus japonicus` / AphiaID 241776 → **논문 내** holotoxin A₁ → *Candida albicans* SC5314의 MIC/MFC 각각 2 µg/mL → [Liao et al. 2024, DOI 10.1111/bph.16333](https://doi.org/10.1111/bph.16333). Candida는 시험 생물이다. 외부 후보 CID 119551과 163110604 중 후자는 논문 분자식과 다르고, 어느 것도 구조 대조로 확정하지 못했다. 논문 내 식별과 외부 CID의 연결을 분리했다. MIC/MFC는 complex I IC50이나 pChEMBL, 사람 치료효과가 아니다.
- 다시마 `Saccharina japonica` / AphiaID 377084 → **논문 내 분획** Lj5 → α-glucosidase IC50 153.27 ± 22.89 µg/mL → [Ke et al. 2020, DOI 10.1002/cbdv.202000233](https://doi.org/10.1002/cbdv.202000233). 효소 생물학적 기원 미기재. Lj5는 다당류 분획이며 단일 화합물 CID/InChIKey가 아니다. [Islam et al. 2013, DOI 10.1016/j.fct.2013.01.054](https://doi.org/10.1016/j.fct.2013.01.054)의 다른 추출 분획 IC50는 분리된 단일 성분의 값으로 이식하지 않았다.
- 종 이름/AphiaID는 저장소가 인용한 [WoRMS 241776](https://www.marinespecies.org/aphia.php?p=taxdetails&id=241776), [WoRMS 377084](https://www.marinespecies.org/aphia.php?p=taxdetails&id=377084)와 PR #5에서 대조한 OBIS taxon ID를 사용했다. WoRMS 개별 페이지를 당일 직접 재조회하지 못했다는 한계는 PR #5에 기록되어 있다.
- 운영 프로필의 CMNPD 화합물 건수와 정량 활성 요약 건수는 레코드 ID–기원종–원논문–시험 연결이 없으므로 단지 **목록 요약**으로 표시한다. [CMNPD 이용조건](https://docs.cmnpd.org/terms-and-conditions)은 CC BY-NC-SA 4.0이며, 두 종의 CMNPD 레코드 단위 연결은 확인되지 않았다. [ChEMBL 문서](https://chembl.gitbook.io/chembl-interface-documentation/about)는 CC BY-SA 3.0이고 이 논문들의 molecule–assay–activity–document 행을 확인하지 못했다. 시험 생물 필드는 기원종이 아니다.

원논문 및 출처 조회 기준일은 **2026-09-24 UTC**. Wiley/Wiley-VHCA 전문 재배포 허용 여부 미확인: 링크 및 짧은 사실 요약만 제공한다. WoRMS 텍스트는 [CC BY 안내](https://www.marinespecies.org/about.php)를 따른다. [PubChem 이용 안내](https://pubchem.ncbi.nlm.nih.gov/docs/downloads)에 따라 개별 기여자의 조건은 별도 검토가 필요하다. 외부 데이터베이스 원문이나 대량 레코드는 복제하지 않았다.

## 화면과 산출 경계

`dist/app.js`의 정적 카드 데이터는 화면 표시 전용이다. 기존 `assessments.json` 부착 및 점수 계산 경로를 변경하거나 새 값을 만들지 않는다. 출처 건수가 많은 것과 정량 시험의 검증은 구분하며, 자료 연결 5항목의 **정량 연결은 공개 요약 건수만으로 확인으로 세지 않는다**. 연구 요약 파일이 누락되거나 학명·AphiaID가 맞지 않으면 해당 종에는 일반 보류 안내만 보인다. 운영 DB와 출현 격자/좌표는 수정하지 않았다.

다음 작업: 운영 8종 프로필 명칭 확인, WoRMS 최신 승인 학명 재검토, holotoxin A₁의 논문 구조와 PubChem 후보 CID/InChIKey 검증, CMNPD/ChEMBL 레코드–원논문 연결 검증, 분획 연구의 별도 입력 스키마 및 독립 검수, 재배포 조건 확인. 그 전까지 두 사례 모두 소분자 MBPI 입력 승인 불가.
