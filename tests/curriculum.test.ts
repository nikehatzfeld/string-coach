import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { VIOLIN_PATH, STAGES, DOMAINS, byStage, coreOf } from '../src/academy/curriculum';
import { songToAlphaTex } from '../src/songs/alphatex';
import { INSTRUMENTS } from '../src/songs/instruments';
import { barBeats, parseNotation } from '../src/songs/notation';
import { placeMelody } from '../src/songs/positions';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

describe('parcours violon', () => {
  it('des centaines d’exercices, identifiants uniques, chaque palier a des clés', () => {
    console.log('exercices', VIOLIN_PATH.length, STAGES.map((s) => `${s.n}:${byStage(s.n).length}/${coreOf(s.n).length}`).join(' '));
    expect(VIOLIN_PATH.length).toBeGreaterThanOrEqual(400);
    expect(new Set(VIOLIN_PATH.map((e) => e.id)).size).toBe(VIOLIN_PATH.length);
    for (const s of STAGES) expect(coreOf(s.n).length, `palier ${s.n}`).toBeGreaterThanOrEqual(5);
    for (const d of DOMAINS) expect(VIOLIN_PATH.filter((e) => e.domain === d.id).length, d.id).toBeGreaterThan(20);
  });
  it('mesures complètes, notes jouables, partition chargée', () => {
    for (const e of VIOLIN_PATH) {
      const bars = parseNotation(e.notation);
      bars.forEach((b, i) => expect(barBeats(b), `${e.id} mesure ${i + 1}`).toBeCloseTo(4));
      const midis = bars.flat().filter((x) => x.kind === 'note').map((x) => x.midi!);
      expect(Math.min(...midis), e.id).toBeGreaterThanOrEqual(55);
      expect(Math.max(...midis), e.id).toBeLessThanOrEqual(103);
      let placed: unknown[] = [];
      try {
        placed = placeMelody(midis, INSTRUMENTS.violin, { onlyString: e.string, position: e.position });
      } catch (err) {
        throw new Error(`${e.id} : ${(err as Error).message}`);
      }
      expect(placed.length, e.id).toBe(midis.length);
      const score = alphaTab.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(e, INSTRUMENTS.violin));
      expect(score.tracks[0].staves[0].bars.length, e.id).toBeGreaterThan(0);
    }
  });
});
