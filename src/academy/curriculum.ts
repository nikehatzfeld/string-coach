import type { Exercise } from '../songs/exercise-bank';

/**
 * Parcours violon : plusieurs centaines d'exercices générés (exacts par construction), rangés en
 * 12 paliers (du débutant qui sait tenir l'archet jusqu'au niveau expert) et 7 domaines.
 * Progression inspirée des méthodes classiques (cadres de main type Suzuki/Rolland, doigts de Ševčík op. 1,
 * démanchés op. 8, système de gammes à la Flesch/Galamian), sans reproduire aucun recueil.
 * Chaque unité a un exercice « clé » : valider toutes les clés d'un palier ouvre le suivant.
 */

export type Domain = 'intonation' | 'bow' | 'fingers' | 'positions' | 'scales' | 'rhythm' | 'double';

export const DOMAINS: { id: Domain; label: string; icon: string; what: string }[] = [
  { id: 'intonation', label: 'Justesse', icon: '🎯', what: 'Notes longues, intervalles, cadres de main' },
  { id: 'bow', label: 'Archet', icon: '🏹', what: 'Son, passages de cordes, coups d’archet' },
  { id: 'fingers', label: 'Doigts', icon: '✋', what: 'Indépendance, trilles, permutations, extensions' },
  { id: 'positions', label: 'Positions', icon: '🧗', what: 'Positions et démanchés' },
  { id: 'scales', label: 'Gammes', icon: '🎼', what: 'Gammes et arpèges, 1 à 3 octaves' },
  { id: 'rhythm', label: 'Rythme', icon: '⏱', what: 'Subdivisions, rythmes pointés, vitesse' },
  { id: 'double', label: 'Doubles cordes', icon: '🎻', what: 'Tierces, sixtes, octaves (préparées brisées)' },
];

export const STAGES = [
  { n: 1, name: 'Premiers sons', level: 'Débutant' },
  { n: 2, name: 'La main se place', level: 'Débutant' },
  { n: 3, name: 'Toute la 1re position', level: 'Débutant +' },
  { n: 4, name: 'Tonalités et rythmes', level: 'Intermédiaire −' },
  { n: 5, name: 'La 3e position', level: 'Intermédiaire' },
  { n: 6, name: 'Démanchés et doubles cordes', level: 'Intermédiaire' },
  { n: 7, name: 'La 5e position', level: 'Intermédiaire +' },
  { n: 8, name: 'Trois octaves', level: 'Avancé' },
  { n: 9, name: 'Positions hautes', level: 'Avancé +' },
  { n: 10, name: 'Virtuosité I', level: 'Expert' },
  { n: 11, name: 'Virtuosité II', level: 'Expert +' },
  { n: 12, name: 'Concertiste', level: 'Virtuose' },
] as const;

export interface VExercise extends Exercise {
  stage: number;
  domain: Domain;
  /** Unité (groupe d'exercices du même type). */
  unit: string;
  /** Exercice clé de l'unité (obligatoire pour passer le palier). */
  core?: boolean;
  /** Rang dans tout le parcours (1 = premier). */
  rank: number;
}

// ---------- Outils de notation ----------
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR: Record<string, string> = { C: 'Do', 'C#': 'Do♯', Db: 'Ré♭', D: 'Ré', Eb: 'Mi♭', E: 'Mi', F: 'Fa', 'F#': 'Fa♯', Gb: 'Sol♭', G: 'Sol', Ab: 'La♭', A: 'La', Bb: 'Si♭', B: 'Si' };
const tok = (m: number, flat: boolean) => `${(flat ? FLATN : SHARP)[m % 12]}${Math.floor(m / 12) - 1}`;
const DUR: Record<string, string> = { '4': '1', '3': '2.', '2': '2', '1.5': '4.', '1': '4', '0.75': '8.', '0.5': '8', '0.25': '16' };

type N = { m: number | null; d: number };
/** Notes → mesures de 4/4 complètes (silences ajoutés en fin de mesure). */
function pack(notes: N[], flat = false): string {
  const bars: string[][] = [[]];
  let acc = 0;
  const fill = (rest: number) => {
    for (const v of [2, 1, 0.5, 0.25])
      while (rest >= v - 1e-6) {
        bars[bars.length - 1].push(`r:${DUR[String(v)]}`);
        rest -= v;
      }
  };
  for (const n of notes) {
    if (acc + n.d > 4 + 1e-6) {
      fill(4 - acc);
      bars.push([]);
      acc = 0;
    }
    bars[bars.length - 1].push(`${n.m === null ? 'r' : tok(n.m, flat)}:${DUR[String(n.d)]}`);
    acc += n.d;
    if (Math.abs(acc - 4) < 1e-6) {
      bars.push([]);
      acc = 0;
    }
  }
  if (acc > 1e-6) fill(4 - acc);
  return bars.filter((b) => b.length).map((b) => b.join(' ')).join(' | ');
}
const seq = (ms: number[], d: number): N[] => ms.map((m) => ({ m, d }));
const rep = <T,>(a: T[], k: number): T[] => Array.from({ length: k }, () => a).flat();
const updown = (ms: number[]) => [...ms, ...ms.slice(0, -1).reverse()];

// Cordes du violon (MIDI)
const G3 = 55, D4 = 62, A4 = 69, E5 = 76;
const OPEN = [G3, D4, A4, E5];
const SN = ['Sol', 'Ré', 'La', 'Mi'];

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const NMIN = [0, 2, 3, 5, 7, 8, 10];
const HMIN = [0, 2, 3, 5, 7, 8, 11];
const MMIN = [0, 2, 3, 5, 7, 9, 11];
/** Gamme sur n octaves (montée). */
const scaleUp = (root: number, steps: number[], oct: number) => {
  const out: number[] = [];
  for (let o = 0; o < oct; o++) for (const s of steps) out.push(root + 12 * o + s);
  out.push(root + 12 * oct);
  return out;
};
const arpUp = (root: number, minor: boolean, oct: number) => {
  const out: number[] = [];
  for (let o = 0; o < oct; o++) out.push(root + 12 * o, root + 12 * o + (minor ? 3 : 4), root + 12 * o + 7);
  out.push(root + 12 * oct);
  return out;
};

interface Key {
  n: string;
  root: number;
  flat: boolean;
  minor?: boolean;
}
const K = (n: string, root: number, flat = false, minor = false): Key => ({ n, root, flat, minor });
const kname = (k: Key) => `${FR[k.n]} ${k.minor ? 'mineur' : 'majeur'}`;
const keySig = (k: Key) => (k.minor ? `${k.n.toLowerCase()}minor` : k.n);

// ---------- Construction ----------
const ALL: Omit<VExercise, 'rank'>[] = [];
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/♯/g, 'd')
    .replace(/♭/g, 'b')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface Item {
  title: string;
  how: string;
  notes: N[];
  bpm: number;
  flat?: boolean;
  key?: string;
  string?: number;
  position?: number;
}
/** Une unité : plusieurs variantes d'un même travail ; la première est la clé du palier. */
function unit(stage: number, domain: Domain, name: string, items: Item[]) {
  items.forEach((it, i) =>
    ALL.push({
      id: `vn-${slug(it.title)}`,
      title: it.title,
      composer: 'Parcours violon',
      style: 'Exercices',
      category: DOMAINS.find((d) => d.id === domain)!.label,
      level: Math.min(5, Math.max(1, Math.ceil(stage / 2.4))) as 1,
      tempo: Math.max(40, Math.round(it.bpm * 0.75)),
      targetBpm: it.bpm,
      timeSignature: [4, 4],
      only: 'violin',
      how: it.how,
      notation: pack(it.notes, it.flat),
      ...(it.key ? { key: it.key } : {}),
      ...(it.string ? { string: it.string } : {}),
      ...(it.position ? { position: it.position } : {}),
      stage,
      domain,
      unit: name,
      ...(i === 0 ? { core: true } : {}),
    }),
  );
}

// ===== PALIER 1 : cordes à vide, premiers doigts =====
unit(1, 'bow', 'Cordes à vide', [
  ...OPEN.map((o, s) => ({ title: `Cordes à vide : ${SN[s]} en noires`, how: 'Archet droit, parallèle au chevalet, entre la touche et le chevalet. Son plein et égal.', notes: seq(rep([o], 16), 1), bpm: 72, string: 4 - s })),
  ...OPEN.map((o, s) => ({ title: `Cordes à vide : ${SN[s]} en blanches`, how: 'Une blanche par archet : moitié d’archet, vitesse constante.', notes: seq(rep([o], 8), 2), bpm: 66, string: 4 - s })),
  ...OPEN.map((o, s) => ({ title: `Archets entiers sur ${SN[s]}`, how: 'Une ronde par archet, du talon à la pointe. Compte 4 temps, son égal du début à la fin.', notes: seq(rep([o], 4), 4), bpm: 60, string: 4 - s })),
]);
unit(1, 'bow', 'Passages de cordes voisines', [0, 1, 2].map((i) => ({ title: `Passage ${SN[i]}–${SN[i + 1]} en noires`, how: 'Change de plan avec le bras avant la note, pas pendant. Deux notes par corde.', notes: seq(rep([OPEN[i], OPEN[i], OPEN[i + 1], OPEN[i + 1]], 4), 1), bpm: 66 })));
unit(1, 'fingers', 'Premiers doigts (schéma 2 haut)', [D4, A4].flatMap((o, i) => [
  { title: `Doigts 0-1-2-3 sur ${SN[i + 1]}`, how: 'Doigts arrondis, bout du doigt. 2e doigt collé au 3e (schéma « 2 haut »).', notes: seq(updown([o, o + 2, o + 4, o + 5]), 1), bpm: 60, string: 3 - i },
  { title: `Doigts posés 0-1-2-3 sur ${SN[i + 1]} en blanches`, how: 'Laisse chaque doigt posé quand le suivant arrive.', notes: seq(updown([o, o + 2, o + 4, o + 5]), 2), bpm: 60, string: 3 - i },
]));
unit(1, 'intonation', 'Notes longues avec la corde voisine', [
  { title: 'Résonance : 3e doigt contre la corde à vide', how: 'Corde à vide, puis la même note à l’octave avec le 3e doigt sur la corde voisine : si c’est juste, la corde à vide se met à vibrer toute seule.', notes: seq([G3, D4 + 5, G3, D4 + 5, D4, A4 + 5, D4, A4 + 5], 2), bpm: 60 },
  { title: 'Notes longues : La majeur sur La', how: 'Rondes. Garde l’aiguille au centre pendant toute la note.', notes: seq([A4, A4 + 2, A4 + 4, A4 + 5, A4 + 7], 4), bpm: 60, string: 2 },
  { title: 'Notes longues : Ré majeur sur Ré', how: 'Rondes. Le 3e doigt (Sol) doit faire vibrer la corde de Sol à vide.', notes: seq([D4, D4 + 2, D4 + 4, D4 + 5, D4 + 7], 4), bpm: 60, string: 3 },
]);
unit(1, 'scales', 'Gamme de Ré majeur, 1 octave', [
  { title: 'Ré majeur, 1 octave, en noires', how: 'Corde de Ré puis corde de La, schéma 2 haut sur les deux.', notes: seq(updown(scaleUp(D4, MAJ, 1)), 1), bpm: 60, key: 'D' },
  { title: 'Ré majeur, 1 octave, en blanches', how: 'Lent : chaque note bien juste avant de passer à la suivante.', notes: seq(updown(scaleUp(D4, MAJ, 1)), 2), bpm: 60, key: 'D' },
  { title: 'La majeur, 1 octave, en noires', how: 'Corde de La puis corde de Mi.', notes: seq(updown(scaleUp(A4, MAJ, 1)), 1), bpm: 60, key: 'A' },
]);
unit(1, 'rhythm', 'Noires et blanches', [
  { title: 'Rythme noire-noire-blanche sur La', how: 'Deux archets courts, un long : la blanche dure deux fois plus.', notes: seq(rep([A4, A4], 4), 1).flatMap((n, i) => (i % 2 ? [n, { m: A4, d: 2 }] : [n])).slice(0, 12), bpm: 66, string: 2 },
  { title: 'Rythme blanche-noire-noire sur Ré', how: 'Compte à voix haute : « 1-2, 3, 4 ».', notes: rep([{ m: D4, d: 2 }, { m: D4, d: 1 }, { m: D4, d: 1 }], 4), bpm: 66, string: 3 },
]);

// ===== PALIER 2 : schémas de doigts, Sol et La majeur =====
const PAT = {
  '2 haut': [0, 2, 4, 5, 7],
  '2 bas': [0, 2, 3, 5, 7],
  '3 haut': [0, 2, 4, 6, 7],
  '1 bas': [0, 1, 3, 5, 6],
  '4 bas': [0, 2, 4, 5, 6],
} as const;
unit(2, 'fingers', 'Schéma 2 haut sur les 4 cordes', OPEN.map((o, s) => ({ title: `Schéma 2 haut sur ${SN[s]}`, how: '0-1-2-3-4 : demi-ton entre 2 et 3. Le 4e doigt donne la même note que la corde à vide suivante.', notes: seq(updown([...PAT['2 haut']].map((x) => o + x)), 1), bpm: 66, string: 4 - s })));
unit(2, 'fingers', 'Schéma 2 bas sur les 4 cordes', OPEN.map((o, s) => ({ title: `Schéma 2 bas sur ${SN[s]}`, how: 'Le 2e doigt recule contre le 1er : demi-ton entre 1 et 2.', notes: seq(updown([...PAT['2 bas']].map((x) => o + x)), 1), bpm: 66, string: 4 - s })));
unit(2, 'bow', 'Croches sur cordes à vide', OPEN.map((o, s) => ({ title: `Croches sur ${SN[s]} à vide`, how: 'Au milieu de l’archet, petits archets égaux, sans accent.', notes: seq(rep([o], 16), 0.5), bpm: 72, string: 4 - s })));
unit(2, 'bow', 'Croisements de cordes en croches', [0, 1, 2].map((i) => ({ title: `Croisements ${SN[i]}–${SN[i + 1]} en croches`, how: 'Une note par corde, en alternance : le coude guide, le poignet suit.', notes: seq(rep([OPEN[i], OPEN[i + 1]], 8), 0.5), bpm: 66 })));
unit(2, 'scales', 'Gammes 1 octave (Sol, La, Ré)', [
  { title: 'Sol majeur, 1 octave', how: 'Corde de Sol puis de Ré : schéma 2 haut.', notes: seq(updown(scaleUp(G3, MAJ, 1)), 1), bpm: 72, key: 'G' },
  { title: 'Ré majeur, 1 octave, en croches', how: 'Deux croches par note de la gamme.', notes: seq(updown(scaleUp(D4, MAJ, 1)).flatMap((m) => [m, m]), 0.5), bpm: 66, key: 'D' },
  { title: 'La majeur, 1 octave, en croches', how: 'Deux croches par note.', notes: seq(updown(scaleUp(A4, MAJ, 1)).flatMap((m) => [m, m]), 0.5), bpm: 66, key: 'A' },
  { title: 'Do majeur, 1 octave (schéma 2 bas)', how: 'Commence au 3e doigt sur Sol. Attention au Fa (2 bas sur Ré) et au Do (2 bas sur La).', notes: seq(updown(scaleUp(60, MAJ, 1)), 1), bpm: 66, key: 'C' },
]);
unit(2, 'scales', 'Arpèges 1 octave', [
  { title: 'Arpège de Ré majeur, 1 octave', how: 'Ré-Fa♯-La-Ré : écoute la tierce majeure.', notes: seq(updown(arpUp(D4, false, 1)), 1), bpm: 66, key: 'D' },
  { title: 'Arpège de La majeur, 1 octave', how: 'La-Do♯-Mi-La.', notes: seq(updown(arpUp(A4 - 12, false, 1)), 1), bpm: 66, key: 'A' },
  { title: 'Arpège de Sol majeur, 1 octave', how: 'Sol-Si-Ré-Sol.', notes: seq(updown(arpUp(G3, false, 1)), 1), bpm: 66, key: 'G' },
]);
unit(2, 'intonation', 'Notes longues en Sol majeur', [
  { title: 'Notes longues : Sol majeur', how: 'Rondes. Sol, Ré et La ont une corde à vide : fais-les résonner.', notes: seq(scaleUp(G3, MAJ, 1), 4), bpm: 60, key: 'G' },
  { title: 'Octaves avec la corde à vide', how: 'Corde à vide, puis la même note une octave plus haut (4e doigt deux cordes plus loin) : elles doivent fusionner.', notes: seq([G3, G3 + 12, D4, D4 + 12, A4, A4 + 12], 2), bpm: 60 },
]);
unit(2, 'rhythm', 'Croches et noires', [
  { title: 'Noire-2 croches sur la gamme de Ré', how: 'Chaque note de la gamme : une noire puis deux croches.', notes: updown(scaleUp(D4, MAJ, 1)).flatMap((m) => [{ m, d: 1 }, { m, d: 0.5 }, { m, d: 0.5 }]), bpm: 66, key: 'D' },
  { title: '« Mis-si-ssip-pi » sur La à vide puis gamme de La', how: 'Quatre doubles croches + deux croches : rythme classique de la méthode Suzuki.', notes: updown(scaleUp(A4 - 12, MAJ, 1)).flatMap((m) => [...seq([m, m, m, m], 0.25), ...seq([m, m], 0.5)]), bpm: 60, key: 'A' },
]);

// ===== PALIER 3 : toute la 1re position =====
for (const [pname, lvl] of [['3 haut', 3], ['1 bas', 3], ['4 bas', 3]] as const)
  unit(lvl, 'fingers', `Schéma ${pname}`, OPEN.map((o, s) => ({ title: `Schéma ${pname} sur ${SN[s]}`, how: pname === '3 haut' ? 'Le 3e doigt avance (Do♯ sur La, Sol♯ sur Ré…) : un ton entre 2 et 3.' : pname === '1 bas' ? 'Le 1er doigt recule contre le sillet (Si♭ sur La, Mi♭ sur Ré…).' : 'Le 4e doigt recule d’un demi-ton.', notes: seq(updown([...PAT[pname]].map((x) => o + x)), 1), bpm: 72, string: 4 - s })));
unit(3, 'fingers', 'Doigts posés (schémas combinés)', OPEN.map((o, s) => ({ title: `Doigts posés 1-2-3-4-3-2 sur ${SN[s]}`, how: 'Garde les doigts du bas posés ; ne lève que celui qui part.', notes: seq(rep([o + 2, o + 4, o + 5, o + 7, o + 5, o + 4, o + 2, o], 3), 0.5), bpm: 66, string: 4 - s })));
const KEYS_1POS_2OCT = [K('G', G3), K('A', 57), K('Bb', 58, true)];
unit(3, 'scales', 'Gammes sur 2 octaves en 1re position', KEYS_1POS_2OCT.map((k) => ({ title: `${kname(k)}, 2 octaves (1re position)`, how: 'Tout en 1re position : sur la corde de Mi, le 4e doigt monte jusqu’au Si.', notes: seq(updown(scaleUp(k.root, MAJ, 2)), 1), bpm: 72, flat: k.flat, key: keySig(k) })));
const MIN1 = [K('A', 57, false, true), K('E', 64, false, true), K('D', D4, true, true), K('G', G3, true, true)];
unit(3, 'scales', 'Gammes mineures naturelles', MIN1.map((k) => ({ title: `${kname(k)} naturel`, how: 'Mêmes notes que la gamme majeure relative (une tierce mineure au-dessus).', notes: seq(updown(scaleUp(k.root, NMIN, 1)), 1), bpm: 72, flat: k.flat, key: keySig(k) })));
unit(3, 'bow', 'Arpèges sur cordes à vide', [
  { title: 'Arpège Sol-Ré-La-Mi en noires', how: 'Le bras dessine un arc régulier d’une corde à l’autre.', notes: seq(rep(updown(OPEN), 2), 1), bpm: 72 },
  { title: 'Arpège Sol-Ré-La-Mi en croches', how: 'Arc régulier, coude au niveau de la corde jouée.', notes: seq(rep(updown(OPEN), 3), 0.5), bpm: 66 },
  { title: 'Bariolage Ré-La en croches', how: 'Une note doigtée sur Ré, puis La à vide, en alternance.', notes: seq([62, 69, 64, 69, 66, 69, 67, 69, 69, 69, 67, 69, 66, 69, 64, 69], 0.5), bpm: 66 },
]);
unit(3, 'intonation', 'Intervalles en 1re position', [
  ['tierces', 4],
  ['quartes', 5],
  ['quintes', 7],
  ['sixtes', 9],
].map(([nm, iv]) => {
  const sc = scaleUp(G3, MAJ, 2);
  const notes: number[] = [];
  for (let i = 0; i < 7; i++) notes.push(sc[i], sc[i + ({ 4: 2, 5: 3, 7: 4, 9: 5 } as Record<number, number>)[iv as number]]);
  return { title: `Intervalles : ${nm} en Sol majeur`, how: 'Entends la seconde note dans ta tête avant de la jouer.', notes: seq(notes, 1), bpm: 66, key: 'G' };
}));
unit(3, 'rhythm', 'Rythmes pointés', [
  { title: 'Noire pointée-croche sur Ré majeur', how: 'La croche est courte : ne la précipite pas, ne la traîne pas.', notes: updown(scaleUp(D4, MAJ, 1)).flatMap((m) => [{ m, d: 1.5 }, { m, d: 0.5 }]), bpm: 66, key: 'D' },
  { title: 'Croche pointée-double sur La majeur', how: 'Rythme « sautillant » : compte en doubles croches (1-2-3, 4).', notes: updown(scaleUp(57, MAJ, 1)).flatMap((m) => [{ m, d: 0.75 }, { m, d: 0.25 }]), bpm: 60, key: 'A' },
  { title: 'Croche-2 doubles sur Sol majeur', how: '« Ta-ti-ti » sur chaque note.', notes: updown(scaleUp(G3, MAJ, 1)).flatMap((m) => [{ m, d: 0.5 }, { m, d: 0.25 }, { m, d: 0.25 }]), bpm: 60, key: 'G' },
]);

// ===== PALIER 4 : tonalités, doubles croches, mineures harmoniques =====
const KEYS_P4 = [K('C', 60), K('F', 65, true), K('E', 64), K('Bb', 58, true), K('Eb', 63, true)];
unit(4, 'scales', 'Nouvelles tonalités, 1 octave', KEYS_P4.map((k) => ({ title: `${kname(k)}, 1 octave, croches`, how: 'Repère les schémas de doigts de chaque corde avant de jouer.', notes: seq(updown(scaleUp(k.root, MAJ, 1)).flatMap((m) => [m, m]), 0.5), bpm: 80, flat: k.flat, key: keySig(k) })));
unit(4, 'scales', 'Mineures harmoniques', MIN1.map((k) => ({ title: `${kname(k)} harmonique`, how: '7e degré haussé : la seconde augmentée (6e→7e) est grande, ose l’écart.', notes: seq(updown(scaleUp(k.root, HMIN, 1)), 1), bpm: 76, flat: k.flat, key: keySig(k) })));
unit(4, 'scales', 'Arpèges majeurs et mineurs 2 octaves', [K('G', G3), K('A', 57), K('Bb', 58, true), K('G', G3, true, true), K('A', 57, false, true)].map((k) => ({ title: `Arpège de ${kname(k)}, 2 octaves`, how: 'Croches régulières, prépare chaque changement de corde.', notes: seq(updown(arpUp(k.root, !!k.minor, 2)), 0.5), bpm: 72, flat: k.flat, key: keySig(k) })));
unit(4, 'rhythm', 'Doubles croches lentes', [K('D', D4), K('G', G3), K('A', 57)].map((k) => ({ title: `${kname(k)} en doubles croches (4 par note)`, how: 'Petit archet au milieu, poignet souple. Monte le tempo seulement si tout est égal.', notes: seq(updown(scaleUp(k.root, MAJ, 1)).flatMap((m) => [m, m, m, m]), 0.25), bpm: 66, key: keySig(k) })));
unit(4, 'bow', 'Coups d’archet : détaché, liés, martelé', [
  { title: 'Ré majeur détaché en croches', how: 'Un archet par note, son continu entre les notes.', notes: seq(updown(scaleUp(D4, MAJ, 1)).flatMap((m) => [m, m]), 0.5), bpm: 80, key: 'D' },
  { title: 'Ré majeur, 2 notes liées par archet', how: 'Deux croches dans le même archet : seuls les doigts changent la note.', notes: seq(updown(scaleUp(D4, MAJ, 1)), 0.5), bpm: 72, key: 'D' },
  { title: 'Ré majeur, 4 notes liées par archet', how: 'Quatre notes par archet : répartis bien la longueur.', notes: seq(rep(updown(scaleUp(D4, MAJ, 1)), 2), 0.5), bpm: 72, key: 'D' },
  { title: 'Martelé sur La majeur', how: 'Attaque nette (« pincement » de la corde), puis relâche ; silence entre les notes.', notes: updown(scaleUp(57, MAJ, 1)).flatMap((m) => [{ m, d: 0.5 }, { m: null, d: 0.5 }]), bpm: 72, key: 'A' },
]);
unit(4, 'fingers', 'Battements de doigts lents', [[2, 4], [4, 5], [5, 7]].flatMap(([a, b], i) => [D4, A4].map((o, s) => ({ title: `Battements ${i + 1}-${i + 2} sur ${SN[s + 1]}`, how: 'Doigt du bas posé ; le doigt du haut tombe comme un marteau et se relève vite.', notes: seq(rep([o + a, o + b], 8), 0.5), bpm: 72, string: 3 - s }))));
unit(4, 'intonation', 'Chromatique en 1re position', [D4, A4].map((o, s) => ({ title: `Chromatique sur ${SN[s + 1]}`, how: 'Glisse le même doigt pour le demi-ton (1-1, 2-2…) : petits mouvements.', notes: seq(updown(Array.from({ length: 8 }, (_, i) => o + i)), 1), bpm: 66, string: 3 - s })));

// ===== PALIER 5 : 3e position =====
unit(5, 'positions', 'Gammes en 3e position (une corde)', OPEN.map((o, s) => ({ title: `3e position sur ${SN[s]} : 1-2-3-4`, how: 'Main posée en 3e position (le 1er doigt où était le 3e) ; pouce face au 1er doigt.', notes: seq(updown([o + 5, o + 7, o + 9, o + 10, o + 12]), 1), bpm: 66, string: 4 - s, position: 3 })));
unit(5, 'positions', 'Démanchés 1re ↔ 3e même doigt', OPEN.flatMap((o, s) => [
  { title: `Démanché 1→3 au 1er doigt sur ${SN[s]}`, how: 'Glisse avec le doigt qui vient de jouer, pouce et main ensemble, sans bruit d’arrivée.', notes: seq(rep([o + 2, o + 5], 6), 1), bpm: 66, string: 4 - s },
  { title: `Démanché 1→3 au 2e doigt sur ${SN[s]}`, how: 'Même geste avec le 2e doigt ; la main reste en forme.', notes: seq(rep([o + 4, o + 7], 6), 1), bpm: 66, string: 4 - s },
]));
const KEYS_3POS = [K('C', 60), K('D', D4), K('Bb', 58, true), K('A', A4 - 12)];
unit(5, 'scales', 'Gammes 2 octaves avec 3e position', KEYS_3POS.map((k) => ({ title: `${kname(k)}, 2 octaves (avec 3e position)`, how: 'Monte en 3e position sur la corde de Mi (ou de La) pour atteindre l’aigu.', notes: seq(updown(scaleUp(k.root, MAJ, 2)), 1), bpm: 72, flat: k.flat, key: keySig(k) })));
unit(5, 'rhythm', 'Syncopes', [K('G', G3), K('D', D4)].flatMap((k) => [
  { title: `Syncopes croche-noire-croche en ${kname(k)}`, how: 'La noire tombe entre les temps : garde la pulsation dans le pied.', notes: updown(scaleUp(k.root, MAJ, 1)).flatMap((m) => [{ m, d: 0.5 }, { m, d: 1 }, { m, d: 0.5 }]), bpm: 72, key: keySig(k) },
  { title: `Contretemps en ${kname(k)}`, how: 'Silence sur le temps, note sur le « et ».', notes: updown(scaleUp(k.root, MAJ, 1)).flatMap((m) => [{ m: null, d: 0.5 }, { m, d: 0.5 }]), bpm: 72, key: keySig(k) },
]));
unit(5, 'bow', 'Bariolage', [
  { title: 'Bariolage La-Mi en doubles croches', how: 'Alterne note doigtée sur La et Mi à vide ; mouvement de poignet seul.', notes: seq(rep([69, 76, 71, 76, 73, 76, 74, 76], 4), 0.25), bpm: 66 },
  { title: 'Bariolage Ré-La en doubles croches', how: 'Petit mouvement circulaire du poignet.', notes: seq(rep([62, 69, 64, 69, 66, 69, 67, 69], 4), 0.25), bpm: 66 },
  { title: 'Sauts de cordes Sol ↔ La', how: 'Passe au-dessus de la corde de Ré sans la toucher.', notes: seq(rep([G3, A4], 8), 0.5), bpm: 66 },
]);
unit(5, 'intonation', 'Notes longues en 3e position', OPEN.map((o, s) => ({ title: `Notes longues en 3e position sur ${SN[s]}`, how: 'Le 3e doigt donne l’octave de la corde à vide : vérifie-la à chaque fois.', notes: seq([o + 5, o + 7, o + 9, o + 10, o + 12], 2), bpm: 60, string: 4 - s, position: 3 })));
unit(5, 'double', 'Doubles cordes avec corde à vide (préparation)', [D4, A4].flatMap((o, s) => [
  { title: `Ré-La brisées : doigts sur ${SN[s + 1]} + corde à vide aiguë`, how: 'Joue la note doigtée puis la corde à vide, puis les deux ensemble (l’appli juge la note doigtée).', notes: seq([o, o + 7, o + 2, o + 7, o + 4, o + 7, o + 5, o + 7], 1), bpm: 66 },
]).concat([{ title: 'Quintes à vide : Sol-Ré, Ré-La, La-Mi', how: 'Deux cordes à vide en même temps, poids égal sur les deux.', notes: seq([G3, D4, G3, D4, D4, A4, D4, A4, A4, E5, A4, E5], 1), bpm: 66 }]));

// ===== PALIER 6 : 2e position, demi-position, démanchés variés, sixtes et tierces brisées =====
unit(6, 'positions', '2e position', OPEN.map((o, s) => ({ title: `2e position sur ${SN[s]}`, how: 'Le 1er doigt prend la place du 2e de la 1re position. Position sans repère : écoute bien.', notes: seq(updown([o + 3, o + 5, o + 7, o + 8, o + 10]), 1), bpm: 66, string: 4 - s, position: 2 })));
unit(6, 'positions', 'Démanchés avec changement de doigt', OPEN.flatMap((o, s) => [
  { title: `Démanché 1→2 (doigt de départ glisse) sur ${SN[s]}`, how: 'Le 1er doigt glisse jusqu’à sa nouvelle place, puis le 2e tombe : le glissé « guide » reste discret.', notes: seq(rep([o + 2, o + 9], 5), 1), bpm: 66, string: 4 - s },
  { title: `Démanché 3→1 (redescente) sur ${SN[s]}`, how: 'Redescends en gardant le pouce souple ; le 1er doigt arrive au bon endroit.', notes: seq(rep([o + 9, o + 2], 5), 1), bpm: 66, string: 4 - s },
]));
unit(6, 'scales', 'Mineures mélodiques', MIN1.map((k) => ({ title: `${kname(k)} mélodique`, how: 'Montée : 6e et 7e haussées. Descente : naturelle.', notes: seq([...scaleUp(k.root, MMIN, 1), ...scaleUp(k.root, NMIN, 1).slice(0, -1).reverse()], 1), bpm: 76, flat: k.flat, key: keySig(k) })));
unit(6, 'scales', 'Gammes 2 octaves en croches', [K('G', G3), K('A', 57), K('Bb', 58, true), K('C', 60), K('D', D4)].map((k) => ({ title: `${kname(k)}, 2 octaves en croches`, how: 'Deux notes par archet, démanchés anticipés.', notes: seq(updown(scaleUp(k.root, MAJ, 2)), 0.5), bpm: 84, flat: k.flat, key: keySig(k) })));
const brokenIv = (k: Key, iv: number, oct: number) => {
  const sc = scaleUp(k.root, k.minor ? NMIN : MAJ, oct + 1);
  const out: number[] = [];
  for (let i = 0; i + iv < sc.length && i < 7 * oct + 1; i++) out.push(sc[i], sc[i + iv]);
  return out;
};
unit(6, 'double', 'Sixtes brisées', [K('G', G3), K('D', D4), K('A', 57)].map((k) => ({ title: `Sixtes brisées en ${kname(k)}`, how: 'Note grave puis note aiguë ; prépare les deux doigts ensemble comme pour une double corde.', notes: seq(brokenIv(k, 5, 1), 0.5), bpm: 72, key: keySig(k) })));
unit(6, 'fingers', 'Trilles', OPEN.flatMap((o, s) => [[2, 4], [4, 5], [5, 7]].map(([a, b], i) => ({ title: `Trille ${i + 1}-${i + 2} sur ${SN[s]}`, how: 'Doubles croches régulières ; le doigt du haut reste près de la corde.', notes: seq(rep([o + a, o + b], 16), 0.25), bpm: 72, string: 4 - s }))));
unit(6, 'rhythm', 'Gammes en doubles croches', [K('G', G3), K('D', D4), K('A', 57), K('C', 60)].map((k) => ({ title: `${kname(k)}, 1 octave en doubles croches`, how: 'Une note par double croche, 4 par archet si tu veux.', notes: seq(rep(updown(scaleUp(k.root, MAJ, 1)), 2), 0.25), bpm: 72, key: keySig(k) })));
unit(6, 'bow', 'Spiccato (préparation)', [K('D', D4), K('G', G3)].map((k) => ({ title: `Spiccato préparé en ${kname(k)}`, how: 'Au point d’équilibre de l’archet, laisse-le rebondir : notes courtes, régulières.', notes: updown(scaleUp(k.root, MAJ, 1)).flatMap((m) => [{ m, d: 0.25 }, { m, d: 0.25 }, { m: null, d: 0.5 }]), bpm: 72, key: keySig(k) })));
unit(6, 'intonation', 'Intervalles à travers les cordes', [[7, 'quintes justes'], [12, 'octaves'], [9, 'sixtes majeures'], [3, 'tierces mineures']].map(([iv, nm]) => ({ title: `Intervalles : ${nm} depuis chaque note de Ré majeur`, how: 'Joue la note puis l’intervalle ; vérifie que l’écart est toujours le même.', notes: seq(scaleUp(D4, MAJ, 1).flatMap((m) => [m, m + (iv as number)]), 1), bpm: 66, key: 'D' })));

// ===== PALIER 7 : 5e position, tierces brisées =====
unit(7, 'positions', '5e position', OPEN.map((o, s) => ({ title: `5e position sur ${SN[s]}`, how: 'La paume touche presque l’éclisse ; pouce sous le manche.', notes: seq(updown([o + 9, o + 11, o + 12, o + 14, o + 16]), 1), bpm: 66, string: 4 - s, position: 5 })));
unit(7, 'positions', 'Démanchés 1↔5 et 3↔5', OPEN.flatMap((o, s) => [
  { title: `Démanché 1→5 au 1er doigt sur ${SN[s]}`, how: 'Grand déplacement : le bras amène la main, le doigt reste léger.', notes: seq(rep([o + 2, o + 9], 5), 1), bpm: 60, string: 4 - s },
  { title: `Démanché 3→5 au 1er doigt sur ${SN[s]}`, how: 'Petit déplacement : vise juste du premier coup.', notes: seq(rep([o + 5, o + 9], 5), 1), bpm: 66, string: 4 - s },
]));
unit(7, 'positions', 'Gamme sur une seule corde', OPEN.map((o, s) => ({ title: `Gamme majeure sur la seule corde de ${SN[s]}`, how: 'Toutes les positions sur une corde : 0-1-2, démanché, 1-2-3, démanché, 1-2-3-4.', notes: seq(updown(scaleUp(o, MAJ, 1)), 1), bpm: 66, string: 4 - s })));
unit(7, 'double', 'Tierces brisées', [K('G', G3), K('D', D4), K('A', 57), K('C', 60)].map((k) => ({ title: `Tierces brisées en ${kname(k)}, 2 octaves`, how: 'Une note puis sa tierce : prépare les doigts par paires (1-3, 2-4).', notes: seq(brokenIv(k, 2, 2), 0.5), bpm: 72, flat: k.flat, key: keySig(k) })));
unit(7, 'fingers', 'Permutations de doigts', ['1234', '1243', '1324', '1342', '1423', '1432', '2134', '2143', '2314', '3142', '3412', '4321'].map((p) => ({ title: `Permutation ${p.split('').join('-')} sur La`, how: 'Ordre inhabituel : chaque doigt devient indépendant. Lent, juste, puis accélère.', notes: seq(rep(p.split('').map((f) => A4 + [0, 2, 4, 5, 7][Number(f)]), 4), 0.25), bpm: 66, string: 2 })));
unit(7, 'scales', 'Mineures 2 octaves', [K('G', G3, true, true), K('A', 57, false, true), K('B', 59, false, true), K('C', 60, true, true), K('D', D4, true, true)].map((k) => ({ title: `${kname(k)} mélodique, 2 octaves`, how: 'Montée mélodique, descente naturelle.', notes: seq([...scaleUp(k.root, MMIN, 2), ...scaleUp(k.root, NMIN, 2).slice(0, -1).reverse()], 0.5), bpm: 80, flat: k.flat, key: keySig(k) })));
unit(7, 'rhythm', 'Vitesse : doubles croches 2 octaves', [K('G', G3), K('A', 57), K('Bb', 58, true)].map((k) => ({ title: `${kname(k)}, 2 octaves en doubles croches`, how: 'Commence 20 BPM sous la cible, monte de 4 après 3 passages propres.', notes: seq(updown(scaleUp(k.root, MAJ, 2)), 0.25), bpm: 80, flat: k.flat, key: keySig(k) })));
unit(7, 'bow', 'Arpèges sur 3 et 4 cordes', [K('G', G3), K('C', 60), K('D', D4), K('A', 57, false, true)].map((k) => ({ title: `Arpège ${kname(k)} sur 3 cordes en doubles croches`, how: 'Mouvement d’arc régulier : le bras dessine, les doigts restent posés sur l’accord.', notes: seq(rep(updown(arpUp(k.root, !!k.minor, 1)).slice(0, 6), 4), 0.25), bpm: 72, key: keySig(k) })));
unit(7, 'intonation', 'Justesse en 5e position', OPEN.map((o, s) => ({ title: `Notes longues en 5e position sur ${SN[s]}`, how: 'Les demi-tons sont plus serrés en haut du manche : rapproche les doigts.', notes: seq([o + 9, o + 11, o + 12, o + 14, o + 16], 2), bpm: 60, string: 4 - s, position: 5 })));

// ===== PALIER 8 : trois octaves =====
const KEYS_3OCT = [K('G', G3), K('A', 57), K('Bb', 58, true), K('B', 59), K('C', 60), K('D', D4)];
unit(8, 'scales', 'Gammes 3 octaves (lentes)', KEYS_3OCT.map((k) => ({ title: `${kname(k)}, 3 octaves en noires`, how: 'Doigtés classiques : démanchés sur les mêmes notes à chaque fois, le plus souvent au 1er doigt.', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 1), bpm: 72, flat: k.flat, key: keySig(k) })));
unit(8, 'scales', 'Arpèges 3 octaves', KEYS_3OCT.slice(0, 4).flatMap((k) => [
  { title: `Arpège de ${kname(k)}, 3 octaves`, how: 'Démanchés entre les notes de l’accord : vise la note d’arrivée.', notes: seq(updown(arpUp(k.root, false, 3)), 0.5), bpm: 72, flat: k.flat, key: keySig(k) },
  { title: `Arpège de ${FR[k.n]} mineur, 3 octaves`, how: 'Tierce mineure : un doigt plus bas qu’en majeur.', notes: seq(updown(arpUp(k.root, true, 3)), 0.5), bpm: 72, flat: true, key: `${k.n.toLowerCase()}minor` },
]));
unit(8, 'positions', '4e position', OPEN.map((o, s) => ({ title: `4e position sur ${SN[s]}`, how: 'Le pouce touche le talon du manche ; la main ne doit pas se crisper.', notes: seq(updown([o + 7, o + 9, o + 11, o + 12, o + 14]), 1), bpm: 66, string: 4 - s, position: 4 })));
unit(8, 'double', 'Sixtes et tierces brisées 2 octaves', [K('Bb', 58, true), K('D', D4), K('E', 64)].flatMap((k) => [
  { title: `Sixtes brisées en ${kname(k)}, 2 octaves`, how: 'Prépare la sixte (doigts croisés sur deux cordes).', notes: seq(brokenIv(k, 5, 2), 0.5), bpm: 76, flat: k.flat, key: keySig(k) },
  { title: `Tierces brisées en ${kname(k)}, 2 octaves en doubles`, how: 'Doubles croches, doigts par paires.', notes: seq(brokenIv(k, 2, 2), 0.25), bpm: 66, flat: k.flat, key: keySig(k) },
]));
unit(8, 'rhythm', 'Vitesse : 2 octaves en doubles croches', [K('C', 60), K('D', D4), K('E', 64), K('F', 65, true)].map((k) => ({ title: `${kname(k)}, 2 octaves en doubles croches rapides`, how: 'Doigts près des cordes, archet au milieu.', notes: seq(updown(scaleUp(k.root, MAJ, 2)), 0.25), bpm: 92, flat: k.flat, key: keySig(k) })));
unit(8, 'fingers', 'Extensions', OPEN.map((o, s) => ({ title: `Extension du 4e doigt sur ${SN[s]}`, how: 'Le 4e doigt s’allonge d’un demi-ton sans bouger la main (note au-dessus de la corde voisine).', notes: seq(rep([o + 2, o + 4, o + 5, o + 7, o + 8, o + 7, o + 5, o + 4], 3), 0.5), bpm: 66, string: 4 - s })));
unit(8, 'bow', 'Sautillé', [K('G', G3), K('D', D4), K('A', 57)].map((k) => ({ title: `Sautillé en ${kname(k)}, 2 octaves`, how: 'Doubles croches rapides au milieu de l’archet : l’archet rebondit tout seul, tu le guides.', notes: seq(updown(scaleUp(k.root, MAJ, 2)).flatMap((m) => [m, m]), 0.25), bpm: 88, key: keySig(k) })));
unit(8, 'intonation', 'Chromatique sur 2 octaves', [G3, D4].map((o) => ({ title: `Chromatique sur 2 octaves depuis ${FR[SHARP[o % 12]]}`, how: 'Doigté chromatique : glisse le même doigt pour les demi-tons.', notes: seq(updown(Array.from({ length: 25 }, (_, i) => o + i)), 0.5), bpm: 72 })));

// ===== PALIER 9 : positions hautes, octaves brisées =====
unit(9, 'positions', '6e et 7e positions', OPEN.flatMap((o, s) => [
  { title: `6e position sur ${SN[s]}`, how: 'Le pouce glisse sous le manche ; le poignet avance.', notes: seq(updown([o + 11, o + 12, o + 14, o + 16, o + 17]), 1), bpm: 66, string: 4 - s, position: 6 },
  { title: `7e position sur ${SN[s]}`, how: 'Le 4e doigt fait l’octave de la 3e position.', notes: seq(updown([o + 12, o + 14, o + 16, o + 17, o + 19]), 1), bpm: 66, string: 4 - s, position: 7 },
]));
unit(9, 'positions', 'Grands démanchés', OPEN.map((o, s) => ({ title: `Démanchés 1→7 et retour sur ${SN[s]}`, how: 'Garde l’oreille sur la note d’arrivée ; le bras prépare avant le doigt.', notes: seq(rep([o + 2, o + 14, o + 12, o + 2], 3), 1), bpm: 60, string: 4 - s })));
unit(9, 'double', 'Octaves brisées', [K('G', G3), K('A', 57), K('D', D4)].map((k) => ({ title: `Octaves brisées en ${kname(k)}`, how: 'Cadre 1-4 fixe : la main se déplace en bloc.', notes: seq(scaleUp(k.root, MAJ, 1).flatMap((m) => [m, m + 12]), 0.5), bpm: 72, key: keySig(k) })));
unit(9, 'scales', '3 octaves en croches', KEYS_3OCT.map((k) => ({ title: `${kname(k)}, 3 octaves en croches`, how: 'Deux notes par archet ; démanchés invisibles.', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 0.5), bpm: 84, flat: k.flat, key: keySig(k) })));
unit(9, 'scales', 'Mineures 3 octaves', [K('G', G3, true, true), K('A', 57, false, true), K('B', 59, false, true), K('C', 60, true, true)].map((k) => ({ title: `${kname(k)} mélodique, 3 octaves`, how: 'Mélodique en montant, naturelle en descendant.', notes: seq([...scaleUp(k.root, MMIN, 3), ...scaleUp(k.root, NMIN, 3).slice(0, -1).reverse()], 0.5), bpm: 80, flat: k.flat, key: keySig(k) })));
unit(9, 'rhythm', 'Vitesse : 3 octaves en doubles croches', [K('G', G3), K('A', 57)].map((k) => ({ title: `${kname(k)}, 3 octaves en doubles croches`, how: 'Vise la régularité avant la vitesse.', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 0.25), bpm: 88, key: keySig(k) })));
unit(9, 'fingers', 'Trilles rapides en positions', OPEN.map((o, s) => ({ title: `Trilles enchaînés 1-2, 2-3, 3-4 en 3e position sur ${SN[s]}`, how: 'Doubles croches rapides, le doigt du bas ne bouge pas.', notes: seq([...rep([o + 5, o + 7], 8), ...rep([o + 7, o + 9], 8), ...rep([o + 9, o + 10], 8)], 0.25), bpm: 88, string: 4 - s, position: 3 })));
unit(9, 'bow', 'Ricochet (préparation)', [K('G', G3), K('D', D4)].map((k) => ({ title: `Arpèges en ricochet sur ${kname(k)}`, how: 'Archet lancé sur 4 cordes, il rebondit : groupes de 4 doubles croches.', notes: seq(rep(k.root === G3 ? [G3, D4, A4, E5, A4, D4] : [D4, A4, 74, 78, 74, A4], 4), 0.25), bpm: 84, key: keySig(k) })));
unit(9, 'intonation', 'Justesse en positions hautes', [A4, E5].map((o, s) => ({ title: `Notes longues en 7e position sur ${SN[s + 2]}`, how: 'Contrôle chaque note avec l’accordeur : en haut du manche, quelques millimètres = un quart de ton.', notes: seq([o + 12, o + 14, o + 16, o + 17, o + 19], 2), bpm: 60, string: 2 - s, position: 7 })));

// ===== PALIER 10 : système de gammes, vitesse =====
const KEYS_ALL = [K('G', G3), K('Ab', 56, true), K('A', 57), K('Bb', 58, true), K('B', 59), K('C', 60), K('Db', 61, true), K('D', D4), K('Eb', 63, true), K('E', 64)];
unit(10, 'scales', 'Système : gamme + arpèges, 3 octaves', KEYS_ALL.map((k) => ({ title: `Système en ${kname(k)} (gamme et arpège 3 octaves)`, how: 'Gamme puis arpège enchaînés, comme une routine quotidienne de concertiste.', notes: seq([...updown(scaleUp(k.root, MAJ, 3)), ...updown(arpUp(k.root, false, 3))], 0.5), bpm: 96, flat: k.flat, key: keySig(k) })));
unit(10, 'rhythm', 'Vitesse : 3 octaves à 100', KEYS_3OCT.map((k) => ({ title: `${kname(k)}, 3 octaves en doubles croches à 100`, how: 'Quatre notes par archet, puis huit.', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 0.25), bpm: 100, flat: k.flat, key: keySig(k) })));
unit(10, 'double', 'Tierces et sixtes brisées rapides', [K('G', G3), K('A', 57), K('Bb', 58, true), K('C', 60)].flatMap((k) => [
  { title: `Tierces brisées en ${kname(k)}, 3 octaves`, how: 'Doubles croches : paires de doigts préparées.', notes: seq(brokenIv(k, 2, 3), 0.25), bpm: 80, flat: k.flat, key: keySig(k) },
  { title: `Sixtes brisées en ${kname(k)}, 2 octaves rapides`, how: 'Doubles croches régulières.', notes: seq(brokenIv(k, 5, 2), 0.25), bpm: 84, flat: k.flat, key: keySig(k) },
]));
unit(10, 'positions', 'Gammes sur une seule corde, 2 octaves', [G3, D4, A4].map((o, s) => ({ title: `2 octaves sur la seule corde de ${SN[s]}`, how: 'Démanchés réguliers jusqu’en 8e position : même doigté en montant et en descendant.', notes: seq(updown(scaleUp(o, MAJ, 2)), 0.5), bpm: 72, string: 4 - s })));
unit(10, 'fingers', 'Permutations rapides en 3e position', ['1324', '1423', '2413', '3142'].flatMap((p) => [D4, A4].map((o, s) => ({ title: `Permutation ${p.split('').join('-')} en 3e position sur ${SN[s + 1]}`, how: 'Rapide et égal ; le pouce reste détendu.', notes: seq(rep(p.split('').map((f) => o + [5, 7, 9, 10, 12][Number(f)]), 8), 0.25), bpm: 96, string: 3 - s, position: 3 }))));
unit(10, 'bow', 'Bariolages rapides', [
  { title: 'Bariolage rapide La-Mi (style Bach)', how: 'Poignet seul, bras immobile ; son égal sur les deux cordes.', notes: seq(rep([69, 76, 73, 76, 71, 76, 73, 76], 6), 0.25), bpm: 100 },
  { title: 'Bariolage rapide Ré-La', how: 'Doubles croches, mouvement circulaire.', notes: seq(rep([66, 69, 64, 69, 62, 69, 64, 69], 6), 0.25), bpm: 100 },
  { title: 'Sauts de cordes Sol ↔ Mi rapides', how: 'Archet précis, cordes intermédiaires évitées.', notes: seq(rep([G3, E5], 16), 0.25), bpm: 84 },
]);
unit(10, 'intonation', 'Justesse : chromatique rapide', [G3, D4, A4 - 12].map((o) => ({ title: `Chromatique 2 octaves rapide depuis ${FR[SHARP[o % 12]]}`, how: 'Doubles croches ; les demi-tons restent égaux à toutes les positions.', notes: seq(updown(Array.from({ length: 25 }, (_, i) => o + i)), 0.25), bpm: 84 })));

// ===== PALIER 11 : virtuosité II =====
unit(11, 'scales', 'Mineures : système 3 octaves', [K('G', G3, true, true), K('A', 57, false, true), K('B', 59, false, true), K('C', 60, true, true), K('D', D4, true, true), K('E', 64, false, true)].map((k) => ({ title: `Système en ${kname(k)}, 3 octaves`, how: 'Gamme mélodique puis arpège mineur 3 octaves.', notes: seq([...scaleUp(k.root, MMIN, 3), ...scaleUp(k.root, NMIN, 3).slice(0, -1).reverse(), ...updown(arpUp(k.root, true, 3))], 0.5), bpm: 100, flat: k.flat, key: keySig(k) })));
unit(11, 'double', 'Dixièmes et octaves brisées rapides', [K('G', G3), K('A', 57), K('C', 60)].flatMap((k) => [
  { title: `Dixièmes brisées en ${kname(k)}`, how: 'Grande extension 1-4 : main ouverte, pouce libre.', notes: seq(brokenIv(k, 9, 1), 0.5), bpm: 72, key: keySig(k) },
  { title: `Octaves brisées en ${kname(k)}, 2 octaves rapides`, how: 'Doubles croches, cadre d’octave immobile.', notes: seq(scaleUp(k.root, MAJ, 2).flatMap((m) => [m, m + 12]), 0.25), bpm: 84, key: keySig(k) },
]));
const POS_OFF: Record<number, number> = { 8: 14, 9: 15, 10: 17 };
unit(11, 'positions', 'Positions très hautes', [A4, E5].flatMap((o, s) => [8, 9, 10].map((p) => ({ title: `${p}e position sur ${SN[s + 2]}`, how: 'Le pouce passe sous le manche, le coude avance vers la droite.', notes: seq(updown([0, 2, 4, 5].map((x) => o + POS_OFF[p] + x)), 1), bpm: 66, string: 2 - s, position: p }))));
unit(11, 'rhythm', 'Vitesse : 3 octaves à 120', KEYS_3OCT.map((k) => ({ title: `${kname(k)}, 3 octaves à 120`, how: 'Huit notes par archet, puis 12, puis 24 (gamme entière d’un archet).', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 0.25), bpm: 120, flat: k.flat, key: keySig(k) })));
unit(11, 'fingers', 'Trilles et chromatique glissée', OPEN.map((o, s) => ({ title: `Trilles 3-4 en 5e position sur ${SN[s]}`, how: 'Le 4e doigt, le plus faible : léger et rapide.', notes: seq(rep([o + 14, o + 16], 24), 0.25), bpm: 100, string: 4 - s, position: 5 })));
unit(11, 'bow', 'Staccato volant (préparation)', [K('D', D4), K('A', 57)].map((k) => ({ title: `Staccato en ${kname(k)}, 2 octaves`, how: 'Plusieurs notes piquées dans le même archet poussé ; avant-bras légèrement tendu.', notes: updown(scaleUp(k.root, MAJ, 2)).flatMap((m) => [{ m, d: 0.25 }, { m: null, d: 0.25 }]), bpm: 92, key: keySig(k) })));
unit(11, 'intonation', 'Justesse : tonalités éloignées', [K('Db', 61, true), K('F#', 66), K('Ab', 56, true), K('B', 59)].map((k) => ({ title: `Notes longues en ${kname(k)}`, how: 'Peu de cordes à vide pour se repérer : compare chaque degré à l’accordeur.', notes: seq(scaleUp(k.root, MAJ, 1), 2), bpm: 60, flat: k.flat, key: keySig(k) })));

// ===== PALIER 12 : concertiste =====
unit(12, 'scales', 'Système complet à 132', KEYS_ALL.map((k) => ({ title: `Système à 132 en ${kname(k)}`, how: 'Gamme, arpège et tierces brisées 3 octaves enchaînés, sans interruption.', notes: seq([...updown(scaleUp(k.root, MAJ, 3)), ...updown(arpUp(k.root, false, 3)), ...brokenIv(k, 2, 2)], 0.25), bpm: 132, flat: k.flat, key: keySig(k) })));
unit(12, 'rhythm', 'Vitesse extrême : 3 octaves à 144', KEYS_3OCT.map((k) => ({ title: `${kname(k)}, 3 octaves à 144`, how: 'Gamme entière dans un archet ; détente totale du bras gauche.', notes: seq(updown(scaleUp(k.root, MAJ, 3)), 0.25), bpm: 144, flat: k.flat, key: keySig(k) })));
unit(12, 'double', 'Doubles cordes : 3 octaves brisées', [K('G', G3), K('A', 57), K('D', D4)].map((k) => ({ title: `Sixtes brisées en ${kname(k)}, 3 octaves`, how: 'Doubles croches rapides, toutes positions.', notes: seq(brokenIv(k, 5, 3).filter((m) => m <= 100), 0.25), bpm: 100, key: keySig(k) })));
unit(12, 'positions', 'Sauts extrêmes', [G3, D4, A4].map((o, s) => ({ title: `Sauts de 2 octaves sur ${SN[s]}`, how: 'Arrivée juste du premier coup, sans glissé audible.', notes: seq(rep([o + 2, o + 21, o + 4, o + 19, o + 5, o + 17], 2), 0.5), bpm: 72, string: 4 - s })));
unit(12, 'fingers', 'Permutations à 132', ['1324', '2413', '3142', '4231'].map((p) => ({ title: `Permutation ${p.split('').join('-')} à 132 sur Mi`, how: 'Indépendance totale, son égal.', notes: seq(rep(p.split('').map((f) => E5 + [0, 2, 4, 5, 7][Number(f)]), 8), 0.25), bpm: 132, string: 1 })));
unit(12, 'bow', 'Ricochet et bariolage virtuoses', [
  { title: 'Ricochet sur 4 cordes à 120', how: 'Archet lancé, rebonds réguliers sur Sol-Ré-La-Mi.', notes: seq(rep([...OPEN, ...OPEN.slice().reverse()], 6), 0.25), bpm: 120 },
  { title: 'Bariolage sur 3 cordes à 120', how: 'Ré-La-Mi en alternance rapide.', notes: seq(rep([D4 + 4, A4, E5, A4], 12), 0.25), bpm: 120 },
]);
unit(12, 'intonation', 'Justesse absolue : 3 octaves lentes', [K('Eb', 63, true), K('E', 64), K('F', 65, true)].map((k) => ({ title: `${kname(k)}, 3 octaves en blanches`, how: 'Lent : chaque note parfaitement centrée, vibrato possible.', notes: seq(updown(scaleUp(k.root, MAJ, 3)).filter((m) => m <= 101), 2), bpm: 72, flat: k.flat, key: keySig(k) })));

// ===== Compléments transverses (variantes de rythmes, coups d'archet, vibrato, tonalités) =====
const RH: [string, (m: number) => N[], number, string][] = [
  ['noire pointée-croche', (m) => [{ m, d: 1.5 }, { m, d: 0.5 }], 3, 'Croche courte et légère, sans précipiter.'],
  ['croche-2 doubles', (m) => [{ m, d: 0.5 }, { m, d: 0.25 }, { m, d: 0.25 }], 4, '« Ta-ti-ti » : les doubles égales.'],
  ['2 doubles-croche', (m) => [{ m, d: 0.25 }, { m, d: 0.25 }, { m, d: 0.5 }], 4, '« Ti-ti-ta » : ne raccourcis pas la croche.'],
  ['croche pointée-double', (m) => [{ m, d: 0.75 }, { m, d: 0.25 }], 5, 'Double très courte, juste avant le temps suivant.'],
  ['double-croche pointée', (m) => [{ m, d: 0.25 }, { m, d: 0.75 }], 5, 'Rythme « lombard » : la note courte sur le temps.'],
  ['syncope', (m) => [{ m, d: 0.5 }, { m, d: 1 }, { m, d: 0.5 }], 5, 'La noire entre les temps, la pulsation reste stable.'],
];
for (const [rn, f, st, how] of RH)
  unit(st, 'rhythm', `Rythme ${rn} sur les gammes`, [K('G', G3), K('D', D4), K('A', 57), K('C', 60)].map((k) => ({ title: `Gamme de ${kname(k)} en rythme ${rn}`, how, notes: updown(scaleUp(k.root, MAJ, 1)).flatMap(f), bpm: 72, key: keySig(k) })));
const BOWINGS: [string, number, string, number][] = [
  ['détaché large', 4, 'Un archet par note, tout l’archet en croches lentes : son plein, changements invisibles.', 0.5],
  ['liés par 2', 4, 'Deux notes par archet : seuls les doigts de la main gauche changent.', 0.5],
  ['liés par 4', 5, 'Quatre notes par archet, répartition égale.', 0.5],
  ['liés par 8', 6, 'Huit notes par archet : archet lent, son nourri jusqu’au bout.', 0.5],
  ['martelé', 6, 'Attaque mordante puis relâchement, silence entre les notes.', 0.5],
  ['collé', 7, 'Petits coups d’archet pincés à la corde, doigts de la main droite actifs.', 0.5],
  ['spiccato', 7, 'L’archet quitte la corde à chaque note, au point d’équilibre.', 0.25],
  ['sautillé', 8, 'Rebond naturel au milieu de l’archet, très rapide.', 0.25],
];
for (const [bn, st, how, d] of BOWINGS)
  unit(st, 'bow', `Coup d’archet : ${bn}`, [K('G', G3), K('D', D4), K('A', 57)].map((k) => ({ title: `${kname(k)}, 2 octaves, ${bn}`, how, notes: seq(updown(scaleUp(k.root, MAJ, 2)), d), bpm: d < 0.5 ? 80 : 72, key: keySig(k) })));
unit(5, 'intonation', 'Vibrato (préparation)', OPEN.flatMap((o, s) => [
  { title: `Vibrato lent (croches) sur ${SN[s]}, 2e doigt`, how: 'Balance le doigt vers l’arrière (vers le bas de la note) en croches régulières ; la note doit rester juste au centre.', notes: seq(rep([o + 4], 8), 2), bpm: 60, string: 4 - s },
  { title: `Vibrato en doubles croches sur ${SN[s]}, 3e doigt`, how: 'Mouvement plus rapide et plus petit ; le pouce reste souple.', notes: seq(rep([o + 5], 8), 2), bpm: 66, string: 4 - s },
]));
unit(6, 'scales', 'Arpèges 2 octaves dans toutes les tonalités', [K('C', 60), K('D', D4), K('E', 64), K('F', 65, true), K('Eb', 63, true), K('B', 59), K('C', 60, true, true), K('D', D4, true, true), K('E', 64, false, true), K('B', 59, false, true)].map((k) => ({ title: `Arpège de ${kname(k)}, 2 octaves en croches`, how: 'Prépare chaque démanché sur la note précédente.', notes: seq(updown(arpUp(k.root, !!k.minor, 2)), 0.5), bpm: 80, flat: k.flat, key: keySig(k) })));
unit(8, 'scales', 'Mineures harmoniques 3 octaves', [K('G', G3, true, true), K('A', 57, false, true), K('B', 59, false, true), K('C', 60, true, true), K('D', D4, true, true)].map((k) => ({ title: `${kname(k)} harmonique, 3 octaves`, how: 'Seconde augmentée à chaque octave : écarte franchement.', notes: seq(updown(scaleUp(k.root, HMIN, 3)), 0.5), bpm: 76, flat: k.flat, key: keySig(k) })));
unit(9, 'scales', 'Arpèges de septième (dominante, diminuée)', [K('G', G3), K('A', 57), K('Bb', 58, true), K('C', 60)].flatMap((k) => [
  { title: `Arpège de 7e de dominante sur ${FR[k.n]}, 3 octaves`, how: 'Fondamentale, tierce, quinte, septième mineure.', notes: seq(updown(Array.from({ length: 13 }, (_, i) => k.root + 12 * Math.floor(i / 4) + [0, 4, 7, 10][i % 4])), 0.5), bpm: 80, flat: k.flat },
  { title: `Arpège de 7e diminuée sur ${FR[k.n]}, 3 octaves`, how: 'Uniquement des tierces mineures : écart identique entre chaque note.', notes: seq(updown(Array.from({ length: 13 }, (_, i) => k.root + 3 * i)), 0.5), bpm: 80, flat: k.flat },
]));
unit(9, 'rhythm', 'Accélérations progressives', [K('G', G3), K('D', D4), K('A', 57)].map((k) => ({ title: `Accélération noires → croches → doubles en ${kname(k)}`, how: 'Même gamme en noires, puis croches, puis doubles croches, sans changer de tempo.', notes: [...seq(scaleUp(k.root, MAJ, 1), 1), ...seq(updown(scaleUp(k.root, MAJ, 1)), 0.5), ...seq(rep(updown(scaleUp(k.root, MAJ, 1)), 2), 0.25)], bpm: 84, key: keySig(k) })));
unit(10, 'double', 'Octaves brisées 3 octaves', [K('G', G3), K('A', 57), K('Bb', 58, true)].map((k) => ({ title: `Octaves brisées en ${kname(k)}, 2 octaves en doubles`, how: 'Doubles croches ; le cadre d’octave se déplace en bloc à chaque démanché.', notes: seq(scaleUp(k.root, MAJ, 2).flatMap((m) => [m, m + 12]), 0.25), bpm: 92, flat: k.flat, key: keySig(k) })));
unit(11, 'intonation', 'Harmoniques naturelles', OPEN.map((o, s) => ({ title: `Harmoniques naturelles sur ${SN[s]}`, how: 'Doigt effleuré (sans appuyer) au milieu de la corde (octave), au tiers (quinte), au quart (double octave).', notes: seq([o, o + 12, o + 19, o + 24, o + 19, o + 12], 2), bpm: 60, string: 4 - s })));

// Rangement : palier, puis on alterne les domaines pour que le parcours reste varié.
const ORDER: Domain[] = ['intonation', 'bow', 'fingers', 'scales', 'rhythm', 'positions', 'double'];
export const VIOLIN_PATH: VExercise[] = [...ALL]
  .map((e, i) => ({ e, i }))
  .sort((a, b) => a.e.stage - b.e.stage || (a.e.core === b.e.core ? 0 : a.e.core ? -1 : 1) || ORDER.indexOf(a.e.domain) - ORDER.indexOf(b.e.domain) || a.i - b.i)
  .map(({ e }, i) => ({ ...e, rank: i + 1 }));

export const byStage = (s: number) => VIOLIN_PATH.filter((e) => e.stage === s);
export const coreOf = (s: number) => byStage(s).filter((e) => e.core);
export const findExercise = (id: string) => VIOLIN_PATH.find((e) => e.id === id);
