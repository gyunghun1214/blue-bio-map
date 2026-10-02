# Build the anticancer-peptide IC50 comparison cohorts for verified-pilot-3.21 from the CancerPPD 2.0
# cell-line tables. Mirrors scripts/build_amp_cohorts.py (MIC -> IC50, target bacterium -> cancer cell line).
# Strict rules: IC50 only, a single clean numeric value (an attached standard deviation is allowed and the
# central value is used), units converted to uM, and a mass is computed only when the record describes a
# plain standard-residue linear monomer with free termini and no chemical modification.
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

# Column order of fetch_cell_line.php, taken from the table's own header row
COLS = ['ID', 'PMID', 'YEAR', 'Sequence', 'Name', 'Length', 'Linear/Cyclic', 'Chirality', 'Chem-MOD',
        'C-ter MOD', 'N-ter MOD', 'Nature', 'Origin', 'Cell Line', 'Cancer Type', 'Assay', 'Activity',
        'Testing Time', 'Tissue Affected', 'Patents']
I = {c: i for i, c in enumerate(COLS)}

# CancerPPD's "Origin" column is free text: a source organism, or wording that says the peptide was made or
# redesigned. It is only good enough for a sensitivity cohort, never for an origin claim, which we read in the paper.
DESIGNED = re.compile(r'synthe|analog|designed|derivativ|modified|variant|mutant|hybrid|conjugat|FLAK|library', re.I)
MEASURE = re.compile(r'^\s*(?P<m>[A-Za-z]+\s*\d*)\s*(?P<rel>[=<>~≈≥≤]+)\s*(?P<rest>.+)$')
# "12.5", "12.5 ± 0.3", "12.5±0.3"
VALUE = re.compile(r'^(?P<val>\d+(?:\.\d+)?)\s*(?:[±±]\s*\d+(?:\.\d+)?)?\s*(?P<unit>\S.*)$')
# Units we accept. A bare "M" is refused: every such row in the snapshot reads "IC50 = 5 M" or "6 M",
# which is not a credible peptide IC50 and looks like a data-entry fault.
UNITS = {'um': 'uM', 'umol/l': 'uM', 'umo/l': 'uM', 'um/l': 'uM',
         'nm': 'nM', 'nmol/l': 'nM', 'mm': 'mM', 'mmol/l': 'mM', 'pm': 'pM', 'pmol/l': 'pM',
         'ug/ml': 'ug/ml', 'ug/l': 'ug/l', 'mg/ml': 'mg/ml', 'ng/ml': 'ng/ml'}
TO_uM = {'uM': 1.0, 'nM': 1e-3, 'mM': 1e3, 'pM': 1e-6}
MASS_PER_ML = {'ug/ml': 1.0, 'mg/ml': 1e3, 'ng/ml': 1e-3, 'ug/l': 1e-3}   # in ug/mL


def norm_unit(u):
    u = u.strip().strip('.').replace(' ', '').replace('µ', 'u').replace('μ', 'u').lower()
    return UNITS.get(u)


def norm_cell(name):
    """Match cell-line spellings that differ only in hyphens, spaces and case (A-549 vs A549)."""
    return re.sub(r'[^A-Z0-9]', '', (name or '').upper())


def member_key(c):
    """sequence + termini + chemical modification + ring form + chirality, so an analogue is its own member."""
    parts = [(c[I['Sequence']] or '').strip().upper(), (c[I['Chem-MOD']] or '').strip(),
             (c[I['C-ter MOD']] or '').strip(), (c[I['N-ter MOD']] or '').strip(),
             (c[I['Linear/Cyclic']] or '').strip(), (c[I['Chirality']] or '').strip()]
    key = '|'.join(parts)
    return key, hashlib.sha256(key.encode()).hexdigest()[:16]


def plain_monomer(c):
    """A mass can be computed only for a plain standard-residue linear peptide with free, unmodified termini."""
    seq = (c[I['Sequence']] or '').strip().upper()
    free = lambda v: (v or '').strip().lower() in ('free', 'none', '-', '')
    return (bool(STD.match(seq)) and (c[I['Linear/Cyclic']] or '').strip().lower() == 'linear'
            and free(c[I['Chem-MOD']]) and free(c[I['C-ter MOD']]) and free(c[I['N-ter MOD']]))


def main():
    rows = []
    for line in open(SRC, encoding='utf-8'):
        d = json.loads(line)
        c = d.get('cells')
        if c and len(c) == len(COLS) and c[0] != 'ID':
            rows.append(c)

    pool = defaultdict(lambda: defaultdict(list))     # cell line -> member hash -> uM values
    info, stats, names = {}, Counter(), {}
    dropped_units, dropped_measures = Counter(), Counter()
    for c in rows:
        cell = (c[I['Cell Line']] or '').strip()
        key = norm_cell(cell)
        if not key:
            continue
        stats['01_rows'] += 1
        act = (c[I['Activity']] or '').strip()
        m = MEASURE.match(act)
        if not m:
            stats['02_drop_activity_unparsed'] += 1
            continue
        measure = re.sub(r'\s+', '', m.group('m')).upper()
        if measure != 'IC50':
            stats['03_drop_measure_not_IC50'] += 1
            dropped_measures[measure] += 1
            continue
        stats['04_IC50_rows'] += 1
        if m.group('rel') != '=':
            stats['05_drop_censored_relation'] += 1
            continue
        v = VALUE.match(m.group('rest').strip())
        if not v:
            stats['06_drop_value_not_single_number'] += 1
            continue
        unit = norm_unit(v.group('unit'))
        if unit is None:
            stats['07_drop_unit_unusable'] += 1
            dropped_units[v.group('unit').strip()[:16]] += 1
            continue
        val = float(v.group('val'))
        seq = (c[I['Sequence']] or '').strip().upper()
        if unit in TO_uM:
            uM = val * TO_uM[unit]
        else:
            if not plain_monomer(c):
                stats['08_drop_mass_not_computable'] += 1
                continue
            uM = val * MASS_PER_ML[unit] * 1000.0 / (sum(MW[ch] for ch in seq) + WATER)
        if uM <= 0:
            stats['09_drop_nonpositive'] += 1
            continue
        stats['10_admitted_rows'] += 1
        _, kh = member_key(c)
        pool[key][kh].append(uM)
        names.setdefault(key, cell)
        info.setdefault(kh, {'seq': seq, 'name': (c[I['Name']] or '').strip(),
                             'natural': not DESIGNED.search(c[I['Origin']] or ''), 'ids': set()})
        info[kh]['ids'].add(c[I['ID']])

    cohorts = []
    for key, members in sorted(pool.items()):
        value = {k: statistics.median(v) for k, v in members.items()}
        if len(value) < 30:
            continue
        pic = sorted(6 - math.log10(x) for x in value.values())
        nat = [v for k, v in value.items() if info[k]['natural']]
        cohorts.append({
            'cohort_id': 'anticancer-cancerppd-ic50-' + re.sub(r'[^a-z0-9]+', '-', names[key].lower()).strip('-'),
            'cell_line': names[key],
            'cell_line_key': key,
            'measure': 'IC50',
            'scope': 'every assay and exposure time CancerPPD records for this cell line',
            'size': len(value),
            'median_pIC50': round(statistics.median(pic), 3),
            'min_pIC50': round(min(pic), 3),
            'max_pIC50': round(max(pic), 3),
            'median_ic50_uM': round(statistics.median(list(value.values())), 4),
            'sensitivity': {'natural_origin_only': {
                'size': len(nat),
                'median_ic50_uM': round(statistics.median(nat), 4) if nat else None}},
            # 6 significant digits, so a picomolar value does not round away to zero
            'members': [{'k': k, 'ic50_uM': float('%.6g' % value[k]), 'n': len(members[k])}
                        for k in sorted(value, key=lambda k: (-value[k], info[k]['seq']))],
        })

    doc = {
        'stratum_id': 'anticancer-cancerppd-ic50-2026',
        'generated': '2026-10-02',
        'source': {
            'provider': 'CancerPPD 2.0 (repository of experimentally verified anticancer peptides and proteins), '
                        'Raghava group, IIIT-Delhi',
            'file': 'cell-line tables of fetch_cell_line.php, one HTML table per cell line in browse_cell_line.php',
            'url': 'https://webs.iiitd.edu.in/raghava/cancerppd2/',
            'retrieved': '2026-10-02',
            'dump_sha256': 'ab2e058e5d67ca21b3556eb6b8413b8c2006ffd28405d7080f105574f852d2f8',
            'cell_line_tables': 407,
            'licence': 'Prof. G. P. S. Raghava confirmed by email on 2026-10-02: "All our databases and server are '
                       'free for public, we have no restrictions from our side." Only peptide sequences, IC50 values '
                       'and row counts are stored.',
            'citation': 'Chauhan M., Gupta A., Tomer R. and Raghava G.P.S. (2025) CancerPPD2: an updated repository '
                        'of anticancer peptides and proteins. Database 2025:baaf030, doi:10.1093/database/baaf030',
        },
        'rule': (
            'Cohort = one cancer cell line x measure IC50 (any assay, any exposure time).\n'
            '  - the Activity cell must read IC50 with relation "="; EC50, LD50, LC50, CC50, GI50, MIC,\n'
            '    "> x", "< x", "~ x" and "between x to y" are dropped\n'
            '  - a single numeric value; an attached standard deviation is kept and its central value used\n'
            '  - units uM/nM/mM/pM used as read (including the uMol/L spellings); ug/mL, mg/mL, ng/mL and ug/L\n'
            '    converted with ExPASy average residue masses + one water, which admits only a plain\n'
            '    standard-residue linear monomer with free unmodified termini; a bare "M" is refused because\n'
            '    every such row reads "IC50 = 5 M" or "6 M", which is not a credible peptide IC50\n'
            '  - member key = sequence + chemical modification + both termini + ring form + chirality;\n'
            '    member value = the median of that member uM rows for the cell line\n'
            '  - score pIC50 = 6 - log10(IC50 in uM); percentile = 100 x (below + 0.5 x equal) / size\n'
            '  - minimum cohort size 30; cell-line names are matched ignoring hyphens, spaces and case'
        ),
        'percentile_rule': 'percentile = 100 x (members with lower pIC50 + 0.5 x members with equal pIC50) / size',
        'self_membership_rule': (
            'A peptide this project scores may itself be one of the cohort rows. The index builder removes the member '
            'whose key equals the scored peptide before it ranks, so nothing is ranked against itself.'),
        'limitations': [
            'The cohort pools exposure times (24 h, 48 h, 72 h ...) and assay formats (MTT, MTS, CCK-8, SRB, '
            'alamarBlue). A longer exposure usually gives a lower IC50, so a short-exposure value ranks low for a '
            'reason that is not potency. The 24-h-only cohort is published beside it as a sensitivity.',
            'The cohort is dominated by designed and synthetic peptides, so a natural marine peptide usually lands '
            'below the median; a natural-origin-only cohort is published as a sensitivity. That split reads '
            'CancerPPD\'s free-text "Origin" column, which is an approximation; an origin claim for a scored '
            'peptide is always read in the original paper instead.',
            'A rank at the very top or bottom of a cohort of a few dozen peers rests on few comparisons. The size of '
            'the cohort is published with every item, and a percentile of 100 means only that the value beats every '
            'peer in this cohort, not that no stronger anticancer peptide exists.',
        ],
        'filter_counts': dict(sorted(stats.items())),
        'dropped_measures': dict(dropped_measures.most_common(12)),
        'dropped_units': dict(dropped_units.most_common(12)),
        'cohorts': cohorts,
    }
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n')

    for c in cohorts:
        print('%-26s size=%-5d median_pIC50=%-7s natural=%s' % (
            c['cell_line'], c['size'], c['median_pIC50'], c['sensitivity']['natural_origin_only']['size']))
    print('\nfilters:', dict(sorted(stats.items())))
    print('dropped units:', dropped_units.most_common(8))


main()
