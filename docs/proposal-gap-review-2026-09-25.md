# Proposal-to-implementation review · 2026-09-25

This review precedes implementation on `feature/proposal-gap-audit-20260925`, based on `main` `a40e55fea10a97f29a799217fd3b2ea01ae6676d`. The uploaded Blue-bio Value Map proposal pp. 3–4 describes species and molecule normalization, separate MFPI/MBPI/MCUI axes, a weighted BBVI, an evidence sufficiency dimension, an unexplored-candidate pathway, a matrix, a GIS overlay, and protected coordinates. A proposed use case is not a validated predictive claim.

## Deployment and PR boundary

The shared production URL could not be read through public retrieval (inaccessible), and a direct request timed out. The checked-in `.openai/hosting.json` has a Sites project ID, but the current account's Sites connector reports `project_not_found`; no saved-version/commit attestation can be retrieved. **The deployment's commit and visible state are unverified.** The rest of this review describes the GitHub tree, not an observation of the live UI. Do not infer that merging PR #14 or the asset version bump deployed anything.

GitHub PR status at the branch point: #3–#9, #11, #13 and #14 merged; #10, #12 and #15 open. Their unmerged rows or UI proposals are leads, not accepted inputs. The earlier PR #12 statement of zero scores refers to its older, unmerged snapshot. The current `main` report has 3 MFPI and 2 MCUI values, with 0 MBPI and 0 BBVI. Distinguish the `main` report dated 2026-09-25 from a live production version that was not accessible.

## Design comparison

| Proposal requirement | Code state on checked `main` | Scientific validation | Decision in this branch |
| --- | --- | --- | --- |
| Approved species and definite molecule IDs | **부분 구현**: eight WoRMS-linked profile identities; compound chain attempts contain unresolved stereochemistry, fragments or extracts | Species roster documented; no complete species-origin/compound/assay chain | Extend a record-level candidate lead, keeping an unresolved CID absent rather than guessing |
| MFPI from nutrition, edible yield and cultivation | **부분 구현**: three separately cohort-scored provisional values (oyster 65.5, sea squirt 54.2, wakame 42.2) | Formula 80/10/10 and grade factors are project rules, not a validated food-potential predictor; animals and algae have different cohorts | Preserve original traces and make cross-cohort noncomparability explicit at the comparison point |
| MBPI from comparable quantitative assays | **자료 부족으로 보류**: partial paper-level records for all eight, 0 scored molecules | No qualifying full identity + comparable assay stratum; activity is not a treatment effect | Add an original-paper lead with source-value/unit and a clear identity stop; keep MBPI null |
| MCUI from current IUCN and checked occurrence trend | **부분 구현**: sea cucumber EN→80, squid LC→10; trend correction absent | Project category mapping; no effort-adjusted population trend; two cases cannot validate prediction | Preserve raw category, scope and date; no occurrence-count correction |
| BBVI and separate conservation axis | **자료 부족으로 보류**: configurable `w·MFPI+(1−w)·MBPI` requires both axes | No integrated score as MBPI is null | Keep null and never add MCUI to BBVI |
| Information sufficiency and unexplored candidate | **부분 구현**: axis-specific coverage; conditional relative search | No reviewed relative BBVI and no actual unexplored-candidate result | Preserve coverage without propagating relatives' scores |
| Actual species in matrix | **자료 부족으로 보류**: zero; A–D remains a separate fictitious demo | No species has BBVI and MCUI together | Do not add invented points |
| Spatial value/conservation judgement | **자료 부족으로 보류**: generalized selected occurrence cells and separate status | Sampling effort overlay cannot itself establish comparable abundance or sea-area value | Do not copy species-level scores onto occurrence cells |
| Sensitive coordinates | **구현됨 for public output**: generalized 1° cells (4° sea cucumber), schematic dots | Role-based approved fine-coordinate access is not built | Keep current coarse public output; no individual source positions |
| Jurisdiction / benefit-sharing | **부분 구현**: ABS/BBNJ reading checklist | No legal applicability determination or verified cell jurisdiction | Preserve as a checklist; do not infer legal duties from occurrence country |

The existing A–D example separation and occurrence-count warnings already meet their immediate display purpose; this branch does not duplicate them. The Food Standards Australia New Zealand **Australian Food Composition Database Release 3** is the earlier oyster cross-check, while the present main primary cohort is the **RDA National Standard Food Composition Database 10.4**; FAO/INFOODS **uFiSh1.0 (2016)** was searched but not silently blended into the raw Korean sample cohort. These database choices and cohort sizes are documented in `docs/verified-indices-design.md` and `research/verified-indices/nutrition-audit.md`.

## Implementation and review acceptance

1. Keep separate immutable provenance for the newly located *Sargassum fusiforme* paper-local IC50: original reported *S. fusiformis*, molecule name, cell system, value ± uncertainty and unit, DOI/PMID, access/rights, chemical ID absent and original isolation details still to confirm. A cellular phenotypic endpoint is not a protein target. The earlier *Hizikia fusiformis* isolation paper and present 2022 test paper must not be counted as independent quantitative replications.
2. Display the new partial value with an explicit incomplete-chain reason in the existing evidence panel; never turn this into MBPI or BBVI until full stereochemical identity and like-for-like fixed peers are reviewed. Preserve the negative checks for PubChem, CMNPD and ChEMBL test-organism/source confusion.
3. Label the animal and raw-seaweed nutrient cohorts at the **comparison table itself**, because a naked 65.5 against 42.2 invites a numerical cross-cohort ranking even though the detailed panel warns against it.
4. Regression check the 3/0/2/0 actual value counts, eight exact taxon joins, no fabricated matrix or cell decision, raw value and source link on screen, food cohort label, and no change to the snapshot's scientific scores. Record remaining fieldwork and legal/permission boundaries in the PR.
