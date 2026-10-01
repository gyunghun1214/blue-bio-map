# AMP MIC cohorts (DBAASP) for verified-pilot-3.16 — build note

Companion file: `amp-cohorts-dbaasp-2026-10-02.json` (sha256 `d70648cebe70b80e27153ac4949524fed112c5a3d45a255bc405e3d6799aa205`).
Mirrors `research/verified-indices/peptide-cohort-ahtpdb-ace-hhl.json`, with `mic_uM`
in place of `ic50_uM`. Nine cohorts in one file; all nine reach the minimum of 30 members.

## Rule

```
Cohort = one target species x measure MIC x broth medium (any strain of that species).
  - activityMeasureValue exactly "MIC" (MIC50, MIC90, MBC, MFC, MEC, IC50, LC/LD dropped)
  - medium in the broth whitelist; agar media and media we could not classify are dropped
  - concentration a single number: ">", ">=", "<", "<=", ranges and "+/-" dropped
  - unit µM used as read; µg/ml converted with ExPASy average residue masses + one water
    (18.01524), so µg/ml rows are admitted only for a plain standard-residue monomer with
    free termini -- DBAASP reports molarMass 0.0 for every terminus and unusual residue,
    so a modified peptide's mass cannot be computed and its µg/ml rows are dropped
  - member key = sequence + N-terminus + C-terminus + non-standard residues + intrachain
    and interchain bonds + complexity; member value = median of that member's µM rows
  - DBAASP's own numeric "activity" field is never read (it is a transformed value)
  - score pMIC = 6 - log10(MIC in µM); percentile = 100 x (below + 0.5 x equal) / size
  - minimum cohort size 30; CLSI MHB/CAMHB-only is a sensitivity variant, not the primary
```

`percentile = 100 x (members with lower pMIC + 0.5 x members with equal pMIC) / size`

### Media

Primary = broth only. A medium enters the primary cohort only if its DBAASP abbreviation
expands to a liquid medium we can name; agar plates, cell-culture media, blanks and
abbreviations we could not pin down are dropped and tallied per cohort under
`dropped_media`, so the exclusion is auditable rather than guessed.

Whitelist (22): `MHB` Mueller-Hinton broth, `CAMHB` cation-adjusted Mueller-Hinton broth, `LBB` Luria-Bertani broth, `LB` Luria-Bertani broth, `TSB` tryptic soy broth, `TSBY` tryptic soy broth + yeast extract, `BHIB` brain heart infusion broth, `NB` nutrient broth, `THB` Todd-Hewitt broth, `ISB` Iso-Sensitest broth, `BrB` Brucella broth, `ColB` Columbia broth, `AM3` antibiotic medium 3 (liquid), `NZCYM` NZCYM broth, `TB` terrific/tryptose broth, `RPMI-1640` RPMI-1640 (CLSI M27 antifungal broth microdilution), `SDB` Sabouraud dextrose broth, `SGB` Sabouraud glucose broth, `PDB` potato dextrose broth, `MEB` malt extract broth, `YEPD` yeast extract peptone dextrose broth, `YNB` yeast nitrogen base (liquid)

CLSI `MHB`/`CAMHB` is recorded as a **sensitivity variant only** (`sensitivity.CLSI_MHB_CAMHB_only`),
never the primary: both of our own papers measured MIC in LB broth, not Mueller-Hinton,
so a CLSI-only cohort would be a medium-mismatched comparison for our species.

## Counts per cohort

| cohort | target | kind | size | median pMIC | min pMIC | max pMIC | natural-origin only | CLSI only |
|---|---|---|---|---|---|---|---|---|
| `staphylococcus-aureus` | Staphylococcus aureus | bacterium | **6158** | 5.056 | 1.921 | 8.383 | 1281 (median 5.097) | 4242 (median 5.0) |
| `escherichia-coli` | Escherichia coli | bacterium | **7123** | 5.028 | 1.464 | 8.163 | 1263 (median 5.0) | 4760 (median 5.032) |
| `vibrio-parahaemolyticus` | Vibrio parahaemolyticus | bacterium | **128** | 5.281 | 3.495 | 6.358 | 45 (median 5.497) | 77 (median 5.32) |
| `vibrio-alginolyticus` | Vibrio alginolyticus | bacterium | **55** | 4.868 | 4.194 | 6.301 | 28 (median 4.923) | 33 (median 5.16) |
| `vibrio-anguillarum` | Vibrio anguillarum (incl. Listonella anguillarum) | bacterium | **69** | 5.201 | 4.194 | 6.659 | 38 (median 5.206) | 39 (median 5.012) |
| `bacillus-subtilis` | Bacillus subtilis | bacterium | **2131** | 5.252 | 2.861 | 8.163 | 449 (median 5.252) | 1205 (median 5.244) |
| `pseudomonas-aeruginosa` | Pseudomonas aeruginosa | bacterium | **4403** | 4.903 | 1.163 | 8.416 | 671 (median 4.937) | 3011 (median 4.903) |
| `streptococcus-agalactiae` | Streptococcus agalactiae | bacterium | **97** | 5.072 | 3.696 | 6.943 | 34 (median 4.892) | 68 (median 5.097) |
| `candida-albicans` | Candida albicans | fungus | **1948** | 4.832 | 2.066 | 7.127 | 665 (median 4.901) | 441 (median 4.796) |

*Candida albicans* is a **fungus**, not a bacterium: it is kept as its own cohort and must
never be pooled or ranked with the eight bacterial cohorts. Its MIC rows are mostly
RPMI-1640 (CLSI M27 antifungal broth microdilution), so its `CLSI_MHB_CAMHB_only`
variant (441 members) is not the right sensitivity for it.

`natural-origin only` = members with at least one DBAASP `sourceGenes` entry carrying a
non-empty source organism.

## Dropped rows, per reason

| cohort | target rows | not MIC | medium not broth | censored/range/± | µg/ml mass not computable | other unit | admitted rows | members |
|---|---|---|---|---|---|---|---|---|
| Staphylococcus aureus | 33403 | 6379 | 2347 | 7026 | 6217 | 3 | 11431 | 6158 |
| Escherichia coli | 32042 | 6433 | 1958 | 6143 | 4773 | 2 | 12733 | 7123 |
| Vibrio parahaemolyticus | 400 | 154 | 38 | 53 | 12 | 0 | 143 | 128 |
| Vibrio alginolyticus | 306 | 123 | 44 | 48 | 22 | 0 | 69 | 55 |
| Vibrio anguillarum | 246 | 87 | 31 | 46 | 7 | 0 | 75 | 69 |
| Bacillus subtilis | 6454 | 1134 | 692 | 890 | 1209 | 0 | 2529 | 2131 |
| Pseudomonas aeruginosa | 20604 | 3768 | 1209 | 4584 | 3982 | 4 | 7057 | 4403 |
| Streptococcus agalactiae | 333 | 95 | 8 | 97 | 31 | 0 | 102 | 97 |
| Candida albicans | 8327 | 2445 | 781 | 1449 | 1069 | 0 | 2583 | 1948 |

Per-cohort `dropped_media` and `dropped_concentration_shapes` in the JSON name every
dropped medium and every rejected concentration string shape (`>#`, `#-#`, `#±#`, `<#`,
`>=#`, `#->#`, `≥#`, `#,#` …) with its count.

### Known cost of the strict µg/ml rule

DBAASP reports `molarMass: 0.0` for every terminus and every unusual residue, so a modified
peptide's mass cannot be computed from the dump and its µg/ml rows are dropped — the
largest avoidable bucket above. Admitting just the two textbook offsets (amide −0.98476,
acetyl +42.03675) would add members but barely move the centre:

| cohort | members gained | median pMIC strict → widened |
|---|---|---|
| Staphylococcus aureus | +1297 | 5.046 → 5.039 |
| Escherichia coli | +1317 | 5.032 → 5.043 |
| Vibrio parahaemolyticus | +9 | 5.22 → 5.119 |
| Vibrio alginolyticus | +16 | 4.868 → 4.896 |
| Vibrio anguillarum | +5 | 5.201 → 5.22 |
| Bacillus subtilis | +401 | 5.242 → 5.255 |
| Pseudomonas aeruginosa | +1043 | 4.903 → 4.889 |
| Streptococcus agalactiae | +13 | 5.072 → 5.097 |
| Candida albicans | +289 | 4.832 → 4.843 |

Median pMIC moves by at most 0.10 in any cohort, so the strict rule costs size, not centre,
and is kept. (That table uses a coarser member key than the cohort build, so its absolute
counts are not the cohort sizes — only the deltas are meaningful.)

### Conversion check

The ExPASy average-residue implementation reproduces the source paper's own ProtParam
masses exactly: Table 2 of doi:10.3390/md15070205 gives Mw 1583.81 / 1646.86 / 1572.87 Da
for AI-hemocidin 1 / 2 / 3; this code gives 1583.805 / 1646.864 / 1572.868.

## Licence and citation

- Source: DBAASP v3 (Database of Antimicrobial Activity and Structure of Peptides)
- REST dump `dbaasp_full.jsonl (full REST dump, one peptide record per line)`, retrieved 2026-10-02, sha256 `d8877834a51d92276d19a1ab6bb7fff53ab32083fce6ad53232dca9b0dad3eb8`, 25542 records.
- https://dbaasp.org/v3/api-docs
- Licence: DBAASP Terms of Use allow redistribution with attribution; sequences and values redistributed, numeric "activity" field not used
- Cite: Pirtskhalava M. et al. (2021) Nucleic Acids Res 49:D288-D297, doi:10.1093/nar/gkaa991

DBAASP's own numeric `activity` field is a transformed value and is **never** read; every
number here comes from `concentration` + `unit`.

## Candidate percentiles (NOT part of the committed file)

| peptide | sequence | target | MIC µM | pMIC | cohort size | cohort median pMIC | percentile |
|---|---|---|---|---|---|---|---|
| 피조개 AI-hemocidin 2 | `DLRDSWKVIGSDKK` | Staphylococcus aureus | 22.77 | 4.6426 | 6158 | 5.056 | **29.4** |
| 피조개 AI-hemocidin 2 | `DLRDSWKVIGSDKK` | Escherichia coli | 45.54 | 4.3416 | 7123 | 5.028 | **17.3** |
| 피조개 AI-hemocidin 2 | `DLRDSWKVIGSDKK` | Pseudomonas aeruginosa | 91.08 | 4.0406 | 4403 | 4.903 | **7.5** |
| 피조개 AI-hemocidin 2 | `DLRDSWKVIGSDKK` | Bacillus subtilis | 182.16 | 3.7395 | 2131 | 5.252 | **2.0** |
| 피조개 AI-hemocidin 1 | `PSVQGAAAQLTADVKK` | Escherichia coli | 47.35 | 4.3247 | 7123 | 5.028 | **17.1** |
| 피조개 AI-hemocidin 1 | `PSVQGAAAQLTADVKK` | Pseudomonas aeruginosa | 47.35 | 4.3247 | 4403 | 4.903 | **18.6** |
| 조피볼락 TS40 | `FVSRQSCMDVCAKGAKQHTSRGNVRRARRNRKNRITYLQA` | Vibrio anguillarum | 25.0 | 4.6021 | 69 | 5.201 | **16.7** |
| 조피볼락 TS40 | `FVSRQSCMDVCAKGAKQHTSRGNVRRARRNRKNRITYLQA` | Vibrio parahaemolyticus | 400.0 | 3.3979 | 128 | 5.281 | **0.0** |
| 조피볼락 TS40 | `FVSRQSCMDVCAKGAKQHTSRGNVRRARRNRKNRITYLQA` | Staphylococcus aureus | 12.5 | 4.9031 | 6158 | 5.056 | **42.2** |
| 조피볼락 TS40 | `FVSRQSCMDVCAKGAKQHTSRGNVRRARRNRKNRITYLQA` | Streptococcus agalactiae | 800.0 | 3.0969 | 97 | 5.072 | **0.0** |

None of the three sequences is itself a DBAASP record, so there is no self-inclusion in
any cohort. Both source papers measured MIC in LB broth by 96-well broth microdilution,
which is inside the primary cohort's medium set (`LBB`) but outside the CLSI variant.
