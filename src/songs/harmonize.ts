import { beatsOf, type ParsedBar } from './notation';

/**
 * Harmonisation automatique : quand un morceau n'a pas (ou presque pas) d'accords notés,
 * on choisit pour chaque mesure (ou demi-mesure en 4/4) l'accord de la gamme qui colle le mieux
 * à la mélodie, avec une préférence pour I, IV, V et une cadence finale sur la tonique.
 */

const SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1]); // Fa, Si♭, Mi♭, La♭, Ré♭
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** Degrés retenus : [décalage depuis la tonique, mineur ?, préférence]. */
const DEGREES: [number, boolean, number][] = [
  [0, false, 0.35], // I
  [5, false, 0.25], // IV
  [7, false, 0.3], // V
  [9, true, 0.18], // vi
  [2, true, 0.1], // ii
  [4, true, 0.04], // iii
];

function bestKey(midis: number[], last: number | undefined): number {
  let best = 0;
  let score = -1;
  for (let k = 0; k < 12; k++) {
    const set = new Set(MAJOR.map((s) => (k + s) % 12));
    const sc = midis.filter((m) => set.has(m % 12)).length + (last !== undefined && last % 12 === k ? 3 : 0) + (last !== undefined && (last + 3) % 12 === k ? 1 : 0);
    if (sc > score) {
      score = sc;
      best = k;
    }
  }
  return best;
}

/** Trop peu d'accords notés (moins d'un toutes les 4 mesures) : on harmonise. */
export function needsHarmony(bars: ParsedBar[]): boolean {
  const n = bars.flat().filter((e) => e.chord).length;
  return bars.length > 0 && n < Math.ceil(bars.length / 4);
}

export function harmonize(bars: ParsedBar[], ts: [number, number]): ParsedBar[] {
  const notes = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi as number);
  if (!notes.length) return bars;
  const tonic = bestKey(notes, notes[notes.length - 1]);
  const flat = FLAT_KEYS.has(tonic);
  const name = (root: number, minor: boolean) => `${(flat ? FLAT : SHARP)[root % 12]}${minor ? 'm' : ''}`;
  const half = ts[1] === 4 && ts[0] === 4; // changement possible sur le 3e temps
  let prev = -1;
  return bars.map((bar, bi) => {
    // Segments : mesure entière, ou deux demi-mesures en 4/4.
    let t = 0;
    const timed = bar.map((ev) => {
      const start = t;
      t += beatsOf(ev);
      return { ev, start, dur: beatsOf(ev) };
    });
    const segs = half ? [0, 2] : [0];
    const out = bar.map((e) => ({ ...e, chord: undefined as string | undefined }));
    let lastMidi: number | null = null;
    for (let si = 0; si < segs.length; si++) {
      const from = segs[si];
      const to = segs[si + 1] ?? t;
      const inSeg = timed.filter((x) => x.start >= from && x.start < to);
      const first = inSeg[0] ?? timed.find((x) => x.start + x.dur > from);
      if (!first) continue;
      const isLast = bi === bars.length - 1;
      let best = 0;
      let bestScore = -Infinity;
      DEGREES.forEach(([off, minor, pref], di) => {
        const root = (tonic + off) % 12;
        const pcs = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
        let sc = pref;
        for (const x of timed) {
          const s0 = Math.max(x.start, from);
          const s1 = Math.min(x.start + x.dur, to);
          if (s1 <= s0) continue;
          const m = x.ev.kind === 'note' ? (x.ev.midi as number) : x.ev.kind === 'tie' ? lastMidi : null;
          if (x.ev.kind === 'note') lastMidi = x.ev.midi as number;
          if (m === null) continue;
          const strong = x.start % 1 === 0 ? (x.start === 0 ? 1.6 : 1.2) : 0.7;
          sc += (pcs.includes(m % 12) ? 1 : -0.45) * (s1 - s0) * strong;
        }
        if (di === prev) sc += 0.15; // un peu de stabilité
        if (isLast && di === 0) sc += 3; // cadence finale sur I
        if (prev === 2 && di === 0) sc += 0.3; // V → I
        if (sc > bestScore) {
          bestScore = sc;
          best = di;
        }
      });
      if (si > 0 && best === prev) continue; // pas de répétition inutile en milieu de mesure
      const idx = out.findIndex((_, k) => timed[k] === first);
      if (idx >= 0 && (best !== prev || si === 0)) out[idx].chord = name((tonic + DEGREES[best][0]) % 12, DEGREES[best][1]);
      prev = best;
    }
    return out;
  });
}
