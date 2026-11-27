import { describe, expect, it } from 'vitest';
import { critique } from '../src/academy/critique';

describe('bilan critique', () => {
  it('repère les notes fausses avec mesure, doigt et corde', () => {
    const log = Array.from({ length: 16 }, (_, i) => ({ midi: 69 + (i % 4), cents: i === 5 ? -32 : 3, spread: 4, deltaMs: i === 9 ? -180 : 10, finger: i % 4, string: 2, bar: Math.floor(i / 4) + 1 }));
    const c = critique(log, 'game', true)!;
    expect(c.worst.join(' | ')).toMatch(/Mesure 2 · .* \(1er doigt, corde de La\) : -32 cents \(trop bas\)/);
    expect(c.worst.join(' ')).toMatch(/180 ms en avance/);
    expect(c.good.join(' ')).toMatch(/Justesse très précise/);
    expect(c.scores.find((s) => s.label === 'Justesse')!.value).toBeGreaterThan(80);
  });
  it('trop peu de notes : pas de bilan', () => expect(critique([], 'step', true)).toBeNull());
});
