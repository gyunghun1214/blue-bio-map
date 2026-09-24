# 8종 종 식별·출현·보전 원자료 감사

조회 기준: **2026-09-24 UTC**. 기준 코드: [main a05dfc0](https://github.com/gyunghun1214/blue-bio-map/commit/a05dfc0063586db38083a27308402df0edf44b12). [8종 행별 확인표](species-check.csv), [OBIS 시연 원제공 데이터셋 19개 인용·라이선스 표](occurrence-sources.csv). 조사 결과는 운영 DB 입력/공개 지도 셀 발행/지표 점수 또는 실제 한국 전체 분포의 승인 자료가 아니다. 개별 정밀 좌표·레코드 ID·비공개 원자료는 복제하지 않았다.

## 이름 및 보전 결론

| 한국어 후보 | WoRMS 학명 후보·AphiaID | 이름 결속 상태 | IUCN 원평가 검증 |
| --- | --- | --- | --- |
| 참굴 | [*Magallana gigas* · 836033](https://www.marinespecies.org/aphia.php?p=taxdetails&id=836033) | 저장소 시연 학명 및 WoRMS 색인에서 accepted 확인. 옛 조합 *Crassostrea gigas*와 구별 | 종별 평가 원문에서 등급·연도·범위 **미확인** |
| 살오징어 | [*Todarodes pacificus* · 342067](https://www.marinespecies.org/aphia.php?p=taxdetails&id=342067) | WoRMS 색인 accepted; 운영 한국어 이름–학명 조합은 공개 프로필 원행 대조 보류 | 미확인 |
| 해삼 | [*Apostichopus japonicus* · 241776](https://www.marinespecies.org/aphia.php?p=taxdetails&id=241776) | 저장소 시연 종은 **돌기해삼**. 일반명 ‘해삼’은 다른 종을 포함할 수 있어 운영 원행 대조 필요 | **2013년 발표 EN A2bd v3.1** 원평가 확인. [평가 레코드](https://www.iucnredlist.org/species/180424/1629389), [DOI](https://doi.org/10.2305/IUCN.UK.2013-1.RLTS.T180424A1629389.en). 평가일 **2010-05-19**, 범위 **북서태평양 전 분포**(중국·일본·한반도·러시아 극동), 한국 단독 평가 아님. **현재 재평가 여부 확인 보류** |
| 톳 | [*Sargassum fusiforme* · 494972](https://www.marinespecies.org/aphia.php?p=taxdetails&id=494972) | WoRMS 색인 accepted. *Hizikia fusiformis* 등 옛 이름을 운영 기록과 재대조 | 미확인 |
| 미역 | [*Undaria pinnatifida* · 145721](https://www.marinespecies.org/aphia.php?p=taxdetails&id=145721) | WoRMS 레코드 학명·ID 확인. 시연 **다시마** *Saccharina japonica*와 혼동 금지 | 미확인 |
| 우뭇가사리 | [*Gelidium amansii* · **212186 후보**](https://www.marinespecies.org/aphia.php?p=taxdetails&id=212186) | [AlgaeBase 학명](https://www.algaebase.org/search/species/detail/?species_id=1830)과 WoRMS 링크를 싣는 [외부 인용](https://www.plantasyhongos.es/herbarium/htm/Gelidium_amansii.htm)까지 확인. WoRMS **해당 레코드의 현재 accepted 상태 직접 확인 실패**. ID를 확정 입력 금지 | 미확인 |
| 홍합(참담치) | [*Mytilus coruscus* · 506159](https://www.marinespecies.org/aphia.php?p=taxdetails&id=506159) | WoRMS 색인 accepted, [PubChem의 WoRMS ID 교차 인용](https://pubchem.ncbi.nlm.nih.gov/taxonomy/42192). ‘홍합’만으로는 종 동정 불가; 참담치 운영 원행 확인 필요 | 미확인 |
| 멍게 | [*Halocynthia roretzi* · 250680](https://www.marinespecies.org/aphia.php?p=taxdetails&id=250680) | WoRMS 색인 accepted; 운영 한국어 이름–학명 원행 대조 보류 | 미확인 |

WoRMS는 학명과 AphiaID를 검증하는 **분류 출처**다. 한국어 통용명→WoRMS 승인종 연결은 별개의 판단이다. WoRMS 개별 페이지가 일부 직접 조회에서 403/접속 실패였으므로 검색에 노출된 레코드 정보, 저장소에 남은 분류 인용, AlgaeBase/교차 인용을 상태별로 구분했다. 특히 우뭇가사리의 212186을 검수 완료값처럼 쓰지 않는다.

IUCN의 [공식 범주 설명](https://www.iucnredlist.org/)에 따르면 NE는 평가가 수행되지 않은 분류군을 뜻하고, [FAQ](https://www.iucnredlist.org/about/faqs)는 NE가 Red List에 포함되지 않는다고 설명한다. **검색 미발견 ≠ 공식 NE**. 7종의 `assessment_not_verified`는 검색·접속 범위에서 원평가의 범주/발표연도/평가범위를 한꺼번에 확인하지 못했다는 기록일 뿐 IUCN이 평가하지 않았다는 주장이 아니다. 돌기해삼의 EN도 **2013년 발표 당시의 전 세계 평가**이며 2026년 한국 현황·종별 MCUI로 자동 변환하지 않는다. 2010년 평가일과 2013년 발표 연도를 혼동하지 않는다.

## 출현기록: 시연 3종과 운영 8종 구분

| 출처 범위 | 종 | 기록에서 확인한 시기 | 해역과 제공처 | 한계 |
| --- | --- | --- | --- | --- |
| [별도 OBIS 시연 스냅샷](../../dist/data.json), 2026-09-22 | 참굴 | 1874–2026, 필터 뒤 990건, 33개 공개 1° 셀 | 조회 사각형 122–136°E·30–43°N. 일본 오사카/와카야마 연안 조사, 일본 표본·갯벌, 한국 MABIK, iNaturalist 등 12개 OBIS 데이터셋 | 총 응답 1,020건 중 처음 1,000건만 조회한 뒤 라이선스 미확인 10건 제외. 한국 전수 아님 |
| 같은 시연 | 돌기해삼 | 1986–2026(연도 없는 1건 별도), 507건, 27셀 | 같은 조회 사각형. NIFS, MABIK, 일본 오사카 조사, UF 표본, iNaturalist 등 5개 OBIS 데이터셋 | 이웃 나라 포함·자료원별 노력 차이·중복 및 동정 오차 가능 |
| 같은 시연 | **다시마** (*Saccharina japonica*), 요청 8종의 미역과 별개 | 2000–2023, 389건, 14셀 | 같은 조회 사각형. MABIK 조류·iNaturalist 등 2개 OBIS 데이터셋 | 8종 미역의 출현값으로 대체 불가 |
| [운영 발행 요약을 읽는 코드](../../dist/live-data.js), [README](../../README.md) | 참굴·살오징어·해삼·톳·미역·우뭇가사리·참담치·멍게 | **종별 기간을 이 Git 스냅샷에서 8행 모두 확인하지 못함** | README/코드의 시험 범위 124–132°E·33–38.7°N. `species_profiles`의 공개 인용과 `species_map_cells`의 1° 셀만 브라우저에서 읽도록 설계. 종별 제공처·LME·국가는 공개 프로필/셀 인용 원행과 다시 연결해야 함 | 이 확인에서는 원격 공개 프로필 원행에 접근하지 못했으며 5종의 제공처/연도/해역을 임의 생성하지 않음. README의 2026-09-22 참굴 26건·살오징어 2건도 당시 요약이지 현재 8종 확정 값 아님 |

OBIS 시연의 데이터셋별 **원제공처 제목·URL·인용문·이용조건**은 `occurrence-sources.csv`에 19행 모두 기록했다. 이는 시연에 **포함된 출처 목록**이지 출처별 개별 건수 배분이 아니다. 참굴 자료에 일본 연구 데이터셋이 여럿 들어 있으므로 표의 넓은 사각형을 한국 현재 분포 지도처럼 설명할 수 없다. 채집 기간의 시작·끝은 개별 연구와 표본의 기록 연도 범위이며 연속적 조사기간이 아니다. 출현건수·격자수는 개체수, 자원량, 개체군 감소율이 아니다. 운영 공개 셀의 원좌표를 가져오거나 이 저장소에 복제하지 않았다.

## 방법, 원출처·이용조건

1. 최신 main SHA를 확인하고 `dist/data.json`의 3종 WoRMS 인용·OBIS 질의·기간·제공처와 `dist/live-data.js`의 공개 8종 로딩 방식을 읽었다. README의 운영지도 데이터는 Git 추적 밖의 `output/database/...`을 가리켜 이 스냅샷에서 원행을 검수할 수 없다. 공개 사이트에는 이 조회에서 로그인 화면이 나와 실제 운영 프로필 원행을 읽지 못했다.
2. WoRMS [종 검색](https://www.marinespecies.org/aphia.php?p=search)·[REST 안내](https://www.marinespecies.org/aphia.php?p=webservice), 위 표의 종별 레코드를 확인했다. 이용조건은 [WoRMS 안내](https://www.marinespecies.org/about.php)의 텍스트 CC BY 안내를 참고한다. 각 taxon의 오늘의 최신 상태는 페이지 직접 조회 실패 종에 한해 추가 확인이 필요하다.
3. IUCN 각 후보 학명으로 `iucnredlist.org/species/` 결과를 검색하고 평가 원문에서 **범주·기준, 평가일, 발표연도, 지리적 범위**를 함께 찾아 연결했다. 돌기해삼의 IUCN 문서 [원평가 PDF의 공개 사본](https://www.researchgate.net/profile/Annie-Mercier/publication/295098284_Apostichopus_japonicus_The_IUCN_Red_List_of_Threatened_Species_2013_eT180424A1629389/links/56c7707108aee3cee5394ac8/Apostichopus-japonicus-The-IUCN-Red-List-of-Threatened-Species-2013-eT180424A1629389.pdf) p. 1–2에서 EN A2bd·2013·2010-05-19·북서태평양 전역을 확인했다. [IUCN 이용약관](https://www.iucnredlist.org/terms/terms-of-use)을 따르며 PDF 자체는 저장소에 복제하지 않았다. 원문은 교육·비상업 이용 시 출처 인용, 상업 재게시·재배포는 별도 허가를 요구한다. 해당 평가의 최신 대체판 여부는 IUCN 원 사이트에서 재확인할 일이다.
4. OBIS [출판·라이선스 지침](https://manual.obis.org/data_publication.html)과 [민감 위치 정책](https://manual.obis.org/policy.html), GBIF [이용약관](https://www.gbif.org/terms)을 확인했다. 데이터셋별 CC0 / CC BY / CC BY-NC 4.0은 `dist/data.json`의 2026-09-22 스냅샷을 그대로 기록했다. CC BY-NC가 포함되므로 통째 재배포나 상업 전용을 승인하지 않는다. 링크·간단한 메타데이터만 기록한다.

## 남은 확인

- 운영 공개 프로필의 8행에서 **한국어명–승인 학명–AphiaID**, 발행 시점, 출현 `period_start/end`, `public_citations`, 공개 셀의 `sea_areas/countries/citations`를 종별로 동결한다. 이 브랜치에서는 DB 읽기 실패로 그 결과를 대신 쓰지 않았다.
- 우뭇가사리의 WoRMS 212186 현재 상태, ‘해삼’과 ‘홍합’ 통용명 범위, 톳의 구명 조합을 원분류 레코드로 재검수한다.
- IUCN 7종은 실제 평가 레코드를 찾을 때까지 범주·연도·범위를 모두 보류한다. 돌기해삼은 2013년판 이후의 평가가 있는지 확인하고 국가별 평가와 전 세계 평가를 구분한다.
- 별도 진행 중인 [실제 종 시범 점수 PR #6](https://github.com/gyunghun1214/blue-bio-map/pull/6)의 문서에 “돌기해삼 IUCN 평가 없음”으로 적힌 부분은 **이 조사에서 찾은 2013년 원평가를 반영해 수정해야 한다**. 평가가 오래되었고 운영 ‘해삼’과의 동일성도 미확인이라 이 PR에서 점수를 생성하지 않는다.

## 추가 확인 (2026-09-25): 돌기해삼 2026년 IUCN 평가

GBIF가 수록한 IUCN 적색목록 체크리스트(2026-07-28판)의 *Apostichopus japonicus*(IUCN 180424) 항목이 **새 평가**를 인용한다: Hamel, J.-F. & Mercier, A. 2026. *Apostichopus japonicus* (Selenka, 1867). The IUCN Red List of Threatened Species 2026. [DOI 10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en](https://doi.org/10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en). 범주 **EN**, 범위 Global. DOI는 IUCN 평가 페이지(평가 ID 272708369)로 연결되고, 2013년 평가(ID 1629389)와 다르다.

- 확인 경로: GBIF 종 API의 IUCN 체크리스트 레코드(`/species/176598261/distributions`)와 DOI 해석. IUCN 사이트는 자동 접근을 막아(403) 원문은 열지 못했다.
- 따라서 2013년 EN A2bd는 **대체된 이전 평가**다. 사이트는 2026년 평가를 현행으로, 2013년 평가를 이전 평가로 표시한다.
- 아직 확인하지 않은 것: 2026년 평가의 **기준(criteria)·평가일·범위 세부**. 사람이 원문을 읽고 검수하기 전에는 MCUI 입력(`reviewed: true`, `current_status_check`)으로 쓰지 않는다.
