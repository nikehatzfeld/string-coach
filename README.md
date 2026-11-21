# String Coach

Application d'accompagnement pour **violon** et **guitare** : partition et tablature qui défilent pendant la lecture, mode **pas à pas** qui écoute ton instrument au micro, bibliothèque de morceaux par style et import de tes propres fichiers.

Une seule base de code web qui tourne dans le navigateur (desktop, mobile, TV) et s'installe comme une app (PWA). Les versions empaquetées (Tauri pour desktop, Capacitor pour mobile et Android TV) sont prévues dans la roadmap.

Projet perso, partie logicielle du projet « manche violon DIY à LEDs » ([doc de vision](https://claude.ai/artifact/JU7wcqTQpiYraxATrnN6y9)).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173 (aussi accessible depuis le mobile sur le même Wi-Fi)
npm test           # tests (notation, doigtés, chaque morceau de la bibliothèque, mode pas à pas)
npm run build      # vérification TypeScript + build de production dans dist/
```

Le micro nécessite HTTPS ou `localhost`. Pour tester sur mobile : `npm run build && npx vite preview --host`, puis utiliser un tunnel HTTPS, ou déployer `dist/` sur un hébergement statique.

## Fonctions

| Fonction | Détail |
| --- | --- |
| Mode jeu | Notes qui défilent par corde vers une ligne de frappe, jugées au micro (Parfait / Bien / Raté), combo et multiplicateur, compensation de latence, guide audio |
| Progression | XP et niveaux, série de jours, objectif quotidien, 16 badges, défi du jour (+100 XP), score et 1 à 3 étoiles par morceau, écran de résultats |
| Coffre | Chansons protégées publiées chiffrées, accessibles avec ton mot de passe : voir [docs/coffre.md](docs/coffre.md) |
| Doigtés | Violon : vrais doigts (0 à 4) au-dessus des notes, changements de position marqués (« → 3e pos. »), calculés sur toute la mélodie pour limiter les déplacements. Guitare : position et doigt par case. Nom de chaque note (avec ♯ / ♭) sous la portée |
| Parties | Chaque morceau se travaille en entier ou par parties (nommées ou de 4 mesures), en écoute (boucle), pas à pas et jeu |
| Accompagnement | Play-along généré depuis les accords (guitare ou cordes, basse, batterie selon le style), activable par bouton |
| Tempo | Réglé en BPM (−/+ 5, curseur, retour au tempo d'origine), mémorisé par morceau |
| Lecture live | Son de synthèse (SoundFont SONiVOX), curseur synchronisé, tempo 25 à 150 %, boucle, métronome, décompte |
| Affichage | Partition + tablature, tablature seule ou partition seule, zoom, accords au-dessus de la portée |
| Pas à pas | La note suivante est indiquée (nom, corde, position) ; l'app n'avance que si la note jouée au micro est juste et tenue 80 ms (tolérance réglable ±10 à ±60 cents) |
| Manche | Schéma du violon ou de la guitare (bouton « Manche ») : note en cours avec le doigt conseillé, note suivante en pointillés ; positions calculées sur la vraie géométrie de la corde, comme les LEDs du manche DIY |
| Violon | Tablature en demi-tons par corde, repères type « rubans » de 1re position sur le manche |
| Bibliothèque | 98 morceaux du domaine public : 22 classiques, 10 chants de Noël, comptines, folk du monde, gospel, blues, et 38 gammes et arpèges générés automatiquement ; filtres par style et par niveau ; armures à la clé |
| Pop | [Liste de 106 chansons faciles](docs/pop-a-importer.md) (violon et guitare) avec où trouver les fichiers à importer |
| Import | Guitar Pro (.gp, .gp3-5, .gpx), MusicXML (.xml, .musicxml, .mxl), alphaTex ; stockés sur l'appareil (IndexedDB) |
| TV / télécommande | Navigation aux flèches, Entrée, Espace = lecture, Échap/Retour = bibliothèque, N/P = note suivante/précédente |

## Structure

```
src/
  main.ts                 démarrage et navigation
  ui/home.ts              accueil : progression, badges, défi, bibliothèque, coffre, imports
  ui/player.ts            lecteur : écoute, pas à pas noté, mode jeu
  ui/results.ts           écran de résultats, confettis, notifications
  game/                   progression (XP, badges, défi), score, arbitre et piste du mode jeu
  vault/                  coffre chiffré (Web Crypto) ; scripts/vault.ts pour la ligne de commande
  songs/notation.ts       notation compacte des morceaux (voir en-tête du fichier)
  songs/instruments.ts    accordages, choix corde/case, tessiture
  songs/alphatex.ts       conversion d'un morceau en alphaTex pour un instrument
  songs/library.ts        morceaux de la bibliothèque (+ library-more.ts)
  songs/exercises.ts      gammes, arpèges et exercices générés
  practice/pitch-detector.ts  micro → hauteur (pitchy, algorithme McLeod)
  practice/step-trainer.ts    logique du pas à pas (testée sans micro)
  ui/score-view.ts        enveloppe alphaTab (rendu + lecture)
  ui/fingerboard.ts       schéma du manche avec doigtés
  ui/spatial-nav.ts       navigation télécommande
  ui/imports-store.ts     stockage des fichiers importés
tests/                    vitest
```

## Ajouter un morceau

Dans `src/songs/library.ts`, en notation compacte : `F#4:8` (croche), `A4:4.` (noire pointée), `r:4` (silence), `-:4` (liaison), `D4@Am` (accord). Les tests vérifient automatiquement que chaque mesure a la bonne durée et que le morceau se charge pour les deux instruments.

Les mélodies de la bibliothèque sont transcrites de mémoire : à vérifier à l'oreille.

Le repo et le site étant publics, la bibliothèque intégrée ne contient que des œuvres du domaine public. La musique sous droits (pop, etc.) s'importe via « Mes fichiers » et reste sur l'appareil.

## Briques open source

- [alphaTab](https://alphatab.net) (MPL-2.0) : rendu partition/tablature, lecture, import Guitar Pro et MusicXML
- [pitchy](https://github.com/ianprime0509/pitchy) (MIT) : détection de hauteur
- Banque de sons extraite de MuseScore General (MIT, [licence](public/soundfont/string-coach-LICENSE.md)) avec `scripts/trim-soundfont.py` ; police Bravura (fournie avec alphaTab)
