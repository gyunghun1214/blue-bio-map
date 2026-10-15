# 화합물 기원 분류 결과 · 2026-10-15

`scripts/build_origin_review.py`가 `research/verified-indices/origin-review-2026-10-15.json`와 `dist/assessments.json`(verified-4.19)으로 만든 표입니다. 규칙은 `research/verified-indices/origin-class-rule-2026-10-15.md`(출력보다 먼저 커밋). 점수·유형·50선·가중치는 바뀌지 않습니다.

## 요약

- 종 30개, MBPI 점수 항목 91개
- 의심 항목(확인됨이 아닌 항목) 19개: producer_confirmed 72, associated_possible 12, artifact_possible 5, sample_mismatch 2, unknown 0
- 최상위 항목이 의심으로 분류된 종 7개: 멍게, 우뭇가사리, 홍합(참담치), 다시마, 바지락, 시카메굴, 멸치

## MBPI와 참고값 mbpi_origin_strict

| 종 | MBPI | 참고값(확인 항목만) | 차이 | 최상위 근거 기원 | 최상위 분류 | 의심/전체 |
|---|---:|---:|---:|---|---|---:|
| 미역 | 89.2 | 89.2 | +0.0 | 확인됨 | producer_confirmed | 0/8 |
| 해삼 | 8.7 | 8.7 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 멍게 | 13.5 | 없음 | – | 의심 | associated_possible | 1/1 |
| 살오징어 | 56.9 | 56.9 | +0.0 | 확인됨 | producer_confirmed | 0/2 |
| 우뭇가사리 | 13.5 | 없음 | – | 의심 | sample_mismatch | 1/1 |
| 톳 | 65.0 | 65.0 | +0.0 | 확인됨 | producer_confirmed | 3/6 |
| 홍합(참담치) | 10.1 | 없음 | – | 의심 | associated_possible | 1/1 |
| 참굴 | 72.2 | 72.2 | +0.0 | 확인됨 | producer_confirmed | 3/6 |
| 다시마 | 26.5 | 없음 | – | 의심 | artifact_possible | 2/2 |
| 감태 | 56.8 | 56.8 | +0.0 | 확인됨 | producer_confirmed | 0/10 |
| 가시파래 | 73.3 | 73.3 | +0.0 | 확인됨 | producer_confirmed | 0/3 |
| 괭생이모자반 | 21.6 | 21.6 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 꼬시래기 | 49.3 | 49.3 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 청각 | 0.6 | 0.6 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 바지락 | 58.6 | 39.5 | -19.1 | 의심 | associated_possible | 4/7 |
| 전복(종 수준) | 15.6 | 15.6 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 큰가리비 | 27.3 | 27.3 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 시카메굴 | 13.8 | 없음 | – | 의심 | sample_mismatch | 1/1 |
| 피조개 | 75.0 | 75.0 | +0.0 | 확인됨 | producer_confirmed | 0/8 |
| 가리맛조개 | 56.9 | 56.9 | +0.0 | 확인됨 | producer_confirmed | 0/3 |
| 고등어 | 34.9 | 34.9 | +0.0 | 확인됨 | producer_confirmed | 0/4 |
| 멸치 | 22.6 | 없음 | – | 의심 | associated_possible | 3/3 |
| 참조기 | 53.8 | 53.8 | +0.0 | 확인됨 | producer_confirmed | 0/2 |
| 넙치 | 43.2 | 43.2 | +0.0 | 확인됨 | producer_confirmed | 0/6 |
| 조피볼락 | 31.7 | 31.7 | +0.0 | 확인됨 | producer_confirmed | 0/4 |
| 방어 | 7.5 | 7.5 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 대구 | 59.9 | 59.9 | +0.0 | 확인됨 | producer_confirmed | 0/2 |
| 꽃게 | 30.3 | 30.3 | +0.0 | 확인됨 | producer_confirmed | 0/2 |
| 참문어(동아시아 종) | 70.5 | 70.5 | +0.0 | 확인됨 | producer_confirmed | 0/1 |
| 갑오징어 | 65.8 | 65.8 | +0.0 | 확인됨 | producer_confirmed | 0/1 |

## 항목별 origin_class

| 종 | 항목 | 층 | 조정값 | origin_class | 사유 |
|---|---|---|---:|---|---|
| 미역 | VW | peptide | 89.2 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | IW | peptide | 71.5 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | IY | peptide | 60.7 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | AW | peptide | 47.6 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | LW | peptide | 44.6 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | VY | peptide | 39.2 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | FY | peptide | 37.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 미역 | KNFL | peptide | 19.6 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 해삼 | HDWWKER | peptide | 8.7 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 멍게 | HALOCYNTHIAXANTHIN | chembl | 13.5 | ⚠ associated_possible | 동물은 카로티노이드를 새로 만들지 못하고 먹이에서 얻어 바꿉니다. 할로시티아잔틴은 먹이 조류의 푸코잔틴이 바뀐 물질로 알려져 있습니다. |
| 살오징어 | YALPHA | peptide | 56.9 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 살오징어 | GYALPHA | peptide | 42.8 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 우뭇가사리 | PHEOPHORBIDE A | chembl | 13.5 | ⚠ sample_mismatch | 점수에 쓴 HIV-1 IC50은 다른 생물(Vatica cinerea)에서 얻은 페오포바이드 a로 잰 값입니다. 엽록소 분해 산물이라, 말린 엽체를 추출하는 중에 생겼을 수 있습니다. |
| 톳 | GKY | peptide | 65.0 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 톳 | SVY | peptide | 58.6 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 톳 | SKTY | peptide | 55.2 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 톳 | CHEMBL275911 | chembl | 45.3 | ⚠ artifact_possible | 푸코스테롤에서 나온 산화 스테롤이라 건조 중 자동 산화로 생겼을 수 있습니다. |
| 톳 | CHEMBL252561 | chembl | 26.5 | ⚠ artifact_possible | 푸코스테롤이 빛·공기에 산화하면 생기는 물질이라 건조·추출 중에 생겼을 수 있습니다. |
| 톳 | SARINGOSTEROL | chembl | 19.6 | ⚠ artifact_possible | 푸코스테롤이 빛·공기에 산화하면 생기는 물질이라 건조·추출 중에 생겼을 수 있습니다. |
| 홍합(참담치) | HALOCYNTHIAXANTHIN | chembl | 10.1 | ⚠ associated_possible | 동물은 카로티노이드를 새로 만들지 못하고 먹이에서 얻어 바꿉니다. 할로시티아잔틴은 먹이 조류의 푸코잔틴이 바뀐 물질로 알려져 있습니다. |
| 참굴 | LQP | peptide | 72.2 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 참굴 | Cg-BigDef1 | amp | 62.6 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 참굴 | CHEMBL1980535 | chembl | 29.4 | ⚠ associated_possible | 페리디닌은 와편모조류의 색소로, 참굴은 먹이에서 얻어 조직에 쌓습니다. |
| 참굴 | CHEMBL1980535 | chembl | 19.9 | ⚠ associated_possible | 페리디닌은 와편모조류의 색소로, 참굴은 먹이에서 얻어 조직에 쌓습니다. |
| 참굴 | HALOCYNTHIAXANTHIN | chembl | 10.1 | ⚠ associated_possible | 동물은 카로티노이드를 새로 만들지 못하고 먹이에서 얻어 바꿉니다. 할로시티아잔틴은 먹이 조류의 푸코잔틴이 바뀐 물질로 알려져 있습니다. |
| 참굴 | AEYLCEAC | peptide | 1.1 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 다시마 | CHEMBL252561 | chembl | 26.5 | ⚠ artifact_possible | 푸코스테롤이 빛·공기에 산화하면 생기는 물질이라 건조·추출 중에 생겼을 수 있습니다. |
| 다시마 | SARINGOSTEROL | chembl | 19.6 | ⚠ artifact_possible | 푸코스테롤이 빛·공기에 산화하면 생기는 물질이라 건조·추출 중에 생겼을 수 있습니다. |
| 감태 | DIECKOL | chembl | 56.8 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | ECKOL | chembl | 46.1 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | PHLOROFUCOFUROECKOL A | chembl | 39.3 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | CHEMBL456228 | chembl | 28.9 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | CHEMBL443626 | chembl | 24.8 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | 2-PHLOROECKOL | chembl | 23.9 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | FUCODIPHLOROETHOL G | chembl | 22.7 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | CHEMBL502202 | chembl | 19.8 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | CHEMBL502202 | chembl | 19.8 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 감태 | DIOXINODEHYDROECKOL | chembl | 9.0 | producer_confirmed | 플로로탄닌은 갈조류가 스스로 만드는 폴리페놀이며, 연결 논문이 감태에서 분리했습니다. |
| 가시파래 | KAF | peptide | 73.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 가시파래 | HTDT-6-2-3-2 | anticancer | 2.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 가시파래 | HTDT-6-2-3-2 | anticancer | 2.1 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 괭생이모자반 | CHEMBL4085945 | chembl | 21.6 | producer_confirmed | 모자반류가 만드는 크로메놀(메로테르페노이드)이며, 연결 논문 3편이 괭생이모자반에서 분리했습니다. |
| 꼬시래기 | PROSTAGLANDIN A2 | chembl | 49.3 | producer_confirmed | 상처 난 꼬시래기 조직에서 효소 반응으로 크게 늘어나는 방어 물질(에이코사노이드)로 보고됐습니다. |
| 청각 | CHEMBL5287816 | chembl | 0.6 | producer_confirmed | 청각류 녹조가 광합성 색소로 만드는 카로티노이드이며, 점수 값도 청각에서 정제한 시료로 쟀습니다. |
| 바지락 | VISDEDGVTH | peptide | 58.6 | ⚠ associated_possible | Bacillus natto로 발효한 바지락에서 찾은 서열이라, 원문(초록)이 바지락 단백질과 맞춰 보이지 않아 발효균 단백질에서 나왔을 수도 있습니다. |
| 바지락 | LDSGDGVTH | peptide | 43.5 | ⚠ associated_possible | Bacillus natto로 발효한 바지락에서 찾은 서열이라, 원문(초록)이 바지락 단백질과 맞춰 보이지 않아 발효균 단백질에서 나왔을 수도 있습니다. |
| 바지락 | IAE | peptide | 39.5 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 바지락 | VVVGDGAVGK | peptide | 36.6 | ⚠ associated_possible | Bacillus natto로 발효한 바지락에서 찾은 서열이라, 원문(초록)이 바지락 단백질과 맞춰 보이지 않아 발효균 단백질에서 나왔을 수도 있습니다. |
| 바지락 | FAGDDAPRA | peptide | 32.8 | ⚠ associated_possible | Bacillus natto로 발효한 바지락에서 찾은 서열이라, 원문(초록)이 바지락 단백질과 맞춰 보이지 않아 발효균 단백질에서 나왔을 수도 있습니다. |
| 바지락 | IVE | peptide | 26.4 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 바지락 | LLP | peptide | 23.0 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 전복(종 수준) | AMN | peptide | 15.6 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 큰가리비 | VW | peptide | 27.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 시카메굴 | FLAZINE | chembl | 13.8 | ⚠ sample_mismatch | 점수에 쓴 항바이러스 값은 버섯(Suillus granulatus)에서 분리한 flazin으로 잰 값입니다. flazin은 가열·발효 식품에서 생기는 물질로 알려져 있습니다. |
| 피조개 | P6 | anticancer | 75.0 | producer_confirmed | 이 종의 혈림프에서 정제한 펩타이드의 단편 서열입니다. |
| 피조개 | P6 | anticancer | 50.0 | producer_confirmed | 이 종의 혈림프에서 정제한 펩타이드의 단편 서열입니다. |
| 피조개 | AI-hemocidin 2 | amp | 22.0 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 피조개 | AI-hemocidin 1 | amp | 14.0 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 피조개 | AI-hemocidin 2 | amp | 12.9 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 피조개 | AI-hemocidin 1 | amp | 12.8 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 피조개 | AI-hemocidin 2 | amp | 5.7 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 피조개 | AI-hemocidin 2 | amp | 1.5 | producer_confirmed | 이 종 자신의 헤모글로빈 유전자(GenBank AB713934)가 암호화한 서열의 단편입니다. |
| 가리맛조개 | VQY | peptide | 56.9 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 가리맛조개 | SCH-P10 | anticancer | 3.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 가리맛조개 | SCH-P9 | anticancer | 3.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 고등어 | PLITT | peptide | 34.9 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 고등어 | APFLAG | peptide | 30.9 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 고등어 | FDHKKFF | peptide | 20.7 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 고등어 | LFPKFA | peptide | 18.8 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 멸치 | DGGP | peptide | 22.6 | ⚠ associated_possible | 멸치 발효 액젓에서 찾은 서열이라, 원문이 멸치 단백질과 맞춰 보이지 않아 발효 미생물 단백질에서 나왔을 수도 있습니다. |
| 멸치 | GCK | peptide | 21.9 | ⚠ associated_possible | 멸치 발효 액젓에서 찾은 서열이라, 원문이 멸치 단백질과 맞춰 보이지 않아 발효 미생물 단백질에서 나왔을 수도 있습니다. |
| 멸치 | PK | peptide | 1.1 | ⚠ associated_possible | 멸치 발효 액젓에서 찾은 서열이라, 원문이 멸치 단백질과 맞춰 보이지 않아 발효 미생물 단백질에서 나왔을 수도 있습니다. |
| 참조기 | WW8 | xo | 53.8 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 참조기 | AW10 | xo | 37.5 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 넙치 | P35 | amp | 43.2 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 넙치 | P35 | amp | 38.6 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 넙치 | P35 | amp | 36.3 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 넙치 | P35 | amp | 35.6 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 넙치 | MEVFVP | peptide | 29.2 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 넙치 | VSQLTR | peptide | 25.8 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 조피볼락 | TS40 | amp | 31.7 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 조피볼락 | TS40 | amp | 12.8 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 조피볼락 | TS40 | amp | 0.0 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 조피볼락 | TS40 | amp | 0.0 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 방어 | sbGnRH([Ser8]GnRH) | relaxed | 7.5 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 대구 | GASSGMPG | peptide | 59.9 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 대구 | LAYA | peptide | 51.3 | producer_confirmed | 이 종 조직의 단백질을 효소로 분해해 얻은 서열입니다. |
| 꽃게 | MCCC1-MTS | amp | 30.3 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 꽃게 | MCCC1-MTS | amp | 29.4 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 참문어(동아시아 종) | cephalotocin | relaxed | 70.5 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |
| 갑오징어 | FMRFamide | relaxed | 65.8 | producer_confirmed | 이 종의 유전체·전사체·자기 단백질 기록이 암호화한 서열입니다. |

## 사후 검증 3종(30종 밖, 참고)

| 종 | 화합물 | origin_class | 사유 |
|---|---|---|---|
| Halichondria okadai | okadaic acid | associated_possible | 오카다산을 실제로 만드는 것은 와편모조류이며, 해면은 먹이·공생으로 쌓은 것일 수 있습니다. |
| Ecteinascidia turbinata | ecteinascidin 770 | sample_mismatch | 점수에 쓴 값은 다른 종(Ecteinascidia thurstoni) 시료로 잰 값입니다. 그 시료는 시안화칼륨(KCN)으로 처리해 얻은 것입니다(Suwanborirux 2002). |
| Conus magus | ziconotide | 계산 안 됨 | MBPI가 계산되지 않아(P703 연결 없음) 분류할 점수 항목이 없습니다. |
