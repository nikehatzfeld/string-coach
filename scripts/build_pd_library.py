#!/usr/bin/env python3
"""
Construit la bibliothèque de morceaux complets à partir du catalogue Mutopia Project
(domaine public et Creative Commons BY / BY-SA).

    venv/bin/python scripts/build_pd_library.py <dossier de travail>

Produit src/songs/pd-library.json (morceaux) et docs/credits-mutopia.md (sources et licences).
Ne garde que les niveaux débutant à intermédiaire (calculés sur la mélodie), 8 à 200 mesures.
"""
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
import import_pd  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTRUMENTS = ['Violin', 'Flute', 'Recorder', 'Voice']
# Pièces de piano populaires dont la main droite fait une belle mélodie.
EXTRA = [
    ('Marche turque (Rondo alla turca)', 'W. A. Mozart', 'https://www.mutopiaproject.org/ftp/MozartWA/KV331/KV331_3_RondoAllaTurca/KV331_3_RondoAllaTurca.mid', 'Public Domain', 'Classique', 110),
    ('Lettre à Élise (Für Elise)', 'L. van Beethoven', 'https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.mid', 'Public Domain', 'Classique', 70),
    ('The Entertainer', 'S. Joplin', 'https://www.mutopiaproject.org/ftp/JoplinS/entertainer/entertainer.mid', 'Public Domain', 'Gospel & jazz', 80),
    ('Musette en Ré', 'J. S. Bach', 'https://www.mutopiaproject.org/ftp/BachJS/BWVAnh126/anna-magdalena-22/anna-magdalena-22.mid', 'Public Domain', 'Classique', 100),
    ('Menuet en la mineur BWV Anh. 120', 'J. S. Bach', 'https://www.mutopiaproject.org/ftp/BachJS/BWVAnh120/BWV-120/BWV-120.mid', 'Public Domain', 'Classique', 100),
    ('Menuet en Si♭ BWV Anh. 118', 'J. S. Bach', 'https://www.mutopiaproject.org/ftp/BachJS/BWVAnh118/BWV-118/BWV-118.mid', 'Public Domain', 'Classique', 100),
    ('Valse op. 39 n° 15', 'J. Brahms', 'https://www.mutopiaproject.org/ftp/BrahmsJ/O39/waltz-op39-15/waltz-op39-15.mid', 'Public Domain', 'Classique', 80),
    ('Berceuse (Wiegenlied)', 'J. Brahms', 'https://www.mutopiaproject.org/ftp/BrahmsJ/LullabyBrahms-C/LullabyBrahms-C.mid', 'Public Domain', 'Classique', 80),
    ('Air (« sur la corde de sol »)', 'J. S. Bach', 'https://www.mutopiaproject.org/ftp/BachJS/BWV1068/bach_air_bmv_1068/bach_air_bmv_1068.mid', 'Public Domain', 'Classique', 60),
    ('Sonatine op. 36 n° 1', 'M. Clementi', 'https://www.mutopiaproject.org/ftp/ClementiM/O36/sonatina-1/sonatina-1-mids.zip', 'Public Domain', 'Classique', 110),
]
POPULAR = re.compile(r'folk|traditional|christmas|carol|hymn|spiritual|popular|song|chanson|lied|lullaby|dance|march|waltz|jig|reel|hornpipe', re.I)
SKIP_WORDS = re.compile(r'concerto|symphon|quartet|quintet|overture|ouverture|mass\b|messe|cantata|kantate|opera|oratorio|requiem|magnificat|motet|madrigal|passion|psalm|canons\b|fuga|fugue', re.I)
STYLE_MAP = [
    (re.compile(r'christmas|carol|noël|noel', re.I), 'Noël'),
    (re.compile(r'hymn|sacred|spiritual|gospel', re.I), 'Chants & cantiques'),
    (re.compile(r'folk|traditional|dance|popular|jig|reel|hornpipe', re.I), 'Folk & monde'),
    (re.compile(r'jazz|rag|blues', re.I), 'Gospel & jazz'),
]


def fetch_catalog(inst, cache):
    path = os.path.join(cache, f'catalog-{inst}.json')
    if os.path.exists(path):
        return json.load(open(path))
    rows, start = [], 0
    while True:
        url = 'https://www.mutopiaproject.org/cgibin/make-table.cgi?' + urllib.parse.urlencode({'Instrument': inst, 'startat': start})
        page = urllib.request.urlopen(url, timeout=120).read().decode('utf-8', 'replace')
        tables = page.split('<table class="table-bordered result-table"')[1:]
        if not tables:
            break
        for t in tables:
            cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', t, re.S)]
            cells = [c for c in cells if c]
            mid = re.findall(r'href="([^"]+\.mid)"', t) or re.findall(r'href="([^"]+mids\.zip)"', t)
            info = re.findall(r'href="(https://www\.mutopiaproject\.org/cgibin/piece-info\.cgi\?id=\d+)"', t)
            rows.append({'inst': inst, 'cells': cells, 'mid': mid[0] if mid else '', 'info': info[0] if info else ''})
        nxt = re.search(r'startat=(\d+)[^"]*"[^>]*>\s*Next', page)
        if not nxt:
            break
        start = int(nxt.group(1))
    json.dump(rows, open(path, 'w'), ensure_ascii=False)
    return rows


def license_of(cells):
    lic = next((c for c in cells if 'Public Domain' in c or 'Creative Commons' in c), '')
    if 'Public Domain' in lic:
        return 'Domaine public'
    if 'ShareAlike' in lic:
        return 'CC BY-SA ' + (re.findall(r'\d\.\d', lic) or [''])[0]
    if 'Attribution' in lic:
        return 'CC BY ' + (re.findall(r'\d\.\d', lic) or [''])[0]
    return ''


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60]


def style_of(cells, default):
    text = ' '.join(cells)
    for rx, st in STYLE_MAP:
        if rx.search(text):
            return st
    return default


def candidates(cache):
    out = []
    for inst in INSTRUMENTS:
        for r in fetch_catalog(inst, cache):
            c = r['cells']
            if not c or not r['mid']:
                continue
            title = c[0]
            lic = license_of(c)
            if not lic or SKIP_WORDS.search(title):
                continue
            by = next((x for x in c if x.startswith('by ')), '')
            composer = re.sub(r'\s*\(.*?\)\s*$', '', by[3:]).strip() or 'Traditionnel'
            text = ' '.join(c)
            popular = bool(POPULAR.search(text))
            # Voix : seulement chants populaires, traditionnels, cantiques et Noël (pas les madrigaux ni motets).
            if inst == 'Voice' and not popular:
                continue
            out.append({'title': title, 'composer': composer, 'midi': r['mid'], 'license': lic,
                        'source': r['info'] or r['mid'], 'style': style_of(c, 'Classique'), 'inst': inst, 'popular': popular})
    for title, composer, mid, lic, style, tempo in EXTRA:
        out.append({'title': title, 'composer': composer, 'midi': mid, 'license': license_of([lic]) or 'Domaine public',
                    'source': mid, 'style': style, 'tempo': tempo, 'inst': 'Piano', 'level': None})
    # Doublons (même fichier)
    seen, uniq = set(), []
    for x in out:
        if x['midi'] in seen:
            continue
        seen.add(x['midi'])
        uniq.append(x)
    return uniq


def work(c):
    spec = {**c, 'id': 'pd-' + slug(c['title'] + '-' + c['composer'])}
    try:
        song = import_pd.convert(spec)
        song['inst'] = c['inst']
        song['popular'] = c.get('popular', False)
        return song, None
    except Exception as e:  # noqa: BLE001
        return None, f"{c['title']}: {e}"


def main(cache):
    os.makedirs(cache, exist_ok=True)
    cands = candidates(cache)
    print(len(cands), 'candidats')
    songs, errors = [], []
    with ProcessPoolExecutor(4) as ex:
        futs = [ex.submit(work, c) for c in cands]
        for i, f in enumerate(as_completed(futs)):
            try:
                song, err = f.result(timeout=300)
            except Exception as e:  # noqa: BLE001
                song, err = None, str(e)
            if err:
                errors.append(err)
            elif song:
                songs.append(song)
            if i % 50 == 0:
                print(f'{i}/{len(futs)}…', flush=True)
    kept = []
    ids = set()
    for s in sorted(songs, key=lambda x: (x['autoLevel'], x['title'])):
        if s['autoLevel'] > 3 or not (8 <= s['bars'] <= 200):
            continue
        if s['id'] in ids:
            continue
        ids.add(s['id'])
        bars_ = s['notation'].split(' | ')
        while len(bars_) > 1 and all(t.startswith('r:') for t in bars_[0].split()):
            bars_.pop(0)
        # L'accord éventuel d'une mesure retirée est reporté sur la première note.
        s['notation'] = ' | '.join(bars_)
        s['level'] = s.pop('autoLevel')
        s.pop('inst', None)
        s.pop('popular', None)
        s.pop('metrics', None)
        s.pop('bars', None)
        kept.append(s)
    json.dump(kept, open(os.path.join(ROOT, 'src/songs/pd-library.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    lines = ['# Morceaux complets : sources et licences', '',
             'Mélodies extraites automatiquement (scripts/build_pd_library.py) des fichiers MIDI du '
             '[Mutopia Project](https://www.mutopiaproject.org). Les morceaux sous licence Creative Commons '
             'BY-SA sont redistribués sous la même licence ; les adaptations (mélodie seule, doigtés) sont du même auteur que le dépôt.', '',
             '| Morceau | Compositeur | Licence | Source |', '|---|---|---|---|']
    for s in kept:
        lines.append(f"| {s['title']} | {s['composer']} | {s['source']['license']} | {s['source']['url']} |")
    open(os.path.join(ROOT, 'docs/credits-mutopia.md'), 'w').write('\n'.join(lines) + '\n')
    print(f'{len(kept)} morceaux gardés sur {len(songs)} convertis ({len(errors)} erreurs)')
    from collections import Counter
    print(Counter(s['level'] for s in kept), Counter(s['style'] for s in kept))
    for e in errors[:15]:
        print('  ', e[:160])


if __name__ == '__main__':
    main(sys.argv[1])
