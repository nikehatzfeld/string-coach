import { describe, expect, it } from 'vitest';
import { SingJudge } from '../src/game/sing';

const note = (tick: number, midi: number) => ({ tick, duration: 960, midi, lane: 0, label: 'la' });
const run = (j: SingJudge, from: number, to: number, f: (t: number) => number | null) => {
  const evs = [];
  for (let t = from; t <= to; t += 16) evs.push(...j.update(f(t), t, 1));
  return evs;
};

describe('jeu de chant', () => {
  it('note tenue juste et à l’heure : parfait', () => {
    const j = new SingJudge([note(1000, 69)], { latencyMs: 0 });
    const ev = run(j, 0, 2500, (t) => (t >= 1000 && t <= 1960 ? 69.1 : null));
    expect(ev.map((e) => e.judgment)).toEqual(['perfect']);
  });
  it('une octave plus bas compte ; à moitié juste : bien ou presque', () => {
    const j = new SingJudge([note(1000, 69)], { latencyMs: 0 });
    expect(run(j, 0, 2500, (t) => (t >= 1000 && t <= 1960 ? 57 : null))[0].judgment).toBe('perfect');
    const k = new SingJudge([note(1000, 69)], { latencyMs: 0 });
    expect(['good', 'ok']).toContain(run(k, 0, 2500, (t) => (t >= 1000 && t <= 1500 ? 69 : null))[0].judgment);
  });
  it('attaque très en retard : un cran de moins ; silence : raté', () => {
    const j = new SingJudge([note(1000, 69)], { latencyMs: 0, graceMs: 100 });
    expect(run(j, 0, 2500, (t) => (t >= 1300 && t <= 2060 ? 69 : null))[0].judgment).not.toBe('perfect');
    const k = new SingJudge([note(1000, 69)], { latencyMs: 0 });
    expect(run(k, 0, 2500, () => null)[0].judgment).toBe('miss');
  });
});
