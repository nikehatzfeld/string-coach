import type { InstrumentId } from '../songs/instruments';
import type { Song } from '../songs/alphatex';
import { LIBRARY } from '../songs/library';

/**
 * Parcours de 12 semaines (par paliers de 2 semaines), construits d'après docs/pedagogie.md :
 * séquence Suzuki / Essential Elements / ABRSM pour le violon, JustinGuitar / Carulli / Giuliani pour la guitare.
 * Les tempos cibles sont des estimations (indiquées comme telles dans la recherche).
 */

export type Block = 'warmup' | 'technique' | 'piece' | 'rhythm' | 'review';

export interface CourseItem {
  block: Block;
  title: string;
  how: string;
  /** Morceau de la bibliothèque : identifiant exact, ou expression cherchée dans les titres. */
  song?: string | RegExp;
  mode?: 'live' | 'step' | 'game';
  bpm?: number;
  /** Exercice hors application (accords, archet…) : minuteur et case à cocher. */
  offline?: boolean;
}

export interface CourseStage {
  weeks: [number, number];
  goal: string;
  items: CourseItem[];
}

export const BLOCK_LABEL: Record<Block, string> = {
  warmup: 'Échauffement',
  technique: 'Technique',
  piece: 'Morceau',
  rhythm: 'Jeu & rythme',
  review: 'Révision',
};

/** Minutes par bloc selon la durée de séance choisie (modèle de séance de la recherche). */
export const SESSION_TEMPLATE: Record<15 | 20 | 30, Record<Block, number>> = {
  15: { warmup: 2, technique: 4, piece: 6, rhythm: 2, review: 0 },
  20: { warmup: 3, technique: 5, piece: 8, rhythm: 3, review: 0 },
  30: { warmup: 4, technique: 6, piece: 10, rhythm: 0, review: 4 },
};

const VIOLIN: CourseStage[] = [
  {
    weeks: [1, 2],
    goal: 'Tenue, cordes à vide, archet droit',
    items: [
      { block: 'warmup', title: 'Archets longs sur cordes à vide', how: '5 à 10 archets entiers, du talon à la pointe, archet parallèle au chevalet.', offline: true },
      { block: 'technique', title: 'Cordes à vide', how: 'Son régulier sur chaque corde, puis passages de corde.', song: 'cordes-a-vide', mode: 'step', bpm: 60 },
      { block: 'piece', title: 'Rythmes de base', how: 'Rythmes des variations de Twinkle sur une corde à vide.', song: 'rythmes-de-base', mode: 'step', bpm: 60 },
      { block: 'rhythm', title: 'Hot Cross Buns', how: 'En mode jeu : vise le combo.', song: 'hot-cross-buns', mode: 'game', bpm: 60 },
    ],
  },
  {
    weeks: [3, 4],
    goal: 'Schéma « 2 haut », gamme de La majeur',
    items: [
      { block: 'warmup', title: 'Son filé', how: 'Une note tenue sur tout l’archet, crescendo en tirant, diminuendo en poussant.', offline: true },
      { block: 'technique', title: 'Gamme de La majeur', how: 'Lente, chaque note bien juste (accordeur vert).', song: 'gamme-a-major', mode: 'step', bpm: 60 },
      { block: 'technique', title: 'Les quatre doigts', how: 'Doigts posés, gardés sur la corde.', song: 'quatre-doigts', mode: 'step', bpm: 60 },
      { block: 'piece', title: 'Ah ! vous dirai-je, maman', how: 'Le « Twinkle » de Suzuki : par parties, puis en entier.', song: 'ah-vous-dirai-je', mode: 'step', bpm: 66 },
      { block: 'rhythm', title: 'Mary Had a Little Lamb', how: 'Mode jeu.', song: 'mary-had-a-little-lamb', mode: 'game', bpm: 72 },
    ],
  },
  {
    weeks: [5, 6],
    goal: 'Ré majeur, 4e doigt',
    items: [
      { block: 'warmup', title: 'Répartition de l’archet', how: 'Moitié inférieure lourde et forte, moitié supérieure légère.', offline: true },
      { block: 'technique', title: 'Gamme de Ré majeur', how: 'Même schéma que La majeur, une corde plus bas.', song: 'gamme-d-major', mode: 'step', bpm: 72 },
      { block: 'piece', title: 'Au clair de la lune', how: 'Par parties.', song: 'au-clair-de-la-lune', mode: 'step', bpm: 72 },
      { block: 'piece', title: 'Ode à la joie', how: 'Mode pas à pas puis écoute avec accompagnement.', song: 'ode-joie', mode: 'step', bpm: 72 },
      { block: 'rhythm', title: 'London Bridge', how: 'Mode jeu.', song: 'london-bridge', mode: 'game', bpm: 80 },
    ],
  },
  {
    weeks: [7, 8],
    goal: 'Corde de Sol, Sol majeur',
    items: [
      { block: 'warmup', title: 'Archets longs + rythmes Twinkle', how: 'Sur la corde de Sol.', offline: true },
      { block: 'technique', title: 'Gamme de Sol majeur', how: 'Une octave, puis deux.', song: 'gamme-g-major', mode: 'step', bpm: 72 },
      { block: 'technique', title: 'Arpège de Sol majeur', how: 'Détaché, sur un bourdon si possible.', song: 'arpege-g-major', mode: 'step', bpm: 72 },
      { block: 'piece', title: 'Oh! Susanna', how: 'Avec l’accompagnement.', song: 'oh-susanna', mode: 'step', bpm: 84 },
      { block: 'rhythm', title: 'Alouette', how: 'Mode jeu.', song: 'alouette', mode: 'game', bpm: 84 },
    ],
  },
  {
    weeks: [9, 10],
    goal: '« 2 bas », Do naturel',
    items: [
      { block: 'warmup', title: 'Son filé avec nuances', how: 'pp → ff → pp sur un archet.', offline: true },
      { block: 'technique', title: 'Gamme de Do majeur', how: 'Attention au 2e doigt bas (Do, Fa naturels).', song: 'gamme-c-major', mode: 'step', bpm: 80 },
      { block: 'technique', title: 'Tierces en Ré majeur', how: 'Lentement, justesse d’abord.', song: 'tierces-re', mode: 'step', bpm: 72 },
      { block: 'piece', title: 'Menuets de Bach (Anna Magdalena)', how: 'Version complète : une partie par jour.', song: /menuet bwv anh 114/i, mode: 'step', bpm: 80 },
      { block: 'rhythm', title: 'Greensleeves', how: 'Mode jeu.', song: 'greensleeves', mode: 'game', bpm: 84 },
    ],
  },
  {
    weeks: [11, 12],
    goal: 'Niveau « grade 1 » : Sol sur 2 octaves, Ré, premiers menuets',
    items: [
      { block: 'warmup', title: 'Archets longs, cordes à vide', how: 'Respiration calée sur le sens de l’archet.', offline: true },
      { block: 'technique', title: 'Gamme de Sol majeur sur 2 octaves', how: 'De mémoire si possible.', song: 'gamme-g-2oct', mode: 'step', bpm: 84 },
      { block: 'technique', title: 'Arpège de Ré majeur', how: 'Détaché.', song: 'arpege-d-major', mode: 'step', bpm: 84 },
      { block: 'piece', title: 'Musette en Ré (Bach)', how: 'Morceau complet, par parties.', song: /musette en ré/i, mode: 'step', bpm: 84 },
      { block: 'piece', title: 'Menuet en Sol (Bach)', how: 'Viser 3 étoiles.', song: /menuet bwv anh 114/i, mode: 'game', bpm: 96 },
    ],
  },
];

const GUITAR: CourseStage[] = [
  {
    weeks: [1, 2],
    goal: 'Accords Ré, La, Mi ; un doigt par case',
    items: [
      { block: 'warmup', title: 'Spider 1-2-3-4', how: 'Chromatique, un doigt par case, de la corde 6 à la corde 1, à 60 BPM.', song: 'chromatique', mode: 'step', bpm: 60 },
      { block: 'technique', title: 'Changements en une minute : Ré–La, Ré–Mi, La–Mi', how: 'Chronomètre 1 minute par paire et compte les changements (objectif : 30 par minute).', offline: true },
      { block: 'piece', title: 'Hot Cross Buns', how: 'Mélodie sur les cordes aiguës.', song: 'hot-cross-buns', mode: 'step', bpm: 60 },
      { block: 'rhythm', title: 'Mary Had a Little Lamb', how: 'Mode jeu.', song: 'mary-had-a-little-lamb', mode: 'game', bpm: 70 },
    ],
  },
  {
    weeks: [3, 4],
    goal: 'La mineur, Mi mineur, Ré mineur ; croches en aller-retour',
    items: [
      { block: 'warmup', title: 'Spider, variante 4-3-2-1', how: 'Propre avant d’accélérer.', song: 'chromatique', mode: 'step', bpm: 66 },
      { block: 'technique', title: 'Pentatonique de Mi mineur', how: 'Position ouverte, lentement.', song: 'penta-mi-mineur', mode: 'step', bpm: 70 },
      { block: 'technique', title: 'Grattage en croches', how: 'Bras en pendule constant, sur Am – Em – Dm (objectif : 40 changements par minute).', offline: true },
      { block: 'piece', title: 'Frère Jacques', how: 'Mélodie.', song: 'frere-jacques', mode: 'step', bpm: 80 },
      { block: 'rhythm', title: 'Ode à la joie', how: 'Mode jeu.', song: 'ode-joie', mode: 'game', bpm: 80 },
    ],
  },
  {
    weeks: [5, 6],
    goal: 'Sol et Do ; motif « bas bas haut haut bas haut »',
    items: [
      { block: 'warmup', title: 'Spider, variante 1-3-2-4', how: 'À mi-vitesse.', song: 'chromatique', mode: 'step', bpm: 70 },
      { block: 'technique', title: 'Gamme de Sol majeur', how: '1re position.', song: 'gamme-g-major', mode: 'step', bpm: 80 },
      { block: 'technique', title: 'Suite I–IV–V en Sol (G – C – D)', how: 'Motif bas bas haut haut bas haut à 80 BPM.', offline: true },
      { block: 'piece', title: 'When the Saints Go Marching In', how: 'Avec l’accompagnement.', song: 'saints', mode: 'step', bpm: 100 },
      { block: 'rhythm', title: 'London Bridge', how: 'Mode jeu.', song: 'london-bridge', mode: 'game', bpm: 90 },
    ],
  },
  {
    weeks: [7, 8],
    goal: 'Bases du jeu aux doigts (p-i-m-a)',
    items: [
      { block: 'warmup', title: 'Pouce en basse + index', how: 'Pouce sur la corde de La, index sur la corde de Sol, régulier.', offline: true },
      { block: 'technique', title: 'Arpège de Do majeur', how: 'Une note par doigt.', song: 'arpege-c-major', mode: 'step', bpm: 60 },
      { block: 'piece', title: 'Scarborough Fair', how: 'Mélodie en 3/4.', song: 'scarborough-fair', mode: 'step', bpm: 80 },
      { block: 'rhythm', title: 'Oh! Susanna', how: 'Mode jeu.', song: 'oh-susanna', mode: 'game', bpm: 90 },
    ],
  },
  {
    weeks: [9, 10],
    goal: 'Gammes : pentatonique, Do majeur',
    items: [
      { block: 'warmup', title: 'Spider aller-retour', how: 'Coups alternés.', song: 'chromatique', mode: 'step', bpm: 76 },
      { block: 'technique', title: 'Gamme de Do majeur', how: 'Alternance i-m.', song: 'gamme-c-major', mode: 'step', bpm: 70 },
      { block: 'technique', title: 'Pentatonique de Sol majeur', how: 'Croches à 60 BPM.', song: 'penta-sol-majeur', mode: 'step', bpm: 60 },
      { block: 'piece', title: 'Greensleeves', how: 'Par parties.', song: 'greensleeves', mode: 'step', bpm: 80 },
      { block: 'rhythm', title: 'Amazing Grace', how: 'Mode jeu.', song: 'amazing-grace', mode: 'game', bpm: 80 },
    ],
  },
  {
    weeks: [11, 12],
    goal: 'Consolidation : pentatonique de La, blues',
    items: [
      { block: 'warmup', title: 'Spider, toutes les variantes', how: 'À 80 BPM.', song: 'chromatique', mode: 'step', bpm: 80 },
      { block: 'technique', title: 'Pentatonique de La mineur', how: 'Position 1.', song: 'penta-la-mineur', mode: 'step', bpm: 80 },
      { block: 'technique', title: 'Gamme blues de La', how: 'Avec la note bleue.', song: 'blues-la', mode: 'step', bpm: 80 },
      { block: 'piece', title: 'Walking blues en La', how: 'Avec l’accompagnement.', song: 'walking-blues-la', mode: 'step', bpm: 90 },
      { block: 'rhythm', title: 'The Entertainer (Joplin)', how: 'Morceau complet, partie 1 en mode jeu.', song: /entertainer/i, mode: 'game', bpm: 70 },
    ],
  },
];

export const COURSES: Record<InstrumentId, { title: string; stages: CourseStage[] }> = {
  violin: { title: 'Violon : 12 semaines pour débuter', stages: VIOLIN },
  guitar: { title: 'Guitare : 12 semaines pour débuter', stages: GUITAR },
};

export function stageForWeek(inst: InstrumentId, week: number): CourseStage {
  const stages = COURSES[inst].stages;
  return stages.find((s) => week >= s.weeks[0] && week <= s.weeks[1]) ?? stages[stages.length - 1];
}

/** Séance du jour : éléments du palier, minutes réparties selon la durée choisie. */
export function buildSession(inst: InstrumentId, week: number, length: 15 | 20 | 30, reviewSongIds: string[] = []) {
  const stage = stageForWeek(inst, week);
  const tpl = SESSION_TEMPLATE[length];
  const items: (CourseItem & { minutes: number; key: string })[] = [];
  (Object.keys(tpl) as Block[]).forEach((block) => {
    const minutes = tpl[block];
    if (!minutes) return;
    let pool = stage.items.filter((i) => i.block === block);
    if (block === 'review') {
      pool = reviewSongIds.slice(0, 2).map((id) => ({ block, title: 'Révision', how: 'Morceau maîtrisé à revoir (révision espacée).', song: id, mode: 'game' as const }));
      if (!pool.length) return;
    }
    if (block === 'rhythm' && !pool.length) return;
    pool.forEach((item, k) => items.push({ ...item, minutes: Math.max(1, Math.round(minutes / pool.length)), key: `${week}-${block}-${k}` }));
  });
  return { stage, items };
}

export function resolveSong(ref: CourseItem['song']): Song | undefined {
  if (!ref) return undefined;
  return typeof ref === 'string' ? LIBRARY.find((s) => s.id === ref) : LIBRARY.find((s) => ref.test(s.title));
}
