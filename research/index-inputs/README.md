# Index evidence audit · 2026-09-24 UTC

This snapshot is based on the latest merged research and independent source checks. The original branch based on c35c99c was rebased in substance onto main d14b221 after main advanced 50 commits. PRs #5, #6, #7 and #11 are now merged; #10 remains open. A merged research submission with `self_checked` is evidence to inspect, not automatic approval for a scored axis.

## Eight operational candidates

The live site returned a ChatGPT sign-in gate; the public `species_profiles` endpoint timed out from this environment. However, latest main now contains [a 2026-09-23 public-profile extract](../submissions/species_operating_8.csv), checked 2026-09-24 via WoRMS REST in that file. It records the following identities. This is the exact scope verified: the **frozen Git extract**, not another read of live rows.

| Public-profile Korean name | Approved name in extract | AphiaID | Current score |
| --- | --- | ---: | --- |
| 참굴 | *Magallana gigas* | 836033 | all withheld |
| 홍합(참담치) | *Mytilus coruscus* | 506159 | all withheld |
| 톳 | *Sargassum fusiforme* | 494972 | all withheld |
| 우뭇가사리 | *Gelidium elegans* | 372119 | all withheld |
| 살오징어 | *Todarodes pacificus* | 342067 | all withheld |
| 멍게 | *Halocynthia roretzi* | 250680 | all withheld |
| 해삼 | *Apostichopus japonicus* | 241776 | all withheld; historical EN and assay partial facts shown |
| 미역 | *Undaria pinnatifida* | 145721 | all withheld |

The earlier #7 draft's *Gelidium amansii* 212186 is a **different species**, not a synonym substituted for the operational *G. elegans*. The bundled `dist/data.json` demo uses oyster, sea cucumber and *Saccharina japonica* kelp, not the same eight.

## Original conservation assessment: one apparent score retracted

Hamel & Mercier, [IUCN Red List 2013-1 T180424A1629389](https://www.iucnredlist.org/species/180424/1629389), [DOI](https://doi.org/10.2305/IUCN.UK.2013-1.RLTS.T180424A1629389.en), assessed 2010-05-19, published 2013: original IUCN-authored [assessment text](https://www.researchgate.net/publication/295098284_Apostichopus_japonicus_The_IUCN_Red_List_of_Threatened_Species_2013_eT180424A1629389) gives EN A2bd v3.1 and the global Northwest Pacific range. WoRMS [AphiaID 241776](https://www.marinespecies.org/aphia.php?p=taxdetails&id=241776) is the accepted indexed taxon. When this work began, EN→80 appeared to be an independently calculable historical MCUI. **New merged evidence** in [record S-OP-I1](../submissions/species_operating_8.csv) shows a 2026-1 replacement [T180424A272708369](https://www.iucnredlist.org/species/180424/272708369), [DOI](https://doi.org/10.2305/IUCN.UK.2026-1.RLTS.T180424A272708369.en), listed EN/global in the GBIF IUCN checklist. We also checked the newer DOI via current indexed citation. The **2026 original assessment date, criteria/justification and terms were not available**; the IUCN original page and WoRMS direct page returned 403. Thus 2013 EN→80 is **withdrawn as an actual score**, and 2026 EN remains a partial fact. Do not extrapolate either to Korean current risk. Source terms: [IUCN terms](https://www.iucnredlist.org/terms/terms-of-use) require review; the cited GBIF mirror is marked CC BY 4.0 in the Git research record; WoRMS text CC BY. No PDFs or full records redistributed. The older 2013 evaluation remains in `curated.json` with `current_status_check.is_current=false` so the scorer and screen withhold MCUI explicitly. OBIS occurrence trends supply no adjustment.

[Operational squid record S-OP-I3](../submissions/species_operating_8.csv) points to Barratt & Allcock 2014 IUCN LC, assessed 2010-05-10, global scope, DOI 10.2305/IUCN.UK.2014-1.RLTS.T176085A1428473.en. Its current-status mirror and original date/justification were not independently checked in this run; it is not upgraded to a score. Other six no-result searches in the merged checklist are **not NE**.

## Food composition and partial values

The proposal's AFCD is the **Aquatic Foods Composition Database** (Golden et al., [Harvard Dataverse DOI 10.7910/DVN/KI0NYM](https://doi.org/10.7910/DVN/KI0NYM)); the Australian Food Composition Database shares the same acronym but is a different product. The AFCD [package](https://github.com/Aquatic-Food-Composition-Database/AFCD) distinguishes taxon, food part, preparation, nutrient and original citation. The FAO/INFOODS [uFiSh1.0 official listing](https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/) and [2016 spreadsheet](https://www.fao.org/3/I6655EN/uFiSh1.0.xlsx) were located. Neither versioned source yielded a verified record ID with all three component values, fresh edible 100g basis, sample method and provenance for three fixed comparison taxa in this environment. **No MFPI input was fabricated.**

Latest main [food_wakame_sea_squirt.csv](../submissions/food_wakame_sea_squirt.csv) records a directly checked *Halocynthia roretzi* edible internal fraction **35.32% wet** (Gao 2024 Table 2, DOI 10.1016/j.heliyon.2024.e32321) and crude protein **48.41% dry edible internal organ** (Table 3), sampled 2023-03 in Rongcheng. These are two genuine facts with different denominators: neither proves protein g/100g fresh edible portion; neither gives iron and zinc, and the local edible-fraction definition requires checking. The work retains the original rows rather than convert dry→fresh. Terms marked CC BY-NC 4.0 by Europe PMC; only source links and brief facts cited. The kelp F-W-01 dry protein and national production F-W-02 in that file remain unreviewed/license unclear; production tonnes cannot establish local technical feasibility. Need edible fraction and regional cultivation methods before MFPI.

## Bioactivity: partial, not a potency score

Merged #5's [research/bioactivity/evidence.csv](../bioactivity/evidence.csv) and the original-paper DOIs were examined. [Liao et al. 2024](https://doi.org/10.1111/bph.16333): *A. japonicus* → purified paper-local holotoxin A1 → *Candida albicans* SC5314 MIC and MFC each **2 µg/mL**, measured under different endpoints. PubChem same-name CID 119551 vs 163110604 has unresolved structural/formula conflict; neither is approved. [Ke et al. 2020](https://doi.org/10.1002/cbdv.202000233): *Saccharina japonica* → Lj5 **polysaccharide fraction** → α-glucosidase IC50 **153.27 ± 22.89 µg/mL**; source kelp is not operational 미역 and fraction has no single-molecule CID. The short paper-local records are in `partial-evidence.json`; Wiley full-text redistribution rights are unconfirmed. CMNPD [tutorial](https://docs.cmnpd.org/tutorial) species/material lookups lacked confirmed source-compound-paper IDs; ChEMBL [pChEMBL rules](https://chembl.gitbook.io/chembl-interface-documentation/frequently-asked-questions/chembl-data-questions) require matching original endpoint, relation, unit and validity. ChEMBL test organism is not the natural-product origin. PubChem BioAssay yielded no independently validated compound-assay-paper join. Hence **MBPI 0**, no MIC/MFC→IC50 conversion. CMNPD terms CC BY-NC-SA 4.0, ChEMBL CC BY-SA 3.0; no database rows copied.

## Frozen cohort, method, and next extraction

The fixed cohort currently has **8 operational candidate identities, 0 external reference taxa, 0 qualifying fresh edible species for each nutrient, and 0 qualifying compounds**. `config/pilot-method.json` carries only **project-chosen** weights and minimum-three gate; 3 is not statistically sufficient by definition. With zero ranked compounds, changing maximum to top-two mean has no actual result; BBVI food weight 0→1 remains null, not a numerical confidence interval. No tuned calibration examples were used; the proposal's known marine medicine and conservation examples remain held out for later retrospective verification.

Run `python scripts/build_indices.py`: pin raw short-source extract → normalize → validate original taxon and replacement → freeze cohorts → score only qualifying axes → write `dist/assessments.json` and `dist/partial-evidence.json`. Next, recover the 2026 IUCN original assessment date/justification and use terms; extract AFCD/uFiSh food/nutrient/reference row IDs and edible yield for like-preparation peers; resolve CID stereostructure and assay DOI joins under identical endpoint/target/test system/conditions. Source retrieval date 2026-09-24 UTC. The Site deployment and operational database were not touched.

