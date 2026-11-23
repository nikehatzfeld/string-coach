import type { GameNote } from './judge';
import type { Judgment } from './scoring';
import { solfege } from '../songs/positions';

const COLORS: Record<Judgment, string> = { perfect: '#4fd1a5', good: '#5aa9ff', ok: '#ffb547', miss: '#ff6b6b' };
const LABEL: Record<Judgment, string> = { perfect: 'Parfait !', good: 'Bien', ok: 'Presque', miss: 'Raté' };

/**
 * Piste de chant (style karaoké) : le temps défile de droite à gauche, la hauteur est verticale et FIXE.
 * Les notes sont des barres épaisses avec leur syllabe ; la voix est une ligne épaisse ; la ligne
 * verticale est « maintenant ».
 */
export class SingLane {
  private readonly ctx: CanvasRenderingContext2D;
  private raf = 0;
  private anchorTick = 0;
  private anchorTime = 0;
  private ticksPerMs = 1.6;
  private playing = false;
  private trail: { tick: number; m: number | null }[] = [];
  private popups: { text: string; color: string; born: number; y: number }[] = [];
  private readonly lo: number;
  private readonly hi: number;
  /** Ticks visibles avant / après « maintenant ». */
  past = 960 * 2;
  future = 960 * 8;
  toleranceCents = 50;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly notes: GameNote[],
  ) {
    this.ctx = canvas.getContext('2d')!;
    const ms = notes.map((n) => n.midi);
    this.lo = (ms.length ? Math.min(...ms) : 60) - 3;
    this.hi = (ms.length ? Math.max(...ms) : 72) + 3;
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  sync(tick: number, ticksPerMs: number, playing: boolean): void {
    this.anchorTick = tick;
    this.anchorTime = performance.now();
    if (ticksPerMs > 0) this.ticksPerMs = ticksPerMs;
    this.playing = playing;
  }

  get tick(): number {
    return this.playing ? this.anchorTick + (performance.now() - this.anchorTime) * this.ticksPerMs : this.anchorTick;
  }

  get speed(): number {
    return this.ticksPerMs;
  }

  /** Voix entendue (MIDI flottant), ramenée à l'octave de la note la plus proche. */
  set heard(m: number | null) {
    const t = this.tick;
    if (m !== null) {
      const near = this.notes.find((n) => t >= n.tick - 480 && t <= n.tick + n.duration + 480) ?? this.notes.find((n) => n.tick > t);
      const ref = near?.midi ?? (this.lo + this.hi) / 2;
      while (m - ref > 6) m -= 12;
      while (ref - m > 6) m += 12;
    }
    const last = this.trail[this.trail.length - 1];
    if (last && t - last.tick < 30 * this.ticksPerMs) return;
    this.trail.push({ tick: t, m });
    while (this.trail.length && this.trail[0].tick < t - this.past * 1.2) this.trail.shift();
  }

  feedback(note: GameNote, j: Judgment): void {
    this.popups.push({ text: LABEL[j], color: COLORS[j], born: performance.now(), y: note.midi });
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
    const now = this.tick;
    const left = 52;
    const nowX = left + (w - left) * (this.past / (this.past + this.future));
    const x = (tick: number) => nowX + ((tick - now) / (this.past + this.future)) * (w - left);
    const span = this.hi - this.lo;
    const y = (m: number) => h - 22 - ((m - this.lo) / span) * (h - 44);
    const row = (h - 44) / span;
    // Lignes de notes
    g.font = '11px system-ui';
    for (let m = this.lo; m <= this.hi; m++) {
      const natural = ![1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
      g.strokeStyle = natural ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
      g.beginPath();
      g.moveTo(left, y(m));
      g.lineTo(w, y(m));
      g.stroke();
      if (natural) {
        g.fillStyle = 'rgba(238,241,247,0.55)';
        g.fillText(`${solfege(m, false)}${Math.floor(m / 12) - 1}`, 6, y(m) + 4);
      }
    }
    // Barres des notes (épaisses : au moins la largeur de la tolérance)
    const barH = Math.max(24, row * (this.toleranceCents / 50));
    for (const n of this.notes) {
      const x0 = x(n.tick);
      const x1 = x(n.tick + n.duration);
      if (x1 < left || x0 > w) continue;
      const yy = y(n.midi);
      const col = n.judged ? COLORS[n.judged] : n.tick <= now && now <= n.tick + n.duration ? '#ffd166' : 'rgba(255,181,71,0.75)';
      g.fillStyle = col;
      g.globalAlpha = n.judged === 'miss' ? 0.45 : 1;
      roundRect(g, x0 + 1, yy - barH / 2, Math.max(6, x1 - x0 - 2), barH, barH / 2);
      g.fill();
      g.globalAlpha = 1;
      // Syllabe sous la barre
      g.fillStyle = n.tick <= now && now <= n.tick + n.duration ? '#fff' : 'rgba(238,241,247,0.85)';
      g.font = `bold ${n.tick <= now && now <= n.tick + n.duration ? 18 : 15}px system-ui`;
      g.fillText(n.label, x0 + 2, yy + barH / 2 + 17);
    }
    // Ligne « maintenant »
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(nowX, 8);
    g.lineTo(nowX, h - 8);
    g.stroke();
    // Voix : ligne épaisse
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    let prev: { tick: number; m: number } | null = null;
    for (const p of this.trail) {
      if (p.m === null) {
        prev = null;
        continue;
      }
      if (prev && Math.abs(p.m - prev.m) < 2) {
        const target = this.notes.find((n) => p.tick >= n.tick && p.tick <= n.tick + n.duration);
        const off = target ? Math.abs(p.m - target.midi) * 100 : 999;
        g.strokeStyle = off <= this.toleranceCents ? '#4fd1a5' : off <= this.toleranceCents * 2 ? '#5aa9ff' : 'rgba(255,255,255,0.65)';
        g.beginPath();
        g.moveTo(x(prev.tick), y(prev.m));
        g.lineTo(x(p.tick), y(p.m));
        g.stroke();
      }
      prev = { tick: p.tick, m: p.m };
    }
    // Messages de réussite
    const t = performance.now();
    this.popups = this.popups.filter((p) => t - p.born < 900);
    for (const p of this.popups) {
      const k = (t - p.born) / 900;
      g.globalAlpha = 1 - k;
      g.fillStyle = p.color;
      g.font = 'bold 22px system-ui';
      g.fillText(p.text, nowX - 40, y(p.y) - barH - 10 - k * 30);
    }
    g.globalAlpha = 1;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
