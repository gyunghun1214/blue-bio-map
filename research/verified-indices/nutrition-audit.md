# MFPI nutrition and cultivation evidence audit

> **verified-pilot-2 갱신 (2026-09-25).** 주 비교집단을 농촌진흥청 국립식량과학원 **국가표준식품성분 DB 10.4 (2026)**로 바꿨다(공공누리 제1유형). 아래 AFCD 기록은 교차 점검으로 유지한다.
>
> | 종 · 식품코드 | 단백질 g | 철 mg | 아연 mg | 폐기율 % | 출처 표기 | 결과 |
> | --- | --- | --- | --- | --- | --- | --- |
> | 참굴 · K4040020000a 굴, 참굴, 생것 (Pacific oyster, Wild) | 9.66 | 8.72 | 15.9 | 84 | ('16) | MFPI 65.5 (수산동물 25개 코호트) |
> | 멍게 · K6100000000a 멍게(우렁쉥이), 생것 | 5 | 5.7 | 5.3 | 80 | JAPAN('20) | MFPI 54.2 (타국 표 인용 0.85) |
> | 미역 · L0130000000a 미역, 생것 | 1.68 | 0.46 | 0.14 | 0 | ('16) | MFPI 42.2 (해조류 3개 코호트) |
> | 참담치 · K4270000000a | 13.8 | 6.1 | 빈칸 | 76 | ('09) | 아연 결측 → 보류 |
> | 살오징어 · K6230020000a | 15.7 | 1.6 | 빈칸 | 20 | ('09) | 아연 결측 → 보류 |
> | 톳 · L0260000000a | 1.9 | 3.9 | 빈칸 | 0 | ('09) | 아연 결측 → 보류 |
> | 해삼 · K6340000000a "해삼, 생것" | 3.7 | 2.1 | 빈칸 | 21 | ('09) | 일반명 행 → 종 연결 안 함 |
> | 우뭇가사리 · L0190000000a | 4.2 | 3.9 | 빈칸 | 0 | ('09) | 일반명(Ceylon moss) → 종 연결 안 함 |
>
> 양식 근거 추가: 멍게 — Shin et al. 2011, KFAS 44(4):366 (국립수산과학원, 통영 양식장 2007년 측정, 5–9월 고수온기 성장 음(−)); 미역 — FAO FTP 441 §8.5 (로프 연승 수하식, 한국 최대 생산국, 4월 수확 종료).
> 재수집: `python scripts/collect_rda_nutrition.py` (상세 조회 `detailOne?foodCodes=<코드>`), 스냅샷 파일로 고정.
> 후속 확인 (2026-09-25): 식약처 식품영양성분 DB의 "담치, 참담치(홍합), 생것"은 출처가 국립식량과학원(RDA) 데이터로 표시된 같은 행이며 아연 항목이 없다. 공식 DB 두 곳 모두 아연 결측이므로 대체값을 채우지 않았다.

> **가식부 점검 (검수 반영, 2026-09-26).** MFPI가 나온 7종의 가식부 행을 모두 봤다. RDA 상세 화면은 폐기율과 출처 표기만 보여 주고 폐기 부위는 보여 주지 않는다. 그래서 JAPAN('20) 행은 일본 원표(문부과학성 日本食品標準成分表2020年版（八訂） 第2章 Excel, sha256 `ae54da2f…0c4d`)의 같은 식품 비고로 확인했다.
>
> | 종 · 식품코드 | 식품명 (출처 표기) | 폐기율 % → 가식부 | 식품 형태 근거 | 판정 |
> | --- | --- | --- | --- | --- |
> | 참굴 · K4040020000a | 굴, 참굴, 생것 ('16) | 84 → 0.16 | 껍데기째 형태와 맞음. 국내 행이라 폐기 부위는 미공개(참고: 일본 かき 養殖 生 75%, 貝殻) | 인정 |
> | 멍게 · K6100000000a | 멍게(우렁쉥이), 생것 (JAPAN('20)) | 80 → 0.20 | 일본 10374 ほや 生과 영양값·폐기율 동일, 비고 "試料： まぼや、あかぼや 廃棄部位： 外皮及び内臓" | 인정 |
> | 미역 · L0130000000a | 미역, 생것 ('16) | 0 → 1.00 | 국내 행, 폐기 부위 미공개. 껍데기·뼈 같은 단단한 폐기 부위가 없는 해조라 0이 설명 가능하다고 봄. 일본 09039 わかめ 原藻 生은 35%("基部を除いたもの 廃棄部位： 茎、中肋及びめかぶ")로 기준이 다름 | 인정, 확인 필요(운영 8종이라 바꾸지 않음) |
> | 바지락 · K4130000000a | 바지락, 생것 ('16) | 68 → 0.32 | 껍데기째 형태와 맞음(참고: 일본 あさり 生 60%, 貝殻) | 인정 |
> | 큰가리비 · K4000040000a | 가리비, 큰가리비, 생것 ('16) | 58 → 0.42 | 껍데기째 형태와 맞음(참고: 일본 ほたてがい 生 50%, 貝殻) | 인정 |
> | 조피볼락 · K0960070000a | 볼락, 조피볼락(우럭), 생것 ('16) | 75 → 0.25 | 통째 어체 형태와 맞음. 일본 원표에 같은 종 행 없음 | 인정 |
> | 방어 · K0830011130a | 방어, 양식, 어린것, 생것 (JAPAN('20)) | 0 → 불인정 | 일본 10243 はまち 養殖 皮つき 生과 폐기율·수분·단백질·철·아연 동일, 비고 "切り身 (魚体全体から調理する場合、廃棄率： 40 %、廃棄部位： 頭部、内臓、骨、ひれ等)" → 토막살 시료 | 행 폐기율 불인정(`rda_refuse_not_accepted`). 같은 원표 비고의 통째 손질 폐기율 40%로 가식부 0.60(`food_support`, `mext_sfct_2020`). MFPI 60.3 → 56.3 |
>
> 규칙: 행의 폐기율이 구입 형태의 가식부를 나타내지 못하면(토막살, 살만 담은 행 등) `evidence.json`의 `rda_refuse_not_accepted`에 이유·출처·확인일을 적고 그 행 폐기율을 쓰지 않는다. 다른 공식 출처의 가식부가 있으면 `food_support`(kind `edible_fraction`)로 쓰고, 없으면 MFPI를 `species_edible_yield_unverified`로 보류한다. 코드에는 종 이름이 없다. 방어의 다른 RDA 행(K0830000000a '09 41%, K0830021130a '82 자연산 45%)은 다른 시료라 쓰지 않았다.


Reviewed 2026-09-25. This audit distinguishes published raw values from the
project's **unvalidated pilot scoring rule**. It does not authorize a species
score for an entire sea area, and none of the reference oysters below are
operating candidates. The operating candidate is *Magallana gigas* (WoRMS
AphiaID 836033); the source records use its synonym *Crassostrea gigas*.

## Source identity and reproducible retrieval

| ID | Source, version, and retrieval | Role and rights |
| --- | --- | --- |
| `afcd-r3` | Food Standards Australia New Zealand (FSANZ), [Australian Food Composition Database (AFCD), Release 3](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/about-afcd), accessed 2026-09-25. Download the linked **Release 3 – Food details** and **Release 3 – Nutrient profiles** XLSX files; inspect the `Food details` and `All solids & liquids per 100 g` sheets respectively. | The source of the publishable, minimally extracted nutrient numbers below. [FSANZ data user licence](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement), based on CC BY-SA 3.0 Australia, applies to data/derivatives. |
| `frdc-2008-905` | David Padula, Heather Greenfield, Andreas Kiermeier, Catherine McLeod, *Australian Seafood Compositional Profiles*, Fisheries Research and Development Corporation (FRDC) project **2008/905**, July **2012**, ISBN 978-0-9805789-9-7, [original SARDI/Seafood CRC report](https://www.frdc.com.au/sites/default/files/products/2008-905-DLD.pdf), accessed 2026-09-25. | Original study behind the three-oyster comparison. PDF pp. 8–12 describe sampling/QA; pp. 22–24 give oyster means, SD and identification; pp. 54–55 give assay methods. The report asserts copyright and forbids reproduction/electronic storage without permission on p. 1. Link and cite it; do not check in its PDF or tables wholesale. |
| `ufish-1` | FAO/INFOODS, [Global Food Composition Database for Fish and Shellfish, uFiSh1.0](https://www.fao.org/food-composition/tables-and-databases/detail/f-food-composition-tables/en), 2016, [official XLSX](https://www.fao.org/3/I6655EN/uFiSh1.0.xlsx), accessed 2026-09-25. | Cross-check and gap search only for this cohort. The workbook states `FAO © December 2016` and gives a citation in `01 Introduction`; a redistribution permission was not established here. Retain row identifiers and links rather than copying the workbook. |
| `yield-dalian` | Li et al., [*Foods* 14 (2025) 1595](https://doi.org/10.3390/foods14091595), Table 1 and Methods 2.1–2.3, accessed 2026-09-25. | Species-specific whole-to-meat yield, separate population from AFCD. |
| `yield-chile` | Valenzuela et al., [*PLOS ONE* 17 (2022) e0270825](https://doi.org/10.1371/journal.pone.0270825), [printable PDF](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0270825&type=printable), Methods and Tables 1/3, accessed 2026-09-25. | Two dated, species-specific yield alternatives for sensitivity. Article is CC BY with attribution. |
| `fao-oyster-culture` | FAO, [Cultured Aquatic Species profile: Pacific cupped oyster](https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_pacificcuppedoyster.htm) and [*Culture of the Pacific Oyster in the Republic of Korea*, introduction](https://www.fao.org/4/ab706e/AB706E01.htm) and [methods](https://www.fao.org/4/ab706e/AB706E05.htm), accessed 2026-09-25. | Species-level cultivation method and regional limitations. These historical descriptions do not verify the suitability of any current map cell. |
| `m-coruscus-2012` | He, Zhao & Liu, [*South China Fisheries Science* 8(4), 2012, 37–42](https://www.schinafish.cn/cn/article/pdf/preview/10.3969/j.issn.2095-0780.2012.04.006.pdf), DOI `10.3969/j.issn.2095-0780.2012.04.006`, accessed 2026-09-25. | Independent species-specific mussel composition check; insufficient whole-to-meat yield for full MFPI. |

For exact replication, download from the official source links, retain original
files outside version control, use the workbook sheet names/food keys below,
and record the retrieval date. Do **not** infer a calendar collection year from
an article publication date or a project-number prefix.

## Cohort selected for the first nutritional percentile

The predeclared cohort is three **raw, aquacultured, shucked oyster species**
from the same Australian SARDI survey. The original report confirms the three
names by DNA sequencing, says each approximately 2 kg flesh sample was
analysed in duplicate, and defines the tested part as the whole oyster **minus
shell**. Five Pacific and five Sydney rock oyster samples came from industry
suppliers; only two native oyster samples could be obtained. Samples for the
survey arrived **July 2010–July 2011**, mostly raw/frozen, and edible tissues
were stored at −80 °C for laboratory analysis. The original report does not
assign a specific year to each oyster species or individual sample.

| Cohort status | AFCD food key and exact food name | Original taxon, samples | Protein (g/100 g flesh) | Fe (mg/100 g flesh) | Zn (mg/100 g flesh) |
| --- | --- | --- | ---: | ---: | ---: |
| Reference | `F006288` — Oyster, native, aquacultured, raw | *Ostrea angasi*, n=2 | 7.3 | 3.75 | 11.05 |
| **Operating candidate** | `F006289` — Oyster, Pacific, aquacultured, raw | *Crassostrea gigas* = *Magallana gigas*, n=5 | 10.8 | 4.43 | 18.04 |
| Reference | `F006291` — Oyster, Sydney rock, aquacultured, raw | *Saccostrea glomerata*, n=5 | 10.6 | 3.47 | 20.25 |

These are AFCD Release 3 `Nutrient profiles` sheet `All solids & liquids per
100 g`, Excel rows **1253–1255** respectively, columns **8** (`Protein`),
**63** (`Iron`) and **76** (`Zinc`). The same rows in the `Food details` workbook
carry the food keys, `Derivation = Analysed`, sampling descriptions and
`Analysed Portion = 100% (flesh)` / `Unanalysed Portion = 0%`. The 100% value
means that nutrient results are already for edible shucked flesh. It is
**not** a 100% shell-on edible yield.

The original report's oyster tables (PDF pp. 23–24) list protein **7.3,
10.9, 10.6 g**; Fe **3.75, 4.43, 3.47 mg**; and Zn **11.1, 18.0, 20.3 mg**
per 100 g edible flesh in the same species order. AFCD's Pacific protein
10.8 differs from the original 10.9; the extra Zn decimals in AFCD also differ
from the original report's rounding. Use the AFCD snapshot consistently for
calculation, cite the original for method verification, and preserve this
version difference instead of silently asserting identical numbers.

The AFCD `Food details` sampling description says most nutrient data came
from **“2008 (SARDI)”**. The original FRDC report calls the study **project
2008/905** but expressly says survey samples were supplied **July 2010–July
2011**. “2008” therefore cannot safely be recorded as the actual sample year;
it appears to refer to project identification or an AFCD provenance shorthand.
The study was **published July 2012** and AFCD Release 3 is the later
**2025** database snapshot; both are distinct from collection. An input schema
that requires one integer `sample_year` must accept a documented **2010–2011
range/unknown exact year** before any row can honestly be marked reviewed.

The AFCD row-level `Analysed` flag does not mean every nutrient is measured
directly. The original report says protein was **calculated from measured
nitrogen × 6.25** (p. 12); assay-method references in Appendix 4 include
AOAC 988.05 and others as appropriate. This protein should be graded
`calculated` under the pilot's measured/calculated/proxy distinction. Iron
was measured by **acid digest, ICP-OES** and zinc by **wet oxidation,
ICP-OES** (Appendix 4), so Fe and Zn can be graded `measured`. AsureQuality,
Auckland performed proximate and mineral assays; NIWA confirmed the species
by DNA. The original report documents duplicate runs, a subset of triplicate
runs, laboratory controls and data review. The two downloaded AFCD workbooks
have a food-level derivation, not separate nutrient-level method flags.

## Yield: independent measurements and context

The AFCD oyster profile does **not** provide shell-on to shucked-flesh yield.
Nor does `100% (flesh)` mean whole-animal yield. Three species-specific
measurements show why a single yield needs a population label:

| Source | Collection, sample and method | *C. gigas* meat yield |
| --- | --- | ---: |
| Li et al., *Foods* 2025, Table 1 | Live animals bought at New Changxing Seafood Market, Dalian, China; at least 30 individuals per species from three harvest batches in **Q2, year unstated**. `yield = (whole wet mass − shell mass) / whole wet mass`. Harvest site and exact collection year were not reported. | **11.57%** |
| Valenzuela et al., *PLOS ONE* 2022, Table 3 | **September 2017**, Faro Corona, north Chiloé Island, Chile; 40 individuals pooled in two groups of 20. `yield = shucked meat wet mass / whole wet mass`. | **15.27 ± 0.36%** (study SE) |
| Valenzuela et al., *PLOS ONE* 2022, Table 1 | **August 2018**, Hueihue, north Chiloé Island, Chile; 60 individuals pooled in three groups of 20; same wet-mass method. | **23.70 ± 0.52%** (study SE) |

These are observed species-specific yields, but **none was measured on the
Australian oysters whose nutrients AFCD reports**. The Dalian paper's protein
45.82% is on a **dry** basis and must not be substituted for AFCD's raw,
wet-flesh protein. The published PLOS SEs are study-specific measurement
precision, not confidence intervals for the MFPI score or a pooled yield.
Choose one source in the versioned scoring policy and report other yields as
explicit sensitivity scenarios; do not average different markets, seasons and
regions into an undocumented universal coefficient. FAO uFiSh's generic
Crassostrea edible factor 0.11 is estimated and is not a direct *C. gigas*
measurement.

## Cultivation feasibility for Pacific oyster

The FAO [cultured-species profile](https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_pacificcuppedoyster.htm)
documents real sea grow-out of *C. gigas* through bottom sowing, off-bottom
mesh bags/trays on trestles, and suspended longline/raft systems. Site
requirements include firm substrate for bottom culture, adequate water
exchange and natural phytoplankton, and suitable depth/space for suspended
gear. It describes rapid growth around 15–25 °C and 25–32‰ salinity, with
roughly 18–30 months to 70–100 g shell-on market size under the cited
conditions. Growth and yield vary with water, density, fouling and season;
summer mortality can follow spawning under warm/high-density conditions, and
harmful algal blooms can halt harvesting.

The FAO [Korean cultivation manual](https://www.fao.org/4/ab706e/AB706E05.htm)
describes southern-coast raft and anchored longline cultivation with oyster
strings, and explicitly notes higher facility and labour costs of hanging
systems and site-specific current/density effects. Its introduction reports
1986 production and an established longline industry; label this as
**historical practice**, not a current capacity or a current licence for any
mapped sea area. A defensible pilot `aquaculture = true` can mean **species-level
technical feasibility with documented method, region and historical period**.
It cannot mean that a particular Korean cell is suitable, licensed, safe or
profitable in 2026. Production counts alone were not used as proof.

## FAO uFiSh cross-check and mussel status

In FAO uFiSh1.0, `02 Overview Species` has *Crassostrea gigas* at row **79**
and *Mytilus coruscus* at row **86**. The other six operating species are not
present as exact-species nutrient profiles. A `Todarodes`/Ommastrephidae
family aggregate is not a substitute for *T. pacificus*.

`04 NV_sum (per 100 g EP)` row **419**, Food Item **093006**, gives raw
*C. gigas* edible-flesh protein **9.7244833333 g**, Fe **2.718 mg** and Zn
**8.499 mg** per 100 g. This combines multiple reference datasets. The
corresponding `05 NV_stat` Zn distribution is especially heterogeneous:
**n=9, median 0.019 mg, range 0.012–26.8 mg**. Food Item **093007** (farmed
Pacific oyster) has a Zn summary of **0.0142 mg/100 g** (range
0.012–0.019). Those unusually low entries require source/unit reconciliation
before use. Do not treat the aggregate as a single directly measured sample
or pool it with AFCD as an independent replicate. The generic oyster edible
factor **0.11** in uFiSh is marked estimated from a generic US yield source;
it is not species-specific observed yield.

`04 NV_sum` row **446**, Food Item **093015**, reports raw *M. coruscus*
edible-flesh protein **12.38488975 g**, Fe **2.255988 mg** and Zn
**1.3517015 mg** per 100 g. The workbook's whole-to-meat factor **0.51** is
marked estimated from generic *Mytilus* spp (`093014`), without a verifiable
species-specific source. This is **not** adequate to mark *M. coruscus*
edible fraction reviewed. Its nutrients can be shown as underlying values,
but a full MFPI should remain uncalculated until a species-specific yield is
verified (or the methodology explicitly removes yield as a required input).

An independent original paper by He, Zhao & Liu sampled *M. coruscus* soft
parts at a **Zhoushan, Zhejiang seafood market in September 2011**. The
actual harvest site and wild/farmed status are not given. Its Table 1 (PDF
p. 2) explicitly labels **fresh-weight** crude protein **11.12 g/100 g**,
measured by Kjeldahl nitrogen. Its Table 5 (PDF p. 5) gives Fe **21.00
mg/kg** and Zn **22.10 mg/kg** of soft part using flame atomic absorption.
The authors say the mineral subsample was frozen at −20 °C while a separate
proximate subsample was dried, supporting an inference of wet tissue, but
Table 5 itself does **not** expressly label the mineral denominator as fresh
or dry weight. Retain the original mg/kg values and flag the basis until
resolved; do not silently convert them into scored fresh-per-100-g rows.
The 2010 Li et al. cultivated Shengsi Islands mussel study cited by uFiSh
([DOI 10.1021/jf101526c](https://doi.org/10.1021/jf101526c)) confirms
species-specific aquaculture/nutrition interest, but the abstract alone does
not establish a whole-to-meat fraction or complete component methods.

## Score implications and decision record

The AFCD cohort is small yet unusually coherent: three taxonomically
confirmed oyster species, one survey, one edible raw tissue state and a
common component method. This makes it preferable to a larger uFiSh mixture
of studies/years for the **first explicitly provisional** percentile. The
current pilot's minimum of three species is a software threshold, not a
statistically validated reference-group size. Keep the cohort frozen in
versioned configuration and do not let screen filters alter ranks.

For the current `scripts/evaluate_candidates.py` formula only, the
three-species midrank percentiles are 16.67, 50.00 and 83.33 (the candidate
itself is included). *M. gigas* is highest on protein and Fe and middle on
Zn. Protein receives the pilot's `calculated = 0.85` evidence factor; Fe/Zn
receive `measured = 1.0`. Under the unmodified pilot rule — 80% mean
grade-adjusted nutrient percentile, 10% edible fraction and 10% binary
cultivation — using the 11.57% Dalian yield gives **about 65.6 MFPI**.
Using 15.27% or 23.70% yield instead gives about **66.0** or **66.8**,
respectively, holding every other assumption fixed. These are arithmetic
scenario results, **not** published values, validation, clinical or food
security outcomes, or confidence intervals. If the method/configuration
changes, recompute and version the results.

The larger uncertainty is the tiny and variable nutrient cohort, especially
Zn: the original SARDI report gives Zn sample SDs **13.4, 21.4, 13.6
mg/100 g** for native, Pacific and Sydney rock oyster respectively. Native
oyster has only two samples. A shift of one rank step changes a nutrient
percentile by 33.33 points with this midrank formula; season, producer and
geography could plausibly change the ordering. Show the reference species,
sample sizes, original SDs, year range and yield alternatives beside a
provisional MFPI. Do not label this SD-based or scenario-based spread as a
statistical confidence interval. Nutrition per shucked 100 g and shell-on
yield are different dimensions; the formula's 80/10/10 weights and 0.85
calculation factor are project choices, not FAO/FSANZ scientific standards.

### Data-use notice for any published AFCD-derived extract

Credit **Food Standards Australia New Zealand, Australian Food Composition
Database Release 3**, link the [data user licence](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement),
identify transformations/changes and apply the same licence to AFCD
derivatives. Include FSANZ's limitation statement in the published data
artifact: food-composition averages reflect sampled foods at a particular
time and may vary by batch, season, processing, brand and calculation method.
Also state that **the data are based on Australian foods and may not be
appropriate in other countries**. Do not imply FSANZ endorsement or use its
logo. The original FRDC PDF has separate restrictive terms; attribution to
AFCD does not grant permission to redistribute the PDF or its complete tables.


**조사 후보 22종 (2026-09-26):** 같은 규칙으로 조사한 결과와 보류 사유는 [candidate-evidence-2026-09-26.md](candidate-evidence-2026-09-26.md)에 있다.
