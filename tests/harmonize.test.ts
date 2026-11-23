import { describe, expect, it } from 'vitest';
import { harmonize, needsHarmony } from '../src/songs/harmonize';
import { parseNotation } from '../src/songs/notation';

describe('harmonisation automatique', () => {
  it('Frère Jacques en Ré : Ré au début, cadence finale sur Ré', () => {
    const bars = parseNotation('D4:4 E4:4 F#4:4 D4:4 | D4:4 E4:4 F#4:4 D4:4 | F#4:4 G4:4 A4:2 | F#4:4 G4:4 A4:2 | D4:4 A3:4 D4:2');
    expect(needsHarmony(bars)).toBe(true);
    const h = harmonize(bars, [4, 4]);
    const chords = h.flat().map((e) => e.chord).filter(Boolean);
    expect(chords[0]).toBe('D');
    expect(chords[chords.length - 1]).toBe('D');
    for (const c of chords) expect(['D', 'G', 'A', 'Bm', 'Em', 'F#m']).toContain(c);
  });
  it('accords déjà notés : rien à faire', () => {
    expect(needsHarmony(parseNotation('C4:1@C | D4:1@G | E4:1@C | C4:1@F'))).toBe(false);
  });
});
