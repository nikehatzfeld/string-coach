#!/usr/bin/env python3
"""
Répertoire de guitare classique (Mutopia, catalogue « Guitar ») avec TOUTES les notes :
basse et mélodie, placées sur les cordes avec un doigté jouable, en alphaTex prêt à afficher.

    venv/bin/python scripts/build_guitar.py <dossier de cache>

Produit src/songs/pd-guitar.json et complète docs/credits-mutopia.md.
Chaque morceau garde aussi sa mélodie (voix haute) en notation compacte, pour le pas à pas.
"""
import itertools
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from fractions import Fraction

sys.path.insert(0, os.path.dirname(__file__))
import build_pd_library as bpl  # noqa: E402
import import_pd  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TUNING = [64, 59, 55, 50, 45, 40]  # corde 1 (Mi aigu) → 6 (Mi grave)
MAX_FRET = 12
Q = import_pd.Q


def options(midi):
    return [(s + 1, midi - o) for s, o in enumerate(TUNING) if 0 <= midi - o <= MAX_FRET]


def assign(chord, prev_pos):
    """Cordes distinctes pour les notes d'un accord ; écart de main ≤ 4 cases ; près de la position précédente."""
    best, best_cost = None, None
    opts = [options(m) for m in chord]
    if any(not o for o in opts):
        return None, prev_pos
    for combo in itertools.product(*opts):
        strings = [s for s, _ in combo]
        if len(set(strings)) < len(strings):
            continue
        fretted = [f for _, f in combo if f > 0]
        span = (max(fretted) - min(fretted)) if fretted else 0
        if span > 4:
            continue
        pos = min(fretted) if fretted else prev_pos
        cost = span * 1.5 + abs(pos - prev_pos) * 1.0 + sum(f for _, f in combo) * 0.15
        if best_cost is None or cost < best_cost:
            best, best_cost = combo, cost
    if best is None:
        return None, prev_pos
    fretted = [f for _, f in best if f > 0]
    return best, (min(fretted) if fretted else prev_pos)


def tex_dur(d):
    return import_pd.split(d)


def build(spec):
    score = import_pd.load(spec['midi'], spec.get('member', 0))
    events = [e for p in score.parts for e in import_pd.part_events(p)]
    if not events:
        raise ValueError('vide')
    ts = score.recurse().getElementsByClass(import_pd.m21.meter.TimeSignature).first()
    num, den = (ts.numerator, ts.denominator) if ts else (4, 4)
    bar_len = Fraction(num * 4, den)
    pickup = import_pd.lily_pickup(spec['midi'])
    shift = (bar_len - pickup) % bar_len if pickup else Fraction(0)
    by = {}
    for s, d, ps in events:
        by.setdefault(s + shift, set()).update(p for p in ps)
    onsets = sorted(by)
    end = max(s + shift + d for s, d, _ in events)
    n_bars = int(-(-end // bar_len))
    if not (8 <= n_bars <= 160):
        raise ValueError(f'{n_bars} mesures')
    # Notes hors guitare (sous le Mi grave) ramenées d'une octave.
    pos = 0
    bars_tex = []
    i = 0
    hard = 0
    for b in range(n_bars):
        b0, b1 = b * bar_len, (b + 1) * bar_len
        toks = []
        t = b0
        while t < b1:
            nxt_on = next((o for o in onsets[i:] if o > t), None)
            seg_end = min(b1, nxt_on if nxt_on is not None else b1)
            durs = tex_dur(seg_end - t)
            if i < len(onsets) and onsets[i] == t:
                chord = sorted({m + 12 if m < 40 else m for m in by[t]}, reverse=True)[:6]
                combo, pos = assign(chord, pos)
                while combo is None and len(chord) > 1:
                    chord = chord[:-2] + chord[-1:] if len(chord) > 2 else chord[:1]  # on garde basse et mélodie
                    combo, pos = assign(chord, pos)
                if combo is None:
                    raise ValueError('accord injouable')
                hard += max([f for _, f in combo] + [0]) > 7
                notes = ' '.join(f'{f}.{s}' for s, f in combo)
                dot = lambda d: d.rstrip('.') + ('{d}' if d.endswith('.') else '')  # noqa: E731
                toks.append(f'({notes}).{dot(durs[0])}')
                # Reste de la durée : notes liées (même cordes).
                ties = ' '.join(f'-.{s}' for s, _ in combo)
                toks += [f'({ties}).{dot(d)}' for d in durs[1:]]
                i += 1
            else:
                toks += [f'r.{d.rstrip(".")}' + ('{d}' if d.endswith('.') else '') for d in durs]
            t = seg_end
        bars_tex.append(' '.join(toks))
    mel = import_pd.convert({**spec, 'melody': 'auto'})
    density = len(onsets) / max(1, n_bars)
    level = 2 if density < 4 and hard < 3 else 3 if density < 7 and hard < 15 else 4 if density < 11 else 5
    mm = score.recurse().getElementsByClass(import_pd.m21.tempo.MetronomeMark).first()
    tempo = mel['tempo']
    tex = '\n'.join([
        f'\\title "{spec["title"]}"',
        f'\\artist "{spec["composer"]}"',
        f'\\tempo {tempo}',
        f'\\ts ({num} {den})',
        '\\track "Guitare"',
        '\\staff {score tabs}',
        '\\instrument acousticguitarnylon',
        '\\tuning (E4 B3 G3 D3 A2 E2)',
        ' |\n'.join(bars_tex),
    ])
    return {
        'id': spec['id'], 'title': spec['title'], 'composer': spec['composer'], 'style': 'Classique',
        'level': level, 'tempo': tempo, 'timeSignature': [num, den], 'notation': mel['notation'],
        'tex': tex, 'source': {'url': spec['source'], 'license': spec['license']}, 'origin': 'Guitar',
        'instruments': ['guitar'], 'backing': False,
    }


def work(spec):
    try:
        return build(spec), None
    except Exception as e:  # noqa: BLE001
        return None, f"{spec['title']}: {e}"


def main(cache):
    rows = bpl.fetch_catalog('Guitar', cache)
    specs = []
    for r in rows:
        c = r['cells']
        if not c or not r['mid']:
            continue
        lic = bpl.license_of(c)
        for_ = next((x for x in c if x.startswith('for ')), '')
        if not lic or for_.strip() != 'for Guitar':
            continue
        by = next((x for x in c if x.startswith('by ')), '')
        composer = bpl.re.sub(r'\s*\(.*?\)\s*$', '', by[3:]).strip() or 'Anonyme'
        specs.append({'id': 'gt-' + bpl.slug(c[0] + '-' + composer), 'title': c[0], 'composer': composer, 'midi': r['mid'],
                      'license': lic, 'source': r['info'] or r['mid']})
    print(len(specs), 'pièces pour guitare seule')
    out, errs = [], []
    with ProcessPoolExecutor(4) as ex:
        for f in as_completed([ex.submit(work, s) for s in specs]):
            song, err = f.result()
            (out.append(song) if song else errs.append(err))
    out.sort(key=lambda s: (s['level'], s['title']))
    seen = set()
    out = [s for s in out if not (s['id'] in seen or seen.add(s['id']))]
    json.dump(out, open(os.path.join(ROOT, 'src/songs/pd-guitar.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'gardées ;', len(errs), 'écartées')
    with open(os.path.join(ROOT, 'docs/credits-mutopia.md'), 'a') as f:
        f.write('\n## Guitare classique (scripts/build_guitar.py) — toutes les notes\n\n| Titre | Compositeur | Licence | Source |\n|---|---|---|---|\n')
        for s in out:
            f.write(f"| {s['title']} | {s['composer']} | {s['source']['license']} | {s['source']['url']} |\n")


if __name__ == '__main__':
    main(sys.argv[1])
