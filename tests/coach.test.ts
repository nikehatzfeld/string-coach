import { describe, expect, it } from 'vitest';
import { emptyAcademy, recordAttempt, planSession, diagnose, currentStage, mergeAcademy, suggestedBpm, nextInDomain } from '../src/academy/coach';
import { nextProbe, placementSkills, placementStage, probeExercise, type Placement } from '../src/academy/assessment';
import { VIOLIN_PATH, coreOf } from '../src/academy/curriculum';
import { summarize } from '../src/academy/metrics';
import { parseNotation, barBeats } from '../src/songs/notation';

describe('coach violon', () => {
  it('une réussite nette fait monter le domaine, un échec facile ne fait pas chuter', () => {
    const st = emptyAcademy();
    st.skill.scales = 5;
    const ex = VIOLIN_PATH.find((e) => e.domain === 'scales' && e.stage === 6)!;
    recordAttempt(st, { id: ex.id, t: 1, bpm: ex.targetBpm, acc: 0.97, stars: 3, mode: 'game' }, ex);
    expect(st.skill.scales).toBeGreaterThan(5.3);
    const easy = VIOLIN_PATH.find((e) => e.domain === 'scales' && e.stage === 2)!;
    const before = st.skill.scales;
    recordAttempt(st, { id: easy.id, t: 2, bpm: 60, acc: 0.3, stars: 0, mode: 'game' }, easy);
    expect(st.skill.scales).toBe(before);
  });
  it('séance du jour : exercices variés, au niveau, points faibles d’abord', () => {
    const st = emptyAcademy();
    Object.assign(st.skill, { intonation: 6, bow: 6, fingers: 3, positions: 6, scales: 6, rhythm: 6, double: 5 });
    st.placed = 6;
    const plan = planSession({}, st, 20);
    expect(plan.length).toBe(5);
    expect(new Set(plan.map((p) => p.ex.id)).size).toBe(plan.length);
    expect(plan.some((p) => p.ex.domain === 'fingers' && p.ex.stage <= 4)).toBe(true);
    expect(currentStage({}, st)).toBe(6);
    expect(nextInDomain('fingers', {}, st)!.stage).toBe(3);
  });
  it('tempo conseillé : sous la cible au début, record + 4 ensuite', () => {
    const st = emptyAcademy();
    const ex = coreOf(3)[0];
    st.skill[ex.domain] = 3;
    expect(suggestedBpm(ex, st)).toBeLessThan(ex.targetBpm);
    st.bestBpm[ex.id] = 60;
    expect(suggestedBpm(ex, st)).toBe(Math.min(ex.targetBpm, 64));
  });
  it('diagnostic : doigt trop bas, précipitation', () => {
    const st = emptyAcademy();
    const m = summarize(
      Array.from({ length: 20 }, (_, i) => ({ midi: 69 + (i % 5), cents: i % 5 === 3 ? -22 : -2, spread: 5, deltaMs: -60, finger: i % 5, string: 2 })),
    );
    for (let i = 0; i < 4; i++) recordAttempt(st, { id: 'x', t: i + 1, bpm: 60, acc: 0.9, stars: 2, mode: 'game', m });
    const d = diagnose(st);
    expect(d.weaknesses.join(' ')).toMatch(/3e doigt souvent trop bas/);
    expect(d.weaknesses.join(' ')).toMatch(/précipites/);
  });
  it('fusion de deux appareils', () => {
    const a = emptyAcademy();
    const b = emptyAcademy();
    a.attempts.push({ id: 'x', t: 1, bpm: 60, acc: 1, stars: 3, mode: 'step' });
    b.attempts.push({ id: 'y', t: 2, bpm: 60, acc: 1, stars: 3, mode: 'step' });
    b.updatedAt = 5;
    b.skill.bow = 4;
    const m = mergeAcademy(a, b)!;
    expect(m.attempts.length).toBe(2);
    expect(m.skill.bow).toBe(4);
  });
});

describe('évaluation', () => {
  it('monte après une réussite, descend après un échec, et place l’élève', () => {
    const p: Placement = { guess: 4, results: [] };
    let guard = 0;
    for (let nx = nextProbe(p); nx && guard < 20; nx = nextProbe(p), guard++) {
      const ex = probeExercise(nx.domain, nx.stage)!;
      expect(ex).toBeTruthy();
      parseNotation(ex.notation).forEach((b) => expect(barBeats(b)).toBeCloseTo(4));
      // Élève solide en justesse (réussit tout), faible en rythme (échoue tout).
      const pass = nx.domain === 'rhythm' ? false : nx.domain === 'intonation' ? true : nx.stage <= 5;
      p.results.push({ domain: nx.domain, stage: nx.stage, acc: pass ? 0.9 : 0.5, pass });
    }
    expect(p.results.length).toBeGreaterThanOrEqual(10);
    const sk = placementSkills(p);
    expect(sk.intonation).toBeGreaterThan(sk.rhythm + 3);
    expect(placementStage(sk)).toBeGreaterThanOrEqual(3);
  });
});
