# 영어 화면 종 이름 노트

영어 화면(`?lang=en`)의 종 이름은 `dist/species-names-en.json`에서 읽는다. 형식은
`{AphiaID: {"en", "kind", "source", "alt", "checked"}}`이고 `scripts/build_species_names_en.py`가 아래 출처에서만 채운다. 이름은 지어내지 않는다.

1. WoRMS 영어 vernacular (`AphiaVernacularsByAphiaID`, language_code `eng`)
2. 1이 없으면 같은 종의 이전 학명(`AphiaSynonymsByAphiaID`, 계급 Species만)의 영어 vernacular. 아종·속 이름은 빌리지 않는다
3. FAO ASFIS 영어 이름(학명이 정명과 같은 줄, 없으면 동의어와 같은 줄)

- 기본 고르기: WoRMS preferred → ASFIS(정명 줄) → WoRMS 정명 이름 → WoRMS 동의어 이름 → ASFIS(동의어 줄), 같은 단계에서는 짧은 것.
  사람이 고른 이름은 `species-names-choices.json`(이름과 이유)이 먼저이고, 그 이름도 받은 후보 안에 있어야 한다.
- 이름이 하나도 없는 종은 `"en": null, "kind": "scientific"`: 영어 화면에서 학명이 이름 자리에 그대로 보인다(지금까지와 같음).
- `alt`는 같은 출처의 다른 영어 이름으로, 화면에는 보이지 않고 검색에만 쓴다.
- 대문자는 문장형(첫 글자만), 원래 대문자인 지명은 그대로.

## 2026-10-25 원본

- 클라우드 세션에서는 `www.marinespecies.org`·`www.fao.org`가 막혀 있어(프록시 403), LKH PC에서 받았다(표준 라이브러리 스크립트, 2026-10-25).
- 원본: `species-names-raw-2026-10-25.json` — WoRMS 응답 그대로(30종 레코드·영어 이름·동의어 196개와 그 영어 이름),
  ASFIS는 `https://www.fao.org/fishery/static/ASFIS/ASFIS_sp.zip`(sha256 `41ffe32651ca4c88c203212617e3741ea76286a70b371fa34711637edee45e89`, 28줄 맞춤)에서 맞춘 줄만. ASFIS 파일 전체는 저장소에 두지 않는다.
- 다시 만들기: `python scripts/build_species_names_en.py --rebuild`, 확인: `--check`(CI unit 잡).
- WoRMS에 정명 영어 이름이 없는 종 중 영어 이름이 생긴 곳: 이전 학명(참굴·홍합·갑오징어), ASFIS(다시마·시카메굴·전복·가리맛조개·가시파래).

## 종마다 (● = 지명이 든 표준 이름: 팀이 볼 것)

| 국명 | 학명 | 영어 이름 | 출처 | kind | 다른 이름(alt) | 고른 이유 |
|---|---|---|---|---|---|---|
| 미역 | *Undaria pinnatifida* | Wakame | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 해삼 | *Apostichopus japonicus* | Japanese sea cucumber ● | FAO ASFIS | common | Japanese spiky sea cucumber | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 멍게 | *Halocynthia roretzi* | Sea pineapple | WoRMS | common | Korean common sea squirt, Red oyas | WoRMS 영어 이름. ASFIS 'Red oyas'는 일반 독자에게 낯설다 |
| 살오징어 | *Todarodes pacificus* | Japanese flying squid ● | FAO ASFIS | common | Common flying squid | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 우뭇가사리 | *Gelidium elegans* | — (학명) | — | scientific | — | WoRMS(정명·동의어)·FAO ASFIS에 영어 이름 없음 → 학명이 이름 |
| 톳 | *Sargassum fusiforme* | Fusiform sargassum | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 홍합(참담치) | *Mytilus coruscus* | Korean mussel ● | WoRMS (synonym Mytilus crassitesta) | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 참굴 | *Magallana gigas* | Pacific oyster ● | WoRMS (synonym Crassostrea gigas) | common | Giant cupped oyster, Giant oyster, Giant pacific oyster, Immigrant oyster, Japanese oyster, Pacific cupped oyster, Pacific giant oyster, Portuguese oyster | WoRMS(이전 학명 Crassostrea gigas) 영어 이름 중 가장 짧고 흔한 이름. ASFIS 'Pacific cupped oyster'는 같은 뜻의 긴 거래명 |
| 다시마 | *Saccharina japonica* | Japanese kelp ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 감태 | *Ecklonia cava* | — (학명) | — | scientific | — | WoRMS(정명·동의어)·FAO ASFIS에 영어 이름 없음 → 학명이 이름 |
| 가시파래 | *Ulva prolifera* | Dark green nori | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 괭생이모자반 | *Sargassum horneri* | — (학명) | — | scientific | — | WoRMS(정명·동의어)·FAO ASFIS에 영어 이름 없음 → 학명이 이름 |
| 꼬시래기 | *Gracilaria vermiculophylla* | — (학명) | — | scientific | — | WoRMS(정명·동의어)·FAO ASFIS에 영어 이름 없음 → 학명이 이름 |
| 청각 | *Codium fragile* | Fragile codium | FAO ASFIS | common | Felt-alga, Forked felt alga, Sponge seaweed | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 바지락 | *Ruditapes philippinarum* | Manila clam ● | WoRMS | common | Japanese carpet shell, Japanese clam, Japanese littleneck, Japanese littleneck clam, Manilla clam, Short-necked clam | WoRMS 영어 이름 중 시장·연구에서 가장 흔한 이름. ASFIS 'Japanese carpet shell'은 일반 독자에게 낯설다 |
| 전복(종 수준) | *Haliotis discus* | Japanese abalone ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 큰가리비 | *Mizuhopecten yessoensis* | Yesso scallop ● | FAO ASFIS | common | Ezo giant scallop, Giant Ezo scallop, Japanese weathervane scallop, Large weathervane scallop | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 시카메굴 | *Magallana sikamea* | Kumamoto oyster ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 피조개 | *Anadara broughtonii* | Inflated ark | FAO ASFIS | common | Blood clam | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 가리맛조개 | *Sinonovacula constricta* | Constricted tagelus | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 고등어 | *Scomber japonicus* | Pacific chub mackerel ● | FAO ASFIS | common | Atlantic chub mackerel, Chub mackerel, Spanish mackerel | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 멸치 | *Engraulis japonicus* | Japanese anchovy ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 참조기 | *Larimichthys polyactis* | Yellow croaker | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 넙치 | *Paralichthys olivaceus* | Olive flounder | FAO ASFIS | common | Bastard halibut, Summer flounder | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 조피볼락 | *Sebastes schlegelii* | Korean rockfish ● | FAO ASFIS | common | Schlegel’s rockfish | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 방어 | *Seriola quinqueradiata* | Japanese amberjack ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 대구 | *Gadus macrocephalus* | Pacific cod ● | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 꽃게 | *Portunus trituberculatus* | Gazami crab | FAO ASFIS | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |
| 참문어(동아시아 종) | *Octopus sinensis* | — (학명) | — | scientific | — | WoRMS(정명·동의어)·FAO ASFIS에 영어 이름 없음 → 학명이 이름 |
| 갑오징어 | *Acanthosepion esculentum* | Golden cuttlefish | WoRMS (synonym Sepia esculenta) | common | — | 기본 규칙(WoRMS preferred 없음 → ASFIS 정명 줄 → WoRMS 이름 → 동의어 이름, 같은 단계는 짧은 것) |

## 팀이 볼 것

- 지명이 든 표준 이름(●)이 여럿이다(Japanese·Pacific·Korean 등). 출처의 표준 이름이라 그대로 두었다. 다른 후보로 바꾸려면 `species-names-choices.json`에 이유와 함께 적는다.
- 피조개는 ASFIS `Inflated ark`를 썼다. WoRMS의 `Blood clam`은 더 흔하지만 꼬막(*Tegillarca granosa*)에도 쓰이는 이름이라 고르지 않았다.
- 가시파래의 ASFIS 이름 `Dark green nori`, 청각의 `Fragile codium`은 공식 거래명이다. 더 쉬운 WoRMS 이름(청각 `Sponge seaweed` 등)으로 바꿀 수 있다.
- 우뭇가사리·감태·괭생이모자반·꼬시래기·참문어는 WoRMS·ASFIS에 영어 이름이 없어 학명으로 보인다. AlgaeBase·SeaLifeBase에서 찾으면 `species-names-manual-YYYY-MM-DD.json`에 이름·주소·날짜만 적고 스크립트가 읽게 한다(아직 안 함).
