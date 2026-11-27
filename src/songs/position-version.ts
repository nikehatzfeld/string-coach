import type { Song } from './alphatex';
import { noteToMidi, parseNotation } from './notation';

/**
 * Versions simplifiées d'un morceau de violon :
 * - « 1re position » : toutes les notes entre Sol3 et Si5, jouées sans démanché ;
 * - « jusqu'en 3e position » : jusqu'au Ré6, jamais au-delà de la 3e position.
 * Le morceau est transposé si besoin, vers la tonalité la plus simple pour le violon
 * (peu d'altérations, de préférence Sol, Ré, La ou Do majeur).
 */
export type PosVersion = 1 | 3;
const RANGE: Record<PosVersion, [number, number]> = { 1: [55, 83], 3: [55, 86] };

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR: Record<string, string> = { C: 'Do', 'C#': 'Do♯', Db: 'Ré♭', D: 'Ré', 'D#': 'Ré♯', Eb: 'Mi♭', E: 'Mi', F: 'Fa', 'F#': 'Fa♯', Gb: 'Sol♭', G: 'Sol', 'G#': 'Sol♯', Ab: 'La♭', A: 'La', 'A#': 'La♯', Bb: 'Si♭', B: 'Si' };
/** Altérations à la clé de chaque tonique majeure (0 = Do). */
const ACC = [0, 5, 2, 3, 4, 1, 6, 1, 4, 3, 2, 5];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // Fa, Si♭, Mi♭, La♭, Ré♭, Sol♭
const VIOLIN_FRIENDLY = new Set([7, 2, 9, 0]); // Sol, Ré, La, Do

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (name: string) => (PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;

/** Tonique majeure (relative majeure pour un mineur) et mode. */
export function songKey(song: Song, midis: number[]): { major: number; minor: boolean } {
  if (song.key) {
    const minor = /minor$/i.test(song.key);
    const root = pcOf(song.key.replace(/minor$/i, '').replace(/^./, (c) => c.toUpperCase()));
    return { major: minor ? (root + 3) % 12 : root, minor };
  }
  // Estimation : la gamme majeure qui contient le plus de notes du morceau.
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  let best = 0;
  let bestN = -1;
  for (let k = 0; k < 12; k++) {
    const n = midis.filter((m) => MAJ.includes((m - k + 120) % 12)).length - ACC[k] * 0.01;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return { major: best, minor: false };
}

/** Meilleure transposition (demi-tons) pour tenir dans la tessiture, ou null si impossible. */
export function bestTransposition(midis: number[], major: number, v: PosVersion): number | null {
  const [lo, hi] = RANGE[v];
  const min = Math.min(...midis);
  const max = Math.max(...midis);
  if (max - min > hi - lo) return null;
  let best: number | null = null;
  let bestCost = Infinity;
  for (let t = -24; t <= 24; t++) {
    if (min + t < lo || max + t > hi) continue;
    const k = (major + t + 120) % 12;
    const cost = ACC[k] * 3 + (VIOLIN_FRIENDLY.has(k) ? 0 : 1.5) + (t % 12 === 0 ? 0 : 2) + Math.abs(t) / 12;
    if (cost < bestCost) {
      bestCost = cost;
      best = t;
    }
  }
  return best;
}

const transposeChord = (c: string, t: number, flat: boolean) =>
  c.replace(/^([A-G][#b]?)/, (r) => (flat ? FLAT : SHARP)[(pcOf(r) + t + 120) % 12]).replace(/\/([A-G][#b]?)/, (_m, r) => `/${(flat ? FLAT : SHARP)[(pcOf(r) + t + 120) % 12]}`);

/** Transpose une notation compacte (notes et accords). */
export function transposeNotation(notation: string, t: number, flat: boolean): string {
  if (!t) return notation;
  return notation.replace(/(^|\s|\|)([A-G])([#b]?)(-?\d)(?=[:.@\s|]|$)/g, (_m, pre, l, acc, oct) => {
    const midi = noteToMidi(l, acc, Number(oct)) + t;
    return `${pre}${(flat ? FLAT : SHARP)[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }).replace(/@(\S+)/g, (_m, c) => `@${transposeChord(c, t, flat)}`);
}

/** Version 1re position ou jusqu'en 3e position ; null si la mélodie est trop étendue. */
export function positionVersion(song: Song, v: PosVersion): Song | null {
  if (song.tex || song.string || song.position) return null;
  const midis = parseNotation(song.notation)
    .flat()
    .filter((e) => e.kind === 'note')
    .map((e) => e.midi as number);
  if (!midis.length) return null;
  const key = songKey(song, midis);
  const t = bestTransposition(midis, key.major, v);
  if (t === null) return null;
  const newMajor = (key.major + t + 120) % 12;
  const flat = FLAT_KEYS.has(newMajor);
  const names = flat ? FLAT : SHARP;
  const tonic = key.minor ? (newMajor + 9) % 12 : newMajor;
  const keyName = key.minor ? `${names[tonic].toLowerCase()}minor` : names[tonic];
  const transposed = t % 12 !== 0;
  return {
    ...song,
    id: `${song.id}~pos${v}`,
    title: `${song.title} · ${v === 1 ? '1re position' : 'jusqu’en 3e position'}`,
    notation: transposeNotation(song.notation, t, flat),
    ...(song.key || transposed ? { key: keyName } : {}),
    ...(song.chords ? { chords: song.chords.replace(/[A-G][#b]?[^\s|]*/g, (c) => transposeChord(c, t, flat)) } : {}),
    maxPosition: v,
    level: Math.min(song.level, v === 1 ? 2 : 3) as Song['level'],
    // Instru audio d'origine : plus synchronisée si on transpose.
    ...(transposed ? { audio: undefined } : {}),
  };
}

/** Description courte : « transposé en Ré majeur » ou « même tonalité ». */
export function versionLabel(orig: Song, ver: Song): string {
  if (ver.key && ver.key !== orig.key) {
    const minor = /minor$/.test(ver.key);
    const n = ver.key.replace(/minor$/, '');
    return `transposé en ${FR[n.charAt(0).toUpperCase() + n.slice(1)] ?? n} ${minor ? 'mineur' : 'majeur'}`;
  }
  return 'même tonalité';
}
