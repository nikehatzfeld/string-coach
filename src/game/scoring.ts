import type { Stars } from './progress';

/**
 * perfect : juste du premier coup (pas à pas) ou dans le temps à ±80 ms (jeu)
 * good    : juste mais hors de la fenêtre parfaite (jeu)
 * ok      : juste après une ou plusieurs erreurs (pas à pas)
 * miss    : note passée ou ratée
 */
export type Judgment = 'perfect' | 'good' | 'ok' | 'miss';

const POINTS: Record<Judgment, number> = { perfect: 100, good: 60, ok: 40, miss: 0 };
const WEIGHT: Record<Judgment, number> = { perfect: 1, good: 0.7, ok: 0.5, miss: 0 };

export const STAR_THRESHOLDS: [number, number, number] = [0.6, 0.8, 0.95];

export function starsFor(accuracy: number): Stars {
  if (accuracy >= STAR_THRESHOLDS[2]) return 3;
  if (accuracy >= STAR_THRESHOLDS[1]) return 2;
  if (accuracy >= STAR_THRESHOLDS[0]) return 1;
  return 0;
}

/** Multiplicateur de combo : ×1 puis +1 toutes les 10 notes, jusqu'à ×4. */
export function multiplierFor(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 10));
}

export class ScoreKeeper {
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judgment, number> = { perfect: 0, good: 0, ok: 0, miss: 0 };
  private weight = 0;

  constructor(readonly total: number) {}

  get played(): number {
    return this.counts.perfect + this.counts.good + this.counts.ok + this.counts.miss;
  }

  get multiplier(): number {
    return multiplierFor(this.combo);
  }

  /** Justesse pondérée sur les notes jouées (0..1). */
  get accuracy(): number {
    return this.played ? this.weight / this.played : 0;
  }

  register(j: Judgment): number {
    this.counts[j]++;
    this.weight += WEIGHT[j];
    if (j === 'perfect' || j === 'good') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.combo = 0;
    }
    const gained = POINTS[j] * multiplierFor(this.combo);
    this.score += gained;
    return gained;
  }

  /** Étoiles finales : justesse sur l'ensemble du morceau (notes non jouées = ratées). */
  finalAccuracy(): number {
    return this.total ? this.weight / this.total : 0;
  }

  stars(): Stars {
    return starsFor(this.finalAccuracy());
  }
}
