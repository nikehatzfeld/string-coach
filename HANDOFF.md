# Reprise du projet

Fichier à lire en premier pour reprendre le travail depuis n'importe quel appareil (Claude Code sur PC, app mobile ou web).

## Où on en est (19/11/2026)

**v0.1 livrée et testée** (48 tests verts, build OK, vérifié dans Chromium desktop et mobile) :
- Bibliothèque par style, choix violon / guitare, recherche, import de fichiers
- Lecteur alphaTab : partition + tablature, son, curseur, tempo, boucle, métronome, décompte, zoom
- Mode pas à pas au micro avec accordeur visuel, boutons précédente / suivante, tolérance réglable
- Navigation télécommande, mise en page mobile, manifest PWA

## v0.2 (19/11/2026)

- 9 morceaux classiques ajoutés (22 au total, 78 tests verts)
- Schéma du manche (violon et guitare) : note en cours + doigt conseillé, note suivante ; vue compacte 1re position sur mobile ; bouton « Manche » pour l'afficher / le masquer

## v0.3 (20/11/2026)

- Bibliothèque à 98 morceaux (306 tests verts) : comptines, classique, Noël, folk du monde, gospel, gammes et arpèges générés
- Filtre par niveau, armures à la clé
- `docs/pop-a-importer.md` : 106 chansons pop/variété faciles (violon et guitare) avec liens de recherche ; à importer par l'utilisateur
- Objectif initial : 200 morceaux. Au-delà d'une centaine, les transcriptions de mémoire ne seraient plus fiables ; le complément vient de la liste pop à importer

## v0.4 (21/11/2026)

- Refonte visuelle : accueil avec niveau, série, objectif du jour, défi du jour, badges, « Reprendre »
- Gamification : XP/niveaux, 16 badges, défi du jour, score + étoiles, écran de résultats animé
- Mode jeu : piste à défilement synchronisée au lecteur, jugement au micro ; testé avec une mélodie injectée comme micro (25 parfaites / 26, 3 étoiles)
- Coffre chiffré pour les chansons protégées (docs/coffre.md) ; testé de bout en bout ; aucun coffre publié pour l'instant
- 318 tests verts
- Limite connue : progression stockée par appareil (pas encore synchronisée)

## v0.5 (21/11/2026)

- Doigtés réels au violon (plus de demi-tons trompeurs), positions marquées, noms des notes avec ♯/♭ sous la portée, dans le pas à pas, sur le manche et dans le mode jeu
- Positions calculées par programmation dynamique (src/songs/positions.ts) + octave choisie pour rester en 1re position (guitare : octave des méthodes)
- Tempo en BPM ; accompagnement play-along généré depuis les accords (src/songs/backing.ts), 54 morceaux
- Banque de sons MuseScore General réduite à 3,9 Mo (violon, guitares, basses, cordes, batterie ; piano retiré : 15 Mo à lui seul)
- Découpage en parties ; Lettre à Élise complétée (partie A entière)
- Limite : la plupart des pièces classiques restent des thèmes (au-delà, transcription de mémoire non fiable) ; versions complètes via imports / coffre
- 382 tests verts

## v0.6 (22/11/2026)

- 212 morceaux complets importés du Mutopia Project (domaine public, CC BY, CC BY-SA), mélodie extraite automatiquement : `scripts/build_pd_library.py` (catalogues violon, flûte, flûte à bec, voix populaire + pièces de piano célèbres), `scripts/import_pd.py` (MIDI → notation, levée lue dans la source LilyPond, accords déduits, niveau calculé)
- Cours : parcours 12 semaines violon et guitare (src/courses/plans.ts), séance du jour, d'après docs/pedagogie.md
- Mécaniques : tempo +4/−2 BPM, révisions espacées, section « À réviser aujourd'hui »
- Notes hors tessiture ramenées d'une octave
- 1 212 tests verts
- À faire : comptes Supabase (en attente de l'URL et de la clé anon), polyphonie guitare (études Carulli/Sor en accords)

## v0.7 (22/11/2026)

- Micro : seuils adaptés aux téléphones (bruit de fond mesuré, clarté 0,78), contexte audio créé pendant le clic et relancé au besoin, réglages de secours, tolérance aux erreurs d'octave, nouvelle attaque détectée par baisse de volume (changement d'archet)
- Indicateur micro (niveau + « j'entends … ») en pas à pas et en jeu
- Lecteur réorganisé : partition et manche prioritaires, réglages secondaires sous ⚙, pas à pas sur une ligne, manche avec note actuelle + 2 suivantes
- Mode jeu : audio débloqué pendant le clic « Jouer » (Safari / Android)
- Non vérifiable ici : comportement sur l'appareil réel de l'utilisateur

## v0.8 (22/11/2026)

- Doigtés : passages hors tessiture décalés par mesure entière (plus de zigzags), changements de position moins fréquents (coûts ajustés), doigts bas / haut (« 2↓ », « 3↑ ») et position en cours affichés sur le manche et dans le pas à pas
- 5 niveaux (Débutant, Élémentaire, Intermédiaire, Avancé, Virtuose) ; 289 morceaux complets dont 60 avancés / virtuoses (sonates, concertos et pièces pour violon solo inclus)
- 203 exercices générés (src/songs/exercise-bank.ts), page Exercices, validation à 3 étoiles au tempo cible, badges
- Métronome global (src/ui/metronome.ts)
- Bouton « Tout afficher » quand un filtre est actif
- Limite : dans la partition, le doigt bas / haut n'apparaît que par le chiffre (alphaTab n'affiche que des chiffres) ; la flèche est sur le manche et dans le pas à pas

## v0.9 (22/11/2026)
- Commandes vocales fr (Web Speech, Chrome/Edge) : « joue », « stop », « suivant », « recommence », « plus vite », « tempo 80 », « partie 2 », « métronome »… + pédales PageUp/PageDown.
- ♯/♭ affichés sous chaque note (partition, manche, mode jeu) ; zoom A−/A+ partout.
- Pas à pas guidé (▶ Commencer, 🔊 auto) ; mode « Jeu & play-along » sur partition ou défilement.
- Répétitions 1/3/5/10/∞ (exercices et morceaux).
- 105 exercices techniques style Ševčík (src/songs/technique-bank.ts) : total 308 exercices.
- Cercle des notes (chromatique ↔ quintes) à côté du manche.
- Cours « Harmonie & improvisation » 16 leçons (docs/cours-harmonie.md) + atelier (grilles, bourdon, micro qui classe les notes).
- docs/generiques-films-series.md : 63 génériques à importer via le coffre (protégés).

## v0.10 (22/11/2026)
- Micro : filtres « appel » coupés (voiceIsolation), seuil de clarté 0,7, choix du micro (⚙), diagnostic si du son arrive sans note nette (filtre voix Mac/Windows/casque).
- Écran plus compact : cercle agrandi, bandeaux d'aide supprimés, titre/accordage retirés de la partition.
- Boucle de travail : « 📏 Ligne en cours » ou « ✂ Choisir des mesures… » dans le menu des parties (+ voix « la ligne »).
- Les Quatre Saisons de Vivaldi : 12 mouvements, partie soliste (Mutopia, CC BY-SA) via scripts/add_pieces.py.
- Aquarium (Saint-Saëns) : aucune source libre MIDI/MusicXML trouvée (Mutopia, IMSLP) → via coffre.

## v0.11 (22/11/2026)
- Doigtés violon : démanché coûteux sauf pendant une corde à vide, 4e doigt en extension (4↑), moins d'allers-retours (Marche turque : 1re position jusqu'à la partie en La).
- Changement de position annoncé sur la note (ou le silence) qui précède.
- Versions faciles automatiques (src/songs/simplify.ts) : 1 note par temps, 1re position, tempo −25 % ; filtre « ⭐ Incontournables + versions faciles » (liste FAMOUS dans library.ts).
- Cercle compact : indique « chromatique » / « quintes ».

## v0.12 (22/11/2026)
- Micro : test guidé (🎤 Test micro, violon/guitare), La de référence réglable + calibrage depuis le test (accordage à 432 Hz détecté chez l'utilisateur ; PC : désactiver les « améliorations audio » Windows / Intel SST).
- Pas à pas exigeant (⚙) : ⏱ tenir la durée écrite (70 % au tempo choisi), ✂ détaché (chaque note réattaquée).
- Accordeur flottant (🎚 Accordeur) à côté du métronome, sur toutes les pages.
- Comptes : Supabase branché (src/cloud/config.ts) ; reste à exécuter docs/supabase.sql + Site URL côté Supabase.

## v0.13 (22/11/2026)
- Guitare : page 🎸 Accords (44 diagrammes, cours 11 leçons docs/cours-accords.md, changements en 1 minute, 17 grilles + morceaux à accords), lecteur d'accords (12 rythmes, capo/tonalité facile, guitare synthétique Karplus-Strong), reconnaissance d'accords au micro (chroma, src/practice/chord-detector.ts).
- Flûte à bec soprano (doigtés baroques WFG, src/songs/recorder.ts) et voix comme instruments (partition seule, src/songs/alphatex.ts melodicToAlphaTex) ; parcours 12 semaines pour chacun.
- Studio voix (src/ui/voice-studio.ts) : miroir/tessiture, écho, sirène, parole (intonation), deux voix (intervalles tenus, tierces, canon).
- Manche : plus grand, couleur par corde, corde à vide mise en évidence, longueur vibrante animée.
- Paroles domaine public (src/songs/lyrics.ts, 12 chansons, test syllabes = notes).

## v0.14 (22/11/2026)
- Répertoire par instrument (src/songs/library.ts songFor, champ origin) + 192 pièces de guitare classique complètes (scripts/build_guitar.py → pd-guitar.json, champ tex).
- Voix : courbe à échelle fixe, lissée, justesse réglable ; jeu de chant karaoké (src/game/sing.ts, sing-lane.ts) ; paroles karaoké partout (lyrics-strip.ts) ; 17 chansons à paroles ; deux chanteurs (2 micros / chacun son tour).
- Guitare : enchaînements 4/6/8 accords, libre, aléatoire.
- Transcription audio → partition (Basic Pitch, public/basic-pitch, src/practice/transcribe.ts), « Mes morceaux » en localStorage.
- Cinéma & TV : 14 œuvres libres (Satie, Debussy, Strauss, Verdi…).
- Design system « scène néon » (fin de src/style.css, polices Unbounded + Space Grotesk).
- Plus d'« archet » hors violon.

## Décisions prises

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Base technique | Web (Vite + TypeScript, sans framework) | Une base de code pour desktop, mobile et TV |
| Moteur de partition | alphaTab 1.9 | Tablature + partition + lecture synchronisée + import Guitar Pro / MusicXML |
| Pas à pas | Micro, détection de hauteur pitchy | Même logique que le futur manche LED |
| Notes identiques consécutives | Il faut relâcher (silence 60 ms) avant de rejouer | Sinon une note tenue validerait les deux |
| Morceaux | Domaine public + import de fichiers | Pas d'aspiration massive de sites de tablatures (conditions d'utilisation des sites) |
| Mot de passe du coffre | Jamais dans le code, 12 caractères minimum | Repo public ; un code court se casse en quelques minutes |
| Coffre | Fichiers chiffrés publiés avec le site (choix de l'utilisateur) | Pas de clé GitHub à gérer ; les fichiers chiffrés restent publics mais illisibles sans mot de passe |
| Pop | Uniquement par import local ou coffre chiffré, jamais en clair dans le repo | Repo et site publics : pas de musique sous droits dans la bibliothèque intégrée |
| Morceaux complets | Mutopia Project, conversion automatique, crédits obligatoires | Seule source massive de partitions libres lisibles par machine ; licences compatibles |
| thesession.org | Non utilisé | Leur licence interdit tout traitement des données par un modèle d'IA |
| Manche | Sillet à gauche, corde aiguë en haut, géométrie réelle | Même orientation que la tablature, mêmes positions que les futures LEDs |

## Prochaines étapes proposées

1. **Import ABC** depuis thesession.org (des milliers d'airs traditionnels irlandais, écossais, folk, avec API publique) : grosse bibliothèque légale par style.
2. ~~Hébergement~~ fait : **GitHub Pages** (`.github/workflows/deploy-pages.yml`), tests + build + déploiement à chaque push sur `main` → https://nikehatzfeld.github.io/string-coach/ . Le repo est public (requis par Pages sur ce compte). `vercel.json` reste dispo si besoin.
3. **Mode vitesse réelle avec score** : justesse + rythme dans une fenêtre de temps, comme prévu pour le manche.
4. **Accompagnement** : piste d'accords / batterie générée sous la mélodie.
5. **Empaquetage** : Tauri (desktop), Capacitor (Android, Android TV, iOS).
6. **Lien avec le manche LED** : envoyer la note cible en Web MIDI / Web Serial vers la carte Daisy Seed.

## Points connus

- Une même note répétée au violon sans coupure d'archet nette peut demander « Suivante ▶ ».
- Sur mobile, alphaTab affiche une mesure par ligne en portrait ; une vue horizontale défilante serait plus lisible.
- Le bundle alphaTab pèse ~1,2 Mo (300 Ko compressé) ; à découper si le chargement mobile est lent.
