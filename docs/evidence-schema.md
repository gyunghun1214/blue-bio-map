# Curated evidence input for the pilot indices

## Frozen primary-evidence pilot (2026-09-24)

See [the design decision](index-design.md) and [source audit](../research/index-inputs/README.md). Run `python scripts/build_indices.py` to reproduce `dist/assessments.json` from `research/index-inputs/curated.json` and `config/pilot-method.json`. This is a versioned, offline factual extract: the current frozen candidate list has zero current MCUI and no valid MFPI, MBPI or BBVI; the old 2013 IUCN evaluation was superseded in 2026. A method/source change must be reviewed as a new snapshot. The source catalog includes an original IUCN record ID, DOI, evaluation versus publication date, geographic scope, URL, retrieval day and terms. Other candidates' IUCN assessments remain unverified (not NE).

MFPI and MBPI calculations below are **project trial rules, not international standards**. Their output is withheld until a stable peer cohort and original assay/food record joins pass validation. Live profile names and AphiaIDs must match both fields; the eight candidates have a published-profile extract in main research/submissions/species_operating_8.csv, though this environment could not re-read the live API. MCUI is separate from BBVI and cannot be assigned to occurrence cells or represented as current Korean regional priority. `partial-evidence.json` retains paper-local MIC/MFC and fraction IC50 as research facts, not single-molecule pChEMBL scores. No absence becomes zero.

This pipeline is an **unvalidated research prototype**. Do not pass the currently
published species summary to it: aggregate nutrition/compound counts lack units,
assay context, edible fraction and reviewed conservation assessments. Keep working
inputs in ignored `tmp/`; the default output also goes there.

## Input format (schema_version 1)

```json
{
  "schema_version": 1,
  "sources": {
    "paper-doi": {"url": "https://doi.org/10.xxxx/example", "license": "publisher terms reviewed", "accessed": "2026-09-23"},
    "nutrition-row": {"url": "https://example.org/record", "license": "provider terms reviewed", "accessed": "2026-09-23"},
    "iucn-assessment": {"url": "https://www.iucnredlist.org/", "license": "IUCN terms: review before redistribution", "accessed": "2026-09-23"}
  },
  "species": [{
    "aphia_id": 123456,
    "scientific_name": "Example species (synthetic placeholder)",
    "bioassays": [{"compound_id": "CID:123", "target_id": "CHEMBL_TARGET_ID", "assay_type": "binding", "pchembl": 7.2, "reference_id": "paper-doi", "reviewed": true}],
    "nutrition": {
      "protein_g": {"per_100g": 12, "unit": "g", "basis": "100 g edible portion", "sample_state": "fresh", "edible_part": "reviewed", "sample_year": 2025, "sample_region": "synthetic area", "method": "synthetic assay", "grade": "measured", "source_id": "nutrition-row", "reviewed": true},
      "iron_mg": {"per_100g": 2, "unit": "mg", "basis": "100 g edible portion", "sample_state": "fresh", "edible_part": "reviewed", "sample_year": 2025, "sample_region": "synthetic area", "method": "synthetic assay", "grade": "measured", "source_id": "nutrition-row", "reviewed": true},
      "zinc_mg": {"per_100g": 1, "unit": "mg", "basis": "100 g edible portion", "sample_state": "fresh", "edible_part": "reviewed", "sample_year": 2025, "sample_region": "synthetic area", "method": "synthetic assay", "grade": "measured", "source_id": "nutrition-row", "reviewed": true}
    },
    "edible_fraction": 0.7, "edible_fraction_source": "nutrition-row", "edible_fraction_reviewed": true, "edible_fraction_method": "synthetic dissection",
    "aquaculture": true, "aquaculture_source": "nutrition-row", "aquaculture_reviewed": true, "aquaculture_method": "synthetic review", "aquaculture_region": "synthetic area", "aquaculture_assessment_year": 2025, "aquaculture_limitations": "synthetic constraints",
    "conservation": {"category": "VU", "assessment_year": 2025, "source_id": "iucn-assessment", "reviewed": true,
                     "current_status_check": {"is_current": true, "source_id": "iucn-assessment", "checked_on": "2026-09-23"}}
  }]
}
```

The example above is **synthetic and incomplete for scoring**: at least three
distinct compounds in the same target/assay stratum and three species with each
nutrient are needed. No example values are presented as real measurements.

## Normalization and publication rules

- Resolve every accepted species to a unique WoRMS AphiaID. Check the accepted
  scientific name against the published profile before display. Resolve each
  compound to an InChIKey or `CID:number`; do not join on common names alone.
- Supply standardized pChEMBL values with a target, assay type and independent
  reference. Raw IC50 from different assays cannot be ranked together. Each
  unique compound contributes one median within its target/assay stratum;
  independent references change a **provisional** evidence factor, not peer count.
- Nutrition values must be on a reviewed **per 100 g edible portion** basis.
  Record measured, calculated or proxy grade, sample state, actual method, sample
  year/region and edible part. The current pilot accepts only reviewer-confirmed
  **fresh edible portion**, protein in g and iron/zinc in mg per 100 g. Dry and
  processed samples must stay separate until a documented conversion and a new
  peer cohort are explicitly reviewed; do not silently convert dry to fresh or
  whole material to edible portion. Require a reviewed edible fraction with
  method and reviewed aquaculture evidence with method, area, assessment year and
  limitations before MFPI. Production counts do not establish feasibility.
  At least three distinct accepted species per nutrient, in the same unit and
  basis, are needed. Missing components withhold the score, never score zero.
- MCUI requires a reviewed IUCN assessment. `DD` and `NE` do not mean low
  urgency. An OBIS trend can affect MCUI only when sampling effort was controlled
  and the adjustment was independently reviewed; raw occurrence counts cannot
  prove population decline. Assessments over ten years old receive a flag.
  `reviewed` means the original assessment was read; it does not mean the
  assessment is current. MCUI also needs `current_status_check` with
  `is_current: true`, a registered `source_id` and `checked_on`: a real
  YYYY-MM-DD date, not before the assessment year and not in the future (the
  page also rejects dates after the report's `generated_at`).
  Without it MCUI is withheld (`current_status_unverified`); `is_current: false`
  withholds it as `assessment_not_current`. Age alone never decides either way.
- Pilot weights: MBPI uses the best eligible compound percentile, multiplied by
  0.75 for one reference or 1.0 for two or more. MFPI uses 80% mean nutrient
  peer percentile adjusted by evidence grade, 10% edible fraction and 10%
  aquaculture evidence. IUCN categories map LC/NT/VU/EN/CR to 10/35/60/80/100;
  a reviewed effort adjusted trend changes at most ten points. Default BBVI is
  equal weighted MFPI and MBPI; `--food-weight` changes only this value axis.
  **These pilot weights have not been calibrated or back-tested.** MCUI is never
  added to or subtracted from BBVI.
- Sources require a URL, license and access date. Before any `--out
  dist/assessments.json`, review upstream redistribution rights, source records,
  category dates, and a held-out validation set (known marine drugs and observed
  declines). Generated outputs are research leads, not harvesting locations or
  proof of efficacy. Public files must not contain precise occurrence coordinates.

## Public display guard for food evidence

The evaluator emits a `food_trace` only if all three reviewed nutrient rows,
a reviewed edible fraction, documented aquaculture evidence and at least three
comparable species per nutrient are present. It includes the original units,
sample context, peer values and source IDs. A public `assessments.json` is
still a separate editorial decision, subject to source rights and validation.
The browser suppresses a numeric MFPI and any dependent BBVI when the trace
is missing, unreviewed, incompatible or lacks source URL, access date or terms.
An earlier provisional report with only MFPI numbers is not enough to publish
a score. This guard does not make pilot weights validated.
