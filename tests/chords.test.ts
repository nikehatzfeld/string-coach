import { describe, expect, it } from 'vitest';
import { chordNameFr, chordPitchClasses, easiestTransposition, parseChordName, shapeFor, transposeChord } from '../src/songs/chords';

describe('accords de guitare', () => {
  it('formes ouvertes connues', () => {
    expect(shapeFor('C')!.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(shapeFor('G')!.open).toBe(true);
    expect(shapeFor('Am')!.frets).toEqual([-1, 0, 2, 2, 1, 0]);
  });
  it('barrés calculés', () => {
    expect(shapeFor('F')!.frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(shapeFor('F')!.barre).toEqual({ fret: 1, from: 6, to: 1 });
    expect(shapeFor('Bm')!.frets).toEqual([-1, 2, 4, 4, 3, 2]);
    expect(shapeFor('Bb')!.frets).toEqual([-1, 1, 3, 3, 3, 1]);
    expect(shapeFor('F#m')!.frets).toEqual([2, 4, 4, 2, 2, 2]);
    expect(shapeFor('C#m')!.frets).toEqual([-1, 4, 6, 6, 5, 4]);
  });
  it('chaque forme joue bien les notes de l’accord', () => {
    const tuning = [40, 45, 50, 55, 59, 64];
    for (const name of ['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm', 'E7', 'A7', 'D7', 'G7', 'C7', 'B7', 'F', 'Bm', 'Bb', 'F#m', 'Gm', 'Cm', 'Cmaj7', 'Fmaj7', 'Asus4', 'Dsus2', 'Ab', 'Eb', 'C#m', 'G#m']) {
      const sh = shapeFor(name)!;
      const pcs = new Set(chordPitchClasses(name));
      sh.frets.forEach((f, i) => {
        if (f >= 0) expect(pcs.has((tuning[i] + f) % 12), `${name} corde ${6 - i}`).toBe(true);
      });
    }
  });
  it('noms, transposition', () => {
    expect(parseChordName('F#m7')).toMatchObject({ root: 6, quality: 'm7' });
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('Am', -2)).toBe('Gm');
    expect(chordNameFr('F#m')).toBe('Fa♯m');
  });
  it('tonalité facile avec capodastre', () => {
    // Fa – Si♭ – Do : capo 1 → Mi – La – Si ? Non : capo 3 → Ré – Sol – La (toutes ouvertes)
    const r = easiestTransposition(['F', 'Bb', 'C']);
    expect(r.hard).toBe(0);
    expect(r.capo).toBeGreaterThan(0);
  });
});
