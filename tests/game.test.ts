import { describe, expect, it } from 'vitest';
import {
  addPracticeTime, currentStreak, dailyChallenge, emptyProgress, levelInfo, recordResult, xpToNext, type ResultInput,
} from '../src/game/progress';
import { multiplierFor, ScoreKeeper, starsFor } from '../src/game/scoring';

const d = (s: string) => new Date(`${s}T12:00:00`);
const res = (o: Partial<ResultInput> = {}): ResultInput => ({
  songId: 'ode-joie', mode: 'step', score: 1000, stars: 2, notes: 40, perfect: 30, accuracy: 0.85, maxCombo: 12, ...o,
});

describe('niveaux', () => {
  it('courbe d’XP', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, needed: 100 });
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(100 + xpToNext(2)).level).toBe(3);
  });
});

describe('série', () => {
  it('compte les jours consécutifs et se réinitialise', () => {
    const p = emptyProgress(d('2026-11-01'));
    addPracticeTime(p, 5, d('2026-11-01'));
    addPracticeTime(p, 5, d('2026-11-01'));
    addPracticeTime(p, 5, d('2026-11-02'));
    expect(currentStreak(p, d('2026-11-02'))).toBe(2);
    expect(currentStreak(p, d('2026-11-03'))).toBe(2); // pas encore joué aujourd'hui
    expect(currentStreak(p, d('2026-11-04'))).toBe(0); // un jour manqué
    addPracticeTime(p, 5, d('2026-11-05'));
    expect(p.streak).toMatchObject({ count: 1, best: 2 });
  });
  it('objectif quotidien remis à zéro chaque jour', () => {
    const p = emptyProgress(d('2026-11-01'));
    addPracticeTime(p, 10, d('2026-11-01'));
    addPracticeTime(p, 3, d('2026-11-02'));
    expect(p.daily).toMatchObject({ day: '2026-11-02', minutes: 3 });
    expect(p.totals.minutes).toBe(13);
  });
});

describe('résultats et badges', () => {
  it('XP, record, badges', () => {
    const p = emptyProgress();
    const o = recordResult(p, res(), null);
    expect(o.xpGained).toBe(Math.round(40 * 0.85 * 2) + 40);
    expect(o.newBest).toBe(true);
    expect(o.newBadges.map((b) => b.id)).toContain('first-song');
    const o2 = recordResult(p, res({ score: 500 }), null);
    expect(o2.newBest).toBe(false);
    expect(p.songs['ode-joie']).toMatchObject({ best: 1000, plays: 2, stars: 2 });
    const o3 = recordResult(p, res({ score: 2000, stars: 3, accuracy: 1, maxCombo: 30 }), null);
    expect(o3.newBadges.map((b) => b.id)).toEqual(expect.arrayContaining(['three-stars', 'golden-ear', 'combo-25']));
  });
  it('défi du jour : déterministe, bonus une seule fois', () => {
    const songs = [
      { id: 'a', title: 'A', style: 'Classique', level: 1 },
      { id: 'b', title: 'B', style: 'Noël', level: 2 },
      { id: 'g', title: 'G', style: 'Gammes & arpèges', level: 1 },
    ];
    const now = d('2026-11-21');
    const c = dailyChallenge(songs, now)!;
    expect(c).toEqual(dailyChallenge(songs, now));
    expect(c.songId).not.toBe('g');
    const p = emptyProgress(now);
    const o = recordResult(p, res({ songId: c.songId, stars: 2 }), c, now);
    expect(o.challengeCompleted).toBe(true);
    expect(recordResult(p, res({ songId: c.songId, stars: 3 }), c, now).challengeCompleted).toBe(false);
  });
});

describe('score', () => {
  it('combo, multiplicateur, étoiles', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(25)).toBe(3);
    expect(multiplierFor(99)).toBe(4);
    const k = new ScoreKeeper(4);
    k.register('perfect');
    k.register('good');
    k.register('miss');
    k.register('ok');
    expect(k.maxCombo).toBe(2);
    expect(k.combo).toBe(0);
    expect(k.finalAccuracy()).toBeCloseTo((1 + 0.7 + 0 + 0.5) / 4);
    expect(starsFor(0.96)).toBe(3);
    expect(starsFor(0.5)).toBe(0);
  });
});

describe('mécaniques d’entraînement', () => {
  it('+4 BPM après 3 passages propres, −2 après un passage raté', () => {
    const p = emptyProgress();
    const clean = res({ accuracy: 0.97, stars: 3 });
    expect(recordResult(p, clean, null).tempoChange).toBe(0);
    expect(recordResult(p, clean, null).tempoChange).toBe(0);
    expect(recordResult(p, clean, null).tempoChange).toBe(4);
    expect(recordResult(p, res({ accuracy: 0.7, stars: 0 }), null).tempoChange).toBe(-2);
  });
  it('révisions espacées J+1, J+3…', async () => {
    const { dueReviews } = await import('../src/game/progress');
    const p = emptyProgress();
    recordResult(p, res({ stars: 3, accuracy: 1 }), null, d('2026-11-01'));
    expect(p.songs['ode-joie'].nextReview).toBe('2026-11-02');
    expect(dueReviews(p, d('2026-11-01'))).toEqual([]);
    expect(dueReviews(p, d('2026-11-02'))).toEqual(['ode-joie']);
    recordResult(p, res({ stars: 3, accuracy: 1 }), null, d('2026-11-02'));
    expect(p.songs['ode-joie'].nextReview).toBe('2026-11-05');
  });
});
