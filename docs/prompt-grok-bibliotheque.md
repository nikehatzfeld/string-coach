# Prompt pour Grok : bibliothèque de morceaux pour String Coach

Copie tout le bloc ci-dessous dans Grok. Demande une catégorie à la fois (ex. « Lot 1 : violon débutant »),
puis colle sa réponse JSON dans l'app : accueil › **📥 Importer**.

---

```
Tu es un musicien-pédagogue et un documentaliste musical. Je construis une bibliothèque pour mon application d'apprentissage (violon, guitare, flûte à bec soprano, voix). Ta réponse doit être UNIQUEMENT un bloc JSON valide au format ci-dessous, sans texte avant ni après, pour que je le charge directement dans l'application.

## Format de sortie (obligatoire)
{
  "format": "string-coach-library",
  "version": 1,
  "songs": [
    {
      "title": "…",
      "artist": "…",
      "year": 1994,
      "instruments": ["violin" | "guitar" | "recorder" | "voice"],
      "style": "Classique" | "Cinéma & TV" | "Années 80" | "Années 90" | "Pop & rock" | "Variété française" | "Rap US" | "Rap français" | "Folk & monde" | "Chanson française" | "Comptines" | "Noël" | "Blues" | "Gospel & jazz",
      "level": 1 à 5 (1 débutant, 2 élémentaire, 3 intermédiaire, 4 avancé, 5 virtuose),
      "tempo": BPM de la noire,
      "timeSignature": [4, 4],
      "key": "G" (armure : C, G, D, A, E, F, Bb, Eb, aminor, eminor, dminor…),
      "notation": "…" (mélodie, règles plus bas),
      "lyrics": "…" (une syllabe par note, règles plus bas),
      "chords": "G | D | Em C | C" (une mesure entre deux |),
      "source": { "url": "lien vers la source", "license": "Domaine public | CC BY | CC BY-SA | Protégé" }
    }
  ]
}

## Règles de la mélodie ("notation")
- Note = nom anglo-saxon + octave + ":" + durée. Exemples : C4:4 (do du milieu, noire), F#4:8 (fa dièse croche), Bb3:2 (si bémol blanche). C4 = do du milieu du piano, A4 = la 440 Hz.
- Durées : 1 ronde, 2 blanche, 4 noire, 8 croche, 16 double croche ; point APRÈS la durée pour pointer (C4:4.).
- Silence : r:4. Prolongation liée de la note précédente : -:4.
- Accord d'accompagnement collé à une note ou un silence : G4:4@Em.
- Mesures séparées par " | ". CHAQUE mesure doit totaliser exactement la durée de la mesure (4 noires en 4/4, 3 en 3/4, 6 croches en 6/8), sauf la première (levée) et la dernière. Vérifie chaque mesure avant de répondre.
- Tessitures : violon G3–E6, flûte à bec soprano écrite C4–D6, voix A3–E5, guitare E2–B5.

## Règles des paroles ("lyrics")
- Exactement une syllabe par note jouée (pas pour les silences ni les "-").
- Syllabes séparées par des espaces ; tiret collé à la syllabe quand le mot continue : "Frè- re Ja- cques, dor- mez- vous ?".

## Droits d'auteur (impératif)
- Œuvres du domaine public ou sous licence libre (CC BY, CC BY-SA) : donne la mélodie complète ("notation"), les paroles complètes ("lyrics") et les accords.
- Œuvres protégées (chansons des années 80, 90, rap, pop récente, musiques de films récentes) : NE donne PAS les paroles ni la mélodie note à note. Donne seulement : titre, artiste, année, style, niveau, tempo, mesure, tonalité, la grille d'accords complète par mesure dans "chords" (couplet puis refrain), et dans "source.url" le lien vers une source officielle ou sous licence (site de l'artiste, éditeur, partition vendue, page de paroles sous licence). Mets "license": "Protégé".
- N'invente rien : si tu n'es pas sûr d'une note, d'un accord ou d'une année, ne mets pas le morceau.

## Ce que je veux (par lots, 25 à 40 morceaux par réponse)
1. Violon : morceaux variés et connus, du niveau 1 au niveau 5 (folk, classique, musiques de films libres, airs populaires), en équilibrant les niveaux.
2. Guitare : morceaux du niveau 1 au niveau 5 ; mélodies jouables à la guitare et chansons avec grilles d'accords.
3. Flûte à bec soprano : du débutant (3 à 5 notes) à l'avancé, en restant dans la tessiture C4–D6.
4. Voix : chansons à chanter, en priorité celles qui ont des paroles libres de droits (traditionnels, comptines, chants populaires, chants de Noël).
5. Années 80 et années 90 (pop, rock, variété française) : les plus connues, grilles d'accords.
6. Rap US classique (années 80–2000) et rap français classique (années 90–2000) : grilles d'accords ou boucles harmoniques, tempo, structure.
7. Rap et pop des 5 à 10 dernières années (US et français) : mêmes informations.

Commence par le lot que je te donne. Réponds seulement avec le JSON.
```

---

## Conseils
- Fais un lot par message (« Lot 1 », « Lot 2 »…) : les réponses courtes sont plus justes.
- Si l'app refuse un morceau (mesure incomplète, accord inconnu), elle te dit lequel et pourquoi : renvoie le message d'erreur à Grok pour qu'il corrige.
- Pour les chansons protégées, tu peux ajouter toi-même les paroles dans le fichier avant l'import, pour ton usage personnel : elles resteront sur ton appareil.
