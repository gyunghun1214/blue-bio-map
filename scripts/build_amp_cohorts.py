# Build the AMP MIC comparison cohorts (verified-pilot-3.18, Poor Broth added in 3.19) from the DBAASP dump.
# Mirrors research/verified-indices/peptide-cohort-ahtpdb-ace-hhl.json (ic50_uM -> mic_uM).
# Strict rules: MIC only, broth media only (whitelist), single clean numeric concentration,
# DBAASP's own numeric 'activity' field is never read.
import hashlib, json, math, re, statistics, sys
from collections import Counter, defaultdict

SRC = sys.argv[1]
OUT = sys.argv[2]

# ExPASy ProtParam average residue masses + one water (18.01524)
MW = {'A': 71.0788, 'R': 156.1875, 'N': 114.1038, 'D': 115.0886, 'C': 103.1388, 'E': 129.1155,
      'Q': 128.1307, 'G': 57.0519, 'H': 137.1411, 'I': 113.1594, 'L': 113.1594, 'K': 128.1741,
      'M': 131.1926, 'F': 147.1766, 'P': 97.1167, 'S': 87.0782, 'T': 101.1051, 'W': 186.2132,
      'Y': 163.1760, 'V': 99.1326}
WATER = 18.01524
STD = re.compile(r'^[ACDEFGHIKLMNPQRSTVWY]+$')
NUM = re.compile(r'^(\d+(?:\.\d+)?)$')

# Liquid (broth) media, by abbreviation expansions we are confident of. Everything else --
# agar plates, cell-culture media, blanks and abbreviations we cannot pin down -- is dropped
# and tallied by name, so the exclusion list is auditable.
BROTH = {
    'MHB': 'Mueller-Hinton broth', 'CAMHB': 'cation-adjusted Mueller-Hinton broth',
    'LBB': 'Luria-Bertani broth', 'LB': 'Luria-Bertani broth',
    'TSB': 'tryptic soy broth', 'TSBY': 'tryptic soy broth + yeast extract',
    'BHIB': 'brain heart infusion broth', 'NB': 'nutrient broth',
    'THB': 'Todd-Hewitt broth', 'ISB': 'Iso-Sensitest broth', 'BrB': 'Brucella broth',
    'ColB': 'Columbia broth', 'AM3': 'antibiotic medium 3 (liquid)',
    'NZCYM': 'NZCYM broth', 'TB': 'terrific/tryptose broth',
    'RPMI-1640': 'RPMI-1640 (CLSI M27 antifungal broth microdilution)',
    'SDB': 'Sabouraud dextrose broth', 'SGB': 'Sabouraud glucose broth',
    'PDB': 'potato dextrose broth', 'MEB': 'malt extract broth',
    'YEPD': 'yeast extract peptone dextrose broth', 'YNB': 'yeast nitrogen base (liquid)',
    # verified-pilot-3.19 team-lead decision: the liquid growth inhibition assay in Poor Broth is a broth MIC
    # (DBAASP describes PBM as 'Poor Broth medium (Peptone/Tryptone, NaCl)'). Run without this line for the 3.18 file.
    'PBM': 'Poor Broth medium (peptone/tryptone, NaCl)',
}
CLSI = {'MHB', 'CAMHB'}          # sensitivity variant only, never the primary cohort

TARGETS = [
    ('amp-dbaasp-mic-broth-staphylococcus-aureus', 'Staphylococcus aureus',
     r'^Staphylococcus aureus\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-escherichia-coli', 'Escherichia coli',
     r'^Escherichia coli\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-vibrio-parahaemolyticus', 'Vibrio parahaemolyticus',
     r'^Vibrio parahaemolyticus\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-vibrio-alginolyticus', 'Vibrio alginolyticus',
     r'^Vibrio alginolyticus\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-vibrio-anguillarum', 'Vibrio anguillarum (incl. Listonella anguillarum)',
     r'^(Vibrio|Listonella) anguillarum\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-bacillus-subtilis', 'Bacillus subtilis',
     r'^Bacillus subtilis\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-pseudomonas-aeruginosa', 'Pseudomonas aeruginosa',
     r'^Pseudomonas aeruginosa\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-streptococcus-agalactiae', 'Streptococcus agalactiae',
     r'^Streptococcus agalactiae\b', 'bacterium'),
    ('amp-dbaasp-mic-broth-candida-albicans', 'Candida albicans',
     r'^Candida albicans\b', 'fungus'),
]
TARGETS = [(cid, name, re.compile(p, re.I), kind) for cid, name, p, kind in TARGETS]
# the published file keeps only the cohorts an adopted row measures
SCOPE = {'Staphylococcus aureus', 'Escherichia coli', 'Pseudomonas aeruginosa', 'Bacillus subtilis',
         'Vibrio anguillarum (incl. Listonella anguillarum)', 'Vibrio parahaemolyticus', 'Streptococcus agalactiae'}
KEEP = ('cohort_id', 'target_species', 'target_kind', 'measure', 'media', 'size', 'median_pMIC', 'min_pMIC',
        'max_pMIC', 'median_mic_uM', 'sensitivity', 'filter_counts', 'dropped_media', 'dropped_concentration_shapes')


def member_key(d):
    """sequence + N-terminus + C-terminus + non-standard residues + bonds (+ complexity,
    which keeps a multimer from collapsing onto the monomer of the same sequence string)."""
    seq = (d.get('sequence') or '').strip().upper()
    nt = ((d.get('nTerminus') or {}).get('name') or '-')
    ct = ((d.get('cTerminus') or {}).get('name') or '-')
    ua = sorted('%s@%s' % (((u.get('modificationType') or {}).get('name') or '?'), u.get('position'))
                for u in d.get('unusualAminoAcids') or [])
    ib = sorted('%s:%s-%s' % (((b.get('type') or {}).get('name') or '?'), b.get('position1'), b.get('position2'))
                for b in d.get('intrachainBonds') or [])
    xb = sorted('%s:%s-%s' % (((b.get('type') or {}).get('name') or '?'), b.get('chain1'), b.get('chain2'))
                for b in d.get('interchainBonds') or [])
    cx = (d.get('complexity') or {}).get('name') or '?'
    key = '|'.join([seq, nt, ct, ','.join(ua), ','.join(ib), ','.join(xb), cx])
    return key, hashlib.sha256(key.encode()).hexdigest()[:16], seq, (nt, ct, ua, ib, xb, cx)


def main():
    pool = {cid: defaultdict(list) for cid, _, _, _ in TARGETS}
    info = {cid: {} for cid, _, _, _ in TARGETS}
    stats = {cid: Counter() for cid, _, _, _ in TARGETS}
    dropmed = {cid: Counter() for cid, _, _, _ in TARGETS}
    dropshape = {cid: Counter() for cid, _, _, _ in TARGETS}
    nonstd_seq = Counter()
    rows_read = 0

    for line in open(SRC, encoding='utf-8'):
        d = json.loads(line)
        if d.get('_error'):
            continue
        key, kh, seq, parts = member_key(d)
        nt, ct, ua, ib, xb, cx = parts
        # mass is computable only for a plain standard-residue monomer with free termini
        plain = bool(STD.match(seq)) and not ua and nt == '-' and ct == '-' and cx == 'Monomer'
        if seq and not STD.match(seq):
            nonstd_seq[re.sub(r'[ACDEFGHIKLMNPQRSTVWY]', '', seq)[:12]] += 1
        natural = sorted({(g.get('source') or '').strip() for g in d.get('sourceGenes') or []} - {''})
        for a in d.get('targetActivities') or []:
            tn = ((a.get('targetSpecies') or {}).get('name') or '').strip()
            for cid, _, pat, _kind in TARGETS:
                if not pat.match(tn):
                    continue
                rows_read += 1
                s = stats[cid]
                s['01_target_activity_rows'] += 1
                if a.get('activityMeasureValue') != 'MIC':
                    s['02_drop_measure_not_MIC'] += 1
                    continue
                s['03_MIC_rows'] += 1
                med = (a.get('medium') or {}).get('name')
                if med not in BROTH:
                    s['04_drop_medium_not_broth_whitelist'] += 1
                    dropmed[cid][med if (med or '').strip() else '(blank/none)'] += 1
                    continue
                s['05_MIC_broth_rows'] += 1
                conc = str(a.get('concentration') or '').strip()
                m = NUM.match(conc)
                if not m:
                    s['06_drop_censored_range_or_pm'] += 1
                    dropshape[cid][re.sub(r'\d+(\.\d+)?', '#', conc) or '(empty)'] += 1
                    continue
                v = float(m.group(1))
                unit = (a.get('unit') or {}).get('name')
                if unit == 'µM':
                    uM = v
                elif unit == 'µg/ml':
                    if not plain:
                        s['07_drop_ugml_mass_not_computable'] += 1
                        continue
                    uM = v * 1000.0 / (sum(MW[c] for c in seq) + WATER)
                else:
                    s['08_drop_unit_' + (unit or 'none')] += 1
                    continue
                if uM <= 0:
                    s['09_drop_nonpositive'] += 1
                    continue
                s['10_admitted_rows'] += 1
                pool[cid][kh].append({'uM': uM, 'clsi': med in CLSI})
                info[cid].setdefault(kh, {'seq': seq, 'natural': natural})

    def summarise(members):
        v = sorted(members.values())
        if not v:
            return None
        p = [6 - math.log10(x) for x in v]
        return {'size': len(v), 'median_pMIC': round(statistics.median(p), 3),
                'min_pMIC': round(min(p), 3), 'max_pMIC': round(max(p), 3),
                'median_mic_uM': round(statistics.median(v), 4),
                'min_mic_uM': round(min(v), 4), 'max_mic_uM': round(max(v), 2)}

    cohorts = []
    for cid, name, _pat, kind in TARGETS:
        p, inf = pool[cid], info[cid]
        prim = {k: statistics.median([r['uM'] for r in rs]) for k, rs in p.items()}
        clsi = {k: statistics.median([r['uM'] for r in rs if r['clsi']])
                for k, rs in p.items() if any(r['clsi'] for r in rs)}
        nat = {k: v for k, v in prim.items() if inf[k]['natural']}
        base = summarise(prim) or {'size': 0}
        c = {
            'cohort_id': cid,
            'target_species': name,
            'target_kind': kind,
            'measure': 'MIC',
            'media': 'broth only (whitelist below); agar and unclassified media excluded',
            'meets_minimum_30': base['size'] >= 30,
            'size': base['size'],
            'median_pMIC': base.get('median_pMIC'), 'min_pMIC': base.get('min_pMIC'),
            'max_pMIC': base.get('max_pMIC'), 'median_mic_uM': base.get('median_mic_uM'),
            'min_mic_uM': base.get('min_mic_uM'), 'max_mic_uM': base.get('max_mic_uM'),
            'sensitivity': {
                'natural_origin_only': summarise(nat),
                'CLSI_MHB_CAMHB_only': summarise(clsi),
            },
            'filter_counts': dict(sorted(stats[cid].items())),
            'dropped_media': dict(dropmed[cid].most_common()),
            'dropped_concentration_shapes': dict(dropshape[cid].most_common()),
            'members': [],
        }
        if base['size'] >= 30:
            for k in sorted(prim, key=lambda k: (-prim[k], inf[k]['seq'])):
                c['members'].append({'member_key_sha256_16': k, 'sequence': inf[k]['seq'],
                                     'mic_uM': round(prim[k], 4), 'n_rows': len(p[k])})
        cohorts.append(c)

    doc = {
        'stratum_id': 'amp-dbaasp-mic-2026',
        'generated': '2026-10-02',
        'source': {
            'provider': 'DBAASP v3 (Database of Antimicrobial Activity and Structure of Peptides)',
            'file': 'dbaasp_full.jsonl (full REST dump, one peptide record per line)',
            'url': 'https://dbaasp.org/v3/api-docs',
            'retrieved': '2026-10-02',
            'sha256': 'd8877834a51d92276d19a1ab6bb7fff53ab32083fce6ad53232dca9b0dad3eb8',
            'records': 25542,
            'licence': 'DBAASP Terms of Use allow redistribution with attribution; sequences and values redistributed, numeric "activity" field not used',
            'citation': 'Pirtskhalava M. et al. (2021) Nucleic Acids Res 49:D288-D297, doi:10.1093/nar/gkaa991',
        },
        'rule': (
            'Cohort = one target species x measure MIC x broth medium (any strain of that species).\n'
            '  - activityMeasureValue exactly "MIC" (MIC50, MIC90, MBC, MFC, MEC, IC50, LC/LD dropped)\n'
            '  - medium in the broth whitelist; agar media and media we could not classify are dropped\n'
            '  - concentration a single number: ">", ">=", "<", "<=", ranges and "+/-" dropped\n'
            '  - unit µM used as read; µg/ml converted with ExPASy average residue masses + one water\n'
            '    (18.01524), so µg/ml rows are admitted only for a plain standard-residue monomer with\n'
            '    free termini -- DBAASP reports molarMass 0.0 for every terminus and unusual residue,\n'
            '    so a modified peptide\'s mass cannot be computed and its µg/ml rows are dropped\n'
            '  - member key = sequence + N-terminus + C-terminus + non-standard residues + intrachain\n'
            '    and interchain bonds + complexity; member value = median of that member\'s µM rows\n'
            '  - DBAASP\'s own numeric "activity" field is never read (it is a transformed value)\n'
            '  - score pMIC = 6 - log10(MIC in µM); percentile = 100 x (below + 0.5 x equal) / size\n'
            '  - minimum cohort size 30; CLSI MHB/CAMHB-only is a sensitivity variant, not the primary'
        ),
        'broth_whitelist': BROTH,
        'clsi_sensitivity_media': sorted(CLSI),
        'percentile_rule': 'percentile = 100 x (members with lower pMIC + 0.5 x members with equal pMIC) / size',
        'scope': 'Only the target species the adopted rows measure. Other cohorts built in the same run (Vibrio alginolyticus %d, Candida albicans %d - a fungus, never pooled with the bacteria) are reported in the decision record and can be added when a row needs them.' % tuple(
            next(c['size'] for c in cohorts if c['target_species'] == t) for t in ('Vibrio alginolyticus', 'Candida albicans')),
        # members hold only what the percentile needs; the key hash stays for auditing
        'cohorts': [{**{k: c[k] for k in KEEP},
                     'members': [{'k': m['member_key_sha256_16'], 'mic_uM': m['mic_uM'], 'n': m['n_rows']} for m in c['members']]}
                    for c in cohorts if c['target_species'] in SCOPE],
    }
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n')

    for c in cohorts:
        print('%-46s size=%-6d min30=%-5s median_pMIC=%-7s nat=%-5s clsi=%s' % (
            c['target_species'], c['size'], c['meets_minimum_30'], c['median_pMIC'],
            (c['sensitivity']['natural_origin_only'] or {}).get('size'),
            (c['sensitivity']['CLSI_MHB_CAMHB_only'] or {}).get('size')))
    print('\nnon-standard sequence alphabets seen:', nonstd_seq.most_common(8))
    print('target-matched activity rows read:', rows_read)


main()
