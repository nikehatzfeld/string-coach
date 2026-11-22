import type { Exercise } from './exercise-bank';

/**
 * Exercices techniques progressifs, du facile à l'extrême, inspirés des principes de l'école
 * d'O. Ševčík (op. 1 : doigts sur une corde, permutations, trilles ; op. 8 : changements de position)
 * et des routines classiques de guitare (spider en positions, legato, 3 notes par corde).
 * Tout est généré : aucune reproduction des recueils d'origine.
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const tok = (m: number) => `${SHARP[m % 12]}${Math.floor(m / 12) - 1}`;
const DUR: Record<number, string> = { 4: '1', 2: '2', 1: '4', 0.5: '8', 0.25: '16' };
const TARGET = [0, 60, 76, 92, 112, 132];

/** Notes à durée égale rangées en mesures de 4 temps (complétées par des silences). */
function bars(midis: number[], d: number): string {
  const per = Math.round(4 / d);
  const out: string[] = [];
  for (let i = 0; i < midis.length; i += per) {
    const chunk = midis.slice(i, i + per).map((m) => `${tok(m)}:${DUR[d]}`);
    let rest = 4 - chunk.length * d;
    for (const v of [2, 1, 0.5, 0.25]) while (rest >= v - 1e-6) {
      chunk.push(`r:${DUR[v]}`);
      rest -= v;
    }
    out.push(chunk.join(' '));
  }
  return out.join(' | ');
}

const rep = <T,>(arr: T[], n: number) => Array.from({ length: n }, () => arr).flat();

const out: Exercise[] = [];
let n = 0;
function add(e: Omit<Exercise, 'id' | 'composer' | 'style' | 'timeSignature' | 'tempo' | 'targetBpm'> & { targetBpm?: number }) {
  n++;
  const target = e.targetBpm ?? TARGET[e.level];
  out.push({ id: `tx-${String(n).padStart(3, '0')}`, composer: 'Technique', style: 'Exercices', timeSignature: [4, 4], tempo: Math.max(40, target - 24), targetBpm: target, ...e } as Exercise);
}

// ---------- VIOLON ----------
const V_OPEN = [76, 69, 62, 55]; // Mi, La, Ré, Sol (corde 1 = Mi)
const V_NAME = ['Mi', 'La', 'Ré', 'Sol'];
// Schémas de la main (demi-tons depuis la corde à vide pour les doigts 1-2-3-4)
const PATTERNS: [string, number[], number][] = [
  ['2 haut', [2, 4, 5, 7], 1],
  ['2 bas', [2, 3, 5, 7], 2],
  ['3 haut', [2, 4, 6, 7], 3],
  ['1 bas', [1, 3, 5, 6], 3],
];

// 1. Doigts posés 0-1-2-3-4-3-2-1 sur chaque corde et chaque schéma (16)
for (let s = 0; s < 4; s++)
  for (const [pname, f, lvl] of PATTERNS) {
    const o = V_OPEN[s];
    const cell = [o, o + f[0], o + f[1], o + f[2], o + f[3], o + f[2], o + f[1], o + f[0]];
    add({ title: `Doigts posés, schéma ${pname}, corde de ${V_NAME[s]}`, category: 'Technique · doigts (op. 1)', level: lvl as 1, only: 'violin', string: s + 1, how: 'Garde chaque doigt posé en montant ; ne lève que celui qui doit partir.', notation: bars(rep(cell, 4), 0.5) });
  }
// 2. Battements de doigts (trilles lents → rapides) 1-2, 2-3, 3-4 sur chaque corde (12)
for (let s = 0; s < 4; s++)
  for (const [a, b, lvl] of [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
  ] as const) {
    const o = V_OPEN[s];
    const f = PATTERNS[0][1];
    const x = o + f[a];
    const y = o + f[b];
    add({ title: `Trille ${a + 1}-${b + 1}, corde de ${V_NAME[s]}`, category: 'Technique · trilles', level: lvl as 1, only: 'violin', string: s + 1, how: 'Doigt du bas posé ; le doigt du haut tombe de haut, comme un marteau, et repart vite.', notation: bars(rep([x, y], 16), 0.25) });
  }
// 3. Permutations des 4 doigts sur la corde de La (12)
const PERMS = ['1234', '1243', '1324', '1342', '1423', '1432', '2134', '2143', '2314', '3142', '3412', '4231'];
PERMS.forEach((perm, i) => {
  const f = PATTERNS[0][1];
  const cell = [...perm].map((c) => V_OPEN[1] + f[Number(c) - 1]);
  add({ title: `Permutation ${perm.split('').join('-')} (corde de La)`, category: 'Technique · permutations (op. 1)', level: (i < 4 ? 3 : i < 8 ? 4 : 5) as 3, only: 'violin', string: 2, how: 'Ordre de doigts inhabituel : indépendance de chaque doigt. Lent et juste, puis accélère.', notation: bars(rep(cell, 8), 0.25) });
});
// 4. Changements de position avec le même doigt (op. 8) : 1re↔3e, 1re↔5e, 3e↔5e sur chaque corde (12)
const BASE = { 1: 2, 3: 5, 5: 9 } as Record<number, number>;
for (let s = 0; s < 4; s++)
  for (const [p1, p2, lvl] of [
    [1, 3, 3],
    [1, 5, 4],
    [3, 5, 4],
  ] as const) {
    const o = V_OPEN[s];
    const a = o + BASE[p1];
    const b = o + BASE[p2];
    const cell = [a, a + 2, a, b, b + 2, b, a + 2, a];
    add({ title: `Démanché ${p1}e → ${p2}e position (1er doigt), corde de ${V_NAME[s]}`, category: 'Technique · démanchés (op. 8)', level: lvl as 3, only: 'violin', string: s + 1, how: 'Glisse avec le doigt qui vient de jouer, pouce et main ensemble, sans glissando audible à la fin.', notation: bars(rep(cell, 2), 1) });
  }
// 5. Gamme sur une seule corde jusqu'en 5e / 7e position (4)
for (let s = 0; s < 4; s++) {
  const o = V_OPEN[s];
  const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17].map((x) => o + x);
  add({ title: `Gamme sur la seule corde de ${V_NAME[s]}`, category: 'Technique · démanchés (op. 8)', level: 5, only: 'violin', string: s + 1, how: 'Toutes les positions sur une corde : démanchés réguliers, intonation à chaque arrivée.', notation: bars([...scale, ...scale.slice(0, -1).reverse()], 0.5) });
}
// 6. Arpèges sur 3 cordes en doubles croches (6)
for (const [name, root, third] of [
  ['Sol majeur', 55, 4],
  ['Ré majeur', 62, 4],
  ['La majeur', 57, 4],
  ['Do majeur', 60, 4],
  ['Sol mineur', 55, 3],
  ['Ré mineur', 62, 3],
] as const) {
  const arp = [0, third, 7, 12, 16 - (4 - third), 19].map((x) => root + x);
  add({ title: `Arpège ${name} sur 3 cordes`, category: 'Technique · passages de cordes', level: 4, only: 'violin', how: 'Le bras dessine un arc ; poignet souple aux changements de corde.', notation: bars(rep([...arp, ...arp.slice(1, -1).reverse()], 2), 0.25) });
}
// 7. Sauts de cordes Sol ↔ Mi (4)
for (const [a, b, lvl] of [
  [55, 76, 3],
  [57, 79, 4],
  [59, 81, 4],
  [62, 83, 5],
] as const)
  add({ title: `Sauts de cordes ${tok(a)} ↔ ${tok(b)}`, category: 'Technique · passages de cordes', level: lvl as 3, only: 'violin', how: 'Traverse les cordes du milieu sans les toucher, archet bien dosé.', notation: bars(rep([a, b], 16), 0.25) });
// 8. Vélocité : gammes sur 3 octaves (5) — niveau extrême
for (const [name, root] of [
  ['Sol', 55],
  ['La', 57],
  ['Si♭', 58],
  ['Do', 60],
  ['Ré', 62],
] as const) {
  const st = [0, 2, 4, 5, 7, 9, 11];
  const up = [0, 1, 2].flatMap((o) => st.map((x) => root + x + 12 * o)).concat(root + 36);
  add({ title: `Gamme de ${name} majeur sur 3 octaves (vélocité)`, category: 'Technique · vélocité extrême', level: 5, only: 'violin', targetBpm: 144, how: 'Niveau extrême : démanchés rapides, son égal. Commence à 80 BPM et monte par paliers.', notation: bars([...up, ...up.slice(0, -1).reverse()], 0.25) });
}
// 9. Extensions et chromatique (4)
for (let s = 0; s < 4; s++) {
  const o = V_OPEN[s];
  const crawl = [1, 2, 3, 4, 5, 6, 7, 8].map((x) => o + x);
  add({ title: `Chromatique avec extension, corde de ${V_NAME[s]}`, category: 'Technique · doigts (op. 1)', level: 4, only: 'violin', string: s + 1, how: 'Demi-tons glissés et 4e doigt en extension, main immobile.', notation: bars(rep([...crawl, ...crawl.slice().reverse()], 2), 0.25) });
}

// ---------- GUITARE ----------
const G_OPEN = [64, 59, 55, 50, 45, 40];
// 10. Spider qui monte le manche (5)
for (const [pos, lvl] of [
  [1, 1],
  [3, 2],
  [5, 3],
  [7, 4],
  [9, 5],
] as const) {
  const notes: number[] = [];
  for (const o of [...G_OPEN].reverse()) for (const f of [0, 1, 2, 3]) notes.push(o + pos + f);
  add({ title: `Spider en position ${pos}`, category: 'Technique · guitare (positions)', level: lvl as 1, only: 'guitar', position: pos, how: 'Un doigt par case à partir de la case ' + pos + ', pouce derrière le manche.', notation: bars(notes, 0.5) });
}
// 11. Legato (liés) 1-2, 1-3, 1-4, 2-4 sur les 6 cordes (8)
for (const [a, b, lvl] of [
  [1, 2, 2],
  [1, 3, 3],
  [1, 4, 3],
  [2, 4, 4],
] as const)
  for (const pos of [5, 7]) {
    const notes: number[] = [];
    for (const o of G_OPEN) notes.push(o + pos + a - 1, o + pos + b - 1, o + pos + a - 1, o + pos + b - 1);
    add({ title: `Liés ${a}-${b} en position ${pos}`, category: 'Technique · guitare (legato)', level: lvl as 2, only: 'guitar', position: pos, how: 'Une attaque au médiator, puis hammer-on / pull-off pour les notes suivantes.', notation: bars(notes, 0.25) });
  }
// 12. Gamme de Sol majeur, 3 notes par corde, 3 positions (6)
for (const [start, lvl] of [
  [3, 3],
  [5, 3],
  [7, 4],
] as const) {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const notes: number[] = [];
  let m = 43 + (start - 3);
  for (let i = 0; i < 18; i++) {
    notes.push(m);
    const deg = scale.findIndex((x) => (m - 43) % 12 === x);
    m += deg === -1 ? 1 : (scale[(deg + 1) % 7] - scale[deg] + 12) % 12 || 12;
  }
  add({ title: `3 notes par corde (Sol majeur) depuis la case ${start}`, category: 'Technique · guitare (positions)', level: lvl as 3, only: 'guitar', how: 'Trois notes sur chaque corde, aller-retour strict au médiator.', notation: bars([...notes, ...notes.slice(0, -1).reverse()], 0.25) });
  add({ title: `3 notes par corde (Sol majeur) en triolets depuis la case ${start}`, category: 'Technique · guitare (positions)', level: Math.min(5, lvl + 1) as 4, only: 'guitar', targetBpm: TARGET[Math.min(5, lvl + 1)], how: 'Groupes de 3 accentués sur le premier : régularité.', notation: bars(rep(notes.slice(0, 12), 2), 0.5) });
}
// 13. Pentatonique de La mineur, 5 positions (5)
const PENTA_BOXES = [5, 8, 10, 12, 15];
PENTA_BOXES.forEach((pos, i) => {
  const notes = G_OPEN.slice()
    .reverse()
    .flatMap((o) => [57, 60, 62, 64, 67].flatMap((p) => [p - 24, p - 12, p, p + 12]).filter((m) => m - o >= pos - 1 && m - o <= pos + 3).sort((a, b) => a - b))
    .filter((m, k, arr) => arr.indexOf(m) === k);
  add({ title: `Pentatonique de La mineur, position ${i + 1}`, category: 'Technique · guitare (positions)', level: (i < 2 ? 2 : 3) as 2, only: 'guitar', position: pos, how: 'Mémorise la forme : deux notes par corde.', notation: bars([...notes, ...notes.slice(0, -1).reverse()], 0.5) });
});
// 14. Sauts de cordes et vitesse (6)
for (const [label, a, b, lvl] of [
  ['Mi grave ↔ Sol', 40, 55, 3],
  ['La ↔ Si', 45, 59, 3],
  ['Ré ↔ Mi aigu', 50, 64, 4],
] as const)
  add({ title: `Sauts de cordes ${label}`, category: 'Technique · guitare (vitesse)', level: lvl as 3, only: 'guitar', how: 'Médiator précis, cordes intermédiaires étouffées.', notation: bars(rep([a + 5, b + 5, a + 7, b + 7], 8), 0.25) });
for (const [bpm, lvl] of [
  [112, 4],
  [132, 5],
  [152, 5],
] as const)
  add({ title: `Rafales chromatiques à ${bpm} BPM`, category: 'Technique · guitare (vitesse)', level: lvl as 4, only: 'guitar', targetBpm: bpm, position: 5, how: 'Niveau extrême : doubles croches 1-2-3-4 sur chaque corde, médiator en aller-retour strict.', notation: bars(G_OPEN.slice().reverse().flatMap((o) => [o + 5, o + 6, o + 7, o + 8]), 0.25) });

export const TECHNIQUE_BANK: Exercise[] = out;
