import { describe, expect, it } from 'vitest';
import { rateFor } from '../src/audio/rap-voice';
import { RAP_ORIGINALS } from '../src/songs/rap-originals';

describe('voix de rap', () => {
  it('débit ajusté à la mesure', () => {
    expect(rateFor(14, 2.7)).toBeGreaterThan(0.9);
    expect(rateFor(14, 2.7)).toBeLessThan(1.4);
    expect(rateFor(100, 1)).toBe(2.2);
    expect(rateFor(1, 10)).toBe(0.7);
  });
  it('chaque rap a ses vers calés sur les mesures', () => {
    for (const s of RAP_ORIGINALS) {
      const l = s.spoken!.lines;
      expect(l[0].bar).toBe(1);
      for (let i = 1; i < l.length; i++) expect(l[i].bar).toBe(l[i - 1].bar + l[i - 1].bars);
      const nBars = s.notation.split('|').length;
      expect(l[l.length - 1].bar + l[l.length - 1].bars).toBe(nBars);
    }
  });
});
