import { describe, expect, it } from 'vitest';
import { bestMajorKey, contourRange, contourSlope, diatonicStep, harmonyLine, melodyTimeline, voiceType } from '../src/practice/voice-lib';
import { LIBRARY } from '../src/songs/library';

describe('outils voix', () => {
  it('mélodie dans la tessiture vocale', () => {
    const m = melodyTimeline(LIBRARY.find((s) => s.id === 'frere-jacques')!);
    expect(m.length).toBeGreaterThan(20);
    for (const n of m) expect(n.midi).toBeGreaterThanOrEqual(55), expect(n.midi).toBeLessThanOrEqual(76);
  });
  it('tonalité et tierces dans la gamme', () => {
    expect(bestMajorKey([67, 69, 71, 72, 74, 76, 78, 79])).toBe(7); // Sol majeur
    expect(diatonicStep(64, 0, -2)).toBe(60); // Mi → Do en Do majeur
    expect(diatonicStep(67, 0, -2)).toBe(64); // Sol → Mi
    expect(diatonicStep(65, 0, -2)).toBe(62); // Fa → Ré (tierce mineure)
    const h = harmonyLine([{ start: 0, dur: 1, midi: 72 }, { start: 1, dur: 1, midi: 71 }, { start: 2, dur: 1, midi: 72 }]);
    expect(h.map((n) => n.midi)).toEqual([69, 67, 69]);
  });
  it('type de voix et parole', () => {
    expect(voiceType(48, 64)).toBe('baryton');
    expect(voiceType(60, 81)).toBe('soprano');
    const rise = Array.from({ length: 20 }, (_, i) => ({ t: i * 50, m: 55 + (i > 12 ? (i - 12) * 0.8 : 0) }));
    expect(contourSlope(rise)).toBeGreaterThan(5);
    expect(contourRange(Array.from({ length: 20 }, () => ({ m: 57 })))).toBe(0);
  });
});
