import { describe, expect, it } from 'vitest';
import { fretPosition, suggestedFinger } from '../src/ui/fingerboard';
import { INSTRUMENTS } from '../src/songs/instruments';

describe('manche', () => {
  it('géométrie de la corde : l’octave est au milieu', () => {
    expect(fretPosition(0)).toBe(0);
    expect(fretPosition(12)).toBeCloseTo(0.5);
    // Corde de violon de 328 mm : 1er demi-ton à ~18 mm du sillet.
    expect(fretPosition(1) * 328).toBeCloseTo(18.4, 0);
  });
  it('doigtés de 1re position au violon', () => {
    const v = INSTRUMENTS.violin;
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9].map((f) => suggestedFinger(f, v))).toEqual([0, 1, 1, 2, 2, 3, 4, 4, null]);
  });
  it('doigtés de 1re position à la guitare', () => {
    const g = INSTRUMENTS.guitar;
    expect([0, 1, 3, 5].map((f) => suggestedFinger(f, g))).toEqual([0, 1, 3, null]);
  });
});
