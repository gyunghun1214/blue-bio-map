# 2026-10-31 도연 피드백 3건 (휴대폰 · 카카오톡 인앱 브라우저)

원문: ① 그래프 25p랑 숫자랑 겹친다 ② 위로 올리면 범례가 사라진다 ③ 바다탐험에서 생물에 대한 간단한 설명이 있으면 좋겠다.
측정은 클라우드 Chromium(Playwright)으로 휴대폰을 흉내 냈다. 아이폰 Safari(WebKit)는 클라우드에서 내려받지 못해 실기 확인 항목을 아래에 따로 적었다.

## 1. 어획량 그래프 마지막 연도와 25p 겹침

- 원인: `dist/app.js` `stockSpark()`에서 연도 간격 22.4에 가운데 맞춤인 `2024`(폭 약 31)와 `25p`(약 23)가 이웃 칸에 놓였다.
- 수정: 2025년 잠정치가 있을 때만 마지막 연도 글자를 `text-anchor="end"`, x = 마지막 점 + 6. 잠정치가 없으면 전과 같다. 데이터·선·구간 띠·aria-label·`25p`는 그대로.
- 결과(28종 전부, `measure.mjs spark`): 390px(13px 글자) 간격 −4.3 → **+5.0px**, 1440px(12px) −2.2 → **+5.9px**, KO·EN 같음. 겹침 28 → 0.
- 캡처(shots/): `before-spark-390.png` → `after-spark-390.png`, 1440도 같은 이름.

## 2. 휴대폰 지도에서 시트를 올리면 범례가 덮임

- 원인: 출처 ⓘ는 `--sheet-cover`를 따라 올라가는데 범례 `.map-ui-bl`은 `bottom:10px`에 고정.
- 수정: `sheetSync()`가 `--legend-lift = max(0, min(cover+4, 지도 높이 − 위 모드·기간 묶음 아래끝 − 범례 높이 − 8))`를 쓰고, `map-attribution.css` 휴대폰 구간이 `#explore .map-ui-bl{bottom:var(--legend-lift,18px)}`로 읽는다. 범례를 접고 펼칠 때는 기존 ResizeObserver가 `sheetSync()`를 부른다. 넓은 화면으로 바뀌면 값을 지운다. 활용 × 보전의 셀 색 칸(`#value-key`)은 같은 상자 안이라 함께 움직인다. `fitPad()`는 범례를 늘 아래 칸으로 센다(지도 위쪽 절반까지 올라가도 맞춤 여백이 위로 옮겨 가지 않게).
- 함께 고친 것: 범례 상자가 넓으면(펼친 범례, 영어, 셀 색 칸) 출처 ⓘ 동그라미를 덮어 i 글자가 가려졌다(수정 전에도 스크롤 0에서 그랬다). 휴대폰 범례 최대 폭을 `calc(100% - 112px)`로 줄여 ⓘ 누르는 범위(44px) 왼쪽에서 끝나게 했다.
- 결과(`measure.mjs legend`: 360×667·390×750·430×932 × KO·EN × 출현 기록·활용 × 보전 × 접힘·펼침 × 스크롤 0·40·80·120·160·200·300 = 168줄): 상한에 닿기 전 범례가 눌리지 않는 경우 **99 → 0**, 범례가 위 모드·기간 묶음과 겹침 0 → 0, 시트를 올리는 동안 지도 중심·확대가 바뀐 경우 0. 상한에 닿은 뒤(지도가 위 버튼 줄만 남을 때)에는 시트가 덮는다.
- 측정 원자료: `before-legend.json`, `after-legend.json`. 캡처(shots/): `before-390-*`, `after-390-*`(스크롤 0·120·300).

전체 168줄 합계(전 → 후): 상한 전 눌리지 않음 99 → 0 · 범례 상자와 확대/축소 상자 겹침 77 → 0 · 범례 상자와 출처 ⓘ 상자 겹침 58 → 0 · 위 버튼 줄과 겹침 0 → 0 · 지도 움직임 0 → 0. 상한에 닿은 줄 42개.

**390×750 · 출현 기록 · 접힌 범례 (KO)**

| 스크롤 | 시트 윗선 | 범례 위–아래 (전 → 후) | `--sheet-cover` | `--legend-lift` | 눌림 (전 → 후) |
|---|---|---|---|---|---|
| 0 | 410 | 374–414 → 366–406 | 14px | 18px | 됨 → 됨 |
| 40 | 370 | 334–374 → 326–366 | 14px | 18px | 됨 → 됨 |
| 80 | 330 | 325–365 → 286–326 | 45px | 49px | 안 됨 → 됨 |
| 120 | 290 | 325–365 → 246–286 | 85px | 89px | 안 됨 → 됨 |
| 160 | 250 | 325–365 → 206–246 | 125px | 129px | 안 됨 → 됨 |
| 200 | 210 | 325–365 → 166–206 | 165px | 169px | 안 됨 → 됨 |
| 300 | 110 | 325–365 → 124–164 | 265px | 211px | 안 됨 → 안 됨 |

**390×750 · 출현 기록 · 펼친 범례 (KO)**

| 스크롤 | 시트 윗선 | 범례 위–아래 (전 → 후) | `--sheet-cover` | `--legend-lift` | 눌림 (전 → 후) |
|---|---|---|---|---|---|
| 0 | 410 | 335–414 → 306–406 | 14px | 18px | 됨 → 됨 |
| 40 | 370 | 295–374 → 266–366 | 14px | 18px | 됨 → 됨 |
| 80 | 330 | 286–365 → 226–326 | 45px | 49px | 됨 → 됨 |
| 120 | 290 | 286–365 → 186–286 | 85px | 89px | 안 됨 → 됨 |
| 160 | 250 | 286–365 → 146–246 | 125px | 129px | 안 됨 → 됨 |
| 200 | 210 | 286–365 → 124–224 | 165px | 151px | 안 됨 → 됨 |
| 300 | 110 | 286–365 → 124–224 | 265px | 151px | 안 됨 → 안 됨 |

**390×750 · 활용 × 보전 · 셀 색 칸 (KO)**

| 스크롤 | 시트 윗선 | 범례 위–아래 (전 → 후) | `--sheet-cover` | `--legend-lift` | 눌림 (전 → 후) |
|---|---|---|---|---|---|
| 0 | 410 | 337–414 → 310–406 | 14px | 18px | 됨 → 됨 |
| 40 | 370 | 297–374 → 270–366 | 14px | 18px | 됨 → 됨 |
| 80 | 330 | 288–365 → 230–326 | 45px | 49px | 됨 → 됨 |
| 120 | 290 | 288–365 → 190–286 | 85px | 89px | 안 됨 → 됨 |
| 160 | 250 | 288–365 → 150–246 | 125px | 129px | 안 됨 → 됨 |
| 200 | 210 | 288–365 → 124–220 | 165px | 155px | 안 됨 → 됨 |
| 300 | 110 | 288–365 → 124–220 | 265px | 155px | 안 됨 → 안 됨 |

## 3. 바다 탐험 생물 설명

- 새 파일 `dist/expedition-about.json`(AphiaID → `ko`, `en`, `source_title`, `source_url`, `source_name`, `checked`). `expedition-stops.json`은 건드리지 않았다.
- 카드: `.x-species` 안, 이름 아래 카드 폭 전체(15px)에 1~2문장. 이름과 같은 단계(`data-r="2"`)라 함께 나타나고 점수는 그다음. 3D 항해와 카드 목록이 같은 `cardHtml`을 쓴다. 설명이 없거나 파일을 못 불러오면 줄째 빠진다.
- 자세히 보기: 머리말 아래 `어떤 생물인가요` + 같은 글 + 출처 링크, 그다음 `관측 위치·기간`.
- 출처는 종마다 실제로 열어 읽었고(2026-10-31), 출처가 쓴 학명이 다르면 WoRMS 동의어 목록(marinespecies.org REST)으로 같은 종인지 확인했다(참굴 = Crassostrea gigas, 큰가리비 = Patinopecten yessoensis, 갑오징어 = Sepia esculenta, 피조개 = Scapharca broughtonii, 다시마 = Laminaria japonica). 30종 모두 채웠다.
- 검사: `verification/test_expedition_about.mjs`(CI에 추가) — 30종 빠짐 없음, 필드, 한국어 40~90자, 점수·유형·건강 효능·최상급·약점 문구 없음, 민감종(전복·피조개·해삼) 지명 없음, 카드·상세 자리.
- 화면 확인(`about_check.mjs`): 360·390·430·1440 × KO·EN × 보통·reduced-motion 카드 목록에서 30장 모두 설명이 이름 아래·점수 위·카드 폭 전체·15px 이상, EN은 한글 없음. 3D 항해(SwiftShader) 360·390·430 × KO·EN에서 도착하면 설명이 보이고 카드를 스크롤해 '자세히 보기'·'지도에서 보기'까지 닿는다. WebGL 없는 카드 화면은 `expedition_check.mjs`의 no-webgl 단계로 확인(75 PASS / 0 FAIL).
- 캡처(shots/): `card-390-ko.png`, `card-1440-ko.png`, `detail-390-ko.png`, `sea-390-ko.png`.

### 30종 설명 전체

| # | 한글명 (학명) | 설명 (한국어) | 출처 (출처가 쓴 학명) |
|---|---|---|---|
| 1 | 멸치 (*Engraulis japonicus*) | 바다 표면 가까이에서 큰 떼를 지어 다니는 작은 물고기로, 요각류 같은 플랑크톤을 먹는다. 날것이나 소금에 절여 판다. | [FishBase · Engraulis japonicus, Japanese anchovy](https://www.fishbase.se/summary/1663) |
| 2 | 꽃게 (*Portunus trituberculatus*) | 모래나 모래펄 바닥에 사는 게로, 조개·작은 갑각류·물고기를 잡아먹는다. 어업으로 잡아 비싼 값에 팔린다. | [SeaLifeBase · Portunus trituberculatus, Gazami crab](https://sealifebase.ca/summary/Portunus-trituberculatus.html) |
| 3 | 바지락 (*Ruditapes philippinarum*) | 색과 무늬가 제각각인 단단한 껍데기의 조개로, 모래·펄·자갈 갯벌에 산다. 갯벌에 어린 조개를 뿌려 기르고 국이나 볶음으로 먹는다. | [FAO Cultured Aquatic Species · Ruditapes philippinarum](https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_japanesecarpetshell.htm) |
| 4 | 넙치 (*Paralichthys olivaceus*) | 가자미목에 속하는 넙치류 물고기로, 수심 10~200m 바다 밑바닥에 산다. 바다에서 잡기도 하고 양식으로도 기른다. | [FishBase · Paralichthys olivaceus, Bastard halibut](https://www.fishbase.org/summary/1351) |
| 5 | 조피볼락 (*Sebastes schlegelii*) | 연안 바위 바닥에 사는 물고기로, 알을 몸속에서 부화시켜 새끼를 낳는다. 바다에서 잡고 양식으로도 기른다. | [FishBase · Sebastes schlegelii, Korean rockfish](https://fishbase.se/summary/SpeciesSummary.php?id=6534) |
| 6 | 참조기 (*Larimichthys polyactis*) | 민어과에 속하는 물고기로, 수심 120m까지의 얕은 바다에서 모래펄 바닥 가까이에 산다. 상업 어업으로 잡는다. | [FishBase · Larimichthys polyactis, Yellow croaker](https://www.fishbase.org/summary/416) |
| 7 | 청각 (*Codium fragile*) | 스펀지처럼 말랑하고 가지가 둘씩 갈라지는 녹조류로, 겉이 벨벳처럼 보드랍다. 바닷가 바위 웅덩이에서 자란다. | [AlgaeBase Seaweed Site · Codium fragile](https://seaweed.algaebase.org/descriptions/Codium_fragile.html) |
| 8 | 고등어 (*Scomber japonicus*) | 연안 바다에서 떼를 지어 헤엄치는 물고기로, 작은 갑각류·물고기·오징어를 먹는다. 생물·냉동·소금절임으로 팔린다. | [FishBase · Scomber japonicus, Chub mackerel](https://www.fishbase.org/summary/117) |
| 9 | 톳 (*Sargassum fusiforme*) | 바닷가 바위의 조간대에 빽빽이 붙어 자라는 갈조류로, 줄기에서 여러 가지가 뻗는다. 한국과 중국에서 양식해 먹는다. | [Yoshida & Shimabukuro 2017, Journal of Applied Phycology 29: 639–648](https://link.springer.com/article/10.1007/s10811-016-0951-z) |
| 10 | 피조개 (*Anadara broughtonii*) | 꼬막과 같은 돌조개과의 조개로, 펄 바닥에 산다. 어린 조개를 바닥에 뿌리거나 바닷속에 매달아 기른다. | [최규정 2000, 전남대학교 수산과학연구소 논문집 9: 122–127](https://scholar.kyobobook.co.kr/article/detail/4010025905637) (Scapharca broughtonii) |
| 11 | 참굴 (*Magallana gigas*) | 아래 껍데기는 깊게 오목하고 위 껍데기는 납작한 굴로, 하구의 바위나 껍데기에 붙어 산다. 줄에 매달거나 갯벌에서 기른다. | [FAO Cultured Aquatic Species · Crassostrea gigas](https://www.fao.org/fishery/docs/DOCUMENT/aquaculture/CulturedSpecies/file/en/en_pacificcuppedoyster.htm) (Crassostrea gigas) |
| 12 | 가시파래 (*Ulva prolifera*) | 속이 빈 관 모양 몸에 가는 가지가 많이 돋는 녹조류로, 작은 부착기로 붙어 곧게 선다. 바다와 강어귀의 짠물에서 자란다. | [Marine Biodiversity of Bangladesh · Ulva prolifera](https://marinebiodiversity.org.bd/species/ulva-prolifera/) |
| 13 | 시카메굴 (*Magallana sikamea*) | 다 자라도 6cm 안팎인 작은 굴이지만 껍데기가 깊게 오목하다. 바닷가 바위의 조간대에 붙어 살며, 맛으로 찾는 양식 굴이다. | [Smithsonian NEMESIS · Magallana sikamea](https://invasions.si.edu/nemesis/species_summary/-692) |
| 14 | 가리맛조개 (*Sinonovacula constricta*) | 맛조개 무리에 속하는 조개로, 갯벌의 펄이나 모래펄 속 깊이 파고들어 산다. 어린 조개를 갯벌에 뿌려 기른다. | [FAO · Sinonovacula constricta (razor clam culture)](https://www.fao.org/4/ab736e/AB736E05.htm) |
| 15 | 살오징어 (*Todarodes pacificus*) | 먼바다와 연안의 표층을 헤엄쳐 다니는 오징어로, 멸치 같은 작은 물고기와 갑각류를 먹는다. 낚시 기계와 그물로 잡는다. | [SeaLifeBase · Todarodes pacificus, Japanese flying squid](https://sealifebase.ca/summary/Todarodes-pacificus.html) |
| 16 | 갑오징어 (*Acanthosepion esculentum*) | 수심 10~150m 바다에 사는 갑오징어로, 때로 바닥을 파고들어 몸을 숨긴다. 그물과 낚시로 잡는다. | [SeaLifeBase · Sepia esculenta, Golden cuttlefish](https://www.sealifebase.ca/summary/Sepia-esculenta) (Sepia esculenta) |
| 17 | 미역 (*Undaria pinnatifida*) | 가운데 줄기와 깃 모양 잎을 가진 한해살이 갈조류로, 보통 1m 안팎까지 자란다. 줄에 붙여 길러 날것이나 말려서 먹는다. | [FAO Fisheries fact sheet · Undaria pinnatifida](https://www.marineagronomy.org/sites/default/files/FAO%20Fisheries%20fact%20sheet%20-%20Undaria.pdf) |
| 18 | 홍합(참담치) (*Mytilus coruscus*) | 껍데기가 10cm쯤까지 자라는 홍합 무리 조개로, 주로 수심 20m보다 얕은 바닥에 산다. 바다에서 잡기도 하고 양식도 한다. | [SeaLifeBase · Mytilus coruscus, Far Eastern mussel](https://sealifebase.org/summary/83784) |
| 19 | 해삼 (*Apostichopus japonicus*) | 바닥 퇴적물 속 유기물을 먹고 사는 해삼으로, 얕은 바다의 모래펄이나 자갈 바닥에 산다. 잡기도 하고 양식도 한다. | [SeaLifeBase · Apostichopus japonicus, Japanese sea cucumber](https://www.sealifebase.ca/summary/Apostichopus-japonicus) |
| 20 | 대구 (*Gadus macrocephalus*) | 대륙붕과 그 비탈의 바닥 가까이에 사는 물고기로, 물고기·문어·갑각류를 먹는다. 생물·냉동이나 말리고 절여서 판다. | [FishBase · Gadus macrocephalus, Pacific cod](https://www.fishbase.se/summary/308) |
| 21 | 멍게 (*Halocynthia roretzi*) | 멍게류(피낭동물)로 바다 파인애플이라고도 불린다. 줄에 유생을 붙여 기르며, 한국과 일본에서 양식해 먹는다. | [Lambert et al. 2016, Management of Biological Invasions 7: 59–66](https://repository.library.noaa.gov/view/noaa/40746/noaa_40746_DS26.pdf) |
| 22 | 방어 (*Seriola quinqueradiata*) | 무리 지어 다니는 물고기로, 어린 물고기는 떠다니는 해조류 사이에서 지낸다. 어린 고기를 잡아 길러 회로 먹는다. | [FishBase · Seriola quinqueradiata, Japanese amberjack](https://www.fishbase.se/summary/381) |
| 23 | 꼬시래기 (*Gracilaria vermiculophylla*) | 가늘고 긴 가지가 불규칙하게 뻗는 붉은 갈색의 홍조류로, 보통 10~30cm다. 잔잔한 만과 강어귀의 펄 바닥에서 자란다. | [AlgaeBase Seaweed Site · Gracilaria vermiculophylla](https://seaweed.algaebase.org/descriptions/Gracilaria_vermiculophylla.html) |
| 24 | 큰가리비 (*Mizuhopecten yessoensis*) | 지름 10~22cm의 둥근 껍데기를 가진 가리비로, 찬 바다의 모래 바닥에 산다. 그물에 넣어 매달거나 바닥에 뿌려 기른다. | [FAO Cultured Aquatic Species · Patinopecten yessoensis](https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_yessoscallop.htm) (Patinopecten yessoensis) |
| 25 | 다시마 (*Saccharina japonica*) | 띠 모양의 긴 잎과 짧은 줄기, 뿌리 같은 부착기를 가진 갈조류로, 찬 바다 바위에 붙어 자란다. 뗏목에 매단 줄에서 기른다. | [FAO Cultured Aquatic Species · Laminaria japonica](https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_japanesekelp.htm) (Laminaria japonica) |
| 26 | 전복(종 수준) (*Haliotis discus*) | 고둥과 같은 복족류에 속하는 전복으로, 수심 30m보다 얕은 연안 바닥에 산다. 어업으로 잡아 비싼 값에 팔린다. | [SeaLifeBase · Haliotis discus, Japanese abalone](https://sealifebase.org/summary/83743) |
| 27 | 감태 (*Ecklonia cava*) | 다시마목에 속하는 큰 갈조류(켈프)로, 얕은 바닷속에서 빽빽하게 무리 지어 띠를 이루며 자란다. | [Kang et al. 2001, Algae 16(2): 209–215](https://sciwatch.kiost.ac.kr/handle/2020.kiost/5886) |
| 28 | 괭생이모자반 (*Sargassum horneri*) | 모자반과의 갈조류로, 얕은 바닷속 암초에 붙어 자라다 떨어져 나가면 바다에 떠다니며 큰 무리를 이룬다. | [Wu et al. 2023, Journal of Marine Science and Engineering 11(1): 9](https://www.mdpi.com/2077-1312/11/1/9) |
| 29 | 우뭇가사리 (*Gelidium elegans*) | 우뭇가사리목에 속하는 홍조류로, 한천을 만드는 원료로 쓴다. 바닷속 바위 같은 단단한 바닥에 붙어 자란다. | [Tsuchiya et al. 2009, Nippon Suisan Gakkaishi 75(6): 1051–1060](https://www.miyagi.kopas.co.jp/JSFS/jsfs-english/E-PUB/75-6/p1051.html) |
| 30 | 참문어(동아시아 종) (*Octopus sinensis*) | 동아시아에 사는 문어로, 오랫동안 대서양·지중해 문어와 같은 종으로 여겨지다 2016년에 따로 이름이 정리됐다. 값어치 있는 어획물이다. | [Gleadall 2016, Species Diversity 21(1): 31–42](https://www.jstage.jst.go.jp/article/specdiv/21/1/21_31/_article) |

## 아이폰 실기에서 다시 볼 것

1. 탐색 지도에서 아래 시트를 천천히 올릴 때 왼쪽 아래 범례가 시트 윗선 바로 위를 따라 올라오는지, 주소창이 접히고 펴질 때 범례가 시트에 반쯤 걸리지 않는지.
2. 범례를 펼친 채 올릴 때 위 '출현 기록·활용 × 보전' 버튼 줄 아래에서 멈추는지.
3. 활용 × 보전에서 셀 색 칸이 함께 올라오는지, 오른쪽 아래 ⓘ가 가려지지 않는지.
4. 종 상세 '자원 감소 신호' 그래프에서 2024와 25p가 떨어져 보이는지.
5. 바다 탐험 카드에서 설명이 이름 바로 아래 보이고, 카드를 끝까지 내려 '자세히 보기'·'지도에서 보기'를 누를 수 있는지.

## 다시 돌리기

```
python -m http.server 8765 --bind 127.0.0.1 --directory dist      # 이 브랜치
python -m http.server 8766 --bind 127.0.0.1 --directory <main>/dist  # 전후 비교용
SUPA=fixture node verification/2026-10-31-mobile-feedback/measure.mjs out.json [spark|legend|all]   # B=주소
SUPA=fixture TAG=after node verification/2026-10-31-mobile-feedback/shots.mjs <폴더>
GL=swiftshader node verification/2026-10-31-mobile-feedback/about_check.mjs <폴더>
```
