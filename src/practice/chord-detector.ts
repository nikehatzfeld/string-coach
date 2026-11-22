import { chordName, chordPitchClasses } from '../songs/chords';

/**
 * Reconnaissance d'accords au micro : spectre → « chroma » (énergie de chacune des 12 notes),
 * comparé aux modèles d'accords. Moins fiable qu'une note seule : on vérifie surtout l'accord attendu.
 */

/** Chroma à partir d'un spectre d'amplitudes (bin i ↔ fréquence i × sampleRate / fftSize). */
export function chromaFromSpectrum(mags: Float32Array, sampleRate: number, fftSize: number, fmin = 75, fmax = 1400): number[] {
  const chroma = new Array(12).fill(0);
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(fmin / binHz));
  const hi = Math.min(mags.length - 2, Math.ceil(fmax / binHz));
  // Seuls les pics locaux comptent (les harmoniques de bruit sont écartés).
  let max = 0;
  for (let i = lo; i <= hi; i++) max = Math.max(max, mags[i]);
  if (max <= 0) return chroma;
  for (let i = lo; i <= hi; i++) {
    const m = mags[i];
    if (m < max * 0.05 || m < mags[i - 1] || m < mags[i + 1]) continue;
    const f = i * binHz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    // Les graves pèsent un peu plus (fondamentales), les aigus contiennent surtout des harmoniques.
    chroma[pc] += m * (f < 400 ? 1.2 : f < 800 ? 1 : 0.7);
  }
  const top = Math.max(...chroma);
  return top > 0 ? chroma.map((c) => c / top) : chroma;
}

function template(pcs: number[]): number[] {
  const t = new Array(12).fill(0);
  pcs.forEach((pc, i) => (t[pc] = i === 0 ? 1 : 0.9));
  return t;
}

function cosine(a: number[], b: number[]): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < 12; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

const CANDIDATES: string[] = [];
for (let r = 0; r < 12; r++) for (const q of ['', 'm', '7']) CANDIDATES.push(chordName(r, q));

export interface ChordMatch {
  /** Similarité avec l'accord attendu (0..1). */
  score: number;
  /** Accord le plus probable parmi les majeurs, mineurs et 7e. */
  best: string;
  bestScore: number;
  /** L'accord attendu est reconnu (meilleur, ou presque aussi bon que le meilleur). */
  ok: boolean;
}

export function matchChord(chroma: number[], expected: string): ChordMatch {
  const pcs = chordPitchClasses(expected);
  const score = pcs.length ? cosine(chroma, template(pcs)) : 0;
  let best = expected;
  let bestScore = score;
  for (const c of CANDIDATES) {
    const s = cosine(chroma, template(chordPitchClasses(c)));
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  // Tolérance : un accord de 7e ou un renversement proche ne doit pas faire échouer.
  const ok = score >= 0.7 && score >= bestScore - 0.06;
  return { score, best, bestScore, ok };
}

/** Écoute du micro pour les accords (spectre ~20 fois par seconde). */
export class ChordListener {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private timer = 0;

  async start(onFrame: (chroma: number[] | null, level: number) => void, deviceId?: string): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const resumed = this.ctx.resume().catch(() => {});
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, voiceIsolation: false, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } as MediaTrackConstraints,
    });
    await resumed;
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 8192;
    an.smoothingTimeConstant = 0.5;
    src.connect(an);
    const db = new Float32Array(an.frequencyBinCount);
    const td = new Float32Array(an.fftSize);
    const mags = new Float32Array(an.frequencyBinCount);
    let noise = 0.002;
    this.timer = window.setInterval(() => {
      an.getFloatTimeDomainData(td);
      let sum = 0;
      for (let i = 0; i < td.length; i++) sum += td[i] * td[i];
      const rms = Math.sqrt(sum / td.length);
      noise = rms < noise ? rms * 0.5 + noise * 0.5 : noise * 0.998 + rms * 0.002;
      const level = Math.max(0, Math.min(1, Math.log10(Math.max(rms, 1e-5) / Math.max(noise, 1e-5)) / 1.5));
      if (rms < Math.max(0.001, noise * 2)) return onFrame(null, level);
      an.getFloatFrequencyData(db);
      for (let i = 0; i < db.length; i++) mags[i] = Math.pow(10, db[i] / 20);
      onFrame(chromaFromSpectrum(mags, this.ctx!.sampleRate, an.fftSize), level);
    }, 50);
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream = null;
  }
}
