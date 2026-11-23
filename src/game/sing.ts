import type { GameNote, JudgeEvent } from './judge';
import type { Judgment } from './scoring';

/**
 * Jeu de chant : chaque note est une barre à tenir. Une marge de timing avant et après chaque note
 * (« grâce ») rend le jeu jouable malgré la latence du micro. Réussite nuancée :
 * - hauteur : part de la durée chantée juste (pleine valeur dans la tolérance, demi-valeur jusqu'au double) ;
 * - texte / attaque : la voix démarre à peu près au début de la syllabe (approximation de la parole).
 */
export interface SingOptions {
  toleranceCents: number;
  /** Marge avant / après chaque note (ms). */
  graceMs: number;
  latencyMs: number;
}

interface NoteState {
  acc: number;
  onset: number | null;
  done: boolean;
}

export class SingJudge {
  readonly opts: SingOptions;
  private states: NoteState[] = [];
  private lastTick: number | null = null;
  private voiced = false;

  constructor(
    readonly notes: GameNote[],
    opts: Partial<SingOptions> = {},
  ) {
    this.opts = { toleranceCents: 50, graceMs: 260, latencyMs: 80, ...opts };
    this.reset();
  }

  reset(): void {
    this.states = this.notes.map(() => ({ acc: 0, onset: null, done: false }));
    for (const n of this.notes) delete n.judged;
    this.lastTick = null;
    this.voiced = false;
  }

  /** Écart (demi-tons, octave indifférente) entre la voix et une note. */
  private static off(heard: number, target: number): number {
    let d = heard - target;
    while (d > 6) d -= 12;
    while (d < -6) d += 12;
    return Math.abs(d);
  }

  update(heard: number | null, tick: number, ticksPerMs: number): JudgeEvent[] {
    const t = tick - this.opts.latencyMs * ticksPerMs;
    const grace = this.opts.graceMs * ticksPerMs;
    const dt = this.lastTick === null ? 0 : Math.max(0, Math.min(t - this.lastTick, 200 * ticksPerMs));
    this.lastTick = t;
    const attack = heard !== null && !this.voiced;
    this.voiced = heard !== null;
    const tol = this.opts.toleranceCents / 100;
    const out: JudgeEvent[] = [];
    this.notes.forEach((n, i) => {
      const s = this.states[i];
      if (s.done) return;
      const start = n.tick - grace;
      const end = n.tick + n.duration + grace;
      if (t >= start && t <= end && heard !== null) {
        const off = SingJudge.off(heard, n.midi);
        const w = off <= tol ? 1 : off <= tol * 2 ? 0.5 : 0;
        s.acc += w * dt;
        if (w > 0 && s.onset === null && (attack || t <= n.tick + grace)) s.onset = t - n.tick;
      }
      if (t > end) {
        s.done = true;
        const coverage = Math.min(1, s.acc / Math.max(1, n.duration));
        let j: Judgment = coverage >= 0.6 ? 'perfect' : coverage >= 0.35 ? 'good' : coverage >= 0.15 ? 'ok' : 'miss';
        // Syllabe attaquée en retard (ou pas attaquée) : un cran de moins.
        const onTime = s.onset !== null && Math.abs(s.onset) <= grace * 1.5;
        if (!onTime && j !== 'miss') j = j === 'perfect' ? 'good' : 'ok';
        n.judged = j;
        out.push({ note: n, judgment: j, deltaMs: s.onset === null ? 0 : s.onset / ticksPerMs });
      }
    });
    return out;
  }
}
