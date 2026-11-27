import { describe, expect, it } from 'vitest';
import { LIBRARY, songFor } from '../src/songs/library';
import { positionVersion, transposeNotation } from '../src/songs/position-version';
import { parseNotation, barBeats } from '../src/songs/notation';
import { placeMelody } from '../src/songs/positions';
import { INSTRUMENTS } from '../src/songs/instruments';
import { songToAlphaTex } from '../src/songs/alphatex';

describe('versions 1re / 3e position', () => {
  it('transpose notes et accords', () => {
    expect(transposeNotation('C4:8 D4@Am -:4 | r:2 F#5.', 2, false)).toBe('D4:8 E4@Bm -:4 | r:2 G#5.');
  });
  const pieces = LIBRARY.filter((s) => songFor(s, 'violin') && s.style !== 'Exercices' && s.level <= 4);
  it('couverture et validité', () => {
    let n1 = 0;
    let n3 = 0;
    for (const s of pieces) {
      for (const v of [1, 3] as const) {
        const ver = positionVersion(s, v);
        if (!ver) continue;
        v === 1 ? n1++ : n3++;
        const bars = parseNotation(ver.notation);
        expect(bars.length, ver.id).toBe(parseNotation(s.notation).length);
        const midis = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi!);
        expect(Math.min(...midis), ver.id).toBeGreaterThanOrEqual(55);
        expect(Math.max(...midis), ver.id).toBeLessThanOrEqual(v === 1 ? 83 : 86);
        const placed = placeMelody(midis, INSTRUMENTS.violin, { maxPosition: v });
        expect(Math.max(...placed.map((p) => p.position)), ver.id).toBeLessThanOrEqual(v);
        bars.forEach((b, i) => expect(barBeats(b), `${ver.id} ${i}`).toBeCloseTo(barBeats(parseNotation(s.notation)[i])));
        expect(() => songToAlphaTex(ver, INSTRUMENTS.violin)).not.toThrow();
      }
    }
    console.log(`morceaux ${pieces.length} · 1re position ${n1} · ≤3e ${n3}`);
    expect(n3).toBeGreaterThan(pieces.length * 0.85);
  });
});
