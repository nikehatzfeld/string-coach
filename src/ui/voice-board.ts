import { solfege } from '../songs/positions';
import type { MelodicNote } from './recorder-board';

/**
 * Courbe de hauteur en temps réel (voix, ou tout instrument) : la ligne colorée est ce que tu chantes,
 * la bande est la note visée. Vert = juste, orange = proche, rouge = loin.
 */
export class PitchTrace {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private points: { t: number; m: number | null }[] = [];
  private target: number | null = null;
  private nextTarget: number | null = null;
  private center = 67;
  private raf = 0;
  /** Fenêtre visible (ms). */
  windowMs = 6000;
  toleranceCents = 35;
  /** Deuxième voix (chant à deux) : note tenue par l'app, affichée en violet. */
  partner: number | null = null;

  constructor(host: HTMLElement, private readonly label = '') {
    host.classList.add('pitch-trace-host');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pitch-trace';
    host.replaceChildren(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Même interface que le manche : note visée et suivante. */
  show(current: MelodicNote[], next: MelodicNote[] = []): void {
    this.target = current[0]?.midi ?? null;
    this.nextTarget = next[0]?.midi ?? null;
    if (this.target !== null) this.center = this.target;
  }

  /** Hauteur entendue (MIDI flottant), ou null pour un silence. */
  feed(midi: number | null, time = performance.now()): void {
    // Voix grave une octave sous la note visée : on la ramène pour l'affichage.
    if (midi !== null && this.target !== null) {
      while (midi - this.target > 6.5) midi -= 12;
      while (this.target - midi > 6.5) midi += 12;
    }
    this.points.push({ t: time, m: midi });
    const cut = time - this.windowMs;
    while (this.points.length && this.points[0].t < cut) this.points.shift();
    if (midi !== null && this.target === null) this.center += (midi - this.center) * 0.05;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private draw(): void {
    const c = this.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const span = 14; // demi-tons visibles
    const lo = this.center - span / 2;
    const y = (m: number) => h - ((m - lo) / span) * h;
    const left = 54;
    // Lignes des notes
    g.font = '12px system-ui';
    for (let m = Math.ceil(lo); m <= lo + span; m++) {
      const pc = ((m % 12) + 12) % 12;
      const natural = ![1, 3, 6, 8, 10].includes(pc);
      g.strokeStyle = natural ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
      g.beginPath();
      g.moveTo(left, y(m));
      g.lineTo(w, y(m));
      g.stroke();
      g.fillStyle = natural ? 'rgba(238,241,247,0.7)' : 'rgba(238,241,247,0.35)';
      g.fillText(`${solfege(m, false)}${Math.floor(m / 12) - 1}`, 6, y(m) + 4);
    }
    const band = (m: number, color: string) => {
      const t = this.toleranceCents / 100;
      g.fillStyle = color;
      g.fillRect(left, y(m + t), w - left, y(m - t) - y(m + t));
    };
    if (this.nextTarget !== null && this.nextTarget !== this.target) band(this.nextTarget, 'rgba(79,209,165,0.08)');
    if (this.partner !== null) band(this.partner, 'rgba(170,120,255,0.25)');
    if (this.target !== null) band(this.target, 'rgba(255,181,71,0.28)');
    // Courbe
    const now = performance.now();
    const x = (t: number) => left + ((t - (now - this.windowMs)) / this.windowMs) * (w - left - 10);
    g.lineWidth = 4;
    g.lineCap = 'round';
    let prev: { t: number; m: number } | null = null;
    for (const p of this.points) {
      if (p.m === null) {
        prev = null;
        continue;
      }
      if (prev && Math.abs(p.m - prev.m) < 1.5) {
        const ref = this.target ?? Math.round(p.m);
        const off = Math.abs(p.m - ref) * 100;
        g.strokeStyle = off <= this.toleranceCents ? '#4fd1a5' : off <= this.toleranceCents * 2.5 ? '#ffb547' : '#ff6b6b';
        g.beginPath();
        g.moveTo(x(prev.t), y(prev.m));
        g.lineTo(x(p.t), y(p.m));
        g.stroke();
      }
      prev = { t: p.t, m: p.m };
    }
    const last = this.points[this.points.length - 1];
    if (last?.m != null) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x(last.t), y(last.m), 6, 0, Math.PI * 2);
      g.fill();
    }
    if (this.label) {
      g.fillStyle = 'rgba(238,241,247,0.6)';
      g.fillText(this.label, w - g.measureText(this.label).width - 8, 14);
    }
  }
}
