"""Build the public method change ledger (research/method-changelog.json, copied to dist/ for the method tab).

One entry per published method version, from the records already in the repository:
- what changed: config/verified-indices-v*.json `changes_from` (kept verbatim) and a short Korean summary below;
- the public date: research/lineage/source_changelog.json `published_on` (the day dist/assessments.json moved to it);
- the decision record and pre-registration: the research/ documents named below (each must exist);
- whether the decision came before or after its results were seen: from what those records say (NOTES);
- the score impact: computed by comparing the archived public reports of consecutive versions.

Nothing here computes or changes an indicator. The ledger keeps who decided (`decided_by`), as the records do; the
screen words it as '방법 결정'. Run with --check to confirm both copies match the inputs.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_matrix_readiness as readiness  # noqa: E402

OUTPUTS = ("research/method-changelog.json", "dist/method-changelog.json")
AXES = ("MFPI", "MBPI", "MCUI", "BBVI")
RI = "research/verified-indices/"
# Research-only configs never published as the site's method (kept out of the public line, listed in `not_listed`).
NOT_PUBLIC = {"verified-pilot-3": "연구용 설정. 펩타이드 층과 국가 적색목록 층을 먼저 계산해 본 것으로, 2.1·2.2가 같은 규칙을 공개 정의로 옮겼다.",
              "verified-pilot-3-oyster-lqp-research": "참굴 LQP 행을 넣었을 때의 MBPI를 보여 준 연구 시나리오. 공개하지 않았다."}
SKIPPED = {"verified-4.15": "번호만 비어 있다. 병렬 작업(정보 공백 표시, PR #193)에 남겨 두었고 그 작업은 병합하지 않았다. 공개된 적 없다."}

# timing: '결과 확인 전' / '결과 확인 후' / '미확인' / '규칙 변경 없음'. The rule for choosing it is TIMING_RULE.
TIMING_RULE = ("결정이 그 결정으로 바뀌는 값이나 채워지는 칸을 본 뒤였는지를 기록대로 적는다. 기록이 '본 뒤'라고 적었거나, 특정 종·항목을 "
               "놓고 내린 개별 판단이거나, 이미 공개한 결과가 있는 규칙으로 되돌린 경우는 '결과 확인 후'. 기록이 값을 보기 전에 정했다고 "
               "밝힌 경우만 '결과 확인 전'. 순서를 적은 기록이 없으면 '미확인'. 규칙과 판단 없이 고정 규칙 안에서 근거·표시·기록만 바뀐 "
               "버전은 '규칙 변경 없음'.")
# A pre-registration is a document committed on its own before the code and values of that version
# (verification/test_method_changelog.py checks the commit order wherever the clone has the history).
NOTES = {
    "verified-pilot-1": dict(
        summary="첫 시범 산출: 네 지표(MFPI·MBPI·MCUI·BBVI)와 재현 가능한 계산 스크립트",
        reason="기획서의 네 지표를 공개 자료로 처음 계산했다.",
        kind="규칙", decided_by="기록 없음", records=["docs/verified-indices-design.md"],
        timing="미확인", basis="첫 규칙 묶음이다. 값을 보기 전에 정했는지 적은 기록이 없다."),
    "verified-pilot-2": dict(
        summary="식품 비교집단을 국가표준식품성분 DB로 고정, IUCN 현행 확인과 정보충분도 추가",
        reason="비교 기준을 고정된 공개 자료로 바꾸고, 평가가 지금도 유효한지 확인하려고.",
        kind="규칙", decided_by="기록 없음", timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-2.1": dict(
        summary="한국 국가 적색목록 MCUI(구분 표시), 근거 논문 2편 미만이면 BBVI 보류",
        reason="IUCN 평가가 없는 종의 보전 근거를 국가 평가로 보이되 IUCN 기반과 섞지 않으려고.",
        kind="규칙", decided_by="기록 없음", records=[RI + "verified-pilot-3-method.md"],
        timing="결과 확인 후", basis="같은 규칙을 연구용 설정(verified-pilot-3, 2026-09-26)으로 먼저 계산한 뒤 공개 정의로 옮겼다."),
    "verified-pilot-2.2": dict(
        summary="MBPI 펩타이드 층(AHTPDB ACE 고정 비교집단) 공개",
        reason="AHTPDB 이용조건을 비상업·출처 표시(CC BY-NC 4.0)로 확인해 공개할 수 있게 되어서.",
        kind="규칙", decided_by="팀", records=[RI + "verified-pilot-3-method.md"],
        timing="결과 확인 후", basis="연구용 설정(verified-pilot-3)으로 먼저 계산한 펩타이드 층을 같은 값으로 채택했다."),
    "verified-pilot-2.3": dict(
        summary="다른 기원에서 같은 합성 서열을 잰 논문을 효능 재현으로 인정(참굴 LQP)",
        reason="같은 서열의 효능을 다른 연구가 다시 잰 값을 독립 근거로 세려고.",
        kind="규칙", decided_by="팀 결정 B", decision_date="2026-09-27",
        records=[RI + "verified-pilot-2.3-2026-09-27.md", RI + "xo-potency-research-2026-09-27.md", RI + "oyster-mbpi-2026-09-27.md"],
        timing="결과 확인 후", basis="연구용 산출로 참굴 MBPI 72.2→96.3을 먼저 계산한 뒤 공개 정의로 채택했다(xo-potency-research 기록)."),
    "verified-pilot-3.1": dict(
        summary="MBPI에 ChEMBL 자동 층 추가",
        reason="워크플로 2–3단계: 펩타이드 밖 화합물의 활성 근거를 같은 표적·지표 비교집단으로 보려고.",
        kind="규칙", decided_by="기록 없음", records=[RI + "mbpi-chembl-stratum-2026-09-29.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.2": dict(
        summary="매트릭스 4유형(구분선 50)·정보충분도·지도 셀 색 공개, 점수 변화 없음",
        reason="워크플로 4–5단계(매트릭스와 GIS 지도) 구현.",
        kind="규칙", decided_by="기록 없음", records=[RI + "matrix-gis-2026-09-30.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다. 이 버전은 축 점수를 바꾸지 않았다."),
    "verified-pilot-3.3": dict(
        summary="MFPI의 빠진 성분을 같은 섭취 부위 uFiSh 값으로 채움(대체치 라벨)",
        reason="워크플로 3단계 '섭취위치·유사종 대체치 구분' 구현.",
        kind="규칙", decided_by="기록 없음", records=[RI + "mfpi-substitutes-2026-09-30.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.4": dict(
        summary="MCUI에 OBIS 출현 추세 보조 요소, 평가 없는 종에 우선 조사 표시",
        reason="워크플로 3단계 MCUI '분포 최신성 검증' 구현.",
        kind="규칙", decided_by="기록 없음", records=[RI + "mcui-trend-2026-10-01.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.5": dict(
        summary="검수한 근거 행 추가(펩타이드 7종, 양식 기록 3종)",
        reason="독립 검수자가 확인한 행을 고정 규칙 그대로 반영.",
        kind="근거", decided_by="검수", records=[RI + "evidence-additions-2026-10-01.md"],
        timing="규칙 변경 없음", basis="규칙·계수·비교집단은 그대로다."),
    "verified-pilot-3.6": dict(
        summary="MFPI의 빠진 아연을 일본 식품성분표 같은 종 값으로 채움",
        reason="국내표에 아연이 없는 종의 성분을 표시가 붙은 대체치로 채우려고.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "mext-zinc-2026-10-01.md"],
        timing="미확인", basis="빈 성분을 채우는 규칙이다. 결정과 값 확인의 순서를 적은 기록은 없다."),
    "verified-pilot-3.7": dict(
        summary="MFPI 성분에 칼슘 추가, 네 성분 중 셋 이상이면 산출",
        reason="처음 고른 세 성분은 임의 기준이었고, 아연 보고율이 낮다(수산동물 36/410행).",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "mfpi-calcium-2026-10-01.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.8": dict(
        summary="바지락 펩타이드 근거 행 추가",
        reason="검수한 원논문 행을 고정 규칙 그대로 반영.",
        kind="근거", decided_by="검수", records=[RI + "evidence-clam-2026-10-01.md"],
        timing="규칙 변경 없음", basis="규칙·계수·비교집단은 그대로다."),
    "verified-pilot-3.9": dict(
        summary="일본 식품성분표 같은 종 항목을 종 영양 행으로 인정(맛조개·고등어·참문어)",
        reason="국내표에 연결 행이 없는 종의 영양 근거를 같은 종 자료로 채우려고.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "mext-rows-2026-10-01.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.10": dict(
        summary="톳 펩타이드 근거 행 추가",
        reason="검수한 원논문 행을 고정 규칙 그대로 반영.",
        kind="근거", decided_by="검수", records=[RI + "evidence-hijiki-2026-10-01.md"],
        timing="규칙 변경 없음", basis="규칙·계수·비교집단은 그대로다."),
    "verified-pilot-3.11": dict(
        summary="고등어 펩타이드 근거 행 추가",
        reason="검수한 원논문 행을 고정 규칙 그대로 반영.",
        kind="근거", decided_by="검수", records=[RI + "evidence-mackerel-2026-10-01.md"],
        timing="규칙 변경 없음", basis="규칙·계수·비교집단은 그대로다."),
    "verified-pilot-3.12": dict(
        summary="미역 IY 효능 재현 논문 추가(공저자 한 명이 겹치는 두 논문을 독립으로 셈)",
        reason="합성 IY 효능 재현을 찾았다.",
        kind="근거", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "evidence-wakame-iy-2026-10-01.md"],
        timing="결과 확인 후",
        basis="그 항목을 점수에 넣을지 정한 개별 판단이며, 이 판단으로 미역 BBVI가 산출된다. 3.25에서 다른 연구팀 재현 3편이 더해져 이 판단에 기대지 않게 됐다."),
    "verified-pilot-3.13": dict(
        summary="멸치 펩타이드 근거 행 추가",
        reason="검수한 원논문 행을 반영. 학명 없는 멸치액젓 시료를 E. japonicus로 읽었다.",
        kind="근거", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "evidence-anchovy-2026-10-01.md"],
        timing="결과 확인 후", basis="시료의 종을 정한 개별 판단이며, 이 판단으로 멸치 MBPI가 생긴다."),
    "verified-pilot-3.14": dict(
        summary="서열을 확인한 정제 단일 펩타이드를 합성품과 같이 인정",
        reason="가수분해물에서 분리해 서열을 정한 천연 펩타이드도 단일 물질의 효능 값으로 보려고.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "evidence-isolates-2026-10-01.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.15": dict(
        summary="빈칸 채우기: 국명 연결·문헌 환산(MFPI), µg/mL 환산(MBPI), 서식국 국가 목록(MCUI), Rapid LC는 참고",
        reason="'시범 산출·미확인' 칸을 해결할 방법을 찾으라는 요청.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-01", records=[RI + "gap-closing-2026-10-02.md"],
        timing="결과 확인 후", basis="채울 칸을 알고 정했다(gap-closing 기록). 사후 검증 기준은 계산 전에 정했고, 기준 미충족인 Rapid LC는 참고로 두었다."),
    "verified-pilot-3.16": dict(
        summary="우뭇가사리에 러시아 적색자료집 VU(서식국 국가 목록) 반영",
        reason="3.15 규칙으로 남은 빈칸을 조사해 규칙을 통과한 자료만 반영.",
        kind="근거", decided_by="조사", records=[RI + "gap-closing-3.16-2026-10-02.md"],
        timing="규칙 변경 없음", basis="3.15 규칙 그대로이며, 규칙을 완화해 채운 칸이 없다(기록)."),
    "verified-pilot-3.17": dict(
        summary="EPA·DHA 함량 표시(점수에 쓰지 않음)",
        reason="같은 영양 행의 지방산 정보를 표시만 하려고.",
        kind="표시", decided_by="기록 없음", records=[RI + "omega3-display-2026-10-02.md"],
        timing="규칙 변경 없음", basis="점수·규칙은 그대로다."),
    "verified-pilot-3.18": dict(
        summary="MBPI 항균 펩타이드 층(DBAASP 고정 비교집단)",
        reason="기획서가 ACE 옆에 적은 항균 활성 입력 구현.",
        kind="규칙", decided_by="기록 없음", records=[RI + "amp-stratum-2026-10-02.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.19": dict(
        summary="액체 생장 억제 시험·Poor Broth 인정, 재조합 펩타이드 제외 유지, 비정부 적색목록 제외",
        reason="참굴 Cg-BigDef1 등 규칙 해석이 필요한 사례를 정리.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-02", records=[RI + "decisions-3.19-2026-10-02.md"],
        timing="결과 확인 후", basis="개별 사례를 놓고 추천안을 정했다(결정 기록)."),
    "verified-pilot-3.20": dict(
        summary="P703 연결이 있는 종에도 원논문 연결 허용(다시마), 'Inconclusive' 활성 제외",
        reason="다시마·꼬시래기 원논문 연결을 계산해 보고한 뒤 결정.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-02", records=[RI + "decisions-3.20-2026-10-02.md"],
        timing="결과 확인 후", basis="값을 먼저 계산해 보고한 뒤 결정했다(결정 기록)."),
    "verified-pilot-3.21": dict(
        summary="MBPI 항암 펩타이드 층(CancerPPD 2.0)",
        reason="기획서가 항균 옆에 적은 두 번째 입력 구현.",
        kind="규칙", decided_by="기록 없음", records=[RI + "anticancer-stratum-2026-10-02.md"],
        timing="미확인", basis="결정 순서를 적은 기록이 없다."),
    "verified-pilot-3.22": dict(
        summary="괭생이모자반 MFPI(같은 시료 수분이 있는 원논문 자료)",
        reason="3.12부터 있던 문헌 경로를 채우는 원논문을 찾았다.",
        kind="근거", decided_by="조사", records=[RI + "mfpi-sargassum-2026-10-02.md"],
        timing="규칙 변경 없음", basis="규칙·비교집단·계수는 그대로다."),
    "verified-pilot-3.23": dict(
        summary="문헌 행의 한계 문구를 MFPI 근거에 표시",
        reason="빌더가 읽고도 버리던 한계 문구를 화면까지 전달.",
        kind="표시", decided_by="기록 없음", records=[RI + "literature-limitations-3.23-2026-10-02.md"],
        timing="규칙 변경 없음", basis="점수·규칙은 그대로다."),
    "verified-pilot-3.24": dict(
        summary="큰가리비 VW 효능 재현 논문 추가",
        reason="3.14 규칙으로 인정되는 정제 펩타이드 재현을 찾았다.",
        kind="근거", decided_by="검수", records=[RI + "bbvi-replication-3.24-2026-10-02.md"],
        timing="규칙 변경 없음", basis="규칙·간격·계수는 그대로다."),
    "verified-pilot-3.25": dict(
        summary="미역 효능 재현 3편 추가, 양식 기록 2건 정정(점수 불변)",
        reason="다른 연구팀의 합성 펩타이드 재현을 찾았고, 독립 검토로 기록 오류를 찾았다.",
        kind="근거", decided_by="검수", records=[RI + "doyoun-replication-3.25-2026-10-02.md"],
        timing="규칙 변경 없음", basis="점수·규칙은 그대로다."),
    "verified-pilot-3.26": dict(
        summary="청각 양식 한계 문구의 원논문 오식 정정(점수 불변)",
        reason="원논문 표 2의 수치가 오식임을 확인.",
        kind="기록", decided_by="검수", records=[RI + "codium-table2-3.26-2026-10-02.md"],
        timing="규칙 변경 없음", basis="점수·규칙은 그대로다."),
    "verified-pilot-3.27": dict(
        summary="단일 논문 BBVI를 라벨과 함께 점수로, 근거 추가, 사후 검증 실행",
        reason="빈칸을 채우는 버전으로 정했다.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-03", records=[RI + "gap-filling-3.27-2026-10-03.md"],
        timing="결과 확인 후", basis="단일 논문 BBVI 16종이 점수가 되는 것을 알고 정했다(gap-filling 기록). 사후 검증은 미리 정한 기준 그대로 돌렸다."),
    "verified-pilot-3.28": dict(
        summary="톳 효능 재현 논문 추가",
        reason="기존 규칙으로 인정되는 합성 표준품 재측정을 찾았다.",
        kind="근거", decided_by="검수", records=[RI + "tot-replication-3.28-2026-10-03.md"],
        timing="규칙 변경 없음", basis="규칙·비교집단·계수는 그대로다."),
    "verified-4.0": dict(
        summary="정식 산출로 전환(규칙 고정), 세 가지 확장으로 남은 칸 채움",
        reason="다른 시료 수분으로 환산(가시파래·감태), 일본 'ランク外'를 LC 상당으로(넙치·대구), 학명 대응(우뭇가사리).",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-04", records=[RI + "formal-release-4.0-2026-10-04.md"],
        timing="결과 확인 후", basis="채울 종을 알고 정한 확장이다. 2026-10-03의 'ランク外는 LC로 읽지 않음'을 뒤집었다."),
    "verified-4.1": dict(
        summary="꽃게 항균 펩타이드의 기원 확정(공개 서열 기록)",
        reason="4.0에서 보류한 기록의 기원을 공개 서열로 확인.",
        kind="근거", decided_by="팀장 요청", decision_date="2026-10-04", records=[RI + "formal-release-4.1-2026-10-04.md"],
        timing="규칙 변경 없음", basis="비교집단·가중치·계수·기준은 그대로다."),
    "verified-4.2": dict(
        summary="지방(현·주) 적색목록을 MCUI 근거로 추가, 역검증 결과와 함께",
        reason="대회 마감(2026-10-30) 전에 빈 MCUI를 채울 공식 경로가 없다.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-04", prereg=RI + "prereg-subnational-mcui-2026-10-04.md",
        records=[RI + "formal-release-4.2-2026-10-04.md"],
        timing="결과 확인 후", basis="어떤 칸이 채워지는지 안 뒤 정했다고 사전 등록과 공개 기록에 적었다."),
    "verified-4.3": dict(
        summary="모든 칸 채우기: Rapid LC 점수화, XO 층, 조건 하나 완화(d), MBPI 하한값 0",
        reason="'모든 값을 채우고 시범·보류 상태를 없앤다'는 결정.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-05", prereg=RI + "prereg-fill-all-4.3-2026-10-05.md",
        records=[RI + "formal-release-4.3-2026-10-05.md"],
        timing="결과 확인 후", basis="채워질 칸을 안 뒤 정했다고 사전 등록 0절에 적었다. 2026-10-02의 'Rapid LC는 참고만'을 뒤집었다."),
    "verified-4.4": dict(
        summary="참문어에 완화(d) 첫 적용, 공식 목록 재확인(새 규칙 없음)",
        reason="대체 경로로 채운 칸을 근거로 해결하라는 요청.",
        kind="적용", decided_by="팀장 요청", decision_date="2026-10-05", prereg=RI + "prereg-4.4-2026-10-05.md",
        records=[RI + "formal-release-4.4-2026-10-05.md"],
        timing="결과 확인 후", basis="적용 방식을 고정하기 전에 세팔로토신 백분위를 미리 봤다(사전 등록 0절)."),
    "verified-4.5": dict(
        summary="방어·갑오징어에 완화(d) 적용(계통 공통 펩타이드는 금지 대상 밖으로 판단)",
        reason="결정 카드로 두 종의 점수화를 정했다.",
        kind="적용", decided_by="팀장 결정", decision_date="2026-10-05", prereg=RI + "prereg-4.5-2026-10-05.md",
        records=[RI + "formal-release-4.5-2026-10-05.md"],
        timing="결과 확인 후", basis="반영 전에 값을 미리 봤다고 사전 등록에 적었다."),
    "verified-4.6": dict(
        summary="지방 목록 MCUI의 정보충분도 계산 누락 수정(점수 불변)",
        reason="자료 점검에서 공식 목록 행이 0/3으로 읽히는 누락을 찾았다.",
        kind="오류 수정", decided_by="자료 점검", decision_date="2026-10-08", records=[RI + "formal-release-4.6-2026-10-08.md"],
        timing="결과 확인 후", basis="공개값 점검에서 찾은 계산 누락을 고쳤다. 점수·유형은 그대로다."),
    "verified-4.7": dict(
        summary="출처 점검: 근거에 쓰인 출처를 종 출처 목록에 모두 싣고 서지 정보 정정",
        reason="쓰였지만 목록에 없던 출처와 잘못 적힌 서지를 바로잡으려고.",
        kind="기록", decided_by="자료 점검", decision_date="2026-10-08", records=[RI + "formal-release-4.7-2026-10-08.md"],
        timing="규칙 변경 없음", basis="점수·범주·유형은 그대로다."),
    "verified-4.8": dict(
        summary="참문어 국가 적색목록 쪽 재확인 기록",
        reason="2026-10-01에 연결된 행을 원문 쪽으로 다시 확인.",
        kind="기록", decided_by="자료 점검", decision_date="2026-10-08", records=[RI + "formal-release-4.8-2026-10-08.md"],
        timing="규칙 변경 없음", basis="점수·범주·유형은 그대로다."),
    "verified-4.9": dict(
        summary="완화(d) 층에도 다른 연구팀 재현 장치 적용(갑오징어)",
        reason="ACE 층에 있던 재현 장치를 같은 조건으로 넓혔다.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-10", prereg=RI + "prereg-4.9-2026-10-10.md",
        records=[RI + "formal-release-4.9-2026-10-10.md"],
        timing="결과 확인 후", basis="반영 전에 값을 미리 봤다고 사전 등록 3절에 적었다."),
    "verified-4.10": dict(
        summary="탐색용 보조 지표 MBPI-Rx 추가(기본 지표 불변)",
        reason="기능성 식품 펩타이드 층을 뺀 MBPI로 사후 검증을 다시 보려고.",
        kind="표시", decided_by="기록 없음", prereg=RI + "prereg-mbpi-rx-4.10-2026-10-12.md",
        records=[RI + "formal-release-4.10-2026-10-12.md"],
        timing="결과 확인 후", basis="기존 사후 검증 결과를 본 뒤 제안했고 결과를 등록 전에 계산했다고 사전 등록에 적었다."),
    "verified-4.11": dict(
        summary="자료 점검 규칙 정정: 재현 기원, 층 최소 30, 지방 목록·Rapid LC 사용 조건, 추세 보정 중단",
        reason="2026-10-13 자료 점검에서 찾은 규칙의 빈틈.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-13", prereg=RI + "prereg-4.11-2026-10-13.md",
        records=[RI + "formal-release-4.11-2026-10-13.md"],
        timing="결과 확인 후", basis="공개본 4.10의 값을 본 뒤 제안했다고 사전 등록에 적었다."),
    "verified-4.12": dict(
        summary="MCUI 두 번째 근거: KOSIS 어획량 자원 감소 신호, MCUI는 두 값 중 큰 값",
        reason="기획서의 MCUI 검증 방법(어획량 급감 종이 상위에 오는가)을 구현.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-14", prereg=RI + "prereg-4.12-2026-10-14.md",
        records=[RI + "formal-release-4.12-2026-10-14.md"],
        timing="결과 확인 후", basis="규칙과 구간이 30종 결과를 계산한 뒤 정해졌다고 사전 등록 0절에 적었다."),
    "verified-4.13": dict(
        summary="추가 근거 논문 반영(넙치 P35), '관련 문헌 · 점수 미사용' 표시",
        reason="2026-10-14 문헌 조사 지시서를 고정 규칙 안에서 반영.",
        kind="근거", decided_by="팀 조사", decision_date="2026-10-14", prereg=RI + "prereg-4.13-2026-10-14.md",
        records=[RI + "formal-release-4.13-2026-10-14.md"],
        timing="규칙 변경 없음", basis="규칙은 그대로이고, 규칙을 바꿔야 들어가는 항목은 결정 필요로 따로 모았다."),
    "verified-4.14": dict(
        summary="방법 재검토: MCUI 멸종위험은 IUCN·한국 국가 평가만, 반올림 전 BBVI로 유형, 중립 유형 이름",
        reason="2026-10-14 지표 방법론 재검토.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-14", prereg=RI + "prereg-4.14-2026-10-14.md",
        records=[RI + "formal-release-4.14-2026-10-14.md"],
        timing="결과 확인 후", basis="4.11·4.12의 30종 결과를 본 뒤 쓴 규칙이라고 사전 등록에 적었다."),
    "verified-4.16": dict(
        summary="MBPI 근거 프로필 표시(점수 불변)",
        reason="근거의 양과 최상위 항목의 독립 재현 여부를 나눠 보이려고.",
        kind="표시", decided_by="팀장 요청", decision_date="2026-10-15", records=[RI + "formal-release-4.16-2026-10-15.md"],
        timing="규칙 변경 없음", basis="점수·규칙·비교집단·가중치는 그대로다."),
    "verified-4.17": dict(
        summary="공식 평가가 없는 종은 예비 평가(서식국 목록, Rapid LC)로 MCUI 산출",
        reason="2026-10-15 조사에서 14종의 IUCN·국가 평가를 찾지 못했다(IUCN 미평가).",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-15", prereg=RI + "prereg-4.17-2026-10-15.md",
        records=[RI + "formal-release-4.17-2026-10-15.md"],
        timing="결과 확인 후", basis="4.14 결과(14종 MCUI 미산출)를 본 뒤 4.13 방식으로 되돌렸다고 사전 등록에 적었다."),
    "verified-4.18": dict(
        summary="4.13에서 미룬 결정 6건 처리: 5건 규칙 유지, 원논문 연결 규칙 1건 확대(청각)",
        reason="'권장안대로 진행' 결정.",
        kind="규칙", decided_by="팀장 결정", decision_date="2026-10-15", prereg=RI + "prereg-4.18-2026-10-15.md",
        records=[RI + "formal-release-4.18-2026-10-15.md"],
        timing="결과 확인 후", basis="결정 대상 종과 예상값을 사전 등록 5절에 미리 계산해 적었다."),
}
TIMINGS = ("결과 확인 전", "결과 확인 후", "미확인", "규칙 변경 없음")


def _read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def _key(version):
    nums = re.findall(r"\d+", version)
    return tuple(int(n) for n in nums) + ((0,) if len(nums) == 1 else ())


def public_configs():
    """The published method line in order: verified-pilot-1 (archived config), then every config/verified-indices-v*.json
    that is not research-only."""
    rows = [("verified-pilot-1", "research/verified-indices/archive/verified-indices-v1.json")]
    for path in (ROOT / "config").glob("verified-indices-v*.json"):
        version = json.loads(path.read_text(encoding="utf-8"))["method_version"]
        if version not in NOT_PUBLIC:
            rows.append((version, path.relative_to(ROOT).as_posix()))
    return sorted(rows, key=lambda r: _key(r[0]))


def _report(version, current):
    """The public report of a version: the archive, or dist/ for the current one; None when no copy was kept."""
    if version == current["method_version"]:
        return current
    name = version.replace("verified-", "assessments-verified-")
    path = ROOT / "research/verified-indices/archive" / f"{name}.json"
    return _read(path.relative_to(ROOT).as_posix()) if path.exists() else None


def _types(report):
    rule = report["method"].get("matrix")
    if not rule:
        return None
    out = {}
    for s in report["species"] + report.get("candidate_species", []):
        ok = readiness._eligible(s["scores"], s.get("mcui_basis"), rule, s.get("bbvi_label"))
        out[s["aphia_id"]] = readiness.matrix_type(s["scores"], rule) if ok else None
    return out


def _impact(before, after):
    if before is None or after is None:
        return None
    old = {s["aphia_id"]: s["scores"] for s in before["species"] + before.get("candidate_species", [])}
    new = {s["aphia_id"]: s["scores"] for s in after["species"] + after.get("candidate_species", [])}
    none = dict.fromkeys(AXES)
    ids = sorted(set(old) | set(new))
    by_axis = {k: sum((old.get(i) or none)[k] != (new.get(i) or none)[k] for i in ids) for k in AXES}
    changed = sum(any((old.get(i) or none)[k] != (new.get(i) or none)[k] for k in AXES) for i in ids)
    t_old, t_new = _types(before), _types(after)
    types = None if t_old is None or t_new is None else sum(t_old.get(i) != t_new.get(i) for i in ids)
    points = None if t_new is None else sum(v is not None for v in t_new.values())
    return {"species_changed": changed, "by_axis": by_axis, "matrix_type_changed": types, "matrix_points": points}


def _constants(configs):
    """The weights and the matrix lines of every public version; the ledger states whether any of them ever moved."""
    seen = []
    for version, path in configs:
        c = _read(path)
        n, b, m = c["nutrition"], c["bbvi"], c.get("matrix") or {}
        seen.append((version, {"mfpi_weights": [n["nutrient_weight"], n["edible_fraction_weight"], n["aquaculture_weight"]],
                               "bbvi_default_food_weight": b["default_food_weight"],
                               "matrix_thresholds": [m["bbvi_threshold"], m["mcui_threshold"]] if m else None}))
    out = {}
    for key in ("mfpi_weights", "bbvi_default_food_weight", "matrix_thresholds"):
        values = [(v, d[key]) for v, d in seen if d[key] is not None]
        changes = [values[i][0] for i in range(1, len(values)) if values[i][1] != values[i - 1][1]]
        out[key] = {"value": values[-1][1], "since": values[0][0], "changed_in": changes}
    return out


def build():
    current = _read("dist/assessments.json")
    configs = public_configs()
    if configs[-1][0] != current["method_version"]:
        raise ValueError(f"dist/assessments.json is {current['method_version']}, the newest config is {configs[-1][0]}")
    published = {r["to_run_id"]: r["published_on"] for r in _read("research/lineage/source_changelog.json")["runs"]}
    published["verified-pilot-1"] = _read("research/verified-indices/archive/assessments-verified-pilot-1.json")["snapshot_date"]
    entries, previous = [], None
    for version, path in configs:
        if version not in NOTES:
            raise ValueError(f"no ledger note for {version}: add it to NOTES in scripts/build_method_changelog.py")
        if version not in published:
            raise ValueError(f"no published date for {version}: run python scripts/lineage.py changelog first")
        note = NOTES[version]
        if note["timing"] not in TIMINGS:
            raise ValueError(f"{version}: unknown timing {note['timing']}")
        docs = [d for d in [note.get("prereg")] + note.get("records", []) if d]
        missing = [d for d in docs if not (ROOT / d).exists()]
        if missing:
            raise ValueError(f"{version}: missing record {missing}")
        config = _read(path)
        report = _report(version, current)
        prev_report = _report(previous, current) if previous else None
        entries.append({
            "method_version": version, "published_on": published[version],
            "decision_date": note.get("decision_date"), "decided_by": note["decided_by"],
            "kind": note["kind"], "rule_changed": note["timing"] != "규칙 변경 없음",
            "summary": note["summary"], "reason": note["reason"],
            "preregistration": note.get("prereg"), "records": note.get("records", []),
            "timing": note["timing"], "timing_basis": note["basis"],
            "score_impact": _impact(prev_report, report) if previous else None,
            "compared_with": previous, "config": path, "changes_from": config.get("changes_from"),
        })
        previous = version
    last = entries[-1]
    counts = {t: sum(e["timing"] == t for e in entries) for t in TIMINGS}
    return {
        "schema_version": "method-changelog-1",
        "about": "방법 버전마다 무엇을, 왜, 언제 바꿨는지와 사전 등록 여부, 결과를 본 뒤의 결정인지, 점수 영향(종 수)을 적은 원장. "
                 "python scripts/build_method_changelog.py 가 저장소의 설정·기록·보관본으로 만든다. 손으로 고치지 않는다.",
        "timing_rule": TIMING_RULE,
        "score_impact_rule": "직전 공개 버전의 보관본과 비교해 네 지표 중 하나라도 값이 바뀐 종의 수. 보관본이 없는 버전은 null(미확인).",
        "current": {"method_version": last["method_version"], "frozen_on": last["published_on"],
                    "label": f"{last['method_version']} · {last['published_on']} 동결",
                    "note": "대회 기간에는 이 버전으로 고정합니다. 새 방법 버전이 공개되면 이 표시는 그 버전과 날짜로 바뀝니다."},
        "constants": _constants(configs),
        "counts": {"versions": len(entries), "rule_changed": sum(e["rule_changed"] for e in entries),
                   "preregistered": sum(bool(e["preregistration"]) for e in entries), "timing": counts},
        "not_listed": {**NOT_PUBLIC, **SKIPPED},
        "entries": entries,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    serialized = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
    for rel in OUTPUTS:
        out = ROOT / rel
        if args.check:
            if not out.exists() or out.read_text(encoding="utf-8") != serialized:
                raise ValueError(f"{rel} differs from its inputs: run python scripts/build_method_changelog.py")
        else:
            out.write_text(serialized, encoding="utf-8")
    print(("Reproducible" if args.check else "Wrote") + f" method changelog: {len(json.loads(serialized)['entries'])} versions")


if __name__ == "__main__":
    main()
