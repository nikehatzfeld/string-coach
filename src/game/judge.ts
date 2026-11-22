import type { Judgment } from './scoring';
import { centsToNearestOctave } from '../songs/notation';

export interface GameNote {
  /** Début en ticks MIDI (960 par noire). */
  tick: number;
  duration: number;
  midi: number;
  /** Couloir : 0 = corde la plus grave. */
  lane: number;
  /** Doigt (ou case) affiché dans la note. */
  label: string;
  /** Nom de la note avec ♯ ou ♭. */
  name?: string;
  judged?: Judgment;
}

export interface JudgeEvent {
  note: GameNote;
  judgment: Judgment;
  /** Écart en ms (négatif = en avance). */
  deltaMs: number;
}

export interface JudgeOptions {
  perfectMs: number;
  earlyMs: number;
  lateMs: number;
  toleranceCents: number;
  latencyMs: number;
  /** Nombre d'images consécutives sur la bonne note pour valider. */
  stableFrames: number;
}

export const DEFAULT_JUDGE: JudgeOptions = {
  perfectMs: 80,
  earlyMs: 160,
  lateMs: 260,
  toleranceCents: 50,
  latencyMs: 80,
  stableFrames: 2,
};

/**
 * Arbitre du mode jeu : compare la note entendue aux notes attendues autour de la position de lecture.
 * Les ticks sont convertis en ms avec la vitesse courante du lecteur (ticks par ms).
 */
export class GameJudge {
  readonly opts: JudgeOptions;
  private next = 0;
  private candidate: { note: GameNote; frames: number; firstTick: number } | null = null;
  private lastHitMidi: number | null = null;
  private needRelease = false;
  private releasePeak = 0;

  constructor(
    readonly notes: GameNote[],
    opts: Partial<JudgeOptions> = {},
  ) {
    this.opts = { ...DEFAULT_JUDGE, ...opts };
  }

  get done(): boolean {
    return this.notes.every((n) => n.judged);
  }

  reset(): void {
    for (const n of this.notes) n.judged = undefined;
    this.next = 0;
    this.candidate = null;
    this.lastHitMidi = null;
    this.needRelease = false;
  }

  /**
   * @param heardMidi hauteur entendue (MIDI flottant) ou null
   * @param tick position de lecture courante
   * @param ticksPerMs vitesse de lecture
   */
  update(heardMidi: number | null, tick: number, ticksPerMs: number, rms?: number): JudgeEvent[] {
    if (this.needRelease && rms !== undefined) {
      this.releasePeak = Math.max(this.releasePeak, rms);
      if (rms < this.releasePeak * 0.55) this.needRelease = false;
    }
    const events: JudgeEvent[] = [];
    const o = this.opts;
    const eff = tick - o.latencyMs * ticksPerMs;
    const late = o.lateMs * ticksPerMs;
    const early = o.earlyMs * ticksPerMs;

    // Notes dépassées : ratées.
    while (this.next < this.notes.length && (this.notes[this.next].judged || this.notes[this.next].tick + late < eff)) {
      const n = this.notes[this.next];
      if (!n.judged) {
        n.judged = 'miss';
        events.push({ note: n, judgment: 'miss', deltaMs: o.lateMs });
      }
      this.next++;
    }

    if (heardMidi === null || (this.lastHitMidi !== null && Math.round(heardMidi) !== this.lastHitMidi)) this.needRelease = false;
    if (heardMidi === null) {
      this.candidate = null;
      return events;
    }

    // Première note non jugée dans la fenêtre et à la bonne hauteur.
    let match: GameNote | null = null;
    for (let i = this.next; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.tick - early > eff) break;
      if (n.judged) continue;
      if (Math.abs(centsToNearestOctave((heardMidi - n.midi) * 100)) <= o.toleranceCents) {
        if (this.needRelease && n.midi === this.lastHitMidi) continue;
        match = n;
        break;
      }
    }
    if (!match) {
      this.candidate = null;
      return events;
    }
    if (!this.candidate || this.candidate.note !== match) this.candidate = { note: match, frames: 0, firstTick: eff };
    this.candidate.frames++;
    if (this.candidate.frames < o.stableFrames) return events;

    const deltaMs = (this.candidate.firstTick - match.tick) / ticksPerMs;
    const judgment: Judgment = Math.abs(deltaMs) <= o.perfectMs ? 'perfect' : 'good';
    match.judged = judgment;
    events.push({ note: match, judgment, deltaMs });
    this.lastHitMidi = match.midi;
    this.needRelease = true;
    this.releasePeak = 0;
    this.candidate = null;
    return events;
  }
}
