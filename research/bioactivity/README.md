# 생리활성 근거 연결 조사 (2026-09-24)

범위: [`main` a05dfc0](https://github.com/gyunghun1214/blue-bio-map/commit/a05dfc0063586db38083a27308402df0edf44b12)의 `dist/data.json`에 실제 WoRMS 학명·AphiaID가 명시된 후보 가운데 돌기해삼과 다시마 2종. 앱의 운영 프로필은 원격 DB에서 동적으로 읽으므로 이 Git 스냅샷만으로 사용자가 언급한 **현재 8종 전체 목록은 확인할 수 없었다**. 따라서 두 종의 실제 운영 8종 포함 여부는 운영 프로필 목록과 대조해야 한다. 운영 DB에 접속하거나 데이터를 입력하지 않았다. 이 파일은 후보의 원문 근거 조사이지 MBPI 입력 또는 점수 승인 기록이 아니다.

[출처별 연결 표](evidence.csv)에서 `direct_primary`는 같은 원논문의 기원종·시험물질·측정값이 이어진다는 뜻이다. `partial`은 논문 내부 분획 식별까지만 가능하다는 뜻이며, `unresolved`는 독립 데이터베이스 식별자로 이어지지 않았다는 뜻이다.

## 확인된 연결

1. **돌기해삼** — `Apostichopus japonicus`, WoRMS AphiaID **241776** ([저장소에 인용된 WoRMS 레코드](https://www.marinespecies.org/aphia.php?p=taxdetails&id=241776), [OBIS taxon](https://obis.org/taxon/241776)). Liao et al. (2024), [DOI 10.1111/bph.16333](https://doi.org/10.1111/bph.16333), §2.1과 §3.1/그림 1은 중국 웨이하이산 *A. japonicus* 조리액에서 분리·HPLC 정제한 **holotoxin A₁**(논문 내 물질명; ESI-MS/NMR로 확인, 논문 분자식 **C66H104O31**, HPLC-ELSD 순도 >98%)을 직접 시험한다. 시험 생물은 **Candida albicans SC5314**로 기원종이 아니다. CLSI M27-A3 변형 연속 2배 희석, Alamar blue 형광을 이용한 **MIC 2 μg/mL**, 배양 후 재도말한 **MFC 2 μg/mL**. 논문은 mitochondrial complex I도 기전 후보로 분석하나 이 두 수치는 **진균 증식/살진균 endpoint**이지 complex I의 IC50/Ki가 아니다. 사람의 약효 입증이 아니다.
2. **다시마** — `Saccharina japonica`, WoRMS AphiaID **377084** ([저장소에 인용된 WoRMS 레코드](https://www.marinespecies.org/aphia.php?p=taxdetails&id=377084), [OBIS taxon](https://obis.org/taxon/377084)). Ke et al. (2020), [DOI 10.1002/cbdv.202000233](https://doi.org/10.1002/cbdv.202000233), [원논문 PDF](https://homepage.zjut.edu.cn/_upload/article/files/51/c3/6b78dffc40f7932148ad26cbf65b/b3e7e90e-2b90-4904-a7a8-06215af19879.pdf), p. 8 표 3 및 p. 10 실험법: 2018년 산둥성 룽청 채집, 표본 **LjW4-18**에서 추출한 황산화 다당류 **Lj5**(논문 내 분획 ID, 1.5–2.0 M NaCl 용출, 평균 분자량 153.92 kDa)를 **α-glucosidase** 효소 활성 시험에 사용. p-nitrophenyl-α-glycoside 기질, 405 nm 흡광도의 **IC50 153.27 ± 22.89 μg/mL**. 원문에는 효소의 **생물학적 기원**이 명시되지 않아 사람 효소라고 지정하지 않는다. `Lj5`는 조성/분자량 분포가 있는 **분획**으로 단일 분자·PubChem CID·InChIKey가 아니다. 이 결과를 소분자 `pChEMBL`이나 다른 연구의 ‘fucoidan’에 일대일 연결할 수 없다.

## 연결이 끊기는 지점

- **Holotoxin A₁의 외부 화학 ID:** [PubChem SID 135073731](https://pubchem.ncbi.nlm.nih.gov/substance/?source=chemidplus&sourceid=0085344350)은 동명 물질을 [CID 119551](https://pubchem.ncbi.nlm.nih.gov/compound/119551)(표시 분자식 C66H104O31)로 안내하지만, [CID 163110604](https://pubchem.ncbi.nlm.nih.gov/compound/163110604)도 `Holotoxin A1` 이름으로 색인되고 표시 분자식은 **C67H106O31**이다. 논문 §3.1의 C66H104O31과 후자는 불일치한다. 이 조사에서 논문 구조식/입체화학과 CID 구조·InChIKey를 원자 단위로 대조하지 못했다. **어느 CID도 확정 연결하지 않음**. 현재 확정 식별자는 ‘논문 DOI + 그 안의 holotoxin A₁ 시료’까지다.
- **Lj5의 외부 화학 ID:** 분획별 평균 분자량과 조성은 보고되었지만 단일 구조 식별자가 없다. 정량 결과가 있어도 `CID:...`/InChIKey나 ChEMBL 단일 분자 activity row로 내보내지 않는다.
- **성분과 분획의 값 혼동:** Islam et al. (2013), [DOI 10.1016/j.fct.2013.01.054](https://doi.org/10.1016/j.fct.2013.01.054), [PubMed](https://pubmed.ncbi.nlm.nih.gov/23402855/)는 다시마에서 pheophorbide a, pheophytin a 및 fucoxanthin을 분리했다. 초록의 NO 억제 IC50 **25.32/75.86 μg/mL**는 각각 **ethyl acetate/CH2Cl2 분획** 값이며 개별 화합물 값이 아니다. 같은 시험에서 fucoxanthin은 비활성이라고 보고한다. 개별 성분에 이 수치를 이식하지 않았다.
- **CMNPD/ChEMBL 범위:** [CMNPD 검색 안내](https://docs.cmnpd.org/tutorial)에서 종명·물질명을 검색어로 삼고 공개 색인의 `Apostichopus japonicus`, `Saccharina japonica`, `holotoxin A1`, `fucoxanthin`과 화합물/기원종 조합을 탐색했으나 이번 접근에서 **종–화합물 레코드 ID와 그 레코드에 결속된 원논문을 독립 확인하지 못했다**. CMNPD 화합물 존재 여부조차 이 조사로 판정하지 않는다. ChEMBL은 공개 검색/문서 수준에서 확인했고 이 두 논문에 대응하는 분자 ID–assay ID–activity ID–document DOI의 **레코드 단위 검증은 수행하지 못했다**. 미발견을 부재로 해석하지 않는다. ChEMBL `assay_organism`이나 `target_organism`은 시험생물로, 해양 기원종으로 역추론하지 않는다.
- 저장소의 `docs/evidence-schema.md`는 검수한 단일 화합물 ID, assay stratum, 독립 원문을 요구한다. 여기의 MIC/MFC는 IC50가 아니며 Lj5 분획은 단일 분자 조건을 충족하지 않는다. **두 행 모두 현행 소분자 MBPI 산출 입력으로 승인하지 않음.**

## 조사 방법과 다음 확인

1. 최신 `main` SHA에서 `dist/data.json`, `README.md`, `docs/evidence-schema.md`를 읽고 선택 후보를 고정했다. 저장소 WoRMS 인용과 OBIS taxon의 AphiaID를 교차 확인했다. WoRMS 개별 페이지/API는 이번 웹 조회에서 403/접근 오류여서 **당일 taxon 상태를 WoRMS 직접 재확인하지 못했다**. 저장소의 WoRMS 인용 날짜는 2026-09-21, OBIS 확인일은 2026-09-24다.
2. 연구 원문에서 **실제 채집 종과 시료 분리 과정 → 시료명/화학 동정 → 표적과 시험 방법 → 값/단위**를 같은 논문 안에서 추적했다. 다른 논문의 동일 성분명에서 얻은 활성값은 이식하지 않았다. `evidence.csv`의 DOI는 원논문에만 기재했고, 데이터베이스/분류 레코드는 DOI가 없으면 빈칸으로 두었다.
3. PubChem에서는 동명 후보의 구조식 차이를 기록했다. 향후 논문 그림 1 및 보충자료 구조, CID 양쪽 구조와 InChIKey를 비교하고 명확한 화학 ID를 확정해야 한다. CMNPD에서는 종·화합물·원문을 같은 레코드에서, ChEMBL에서는 molecule–assay–activity–document를 각각 다시 확인해야 한다. 단일 분자 대응이 없는 Lj5는 **분획 연구 자료**로만 남긴다. 원문 저작권과 각 데이터베이스 이용조건을 다시 검토하기 전 원문 PDF/대량 레코드를 저장소에 복제하지 않는다.

조회일은 아래 표의 **2026-09-24 UTC**이며, 이용조건은 ‘이 표에 기재한 링크·짧은 사실 요약’ 기준이다. Wiley 논문의 전문 재배포 허용 범위는 확인되지 않았으므로 원문 링크만 제공한다. CMNPD의 CC BY-NC-SA 4.0은 [공식 약관](https://docs.cmnpd.org/terms-and-conditions), WoRMS 텍스트 CC BY는 [공식 안내](https://www.marinespecies.org/about.php), ChEMBL CC BY-SA 3.0은 [공식 문서](https://chembl.gitbook.io/chembl-interface-documentation/about)를 참고한다. PubChem의 기여자별 조건은 [공식 다운로드 안내](https://pubchem.ncbi.nlm.nih.gov/docs/downloads)에 따라 개별 확인이 필요하다.
