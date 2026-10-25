# 영어 화면 종 일반명 노트

영어 화면(`?lang=en`)의 종 이름은 `dist/species-names-en.json`에서 읽는다. 형식은 `{AphiaID: {"en", "source", "checked"}}`이고,
`scripts/build_species_names_en.py`가 아래 출처에서만 채운다. 이름은 지어내지 않는다. 이름이 없는 종은 학명 하나만 보인다.

1. WoRMS 영어 vernacular (`AphiaVernacularsByAphiaID`, language_code `eng`, isPreferredName이 있으면 그것, 없으면 첫 이름)
2. FAO ASFIS 영어 이름 (학명이 똑같이 맞는 줄만, `--asfis`로 내려받은 파일을 준다)
3. 둘 다 없으면 비운다

받은 원본은 이 폴더에 `species-names-raw-YYYY-MM-DD.json`으로 남는다(`--check`가 이 원본으로 다시 만들어 dist 파일과 비교한다).

## 2026-10-24 상태: 이름 받기 보류

- 이 작업을 한 클라우드 환경에서 `www.marinespecies.org`와 `www.fao.org` 접속이 막혀 있었다(프록시 403).
  프롬프트 규칙대로 이름을 기억으로 채우지 않고 멈췄다. `dist/species-names-en.json`은 빈 객체 `{}`라서 영어 화면은 학명만 보인다.
- 두 도메인에 접속할 수 있는 곳(팀원 PC 등)에서 아래를 돌리면 채워진다.

  ```
  python scripts/build_species_names_en.py --asfis ASFIS_sp_2025.zip
  python scripts/build_species_names_en.py --check
  ```

- `dist/assessments.json`의 `english_name` 필드는 2026-10-24 기준 30종 모두 비어 있어(null) 비교할 값이 없었다.
- 이름이 여러 개일 때 고른 이유는 채운 뒤 이 노트에 종마다 적는다(WoRMS preferred가 없고 영어 이름이 여럿이면 첫 이름을 고르는 규칙이라, 다른 이름을 쓰려면 여기 근거를 적고 스크립트 규칙을 바꾼다).
