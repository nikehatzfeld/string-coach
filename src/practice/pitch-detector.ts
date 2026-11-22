import { PitchDetector } from 'pitchy';

export interface PitchReading {
  freq: number | null;
  clarity: number;
  rms: number;
  /** Niveau relatif au bruit de fond (0..1), pour l'indicateur. */
  level: number;
  /** Hauteur brute détectée même si elle est rejetée (pour l'affichage « j'entends »). */
  rawFreq: number;
  time: number;
}

export interface MicOptions {
  /** Clarté minimale (0..1) pour accepter une hauteur. */
  minClarity: number;
  /** Niveau RMS minimal absolu. */
  minRms: number;
  /** Le signal doit dépasser le bruit de fond de ce facteur. */
  noiseFactor: number;
  minFreq: number;
  maxFreq: number;
}

/**
 * Seuils volontairement bas : sur téléphone et tablette, sans contrôle automatique du gain,
 * le micro capte beaucoup plus faiblement qu'un ordinateur. Le bruit de fond est mesuré en continu.
 */
const DEFAULTS: MicOptions = { minClarity: 0.78, minRms: 0.0015, noiseFactor: 2.5, minFreq: 70, maxFreq: 2200 };

/** Écoute le micro et renvoie la hauteur jouée environ 60 fois par seconde. */
export class MicPitchDetector {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private timer = 0;
  private readonly opts: MicOptions;
  private noiseFloor = 0.002;
  private resumeOnGesture = () => this.ctx?.state === 'suspended' && this.ctx.resume();

  constructor(opts: Partial<MicOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  /** À appeler depuis un clic : le contexte audio est créé avant toute attente (exigence iOS / Android). */
  async start(onReading: (r: PitchReading) => void): Promise<void> {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const resumed = this.ctx.resume().catch(() => {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') {
        await this.stop();
        throw err;
      }
      // Certains appareils refusent ces réglages : micro par défaut.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    await resumed;
    // Si le navigateur a quand même suspendu l'audio, on le relance au prochain geste.
    document.addEventListener('pointerdown', this.resumeOnGesture);
    document.addEventListener('keydown', this.resumeOnGesture);

    const source = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);
    const detector = PitchDetector.forFloat32Array(buf.length);
    const sampleRate = this.ctx.sampleRate;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Bruit de fond : descend vite, remonte lentement.
      this.noiseFloor = rms < this.noiseFloor ? rms * 0.5 + this.noiseFloor * 0.5 : this.noiseFloor * 0.999 + rms * 0.001;
      const [pitch, clarity] = detector.findPitch(buf, sampleRate);
      const loud = rms >= Math.max(this.opts.minRms, this.noiseFloor * this.opts.noiseFactor);
      const ok = loud && clarity >= this.opts.minClarity && pitch >= this.opts.minFreq && pitch <= this.opts.maxFreq;
      const level = Math.max(0, Math.min(1, Math.log10(Math.max(rms, 1e-5) / Math.max(this.noiseFloor, 1e-5)) / 1.5));
      onReading({ freq: ok ? pitch : null, rawFreq: loud ? pitch : 0, clarity, rms, level, time: performance.now() });
    };
    // setInterval plutôt que requestAnimationFrame : continue même si l'écran rafraîchit peu (TV, économie d'énergie).
    this.timer = window.setInterval(tick, 16);
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    document.removeEventListener('pointerdown', this.resumeOnGesture);
    document.removeEventListener('keydown', this.resumeOnGesture);
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream = null;
  }
}
