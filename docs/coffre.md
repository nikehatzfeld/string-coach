# Mon coffre : chansons protégées chiffrées

Le repo et le site sont publics. Les chansons sous droits n'y sont publiées que **chiffrées** (AES-256-GCM, clé dérivée de ton mot de passe par PBKDF2-SHA256, 600 000 itérations). Les titres sont chiffrés eux aussi. Sans le mot de passe, les fichiers de `public/vault/` sont illisibles.

- Le mot de passe n'est jamais stocké ni envoyé. Si tu le perds, le coffre est irrécupérable : il faut le recréer.
- « Rester déverrouillé sur cet appareil » garde la clé dans le navigateur de l'appareil. À éviter sur un appareil partagé.
- Changer de mot de passe : pas encore prévu (il faudrait tout rechiffrer).
- Les fichiers d'origine (.gp, .musicxml…) ne doivent jamais être committés : `.gitignore` les exclut.

## Quel fichier prendre ?

L'app lit les fichiers **Guitar Pro** (`.gp`, `.gp5`, `.gpx`) et **MusicXML** (`.musicxml`, `.mxl`, `.xml`). Pas les PDF ni les fichiers MuseScore (`.mscz`).

| Site | Bouton à utiliser | Fichier obtenu | Compte |
|---|---|---|---|
| MuseScore.com (violon) | Download › **MusicXML** | `.mxl` | MuseScore Pro pour les œuvres sous droits ; partitions « Official » non téléchargeables |
| Songsterr (guitare) | Export / Download › **Guitar Pro** | `.gp` / `.gp5` | Songsterr Plus |
| Ultimate Guitar (guitare) | Bouton **Download** en bas d'une tab Guitar Pro (site web) | `.gp5` / `.gpx` | Tabs « Official » non téléchargeables |

Avant de chiffrer, ouvre le fichier dans « Mes fichiers » (import local) pour vérifier qu'il s'affiche bien.

## Ajouter des chansons depuis l'app (PC ou mobile)

1. Bibliothèque › **🔒 Mon coffre** › **Créer le coffre** (la 1re fois) ou **Ajouter des chansons** (coffre déverrouillé).
2. Choisis tes fichiers Guitar Pro / MusicXML, puis **Chiffrer et télécharger**.
3. Le navigateur peut demander d'autoriser plusieurs téléchargements : accepte.
4. Dépose **tous** les fichiers téléchargés (`vault.json` + les `.bin`) sur GitHub : [Upload dans public/vault](https://github.com/nikehatzfeld/string-coach/upload/main/public/vault), puis « Commit changes ».
5. Le site se met à jour en 1 à 2 minutes : recharge l'app, ouvre « Mon coffre » et entre ton mot de passe.

## Ajouter des chansons depuis un ordinateur (ligne de commande)

```bash
npm run vault -- add chemin/vers/chanson.gp autre.musicxml
```

```bash
npm run vault -- list
```

```bash
npm run vault -- remove <id>
```

Le mot de passe est demandé au clavier. Committe ensuite le dossier `public/vault/`.
