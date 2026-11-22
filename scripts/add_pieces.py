#!/usr/bin/env python3
"""
Ajoute des œuvres choisies (plusieurs mouvements, partie soliste) à src/songs/pd-library.json.

    venv/bin/python scripts/add_pieces.py

Idempotent : remplace les morceaux de même id. Sources Mutopia (licences dans docs/credits-mutopia.md).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import import_pd  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = 'https://www.mutopiaproject.org/ftp/VivaldiA/O8/{0}/{0}-mids.zip'
INFO = {'spring': 301, 'summer': 336, 'autumn': 350, 'winter': 351}
FR = {'spring': ('1', 'Le Printemps'), 'summer': ('2', "L'Été"), 'autumn': ('3', "L'Automne"), 'winter': ('4', "L'Hiver")}
# (saison, n° de fichier dans le zip trié : score-1 = II, score-2 = III, score = I, mouvement, levée en noires, tempo)
MOVEMENTS = [
    ('spring', 2, 'I. Allegro', 0.5, 100), ('spring', 0, 'II. Largo', 0, 50), ('spring', 1, 'III. Danza pastorale (Allegro)', 0, 60),
    ('summer', 2, 'I. Allegro non molto', 0, 100), ('summer', 0, 'II. Adagio – Presto', 0, 54), ('summer', 1, 'III. Presto', 0, 150),
    ('autumn', 2, 'I. Allegro', 0, 100), ('autumn', 0, 'II. Adagio molto', 0, 46), ('autumn', 1, 'III. Allegro (La caccia)', 0, 100),
    ('winter', 2, 'I. Allegro non molto', 0, 96), ('winter', 0, 'II. Largo', 0, 60), ('winter', 1, 'III. Allegro', 0, 100),
]

# Niveau fixé à la main : la mesure automatique sous-estime les passages rapides des concertos.
LEVEL = {'spring-i': 4, 'spring-ii': 3, 'spring-iii': 4, 'summer-i': 5, 'summer-ii': 4, 'summer-iii': 5,
         'autumn-i': 4, 'autumn-ii': 3, 'autumn-iii': 4, 'winter-i': 5, 'winter-ii': 3, 'winter-iii': 5}


def specs():
    for season, member, mvt, pickup, tempo in MOVEMENTS:
        num = mvt.split('.')[0]
        n, name = FR[season]
        yield {
            'id': f'vivaldi-{season}-{num.lower()}',
            'title': f'Les Quatre Saisons n° {n} · {name} – {mvt}',
            'composer': 'A. Vivaldi',
            'style': 'Classique',
            'midi': M.format(season),
            'member': member,
            'melody': 'solo',
            'pickup': pickup,
            'tempo': tempo,
            'license': 'CC BY-SA 3.0',
            'source': f'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id={INFO[season]}',
        }


def main():
    path = os.path.join(ROOT, 'src/songs/pd-library.json')
    lib = json.load(open(path))
    new = []
    for spec in specs():
        song = import_pd.convert(spec)
        song.pop('autoLevel', None)
        song['level'] = LEVEL[song['id'].removeprefix('vivaldi-')]
        for k in ('metrics', 'bars', 'inst'):
            song.pop(k, None)
        song['origin'] = 'Violin'
        new.append(song)
        print(f"OK {song['id']}: {song['notation'].count('|') + 1} mesures, niveau {song['level']}")
    ids = {s['id'] for s in new}
    lib = [s for s in lib if s['id'] not in ids and not s['id'].startswith('vivaldi-')] + new
    json.dump(lib, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
