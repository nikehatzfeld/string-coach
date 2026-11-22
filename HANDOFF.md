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
