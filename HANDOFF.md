# Reprise du projet

Fichier à lire en premier pour reprendre le travail depuis n'importe quel appareil (Claude Code sur PC, app mobile ou web).

## Où on en est (19/11/2026)

**v0.1 livrée et testée** (48 tests verts, build OK, vérifié dans Chromium desktop et mobile) :
- Bibliothèque par style, choix violon / guitare, recherche, import de fichiers
- Lecteur alphaTab : partition + tablature, son, curseur, tempo, boucle, métronome, décompte, zoom
- Mode pas à pas au micro avec accordeur visuel, boutons précédente / suivante, tolérance réglable
- Navigation télécommande, mise en page mobile, manifest PWA

## Décisions prises

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Base technique | Web (Vite + TypeScript, sans framework) | Une base de code pour desktop, mobile et TV |
| Moteur de partition | alphaTab 1.9 | Tablature + partition + lecture synchronisée + import Guitar Pro / MusicXML |
| Pas à pas | Micro, détection de hauteur pitchy | Même logique que le futur manche LED |
| Notes identiques consécutives | Il faut relâcher (silence 60 ms) avant de rejouer | Sinon une note tenue validerait les deux |
| Morceaux | Domaine public + import de fichiers | Pas d'aspiration massive de sites de tablatures (conditions d'utilisation des sites) |

## Prochaines étapes proposées

1. **Import ABC** depuis thesession.org (des milliers d'airs traditionnels irlandais, écossais, folk, avec API publique) : grosse bibliothèque légale par style.
2. **Hébergement** sur Vercel ou Netlify pour ouvrir l'app sur le téléphone et la TV sans installer Node.
3. **Mode vitesse réelle avec score** : justesse + rythme dans une fenêtre de temps, comme prévu pour le manche.
4. **Accompagnement** : piste d'accords / batterie générée sous la mélodie.
5. **Empaquetage** : Tauri (desktop), Capacitor (Android, Android TV, iOS).
6. **Lien avec le manche LED** : envoyer la note cible en Web MIDI / Web Serial vers la carte Daisy Seed.

## Points connus

- Une même note répétée au violon sans coupure d'archet nette peut demander « Suivante ▶ ».
- Sur mobile, alphaTab affiche une mesure par ligne en portrait ; une vue horizontale défilante serait plus lisible.
- Le bundle alphaTab pèse ~1,2 Mo (300 Ko compressé) ; à découper si le chargement mobile est lent.
