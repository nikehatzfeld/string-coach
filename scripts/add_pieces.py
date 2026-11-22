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


# Musiques du domaine public rendues célèbres par le cinéma, la télévision ou la publicité (mélodie principale).
FILMS = [
    ('film-gymnopedie-1', 'Gymnopédie n° 1 (films, publicités)', 'E. Satie', 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.mid', 'Domaine public', 0),
    ('film-clair-de-lune', 'Clair de lune (Ocean’s Eleven, Twilight)', 'C. Debussy', 'https://www.mutopiaproject.org/ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/debussy_Ste_Bergamesq_Clair.mid', 'Domaine public', 0),
    ('film-toccata', 'Toccata et fugue en ré mineur (films d’horreur)', 'J. S. Bach', 'https://www.mutopiaproject.org/ftp/BachJS/BWV565/ToccataFugue/ToccataFugue.mid', 'Domaine public', 0),
    ('film-moonlight', 'Sonate « Au clair de lune », 1er mouvement', 'L. van Beethoven', 'https://www.mutopiaproject.org/ftp/BeethovenLv/O27/moonlight/moonlight-mids.zip', 'CC BY', 0),
    ('film-nocturne-9-2', 'Nocturne op. 9 n° 2', 'F. Chopin', 'https://www.mutopiaproject.org/ftp/ChopinFF/O9/chopin_nocturne_op9_n2/chopin_nocturne_op9_n2.mid', 'CC BY', 0),
    ('film-marche-nuptiale', 'Marche nuptiale (mariages)', 'F. Mendelssohn', 'https://www.mutopiaproject.org/ftp/Mendelssohn-BartholdyF/O61/Sommernachtstraum-wedding-march/Sommernachtstraum-wedding-march.mid', 'CC BY', 0),
    ('film-beau-danube', 'Le Beau Danube bleu (2001 : l’Odyssée de l’espace)', 'J. Strauss fils', 'https://www.mutopiaproject.org/ftp/StraussJJ/O314/blue_danube/blue_danube.mid', 'CC BY', 0),
    ('film-roi-montagne', 'Dans l’antre du roi de la montagne (complet)', 'E. Grieg', 'https://www.mutopiaproject.org/ftp/GriegE/O46/Dans_l_antre_du_roi_de_la_montagne/Dans_l_antre_du_roi_de_la_montagne.mid', 'Domaine public', 0),
    ('film-carmen-prelude', 'Carmen : Prélude', 'G. Bizet', 'https://www.mutopiaproject.org/ftp/BizetG/prelude/prelude.mid', 'CC BY', 0),
    ('film-valse-minute', 'Valse « minute » op. 64 n° 1', 'F. Chopin', 'https://www.mutopiaproject.org/ftp/ChopinFF/O64/chopin_valse_op64_no1/chopin_valse_op64_no1.mid', 'Domaine public', 0),
    ('film-maple-leaf', 'Maple Leaf Rag', 'S. Joplin', 'https://www.mutopiaproject.org/ftp/JoplinS/maple/maple.mid', 'Domaine public', 0),
    ('film-brindisi', 'La Traviata : Brindisi (Pretty Woman)', 'G. Verdi', 'https://www.mutopiaproject.org/ftp/VerdiG/Traviata_02/Traviata_02.mid', 'Domaine public', 0),
    ('film-anitra', 'Peer Gynt : La danse d’Anitra', 'E. Grieg', 'https://www.mutopiaproject.org/ftp/GriegE/O46/03-anitrasdance/03-anitrasdance-mids.zip', 'Domaine public', 0),
    ('film-aase', 'Peer Gynt : La mort d’Aase', 'E. Grieg', 'https://www.mutopiaproject.org/ftp/GriegE/O46/02-lamortdase-strings/02-lamortdase-strings-mids.zip', 'Domaine public', 0),
]


def films(lib):
    out = []
    for fid, title, comp, mid, lic, member in FILMS:
        try:
            song = import_pd.convert({'id': fid, 'title': title, 'composer': comp, 'style': 'Cinéma & TV', 'midi': mid, 'member': member,
                                      'melody': 'auto', 'license': lic, 'source': mid})
        except Exception as e:  # noqa: BLE001
            print('ERR', fid, e)
            continue
        song['level'] = max(2, min(5, song.pop('autoLevel', 3)))
        for k in ('metrics', 'bars', 'inst'):
            song.pop(k, None)
        song['origin'] = 'Piano'
        song['instruments'] = ['violin', 'recorder', 'guitar']
        out.append(song)
        print(f"OK {fid}: {song['notation'].count('|') + 1} mesures, niveau {song['level']}")
    return out


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
    new += films(lib)
    ids = {s['id'] for s in new}
    lib = [s for s in lib if s['id'] not in ids and not s['id'].startswith(('vivaldi-', 'film-'))] + new
    json.dump(lib, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
