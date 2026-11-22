import { describe, expect, it } from 'vitest';
import { buildSession, COURSES, resolveSong } from '../src/courses/plans';

describe('cours', () => {
  for (const inst of ['violin', 'guitar'] as const) {
    it(`${inst} : chaque morceau du parcours existe dans la bibliothèque`, () => {
      for (const stage of COURSES[inst].stages)
        for (const item of stage.items) if (item.song) expect(resolveSong(item.song), `${inst} ${item.title}`).toBeTruthy();
    });
    it(`${inst} : séances de 15, 20 et 30 min`, () => {
      for (const len of [15, 20, 30] as const) {
        const { items } = buildSession(inst, 3, len, ['ode-joie']);
        expect(items.length).toBeGreaterThan(2);
        expect(items.reduce((s, i) => s + i.minutes, 0)).toBeLessThanOrEqual(len + 3);
      }
    });
  }
});
