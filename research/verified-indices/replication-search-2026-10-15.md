# MBPI 최상위 항목 독립 재현 검색 결과 (2026-10-15)

사전 등록: `research/verified-indices/prereg-replication-search-2026-10-15.md` (검색 전 단독 커밋 5783621). 규칙은 고치지 않았다.

**결과: 16종 모두 기준에 맞는 독립 재현 없음.** 점수·유형·지표 버전(verified-4.16)은 그대로다. 사후 검증 재실행과 탐험 정류장 재생성은 필요 없다(점수 변화 없음).

- ChEMBL 판: 37(2026-05)이 여전히 최신이다(ChEMBL 다운로드 문서, ChEMBL 블로그 2026-09-25 글까지 확인). 그래서 ChEMBL 층 4종(참문어·갑오징어·감태·꼬시래기)은 이번에 바뀔 수 없다(사전 등록 3-4, 5-7).
- 열지 못한 검색원(2026-10-15): KCI(robots 차단), Europe PMC(REST 429·사이트 robots 차단, 가시파래 질의 1건만 열림). 이 검색원은 찾은 것으로 세지 않았다.
- PubMed는 2026-10-13 이후 등록분(넙치는 전체 기간)을 찾았다.

| 순서 | 종 | 최상위 항목 | 검색원(찾음) | 열지 못함 | 결과 |
|---|---|---|---|---|---|
| 1 | 피조개 | WYIRKIRRFFKWLKKKLKKK (anticancer-cancerppd-ic50-ht-29) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 2 | 참굴 | LQP (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 3 | 가시파래 | KAF (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · Europe PMC · 웹 검색 | KCI | 독립 재현 없음 |
| 4 | 참문어(동아시아 종) | CYFRNCPIG (ChEMBL_37:CHEMBL1921\|EC50) | PubMed · ChEMBL 판 확인 | Europe PMC · KCI | 독립 재현 없음 |
| 5 | 갑오징어 | FMRF (ChEMBL_37:CHEMBL5952\|Ki) | PubMed · ChEMBL 판 확인 | Europe PMC · KCI | 독립 재현 없음 |
| 6 | 톳 | GKY (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 7 | 바지락 | VISDEDGVTH (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 8 | 감태 | CHEMBL508791 (ChEMBL_37:CHEMBL5118\|Ki) | PubMed · ChEMBL 판 확인 | Europe PMC · KCI | 독립 재현 없음 |
| 9 | 꼬시래기 | CHEMBL1084643 (ChEMBL_37:CHEMBL2392\|Potency) | ChEMBL 판 확인 · PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 10 | 가리맛조개 | VQY (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 11 | 살오징어 | YALPHA (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 12 | 멸치 | DGGP (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 13 | 고등어 | PLITT (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 14 | 참조기 | WDDMEKIW (xo-peptide-literature-2026-10-05) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 15 | 대구 | GASSGMPG (ahtpdb-ace-ic50-hhl-cushman-cheung) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |
| 16 | 넙치 | SKEKIDRLLNKACNGIKCKL… (amp-dbaasp-mic-broth-vibrio-anguillarum) | PubMed · 웹 검색 | Europe PMC · KCI | 독립 재현 없음 |

종별 검색어, 후보 DOI와 탈락 사유(인정 기준 번호)는 아래 두 부록에 있다. 화면에는 종별 MBPI 근거 상세(접힘)에만 '재현 검색: 검색했으나 독립 재현 없음(검색일, 검색원)'으로 보인다(`dist/replication-search.json`, 표시 전용).

---

# 부록 A. 1–8번 종

## 독립 재현 검색 part A (8종, 검색일 2026-10-15) — 사전등록 `prereg-replication-search-2026-10-15.md` 규칙 그대로 적용

범위: (a) 2026-10-13 이후 등록·공개 문헌, (b) 지난번 열지 못한 검색원(Europe PMC·KCI) 재시도, (c) ChEMBL 새 판 여부. 2026-10-13 부록 B에서 이미 본 범위는 반복하지 않았다.

## 0. 검색원 상태 (공통)

| 검색원 | 상태 | 비고 |
|---|---|---|
| PubMed (커넥터) | 검색함 | `edat` 2026/10/13–2026/10/15. 종당 질의 1건. 대조 질의 `peptide` 동일 창에서 361건 → 날짜 필터 정상 작동 확인(0건이 필터 오류가 아님). |
| Europe PMC | **대부분 열지 못함 (2026-10-15)** | REST(WebFetch) 질의 5건 시도 → 1건만 응답(가시파래), 4건은 프록시가 HTTP 429로 거부(60초·4분 대기 후 재시도도 거부). europepmc.org 웹 화면은 robots 차단. 셸 curl은 프록시 CONNECT 403. → 가시파래만 '검색함', 나머지 7종은 '열지 못함'. |
| KCI (kci.go.kr) | **열지 못함 (2026-10-15)** | `https://www.kci.go.kr/kciportal/main.kci` robots 차단(ROBOTS_DISALLOWED). 본문·검색 화면 모두 접근 불가. 8종 전부 '열지 못함'. |
| ChEMBL (판 번호) | 검색함 | 아래 §0-1. |
| 일반 웹 검색 | 검색함 | 비(非)ChEMBL 층 5종에 종당 질의 1건(extended). |

### 0-1. ChEMBL 판 번호 확인 결과 — 여전히 37

독립 출처 3곳, 모두 2026-10-15 확인:

1. ChEMBL Interface Documentation / Downloads — 최신 = **CHEMBL37, 2026년 5월**. ChEMBLdb·ChEMBL-RDF 표도 37.0이 현재 판.
2. ChEMBL-og 블로그 첫 화면 — 최신 글 2026-09-25(New SureChEMBL Interface and APIs). **ChEMBL 38 릴리스 공지 없음.**
3. macinchem.org 2026-05-30 "ChEMBL 37 is out" — 37 발표, 38 언급 없음.

사전등록 §3.4에 따라, ChEMBL 층 종(참문어·갑오징어·감태)은 두 번째 측정이 ChEMBL 문서로 들어와야 하므로 **새 판이 없는 이번 사이클에는 변동 불가**이고, 그 사실과 출처를 적고 끝낸다.

---

## 1. 피조개 *Anadara broughtonii* (aphia 504357)

- 최상위 항목: WYIRKIRRFFKWLKKKLKKK, HT-29 IC50, 항암 CancerPPD 층, 원논문 10.3390/md20020110
- 검색일: 2026-10-15
- PubMed: `(Anadara broughtonii OR Scapharca broughtonii) AND (peptide OR anticancer OR antimicrobial)`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- 일반 웹 검색: `"WYIRKIRRFFKWLKKKLKKK" Anadara broughtonii HT-29 anticancer peptide` (extended) → 서열 일치 신규 논문 0건

후보(초록 3건, 원문 1건):

| 후보 | DOI | 판정 | 사유(기준 번호) |
|---|---|---|---|
| Antimicrobial Peptides as New Combination Agents in Cancer Therapeutics (HT-29 스페로이드) | 10.3390/ijms21186964 | 불인정 | 다른 펩타이드·합성품, 피조개 유래 아님 (1, 2) |
| Enzymatic optimization for enhancing earthworm peptide yields and biological activities (원문 확인) | 10.3389/fbioe.2026.1957959 | 불인정 | 지렁이 *Amynthas arenulus* 유래, 서열 미동정 분획, HT-29 IC50가 mg/mL 단위 (1, 2, 3) |
| Toxicity of synthesized inverse carnosine peptide analogues on HepG2/HT-29 | — (PMID 29372035) | 불인정 | 합성 카르노신 유사체, 타 분자 (1, 2) |

**판정: searched_none**

---

## 2. 참굴 *Magallana gigas* (836033; 이명 *Crassostrea gigas*)

- 최상위 항목: LQP (Leu-Gln-Pro), ACE IC50 (HHL 기질), 원논문 10.5352/jls.2012.22.2.220
- 검색일: 2026-10-15
- PubMed: `(Magallana gigas OR Crassostrea gigas OR oyster) AND peptide AND (ACE OR angiotensin-converting)`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- 일반 웹 검색: `"Leu-Gln-Pro" OR "LQP" oyster Crassostrea gigas ACE inhibitory peptide hippuryl-histidyl-leucine IC50` (extended)

후보(초록 3건):

| 후보 | DOI | 판정 | 사유(기준 번호) |
|---|---|---|---|
| Pacific Oyster-Derived ADH Activating Peptide Leu-Gln-Pro-Pro-Arg (JAFC 2025) | 10.1021/acs.jafc.5c05752 | 불인정 | LQPPR 오펩타이드로 **분자 다름**, 표적이 알코올탈수소효소(ACE 아님) (2, 3) |
| In silico prospecting of ADH activating peptides from Pacific oyster (Food Chem 2025, PMID 40081072, PubMed 메타데이터로 DOI 확인) | 10.1016/j.foodchem.2025.143777 | 불인정 | in silico 스크리닝 + ADH 표적, LQP의 ACE IC50 측정 아님. 위 JAFC LQPPR 논문과 같은 그룹(廣東海洋大 Zheng Zhihong 등) (2, 3) |
| *C. gigas* 유래 AEYLCEAC (HHL, IC50 4.29 mM) | 10.3389/fnut.2022.981163 | 불인정 | 분자 다름, 효능 차이 1 log 초과(2026-10-13에도 동일 판정) (2, 4) |

(LQP 기원인 옥수수 α-zein 합성 펩타이드 10.1271/bbb1961.55.1313은 기존대로 '다른 기원'으로 제외 유지.)

**판정: searched_none**

---

## 3. 가시파래 *Ulva prolifera* (234476; 이명 *Enteromorpha prolifera*)

- 최상위 항목: KAF (Lys-Ala-Phe), ACE IC50 (HHL 기질), 원논문 10.3390/md22090398
- 검색일: 2026-10-15
- PubMed: `(Ulva prolifera OR Enteromorpha prolifera OR Ulva) AND peptide`, edat 2026/10/13–15 → **0건**
- **Europe PMC: 검색함** (이번 라운드에서 유일하게 응답한 Europe PMC 질의) — `KAF AND ACE AND Ulva` → **5건**
- KCI: **열지 못함 (2026-10-15, robots)**
- 일반 웹 검색: `"Lys-Ala-Phe" OR "KAF peptide" Ulva prolifera Enteromorpha ACE inhibitory IC50 purified 2026` (extended)

후보(초록 5건):

| 후보 | DOI | 판정 | 사유(기준 번호) |
|---|---|---|---|
| Preparation and Vasodilation Mechanism of ACE Inhibitory Peptide from *Ulva prolifera* Protein | 10.3390/md22090398 | 불인정 | **원논문 자체** (5: 같은 저자군) |
| Marine Bioactive Peptides—Structure, Function, and Application 2.0 (편집자 서문) | — | 불인정 | 리뷰/편집자 서문, 값 전재 (6) |
| Targeting the Cardiovascular–Alzheimer's Disease Axis: Marine Bioactive Peptides | — | 불인정 | 리뷰, 값 전재 (6) |
| Research Progress on the Mechanism of Action of Food-Derived ACE-Inhibitory Peptides | — | 불인정 | 리뷰, 값 전재 (6) |
| From Sea to Lab: ACE Inhibition by Marine Peptides—Mechanisms and Applications | — | 불인정 | 리뷰, 값 전재 (6) |
| (웹 검색) 땅콩 단백 유래 ACE 저해 펩타이드 / *Laminaria digitata* 가수분해물 | 10.1371/journal.pone.0111188 등 | 불인정 | 타 생물 유래 (1) |

**판정: searched_none**

---

## 4. 참문어 *Octopus sinensis* (534443)

- 최상위 항목: CYFRNCPIG, EC50, ChEMBL 37 항목, 원논문 10.3390/md20050328
- 검색일: 2026-10-15
- PubMed: `(Octopus sinensis OR Octopus vulgaris OR octopus) AND peptide`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- ChEMBL: 최신 판 **37** (§0-1, 출처 3곳). 재현은 두 번째 ChEMBL 문서여야 하므로 새 판 없이는 변동 불가 → 사전등록 §3.4대로 여기서 멈춤.

후보: 없음(0건).

**판정: searched_none**

---

## 5. 갑오징어 *Acanthosepion esculentum* (1666974; 이명 *Sepia esculenta*)

- 최상위 항목: FMRF-NH2, 사람 NPFF2 Ki, ChEMBL 37 항목(CHEMBL5952 표적), 원논문 10.1021/acs.jmedchem.0c00643
- 검색일: 2026-10-15
- PubMed: `(Sepia esculenta OR Acanthosepion OR cuttlefish) AND (peptide OR FMRFamide OR neuropeptide)`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- ChEMBL: 최신 판 **37** → 변동 불가, §3.4대로 멈춤.

후보: 없음(0건). 기존 제외 2건(Bonini 2000 합성·다른 기원, Kotani 2001 같은 연구 그룹 가능성)은 그대로 유지.

**판정: searched_none**

---

## 6. 톳 *Sargassum fusiforme* (494972; 이명 *Hizikia fusiformis*)

- 최상위 항목: GKY (Gly-Lys-Tyr), ACE IC50 (HHL 기질), 원논문 10.2331/suisan.64.862
- 검색일: 2026-10-15
- PubMed: `(Sargassum fusiforme OR Hizikia fusiformis OR Sargassum) AND peptide`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- 일반 웹 검색: `"Gly-Lys-Tyr" OR "GKY" Hizikia fusiformis Sargassum fusiforme ACE inhibitory peptide 分離 精製` (extended)

후보(초록 3건):

| 후보 | DOI | 판정 | 사유(기준 번호) |
|---|---|---|---|
| *Hizikia fusiformis* 당단백질의 아세트아미노펜 간손상 효과 | — | 불인정 | 당단백질, GKY 아님, ACE 측정 아님 (2, 3) |
| *Undaria pinnatifida* (wakame) 펩타이드의 SHR 혈압 효과 | — | 불인정 | 타 종 유래 (1) |
| ACE Inhibitory Activity of Protein Hydrolysates from *Laminaria digitata* | — (PMC9222848) | 불인정 | 타 종, 분획 단위 활성, 서열 미동정 (1, 2, 3) |

**판정: searched_none**

---

## 7. 바지락 *Ruditapes philippinarum* (231750)

- 최상위 항목: VISDEDGVTH, ACE IC50 (HHL 기질), 원논문 10.1039/c8fo01146j
- 검색일: 2026-10-15
- PubMed: `(Ruditapes philippinarum OR clam) AND peptide`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- 일반 웹 검색: `"VISDEDGVTH" Ruditapes philippinarum ACE inhibitory peptide` (extended) → 서열 일치 신규 논문 0건

후보(초록 3건):

| 후보 | DOI | 판정 | 사유(기준 번호) |
|---|---|---|---|
| Isolation, purification and the anti-hypertensive effect … *Ruditapes philippinarum* fermented with *Bacillus natto* | 10.1039/c8fo01146j | 불인정 | **원논문 자체** (5) |
| Food-derived Bioactive Peptides with ACE Inhibiting Effect: A Systematic Review | 10.1177/0976500X231175217 | 불인정 | 리뷰의 값 전재 (6) |
| Nine novel ACE inhibitory peptides from cuttlefish (*Sepia officinalis*) muscle hydrolysates | — | 불인정 | 타 종, 타 분자 (1, 2) |

**판정: searched_none**

---

## 8. 감태 *Ecklonia cava* (371986)

- 최상위 항목: **DIECKOL** (CHEMBL508791, InChIKey DRZQFGYIIYNNEC-UHFFFAOYSA-N), **Ki**, 표적 CHEMBL5118 (SARS 관련 코로나바이러스 Replicase polyprotein 1ab), 중앙 pChEMBL 5.62, ChEMBL 37 항목. 공개본 `bioactivity_trace`의 문서: **CHEMBL2390950 1건**. 원논문 5편: 10.1016/j.bmc.2009.01.031, 10.1016/j.bmc.2011.10.078, 10.1016/j.bmc.2013.04.026, 10.1155/2011/140462, 10.1248/bpb.27.544
- 검색일: 2026-10-15
- PubMed: `(Ecklonia cava OR dieckol OR phlorotannin) AND (protease OR inhibitor OR Ki OR antiviral)`, edat 2026/10/13–15 → **0건**
- Europe PMC: **열지 못함 (2026-10-15, HTTP 429)**
- KCI: **열지 못함 (2026-10-15, robots)**
- ChEMBL: 최신 판 **37** (§0-1). 이 화합물–표적–Ki 항목에 연결된 ChEMBL 문서는 **CHEMBL2390950 단 1건**이므로 두 번째 독립 ChEMBL 문서가 없다. 새 판이 없는 한 변동 불가 → §3.4대로 멈춤.

후보: 없음(0건).

**판정: searched_none**

---

## 비고 / 한계

- 8종 모두 **신규 재현 0건**. 2026-10-13 이후 2일 창의 PubMed 신규 등록분에는 8종 중 어느 종의 대상 분자도 없었다(대조 질의로 날짜 필터 정상 작동 확인).
- Europe PMC는 이번에도 사실상 열리지 않았다: REST 질의 5건 중 1건만 응답(가시파래), 나머지는 60초·4분 대기 후 재시도에도 HTTP 429. 웹 화면(europepmc.org)과 셸 curl은 각각 robots·프록시 403. 따라서 **7종은 Europe PMC를 검색한 것으로 세지 않았다.**
- KCI는 2026-10-13과 같은 이유로 또 열지 못했다(robots). **8종 전부 KCI 미검색.**
- 종당 상한(검색원별 질의 4개, 초록 15건, 원문 5건)에는 닿지 않았다. 사용량: 종당 PubMed 1질의, 웹 검색 0–1질의, 초록 0–6건, 원문 0–1건.
- 상한 미달인데 멈춘 이유는 두 가지뿐이다. (i) ChEMBL 층 3종은 사전등록 §3.4가 새 판 없으면 거기서 끝내라고 정해두었다. (ii) Europe PMC·KCI는 열리지 않았다.

```json
[
  {"aphia_id": 504357, "korean_name": "피조개", "searched_item": "WYIRKIRRFFKWLKKKLKKK / HT-29 IC50", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 836033, "korean_name": "참굴", "searched_item": "LQP / ACE IC50 (HHL)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 234476, "korean_name": "가시파래", "searched_item": "KAF / ACE IC50 (HHL)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "searched", "queries": 1}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 534443, "korean_name": "참문어", "searched_item": "CYFRNCPIG / EC50 (ChEMBL 37)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "ChEMBL", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 1666974, "korean_name": "갑오징어", "searched_item": "FMRF-NH2 / NPFF2 Ki (ChEMBL 37)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "ChEMBL", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 494972, "korean_name": "톳", "searched_item": "GKY / ACE IC50 (HHL)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 231750, "korean_name": "바지락", "searched_item": "VISDEDGVTH / ACE IC50 (HHL)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 371986, "korean_name": "감태", "searched_item": "DIECKOL (CHEMBL508791) / Ki, CHEMBL5118 (ChEMBL 37)", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 1}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "ChEMBL", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null}
]
```


---

# 부록 B. 9–16번 종

## MBPI 최상위 항목 독립 재현 검색 — part B (9~16번, 8종) · 2026-10-15

- 규칙: `research/verified-indices/prereg-replication-search-2026-10-15.md`(사전 등록본) 그대로. 규칙은 고치지 않았다.
- 범위: (a) 2026-10-13 이후 등록·출판 문헌, (b) 2026-10-13에 열지 못한 Europe PMC·KCI, (c) ChEMBL 새 판 여부. 넙치(#16)만 현재 최상위 항목(P35)을 처음 찾으므로 전 기간을 찾았다.
- 2026-10-13 부록 B에서 이미 본 후보는 다시 걸려도 새로 평가하지 않고 "기존 검토"로만 적었다.
- 인정 기준 번호는 사전 등록 5절: 1 같은 종 정제 시료 / 2 같은 분자 / 3 같은 표적·시험(ACE는 HHL IC50 µM, AMP는 같은 균 MIC) / 4 1.0 log 이내 / 5 다른 연구 그룹 / 6 DOI 논문(특허·DB·리뷰 불인정) / 7 ChEMBL 층은 ChEMBL 문서.

## 결과 요약

**8종 모두 searched_none. 인정된 재현은 없다.** 점수와 지표 버전은 바뀌지 않는다.

| # | 종 | 최상위 항목 | 결과 | 가장 가까운 후보와 탈락 이유 |
|---|---|---|---|---|
| 9 | 꼬시래기 | PGA2(CHEMBL1084643), CHEMBL2392 Potency | searched_none | ChEMBL 37이 아직 최신 판이라 기준 7에 따라 바뀔 수 없다 |
| 10 | 가리맛조개 | VQY, ACE IC50 HHL | searched_none | 새 문헌 0건. 걸린 것은 원논문 사본과 다른 종(*Batissa violacea*, in silico) |
| 11 | 살오징어 | YALPHA, ACE IC50 HHL | searched_none | 새 문헌 0건. Mar Drugs 2025는 기존 검토(기준 2·3) |
| 12 | 멸치 | DGGP, ACE IC50 HHL | searched_none | 새 문헌 0건. 멸치 관련 국내 논문은 서열 없이 억제율·분획 값만 있다(기준 2·3) |
| 13 | 고등어 | PLITT, ACE IC50 HHL | searched_none | 새 문헌 0건. *S. australasicus* 논문은 다른 종이고 % 억제율이다(기준 1·3) |
| 14 | 참조기 | WDDMEKIW, XO IC50 | searched_none | 새 문헌 0건. 식품과학 2026 XO 논문은 플라보노이드, 2025 논문은 주조박 유래 펩타이드(기준 1·2) |
| 15 | 대구 | GASSGMPG, ACE IC50 HHL | searched_none | 새 문헌 0건. 대구 관련 중국 논문은 억제율만 있고 서열이 없다(기준 2·3) |
| 16 | 넙치 | P35 (NKLnc 유래 35-mer), *V. anguillarum* MIC | searched_none | 넙치 NK-lysin 관련 다른 그룹 논문은 다른 분자(일반형 NKL 재조합 단백질, 27-mer 합성)이다(기준 1·2) |

열지 못한 검색원(2026-10-15):
- **Europe PMC**: REST(`www.ebi.ac.uk/europepmc/webservices/rest/search`)는 WebFetch 프록시가 HTTP 429로 거절했고 다시 시도하지 말라고 했다. 웹 화면(`europepmc.org/search`)은 robots로 막혔고, curl은 CONNECT 403이었다.
- **KCI**: 검색 화면(`kci.go.kr/kciportal/po/search/...`)과 논문 화면(`kciportal/landing/article.kci?...`)이 모두 robots로 막혔고, curl은 CONNECT 403이었다.
- 두 곳은 **열지 못함**으로 적고, 찾은 것으로 세지 않는다. `site:` 제한 일반 웹 검색으로 두 도메인을 한 번씩 훑었다. 이 결과는 "일반 웹 검색" 항목에만 적었다.

공통 메모:
- PubMed의 `date_from`만 준 첫 질의는 날짜 필터가 걸리지 않았다(전 기간 결과). 그래서 그 결과는 후보로 읽지 않고 버렸다. `date_from=2026/10/13, date_to=2026/12/31, datetype=edat`(질의 번역에 `2026/10/13:2026/12/31[Date - Entry]` 확인)로 다시 돌렸다. 버린 질의도 질의 수에 넣었다.
- 펩타이드 7종이 함께 쓴 질의가 둘 있다. (i) ACE 펩타이드 일반 질의, 등록일 2026-10-13 이후: 1건(10.1002/biof.70160, 인도 치즈 펩타이드, 무관). (ii) 서열 묶음 질의, 전 기간: 21건. 여기서 대상과 관련된 것은 원논문 2건(10.3390/md14060110, 10.3390/foods12050982)뿐이다. 나머지는 "Yα" 같은 표기가 YALPHA에 잘못 맞은 무관 문헌이다. GASSGMPG는 PubMed 색인어에 없어 질의 번역에서 빠졌다. 공유 질의는 해당 종마다 1개로 셌다.
- ChEMBL 판: ChEMBL Interface Documentation Downloads 페이지의 최신 판은 "CHEMBL37 | May 2026"이다(2026-10-15 확인). 웹 검색 "ChEMBL 38 release"에도 38판 공지가 나오지 않았다. 참고로 ChEMBL MCP 커넥터는 v34 기반이어서 판 확인에 쓰지 않았다.

---

## 9. 꼬시래기 *Gracilaria vermiculophylla* (aphia 236157)

- 현재 최상위 항목: ChEMBL 37 'Potency' 항목. PROSTAGLANDIN A2(CHEMBL1084643, InChIKey MYHXHCUNDDAEOZ-FOSBLDSVSA-N), 표적 CHEMBL2392 DNA polymerase beta(사람), median pChEMBL 5.5, activity_id 5031175, 문서 CHEMBL1201862(PubChem qHTS), 기원 연결 논문 10.1371/journal.pone.0029359.
- 검색일: 2026-10-15
- 검색원:
  - ChEMBL: 최신 판은 37(Downloads 페이지)이다. 38판이 없으므로 사전 등록 3절 4항에 따라 여기서 끝냈다.
  - PubMed: 2개 질의. ① 날짜 필터 실패 질의(버림). ② `(Gracilaria vermiculophylla OR Gracilaria) OR (prostaglandin A2 AND DNA polymerase beta)`, 등록일 2026-10-13 이후: 3건.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 1개 질의("ChEMBL 38 release", ChEMBL 판 확인용)
- 후보:
  - 10.3389/fmicb.2026.1935663: *G. tenuistipitata* 내생 세균의 추출물이다. 다른 종이고 다른 분자다(기준 1·2). 또 ChEMBL 문서가 아니다(기준 7).
  - 10.1016/j.marenvres.2026.108460: *G. caudata* 열파 생리 연구. 활성 측정이 없다(기준 1·2·3).
  - 10.3389/fnut.2026.1959089: 대서양 해조 영양 성분 연구. 무관하다(기준 2·3).
- 판정: **searched_none** (ChEMBL 38 미공개라 기준 7상 변경 불가)

## 10. 가리맛조개 *Sinonovacula constricta* (aphia 413600)

- 현재 최상위 항목: VQY (Val-Gln-Tyr), ACE IC50 9.8 µM (HHL), 원논문 10.3390/md14060110
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 4개 질의. ① 날짜 필터 실패 질의(버림). ② `Sinonovacula constricta`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의(전 기간): VQY 관련은 원논문뿐이다. ④ ACE 펩타이드 일반 공유 질의(등록일 이후): 1건, 무관.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 3개 질의. `"VQY" razor clam Sinonovacula ACE inhibitory peptide 2026`: 9건. `缢蛏 ACE抑制肽 VQY 分离纯化 2026`: 9건. europepmc.org로 제한한 `Sinonovacula constricta ACE peptide`: 2건(무관한 PDF).
- 후보(초록 또는 페이지 확인 4건):
  - orca.cardiff.ac.uk/168397: 원논문(10.3390/md14060110)의 기관 저장소 사본이다. 원논문이므로 재현이 아니다(기준 5·6).
  - 10.21608/ejabf.2025.440926: *Batissa violacea* 펩타이드의 in silico 연구다. 다른 종, 다른 분자이고 실측이 없다(기준 1·2·3).
  - 10.12383/SciencepaperOnline.201307.0034: 카제인 유래 ACE 펩타이드. 다른 원료, 다른 서열이다(기준 1·2).
  - PMC12735907(셀레늄 강화 굴 ACE 펩타이드): 제목으로 다른 종임을 확인했다(기준 1). 같은 계열은 10-13 검색에서 이미 검토했다.
- 판정: **searched_none**

## 11. 살오징어 *Todarodes pacificus* (aphia 342067)

- 현재 최상위 항목: YALPHA, ACE IC50 9.8 µM (HHL), 원논문 10.1271/bbb.60.1353
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 4개 질의. ① 날짜 필터 실패 질의(버림). ② `(Todarodes pacificus OR squid) AND (peptide OR ACE OR angiotensin)`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의: YALPHA로 걸린 것은 모두 "Yα" 표기 오검출이다. ④ ACE 일반 공유 질의: 1건, 무관.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 2개 질의. `"YALPHA" squid Todarodes ACE inhibitory peptide`: 9건. `スルメイカ ACE阻害ペプチド Tyr-Ala-Leu-Pro-His-Ala 精製`: 9건(특허, 오키나와현 보고서, 시약 카탈로그, 사람 카제인 펩타이드).
- 후보(4건):
  - 10.3390/md23020081 (Mar Drugs 2025, 살오징어 껍질): 기존 검토. 다른 서열, FAPGG 기질, mg/mL 단위다(기준 2·3).
  - PMC6747323 (IJMS 2019, *T. pacificus* in silico + 합성): 기존 검토. 합성품이고 다른 서열이다(기준 1·2).
  - pep-lab.info 펩타이드 카드(375·430), rethinkpeptides 페이지: 원값을 다시 실은 DB 또는 요약이다(기준 6).
  - 10.3746/jkfn.2010.39.11.1654 (오징어 간 젓갈 소스 ACE 펩타이드, 2010): 서열이 없고, 분획 IC50만 µg 단위로 있다. 종명도 적혀 있지 않다(기준 1·2·3).
- 판정: **searched_none**

## 12. 멸치 *Engraulis japonicus* (aphia 219984)

- 현재 최상위 항목: DGGP (Asp-Gly-Gly-Pro), ACE IC50 163.51 µM (HHL), 원논문 10.1007/s13765-015-0129-4
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 4개 질의. ① 날짜 필터 실패 질의(버림). ② `(Engraulis japonicus OR anchovy) AND (peptide OR ACE OR angiotensin)`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의(`DGGP AND anchovy` 포함): 0건 추가. ④ ACE 일반 공유 질의: 1건, 무관.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15). kci.go.kr로 제한한 웹 검색 `멸치 ACE 저해 펩타이드 정제`는 10건이었지만 멸치 논문이 없었다. 해당 KCI 논문 화면도 robots로 막혔다.
  - 일반 웹: 3개 질의. `"DGGP" anchovy Engraulis japonicus ACE inhibitory peptide`: 9건. `Asp-Gly-Gly-Pro anchovy sauce ACE inhibitory peptide purified 2026`: 9건. kci.go.kr로 제한한 질의 1개.
- 후보(6건):
  - pure.ul.ie, scholarworks.gnu.ac.kr/15698: 원논문 자체다(Kim HJ, Kang SG, Jaiswal L, Li J, Choi JH, Moon SM, Cho JY, Ham KS, 2016)(기준 5).
  - US 11753442, US 12291580: 특허다(기준 6).
  - 한국수산과학회지 31(6):875 (1998, *E. japonica* 근육 가수분해물): 서열이 없고, 억제율 %만 있으며, DOI가 없다(기준 2·3·6).
  - 10.3746/jkfn.2003.32.7.1120 (멸치액젓 펩타이드, 2003): 서열이 없고, GPC 분획 IC50만 µg/mL 단위로 있다(기준 2·3).
  - portalcientifico.uvigo.gal 레코드: 고등어 PLITT 원논문(10.1016/j.foodchem.2024.138873)이다. 다른 종이다(기준 1·2).
  - 10.13386/j.issn1002-0306.2023070015: 해삼이다. 다른 종이다(기준 1·2).
- 판정: **searched_none**

## 13. 고등어 *Scomber japonicus* (aphia 127022)

- 현재 최상위 항목: PLITT, ACE IC50 48.73 µM (HHL), 원논문 10.1016/j.foodchem.2024.138873 (Wang B, Zhang H, Wen Y, Yuan W, Chen H, Lin L, Guo F, Zheng Z-P, Zhao C; Quanzhou Normal Univ). J Food Sci 2025(10.1111/1750-3841.70767, Zhang Hui 등)는 저자가 겹친다. 10-13에 이미 기준 2·5로 탈락했다.
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 4개 질의. ① 날짜 필터 실패 질의(버림). ② `(Scomber japonicus OR mackerel) AND (peptide OR ACE OR angiotensin)`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의(`PLITT AND mackerel`): 0건. ④ ACE 일반 공유 질의: 1건, 무관.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 2개 질의. `"PLITT" peptide mackerel Scomber japonicus ACE`: 10건. `日本鲭 ACE抑制肽 PLITT 鉴定 2026`: 9건.
- 후보(5건):
  - uvadoc.uva.es/10324/74738, portaldelaciencia.uva.es (스페인 그룹 mackerel skin gelatine): 기존 검토. PLITT가 없다(기준 2).
  - 10.3390/foods11121785 (Taiwan mackerel *S. australasicus* 증자액): 다른 종이고, in silico와 % 억제율뿐이다(기준 1·2·3).
  - PMC9355146 (참치 정소), PMC10252845 (*Sardina pilchardus*): 다른 종이다(기준 1·2).
  - US 12291580, US 11753442: 특허다(기준 6).
- 판정: **searched_none**

## 14. 참조기 *Larimichthys polyactis* (aphia 281273)

- 현재 최상위 항목: WDDMEKIW (WW8), xanthine oxidase IC50 3.16 mM (소 우유 XO, 요산 290 nm), 원논문 10.3390/foods12050982
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 3개 질의. ① 날짜 필터 실패 질의(버림, 전 기간 14건). ② `(Larimichthys polyactis OR Pseudosciaena polyactis OR small yellow croaker) AND (peptide OR xanthine oxidase)`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의: WDDMEKIW는 원논문(PMID 36900499 = 10.3390/foods12050982)뿐이다.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 2개 질의. `"WDDMEKIW" xanthine oxidase small yellow croaker peptide`: 9건. `小黄鱼 黄嘌呤氧化酶抑制肽 WDDMEKIW 2026`: 9건.
- 후보(4건):
  - PMC8538066 (*Decapterus maruadsi* XO 펩타이드): 기존 검토. 다른 종이다(기준 1·2).
  - CN121574201B (TE6 헥사펩타이드): 기존 검토. 특허다(기준 6).
  - 10.7506/spkx1002-6630-20260116-136 (식품과학 2026, 47(17):10; 지난대학): 플라보노이드 4종의 XO 억제 연구다. 펩타이드가 아니다(기준 1·2).
  - 10.7506/spkx1002-6630-20250620-152 (식품과학 2025, 46(24):200): 주조박 유래 WDLPF/WPQ/WFPE/LQKW다. 다른 원료, 다른 서열이다(기준 1·2).
- 판정: **searched_none**

## 15. 대구 *Gadus macrocephalus* (aphia 254538)

- 현재 최상위 항목: GASSGMPG, ACE IC50 6.9 µM (HHL), 원논문 10.1016/j.procbio.2016.07.006 (Ngo·Kim SK 연구실, 부경대)
- 검색일: 2026-10-15
- 검색원:
  - PubMed: 4개 질의. ① 날짜 필터 실패 질의(버림). ② `(Gadus macrocephalus OR Pacific cod OR cod gelatin OR cod skin) AND (peptide OR ACE OR angiotensin)`, 등록일 2026-10-13 이후: 0건. ③ 서열 묶음 공유 질의: GASSGMPG는 PubMed 색인어에 없다(0건). ④ ACE 일반 공유 질의: 1건, 무관.
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 2개 질의. `"GASSGMPG" Pacific cod gelatin ACE inhibitory peptide`: 10건. `대구 껍질 젤라틴 ACE 저해 펩타이드 GASSGMPG 2026`: 9건.
- 후보(4건):
  - 10.1016/j.ijbiomac.2011.09.009 (Ngo 등 2011, 대구 껍질 젤라틴 TCSP·TGGGNV): 같은 연구실이고 다른 서열이다(기준 2·5). 기존 검토.
  - 10.13386/j.issn1002-0306.2020.05.027 (알래스카 대구 항고혈압 펩타이드): 서열이 없고 억제율 %만 있다(기준 2·3).
  - 10.1038/s41598-021-86808-9 (고등어 부산물 젤라틴 펩타이드): 다른 종이고 mg/mL 단위다(기준 1·2·3).
  - 10.3390/md16070228 (lizardfish 비늘 젤라틴 AGPPGSDGQPGAK): 다른 종이다(기준 1·2).
- 판정: **searched_none**

## 16. 넙치 *Paralichthys olivaceus* (aphia 275816) — 현재 항목 첫 검색, 전 기간

- 현재 최상위 항목: P35 SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK (비정형 NK-lysin NKLnc의 SapB 도메인 유래), *Vibrio anguillarum* MIC 5 µM (LB, 28 °C, 미량액체희석), 원논문 10.3390/ijms232112722 (Xu H, Yuan Z, Sun L; 중국과학원 해양연구소, 칭다오). 공개본 material_class는 `native_sequence_synthetic`이다. 원 측정 자체가 넙치에서 정제한 시료가 아니라 서열을 바탕으로 만든 펩타이드다.
- 검색일: 2026-10-15
- 검색원:
  - PubMed(전 기간): 4개 질의. ① `(Paralichthys olivaceus OR olive flounder OR Japanese flounder) AND (P35 OR <서열> OR antimicrobial peptide) AND (Vibrio anguillarum OR MIC)`: 0건. ② `(Paralichthys olivaceus OR flounder) AND (NK-lysin OR NKLnc OR saposin)`: 6건. ③ `Paralichthys olivaceus AND antimicrobial peptide AND (Vibrio anguillarum OR Listonella anguillarum)`: 0건. ④ `"non-canonical NK-lysin" OR NKLnc OR (NK-lysin AND Paralichthys AND peptide AND bactericidal)`: 1건(원논문).
  - Europe PMC: 열지 못함(2026-10-15)
  - KCI: 열지 못함(2026-10-15)
  - 일반 웹: 3개 질의. `"SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK"`: 10건(원논문 MDPI 외에는 사람 단백질 도메인 DB, huggingface 무작위 서열 파일). `牙鲆 NK-lysin 抗菌肽 P35 鳗弧菌 MIC`: 9건. `Paralichthys olivaceus NK-lysin peptide Vibrio anguillarum minimum inhibitory concentration`: 10건.
- 후보(초록 확인 8건, 원문 0건):
  - 10.3390/ijms232112722: 원논문(기준 5).
  - 10.1016/j.ijbiomac.2023.127590 (Li X … Zhan W, 중국해양대; UiT Dalmo 공저. ninum.uit.no/10037/33048은 같은 연구의 저장소 사본으로 보인다): 넙치 **일반형** NK-lysin(rPoNKL)과 hepcidin 2의 **재조합 단백질**이다. P35/NKLnc가 아니다. 대장균 발현품이라 넙치에서 정제한 시료도 아니다(기준 1·2).
  - 10.1016/j.fsi.2006.08.003 (Hirono 등 2006, 도쿄해양대): 넙치 일반형 NK-lysin 유래 **27-mer 합성** 펩타이드다. 시험균에 *V. anguillarum*이 없다(기준 1·2·3).
  - 10.1371/journal.pone.0106543 (NKLP27, 반엽어 *Cynoglossus semilaevis*; Sun L 연구실): 다른 종, 다른 분자이고 같은 연구실이다(기준 1·2·5).
  - 10.1016/j.fsi.2020.05.075 (*Platichthys stellatus* PSAP 유래 합성 AMP): 다른 종, 다른 분자다(기준 1·2).
  - 10.1016/j.fsi.2023.109080 (*Takifugu obscurus* ToNK-lysin 재조합): 다른 종이다(기준 1·2).
  - 10.1016/j.dci.2026.105641 (넙치 사료 첨가 후 AMP 유전자 발현): MIC 측정이 없다(기준 2·3).
  - 10.1080/10495398.2023.2290520 (닭·소·사람 NK-lysin 펩타이드): 다른 생물이다(기준 1·2).
  - 10.3389/fmicb.2021.773076 (mBjAMP1 개량 설계 AMP): 다른 분자, 합성 설계 펩타이드다(기준 1·2).
- 참고: P35 같은 '단백질 도메인 유래 합성 펩타이드'는 다른 그룹이 다시 재더라도 보통 합성품을 쓴다. 기준 1(같은 종 정제 시료)을 만족하는 재현은 구조적으로 나오기 어렵다. 이번 검색에서는 다른 그룹이 P35를 다시 잰 문헌 자체가 없었다.
- 판정: **searched_none**

---

## 기록 JSON

```json
[
  {"aphia_id": 236157, "korean_name": "꼬시래기", "searched_item": "ChEMBL_37:CHEMBL2392|Potency — PROSTAGLANDIN A2 (CHEMBL1084643), DNA polymerase beta, activity 5031175, origin 10.1371/journal.pone.0029359", "searched_on": "2026-10-15", "sources": [{"name": "ChEMBL (release check: Downloads page, CHEMBL37 May 2026 latest)", "status": "searched", "queries": 1}, {"name": "PubMed", "status": "searched", "queries": 2}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 1}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 413600, "korean_name": "가리맛조개", "searched_item": "VQY, ACE IC50 (HHL), 10.3390/md14060110", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 3}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 342067, "korean_name": "살오징어", "searched_item": "YALPHA, ACE IC50 (HHL), 10.1271/bbb.60.1353", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 2}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 219984, "korean_name": "멸치", "searched_item": "DGGP, ACE IC50 (HHL), 10.1007/s13765-015-0129-4", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 3}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 127022, "korean_name": "고등어", "searched_item": "PLITT, ACE IC50 (HHL), 10.1016/j.foodchem.2024.138873", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 2}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 281273, "korean_name": "참조기", "searched_item": "WDDMEKIW, xanthine oxidase IC50, 10.3390/foods12050982", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 3}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 2}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 254538, "korean_name": "대구", "searched_item": "GASSGMPG, ACE IC50 (HHL), 10.1016/j.procbio.2016.07.006", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 2}], "result": "searched_none", "accepted_doi": null},
  {"aphia_id": 275816, "korean_name": "넙치", "searched_item": "P35 SKEKIDRLLNKACNGIKCKLIRQACNKIIGHFKRK, MIC vs Vibrio anguillarum (DBAASP), 10.3390/ijms232112722 — first search, all years", "searched_on": "2026-10-15", "sources": [{"name": "PubMed", "status": "searched", "queries": 4}, {"name": "Europe PMC", "status": "unavailable", "queries": 0}, {"name": "KCI", "status": "unavailable", "queries": 0}, {"name": "Web search", "status": "searched", "queries": 3}], "result": "searched_none", "accepted_doi": null}
]
```
