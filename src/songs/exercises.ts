import type { Song } from './alphatex';

/**
 * Gammes, arpèges et exercices générés : exacts par construction.
 * Les toniques sont choisies pour tenir en 1re position au violon (≥ Sol3).
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR: Record<string, string> = {
  C: 'Do', 'C#': 'Do#', Db: 'Réb', D: 'Ré', 'D#': 'Ré#', Eb: 'Mib', E: 'Mi', F: 'Fa', 'F#': 'Fa#',
  Gb: 'Solb', G: 'Sol', 'G#': 'Sol#', Ab: 'Lab', A: 'La', 'A#': 'La#', Bb: 'Sib', B: 'Si',
};

function tok(midi: number, flat: boolean): string {
  const names = flat ? FLAT : SHARP;
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

const MODES = {
  major: { steps: [0, 2, 4, 5, 7, 9, 11, 12], label: 'majeur', arp: [0, 4, 7, 12] },
  minor: { steps: [0, 2, 3, 5, 7, 8, 10, 12], label: 'mineur', arp: [0, 3, 7, 12] },
  harmonic: { steps: [0, 2, 3, 5, 7, 8, 11, 12], label: 'mineur harmonique', arp: [0, 3, 7, 12] },
} as const;
type Mode = keyof typeof MODES;

interface KeyDef {
  name: string; // ex. 'D', 'Bb'
  root: number; // MIDI de la tonique
  mode: Mode;
  level: 1 | 2 | 3;
}

const KEYS: KeyDef[] = [
  { name: 'G', root: 55, mode: 'major', level: 1 },
  { name: 'A', root: 57, mode: 'major', level: 1 },
  { name: 'D', root: 62, mode: 'major', level: 1 },
  { name: 'C', root: 60, mode: 'major', level: 1 },
  { name: 'F', root: 65, mode: 'major', level: 2 },
  { name: 'E', root: 64, mode: 'major', level: 2 },
  { name: 'Bb', root: 58, mode: 'major', level: 2 },
  { name: 'Eb', root: 63, mode: 'major', level: 3 },
  { name: 'A', root: 57, mode: 'minor', level: 1 },
  { name: 'E', root: 64, mode: 'minor', level: 1 },
  { name: 'D', root: 62, mode: 'minor', level: 2 },
  { name: 'G', root: 55, mode: 'minor', level: 2 },
  { name: 'B', root: 59, mode: 'minor', level: 2 },
  { name: 'A', root: 57, mode: 'harmonic', level: 2 },
  { name: 'D', root: 62, mode: 'harmonic', level: 3 },
  { name: 'E', root: 64, mode: 'harmonic', level: 3 },
];

function keySig(k: KeyDef): string {
  return k.mode === 'major' ? k.name : `${k.name.toLowerCase()}minor`;
}

function base(id: string, title: string, k: KeyDef, tempo: number, notation: string): Song {
  return {
    id,
    title,
    composer: 'Exercice',
    style: 'Gammes & arpèges',
    level: k.level,
    tempo,
    timeSignature: [4, 4],
    key: keySig(k),
    notation,
  };
}

function scale(k: KeyDef): Song {
  const flat = k.name.includes('b') || k.name === 'F' || (k.mode !== 'major' && ['D', 'G'].includes(k.name));
  const up = MODES[k.mode].steps.map((s) => tok(k.root + s, flat));
  // La gamme mineure harmonique et mineure redescendent de la même façon.
  const down = [...up].reverse();
  const n = `${up.slice(0, 4).join(' ')} | ${up.slice(4).join(' ')} | ${down.slice(0, 4).join(' ')} | ${down.slice(4).join(' ')} | ${up[0]}:1`;
  const id = `gamme-${k.name.toLowerCase()}-${k.mode}`.replace('#', 'd');
  return base(id, `Gamme de ${FR[k.name]} ${MODES[k.mode].label}`, k, 72, n);
}

function arpeggio(k: KeyDef): Song {
  const flat = k.name.includes('b') || k.name === 'F' || (k.mode !== 'major' && ['D', 'G'].includes(k.name));
  const a = MODES[k.mode].arp.map((s) => tok(k.root + s, flat));
  const r = [...a].reverse();
  const n = `${a.join(' ')} | ${r.join(' ')} | ${a.map((x) => `${x}:8`).join(' ')} ${r.map((x) => `${x}:8`).join(' ')} | ${a[0]}:1`;
  const id = `arpege-${k.name.toLowerCase()}-${k.mode}`;
  return base(id, `Arpège de ${FR[k.name]} ${MODES[k.mode].label}`, k, 72, n);
}

function twoOctaves(k: KeyDef): Song {
  const steps = [...MODES[k.mode].steps, ...MODES[k.mode].steps.slice(1).map((s) => s + 12)];
  const up = steps.map((s) => tok(k.root + s, false));
  const down = [...up].reverse();
  // 15 notes : 7 croches + noire par mesure à la montée et à la descente.
  const bar = (notes: string[]) => `${notes.slice(0, 6).map((x) => `${x}:8`).join(' ')} ${notes[6]}:4`;
  const n = [
    `${up.slice(0, 8).map((x) => `${x}:8`).join(' ')}`,
    bar(up.slice(8, 15)),
    `${down.slice(0, 8).map((x) => `${x}:8`).join(' ')}`,
    bar(down.slice(8, 15)),
    `${up[0]}:1`,
  ].join(' | ');
  return base(`gamme-${k.name.toLowerCase()}-2oct`, `Gamme de ${FR[k.name]} ${MODES[k.mode].label} sur 2 octaves`, { ...k, level: 2 }, 80, n);
}

const PENTA = [
  { id: 'penta-sol-majeur', title: 'Pentatonique de Sol majeur', root: 55, steps: [0, 2, 4, 7, 9, 12], key: 'G', level: 1 as const },
  { id: 'penta-re-majeur', title: 'Pentatonique de Ré majeur', root: 62, steps: [0, 2, 4, 7, 9, 12], key: 'D', level: 1 as const },
  { id: 'penta-mi-mineur', title: 'Pentatonique de Mi mineur', root: 64, steps: [0, 3, 5, 7, 10, 12], key: 'eminor', level: 1 as const },
  { id: 'penta-re-mineur', title: 'Pentatonique de Ré mineur', root: 62, steps: [0, 3, 5, 7, 10, 12], key: 'dminor', level: 2 as const },
  { id: 'blues-la', title: 'Gamme blues de La', root: 57, steps: [0, 3, 5, 6, 7, 10, 12], key: 'aminor', level: 2 as const },
  { id: 'blues-mi', title: 'Gamme blues de Mi', root: 64, steps: [0, 3, 5, 6, 7, 10, 12], key: 'eminor', level: 2 as const },
];

function penta(p: (typeof PENTA)[number]): Song {
  const up = p.steps.map((s) => tok(p.root + s, false));
  const down = [...up].reverse();
  // Croches, montée et descente, complétées par la tonique.
  const all = [...up, ...down.slice(1)].map((x) => `${x}:8`);
  const bars: string[] = [];
  for (let i = 0; i < all.length; i += 8) bars.push(all.slice(i, i + 8).join(' '));
  const last = all.length % 8;
  if (last) bars[bars.length - 1] += ` ${'r:8 '.repeat(8 - last).trim()}`;
  bars.push(`${up[0]}:1`);
  return {
    id: p.id,
    title: p.title,
    composer: 'Exercice',
    style: 'Gammes & arpèges',
    level: p.level,
    tempo: 80,
    timeSignature: [4, 4],
    key: p.key,
    notation: bars.join(' | '),
  };
}

const EXTRA: Song[] = [
  {
    id: 'cordes-a-vide',
    title: 'Cordes à vide',
    composer: 'Exercice (violon)',
    style: 'Exercices',
    level: 1,
    tempo: 70,
    timeSignature: [4, 4],
    notation: 'G3:2 G3 | D4:2 D4 | A4:2 A4 | E5:2 E5 | E5:4 A4 D4 G3 | G3 D4 A4 E5 | G3:8 G3 D4 D4 A4 A4 E5 E5 | E5:1',
  },
  {
    id: 'quatre-doigts',
    title: 'Les quatre doigts (1re position)',
    composer: 'Exercice (violon)',
    style: 'Exercices',
    level: 1,
    tempo: 70,
    timeSignature: [4, 4],
    key: 'D',
    notation: 'D4 E4 F#4 G4 | A4:1 | A4:4 G4 F#4 E4 | D4:1 | A4:4 B4 C#5 D5 | E5:1 | E5:4 D5 C#5 B4 | A4:1',
  },
  {
    id: 'chromatique',
    title: 'Gamme chromatique',
    composer: 'Exercice',
    style: 'Exercices',
    level: 2,
    tempo: 70,
    timeSignature: [4, 4],
    notation: 'G3:8 G#3 A3 A#3 B3 C4 C#4 D4 | D#4 E4 F4 F#4 G4:2 | G4:8 F#4 F4 E4 D#4 D4 C#4 C4 | B3 A#3 A3 G#3 G3:2',
  },
  {
    id: 'rythmes-de-base',
    title: 'Rythmes de base',
    composer: 'Exercice',
    style: 'Exercices',
    level: 1,
    tempo: 80,
    timeSignature: [4, 4],
    key: 'D',
    notation:
      'D4:4 D4 D4:2 | D4:8 D4 D4 D4 D4:2 | D4:4. D4:8 D4:2 | D4:8 D4 D4:4 D4:2 | ' +
      'A4:4 A4 A4:2 | A4:8 A4 A4 A4 A4:2 | A4:4. A4:8 A4:2 | D4:1',
  },
  {
    id: 'tierces-re',
    title: 'Tierces en Ré majeur',
    composer: 'Exercice',
    style: 'Exercices',
    level: 2,
    tempo: 72,
    timeSignature: [4, 4],
    key: 'D',
    notation: 'D4:8 F#4 E4 G4 F#4 A4 G4 B4 | A4 C#5 B4 D5 C#5 E5 D5:4 | D5:8 B4 C#5 A4 B4 G4 A4 F#4 | G4 E4 F#4 D4 E4 C#4 D4:4',
  },
  {
    id: 'blues-mi-walking',
    title: 'Walking blues en Mi',
    composer: 'Exercice (12 mesures)',
    style: 'Blues',
    level: 2,
    tempo: 96,
    timeSignature: [4, 4],
    notation:
      'E3:8@E7 G#3 B3 C#4 D4 C#4 B3 G#3 | E3 G#3 B3 C#4 D4 C#4 B3 G#3 | E3 G#3 B3 C#4 D4 C#4 B3 G#3 | E3 G#3 B3 C#4 D4 C#4 B3 G#3 | ' +
      'A2@A7 C#3 E3 F#3 G3 F#3 E3 C#3 | A2 C#3 E3 F#3 G3 F#3 E3 C#3 | E3@E7 G#3 B3 C#4 D4 C#4 B3 G#3 | E3 G#3 B3 C#4 D4 C#4 B3 G#3 | ' +
      'B2@B7 D#3 F#3 G#3 A3 G#3 F#3 D#3 | A2@A7 C#3 E3 F#3 G3 F#3 E3 C#3 | E3@E7 G#3 B3 C#4 D4 C#4 B3 G#3 | B2@B7 D#3 F#3 G#3 A3 G#3 F#3 D#3 | E3:1@E7',
  },
];

export const EXERCISES: Song[] = [
  ...KEYS.map(scale),
  ...KEYS.filter((k) => k.mode !== 'harmonic').map(arpeggio),
  twoOctaves(KEYS[0]),
  twoOctaves(KEYS[1]),
  ...PENTA.map(penta),
  ...EXTRA,
];
