import type { Instrument } from './instruments';

/**
 * Choix des cordes, positions et doigts pour une mélodie.
 * Violon : 1re position par défaut (cordes à vide privilégiées) ; on ne monte que si une note
 * ne se joue pas dans la position courante, et on redescend dès qu'elle ne suffit plus.
 * Guitare : position = case de l'index (1re position = cases 1 à 4).
 */

export interface Placed {
  midi: number;
  /** 1 = corde la plus aiguë. */
  string: number;
  fret: number;
  /** 0 = corde à vide, 1 à 4 = doigt de la main gauche. */
  finger: number;
  position: number;
}

/** Violon : demi-ton où se pose le 1er doigt dans chaque position. */
const VIOLIN_BASE: Record<number, number> = { 1: 2, 2: 4, 3: 5, 4: 7, 5: 9, 6: 10, 7: 12, 8: 14, 9: 15, 10: 17 };

export function fingerFor(fret: number, position: number, inst: Instrument): number | null {
  if (fret === 0) return 0;
  if (inst.id === 'violin') {
    const base = VIOLIN_BASE[position];
    if (base === undefined) return null;
    const o = fret - base;
    // o = 6 : 4e doigt en extension (ex. Do sur la corde de Mi en 1re position).
    if (o < -1 || o > 6) return null;
    if (o <= 0) return 1;
    if (o <= 2) return 2;
    if (o <= 4) return 3;
    return 4;
  }
  // Guitare : un doigt par case, extension du 4e doigt d'une case.
  const o = fret - position;
  if (o < 0 || o > 4) return null;
  return Math.min(o + 1, 4);
}

function positionsOf(inst: Instrument): number[] {
  return inst.id === 'violin' ? [1, 2, 3, 4, 5, 6, 7] : Array.from({ length: 15 }, (_, i) => i + 1);
}

/** Meilleure façon de jouer une note dans une position donnée (case la plus basse), ou null. */
function placeIn(midi: number, position: number, inst: Instrument): Placed | null {
  let best: Placed | null = null;
  inst.tuning.forEach((open, i) => {
    const fret = midi - open;
    if (fret < 0) return;
    const finger = fingerFor(fret, position, inst);
    if (finger === null) return;
    if (!best || fret < best.fret) best = { midi, string: i + 1, fret, finger, position };
  });
  return best;
}

/** Coûts : rester en position basse et changer le moins possible. */
// Rester en 2e ou 3e position coûte peu ; un démanché coûte cher (et deux de suite encore plus).
const HEIGHT_COST = 1.5;
const SHIFT_COST = 14;
/** 4e doigt en extension : utile pour éviter un aller-retour de position pour une seule note. */
const EXTENSION_COST = 4;
const OPEN_SHIFT_COST = 2;
const SHIFT_DISTANCE_COST = 0.5;
const SLIDE_COST = 5;

/**
 * Enchaînement des positions optimisé sur toute la mélodie (programmation dynamique) :
 * chaque note coûte (position − 1) × HEIGHT_COST, chaque changement SHIFT_COST + distance.
 * Une corde à vide ne coûte rien et ne force aucune position.
 */
export interface PlaceOptions {
  /** Tout jouer sur cette corde (1 = la plus aiguë) : gammes sur une corde, démanchés. */
  onlyString?: number;
  /** Tout jouer dans cette position (si possible) : spider, exercices de position. */
  position?: number;
  /** Ne pas monter au-delà de cette position (versions « 1re position » / « jusqu'en 3e »). */
  maxPosition?: number;
}

export function placeMelody(midis: number[], inst: Instrument, opts: PlaceOptions = {}): Placed[] {
  if (opts.onlyString) {
    const s = opts.onlyString;
    const single = { ...inst, tuning: [inst.tuning[s - 1]] };
    return placeMelodyAuto(midis, single).map((p) => ({ ...p, string: s }));
  }
  if (opts.position) {
    const auto = placeMelodyAuto(midis, inst);
    return midis.map((m, i) => placeIn(m, opts.position!, inst) ?? auto[i]);
  }
  return placeMelodyAuto(midis, inst, opts.maxPosition);
}

function placeMelodyAuto(midis: number[], inst: Instrument, maxPosition?: number): Placed[] {
  const positions = positionsOf(inst).filter((p) => !maxPosition || p <= maxPosition);
  const INF = Number.POSITIVE_INFINITY;
  const options = midis.map((m) => positions.map((p) => placeIn(m, p, inst)));
  let cost = positions.map((p, j) => {
    const o = options[0]?.[j];
    return o ? (o.finger === 0 ? 0 : (p - 1) * HEIGHT_COST + (isExtension(o, inst) ? EXTENSION_COST : 0)) : INF;
  });
  if (!midis.length) return [];
  // Note injouable partout (trop aiguë) : on l'autorise dans toutes les positions.
  const allowAll = (i: number) => options[i].every((o) => !o);
  if (allowAll(0)) cost = positions.map((p) => (p - 1) * HEIGHT_COST);
  const back: number[][] = [];
  for (let i = 1; i < midis.length; i++) {
    const next: number[] = [];
    const from: number[] = [];
    const free = allowAll(i);
    positions.forEach((q, j) => {
      const opt = options[i][j];
      if (!opt && !free) {
        next.push(INF);
        from.push(0);
        return;
      }
      const noteCost = opt?.finger === 0 ? 0 : (q - 1) * HEIGHT_COST + (opt && isExtension(opt, inst) ? EXTENSION_COST : 0);
      let best = INF;
      let arg = 0;
      positions.forEach((p, k) => {
        const prev = options[i - 1][k];
        // Même doigt sur une autre case juste après : glissement à éviter.
        const slide = prev && opt && prev.finger > 0 && prev.finger === opt.finger && prev.fret !== opt.fret ? SLIDE_COST : 0;
        // Pendant une corde à vide, la main se déplace librement : démanché presque gratuit.
        const shift = prev?.finger === 0 ? OPEN_SHIFT_COST : SHIFT_COST;
        const c = cost[k] + slide + (p === q ? 0 : shift + Math.abs(q - p) * SHIFT_DISTANCE_COST);
        if (c < best) {
          best = c;
          arg = k;
        }
      });
      next.push(best + noteCost);
      from.push(arg);
    });
    cost = next;
    back.push(from);
  }
  // Remontée du meilleur chemin.
  let j = cost.indexOf(Math.min(...cost));
  const path: number[] = new Array(midis.length);
  for (let i = midis.length - 1; i >= 0; i--) {
    path[i] = j;
    if (i > 0) j = back[i - 1][j];
  }
  return midis.map((midi, i) => {
    const p = positions[path[i]];
    const placed = options[i][path[i]];
    if (placed) return placed;
    // Hors de portée des positions connues : case la plus basse.
    let fallback: Placed | null = null;
    inst.tuning.forEach((open, s) => {
      const fret = midi - open;
      if (fret >= 0 && (!fallback || fret < fallback.fret)) fallback = { midi, string: s + 1, fret, finger: 4, position: p };
    });
    if (!fallback) throw new Error(`Note ${midi} trop grave pour ${inst.label}`);
    return fallback;
  });
}

/**
 * Octave de jeu : celle qui met le plus de notes en 1re position (à la guitare, les méthodes
 * écrivent la mélodie une octave plus haut qu'elle ne sonne). Toutes les notes doivent rester jouables.
 */
export function bestOctaveShift(midis: number[], inst: Instrument): number {
  const lowest = Math.min(...inst.tuning);
  let best = 0;
  let bestScore = -Infinity;
  for (const shift of [0, -12, 12, -24, 24]) {
    if (midis.some((m) => m + shift < lowest)) continue;
    // Note confortable en 1re position = 10 ; avec extension du 4e doigt = 6.
    const comfort = midis.reduce((sum, m) => {
      const p = placeIn(m + shift, 1, inst);
      return sum + (!p ? 0 : inst.id === 'guitar' && p.fret > 4 ? 6 : 10);
    }, 0);
    const score = comfort - Math.abs(shift) / 12;
    if (score > bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  return best;
}

export function positionLabel(position: number, inst: Instrument): string {
  if (inst.id === 'violin') return position === 1 ? '1re pos.' : `${position}e pos.`;
  return position === 1 ? '1re pos. (cases 1-4)' : `Pos. ${position} (cases ${position}-${position + 3})`;
}

const NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const NAMES_FLAT = ['Do', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

/** Nom de note en solfège, avec ♯ ou ♭ selon l'orthographe écrite. */
export function solfege(midi: number, spelledFlat: boolean): string {
  return (spelledFlat ? NAMES_FLAT : NAMES)[((midi % 12) + 12) % 12];
}

function isExtension(p: Placed, inst: Instrument): boolean {
  return inst.id === 'violin' && p.finger === 4 && p.fret - (VIOLIN_BASE[p.position] ?? 0) === 6;
}

/** Variante du doigt au violon : « bas » (un demi-ton plus bas que d'habitude) ou « haut ». */
export function fingerVariant(p: Placed, inst: Instrument): '' | 'bas' | 'haut' {
  if (inst.id !== 'violin' || p.finger === 0) return '';
  const base = VIOLIN_BASE[p.position];
  if (base === undefined) return '';
  const o = p.fret - base;
  if (o === -1 || o === 1) return 'bas';
  if (o === 4 || o === 6) return 'haut';
  return '';
}

/** Doigt affiché : « 2 », « 2↓ » (bas), « 3↑ » (haut), « 0 » (corde à vide). */
export function fingerLabel(p: Placed, inst: Instrument): string {
  const v = fingerVariant(p, inst);
  return `${p.finger}${v === 'bas' ? '↓' : v === 'haut' ? '↑' : ''}`;
}
