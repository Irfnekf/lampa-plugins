#!/usr/bin/env python3
"""Поповнює kinoukr_db.json новими тайтлами з kinoukr.tv (для джерела KinoUkr у LMX UA).

Іде сторінками каталогу від найновіших, відкриває лише сторінки тайтлів, яких ще немає в базі,
і зупиняється, щойно сторінка каталогу не дала нічого нового. Запускається щодня з GitHub Actions.
Формат рядка бази: [назва, оригінальна назва, рік, ashdi, tortuga].
"""
import json
import os
import re
import sys
import time
import urllib.request

HOST = os.environ.get('KINOUKR_HOST', 'https://kinoukr.tv')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'kinoukr_db.json')
KNOWN = os.path.join(ROOT, 'tools', 'kinoukr_known.json')
MAX_PAGES = int(os.environ.get('KINOUKR_PAGES', '120'))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'


def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'uk,en;q=0.8', 'Referer': HOST + '/'})
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 + attempt * 3)
    print('fail', url, err, file=sys.stderr)
    return None


def parse_title(html):
    name = re.search(r'itemprop="name">([^<]+)</h1>', html)
    eng = re.search(r'class="foriginal">([^<]+)</div>', html)
    year = re.search(r'<span>Рік:</span> ?<a [^>]+>([0-9]+)</a>', html)
    tortuga = re.search(r'src="https?://tortuga\.[a-z]+/([^"]+)"', html)
    ashdi = re.search(r'src="https?://ashdi\.vip/([^"]+)"', html)
    if not name or not (ashdi or tortuga):
        return None
    return [name.group(1).strip(), (eng.group(1).strip() if eng else ''), int(year.group(1)) if year else 0,
            ashdi.group(1) if ashdi else '', tortuga.group(1) if tortuga else '']


def main():
    db = json.load(open(DB, encoding='utf-8'))
    known = set(json.load(open(KNOWN)))
    have = {(r[0].lower(), r[2]) for r in db}
    added, seen_ids = [], set()
    reached = False
    for page in range(1, MAX_PAGES + 1):
        url = HOST + '/' if page == 1 else '%s/page/%d/' % (HOST, page)
        listing = get(url)
        if listing is None:
            break
        reached = True
        links = re.findall(r'class="mask flex-col ps-link" href="(https?://[^/]+/(\d+)-[^"]+\.html)"', listing)
        if not links:
            break
        fresh = [(u, int(i)) for u, i in links if int(i) not in known and int(i) not in seen_ids]
        for u, i in fresh:
            seen_ids.add(i)
            html = get(u)
            time.sleep(0.4)
            if html is None:
                continue
            row = parse_title(html)
            known.add(i)
            if row and (row[0].lower(), row[2]) not in have:
                have.add((row[0].lower(), row[2]))
                added.append(row)
        if not fresh:
            break       # уся сторінка вже відома — далі лише старіше
        time.sleep(0.4)
    if not reached:
        print('kinoukr недоступний', file=sys.stderr)
        sys.exit(1)
    if added:
        db = added + db
        open(DB, 'w', encoding='utf-8').write(json.dumps(db, ensure_ascii=False, separators=(',', ':')))
    open(KNOWN, 'w').write(json.dumps(sorted(known), separators=(',', ':')))
    print('added', len(added), 'total', len(db))


if __name__ == '__main__':
    main()
