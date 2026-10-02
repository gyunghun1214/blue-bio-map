# Crawl every CancerPPD 2.0 cell-line table (fetch_cell_line.php) into one JSONL dump.
# The REST API omits the activity column, so the cell-line tables are the only source of IC50 values.
import html, json, re, ssl, sys, time, urllib.parse, urllib.request

BASE = 'https://webs.iiitd.edu.in/raghava/cancerppd2/'
ctx = ssl.create_default_context()
ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE   # the site's chain fails verification
UA = {'User-Agent': 'Mozilla/5.0 (research crawl; contact research@example.org)'}


def get(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers=UA)
            return urllib.request.urlopen(req, timeout=120, context=ctx).read().decode('utf-8', 'replace')
        except Exception as e:  # noqa: BLE001
            time.sleep(5 * (attempt + 1))
            err = e
    raise err


def cells(row):
    return [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)]


page = get(BASE + 'browse_cell_line.php')
lines = re.findall(r'<form action="fetch_cell_line.php" method="POST"[^>]*>.*?name="cell_line" value="([^"]*)"', page, re.S)
out = open(sys.argv[1], 'w', encoding='utf-8')
header = None
for i, cl in enumerate(lines):
    t = get(BASE + 'fetch_cell_line.php', {'cell_line': cl})
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)
    if rows and header is None:
        header = cells(rows[0])
        out.write(json.dumps({'_header': header}, ensure_ascii=False) + '\n')
    n = 0
    for r in rows[1:]:
        c = cells(r)
        if c:
            out.write(json.dumps({'_query': cl, 'cells': c}, ensure_ascii=False) + '\n')
            n += 1
    print(i + 1, len(lines), cl, n, flush=True)
    time.sleep(0.7)
out.close()
