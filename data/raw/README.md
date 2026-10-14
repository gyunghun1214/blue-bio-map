# 원자료 (`data/raw/`)

## `kosis_DT_1EW0004_national_2015_2025.csv`

- **출처**: 통계청(국가데이터처) KOSIS 국가통계포털, 「어업생산동향조사」 어업별 품종별 통계 `DT_1EW0004`  
  <https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1EW0004>
- **조건**: 행정구역 계(전국) · 판매형태 계 · 항목 생산량:계(톤) · 연간 2015~2025
- **받은 날**: 2026-10-14 (자료갱신일 2026-09-30). 팀장이 받은 표를 그대로 옮겼고 손으로 고친 값은 없다.
- **이용 조건**: KOSIS 이용약관, 출처 표시
- **열**: `fishery`(연근해어업 / 해면양식업), `kosis_item`(KOSIS 품종 이름 그대로), 2015~2024(확정치, 톤), `2025p`(잠정치, 톤)
- **빈칸**: KOSIS에 값이 없는 해다. 점수 계산에서는 0톤으로 넣고, 연근해 빈 해가 3년 이상이면 '자료 부족'으로 점수를 주지 않는다. 해면양식 행이 없거나 빈칸이면 양식 0톤으로 본다.
- **2025p**: 잠정치라 점수에 쓰지 않고 종 상세에 참고로만 보인다.

쓰는 곳: `config/verified-indices-v4.12.json`의 `mcui_stock_decline`, `scripts/build_verified_indices.py`의 `read_stock_decline`·`stock_decline`. 규칙은 [사전 등록 4.12](../../research/verified-indices/prereg-4.12-2026-10-14.md)에 있다.

## 품종 연결표 (`../mapping/kosis_to_aphia.csv`)

30종(AphiaID)마다 KOSIS 품종 하나를 연결한다. `match_level`은 `species`(종 단위), `broader`(더 넓은 묶음, 점수 상한 60), `none`(대응 품종 없음) 중 하나다. 빌드는 연결표의 종이 공개 30종과 정확히 같지 않으면 멈춘다.
