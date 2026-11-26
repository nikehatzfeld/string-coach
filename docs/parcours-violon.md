# Parcours violon

Code : `src/academy/` (logique pure, testée) et `src/ui/academy.ts` (écran).

## Organisation
- **506 exercices générés** (`curriculum.ts`), rangés en **12 paliers** (Premiers sons → Concertiste) et **7 domaines** : justesse, archet, doigts, positions, gammes, rythme, doubles cordes.
- Dans chaque unité, le premier exercice est la **clé** (⭐). Le palier suivant s'ouvre quand toutes les clés sont validées. Validation : 3 étoiles au tempo cible.
- Les doubles cordes sont préparées en notes brisées : le micro ne juge qu'une note à la fois.

## Adaptation (`coach.ts`)
- Chaque domaine a un niveau continu de 1 à 12. Une réussite nette le fait monter. Un échec ne le fait baisser que si l'exercice est au niveau de l'élève.
- Mesures relevées à chaque passage (`metrics.ts`) :
  - justesse : écart moyen en cents et tendance (trop haut ou trop bas) ;
  - stabilité de la hauteur pendant la note ;
  - placement rythmique : avance ou retard en ms ;
  - temps de lecture ;
  - justesse par doigt et par corde.
- Séance du jour :
  1. échauffement ;
  2. les 2 domaines les plus faibles ;
  3. la clé du palier ;
  4. une révision ;
  5. compléments.

  Le tempo conseillé vaut 75 % de la cible au départ, ajusté selon l'écart de niveau, puis record + 4 BPM.
- Diagnostic en clair : points forts, points à travailler, conseils.

## Évaluation (`assessment.ts`)
- 10 à 12 mini-tests de 4 mesures en mode jeu.
- Pour chaque domaine, le premier test est au palier présumé (selon l'ancienneté), le second 2 paliers plus haut si le premier est réussi, 2 plus bas sinon.
- Seuil de réussite : 75 %.

## Profils (`state/profiles.ts`)
- Progression par profil : clé `string-coach:progress@<id>`, le profil principal garde la clé d'origine.
- Tous les profils sont synchronisés avec le compte (`others` dans les données Supabase).
