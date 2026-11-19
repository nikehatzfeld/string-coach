import { PitchDetector } from 'pitchy';

export interface PitchReading {
  freq: number | null;
  clarity: number;
  rms: number;
  time: number;
}

export interface MicOptions {
  /** Clarté minimale (0..1) pour accepter une hauteur. */
  minClarity: number;
  /** Niveau RMS minimal pour considérer qu'une note est jouée. */
  minRms: number;
  minFreq: number;
  maxFreq: number;
}

const DEFAULTS: MicOptions = { minClarity: 0.88, minRms: 0.01, minFreq: 70, maxFreq: 2000 };

/** Écoute le micro et renvoie la hauteur jouée environ 60 fois par seconde. */
export class MicPitchDetector {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private readonly opts: MicOptions;

  constructor(opts: Partial<MicOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  async start(onReading: (r: PitchReading) => void): Promise<void> {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new AudioContext();
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
      const [pitch, clarity] = detector.findPitch(buf, sampleRate);
      const ok =
        rms >= this.opts.minRms &&
        clarity >= this.opts.minClarity &&
        pitch >= this.opts.minFreq &&
        pitch <= this.opts.maxFreq;
      onReading({ freq: ok ? pitch : null, clarity, rms, time: performance.now() });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  async stop(): Promise<void> {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    this.ctx = null;
    this.stream = null;
  }
}
