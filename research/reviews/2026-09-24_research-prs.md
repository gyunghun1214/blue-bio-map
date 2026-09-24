# 연구 PR #3·#5·#7 원고 검토 (2026-09-24)

원고는 고치지 않고 그대로 둔다. 이 파일은 원고의 주장 가운데 **다시 확인된 것**과 **보류할 것**을 나눈 기록이다. 확인에 쓴 곳은 WoRMS REST, Crossref, Europe PMC 초록, PubChem PUG REST, GBIF API(IUCN Red List 체크리스트 미러 포함), 운영 공개 API(읽기 전용)다. 점수·운영 DB·배포와 무관하다.

근거 행으로 옮긴 것: [`submissions/species_operating_8.csv`](../submissions/species_operating_8.csv)(운영 8종 분류 8행 + IUCN 9행), 앞서 옮긴 [`submissions/food_wakame_sea_squirt.csv`](../submissions/food_wakame_sea_squirt.csv).

## PR #7 종 식별·출현·보전 (sunnykim23, doyoun0824 과제 대신 수행)

| 원고 주장 | 검토 결과 |
| --- | --- |
| 8종 학명·AphiaID 후보 | 7종은 운영 공개 프로필과 일치하고 WoRMS accepted. **우뭇가사리만 다름**: 운영은 *Gelidium elegans* 372119, 원고는 *G. amansii* 212186. 212186도 WoRMS accepted(*G. amansii* (J.V.Lamouroux) J.V.Lamouroux, 1813)지만 별개 종이다. 원고의 "212186 accepted 확인 실패"는 이제 확인됨, 다만 운영 종이 아님 |
| 해삼과 돌기해삼 동일성 미확인 | **같은 종**. 운영 "해삼"과 시연 "돌기해삼" 모두 *Apostichopus japonicus* 241776. 한국어 표시명만 다름 |
| 해삼 IUCN 2013 EN A2bd, 평가일 2010-05-19, 전 세계 | DOI·평가일 Crossref로 확인. 단 **과거 평가**다. 현행은 Red List **2026-1 EN**(Hamel & Mercier, 전 세계, DOI 10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en). 현행판의 판정 기준은 미확인 |
| 7종 IUCN "assessment_not_verified" | 살오징어는 **Red List 2014-1 LC**(평가일 2010-05-10, 전 세계) 확인. 나머지 6종은 GBIF 미러에 기록 없음. 공식 NE로 쓰지 않음 |
| 홍합(참담치) *Mytilus coruscus* 506159 | WoRMS accepted. GBIF 백본은 *M. unguiculatus* 이명으로 둔다(출처 간 불일치, 기록만) |
| OBIS 시연 3종 출현·19개 데이터셋 표 | 시연 파일 기준이라는 한정이 원고에 명시돼 있어 유지. 운영 8종 값으로 쓰지 않음 |
| 운영 8종 출현 기간·제공처 미동결 | 공개 API로 동결: [assessment-1 README "운영 8종 대조"](../assessment-1/README.md) (PR #6 수정 브랜치 `claude/assessment-reasons-fix`) |
| PR #6의 "IUCN 평가 없음" 수정 필요 | 맞음. 수정 브랜치에서 과거/현행 평가를 나눠 반영, MCUI 변환 없음 |

## PR #5 생리활성 (sunnykim23)

| 원고 주장 | 검토 결과 |
| --- | --- |
| 세 논문의 서지(Liao 2024 BJP, Ke 2020 Chem Biodivers, Islam 2013 FCT) | Crossref로 DOI·제목·저자·학술지 확인 |
| Ke 2020 Lj5 α-glucosidase IC50 153.27 ± 22.89 µg/mL | 초록에서 확인 |
| Islam 2013 IC50 25.32(ethyl acetate)·75.86(CH2Cl2) µg/mL는 분획 값, fucoxanthin 비활성 | 초록에서 확인 |
| Liao 2024 holotoxin A1 MIC·MFC 2 µg/mL | **보류**: 초록에 수치 없음, 전문 비공개라 이번에 재확인 못함(원고 작성자는 본문 확인으로 기록) |
| CID 119551 (C66H104O31) vs 163110604 (C67H106O31) 충돌 | PubChem에서 두 분자식 확인. 119551의 이름은 입체 정보 없는 체계명(InChIKey …-UHFFFAOYSA-N)이라 논문 구조와 동일한지 미확정. **어느 CID도 연결하지 않음**(원고 결론과 같음) |
| 대상 종 | 돌기해삼(운영 "해삼"과 같은 종)과 **다시마(운영 8종 아님)**. 다시마 근거는 시연 종 자료로만 둔다 |
| `evidence.csv` 형식 | 원고 고유 열 구성이라 접수 양식과 다름. 원고로 보존하고, 행을 옮길 때는 `templates/bioactivity.csv`에 `link_level`을 붙여 새로 작성 |

## PR #3 식량 (yennybear)

| 원고 주장 | 검토 결과 |
| --- | --- |
| 멍게 Gao et al. 2024 (35.32%, 48.41% 등) | 앞서 Europe PMC 전문(PMC11209008)으로 대조해 `food_wakame_sea_squirt.csv`에 `self_checked`로 옮김 |
| 미역 Park 논문 21.32%, NIFS 2024 양식량 572,381 t | **보류**: PDF 내려받기 실패, NIFS 페이지 404. `license_unclear`로 둠 |
| FSIS '톳'·'홍합' 성분표, NIFS 제주 2010 어획, 2024 '홍합' 58,789 t | **보류**: 품목·통칭 수준이며 원고도 종값으로 채택하지 않음. 이번에 원문 재대조 안 함 |
| 우뭇가사리 = *Gelidium amansii* (NIFS 목록 근거) | **운영 종과 불일치**(운영 *G. elegans* 372119). 원고의 우뭇가사리 근거를 운영 종에 연결하려면 원출처 시료 학명 재확인 필요 |
| 각 종 영양값 미확인, 결측을 0으로 쓰지 않음 | 원고 규칙이 접수 양식과 같음 |

## 계속 보류

- 우뭇가사리 학명: 운영 *G. elegans*와 원고 *G. amansii* 중 어느 쪽 근거인지 원출처별로 다시 확인
- 해삼 현행 IUCN 평가의 판정 기준·평가일 원문(IUCN 사이트 403)
- 나머지 6종 IUCN: 미러 기록 없음, 공식 NE 여부 미확인
- Liao 2024 MIC/MFC 수치, holotoxin A1 CID
- 미역 Park 논문·NIFS 생산량, FSIS 성분표 이용조건
