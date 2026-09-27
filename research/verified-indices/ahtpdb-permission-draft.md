# AHTPDB 이용 문의 (2026-09-27 발송·회신 완료)

- 상태: **회신 받음 (2026-09-27).** 팀 대표가 2026-09-27 12:36 UTC에 Gmail로 보냈고, 12:48 UTC에 답을 받았다. 아래는 보낸 본문이다(서명의 연락처 줄은 생략).
- **회신 요지** (Prof. G. P. S. Raghava, raghava@iiitd.ac.in): AHTPDB는 공개 데이터베이스이며 누구나 사용할 수 있다.
  - 원문 첫 문장은 AHTPDB를 "hemolytic peptides" DB로 적었다. AHTPDB는 항고혈압 펩타이드 DB이고, 용혈성 펩타이드 DB는 같은 연구실의 Hemolytik이다. 우리 문의가 AHTPDB·ACE IC50을 특정했으므로 AHTPDB에 대한 답으로 본다.
  - README(CC BY-NC)와 LICENSE(MIT) 중 어느 쪽인지, 원하는 인용 방식은 답하지 않았다. 그래서 Kumar et al. 2015 인용과 비상업 이용을 그대로 유지한다.
- **감사 답장** (2026-09-27 12:53 UTC 발송): "AHTPDB(the antihypertensive peptide database)는 누구나 쓸 수 있는 공개 자료로 이해했고, 웹사이트와 근거 파일에 Kumar et al. 2015를 계속 인용하겠다." 새 질문은 넣지 않았다.
- **반영**: `evidence-v3.json`의 `ahtpdb_ic50_2026` 이용조건을 "공개 DB · 개발자 이메일 확인(2026-09-27)"으로 바꾸고 `permission` 기록을 붙였다. 점수·비교집단·규칙은 바꾸지 않았다.
  - 비교집단 파일(`peptide-cohort-ahtpdb-ace-hhl.json`)의 `licence`는 원파일 해시와 함께 고정된 수집 기록이라 README 표기 그대로 둔다.
- 2026-09-27(앞선 결정, 이후 변경): 발송하지 않기로 했다. 비영리 공개이므로 더 엄격한 CC BY-NC 4.0으로 보고 출처를 표시해 쓴다(`oyster-mbpi-2026-09-27.md` 6절).
- 수신 후보: Prof. Gajendra P. S. Raghava (IIIT-Delhi), raghava@iiitd.ac.in
  - 출처: GitHub `sachini-tech/AHTPDB` README의 maintainer 표기
- 배경: `docs/species-30-method-review.md` 4절. 내려받기 페이지에는 조건 표기가 없다. 공식 저장소 README는 CC BY-NC 4.0, LICENSE 파일은 MIT로 서로 다르다.

---

Sent: 2026-09-27, to raghava@iiitd.ac.in

Subject: Request for confirmation: non-commercial use of AHTPDB IC50 values in "Blue-bio Value Map"

Dear Prof. Raghava,

I am writing on behalf of a student team from Dongguk University and Korea University (Seoul, Republic of Korea). We have built "Blue-bio Value Map", a non-commercial research prototype for the Ocean 20 Challenge. The prototype summarises published evidence on marine species in Korean waters, and it will be presented publicly at the World Ocean Forum.

We use AHTPDB (Kumar R. et al., 2015, Nucleic Acids Research 43:D956-D962, doi:10.1093/nar/gku1141) as follows:

1. From the IC50 download (pepic50.txt, retrieved 2026-09-26), we selected the rows for ACE inhibition measured with the HHL substrate (Cushman and Cheung method) that have a single numeric IC50. This gives a fixed comparison set of 352 peptides.
2. We rank peptides reported in original papers for two species against this set. Those species are the Pacific oyster (Magallana gigas) and wakame (Undaria pinnatifida). Only the resulting percentile scores are shown publicly.
3. Our repository keeps only the AHTPDB row IDs, the IC50 values we used, and a checksum of the downloaded file. We do not redistribute the file or the peptide sequence list.
4. AHTPDB and your 2015 paper are cited on the website and in our evidence files.

We found two different statements of terms. The README of the AHTPDB repository on GitHub (sachini-tech/AHTPDB) gives CC BY-NC 4.0, but the LICENSE file in the same repository is MIT. The download page does not state any terms. We have followed the stricter reading, CC BY-NC 4.0, with attribution and non-commercial use only.

Could you please let us know:
- which terms apply to the AHTPDB data;
- whether the use described above is acceptable; and
- how you would like AHTPDB to be cited or acknowledged?

If this use is not acceptable, we will remove the AHTPDB-based scores from the public site.

Thank you for creating and maintaining this resource.

Kind regards,

Gyunghun Lee
On behalf of the Blue-bio Value Map team
Dongguk University and Korea University, Seoul, Republic of Korea
Ocean 20 Challenge
