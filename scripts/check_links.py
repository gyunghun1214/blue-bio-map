#!/usr/bin/env python3
"""Check every outside link the site can show: a[href] in the pages, links written into the page code, and the source
URLs inside the data files the site reads (dist/*.json). Standard library only.

    python scripts/check_links.py                         # -> reports/link-check/links.csv
    python scripts/check_links.py --out other.csv --workers 8 --timeout 20
    python scripts/check_links.py --list                  # only list the URLs and where they are, no requests

Each URL gets a HEAD request; when HEAD fails or is refused (some servers answer 403/405/501 to HEAD only) the same URL is
asked again with GET (the body is not read). Redirects are followed. Requests are spread over hosts (at most two at a time
per host) so no site gets a burst.

CSV columns: url, status (last HTTP code, or the error), result, final_url, locations (file and place, ' | '-joined).
result is one of
  정상       2xx at the end (after redirects)
  이동됨     a permanent redirect (301/308) to another address that works: the link still opens, the address could be updated
  깨짐       404/410, or the host does not exist
  확인 불가  the site refused an automatic request (401/403/429), a server error, a timeout or a network error: open by hand
The exit code is 0 unless --fail-on-broken is given and a link is 깨짐 (the checker is a report, not a gate: outside sites
come and go independently of this repository).
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import csv
import http.client
import json
import re
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
UA = 'Mozilla/5.0 (compatible; BlueBioMap-linkcheck/1.0; +https://blue-bio-map.blue-bio-map.workers.dev)'
URL_RE = re.compile(r"""https?://[^\s"'<>()`\\]+""")
HREF_RE = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']""", re.I)
# Not links a reader opens: the data API needs a key, and the license/credit lines of the map tiles are templates.
SKIP_HOSTS = {'mmsyrshjuaxdvegjhpdz.supabase.co', '127.0.0.1', 'localhost'}


def clean(url: str) -> str:
    url = url.rstrip('.,;:')
    while url.endswith(')') and url.count('(') < url.count(')'):
        url = url[:-1]
    return url


def is_template(url: str) -> bool:
    return '${' in url or '{' in url or url.endswith(('=', '/aphia.php?p=taxdetails&id'))


def json_urls(node, path='$'):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from json_urls(v, f'{path}.{k}')
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from json_urls(v, f'{path}[{i}]')
    elif isinstance(node, str):
        for m in URL_RE.finditer(node):
            yield clean(m.group(0)), path


def short_path(path: str) -> str:
    # $.species[12].sources[3].url -> species[].sources[].url: one entry per kind of place, not per row
    return re.sub(r'\[\d+\]', '[]', path)[2:] or '$'


def collect(dist: Path):
    """{url: {location: count}} over the pages, page code and data files of dist/."""
    found: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for page in sorted(dist.glob('*.html')):
        text = page.read_text(encoding='utf-8')
        for m in HREF_RE.finditer(text):
            href = m.group(1)
            if href.startswith(('http://', 'https://')):
                line = text.count('\n', 0, m.start()) + 1
                found[clean(href)][f'{page.name}:{line} a[href]'] += 1
    for code in sorted(dist.glob('*.js')):
        text = code.read_text(encoding='utf-8')
        for m in URL_RE.finditer(text):
            line = text.count('\n', 0, m.start()) + 1
            found[clean(m.group(0))][f'{code.name}:{line}'] += 1
    for data in sorted(dist.glob('*.json')):
        try:
            doc = json.loads(data.read_text(encoding='utf-8'))
        except (ValueError, UnicodeDecodeError):
            continue
        for url, path in json_urls(doc):
            found[url][f'{data.name} {short_path(path)}'] += 1
    out = {}
    for url, places in found.items():
        host = urllib.parse.urlsplit(url).hostname or ''
        if host in SKIP_HOSTS or is_template(url) or not host or '.' not in host:
            continue
        out[url] = places
    return dict(sorted(out.items()))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # follow by hand to see each hop's code
        return None


OPENER = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def request(url: str, method: str, timeout: float):
    req = urllib.request.Request(url, method=method, headers={
        'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko,en;q=0.8'})
    try:
        with OPENER.open(req, timeout=timeout) as r:
            if method == 'GET':
                r.read(1024)
            return r.status, r.headers.get('Location')
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Location')


def follow(url: str, method: str, timeout: float):
    """(last status, final url, first permanent redirect target or None)"""
    seen, permanent = 0, None
    while True:
        status, location = request(url, method, timeout)
        if status in (301, 302, 303, 307, 308) and location and seen < 10:
            nxt = urllib.parse.urljoin(url, location)
            if status in (301, 308) and permanent is None:
                permanent = nxt
            url, seen = nxt, seen + 1
            continue
        return status, url, permanent


def trivial_move(a: str, b: str) -> bool:
    """http->https, www., a trailing slash or a doi.org resolve: not a moved source."""
    pa, pb = urllib.parse.urlsplit(a), urllib.parse.urlsplit(b)
    if pa.hostname in ('doi.org', 'dx.doi.org'):
        return True
    host = lambda p: (p.hostname or '').removeprefix('www.')
    return host(pa) == host(pb) and pa.path.rstrip('/') == pb.path.rstrip('/') and pa.query == pb.query


def check(url: str, timeout: float):
    status, final, permanent, error = None, url, None, ''
    for method in ('HEAD', 'GET'):
        try:
            status, final, permanent = follow(url, method, timeout)
            error = ''
        except (urllib.error.URLError, http.client.HTTPException, socket.timeout, TimeoutError, ConnectionError,
                ssl.SSLError, ValueError, OSError) as e:
            reason = getattr(e, 'reason', e)
            status, error = None, f'{type(reason).__name__}: {reason}'[:160]
            if isinstance(reason, socket.gaierror):
                break  # the host does not resolve: GET will not do better
        if status is not None and 200 <= status < 300:
            break
        # HEAD refused or failed: try GET once (some servers only answer GET)
    if status is not None and 200 <= status < 300:
        result = '이동됨' if permanent and not trivial_move(url, final) else '정상'
    elif status in (404, 410) or (error and 'gaierror' in error):
        result = '깨짐'
    else:
        result = '확인 불가'
    return {'url': url, 'status': str(status) if status is not None else error, 'result': result,
            'final_url': final if final != url else ''}


def run(urls, workers: int, timeout: float, per_host: int = 2):
    locks: dict[str, threading.Semaphore] = defaultdict(lambda: threading.Semaphore(per_host))
    guard = threading.Lock()

    def one(url):
        host = urllib.parse.urlsplit(url).hostname or ''
        with guard:
            sem = locks[host]
        with sem:
            row = check(url, timeout)
            time.sleep(0.2)  # polite pause per host slot
            return row

    # interleave hosts so the pool does not start with 200 URLs of one site
    by_host = defaultdict(list)
    for u in urls:
        by_host[urllib.parse.urlsplit(u).hostname].append(u)
    order = [u for group in zip_longest_all(by_host.values()) for u in group]
    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(one, order))


def zip_longest_all(groups):
    groups = [list(g) for g in groups]
    i = 0
    while any(i < len(g) for g in groups):
        yield [g[i] for g in groups if i < len(g)]
        i += 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--dist', default=str(DIST))
    ap.add_argument('--out', default=str(ROOT / 'reports' / 'link-check' / 'links.csv'))
    ap.add_argument('--workers', type=int, default=12)
    ap.add_argument('--timeout', type=float, default=20)
    ap.add_argument('--list', action='store_true', help='list URLs and places only, no requests')
    ap.add_argument('--fail-on-broken', action='store_true')
    args = ap.parse_args(argv)

    found = collect(Path(args.dist))
    if args.list:
        for url, places in found.items():
            print(url, '\t', ' | '.join(places))
        print(f'{len(found)} URLs', file=sys.stderr)
        return 0
    rows = run(list(found), args.workers, args.timeout)
    rows.sort(key=lambda r: (['깨짐', '이동됨', '확인 불가', '정상'].index(r['result']), r['url']))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', newline='', encoding='utf-8-sig') as f:  # BOM: Excel on Windows opens the Korean as is
        w = csv.DictWriter(f, fieldnames=['url', 'status', 'result', 'final_url', 'locations'])
        w.writeheader()
        for r in rows:
            places = found[r['url']]
            w.writerow({**r, 'locations': ' | '.join(f'{p} ×{n}' if n > 1 else p for p, n in places.items())})
    counts = defaultdict(int)
    for r in rows:
        counts[r['result']] += 1
    print(f"{len(rows)} URLs · " + ' · '.join(f'{k} {counts[k]}' for k in ['정상', '이동됨', '깨짐', '확인 불가']) + f' -> {out}')
    return 1 if args.fail_on_broken and counts['깨짐'] else 0


if __name__ == '__main__':
    sys.exit(main())
