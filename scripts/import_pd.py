#!/usr/bin/env python3
"""
Convertit un fichier MIDI du domaine public (ex. Mutopia Project) en morceau pour String Coach.

    venv/bin/python scripts/import_pd.py pieces.json src/songs/pd-library.json

pieces.json : liste d'objets
  { "id", "title", "composer", "style", "level", "midi" (URL ou chemin), "license", "source",
    "melody": index ou nom (partiel) de la piste mélodie, "maxBars": optionnel, "transpose": optionnel }

Étapes : mélodie = note la plus haute à chaque attaque (piste choisie), quantifiée à la double croche ;
levée détectée par analyse métrique ; accords déduits des autres pistes (ou de la mélodie) par mesure ou
demi-mesure ; sortie au format de notation compacte de l'app (voir src/songs/notation.ts).
Nécessite music21 (pip install music21).
"""
import json
import math
import sys
import tempfile
import urllib.request
from fractions import Fraction

import music21 as m21

NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
Q = Fraction(1, 4)  # grille : double croche (en noires)


def load(src, member=0):
    """Partition music21 depuis un fichier MIDI (URL ou chemin) ; pour un zip, le n-ième fichier .mid."""
    data = urllib.request.urlopen(src, timeout=120).read() if src.startswith('http') else open(src, 'rb').read()
    if src.endswith('.zip'):
        import io
        import zipfile
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            mids = sorted(n for n in z.namelist() if n.lower().endswith('.mid'))
            data = z.read(mids[member])
    f = tempfile.NamedTemporaryFile(suffix='.mid', delete=False)
    f.write(data)
    f.close()
    return m21.converter.parse(f.name, quantizePost=False)


def lily_pickup(midi_url, override=None):
    """Durée de la levée (en noires) lue dans la source LilyPond de Mutopia (\\partial), ou None."""
    if override is not None:
        return Fraction(override)
    if not midi_url.startswith('http'):
        return None
    import io
    import re
    import zipfile
    base = midi_url.rsplit('.', 1)[0].replace('-mids', '')
    texts = []
    for url in (base + '.ly', base + '-lys.zip'):
        try:
            data = urllib.request.urlopen(url, timeout=60).read()
        except Exception:  # noqa: BLE001
            continue
        if url.endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                texts += [z.read(n).decode('utf-8', 'replace') for n in z.namelist() if n.endswith(('.ly', '.ily'))]
        else:
            texts.append(data.decode('utf-8', 'replace'))
        break
    for t in texts:
        m = re.search(r'\\partial\s+(\d+)(\.?)(?:\s*\*\s*(\d+))?', t)
        if m:
            d = Fraction(4, int(m.group(1)))
            if m.group(2):
                d *= Fraction(3, 2)
            if m.group(3):
                d *= int(m.group(3))
            return d
    return Fraction(0) if texts else None


def q(x):
    """Arrondi à la grille de double croche."""
    return Fraction(round(Fraction(x) / Q)) * Q


def part_events(part):
    """(début, durée, [hauteurs]) quantifiés pour toutes les notes d'une piste."""
    ev = []
    for n in part.recurse().notes:
        start = q(n.getOffsetInHierarchy(part))
        dur = max(Q, q(n.quarterLength))
        pitches = [p.midi for p in n.pitches]
        ev.append((start, dur, pitches))
    return ev


def skyline(events):
    """Mélodie monophonique : note la plus haute à chaque attaque, durée jusqu'à l'attaque suivante."""
    by_start = {}
    for s, d, ps in events:
        top = max(ps)
        if s not in by_start or top > by_start[s][1]:
            by_start[s] = (d, top)
    starts = sorted(by_start)
    out = []
    for i, s in enumerate(starts):
        d, p = by_start[s]
        if i + 1 < len(starts):
            d = min(d, starts[i + 1] - s)
        out.append((s, d, p))
    return out


def best_pickup(melody, bar_len, beat):
    """Décalage (silence à ajouter au début) qui place le mieux les notes sur les temps forts."""
    best, best_score = Fraction(0), -1
    for k in range(int(bar_len / Q)):
        shift = k * Q
        score = 0.0
        for s, d, _ in melody:
            pos = (s + shift) % bar_len
            w = 4 if pos == 0 else 2 if pos == bar_len / 2 and bar_len % 2 == 0 else 1 if pos % beat == 0 else 0
            score += w * float(d)
        # Préférer aucun décalage à score quasi égal.
        if score > best_score * 1.02 or (k == 0 and score >= best_score):
            best, best_score = shift, score
    return best


DUR = [(Fraction(4), '1'), (Fraction(3), '2.'), (Fraction(2), '2'), (Fraction(3, 2), '4.'), (Fraction(1), '4'),
       (Fraction(3, 4), '8.'), (Fraction(1, 2), '8'), (Fraction(1, 4), '16')]


def split(d):
    out = []
    while d > 0:
        for v, name in DUR:
            if v <= d:
                out.append(name)
                d -= v
                break
        else:
            break
    return out


def pitch_name(midi, flat):
    names = NAMES_FLAT if flat else NAMES_SHARP
    return f'{names[midi % 12]}{midi // 12 - 1}'


TEMPLATES = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'dim': [0, 3, 6]}


def chord_for(weights):
    """Accord (nom) le plus compatible avec un histogramme de classes de hauteur pondéré."""
    if sum(weights) == 0:
        return None
    best, best_score = None, -1
    for root in range(12):
        for qual, tpl in TEMPLATES.items():
            inside = sum(weights[(root + i) % 12] for i in tpl)
            outside = sum(weights) - inside
            score = inside - 0.6 * outside + 0.3 * weights[root] - (0.15 * sum(weights) if qual in ('7', 'dim') else 0)
            if score > best_score:
                best, best_score = NAMES[root] + qual, score
    return best


MELODY_NAMES = ('violin', 'violino', 'flute', 'flauto', 'recorder', 'soprano', 'voice', 'voce', 'melody', 'canto', 'oboe')


def auto_melody(parts):
    """Piste mélodique : nom évocateur, sinon la plus aiguë et la plus monophonique."""
    best, best_score = 0, -1e9
    for i, p in enumerate(parts):
        notes = list(p.recurse().notes)
        if len(notes) < 8:
            continue
        name = (p.partName or '').lower()
        mean = sum(max(x.pitches).midi for x in notes) / len(notes)
        chords = sum(1 for x in notes if len(x.pitches) > 1) / len(notes)
        onsets = {}
        for x in notes:
            onsets[x.offset] = onsets.get(x.offset, 0) + 1
        poly = sum(1 for v in onsets.values() if v > 1) / max(1, len(onsets))
        score = mean - 40 * chords - 30 * poly + (25 if any(k in name for k in MELODY_NAMES) else 0) - (20 if 'piano' in name or 'bass' in name else 0)
        if score > best_score:
            best, best_score = i, score
    return best


def metrics(melody, bar_len, tempo, n_bars):
    """Indicateurs de difficulté pour le violon."""
    notes = [p for _, _, p in melody]
    if not notes:
        return {}
    seconds = float(n_bars * bar_len) * 60 / max(30, tempo)
    nps = len(notes) / max(1, seconds)
    sixteenths = sum(1 for _, d, _ in melody if d <= Fraction(1, 4)) / len(notes)
    leaps = sum(1 for a, b in zip(notes, notes[1:]) if abs(a - b) > 9) / max(1, len(notes) - 1)
    return {'nps': round(nps, 2), 'low': min(notes), 'high': max(notes), 'span': max(notes) - min(notes),
            'sixteenths': round(sixteenths, 2), 'leaps': round(leaps, 3), 'notes': len(notes)}


def level_for(m, transpose_to_violin):
    """1 débutant, 2 intermédiaire, 3 avancé-intermédiaire, 4 trop difficile."""
    high = m['high'] + transpose_to_violin
    if m['nps'] <= 2.2 and m['span'] <= 15 and high <= 83 and m['sixteenths'] <= 0.1 and m['leaps'] <= 0.02:
        return 1
    if m['nps'] <= 4 and m['span'] <= 22 and high <= 88 and m['sixteenths'] <= 0.35 and m['leaps'] <= 0.06:
        return 2
    if m['nps'] <= 6 and m['span'] <= 29 and high <= 93 and m['leaps'] <= 0.12:
        return 3
    return 4


def violin_shift(low, high):
    """Octave qui met la mélodie dans la tessiture du violon (Sol3 et plus), sans monter inutilement."""
    for t in (0, 12, 24, -12, -24):
        if low + t >= 55 and high + t <= 95:
            return t
    return 0


def convert(spec):
    score = load(spec['midi'], spec.get('member', 0))
    parts = list(score.parts)
    names = [(p.partName or '') for p in parts]
    mel = spec.get('melody', 'auto')
    if mel == 'auto':
        idx = auto_melody(parts)
    elif isinstance(mel, str):
        idx = next(i for i, n in enumerate(names) if mel.lower() in n.lower())
    else:
        idx = mel
    ts = score.recurse().getElementsByClass(m21.meter.TimeSignature).first()
    num, den = (ts.numerator, ts.denominator) if ts else (4, 4)
    bar_len = Fraction(num * 4, den)
    beat = Fraction(3, 2) if den == 8 and num % 3 == 0 else Fraction(4, den)
    mm = score.recurse().getElementsByClass(m21.tempo.MetronomeMark).first()
    tempo = round(mm.getQuarterBPM()) if mm and mm.getQuarterBPM() else 0
    if not tempo or tempo == 60:  # 60 = tempo par défaut de LilyPond : souvent non renseigné
        tempo = {2: 100, 3: 100, 4: 96, 6: 72, 9: 66, 12: 60}.get(num, 96) if den != 2 else 80
    ks = score.recurse().getElementsByClass(m21.key.KeySignature).first()
    sharps = ks.sharps if ks else 0
    flat = sharps < 0
    transpose = spec.get('transpose', 0)

    melody = skyline(part_events(parts[idx]))
    melody = [(s, d, p + transpose) for s, d, p in melody]
    pickup = lily_pickup(spec['midi'], spec.get('pickup'))
    shift = (bar_len - pickup) % bar_len if pickup is not None else best_pickup(melody, bar_len, beat)
    melody = [(s + shift, d, p) for s, d, p in melody]
    end = max(s + d for s, d, _ in melody)
    n_bars = math.ceil(end / bar_len)
    if spec.get('maxBars'):
        n_bars = min(n_bars, spec['maxBars'])

    # Accords : par demi-mesure en 4/4 et 2/2, sinon par mesure.
    others = [e for i, p in enumerate(parts) if i != idx for e in part_events(p)] or [(s, d, [p]) for s, d, p in melody]
    others = [(s + shift, d, ps) for s, d, ps in others]
    win = bar_len / 2 if num in (4, 2) and den in (4, 2) else bar_len
    chords = {}
    t = Fraction(0)
    while t < n_bars * bar_len:
        w = [0.0] * 12
        for s, d, ps in others:
            overlap = min(s + d, t + win) - max(s, t)
            if overlap > 0:
                low = min(ps)
                for p in ps:
                    w[p % 12] += float(overlap) * (2.0 if p == low else 1.0)
        chords[t] = chord_for(w)
        t += win

    # Notation : mesure par mesure, silences et liaisons au besoin.
    bars = []
    last_chord = None
    cursor = Fraction(0)
    notes = [x for x in melody if x[0] < n_bars * bar_len]
    i = 0
    for b in range(n_bars):
        b0, b1 = b * bar_len, (b + 1) * bar_len
        toks = []
        cursor = b0
        while cursor < b1:
            chord = chords.get(cursor) if cursor in chords else None
            label = ''
            if chord and chord != last_chord:
                label = '@' + chord
                last_chord = chord
            if i < len(notes) and notes[i][0] <= cursor:
                s, d, p = notes[i]
                d = min(s + d, b1) - cursor
                # Coupe aux changements d'accord (demi-mesure) pour garder l'accord sur la bonne note.
                nxt_chord = min([c for c in chords if cursor < c < cursor + d] or [cursor + d])
                d = nxt_chord - cursor
                parts_d = split(d)
                first = cursor == s
                for k, pd in enumerate(parts_d):
                    tok = (pitch_name(p, flat) if first and k == 0 else '-') + ':' + pd.replace('.', '') + ('.' if pd.endswith('.') else '')
                    toks.append(tok + (label if k == 0 else ''))
                cursor += d
                if cursor >= s + notes[i][1] or cursor >= b1 and s + notes[i][1] <= b1:
                    i += 1
                elif cursor >= b1:
                    pass  # la note continue dans la mesure suivante (liaison)
            else:
                nxt = notes[i][0] if i < len(notes) else b1
                nxt_chord = min([c for c in chords if cursor < c] or [b1])
                d = min(nxt, b1, nxt_chord) - cursor
                for k, pd in enumerate(split(d)):
                    toks.append('r:' + pd.replace('.', '') + ('.' if pd.endswith('.') else '') + (label if k == 0 else ''))
                cursor += d
            # Une note commencée avant cette mesure et qui continue : liaison.
            if i < len(notes) and notes[i][0] < cursor and notes[i][0] + notes[i][1] > cursor and cursor < b1:
                pass
        bars.append(' '.join(toks))
    # Notes qui débordent la mesure : la boucle ci-dessus coupe à la barre ; reprise en liaison.
    notation = ' | '.join(bars)

    key = None
    if ks:
        k = ks.asKey('major') if ks else None
        key = k.tonic.name.replace('-', 'b') if k else None
    return {
        'id': spec['id'], 'title': spec['title'], 'composer': spec['composer'], 'style': spec.get('style', 'Classique'),
        'level': spec.get('level', 2), 'tempo': spec.get('tempo', tempo), 'timeSignature': [num, den],
        **({'key': key} if key and spec.get('keySignature', True) else {}),
        'notation': notation,
        'source': {'url': spec.get('source', spec['midi']), 'license': spec.get('license', '')},
        'bars': n_bars,
        'metrics': (mt := metrics(notes, bar_len, spec.get('tempo', tempo), n_bars)),
        'autoLevel': level_for(mt, violin_shift(mt['low'], mt['high'])) if mt else 4,
    }


def main(spec_path, out_path):
    specs = json.load(open(spec_path))
    out = []
    for s in specs:
        try:
            song = convert(s)
            out.append(song)
            print(f"OK  {s['id']}: {song['bars']} mesures, {song['timeSignature'][0]}/{song['timeSignature'][1]}, {song['tempo']} bpm")
        except Exception as e:  # noqa: BLE001
            print(f"ERR {s['id']}: {e}")
    json.dump(out, open(out_path, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
