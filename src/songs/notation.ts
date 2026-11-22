/**
 * Notation compacte utilisée pour écrire les morceaux de la bibliothèque.
 *
 * Jetons séparés par des espaces, mesures séparées par `|` :
 *   F#4        note (lettre, # ou b, octave ; Do4 = C4 = MIDI 60)
 *   F#4:8      durée : 1 ronde, 2 blanche, 4 noire, 8 croche, 16 double
 *   F#4:4.     durée pointée
 *   r:4        silence
 *   -:4        liaison : prolonge la note précédente
 *   D4@Am      accord affiché au-dessus de la note (pour la guitare)
 * Sans durée, la durée du jeton précédent est reprise (noire au départ).
 */

export type Duration = 1 | 2 | 4 | 8 | 16;

export interface ParsedEvent {
  kind: 'note' | 'rest' | 'tie';
  midi: number | null;
  duration: Duration;
  dotted: boolean;
  chord?: string;
  /** Écrite avec un bémol (pour afficher Si♭ plutôt que La♯). */
  flat?: boolean;
}

export type ParsedBar = ParsedEvent[];

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const TOKEN = /^(r|-|([A-G])([#b]?)(-?\d))(?::(1|2|4|8|16))?(\.)?(?:@(\S+))?$/;

export function noteToMidi(letter: string, accidental: string, octave: number): number {
  const base = LETTERS[letter];
  if (base === undefined) throw new Error(`Lettre inconnue : ${letter}`);
  const acc = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (octave + 1) * 12 + base + acc;
}

export function parseNotation(src: string): ParsedBar[] {
  const bars: ParsedBar[] = [];
  let duration: Duration = 4;
  for (const rawBar of src.split('|')) {
    const tokens = rawBar.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const bar: ParsedBar = [];
    for (const tok of tokens) {
      const m = TOKEN.exec(tok);
      if (!m) throw new Error(`Jeton invalide : "${tok}"`);
      if (m[5]) duration = Number(m[5]) as Duration;
      const dotted = m[6] === '.';
      const chord = m[7];
      if (m[1] === 'r') bar.push({ kind: 'rest', midi: null, duration, dotted, chord });
      else if (m[1] === '-') bar.push({ kind: 'tie', midi: null, duration, dotted, chord });
      else bar.push({ kind: 'note', midi: noteToMidi(m[2], m[3], Number(m[4])), duration, dotted, chord, flat: m[3] === 'b' });
    }
    bars.push(bar);
  }
  // Résout les liaisons sur la hauteur de la note précédente.
  let last: ParsedEvent | null = null;
  for (const bar of bars) {
    for (const ev of bar) {
      if (ev.kind === 'note') last = ev;
      else if (ev.kind === 'tie') {
        if (last === null) throw new Error('Liaison sans note précédente');
        ev.midi = last.midi;
        ev.flat = last.flat;
      }
    }
  }
  return bars;
}

/** Durée d'un évènement en noires. */
export function beatsOf(ev: ParsedEvent): number {
  const base = 4 / ev.duration;
  return ev.dotted ? base * 1.5 : base;
}

export function barBeats(bar: ParsedBar): number {
  return bar.reduce((sum, ev) => sum + beatsOf(ev), 0);
}

const NAMES_FR = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiName(midi: number, lang: 'fr' | 'en' = 'fr'): string {
  const names = lang === 'fr' ? NAMES_FR : NAMES_EN;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Écart en cents ramené à l'octave la plus proche (−600 à +600). */
export function centsToNearestOctave(cents: number): number {
  return ((((cents + 600) % 1200) + 1200) % 1200) - 600;
}

export function freqToMidiFloat(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}
