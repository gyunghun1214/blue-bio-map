# 사전 등록: MBPI 최상위 항목 독립 재현 검색 (2026-10-15)

**이 문서는 검색 결과를 보기 전에, 이 파일 하나만 커밋한다.** 결과를 본 뒤 이 문서의 규칙을 고치지 않는다. 검색 결과가 순위나 유형을 바꾸더라도 규칙은 고치지 않는다. 고칠 이유가 생기면 날짜를 붙여 덧붙이고, 그 규칙은 다음 검색부터 쓴다.

계기: 팀장(LKH)의 2026-10-15 '근거 논문 1편' 정리 요청 2부(프롬프트 v2: 프로젝트 파일 `prompts/evidence-profile-claude-code-v2.md`). 1부(verified-4.16, PR #194, 2026-10-15 병합)는 근거 프로필을 표시만 했다. 이 2부는 근거를 실제로 늘릴 수 있는지 찾는다.

## 0. 이미 본 것 (숨기지 않는다)

- 2026-10-09/10에 26종을 찾아 1건(갑오징어 Bonini 2000)을 찾았다. 이 건은 4.11 같은 기원 규칙에 따라 다시 빠졌다. 기록은 프로젝트 파일 `research/replication-search-2026-10-09.md`에 있다.
- 2026-10-13에 29종을 다시 찾았고 모두 '없음'이었다. 그때 본 범위는 2025-06~2026-10 새 논문, ChEMBL 37 판이다. 기록은 프로젝트 파일 `research/evidence-search-2026-10-13.md` 부록 B에 있다.
- 그 뒤 최상위 항목이 바뀐 종은 넙치 하나다. 4.13에서 ACE MEVFVP가 항균 P35로 바뀌었다. 그래서 넙치는 현재 최상위 항목으로 처음 찾는다.
- 이번 검색은 앞선 범위를 반복하지 않는다. 대상은 2026-10-13 이후에 나온 문헌, 그때 열지 못한 검색원(Europe PMC·KCI), ChEMBL 새 판 여부다.
- 결과를 미리 짐작할 근거는 있다. 앞선 두 번의 검색이 '없음'이었으므로, 이번에도 대부분 '없음'일 것으로 예상한다.

## 1. 바뀌지 않는 것

근거 계수(재현 없음 0.75, ChEMBL 층은 연결 계수 × 활성 계수, 예 0.5625), 층화 규칙, 층 내부 백분위 산식, 식품 가중치 w=0.50, 매트릭스 구분선 50, 4.11 같은 기원 규칙, 효능 차이 기준(pIC50·pChEMBL 1.0), 사후 검증 사례와 판정 문장은 바꾸지 않는다. `supplementary-literature.json`·`trait-evidence.json`의 '점수 미사용' 문헌은 점수에 넣지 않는다.

## 2. 대상과 순서 (현재 공개본 verified-4.16의 최상위 항목)

| 순서 | 종 | 최상위 항목 | 층 | 원논문 |
|---|---|---|---|---|
| 1 | 피조개 *Anadara broughtonii* | WYIRKIRRFFKWLKKKLKKK, HT-29 IC50 | 항암 CancerPPD | 10.3390/md20020110 |
| 2 | 참굴 *Magallana gigas* | LQP, ACE IC50 (HHL) | ACE 펩타이드 | 10.5352/jls.2012.22.2.220 |
| 3 | 가시파래 *Ulva prolifera* | KAF, ACE IC50 (HHL) | ACE 펩타이드 | 10.3390/md22090398 |
| 4 | 참문어 *Octopus sinensis* | CYFRNCPIG, EC50 (ChEMBL 37) | ChEMBL | 10.3390/md20050328 |
| 5 | 갑오징어 *Acanthosepion esculentum* | FMRF-NH2, NPFF2 Ki (ChEMBL 37) | ChEMBL | 10.1021/acs.jmedchem.0c00643 |
| 6 | 톳 *Sargassum fusiforme* | GKY, ACE IC50 (HHL) | ACE 펩타이드 | 10.2331/suisan.64.862 |
| 7 | 바지락 *Ruditapes philippinarum* | VISDEDGVTH, ACE IC50 (HHL) | ACE 펩타이드 | 10.1039/c8fo01146j |
| 8 | 감태 *Ecklonia cava* | ChEMBL 37 Ki 항목(CHEMBL5118 표적) | ChEMBL | 원논문 5편(공개본 `bioactivity_trace`) |
| 9 | 꼬시래기 *Gracilaria vermiculophylla* | ChEMBL 37 Potency 항목(CHEMBL2392 표적) | ChEMBL | 10.1371/journal.pone.0029359 |
| 10 | 가리맛조개 *Sinonovacula constricta* | VQY, ACE IC50 (HHL) | ACE 펩타이드 | 10.3390/md14060110 |
| 11 | 살오징어 *Todarodes pacificus* | YALPHA, ACE IC50 (HHL) | ACE 펩타이드 | 10.1271/bbb.60.1353 |
| 12 | 멸치 *Engraulis japonicus* | DGGP, ACE IC50 (HHL) | ACE 펩타이드 | 10.1007/s13765-015-0129-4 |
| 13 | 고등어 *Scomber japonicus* | PLITT, ACE IC50 (HHL) | ACE 펩타이드 | 10.1016/j.foodchem.2024.138873 |
| 14 | 참조기 *Larimichthys polyactis* | WDDMEKIW, XO IC50 | XO 펩타이드 | 10.3390/foods12050982 |
| 15 | 대구 *Gadus macrocephalus* | GASSGMPG, ACE IC50 (HHL) | ACE 펩타이드 | 10.1016/j.procbio.2016.07.006 |
| 16 | 넙치 *Paralichthys olivaceus* | P35 SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK, MIC | 항균 DBAASP | 10.3390/ijms232112722 |

## 3. 검색원

순서대로 쓴다. 열리지 않는 곳은 "열지 못함"과 날짜를 기록하고, 그 검색원은 찾은 것으로 세지 않는다.

1. PubMed (커넥터): 2026-10-13 이후 등록분, 넙치는 전체 기간.
2. Europe PMC (웹 검색 화면 또는 REST). 2026-10-13에는 열리지 않았다.
3. KCI (한국학술지인용색인). 2026-10-13에는 본문을 열지 못했다.
4. ChEMBL: 최신 판 번호를 확인한다. ChEMBL 층 4종(참문어·갑오징어·감태·꼬시래기)은 두 번째 독립 측정이 ChEMBL 문서여야 하므로, 새 판(38)이 없으면 바뀔 수 없다. 새 판이 없으면 그 사실과 확인 출처를 적고 끝낸다.
5. 일반 웹 검색: 서열 문자열 그대로, 학명과 이명, 한·중·일 검색어.

## 4. 검색어 규칙

- 학명: 공개본 학명과 WoRMS 이명(예: *Crassostrea gigas*, *Enteromorpha prolifera*, *Hizikia fusiformis*, *Patinopecten*, *Octopus vulgaris* 동아시아 개체군 표기)을 OR로 묶는다.
- 펩타이드는 한 글자 서열을 그대로 쓰고, 4잔기 이하는 세 글자 표기(예: Leu-Gln-Pro)도 함께 쓴다. 저분자는 화합물 이름과 InChIKey를 쓴다.
- 표적·시험명을 함께 쓴다(ACE·angiotensin, xanthine oxidase, HT-29, MIC·antimicrobial, NPFF2).
- 종당 상한: 검색원마다 질의 4개, 초록을 읽는 후보는 종당 15건, 원문까지 여는 후보는 종당 5건. 상한에 닿으면 멈추고 그 사실을 적는다.

## 5. 인정 기준 (기존 4.11 규칙과 2026-10-14 팀 결정 그대로)

재현으로 세려면 다음을 **모두** 만족해야 한다.

1. **같은 종 유래 시료.** 이 종에서 정제·분리한 시료여야 한다. 합성품, 다른 생물, 시판 표준품, 서열 단편은 세지 않는다(4.11 규칙 1).
2. **같은 분자.** 같은 서열이거나 같은 화합물이어야 한다.
3. **같은 표적·같은 시험 유형.** ACE 층은 HHL 기질 IC50(µM, '=' 값)이어야 한다. FAPGG·억제율·mg/mL만 있는 값은 세지 않는다. 다른 층은 원 항목과 같은 표적과 같은 측정 종류여야 한다.
4. **효능 차이.** 원 값과의 차이가 pIC50(또는 pChEMBL) 1.0 이내여야 한다.
5. **다른 연구 그룹.** 원논문 저자와 겹치는 저자가 있으면 세지 않는다. 같은 연구실의 후속 논문도 세지 않는다. 그룹이 같을 가능성이 확인되지 않으면 '같은 연구 그룹 가능성'으로 세지 않는다(4.9 Kotani 처리와 같다).
6. **DOI가 있는 논문.** DOI 없는 문헌, 특허, DB 재수록(BIOPEP·AHTPDB 카드 등), 리뷰의 값 전재는 세지 않는다.
7. **ChEMBL 층**은 두 번째 측정이 ChEMBL 문서로 들어와 있어야 한다. 논문만 있고 ChEMBL에 없으면 단서로만 적는다.

## 6. 산출물

- 종별 표: 최상위 항목 / 후보 DOI / 인정 여부와 사유 / 검색일 / 검색원. 공유 폴더 `research/replication-search-2026-10-15.md`와 저장소 `research/verified-indices/replication-search-2026-10-15.md`에 둔다.
- 표시 전용 검색 기록 `dist/replication-search.json`. 종마다 검색일, 검색원(열지 못한 곳 포함), 검색한 최상위 항목, 결과(`searched_none` · `accepted`)를 담는다. 점수 계산은 이 파일을 읽지 않는다.
- 근거 프로필 표시:
  - 재현을 못 찾은 종: '검색했으나 독립 재현 없음(검색일, 검색원)'. 이 문구는 접힌 MBPI 근거 상세에 둔다. 카드와 프로필 앞면은 1부의 담담한 상태 이름을 그대로 쓴다(팀장 피드백 2026-10-15).
  - 검색 기록이 없는 종: '재현 검색 기록 없음'
  - 검색한 항목이 현재 최상위 항목과 다른 종: '현재 최상위 항목 검색 전'
- 인정된 재현이 생기면 기존 파이프라인으로만 다시 계산한다. 재현 행을 설정에 추가하고 버전을 올린다. 손으로 JSON을 고치지 않는다. 그 경우에는 변경 전후 점수·유형 표와 MBPI 사후 검증 재실행 결과를 그대로 남긴다.
- 인정된 재현이 없으면 점수와 지표 버전은 그대로 두고, 검색 기록과 표시만 PR로 낸다.
