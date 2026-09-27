# AHTPDB 이용 문의 (2026-09-27 발송, 회신 대기)

- 상태: **발송함, 회신 대기.** 2026-09-27 팀 대표가 Gmail로 직접 보냈다. 아래는 보낸 본문이다(서명의 연락처 줄은 생략).
- 회신을 받으면 이 파일과 `oyster-mbpi-2026-09-27.md` 6절에 날짜와 요지를 적는다.
  - 허용: 회신이 요청한 인용 방식을 화면과 `evidence-v3.json`에 반영한다.
  - 불허: 메일에서 약속한 대로 공개 화면의 AHTPDB 기반 MBPI(참굴·미역)를 내리고 원값 표시(v2.1 방식)로 되돌린다.
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
