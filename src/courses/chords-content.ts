import courseMd from '../../docs/cours-accords.md?raw';
import type { Song } from '../songs/alphatex';
import { beatsOf, parseNotation } from '../songs/notation';

/** Une grille à jouer : accords par mesure, chacun avec sa position (en croches depuis le début de la mesure). */
export interface ChordChart {
  id: string;
  title: string;
  subtitle?: string;
  timeSignature: [number, number];
  bpm: number;
  bars: { chord: string; at: number }[][];
  pattern?: string;
}

/** Grille écrite simplement : « G | C D | Em . C D » (« . » = rien de nouveau sur ce demi-temps de mesure). */
export function chart(id: string, title: string, grid: string, ts: [number, number] = [4, 4], bpm = 80, extra: Partial<ChordChart> = {}): ChordChart {
  const eighths = ts[1] === 8 ? ts[0] : ts[0] * (8 / ts[1]);
  const bars = grid
    .split('|')
    .map((b) => b.trim().split(/\s+/).filter(Boolean))
    .filter((b) => b.length)
    .map((toks) => {
      const step = eighths / toks.length;
      return toks.map((c, i) => ({ chord: c, at: Math.round(i * step) })).filter((x) => x.chord !== '.');
    });
  return { id, title, timeSignature: ts, bpm, bars, ...extra };
}

/** Grilles célèbres et morceaux traditionnels (grilles d'accords seulement, pas de paroles). */
export const CHORD_CHARTS: ChordChart[] = [
  chart('g-50s', 'Progression années 50 (I–vi–IV–V)', 'G | Em | C | D', [4, 4], 80, { subtitle: 'comme Stand by Me, Every Breath You Take' }),
  chart('g-axis', 'I–V–vi–IV (la grille pop)', 'G | D | Em | C', [4, 4], 84, { subtitle: 'comme Let It Be, With or Without You, Someone Like You' }),
  chart('g-vi-iv', 'vi–IV–I–V', 'Em | C | G | D', [4, 4], 84, { subtitle: 'comme Zombie (The Cranberries)' }),
  chart('g-3acc', 'I–IV–V rock’n’roll', 'C F | G F | C F | G G', [4, 4], 120, { subtitle: 'comme La Bamba, Twist and Shout', pattern: 'croches' }),
  chart('g-anda', 'Cadence andalouse', 'Am | G | F | E', [4, 4], 90, { subtitle: 'comme Hit the Road Jack, flamenco' }),
  chart('g-canon', 'Canon de Pachelbel (grille)', 'D A | Bm F#m | G D | G A', [4, 4], 72, { subtitle: 'la basse obstinée de Pachelbel' }),
  chart('g-canon-capo', 'Canon de Pachelbel (version facile, capo 2)', 'C G | Am Em | F C | F G', [4, 4], 66, { subtitle: 'mêmes accords, formes de Do avec capo 2' }),
  chart('g-blues-a', 'Blues en 12 mesures (La)', 'A7 | A7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7', [4, 4], 90, { pattern: 'boom-chuck' }),
  chart('g-blues-e', 'Blues en 12 mesures (Mi)', 'E7 | E7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7', [4, 4], 90, { pattern: 'croches' }),
  chart('g-251', 'ii–V–I jazz (Do)', 'Dm7 | G7 | Cmaj7 | Cmaj7', [4, 4], 100),
  chart('t-rising-sun', 'House of the Rising Sun (traditionnel)', 'Am | C | D | F | Am | C | E | E | Am | C | D | F | Am | E | Am | E', [6, 8], 66, { pattern: '68-arp' }),
  chart('t-amazing', 'Amazing Grace (traditionnel, Sol)', 'G | G | C | G | G | G | D | D | G | G7 | C | G | G | D | G | G', [3, 4], 80, { pattern: 'valse' }),
  chart('t-saints', 'When the Saints Go Marching In (traditionnel)', 'G | G | G | G | G | G | D | D | G | G7 | C | C | G D | G | G | G', [4, 4], 120, { pattern: 'boom-chuck' }),
  chart('t-bamba', 'La Bamba (traditionnel mexicain)', 'C F | G F | C F | G F', [4, 4], 140, { pattern: 'pop' }),
  chart('t-greensleeves', 'Greensleeves (traditionnel)', 'Am | G | Am | E | Am | G | Am E | Am | C | G | Am | E | C | G | Am E | Am', [6, 8], 60, { pattern: '68' }),
  chart('t-auclair', 'Au clair de la lune (comptine)', 'C | C | G7 | C | C | C | G7 | C', [4, 4], 90, { pattern: 'noires' }),
  chart('t-frere', 'Frère Jacques (comptine)', 'G | G | G | G | G D | G D | G D | G D', [4, 4], 100, { pattern: 'noires' }),
];

/** Grille d'accords d'un morceau de la bibliothèque (accords notés « @Am » dans la mélodie). */
export function chartFromSong(song: Song): ChordChart | null {
  const bars = parseNotation(song.notation);
  let any = false;
  const out = bars.map((bar) => {
    let t = 0;
    const cs: { chord: string; at: number }[] = [];
    for (const ev of bar) {
      if (ev.chord) {
        cs.push({ chord: ev.chord, at: Math.round(t * 2) });
        any = true;
      }
      t += beatsOf(ev);
    }
    return cs;
  });
  if (!any) return null;
  return { id: `song-${song.id}`, title: song.title, subtitle: song.composer, timeSignature: song.timeSignature, bpm: song.timeSignature[1] === 8 ? Math.round(song.tempo / 1.5) : song.tempo, bars: out };
}

export interface ChordLesson {
  n: number;
  title: string;
  body: string;
  practice: ChordChart;
}

const PRACTICE: Record<number, ChordChart> = {
  1: chart('l1', 'Em ↔ Am', 'Em | Em | Am | Am', [4, 4], 60, { pattern: 'plaque' }),
  2: chart('l2', 'Em – E – Am – A', 'Em | E | Am | A', [4, 4], 60, { pattern: 'noires' }),
  3: chart('l3', 'G – C – D – G', 'G | C | D | G', [4, 4], 64, { pattern: 'noires' }),
  4: chart('l4', 'Changements Am ↔ C, G ↔ D', 'Am | C | Am | C | G | D | G | D', [4, 4], 70, { pattern: 'plaque' }),
  5: chart('l5', 'Rythme pop sur G – C – D – G', 'G | C | D | G', [4, 4], 76, { pattern: 'pop' }),
  6: CHORD_CHARTS.find((c) => c.id === 'g-blues-a')!,
  7: CHORD_CHARTS.find((c) => c.id === 'g-axis')!,
  8: chart('l8', 'F – Bb – C avec capo 3 (D – G – A)', 'F | Bb | C | F', [4, 4], 72, { pattern: 'pop' }),
  9: chart('l9', 'Barrés : F ↔ C, Bm ↔ G', 'F | C | F | C | Bm | G | Bm | G', [4, 4], 60, { pattern: 'plaque' }),
  10: CHORD_CHARTS.find((c) => c.id === 't-rising-sun')!,
  11: CHORD_CHARTS.find((c) => c.id === 'g-50s')!,
};

export function chordLessons(): ChordLesson[] {
  return courseMd
    .split(/\n(?=## Leçon \d+)/)
    .slice(1)
    .map((p) => {
      const m = /^## Leçon (\d+)\s*[—-]\s*(.+)$/m.exec(p)!;
      const n = Number(m[1]);
      const body = p.split('\n').slice(1).join('\n').replace(/\n---\s*$/m, '').trim();
      return { n, title: m[2].trim(), body, practice: PRACTICE[n] ?? PRACTICE[1] };
    });
}

/** Accords distincts d'une grille. */
export function chartChords(c: ChordChart): string[] {
  return [...new Set(c.bars.flat().map((x) => x.chord))];
}
