# Format d'import « string-coach-library » (version 1)

Un fichier JSON que l'app charge avec **📥 Importer** (accueil). Les morceaux sont vérifiés,
puis gardés sur l'appareil, rangés dans leur style.

```json
{
  "format": "string-coach-library",
  "version": 1,
  "songs": [
    {
      "title": "Frère Jacques",
      "artist": "Traditionnel",
      "year": 1780,
      "instruments": ["voice", "violin", "recorder", "guitar"],
      "style": "Comptines",
      "level": 1,
      "tempo": 100,
      "timeSignature": [4, 4],
      "key": "D",
      "notation": "D4:4@D E4:4 F#4:4 D4:4 | D4:4 E4:4 F#4:4 D4:4",
      "lyrics": "Frè- re Ja- cques, Frè- re Ja- cques",
      "chords": "D | D",
      "source": { "url": "https://…", "license": "Domaine public" }
    }
  ]
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `title` | oui | texte |
| `artist`, `year` | non | texte, nombre |
| `instruments` | non | `violin`, `guitar`, `recorder` (flûte à bec), `voice` |
| `style` | non | `Comptines`, `Chanson française`, `Classique`, `Cinéma & TV`, `Années 80`, `Années 90`, `Pop & rock`, `Variété française`, `Rap US`, `Rap français`, `R&B & soul`, `Reggae`, `Électro & dance`, `Comédies musicales`, `Noël`, `Folk & monde`, `Chants & cantiques`, `Gospel & jazz`, `Blues`, `Fêtes`, `Gammes & arpèges`, `Exercices` (sinon « Mes morceaux ») |
| `level` | non | 1 Débutant · 2 Élémentaire · 3 Intermédiaire · 4 Avancé · 5 Virtuose |
| `tempo` | non | BPM de la noire (30–240) |
| `timeSignature` | non | `[4,4]`, `[3,4]`, `[6,8]`, `[2,4]`… |
| `key` | non | armure alphaTex : `C`, `G`, `D`, `F`, `Bb`, `eminor`… |
| `notation` | `notation` ou `chords` | mélodie (voir ci-dessous) |
| `lyrics` | non | une syllabe par note de la mélodie |
| `chords` | `notation` ou `chords` | grille d'accords par mesure |
| `source` | non | lien et licence |

## Mélodie (`notation`)

- Une note : `Nom` + `Octave` + `:` + `Durée`. Exemples : `C4:4` (do du milieu, noire), `F#4:8` (fa♯ croche), `Bb3:2` (si♭ blanche).
- Octaves : `C4` = do du milieu du piano ; `A4` = la 440 Hz.
- Durées : `1` ronde, `2` blanche, `4` noire, `8` croche, `16` double croche ; point après la durée pour une note pointée (`4.`).
- Silence : `r:4`. Note liée à la précédente (prolongée) : `-:4`.
- Accord (accompagnement) collé à une note ou un silence : `G4:4@Em`.
- Mesures séparées par `|`. **Chaque mesure doit faire la durée de la mesure** (sauf la première, si levée, et la dernière).

## Paroles (`lyrics`)

- Une syllabe par note jouée (pas par silence ni par note liée `-`).
- Syllabes séparées par des espaces ; un tiret **collé** à la syllabe indique que le mot continue : `Frè- re Ja- cques`.
- La ponctuation est permise (`cques,`), un signe isolé (`?`) est ignoré.

## Accords (`chords`)

- Mesures séparées par `|`, accords séparés par des espaces dans une mesure : `G | D | Em C | C`.
- Noms anglo-saxons : `C D E F G A B`, `#` ou `b`, puis `m`, `7`, `m7`, `maj7`, `sus2`, `sus4`, `add9`, `dim`, `5`, basse `/` (`G/B`).
- `.` ou `%` = l'accord précédent continue.
- Sans `notation`, la grille seule donne un accompagnement et une fiche d'accords pour la guitare.
