import { fingerNote, octaveShiftFor, type Instrument } from './instruments';
import { parseNotation, type ParsedBar } from './notation';

export type Style =
  | 'Classique'
  | 'Folk français'
  | 'Folk anglo-saxon'
  | 'Gospel & jazz'
  | 'Blues'
  | 'Fêtes'
  | 'Exercices';

export type Level = 1 | 2 | 3;

export interface Song {
  id: string;
  title: string;
  composer: string;
  style: Style;
  level: Level;
  tempo: number;
  timeSignature: [number, number];
  notation: string;
}

const DUR_TEX: Record<number, string> = { 1: '1', 2: '2', 4: '4', 8: '8', 16: '16' };

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function songMidiRange(bars: ParsedBar[]): [number, number] {
  const notes = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi as number);
  return [Math.min(...notes), Math.max(...notes)];
}

/** Convertit un morceau de la bibliothèque en alphaTex pour un instrument. */
export function songToAlphaTex(song: Song, inst: Instrument): string {
  const bars = parseNotation(song.notation);
  const [min, max] = songMidiRange(bars);
  const shift = octaveShiftFor(min, max, inst);
  const [num, den] = song.timeSignature;

  const header = [
    `\\title "${escape(song.title)}"`,
    `\\artist "${escape(song.composer)}"`,
    `\\tempo ${song.tempo}`,
    `\\ts (${num} ${den})`,
    `\\track "${inst.label}"`,
    `\\staff {score tabs}`,
    `\\instrument ${inst.alphaTexInstrument}`,
    `\\tuning (${inst.tuningNames.join(' ')})`,
  ].join('\n');

  let lastString = 1;
  const body = bars
    .map((bar) =>
      bar
        .map((ev) => {
          const dur = DUR_TEX[ev.duration];
          const effects: string[] = [];
          if (ev.dotted) effects.push('d');
          if (ev.chord) effects.push(`ch "${escape(ev.chord)}"`);
          const fx = effects.length ? `{${effects.join(' ')}}` : '';
          if (ev.kind === 'rest') return `r.${dur}${fx}`;
          if (ev.kind === 'tie') return `-.${lastString}.${dur}${fx}`;
          const f = fingerNote((ev.midi as number) + shift, inst);
          lastString = f.string;
          return `${f.fret}.${f.string}.${dur}${fx}`;
        })
        .join(' '),
    )
    .join(' |\n');

  return `${header}\n${body}`;
}
