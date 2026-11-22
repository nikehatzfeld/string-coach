import { solfege } from '../songs/positions';
import type { MelodicNote } from './recorder-board';

/**
 * Courbe de hauteur en temps réel (voix, ou tout instrument). L'échelle verticale est FIXE
 * (tessiture du morceau ou de l'exercice) : seule la courbe bouge. Jusqu'à deux chanteurs.
 * Vert = juste (dans la tolérance), orange = proche, rouge = loin.
 */
type Pt = { t: number; m: number | null };

export class PitchTrace {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly series: Pt[][] = [[], []];
  private readonly raw: Pt[][] = [[], []];
  private targets: (number | null)[] = [null, null];
  private nextTarget: number | null = null;
  private lo = 55;
  private hi = 72;
  private fixed = false;
  private raf = 0;
  /** Fenêtre visible (ms). */
  windowMs = 8000;
  /** Tolérance de justesse (cents) : largeur des bandes et couleur de la courbe. */
  toleranceCents = 50;
  /** Lissage dans le temps (ms) : médiane des mesures sur cette durée. */
  smoothMs = 150;
  /** Note tenue par l'app (chant à deux), en violet. */
  partner: number | null = null;
  /** Noms affichés à droite pour chaque chanteur. */
  names: string[] = [];

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

  /** Échelle verticale fixe (MIDI), avec une marge d'un ton. */
  setRange(lo: number, hi: number): void {
    this.lo = Math.floor(lo) - 2;
    this.hi = Math.ceil(hi) + 2;
    if (this.hi - this.lo < 10) {
      const mid = (this.lo + this.hi) / 2;
      this.lo = Math.floor(mid - 5);
      this.hi = Math.ceil(mid + 5);
    }
    this.fixed = true;
  }

  /** Note visée (et suivante) ; `singer` = 0 ou 1. */
  show(current: MelodicNote[], next: MelodicNote[] = [], _later: MelodicNote[] = [], singer = 0): void {
    this.targets[singer] = current[0]?.midi ?? null;
    if (singer === 0) this.nextTarget = next[0]?.midi ?? null;
    // Sans échelle fixée : on l'élargit si besoin, sans jamais recentrer.
    const t = this.targets[singer];
    if (t !== null && !this.fixed) {
      if (t < this.lo + 1) this.lo = Math.floor(t) - 2;
      if (t > this.hi - 1) this.hi = Math.ceil(t) + 2;
    }
  }

  /** Hauteur entendue (MIDI flottant) ou null (silence), pour le chanteur 0 ou 1. */
  feed(midi: number | null, time = performance.now(), singer = 0): void {
    const raw = this.raw[singer];
    raw.push({ t: time, m: midi });
    while (raw.length && raw[0].t < time - this.smoothMs) raw.shift();
    const series = this.series[singer];
    const last = series[series.length - 1];
    // Un point toutes les 50 ms au plus : courbe moins nerveuse.
    if (last && time - last.t < 50) return;
    const voiced = raw.filter((p) => p.m !== null).map((p) => p.m as number);
    let m: number | null = voiced.length >= Math.max(1, raw.length / 2) ? voiced.sort((a, b) => a - b)[Math.floor(voiced.length / 2)] : null;
    if (m !== null) {
      // Voix grave une octave sous la note visée (ou hors échelle) : ramenée pour l'affichage.
      const ref = this.targets[singer] ?? (this.lo + this.hi) / 2;
      while (m - ref > 6.5) m -= 12;
      while (ref - m > 6.5) m += 12;
    }
    series.push({ t: time, m });
    while (series.length && series[0].t < time - this.windowMs) series.shift();
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
    const lo = this.lo;
    const span = this.hi - this.lo;
    const y = (m: number) => h - ((m - lo) / span) * h;
    const left = 54;
    const rowH = h / span;
    g.font = `${Math.min(13, Math.max(9, rowH * 0.7))}px system-ui`;
    for (let m = Math.ceil(lo); m <= this.hi; m++) {
      const pc = ((m % 12) + 12) % 12;
      const natural = ![1, 3, 6, 8, 10].includes(pc);
      g.strokeStyle = natural ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)';
      g.beginPath();
      g.moveTo(left, y(m));
      g.lineTo(w, y(m));
      g.stroke();
      if (natural || rowH > 14) {
        g.fillStyle = natural ? 'rgba(238,241,247,0.75)' : 'rgba(238,241,247,0.35)';
        g.fillText(`${solfege(m, false)}${Math.floor(m / 12) - 1}`, 6, y(m) + 4);
      }
    }
    const band = (m: number, color: string) => {
      const t = this.toleranceCents / 100;
      g.fillStyle = color;
      const hh = Math.max(16, y(m - t) - y(m + t));
      g.fillRect(left, y(m) - hh / 2, w - left, hh);
    };
    if (this.nextTarget !== null && this.nextTarget !== this.targets[0]) band(this.nextTarget, 'rgba(79,209,165,0.08)');
    if (this.partner !== null) band(this.partner, 'rgba(170,120,255,0.25)');
    if (this.targets[1] !== null) band(this.targets[1]!, 'rgba(90,169,255,0.25)');
    if (this.targets[0] !== null) band(this.targets[0]!, 'rgba(255,181,71,0.3)');
    const now = performance.now();
    const x = (t: number) => left + ((t - (now - this.windowMs)) / this.windowMs) * (w - left - 12);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    this.series.forEach((pts, s) => {
      g.lineWidth = 9;
      let prev: { t: number; m: number } | null = null;
      for (const p of pts) {
        if (p.m === null) {
          prev = null;
          continue;
        }
        if (prev && Math.abs(p.m - prev.m) < 2) {
          const ref = this.targets[s] ?? Math.round(p.m);
          const off = Math.abs(p.m - ref) * 100;
          const ok = off <= this.toleranceCents;
          const near = off <= this.toleranceCents * 2;
          g.strokeStyle = s === 0 ? (ok ? '#4fd1a5' : near ? '#ffb547' : '#ff6b6b') : ok ? '#5aa9ff' : near ? '#b48cff' : '#ff6bd5';
          g.beginPath();
          g.moveTo(x(prev.t), y(prev.m));
          g.lineTo(x(p.t), y(p.m));
          g.stroke();
        }
        prev = { t: p.t, m: p.m };
      }
      const last = pts[pts.length - 1];
      if (last?.m != null) {
        g.fillStyle = s === 0 ? '#fff' : '#5aa9ff';
        g.beginPath();
        g.arc(x(last.t), y(last.m), 7, 0, Math.PI * 2);
        g.fill();
      }
    });
    g.fillStyle = 'rgba(238,241,247,0.65)';
    const labels = this.names.length ? this.names : this.label ? [this.label] : [];
    labels.forEach((l, i) => {
      g.fillStyle = i === 0 ? 'rgba(238,241,247,0.7)' : '#5aa9ff';
      g.fillText(l, w - g.measureText(l).width - 8, 14 + i * 16);
    });
  }
}
