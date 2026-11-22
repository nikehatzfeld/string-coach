/**
 * Accords de guitare : formes (diagrammes), notes, transposition et tonalité facile (capodastre).
 * Cordes notées de la plus grave (Mi grave, 6e corde) à la plus aiguë (Mi aigu, 1re corde).
 */

export interface ChordShape {
  /** Case par corde, de la 6e à la 1re ; -1 = corde non jouée, 0 = à vide. */
  frets: number[];
  /** Doigt par corde (0 = aucun). */
  fingers: number[];
  /** Barré : case et cordes couvertes (de, à : 6..1). */
  barre?: { fret: number; from: number; to: number };
  /** Forme ouverte (sans barré), considérée « facile ». */
  open: boolean;
}

const S = (frets: string, fingers: string, barre?: ChordShape['barre']): ChordShape => ({
  frets: [...frets].map((c) => (c === 'x' ? -1 : parseInt(c, 16))),
  fingers: [...fingers].map((c) => (c === 'x' ? 0 : Number(c))),
  barre,
  open: !barre,
});

/** Formes ouvertes usuelles (positions standard des méthodes de guitare). */
const OPEN: Record<string, ChordShape> = {
  C: S('x32010', 'x32010'),
  D: S('xx0232', 'xx0132'),
  E: S('022100', '023100'),
  G: S('320003', '210003'),
  A: S('x02220', 'x01230'),
  Am: S('x02210', 'x02310'),
  Em: S('022000', '023000'),
  Dm: S('xx0231', 'xx0231'),
  E7: S('020100', '020100'),
  A7: S('x02020', 'x02030'),
  D7: S('xx0212', 'xx0213'),
  G7: S('320001', '320001'),
  C7: S('x32310', 'x32410'),
  B7: S('x21202', 'x21304'),
  Am7: S('x02010', 'x02010'),
  Em7: S('020000', '020000'),
  Dm7: S('xx0211', 'xx0211'),
  Cmaj7: S('x32000', 'x32000'),
  Fmaj7: S('xx3210', 'xx3210'),
  Gmaj7: S('320002', '320001'),
  Dmaj7: S('xx0222', 'xx0111'),
  Amaj7: S('x02120', 'x02130'),
  Asus2: S('x02200', 'x01200'),
  Asus4: S('x02230', 'x01230'),
  Dsus2: S('xx0230', 'xx0130'),
  Dsus4: S('xx0233', 'xx0134'),
  Esus4: S('022200', '023400'),
  Cadd9: S('x32030', 'x21030'),
  E5: S('022xxx', '011xxx'),
  A5: S('x022xx', 'x011xx'),
  D5: S('xx023x', 'xx013x'),
};

/** Formes mobiles avec barré, fondamentale sur la 6e (E) ou la 5e corde (A). Cases relatives à la fondamentale. */
const MOVABLE: { quality: string; root: 6 | 5; frets: number[]; fingers: string }[] = [
  { quality: '', root: 6, frets: [0, 2, 2, 1, 0, 0], fingers: '134211' },
  { quality: 'm', root: 6, frets: [0, 2, 2, 0, 0, 0], fingers: '134111' },
  { quality: '7', root: 6, frets: [0, 2, 0, 1, 0, 0], fingers: '131211' },
  { quality: 'm7', root: 6, frets: [0, 2, 0, 0, 0, 0], fingers: '131111' },
  { quality: '5', root: 6, frets: [0, 2, 2, -1, -1, -1], fingers: '134xxx' },
  { quality: '', root: 5, frets: [-1, 0, 2, 2, 2, 0], fingers: 'x12341' },
  { quality: 'm', root: 5, frets: [-1, 0, 2, 2, 1, 0], fingers: 'x13421' },
  { quality: '7', root: 5, frets: [-1, 0, 2, 0, 2, 0], fingers: 'x13141' },
  { quality: 'm7', root: 5, frets: [-1, 0, 2, 0, 1, 0], fingers: 'x13121' },
  { quality: 'maj7', root: 5, frets: [-1, 0, 2, 1, 2, 0], fingers: 'x13241' },
  { quality: 'sus4', root: 5, frets: [-1, 0, 2, 2, 3, 0], fingers: 'x12341' },
  { quality: 'sus2', root: 5, frets: [-1, 0, 2, 2, 0, 0], fingers: 'x13411' },
  { quality: 'dim', root: 5, frets: [-1, 0, 1, 2, 1, -1], fingers: 'x1243x' },
  { quality: '5', root: 5, frets: [-1, 0, 2, 2, -1, -1], fingers: 'x134xx' },
];

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'];

export interface ParsedChord {
  root: number;
  quality: string;
  /** Basse (accord renversé « C/G »), ignorée pour la forme. */
  bass?: number;
}

/** « F#m7 », « Bb », « Csus4 », « G/B »… (qualités : '', m, 7, m7, maj7, sus2, sus4, add9, dim, 5). */
export function parseChordName(name: string): ParsedChord | null {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name.trim());
  if (!m) return null;
  const root = (LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let q = m[3];
  if (/^(min|mi)$/.test(q)) q = 'm';
  if (/^(M7|Δ7?)$/.test(q)) q = 'maj7';
  if (/^(°|o)$/.test(q)) q = 'dim';
  const known = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', 'dim', '5', 'm6', '6', '9'];
  if (!known.includes(q)) q = q.startsWith('m') && !q.startsWith('maj') ? 'm' : q.includes('7') ? '7' : '';
  const bass = m[4] ? parseChordName(m[4])?.root : undefined;
  return { root, quality: q, bass };
}

const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  dim: [0, 3, 6],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 2],
};

/** Classes de hauteur de l'accord (fondamentale en premier). */
export function chordPitchClasses(name: string): number[] {
  const c = parseChordName(name);
  if (!c) return [];
  return (INTERVALS[c.quality] ?? INTERVALS['']).map((i) => (c.root + i) % 12);
}

export function chordName(root: number, quality: string, flat = false): string {
  return `${(flat ? FLAT : SHARP)[((root % 12) + 12) % 12]}${quality}`;
}

/** Nom français : « Lam », « Fa♯7 »… */
export function chordNameFr(name: string): string {
  const c = parseChordName(name);
  if (!c) return name;
  const q = c.quality === 'm' ? 'm' : c.quality;
  return `${FR[c.root]}${q}${c.bass !== undefined ? `/${FR[c.bass]}` : ''}`;
}

export function transposeChord(name: string, semitones: number): string {
  const c = parseChordName(name);
  if (!c) return name;
  const flat = /b/.test(name.slice(1, 2));
  const out = chordName(c.root + semitones, c.quality, flat);
  return c.bass !== undefined ? `${out}/${(flat ? FLAT : SHARP)[(((c.bass + semitones) % 12) + 12) % 12]}` : out;
}

/** Forme à jouer : ouverte si elle existe, sinon barré (fondamentale sur la 6e ou la 5e corde, la plus basse). */
export function shapeFor(name: string): ChordShape | null {
  const c = parseChordName(name);
  if (!c) return null;
  const key = chordName(c.root, c.quality);
  const keyFlat = chordName(c.root, c.quality, true);
  if (OPEN[key]) return OPEN[key];
  if (OPEN[keyFlat]) return OPEN[keyFlat];
  // Qualités sans forme mobile : on se rabat sur la plus proche.
  const q = c.quality === 'add9' || c.quality === '6' ? '' : c.quality === 'm6' ? 'm' : c.quality === '9' ? '7' : c.quality;
  if (q !== c.quality) return shapeFor(chordName(c.root, q));
  const cands = MOVABLE.filter((m) => m.quality === q).map((m) => {
    const open = m.root === 6 ? 4 : 9; // Mi grave, La
    const fret = (((c.root - open) % 12) + 12) % 12 || 12;
    return { m, fret: fret === 12 && m.root === 6 ? 0 : fret };
  });
  const best = cands.sort((a, b) => a.fret - b.fret)[0];
  if (!best) return null;
  const { m, fret } = best;
  const frets = m.frets.map((f) => (f < 0 ? -1 : f + fret));
  const fingers = [...m.fingers].map((ch) => (ch === 'x' ? 0 : Number(ch)));
  const strings = m.frets.map((f, i) => (f >= 0 ? 6 - i : 0)).filter(Boolean);
  return { frets, fingers, barre: fret > 0 ? { fret, from: Math.max(...strings), to: Math.min(...strings) } : undefined, open: fret === 0 };
}

/** Difficulté d'une grille : nombre d'accords sans forme ouverte. */
export function hardChords(chords: string[]): string[] {
  return [...new Set(chords)].filter((c) => !shapeFor(c)?.open);
}

/**
 * Tonalité la plus facile : décalage (−5..+6 demi-tons) qui maximise les formes ouvertes.
 * Capo = case du capodastre pour garder la hauteur d'origine (décalage négatif → capo).
 */
export function easiestTransposition(chords: string[]): { shift: number; capo: number; hard: number } {
  const score = (sh: number) => hardChords(chords.map((c) => transposeChord(c, sh))).length;
  let best = { shift: 0, capo: 0, hard: score(0) };
  // Formes plus graves + capodastre (même hauteur), jusqu'à la 7e case.
  for (let sh = -1; sh >= -7; sh--) {
    const hard = score(sh);
    if (hard < best.hard) best = { shift: sh, capo: -sh, hard };
  }
  return best;
}

/** Accords pour les cours et le dictionnaire, par famille. */
export const CHORD_FAMILIES: { name: string; chords: string[] }[] = [
  { name: 'Premiers accords', chords: ['Em', 'Am', 'E', 'A', 'D', 'G', 'C', 'Dm'] },
  { name: 'Accords de 7e', chords: ['E7', 'A7', 'D7', 'G7', 'C7', 'B7', 'Am7', 'Em7', 'Dm7'] },
  { name: 'Couleurs (maj7, sus, add9)', chords: ['Cmaj7', 'Fmaj7', 'Gmaj7', 'Dmaj7', 'Amaj7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Cadd9'] },
  { name: 'Barrés', chords: ['F', 'Bm', 'Bb', 'F#m', 'B', 'Gm', 'Cm', 'Fm', 'C#m', 'Ab'] },
  { name: 'Power chords (rock)', chords: ['E5', 'A5', 'D5', 'G5', 'C5', 'F5'] },
];

export { FR as NOTE_FR };
