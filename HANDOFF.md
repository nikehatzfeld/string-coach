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

## Décisions prises

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Base technique | Web (Vite + TypeScript, sans framework) | Une base de code pour desktop, mobile et TV |
| Moteur de partition | alphaTab 1.9 | Tablature + partition + lecture synchronisée + import Guitar Pro / MusicXML |
| Pas à pas | Micro, détection de hauteur pitchy | Même logique que le futur manche LED |
| Notes identiques consécutives | Il faut relâcher (silence 60 ms) avant de rejouer | Sinon une note tenue validerait les deux |
| Morceaux | Domaine public + import de fichiers | Pas d'aspiration massive de sites de tablatures (conditions d'utilisation des sites) |
| Pop | Uniquement par import local, jamais dans le repo | Repo et site publics : pas de musique sous droits dans la bibliothèque intégrée |
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
