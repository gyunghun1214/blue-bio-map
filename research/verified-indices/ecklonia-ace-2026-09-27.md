# 감태 원논문 ACE 층 검수 및 시범 MBPI — 2026-09-27

## 범위와 탐색

기존 8종과 신규 후보 22종의 승인명·기존 생리활성 단서를 후보 풀로 두었다. 우선 원논문의 **분리·구조 동정**과 **동일 시험의 여러 정량 IC₅₀**가 함께 존재하는 자료를 찾았다. 검색식: `"<accepted scientific name>" isolated compounds IC50 original assay`, `"Ecklonia cava" phlorotannins ACE IC50`, `"Ecklonia cava" BACE1 dieckol bieckol`, `"Ecklonia cava" PEDV eckol dieckol`, `"Apostichopus japonicus" holotoxin A1 structure`, `"Todarodes pacificus" SAGSLVP sequence mass`, `"Halocynthia roretzi" halorotetin B IC50`; PubMed/PMC, 원출판사, WoRMS, PubChem, ChEMBL, PubChem BioAssay, CMNPD를 2026-09-27 조회했다. 검색 노출 결과는 데이터베이스의 부재 증거가 아니다. ChEMBL/BioAssay/CMNPD에서 동일 DOI–시료 기원–구조–assay의 전체 사슬은 별도로 확인하지 못했으며, 아래 승인값은 **원논문의 Table 2 직접 전사**이고 pChEMBL은 단위 변환 후 계산값이다.

| 집중 후보 | 원자료 | 처리 |
| --- | --- | --- |
| 감태 *Ecklonia cava* (371986) | [Wijesinghe et al. 2011](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93), DOI 10.4162/nrp.2011.5.2.93: 제주 감태 추출·HPLC 정제·NMR 비교·Fig. 3 구조·Table 2 동일 ACE assay의 5개 IC₅₀ | 현행 규칙 안에서 5개 확정 화합물 승인. 단일 논문의 시험 내 상대 점수만 허용. |
| 감태 | [Lee & Jun 2019](https://doi.org/10.3390/md17020091), BACE1의 eckol/dieckol/8,8′-bieckol 정량값 | ACE와 다른 표적이라 별도 층. 이 보고서에서는 정제 시료의 출처·구조·방법 전체를 재검수하지 못해 합산 제외. |
| 감태 | [Park et al. 2013](https://pubmed.ncbi.nlm.nih.gov/23746631/), PEDV 세포 감염 시험 | 효소 ACE와 시험계·노출 방식이 달라 제외. |
| 해삼 *Apostichopus japonicus* (241776) | [기존 원문·구조 불일치 감사](bioactivity-audit.md): holotoxin A₁ PubChem 동명이물 CID 163110604의 분자식과 원문 분자식 불일치; [별도 K562 논문](https://doi.org/10.3390/md16040123)의 시료는 *Cladolabes schmeltzii* | 해삼의 확정 구조–원논문 활성 연결로 승격하지 않음. |
| 살오징어 *Todarodes pacificus* (342067) | [기존 원문·서열 감사](bioactivity-audit.md): SAGSLVP의 서열 계산 질량 629.7 Da와 논문 보고 657 Da 불일치 | 펩타이드 구조 보류. |
| 멍게 *Halocynthia roretzi* (250680) | [기존 원문 감사](bioactivity-audit.md): 2006년 카로티노이드의 단일 농도 HL-60 생존율은 IC₅₀ 아님. [2026년 Halorotetin B 원문](https://doi.org/10.1002/advs.202515652)은 Fig. 2의 IC₅₀ 곡선을 제시 | 후자는 구조의 입체화학·안정 CID 및 동일 조건 비교층 확인 전까지 별도 단서로 보류. 두 시험을 섞지 않음. |
| 기존 나머지 5종·신규 나머지 21종 | [기존 8종 감사](bioactivity-audit.md), [22종 원자료 상태](../../dist/expansion-evidence.json)를 후보 풀로 확인 | 이번 집중 조사에서 원논문 사슬을 새로 검수하지 않았다. **30종별 체계적 제목·초록 선별이나 활성이 없다는 판정이 아님**. 기존 보류 유지, 후속 종별 검색 필요. |

## 원논문 사슬

WoRMS [승인명 *Ecklonia cava* / AphiaID 371986](https://www.marinespecies.org/aphia.php?p=taxdetails&id=371986). 논문 원명도 *E. cava*로 일치하며 이명 추론이 필요하지 않다. 저자들은 제주 해조체에서 메탄올 추출, 에틸아세테이트 분획, Sephadex LH-20 및 HPLC 정제를 거쳐 ¹H/¹³C NMR과 선행 구조 자료로 5종을 동정했다. 원논문 Fig. 3 패널과 [PubChem](https://pubchem.ncbi.nlm.nih.gov/)의 구조명·분자식을 연결했다. 아래 PubChem CID는 **구조 식별**에 사용하며, PubChem에 이름이 있다는 사실을 해당 논문의 기원·활성 증거로 사용하지 않는다. 별도의 절대배치가 필요한 입체중심을 이 2D 구조에서 주장하지 않는다. Eckstolonol의 PubChem 표제어는 dioxinodehydroeckol이며 동의어·Fig. 3 구조를 대조했다.

| 기원종 | 분리·동정 물질 · Fig. 3 | PubChem CID · 분자식 | ACE IC₅₀ 원값 (mM, 평균 ± SD) | nM 환산 · pIC₅₀ | 원문 |
| --- | --- | --- | ---: | ---: | --- |
| *E. cava* | phloroglucinol · 3a | [359](https://pubchem.ncbi.nlm.nih.gov/compound/359) · C₆H₆O₃ | 2.57 ± 0.09 | 2,570,000 · 2.5901 | [Table 2](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93) |
| *E. cava* | triphlorethol-A · 3c | [23427055](https://pubchem.ncbi.nlm.nih.gov/compound/23427055) · C₁₈H₁₄O₉ | 2.01 ± 0.36 | 2,010,000 · 2.6968 | [Table 2](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93) |
| *E. cava* | eckol · 3b | [145937](https://pubchem.ncbi.nlm.nih.gov/compound/145937) · C₁₈H₁₂O₉ | 2.27 ± 0.08 | 2,270,000 · 2.6439 | [Table 2](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93) |
| *E. cava* | dieckol · 3d | [3008868](https://pubchem.ncbi.nlm.nih.gov/compound/3008868) · C₃₆H₂₂O₁₈ | 1.47 ± 0.04 | 1,470,000 · 2.8327 | [Table 2](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93) |
| *E. cava* | eckstolonol · 3e | [10429214](https://pubchem.ncbi.nlm.nih.gov/compound/10429214) · C₁₈H₁₀O₉ | 2.95 ± 0.28 | 2,950,000 · 2.5302 | [Table 2](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93) |

관계기호는 모두 `=`. 표적 ACE (EC 3.4.15.1), Sigma 공급 효소(조직 기원은 논문에 미기재), 기질 Hippuryl-His-Leu 25 mM, borate pH 8.3 및 NaCl 500 mM, 37°C 10분 사전 배양 후 60분 반응, 228 nm 흡광. 세 번의 측정(같은 논문 안의 반복)이며 **독립 논문 수 1**, 독립 화합물 수 5. 효소의 생물학적 기원과 화합물 기원종은 서로 다르다. 추출물의 별도 0.96 mg/mL 값이나 NO/세포 생존율은 이 층에 넣지 않았다.

## 고정 층, 산식, 한계

고정 층 ID `wijesinghe-2011-cell-free-ACE-IC50`: 위 Table 2의 다섯 분리 화합물만 포함한다. 현행 `verified-pilot-2`의 `minimum_compounds_per_stratum=3`, `pChEMBL = 9 − log₁₀(IC₅₀ nM)`, 중앙값 백분위(동률 중간순위), 단일 DOI 계수 0.75, 종 내 최고 조정값 집계를 **변경하지 않았다**. Dieckol 백분위 90, 계수 0.75 → **시범 MBPI 67.5**. 다섯 조정값은 7.5, 22.5, 37.5, 52.5, 67.5이고 최고값 대신 중앙값/평균값을 쓰면 모두 37.5. 수치가 바뀌는 집계 민감도이며 임상 효과 크기나 100점 만점의 절대 효능이 아니다. 한 논문에서 같은 종의 화합물끼리 비교하는 점수는 새로운 종과 공통 참조집단으로 견줄 수 없다. 현재 자료로 점수의 외부 성능 검증·독립 재현은 하지 않았다.

MFPI에는 종별 생것·가식부·양식 근거가 부족하며 MCUI에는 검수된 현행 IUCN 원평가가 없다. **BBVI와 매트릭스 점은 없다.** 종 점수를 출현 격자에 전가하지 않는다. 합성 회귀 화합물은 계산식 검사에만 사용했다.

## 공개 v2.1 후속 판정

현행 공개 방법 `verified-pilot-2.1`은 이 MBPI를 **"참고값(단일 논문)"**으로 표시한다. 서로 다른 원논문 DOI가 두 편 이상이어야 BBVI 입력 후보가 된다. 이는 최소 증거 조건이며 생물학적 독립 재현의 증명은 아니다. 따라서 감태의 MFPI가 확보되어도 지금의 ACE/HHL 논문 한 편만으로는 BBVI를 산출하지 않는다.

- 현행 연결된 농촌진흥청 식품성분표 스냅샷에서 *E. cava*의 종별 생것·가식부 100 g 영양 행을 확인하지 못했다. 식품성분표 전체에 자료가 없다고 단정하지 않는다. 가공 상태·수분·부위가 다른 수치나 근연종 값은 종별 실측값을 대신하지 않는다. [국가표준식품성분표 검색](https://www.nics.go.kr/food/kfi/fct/fctFoodSrch/list)에서 종명·식품명과 원자료를 다시 대조해야 한다.
- [EFSA의 2017년 안전성 의견](https://doi.org/10.2903/j.efsa.2017.5003)은 감태 유래 **phlorotannin 추출물**을 다룬다. 식용 감태 전체의 생것 영양성분이나 가식부 비율로 전용할 수 없다.
- 저장된 IUCN 종 검색 결과 0건은 해당 조회 시점에 평가를 연결하지 못했다는 기록이다. 공식 NE·DD 판정이나 낮은 보전 위험 점수가 아니다. [IUCN 범주·기준](https://nrl.iucnredlist.org/resources/categories-and-criteria)과 평가 원문·연도·범위를 확인하기 전 MCUI는 보류한다.
- 다음 작업: 종별 식품 실측 원자료와 가식부·가공 상태를 확인하고, 동일 ACE/HHL 조건의 독립 원논문을 찾아 DOI·화합물·시험값을 검수한다. 그 후에도 시범 점수의 외부 검증과 비교집단 민감도 검사가 필요하다.

## 이용조건

원논문 [NRP](https://e-nrp.org/DOIx.php?id=10.4162/nrp.2011.5.2.93)는 **CC BY-NC 3.0**; 표/그림 이미지는 재배포하지 않고 출처·측정 사실만 재정리. [WoRMS](https://www.marinespecies.org/about.php)는 저작자표시, [PubChem](https://pubchem.ncbi.nlm.nih.gov/)은 NIH 화합물 구조 기록으로 각 CID를 링크한다. 출처의 이용조건은 `evidence.json`에도 기록했다.
