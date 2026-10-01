# 톳 펩타이드 근거 행 (2026-10-01, `verified-pilot-3.10`에 반영)

- 파일: `research/verified-indices/evidence-hijiki-2026-10-01.json` (펩타이드 보충 파일, `snapshot_date` 2026-10-01)
- 상태: `verified-pilot-3.10` 설정(`config/verified-indices-v3.10.json`)의 `peptide_supplements`가 이 파일을 읽는다(팀장 결정, 2026-10-01).
  - 3.9 이하 설정은 이 파일을 읽지 않는다. 3.9 공개본은 `archive/assessments-verified-pilot-3.9.json`에 그대로 보관한다.
- 규칙, 계수, 비교집단은 바뀌지 않는다. 바뀌는 것은 근거 행뿐이다.
- 테스트 `VerifiedPilot310Tests`는 3.9와 비교해 톳 MBPI만 바뀌는지와 점수 행·BBVI 보류 사유를 확인한다.

## 1. 점수에 쓰는 행

종: *Sargassum fusiforme* (AphiaID 494972). 논문의 *Hizikia fusiformis*는 WoRMS에서 같은 종의 이명이다. 시료는 1995년 2월 나가사키현 쓰시마 사스나만에서 채취한 톳이다(p.862).

| 서열 | IC50 (µM) | 백분위 | 보정 후 |
|---|---|---|---|
| GKY | 3.92 | 86.65 | **65.0** |
| SVY | 8.12 | 78.12 | 58.6 |
| SKTY | 11.07 | 73.58 | 55.2 |

논문: 末綱 邦男(Suetsuna) 1998, 日本水産学会誌 64(5):862–866, doi:10.2331/suisan.64.862 (J-STAGE 무료 전문, 일본어·영문 초록). 원문에서 확인한 것:
- 톳 단백질의 펩신 소화물을 이온교환·겔 여과·역상 HPLC로 분리했다.
- 서열은 아미노산 분석, 자동 Edman 분해(477A), FAB-MS로 정했다(p.864). FAB-MS m/z는 GKY 367, SVY 368, SKTY 498이다.
- 펩타이드는 Fmoc 고상법(433A)으로 합성했고(p.863), 표 1의 제목은 "ACE inhibitory activity of synthetic peptides"다(p.865).
- ACE는 토끼 폐(Sigma), 기질은 HHL 12.5 mM(펩타이드연구소)이다. 방법은 Lieberman법을 고친 야마모토 등의 방법이다(p.863).
- PDF의 기계 판독 글자층에는 "Ser-Lys-Tyr-Tyr"가 한 번 나온다. 인쇄면에는 없고, 표 1·결과·초록과 m/z 498은 모두 SKTY다.

결과: 톳 MBPI가 ChEMBL 값 45.3(LXR-α EC50)에서 **65.0**(GKY, 백분위 86.65 × 단일 논문 0.75)으로 바뀌고, "참고값(단일 논문)"으로 표시된다. ChEMBL 항목은 근거 목록에 그대로 남는다. 세 서열 모두 이 논문 하나뿐이라 BBVI는 `mbpi_single_source`로 보류된다.

## 2. 재현을 찾지 못한 것

- GKY, SVY, SKTY를 다른 연구진이 합성품·HHL로 잰 논문은 PubMed와 Crossref에서 찾지 못했다(2026-10-01).
- 청각(*Codium fragile*)은 ACE 억제 펩타이드 논문이 없었다.
- Lin 2018(Nutrients 10:1397, Chlorella)의 IW 0.50·VW 0.58 µM는 분리 피크로 잰 값이고 합성품 값이 아니다. 그래서 미역 IW·VW의 재현으로 쓰지 않는다.
