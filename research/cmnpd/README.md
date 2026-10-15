# CMNPD 후보 화합물 탐색 레이어 (2026-10-15)

**한 줄:** CMNPD는 후보 화합물을 찾는 데 쓰고, 점수는 표준화가 가능한 ChEMBL로 계산합니다.

- 기록: [`cmnpd-candidates-2026-10-15.json`](cmnpd-candidates-2026-10-15.json) → `python scripts/build_cmnpd_candidates.py [--check]` → `dist/cmnpd-candidates.json`
- 화면: '비교와 지표' 종 프로필의 **후보 화합물 탐색 · 점수 미사용** 줄(30종 모두), '근거와 방법' 02 접기의 **왜 MBPI의 주 소스가 ChEMBL인가요?** 카드
- 점수: MFPI·MBPI·MCUI·BBVI·사분면 유형·지도 색·쓰임새 칩 모두 이 파일을 읽지 않는다(`verification/test_cmnpd_candidates*.{py,mjs}`가 확인).
- 이용조건: CMNPD 1.0 · CC BY-NC-SA 4.0 ([약관](https://docs.cmnpd.org/terms-and-conditions)) · 인용 doi:10.1093/nar/gkaa763. **CMNPD 화합물 ID와 개수만** 싣는다. 화합물 이름·구조·InChIKey·활성값은 저장소와 화면에 옮기지 않았다.

## 조회 방법

클라우드 작업 환경에서는 cmnpd.org에 직접 접속이 막혀 있어(프록시 403), 2026-10-15 공개 CMNPD 사이트를 브라우저로 열어 같은 사이트의 공개 조회를 사용했다. 각 종을 WoRMS 승인 학명과 WoRMS 이명 전부(`mbpi-links-2026-09-30.json`의 이름 목록, 총 226개)로 찾아, 생물 이름이 정확히 일치하는 CMNPD 생물 ID의 'Associated Compounds' 목록을 받았다. 화합물마다 표준 InChIKey와 CMNPD가 적어 둔 ChEMBL 교차 참조를 읽어 MBPI의 종→화합물 연결(위키데이터 P703 + 원논문 연결, verified-4.18)과 대조했다. 대조에 쓴 InChIKey는 저장하지 않았다. 해삼 122개는 운영 DB 프로필이 이미 CMNPD에서 받아 공개하던 수와 같다.

## 결과 · 30종 CMNPD 화합물 수와 연결 공백

- CMNPD 보고 화합물: **30종 중 13종, 종–화합물 쌍 187개**. 17종은 학명·이명 어느 것으로도 CMNPD 생물 기록이 없다(CMNPD 1.0은 2020-09-01 갱신본).
- MBPI 연결과 같은 InChIKey: 13쌍 · 골격(InChIKey 첫 블록)만 같은 입체·전하 변이: 15쌍
- MBPI 연결을 거쳐 ChEMBL 분자까지 이어진 쌍: **1쌍**(감태 CMNPD16752 = CHEMBL459393)
- **연결 공백(CMNPD에는 있는데 ChEMBL 연결이 없는 종–화합물 쌍): 186쌍**
- **Conus magus형 누락 사례(ChEMBL에는 화합물이 있는데 종 연결이 없음): 4건** — CMNPD가 ChEMBL ID를 함께 적은 화합물 가운데 MBPI 종 연결에 없는 것. 네 ChEMBL ID 모두 2026-10-15 ChEMBL에서 조회해 InChIKey가 CMNPD 값과 같음을 확인했다. 꼬시래기 2건은 MBPI 연결에 같은 골격의 다른 입체 이성질체만 있다. 멍게 1건은 흔한 대사산물이어서, 연결하더라도 MBPI 공통 대사산물 규칙에 걸릴 수 있다.
- Conus magus 자체는 CMNPD 1.0에 생물 기록이 없다(ziconotide·conotoxin 항목도 없음). 그래서 같은 유형의 누락을 30종 안에서 CMNPD의 ChEMBL 교차 참조로 셌다.
- 이 누락을 MBPI에 넣으려면 종–화합물 연결을 원논문으로 다시 검수해야 한다(3.20 원논문 연결 규칙). 이번 작업은 기록만 하고 점수 규칙·연결은 바꾸지 않았다.

| 종 | 학명 | CMNPD 생물 ID | CMNPD 화합물 | MBPI 같은 InChIKey | 같은 골격만 | ChEMBL 연결 | 연결 공백 | ChEMBL에 있지만 종 연결 없음 |
|---|---|---|---:|---:|---:|---:|---:|---|
| 해삼 | *Apostichopus japonicus* | CMNPD370960 | 122 | 0 | 1 | 0 | 122 | — |
| 큰가리비 | *Mizuhopecten yessoensis* | CMNPD371010 | 14 | 2 | 5 | 0 | 14 | — |
| 참굴 | *Magallana gigas* | CMNPD371004 | 13 | 5 | 3 | 0 | 13 | — |
| 멍게 | *Halocynthia roretzi* | CMNPD370241 | 12 | 1 | 2 | 0 | 12 | CMNPD10845→CHEMBL1234101 |
| 다시마 | *Saccharina japonica* | CMNPD372636 | 9 | 0 | 1 | 0 | 9 | — |
| 톳 | *Sargassum fusiforme* | CMNPD372604 | 4 | 0 | 0 | 0 | 4 | — |
| 꼬시래기 | *Gracilaria vermiculophylla* | CMNPD373261 | 3 | 0 | 3 | 0 | 3 | CMNPD15872→CHEMBL445447, CMNPD15874→CHEMBL451514 |
| 미역 | *Undaria pinnatifida* | CMNPD372631 | 3 | 3 | 0 | 0 | 3 | — |
| 감태 | *Ecklonia cava* | CMNPD372637 | 2 | 1 | 0 | 1 | 1 | — |
| 바지락 | *Ruditapes philippinarum* | CMNPD371018 | 2 | 0 | 0 | 0 | 2 | CMNPD5792→CHEMBL525964 |
| 청각 | *Codium fragile* | CMNPD373079 | 1 | 0 | 0 | 0 | 1 | — |
| 피조개 | *Anadara broughtonii* | CMNPD370991 | 1 | 0 | 0 | 0 | 1 | — |
| 홍합(참담치) | *Mytilus coruscus* | CMNPD371000 | 1 | 1 | 0 | 0 | 1 | — |
| 가리맛조개 | *Sinonovacula constricta* | — | 0 | 0 | 0 | 0 | 0 | — |
| 가시파래 | *Ulva prolifera* | — | 0 | 0 | 0 | 0 | 0 | — |
| 갑오징어 | *Acanthosepion esculentum* | — | 0 | 0 | 0 | 0 | 0 | — |
| 고등어 | *Scomber japonicus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 괭생이모자반 | *Sargassum horneri* | — | 0 | 0 | 0 | 0 | 0 | — |
| 꽃게 | *Portunus trituberculatus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 넙치 | *Paralichthys olivaceus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 대구 | *Gadus macrocephalus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 멸치 | *Engraulis japonicus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 방어 | *Seriola quinqueradiata* | — | 0 | 0 | 0 | 0 | 0 | — |
| 살오징어 | *Todarodes pacificus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 시카메굴 | *Magallana sikamea* | — | 0 | 0 | 0 | 0 | 0 | — |
| 우뭇가사리 | *Gelidium elegans* | — | 0 | 0 | 0 | 0 | 0 | — |
| 전복(종 수준) | *Haliotis discus* | — | 0 | 0 | 0 | 0 | 0 | — |
| 조피볼락 | *Sebastes schlegelii* | — | 0 | 0 | 0 | 0 | 0 | — |
| 참문어(동아시아 종) | *Octopus sinensis* | — | 0 | 0 | 0 | 0 | 0 | — |
| 참조기 | *Larimichthys polyactis* | — | 0 | 0 | 0 | 0 | 0 | — |
| **합계** | | 13종 | **187** | 13 | 15 | **1** | **186** | **4** |

## 점수 diff

변경 없음. `dist/assessments.json`·`dist/matrix-readiness.json`·`config/`는 main(verified-4.18)과 바이트 단위로 같고, `build_verified_indices.py --check`·`build_matrix_readiness.py --check`가 통과한다. 30종의 MFPI·MBPI·MCUI·BBVI와 사분면 유형은 이 파일이 없을 때·있을 때·모든 수를 바꿨을 때 같다(`test_cmnpd_candidates_ui.mjs`).

## 화면 확인

`verification/2026-10-15-cmnpd-candidates/` · `capture.mjs` 22/22 PASS(1440·390px, 해삼·감태·고등어 프로필, 근거와 방법 카드, 11px 미만 글자 없음, 가로 넘침 없음).
