import { centsToNearestOctave, freqToMidiFloat } from '../songs/notation';

export interface StepTarget {
  midi: number;
  /** Index dans la liste de beats d'alphaTab, pour placer le curseur. */
  beatIndex: number;
}

export interface TrainerOptions {
  /** Tolérance de justesse en cents (±). */
  toleranceCents: number;
  /** Durée minimale de stabilité dans la tolérance avant validation (ms). */
  holdMs: number;
  /** Silence minimal pour réattaquer une note identique à la précédente (ms). */
  releaseMs: number;
  a4: number;
  /** Accepter la bonne note à une autre octave (erreurs d'octave fréquentes du détecteur). */
  anyOctave: boolean;
}

export const DEFAULT_TRAINER_OPTIONS: TrainerOptions = {
  toleranceCents: 35,
  holdMs: 80,
  releaseMs: 60,
  a4: 440,
  anyOctave: true,
};

export type Verdict = 'silence' | 'listening' | 'too-low' | 'too-high' | 'holding' | 'validated' | 'finished';

export interface TrainerUpdate {
  verdict: Verdict;
  /** Écart à la note cible en cents (null si silence). */
  cents: number | null;
  /** Note entendue (MIDI flottant). */
  heardMidi: number | null;
  index: number;
}

/**
 * Logique du mode pas à pas : on n'avance que lorsque la note jouée est juste et stable.
 * Indépendante du micro et de l'affichage pour pouvoir être testée.
 */
export class StepTrainer {
  private idx = 0;
  private holdSince: number | null = null;
  private silenceSince: number | null = null;
  private needRelease = false;
  private releasePeak = 0;
  readonly options: TrainerOptions;

  constructor(
    readonly targets: StepTarget[],
    options: Partial<TrainerOptions> = {},
  ) {
    this.options = { ...DEFAULT_TRAINER_OPTIONS, ...options };
  }

  get index(): number {
    return this.idx;
  }

  get current(): StepTarget | null {
    return this.targets[this.idx] ?? null;
  }

  get finished(): boolean {
    return this.idx >= this.targets.length;
  }

  reset(index = 0): void {
    this.idx = Math.max(0, Math.min(index, this.targets.length));
    this.holdSince = null;
    this.needRelease = false;
  }

  /** Avance manuellement (bouton « passer » ou télécommande). */
  skip(): void {
    if (!this.finished) this.advance();
  }

  back(): void {
    this.reset(this.idx - 1);
  }

  /**
   * @param freq fréquence détectée en Hz, ou null si silence / signal peu clair
   * @param now horodatage en ms
   * @param rms niveau du signal : une baisse nette (changement d'archet) compte comme une nouvelle attaque
   */
  update(freq: number | null, now: number, rms?: number): TrainerUpdate {
    if (this.needRelease && rms !== undefined) {
      this.releasePeak = Math.max(this.releasePeak, rms);
      if (rms < this.releasePeak * 0.55) this.needRelease = false;
    }
    if (this.finished) return { verdict: 'finished', cents: null, heardMidi: null, index: this.idx };

    if (freq === null || freq <= 0) {
      this.holdSince = null;
      if (this.silenceSince === null) this.silenceSince = now;
      if (this.needRelease && now - this.silenceSince >= this.options.releaseMs) this.needRelease = false;
      return { verdict: 'silence', cents: null, heardMidi: null, index: this.idx };
    }
    this.silenceSince = null;

    const target = this.targets[this.idx];
    const heard = freqToMidiFloat(freq, this.options.a4);
    const raw = (heard - target.midi) * 100;
    const cents = this.options.anyOctave ? centsToNearestOctave(raw) : raw;

    if (this.needRelease) {
      return { verdict: 'listening', cents, heardMidi: heard, index: this.idx };
    }
    if (Math.abs(cents) > this.options.toleranceCents) {
      this.holdSince = null;
      return { verdict: cents < 0 ? 'too-low' : 'too-high', cents, heardMidi: heard, index: this.idx };
    }
    if (this.holdSince === null) this.holdSince = now;
    if (now - this.holdSince >= this.options.holdMs) {
      const validatedIndex = this.idx;
      this.advance();
      return { verdict: 'validated', cents, heardMidi: heard, index: validatedIndex };
    }
    return { verdict: 'holding', cents, heardMidi: heard, index: this.idx };
  }

  private advance(): void {
    const prev = this.targets[this.idx];
    this.idx++;
    this.holdSince = null;
    const next = this.targets[this.idx];
    // Deux notes identiques de suite : il faut relâcher avant de rejouer.
    this.needRelease = !!next && !!prev && next.midi === prev.midi;
    this.releasePeak = 0;
  }
}
