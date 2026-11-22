import type { Level, Song } from './alphatex';
import { beatsOf, parseNotation } from './notation';

/**
 * Version facile d'un morceau : une note par temps (la note qui sonne sur le temps),
 * ramenée en 1re position au violon (Sol3 à Si5), tempo ralenti.
 * Garde la forme du morceau et ses accords : on le reconnaît, on le joue plus vite.
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Tessiture de la 1re position au violon : Sol3 (corde à vide) à Si5 (4e doigt sur Mi). */
const LOW = 55;
const HIGH = 83;

const name = (midi: number, flat: boolean) => `${(flat ? FLAT : SHARP)[midi % 12]}${Math.floor(midi / 12) - 1}`;

export function easyVersion(song: Song): Song {
  const [num, den] = song.timeSignature;
  const unit = den === 8 && num % 3 === 0 ? 1.5 : 4 / den; // temps en noires
  const durTok = unit === 1.5 ? '4.' : unit === 2 ? '2' : unit === 0.5 ? '8' : '4';
  const bars = parseNotation(song.notation);

  type Beat = { midi: number | null; held: boolean; flat: boolean; chord?: string };
  const outBars: Beat[][] = [];
  let lastMidi: number | null = null;
  let lastFlat = false;
  for (const bar of bars) {
    // Événements avec leur début (en noires) dans la mesure.
    let t = 0;
    const evs = bar.map((ev) => {
      const start = t;
      t += beatsOf(ev);
      return { ev, start, end: t };
    });
    const len = t;
    const beats: Beat[] = [];
    for (let b = 0; b + 1e-6 < len; b += unit) {
      const at = evs.find((e) => e.start <= b + 1e-6 && e.end > b + 1e-6);
      const chord = evs.find((e) => e.ev.chord && e.start >= b - 1e-6 && e.start < b + unit - 1e-6)?.ev.chord;
      if (!at || at.ev.kind === 'rest') {
        // Silence sur le temps : on prend la première note qui commence pendant ce temps, sinon silence.
        const inside = evs.find((e) => e.ev.kind === 'note' && e.start > b && e.start < b + unit - 1e-6);
        if (inside) {
          lastMidi = inside.ev.midi;
          lastFlat = !!inside.ev.flat;
          beats.push({ midi: lastMidi, held: false, flat: lastFlat, chord });
        } else {
          lastMidi = null;
          beats.push({ midi: null, held: false, flat: false, chord });
        }
        continue;
      }
      const startedBefore = at.start < b - 1e-6 || at.ev.kind === 'tie';
      if (at.ev.kind === 'note') {
        lastMidi = at.ev.midi;
        lastFlat = !!at.ev.flat;
      }
      beats.push({ midi: lastMidi, held: startedBefore && lastMidi !== null, flat: lastFlat, chord });
    }
    outBars.push(beats);
  }

  // Octave : décalage global qui met le plus de notes en 1re position, puis mesure par mesure si besoin.
  const all = outBars.flat().filter((x) => x.midi !== null).map((x) => x.midi as number);
  const fitCount = (s: number) => all.filter((m) => m + s >= LOW && m + s <= HIGH).length;
  const global = [0, -12, 12, -24, 24].reduce((best, s) => (fitCount(s) > fitCount(best) ? s : best), 0);
  const fold = (m: number) => {
    while (m > HIGH) m -= 12;
    while (m < LOW) m += 12;
    return m;
  };

  let prevTok: string | null = null;
  const notation = outBars
    .map((beats) => {
      const ms = beats.filter((x) => x.midi !== null).map((x) => (x.midi as number) + global);
      let shift = global;
      if (ms.length && (Math.max(...ms) > HIGH || Math.min(...ms) < LOW)) {
        const lo = Math.min(...ms);
        const hi = Math.max(...ms);
        const extra = [-12, 12].find((s) => lo + s >= LOW && hi + s <= HIGH);
        if (extra !== undefined) shift += extra;
      }
      return beats
        .map((x) => {
          const chord = x.chord ? `@${x.chord}` : '';
          if (x.midi === null) {
            prevTok = null;
            return `r:${durTok}${chord}`;
          }
          const tok = name(fold(x.midi + shift), x.flat);
          // Note tenue sur le temps suivant : liaison (même hauteur).
          const out: string = x.held && prevTok === tok ? `-:${durTok}${chord}` : `${tok}:${durTok}${chord}`;
          prevTok = tok;
          return out;
        })
        .join(' ');
    })
    .map((bar) => (unit === 1 ? mergeTies(bar) : bar))
    .join(' | ');

  return {
    ...song,
    id: `${song.id}~facile`,
    title: `${song.title} · version facile`,
    level: Math.max(1, Math.min(song.level - 2, 2)) as Level,
    tempo: Math.max(40, Math.round((song.tempo * 0.75) / 2) * 2),
    notation,
    sections: undefined,
    string: undefined,
    position: undefined,
  };
}

/** En noires : « Ré5:4 -:4 » sur un temps pair devient « Ré5:2 » (plus lisible). */
function mergeTies(bar: string): string {
  const toks = bar.split(' ');
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    if (i % 2 === 0 && next === '-:4' && !t.startsWith('r:') && /:4(@|$)/.test(t)) {
      out.push(t.replace(':4', ':2'));
      i++;
    } else out.push(t);
  }
  return out.join(' ');
}
