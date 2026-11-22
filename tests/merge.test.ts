import { describe, expect, it } from 'vitest';
import { mergeProgress } from '../src/cloud/merge';
import { emptyProgress, recordResult, type ResultInput } from '../src/game/progress';

const res = (o: Partial<ResultInput>): ResultInput => ({ songId: 'a', mode: 'step', score: 100, stars: 1, notes: 10, perfect: 5, accuracy: 0.7, maxCombo: 3, ...o });

describe('fusion de deux appareils', () => {
  it('garde le meilleur de chaque', () => {
    const pc = emptyProgress(new Date('2026-11-20T12:00:00'));
    const phone = emptyProgress(new Date('2026-11-21T12:00:00'));
    recordResult(pc, res({ songId: 'a', score: 900, stars: 3, accuracy: 1, maxCombo: 30 }), null, new Date('2026-11-20T12:00:00'));
    recordResult(phone, res({ songId: 'a', score: 500, stars: 2 }), null, new Date('2026-11-21T12:00:00'));
    recordResult(phone, res({ songId: 'b', score: 300 }), null, new Date('2026-11-21T12:00:00'));
    const m = mergeProgress(pc, phone);
    expect(m.songs.a).toMatchObject({ best: 900, stars: 3 });
    expect(m.songs.b.best).toBe(300);
    expect(m.xp).toBe(Math.max(pc.xp, phone.xp));
    expect(Object.keys(m.badges)).toEqual(expect.arrayContaining(Object.keys(pc.badges)));
    expect(m.streak.lastDay).toBe('2026-11-21');
    expect(m.totals.bestCombo).toBe(30);
  });
});
