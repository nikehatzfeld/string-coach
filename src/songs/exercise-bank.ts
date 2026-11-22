import type { Song } from './alphatex';
import type { InstrumentId } from './instruments';

/**
 * Banque d'exercices techniques générés (exacts par construction), indépendants des morceaux.
 * Chaque exercice se valide avec 3 étoiles au tempo cible.
 */

export interface Exercise extends Song {
  category: string;
  /** Tempo à atteindre pour valider (BPM). */
  targetBpm: number;
  /** Instrument concerné ; absent = les deux. */
  only?: InstrumentId;
  how: string;
}

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR: Record<string, string> = {
  C: 'Do', 'C#': 'Do♯', Db: 'Ré♭', D: 'Ré', Eb: 'Mi♭', E: 'Mi', F: 'Fa', 'F#': 'Fa♯', Gb: 'Sol♭', G: 'Sol', Ab: 'La♭', A: 'La', Bb: 'Si♭', B: 'Si',
};
const TARGET = [0, 60, 72, 84, 96, 108];

interface Key {
  name: string;
  root: number; // MIDI, ≥ Sol3 pour tenir au violon
  flat: boolean;
  level: 1 | 2 | 3 | 4 | 5;
}
const MAJOR_KEYS: Key[] = [
  { name: 'G', root: 55, flat: false, level: 1 },
  { name: 'D', root: 62, flat: false, level: 1 },
  { name: 'A', root: 57, flat: false, level: 1 },
  { name: 'C', root: 60, flat: false, level: 2 },
  { name: 'F', root: 65, flat: true, level: 2 },
  { name: 'Bb', root: 58, flat: true, level: 2 },
  { name: 'E', root: 64, flat: false, level: 2 },
  { name: 'Eb', root: 63, flat: true, level: 3 },
  { name: 'B', root: 59, flat: false, level: 3 },
  { name: 'Ab', root: 56, flat: true, level: 4 },
  { name: 'F#', root: 66, flat: false, level: 4 },
  { name: 'Db', root: 61, flat: true, level: 5 },
];
const MINOR_KEYS: Key[] = [
  { name: 'A', root: 57, flat: false, level: 1 },
  { name: 'E', root: 64, flat: false, level: 1 },
  { name: 'D', root: 62, flat: true, level: 2 },
  { name: 'G', root: 55, flat: true, level: 2 },
  { name: 'B', root: 59, flat: false, level: 3 },
  { name: 'C', root: 60, flat: true, level: 3 },
  { name: 'F#', root: 66, flat: false, level: 4 },
  { name: 'F', root: 65, flat: true, level: 4 },
];

const tok = (midi: number, flat: boolean) => `${(flat ? FLAT : SHARP)[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** Range des notes en mesures de 4 temps ; durées en noires (1, 0,5…). */
function pack(notes: { midi: number | null; d: number }[], flat: boolean, barBeats = 4): string {
  const dur = (d: number) => ({ 4: '1', 3: '2.', 2: '2', 1.5: '4.', 1: '4', 0.75: '8.', 0.5: '8', 0.25: '16' })[d] ?? '4';
  const bars: string[][] = [[]];
  let acc = 0;
  for (const n of notes) {
    if (acc + n.d > barBeats + 1e-6) {
      // Complète la mesure par un silence puis passe à la suivante.
      const rest = barBeats - acc;
      if (rest > 1e-6) bars[bars.length - 1].push(`r:${dur(rest)}`);
      bars.push([]);
      acc = 0;
    }
    bars[bars.length - 1].push(`${n.midi === null ? 'r' : tok(n.midi, flat)}:${dur(n.d)}`);
    acc += n.d;
    if (Math.abs(acc - barBeats) < 1e-6) {
      bars.push([]);
      acc = 0;
    }
  }
  if (acc > 0) {
    let rest = barBeats - acc;
    for (const v of [2, 1, 0.5, 0.25]) while (rest >= v - 1e-6) {
      bars[bars.length - 1].push(`r:${dur(v)}`);
      rest -= v;
    }
  }
  return bars.filter((b) => b.length).map((b) => b.join(' ')).join(' | ');
}

const seq = (midis: number[], d: number) => midis.map((midi) => ({ midi, d }));
const keySig = (k: Key, minor = false) => (minor ? `${k.name.toLowerCase()}minor` : k.name);

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const NAT_MIN = [0, 2, 3, 5, 7, 8, 10, 12];
const HARM_MIN = [0, 2, 3, 5, 7, 8, 11, 12];
const MEL_MIN_UP = [0, 2, 3, 5, 7, 9, 11, 12];

function updown(steps: number[], root: number): number[] {
  const up = steps.map((s) => root + s);
  return [...up, ...up.slice(0, -1).reverse()];
}

function twoOct(steps: number[], root: number): number[] {
  const s2 = [...steps, ...steps.slice(1).map((x) => x + 12)];
  return updown(s2, root);
}

const out: Exercise[] = [];
let n = 0;
function add(e: Omit<Exercise, 'id' | 'composer' | 'style' | 'tempo' | 'timeSignature' | 'targetBpm'> & { targetBpm?: number; tempo?: number }) {
  n++;
  const target = e.targetBpm ?? TARGET[e.level];
  out.push({
    id: `ex-${String(n).padStart(3, '0')}`,
    composer: 'Exercice',
    style: 'Exercices',
    timeSignature: [4, 4],
    tempo: e.tempo ?? Math.max(50, target - 12),
    targetBpm: target,
    ...e,
  } as Exercise);
}

// 1. Gammes majeures, 1 octave (12)
for (const k of MAJOR_KEYS)
  add({ title: `Gamme de ${FR[k.name]} majeur`, category: 'Gammes majeures', level: k.level, key: keySig(k), how: 'Lente et juste, chaque note tenue jusqu’au vert.', notation: pack([...seq(updown(MAJOR, k.root), 1), { midi: k.root, d: 1 }], k.flat) });
// 2. Gammes majeures, 2 octaves (6)
for (const k of MAJOR_KEYS.filter((x) => ['G', 'A', 'Bb', 'B', 'C', 'D'].includes(x.name)))
  add({ title: `Gamme de ${FR[k.name]} majeur, 2 octaves`, category: 'Gammes majeures', level: Math.min(5, k.level + 2) as Key['level'], key: keySig(k), how: 'En croches, démanché propre si besoin.', notation: pack(seq(twoOct(MAJOR, k.root), 0.5), k.flat) });
// 3-5. Gammes mineures : naturelle, harmonique, mélodique (24)
for (const [label, steps, cat] of [
  ['naturelle', NAT_MIN, 'Gammes mineures'],
  ['harmonique', HARM_MIN, 'Gammes mineures'],
  ['mélodique', MEL_MIN_UP, 'Gammes mineures'],
] as const) {
  for (const k of MINOR_KEYS) {
    const up = steps.map((s) => k.root + s);
    // Mélodique : montée mélodique, descente naturelle.
    const down = (label === 'mélodique' ? NAT_MIN : steps).map((s) => k.root + s).slice(0, -1).reverse();
    add({ title: `Gamme de ${FR[k.name]} mineur ${label}`, category: cat, level: Math.min(5, k.level + (label === 'naturelle' ? 0 : 1)) as Key['level'], key: keySig(k, true), how: label === 'mélodique' ? 'Montée avec 6te et 7e haussées, descente naturelle.' : label === 'harmonique' ? 'Attention à la seconde augmentée entre 6e et 7e degré.' : 'Mêmes notes que la gamme majeure relative.', notation: pack([...seq([...up, ...down], 1), { midi: k.root, d: 1 }], k.flat) });
  }
}
// 6. Arpèges majeurs (12) et mineurs (8)
for (const k of MAJOR_KEYS)
  add({ title: `Arpège de ${FR[k.name]} majeur`, category: 'Arpèges', level: k.level, key: keySig(k), how: 'Doigts posés, notes bien liées.', notation: pack(seq(updown([0, 4, 7, 12], k.root), 1), k.flat) });
for (const k of MINOR_KEYS)
  add({ title: `Arpège de ${FR[k.name]} mineur`, category: 'Arpèges', level: k.level, key: keySig(k, true), how: 'Écoute la tierce mineure.', notation: pack(seq(updown([0, 3, 7, 12], k.root), 1), k.flat) });
// 7. Arpèges sur 2 octaves (6)
for (const k of MAJOR_KEYS.slice(0, 6))
  add({ title: `Arpège de ${FR[k.name]} majeur, 2 octaves`, category: 'Arpèges', level: Math.min(5, k.level + 2) as Key['level'], key: keySig(k), how: 'Croches régulières.', notation: pack(seq(updown([0, 4, 7, 12, 16, 19, 24], k.root), 0.5), k.flat) });
// 8. Gammes en tierces (8)
for (const k of MAJOR_KEYS.slice(0, 8)) {
  const sc = [...MAJOR, 14, 16].map((s) => k.root + s);
  const notes: number[] = [];
  for (let i = 0; i + 2 < sc.length; i++) notes.push(sc[i], sc[i + 2]);
  add({ title: `Tierces en ${FR[k.name]} majeur`, category: 'Tierces et séquences', level: Math.min(5, k.level + 1) as Key['level'], key: keySig(k), how: 'Note de la gamme puis sa tierce, en croches.', notation: pack(seq(notes, 0.5), k.flat) });
}
// 9. Séquences par groupes de 4 (8)
for (const k of MAJOR_KEYS.slice(0, 8)) {
  const sc = [...MAJOR, 14, 16, 17].map((s) => k.root + s);
  const notes: number[] = [];
  for (let i = 0; i + 3 < sc.length; i++) notes.push(sc[i], sc[i + 1], sc[i + 2], sc[i + 3]);
  add({ title: `Séquence 1-2-3-4 en ${FR[k.name]} majeur`, category: 'Tierces et séquences', level: Math.min(5, k.level + 1) as Key['level'], key: keySig(k), how: 'Groupes de 4 notes qui remontent d’un degré.', notation: pack(seq(notes, 0.5), k.flat) });
}
// 10. Rythmes de « Twinkle » sur gammes (15)
const RHYTHMS: [string, number[]][] = [
  ['Noires', [1]],
  ['Croches', [0.5, 0.5]],
  ['« Mississippi hot dog » (4 doubles + 2 croches)', [0.25, 0.25, 0.25, 0.25, 0.5, 0.5]],
  ['Noire pointée-croche', [1.5, 0.5]],
  ['Croche-2 doubles', [0.5, 0.25, 0.25]],
];
for (const [rname, pattern] of RHYTHMS)
  for (const k of MAJOR_KEYS.slice(0, 3)) {
    const notes: { midi: number; d: number }[] = [];
    for (const m of updown(MAJOR, k.root)) for (const d of pattern) notes.push({ midi: m, d });
    add({ title: `Gamme de ${FR[k.name]} : ${rname}`, category: 'Rythmes', level: (pattern.length > 2 ? 2 : 1) as Key['level'], key: keySig(k), how: 'Chaque note de la gamme répétée sur le rythme, archet / médiator régulier.', notation: pack(notes, k.flat) });
  }
// 11. Rythmes pointés et syncopes (6)
for (const k of MAJOR_KEYS.slice(0, 6)) {
  const notes: { midi: number; d: number }[] = [];
  updown(MAJOR, k.root).forEach((m, i) => notes.push({ midi: m, d: i % 2 ? 0.25 : 0.75 }));
  add({ title: `Gamme de ${FR[k.name]} en rythme pointé`, category: 'Rythmes', level: Math.min(5, k.level + 1) as Key['level'], key: keySig(k), how: 'Croche pointée-double croche, sans précipiter la double.', notation: pack(notes, k.flat) });
}
// 12. Justesse : notes longues (6)
for (const k of MAJOR_KEYS.slice(0, 6))
  add({ title: `Notes longues en ${FR[k.name]} majeur`, category: 'Justesse', level: 1, key: keySig(k), targetBpm: 60, tempo: 60, how: 'Rondes : son régulier, aiguille au centre du début à la fin.', notation: pack(seq(MAJOR.map((s) => k.root + s), 4), k.flat) });
// 13. Intervalles (12)
for (const [iname, iv] of [
  ['tierces', 4],
  ['quartes', 5],
  ['quintes', 7],
  ['sixtes', 9],
  ['octaves', 12],
  ['secondes', 2],
] as const)
  for (const k of [MAJOR_KEYS[0], MAJOR_KEYS[1]]) {
    const notes: number[] = [];
    for (const s of MAJOR.slice(0, 5)) notes.push(k.root + s, k.root + s + iv);
    add({ title: `Intervalles : ${iname} en ${FR[k.name]}`, category: 'Intervalles', level: (iv >= 9 ? 3 : 2) as Key['level'], key: keySig(k), how: 'Entends la note d’arrivée avant de la jouer.', notation: pack(seq(notes, 1), k.flat) });
  }
// 14. Chromatique (6)
for (const root of [55, 57, 60, 62, 64, 67])
  add({ title: `Chromatique depuis ${FR[SHARP[root % 12]]}`, category: 'Chromatique', level: 3, how: 'Demi-tons serrés : glisse le moins possible.', notation: pack(seq(updown(Array.from({ length: 13 }, (_, i) => i), root), 0.5), false) });
// 15. Pentatoniques majeures et mineures (10), blues (4)
for (const k of MAJOR_KEYS.slice(0, 5))
  add({ title: `Pentatonique de ${FR[k.name]} majeur`, category: 'Pentatoniques et blues', level: k.level, key: keySig(k), how: 'Cinq notes, sans demi-ton.', notation: pack(seq(updown([0, 2, 4, 7, 9, 12], k.root), 1), k.flat) });
for (const k of MINOR_KEYS.slice(0, 5))
  add({ title: `Pentatonique de ${FR[k.name]} mineur`, category: 'Pentatoniques et blues', level: k.level, key: keySig(k, true), how: 'La gamme du blues et du rock.', notation: pack(seq(updown([0, 3, 5, 7, 10, 12], k.root), 1), k.flat) });
for (const k of [MINOR_KEYS[0], MINOR_KEYS[1], MINOR_KEYS[2], MINOR_KEYS[3]])
  add({ title: `Gamme blues de ${FR[k.name]}`, category: 'Pentatoniques et blues', level: 2, key: keySig(k, true), how: 'Avec la « blue note » (quinte diminuée).', notation: pack(seq(updown([0, 3, 5, 6, 7, 10, 12], k.root), 0.5), k.flat) });
// 16. Modes (6)
for (const [mname, steps] of [
  ['dorien', [0, 2, 3, 5, 7, 9, 10, 12]],
  ['mixolydien', [0, 2, 4, 5, 7, 9, 10, 12]],
  ['lydien', [0, 2, 4, 6, 7, 9, 11, 12]],
] as const)
  for (const k of [MAJOR_KEYS[1], MAJOR_KEYS[0]])
    add({ title: `Mode ${mname} sur ${FR[k.name]}`, category: 'Modes', level: 3, how: 'Compare avec la gamme majeure : une seule note change.', notation: pack(seq(updown([...steps], k.root), 1), false) });
// 17. Doubles croches rapides (8)
for (const k of MAJOR_KEYS.slice(0, 8))
  add({ title: `Gamme de ${FR[k.name]} en doubles croches`, category: 'Vélocité', level: Math.min(5, k.level + 2) as Key['level'], key: keySig(k), targetBpm: TARGET[Math.min(5, k.level + 2)] - 12, how: 'Commence lentement, monte de 4 BPM après 3 passages propres.', notation: pack(seq(updown(MAJOR, k.root), 0.25), k.flat) });

// ---------- Violon ----------
const OPEN = { G: 55, D: 62, A: 69, E: 76 } as const;
const STR = ['G', 'D', 'A', 'E'] as const;
const STR_FR = { G: 'Sol', D: 'Ré', A: 'La', E: 'Mi' };
// 18. Cordes à vide et passages de cordes (10)
for (let i = 0; i < 3; i++) {
  const a = OPEN[STR[i]];
  const b = OPEN[STR[i + 1]];
  add({ title: `Passage de cordes ${STR_FR[STR[i]]}–${STR_FR[STR[i + 1]]}`, category: 'Archet et cordes à vide', level: 1, only: 'violin', how: 'Le bras change de plan avant la note, pas pendant.', notation: pack(seq([a, b, a, b, a, b, a, b, a, a, b, b, a, a, b, b], 0.5), false) });
  add({ title: `Passage de cordes ${STR_FR[STR[i]]}–${STR_FR[STR[i + 1]]} en doubles`, category: 'Archet et cordes à vide', level: 2, only: 'violin', how: 'Poignet souple, archet au milieu.', notation: pack(seq(Array.from({ length: 16 }, (_, j) => (j % 2 ? b : a)), 0.25), false) });
}
for (const s of STR)
  add({ title: `Archets longs sur la corde de ${STR_FR[s]}`, category: 'Archet et cordes à vide', level: 1, only: 'violin', targetBpm: 60, tempo: 60, how: 'Une ronde par archet, du talon à la pointe, son égal.', notation: pack(seq([OPEN[s], OPEN[s], OPEN[s], OPEN[s]], 4), false) });
// 19. Schémas de doigts sur chaque corde (12)
for (const s of STR)
  for (const [pname, steps, lvl] of [
    ['2 haut (comme La majeur)', [0, 2, 4, 5, 7], 1],
    ['2 bas (comme Do majeur)', [0, 2, 3, 5, 7], 2],
    ['3 haut', [0, 2, 4, 6, 7], 3],
  ] as const)
    add({ title: `Schéma ${pname}, corde de ${STR_FR[s]}`, category: 'Schémas de doigts', level: lvl, only: 'violin', how: 'Doigts posés et gardés, cadre de main stable.', notation: pack(seq(updown([...steps], OPEN[s]).concat(OPEN[s]), 1), false) });
// 20. Démanchés 1re → 3e position (8)
for (const s of STR) {
  const o = OPEN[s];
  add({ title: `Démanché 1re → 3e position (1er doigt), corde de ${STR_FR[s]}`, category: 'Démanchés', level: 3, only: 'violin', how: 'Glisse avec le doigt qui joue, pouce et main ensemble.', notation: pack(seq([o + 2, o + 5, o + 2, o + 5, o + 2, o + 4, o + 5, o + 7, o + 5, o + 4, o + 2, o + 2], 1), false) });
  add({ title: `Démanché 1re → 3e position (gamme), corde de ${STR_FR[s]}`, category: 'Démanchés', level: 4, only: 'violin', how: 'Une octave sur une seule corde : 0-1-2-3, démanché, 1-2-3-4.', notation: pack(seq(updown([0, 2, 4, 5, 7, 9, 11, 12], o), 1), false) });
}

// ---------- Guitare ----------
// 21. Spider (8)
const SPIDERS: [string, number[], number][] = [
  ['1-2-3-4', [0, 1, 2, 3], 1],
  ['4-3-2-1', [3, 2, 1, 0], 1],
  ['1-3-2-4', [0, 2, 1, 3], 2],
  ['1-2-4-3', [0, 1, 3, 2], 2],
  ['1-4-2-3', [0, 3, 1, 2], 3],
  ['2-1-4-3', [1, 0, 3, 2], 3],
  ['1-3-4-2', [0, 2, 3, 1], 4],
  ['4-2-3-1', [3, 1, 2, 0], 4],
];
const GSTR = [40, 45, 50, 55, 59, 64];
for (const [sname, pat, lvl] of SPIDERS) {
  const notes: number[] = [];
  for (const open of GSTR) for (const f of pat) notes.push(open + 1 + f);
  add({ title: `Spider ${sname}`, category: 'Spider et doigts', level: lvl as Key['level'], only: 'guitar', how: 'Un doigt par case (cases 1 à 4), de la corde grave à l’aiguë.', notation: pack(seq(notes, 0.5), false) });
}
// 22. Arpèges aux doigts p-i-m-a (8)
for (const [cname, chord] of [
  ['Do', [48, 52, 55, 60]],
  ['La mineur', [45, 52, 57, 60]],
  ['Sol', [43, 50, 55, 59]],
  ['Mi mineur', [40, 47, 52, 55]],
  ['Ré', [50, 57, 62, 66]],
  ['La', [45, 52, 57, 61]],
  ['Mi', [40, 47, 52, 56]],
  ['Fa (petit barré)', [53, 57, 60, 65]],
] as const) {
  const notes: number[] = [];
  for (let r = 0; r < 4; r++) notes.push(...chord, chord[2], chord[1]);
  add({ title: `Arpège p-i-m-a sur ${cname}`, category: 'Arpèges aux doigts', level: (cname.startsWith('Fa') ? 3 : 1) as Key['level'], only: 'guitar', how: 'Pouce sur la basse, i-m-a sur les cordes aiguës, accord tenu.', notation: pack(seq(notes, 0.5), false) });
}

export const EXERCISE_BANK: Exercise[] = out;

export function exercisesFor(inst: InstrumentId): Exercise[] {
  return out.filter((e) => !e.only || e.only === inst);
}

export const EXERCISE_CATEGORIES = [...new Set(out.map((e) => e.category))];
