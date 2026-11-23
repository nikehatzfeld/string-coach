import type { ParsedBar } from './notation';
import { beatsOf } from './notation';

/**
 * Accompagnement « play-along » généré à partir des accords notés dans le morceau (D4@Am…) :
 * accords (guitare ou nappe de cordes), basse et, selon le style, batterie.
 * Renvoie des pistes alphaTex à ajouter après la mélodie (qui reste la piste 1).
 */

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

export interface ChordShape {
  root: number; // 0..11
  intervals: number[];
}

export function parseChord(name: string): ChordShape | null {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m) return null;
  const root = (LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const q = m[3];
  let intervals = [0, 4, 7];
  if (/^m(?!aj)/.test(q)) intervals = [0, 3, 7];
  if (/dim/.test(q)) intervals = [0, 3, 6];
  if (/sus4/.test(q)) intervals = [0, 5, 7];
  if (/maj7/.test(q)) intervals = [...intervals, 11];
  else if (/7/.test(q)) intervals = [...intervals, 10];
  return { root, intervals };
}

function texNote(midi: number): string {
  return `${SHARP_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Accord en position serrée, fondamentale entre Fa3 et Mi4. */
function voicing(c: ChordShape): number[] {
  let base = 48 + c.root; // Do3 + fondamentale
  if (base < 53) base += 12;
  return c.intervals.map((i) => base + i);
}

function bassNote(c: ChordShape, fifth = false): number {
  let n = 36 + c.root + (fifth ? 7 : 0); // autour de Do2
  if (n < 40) n += 12;
  if (n > 55) n -= 12;
  return n;
}

export type BackingKind = 'band' | 'strings' | 'beat';

/** Style d'accompagnement selon le genre du morceau. */
export function backingKindFor(style: string): BackingKind {
  if (['Rap US', 'Rap français', 'R&B & soul', 'Électro & dance'].includes(style)) return 'beat';
  return ['Folk & monde', 'Gospel & jazz', 'Blues', 'Fêtes', 'Pop & rock', 'Années 80', 'Années 90', 'Variété française', 'Reggae'].includes(style) ? 'band' : 'strings';
}

/** Accord actif au début de chaque temps de chaque mesure. */
function chordsByPulse(bars: ParsedBar[], pulse: number, barLen: number): (ChordShape | null)[][] {
  const changes: { at: number; chord: ChordShape }[] = [];
  let t = 0;
  for (const bar of bars) {
    for (const ev of bar) {
      if (ev.chord) {
        const c = parseChord(ev.chord);
        if (c) changes.push({ at: t, chord: c });
      }
      t += beatsOf(ev);
    }
  }
  return bars.map((_, b) => {
    const out: (ChordShape | null)[] = [];
    for (let p = 0; p < barLen - 1e-6; p += pulse) {
      const time = b * barLen + p;
      let cur: ChordShape | null = null;
      for (const ch of changes) if (ch.at <= time + 1e-6) cur = ch.chord;
      out.push(cur);
    }
    return out;
  });
}

export function hasChords(bars: ParsedBar[]): boolean {
  return bars.some((bar) => bar.some((ev) => ev.chord && parseChord(ev.chord)));
}

export function backingTracks(bars: ParsedBar[], timeSignature: [number, number], kind: BackingKind): string {
  const [num, den] = timeSignature;
  if (kind === 'beat') {
    if (num === 4 && den === 4) return beatTracks(bars);
    kind = 'band';
  }
  const barLen = (num * 4) / den; // en noires
  const compound = den === 8 && num % 3 === 0; // 6/8, 9/8 : pulsation à la noire pointée
  const pulse = compound ? 1.5 : 1;
  const pulseTex = compound ? '4{d}' : '4';
  const grid = chordsByPulse(bars, pulse, barLen);
  const pulses = grid[0]?.length ?? 0;

  // Accords : un accord par temps (guitare), ou tenu toute la mesure (cordes).
  const chordBars = grid.map((row) => {
    if (kind === 'strings') {
      // Une valeur par changement d'accord dans la mesure.
      const parts: string[] = [];
      let i = 0;
      while (i < row.length) {
        let j = i + 1;
        while (j < row.length && row[j] === row[i]) j++;
        parts.push(...splitDuration((j - i) * pulse).map((d) => (row[i] ? `(${voicing(row[i]!).map(texNote).join(' ')}).${d}` : `r.${d}`)));
        i = j;
      }
      return parts.join(' ');
    }
    return row.map((c) => (c ? `(${voicing(c).map(texNote).join(' ')}).${pulseTex}` : `r.${pulseTex}`)).join(' ');
  });

  // Basse : fondamentale au premier temps, quinte au milieu de la mesure (4/4, 9/8).
  const bassBars = grid.map((row) => {
    const half = pulses === 4 || pulses === 3 && compound ? 2 : pulses;
    const parts: string[] = [];
    for (let i = 0; i < row.length; i += half) {
      const c = row[i];
      const len = Math.min(half, row.length - i) * pulse;
      const fifth = i > 0 && row[i] === row[0];
      parts.push(...splitDuration(len).map((d, k) => (c && k === 0 ? `${texNote(bassNote(c, fifth))}.${d}` : `r.${d}`)));
    }
    return parts.join(' ');
  });

  // Batterie (style « band » seulement) : grosse caisse / caisse claire + charleston.
  const KICK = 36;
  const SNARE = 38;
  const HAT = 42;
  const drumBars = grid.map((row) => {
    if (!row.some(Boolean)) return row.map(() => `r.${pulseTex}`).join(' ');
    return row
      .map((_, i) => {
        let hit: number[];
        if (compound) hit = i === 0 ? [KICK, HAT] : i === 1 ? [SNARE, HAT] : [HAT];
        else if (pulses === 3) hit = i === 0 ? [KICK, HAT] : [HAT];
        else hit = i % 2 === 0 ? [KICK, HAT] : [SNARE, HAT];
        return `(${hit.join(' ')}).${pulseTex}`;
      })
      .join(' ');
  });

  const out = [
    kind === 'strings'
      ? `\\track "Cordes" \\staff {score} \\instrument stringensemble1\n${chordBars.join(' |\n')}`
      : `\\track "Guitare d'accompagnement" \\staff {score} \\instrument acousticguitarnylon\n${chordBars.join(' |\n')}`,
    `\\track "Basse" \\staff {score} \\instrument acousticbass\n${bassBars.join(' |\n')}`,
  ];
  if (kind === 'band') out.push(`\\track "Batterie" \\instrument percussion \\staff {score}\n${drumBars.join(' |\n')}`);
  return out.join('\n');
}

/**
 * Beat hip-hop (4/4), en croches : grosse caisse sur 1, 3 et le « et » de 3, caisse claire sur 2 et 4,
 * charleston sur toutes les croches (ouvert sur le dernier « et ») ; basse syncopée sur la fondamentale ;
 * nappe de chœur tenue sur chaque accord.
 */
function beatTracks(bars: ParsedBar[]): string {
  const grid = chordsByPulse(bars, 1, 4);
  const KICK = 36;
  const SNARE = 38;
  const HAT = 42;
  const OPEN = 46;
  const drums = grid.map((row) => {
    if (!row.some(Boolean)) return 'r.1';
    const hits: number[][] = [[KICK, HAT], [HAT], [SNARE, HAT], [HAT], [KICK, HAT], [KICK, HAT], [SNARE, HAT], [OPEN]];
    return hits.map((h) => `(${h.join(' ')}).8`).join(' ');
  });
  const bass = grid.map((row) => {
    if (!row.some(Boolean)) return 'r.1';
    const at = (beat: number) => row[beat] ?? row[0];
    const n = (c: ChordShape | null, oct = 0) => (c ? `${texNote(bassNote(c) + oct)}` : 'r');
    // Croches : 1 (noire pointée) · « et » de 2 · 3 (noire) · « et » de 3 · 4 (croche) · silence
    return [`${n(at(0))}.4{d}`, `${n(at(1))}.8`, `${n(at(2))}.4`, `${n(at(2), 12)}.8`, `${n(at(3))}.8`].join(' ');
  });
  const pad = grid.map((row) => {
    const parts: string[] = [];
    let i = 0;
    while (i < row.length) {
      let j = i + 1;
      while (j < row.length && row[j] === row[i]) j++;
      parts.push(...splitDuration(j - i).map((d) => (row[i] ? `(${voicing(row[i]!).map(texNote).join(' ')}).${d}` : `r.${d}`)));
      i = j;
    }
    return parts.join(' ');
  });
  return [
    `\\track "Nappe" \\staff {score} \\instrument choiraahs\n${pad.join(' |\n')}`,
    `\\track "Basse" \\staff {score} \\instrument electricbassfinger\n${bass.join(' |\n')}`,
    `\\track "Batterie" \\instrument percussion \\staff {score}\n${drums.join(' |\n')}`,
  ].join('\n');
}

/** Découpe une durée (en noires) en valeurs alphaTex : 4 → ronde, 3 → blanche pointée, 1,5 → noire pointée… */
export function splitDuration(quarters: number): string[] {
  const table: [number, string][] = [
    [4, '1'],
    [3, '2{d}'],
    [2, '2'],
    [1.5, '4{d}'],
    [1, '4'],
    [0.75, '8{d}'],
    [0.5, '8'],
    [0.25, '16'],
  ];
  const out: string[] = [];
  let rest = quarters;
  while (rest > 1e-6) {
    const hit = table.find(([v]) => v <= rest + 1e-6);
    if (!hit) break;
    out.push(hit[1]);
    rest -= hit[0];
  }
  return out;
}
