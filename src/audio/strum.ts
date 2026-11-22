import { shapeFor } from '../songs/chords';

/**
 * Guitare synthétique (Karplus-Strong calculé en JS, mis en cache par note) et rythmes de grattage.
 * Pas de banque de sons à charger : léger et disponible hors ligne.
 */

const TUNING = [40, 45, 50, 55, 59, 64]; // Mi grave → Mi aigu

/** Corde pincée : bruit filtré dans une boucle de retard (Karplus-Strong). Pur, testable. */
export function pluck(midi: number, sampleRate: number, seconds = 2.2, brightness = 0.5): Float32Array {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const n = Math.round(sampleRate / f);
  const out = new Float32Array(Math.round(sampleRate * seconds));
  const buf = new Float32Array(n);
  let seed = midi * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) buf[i] = rnd();
  // Pré-filtrage du bruit : attaque plus douce si brightness faible.
  for (let k = 0; k < 2; k++) for (let i = 1; i < n; i++) buf[i] = buf[i] * brightness + buf[i - 1] * (1 - brightness);
  const decay = 0.996 - Math.max(0, midi - 52) * 0.00012;
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const next = (idx + 1) % n;
    const v = buf[idx];
    out[i] = v;
    buf[idx] = (v + buf[next]) * 0.5 * decay;
    idx = next;
  }
  return out;
}

export type StrumStep = 'D' | 'U' | 'B' | 'A' | 'C' | 'X' | '-' | `s${number}`;

export interface StrumPattern {
  id: string;
  name: string;
  /** Temps par mesure pour lesquels le rythme est écrit (4, 3 ou 6 pour 6/8). */
  beats: number;
  /** Une case par croche. D = bas, U = haut, B = basse, A = basse alternée, C = accord (cordes aiguës), X = étouffé, s3 = corde 3 seule, - = rien. */
  steps: StrumStep[];
  tip: string;
}

export const PATTERNS: StrumPattern[] = [
  { id: 'plaque', name: 'Plaqué (1 par mesure)', beats: 4, steps: ['D', '-', '-', '-', '-', '-', '-', '-'], tip: 'Un seul coup vers le bas, on laisse sonner : pour apprendre les changements.' },
  { id: 'noires', name: 'Noires ↓ ↓ ↓ ↓', beats: 4, steps: ['D', '-', 'D', '-', 'D', '-', 'D', '-'], tip: 'Un coup vers le bas par temps. La main ne s’arrête jamais.' },
  { id: 'pop', name: 'Pop / folk ↓ ↓↑ ↑↓↑', beats: 4, steps: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], tip: 'Le grand classique. La main fait toujours bas-haut ; on « rate » les cordes sur le 3e temps.' },
  { id: 'croches', name: 'Croches ↓↑ ↓↑ ↓↑ ↓↑', beats: 4, steps: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], tip: 'Bas sur les temps, haut entre les temps. Accentue les temps 2 et 4.' },
  { id: 'boom-chuck', name: 'Basse-accord (country, folk)', beats: 4, steps: ['B', '-', 'C', '-', 'A', '-', 'C', '-'], tip: 'Basse (fondamentale), accord, basse alternée, accord. Le pouce joue les basses.' },
  { id: 'arpege', name: 'Arpège ballade (p-i-m-a)', beats: 4, steps: ['B', 's3', 's2', 's1', 's2', 's3', 's2', 's3'], tip: 'Pouce sur la basse, puis index, majeur, annulaire sur les cordes 3, 2, 1.' },
  { id: 'reggae', name: 'Reggae (contretemps)', beats: 4, steps: ['-', '-', 'X', '-', '-', '-', 'X', '-'], tip: 'Accord court et étouffé sur les temps 2 et 4 seulement.' },
  { id: 'rock', name: 'Rock (croches étouffées)', beats: 4, steps: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'], tip: 'Tout vers le bas, paume légèrement posée sur les cordes près du chevalet.' },
  { id: 'valse', name: 'Valse 3/4 (basse-accord-accord)', beats: 3, steps: ['B', '-', 'C', '-', 'C', '-'], tip: 'Un-deux-trois : basse sur le 1, accord sur le 2 et le 3.' },
  { id: 'valse-arp', name: 'Arpège 3/4', beats: 3, steps: ['B', 's3', 's2', 's1', 's2', 's3'], tip: 'Pouce, puis index-majeur-annulaire-majeur-index.' },
  { id: '68', name: '6/8 ballade ↓ ↓↑ ↓ ↓↑', beats: 6, steps: ['D', '-', 'U', 'D', '-', 'U'], tip: 'Deux grands temps de trois croches (House of the Rising Sun, Greensleeves).' },
  { id: '68-arp', name: 'Arpège 6/8', beats: 6, steps: ['B', 's3', 's2', 's1', 's2', 's3'], tip: 'Pouce, 3, 2, 1, 2, 3 : le motif de House of the Rising Sun.' },
];

/** Rythmes adaptés à une mesure : 3/4, 6/8, ou binaire (2/4 et 4/4). */
export function patternsFor(ts: [number, number]): StrumPattern[] {
  const beats = ts[1] === 8 && ts[0] % 3 === 0 ? 6 : ts[0] === 3 ? 3 : 4;
  return PATTERNS.filter((p) => p.beats === beats || p.id === 'plaque');
}

/** Cordes (indices 0..5, 0 = Mi grave) jouées par une case du rythme pour une forme d'accord. */
export function stringsForStep(step: StrumStep, frets: number[]): number[] {
  const playable = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  const bass = playable[0] ?? 0;
  switch (step) {
    case 'D':
      return playable;
    case 'U':
      return playable.filter((i) => i >= 2).reverse();
    case 'B':
      return [bass];
    case 'A': {
      // Basse alternée : la corde jouée suivante (souvent la quinte).
      const alt = playable.find((i) => i > bass) ?? bass;
      return [alt];
    }
    case 'C':
    case 'X':
      return playable.filter((i) => i >= 2);
    case '-':
      return [];
    default: {
      const s = Number(step.slice(1)); // 1 = Mi aigu
      const i = 6 - s;
      return frets[i] >= 0 ? [i] : [];
    }
  }
}

/** Joue les accords avec un AudioContext (cache des cordes par hauteur). */
export class StrumSynth {
  readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly cache = new Map<number, AudioBuffer>();

  constructor(ctx?: AudioContext) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = ctx ?? new Ctx();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    this.out.connect(lp).connect(this.ctx.destination);
  }

  set volume(v: number) {
    this.out.gain.value = v;
  }

  private buffer(midi: number): AudioBuffer {
    let b = this.cache.get(midi);
    if (!b) {
      const data = pluck(midi, this.ctx.sampleRate);
      b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.cache.set(midi, b);
    }
    return b;
  }

  /** Une case de rythme pour un accord, à l'instant `when` (secondes, horloge audio). */
  play(chord: string, step: StrumStep, when: number, stepDur: number): void {
    const shape = shapeFor(chord);
    if (!shape || step === '-') return;
    const strings = stringsForStep(step, shape.frets);
    const gap = step === 'U' ? 0.009 : 0.012;
    const level = step === 'U' ? 0.6 : step === 'B' || step === 'A' ? 0.9 : 0.75;
    const short = step === 'X' || step === 'C';
    strings.forEach((s, k) => {
      const midi = TUNING[s] + shape.frets[s];
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer(midi);
      const g = this.ctx.createGain();
      const t = when + (step.startsWith('s') || step === 'B' || step === 'A' ? 0 : k * gap);
      g.gain.setValueAtTime(level, t);
      // Accord court (étouffé) ou laissé sonner jusqu'au prochain coup.
      const end = t + (step === 'X' ? 0.12 : short ? Math.min(stepDur * 1.6, 0.5) : 2);
      g.gain.setTargetAtTime(0.0001, end - 0.05, 0.04);
      src.connect(g).connect(this.out);
      src.start(t);
      src.stop(end + 0.3);
    });
  }

  /** Clic de métronome. */
  click(when: number, accent: boolean): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.25, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start(when);
    o.stop(when + 0.06);
  }
}
