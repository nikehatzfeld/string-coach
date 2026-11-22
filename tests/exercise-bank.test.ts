import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { EXERCISE_BANK, exercisesFor } from '../src/songs/exercise-bank';
import { songToAlphaTex } from '../src/songs/alphatex';
import { INSTRUMENTS } from '../src/songs/instruments';
import { barBeats, parseNotation } from '../src/songs/notation';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

describe('banque d’exercices', () => {
  it('au moins 200 exercices, identifiants uniques', () => {
    expect(EXERCISE_BANK.length).toBeGreaterThanOrEqual(200);
    expect(new Set(EXERCISE_BANK.map((e) => e.id)).size).toBe(EXERCISE_BANK.length);
    expect(exercisesFor('violin').length).toBeGreaterThan(150);
    expect(exercisesFor('guitar').length).toBeGreaterThan(150);
  });
  it('mesures justes et chargement alphaTab pour chaque instrument concerné', () => {
    for (const e of EXERCISE_BANK) {
      parseNotation(e.notation).forEach((b, i) => expect(barBeats(b), `${e.id} mesure ${i + 1}`).toBeCloseTo(4));
      for (const inst of Object.values(INSTRUMENTS)) {
        if (e.only && e.only !== inst.id) continue;
        const score = alphaTab.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(e, inst));
        expect(score.tracks[0].staves[0].bars.length, e.id).toBeGreaterThan(0);
      }
    }
  });
});
