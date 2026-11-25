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

describe('morceaux personnels entre appareils', () => {
  it('le plus récent gagne, les suppressions ne reviennent pas', async () => {
    const { mergeUserSongs } = await import('../src/state/user-songs');
    const base = { composer: 'x', style: 'Mes morceaux' as const, level: 1 as const, tempo: 90, timeSignature: [4, 4] as [number, number], notation: 'C4:1' };
    const local = [{ ...base, id: 'a', title: 'A v2', savedAt: 20 }, { ...base, id: 'c', title: 'C', savedAt: 5 }];
    const remote = [{ ...base, id: 'a', title: 'A v1', savedAt: 10 }, { ...base, id: 'b', title: 'B', savedAt: 15 }, { ...base, id: 'd', title: 'D', savedAt: 1 }];
    const m = mergeUserSongs(local, remote, ['d']);
    expect(m.map((s) => s.title)).toEqual(['A v2', 'B', 'C']);
  });
});
