"""Build safe, source-linked audit summaries; no occurrence geometry or record identifiers."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "dist/candidate-catalog.json").read_text())["species"]
gbif = {s["aphiaID"]: s for s in json.loads((ROOT / "tmp/expansion-30/gbif/summary.json").read_text())["species"]}
iucn = {s["aphiaID"]: s for s in json.loads((ROOT / "tmp/expansion-30/iucn-audit.json").read_text())["species"]}
rda = json.loads((ROOT / "research/verified-indices/snapshots/rda-db-10.4-marine-raw-2026-09-25.json").read_text())
food = {r["code"]: r for r in rda["rows"]}
released_path = ROOT / "dist/expansion-public-cells.json"
released = json.loads(released_path.read_text()) if released_path.exists() else None
published_historical = bool(released and released.get("schemaVersion") == "candidate-public-cells-1"
                            and len(released.get("species", [])) == 1
                            and released["species"][0].get("aphiaID") == 504357
                            and len(released["species"][0].get("cells", [])) == 1
                            and released["species"][0]["cells"][0].get("records") == 1)
# Candidate food names are NOT verified species links. No food row is fed into a score.
food_candidates = {
    377084: "L0050000000a", 236157: "L0040000000a", 145086: "L0230000000a",
    231750: "K4130000000a", 397082: "K4220010000a", 393716: "K4000040000a",
    504357: "K4250160000a", 413600: "K4250050000a", 127022: "K0150002550a",
    219984: "K0660000000a", 281273: "K1620000000a", 275816: "K0270000000a",
    274849: "K0960070000a", 276651: "K0830000000a", 254538: "K0440002570a",
    1061762: "K6020010000a", 534443: "K6110030000a",
    1666974: "K6230010000a",
}
notes = {
    377084: "다시마 일반명; Laminaria/Saccharina 분류 대조 필요",
    236157: "꼬시래기 일반명; 해당 종 동정 근거 없음",
    145086: "청각 일반명; 아종 및 근연종 동정 근거 없음",
    231750: "바지락 식품명; 표에 학명 없음",
    397082: "둥근전복 식품명; H. discus 아종/시료 구분 검수 필요",
    393716: "큰가리비/Yesso scallop 식품명 일치 후보; 학명은 원행에 없음",
    504357: "피조개/Ark shell 일반명; 종 일치 재검수",
    413600: "맛조개/Gould's razor shell 명칭과 목표 학명 대조 필요",
    127022: "고등어/Mackerel 지역별 행; Scomber 종 일치 확인 필요",
    219984: "멸치/Anchovy 일반명; 학명 원행에 없음",
    281273: "참조기/Yellow croaker 식품명 일치 후보; 학명 원행에 없음",
    275816: "넙치/Bastard halibut 식품명 일치 후보; 학명 원행에 없음",
    274849: "조피볼락/Korean rockfish 식품명 일치 후보; 학명 원행에 없음",
    276651: "방어/Yellowtail 일반명; 학명 원행에 없음",
    254538: "대구/Pacific cod 수컷 행; 성별/가식부 구분, 학명 확인 필요",
    1061762: "꽃게/Blue crab 일반명은 다른 종에도 쓰임",
    534443: "참문어/Common octopus는 Octopus vulgaris와 혼동 위험",
    1666974: "갑오징어/Cuttle fish 일반명; 종 동정 근거 없음",
}
out = []
for s in catalog:
    key = s["aphiaID"]
    g, c = gbif[key], iucn[key]
    f = food.get(food_candidates.get(key))
    assert g.get("retrieved") == sum(g.get("exclusion_counts", {}).values())
    out.append({
        "aphiaID": key, "name": s["name"],
        "gbif": {"queriedAt": g.get("queried_at"), "queryUrl": g.get("url"),
                 "scope": "124–132°E, 33–38.7°N; coordinates present; exact query name",
                 "rawCount": g.get("reported_total"), "retrievedCount": g.get("retrieved"),
                 "truncated": g.get("truncated"), "reasons": g.get("exclusion_counts"),
                 "preliminaryEligible": g.get("exclusion_counts", {}).get("eligible_pre_sensitivity", 0),
                 "datasets": [{"url": d["url"], "title": d["metadata"].get("title"),
                               "doi": d["metadata"].get("doi"),
                               "datasetLicense": d["metadata"].get("license"),
                               "recordLicenses": d["licenses"], "retrieved": d["retrieved"],
                               "preliminaryEligible": d["eligible"]}
                              for d in g.get("datasets", [])],
                 "publicCellStatus": "one_historical_4_degree_cell_published_remaining_withheld" if key == 504357 and published_historical else "withheld_pending_sensitivity_source_and_duplicate_review",
                 "publicCellCount": 1 if key == 504357 and published_historical else 0,
                 "publicRecordCount": 1 if key == 504357 and published_historical else 0,
                 "limitations": "GBIF 검색 응답만 검토. OBIS 종별 조회 미실행(API 시간 초과). 위치/연도/원기록 ID는 공개하지 않음."},
        "iucn": {"status": c["status"], "record": c.get("record"),
                 "checklistRecordUrl": c.get("checklist_record_url"),
                 "searchUrl": c.get("search_url"),
                 "limitations": "IUCN 게시 체크리스트의 글로벌 평가 메타데이터. 원평가의 평가일·기준·근거는 별도 확인 전."},
        "nutrition": {"status": "food_name_candidate_unverified" if f else "no_food_row_linked",
                      "foodCode": f["code"] if f else None,
                      "foodName": f["name"] if f else None,
                      "englishName": f.get("english_name") if f else None,
                      "values": f["values"] if f else None,
                      "note": notes.get(key, "종 수준으로 연결할 식품 행을 이번 스냅샷에서 확인하지 못함"),
                      "rowUrl": "https://www.nics.go.kr/food/kfi/fct/fctFoodSrch/detailOne?foodCodes="+f["code"] if f else None,
                      "source": "RDA 국가표준식품성분 DB 10.4 (2026), 공개 스냅샷 2026-09-25; 공공누리 제1유형"},
        "bioactivity": {"status": "not_reviewed", "note": "기원종·화합물 구조·정량 assay·원논문 연결 미검수"},
        "scores": {"MFPI": None, "MBPI": None, "MCUI": None, "BBVI": None},
        "sensitivity": "one_historical_4_degree_cell_reviewed_remaining_withheld" if key == 504357 and published_historical else "needs_review",
    })
assert len(out) == 22 and len({s["aphiaID"] for s in out}) == 22
(ROOT / "dist/expansion-evidence.json").write_text(json.dumps({
    "schemaVersion": "expansion-evidence-1", "retrievedOn": "2026-09-25",
    "scope": "Candidate research with one independently reviewed historical 4-degree public cell. No original coordinates, occurrence IDs, or scored indicators.",
    "sourceNotes": {"gbif": "GBIF API search; individual record licence and dataset licence retained separately",
                    "obis": "API endpoint timed out during representative query; 22 per-species queries not attempted",
                    "iucn": "https://www.gbif.org/dataset/19491596-35ae-4a91-9a98-85cf505f1bd3",
                    "nutrition": "https://www.nics.go.kr/food/kfi/fct/fctFoodSrch/main"},
    "species": out,
}, ensure_ascii=False, separators=(",", ":")) + "\n")
print("Built", len(out), "safe audit entries")
