import { describe, expect, it } from 'vitest';
import { GameJudge, type GameNote } from '../src/game/judge';

// 120 bpm : 960 ticks par noire = 500 ms → 1,92 tick/ms
const TPM = 1.92;
const notes = (): GameNote[] => [
  { tick: 960, duration: 960, midi: 69, lane: 2, label: '0' },
  { tick: 1920, duration: 960, midi: 69, lane: 2, label: '0' },
  { tick: 2880, duration: 960, midi: 71, lane: 2, label: '2' },
];
const at = (ms: number) => ms * TPM;

describe('arbitre du mode jeu', () => {
  it('parfait à l’heure, compensation de latence', () => {
    const j = new GameJudge(notes(), { latencyMs: 0 });
    expect(j.update(69, at(500), TPM)).toEqual([]); // 1re image : stabilisation
    const ev = j.update(69, at(516), TPM);
    expect(ev[0].judgment).toBe('perfect');
  });

  it('rejouer la même note exige un relâchement', () => {
    const j = new GameJudge(notes(), { latencyMs: 0 });
    j.update(69, at(500), TPM);
    j.update(69, at(516), TPM);
    // Note tenue jusqu'à la 2e : pas validée sans relâcher.
    expect(j.update(69, at(1000), TPM)).toEqual([]);
    expect(j.update(69, at(1016), TPM)).toEqual([]);
    j.update(null, at(1030), TPM);
    j.update(69, at(1040), TPM);
    expect(j.update(69, at(1056), TPM)[0].judgment).toBe('perfect');
  });

  it('bien en retard, ratée si absente, fausse note ignorée', () => {
    const j = new GameJudge(notes(), { latencyMs: 0 });
    j.update(70, at(500), TPM); // fausse note (La#)
    j.update(70, at(516), TPM);
    j.update(69, at(700), TPM);
    expect(j.update(69, at(716), TPM)[0]).toMatchObject({ judgment: 'good' });
    // La 2e note n'est jamais jouée : ratée après la fenêtre.
    const ev = j.update(null, at(1000 + 300), TPM);
    expect(ev.map((e) => e.judgment)).toEqual(['miss']);
    j.update(null, at(5000), TPM);
    expect(j.done).toBe(true);
  });
});
